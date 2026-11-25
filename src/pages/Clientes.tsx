import { useState, useEffect, useLayoutEffect, useCallback, useMemo, useRef, type CSSProperties, type PointerEvent, type WheelEvent } from 'react'
import { useSearchParams } from 'react-router-dom'
import { createPortal } from 'react-dom'
import { useAuth } from '../context/auth-context'
import { useRates } from '../context/rates-context'
import { MoneyWithBcv } from '../components/MoneyWithBcv'
import { StyledSelect } from '../components/StyledSelect'
import { ReceivablePaymentEditor, type ReceivablePaymentComponent } from '../components/ReceivablePaymentEditor'
import { formatProductTitle, normalizeForSearch } from '../lib/textFormat'
import { alertDialog, confirmDialog } from '../components/ConfirmDialog'
import { EmptyState } from '../components/EmptyState'
import { PageSkeleton } from '../components/PageSkeleton'
import { LoadingSkeleton } from '../components/LoadingSkeleton'
import { getCredits, getCreditPayments, addCreditPayment, getCustomerPaymentAccounts, setCustomerActive, getCustomers, getCustomerOrders, getCustomerPurchaseMetrics, getProducts, type Credit as CreditType, type CreditPayment, type Customer, type CustomerOrderSummary, type CustomerPurchaseMetric, type Product, type FinancialAccount } from '../lib/dataService'
import { Search, Users, Calendar, User, Plus, Crown, CreditCard, DollarSign, Eye, Edit2, Trash2, X, Phone, Gift, ShoppingBag, MapPin, ArrowLeft, Tag, ChevronLeft, ChevronRight, IdCard, ShoppingCart, ClipboardList, Package, Wallet } from 'lucide-react'
import './Clientes.css'
import { QuickOrderModal } from './clientes/QuickOrderModal'
import { NewClientModal } from './clientes/NewClientModal'
import { EditClientModal } from './clientes/EditClientModal'
import { CustomerRow, formatTenure, formatRelativeDays, formatDate, formatDateTime, formatUsdText, WhatsAppIcon, normalizeCustomerName, avatarColorFor, buildDemoClientData, ORDER_TYPE_LABELS, ORDER_TYPE_ICONS, FULFILLMENT_LABELS, formatBirthday, PAYMENT_LABELS, PAYMENT_ICONS, classifyIdentification } from './clientes/model'
import { useLiveDataRefresh } from '../lib/liveDataRefresh'

// Cache a nivel de módulo: al volver a esta pestaña se muestran los datos de
// la última visita al instante, sin el parpadeo de "Cargando...", mientras
// se refrescan en segundo plano.
let creditsCache: CreditType[] | null = null

