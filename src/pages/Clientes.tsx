import { useState, useEffect, useCallback, useMemo } from 'react'
import { useAuth } from '../context/auth-context'
import { getCredits, addCreditPayment, type Credit as CreditType } from '../lib/dataService'
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
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  X,
  Phone,
  Gift,
  MessageCircle,
  ShoppingBag,
  Ticket,
  MapPin,
  Copy,
  Star
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
  type: 'Minorista' | 'Mayorista'
  lastPurchase: string
  totalPurchased: number
  pendingBalance: number
  status: 'Crédito' | 'Frecuente' | 'Activo'
}

const MOCK_CUSTOMERS: CustomerRow[] = [
  {
    id: 'c1',
    initials: 'JP',
    avatarBg: '#dc2626',
    name: 'Juan Pérez',
    phone: '987 654 321',
    type: 'Minorista',
    lastPurchase: '22/05/2025',
    totalPurchased: 3859.40,
    pendingBalance: 120.00,
    status: 'Crédito',
  },
  {
    id: 'c2',
    initials: 'MG',
    avatarBg: '#d97706',
    name: 'María González',
    phone: '987 654 322',
    type: 'Mayorista',
    lastPurchase: '23/05/2025',
    totalPurchased: 28760.00,
    pendingBalance: 0.00,
    status: 'Frecuente',
  },
  {
    id: 'c3',
    initials: 'PR',
    avatarBg: '#ea580c',
    name: 'Pedro Ramírez',
    phone: '987 654 323',
    type: 'Minorista',
    lastPurchase: '20/05/2025',
    totalPurchased: 6890.00,
    pendingBalance: 1890.00,
    status: 'Crédito',
  },
  {
    id: 'c4',
    initials: 'SL',
    avatarBg: '#ca8a04',
    name: 'Sofía Lima',
    phone: '987 654 324',
    type: 'Minorista',
    lastPurchase: '19/05/2025',
    totalPurchased: 4560.00,
    pendingBalance: 0.00,
    status: 'Activo',
  },
  {
    id: 'c5',
    initials: 'CR',
    avatarBg: '#dc2626',
    name: 'Camila Rojas',
    phone: '987 654 325',
    type: 'Mayorista',
    lastPurchase: '24/05/2025',
    totalPurchased: 15230.00,
    pendingBalance: 2730.00,
    status: 'Crédito',
  },
]

const RECENT_CUSTOMERS = [
  { initials: 'DH', avatarBg: '#d97706', name: 'Diego Herrera', date: '24/05/2025', amount: 1250.00 },
  { initials: 'VT', avatarBg: '#b45309', name: 'Valeria Torres', date: '24/05/2025', amount: 980.00 },
  { initials: 'RM', avatarBg: '#991b1b', name: 'Ricardo Méndez', date: '23/05/2025', amount: 3450.00 },
  { initials: 'NC', avatarBg: '#d97706', name: 'Natalia Castro', date: '23/05/2025', amount: 760.00 },
  { initials: 'JS', avatarBg: '#b45309', name: 'Jorge Suárez', date: '23/05/2025', amount: 1890.00 },
]

const FOOD_FAVORITES = [
  { rank: '#1', name: 'Arroz chaufa', orders: '12 pedidos', img: 'https://images.unsplash.com/photo-1603133872878-684f208fb84b?auto=format&fit=crop&w=400&q=80' },
  { rank: '#2', name: 'Chow mein', orders: '9 pedidos', img: 'https://images.unsplash.com/photo-1569718212165-3a8278d5f624?auto=format&fit=crop&w=400&q=80' },
  { rank: '#3', name: 'Lumpias', orders: '8 pedidos', img: 'https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=400&q=80' },
  { rank: '#4', name: 'Pollo agridulce', orders: '7 pedidos', img: 'https://images.unsplash.com/photo-1525755662778-989d0524087e?auto=format&fit=crop&w=400&q=80' },
]

