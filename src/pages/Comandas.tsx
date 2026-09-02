import { useState, useMemo, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { Caja } from './Caja'
import { MoneyWithBcv } from '../components/MoneyWithBcv'
import { PaymentMethodSelect } from '../components/PaymentMethodSelect'
import {
  getOrdersWithItems,
  getActiveCashSession,
  recordOrderPayments,
  updateOrderStatus,
  removeOrderItem,
  deleteOrder,
  deleteWebOrder,
  validateMyPin,
  setOrderDeliveryFee,
  type PaymentMethod,
  type CartItem,
} from '../lib/dataService'
import { AddItemsToOrderModal } from '../components/AddItemsToOrderModal'
import { confirmDialog, alertDialog } from '../components/ConfirmDialog'
import { confirmWebOrder, getPendingWebOrders } from '../lib/publicOrders'
import { supabase } from '../lib/supabase'
import { normalizeForSearch } from '../lib/textFormat'
import { useRates } from '../context/rates-context'
import { formatUsd, formatVes, dayRangeInTimeZone } from '../lib/money'
import {
  Search,
  Calendar,
  ChevronDown,
  Filter,
  Clock,
  CheckCircle,
  CheckCircle2,
  Package,
  Truck,
  User,
  ShoppingBag,
  Bike,
  UtensilsCrossed,
  Utensils,
  Plus,
  Trash2,
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
  Split,
  ChefHat,
  AlertTriangle,
  ClipboardList,
  Globe,
  Timer,
  DollarSign,
  Flame,
  Sparkles,
} from 'lucide-react'
import { EmptyState } from '../components/EmptyState'
import './Comandas.css'

const PAYMENT_METHODS = [
  { method: 'cash', label: 'Efectivo', icon: <Banknote size={16} strokeWidth={1.8} /> },
  { method: 'mobile', label: 'Pago móvil', icon: <Smartphone size={16} strokeWidth={1.8} /> },
  { method: 'card', label: 'Punto', icon: <CreditCard size={16} strokeWidth={1.8} /> },
  { method: 'transfer', label: 'Transferencia', icon: <Landmark size={16} strokeWidth={1.8} /> },
  { method: 'binance', label: 'Binance', icon: <Hexagon size={16} strokeWidth={1.8} /> },
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
  customerIdentification?: string
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

const DEMO_CUSTOMERS = [
  'María González', 'Carlos Ramírez', 'Andrea Pérez', 'José Martínez', 'Valentina Rojas',
  'Luis Hernández', 'Gabriela Silva', 'Miguel Torres', 'Daniela Vargas', 'Ricardo Mendoza',
  'Paola Castillo', 'Santiago Núñez', 'Camila Ortega', 'Diego Salazar', 'Natalia Romero',
]

const DEMO_PRODUCTS = [
  { name: 'Arroz Camarón y Pollo', price: 6 },
  { name: 'Arroz Frito Especial', price: 7 },
  { name: 'Tallarín de Arroz Mixto', price: 8 },
  { name: 'Lumpias', price: 3 },
  { name: 'Costillas Agridulces', price: 9 },
  { name: 'Chop Suey Mixto', price: 8.5 },
  { name: 'Wonton', price: 3 },
  { name: 'Papas Fritas', price: 3 },
]

function createDemoComandas(): ComandaOrder[] {
  const now = Date.now()
  const statusGroups: Array<{ status: ComandaOrder['status']; count: number; baseMinutes: number }> = [
    { status: 'new', count: 9, baseMinutes: 3 },
    { status: 'preparing', count: 8, baseMinutes: 9 },
    { status: 'ready', count: 7, baseMinutes: 16 },
    { status: 'delivered', count: 3, baseMinutes: 28 },
  ]
  let orderIndex = 0

  return statusGroups.flatMap(({ status, count, baseMinutes }) =>
    Array.from({ length: count }, (_, statusIndex) => {
      const index = orderIndex++
      const elapsedMins = baseMinutes + statusIndex * (status === 'preparing' ? 4 : 3)
      const createdAt = new Date(now - elapsedMins * 60_000)
      const itemCount = 2 + (index % 3)
      const items = Array.from({ length: itemCount }, (__, itemIndex) => {
        const product = DEMO_PRODUCTS[(index + itemIndex * 2) % DEMO_PRODUCTS.length]
        const quantity = itemIndex === 0 && index % 4 === 0 ? 2 : 1
        return {
          id: `demo-item-${index}-${itemIndex}`,
          name: product.name,
          quantity,
          unitPrice: product.price,
          subtotal: product.price * quantity,
          observations: itemIndex === 0 && index % 5 === 0 ? 'Sin cebollín' : undefined,
        }
      })
      const orderType = index % 3 === 0 ? `Mesa ${(index % 8) + 1}` : index % 3 === 1 ? 'Para llevar' : 'Delivery'
      const isPaid = index % 4 !== 0
      const totalAmount = items.reduce((total, item) => total + (item.subtotal ?? 0), 0) + (orderType === 'Delivery' ? 2 : 0)

      return {
        id: `demo-order-${index + 1}`,
        orderNumber: `#FC-D${String(index + 1).padStart(3, '0')}`,
        time: createdAt.toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit' }),
        date: createdAt.toLocaleDateString('es-VE'),
        isRetraso: status !== 'ready' && status !== 'delivered' && elapsedMins >= 20,
        customerName: DEMO_CUSTOMERS[index % DEMO_CUSTOMERS.length],
        customerPhone: `0414-${String(1200000 + index * 731).slice(0, 7)}`,
        address: orderType === 'Delivery' ? `Sector ${index % 2 === 0 ? 'La Floresta' : 'Centro'}, punto de referencia demo` : '',
        reference: orderType === 'Delivery' ? 'Frente a la plaza' : '',
        orderType,
        items,
        notes: index % 6 === 0 ? 'Empacar salsas por separado.' : '',
        paymentMethod: isPaid ? (index % 2 === 0 ? 'Pago: Pago móvil' : 'Pago: Efectivo $') : '⚠️ Sin pagar',
        paymentType: isPaid ? (index % 2 === 0 ? 'app' : 'cash') : 'pending',
        isPaid,
        totalAmount,
        serviceCharge: 0,
        discount: 0,
        bcvRate: 798.33,
        elapsedMins,
        status,
        deliveredTime: status === 'delivered' ? createdAt.toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit' }) : undefined,
        attendedBy: index % 2 === 0 ? 'Ana · Caja' : 'Luis · Caja',
        source: 'pos',
      }
    })
  )
}

// La ubicación GPS del cliente llega dentro de las notas del pedido web como un
// link de Google Maps. Estos helpers la extraen para mostrar un botón de mapa y
// limpian esa línea del texto de notas visible.
const MAPS_URL_RE = /https?:\/\/(?:maps\.google\.[a-z.]+|www\.google\.[a-z.]+\/maps|maps\.app\.goo\.gl|goo\.gl\/maps)\S*/i

function formatElapsed(mins: number): string {
  if (mins < 60) return `${mins} min`
  const hours = Math.floor(mins / 60)
  const rest = mins % 60
  if (hours < 24) return rest > 0 ? `${hours}h ${rest}min` : `${hours}h`
  const days = Math.floor(hours / 24)
  const restHours = hours % 24
  return restHours > 0 ? `${days}d ${restHours}h` : `${days}d`
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[1][0]).toUpperCase()
}

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
    .filter((line) => !MAPS_URL_RE.test(line) && !/ubicaci[oó]n gps/i.test(line) && !/pago preferido/i.test(line))
    .join('\n')
    .trim()
}

