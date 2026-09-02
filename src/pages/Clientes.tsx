import { useState, useEffect, useCallback, useMemo, type CSSProperties } from 'react'
import { useSearchParams } from 'react-router-dom'
import { createPortal } from 'react-dom'
import { useAuth } from '../context/auth-context'
import { useRates } from '../context/rates-context'
import { MoneyWithBcv } from '../components/MoneyWithBcv'
import { StyledSelect } from '../components/StyledSelect'
import NumberStepper from '../components/NumberStepper'
import { formatProductTitle, normalizeForSearch } from '../lib/textFormat'
import { alertDialog, confirmDialog } from '../components/ConfirmDialog'
import { EmptyState } from '../components/EmptyState'
import {
  getCredits,
  getCreditPayments,
  addCreditPayment,
  createCustomer,
  updateCustomer,
  setCustomerActive,
  getCustomers,
  getCustomerOrders,
  getCustomerPurchaseMetrics,
  getProducts,
  checkout,
  type Credit as CreditType,
  type CreditPayment,
  type Customer,
  type CustomerOrderSummary,
  type CustomerPurchaseMetric,
  type Product,
  type CartItem,
  type PaymentMethod,
} from '../lib/dataService'
import {
  Search,
  Users,
  Calendar,
  User,
  Plus,
  Minus,
  Crown,
  CreditCard,
  DollarSign,
  Download,
  Eye,
  Edit2,
  Trash2,
  X,
  Phone,
  Gift,
  ShoppingBag,
  MapPin,
  ArrowLeft,
  Tag,
  Info,
  ChevronLeft,
  ChevronRight,
  IdCard,
  ShoppingCart,
  ClipboardList,
  Bike,
  Utensils,
  Package,
  Banknote,
  Smartphone,
  ArrowLeftRight,
  Coins,
  Wallet,
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

function formatTenure(value: string): string {
  if (!value) return 'Cliente nuevo'
  const start = new Date(value.length <= 10 ? `${value}T12:00:00` : value)
  if (Number.isNaN(start.getTime())) return 'Cliente nuevo'
  const days = Math.max(0, Math.floor((Date.now() - start.getTime()) / 86400000))
  if (days < 1) return 'Cliente nuevo'
  if (days < 30) return `${days} día${days === 1 ? '' : 's'}`
  if (days < 365) { const m = Math.floor(days / 30); return `${m} mes${m === 1 ? '' : 'es'}` }
  const years = Math.floor(days / 365)
  const months = Math.floor((days % 365) / 30)
  return months > 0 ? `${years} año${years === 1 ? '' : 's'} y ${months} mes${months === 1 ? '' : 'es'}` : `${years} año${years === 1 ? '' : 's'}`
}

function formatRelativeDays(value: string): string {
  if (!value) return ''
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return ''
  const days = Math.max(0, Math.floor((Date.now() - d.getTime()) / 86400000))
  if (days < 1) return 'Hoy'
  if (days === 1) return 'Ayer'
  return `Hace ${days} días`
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

function WhatsAppIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" />
      <path d="M12.001 2C6.478 2 2 6.478 2 12c0 1.79.47 3.548 1.362 5.096L2 22l4.99-1.331A9.956 9.956 0 0 0 12.001 22C17.523 22 22 17.523 22 12S17.523 2 12.001 2zm0 18.15a8.126 8.126 0 0 1-4.15-1.132l-.297-.176-3.11.83.83-3.033-.194-.312A8.104 8.104 0 0 1 3.85 12c0-4.49 3.66-8.15 8.15-8.15S20.15 7.51 20.15 12 16.49 20.15 12 20.15z" />
    </svg>
  )
}

const normalizeCustomerName = (value: string) => value.trim().toLocaleLowerCase('es-VE')

const AVATAR_COLORS = ['#E31B2B', '#FF4D3D', '#FF9E1B', '#FFC83D', '#b91c1c', '#c2410c']

