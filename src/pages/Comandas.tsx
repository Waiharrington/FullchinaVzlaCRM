import { useState, useMemo, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { MoneyWithBcv } from '../components/MoneyWithBcv'
import { PaymentMethodSelect } from '../components/PaymentMethodSelect'
import {
  getOrdersWithItems,
  getActiveCashSession,
  recordOrderPayments,
  updateOrderStatus,
  type PaymentMethod,
  type CartItem,
} from '../lib/dataService'
import { AddItemsToOrderModal } from '../components/AddItemsToOrderModal'
import { confirmWebOrder, getPendingWebOrders } from '../lib/publicOrders'
import { supabase } from '../lib/supabase'
import { useRates } from '../context/rates-context'
import { formatUsd, formatVes } from '../lib/money'
import {
  Search,
  Calendar,
  ChevronDown,
  Filter,
  Clock,
  CheckCircle,
  Package,
  Truck,
  User,
  ShoppingBag,
  Bike,
  Plus,
  MapPin,
  CreditCard,
  Printer,
  Edit3,
  Hash,
  Phone,
  FileText,
  X,
  QrCode,
  ShieldCheck,
  Banknote,
  Smartphone,
  Landmark,
  Hexagon,
  BadgeDollarSign,
  Split,
} from 'lucide-react'
import './Comandas.css'

const PAYMENT_METHODS = [
  { method: 'cash', label: 'Efectivo', icon: <Banknote size={16} strokeWidth={1.8} /> },
  { method: 'mobile', label: 'Pago móvil', icon: <Smartphone size={16} strokeWidth={1.8} /> },
  { method: 'card', label: 'Punto', icon: <CreditCard size={16} strokeWidth={1.8} /> },
  { method: 'transfer', label: 'Transferencia', icon: <Landmark size={16} strokeWidth={1.8} /> },
  { method: 'binance', label: 'Binance', icon: <Hexagon size={16} strokeWidth={1.8} /> },
  { method: 'zelle', label: 'Zelle', icon: <BadgeDollarSign size={16} strokeWidth={1.8} /> },
  { method: 'split', label: 'Pago combinado', icon: <Split size={16} strokeWidth={1.8} /> },
] as const

type SplitPaymentMethod = Exclude<PaymentMethod, 'other'>
const SPLIT_PAYMENT_METHODS = PAYMENT_METHODS.filter(
  (item): item is (typeof PAYMENT_METHODS)[number] & { method: SplitPaymentMethod } => item.method !== 'split',
)
const usesBolivares = (method: SplitPaymentMethod) => method === 'mobile' || method === 'card' || method === 'transfer'
const requiresPaymentReference = (method: SplitPaymentMethod) => method !== 'cash'
const paymentReferenceLabel = (method: SplitPaymentMethod) => {
  if (method === 'card') return 'Referencia del voucher del punto *'
  if (method === 'binance') return 'ID de transacción de Binance *'
  if (method === 'zelle') return 'Confirmación de Zelle *'
  return 'Número de referencia *'
}
const paymentInputToUsd = (value: string, method: SplitPaymentMethod, rate: number | null) => {
  const amount = Number(value)
  if (!Number.isFinite(amount)) return 0
  return usesBolivares(method) ? (rate && rate > 0 ? amount / rate : 0) : amount
}
const usdToPaymentInput = (usd: number, method: SplitPaymentMethod, rate: number | null) =>
  (usesBolivares(method) ? usd * (rate || 0) : usd).toFixed(2)

export interface ComandaItem {
  id: string
  name: string
  quantity: number
  unitPrice?: number
  subtotal?: number
  observations?: string
}

export interface ComandaOrder {
  id: string
  orderNumber: string
  time: string
  date?: string
  isRetraso?: boolean
  customerName: string
  customerPhone?: string
  address?: string
  reference?: string
  paymentReference?: string
  orderType: string
  deliveryProvider?: string
  items: ComandaItem[]
  notes?: string
  paymentMethod: string
  paymentType: 'card' | 'cash' | 'app' | 'pending'
  isPaid: boolean
  totalAmount?: number
  serviceCharge?: number
  discount?: number
  bcvRate?: number
  elapsedMins: number
  status: 'new' | 'preparing' | 'ready' | 'delivered'
  deliveredTime?: string
  attendedBy?: string
  source?: 'pos' | 'web'
  webRequestId?: string
}

const MOCK_COMANDAS: ComandaOrder[] = []

// La ubicación GPS del cliente llega dentro de las notas del pedido web como un
// link de Google Maps. Estos helpers la extraen para mostrar un botón de mapa y
// limpian esa línea del texto de notas visible.
const MAPS_URL_RE = /https?:\/\/(?:maps\.google\.[a-z.]+|www\.google\.[a-z.]+\/maps|maps\.app\.goo\.gl|goo\.gl\/maps)\S*/i

function extractMapsUrl(notes?: string): string | null {
  if (!notes) return null
  const url = notes.match(MAPS_URL_RE)
  if (url) return url[0]
  const coords = notes.match(/(-?\d{1,3}\.\d+)\s*,\s*(-?\d{1,3}\.\d+)/)
  return coords ? `https://maps.google.com/?q=${coords[1]},${coords[2]}` : null
}

function cleanNotes(notes?: string): string {
  if (!notes) return ''
  return notes
    .split('\n')
    .filter((line) => !MAPS_URL_RE.test(line) && !/ubicaci[oó]n gps/i.test(line))
    .join('\n')
    .trim()
}

const COLUMNS = [
  { key: 'new', label: 'Nuevas', icon: <Package size={16} />, color: '#38bdf8', totalCount: 5 },
  { key: 'preparing', label: 'En preparación', icon: <Clock size={16} />, color: '#f97316', totalCount: 7 },
  { key: 'ready', label: 'Listas', icon: <CheckCircle size={16} />, color: '#10b981', totalCount: 15 },
  { key: 'delivered', label: 'Entregadas', icon: <Truck size={16} />, color: '#3b82f6', totalCount: 7 },
]

export function Comandas() {
  const navigate = useNavigate()
  const { bcvRate } = useRates()
  const [comandas, setComandas] = useState<ComandaOrder[]>(MOCK_COMANDAS)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedOrder, setSelectedOrder] = useState<ComandaOrder | null>(null)

  // Modal de cobro directo desde Comandas
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [paymentOrder, setPaymentOrder] = useState<ComandaOrder | null>(null)
  const [selectedPaymentTab, setSelectedPaymentTab] = useState<SplitPaymentMethod | 'split'>('cash')
  const [refNumber, setRefNumber] = useState('')
  const [amountReceived, setAmountReceived] = useState('')
  const [splitPrimaryMethod, setSplitPrimaryMethod] = useState<SplitPaymentMethod>('cash')
  const [splitSecondaryMethod, setSplitSecondaryMethod] = useState<SplitPaymentMethod>('mobile')
  const [splitPrimaryReference, setSplitPrimaryReference] = useState('')
  const [splitSecondaryReference, setSplitSecondaryReference] = useState('')
  const [paymentNote, setPaymentNote] = useState('')
  const [paymentError, setPaymentError] = useState('')
  const [paying, setPaying] = useState(false)
  const [statusError, setStatusError] = useState('')
  const [confirmingWebId, setConfirmingWebId] = useState<string | null>(null)
  const [reloadToken, setReloadToken] = useState(0)
  const [showAddItems, setShowAddItems] = useState(false)

  // Agrega ítems (ya insertados en BD) al detalle abierto de forma optimista y
  // recarga el tablero para reconciliar con los datos reales.
  const handleItemsAdded = (added: CartItem[]) => {
    setSelectedOrder((prev) => {
      if (!prev) return prev
      const newItems: ComandaItem[] = added.map((i, idx) => ({
        id: i.lineId || `added-${Date.now()}-${idx}`,
        name: i.productName,
        quantity: i.quantity,
        unitPrice: i.price,
        subtotal: i.price * i.quantity,
        observations:
          i.selectedModifiers && i.selectedModifiers.length > 0
            ? i.selectedModifiers.map((m) => m.optionName).join(', ')
            : undefined,
      }))
      const addedTotal = added.reduce((s, i) => s + i.price * i.quantity, 0)
      return { ...prev, items: [...prev.items, ...newItems], totalAmount: (prev.totalAmount || 0) + addedTotal }
    })
    setReloadToken((value) => value + 1)
  }
  const paymentRate = paymentOrder?.bcvRate && paymentOrder.bcvRate > 0 ? paymentOrder.bcvRate : bcvRate
  const splitPrimaryAmountUsd = paymentInputToUsd(amountReceived, splitPrimaryMethod, paymentRate)

  const handleOpenPaymentForOrder = async (order: ComandaOrder) => {
    // Abrir primero el modal para que el clic siempre tenga respuesta visual,
    // incluso si la validación de caja tarda o el backend devuelve un error.
    setPaymentOrder(order)
    setSelectedPaymentTab('cash')
    setRefNumber('')
    setAmountReceived(order.totalAmount?.toFixed(2) || '0.00')
    setSplitPrimaryMethod('cash')
    setSplitSecondaryMethod('mobile')
    setSplitPrimaryReference('')
    setSplitSecondaryReference('')
    setPaymentNote('')
    setPaymentError('Verificando la caja activa…')
    setShowPaymentModal(true)

    try {
      const activeSession = await getActiveCashSession()
      if (!activeSession) {
        setPaymentError('Debes abrir la caja antes de cobrar esta comanda.')
        return
      }
    } catch (cause) {
      setPaymentError(cause instanceof Error ? cause.message : 'No se pudo verificar la caja activa')
      return
    }
    setPaymentError('')
  }

  const handleSelectPaymentTab = (method: typeof selectedPaymentTab) => {
    setSelectedPaymentTab(method)
    setPaymentError('')
    setRefNumber('')
    setSplitPrimaryReference('')
    setSplitSecondaryReference('')
    if (method === 'split' && paymentOrder?.totalAmount) {
      setAmountReceived(usdToPaymentInput(paymentOrder.totalAmount / 2, 'cash', paymentRate))
    } else {
      const inputMethod: SplitPaymentMethod = method === 'split' ? 'cash' : method
      setAmountReceived(usdToPaymentInput(paymentOrder?.totalAmount || 0, inputMethod, paymentRate))
    }
  }

  const handleConfirmOrderPayment = async () => {
    if (!paymentOrder) return
    setPaying(true)
    setPaymentError('')
    try {
      const total = Number(paymentOrder.totalAmount ?? 0)
      const enteredAmount = Number(amountReceived)
      if (total <= 0) throw new Error('La comanda no tiene un total cobrable')
      if (!Number.isFinite(enteredAmount) || enteredAmount <= 0) {
        throw new Error('Ingresa un monto válido')
      }

      const requiresReference = selectedPaymentTab !== 'split' && requiresPaymentReference(selectedPaymentTab)
      if (requiresReference && !refNumber.trim()) {
        throw new Error('La referencia es obligatoria para este método')
      }

      let payments: Array<{
        method: PaymentMethod
        amount: number
        referenceNumber?: string
        receivedAmount?: number
        notes?: string
      }>

      if (selectedPaymentTab === 'split') {
        const primaryAmount = Math.round(splitPrimaryAmountUsd * 100) / 100
        const secondaryAmount = Math.round((total - primaryAmount) * 100) / 100
        if (primaryAmount <= 0 || secondaryAmount <= 0) {
          throw new Error('El pago combinado necesita dos montos mayores a cero')
        }
        if (splitPrimaryMethod === splitSecondaryMethod) {
          throw new Error('Selecciona dos métodos de pago diferentes')
        }
        if (requiresPaymentReference(splitPrimaryMethod) && !splitPrimaryReference.trim()) {
          throw new Error('Ingresa la referencia del primer método')
        }
        if (requiresPaymentReference(splitSecondaryMethod) && !splitSecondaryReference.trim()) {
          throw new Error('Ingresa la referencia del segundo método')
        }
        payments = [
          {
            method: splitPrimaryMethod,
            amount: primaryAmount,
            referenceNumber: splitPrimaryReference.trim() || undefined,
            receivedAmount: splitPrimaryMethod === 'cash' ? primaryAmount : undefined,
            notes: paymentNote || undefined,
          },
          {
            method: splitSecondaryMethod,
            amount: secondaryAmount,
            referenceNumber: splitSecondaryReference.trim() || undefined,
            receivedAmount: splitSecondaryMethod === 'cash' ? secondaryAmount : undefined,
            notes: paymentNote || undefined,
          },
        ]
      } else {
        if (selectedPaymentTab === 'cash' && enteredAmount < total) {
          throw new Error('El efectivo recibido no cubre el total')
        }
        payments = [{
          method: selectedPaymentTab,
          amount: total,
          referenceNumber: refNumber.trim() || undefined,
          receivedAmount: selectedPaymentTab === 'cash' ? enteredAmount : undefined,
          notes: paymentNote || undefined,
        }]
      }

      await recordOrderPayments({
        orderId: paymentOrder.id,
        payments,
        notes: paymentNote || null,
      })

      const methodLabels: Record<string, string> = {
        cash: 'Pago: Efectivo',
        mobile: 'Pago: Pago móvil',
        card: 'Pago: Punto',
        transfer: 'Pago: Transferencia',
        binance: 'Pago: Binance',
        zelle: 'Pago: Zelle',
        split: 'Pago combinado',
      }
      const methodLabel = methodLabels[selectedPaymentTab] || 'Pago: Efectivo'
      const payType: ComandaOrder['paymentType'] = selectedPaymentTab === 'cash'
        ? 'cash'
        : selectedPaymentTab === 'card' || selectedPaymentTab === 'split'
          ? 'card'
          : 'app'
      const paymentReference = selectedPaymentTab === 'split'
        ? [splitPrimaryReference.trim() && `Método 1: ${splitPrimaryReference.trim()}`, splitSecondaryReference.trim() && `Método 2: ${splitSecondaryReference.trim()}`].filter(Boolean).join(' · ')
        : refNumber.trim()

      setComandas(prev =>
        prev.map(c =>
          c.id === paymentOrder.id
            ? {
                ...c,
                isPaid: true,
                paymentMethod: methodLabel,
                paymentType: payType,
                paymentReference: paymentReference || undefined,
              }
            : c
        )
      )

      if (selectedOrder?.id === paymentOrder.id) {
        setSelectedOrder(prev => prev ? {
          ...prev,
          isPaid: true,
          paymentMethod: methodLabel,
          paymentType: payType,
          paymentReference: paymentReference || undefined,
        } : null)
      }

      setShowPaymentModal(false)
      setPaymentOrder(null)
    } catch (e) {
      console.error('Error al confirmar pago:', e)
      setPaymentError(e instanceof Error ? e.message : 'No se pudo registrar el pago')
    } finally {
      setPaying(false)
    }
  }

  // Fetch real orders from Supabase / dataService
  useEffect(() => {
    let active = true
    const loadRealOrders = async () => {
      try {
        const today = new Date().toISOString().split('T')[0]
        const [realOrders, webOrders] = await Promise.all([
          getOrdersWithItems(today + 'T00:00:00', today + 'T23:59:59'),
          getPendingWebOrders(),
        ])

        const creatorNames = new Map<string, string>()
        const creatorIds = [...new Set(realOrders.map(order => order.createdBy).filter(Boolean))]
        if (supabase && creatorIds.length > 0) {
          const { data: profiles, error: profilesError } = await supabase
            .from('profiles')
            .select('id,full_name')
            .in('id', creatorIds)

          if (profilesError) {
            console.warn('No se pudieron cargar los nombres de quienes atendieron:', profilesError)
          } else {
            for (const profile of profiles ?? []) {
              creatorNames.set(String(profile.id), String(profile.full_name || 'Usuario del sistema'))
            }
          }
        }

        if (active) {
          const mapped: ComandaOrder[] = realOrders.map((o) => {
            const date = new Date(o.createdAt)
            const elapsed = Math.floor((Date.now() - date.getTime()) / 60000)
            const status: ComandaOrder['status'] = o.fulfillmentStatus

            const hasPaid = o.status === 'paid' || o.status === 'delivered' || o.status === 'completed'
            const paymentMethods = [...new Set(o.payments.map((payment) => payment.method))]
            const paymentLabels: Record<PaymentMethod, string> = {
              cash: 'Efectivo',
              mobile: 'Pago móvil',
              card: 'Punto',
              transfer: 'Transferencia',
              binance: 'Binance',
              zelle: 'Zelle',
              other: 'Otro',
            }
            const persistedPaymentLabel = paymentMethods.length > 1
              ? 'Pago combinado'
              : paymentMethods.length === 1
                ? `Pago: ${paymentLabels[paymentMethods[0]]}`
                : 'Pago registrado'
            const persistedReference = o.payments
              .map((payment) => payment.referenceNumber)
              .find((reference): reference is string => Boolean(reference))

            return {
              id: o.id,
              orderNumber: `#FC-${String(o.orderNumber).padStart(6, '0')}`,
              time: date.toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit' }),
              date: date.toLocaleDateString('es-VE', { day: '2-digit', month: '2-digit', year: 'numeric' }),
              isRetraso: elapsed > 15 && status !== 'delivered',
              customerName: o.customerName || 'Cliente general',
              customerPhone: '0412-1234567',
              address: o.orderType === 'delivery' ? 'Av. Principal, Edificio Central' : '',
              reference: o.orderType === 'delivery' ? 'Dejar en recepción' : '',
              paymentReference: persistedReference,
              orderType: o.orderType === 'takeaway' ? 'Para llevar' : o.orderType === 'delivery' ? 'Delivery' : o.orderType === 'dine-in' ? 'Mesa' : 'Para llevar',
              items: o.items.map((item) => ({
                id: item.id,
                name: item.productName,
                quantity: item.quantity,
                unitPrice: item.unitPrice || 0,
                subtotal: (item.quantity || 0) * (item.unitPrice || 0),
                observations: '',
              })),
              notes: o.notes || '',
              paymentMethod: hasPaid ? persistedPaymentLabel : '⚠️ Sin pagar',
              paymentType: hasPaid
                ? paymentMethods.includes('cash')
                  ? 'cash'
                  : paymentMethods.includes('mobile') || paymentMethods.includes('transfer')
                    ? 'app'
                    : 'card'
                : 'pending' as const,
              isPaid: hasPaid,
              totalAmount: o.totalAmount || 0,
              serviceCharge: 0,
              discount: 0,
              bcvRate: o.bcvRate || undefined,
              elapsedMins: elapsed < 0 ? 1 : elapsed,
              status,
              deliveredTime: status === 'delivered' ? date.toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit' }) : undefined,
              attendedBy: creatorNames.get(o.createdBy) || 'Usuario del sistema',
              source: 'pos',
            }
          })
          const pendingWeb: ComandaOrder[] = webOrders.map((order) => {
            const date = new Date(order.createdAt)
            const elapsed = Math.max(0, Math.floor((Date.now() - date.getTime()) / 60000))
            return {
              id: `web:${order.id}`,
              webRequestId: order.id,
              source: 'web',
              orderNumber: order.code,
              time: date.toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit' }),
              date: date.toLocaleDateString('es-VE'),
              isRetraso: elapsed > 10,
              customerName: order.customerName,
              customerPhone: order.customerPhone,
              address: order.deliveryAddress || '',
              orderType: order.orderType === 'delivery' ? 'Delivery' : 'Para llevar',
              items: order.items.map(item => ({ id: item.id, name: item.productName, quantity: item.quantity, unitPrice: item.price, subtotal: item.price * item.quantity })),
              notes: order.notes || '',
              paymentMethod: 'Pendiente de confirmar',
              paymentType: 'pending',
              isPaid: false,
              totalAmount: order.subtotal,
              serviceCharge: 0,
              discount: 0,
              bcvRate: order.bcvRate || undefined,
              elapsedMins: elapsed,
              status: 'new',
              attendedBy: 'Pedido desde la web',
            }
          })
          setComandas([...pendingWeb, ...mapped])
        }
      } catch (e) {
        console.error('Error cargando comandas reales:', e)
      }
    }

    loadRealOrders()
    const interval = setInterval(loadRealOrders, 10000)
    return () => { active = false; clearInterval(interval) }
  }, [reloadToken])

  const handleConfirmWebOrder = async (order: ComandaOrder) => {
    if (!order.webRequestId) return
    setConfirmingWebId(order.webRequestId)
    try {
      await confirmWebOrder(order.webRequestId)
      setSelectedOrder(null)
      setReloadToken(value => value + 1)
    } catch (cause) {
      console.error('Error confirmando pedido web:', cause)
      window.alert(cause instanceof Error ? cause.message : 'No se pudo confirmar el pedido web')
    } finally {
      setConfirmingWebId(null)
    }
  }

  // Simulation timer for elapsed mins
  useEffect(() => {
    const timer = setInterval(() => {
      setComandas(prev =>
        prev.map(c => (c.status !== 'delivered' ? { ...c, elapsedMins: c.elapsedMins + 1 } : c))
      )
    }, 60000)
    return () => clearInterval(timer)
  }, [])

  const filteredComandas = useMemo(() => {
    return comandas.filter(c => {
      const matchSearch =
        c.orderNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.items.some(i => i.name.toLowerCase().includes(searchQuery.toLowerCase()))
      return matchSearch
    })
  }, [comandas, searchQuery])

  const getOrdersByStatus = (statusKey: string) => {
    return filteredComandas.filter(c => c.status === statusKey)
  }

  const handleAdvanceStatus = async (orderId: string, currentStatus: string) => {
    let nextStatus: ComandaOrder['status'] = 'preparing'
    if (currentStatus === 'new') nextStatus = 'preparing'
    else if (currentStatus === 'preparing') nextStatus = 'ready'
    else if (currentStatus === 'ready') nextStatus = 'delivered'

    setStatusError('')
    setComandas(prev =>
      prev.map(c =>
        c.id === orderId
          ? {
              ...c,
              status: nextStatus,
              isRetraso: false,
              deliveredTime: nextStatus === 'delivered' ? new Date().toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit' }) : c.deliveredTime
            }
          : c
      )
    )

    try {
      await updateOrderStatus(orderId, nextStatus)
    } catch (e) {
      console.error('Error actualizando estado en servidor:', e)
      setComandas(prev => prev.map(comanda => (
        comanda.id === orderId ? { ...comanda, status: currentStatus as ComandaOrder['status'] } : comanda
      )))
      setStatusError('No se pudo guardar el cambio de estado. Intenta nuevamente.')
    }
  }

  const totalComandasCount = comandas.length
  const pendientesCount = comandas.filter(c => c.status === 'new' || c.status === 'preparing').length
  const listasCount = comandas.filter(c => c.status === 'ready').length
  const activeComandas = comandas.filter(c => c.status !== 'delivered')
  const avgMins = activeComandas.length > 0
    ? Math.round(activeComandas.reduce((sum, comanda) => sum + comanda.elapsedMins, 0) / activeComandas.length)
    : 0

  return (
    <div className="comandas-page animate-fade-in">
      {/* Comandas Header + Stat Cards Row */}
      <div className="comandas-header-row">
        <div className="comandas-header-left">
          <div className="header-icon-box red">📋</div>
          <div>
            <h1 className="comandas-title">Comandas</h1>
            <p className="comandas-subtitle">Gestiona el estado de tus pedidos en tiempo real.</p>
          </div>
        </div>

        <div className="comandas-header-right">
          <div className="comandas-stats-row">
            <div className="stat-card-mini">
              <span className="stat-number text-red">{totalComandasCount}</span>
              <div className="stat-info">
                <span className="stat-title">Total comandas</span>
                <span className="stat-sub">Hoy</span>
              </div>
            </div>

            <div className="stat-card-mini">
              <span className="stat-number text-orange">{pendientesCount}</span>
              <div className="stat-info">
                <span className="stat-title">Pendientes</span>
                <span className="stat-sub">Nuevas + En preparación</span>
              </div>
            </div>

            <div className="stat-card-mini">
              <span className="stat-number text-green">{listasCount}</span>
              <div className="stat-info">
                <span className="stat-title">Listas</span>
                <span className="stat-sub">Para entrega</span>
              </div>
            </div>

            <div className="stat-card-mini">
              <div className="stat-time-group">
                <Clock size={16} className="text-blue" />
                <span className="stat-number text-white">{avgMins > 0 ? `${avgMins} min` : '--'}</span>
              </div>
              <div className="stat-info">
                <span className="stat-title">Tiempo promedio</span>
                <span className="stat-sub">Hoy</span>
              </div>
            </div>
          </div>

          <button className="btn-nueva-comanda" onClick={() => navigate('/caja')}>
            <Plus size={16} />
            <span>Nueva comanda</span>
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="comandas-filters">
        <div className="filter-group-item">
          <Calendar size={14} />
          <span>Hoy</span>
          <ChevronDown size={12} />
        </div>

        <div className="filter-group-item">
          <Filter size={14} />
          <span>Estado</span>
          <ChevronDown size={12} />
        </div>

        <div className="filter-group-item">
          <Package size={14} />
          <span>Tipo de pedido</span>
          <ChevronDown size={12} />
        </div>

        <button className="filter-group-item filter-btn-dark">
          <Filter size={14} />
          <span>Filtros</span>
        </button>

        <div className="filter-search-inline">
          <Search size={14} />
          <input
            type="text"
            placeholder="Buscar por número, cliente o teléfono..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {statusError && <div className="command-status-error" role="alert">{statusError}</div>}

      {/* 4 Kanban Columns matching Target Mockup */}
      <div className="kanban-board-grid">
        {COLUMNS.map(col => {
          const colOrders = getOrdersByStatus(col.key)

          return (
            <div key={col.key} className="kanban-column">
              {/* Column Header */}
              <div className="kanban-col-header" style={{ borderBottomColor: col.color }}>
                <div className="col-header-left">
                  <span className="col-icon" style={{ color: col.color }}>{col.icon}</span>
                  <h3 className="col-title">{col.label}</h3>
                </div>
                <span className="col-count-badge">{colOrders.length}</span>
              </div>

              {/* Column Body / Order Cards */}
              <div className="kanban-col-body">
                {colOrders.length === 0 ? (
                  <div className="empty-col">Sin comandas</div>
                ) : (
                  colOrders.map(order => (
                    <div
                      key={order.id}
                      className={`comanda-card-item card-${order.status} ${order.isRetraso ? 'has-retraso' : ''}`}
                      onClick={() => { setShowAddItems(false); setSelectedOrder(order) }}
                    >
                      {/* Top Header line */}
                      <div className="card-top-line">
                        <span className="card-order-no">{order.orderNumber}</span>
                        <div className="card-time-wrap">
                          <span className="card-time-text">{order.time}</span>
                          {order.isRetraso && (
                            <span className="badge-retraso">⏰ Retraso</span>
                          )}
                        </div>
                      </div>

                      {/* Customer & Delivery line */}
                      <div className="card-customer-line">
                        <span className="customer-name">
                          <User size={13} className="meta-icon" /> {order.customerName}
                        </span>
                        <span className="order-type-tag">
                          {order.orderType === 'Delivery' ? <Bike size={13} /> : <ShoppingBag size={13} />} {order.orderType}
                        </span>
                      </div>

                      {/* Item list */}
                      <div className="card-items-list">
                        {order.items.map(item => (
                          <div key={item.id} className="card-item-row">
                            <span className="dot-indicator" style={{ backgroundColor: col.color }}></span>
                            <span className="item-name-text">{item.name}</span>
                            <span className="item-qty-text">× {item.quantity}</span>
                          </div>
                        ))}
                      </div>

                      {/* Footer Row */}
                      <div className="card-footer-line">
                        {order.source === 'web' ? (
                          <span className="badge-sin-pagar">🌐 Web · Por confirmar</span>
                        ) : order.isPaid ? (
                          <span className={`payment-type-badge pay-${order.paymentType}`}>
                            {order.paymentMethod}
                          </span>
                        ) : (
                          <span className="badge-sin-pagar">⚠️ Sin cobrar</span>
                        )}

                        {order.status === 'ready' ? (
                          <div className="status-ready-group">
                            <span className="badge-ready-tag">✓ Listo</span>
                            <span className="timer-mins text-green">⏱️ {order.elapsedMins} min</span>
                          </div>
                        ) : order.status === 'delivered' ? (
                          <span className="badge-delivered-tag">
                            Entregado {order.deliveredTime} ✓
                          </span>
                        ) : (
                          <span className={`timer-mins ${order.isRetraso ? 'text-red-urgent' : 'text-orange'}`}>
                            {order.isRetraso ? '⏰' : '⏱️'} {order.elapsedMins} min
                          </span>
                        )}
                      </div>

                      {/* Quick Advance Status Action */}
                      {order.source === 'web' ? (
                        <button
                          className="quick-advance-btn"
                          disabled={confirmingWebId === order.webRequestId}
                          onClick={e => { e.stopPropagation(); handleConfirmWebOrder(order) }}
                        >
                          {confirmingWebId === order.webRequestId ? 'Confirmando…' : '✅ Confirmar pedido de WhatsApp'}
                        </button>
                      ) : order.status !== 'delivered' && (
                        <button
                          className="quick-advance-btn"
                          onClick={e => {
                            e.stopPropagation()
                            handleAdvanceStatus(order.id, order.status)
                          }}
                        >
                          {order.status === 'new'
                            ? '👨‍🍳 Iniciar preparación'
                            : order.status === 'preparing'
                            ? '✅ Marcar como lista'
                            : '🚚 Marcar como entregada'}
                        </button>
                      )}
                    </div>
                  ))
                )}
              </div>

              {/* Column Footer */}
              <div className="kanban-col-footer">
                <button className="ver-todas-btn">
                  + Ver todas ({col.totalCount})
                </button>
              </div>
            </div>
          )
        })}
      </div>

      {/* Agregar productos a una comanda sin cobrar */}
      {showAddItems && selectedOrder && !selectedOrder.isPaid && (
        <AddItemsToOrderModal
          orderId={selectedOrder.id}
          orderNumber={selectedOrder.orderNumber}
          onClose={() => setShowAddItems(false)}
          onAdded={handleItemsAdded}
        />
      )}

      {/* Modal detail */}
      {selectedOrder && createPortal(
        <div className="cmd-modal-overlay" onClick={() => setSelectedOrder(null)}>
          <div className="cmd-modal-container animate-pop" onClick={e => e.stopPropagation()}>
            <header className="cmd-modal-header">
              <div className="cmd-modal-title">
                <Clock size={18} className="cmd-icon-title" />
                <span>Detalle de comanda</span>
                <h2>{selectedOrder.orderNumber}</h2>
                <div className={`cmd-badge ${selectedOrder.status}`}>
                  {selectedOrder.status === 'new' && 'Nueva'}
                  {selectedOrder.status === 'preparing' && 'En preparación'}
                  {selectedOrder.status === 'ready' && 'Lista'}
                  {selectedOrder.status === 'delivered' && 'Entregada'}
                </div>
                {selectedOrder.isPaid ? (
                  <div className="cmd-badge paid">Pagado</div>
                ) : (
                  <div className="cmd-badge sin-pagar">⚠️ Sin cobrar</div>
                )}
                <div className="cmd-badge delivery">{selectedOrder.orderType}</div>
              </div>
              <button className="cmd-close-btn" onClick={() => setSelectedOrder(null)}><X size={20} /></button>
            </header>

            <div className="cmd-modal-meta">
              <div className="cmd-meta-item">
                <User size={14} className="cmd-meta-icon" />
                <div>
                  <span className="cmd-meta-label">Cliente</span>
                  <span className="cmd-meta-val">{selectedOrder.customerName}</span>
                </div>
              </div>
              <div className="cmd-meta-item">
                <Phone size={14} className="cmd-meta-icon" />
                <div>
                  <span className="cmd-meta-label">Teléfono</span>
                  <span className="cmd-meta-val">{selectedOrder.customerPhone || '-'}</span>
                </div>
              </div>
              <div className="cmd-meta-item">
                <Calendar size={14} className="cmd-meta-icon" />
                <div>
                  <span className="cmd-meta-label">Fecha</span>
                  <span className="cmd-meta-val">{selectedOrder.date || '24/05/2025'}</span>
                </div>
              </div>
              <div className="cmd-meta-item">
                <Clock size={14} className="cmd-meta-icon" />
                <div>
                  <span className="cmd-meta-label">Hora</span>
                  <span className="cmd-meta-val">{selectedOrder.time}</span>
                </div>
              </div>
              <div className="cmd-meta-item">
                <User size={14} className="cmd-meta-icon" />
                <div>
                  <span className="cmd-meta-label">Atendido por</span>
                  <span className="cmd-meta-val">{selectedOrder.attendedBy || 'Admin'}</span>
                </div>
              </div>
              <div className="cmd-meta-item">
                <Hash size={14} className="cmd-meta-icon" />
                <div>
                  <span className="cmd-meta-label">Nº de pedido</span>
                  <span className="cmd-meta-val">{selectedOrder.orderNumber.replace('#FC-', '')}</span>
                </div>
              </div>
              <div className="cmd-meta-item cmd-time-elapsed">
                <Clock size={14} className="cmd-meta-icon text-orange" />
                <div>
                  <span className="cmd-meta-label text-orange">Tiempo transcurrido</span>
                  <span className="cmd-meta-val text-orange font-bold">{selectedOrder.elapsedMins} min</span>
                </div>
              </div>
            </div>

            <div className="cmd-modal-body">
              <div className="cmd-col-left">
                {selectedOrder.orderType === 'Delivery' && (
                  <div className="cmd-section cmd-address-section">
                    <div className="cmd-section-title"><MapPin size={16} /> Dirección de entrega</div>
                    <div className="cmd-address-content">
                      <div className="cmd-address-text">
                        <p>{selectedOrder.address || 'Sin dirección registrada'}</p>
                        {selectedOrder.reference && <p className="cmd-reference">Referencia de entrega: {selectedOrder.reference}</p>}
                        {selectedOrder.paymentReference && <p className="cmd-reference">Referencia de pago: {selectedOrder.paymentReference}</p>}
                      </div>
                      {extractMapsUrl(selectedOrder.notes) ? (
                        <a
                          className="cmd-map-link"
                          href={extractMapsUrl(selectedOrder.notes)!}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <MapPin size={18} />
                          <span>Ver ubicación</span>
                        </a>
                      ) : (
                        <div className="cmd-map-placeholder">
                          <MapPin size={24} className="cmd-map-icon" />
                        </div>
                      )}
                    </div>
                  </div>
                )}

                <div className="cmd-section">
                  <div className="cmd-section-title cmd-section-title-row">
                    <span className="cmd-section-title-text"><ShoppingBag size={16} /> Producción del pedido</span>
                    {!selectedOrder.isPaid && (
                      <button type="button" className="cmd-add-item-btn" onClick={() => setShowAddItems(true)}>
                        <Plus size={14} /> Agregar producto
                      </button>
                    )}
                  </div>
                  <div className="cmd-items-table-wrap">
                    <table className="cmd-items-table">
                      <thead>
                        <tr>
                          <th>Producto</th>
                          <th>Observaciones / Extras</th>
                          <th>Cant.</th>
                          <th>P. Unit.</th>
                          <th>Subtotal</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedOrder.items.map(item => (
                          <tr key={item.id}>
                            <td>
                              <div className="cmd-product-cell">
                                <div className="cmd-product-img">🍔</div>
                                <span>{item.name}</span>
                              </div>
                            </td>
                            <td className="cmd-obs">{item.observations || '—'}</td>
                            <td>x{item.quantity}</td>
                            <td><MoneyWithBcv usd={item.unitPrice || 0} rate={selectedOrder.bcvRate} compact /></td>
                            <td><MoneyWithBcv usd={item.subtotal || 0} rate={selectedOrder.bcvRate} compact /></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="cmd-section cmd-notes-section">
                  <div className="cmd-section-title"><FileText size={16} /> Notas del pedido</div>
                  <div className="cmd-notes-content">
                    {cleanNotes(selectedOrder.notes) ? cleanNotes(selectedOrder.notes).split('\n').map((line, i) => <p key={i}>{line}</p>) : <p>Sin notas adicionales.</p>}
                  </div>
                </div>
              </div>

              <div className="cmd-col-right">
                <div className="cmd-section cmd-payment-section">
                  <div className="cmd-section-title"><CreditCard size={16} /> Resumen de pago</div>
                  
                  <div className="cmd-summary-row">
                    <span>Subtotal</span>
                    <MoneyWithBcv usd={selectedOrder.totalAmount! - (selectedOrder.serviceCharge || 0) + (selectedOrder.discount || 0)} rate={selectedOrder.bcvRate} compact />
                  </div>
                  {(selectedOrder.serviceCharge || 0) > 0 && (
                    <div className="cmd-summary-row">
                      <span>Cargo por servicio (10%)</span>
                      <MoneyWithBcv usd={selectedOrder.serviceCharge || 0} rate={selectedOrder.bcvRate} compact />
                    </div>
                  )}
                  {(selectedOrder.discount || 0) > 0 && (
                    <div className="cmd-summary-row cmd-discount">
                      <span>Descuento</span>
                      <MoneyWithBcv usd={-(selectedOrder.discount || 0)} rate={selectedOrder.bcvRate} compact />
                    </div>
                  )}
                  
                  <div className="cmd-summary-total">
                    <span>TOTAL</span>
                    <MoneyWithBcv usd={selectedOrder.totalAmount || 0} rate={selectedOrder.bcvRate} className="cmd-total-amounts" usdClassName="cmd-total-usd" />
                  </div>

                  <div className="cmd-payment-method-row">
                    <span className="cmd-method-label">Método de pago</span>
                    <span className="cmd-method-badge">{selectedOrder.isPaid ? selectedOrder.paymentMethod : '⚠️ Sin cobrar'}</span>
                  </div>

                  <div className="cmd-breakdown-section">
                    <div className="cmd-summary-row cmd-breakdown-title">Desglose del pago</div>
                    {selectedOrder.isPaid ? (
                      <div className="cmd-summary-row cmd-breakdown-item">
                        <span className="cmd-paid-green">Pagado ({selectedOrder.paymentMethod})</span>
                        <MoneyWithBcv usd={selectedOrder.totalAmount || 0} rate={selectedOrder.bcvRate} compact />
                      </div>
                    ) : (
                      <div className="cmd-summary-row cmd-breakdown-item">
                        <span className="cmd-paid-yellow">⚠️ Pendiente de cobro</span>
                        <MoneyWithBcv usd={selectedOrder.totalAmount || 0} rate={selectedOrder.bcvRate} className="cmd-paid-yellow" compact />
                      </div>
                    )}
                  </div>

                  <div className="cmd-summary-row cmd-total-paid">
                    <span>Total pagado</span>
                    <MoneyWithBcv usd={selectedOrder.isPaid ? selectedOrder.totalAmount || 0 : 0} rate={selectedOrder.bcvRate} className={selectedOrder.isPaid ? 'cmd-paid-green' : ''} compact />
                  </div>
                  <div className="cmd-summary-row cmd-balance">
                    <span>Saldo restante</span>
                    <MoneyWithBcv usd={selectedOrder.isPaid ? 0 : selectedOrder.totalAmount || 0} rate={selectedOrder.bcvRate} className={!selectedOrder.isPaid ? 'cmd-paid-yellow' : 'cmd-paid-green'} compact />
                  </div>
                </div>
              </div>
            </div>

            <div className="cmd-modal-timeline">
              <div className="cmd-timeline-header">
                <Clock size={14} className="cmd-tl-icon"/> Progreso del pedido
              </div>
              <div className="cmd-timeline-steps">
                <div className={`cmd-step ${['new', 'preparing', 'ready', 'delivered'].includes(selectedOrder.status) ? 'active' : ''}`}>
                  <div className="cmd-step-icon"><FileText size={16} /></div>
                  <div className="cmd-step-info">
                    <span className="cmd-step-name">Nueva</span>
                    <span className="cmd-step-time">{selectedOrder.time}</span>
                  </div>
                </div>
                <div className={`cmd-timeline-line ${['preparing', 'ready', 'delivered'].includes(selectedOrder.status) ? 'active' : ''}`}></div>
                <div className={`cmd-step ${['preparing', 'ready', 'delivered'].includes(selectedOrder.status) ? 'active' : ''}`}>
                  <div className="cmd-step-icon"><Clock size={16} /></div>
                  <div className="cmd-step-info">
                    <span className="cmd-step-name">En preparación</span>
                    <span className="cmd-step-time">{['preparing', 'ready', 'delivered'].includes(selectedOrder.status) ? selectedOrder.time : '—'}</span>
                  </div>
                </div>
                <div className={`cmd-timeline-line ${['ready', 'delivered'].includes(selectedOrder.status) ? 'active' : ''}`}></div>
                <div className={`cmd-step ${['ready', 'delivered'].includes(selectedOrder.status) ? 'active' : ''}`}>
                  <div className="cmd-step-icon"><CheckCircle size={16} /></div>
                  <div className="cmd-step-info">
                    <span className="cmd-step-name">Lista</span>
                    <span className="cmd-step-time">{['ready', 'delivered'].includes(selectedOrder.status) ? '—' : '—'}</span>
                  </div>
                </div>
                <div className={`cmd-timeline-line ${['delivered'].includes(selectedOrder.status) ? 'active' : ''}`}></div>
                <div className={`cmd-step ${['delivered'].includes(selectedOrder.status) ? 'active' : ''}`}>
                  <div className="cmd-step-icon"><Truck size={16} /></div>
                  <div className="cmd-step-info">
                    <span className="cmd-step-name">Entregada</span>
                    <span className="cmd-step-time">{selectedOrder.status === 'delivered' ? (selectedOrder.deliveredTime || '—') : '—'}</span>
                  </div>
                </div>
              </div>
            </div>

            <footer className="cmd-modal-footer">
              <div className="cmd-footer-left">
                {selectedOrder.status !== 'delivered' && (
                  <button className="cmd-btn-outline"><Edit3 size={16} /> Editar pedido</button>
                )}
                <button className="cmd-btn-outline" onClick={() => window.print()}><Printer size={16} /> Imprimir comanda</button>
              </div>
              <div className="cmd-footer-right">
                {selectedOrder.source === 'web' ? (
                  <button className="cmd-btn-primary" disabled={confirmingWebId === selectedOrder.webRequestId} onClick={() => handleConfirmWebOrder(selectedOrder)}>
                    <CheckCircle size={16} /> {confirmingWebId === selectedOrder.webRequestId ? 'Confirmando…' : 'Confirmar pedido'}
                  </button>
                ) : !selectedOrder.isPaid && (
                  <button
                    className="cmd-btn-cobrar"
                    onClick={() => handleOpenPaymentForOrder(selectedOrder)}
                  >
                    💲 Cobrar pedido
                  </button>
                )}
                {selectedOrder.source !== 'web' && selectedOrder.status !== 'delivered' && <button
                  className="cmd-btn-primary"
                  onClick={() => {
                    handleAdvanceStatus(selectedOrder.id, selectedOrder.status)
                    setSelectedOrder(null)
                  }}
                >
                  <CheckCircle size={16} /> Marcar como {selectedOrder.status === 'new' ? 'preparación' : selectedOrder.status === 'preparing' ? 'lista' : 'entregada'}
                </button>}
                <button className="cmd-btn-secondary" onClick={() => setSelectedOrder(null)}>Cerrar</button>
              </div>
            </footer>
          </div>
        </div>,
        document.body
      )}
      {/* Modal Cobrar Pedido Directo desde Comandas */}
      {showPaymentModal && paymentOrder && createPortal(
        <div className="modal-overlay-dark" onClick={() => setShowPaymentModal(false)}>
          <div className="payment-modal-box animate-pop" onClick={(e) => e.stopPropagation()}>
            {/* Modal Header */}
            <div className="payment-modal-header">
              <h2 className="payment-modal-title">
                Cobrar pedido <span className="payment-order-tag">{paymentOrder.orderNumber}</span>
              </h2>
              <button className="payment-modal-close" onClick={() => setShowPaymentModal(false)}>
                <X size={18} />
              </button>
            </div>

            {/* Payment Method Tabs */}
            <div className="payment-tabs-bar">
              {PAYMENT_METHODS.map((pm) => (
                <button
                  key={pm.method}
                  className={`payment-tab-btn ${selectedPaymentTab === pm.method ? 'active' : ''}`}
                  onClick={() => handleSelectPaymentTab(pm.method)}
                >
                  <span>{pm.icon}</span>
                  <span>{pm.label}</span>
                </button>
              ))}
            </div>

            {/* Modal Body */}
            <div className="payment-modal-body">
              {/* Left Column: Details */}
              <div className="payment-body-left">
                <h3 className="payment-sub-heading">
                  Detalles del pago ({PAYMENT_METHODS.find(p => p.method === selectedPaymentTab)?.label})
                </h3>

                {selectedPaymentTab !== 'split' && requiresPaymentReference(selectedPaymentTab) && (
                <div className="payment-field-group mt-2">
                  <label className="payment-field-label">
                    {paymentReferenceLabel(selectedPaymentTab)}
                  </label>
                  <div className="payment-input-wrap">
                    <input
                      type="text"
                      className="payment-field-input"
                      value={refNumber}
                      onChange={(e) => setRefNumber(e.target.value)}
                      placeholder="Ej. 876543210"
                    />
                    <QrCode size={16} className="qr-icon-right" />
                  </div>
                </div>
                )}

                {selectedPaymentTab === 'split' && (
                  <div className="split-payment-grid mt-2">
                    <section className="split-method-card">
                      <div className="split-method-heading"><span className="split-method-number">1</span><span>Primer método</span></div>
                      <PaymentMethodSelect ariaLabel="Primer método de pago" value={splitPrimaryMethod} options={SPLIT_PAYMENT_METHODS} disabledMethod={splitSecondaryMethod} onChange={(nextMethod) => {
                        const currentUsd = paymentInputToUsd(amountReceived, splitPrimaryMethod, paymentRate)
                        setSplitPrimaryMethod(nextMethod)
                        setAmountReceived(usdToPaymentInput(currentUsd, nextMethod, paymentRate))
                        setSplitPrimaryReference('')
                        setPaymentError('')
                      }} />
                      <label className="payment-field-label">Monto del primer método</label>
                      <div className="payment-input-wrap">
                        <input type="text" inputMode="decimal" className="payment-field-input" value={amountReceived} onChange={(event) => setAmountReceived(event.target.value)} />
                        <span className="currency-tag-right">{usesBolivares(splitPrimaryMethod) ? 'Bs' : 'USD'}</span>
                      </div>
                      <span className="payment-hint-sub">
                        {usesBolivares(splitPrimaryMethod)
                          ? `Ref. ${formatUsd(splitPrimaryAmountUsd)}`
                          : paymentRate ? `Ref. ${formatVes(splitPrimaryAmountUsd * paymentRate)}` : 'Referencia BCV no disponible'}
                      </span>
                      {requiresPaymentReference(splitPrimaryMethod) && (
                        <>
                          <label className="payment-field-label">{paymentReferenceLabel(splitPrimaryMethod)}</label>
                          <input type="text" className="payment-field-input" value={splitPrimaryReference} onChange={(event) => setSplitPrimaryReference(event.target.value)} placeholder="Ej. 876543210" />
                        </>
                      )}
                    </section>

                    <section className="split-method-card">
                      <div className="split-method-heading"><span className="split-method-number">2</span><span>Segundo método</span></div>
                      <PaymentMethodSelect ariaLabel="Segundo método de pago" value={splitSecondaryMethod} options={SPLIT_PAYMENT_METHODS} disabledMethod={splitPrimaryMethod} onChange={(nextMethod) => {
                        setSplitSecondaryMethod(nextMethod)
                        setSplitSecondaryReference('')
                        setPaymentError('')
                      }} />
                      <label className="payment-field-label">Monto del segundo método</label>
                      <div className="split-readonly-amount">
                        <MoneyWithBcv
                          usd={Math.max(0, (paymentOrder.totalAmount ?? 0) - splitPrimaryAmountUsd)}
                          rate={paymentRate}
                          primaryCurrency={usesBolivares(splitSecondaryMethod) ? 'VES' : 'USD'}
                          compact
                        />
                      </div>
                      {requiresPaymentReference(splitSecondaryMethod) && (
                        <>
                          <label className="payment-field-label">{paymentReferenceLabel(splitSecondaryMethod)}</label>
                          <input type="text" className="payment-field-input" value={splitSecondaryReference} onChange={(event) => setSplitSecondaryReference(event.target.value)} placeholder="Ej. 876543210" />
                        </>
                      )}
                    </section>
                  </div>
                )}

                {selectedPaymentTab !== 'split' && <div className="payment-field-group mt-3">
                  <label className="payment-field-label">
                    {selectedPaymentTab === 'cash' ? 'MONTO RECIBIDO' : 'MONTO A COBRAR'}
                    <span className="text-red"> *</span>
                  </label>
                  <div className="payment-input-wrap">
                    <input
                      type="text"
                      inputMode="decimal"
                      className="payment-field-input"
                      value={amountReceived}
                      onChange={(e) => setAmountReceived(e.target.value)}
                    />
                    <span className="currency-tag-right">{usesBolivares(selectedPaymentTab) ? 'Bs' : 'USD'}</span>
                  </div>
                  <span className="payment-hint-sub">
                    {usesBolivares(selectedPaymentTab)
                      ? `Ref. ${formatUsd(paymentOrder.totalAmount || 0)}`
                      : paymentRate ? `Ref. ${formatVes((paymentOrder.totalAmount || 0) * paymentRate)}` : 'Referencia BCV no disponible'}
                  </span>
                </div>}

                {paymentError && <div className="payment-error-message" role="alert">{paymentError}</div>}

                <div className="payment-field-group mt-3">
                  <label className="payment-field-label">NOTA (OPCIONAL)</label>
                  <div className="payment-textarea-wrap">
                    <textarea
                      className="payment-field-textarea"
                      placeholder="Ej. Pago por Yape / Pago Móvil"
                      value={paymentNote}
                      onChange={(e) => setPaymentNote(e.target.value.slice(0, 120))}
                      rows={2}
                    />
                    <span className="payment-counter-bottom">{paymentNote.length}/120</span>
                  </div>
                </div>

                {/* Desglose de Pago */}
                <div className="payment-breakdown-card mt-3">
                  <span className="breakdown-card-title">Desglose de pago</span>
                  <div className="breakdown-rows-list">
                    {selectedPaymentTab === 'split' ? (
                      <>
                        <div className="breakdown-row-item">
                          <span className="row-item-left">
                            1. {SPLIT_PAYMENT_METHODS.find(method => method.method === splitPrimaryMethod)?.icon}{' '}
                            {SPLIT_PAYMENT_METHODS.find(method => method.method === splitPrimaryMethod)?.label}
                          </span>
                          <MoneyWithBcv usd={splitPrimaryAmountUsd} rate={paymentRate} primaryCurrency={usesBolivares(splitPrimaryMethod) ? 'VES' : 'USD'} className="row-item-val" compact />
                        </div>
                        <div className="breakdown-row-item">
                          <span className="row-item-left">
                            2. {SPLIT_PAYMENT_METHODS.find(method => method.method === splitSecondaryMethod)?.icon}{' '}
                            {SPLIT_PAYMENT_METHODS.find(method => method.method === splitSecondaryMethod)?.label}
                          </span>
                          <MoneyWithBcv usd={Math.max(0, (paymentOrder.totalAmount ?? 0) - splitPrimaryAmountUsd)} rate={paymentRate} primaryCurrency={usesBolivares(splitSecondaryMethod) ? 'VES' : 'USD'} className="row-item-val" compact />
                        </div>
                      </>
                    ) : (
                      <div className="breakdown-row-item">
                        <span className="row-item-left">{PAYMENT_METHODS.find(p => p.method === selectedPaymentTab)?.icon} {PAYMENT_METHODS.find(p => p.method === selectedPaymentTab)?.label}</span>
                        <MoneyWithBcv usd={paymentOrder.totalAmount || 0} rate={paymentOrder.bcvRate} className="row-item-val" compact />
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Right Column: Order Summary */}
              <div className="payment-body-right">
                <div className="order-summary-box">
                  <h3 className="summary-box-title">Resumen del pedido</h3>

                  <div className="summary-box-lines mt-3">
                    <div className="summary-box-line">
                      <span>Subtotal</span>
                      <MoneyWithBcv usd={paymentOrder.totalAmount || 0} rate={paymentOrder.bcvRate} usdClassName="font-bold" compact />
                    </div>

                    <div className="summary-box-total-line mt-3">
                      <span className="summary-total-label">Total</span>
                      <MoneyWithBcv usd={paymentOrder.totalAmount || 0} rate={paymentOrder.bcvRate} className="summary-total-val" />
                    </div>
                  </div>

                  {/* Customer field */}
                  <div className="summary-box-customer mt-4">
                    <span className="customer-box-label">Cliente</span>
                    <div className="customer-box-card">
                      <span className="customer-box-name">👤 {paymentOrder.customerName || 'Cliente general'}</span>
                    </div>
                  </div>

                  {/* Info Notice */}
                  <div className="payment-security-notice mt-4">
                    <ShieldCheck size={16} className="text-green flex-shrink-0" />
                    <span>El cobro se actualizará automáticamente en la comanda.</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Footer Actions */}
            <div className="payment-modal-footer">
              <button className="btn-confirm-payment-red" onClick={handleConfirmOrderPayment} disabled={paying || paymentError.includes('abrir la caja')}>
                <CheckCircle size={18} /> Confirmar pago
              </button>
              <button className="btn-modal-action-dark" onClick={() => window.print()}>
                <Printer size={18} /> Imprimir recibo
              </button>
              <button className="btn-modal-action-ghost" onClick={() => setShowPaymentModal(false)}>
                <X size={18} /> Cancelar
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}