// El método de pago que el cliente eligió en la web viaja en las notas como
// "Pago preferido: <codigos>" (p. ej. "cash" o "cash+mobile"). Se extrae para
// pre-seleccionarlo al cobrar y mostrarlo en la comanda.
const PAY_METHOD_LABELS: Record<string, string> = {
  cash: 'Efectivo', mobile: 'Pago móvil', card: 'Punto', transfer: 'Transferencia', binance: 'Binance', zelle: 'Zelle',
}

function extractPreferredPayment(notes?: string | null): { methods: SplitPaymentMethod[]; label: string } | null {
  if (!notes) return null
  const match = notes.match(/pago preferido:\s*([a-z+]+)/i)
  if (!match) return null
  const methods = match[1]
    .split('+')
    .map((s) => s.trim().toLowerCase())
    .filter((c): c is SplitPaymentMethod => c in PAY_METHOD_LABELS)
  if (methods.length === 0) return null
  return { methods, label: methods.map((c) => PAY_METHOD_LABELS[c]).join(' + ') }
}

const COLUMNS = [
  { key: 'new', label: 'Nuevas', icon: <Package size={16} />, color: '#ff4d3d' },
  { key: 'preparing', label: 'En preparación', icon: <Clock size={16} />, color: '#f97316' },
  { key: 'ready', label: 'Listas', icon: <CheckCircle size={16} />, color: '#10b981' },
  { key: 'delivered', label: 'Entregadas', icon: <Truck size={16} />, color: '#3b82f6' },
]

// Cuántas comandas se muestran por columna antes de "Ver todas".
const COLUMN_PREVIEW_LIMIT = 6