function avatarColorFor(name: string): string {
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0
  return AVATAR_COLORS[hash % AVATAR_COLORS.length]
}

// Genera un cliente ficticio con historial completo para previsualizar el
// diseño del perfil localmente. Solo vive en memoria (?demoClient=1 en la
// URL): no lee ni escribe nada en Supabase.
function buildDemoClientData() {
  const now = Date.now()
  const daysAgo = (n: number) => new Date(now - n * 86400000).toISOString()

  const customer: Customer = {
    id: 'demo-client-001',
    name: 'Valentina Torres (Demo)',
    identification: '27458901',
    phone: '+58 412-555-0198',
    address: 'Av. Principal de Las Mercedes, Res. Los Nardos, Piso 4, Caracas',
    email: 'demo@fullchina.dev',
    totalVisits: 14,
    rewardsUnlocked: 2,
    lastVisit: daysAgo(3),
    favoriteProduct: 'Arroz Chino Especial',
    birthday: '1994-07-22',
    createdAt: daysAgo(430),
    isActive: true,
  }

  const orders: CustomerOrderSummary[] = [
    { id: 'demo-o1', orderNumber: 1042, createdAt: daysAgo(3), orderType: 'delivery', status: 'paid', fulfillmentStatus: 'delivered', total: 28.5, itemsText: '2x Arroz Chino Especial, 1x Wantán Frito', items: [{ productName: 'Arroz Chino Especial', quantity: 2 }, { productName: 'Wantán Frito', quantity: 1 }], paymentMethods: ['mobile'] },
    { id: 'demo-o2', orderNumber: 1017, createdAt: daysAgo(11), orderType: 'dine-in', status: 'paid', fulfillmentStatus: 'delivered', total: 41.9, itemsText: '1x Pollo Agridulce, 2x Tallarines Salteados', items: [{ productName: 'Pollo Agridulce', quantity: 1 }, { productName: 'Tallarines Salteados', quantity: 2 }], paymentMethods: ['card'] },
    { id: 'demo-o3', orderNumber: 986, createdAt: daysAgo(24), orderType: 'takeaway', status: 'paid', fulfillmentStatus: 'delivered', total: 19.0, itemsText: '1x Arroz Chino Especial', items: [{ productName: 'Arroz Chino Especial', quantity: 1 }], paymentMethods: ['cash'] },
    { id: 'demo-o4', orderNumber: 951, createdAt: daysAgo(45), orderType: 'delivery', status: 'paid', fulfillmentStatus: 'delivered', total: 33.2, itemsText: '3x Wantán Frito, 1x Arroz Chino Especial', items: [{ productName: 'Wantán Frito', quantity: 3 }, { productName: 'Arroz Chino Especial', quantity: 1 }], paymentMethods: ['zelle'] },
    { id: 'demo-o5', orderNumber: 903, createdAt: daysAgo(80), orderType: 'dine-in', status: 'paid', fulfillmentStatus: 'delivered', total: 52.4, itemsText: '2x Pollo Agridulce, 2x Tallarines Salteados', items: [{ productName: 'Pollo Agridulce', quantity: 2 }, { productName: 'Tallarines Salteados', quantity: 2 }], paymentMethods: ['mobile', 'cash'] },
    { id: 'demo-o6', orderNumber: 844, createdAt: daysAgo(140), orderType: 'delivery', status: 'pending', fulfillmentStatus: 'preparing', total: 22.75, itemsText: '1x Arroz Chino Especial, 1x Wantán Frito', items: [{ productName: 'Arroz Chino Especial', quantity: 1 }, { productName: 'Wantán Frito', quantity: 1 }], paymentMethods: [] },
  ]

  const credits: CreditType[] = [
    { id: 'demo-c1', customerId: customer.id, customerName: customer.name, totalAmount: 60, totalPaid: 35, balancePending: 25, status: 'partial', orderId: 'demo-o6', createdAt: daysAgo(20) },
    { id: 'demo-c2', customerId: customer.id, customerName: customer.name, totalAmount: 40, totalPaid: 40, balancePending: 0, status: 'paid', orderId: 'demo-o4', createdAt: daysAgo(60) },
  ]

  const payments: CreditPayment[] = [
    { id: 'demo-p1', creditId: 'demo-c1', amount: 20, notes: 'Abono parcial', createdBy: 'demo', createdAt: daysAgo(9) },
    { id: 'demo-p2', creditId: 'demo-c1', amount: 15, notes: null, createdBy: 'demo', createdAt: daysAgo(20) },
    { id: 'demo-p3', creditId: 'demo-c2', amount: 40, notes: 'Pago completo', createdBy: 'demo', createdAt: daysAgo(58) },
  ]

  const totalPurchased = orders.filter((o) => o.status === 'paid').reduce((s, o) => s + o.total, 0)

  const metric: CustomerPurchaseMetric = {
    customerId: customer.id,
    customerName: customer.name,
    orderCount: orders.length,
    totalPurchased,
    lastPurchase: orders[0].createdAt,
  }

  const row: CustomerRow = {
    id: customer.id,
    initials: 'VT',
    avatarBg: avatarColorFor(customer.name),
    name: customer.name,
    phone: customer.phone,
    identification: customer.identification,
    identificationStatus: 'verified_format',
    lastPurchase: orders[0].createdAt,
    totalPurchased,
    pendingBalance: credits.reduce((s, c) => s + c.balancePending, 0),
    status: 'Frecuente',
  }

  const demoProducts: Product[] = [
    { id: 'demo-p1', name: 'Arroz Chino Especial', description: null, price: 9.5, cost: null, category: 'Arroz', categories: ['Arroz'], emoji: '🍚', active: true, imageUrl: null },
    { id: 'demo-p2', name: 'Wantán Frito', description: null, price: 6.0, cost: null, category: 'Entradas', categories: ['Entradas'], emoji: '🥟', active: true, imageUrl: null },
    { id: 'demo-p3', name: 'Pollo Agridulce', description: null, price: 12.5, cost: null, category: 'Pollo', categories: ['Pollo'], emoji: '🍗', active: true, imageUrl: null },
    { id: 'demo-p4', name: 'Tallarines Salteados', description: null, price: 8.75, cost: null, category: 'Tallarines', categories: ['Tallarines'], emoji: '🍜', active: true, imageUrl: null },
    { id: 'demo-p5', name: 'Costillas Agridulce', description: null, price: 13.9, cost: null, category: 'Costillas', categories: ['Costillas'], emoji: '🍖', active: true, imageUrl: null },
    { id: 'demo-p6', name: 'Chop Suey Especial', description: null, price: 10.25, cost: null, category: 'Chop Suey', categories: ['Chop Suey'], emoji: '🥡', active: true, imageUrl: null },
  ]

  return { customer, orders, credits, payments, metric, row, products: demoProducts }
}

