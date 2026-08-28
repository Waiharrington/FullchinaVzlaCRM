import { useState, useEffect, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/auth-context'
import { MoneyWithBcv } from '../components/MoneyWithBcv'
import { StyledSelect } from '../components/StyledSelect'
import { formatProductTitle } from '../lib/textFormat'
import {
  getCredits,
  getCreditPayments,
  addCreditPayment,
  createCustomer,
  updateCustomer,
  getCustomers,
  getCustomerOrders,
  getCustomerPurchaseMetrics,
  type Credit as CreditType,
  type CreditPayment,
  type Customer,
  type CustomerOrderSummary,
  type CustomerPurchaseMetric,
} from '../lib/dataService'
import {
  Search,
  Users,
  Calendar,
  User,
  Plus,
  Crown,
  CreditCard,
  DollarSign,
  Download,
  Eye,
  Edit2,
  MoreVertical,
  X,
  Phone,
  Gift,
  MessageCircle,
  ShoppingBag,
  Ticket,
  MapPin,
  ArrowLeft,
  Tag,
  Info,
} from 'lucide-react'
import './Clientes.css'

// Cache a nivel de módulo: al volver a esta pestaña se muestran los datos de
// la última visita al instante, sin el parpadeo de "Cargando...", mientras
// se refrescan en segundo plano.
let creditsCache: CreditType[] | null = null

interface CustomerRow {
  id: string
  initials: string
  avatarBg: string
  name: string
  phone: string
  identification: string
  identificationStatus: 'verified_format' | 'legacy_review' | 'missing'
  lastPurchase: string
  totalPurchased: number
  pendingBalance: number
  status: 'Crédito' | 'Frecuente' | 'Activo' | 'Inactivo'
}

function formatDate(value: string): string {
  if (!value) return '—'
  const d = new Date(value.length <= 10 ? `${value}T12:00:00` : value)
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('es-VE', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function formatDateTime(value: string): string {
  if (!value) return '—'
  const date = new Date(value)
  return Number.isNaN(date.getTime())
    ? '—'
    : date.toLocaleString('es-VE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function formatUsdText(value: number): string {
  return new Intl.NumberFormat('es-VE', { style: 'currency', currency: 'USD' }).format(value)
}

const normalizeCustomerName = (value: string) => value.trim().toLocaleLowerCase('es-VE')

const ORDER_TYPE_LABELS: Record<string, string> = {
  'dine-in': 'Mesa', takeaway: 'Para llevar', delivery: 'Delivery',
}

const FULFILLMENT_LABELS: Record<string, string> = {
  new: 'Nueva', preparing: 'En preparación', ready: 'Lista', delivered: 'Entregada', cancelled: 'Cancelada',
}

function formatBirthday(value: string): string {
  if (!value) return ''
  const d = new Date(`${value.slice(0, 10)}T12:00:00`)
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('es-VE', { day: 'numeric', month: 'long' })
}

const PAYMENT_LABELS: Record<string, string> = {
  cash: 'Efectivo', mobile: 'Pago móvil', card: 'Punto',
  transfer: 'Transferencia', binance: 'Binance', zelle: 'Zelle', other: 'Otro',
}

function classifyIdentification(value: string): CustomerRow['identificationStatus'] {
  const normalized = value.trim()
  if (!normalized) return 'missing'
  const digits = normalized.replace(/\D/g, '')
  const acceptedFormat = /^(?:[VE]-?)?\d{6,10}$/i.test(normalized)
  const repeatedPlaceholder = /^(\d)\1+$/.test(digits)
  return acceptedFormat && !repeatedPlaceholder ? 'verified_format' : 'legacy_review'
}

export function Clientes() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [credits, setCredits] = useState<CreditType[]>(creditsCache ?? [])

  // Selected customer for Profile View matching target screenshot
  const [selectedClient, setSelectedClient] = useState<CustomerRow | null>(null)
  const [customers, setCustomers] = useState<Customer[]>([])
  const [purchaseMetrics, setPurchaseMetrics] = useState<CustomerPurchaseMetric[]>([])

  // Filters state
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [identityFilter, setIdentityFilter] = useState('all')

  // Modals
  const [showNewModal, setShowNewModal] = useState(false)
  const [newClientName, setNewClientName] = useState('')
  const [newClientLastName, setNewClientLastName] = useState('')
  const [newClientPhone, setNewClientPhone] = useState('')
  const [newClientAddress, setNewClientAddress] = useState('')
  const [birthMonth, setBirthMonth] = useState('')
  const [birthDay, setBirthDay] = useState('')

  // Edit client modal state
  const [editClientId, setEditClientId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editPhone, setEditPhone] = useState('')
  const [editIdentification, setEditIdentification] = useState('')
  const [editAddress, setEditAddress] = useState('')
  const [editBirthMonth, setEditBirthMonth] = useState('')
  const [editBirthDay, setEditBirthDay] = useState('')
  const [editSaving, setEditSaving] = useState(false)
  const [editError, setEditError] = useState('')

  const [paymentModal, setPaymentModal] = useState<CreditType | null>(null)
  const [paymentAmount, setPaymentAmount] = useState('')
  const [showCobrarModal, setShowCobrarModal] = useState(false)
  const [customerOrders, setCustomerOrders] = useState<CustomerOrderSummary[]>([])
  const [customerCreditPayments, setCustomerCreditPayments] = useState<CreditPayment[]>([])
  const [profileLoading, setProfileLoading] = useState(false)
  const [profileError, setProfileError] = useState('')

  useEffect(() => {
    if (!selectedClient) {
      setCustomerOrders([])
      setCustomerCreditPayments([])
      setProfileError('')
      return
    }

    let cancelled = false
    const customerCredits = credits.filter(
      (credit) => credit.customerId === selectedClient.id
        || (!credit.customerId && normalizeCustomerName(credit.customerName) === normalizeCustomerName(selectedClient.name)),
    )
    setProfileLoading(true)
    setProfileError('')
    Promise.all([
      getCustomerOrders(selectedClient.id, selectedClient.name),
      Promise.all(customerCredits.map((credit) => getCreditPayments(credit.id))),
    ])
      .then(([orders, paymentGroups]) => {
        if (cancelled) return
        setCustomerOrders(orders)
        setCustomerCreditPayments(paymentGroups.flat().sort((a, b) => b.createdAt.localeCompare(a.createdAt)))
      })
      .catch((error) => {
        if (cancelled) return
        console.error('Error cargando la ficha real del cliente:', error)
        setCustomerOrders([])
        setCustomerCreditPayments([])
        setProfileError('No se pudo cargar toda la actividad del cliente.')
      })
      .finally(() => { if (!cancelled) setProfileLoading(false) })

    return () => { cancelled = true }
  }, [selectedClient, credits])

  const fetchCredits = useCallback(async () => {
    try {
      const [creditData, customerData, metricData] = await Promise.all([
        getCredits(),
        getCustomers(),
        getCustomerPurchaseMetrics(),
      ])
      setCredits(creditData)
      setCustomers(customerData)
      setPurchaseMetrics(metricData)
      creditsCache = creditData
    } catch (e) {
      console.error('Error cargando créditos:', e)
    }
  }, [])

  useEffect(() => {
    fetchCredits()
  }, [fetchCredits])

  const handleSaveClient = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newClientName.trim()) return

    const fullName = `${newClientName.trim()} ${newClientLastName.trim()}`.trim()
    const birthDate = birthMonth && birthDay ? `2000-${birthMonth.padStart(2, '0')}-${birthDay.padStart(2, '0')}` : undefined
    let saved: Customer
    try {
      saved = await createCustomer({
        name: fullName,
        phone: newClientPhone.trim(),
        address: newClientAddress.trim() || undefined,
        birthDate,
      })
    } catch (err) {
      console.error('Error guardando cliente:', err)
      alert('No se pudo guardar el cliente. Revisa los datos e intenta de nuevo.')
      return
    }
    const newClientObj: CustomerRow = {
      id: saved.id,
      initials: (newClientName[0] + (newClientLastName[0] || '')).toUpperCase(),
      avatarBg: '#dc2626',
      name: fullName,
      phone: saved.phone,
      identification: saved.identification,
      identificationStatus: classifyIdentification(saved.identification),
      lastPurchase: new Date().toLocaleDateString('es-VE', { day: '2-digit', month: '2-digit', year: 'numeric' }),
      totalPurchased: 0.00,
      pendingBalance: 0.00,
      status: 'Activo',
    }

    setCustomers(prev => [saved, ...prev])
    setNewClientName('')
    setNewClientLastName('')
    setNewClientPhone('')
    setNewClientAddress('')
    setBirthMonth('')
    setBirthDay('')
    setShowNewModal(false)
    setSelectedClient(newClientObj)
  }

  const openEditCustomer = (c: Customer) => {
    setEditClientId(c.id)
    setEditName(c.name)
    setEditPhone(c.phone ?? '')
    setEditIdentification(c.identification ?? '')
    setEditAddress(c.address ?? '')
    const bd = (c.birthday || '').slice(0, 10)
    if (bd) {
      const [, m, d] = bd.split('-')
      setEditBirthMonth(String(Number(m)))
      setEditBirthDay(String(Number(d)))
    } else {
      setEditBirthMonth('')
      setEditBirthDay('')
    }
    setEditError('')
  }

  const handleUpdateClient = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editClientId || !editName.trim()) return
    const birthDate = editBirthMonth && editBirthDay ? `2000-${editBirthMonth.padStart(2, '0')}-${editBirthDay.padStart(2, '0')}` : undefined
    setEditSaving(true)
    setEditError('')
    try {
      const updated = await updateCustomer(editClientId, {
        name: editName.trim(),
        phone: editPhone.trim(),
        identification: editIdentification.trim(),
        address: editAddress.trim() || undefined,
        birthDate,
      })
      setCustomers(prev => prev.map(c => c.id === updated.id ? updated : c))
      setSelectedClient(prev => prev && prev.id === updated.id ? {
        ...prev,
        name: updated.name,
        phone: updated.phone,
        identification: updated.identification,
        identificationStatus: classifyIdentification(updated.identification),
      } : prev)
      setEditClientId(null)
    } catch (err) {
      console.error('Error actualizando cliente:', err)
      setEditError('No se pudo actualizar el cliente. Revisa los datos e intenta de nuevo.')
    } finally {
      setEditSaving(false)
    }
  }

  const handlePayment = async (e: React.FormEvent) => {
    e.preventDefault()
    if (paymentModal && paymentAmount && parseFloat(paymentAmount) > 0 && user) {
      try {
        await addCreditPayment({
          creditId: paymentModal.id,
          amount: parseFloat(paymentAmount),
          userId: user.id,
        })
        setPaymentModal(null)
        setPaymentAmount('')
        fetchCredits()
      } catch (e) {
        console.error('Error registrando abono:', e)
        alert('Error al registrar abono')
      }
    }
  }

  // Clientes reales importados, enriquecidos con saldos de crédito actuales.
  const displayRows = useMemo(() => {
    const rows: CustomerRow[] = customers.map((customer, index) => {
      const customerCredits = credits.filter(item => item.customerId === customer.id || (!item.customerId && normalizeCustomerName(item.customerName) === normalizeCustomerName(customer.name)))
      const metric = purchaseMetrics.find(item => item.customerId === customer.id || (!item.customerId && normalizeCustomerName(item.customerName) === normalizeCustomerName(customer.name)))
      const pendingBalance = customerCredits.reduce((sum, credit) => sum + credit.balancePending, 0)
      const parts = customer.name.split(' ')
      return {
        id: customer.id, initials: `${parts[0]?.[0] || 'C'}${parts[1]?.[0] || ''}`.toUpperCase(),
        avatarBg: index % 2 === 0 ? '#dc2626' : '#d97706', name: customer.name,
        phone: customer.phone, identification: customer.identification,
        identificationStatus: classifyIdentification(customer.identification),
        lastPurchase: metric?.lastPurchase ? formatDate(metric.lastPurchase) : customer.lastVisit ? formatDate(customer.lastVisit) : 'Sin compras enlazadas',
        totalPurchased: metric?.totalPurchased ?? 0, pendingBalance,
        status: !customer.isActive ? 'Inactivo' : pendingBalance > 0 ? 'Crédito' : customer.totalVisits >= 5 ? 'Frecuente' : 'Activo',
      }
    })

    return rows.filter((r) => {
      const matchSearch = r.name.toLowerCase().includes(searchTerm.toLowerCase()) || r.phone.includes(searchTerm) || r.identification.toLowerCase().includes(searchTerm.toLowerCase())
      const matchStatus = statusFilter === 'all' || r.status.toLowerCase() === statusFilter.toLowerCase()
      const matchIdentity = identityFilter === 'all' || r.identificationStatus === identityFilter
      return matchSearch && matchStatus && matchIdentity
    })
  }, [credits, customers, purchaseMetrics, searchTerm, statusFilter, identityFilter])

  const totalOutstanding = useMemo(() => {
    return credits.reduce((acc, c) => acc + c.balancePending, 0)
  }, [credits])

  const frequentCustomers = useMemo(() => customers.filter((customer) => customer.totalVisits >= 5).length, [customers])
  const activeCreditsCount = useMemo(() => credits.filter((credit) => credit.balancePending > 0).length, [credits])
  const customersWithDebt = useMemo(() => new Set(
    credits.filter((credit) => credit.balancePending > 0).map((credit) => credit.customerId ?? `name:${normalizeCustomerName(credit.customerName)}`),
  ).size, [credits])


  // ═══════════════════════════════════════════════════════════════════════════
  // FICHA DE CLIENTE / PERFIL DEL CLIENTE VIEW (Matching Target Screenshot)
  // ═══════════════════════════════════════════════════════════════════════════
  if (selectedClient) {
    const fullCustomer = customers.find((c) => c.id === selectedClient.id) ?? null
    const customerCredits = credits.filter((credit) => credit.customerId === selectedClient.id || (!credit.customerId && normalizeCustomerName(credit.customerName) === normalizeCustomerName(selectedClient.name)))
    const ordersCount = customerOrders.length
    const totalPurchased = customerOrders.reduce((s, o) => s + o.total, 0)
    const avgTicket = ordersCount > 0 ? totalPurchased / ordersCount : 0
    const pendingBalance = customerCredits.reduce((sum, credit) => sum + credit.balancePending, 0)
    const creditedTotal = customerCredits.reduce((sum, credit) => sum + credit.totalAmount, 0)
    const paidTowardCredit = customerCredits.reduce((sum, credit) => sum + credit.totalPaid, 0)
    const activeCredits = customerCredits.filter((credit) => credit.balancePending > 0).length
    const lastCreditPayment = customerCreditPayments[0] ?? null
    const isFrecuente = (fullCustomer?.totalVisits ?? 0) >= 5
    const birthdayText = formatBirthday(fullCustomer?.birthday ?? '')
    const favoriteProducts = [...customerOrders.reduce((products, order) => {
      order.items.forEach((item) => {
        const key = item.productName.trim().toLocaleLowerCase('es-VE')
        const current = products.get(key)
        if (current) current.quantity += item.quantity
        else products.set(key, { name: item.productName, quantity: item.quantity })
      })
      return products
    }, new Map<string, { name: string; quantity: number }>()).values()]
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 4)
    const recentActivity = [
      ...customerOrders.map((order) => ({
        id: `order-${order.id}`,
        type: 'order' as const,
        title: `Pedido #FC-${String(order.orderNumber).padStart(6, '0')} · ${formatUsdText(order.total)}`,
        createdAt: order.createdAt,
      })),
      ...customerCreditPayments.map((payment) => ({
        id: `payment-${payment.id}`,
        type: 'payment' as const,
        title: `Abono a crédito · ${formatUsdText(payment.amount)}`,
        createdAt: payment.createdAt,
      })),
      ...(fullCustomer?.createdAt ? [{
        id: `created-${fullCustomer.id}`,
        type: 'created' as const,
        title: 'Cliente registrado en el sistema',
        createdAt: fullCustomer.createdAt,
      }] : []),
    ].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 5)

    return (
      <div className="page animate-fade-in">

        {/* Breadcrumb & Title */}
        <div className="profile-breadcrumb-wrap">
          <div className="profile-breadcrumbs">
            <button className="breadcrumb-link" onClick={() => setSelectedClient(null)}>
              <ArrowLeft size={13} style={{ marginRight: 4 }} /> Clientes
            </button>
            <span className="breadcrumb-sep">›</span>
            <span className="breadcrumb-current">Perfil del cliente</span>
          </div>
          <div className="profile-title-with-back">
            <button
              className="btn-back-square"
              onClick={() => setSelectedClient(null)}
              title="Volver a la lista de clientes"
              aria-label="Volver a la lista de clientes"
            >
              <ArrowLeft size={18} />
            </button>
            <h1 className="profile-page-title">Perfil del cliente</h1>
          </div>
        </div>

        {/* HERO CLIENT CARD (With all client data integrated) */}
        <div className="profile-hero-card">
          <div className="hero-left-info">
            <div className="hero-avatar-circle" style={{ backgroundColor: selectedClient.avatarBg }}>
              {selectedClient.initials}
            </div>
            <div className="hero-text-details">
              <div className="hero-name-row">
                <h2 className="hero-client-name">{selectedClient.name}</h2>
              </div>
              <div className="hero-meta-tags-row flex-wrap">
                <span className="hero-phone-wrap">
                  <Phone size={13} /> {selectedClient.phone || 'Sin teléfono'}
                  <button
                    className="btn-wsap-icon-inline"
                    title={selectedClient.phone ? 'Enviar WhatsApp' : 'Cliente sin teléfono'}
                    disabled={!selectedClient.phone}
                    onClick={() => {
                      const phone = selectedClient.phone.replace(/\D/g, '')
                      if (phone) window.open(`https://wa.me/${phone.startsWith('58') ? phone : `58${phone.replace(/^0/, '')}`}`, '_blank', 'noopener,noreferrer')
                    }}
                  ><MessageCircle size={12} /></button>
                </span>
                <span className="meta-divider">|</span>
                <span className={`identity-badge ${selectedClient.identificationStatus}`}>
                  {selectedClient.identificationStatus === 'verified_format'
                    ? `Cédula: ${selectedClient.identification}`
                    : selectedClient.identificationStatus === 'legacy_review'
                    ? 'Identificación por revisar'
                    : 'Sin identificación'}
                </span>
                {isFrecuente && <><span className="meta-divider">|</span><span className="badge-tag-purple"><Tag size={13} /> Cliente Frecuente</span></>}
                <span className="meta-divider">|</span>
                <span className={fullCustomer?.isActive === false ? 'badge-tag-red' : 'badge-tag-green'}>
                  {fullCustomer?.isActive === false ? 'Inactivo' : 'Activo'}
                </span>
                <span className="meta-divider">|</span>
                <span className="hero-detail-tag" style={{ whiteSpace: 'nowrap' }}>
                  <Calendar size={13} /> Reg: {formatDate(fullCustomer?.createdAt ?? '')}
                  {birthdayText && <><Gift size={13} style={{ marginLeft: 10 }} /> {birthdayText}</>}
                </span>
              </div>
            </div>
          </div>

          <div className="hero-right-actions">
            <button className="btn-hero-dark" onClick={() => { if (fullCustomer) openEditCustomer(fullCustomer) }}>
              <Edit2 size={16} /> Editar cliente
            </button>
            <button className="btn-hero-red" onClick={() => navigate('/caja', { state: { customerName: selectedClient.name } })}>
              <Plus size={16} /> Nuevo pedido
            </button>
          </div>
        </div>

        {/* 5 KPI METRICS BANNER */}
        <div className="profile-kpi-banner">
          {/* Metric 1 */}
          <div className="kpi-banner-item">
            <div className="kpi-banner-icon red"><DollarSign size={20} /></div>
            <div className="kpi-banner-info">
              <span className="kpi-banner-label">Total comprado</span>
              <MoneyWithBcv usd={totalPurchased} className="kpi-banner-val" align="start" compact />
              <span className="kpi-banner-sub">En {ordersCount} pedido{ordersCount === 1 ? '' : 's'}</span>
            </div>
          </div>

          {/* Metric 2 */}
          <div className="kpi-banner-item">
            <div className="kpi-banner-icon orange"><ShoppingBag size={20} /></div>
            <div className="kpi-banner-info">
              <span className="kpi-banner-label">Pedidos realizados</span>
              <span className="kpi-banner-val">{ordersCount}</span>
              <span className="kpi-banner-sub">Histórico</span>
            </div>
          </div>

          {/* Metric 3 */}
          <div className="kpi-banner-item">
            <div className="kpi-banner-icon gold"><Ticket size={20} /></div>
            <div className="kpi-banner-info">
              <span className="kpi-banner-label">Ticket promedio</span>
              <MoneyWithBcv usd={avgTicket} className="kpi-banner-val" align="start" compact />
              <span className="kpi-banner-sub">Promedio por pedido</span>
            </div>
          </div>

          {/* Metric 4 */}
          <div className="kpi-banner-item">
            <div className="kpi-banner-icon dark-red"><CreditCard size={20} /></div>
            <div className="kpi-banner-info">
              <span className="kpi-banner-label">Saldo pendiente</span>
              <MoneyWithBcv usd={pendingBalance} className="kpi-banner-val" align="start" compact />
              <span className="kpi-banner-sub gold">{activeCredits} crédito{activeCredits === 1 ? '' : 's'} activo{activeCredits === 1 ? '' : 's'}</span>
            </div>
          </div>

          {/* Metric 5 */}
          <div className="kpi-banner-item">
            <div className="kpi-banner-icon user-orange"><User size={20} /></div>
            <div className="kpi-banner-info">
              <span className="kpi-banner-label">Cliente desde</span>
              <span className="kpi-banner-val">{formatDate(fullCustomer?.createdAt ?? '')}</span>
              <span className="kpi-banner-sub">Fecha de registro</span>
            </div>
          </div>
        </div>

        {/* MAIN 2-COLUMNS GRID (Wider History Table on Left + Stacked Right Column) */}
        <div className="profile-grid-2cols">
          {/* LEFT COL: Historial de pedidos */}
          <div className="profile-card-col center-col">
            <div className="profile-card-header">
              <h3 className="profile-card-title">Historial de pedidos</h3>
              <span className="profile-data-caption">{ordersCount} registrado{ordersCount === 1 ? '' : 's'}</span>
            </div>

            {profileError && <div className="profile-data-message error">{profileError}</div>}

            <div className="table-responsive-wrapper">
              <table className="profile-history-table">
                <thead>
                  <tr>
                    <th># Pedido</th>
                    <th>Fecha</th>
                    <th>Tipo</th>
                    <th>Productos</th>
                    <th>Total</th>
                    <th>Estado</th>
                    <th>Pago</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {profileLoading ? (
                    <tr><td colSpan={8} className="profile-empty-state">Cargando actividad real…</td></tr>
                  ) : customerOrders.length === 0 ? (
                    <tr><td colSpan={8} className="profile-empty-state">Este cliente todavía no tiene pedidos enlazados.</td></tr>
                  ) : customerOrders.map((order) => (
                    <tr key={order.id}>
                      <td className="font-bold text-white">#FC-{String(order.orderNumber).padStart(6, '0')}</td>
                      <td className="date-sub-text">{formatDateTime(order.createdAt)}</td>
                      <td>
                        <span className="order-type-pill">
                          {(ORDER_TYPE_LABELS[order.orderType] ?? order.orderType) || 'Sin tipo'}
                        </span>
                      </td>
                      <td className="products-cell">{order.itemsText || 'Sin detalle'}</td>
                      <td><MoneyWithBcv usd={order.total} usdClassName="font-bold" compact /></td>
                      <td>
                        <span className={`status-pill-sub ${order.fulfillmentStatus === 'delivered' ? 'green' : 'gold'}`}>
                          {(FULFILLMENT_LABELS[order.fulfillmentStatus] ?? order.fulfillmentStatus) || order.status}
                        </span>
                      </td>
                      <td>
                        <span className="payment-method-tag">
                          {order.paymentMethods.length > 0
                            ? order.paymentMethods.map((method) => PAYMENT_LABELS[method] ?? method).join(' + ')
                            : 'Sin cobrar'}
                        </span>
                      </td>
                      <td>
                        <span className="date-sub-text">{order.status === 'paid' ? 'Pagado' : 'Pendiente'}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* RIGHT COL: Stacked Cards (Créditos + Actividad) */}
          <div className="profile-card-col right-col">
            {/* Top Right Card: Créditos */}
            <div className="side-credit-card">
              <div className="side-card-header">
                <h3 className="profile-card-title">Créditos / Cuentas por cobrar</h3>
                <span className="profile-data-caption">Datos registrados</span>
              </div>

              <div className="credit-metrics-grid mt-2">
                <div className="credit-metric-box">
                  <span className="credit-label">Saldo actual</span>
                  <MoneyWithBcv usd={pendingBalance} className="credit-val-big text-red" align="start" compact />
                </div>
                <div className="credit-metric-box">
                  <span className="credit-label">Créditos activos</span>
                  <span className="credit-val-big">{activeCredits}</span>
                </div>
              </div>

              <div className="credit-due-breakdown mt-3">
                <div className="due-box">
                  <span className="due-label">Crédito emitido</span>
                  <MoneyWithBcv usd={creditedTotal} className="due-val" align="start" compact />
                  <span className="due-sub">{customerCredits.length} registro{customerCredits.length === 1 ? '' : 's'}</span>
                </div>
                <div className="due-box">
                  <span className="due-label">Total abonado</span>
                  <MoneyWithBcv usd={paidTowardCredit} className="due-val text-green" align="start" compact />
                  <span className="due-sub">Abonos confirmados</span>
                </div>
              </div>

              <div className="last-payment-received-row mt-3">
                <div className="lp-left">
                  <span className="lp-label">Último pago recibido</span>
                  <span className="lp-date">{lastCreditPayment ? formatDateTime(lastCreditPayment.createdAt) : 'Sin abonos'}</span>
                </div>
                <div className="lp-right">
                  {lastCreditPayment && <MoneyWithBcv usd={lastCreditPayment.amount} className="lp-amount text-green font-bold" compact />}
                  <span className="lp-badge">Registrado en el sistema</span>
                </div>
              </div>
            </div>

            {/* Bottom Right Card: Actividad reciente */}
            <div className="side-activity-card mt-3">
              <div className="side-card-header">
                <h3 className="profile-card-title">Actividad reciente</h3>
                <span className="profile-data-caption">{recentActivity.length} evento{recentActivity.length === 1 ? '' : 's'}</span>
              </div>

              <div className="activity-timeline-vertical mt-2">
                {recentActivity.length === 0 && <div className="profile-empty-state compact">Sin actividad registrada.</div>}
                {recentActivity.map((activity) => (
                  <div className="activity-item" key={activity.id}>
                    <span className={`act-dot ${activity.type === 'order' ? 'green' : activity.type === 'payment' ? 'purple' : 'red'}`}>
                      {activity.type === 'order' ? <ShoppingBag size={12} /> : activity.type === 'payment' ? <DollarSign size={12} /> : <User size={12} />}
                    </span>
                    <div className="act-info">
                      <span className="act-title">{activity.title}</span>
                      <span className="act-time">{formatDateTime(activity.createdAt)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* BOTTOM SECTION: Productos favoritos + Dirección principal */}
        <div className="profile-bottom-grid mt-4">
          {/* Left: Productos favoritos */}
          <div className="profile-bottom-card left-favs">
            <div className="profile-card-header">
              <h3 className="profile-card-title">Productos favoritos</h3>
              <span className="profile-data-caption">Según pedidos enlazados</span>
            </div>

            <div className="favorites-cards-grid mt-2">
              {favoriteProducts.length === 0 && <div className="profile-empty-state favorite-empty">Sin productos suficientes para calcular favoritos.</div>}
              {favoriteProducts.map((favorite, index) => (
                <div key={favorite.name} className="favorite-food-card real-favorite">
                  <div className="fav-thumb-area real-favorite-rank">
                    <span className="fav-rank-badge">#{index + 1}</span>
                    <ShoppingBag size={24} />
                  </div>
                  <div className="fav-card-body">
                    <span className="fav-food-title">{formatProductTitle(favorite.name)}</span>
                    <span className="fav-orders-sub">{favorite.quantity} unidad{favorite.quantity === 1 ? '' : 'es'} pedida{favorite.quantity === 1 ? '' : 's'}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Right: Dirección principal */}
          <div className="profile-bottom-card right-address">
            <div className="profile-card-header">
              <div className="address-header-title">
                <MapPin size={16} className="text-red" />
                <span>Dirección principal</span>
              </div>
              <span className="profile-data-caption">Dato del cliente</span>
            </div>

            <div className="address-content-box mt-2">
              {fullCustomer?.address
                ? <span className="address-line-main">{fullCustomer.address}</span>
                : <span className="profile-empty-state compact">Sin dirección registrada.</span>}
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // CLIENTS TABLE LIST VIEW
  // ═══════════════════════════════════════════════════════════════════════════

  return (
    <div className="page animate-fade-in">

      {/* Page Header */}
      <div className="clientes-page-header">
        <div className="header-title-wrap">
          <div className="header-icon-circle">
            <User size={22} />
          </div>
          <div>
            <h1 className="clientes-title">Clientes</h1>
            <p className="clientes-subtitle">Gestiona tu base de clientes, créditos y actividad de compra.</p>
          </div>
        </div>
        <button className="btn-nuevo-cliente-red" onClick={() => setShowNewModal(true)}>
          <Plus size={18} /> Nuevo cliente
        </button>
      </div>

      {/* 4 Summary KPI Cards */}
      <div className="clientes-kpi-grid">
        <div className="kpi-card-dark">
          <div className="kpi-icon-circle-box red">
            <Users size={22} />
          </div>
          <div className="kpi-content-box">
            <span className="kpi-label-sm">Total clientes</span>
            <span className="kpi-value-lg">{customers.length}</span>
            <span className="kpi-sub-tag green">Base registrada</span>
          </div>
        </div>

        <div className="kpi-card-dark">
          <div className="kpi-icon-circle-box gold">
            <Crown size={22} />
          </div>
          <div className="kpi-content-box">
            <span className="kpi-label-sm">Clientes frecuentes</span>
            <span className="kpi-value-lg">{frequentCustomers}</span>
            <span className="kpi-sub-tag orange">5 o más visitas</span>
          </div>
        </div>

        <div className="kpi-card-dark">
          <div className="kpi-icon-circle-box orange">
            <CreditCard size={22} />
          </div>
          <div className="kpi-content-box">
            <span className="kpi-label-sm">Créditos activos</span>
            <span className="kpi-value-lg">{activeCreditsCount}</span>
            <span className="kpi-sub-tag gold-text">Con saldo pendiente</span>
          </div>
        </div>

        <div
          className="kpi-card-dark clickable-kpi"
          role="button"
          tabIndex={0}
          title="Ver cuentas por cobrar"
          onClick={() => setShowCobrarModal(true)}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setShowCobrarModal(true) } }}
        >
          <div className="kpi-icon-circle-box dark-red">
            <DollarSign size={22} />
          </div>
          <div className="kpi-content-box">
            <span className="kpi-label-sm">Pendientes por cobrar</span>
            <MoneyWithBcv usd={totalOutstanding} className="kpi-value-lg" align="start" compact />
            <span className="kpi-sub-tag red-text">De {customersWithDebt} cliente{customersWithDebt === 1 ? '' : 's'}</span>
          </div>
        </div>
      </div>

      {/* Main Content Layout: Left Table + Right Sidebar Cards */}
      <div className="clientes-main-layout">
        {/* LEFT COLUMN: Customers Data Table Card */}
        <div className="clientes-table-card">
          <div className="table-filter-bar">
            <div className="filter-search-box">
              <Search size={16} className="filter-search-icon" />
              <input
                type="text"
                placeholder="Buscar cliente..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="filter-search-input"
              />
            </div>

            <div className="filter-dropdown-wrap">
              <span className="dropdown-label">Estado</span>
              <StyledSelect
                className="filter-select"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="all">Todos</option>
                <option value="crédito">Crédito</option>
                <option value="frecuente">Frecuente</option>
                <option value="activo">Activo</option>
                <option value="inactivo">Inactivo</option>
              </StyledSelect>
            </div>

            <div className="filter-dropdown-wrap">
              <span className="dropdown-label">Identificación</span>
              <StyledSelect
                className="filter-select"
                value={identityFilter}
                onChange={(e) => setIdentityFilter(e.target.value)}
              >
                <option value="all">Todas</option>
                <option value="verified_format">Cédula</option>
                <option value="legacy_review">Por revisar</option>
                <option value="missing">Sin identificación</option>
              </StyledSelect>
            </div>

            <button className="btn-export-dark">
              <Download size={15} /> Exportar
            </button>
          </div>

          <div className="table-responsive-wrapper">
            <table className="clientes-custom-table">
              <thead>
                <tr>
                  <th>Cliente</th>
                  <th>Teléfono</th>
                  <th>Identificación</th>
                  <th>Última compra</th>
                  <th>Total comprado</th>
                  <th>Saldo pendiente</th>
                  <th>Estado</th>
                  <th style={{ textAlign: 'center' }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {displayRows.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="empty-td-row">No se encontraron clientes que coincidan con los filtros.</td>
                  </tr>
                ) : (
                  displayRows.map((row) => (
                    <tr key={row.id} className="clickable-row" onClick={() => setSelectedClient(row)}>
                      <td>
                        <div className="client-cell-wrap">
                          <span className="client-avatar-badge" style={{ backgroundColor: row.avatarBg }}>
                            {row.initials}
                          </span>
                          <span className="client-name-text">{row.name}</span>
                        </div>
                      </td>
                      <td className="phone-td">{row.phone}</td>
                      <td>
                        <div className="identity-cell">
                          {row.identificationStatus === 'legacy_review' ? (
                            <small className="identity-badge legacy_review">Revisar</small>
                          ) : (
                            <>
                              <span>{row.identification || '—'}</span>
                              <small className={`identity-badge ${row.identificationStatus}`}>
                                {row.identificationStatus === 'verified_format' ? 'Cédula' : 'Sin dato'}
                              </small>
                            </>
                          )}
                        </div>
                      </td>
                      <td className="date-td">{row.lastPurchase}</td>
                      <td className="amount-td"><MoneyWithBcv usd={row.totalPurchased} usdClassName="font-bold" compact /></td>
                      <td className="amount-td"><MoneyWithBcv usd={row.pendingBalance} className={row.pendingBalance > 0 ? 'text-red' : 'text-green'} usdClassName="font-bold" compact /></td>
                      <td>
                        <span className={`status-badge-pill ${row.status.toLowerCase()}`}>
                          {row.status}
                        </span>
                      </td>
                      <td>
                        <div className="actions-flex-cell" onClick={(e) => e.stopPropagation()}>
                          <button className="icon-action-btn" title="Ver perfil del cliente" onClick={() => setSelectedClient(row)}>
                            <Eye size={15} />
                          </button>
                          <button className="icon-action-btn" title="Editar cliente" onClick={() => { const c = customers.find(x => x.id === row.id); if (c) openEditCustomer(c) }}>
                            <Edit2 size={15} />
                          </button>
                          <button className="icon-action-btn" title="Más opciones">
                            <MoreVertical size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="table-pagination-footer">
            <span className="pagination-info">Mostrando {displayRows.length} de {customers.length} clientes</span>
            <span className="pagination-info">Listado completo</span>
          </div>
        </div>

      </div>

      {/* Modal Nuevo Cliente */}
      {showNewModal && (
        <div className="modal-overlay-dark" onClick={() => setShowNewModal(false)}>
          <div className="client-modal-box animate-pop" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header-line">
              <div>
                <h3 className="modal-title">Nuevo cliente</h3>
                <p className="modal-sub-desc">Registra un nuevo cliente en el sistema</p>
              </div>
              <button className="modal-close-btn" onClick={() => setShowNewModal(false)}><X size={18} /></button>
            </div>

            <form onSubmit={handleSaveClient} className="crm-form mt-3">
              <div className="field">
                <label className="field-label-white">Nombre</label>
                <input
                  type="text"
                  placeholder="Ingresa el nombre del cliente"
                  value={newClientName}
                  onChange={(e) => setNewClientName(e.target.value)}
                  className="modal-input-dark"
                  required
                />
              </div>

              <div className="field mt-3">
                <label className="field-label-white">Apellido</label>
                <input
                  type="text"
                  placeholder="Ingresa el apellido del cliente"
                  value={newClientLastName}
                  onChange={(e) => setNewClientLastName(e.target.value)}
                  className="modal-input-dark"
                />
              </div>

              <div className="field mt-3">
                <label className="field-label-white">Teléfono</label>
                <div className="input-with-icon-wrap">
                  <Phone size={16} className="input-left-icon" />
                  <input
                    type="text"
                    placeholder="Ej. 55 1234 5678"
                    value={newClientPhone}
                    onChange={(e) => setNewClientPhone(e.target.value)}
                    className="modal-input-dark with-left-icon"
                  />
                </div>
              </div>

              <div className="field mt-3">
                <label className="field-label-white">Dirección</label>
                <div className="input-with-icon-wrap">
                  <MapPin size={16} className="input-left-icon" />
                  <input
                    type="text"
                    placeholder="Ej. Av. Bolívar, casa 12"
                    value={newClientAddress}
                    onChange={(e) => setNewClientAddress(e.target.value)}
                    className="modal-input-dark with-left-icon"
                  />
                </div>
              </div>

              <div className="field mt-3">
                <label className="field-label-white">Cumpleaños</label>
                <div className="birthday-selects-row">
                  <div className="select-col">
                    <span className="select-sub-label">Mes</span>
                    <StyledSelect
                      className="modal-select-dark"
                      value={birthMonth}
                      onChange={(e) => setBirthMonth(e.target.value)}
                    >
                      <option value="">Selecciona el mes</option>
                      {['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'].map((m, i) => (
                        <option key={m} value={String(i + 1)}>{m}</option>
                      ))}
                    </StyledSelect>
                  </div>
                  <div className="select-col">
                    <span className="select-sub-label">Día</span>
                    <StyledSelect
                      className="modal-select-dark"
                      value={birthDay}
                      onChange={(e) => setBirthDay(e.target.value)}
                    >
                      <option value="">Selecciona el día</option>
                      {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
                        <option key={d} value={d}>{d}</option>
                      ))}
                    </StyledSelect>
                  </div>
                </div>
                <span className="birthday-hint mt-1">
                  <Info size={14} /> Solo para promociones y recordatorios
                </span>
              </div>

              <div className="modal-actions-row-right mt-4">
                <button type="button" className="btn-modal-cancel" onClick={() => setShowNewModal(false)}>
                  Cancelar
                </button>
                <button type="submit" className="btn-modal-submit-red">
                  Guardar cliente
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Editar Cliente */}
      {editClientId && (
        <div className="modal-overlay-dark" onClick={() => setEditClientId(null)}>
          <div className="client-modal-box animate-pop" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header-line">
              <div>
                <h3 className="modal-title">Editar cliente</h3>
                <p className="modal-sub-desc">Actualiza los datos del cliente</p>
              </div>
              <button className="modal-close-btn" onClick={() => setEditClientId(null)}><X size={18} /></button>
            </div>

            <form onSubmit={handleUpdateClient} className="crm-form mt-3">
              <div className="field">
                <label className="field-label-white">Nombre completo</label>
                <input type="text" value={editName} onChange={(e) => setEditName(e.target.value)} className="modal-input-dark" required />
              </div>

              <div className="field mt-3">
                <label className="field-label-white">Cédula / Identificación</label>
                <input type="text" placeholder="Ej. V-12345678" value={editIdentification} onChange={(e) => setEditIdentification(e.target.value)} className="modal-input-dark" />
              </div>

              <div className="field mt-3">
                <label className="field-label-white">Teléfono</label>
                <div className="input-with-icon-wrap">
                  <Phone size={16} className="input-left-icon" />
                  <input type="text" placeholder="Ej. 0412 1234567" value={editPhone} onChange={(e) => setEditPhone(e.target.value)} className="modal-input-dark with-left-icon" />
                </div>
              </div>

              <div className="field mt-3">
                <label className="field-label-white">Dirección</label>
                <div className="input-with-icon-wrap">
                  <MapPin size={16} className="input-left-icon" />
                  <input type="text" placeholder="Ej. Av. Bolívar, casa 12" value={editAddress} onChange={(e) => setEditAddress(e.target.value)} className="modal-input-dark with-left-icon" />
                </div>
              </div>

              <div className="field mt-3">
                <label className="field-label-white">Cumpleaños</label>
                <div className="birthday-selects-row">
                  <div className="select-col">
                    <span className="select-sub-label">Mes</span>
                    <StyledSelect className="modal-select-dark" value={editBirthMonth} onChange={(e) => setEditBirthMonth(e.target.value)}>
                      <option value="">Selecciona el mes</option>
                      {['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'].map((m, i) => (
                        <option key={m} value={String(i + 1)}>{m}</option>
                      ))}
                    </StyledSelect>
                  </div>
                  <div className="select-col">
                    <span className="select-sub-label">Día</span>
                    <StyledSelect className="modal-select-dark" value={editBirthDay} onChange={(e) => setEditBirthDay(e.target.value)}>
                      <option value="">Selecciona el día</option>
                      {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
                        <option key={d} value={d}>{d}</option>
                      ))}
                    </StyledSelect>
                  </div>
                </div>
              </div>

              {editError && <p className="login-error mt-2">{editError}</p>}

              <div className="modal-actions-row-right mt-4">
                <button type="button" className="btn-modal-cancel" onClick={() => setEditClientId(null)}>Cancelar</button>
                <button type="submit" className="btn-modal-submit-red" disabled={editSaving}>{editSaving ? 'Guardando…' : 'Guardar cambios'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Abonar Crédito */}
      {paymentModal && (
        <div className="modal-overlay-dark" onClick={() => setPaymentModal(null)}>
          <div className="client-modal-box animate-pop" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header-line">
              <h3 className="modal-title">Abonar a Crédito</h3>
              <button className="modal-close-btn" onClick={() => setPaymentModal(null)}><X size={18} /></button>
            </div>
            <p className="modal-sub-desc mt-2">Cliente: <strong className="text-white">{paymentModal.customerName}</strong></p>
            <p className="birthday-hint">Deuda restante: <MoneyWithBcv usd={paymentModal.balancePending} className="text-red" usdClassName="font-bold" compact /></p>

            <form onSubmit={handlePayment} className="crm-form mt-3">
              <div className="field">
                <label className="field-label-white">Monto a abonar ($)</label>
                <input
                  type="number"
                  step="0.01"
                  max={paymentModal.balancePending}
                  placeholder={`Máximo $${paymentModal.balancePending.toFixed(2)}`}
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  className="modal-input-dark"
                  required
                />
              </div>

              <div className="modal-actions-row-right mt-4">
                <button type="button" className="btn-modal-cancel" onClick={() => setPaymentModal(null)}>
                  Cancelar
                </button>
                <button type="submit" className="btn-modal-submit-red">
                  Confirmar Pago
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Cuentas por cobrar */}
      {showCobrarModal && (
        <div className="modal-overlay-dark" onClick={() => setShowCobrarModal(false)}>
          <div className="client-modal-box animate-pop" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header-line">
              <div className="side-header-title">
                <DollarSign size={18} className="text-red" />
                <h3 className="modal-title">Cuentas por cobrar</h3>
              </div>
              <button className="modal-close-btn" onClick={() => setShowCobrarModal(false)}><X size={18} /></button>
            </div>

            <div className="cobrar-total-area mt-3">
              <MoneyWithBcv usd={totalOutstanding} className="cobrar-total-val" align="center" />
              <span className="cobrar-total-sub">Total pendiente</span>
            </div>

            <div className="circular-gauge-area">
              <div className="ring-gauge-circle">
                <span className="ring-inner-val">18</span>
                <span className="ring-inner-label">Clientes</span>
              </div>
            </div>

            <div className="gauge-legend-list">
              <div className="legend-item-row">
                <div className="legend-left">
                  <span className="dot-color red" />
                  <span>Vencido (7)</span>
                </div>
                <MoneyWithBcv usd={12150} className="legend-val font-bold" compact />
              </div>
              <div className="legend-item-row">
                <div className="legend-left">
                  <span className="dot-color orange" />
                  <span>Por vencer (11)</span>
                </div>
                <MoneyWithBcv usd={12530} className="legend-val font-bold" compact />
              </div>
            </div>

            <div className="oldest-due-footer">
              <span>Más antiguo vencido</span>
              <span className="text-red font-bold">15/05/2025</span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