export function Clientes() {
  const { user } = useAuth()
  const { bcvRate } = useRates()
  const [searchParams] = useSearchParams()
  const isDemoMode = searchParams.get('demoClient') === '1'
  const [credits, setCredits] = useState<CreditType[]>(creditsCache ?? [])
  const [loading, setLoading] = useState(!creditsCache)
  const [mobileMetricIndex, setMobileMetricIndex] = useState(0)
  const [isPhoneViewport, setIsPhoneViewport] = useState(() => window.matchMedia('(max-width: 767px)').matches)
  const metricPointerStart = useRef<{ x: number; y: number } | null>(null)
  const metricWheelDeltaX = useRef(0)
  const metricWheelLastChange = useRef(0)

  const handleMetricPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return
    metricPointerStart.current = { x: event.clientX, y: event.clientY }
  }

  const handleMetricPointerUp = (event: PointerEvent<HTMLDivElement>) => {
    const start = metricPointerStart.current
    metricPointerStart.current = null
    if (!start) return

    const deltaX = event.clientX - start.x
    const deltaY = event.clientY - start.y
    if (Math.abs(deltaX) < 40 || Math.abs(deltaX) < Math.abs(deltaY) * 1.2) return
    setMobileMetricIndex(index => (index + (deltaX < 0 ? 1 : -1) + 2) % 2)
  }

  const handleMetricWheel = (event: WheelEvent<HTMLDivElement>) => {
    if (Math.abs(event.deltaX) < Math.abs(event.deltaY)) return
    event.preventDefault()

    const now = Date.now()
    if (now - metricWheelLastChange.current < 450) return

    metricWheelDeltaX.current += event.deltaX
    if (Math.abs(metricWheelDeltaX.current) < 28) return

    setMobileMetricIndex(index => (index + (metricWheelDeltaX.current > 0 ? 1 : -1) + 2) % 2)
    metricWheelDeltaX.current = 0
    metricWheelLastChange.current = now
  }

  useEffect(() => {
    const media = window.matchMedia('(max-width: 767px)')
    const updateViewport = () => setIsPhoneViewport(media.matches)
    media.addEventListener('change', updateViewport)
    return () => media.removeEventListener('change', updateViewport)
  }, [])

  // Selected customer for Profile View matching target screenshot
  const [selectedClient, setSelectedClient] = useState<CustomerRow | null>(null)
  const selectedClientId = selectedClient?.id
  const [customers, setCustomers] = useState<Customer[]>([])
  const [purchaseMetrics, setPurchaseMetrics] = useState<CustomerPurchaseMetric[]>([])
  const [products, setProducts] = useState<Product[]>([])

  const resetPhoneScroll = useCallback(() => {
    if (!isPhoneViewport) return

    const appMain = document.querySelector<HTMLElement>('.app-main')
    if (appMain) {
      appMain.scrollTop = 0
      appMain.scrollLeft = 0
    }

    const pageScroller = document.scrollingElement
    if (pageScroller) {
      pageScroller.scrollTop = 0
      pageScroller.scrollLeft = 0
    }

    document.documentElement.scrollTop = 0
    document.body.scrollTop = 0
    window.scrollTo(0, 0)
  }, [isPhoneViewport])

  const openClientProfile = useCallback((client: CustomerRow) => {
    resetPhoneScroll()
    setSelectedClient(client)
  }, [resetPhoneScroll])

  useLayoutEffect(() => {
    if (!selectedClientId) return
    resetPhoneScroll()
  }, [selectedClientId, resetPhoneScroll])

  // Filters state
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [identityFilter, setIdentityFilter] = useState('all')

  // Pagination state
  const CLIENTS_PER_PAGE = isPhoneViewport ? 10 : 25
  const [currentPage, setCurrentPage] = useState(1)

  // Modals
  const [showNewModal, setShowNewModal] = useState(false)

  // Edit client modal state
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null)

  const [paymentModal, setPaymentModal] = useState<CreditType | null>(null)
  const [paymentSaving, setPaymentSaving] = useState(false)
  const [paymentError, setPaymentError] = useState('')
  const [financialAccounts, setFinancialAccounts] = useState<FinancialAccount[]>([])
  const [showCobrarModal, setShowCobrarModal] = useState(false)

  useEffect(() => {
    getCustomerPaymentAccounts().then(setFinancialAccounts).catch((error) => {
      console.error('Error cargando cuentas para cobros:', error)
      setFinancialAccounts([])
    })
  }, [])

  // Modal "Nuevo pedido" embebido en la ficha del cliente (no navega a Caja).
  const [showQuickOrderModal, setShowQuickOrderModal] = useState(false)

  // Detalle de un pedido del historial (la tabla es solo vista previa con
  // íconos; el modal muestra todo con nombres completos).
  const [orderDetail, setOrderDetail] = useState<CustomerOrderSummary | null>(null)

  // Closing-delay flags: keep the overlay mounted for the exit animation
  // before flipping the visibility state to false/null.
  const [closingPayment, setClosingPayment] = useState(false)
  const [closingCobrar, setClosingCobrar] = useState(false)
  const [closingOrderDetail, setClosingOrderDetail] = useState(false)

  const closeOrderDetail = () => {
    if (!orderDetail || closingOrderDetail) return
    setClosingOrderDetail(true)
    window.setTimeout(() => {
      setOrderDetail(null)
      setClosingOrderDetail(false)
    }, 200)
  }

  const closePaymentModal = (then?: () => void) => {
    if (!paymentModal || closingPayment) return
    setClosingPayment(true)
    window.setTimeout(() => {
      setPaymentModal(null)
      setClosingPayment(false)
      then?.()
    }, 200)
  }

  const closeCobrarModal = (then?: () => void) => {
    if (!showCobrarModal || closingCobrar) return
    setClosingCobrar(true)
    window.setTimeout(() => {
      setShowCobrarModal(false)
      setClosingCobrar(false)
      then?.()
    }, 200)
  }
  const [customerOrders, setCustomerOrders] = useState<CustomerOrderSummary[]>([])
  const [customerCreditPayments, setCustomerCreditPayments] = useState<CreditPayment[]>([])
  const [profileLoading, setProfileLoading] = useState(false)
  const [profileError, setProfileError] = useState('')
  const [receivableOrders, setReceivableOrders] = useState<Record<string, CustomerOrderSummary>>({})
  const [receivablesLoading, setReceivablesLoading] = useState(false)

  const openReceivablePayment = (credit: CreditType) => {
    setPaymentError('')
    closeCobrarModal(() => setPaymentModal(credit))
  }

  useEffect(() => {
    if (!showCobrarModal) return
    const linkedCredits = credits.filter((credit) => credit.balancePending > 0 && credit.orderId && credit.customerId)
    let cancelled = false
    setReceivablesLoading(true)
    Promise.all(linkedCredits.map(async (credit) => {
      const orders = await getCustomerOrders(credit.customerId as string, credit.customerName)
      return [credit.id, orders.find((order) => order.id === credit.orderId)] as const
    }))
      .then((entries) => {
        if (!cancelled) setReceivableOrders(Object.fromEntries(entries.filter((entry): entry is [string, CustomerOrderSummary] => Boolean(entry[1]))))
      })
      .catch((error) => console.error('Error cargando comandas por cobrar:', error))
      .finally(() => { if (!cancelled) setReceivablesLoading(false) })
    return () => { cancelled = true }
  }, [showCobrarModal, credits])

  useEffect(() => {
    if (isDemoMode) return
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
  }, [selectedClient, credits, isDemoMode])

  // Modo demo: puebla un cliente ficticio con historial completo para
  // previsualizar el diseño del perfil sin tocar Supabase. Se activa con
  // ?demoClient=1 en la URL y solo vive en memoria del navegador.
  useEffect(() => {
    if (!isDemoMode) return
    const demo = buildDemoClientData()
    setCustomers([demo.customer])
    setCredits(demo.credits)
    setPurchaseMetrics([demo.metric])
    setCustomerOrders(demo.orders)
    setCustomerCreditPayments(demo.payments)
    setSelectedClient(demo.row)
    setProducts(demo.products)
    setLoading(false)
  }, [isDemoMode])

  const fetchCredits = useCallback(async (silent = false) => {
    if (isDemoMode) return
    try {
      const [creditData, customerData, metricData] = await Promise.all([
        getCredits(true),
        getCustomers(),
        getCustomerPurchaseMetrics(),
      ])
      setCredits(creditData)
      setCustomers(customerData)
      setPurchaseMetrics(metricData)
      creditsCache = creditData
    } catch (e) {
      console.error('Error cargando créditos:', e)
    } finally {
      if (!silent) setLoading(false)
    }
  }, [isDemoMode])

  useEffect(() => {
    fetchCredits()
  }, [fetchCredits])
  useLiveDataRefresh('clientes', () => fetchCredits(true))

  useEffect(() => {
    if (isDemoMode) return
    getProducts().then(setProducts).catch((e) => console.error('Error cargando fotos de productos:', e))
  }, [isDemoMode])

  const openEditCustomer = (c: Customer) => setEditingCustomer(c)

  const handleDeactivateCustomer = async (customer: CustomerRow) => {
    const ok = await confirmDialog({
      title: 'Desactivar cliente',
      message: `¿Desactivar a ${customer.name}? Ya no aparecerá como cliente activo, pero se conserva todo su historial de pedidos y créditos.`,
      confirmText: 'Desactivar',
      danger: true,
    })
    if (!ok) return
    try {
      await setCustomerActive(customer.id, false)
      setCustomers((prev) => prev.map((c) => c.id === customer.id ? { ...c, isActive: false } : c))
    } catch (e) {
      console.error('Error al desactivar cliente:', e)
      void alertDialog({ message: 'No se pudo desactivar el cliente', danger: true })
    }
  }

  const handlePayment = async (payments: ReceivablePaymentComponent[], notes: string) => {
    if (paymentModal && user) {
      setPaymentSaving(true)
      setPaymentError('')
      try {
        await addCreditPayment({
          creditId: paymentModal.id,
          payments,
          notes: notes || undefined,
        })
        await fetchCredits()
        closePaymentModal(() => setShowCobrarModal(true))
      } catch (e) {
        console.error('Error registrando abono:', e)
        const detail = e instanceof Error ? e.message : 'Intenta de nuevo.'
        setPaymentError(`No se pudo registrar el pago: ${detail}`)
      } finally {
        setPaymentSaving(false)
      }
    }
  }

  // Clientes reales importados, enriquecidos con saldos de crédito actuales.
  const displayRows = useMemo(() => {
    const rows: CustomerRow[] = customers.map((customer) => {
      const customerCredits = credits.filter(item => item.customerId === customer.id || (!item.customerId && normalizeCustomerName(item.customerName) === normalizeCustomerName(customer.name)))
      const metric = purchaseMetrics.find(item => item.customerId === customer.id || (!item.customerId && normalizeCustomerName(item.customerName) === normalizeCustomerName(customer.name)))
      const pendingBalance = customerCredits.reduce((sum, credit) => sum + credit.balancePending, 0)
      const parts = customer.name.split(' ')
      return {
        id: customer.id, initials: `${parts[0]?.[0] || 'C'}${parts[1]?.[0] || ''}`.toUpperCase(),
        avatarBg: avatarColorFor(customer.name), name: customer.name,
        phone: customer.phone, identification: customer.identification,
        identificationStatus: classifyIdentification(customer.identification),
        lastPurchase: metric?.lastPurchase ? formatDate(metric.lastPurchase) : customer.lastVisit ? formatDate(customer.lastVisit) : 'Sin compras enlazadas',
        totalPurchased: metric?.totalPurchased ?? 0, pendingBalance,
        status: !customer.isActive ? 'Inactivo' : pendingBalance > 0 ? 'Crédito' : customer.totalVisits >= 5 ? 'Frecuente' : 'Activo',
      }
    })

    return rows.filter((r) => {
      const matchSearch = normalizeForSearch(r.name).includes(normalizeForSearch(searchTerm)) || r.phone.includes(searchTerm) || normalizeForSearch(r.identification).includes(normalizeForSearch(searchTerm))
      const matchStatus = statusFilter === 'all' || r.status.toLowerCase() === statusFilter.toLowerCase()
      const matchIdentity = identityFilter === 'all' || r.identificationStatus === identityFilter
      return matchSearch && matchStatus && matchIdentity
    })
  }, [credits, customers, purchaseMetrics, searchTerm, statusFilter, identityFilter])

  useEffect(() => {
    setCurrentPage(1)
  }, [searchTerm, statusFilter, identityFilter])

  const totalPages = Math.max(1, Math.ceil(displayRows.length / CLIENTS_PER_PAGE))
  const safePage = Math.min(currentPage, totalPages)
  const pageStart = (safePage - 1) * CLIENTS_PER_PAGE
  const pagedRows = displayRows.slice(pageStart, pageStart + CLIENTS_PER_PAGE)

  const pendingReceivableOrderCount = useMemo(() => new Set(
    credits.filter((credit) => credit.balancePending > 0 && credit.orderId).map((credit) => credit.orderId),
  ).size, [credits])

  const totalOutstanding = useMemo(() => {
    return credits.reduce((acc, credit) => acc + credit.balancePending, 0)
  }, [credits])

  const frequentCustomers = useMemo(() => customers.filter((customer) => customer.totalVisits >= 5).length, [customers])
  const activeCreditsCount = useMemo(() => credits.filter((credit) => credit.balancePending > 0).length, [credits])
  const customersWithDebt = useMemo(() => new Set(
    credits.filter((credit) => credit.balancePending > 0).map((credit) => credit.customerId ?? `name:${normalizeCustomerName(credit.customerName)}`),
  ).size, [credits])


  // Modales globales (Nuevo cliente, Editar, Abonar crédito, Cuentas por
  // cobrar). Se definen una sola vez aquí y se insertan tanto en la vista de
  // lista como en la ficha de perfil, para que abrir "Editar" desde el
  // perfil de un cliente también funcione (antes solo vivían dentro del
  // return de la vista de lista).
  const clientModals = (
    <>
      {/* Modal Nuevo Cliente */}
      {showNewModal && (
        <NewClientModal
          onClose={() => setShowNewModal(false)}
          onCreated={(saved, row) => { setCustomers(prev => [saved, ...prev]); setSelectedClient(row) }}
        />
      )}

      {/* Modal Editar Cliente */}
      {editingCustomer && (
        <EditClientModal
          customer={editingCustomer}
          onClose={() => setEditingCustomer(null)}
          onSaved={(updated) => {
            setCustomers(prev => prev.map(c => c.id === updated.id ? updated : c))
            setSelectedClient(prev => prev && prev.id === updated.id ? {
              ...prev,
              name: updated.name,
              phone: updated.phone,
              identification: updated.identification,
              identificationStatus: classifyIdentification(updated.identification),
            } : prev)
          }}
        />
      )}

      {/* Modal Abonar Crédito */}
      {paymentModal && createPortal(
        <div className={`modal-overlay-dark ${closingPayment ? 'closing' : ''}`} onClick={() => closePaymentModal()}>
          <div className="client-modal-box animate-pop clientes-modal-glow" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header-line clientes-modal-header-glow">
              <h3 className="modal-title">Abonar a Crédito</h3>
            </div>
            <div className="clientes-modal-customer-row mt-2">
              <div className="clientes-modal-avatar">
                {paymentModal.customerName.split(' ').filter(Boolean).slice(0, 2).map((s) => s[0]).join('').toUpperCase()}
              </div>
              <span className="clientes-modal-customer-name">{paymentModal.customerName}</span>
            </div>
            {receivableOrders[paymentModal.id] && <p className="modal-sub-desc">Pago de comanda #{receivableOrders[paymentModal.id].orderNumber}</p>}
            <div className="clientes-debt-highlight mt-2">
              <span className="clientes-debt-label">Deuda restante</span>
              <MoneyWithBcv usd={paymentModal.balancePending} className="clientes-debt-amount" usdClassName="font-bold" compact />
            </div>

            <ReceivablePaymentEditor key={paymentModal.id} variant="clientes" credit={paymentModal} accounts={financialAccounts} exchangeRate={bcvRate} saving={paymentSaving} error={paymentError} initialNotes={receivableOrders[paymentModal.id]?.orderNumber ? `Pago de comanda #${receivableOrders[paymentModal.id].orderNumber}` : 'Abono a cuenta por cobrar'} onSubmit={(payments, notes) => void handlePayment(payments, notes)} />
            <div className="modal-actions-row-right mt-4"><button type="button" className="btn-modal-cancel" onClick={() => closePaymentModal()}>Cancelar</button></div>
          </div>
        </div>,
        document.body
      )}

      {/* Modal Cuentas por cobrar */}
      {showCobrarModal && createPortal((
        <>
        <div className={`modal-overlay-dark receivables-modal-overlay ${closingCobrar ? 'closing' : ''}`} onClick={() => closeCobrarModal()}>
          <div className="client-modal-box receivables-modal-box animate-pop clientes-modal-glow" role="dialog" aria-modal="true" aria-labelledby="receivables-modal-title" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header-line clientes-modal-header-glow">
              <div className="side-header-title">
                <DollarSign size={18} className="text-red" />
                <h3 id="receivables-modal-title" className="modal-title">Cuentas por cobrar</h3>
              </div>
              <button className="modal-close-btn" onClick={() => closeCobrarModal()}><X size={18} /></button>
            </div>

            <div className="cobrar-total-area clientes-cobrar-total-highlight mt-3">
              <MoneyWithBcv usd={totalOutstanding} className="cobrar-total-val" align="center" />
              <span className="cobrar-total-sub">Total pendiente</span>
            </div>

            <div className="receivables-summary-row">
              <span className="clientes-summary-chip">{credits.filter((credit) => credit.balancePending > 0).length} cuentas activas</span>
              <span className="clientes-summary-chip">{pendingReceivableOrderCount} comandas a crédito</span>
            </div>
            <div className="receivables-list">
              {receivablesLoading && <LoadingSkeleton label="Cargando detalle de créditos" count={3} />}
              {credits.filter((credit) => credit.balancePending > 0).map((credit) => {
                const order = receivableOrders[credit.id]
                const days = Math.max(0, Math.floor((Date.now() - new Date(credit.createdAt).getTime()) / 86400000))
                return <div className="receivable-row" key={credit.id}>
                  <div>
                    <strong>{credit.customerName}</strong>
                    <span>{order ? `Comanda #${order.orderNumber} · ${order.itemsText || 'Sin detalle'}` : 'Crédito manual'}</span>
                    <small>Desde hace {days} día{days === 1 ? '' : 's'} · {formatDate(credit.createdAt)}</small>
                  </div>
                  <div className="receivable-row-actions">
                    <MoneyWithBcv usd={credit.balancePending} className="legend-val font-bold" compact />
                    <button type="button" className="receivable-payment-button" onClick={() => openReceivablePayment(credit)}>
                      Registrar pago
                    </button>
                  </div>
                </div>
              })}
              {!receivablesLoading && credits.filter((credit) => credit.balancePending > 0).length === 0 && <p className="modal-sub-desc">No hay cuentas por cobrar activas.</p>}
            </div>
          </div>
        </div>
        </>
      ), document.body)}

      {/* Modal Nuevo pedido (embebido, no navega a Caja) */}
      {showQuickOrderModal && selectedClient && (
        <QuickOrderModal
          bcvRate={bcvRate}
          client={selectedClient}
          isDemoMode={isDemoMode}
          products={products}
          userId={user?.id}
          onClose={() => setShowQuickOrderModal(false)}
          onCreated={(orders, freshCredits) => { setCustomerOrders(orders); setCredits(freshCredits) }}
        />
      )}

      {/* Modal Detalle de pedido (desde el historial, todo con nombres completos) */}
      {orderDetail && createPortal(
        <div className={`modal-overlay-dark ${closingOrderDetail ? 'closing' : ''}`} onClick={closeOrderDetail}>
          <div className="client-modal-box order-detail-modal animate-pop clientes-modal-glow" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header-line clientes-modal-header-glow">
              <div>
                <h3 className="modal-title">Pedido #{String(orderDetail.orderNumber).padStart(6, '0')}</h3>
                <p className="modal-sub-desc">{formatDateTime(orderDetail.createdAt)}</p>
              </div>
              <button className="modal-close-btn" onClick={closeOrderDetail}><X size={18} /></button>
            </div>

            <div className="order-detail-badges mt-2">
              <span className="hero-pill blue">
                {(() => { const Icon = ORDER_TYPE_ICONS[orderDetail.orderType] ?? Package; return <Icon size={13} /> })()}
                {ORDER_TYPE_LABELS[orderDetail.orderType] ?? orderDetail.orderType ?? 'Sin tipo'}
              </span>
              <span className={`status-pill-sub ${orderDetail.fulfillmentStatus === 'delivered' ? 'green' : 'gold'}`}>
                {(FULFILLMENT_LABELS[orderDetail.fulfillmentStatus] ?? orderDetail.fulfillmentStatus) || orderDetail.status}
              </span>
              <span className={`hero-pill ${orderDetail.status === 'paid' ? 'green' : 'red'}`}>
                {orderDetail.status === 'paid' ? 'Pagado' : 'Pendiente de pago'}
              </span>
            </div>

            <div className="order-detail-section mt-3">
              <span className="field-label-white">Productos</span>
              <div className="order-detail-items">
                {orderDetail.items.length > 0 ? orderDetail.items.map((item, idx) => (
                  <div className="order-detail-item-row" key={idx}>
                    <span className="order-detail-item-qty">{item.quantity}x</span>
                    <span className="order-detail-item-name">{formatProductTitle(item.productName)}</span>
                  </div>
                )) : <p className="modal-sub-desc">Sin detalle de productos.</p>}
              </div>
            </div>

            <div className="order-detail-section mt-3">
              <span className="field-label-white">Método de pago</span>
              <div className="order-detail-payment-list">
                {orderDetail.paymentMethods.length > 0
                  ? orderDetail.paymentMethods.map((method, idx) => {
                    const MethodIcon = PAYMENT_ICONS[method] ?? Wallet
                    return (
                      <span className="order-detail-payment-item" key={idx}>
                        <MethodIcon size={14} /> {PAYMENT_LABELS[method] ?? method}
                      </span>
                    )
                  })
                  : <span className="order-detail-payment-item text-muted-amount">Sin cobrar todavía</span>}
              </div>
            </div>

            <div className="quick-order-total-row mt-3">
              <span>Total del pedido</span>
              <MoneyWithBcv usd={orderDetail.total} className="quick-order-total-val" align="end" />
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  )

  // ═══════════════════════════════════════════════════════════════════════════
  // FICHA DE CLIENTE / PERFIL DEL CLIENTE VIEW (Matching Target Screenshot)
  // ═══════════════════════════════════════════════════════════════════════════
  if (selectedClient) {
    const fullCustomer = customers.find((c) => c.id === selectedClient.id) ?? null
    const customerCredits = credits.filter((credit) => credit.customerId === selectedClient.id || (!credit.customerId && normalizeCustomerName(credit.customerName) === normalizeCustomerName(selectedClient.name)))
    const ordersCount = customerOrders.length
    const totalPurchased = customerOrders.reduce((s, o) => s + o.total, 0)
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
    const productImageByName = new Map(products.map((p) => [normalizeForSearch(p.name), p]))
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
        title: `Abono a crédito · ${formatUsdText(payment.amount)}${payment.method ? ` · ${PAYMENT_LABELS[payment.method] ?? payment.method}` : ''}${(payment.changeAmount ?? 0) > 0 ? ` · Vuelto ${payment.changeCurrency === 'VES' ? 'Bs ' : '$'}${payment.changeAmount?.toFixed(2)}` : ''}`,
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
      <div className="page animate-fade-in management-workspace management-workspace--customers management-workspace--customer-profile" key="client-profile-view">

        {/* Title */}
        <div className="profile-breadcrumb-wrap">
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

        {/* HERO CLIENT CARD (Identity + headline stats, Apple-style focal card) */}
        <div className="profile-hero-v2" style={{ '--hero-accent': selectedClient.avatarBg } as CSSProperties}>
          <div className="hero-v2-top">
            <div className="hero-left-info">
              <div className="hero-v2-avatar" style={{ background: `linear-gradient(135deg, ${selectedClient.avatarBg}, ${selectedClient.avatarBg}99)` }}>
                {selectedClient.initials}
              </div>
              <div className="hero-text-details">
                <div className="hero-name-row">
                  <h2 className="hero-client-name">{selectedClient.name}</h2>
                </div>
                <div className="hero-subline">
                  <span className="hero-subline-item">
                    <Phone size={13} /> {selectedClient.phone || 'Sin teléfono'}
                  </span>
                  {selectedClient.phone && (
                    <>
                      <span className="hero-subline-sep" />
                      <button
                        className="btn-wsap-pill"
                        title="Enviar WhatsApp"
                        onClick={() => {
                          const phone = selectedClient.phone.replace(/\D/g, '')
                          if (phone) window.open(`https://wa.me/${phone.startsWith('58') ? phone : `58${phone.replace(/^0/, '')}`}`, '_blank', 'noopener,noreferrer')
                        }}
                      ><WhatsAppIcon size={13} /> WhatsApp</button>
                    </>
                  )}
                </div>

                <div className="hero-subline">
                  {selectedClient.identificationStatus === 'legacy_review' ? (
                    <span className="identity-badge legacy_review">Identificación por revisar</span>
                  ) : (
                    <span className="hero-subline-item">
                      <IdCard size={13} /> {selectedClient.identificationStatus === 'verified_format' ? `Cédula ${selectedClient.identification}` : 'Sin identificación'}
                    </span>
                  )}
                </div>

                <div className="hero-status-row">
                  {isFrecuente && <span className="hero-pill purple"><Tag size={13} /> Frecuente</span>}
                  <span className={`hero-pill ${fullCustomer?.isActive === false ? 'red' : 'green'}`}>
                    <span className="hero-status-dot" /> {fullCustomer?.isActive === false ? 'Inactivo' : 'Activo'}
                  </span>
                  <span className="hero-pill blue">
                    <Calendar size={13} /> Reg: {formatDate(fullCustomer?.createdAt ?? '')}
                  </span>
                  {birthdayText && (
                    <span className="hero-pill gold">
                      <Gift size={13} /> {birthdayText}
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="hero-right-actions">
              <button className="btn-hero-dark" title="Editar cliente" onClick={() => { if (fullCustomer) openEditCustomer(fullCustomer) }}>
                <Edit2 size={16} /> Editar
              </button>
              <button className="btn-hero-red" title="Nuevo pedido" onClick={() => setShowQuickOrderModal(true)}>
                <Plus size={16} /> Pedido
              </button>
            </div>
          </div>

          <div className="hero-v2-stats">
            <div className="hero-stat-item">
              <div className="hero-stat-icon"><ShoppingBag size={16} /></div>
              <div className="hero-stat-info">
                <span className="hero-stat-label">Total comprado</span>
                <MoneyWithBcv usd={totalPurchased} className="hero-stat-val" align="start" compact />
              </div>
            </div>
            <div className="hero-stat-item">
              <div className="hero-stat-icon"><Users size={16} /></div>
              <div className="hero-stat-info">
                <span className="hero-stat-label">Relación</span>
                <span className="hero-stat-val">{formatTenure(fullCustomer?.createdAt ?? '')}</span>
              </div>
            </div>
            <div className="hero-stat-item">
              <div className="hero-stat-icon"><ShoppingCart size={16} /></div>
              <div className="hero-stat-info">
                <span className="hero-stat-label">Última compra</span>
                <span className="hero-stat-val">{customerOrders[0] ? formatDate(customerOrders[0].createdAt) : 'Sin compras'}</span>
                {customerOrders[0] && <span className="hero-stat-sub">{formatRelativeDays(customerOrders[0].createdAt)}</span>}
              </div>
            </div>
            <div className="hero-stat-item">
              <div className="hero-stat-icon"><ClipboardList size={16} /></div>
              <div className="hero-stat-info">
                <span className="hero-stat-label">Pedidos</span>
                <span className="hero-stat-val">{ordersCount}</span>
                <span className="hero-stat-sub">Totales</span>
              </div>
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
                    <tr><td colSpan={8} className="profile-empty-state"><LoadingSkeleton label="Cargando actividad del cliente" count={4} /></td></tr>
                  ) : customerOrders.length === 0 ? (
                    <tr><td colSpan={8} className="profile-empty-state">Este cliente todavía no tiene pedidos enlazados.</td></tr>
                  ) : customerOrders.map((order) => {
                    const TypeIcon = ORDER_TYPE_ICONS[order.orderType]
                    const typeLabel = ORDER_TYPE_LABELS[order.orderType] ?? order.orderType ?? 'Sin tipo'
                    const firstItem = order.items[0]
                    const extraItems = order.items.length - 1
                    const paymentLabel = order.paymentMethods.length > 0
                      ? order.paymentMethods.map((method) => PAYMENT_LABELS[method] ?? method).join(' + ')
                      : 'Sin cobrar'
                    return (
                      <tr key={order.id} className="clickable-row" onClick={() => setOrderDetail(order)}>
                        <td className="font-bold text-white">#{String(order.orderNumber).padStart(6, '0')}</td>
                        <td className="date-sub-text">{formatDateTime(order.createdAt)}</td>
                        <td>
                          <span className="order-type-icon" title={typeLabel}>
                            {TypeIcon ? <TypeIcon size={14} /> : <Package size={14} />}
                          </span>
                        </td>
                        <td className="products-cell" title={order.itemsText || 'Sin detalle'}>
                          {firstItem
                            ? <>{firstItem.quantity}x {formatProductTitle(firstItem.productName)}{extraItems > 0 && <span className="products-more"> +{extraItems} más</span>}</>
                            : 'Sin detalle'}
                        </td>
                        <td><MoneyWithBcv usd={order.total} usdClassName="font-bold" compact /></td>
                        <td>
                          <span className={`status-pill-sub ${order.fulfillmentStatus === 'delivered' ? 'green' : 'gold'}`}>
                            {(FULFILLMENT_LABELS[order.fulfillmentStatus] ?? order.fulfillmentStatus) || order.status}
                          </span>
                        </td>
                        <td>
                          <span className="payment-method-icons" title={paymentLabel}>
                            {order.paymentMethods.length > 0
                              ? order.paymentMethods.map((method, idx) => {
                                const MethodIcon = PAYMENT_ICONS[method] ?? Wallet
                                return <MethodIcon key={idx} size={14} />
                              })
                              : <Wallet size={14} className="text-muted-amount" />}
                          </span>
                        </td>
                        <td>
                          <span className="date-sub-text">{order.status === 'paid' ? 'Pagado' : 'Pendiente'}</span>
                        </td>
                      </tr>
                    )
                  })}
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
                {activeCredits > 0
                  ? <span className="badge-tag-red">{activeCredits} activo{activeCredits === 1 ? '' : 's'}</span>
                  : <span className="profile-data-caption">Sin créditos activos</span>}
              </div>

              <div className="credit-hero-row mt-2">
                <span className="credit-label">Saldo pendiente</span>
                <MoneyWithBcv usd={pendingBalance} className="credit-val-big text-red" align="start" />
              </div>

              {creditedTotal > 0 ? (
                <>
                  <div className="credit-progress-wrap mt-3">
                    <div className="credit-progress-track">
                      <div
                        className="credit-progress-fill"
                        style={{ width: `${Math.min(100, (paidTowardCredit / creditedTotal) * 100)}%` }}
                      />
                    </div>
                    <div className="credit-progress-labels">
                      <span className="progress-label-paid"><span className="dot-green" /> Abonado {formatUsdText(paidTowardCredit)}</span>
                      <span className="progress-label-total">de {formatUsdText(creditedTotal)} emitido</span>
                    </div>
                  </div>

                  <div className="last-payment-received-row mt-3">
                    <div className="lp-left">
                      <span className="lp-label">Último pago recibido</span>
                      <span className="lp-date">{lastCreditPayment ? formatDateTime(lastCreditPayment.createdAt) : 'Sin abonos'}</span>
                    </div>
                    {lastCreditPayment && (
                      <div className="lp-right">
                        <MoneyWithBcv usd={lastCreditPayment.amount} className="lp-amount text-green font-bold" compact />
                        <span className="lp-badge">Registrado en el sistema</span>
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <p className="profile-empty-state compact mt-3">Este cliente no tiene créditos registrados.</p>
              )}
            </div>

            {/* Bottom Right Card: Actividad reciente */}
            <div className="side-activity-card mt-3">
              <div className="side-card-header">
                <h3 className="profile-card-title">Actividad reciente</h3>
                <span className="profile-data-caption">{recentActivity.length} evento{recentActivity.length === 1 ? '' : 's'}</span>
              </div>

              <div className="activity-timeline-vertical mt-2">
                {recentActivity.length === 0 && <div className="profile-empty-state compact">Sin actividad registrada.</div>}
                {recentActivity.map((activity, index) => (
                  <div className="activity-item" key={activity.id} style={{ animationDelay: `${index * 60}ms` }}>
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

            <div className="favorites-chips-row mt-2">
              {favoriteProducts.length === 0 && <div className="profile-empty-state compact">Sin productos suficientes para calcular favoritos.</div>}
              {favoriteProducts.map((favorite, index) => {
                const product = productImageByName.get(normalizeForSearch(favorite.name))
                return (
                  <div key={favorite.name} className={`favorite-chip ${index === 0 ? 'top' : ''}`}>
                    <span className="favorite-chip-rank">#{index + 1}</span>
                    {product?.imageUrl
                      ? <img src={product.imageUrl} alt="" className="favorite-chip-thumb" />
                      : <ShoppingBag size={14} />}
                    <span className="favorite-chip-name">{formatProductTitle(favorite.name)}</span>
                    <span className="favorite-chip-qty">×{favorite.quantity}</span>
                  </div>
                )
              })}
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

        {clientModals}
      </div>
    )
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // CLIENTS TABLE LIST VIEW
  // ═══════════════════════════════════════════════════════════════════════════

  const customerMetricCards = [
    <div key="total" className="kpi-card-dark red">
      <div className="kpi-icon-circle-box red"><Users size={22} /></div>
      <div className="kpi-content-box">
        <span className="kpi-label-sm">Total clientes</span>
        <span className="kpi-value-lg">{customers.length}</span>
      </div>
    </div>,
    <div key="frequent" className="kpi-card-dark gold">
      <div className="kpi-icon-circle-box gold"><Crown size={22} /></div>
      <div className="kpi-content-box">
        <span className="kpi-label-sm">Frecuentes</span>
        <span className="kpi-value-lg">{frequentCustomers}</span>
        <span className="kpi-sub-tag orange">5+ visitas</span>
      </div>
    </div>,
    <div key="credits" className="kpi-card-dark orange">
      <div className="kpi-icon-circle-box orange"><CreditCard size={22} /></div>
      <div className="kpi-content-box">
        <span className="kpi-label-sm">Créditos</span>
        <span className="kpi-value-lg">{activeCreditsCount}</span>
        <span className="kpi-sub-tag gold-text">Pendiente</span>
      </div>
    </div>,
    <button
      key="receivable"
      type="button"
      className="kpi-card-dark dark-red clickable-kpi kpi-card-receivable"
      title="Ver cuentas por cobrar"
      onClick={() => setShowCobrarModal(true)}
    >
      <div className="kpi-icon-circle-box dark-red"><DollarSign size={22} /></div>
      <div className="kpi-content-box">
        <span className="kpi-label-sm">Por cobrar</span>
        <span className="kpi-value-lg">{formatUsdText(totalOutstanding)}</span>
        <span className="kpi-sub-tag red-text">{customersWithDebt} cliente{customersWithDebt === 1 ? '' : 's'}</span>
      </div>
    </button>,
  ]

  if (loading) return <PageSkeleton cards={4} rows={8} hasTable />

  return (
    <div className="page animate-fade-in management-workspace management-workspace--customers" key="client-list-view">

      {/* Page Header */}
      <div className="clientes-page-header management-workspace-header">
        <div className="header-title-wrap">
          <div>
            <h1 className="page-title"><User size={22} className="page-title-icon" /> Clientes</h1>
            <p className="clientes-subtitle">
              <span className="clientes-subtitle-desktop">Gestiona tu base de clientes, créditos y actividad de compra.</span>
              <span className="clientes-subtitle-mobile">Clientes, compras y créditos.</span>
            </p>
          </div>
        </div>
        <button className="btn-nuevo-cliente-red" onClick={() => setShowNewModal(true)}>
          <Plus size={18} /> Nuevo cliente
        </button>
      </div>

      {/* 4 Summary KPI Cards */}
      <div className="clientes-kpi-grid management-workspace-metrics">
        {isPhoneViewport ? (
          <>
            <div
              className="clientes-kpi-phone-pair"
              onPointerDown={handleMetricPointerDown}
              onPointerUp={handleMetricPointerUp}
              onPointerCancel={() => { metricPointerStart.current = null }}
              onWheel={handleMetricWheel}
            >
              {customerMetricCards.slice(mobileMetricIndex * 2, mobileMetricIndex * 2 + 2)}
            </div>
            <div className="clientes-kpi-dots" role="group" aria-label="Seleccionar grupo de indicadores">
              {['Clientes y frecuentes', 'Créditos y por cobrar'].map((label, index) => (
                <button
                  key={label}
                  type="button"
                  className={`clientes-kpi-dot${mobileMetricIndex === index ? ' active' : ''}`}
                  aria-label={label}
                  aria-current={mobileMetricIndex === index ? 'true' : undefined}
                  onClick={() => setMobileMetricIndex(index)}
                />
              ))}
            </div>
          </>
        ) : customerMetricCards}
      </div>

      {/* Main Content Layout: Left Table + Right Sidebar Cards */}
      <div className="clientes-main-layout">
        {/* LEFT COLUMN: Customers Data Table Card */}
        <div className="clientes-table-card management-workspace-panel">
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
              {searchTerm && (
                <button type="button" className="search-clear-btn" onClick={() => setSearchTerm('')} aria-label="Borrar búsqueda">
                  <X size={13} />
                </button>
              )}
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

          </div>

          <div className="table-responsive-wrapper">
            <table className="clientes-custom-table">
              <thead>
                <tr>
                  <th>Cliente</th>
                  <th>Teléfono</th>
                  <th>Identificación</th>
                  <th>Últ. compra</th>
                  <th className="amount-th">Total</th>
                  <th className="amount-th">Pendiente</th>
                  <th>Estado</th>
                  <th style={{ textAlign: 'center' }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {displayRows.length === 0 ? (
                  <tr>
                    <td colSpan={8}>
                      <EmptyState
                        compact
                        title="No se encontraron clientes"
                        description="Prueba con otro nombre o ajusta los filtros."
                      />
                    </td>
                  </tr>
                ) : (
                  pagedRows.map((row) => (
                    <tr key={row.id} className="clickable-row" onClick={() => openClientProfile(row)}>
                      <td data-label="Cliente">
                        <div className="client-cell-wrap">
                          <span className="client-avatar-badge" style={{ backgroundColor: row.avatarBg }}>
                            {row.initials}
                          </span>
                          <span className="client-name-text">{row.name}</span>
                        </div>
                      </td>
                      <td className="phone-td" data-label="Teléfono">{row.phone || 'Sin teléfono'}</td>
                      <td data-label="Identificación">
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
                      <td className="date-td" data-label="Última compra">{row.lastPurchase}</td>
                      <td className="amount-td" data-label="Total comprado"><MoneyWithBcv usd={row.totalPurchased} className={row.totalPurchased === 0 ? "text-muted-amount" : "text-green"} usdClassName="font-bold" compact /></td>
                      <td className="amount-td" data-label="Saldo pendiente"><MoneyWithBcv usd={row.pendingBalance} className={row.pendingBalance > 0 ? "text-red" : "text-muted-amount"} usdClassName="font-bold" compact /></td>
                      <td data-label="Estado">
                        <span className={`status-badge-pill ${row.status.toLowerCase()}`}>
                          {row.status}
                        </span>
                      </td>
                      <td data-label="Acciones">
                        <div className="actions-flex-cell" onClick={(e) => e.stopPropagation()}>
                          <button className="icon-action-btn" title="Ver perfil del cliente" onClick={() => openClientProfile(row)}>
                            <Eye size={15} />
                          </button>
                          <button className="icon-action-btn" title="Editar cliente" onClick={() => { const c = customers.find(x => x.id === row.id); if (c) openEditCustomer(c) }}>
                            <Edit2 size={15} />
                          </button>
                          <button className="icon-action-btn danger" title="Desactivar cliente" onClick={() => handleDeactivateCustomer(row)}>
                            <Trash2 size={15} />
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
            <span className="pagination-info pagination-info-desktop">
              {displayRows.length === 0
                ? 'Sin resultados'
                : `Mostrando ${pageStart + 1}-${Math.min(pageStart + CLIENTS_PER_PAGE, displayRows.length)} de ${displayRows.length} clientes`}
            </span>
            <span className="pagination-info pagination-info-mobile">
              {displayRows.length === 0
                ? 'Sin resultados'
                : `${pageStart + 1}–${Math.min(pageStart + CLIENTS_PER_PAGE, displayRows.length)} de ${displayRows.length}`}
            </span>
            {totalPages > 1 && (
              <div className="pagination-controls">
                <button
                  type="button"
                  className="pag-btn"
                  disabled={safePage === 1}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  aria-label="Página anterior"
                >
                  <ChevronLeft size={16} />
                </button>
                <span className="pagination-info pagination-page-desktop">Página {safePage} de {totalPages}</span>
                <span className="pagination-info pagination-page-mobile">{safePage} / {totalPages}</span>
                <button
                  type="button"
                  className="pag-btn"
                  disabled={safePage === totalPages}
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  aria-label="Página siguiente"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            )}
          </div>
        </div>

      </div>

      {clientModals}
    </div>
  )
}