const ORDER_TYPE_LABELS: Record<string, string> = {
  'dine-in': 'Mesa', takeaway: 'Para llevar', delivery: 'Delivery',
}

const ORDER_TYPE_ICONS: Record<string, typeof Utensils> = {
  'dine-in': Utensils, takeaway: Package, delivery: Bike,
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

const PAYMENT_ICONS: Record<string, typeof Banknote> = {
  cash: Banknote, mobile: Smartphone, card: CreditCard,
  transfer: ArrowLeftRight, binance: Coins, zelle: Wallet, other: Wallet,
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
  const { bcvRate } = useRates()
  const [searchParams] = useSearchParams()
  const isDemoMode = searchParams.get('demoClient') === '1'
  const [credits, setCredits] = useState<CreditType[]>(creditsCache ?? [])

  // Selected customer for Profile View matching target screenshot
  const [selectedClient, setSelectedClient] = useState<CustomerRow | null>(null)
  const [customers, setCustomers] = useState<Customer[]>([])
  const [purchaseMetrics, setPurchaseMetrics] = useState<CustomerPurchaseMetric[]>([])
  const [products, setProducts] = useState<Product[]>([])

  // Filters state
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [identityFilter, setIdentityFilter] = useState('all')

  // Pagination state
  const CLIENTS_PER_PAGE = 25
  const [currentPage, setCurrentPage] = useState(1)

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

  // Modal "Nuevo pedido" embebido en la ficha del cliente (no navega a Caja).
  const [showQuickOrderModal, setShowQuickOrderModal] = useState(false)
  const [quickOrderSearch, setQuickOrderSearch] = useState('')
  const [quickOrderCart, setQuickOrderCart] = useState<CartItem[]>([])
  const [quickOrderType, setQuickOrderType] = useState<'dine-in' | 'takeaway' | 'delivery'>('takeaway')
  const [quickOrderPayment, setQuickOrderPayment] = useState<PaymentMethod>('cash')
  const [quickOrderSaving, setQuickOrderSaving] = useState(false)
  const [quickOrderError, setQuickOrderError] = useState('')

  // Detalle de un pedido del historial (la tabla es solo vista previa con
  // íconos; el modal muestra todo con nombres completos).
  const [orderDetail, setOrderDetail] = useState<CustomerOrderSummary | null>(null)

  // Closing-delay flags: keep the overlay mounted for the exit animation
  // before flipping the visibility state to false/null.
  const [closingNew, setClosingNew] = useState(false)
  const [closingEdit, setClosingEdit] = useState(false)
  const [closingPayment, setClosingPayment] = useState(false)
  const [closingCobrar, setClosingCobrar] = useState(false)
  const [closingQuickOrder, setClosingQuickOrder] = useState(false)

  const closeNewModal = (then?: () => void) => {
    if (!showNewModal || closingNew) return
    setClosingNew(true)
    window.setTimeout(() => {
      setShowNewModal(false)
      setClosingNew(false)
      then?.()
    }, 200)
  }

  const closeEditModal = (then?: () => void) => {
    if (!editClientId || closingEdit) return
    setClosingEdit(true)
    window.setTimeout(() => {
      setEditClientId(null)
      setClosingEdit(false)
      then?.()
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
  }, [isDemoMode])

  const fetchCredits = useCallback(async () => {
    if (isDemoMode) return
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
  }, [isDemoMode])

  useEffect(() => {
    fetchCredits()
  }, [fetchCredits])

  useEffect(() => {
    if (isDemoMode) return
    getProducts().then(setProducts).catch((e) => console.error('Error cargando fotos de productos:', e))
  }, [isDemoMode])

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
      void alertDialog({ message: 'No se pudo guardar el cliente. Revisa los datos e intenta de nuevo.', danger: true })
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
    closeNewModal(() => setSelectedClient(newClientObj))
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
      closeEditModal()
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
        closePaymentModal()
        setPaymentAmount('')
        fetchCredits()
      } catch (e) {
        console.error('Error registrando abono:', e)
        void alertDialog({ message: 'Error al registrar abono', danger: true })
      }
    }
  }

  const closeQuickOrderModal = () => {
    if (!showQuickOrderModal || closingQuickOrder) return
    setClosingQuickOrder(true)
    window.setTimeout(() => {
      setShowQuickOrderModal(false)
      setClosingQuickOrder(false)
      setQuickOrderSearch('')
      setQuickOrderCart([])
      setQuickOrderError('')
    }, 200)
  }

  const addToQuickOrderCart = (product: Product) => {
    setQuickOrderCart((prev) => {
      const existing = prev.find((item) => item.productId === product.id)
      if (existing) {
        return prev.map((item) => item.productId === product.id ? { ...item, quantity: item.quantity + 1 } : item)
      }
      return [...prev, { productId: product.id, productName: product.name, price: product.price, quantity: 1, emoji: product.emoji, lineId: product.id }]
    })
  }

  const adjustQuickOrderQty = (lineId: string, delta: number) => {
    setQuickOrderCart((prev) => prev
      .map((item) => item.lineId === lineId ? { ...item, quantity: item.quantity + delta } : item)
      .filter((item) => item.quantity > 0))
  }

  const removeFromQuickOrderCart = (lineId: string) => {
    setQuickOrderCart((prev) => prev.filter((item) => item.lineId !== lineId))
  }

  const quickOrderTotal = quickOrderCart.reduce((sum, item) => sum + item.price * item.quantity, 0)

  const handleQuickOrderSubmit = async () => {
    if (isDemoMode || !selectedClient || quickOrderCart.length === 0 || !user) return
    setQuickOrderSaving(true)
    setQuickOrderError('')
    try {
      await checkout({
        items: quickOrderCart,
        method: quickOrderPayment,
        bcvRate,
        userId: user.id,
        orderType: quickOrderType,
        customerName: selectedClient.name,
      })
      closeQuickOrderModal()
      const [orders, freshCredits] = await Promise.all([
        getCustomerOrders(selectedClient.id, selectedClient.name),
        getCredits(),
      ])
      setCustomerOrders(orders)
      setCredits(freshCredits)
      void alertDialog({ message: 'Pedido creado correctamente' })
    } catch (e) {
      console.error('Error creando pedido rápido:', e)
      setQuickOrderError(e instanceof Error ? e.message : 'Error al crear el pedido')
    } finally {
      setQuickOrderSaving(false)
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

  const totalOutstanding = useMemo(() => {
    return credits.reduce((acc, c) => acc + c.balancePending, 0)
  }, [credits])

  const frequentCustomers = useMemo(() => customers.filter((customer) => customer.totalVisits >= 5).length, [customers])
  const activeCreditsCount = useMemo(() => credits.filter((credit) => credit.balancePending > 0).length, [credits])
  const customersWithDebt = useMemo(() => new Set(
    credits.filter((credit) => credit.balancePending > 0).map((credit) => credit.customerId ?? `name:${normalizeCustomerName(credit.customerName)}`),
  ).size, [credits])

  const filteredQuickOrderProducts = useMemo(() => {
    const q = normalizeForSearch(quickOrderSearch)
    return products.filter((p) => !q || normalizeForSearch(p.name).includes(q)).slice(0, 40)
  }, [products, quickOrderSearch])

  // Modales globales (Nuevo cliente, Editar, Abonar crédito, Cuentas por
  // cobrar). Se definen una sola vez aquí y se insertan tanto en la vista de
  // lista como en la ficha de perfil, para que abrir "Editar" desde el
  // perfil de un cliente también funcione (antes solo vivían dentro del
  // return de la vista de lista).
  const clientModals = (
    <>
      {/* Modal Nuevo Cliente */}
      {showNewModal && createPortal(
        <div className={`modal-overlay-dark ${closingNew ? 'closing' : ''}`} onClick={() => closeNewModal()}>
          <div className="client-modal-box animate-pop clientes-modal-glow" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header-line clientes-modal-header-glow">
              <div>
                <h3 className="modal-title">Nuevo cliente</h3>
                <p className="modal-sub-desc">Registra un nuevo cliente en el sistema</p>
              </div>
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
                <button type="button" className="btn-modal-cancel" onClick={() => closeNewModal()}>
                  Cancelar
                </button>
                <button type="submit" className="btn-modal-submit-red">
                  Guardar cliente
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* Modal Editar Cliente */}
      {editClientId && createPortal(
        <div className={`modal-overlay-dark ${closingEdit ? 'closing' : ''}`} onClick={() => closeEditModal()}>
          <div className="client-modal-box animate-pop clientes-modal-glow" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header-line clientes-modal-header-glow">
              <div>
                <h3 className="modal-title">Editar cliente</h3>
                <p className="modal-sub-desc">Actualiza los datos del cliente</p>
              </div>
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
                <button type="button" className="btn-modal-cancel" onClick={() => closeEditModal()}>Cancelar</button>
                <button type="submit" className="btn-modal-submit-red" disabled={editSaving}>{editSaving ? 'Guardando…' : 'Guardar cambios'}</button>
              </div>
            </form>
          </div>
        </div>,
        document.body
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
            <div className="clientes-debt-highlight mt-2">
              <span className="clientes-debt-label">Deuda restante</span>
              <MoneyWithBcv usd={paymentModal.balancePending} className="clientes-debt-amount" usdClassName="font-bold" compact />
            </div>

            <form onSubmit={handlePayment} className="crm-form mt-3">
              <div className="field">
                <label className="field-label-white">Monto a abonar ($)</label>
                <NumberStepper
                  step={0.01}
                  max={paymentModal.balancePending}
                  placeholder={`Máximo $${paymentModal.balancePending.toFixed(2)}`}
                  value={paymentAmount}
                  onChange={(v) => setPaymentAmount(v)}
                  className="modal-input-dark"
                  required
                />
              </div>

              <div className="modal-actions-row-right mt-4">
                <button type="button" className="btn-modal-cancel" onClick={() => closePaymentModal()}>
                  Cancelar
                </button>
                <button type="submit" className="btn-modal-submit-red">
                  Confirmar Pago
                </button>
              </div>
            </form>
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
              <span className="clientes-summary-chip">{credits.filter((credit) => credit.balancePending > 0 && credit.orderId).length} comandas pendientes</span>
            </div>
            <div className="receivables-list">
              {receivablesLoading && <p className="modal-sub-desc">Cargando comandas pendientes…</p>}
              {credits.filter((credit) => credit.balancePending > 0).map((credit) => {
                const order = receivableOrders[credit.id]
                const days = Math.max(0, Math.floor((Date.now() - new Date(credit.createdAt).getTime()) / 86400000))
                return <div className="receivable-row" key={credit.id}>
                  <div>
                    <strong>{credit.customerName}</strong>
                    <span>{order ? `Comanda #${order.orderNumber} · ${order.itemsText || 'Sin detalle'}` : 'Crédito manual'}</span>
                    <small>Desde hace {days} día{days === 1 ? '' : 's'} · {formatDate(credit.createdAt)}</small>
                  </div>
                  <MoneyWithBcv usd={credit.balancePending} className="legend-val font-bold" compact />
                </div>
              })}
              {!receivablesLoading && credits.filter((credit) => credit.balancePending > 0).length === 0 && <p className="modal-sub-desc">No hay cuentas pendientes.</p>}
            </div>
          </div>
        </div>
        </>
      ), document.body)}

      {/* Modal Nuevo pedido (embebido, no navega a Caja) */}
      {showQuickOrderModal && selectedClient && createPortal(
        <div className={`modal-overlay-dark ${closingQuickOrder ? 'closing' : ''}`} onClick={closeQuickOrderModal}>
          <div className="client-modal-box quick-order-modal animate-pop clientes-modal-glow" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header-line clientes-modal-header-glow">
              <div>
                <h3 className="modal-title">Nuevo pedido</h3>
                <p className="modal-sub-desc">Para {selectedClient.name}</p>
              </div>
            </div>

            <div className="quick-order-search-row mt-3">
              <Search size={15} className="ic" />
              <input
                type="text"
                placeholder="Buscar producto…"
                value={quickOrderSearch}
                onChange={(e) => setQuickOrderSearch(e.target.value)}
                className="modal-input-dark with-left-icon"
              />
            </div>

            <div className="quick-order-product-list">
              {filteredQuickOrderProducts.map((p) => (
                <button type="button" key={p.id} className="quick-order-product-row" onClick={() => addToQuickOrderCart(p)}>
                  {p.imageUrl
                    ? <img src={p.imageUrl} alt="" className="quick-order-product-thumb" />
                    : <span className="quick-order-product-thumb quick-order-product-emoji">{p.emoji || '🍽️'}</span>}
                  <span className="quick-order-product-name">{formatProductTitle(p.name)}</span>
                  <span className="quick-order-product-price">{formatUsdText(p.price)}</span>
                  <Plus size={14} />
                </button>
              ))}
              {filteredQuickOrderProducts.length === 0 && <p className="modal-sub-desc">Sin productos para mostrar.</p>}
            </div>

            {quickOrderCart.length > 0 && (
              <div className="quick-order-cart mt-3">
                {quickOrderCart.map((item) => (
                  <div className="quick-order-cart-row" key={item.lineId}>
                    <span className="quick-order-cart-name">{formatProductTitle(item.productName)}</span>
                    <div className="quick-order-qty-controls">
                      <button type="button" onClick={() => adjustQuickOrderQty(item.lineId as string, -1)}><Minus size={12} /></button>
                      <span>{item.quantity}</span>
                      <button type="button" onClick={() => adjustQuickOrderQty(item.lineId as string, 1)}><Plus size={12} /></button>
                    </div>
                    <span className="quick-order-cart-sub">{formatUsdText(item.price * item.quantity)}</span>
                    <button type="button" className="quick-order-remove-btn" onClick={() => removeFromQuickOrderCart(item.lineId as string)}><X size={14} /></button>
                  </div>
                ))}
              </div>
            )}

            <div className="quick-order-config-row mt-3">
              <div className="field">
                <label className="field-label-white">Tipo de pedido</label>
                <StyledSelect
                  className="modal-select-dark"
                  value={quickOrderType}
                  onChange={(e) => setQuickOrderType(e.target.value as 'dine-in' | 'takeaway' | 'delivery')}
                >
                  <option value="takeaway">Para llevar</option>
                  <option value="dine-in">Mesa</option>
                  <option value="delivery">Delivery</option>
                </StyledSelect>
              </div>
              <div className="field">
                <label className="field-label-white">Método de pago</label>
                <StyledSelect
                  className="modal-select-dark"
                  value={quickOrderPayment}
                  onChange={(e) => setQuickOrderPayment(e.target.value as PaymentMethod)}
                >
                  <option value="cash">Efectivo</option>
                  <option value="mobile">Pago móvil</option>
                  <option value="card">Punto</option>
                  <option value="transfer">Transferencia</option>
                  <option value="binance">Binance</option>
                  <option value="zelle">Zelle</option>
                  <option value="other">Otro</option>
                </StyledSelect>
              </div>
            </div>

            {quickOrderError && <p className="login-error mt-2">{quickOrderError}</p>}
            {isDemoMode && <p className="modal-sub-desc quick-order-demo-note">Vista previa — en modo demo no se crean pedidos reales.</p>}

            <div className="quick-order-total-row mt-3">
              <span>Total</span>
              <span className="quick-order-total-val">{formatUsdText(quickOrderTotal)}</span>
            </div>

            <div className="modal-actions-row-right mt-4">
              <button type="button" className="btn-modal-cancel" onClick={closeQuickOrderModal}>Cancelar</button>
              <button
                type="button"
                className="btn-modal-submit-red"
                disabled={quickOrderCart.length === 0 || quickOrderSaving || isDemoMode}
                title={isDemoMode ? 'Deshabilitado en modo demo' : undefined}
                onClick={handleQuickOrderSubmit}
              >
                {quickOrderSaving ? 'Creando…' : 'Crear pedido'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Modal Detalle de pedido (desde el historial, todo con nombres completos) */}
      {orderDetail && createPortal(
        <div className="modal-overlay-dark" onClick={() => setOrderDetail(null)}>
          <div className="client-modal-box order-detail-modal animate-pop clientes-modal-glow" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header-line clientes-modal-header-glow">
              <div>
                <h3 className="modal-title">Pedido #{String(orderDetail.orderNumber).padStart(6, '0')}</h3>
                <p className="modal-sub-desc">{formatDateTime(orderDetail.createdAt)}</p>
              </div>
              <button className="modal-close-btn" onClick={() => setOrderDetail(null)}><X size={18} /></button>
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
      <div className="page animate-fade-in" key="client-profile-view">

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
                    <tr><td colSpan={8} className="profile-empty-state">Cargando actividad real…</td></tr>
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

  return (
    <div className="page animate-fade-in" key="client-list-view">

      {/* Page Header */}
      <div className="clientes-page-header">
        <div className="header-title-wrap">
          <div>
            <h1 className="page-title"><User size={22} className="page-title-icon" /> Clientes</h1>
            <p className="clientes-subtitle">Gestiona tu base de clientes, créditos y actividad de compra.</p>
          </div>
        </div>
        <button className="btn-nuevo-cliente-red" onClick={() => setShowNewModal(true)}>
          <Plus size={18} /> Nuevo cliente
        </button>
      </div>

      {/* 4 Summary KPI Cards */}
      <div className="clientes-kpi-grid">
        <div className="kpi-card-dark red">
          <div className="kpi-icon-circle-box red">
            <Users size={22} />
          </div>
          <div className="kpi-content-box">
            <span className="kpi-label-sm">Total clientes</span>
            <span className="kpi-value-lg">{customers.length}</span>
          </div>
        </div>

        <div className="kpi-card-dark gold">
          <div className="kpi-icon-circle-box gold">
            <Crown size={22} />
          </div>
          <div className="kpi-content-box">
            <span className="kpi-label-sm">Frecuentes</span>
            <span className="kpi-value-lg">{frequentCustomers}</span>
            <span className="kpi-sub-tag orange">5+ visitas</span>
          </div>
        </div>

        <div className="kpi-card-dark orange">
          <div className="kpi-icon-circle-box orange">
            <CreditCard size={22} />
          </div>
          <div className="kpi-content-box">
            <span className="kpi-label-sm">Créditos</span>
            <span className="kpi-value-lg">{activeCreditsCount}</span>
            <span className="kpi-sub-tag gold-text">Pendiente</span>
          </div>
        </div>

        <button
          type="button"
          className="kpi-card-dark dark-red clickable-kpi"
          title="Ver cuentas por cobrar"
          onClick={() => setShowCobrarModal(true)}
        >
          <div className="kpi-icon-circle-box dark-red">
            <DollarSign size={22} />
          </div>
          <div className="kpi-content-box">
            <span className="kpi-label-sm">Por cobrar</span>
            <span className="kpi-value-lg">{formatUsdText(totalOutstanding)}</span>
            <span className="kpi-sub-tag red-text">{customersWithDebt} cliente{customersWithDebt === 1 ? '' : 's'}</span>
          </div>
        </button>
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
                      <td className="amount-td"><MoneyWithBcv usd={row.totalPurchased} className={row.totalPurchased === 0 ? "text-muted-amount" : "text-green"} usdClassName="font-bold" compact /></td>
                      <td className="amount-td"><MoneyWithBcv usd={row.pendingBalance} className={row.pendingBalance > 0 ? "text-red" : "text-muted-amount"} usdClassName="font-bold" compact /></td>
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
            <span className="pagination-info">
              {displayRows.length === 0
                ? 'Sin resultados'
                : `Mostrando ${pageStart + 1}-${Math.min(pageStart + CLIENTS_PER_PAGE, displayRows.length)} de ${displayRows.length} clientes`}
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
                <span className="pagination-info">Página {safePage} de {totalPages}</span>
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