const CUSTOMER_ORDERS_HISTORY = [
  { id: 'PED-001254', date: '24/05/2025 7:45 p. m.', type: 'Delivery', products: 'Arroz chaufa, Pollo agridulce + 1 bebida', total: 125.00, status: 'Entregado', payment: 'Yape' },
  { id: 'PED-001198', date: '17/05/2025 8:10 p. m.', type: 'Para llevar', products: 'Chow mein, Lumpias (4)', total: 98.00, status: 'Entregado', payment: 'Efectivo' },
  { id: 'PED-001145', date: '10/05/2025 7:32 p. m.', type: 'Delivery', products: 'Pollo agridulce, Arroz chaufa', total: 135.00, status: 'Entregado', payment: 'Yape' },
  { id: 'PED-001083', date: '03/05/2025 8:05 p. m.', type: 'Para llevar', products: 'Chow mein, Wantán frito (6)', total: 92.00, status: 'Entregado', payment: 'Efectivo' },
  { id: 'PED-001022', date: '26/04/2025 7:50 p. m.', type: 'Delivery', products: 'Arroz chaufa, Pollo broaster + 1 bebida', total: 128.00, status: 'En preparación', payment: 'Yape' },
]

export function Clientes() {
  const { user } = useAuth()
  const [credits, setCredits] = useState<CreditType[]>(creditsCache ?? [])
  const [loading, setLoading] = useState(!creditsCache)

  // Selected customer for Profile View matching target screenshot
  const [selectedClient, setSelectedClient] = useState<CustomerRow | null>(MOCK_CUSTOMERS[0])

  // Filters state
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [typeFilter, setTypeFilter] = useState('all')

  // Modals
  const [showNewModal, setShowNewModal] = useState(false)
  const [newClientName, setNewClientName] = useState('')
  const [newClientLastName, setNewClientLastName] = useState('')
  const [newClientPhone, setNewClientPhone] = useState('')
  const [birthMonth, setBirthMonth] = useState('')
  const [birthDay, setBirthDay] = useState('')

  const [paymentModal, setPaymentModal] = useState<CreditType | null>(null)
  const [paymentAmount, setPaymentAmount] = useState('')

  const fetchCredits = useCallback(async () => {
    try {
      const data = await getCredits()
      setCredits(data)
      creditsCache = data
    } catch (e) {
      console.error('Error cargando créditos:', e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchCredits()
  }, [fetchCredits])

  const [customClientList, setCustomClientList] = useState<CustomerRow[]>([])

  const handleSaveClient = (e: React.FormEvent) => {
    e.preventDefault()
    if (!newClientName.trim()) return

    const fullName = `${newClientName.trim()} ${newClientLastName.trim()}`.trim()
    const newClientObj: CustomerRow = {
      id: `c_${Date.now()}`,
      initials: (newClientName[0] + (newClientLastName[0] || '')).toUpperCase(),
      avatarBg: '#dc2626',
      name: fullName,
      phone: newClientPhone.trim() || '987 654 000',
      type: 'Minorista',
      lastPurchase: new Date().toLocaleDateString('es-VE', { day: '2-digit', month: '2-digit', year: 'numeric' }),
      totalPurchased: 0.00,
      pendingBalance: 0.00,
      status: 'Activo',
    }

    setCustomClientList((prev) => [newClientObj, ...prev])
    setNewClientName('')
    setNewClientLastName('')
    setNewClientPhone('')
    setBirthMonth('')
    setBirthDay('')
    setShowNewModal(false)
    setSelectedClient(newClientObj)
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

  // Combined data table rows: DB credits mapped + Mock fallback
  const displayRows = useMemo(() => {
    let rows: CustomerRow[] = [...customClientList, ...MOCK_CUSTOMERS]

    if (credits.length > 0) {
      const dbRows: CustomerRow[] = credits.map((c, i) => {
        const parts = c.customerName.split(' ')
        const initials = (parts[0]?.[0] || 'C') + (parts[1]?.[0] || '')
        const isSettled = c.balancePending === 0

        return {
          id: c.id,
          initials: initials.toUpperCase(),
          avatarBg: i % 2 === 0 ? '#dc2626' : '#d97706',
          name: c.customerName,
          phone: '987 654 3' + (20 + i),
          type: i % 3 === 0 ? 'Mayorista' : 'Minorista',
          lastPurchase: new Date(c.createdAt).toLocaleDateString('es-VE', { day: '2-digit', month: '2-digit', year: 'numeric' }),
          totalPurchased: c.totalAmount,
          pendingBalance: c.balancePending,
          status: isSettled ? 'Activo' : 'Crédito',
        }
      })
      rows = [...customClientList, ...dbRows, ...MOCK_CUSTOMERS.filter(m => !dbRows.some(d => d.name === m.name))]
    }

    return rows.filter((r) => {
      const matchSearch = r.name.toLowerCase().includes(searchTerm.toLowerCase()) || r.phone.includes(searchTerm)
      const matchStatus = statusFilter === 'all' || r.status.toLowerCase() === statusFilter.toLowerCase()
      const matchType = typeFilter === 'all' || r.type.toLowerCase() === typeFilter.toLowerCase()
      return matchSearch && matchStatus && matchType
    })
  }, [credits, searchTerm, statusFilter, typeFilter, customClientList])

  const totalOutstanding = useMemo(() => {
    if (credits.length > 0) {
      return credits.reduce((acc, c) => acc + c.balancePending, 0)
    }
    return 24680.00
  }, [credits])


  if (loading) {
    return (
      <div className="page animate-fade-in">
        <div style={{ padding: '40px', color: '#9ca3af' }}>Cargando clientes...</div>
      </div>
    )
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // FICHA DE CLIENTE / PERFIL DEL CLIENTE VIEW (Matching Target Screenshot)
  // ═══════════════════════════════════════════════════════════════════════════
  if (selectedClient) {
    return (
      <div className="page animate-fade-in">

        {/* Breadcrumb & Title */}
        <div className="profile-breadcrumb-wrap">
          <div className="profile-breadcrumbs">
            <button className="breadcrumb-link" onClick={() => setSelectedClient(null)}>Clientes</button>
            <span className="breadcrumb-sep">›</span>
            <span className="breadcrumb-current">Perfil del cliente</span>
          </div>
          <h1 className="profile-page-title">Perfil del cliente</h1>
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
                <Star size={16} className="star-gold-icon" />
              </div>
              <div className="hero-meta-tags-row flex-wrap">
                <span className="hero-phone-wrap">
                  <Phone size={13} /> {selectedClient.phone}
                  <button className="btn-wsap-icon-inline" title="Enviar WhatsApp"><MessageCircle size={12} /></button>
                </span>
                <span className="meta-divider">|</span>
                <span className="badge-tag-purple">🏷️ Cliente Frecuente</span>
                <span className="meta-divider">|</span>
                <span className="badge-tag-green">🟢 Activo</span>
                <span className="meta-divider">|</span>
                <span className="hero-detail-tag"><Gift size={13} /> 15 de Agosto 🎁</span>
                <span className="meta-divider">|</span>
                <span className="hero-detail-tag"><Calendar size={13} /> Reg: 12/09/2024</span>
              </div>

              <div className="hero-bottom-info-row">
                <div className="hero-client-id">
                  <span>ID Cliente: CLI-000142</span>
                  <button className="btn-icon-ghost-sm" title="Copiar ID"><Copy size={13} /></button>
                </div>
                <div className="hero-notes-pill">
                  <span className="font-bold">📝 Notas:</span> Prefiere salsas aparte. No le gusta el kion.
                </div>
              </div>
            </div>
          </div>

          <div className="hero-right-actions">
            <button className="btn-hero-dark" onClick={() => setShowNewModal(true)}>
              <Edit2 size={16} /> Editar cliente
            </button>
            <button className="btn-hero-red" onClick={() => setSelectedClient(null)}>
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
              <span className="kpi-banner-val">$ {selectedClient.totalPurchased.toLocaleString('es-VE', { minimumFractionDigits: 2 })}</span>
              <span className="kpi-banner-sub green">↑ +18.6% vs. último mes</span>
            </div>
          </div>

          {/* Metric 2 */}
          <div className="kpi-banner-item">
            <div className="kpi-banner-icon orange"><ShoppingBag size={20} /></div>
            <div className="kpi-banner-info">
              <span className="kpi-banner-label">Pedidos realizados</span>
              <span className="kpi-banner-val">28</span>
              <span className="kpi-banner-sub">Últimos 12 meses</span>
            </div>
          </div>

          {/* Metric 3 */}
          <div className="kpi-banner-item">
            <div className="kpi-banner-icon gold"><Ticket size={20} /></div>
            <div className="kpi-banner-info">
              <span className="kpi-banner-label">Ticket promedio</span>
              <span className="kpi-banner-val">$ 137.84</span>
              <span className="kpi-banner-sub">Promedio por pedido</span>
            </div>
          </div>

          {/* Metric 4 */}
          <div className="kpi-banner-item">
            <div className="kpi-banner-icon dark-red"><CreditCard size={20} /></div>
            <div className="kpi-banner-info">
              <span className="kpi-banner-label">Saldo pendiente</span>
              <span className="kpi-banner-val">$ {selectedClient.pendingBalance.toLocaleString('es-VE', { minimumFractionDigits: 2 })}</span>
              <span className="kpi-banner-sub gold">1 crédito activo</span>
            </div>
          </div>

          {/* Metric 5 */}
          <div className="kpi-banner-item">
            <div className="kpi-banner-icon user-orange"><User size={20} /></div>
            <div className="kpi-banner-info">
              <span className="kpi-banner-label">Cliente desde</span>
              <span className="kpi-banner-val">12/09/2024</span>
              <span className="kpi-banner-sub">8 meses</span>
            </div>
          </div>
        </div>

        {/* MAIN 2-COLUMNS GRID (Wider History Table on Left + Stacked Right Column) */}
        <div className="profile-grid-2cols">
          {/* LEFT COL: Historial de pedidos */}
          <div className="profile-card-col center-col">
            <div className="profile-card-header">
              <h3 className="profile-card-title">Historial de pedidos</h3>
              <button className="link-red-sm">Ver todos los pedidos →</button>
            </div>

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
                  {CUSTOMER_ORDERS_HISTORY.map((ord) => (
                    <tr key={ord.id}>
                      <td className="font-bold text-white">{ord.id}</td>
                      <td className="date-sub-text">{ord.date}</td>
                      <td>
                        <span className="order-type-pill">
                          {ord.type === 'Delivery' ? '🛵 Delivery' : '🛍️ Para llevar'}
                        </span>
                      </td>
                      <td className="products-cell">{ord.products}</td>
                      <td className="font-bold">${ord.total.toFixed(2)}</td>
                      <td>
                        <span className={`status-pill-sub ${ord.status === 'Entregado' ? 'green' : 'gold'}`}>
                          {ord.status}
                        </span>
                      </td>
                      <td>
                        <span className="payment-method-tag">
                          {ord.payment === 'Yape' ? '📱 Yape' : '💵 Efectivo'}
                        </span>
                      </td>
                      <td>
                        <button className="icon-action-btn"><MoreVertical size={14} /></button>
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
                <button className="link-red-sm">Ver detalle →</button>
              </div>

              <div className="credit-metrics-grid mt-2">
                <div className="credit-metric-box">
                  <span className="credit-label">Saldo actual</span>
                  <span className="credit-val-big text-red">$ 120.00</span>
                </div>
                <div className="credit-metric-box">
                  <span className="credit-label">Créditos activos</span>
                  <span className="credit-val-big">1</span>
                </div>
              </div>

              <div className="credit-due-breakdown mt-3">
                <div className="due-box">
                  <span className="due-label">Vencido</span>
                  <span className="due-val text-red">$ 0.00</span>
                  <span className="due-sub">0 días</span>
                </div>
                <div className="due-box">
                  <span className="due-label">Por vencer</span>
                  <span className="due-val text-orange">$ 120.00</span>
                  <span className="due-sub">vence el 07/06/2025</span>
                </div>
              </div>

              <div className="last-payment-received-row mt-3">
                <div className="lp-left">
                  <span className="lp-label">Último pago recibido</span>
                  <span className="lp-date">17/05/2025</span>
                </div>
                <div className="lp-right">
                  <span className="lp-amount text-green font-bold">$ 98.00</span>
                  <span className="lp-badge">Yape</span>
                </div>
              </div>
            </div>

            {/* Bottom Right Card: Actividad reciente */}
            <div className="side-activity-card mt-3">
              <div className="side-card-header">
                <h3 className="profile-card-title">Actividad reciente</h3>
                <button className="link-red-sm">Ver toda</button>
              </div>

              <div className="activity-timeline-vertical mt-2">
                <div className="activity-item">
                  <span className="act-dot green"><ShoppingBag size={12} /></span>
                  <div className="act-info">
                    <span className="act-title">Realizó un pedido PED-001254</span>
                    <span className="act-time">24/05/2025 · 7:45 p. m.</span>
                  </div>
                </div>

                <div className="activity-item">
                  <span className="act-dot purple"><DollarSign size={12} /></span>
                  <div className="act-info">
                    <span className="act-title">Se registró abono de $ 98.00</span>
                    <span className="act-time">17/05/2025 · 8:12 p. m.</span>
                  </div>
                </div>

                <div className="activity-item">
                  <span className="act-dot blue"><Phone size={12} /></span>
                  <div className="act-info">
                    <span className="act-title">Se actualizó el teléfono del cliente</span>
                    <span className="act-time">12/05/2025 · 6:30 p. m.</span>
                  </div>
                </div>

                <div className="activity-item">
                  <span className="act-dot red"><User size={12} /></span>
                  <div className="act-info">
                    <span className="act-title">Cliente registrado en el sistema</span>
                    <span className="act-time">12/09/2024 · 11:22 a. m.</span>
                  </div>
                </div>
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
              <button className="link-red-sm">Ver más</button>
            </div>

            <div className="favorites-cards-grid mt-2">
              {FOOD_FAVORITES.map((fav) => (
                <div key={fav.name} className="favorite-food-card">
                  <div className="fav-thumb-area" style={{ backgroundImage: `url(${fav.img})` }}>
                    <span className="fav-rank-badge">{fav.rank}</span>
                  </div>
                  <div className="fav-card-body">
                    <span className="fav-food-title">{fav.name}</span>
                    <span className="fav-orders-sub">{fav.orders}</span>
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
              <button className="link-red-sm">Editar</button>
            </div>

            <div className="address-content-box mt-2">
              <span className="address-line-main">Av. Primavera 1234</span>
              <span className="address-line-sub">Urbanización Los Jardines</span>
              <span className="address-line-sub">Santiago de Surco, Lima</span>
              <span className="address-ref-line">Referencia: Frente al parque</span>

              <button className="btn-map-dark mt-3">
                <MapPin size={14} /> Ver en mapa
              </button>
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
            <span className="kpi-value-lg">128</span>
            <span className="kpi-sub-tag green">
              <TrendingUp size={12} /> 12% vs. mes anterior
            </span>
          </div>
        </div>

        <div className="kpi-card-dark">
          <div className="kpi-icon-circle-box gold">
            <Crown size={22} />
          </div>
          <div className="kpi-content-box">
            <span className="kpi-label-sm">Clientes frecuentes</span>
            <span className="kpi-value-lg">35</span>
            <span className="kpi-sub-tag orange">27% del total</span>
          </div>
        </div>

        <div className="kpi-card-dark">
          <div className="kpi-icon-circle-box orange">
            <CreditCard size={22} />
          </div>
          <div className="kpi-content-box">
            <span className="kpi-label-sm">Créditos activos</span>
            <span className="kpi-value-lg">18</span>
            <span className="kpi-sub-tag gold-text">Con saldo pendiente</span>
          </div>
        </div>

        <div className="kpi-card-dark">
          <div className="kpi-icon-circle-box dark-red">
            <DollarSign size={22} />
          </div>
          <div className="kpi-content-box">
            <span className="kpi-label-sm">Pendientes por cobrar</span>
            <span className="kpi-value-lg">$ {totalOutstanding.toLocaleString('es-VE', { minimumFractionDigits: 2 })}</span>
            <span className="kpi-sub-tag red-text">De 18 clientes</span>
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
              <select
                className="filter-select"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="all">Todos</option>
                <option value="crédito">Crédito</option>
                <option value="frecuente">Frecuente</option>
                <option value="activo">Activo</option>
              </select>
            </div>

            <div className="filter-dropdown-wrap">
              <span className="dropdown-label">Tipo</span>
              <select
                className="filter-select"
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
              >
                <option value="all">Todos</option>
                <option value="minorista">Minorista</option>
                <option value="mayorista">Mayorista</option>
              </select>
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
                  <th>Tipo</th>
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
                        <span className={`type-badge ${row.type.toLowerCase()}`}>
                          {row.type}
                        </span>
                      </td>
                      <td className="date-td">{row.lastPurchase}</td>
                      <td className="amount-td font-bold">${row.totalPurchased.toLocaleString('es-VE', { minimumFractionDigits: 2 })}</td>
                      <td className={`amount-td font-bold ${row.pendingBalance > 0 ? 'text-red' : 'text-green'}`}>
                        ${row.pendingBalance.toLocaleString('es-VE', { minimumFractionDigits: 2 })}
                      </td>
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
                          <button className="icon-action-btn" title="Editar cliente">
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
            <span className="pagination-info">Mostrando 1 a 8 de 128 clientes</span>
            <div className="pagination-controls">
              <button className="pag-btn prev"><ChevronLeft size={16} /></button>
              <button className="pag-btn active">1</button>
              <button className="pag-btn">2</button>
              <button className="pag-btn">3</button>
              <span className="pag-dots">...</span>
              <button className="pag-btn">16</button>
              <button className="pag-btn next"><ChevronRight size={16} /></button>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: Stacked Cards */}
        <div className="clientes-right-sidebar">
          <div className="side-card-dark">
            <div className="side-card-header">
              <div className="side-header-title">
                <Users size={16} className="text-red" />
                <span>Clientes recientes</span>
              </div>
              <button className="link-red-sm">Ver todos</button>
            </div>

            <div className="recent-clients-list">
              {RECENT_CUSTOMERS.map((rc, idx) => (
                <div key={idx} className="recent-client-row">
                  <span className="rc-avatar-badge" style={{ backgroundColor: rc.avatarBg }}>
                    {rc.initials}
                  </span>
                  <div className="rc-info">
                    <span className="rc-name">{rc.name}</span>
                    <span className="rc-date">{rc.date}</span>
                  </div>
                  <span className="rc-amount-green">${rc.amount.toLocaleString('es-VE', { minimumFractionDigits: 2 })}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="side-card-dark">
            <div className="side-card-header">
              <div className="side-header-title">
                <DollarSign size={16} className="text-red" />
                <span>Cuentas por cobrar</span>
              </div>
              <button className="link-red-sm">Ver todos</button>
            </div>

            <div className="cobrar-total-area mt-2">
              <span className="cobrar-total-val">$24,680.00</span>
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
                <span className="legend-val font-bold">$12,150.00</span>
              </div>
              <div className="legend-item-row">
                <div className="legend-left">
                  <span className="dot-color orange" />
                  <span>Por vencer (11)</span>
                </div>
                <span className="legend-val font-bold">$12,530.00</span>
              </div>
            </div>

            <div className="oldest-due-footer">
              <span>Más antiguo vencido</span>
              <span className="text-red font-bold">15/05/2025</span>
            </div>
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
                <label className="field-label-white">Cumpleaños</label>
                <div className="birthday-selects-row">
                  <div className="select-col">
                    <span className="select-sub-label">Mes</span>
                    <select
                      className="modal-select-dark"
                      value={birthMonth}
                      onChange={(e) => setBirthMonth(e.target.value)}
                    >
                      <option value="">Selecciona el mes</option>
                      {['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'].map((m) => (
                        <option key={m} value={m}>{m}</option>
                      ))}
                    </select>
                  </div>
                  <div className="select-col">
                    <span className="select-sub-label">Día</span>
                    <select
                      className="modal-select-dark"
                      value={birthDay}
                      onChange={(e) => setBirthDay(e.target.value)}
                    >
                      <option value="">Selecciona el día</option>
                      {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
                        <option key={d} value={d}>{d}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <span className="birthday-hint mt-1">
                  ℹ️ Solo para promociones y recordatorios
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

      {/* Modal Abonar Crédito */}
      {paymentModal && (
        <div className="modal-overlay-dark" onClick={() => setPaymentModal(null)}>
          <div className="client-modal-box animate-pop" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header-line">
              <h3 className="modal-title">Abonar a Crédito</h3>
              <button className="modal-close-btn" onClick={() => setPaymentModal(null)}><X size={18} /></button>
            </div>
            <p className="modal-sub-desc mt-2">Cliente: <strong className="text-white">{paymentModal.customerName}</strong></p>
            <p className="birthday-hint">Deuda restante: <span className="text-red font-bold">${paymentModal.balancePending.toFixed(2)}</span></p>

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
                  autoFocus
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
    </div>
  )
}