export function Comandas() {
  const { bcvRate } = useRates()
  const isDemoMode = new URLSearchParams(window.location.search).get('demo') === '1'
  const [comandas, setComandas] = useState<ComandaOrder[]>(() => isDemoMode ? createDemoComandas() : MOCK_COMANDAS)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedOrder, setSelectedOrder] = useState<ComandaOrder | null>(null)
  const [closingSelectedOrder, setClosingSelectedOrder] = useState(false)

  // Modal de cobro directo desde Comandas
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [closingPayment, setClosingPayment] = useState(false)
  const [paymentOrder, setPaymentOrder] = useState<ComandaOrder | null>(null)
  const [selectedPaymentTab, setSelectedPaymentTab] = useState<SplitPaymentMethod | 'split'>('cash')
  const [refNumber, setRefNumber] = useState('')
  const [extraRefs, setExtraRefs] = useState<string[]>([])
  const [amountReceived, setAmountReceived] = useState('')
  const [splitPrimaryMethod, setSplitPrimaryMethod] = useState<SplitPaymentMethod>('cash')
  const [splitSecondaryMethod, setSplitSecondaryMethod] = useState<SplitPaymentMethod>('mobile')
  const [splitPrimaryReference, setSplitPrimaryReference] = useState('')
  const [splitSecondaryReference, setSplitSecondaryReference] = useState('')
  const [paymentNote, setPaymentNote] = useState('')
  const [paymentError, setPaymentError] = useState('')
  const [paying, setPaying] = useState(false)
  const [cashCurrency, setCashCurrency] = useState<'USD' | 'VES'>('USD')
  const [statusError, setStatusError] = useState('')
  const [confirmingWebId, setConfirmingWebId] = useState<string | null>(null)
  const [reloadToken, setReloadToken] = useState(0)
  const [expandedCols, setExpandedCols] = useState<Record<string, boolean>>(
    isDemoMode ? { new: true, preparing: true, ready: true } : {}
  )
  const [showAddItems, setShowAddItems] = useState(false)
  const [removingItemId, setRemovingItemId] = useState<string | null>(null)
  const [removeError, setRemoveError] = useState('')
  const [deliveryFeeInput, setDeliveryFeeInput] = useState('')
  const [savingDelivery, setSavingDelivery] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [closingDelete, setClosingDelete] = useState(false)
  const [deletePin, setDeletePin] = useState('')
  const [deleteError, setDeleteError] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [showHistoryModal, setShowHistoryModal] = useState(false)
  const [closingHistory, setClosingHistory] = useState(false)
  const [historyOrders, setHistoryOrders] = useState<ComandaOrder[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const [historySearch, setHistorySearch] = useState('')
  const [showNewOrderModal, setShowNewOrderModal] = useState(false)
  const [closingNewOrder, setClosingNewOrder] = useState(false)
  const closeNewOrderModal = () => {
    if (!showNewOrderModal || closingNewOrder) return
    setClosingNewOrder(true)
    window.setTimeout(() => {
      setShowNewOrderModal(false)
      setClosingNewOrder(false)
    }, 200)
  }

  useEffect(() => {
    if (!showNewOrderModal) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeNewOrderModal()
    }
    window.addEventListener('keydown', handleEscape)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', handleEscape)
    }
  }, [showNewOrderModal])

  const [historyRange, setHistoryRange] = useState<'today' | 'yesterday' | '7d' | '30d'>('7d')

  // Filtros de la barra superior (antes eran decorativos, sin lógica).
  const [dateFilter, setDateFilter] = useState<'today' | 'yesterday'>('today')
  const [statusFilter, setStatusFilter] = useState<'all' | ComandaOrder['status']>('all')
  const [orderTypeFilter, setOrderTypeFilter] = useState<'all' | 'Delivery' | 'Para llevar' | 'Mesa'>('all')
  const [openFilterMenu, setOpenFilterMenu] = useState<'date' | 'status' | 'type' | null>(null)
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false)
  const filtersBarRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!openFilterMenu) return
    const handleClickOutside = (e: MouseEvent) => {
      if (filtersBarRef.current && !filtersBarRef.current.contains(e.target as Node)) {
        setOpenFilterMenu(null)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [openFilterMenu])

  const hasActiveFilters = statusFilter !== 'all' || orderTypeFilter !== 'all' || dateFilter !== 'today' || searchQuery !== ''
  const clearFilters = () => {
    setStatusFilter('all')
    setOrderTypeFilter('all')
    setDateFilter('today')
    setSearchQuery('')
    setOpenFilterMenu(null)
  }

  const STATUS_FILTER_OPTIONS: Array<{ value: 'all' | ComandaOrder['status']; label: string }> = [
    { value: 'all', label: 'Estado' },
    { value: 'new', label: 'Nuevas' },
    { value: 'preparing', label: 'En preparación' },
    { value: 'ready', label: 'Listas' },
    { value: 'delivered', label: 'Entregadas' },
  ]
  const ORDER_TYPE_FILTER_OPTIONS: Array<{ value: 'all' | 'Delivery' | 'Para llevar' | 'Mesa'; label: string }> = [
    { value: 'all', label: 'Tipo' },
    { value: 'Delivery', label: 'Delivery' },
    { value: 'Para llevar', label: 'Para llevar' },
    { value: 'Mesa', label: 'Mesa' },
  ]

  // Pre-cargar el costo de delivery actual (renglón "Delivery") al abrir la comanda.
  useEffect(() => {
    const d = selectedOrder?.items.find((i) => i.name === 'Delivery')
    setDeliveryFeeInput(d ? String(d.unitPrice ?? d.subtotal ?? '') : '')
  }, [selectedOrder])

  const handleSaveDeliveryFee = async () => {
    if (!selectedOrder) return
    const fee = Math.max(0, parseFloat(deliveryFeeInput.replace(',', '.')) || 0)
    setSavingDelivery(true)
    setRemoveError('')
    try {
      await setOrderDeliveryFee(selectedOrder.id, fee)
      setSelectedOrder((prev) => {
        if (!prev) return prev
        const withoutDelivery = prev.items.filter((i) => i.name !== 'Delivery')
        const items = fee > 0
          ? [...withoutDelivery, { id: 'delivery-fee', name: 'Delivery', quantity: 1, unitPrice: fee, subtotal: fee }]
          : withoutDelivery
        const totalAmount = items.reduce((s, i) => s + (i.subtotal ?? (i.unitPrice || 0) * i.quantity), 0)
        return { ...prev, items, totalAmount }
      })
      setReloadToken((value) => value + 1)
    } catch (e) {
      setRemoveError(e instanceof Error ? e.message : 'No se pudo guardar el costo de delivery')
    } finally {
      setSavingDelivery(false)
    }
  }

  const handleRemoveItem = async (itemId: string) => {
    const ok = await confirmDialog({ title: 'Quitar producto', message: '¿Quitar este producto de la comanda? Se revertirá su inventario.', confirmText: 'Quitar', danger: true })
    if (!ok) return
    setRemovingItemId(itemId)
    setRemoveError('')
    try {
      await removeOrderItem(itemId)
      setSelectedOrder((prev) => {
        if (!prev) return prev
        const removed = prev.items.find((i) => i.id === itemId)
        const removedTotal = removed ? removed.subtotal ?? (removed.unitPrice || 0) * removed.quantity : 0
        return {
          ...prev,
          items: prev.items.filter((i) => i.id !== itemId),
          totalAmount: Math.max(0, (prev.totalAmount || 0) - removedTotal),
        }
      })
      setReloadToken((value) => value + 1)
    } catch (e) {
      setRemoveError(e instanceof Error ? e.message : 'No se pudo quitar el producto')
    } finally {
      setRemovingItemId(null)
    }
  }

  const handleDeleteOrder = async () => {
    if (!selectedOrder) return
    setDeleting(true)
    setDeleteError('')
    try {
      const valid = await validateMyPin(deletePin)
      if (!valid) {
        setDeleteError('PIN incorrecto')
        setDeleting(false)
        return
      }
      if (selectedOrder.source === 'web' && selectedOrder.webRequestId) {
        await deleteWebOrder(selectedOrder.webRequestId)
      } else {
        await deleteOrder(selectedOrder.id)
      }
      closeDeleteModal()
      closeSelectedOrder()
      setReloadToken((value) => value + 1)
    } catch (e) {
      setDeleteError(e instanceof Error ? e.message : 'No se pudo eliminar la comanda')
    } finally {
      setDeleting(false)
    }
  }

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
    // Pre-seleccionar el método que el cliente indicó en la web (si lo hay).
    const pref = extractPreferredPayment(order.notes)
    if (pref && pref.methods.length >= 2) {
      setSelectedPaymentTab('split')
      setSplitPrimaryMethod(pref.methods[0])
      setSplitSecondaryMethod(pref.methods[1])
    } else if (pref && pref.methods.length === 1) {
      setSelectedPaymentTab(pref.methods[0])
      setSplitPrimaryMethod('cash')
      setSplitSecondaryMethod('mobile')
    } else {
      setSelectedPaymentTab('cash')
      setSplitPrimaryMethod('cash')
      setSplitSecondaryMethod('mobile')
    }
    setRefNumber('')
    setExtraRefs([])
    const initialTab: SplitPaymentMethod = pref && pref.methods.length === 1 ? pref.methods[0] : 'cash'
    const initialRate = order.bcvRate && order.bcvRate > 0 ? order.bcvRate : bcvRate
    setAmountReceived(usdToPaymentInput(order.totalAmount || 0, initialTab, initialRate))
    setCashCurrency('USD')
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
    setExtraRefs([])
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
      let enteredAmount = Number(amountReceived)
      if (total <= 0) throw new Error('La comanda no tiene un total cobrable')
      if (!Number.isFinite(enteredAmount) || enteredAmount <= 0) {
        throw new Error('Ingresa un monto válido')
      }
      if (selectedPaymentTab === 'cash' && cashCurrency === 'VES') {
        enteredAmount = paymentRate && paymentRate > 0 ? enteredAmount / paymentRate : 0
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
        const allRefs = [refNumber, ...extraRefs].map(r => r.trim()).filter(Boolean).join(', ')
        payments = [{
          method: selectedPaymentTab,
          amount: total,
          referenceNumber: allRefs || undefined,
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
        cash: cashCurrency === 'USD' ? 'Pago: Efectivo $' : 'Pago: Efectivo Bs',
        mobile: 'Pago: Pago móvil',
        card: 'Pago: Punto',
        transfer: 'Pago: Transferencia',
        binance: 'Pago: Binance',
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

      closePaymentModal()
    } catch (e) {
      console.error('Error al confirmar pago:', e)
      setPaymentError(e instanceof Error ? e.message : 'No se pudo registrar el pago')
    } finally {
      setPaying(false)
    }
  }

  // Fetch real orders from Supabase / dataService
  useEffect(() => {
    if (isDemoMode) {
      setComandas(createDemoComandas())
      return
    }

    let active = true
    const loadRealOrders = async () => {
      try {
        // El "día" del negocio se calcula en horario de Venezuela (UTC-4), no en
        // UTC: de lo contrario las comandas creadas después de las 8pm local
        // caen en el día UTC siguiente y desaparecen del tablero.
        const targetDate = dateFilter === 'yesterday' ? new Date(Date.now() - 24 * 60 * 60 * 1000) : new Date()
        const { start, end } = dayRangeInTimeZone(targetDate)
        const [realOrders, webOrders] = await Promise.all([
          getOrdersWithItems(start, end),
          dateFilter === 'today' ? getPendingWebOrders() : Promise.resolve([]),
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
              customerPhone: o.customerPhone || undefined,
              customerIdentification: o.customerIdentification || undefined,
              address: o.orderType === 'delivery' ? (o.customerAddress || '') : '',
              reference: '',
              paymentReference: persistedReference,
              orderType: o.orderType === 'takeaway' ? 'Para llevar' : o.orderType === 'delivery' ? 'Delivery' : o.orderType === 'dine-in' ? (o.tableNumber ? `Mesa ${o.tableNumber}` : 'Mesa') : 'Para llevar',
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
              customerIdentification: order.customerIdentification,
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
  }, [reloadToken, dateFilter, isDemoMode])

  const handleConfirmWebOrder = async (order: ComandaOrder) => {
    if (!order.webRequestId) return
    setConfirmingWebId(order.webRequestId)
    try {
      await confirmWebOrder(order.webRequestId)
      closeSelectedOrder()
      setReloadToken(value => value + 1)
    } catch (cause) {
      console.error('Error confirmando pedido web:', cause)
      void alertDialog({ message: cause instanceof Error ? cause.message : 'No se pudo confirmar el pedido web', danger: true })
    } finally {
      setConfirmingWebId(null)
    }
  }

  const closeSelectedOrder = (then?: () => void) => {
    if (!selectedOrder || closingSelectedOrder) return
    setClosingSelectedOrder(true)
    window.setTimeout(() => {
      setSelectedOrder(null)
      setClosingSelectedOrder(false)
      then?.()
    }, 200)
  }

  const closeDeleteModal = (then?: () => void) => {
    if (!showDeleteModal || closingDelete) return
    setClosingDelete(true)
    window.setTimeout(() => {
      setShowDeleteModal(false)
      setClosingDelete(false)
      setDeletePin('')
      setDeleteError('')
      then?.()
    }, 200)
  }

  const closePaymentModal = (then?: () => void) => {
    if (!showPaymentModal || closingPayment) return
    setClosingPayment(true)
    window.setTimeout(() => {
      setShowPaymentModal(false)
      setClosingPayment(false)
      setPaymentOrder(null)
      then?.()
    }, 200)
  }

  const closeHistoryModal = (then?: () => void) => {
    if (!showHistoryModal || closingHistory) return
    setClosingHistory(true)
    window.setTimeout(() => {
      setShowHistoryModal(false)
      setClosingHistory(false)
      setHistorySearch('')
      then?.()
    }, 200)
  }

  const loadHistoryOrders = async () => {
    setHistoryLoading(true)
    try {
      const thirtyDaysAgo = new Date()
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
      const dateFrom = dayRangeInTimeZone(thirtyDaysAgo).start
      const dateTo = dayRangeInTimeZone().end

      const allOrders = await getOrdersWithItems(dateFrom, dateTo)

      const creatorNames = new Map<string, string>()
      const creatorIds = [...new Set(allOrders.map(order => order.createdBy).filter(Boolean))]
      if (supabase && creatorIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id,full_name')
          .in('id', creatorIds)
        for (const profile of profiles ?? []) {
          creatorNames.set(String(profile.id), String(profile.full_name || 'Usuario del sistema'))
        }
      }

      const mapped: ComandaOrder[] = allOrders.map((o) => {
        const date = new Date(o.createdAt)
        const status: ComandaOrder['status'] = o.fulfillmentStatus
        const hasPaid = o.status === 'paid' || o.status === 'delivered' || o.status === 'completed'
        const paymentMethods = [...new Set(o.payments.map((p) => p.method))]
        const paymentLabels: Record<PaymentMethod, string> = {
          cash: 'Efectivo', mobile: 'Pago móvil', card: 'Punto', transfer: 'Transferencia',
          binance: 'Binance', zelle: 'Zelle', other: 'Otro',
        }
        const paymentLabel = paymentMethods.length > 1
          ? 'Pago combinado'
          : paymentMethods.length === 1
            ? `Pago: ${paymentLabels[paymentMethods[0]]}`
            : 'Sin pago'

        return {
          id: o.id,
          orderNumber: `#FC-${String(o.orderNumber).padStart(6, '0')}`,
          time: date.toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit' }),
          date: date.toLocaleDateString('es-VE', { day: '2-digit', month: '2-digit', year: 'numeric' }),
          customerName: o.customerName || 'Cliente general',
          orderType: o.orderType === 'takeaway' ? 'Para llevar' : o.orderType === 'delivery' ? 'Delivery' : o.orderType === 'dine-in' ? (o.tableNumber ? `Mesa ${o.tableNumber}` : 'Mesa') : 'Para llevar',
          items: o.items.map((item) => ({
            id: item.id, name: item.productName, quantity: item.quantity,
            unitPrice: item.unitPrice || 0, subtotal: (item.quantity || 0) * (item.unitPrice || 0),
          })),
          notes: o.notes || '',
          paymentMethod: hasPaid ? paymentLabel : 'Sin pago',
          paymentType: hasPaid
            ? paymentMethods.includes('cash') ? 'cash'
              : paymentMethods.includes('mobile') || paymentMethods.includes('transfer') ? 'app'
                : 'card'
            : 'pending',
          isPaid: hasPaid,
          totalAmount: o.totalAmount || 0,
          elapsedMins: Math.max(0, Math.floor((Date.now() - date.getTime()) / 60000)),
          status,
          deliveredTime: status === 'delivered' ? date.toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit' }) : undefined,
          attendedBy: creatorNames.get(o.createdBy) || 'Admin',
          source: 'pos',
        }
      })

      setHistoryOrders(mapped.sort((a, b) => {
        const dateA = a.date || ''
        const dateB = b.date || ''
        if (dateA !== dateB) return dateB.localeCompare(dateA)
        return b.time.localeCompare(a.time)
      }))
    } catch (e) {
      console.error('Error cargando historial:', e)
    } finally {
      setHistoryLoading(false)
    }
  }

  const filteredHistoryOrders = useMemo(() => {
    if (!historySearch) return historyOrders
    const q = normalizeForSearch(historySearch)
    return historyOrders.filter(c =>
      normalizeForSearch(c.orderNumber).includes(q) ||
      normalizeForSearch(c.customerName).includes(q) ||
      c.items.some(i => normalizeForSearch(i.name).includes(q))
    )
  }, [historyOrders, historySearch])

  const historyGroups = useMemo(() => {
    const parseDdMmYyyy = (str?: string): Date | null => {
      if (!str) return null
      const [d, m, y] = str.split('/').map(Number)
      if (!d || !m || !y) return null
      return new Date(y, m - 1, d)
    }

    const now = new Date()
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const startOfYesterday = new Date(startOfToday)
    startOfYesterday.setDate(startOfYesterday.getDate() - 1)
    const rangeCutoff = new Date(startOfToday)
    if (historyRange === '7d') rangeCutoff.setDate(rangeCutoff.getDate() - 6)
    else if (historyRange === '30d') rangeCutoff.setDate(rangeCutoff.getDate() - 29)

    const filtered = filteredHistoryOrders.filter(order => {
      const d = parseDdMmYyyy(order.date)
      if (!d) return true
      if (historyRange === 'today') return d.getTime() === startOfToday.getTime()
      if (historyRange === 'yesterday') return d.getTime() === startOfYesterday.getTime()
      return d.getTime() >= rangeCutoff.getTime()
    })

    const map = new Map<string, ComandaOrder[]>()
    for (const order of filtered) {
      const key = order.date || ''
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(order)
    }

    return [...map.entries()].map(([key, orders]) => {
      const d = parseDdMmYyyy(key)
      let label = key || 'Sin fecha'
      if (d) {
        const diffDays = Math.round((startOfToday.getTime() - d.getTime()) / 86400000)
        if (diffDays === 0) label = 'Hoy'
        else if (diffDays === 1) label = 'Ayer'
        else {
          const raw = d.toLocaleDateString('es-VE', { weekday: 'long', day: 'numeric', month: 'long' })
          label = raw.charAt(0).toUpperCase() + raw.slice(1)
        }
      }
      return { key, label, orders }
    })
  }, [filteredHistoryOrders, historyRange])

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
    const q = normalizeForSearch(searchQuery)
    return comandas.filter(c => {
      const matchSearch =
        normalizeForSearch(c.orderNumber).includes(q) ||
        normalizeForSearch(c.customerName).includes(q) ||
        c.items.some(i => normalizeForSearch(i.name).includes(q))
      const matchStatus = statusFilter === 'all' || c.status === statusFilter
      const matchType = orderTypeFilter === 'all'
        || (orderTypeFilter === 'Mesa' ? c.orderType.startsWith('Mesa') : c.orderType === orderTypeFilter)
      return matchSearch && matchStatus && matchType
    })
  }, [comandas, searchQuery, statusFilter, orderTypeFilter])

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

    if (isDemoMode) return

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
  const nuevasCount = comandas.filter(c => c.status === 'new').length
  const preparandoCount = comandas.filter(c => c.status === 'preparing').length
  const pendientesCount = nuevasCount + preparandoCount
  const listasCount = comandas.filter(c => c.status === 'ready').length
  const activeComandas = comandas.filter(c => c.status !== 'delivered')
  const avgMins = activeComandas.length > 0
    ? Math.round(activeComandas.reduce((sum, comanda) => sum + comanda.elapsedMins, 0) / activeComandas.length)
    : 0
  const kitchenPulse = pendientesCount === 0
    ? { tone: 'calm', label: 'Todo bajo control', message: 'Cocina libre.' }
    : pendientesCount >= 8 || avgMins >= 20
      ? { tone: 'critical', label: 'Alta carga', message: 'Prioriza mayor espera.' }
      : pendientesCount >= 4 || avgMins >= 12
        ? { tone: 'busy', label: 'Buen ritmo', message: 'Vigila los tiempos.' }
        : { tone: 'steady', label: 'Flujo estable', message: 'Avanzando a buen ritmo.' }

  return (
    <div className="comandas-page animate-fade-in">
      <section className={`comandas-pulse comandas-pulse--${kitchenPulse.tone}`} aria-labelledby="comandas-title">
        <div className="comandas-pulse-top">
          <div className="comandas-pulse-heading">
            <div className="comandas-pulse-title-row">
              <span className="comandas-pulse-icon" aria-hidden="true"><ClipboardList size={22} /></span>
              <div>
                <h1 id="comandas-title">Comandas</h1>
                <p><strong>{kitchenPulse.label}.</strong> {kitchenPulse.message}</p>
              </div>
            </div>
          </div>

          <div className="comandas-actions-row">
            <button className="btn-nueva-comanda btn-historial" disabled={isDemoMode} title={isDemoMode ? 'No disponible en la vista demo' : undefined} onClick={() => { setShowHistoryModal(true); loadHistoryOrders() }}>
              <Clock size={16} />
              <span>Historial</span>
            </button>
            <button className="btn-nueva-comanda" disabled={isDemoMode} title={isDemoMode ? 'No disponible en la vista demo' : undefined} onClick={() => setShowNewOrderModal(true)}>
              <Plus size={16} />
              <span>Nueva comanda</span>
            </button>
          </div>
        </div>

        <div className="comandas-pulse-grid">
          <div className="comandas-pulse-primary">
            <div className="comandas-pulse-primary-icon"><Flame size={20} /></div>
            <div className="comandas-pulse-primary-copy">
              <span>Pendientes ahora</span>
              <strong>{pendientesCount}</strong>
              <small>{pendientesCount === 1 ? 'comanda requiere atención' : 'comandas requieren atención'}</small>
            </div>
          </div>

          <div className="comandas-pulse-metric comandas-pulse-metric--total">
            <span className="comandas-pulse-metric-icon"><Package size={18} /></span>
            <div><strong>{totalComandasCount}</strong><span>Total hoy</span></div>
          </div>
          <div className="comandas-pulse-metric comandas-pulse-metric--ready">
            <span className="comandas-pulse-metric-icon"><CheckCircle2 size={18} /></span>
            <div><strong>{listasCount}</strong><span>Listas</span></div>
          </div>
          <div className="comandas-pulse-metric comandas-pulse-metric--time">
            <span className="comandas-pulse-metric-icon"><Timer size={18} /></span>
            <div><strong>{avgMins > 0 ? `${avgMins} min` : '—'}</strong><span>Tiempo promedio</span></div>
          </div>
        </div>

        <div className="comandas-flow" aria-label={`Flujo actual: ${nuevasCount} nuevas, ${preparandoCount} preparando y ${listasCount} listas`}>
          <div className="comandas-flow-step comandas-flow-step--new">
            <span><Package size={14} /> Nuevas</span><strong>{nuevasCount}</strong>
          </div>
          <span className="comandas-flow-line" aria-hidden="true" />
          <div className="comandas-flow-step comandas-flow-step--preparing">
            <span><ChefHat size={14} /> Preparando</span><strong>{preparandoCount}</strong>
          </div>
          <span className="comandas-flow-line" aria-hidden="true" />
          <div className="comandas-flow-step comandas-flow-step--ready">
            <span><CheckCircle2 size={14} /> Listas</span><strong>{listasCount}</strong>
          </div>
        </div>
      </section>

      {isDemoMode ? (
        <div className="comandas-demo-banner" role="status">
          <span className="comandas-demo-icon"><Sparkles size={16} /></span>
          <span><strong>Vista demo</strong> · 27 comandas ficticias para revisar el tablero con alta carga.</span>
          <small>No modifica información real</small>
        </div>
      ) : null}

      {showNewOrderModal && createPortal(
        <div className={`cmd-sales-overlay ${closingNewOrder ? 'closing' : ''}`} role="dialog" aria-modal="true" aria-label="Nueva comanda">
          <div className="cmd-sales-modal">
            <div className="cmd-sales-modal-head">
              <div><small>Comandas</small><strong>Nueva venta</strong></div>
              <button type="button" onClick={closeNewOrderModal} aria-label="Cerrar nueva comanda"><X size={20}/></button>
            </div>
            <div className="cmd-sales-modal-body">
              <Caja
                embedded
                onClose={closeNewOrderModal}
                onOrderCreated={() => setReloadToken(token => token + 1)}
              />
            </div>
          </div>
        </div>,
        document.body,
      )}

      {/* Filter Bar */}
      <div className="comandas-filters" ref={filtersBarRef}>
        <div className="comandas-filters-toprow">
          <button
            type="button"
            className={`comandas-mobile-filters-toggle ${hasActiveFilters ? 'filter-active' : ''}`}
            onClick={() => setMobileFiltersOpen(prev => !prev)}
          >
            <Filter size={14} />
            <span>Filtros</span>
            {hasActiveFilters && <span className="filter-dot" />}
            <ChevronDown size={12} className={mobileFiltersOpen ? 'rotated' : ''} />
          </button>

          <div className="filter-search-inline">
            <Search size={14} />
            <input
              type="text"
              placeholder="Buscar..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button type="button" className="search-clear-btn" onClick={() => setSearchQuery('')} aria-label="Borrar búsqueda">
                <X size={13} />
              </button>
            )}
          </div>
        </div>

        <div className={`comandas-filter-chips ${mobileFiltersOpen ? 'mobile-open' : ''}`}>
        <div className="filter-dropdown-wrap">
          <button
            type="button"
            className={`filter-group-item ${dateFilter !== 'today' ? 'filter-active' : ''}`}
            onClick={() => setOpenFilterMenu(prev => (prev === 'date' ? null : 'date'))}
          >
            <Calendar size={14} />
            <span>{dateFilter === 'today' ? 'Hoy' : 'Ayer'}</span>
            <ChevronDown size={12} />
          </button>
          {openFilterMenu === 'date' && (
            <div className="filter-dropdown-menu">
              {(['today', 'yesterday'] as const).map(value => (
                <button
                  key={value}
                  type="button"
                  className={dateFilter === value ? 'active' : ''}
                  onClick={() => { setDateFilter(value); setOpenFilterMenu(null) }}
                >
                  {value === 'today' ? 'Hoy' : 'Ayer'}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="filter-dropdown-wrap">
          <button
            type="button"
            className={`filter-group-item ${statusFilter !== 'all' ? 'filter-active' : ''}`}
            onClick={() => setOpenFilterMenu(prev => (prev === 'status' ? null : 'status'))}
          >
            <Filter size={14} />
            <span>{STATUS_FILTER_OPTIONS.find(o => o.value === statusFilter)?.label || 'Estado'}</span>
            <ChevronDown size={12} />
          </button>
          {openFilterMenu === 'status' && (
            <div className="filter-dropdown-menu">
              {STATUS_FILTER_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  className={statusFilter === opt.value ? 'active' : ''}
                  onClick={() => { setStatusFilter(opt.value); setOpenFilterMenu(null) }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="filter-dropdown-wrap">
          <button
            type="button"
            className={`filter-group-item ${orderTypeFilter !== 'all' ? 'filter-active' : ''}`}
            onClick={() => setOpenFilterMenu(prev => (prev === 'type' ? null : 'type'))}
          >
            <Package size={14} />
            <span>{ORDER_TYPE_FILTER_OPTIONS.find(o => o.value === orderTypeFilter)?.label || 'Tipo'}</span>
            <ChevronDown size={12} />
          </button>
          {openFilterMenu === 'type' && (
            <div className="filter-dropdown-menu">
              {ORDER_TYPE_FILTER_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  className={orderTypeFilter === opt.value ? 'active' : ''}
                  onClick={() => { setOrderTypeFilter(opt.value); setOpenFilterMenu(null) }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          )}
        </div>

        <button
          type="button"
          className="filter-group-item filter-btn-dark"
          onClick={clearFilters}
          disabled={!hasActiveFilters}
        >
          <Filter size={14} />
          <span>Limpiar</span>
        </button>
        </div>
      </div>

      {statusError && <div className="command-status-error" role="alert">{statusError}</div>}

      {/* 4 Kanban Columns matching Target Mockup */}
      <div className="kanban-board-grid">
        {COLUMNS.map(col => {
          const colOrders = getOrdersByStatus(col.key)
          const isExpanded = expandedCols[col.key] ?? false
          const visibleOrders = isExpanded ? colOrders : colOrders.slice(0, COLUMN_PREVIEW_LIMIT)
          const hiddenCount = colOrders.length - visibleOrders.length

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
                  visibleOrders.map(order => (
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
                            <span className="badge-retraso"><Clock size={12} /> Retraso</span>
                          )}
                        </div>
                      </div>

                      {/* Customer & Delivery line */}
                      <div className="card-customer-line">
                        <span className="customer-name">
                          <User size={13} className="meta-icon" /> {order.customerName}
                        </span>
                        <span className="order-type-tag">
                          {order.orderType === 'Delivery' ? <Bike size={13} /> : order.orderType.startsWith('Mesa') ? <UtensilsCrossed size={13} /> : <ShoppingBag size={13} />} {order.orderType}
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
                          <span className="badge-sin-pagar"><Globe size={12} /> Web · Por confirmar</span>
                        ) : order.isPaid ? (
                          <span className={`payment-type-badge pay-${order.paymentType}`}>
                            {order.paymentMethod}
                          </span>
                        ) : (
                          <span className="badge-sin-pagar"><AlertTriangle size={12} /> Sin cobrar</span>
                        )}

                        {order.status === 'ready' ? (
                          <div className="status-ready-group">
                            <span className="badge-ready-tag">✓ Listo</span>
                            <span className="timer-mins text-green"><Timer size={12} /> {formatElapsed(order.elapsedMins)}</span>
                          </div>
                        ) : order.status === 'delivered' ? (
                          <span className="badge-delivered-tag">
                            Entregado {order.deliveredTime} ✓
                          </span>
                        ) : (
                          <span className={`timer-mins ${order.isRetraso ? 'text-red-urgent' : 'text-orange'}`}>
                            {order.isRetraso ? <Clock size={12} /> : <Timer size={12} />} {formatElapsed(order.elapsedMins)}
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
                          {confirmingWebId === order.webRequestId ? 'Confirmando…' : <><CheckCircle2 size={16} /> Confirmar pedido de WhatsApp</>}
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
                            ? <><ChefHat size={16} /> Iniciar preparación</>
                            : order.status === 'preparing'
                            ? <><CheckCircle2 size={16} /> Marcar como lista</>
                            : <><Truck size={16} /> Marcar como entregada</>}
                        </button>
                      )}
                    </div>
                  ))
                )}
              </div>

              {/* Column Footer */}
              {(hiddenCount > 0 || isExpanded) && colOrders.length > COLUMN_PREVIEW_LIMIT && (
                <div className="kanban-col-footer">
                  <button
                    className="ver-todas-btn"
                    onClick={() => setExpandedCols(prev => ({ ...prev, [col.key]: !isExpanded }))}
                  >
                    {isExpanded ? 'Ver menos' : `+ Ver todas (${colOrders.length})`}
                  </button>
                </div>
              )}
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
        <div className={`cmd-modal-overlay ${closingSelectedOrder ? 'closing' : ''}`} onClick={() => closeSelectedOrder()}>
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
                  <div className="cmd-badge sin-pagar"><AlertTriangle size={14} /> Sin cobrar</div>
                )}
                <div className={`cmd-badge ${selectedOrder.orderType === 'Delivery' ? 'type-delivery' : selectedOrder.orderType.startsWith('Mesa') ? 'type-mesa' : 'type-takeaway'}`}>{selectedOrder.orderType}</div>
              </div>
              <div className="cmd-header-actions">
                <button className="cmd-delete-btn" onClick={() => { setDeletePin(''); setDeleteError(''); setShowDeleteModal(true) }} title="Eliminar comanda">
                  <Trash2 size={18} />
                </button>
              </div>
            </header>

            <div className="cmd-modal-meta">
              <div className="cmd-meta-cluster cmd-meta-customer">
                <span className="cmd-customer-avatar">{getInitials(selectedOrder.customerName)}</span>
                <div className="cmd-customer-info">
                  <span className="cmd-meta-label">Cliente</span>
                  <span className="cmd-customer-name">{selectedOrder.customerName}</span>
                  <div className="cmd-customer-sub">
                    <span><Phone size={11} /> {selectedOrder.customerPhone || 'Sin teléfono'}</span>
                    <span><User size={11} /> {selectedOrder.customerIdentification || 'Sin cédula'}</span>
                  </div>
                </div>
              </div>

              <span className="cmd-meta-divider" />

              <div className="cmd-meta-cluster">
                <div className="cmd-meta-item">
                  <Calendar size={14} className="cmd-meta-icon cmd-icon-time" />
                  <div>
                    <span className="cmd-meta-label">Fecha</span>
                    <span className="cmd-meta-val">{selectedOrder.date || '24/05/2025'}</span>
                  </div>
                </div>
                <div className="cmd-meta-item">
                  <Clock size={14} className="cmd-meta-icon cmd-icon-time" />
                  <div>
                    <span className="cmd-meta-label">Hora</span>
                    <span className="cmd-meta-val">{selectedOrder.time}</span>
                  </div>
                </div>
                <span className="cmd-elapsed-chip"><Clock size={12} /> {formatElapsed(selectedOrder.elapsedMins)}</span>
              </div>

              <span className="cmd-meta-divider" />

              <div className="cmd-meta-cluster">
                <div className="cmd-meta-item">
                  <User size={14} className="cmd-meta-icon cmd-icon-ops" />
                  <div>
                    <span className="cmd-meta-label">Atendido por</span>
                    <span className="cmd-meta-val">{selectedOrder.attendedBy || 'Admin'}</span>
                  </div>
                </div>
                <div className="cmd-meta-item">
                  <Hash size={14} className="cmd-meta-icon cmd-icon-ops" />
                  <div>
                    <span className="cmd-meta-label">Nº de pedido</span>
                    <span className="cmd-meta-val">{selectedOrder.orderNumber.replace('#FC-', '')}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="cmd-modal-body">
              <div className="cmd-col-left">
                {selectedOrder.orderType === 'Delivery' && (
                  <div className="cmd-section cmd-address-section">
                    <div className="cmd-section-title"><MapPin size={16} className="cmd-icon-address" /> Dirección de entrega</div>
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

                    {!selectedOrder.isPaid && selectedOrder.source !== 'web' && (
                      <div className="cmd-delivery-fee">
                        <label className="cmd-delivery-fee-label"><Bike size={14} /> Costo del delivery</label>
                        <div className="cmd-delivery-fee-row">
                          <span className="cmd-delivery-fee-currency">$</span>
                          <input
                            type="text"
                            inputMode="decimal"
                            className="cmd-delivery-fee-input"
                            value={deliveryFeeInput}
                            onChange={(e) => setDeliveryFeeInput(e.target.value.replace(/[^0-9.,]/g, ''))}
                            placeholder="0,00"
                          />
                          <button
                            type="button"
                            className="cmd-delivery-fee-save"
                            disabled={savingDelivery}
                            onClick={handleSaveDeliveryFee}
                          >
                            {savingDelivery ? 'Guardando…' : 'Guardar'}
                          </button>
                        </div>
                        <small className="cmd-delivery-fee-hint">Monto cotizado por WhatsApp según la ubicación. Se suma al total.</small>
                      </div>
                    )}
                    {!selectedOrder.isPaid && selectedOrder.source === 'web' && (
                      <p className="cmd-delivery-fee-hint" style={{ marginTop: 12 }}>
                        <Bike size={12} /> Confirma el pedido de WhatsApp para poder agregar el costo del delivery.
                      </p>
                    )}
                  </div>
                )}

                <div className="cmd-section cmd-production-section">
                  <div className="cmd-section-title cmd-section-title-row">
                    <span className="cmd-section-title-text"><ShoppingBag size={16} className="cmd-icon-production" /> Producción del pedido</span>
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
                          {!selectedOrder.isPaid && <th aria-label="Acciones"></th>}
                        </tr>
                      </thead>
                      <tbody>
                        {selectedOrder.items.map(item => (
                          <tr key={item.id}>
                            <td>
                              <div className="cmd-product-cell">
                                <div className={`cmd-product-img ${item.name === 'Delivery' ? 'is-delivery' : 'is-food'}`}>{item.name === 'Delivery' ? <Bike size={16} /> : <Utensils size={16} />}</div>
                                <span>{item.name}</span>
                              </div>
                            </td>
                            <td className="cmd-obs">{item.observations || '—'}</td>
                            <td>x{item.quantity}</td>
                            <td><MoneyWithBcv usd={item.unitPrice || 0} rate={selectedOrder.bcvRate} compact /></td>
                            <td><MoneyWithBcv usd={item.subtotal || 0} rate={selectedOrder.bcvRate} compact /></td>
                            {!selectedOrder.isPaid && (
                              <td className="cmd-item-actions">
                                <button
                                  type="button"
                                  className="cmd-item-remove"
                                  title="Quitar producto"
                                  aria-label={`Quitar ${item.name}`}
                                  disabled={removingItemId === item.id}
                                  onClick={() => handleRemoveItem(item.id)}
                                >
                                  <Trash2 size={15} />
                                </button>
                              </td>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {removeError && <p className="cmd-item-remove-error">{removeError}</p>}
                </div>

                <div className="cmd-section cmd-notes-section">
                  <div className="cmd-section-title"><FileText size={16} className="cmd-icon-notes" /> Notas del pedido</div>
                  <div className="cmd-notes-content">
                    {cleanNotes(selectedOrder.notes) ? cleanNotes(selectedOrder.notes).split('\n').map((line, i) => <p key={i}>{line}</p>) : <p>Sin notas adicionales.</p>}
                  </div>
                </div>
              </div>

              <div className="cmd-col-right">
                <div className="cmd-section cmd-payment-section">
                  <div className="cmd-section-title"><CreditCard size={16} className="cmd-icon-payment" /> Resumen de pago</div>
                  
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
                    <span className="cmd-method-badge">{selectedOrder.isPaid ? selectedOrder.paymentMethod : <><AlertTriangle size={14} /> Sin cobrar</>}</span>
                  </div>
                  {!selectedOrder.isPaid && extractPreferredPayment(selectedOrder.notes) && (
                    <div className="cmd-payment-method-row cmd-pref-pay-row">
                      <span className="cmd-method-label"><CreditCard size={14} /> Pago del cliente</span>
                      <span className="cmd-pref-pay-badge">{extractPreferredPayment(selectedOrder.notes)!.label}</span>
                    </div>
                  )}

                  <div className="cmd-breakdown-section">
                    <div className="cmd-summary-row cmd-breakdown-title">Desglose del pago</div>
                    {selectedOrder.isPaid ? (
                      <div className="cmd-summary-row cmd-breakdown-item">
                        <span className="cmd-paid-green">Pagado ({selectedOrder.paymentMethod})</span>
                        <MoneyWithBcv usd={selectedOrder.totalAmount || 0} rate={selectedOrder.bcvRate} compact />
                      </div>
                    ) : (
                      <div className="cmd-summary-row cmd-breakdown-item">
                        <span className="cmd-paid-yellow"><AlertTriangle size={14} /> Pendiente de cobro</span>
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
                    <DollarSign size={16} /> Cobrar pedido
                  </button>
                )}
                {selectedOrder.source !== 'web' && selectedOrder.status !== 'delivered' && <button
                  className="cmd-btn-primary"
                  onClick={() => {
                    handleAdvanceStatus(selectedOrder.id, selectedOrder.status)
                    closeSelectedOrder()
                  }}
                >
                  <CheckCircle size={16} /> Marcar como {selectedOrder.status === 'new' ? 'preparación' : selectedOrder.status === 'preparing' ? 'lista' : 'entregada'}
                </button>}
                <button className="cmd-btn-secondary" onClick={() => closeSelectedOrder()}>Cerrar</button>
              </div>
            </footer>
          </div>
        </div>,
        document.body
      )}
      {/* Modal PIN para eliminar comanda */}
      {showDeleteModal && createPortal(
        <div className={`cmd-modal-overlay ${closingDelete ? 'closing' : ''}`} onClick={() => closeDeleteModal()}>
          <div className="cmd-pin-modal animate-pop" onClick={e => e.stopPropagation()}>
            <div className="cmd-pin-header">
              <ShieldCheck size={24} className="cmd-pin-icon" />
              <h3>Autorización requerida</h3>
            </div>
            <p className="cmd-pin-text">Ingresa tu PIN para eliminar la comanda <strong>{selectedOrder?.orderNumber}</strong></p>
            <input
              key={deletePin}
              type="password"
              className="cmd-pin-input"
              placeholder="PIN"
              maxLength={4}
              autoComplete="new-password"
              value={deletePin}
              onChange={e => { setDeletePin(e.target.value); setDeleteError('') }}
              onKeyDown={e => { if (e.key === 'Enter') handleDeleteOrder() }}
              autoFocus
            />
            {deleteError && <p className="cmd-pin-error">{deleteError}</p>}
            <div className="cmd-pin-actions">
              <button className="cmd-btn-secondary" onClick={() => closeDeleteModal()}>Cancelar</button>
              <button className="cmd-btn-danger" onClick={handleDeleteOrder} disabled={deleting || deletePin.length < 4}>
                <Trash2 size={16} /> {deleting ? 'Eliminando…' : 'Eliminar comanda'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
      {/* Modal Cobrar Pedido Directo desde Comandas */}
      {showPaymentModal && paymentOrder && createPortal(
        <div className={`modal-overlay-dark ${closingPayment ? 'closing' : ''}`} onClick={() => closePaymentModal()}>
          <div className="payment-modal-box animate-pop" onClick={(e) => e.stopPropagation()}>
            {/* Modal Header */}
            <div className="payment-modal-header">
              <h2 className="payment-modal-title">
                Cobrar pedido <span className="payment-order-tag">{paymentOrder.orderNumber}</span>
              </h2>
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
                  <div className="payment-ref-row">
                    <div className="payment-input-wrap" style={{ flex: 1 }}>
                      <input
                        type="text"
                        className="payment-field-input"
                        value={refNumber}
                        onChange={(e) => setRefNumber(e.target.value)}
                        placeholder="Ej. 876543210"
                      />
                      <QrCode size={16} className="qr-icon-right" />
                    </div>
                    <button type="button" className="cmd-add-ref-btn" title="Agregar referencia" onClick={() => setExtraRefs(prev => [...prev, ''])}>
                      <Plus size={18} />
                    </button>
                  </div>
                  {extraRefs.map((ref, idx) => (
                    <div className="payment-ref-row mt-1" key={idx}>
                      <div className="payment-input-wrap" style={{ flex: 1 }}>
                        <input
                          type="text"
                          className="payment-field-input"
                          value={ref}
                          onChange={(e) => { const v = e.target.value; setExtraRefs(prev => prev.map((r, i) => i === idx ? v : r)) }}
                          placeholder={`Referencia ${idx + 2}`}
                        />
                      </div>
                      <button type="button" className="cmd-remove-ref-btn" title="Quitar" onClick={() => setExtraRefs(prev => prev.filter((_, i) => i !== idx))}>
                        <X size={16} />
                      </button>
                    </div>
                  ))}
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
                  {selectedPaymentTab === 'cash' && (
                    <div className="cash-currency-toggle">
                      <button
                        type="button"
                        className={`cash-currency-btn ${cashCurrency === 'USD' ? 'active' : ''}`}
                        onClick={() => { setCashCurrency('USD'); setAmountReceived(paymentOrder?.totalAmount ? paymentOrder.totalAmount.toFixed(2) : '') }}
                      >USD</button>
                      <button
                        type="button"
                        className={`cash-currency-btn ${cashCurrency === 'VES' ? 'active' : ''}`}
                        onClick={() => { setCashCurrency('VES'); setAmountReceived(paymentRate && paymentOrder?.totalAmount ? (paymentOrder.totalAmount * paymentRate).toFixed(2) : '') }}
                      >Bs</button>
                    </div>
                  )}
                  <div className="payment-input-wrap">
                    <input
                      type="text"
                      inputMode="decimal"
                      className="payment-field-input"
                      value={amountReceived}
                      onChange={(e) => setAmountReceived(e.target.value)}
                    />
                    <span className="currency-tag-right">{selectedPaymentTab === 'cash' ? (cashCurrency === 'USD' ? 'USD' : 'Bs') : (usesBolivares(selectedPaymentTab) ? 'Bs' : 'USD')}</span>
                  </div>
                  <span className="payment-hint-sub">
                    {selectedPaymentTab === 'cash'
                      ? (cashCurrency === 'USD'
                        ? (paymentRate ? `Ref. ${formatVes((paymentOrder.totalAmount || 0) * paymentRate)}` : 'Referencia BCV no disponible')
                        : `Ref. ${formatUsd(paymentOrder.totalAmount || 0)}`)
                      : usesBolivares(selectedPaymentTab)
                        ? `Ref. ${formatUsd(paymentOrder.totalAmount || 0)}`
                        : (paymentRate ? `Ref. ${formatVes((paymentOrder.totalAmount || 0) * paymentRate)}` : 'Referencia BCV no disponible')}
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
                      <span className="customer-box-name"><User size={14} /> {paymentOrder.customerName || 'Cliente general'}</span>
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
              <button className="btn-modal-action-ghost" onClick={() => closePaymentModal()}>
                <X size={18} /> Cancelar
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
      {/* Modal Historial de Comandas */}
      {showHistoryModal && createPortal(
        <div className={`cmd-modal-overlay ${closingHistory ? 'closing' : ''}`} onClick={() => closeHistoryModal()}>
          <div className={`cmd-history-modal ${closingHistory ? 'animate-pop-out' : 'animate-pop'}`} onClick={e => e.stopPropagation()}>
            <header className="cmd-history-header">
              <div className="cmd-history-title">
                <span className="cmd-history-icon"><Clock size={18} /></span>
                <div className="cmd-history-title-text">
                  <h2>Historial de comandas</h2>
                  <span className="cmd-history-subtitle">
                    {historyLoading ? 'Cargando…' : `${filteredHistoryOrders.length} comanda${filteredHistoryOrders.length !== 1 ? 's' : ''}`}
                  </span>
                </div>
              </div>
              <button className="cmd-close-btn" onClick={() => closeHistoryModal()}>
                <X size={20} />
              </button>
            </header>

            <div className="cmd-history-toolbar">
              <div className="cmd-history-search">
                <Search size={16} />
                <input
                  type="text"
                  placeholder="Buscar por #, cliente o producto..."
                  value={historySearch}
                  onChange={e => setHistorySearch(e.target.value)}
                  autoFocus
                />
                {historySearch && (
                  <button type="button" className="search-clear-btn" onClick={() => setHistorySearch('')} aria-label="Borrar búsqueda">
                    <X size={13} />
                  </button>
                )}
              </div>
              <div className="cmd-history-range" role="tablist" aria-label="Rango de fechas">
                {([
                  { value: 'today', label: 'Hoy' },
                  { value: 'yesterday', label: 'Ayer' },
                  { value: '7d', label: '7 días' },
                  { value: '30d', label: '30 días' },
                ] as const).map(r => (
                  <button
                    key={r.value}
                    type="button"
                    role="tab"
                    aria-selected={historyRange === r.value}
                    className={`cmd-history-range-btn ${historyRange === r.value ? 'active' : ''}`}
                    onClick={() => setHistoryRange(r.value)}
                  >
                    {r.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="cmd-history-body">
              {historyLoading ? (
                <div className="cmd-history-loading">
                  <div className="cmd-history-spinner"></div>
                  <span>Cargando historial...</span>
                </div>
              ) : historyGroups.length === 0 ? (
                <EmptyState
                  compact
                  title="No se encontraron comandas"
                  description="Prueba con otro número, cliente o rango de fechas."
                />
              ) : (
                historyGroups.map(group => (
                  <section className="cmd-history-group" key={group.key}>
                    <h3 className="cmd-history-group-label">{group.label}</h3>
                    <div className="cmd-history-list">
                      {group.orders.map(order => (
                        <div
                          key={order.id}
                          className={`cmd-history-item ${order.isPaid ? 'paid' : 'unpaid'}`}
                          onClick={() => closeHistoryModal(() => setSelectedOrder(order))}
                        >
                          <span className="cmd-history-item-icon">
                            {order.orderType === 'Delivery' ? <Bike size={16} /> : order.orderType.startsWith('Mesa') ? <UtensilsCrossed size={16} /> : <ShoppingBag size={16} />}
                          </span>
                          <div className="cmd-history-item-main">
                            <div className="cmd-history-item-row">
                              <span className="cmd-history-customer">{order.customerName}</span>
                              <span className="cmd-history-order-no">{order.orderNumber}</span>
                            </div>
                            <div className="cmd-history-item-tags">
                              <span className="cmd-history-type">{order.orderType}</span>
                              {order.items.slice(0, 2).map(item => (
                                <span key={item.id} className="cmd-history-item-tag">{item.name} ×{item.quantity}</span>
                              ))}
                              {order.items.length > 2 && <span className="cmd-history-item-more">+{order.items.length - 2}</span>}
                            </div>
                          </div>
                          <div className="cmd-history-item-right">
                            <span className="cmd-history-time">{order.time}</span>
                            <span className={`cmd-history-status ${order.status}`}>
                              {order.status === 'delivered' ? '✓ Entregada' : order.status === 'ready' ? '✓ Lista' : order.status === 'preparing' ? <><Flame size={11} /> Preparando</> : <><Package size={11} /> Nueva</>}
                            </span>
                          </div>
                          <div className="cmd-history-item-total">
                            <MoneyWithBcv usd={order.totalAmount || 0} compact />
                            <span className={`cmd-history-paid-badge ${order.isPaid ? 'paid' : 'unpaid'}`}>
                              {order.isPaid ? order.paymentMethod : <><AlertTriangle size={11} /> Sin cobrar</>}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>
                ))
              )}
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}
