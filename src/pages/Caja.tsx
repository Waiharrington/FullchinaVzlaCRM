import { useState, useMemo, useEffect, useCallback, type ReactNode } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/auth-context'
import { useRates } from '../context/rates-context'
import { MoneyWithBcv } from '../components/MoneyWithBcv'
import { PaymentMethodSelect } from '../components/PaymentMethodSelect'
import { downloadReceipt } from '../lib/receipt'
import { formatRateDate, formatUsd, formatVes } from '../lib/money'
import { groupMenuProducts, type MenuProductGroup } from '../lib/menuGrouping'
import {
  getProducts,
  getTodayOrders,
  getActiveCashSession,
  checkout,
  sendToKitchen,
  getCustomers,
  createCustomer,
  type Product,
  type CartItem,
  type OrderResult,
  type TodayOrder,
  type PaymentMethod,
  type CashSessionSnapshot,
} from '../lib/dataService'
import {
  X,
  Printer,
  CheckCircle,
  QrCode,
  ShieldCheck,
  Share2,
  ListOrdered,
  ChefHat,
  BellRing,
  Phone,
  ShoppingCart,
  Split,
  Flame,
  WalletCards,
  PencilLine,
  Plus,
  Minus,
  Trash2,
  Search,
  UtensilsCrossed,
  ShoppingBag as TakeawayBag,
  Bike,
  Banknote,
  Smartphone,
  CreditCard,
  Landmark,
  Hexagon,
  BadgeDollarSign,
  IdCard,
  MapPin,
} from 'lucide-react'
import './Caja.css'

type ViewMode = 'grid' | 'list'
type OrderType = 'dine-in' | 'takeaway' | 'delivery'

const CATEGORY_LABELS: Record<string, string> = {
  arroz: 'Arroces',
  noodles: 'Noodles',
  lumpia: 'Lumpias',
  combo: 'Combos',
  proteina: 'Proteínas',
  bebida: 'Bebidas',
  extra: 'Extras',
  plato: 'Platos',
  wok: 'Wok',
  pollo_camaron: 'Pollo y Camarón',
  racion: 'Raciones',
}
const CATEGORY_ORDER = ['arroz', 'noodles', 'lumpia', 'combo', 'proteina', 'bebida', 'extra', 'plato', 'wok', 'pollo_camaron', 'racion']
const BIRTH_MONTHS = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
] as const
const getDaysInBirthMonth = (month: string) => month ? new Date(2000, Number(month), 0).getDate() : 31

const ORDER_TYPE_LABELS: Record<OrderType, { label: string; icon: ReactNode }> = {
  'dine-in': { label: 'Mesa', icon: <UtensilsCrossed size={18} strokeWidth={1.8} /> },
  takeaway: { label: 'Para llevar', icon: <TakeawayBag size={18} strokeWidth={1.8} /> },
  delivery: { label: 'Delivery', icon: <Bike size={18} strokeWidth={1.8} /> },
}

// Método de pago sugerido por tipo de pedido: en mesa se suele pagar con punto,
// en delivery / para llevar con pago móvil. La persona puede cambiarlo luego.
const defaultPaymentForOrderType = (t: OrderType): PaymentMethod => (t === 'dine-in' ? 'card' : 'mobile')

const PAYMENT_METHODS: Array<{ method: PaymentMethod | 'split'; label: string; icon: ReactNode }> = [
  { method: 'cash', label: 'Efectivo', icon: <Banknote size={16} strokeWidth={1.8} /> },
  { method: 'mobile', label: 'Pago móvil', icon: <Smartphone size={16} strokeWidth={1.8} /> },
  { method: 'card', label: 'Punto', icon: <CreditCard size={16} strokeWidth={1.8} /> },
  { method: 'transfer', label: 'Transferencia', icon: <Landmark size={16} strokeWidth={1.8} /> },
  { method: 'binance', label: 'Binance', icon: <Hexagon size={16} strokeWidth={1.8} /> },
  { method: 'zelle', label: 'Zelle', icon: <BadgeDollarSign size={16} strokeWidth={1.8} /> },
  { method: 'split', label: 'Pago combinado', icon: <Split size={16} strokeWidth={1.8} /> },
]

type SplitPaymentMethod = Exclude<PaymentMethod, 'other'>
const SPLIT_PAYMENT_METHODS = PAYMENT_METHODS.filter(
  (item): item is { method: SplitPaymentMethod; label: string; icon: ReactNode } => item.method !== 'split' && item.method !== 'other',
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

const FOOD_IMAGES: Record<string, string> = {
  arroz: 'https://images.unsplash.com/photo-1603133872878-684f208fb84b?auto=format&fit=crop&w=600&q=80',
  noodles: 'https://images.unsplash.com/photo-1569718212165-3a8278d5f624?auto=format&fit=crop&w=600&q=80',
  lumpia: 'https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=600&q=80',
  combo: 'https://images.unsplash.com/photo-1541544741938-0af808871cc0?auto=format&fit=crop&w=600&q=80',
  proteina: 'https://images.unsplash.com/photo-1525755662778-989d0524087e?auto=format&fit=crop&w=600&q=80',
  bebida: 'https://images.unsplash.com/photo-1622483767028-3f66f32aef97?auto=format&fit=crop&w=600&q=80',
  extra: 'https://images.unsplash.com/photo-1565557623262-b51c2513a641?auto=format&fit=crop&w=600&q=80',
  default: 'https://images.unsplash.com/photo-1541544741938-0af808871cc0?auto=format&fit=crop&w=600&q=80'
}

function getProductImage(product: Product): string {
  const nameLower = product.name.toLowerCase()
  if (nameLower.includes('chaufa') || nameLower.includes('arroz')) return FOOD_IMAGES.arroz
  if (nameLower.includes('chow mein') || nameLower.includes('noodle')) return FOOD_IMAGES.noodles
  if (nameLower.includes('lumpia')) return FOOD_IMAGES.lumpia
  if (nameLower.includes('agridulce') || nameLower.includes('pollo')) return FOOD_IMAGES.proteina
  if (nameLower.includes('camaron') || nameLower.includes('camarón')) return FOOD_IMAGES.extra
  if (nameLower.includes('refresco') || nameLower.includes('agua') || nameLower.includes('bebida')) return FOOD_IMAGES.bebida
  return FOOD_IMAGES[product.category] || FOOD_IMAGES.default
}

// Cache a nivel de módulo: al volver a Ventas se muestra el catálogo de la
// última visita al instante, sin el parpadeo de "Cargando...", mientras se
// refresca en segundo plano.
let cajaCache: {
  products: Product[]
  todayOrders: TodayOrder[]
} | null = null

interface CustomerOption {
  id: string
  name: string
  initials: string
  phone: string
}

export function Caja() {
  const { user } = useAuth()
  const { bcvRate, updatedAt: bcvUpdatedAt, stale: bcvStale, error: bcvError, loading: bcvLoading, refresh: refreshBcv } = useRates()
  const navigate = useNavigate()
  const location = useLocation()

  const [products, setProducts] = useState<Product[]>(cajaCache?.products ?? [])
  const [todayOrders, setTodayOrders] = useState<TodayOrder[]>(cajaCache?.todayOrders ?? [])
  const [, setLoading] = useState(!cajaCache)

  const [cart, setCart] = useState<CartItem[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [activeCategory, setActiveCategory] = useState<string>('all')
  const [viewMode, setViewMode] = useState<ViewMode>('grid')
  const [sortBy, setSortBy] = useState<'popular' | 'price' | 'name'>('popular')
  const [selectedProductGroup, setSelectedProductGroup] = useState<MenuProductGroup | null>(null)

  const [orderType, setOrderType] = useState<OrderType>('dine-in')
  const [customerName, setCustomerName] = useState('')
  const [orderNotes, setOrderNotes] = useState('')

  // Customer Search & Auto-complete state
  const [customerList, setCustomerList] = useState<CustomerOption[]>([])
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false)

  // New Client Modal state
  const [showNewClientModal, setShowNewClientModal] = useState(false)
  const [newClientName, setNewClientName] = useState('')
  const [newClientLastName, setNewClientLastName] = useState('')
  const [newClientIdentification, setNewClientIdentification] = useState('')
  const [newClientPhone, setNewClientPhone] = useState('')
  const [newClientAddress, setNewClientAddress] = useState('')
  const [birthMonth, setBirthMonth] = useState('')
  const [birthDay, setBirthDay] = useState('')
  const [creatingCustomer, setCreatingCustomer] = useState(false)
  const [customerCreateError, setCustomerCreateError] = useState('')

  const filteredCustomers = useMemo(() => {
    if (!customerName.trim()) return customerList
    return customerList.filter(c =>
      c.name.toLowerCase().includes(customerName.toLowerCase()) ||
      c.phone.includes(customerName)
    )
  }, [customerList, customerName])

  useEffect(() => {
    getCustomers().then(customers => setCustomerList(customers.map(customer => ({
      id: customer.id,
      name: customer.name,
      initials: customer.name.split(' ').slice(0, 2).map(part => part[0] || '').join('').toUpperCase(),
      phone: customer.phone,
    })))).catch(error => console.error('getCustomers error:', error))
  }, [])

  // Cliente pre-seleccionado al venir desde el perfil de un cliente ("Nuevo pedido").
  useEffect(() => {
    const incoming = (location.state as { customerName?: string } | null)?.customerName
    if (incoming) {
      setCustomerName(incoming)
      // Limpiar el state para que no reaparezca al refrescar o volver.
      navigate(location.pathname, { replace: true, state: null })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleCreateNewClientFromCaja = async (e: React.FormEvent) => {
    e.preventDefault()
    const firstName = newClientName.trim()
    if (!firstName) {
      setCustomerCreateError('Ingresa el nombre del cliente.')
      return
    }
    if ((birthMonth && !birthDay) || (!birthMonth && birthDay)) {
      setCustomerCreateError('Selecciona el mes y el día del cumpleaños, o deja ambos vacíos.')
      return
    }

    setCreatingCustomer(true)
    setCustomerCreateError('')
    try {
      const fullName = `${firstName} ${newClientLastName.trim()}`.trim()
      const initials = (firstName[0] + (newClientLastName.trim()[0] || '')).toUpperCase()
      const identification = newClientIdentification.trim()
      const phone = newClientPhone.trim()
      const address = newClientAddress.trim()
      const birthDate = birthMonth && birthDay ? `2000-${birthMonth}-${birthDay.padStart(2, '0')}` : undefined
      const saved = await createCustomer({ name: fullName, identification, phone, address, birthDate })

      const newCust: CustomerOption = {
        id: saved.id,
        name: saved.name,
        initials,
        phone: saved.phone || phone,
      }

      setCustomerList(prev => [newCust, ...prev])
      setCustomerName(fullName)
      setShowCustomerDropdown(false)
      setShowNewClientModal(false)
      setNewClientName('')
      setNewClientLastName('')
      setNewClientIdentification('')
      setNewClientPhone('')
      setNewClientAddress('')
      setBirthMonth('')
      setBirthDay('')
    } catch (error) {
      console.error('createCustomer error:', error)
      setCustomerCreateError(error instanceof Error ? error.message : 'No se pudo guardar el cliente. Intenta nuevamente.')
    } finally {
      setCreatingCustomer(false)
    }
  }

  // Payment Modal State (Matching Image 1)
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [selectedPaymentTab, setSelectedPaymentTab] = useState<PaymentMethod | 'split'>(defaultPaymentForOrderType('dine-in'))
  const [refNumber, setRefNumber] = useState('')
  const [amountReceived, setAmountReceived] = useState('0.00')
  const [splitPrimaryMethod, setSplitPrimaryMethod] = useState<SplitPaymentMethod>('cash')
  const [splitSecondaryMethod, setSplitSecondaryMethod] = useState<SplitPaymentMethod>('mobile')
  const [splitPrimaryReference, setSplitPrimaryReference] = useState('')
  const [splitSecondaryReference, setSplitSecondaryReference] = useState('')
  const [paymentNote, setPaymentNote] = useState('')

  const [paying, setPaying] = useState(false)
  const [payError, setPayError] = useState('')
  const [cashSession, setCashSession] = useState<CashSessionSnapshot | null>(null)
  const [currentOrder, setCurrentOrder] = useState<OrderResult | null>(null)
  const [showConfirmation, setShowConfirmation] = useState(false)

  const refreshTodayOrders = useCallback(async () => {
    try {
      setTodayOrders(await getTodayOrders())
    } catch (e) {
      console.error('Error:', e)
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true)
      try {
        const [prods, orders] = await Promise.all([
          getProducts().catch((e) => { console.error('getProducts error:', e); return [] as Product[] }),
          getTodayOrders().catch((e) => { console.error('getTodayOrders error:', e); return [] as TodayOrder[] }),
        ])
        setProducts(prods)
        setTodayOrders(orders)
        cajaCache = { products: prods, todayOrders: orders }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    getActiveCashSession()
      .then(setCashSession)
      .catch(() => setCashSession(null))
  }, [])

  const categories = useMemo(() => {
    const present = new Set(products.map((p) => p.category))
    return CATEGORY_ORDER.filter((c) => present.has(c))
  }, [products])

  const filteredProductGroups = useMemo(() => {
    const categoryProducts = products.filter((product) => {
      const matchCat = activeCategory === 'all' || product.category === activeCategory
      return matchCat && product.active
    })
    let result = groupMenuProducts(categoryProducts)
    const query = searchTerm.trim().toLowerCase()
    if (query) {
      result = result.filter(group =>
        group.name.toLowerCase().includes(query) ||
        group.variants.some(({ product, label }) =>
          label.toLowerCase().includes(query) ||
          product.name.toLowerCase().includes(query) ||
          product.description?.toLowerCase().includes(query)
        )
      )
    }
    if (sortBy === 'price') result = [...result].sort((a, b) => a.minPrice - b.minPrice)
    else if (sortBy === 'name') result = [...result].sort((a, b) => a.name.localeCompare(b.name))
    return result
  }, [products, searchTerm, activeCategory, sortBy])

  const addToCart = (product: Product) => {
    setCart((prev) => {
      const existing = prev.find((i) => i.productId === product.id)
      if (existing) return prev.map((i) => i.productId === product.id ? { ...i, quantity: i.quantity + 1 } : i)
      return [...prev, { productId: product.id, productName: product.name, price: product.price, quantity: 1, emoji: product.emoji }]
    })
  }

  const updateQty = (productId: string, delta: number) => {
    setCart((prev) => prev.map((i) => i.productId === productId ? { ...i, quantity: i.quantity + delta } : i).filter((i) => i.quantity > 0))
  }

  const removeFromCart = (productId: string) => {
    setCart((prev) => prev.filter((i) => i.productId !== productId))
  }

  const subtotal = cart.reduce((s, i) => s + i.price * i.quantity, 0)
  const total = subtotal
  const splitPrimaryAmountUsd = paymentInputToUsd(amountReceived, splitPrimaryMethod, bcvRate)

  // Action 1: Enviar a Cocina -> Saves order WITHOUT payment and navigates to /comandas
  const handleSendToKitchen = async () => {
    if (cart.length === 0) return
    setPaying(true)
    setPayError('')
    try {
      const order = await sendToKitchen({
        items: cart,
        bcvRate,
        userId: user!.id,
        notes: orderNotes || null,
        orderType,
        customerName: customerName || 'Cliente general',
      })
      setCurrentOrder(order)
      setCart([])
      setCustomerName('')
      setOrderNotes('')
      refreshTodayOrders()
      // Navigate directly to Comandas page
      navigate('/comandas')
    } catch (e) {
      setPayError(e instanceof Error ? e.message : 'Error al enviar a cocina')
    } finally {
      setPaying(false)
    }
  }

  // Open Payment Modal (Image 1)
  const handleOpenPaymentModal = async (preferredMethod: PaymentMethod | 'split' = 'cash') => {
    if (cart.length === 0) return
    try {
      const active = await getActiveCashSession()
      setCashSession(active)
      if (!active) {
        setPayError('Debes abrir la caja antes de registrar un cobro.')
        return
      }
    } catch (cause) {
      setPayError(cause instanceof Error ? cause.message : 'No se pudo verificar la caja activa')
      return
    }
    setSelectedPaymentTab(preferredMethod)
    setRefNumber('')
    setAmountReceived((preferredMethod === 'split' ? total / 2 : total).toFixed(2))
    setSplitPrimaryMethod('cash')
    setSplitSecondaryMethod('mobile')
    setSplitPrimaryReference('')
    setSplitSecondaryReference('')
    setPaymentNote('')
    setPayError('')
    setShowPaymentModal(true)
  }

  const selectMenuGroup = (group: MenuProductGroup) => {
    if (group.isGrouped) setSelectedProductGroup(group)
    else addToCart(group.variants[0].product)
  }

  const addVariantToCart = (product: Product) => {
    addToCart(product)
    setSelectedProductGroup(null)
  }

  const handleSelectPaymentTab = (method: PaymentMethod | 'split') => {
    setSelectedPaymentTab(method)
    setRefNumber('')
    setSplitPrimaryReference('')
    setSplitSecondaryReference('')
    setPayError('')
    const inputMethod: SplitPaymentMethod = method === 'split' ? 'cash' : method === 'other' ? 'cash' : method
    setAmountReceived(usdToPaymentInput(method === 'split' ? total / 2 : total, inputMethod, bcvRate))
  }

  // Confirm Payment in Modal -> Triggers Confirmation Screen (Image 2)
  const handleConfirmPayment = async () => {
    setPaying(true)
    setPayError('')
    try {
      const enteredAmount = Number(amountReceived)
      if (!Number.isFinite(enteredAmount) || enteredAmount <= 0) {
        throw new Error('Ingresa un monto válido')
      }

      const requiresReference = selectedPaymentTab !== 'split'
        && selectedPaymentTab !== 'other'
        && requiresPaymentReference(selectedPaymentTab)
      if (requiresReference && !refNumber.trim()) {
        throw new Error('La referencia es obligatoria para este método')
      }

      let paymentComponents
      let finalMethod: PaymentMethod
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
        finalMethod = 'other'
        paymentComponents = [
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
        finalMethod = selectedPaymentTab
        paymentComponents = [{
          method: selectedPaymentTab,
          amount: total,
          referenceNumber: refNumber.trim() || undefined,
          receivedAmount: selectedPaymentTab === 'cash' ? enteredAmount : undefined,
          notes: paymentNote || undefined,
        }]
      }

      const order = await checkout({
        items: cart,
        method: finalMethod,
        bcvRate,
        userId: user!.id,
        notes: orderNotes || null,
        orderType,
        customerName: customerName || 'Cliente general',
        referenceNumber: selectedPaymentTab === 'split'
          ? (splitPrimaryReference.trim() || splitSecondaryReference.trim() || null)
          : (refNumber.trim() || null),
        receivedAmount: selectedPaymentTab === 'cash' ? enteredAmount : null,
        payments: paymentComponents,
      })
      setCurrentOrder(order)
      setShowPaymentModal(false)
      setShowConfirmation(true)
      refreshTodayOrders()
    } catch (e) {
      setPayError(e instanceof Error ? e.message : 'Error al confirmar pago')
    } finally {
      setPaying(false)
    }
  }

  const handlePrintReceipt = () => {
    if (currentOrder) {
      downloadReceipt({
        orderId: `FC-${String(currentOrder.orderNumber).padStart(6, '0')}`,
        items: currentOrder.items,
        total: currentOrder.total,
        paymentMethod: currentOrder.paymentMethod,
        createdAt: currentOrder.createdAt,
        bcvRate: currentOrder.bcvRate || bcvRate,
      })
    }
  }

  // Image 2 Target: Confirmation Screen "¡Pedido cobrado con éxito!"
  if (showConfirmation && currentOrder) {
    const orderNo = `#FC-${String(currentOrder.orderNumber).padStart(6, '0')}`
    const formattedDate = new Date(currentOrder.createdAt).toLocaleDateString('es-VE', { day: '2-digit', month: '2-digit', year: 'numeric' })
    const formattedTime = new Date(currentOrder.createdAt).toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit' })
    const paymentLabel = currentOrder.paymentMethod === 'cash'
      ? 'Efectivo'
      : currentOrder.paymentMethod === 'mobile'
        ? 'Pago móvil'
        : currentOrder.paymentMethod === 'card'
          ? 'Punto'
          : currentOrder.paymentMethod === 'transfer'
            ? 'Transferencia'
            : currentOrder.paymentMethod === 'binance'
              ? 'Binance'
              : currentOrder.paymentMethod === 'zelle'
                ? 'Zelle'
                : 'Pago combinado'

    return (
      <div className="page animate-fade-in">
        <div className="caja-success-layout">
          {/* LEFT COLUMN: Success Hero Card + Timeline */}
          <div className="success-left-col">
            {/* Confetti Hero Card */}
            <div className="success-hero-card">
              <div className="confetti-dots-bg" />
              <div className="big-check-circle">
                <CheckCircle size={44} className="check-icon-glow" />
              </div>
              <h1 className="success-hero-title">¡Pedido cobrado con éxito!</h1>
              <p className="success-hero-sub">Gracias por tu venta. El pedido ha sido enviado a cocina.</p>

              {/* 3 Metrics Row */}
              <div className="success-metrics-row">
                <div className="metric-box">
                  <span className="metric-box-label">Número de pedido</span>
                  <span className="metric-box-val text-red">{orderNo}</span>
                </div>
                <div className="metric-box">
                  <span className="metric-box-label">Total</span>
                  <MoneyWithBcv usd={currentOrder.total} rate={currentOrder.bcvRate || bcvRate} className="metric-box-val" align="center" />
                </div>
                <div className="metric-box">
                  <span className="metric-box-label">Método de pago</span>
                  <span className="metric-box-val font-bold">{paymentLabel}</span>
                </div>
              </div>

              {/* Status Badges */}
              <div className="success-status-badges-row">
                <span className="badge-status green">🟢 Pagado</span>
                <span className="badge-status gold">👨‍🍳 Enviado a cocina</span>
              </div>
            </div>

            {/* Action Buttons Bar */}
            <div className="success-actions-bar mt-4">
              <button
                className="btn-success-primary"
                onClick={() => { setShowConfirmation(false); setCart([]); setCurrentOrder(null) }}
              >
                <span>+</span> Nueva venta
              </button>
              <button className="btn-success-secondary" onClick={() => navigate('/comandas')}>
                <ListOrdered size={16} /> Ver comanda
              </button>
              <button className="btn-success-secondary" onClick={handlePrintReceipt}>
                <Printer size={16} /> Imprimir recibo
              </button>
              <button className="btn-success-secondary">
                <Share2 size={16} /> Compartir comprobante
              </button>
            </div>

            {/* Timeline Card */}
            <div className="activity-timeline-card mt-4">
              <h3 className="timeline-card-title">Actividad del pedido</h3>

              <div className="timeline-steps-wrap">
                <div className="timeline-line-bg" />

                <div className="timeline-step active">
                  <div className="step-icon-circle">
                    <CheckCircle size={16} />
                  </div>
                  <div className="step-info">
                    <span className="step-title">Pago confirmado</span>
                    <span className="step-time">{formattedTime}</span>
                    <span className="step-desc">El pago ha sido procesado correctamente.</span>
                  </div>
                </div>

                <div className="timeline-step active">
                  <div className="step-icon-circle">
                    <ChefHat size={16} />
                  </div>
                  <div className="step-info">
                    <span className="step-title">Comanda enviada</span>
                    <span className="step-time">{formattedTime}</span>
                    <span className="step-desc">La comanda ha sido enviada a cocina.</span>
                  </div>
                </div>

                <div className="timeline-step active">
                  <div className="step-icon-circle">
                    <BellRing size={16} />
                  </div>
                  <div className="step-info">
                    <span className="step-title">Cocina notificada</span>
                    <span className="step-time">{formattedTime}</span>
                    <span className="step-desc">El equipo de cocina ha sido notificado del pedido.</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* RIGHT COLUMN: Ticket Receipt Card */}
          <div className="success-right-col">
            <div className="ticket-receipt-card">
              <div className="ticket-header-logo">
                <span className="ticket-logo-icon">🔥</span>
                <span className="ticket-logo-text">FULL CHINA</span>
                <span className="ticket-sub-title">Comprobante de venta</span>
              </div>

              <div className="ticket-dashed-line" />

              <div className="ticket-meta-row">
                <span>Pedido: <strong className="text-red">{orderNo}</strong></span>
                <span>{formattedDate} {formattedTime}</span>
              </div>
              <div className="ticket-meta-row">
                <span>{ORDER_TYPE_LABELS[orderType].label}</span>
                <span>Atendido por: Admin</span>
              </div>

              <div className="ticket-dashed-line" />

              <div className="ticket-items-list">
                {currentOrder.items.map((item, idx) => {
                  const prod = products.find(p => p.id === item.productId)
                  const imgUrl = prod ? getProductImage(prod) : FOOD_IMAGES.default

                  return (
                    <div key={idx} className="ticket-item-row">
                      <img src={imgUrl} alt={item.productName} className="ticket-item-thumb" />
                      <div className="ticket-item-info">
                        <span className="ticket-item-name">{item.productName}</span>
                      </div>
                      <MoneyWithBcv usd={item.price * item.quantity} rate={currentOrder.bcvRate || bcvRate} className="ticket-item-price" compact />
                    </div>
                  )
                })}
              </div>

              <div className="ticket-dashed-line" />

              <div className="ticket-totals-list">
                <div className="ticket-total-line">
                  <span>Subtotal</span>
                  <MoneyWithBcv usd={currentOrder.total} rate={currentOrder.bcvRate || bcvRate} compact />
                </div>
                <div className="ticket-total-line">
                  <span>Descuento</span>
                  <MoneyWithBcv usd={0} rate={currentOrder.bcvRate || bcvRate} compact />
                </div>
              </div>

              <div className="ticket-total-final-row">
                <span className="ticket-final-label">Total</span>
                <MoneyWithBcv usd={currentOrder.total} rate={currentOrder.bcvRate || bcvRate} className="ticket-final-val" />
              </div>

              <div className="ticket-payment-method">
                <span>Método de pago:</span>
                <span className="font-bold">{paymentLabel}</span>
              </div>

              <div className="ticket-footer-text">
                ¡Gracias por su preferencia!
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="page animate-fade-in">
      <div className={`cash-session-strip ${cashSession ? 'open' : 'closed'}`}>
        <div className="cash-session-info">
          <span>{cashSession ? `Caja abierta · Turno #${cashSession.sessionNumber}` : 'Caja operativa sin verificar'}</span>
          <small className={bcvStale || bcvError ? 'bcv-warning' : ''}>
            {bcvLoading && !bcvRate
              ? 'Consultando tasa BCV…'
              : bcvRate
                ? `BCV: $1 = ${formatVes(bcvRate)} · ${bcvStale ? 'referencia guardada' : `actualizada ${formatRateDate(bcvUpdatedAt)}`}`
                : 'Tasa BCV no disponible'}
          </small>
        </div>
        <div className="cash-session-actions">
          <button type="button" className="bcv-refresh-btn" onClick={() => void refreshBcv()} disabled={bcvLoading}>Actualizar BCV</button>
          <button onClick={() => navigate('/caja-operativa')}>{cashSession ? 'Ver turno' : 'Abrir caja'}</button>
        </div>
      </div>
      <div className="caja-layout">
        {/* LEFT: Products */}
        <div className="products-section">
          {/* Hero Wok Flame Banner */}
          <div className="caja-hero-banner">
            <div className="hero-banner-left">
              <div className="hero-cart-icon">🛒</div>
              <div>
                <h1 className="hero-title">Nueva venta</h1>
                <p className="hero-subtitle">Crea pedidos, cobra y envía a cocina.</p>
              </div>
            </div>
            <div className="hero-banner-right">
              <div className="hero-overlay-text">
                <span className="hero-tagline">Sabor que prende,</span>
                <span className="hero-tagline-bold">experiencia que deja huella.</span>
              </div>
            </div>
          </div>

          {/* Category Tabs */}
          <div className="category-tabs">
            <button
              className={`category-tab ${activeCategory === 'all' ? 'active' : ''}`}
              onClick={() => setActiveCategory('all')}
            >
              Todos
            </button>
            {categories.map((cat) => (
              <button
                key={cat}
                className={`category-tab ${activeCategory === cat ? 'active' : ''}`}
                onClick={() => setActiveCategory(cat)}
              >
                {CATEGORY_LABELS[cat] ?? cat}
              </button>
            ))}
          </div>

          {/* Toolbar */}
          <div className="products-toolbar">
            <div className="search-box">
              <span className="search-icon">🔍</span>
              <input
                type="text"
                placeholder="Buscar en el menú..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="search-input-caja"
              />
            </div>
            <button className="filter-btn">⚙️ Filtros</button>
            <select
              className="sort-select"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
            >
              <option value="popular">Más vendidos</option>
              <option value="price">Precio</option>
              <option value="name">Nombre</option>
            </select>
            <div className="view-toggle">
              <button className={`view-btn ${viewMode === 'grid' ? 'active' : ''}`} onClick={() => setViewMode('grid')}>▦</button>
              <button className={`view-btn ${viewMode === 'list' ? 'active' : ''}`} onClick={() => setViewMode('list')}>☰</button>
            </div>
          </div>

          {/* Products Grid */}
          <div className={`products-container ${viewMode}`}>
            {filteredProductGroups.length === 0 ? (
              <p className="empty-message">No hay productos en esta categoría</p>
            ) : (
              filteredProductGroups.map((group, index) => {
                const product = group.variants[0].product
                const imgUrl = getProductImage(product)
                const groupName = group.name.toLowerCase()
                const isPopular = index === 0 || groupName.includes('chaufa') || groupName.includes('especial')
                const isLowStock = group.variants.some(({ product: variant }) => /camaron|camarón/i.test(variant.name))

                return (
                  <div key={group.key} className={`product-card ${group.isGrouped ? 'product-family-card' : ''} ${viewMode}`} onClick={() => selectMenuGroup(group)}>
                    <div className="product-image-area" style={{ backgroundImage: `url(${imgUrl})` }}>
                      {isPopular && <span className="product-badge badge-popular">🔥 Más vendido</span>}
                      {group.isGrouped && <span className="product-badge badge-variants">{group.variants.length} opciones</span>}
                      <button
                        className="product-quick-add-btn"
                        onClick={(e) => { e.stopPropagation(); selectMenuGroup(group) }}
                        title={group.isGrouped ? 'Elegir presentación' : 'Agregar al pedido'}
                      >
                        {group.isGrouped ? '›' : '+'}
                      </button>
                    </div>
                    <div className="product-card-body">
                      <h3 className="product-card-title">{group.name}</h3>
                      {group.isGrouped && (
                        <span className="product-variant-preview">
                          {group.variants.map(variant => variant.label).join(' · ')}
                        </span>
                      )}
                      <div className="product-card-meta">
                        <div className="product-family-price">
                          {group.isGrouped && group.minPrice !== group.maxPrice && <small>Desde</small>}
                          <MoneyWithBcv usd={group.minPrice} className="product-card-price" align="start" compact />
                        </div>
                        <span className={`product-stock-status ${isLowStock ? 'low-stock' : 'in-stock'}`}>
                          <span className="stock-dot" /> {group.isGrouped ? 'Elegir opción' : isLowStock ? 'Pocas piezas' : 'En stock'}
                        </span>
                      </div>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>

        {selectedProductGroup && (
          <div className="modal-overlay-dark" onClick={() => setSelectedProductGroup(null)}>
            <section className="variant-selector-modal animate-pop" role="dialog" aria-modal="true" aria-labelledby="variant-selector-title" onClick={(event) => event.stopPropagation()}>
              <div className="variant-selector-header">
                <div>
                  <span className="variant-selector-eyebrow">Selecciona una presentación</span>
                  <h2 id="variant-selector-title">{selectedProductGroup.name}</h2>
                </div>
                <button type="button" className="payment-modal-close" onClick={() => setSelectedProductGroup(null)} aria-label="Cerrar selector">
                  <X size={18} />
                </button>
              </div>
              <div className="variant-selector-list">
                {selectedProductGroup.variants.map(({ product, label }) => (
                  <button key={product.id} type="button" className="variant-option-card" onClick={() => addVariantToCart(product)}>
                    <span className="variant-option-emoji">{product.emoji || '🍽️'}</span>
                    <span className="variant-option-copy">
                      <strong>{label}</strong>
                      {product.description && <small>{product.description}</small>}
                    </span>
                    <MoneyWithBcv usd={product.price} className="variant-option-price" compact />
                    <span className="variant-option-add">Agregar</span>
                  </button>
                ))}
              </div>
            </section>
          </div>
        )}

        {/* RIGHT: Cart Sidebar */}
        <div className="cart-sidebar">
          <div className="cart-sidebar-header">
            <div className="cart-order-title-group">
              <span className="cart-eyebrow">Comanda activa</span>
              <h3 className="cart-order-title">
                Pedido <span className="cart-order-number">#FC-{String(todayOrders.length + 125).padStart(6, '0')}</span>
              </h3>
              <div className="cart-header-badges">
                <span className="cart-badge-type">{ORDER_TYPE_LABELS[orderType].label}</span>
                <span className="cart-time">12:45 PM</span>
              </div>
            </div>
            <button className="cart-edit-btn" type="button"><PencilLine size={13} /> Editar</button>
          </div>

          <div className="cart-sidebar-body">
            {/* Cart Items */}
            {cart.length === 0 ? (
              <div className="empty-cart-sidebar">
                <span className="empty-cart-icon"><ShoppingCart size={28} /></span>
                <strong>Tu pedido está vacío</strong>
                <p>Selecciona productos del menú para comenzar.</p>
              </div>
            ) : (
              <div className="cart-items-list">
                {cart.map((item) => {
                  const prod = products.find(p => p.id === item.productId)
                  const imgUrl = prod ? getProductImage(prod) : FOOD_IMAGES.default

                  return (
                    <div key={item.productId} className="cart-item-row">
                      <img src={imgUrl} alt={item.productName} className="cart-item-thumb" />
                      <div className="cart-item-details">
                        <span className="cart-item-name">{item.productName}</span>
                        <span className="cart-item-sub">Sin cebollín</span>
                      </div>
                      <div className="cart-item-controls">
                        <button className="qty-btn-sm" aria-label={`Restar ${item.productName}`} onClick={() => updateQty(item.productId, -1)}><Minus size={13} /></button>
                        <span className="qty-display">{item.quantity}</span>
                        <button className="qty-btn-sm" aria-label={`Agregar ${item.productName}`} onClick={() => updateQty(item.productId, 1)}><Plus size={13} /></button>
                      </div>
                      <MoneyWithBcv usd={item.price * item.quantity} className="cart-item-price" compact />
                      <button className="cart-item-remove" aria-label={`Eliminar ${item.productName}`} onClick={() => removeFromCart(item.productId)}><Trash2 size={14} /></button>
                    </div>
                  )
                })}
              </div>
            )}

            {/* Notes */}
            <div className="cart-field mt-2">
              <div className="notes-wrap">
                <span className="notes-icon"><PencilLine size={15} /></span>
                <input
                  type="text"
                  className="cart-notes"
                  placeholder="Notas del pedido (opcional)..."
                  value={orderNotes}
                  onChange={(e) => setOrderNotes(e.target.value.slice(0, 120))}
                />
                <span className="notes-counter">{orderNotes.length}/120</span>
              </div>
            </div>

            {/* Customer + Order Type */}
            <div className="cart-section-group mt-2">
              <div className="cart-field-col customer-input-col">
                <label className="cart-label">Cliente</label>
                <div className="customer-input-wrap">
                  <span className="input-search-icon"><Search size={15} /></span>
                  <input
                    type="text"
                    placeholder="Buscar cliente (opcional)"
                    value={customerName}
                    onChange={(e) => {
                      setCustomerName(e.target.value)
                      setShowCustomerDropdown(true)
                    }}
                    onFocus={() => setShowCustomerDropdown(true)}
                    className="customer-input"
                  />
                  <button
                    type="button"
                    className="customer-add-btn"
                    onClick={() => {
                      setCustomerCreateError('')
                      setShowNewClientModal(true)
                    }}
                    title="Nuevo cliente"
                  >
                    <Plus size={15} />
                  </button>
                </div>

                {/* Autocomplete Dropdown List */}
                {showCustomerDropdown && filteredCustomers.length > 0 && (
                  <div className="customer-dropdown-menu">
                    {filteredCustomers.map((cust) => (
                      <div
                        key={cust.id}
                        className="customer-dropdown-item"
                        onClick={() => {
                          setCustomerName(cust.name)
                          setShowCustomerDropdown(false)
                        }}
                      >
                        <div className="customer-item-avatar">{cust.initials}</div>
                        <div className="customer-item-info">
                          <span className="customer-item-name">{cust.name}</span>
                          <span className="customer-item-phone">{cust.phone}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="cart-field-col mt-2">
                <label className="cart-label">Tipo de pedido</label>
                <div className="order-type-buttons">
                  {(Object.entries(ORDER_TYPE_LABELS) as Array<[OrderType, { label: string; icon: ReactNode }]>).map(([key, val]) => (
                    <button
                      key={key}
                      className={`order-type-card ${orderType === key ? 'active' : ''}`}
                      onClick={() => { setOrderType(key); setSelectedPaymentTab(defaultPaymentForOrderType(key)) }}
                    >
                      <span className="order-type-icon">{val.icon}</span>
                      <span className="order-type-text">{val.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="cart-sidebar-footer">
            {/* Totals Breakdown */}
            <div className="cart-totals-card">
              <div className="cart-total-row">
                <span className="total-label">Subtotal</span>
                <MoneyWithBcv usd={subtotal} className="total-val" compact />
              </div>
              <div className="cart-total-row">
                <span className="total-label">Descuento</span>
                <MoneyWithBcv usd={0} className="total-val" compact />
              </div>
              <div className="cart-divide-row">
                <button
                  type="button"
                  className="divide-payment-link"
                  disabled={cart.length === 0 || paying}
                  onClick={() => handleOpenPaymentModal('split')}
                >
                  <span className="divide-payment-icon"><Split size={16} /></span>
                  <span className="divide-payment-copy">
                    <strong>Pago combinado</strong>
                    <small>Cobrar con dos métodos</small>
                  </span>
                  <span className="divide-payment-arrow">›</span>
                </button>
              </div>
              <div className="cart-total-row total-final-row">
                <span className="final-label">Total</span>
                <MoneyWithBcv usd={total} className="final-amount" />
              </div>
            </div>

            {payError && <p className="pay-error">{payError}</p>}

            {/* Action buttons */}
            <div className="cart-action-buttons mt-2">
              <button
                className="btn-pay-red"
                disabled={cart.length === 0 || paying}
                onClick={() => handleOpenPaymentModal()}
              >
                <WalletCards size={18} /> <span>Cobrar pedido</span>
              </button>
              <button
                className="btn-kitchen-red"
                disabled={cart.length === 0 || paying}
                onClick={handleSendToKitchen}
              >
                <Flame size={18} /> <span>Enviar a cocina</span>
              </button>
            </div>

            {/* Accepted Payment Methods at bottom */}
            <div className="payment-accepted-section mt-2">
              <span className="accepted-title">Formas de pago aceptadas</span>
              <div className="payment-badges-row">
                {PAYMENT_METHODS.filter(pm => pm.method !== 'split').map((pm) => (
                  <span key={pm.method} className="payment-badge-pill">
                    {pm.icon} {pm.label}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Image 1 Target: Payment Modal "Cobrar pedido" */}
      {showPaymentModal && (
        <div className="modal-overlay-dark" onClick={() => setShowPaymentModal(false)}>
          <div className="payment-modal-box animate-pop" onClick={(e) => e.stopPropagation()}>
            {/* Modal Header */}
            <div className="payment-modal-header">
              <h2 className="payment-modal-title">
                Cobrar pedido <span className="payment-order-tag">Nueva venta</span>
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

            {/* Modal Body: Left Details + Right Summary */}
            <div className="payment-modal-body">
              {/* Left Column: Details */}
              <div className="payment-body-left">
                <h3 className="payment-sub-heading">
                  Detalles del pago ({PAYMENT_METHODS.find(p => p.method === selectedPaymentTab)?.label})
                </h3>

                {selectedPaymentTab !== 'split' && selectedPaymentTab !== 'other' && requiresPaymentReference(selectedPaymentTab) && (
                  <div className="payment-field-group mt-2">
                    <label className="payment-field-label">{paymentReferenceLabel(selectedPaymentTab)}</label>
                    <div className="payment-input-wrap">
                      <input
                        type="text"
                        className="payment-field-input"
                        value={refNumber}
                        onChange={(e) => setRefNumber(e.target.value)}
                        placeholder="Ej. 458921"
                      />
                      <QrCode size={16} className="qr-icon-right" />
                    </div>
                  </div>
                )}

                {selectedPaymentTab === 'split' && (
                  <div className="split-payment-grid mt-2">
                    <section className="split-method-card">
                      <div className="split-method-heading">
                        <span className="split-method-number">1</span>
                        <span>Primer método</span>
                      </div>
                      <PaymentMethodSelect
                        ariaLabel="Primer método de pago"
                        value={splitPrimaryMethod}
                        options={SPLIT_PAYMENT_METHODS}
                        disabledMethod={splitSecondaryMethod}
                        onChange={(nextMethod) => {
                          const currentUsd = paymentInputToUsd(amountReceived, splitPrimaryMethod, bcvRate)
                          setSplitPrimaryMethod(nextMethod)
                          setAmountReceived(usdToPaymentInput(currentUsd, nextMethod, bcvRate))
                          setSplitPrimaryReference('')
                          setPayError('')
                        }}
                      />
                      <label className="payment-field-label">Monto del primer método</label>
                      <div className="payment-input-wrap">
                        <input
                          type="text"
                          inputMode="decimal"
                          className="payment-field-input"
                          value={amountReceived}
                          onChange={(e) => setAmountReceived(e.target.value)}
                        />
                        <span className="currency-tag-right">{usesBolivares(splitPrimaryMethod) ? 'Bs' : 'USD'}</span>
                      </div>
                      <span className="payment-hint-sub">
                        {usesBolivares(splitPrimaryMethod)
                          ? `Ref. ${formatUsd(splitPrimaryAmountUsd)}`
                          : bcvRate ? `Ref. ${formatVes(splitPrimaryAmountUsd * bcvRate)}` : 'Referencia BCV no disponible'}
                      </span>
                      {requiresPaymentReference(splitPrimaryMethod) && (
                        <>
                          <label className="payment-field-label">{paymentReferenceLabel(splitPrimaryMethod)}</label>
                          <input
                            type="text"
                            className="payment-field-input"
                            value={splitPrimaryReference}
                            onChange={(e) => setSplitPrimaryReference(e.target.value)}
                            placeholder="Ej. 458921"
                          />
                        </>
                      )}
                    </section>

                    <section className="split-method-card">
                      <div className="split-method-heading">
                        <span className="split-method-number">2</span>
                        <span>Segundo método</span>
                      </div>
                      <PaymentMethodSelect
                        ariaLabel="Segundo método de pago"
                        value={splitSecondaryMethod}
                        options={SPLIT_PAYMENT_METHODS}
                        disabledMethod={splitPrimaryMethod}
                        onChange={(nextMethod) => {
                          setSplitSecondaryMethod(nextMethod)
                          setSplitSecondaryReference('')
                          setPayError('')
                        }}
                      />
                      <label className="payment-field-label">Monto del segundo método</label>
                      <div className="split-readonly-amount">
                        <MoneyWithBcv
                          usd={Math.max(total - splitPrimaryAmountUsd, 0)}
                          rate={bcvRate}
                          primaryCurrency={usesBolivares(splitSecondaryMethod) ? 'VES' : 'USD'}
                          compact
                        />
                      </div>
                      {requiresPaymentReference(splitSecondaryMethod) && (
                        <>
                          <label className="payment-field-label">{paymentReferenceLabel(splitSecondaryMethod)}</label>
                          <input
                            type="text"
                            className="payment-field-input"
                            value={splitSecondaryReference}
                            onChange={(e) => setSplitSecondaryReference(e.target.value)}
                            placeholder="Ej. 458921"
                          />
                        </>
                      )}
                    </section>
                  </div>
                )}

                {selectedPaymentTab !== 'split' && <div className="payment-field-group mt-3">
                  <label className="payment-field-label">
                    MONTO RECIBIDO <span className="text-red">*</span>
                  </label>
                  <div className="payment-input-wrap">
                    <input
                      type="text"
                      inputMode="decimal"
                      className="payment-field-input"
                      value={amountReceived}
                      onChange={(e) => setAmountReceived(e.target.value)}
                    />
                    <span className="currency-tag-right">
                      {selectedPaymentTab !== 'other' && usesBolivares(selectedPaymentTab) ? 'Bs' : 'USD'}
                    </span>
                  </div>
                  <span className="payment-hint-sub">
                    {selectedPaymentTab !== 'other' && usesBolivares(selectedPaymentTab)
                      ? `Ref. ${formatUsd(total)}`
                      : bcvRate ? `Ref. ${formatVes(total * bcvRate)}` : 'Referencia BCV no disponible'}
                  </span>
                </div>}

                <div className="payment-field-group mt-3">
                  <label className="payment-field-label">NOTA (OPCIONAL)</label>
                  <div className="payment-textarea-wrap">
                    <textarea
                      className="payment-field-textarea"
                      placeholder="Ej. Pago por Yape"
                      value={paymentNote}
                      onChange={(e) => setPaymentNote(e.target.value.slice(0, 120))}
                      rows={2}
                    />
                    <span className="payment-counter-bottom">{paymentNote.length}/120</span>
                  </div>
                </div>

                {selectedPaymentTab === 'split' && (
                  <div className="payment-breakdown-card mt-3">
                    <span className="breakdown-card-title">Desglose de pago</span>
                    <div className="breakdown-rows-list">
                      <div className="breakdown-row-item">
                        <span className="row-item-left">
                          1. {SPLIT_PAYMENT_METHODS.find(method => method.method === splitPrimaryMethod)?.icon}{' '}
                          {SPLIT_PAYMENT_METHODS.find(method => method.method === splitPrimaryMethod)?.label}
                        </span>
                        <MoneyWithBcv
                          usd={splitPrimaryAmountUsd}
                          rate={bcvRate}
                          primaryCurrency={usesBolivares(splitPrimaryMethod) ? 'VES' : 'USD'}
                          className="row-item-val"
                          compact
                        />
                      </div>
                      <div className="breakdown-row-item">
                        <span className="row-item-left">
                          2. {SPLIT_PAYMENT_METHODS.find(method => method.method === splitSecondaryMethod)?.icon}{' '}
                          {SPLIT_PAYMENT_METHODS.find(method => method.method === splitSecondaryMethod)?.label}
                        </span>
                        <MoneyWithBcv
                          usd={Math.max(total - splitPrimaryAmountUsd, 0)}
                          rate={bcvRate}
                          primaryCurrency={usesBolivares(splitSecondaryMethod) ? 'VES' : 'USD'}
                          className="row-item-val"
                          compact
                        />
                      </div>
                    </div>
                  </div>
                )}

                {payError && <p className="pay-error" role="alert">{payError}</p>}
              </div>

              {/* Right Column: Order Summary */}
              <div className="payment-body-right">
                <div className="order-summary-box">
                  <h3 className="summary-box-title">Resumen del pedido</h3>

                  <div className="summary-box-lines mt-3">
                    <div className="summary-box-line">
                      <span>Subtotal</span>
                      <MoneyWithBcv usd={subtotal} usdClassName="font-bold" compact />
                    </div>
                    <div className="summary-box-line">
                      <span>Descuento</span>
                      <MoneyWithBcv usd={0} usdClassName="font-bold" compact />
                    </div>

                    <div className="summary-box-total-line mt-3">
                      <span className="summary-total-label">Total</span>
                      <MoneyWithBcv usd={total} className="summary-total-val" />
                    </div>
                  </div>

                  {/* Customer field */}
                  <div className="summary-box-customer mt-4">
                    <span className="customer-box-label">Cliente</span>
                    <div className="customer-box-card">
                      <span className="customer-box-name">👤 {customerName || 'Cliente general'}</span>
                      <button className="customer-edit-btn">✏️</button>
                    </div>
                  </div>

                  {/* Info Notice */}
                  <div className="payment-security-notice mt-4">
                    <ShieldCheck size={16} className="text-green flex-shrink-0" />
                    <span>Los pagos combinados se registrarán en la factura correctamente.</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Footer Actions */}
            <div className="payment-modal-footer">
              <button className="btn-confirm-payment-red" onClick={handleConfirmPayment} disabled={paying}>
                <CheckCircle size={18} /> Confirmar pago
              </button>
              <button className="btn-modal-action-dark" onClick={handlePrintReceipt}>
                <Printer size={18} /> Imprimir recibo
              </button>
              <button className="btn-modal-action-ghost" onClick={() => setShowPaymentModal(false)}>
                <X size={18} /> Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Nuevo Cliente desde Caja */}
      {showNewClientModal && (
        <div className="modal-overlay-dark" onClick={() => !creatingCustomer && setShowNewClientModal(false)}>
          <div className="client-modal-box animate-pop" role="dialog" aria-modal="true" aria-labelledby="new-client-title" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header-line">
              <div>
                <span className="client-modal-eyebrow">Directorio de clientes</span>
                <h3 className="modal-title" id="new-client-title">Nuevo cliente</h3>
                <p className="modal-sub-desc">Registra un nuevo cliente en el sistema</p>
              </div>
              <button type="button" className="modal-close-btn" aria-label="Cerrar ventana" disabled={creatingCustomer} onClick={() => setShowNewClientModal(false)}><X size={18} /></button>
            </div>

            <form onSubmit={handleCreateNewClientFromCaja} className="crm-form mt-3">
              <div className="field">
                <label className="field-label-white">Nombre *</label>
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
                <label className="field-label-white">Cédula / RIF <span className="field-optional">Opcional</span></label>
                <div className="input-with-icon-wrap">
                  <IdCard size={16} className="input-left-icon" />
                  <input
                    type="text"
                    inputMode="text"
                    autoComplete="off"
                    placeholder="Ej. V-12345678"
                    value={newClientIdentification}
                    onChange={(e) => setNewClientIdentification(e.target.value)}
                    className="modal-input-dark with-left-icon"
                    maxLength={24}
                  />
                </div>
              </div>

              <div className="field mt-3">
                <label className="field-label-white">Teléfono</label>
                <div className="input-with-icon-wrap">
                  <Phone size={16} className="input-left-icon" />
                  <input
                    type="tel"
                    placeholder="04129206984"
                    value={newClientPhone}
                    onChange={(e) => setNewClientPhone(e.target.value)}
                    className="modal-input-dark with-left-icon"
                  />
                </div>
              </div>

              <div className="field mt-3">
                <label className="field-label-white">Dirección <span className="field-optional">Opcional</span></label>
                <div className="input-with-icon-wrap input-with-icon-textarea">
                  <MapPin size={16} className="input-left-icon" />
                  <textarea
                    placeholder="Dirección y punto de referencia"
                    value={newClientAddress}
                    onChange={(e) => setNewClientAddress(e.target.value)}
                    className="modal-input-dark modal-textarea-dark with-left-icon"
                    maxLength={300}
                    rows={3}
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
                      onChange={(e) => {
                        const nextMonth = e.target.value
                        setBirthMonth(nextMonth)
                        if (birthDay && Number(birthDay) > getDaysInBirthMonth(nextMonth)) setBirthDay('')
                      }}
                    >
                      <option value="">Mes</option>
                      {BIRTH_MONTHS.map((month, index) => (
                        <option key={month} value={String(index + 1).padStart(2, '0')}>{month}</option>
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
                      <option value="">Día</option>
                      {Array.from({ length: getDaysInBirthMonth(birthMonth) }, (_, i) => i + 1).map((d) => (
                        <option key={d} value={d}>{d}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <span className="birthday-hint mt-1">
                  Solo para promociones y recordatorios
                </span>
              </div>

              {customerCreateError && <div className="client-modal-error" role="alert">{customerCreateError}</div>}

              <div className="modal-actions-row-right mt-4">
                <button type="button" className="btn-modal-cancel" disabled={creatingCustomer} onClick={() => setShowNewClientModal(false)}>
                  Cancelar
                </button>
                <button type="submit" className="btn-modal-submit-red" disabled={creatingCustomer}>
                  {creatingCustomer ? 'Guardando…' : 'Guardar cliente'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
