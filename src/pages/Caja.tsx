import { useState, useMemo, useEffect, useCallback, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/auth-context'
import { useRates } from '../context/rates-context'
import { MoneyWithBcv } from '../components/MoneyWithBcv'
import { PaymentMethodSelect } from '../components/PaymentMethodSelect'
import { StyledSelect } from '../components/StyledSelect'
import Toast from '../components/Toast'
import { downloadReceipt } from '../lib/receipt'
import { formatRateDate, formatUsd, formatVes } from '../lib/money'
import { groupMenuProducts, type MenuProductGroup } from '../lib/menuGrouping'
import { classifyMenuCategory, categoryLabel, menuCategoryKeys, isKnownCategory, hydrateMenuCategories } from '../lib/menuCategories'
import { defaultPaymentForOrderType, type OrderType } from '../lib/orderDefaults'
import {
  getProducts,
  getTodayOrders,
  getTopSellingProducts,
  getActiveCashSession,
  checkout,
  sendToKitchen,
  getCustomers,
  createCustomer,
  getProductModifiers,
  getAllProductModifiers,
  getOccupiedTables,
  getMenuCategories,
  getFinancialAccounts,
  type Product,
  type CartItem,
  type OrderResult,
  type TodayOrder,
  type PaymentMethod,
  type CashSessionSnapshot,
  type ProductModifierGroup,
  type SelectedModifier,
  type FinancialAccount,
} from '../lib/dataService'
import {
  X,
  Check,
  Printer,
  CheckCircle,
  CheckCircle2,
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
  Pencil,
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
  RefreshCw,
  Circle,
  User,
} from 'lucide-react'
import './Caja.css'
import { formatProductTitle, formatSpanishText, normalizeForSearch } from '../lib/textFormat'

const BIRTH_MONTHS = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
] as const
const getDaysInBirthMonth = (month: string) => month ? new Date(2000, Number(month), 0).getDate() : 31

const TABLE_COUNT = 10

const ORDER_TYPE_LABELS: Record<OrderType, { label: string; icon: ReactNode }> = {
  'dine-in': { label: 'Mesa', icon: <UtensilsCrossed size={18} strokeWidth={1.8} /> },
  takeaway: { label: 'Para llevar', icon: <TakeawayBag size={18} strokeWidth={1.8} /> },
  delivery: { label: 'Delivery', icon: <Bike size={18} strokeWidth={1.8} /> },
}

const PAYMENT_DETAILS: Record<PaymentMethod | 'split', { label: string; desc: string; icon: ReactNode }> = {
  card: { label: 'Punto de venta', desc: 'Tarjeta de débito o crédito', icon: <CreditCard size={16} strokeWidth={1.8} /> },
  mobile: { label: 'Pago móvil', desc: 'Transferencia móvil inmediata', icon: <Smartphone size={16} strokeWidth={1.8} /> },
  cash: { label: 'Efectivo', desc: 'Dólares o bolívares en efectivo', icon: <Banknote size={16} strokeWidth={1.8} /> },
  transfer: { label: 'Transferencia', desc: 'Transferencia bancaria', icon: <Landmark size={16} strokeWidth={1.8} /> },
  binance: { label: 'Binance Pay', desc: 'Pago en cripto USDT', icon: <Hexagon size={16} strokeWidth={1.8} /> },
  zelle: { label: 'Zelle', desc: 'Transferencia en dólares', icon: <BadgeDollarSign size={16} strokeWidth={1.8} /> },
  split: { label: 'Pago combinado', desc: 'Cobrar con dos métodos', icon: <Split size={16} strokeWidth={1.8} /> },
  other: { label: 'Otro método', desc: 'Método especial', icon: <CreditCard size={16} strokeWidth={1.8} /> },
}

const PAYMENT_METHODS: Array<{ method: PaymentMethod | 'split'; label: string; icon: ReactNode }> = [
  { method: 'cash', label: 'Efectivo', icon: <Banknote size={16} strokeWidth={1.8} /> },
  { method: 'mobile', label: 'Pago móvil', icon: <Smartphone size={16} strokeWidth={1.8} /> },
  { method: 'card', label: 'Punto', icon: <CreditCard size={16} strokeWidth={1.8} /> },
  { method: 'transfer', label: 'Transferencia', icon: <Landmark size={16} strokeWidth={1.8} /> },
  { method: 'binance', label: 'Binance', icon: <Hexagon size={16} strokeWidth={1.8} /> },
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
  arroz: '/optimized/productos/M1.webp',
  noodles: '/optimized/productos/M2.webp',
  lumpia: '/optimized/productos/M13.webp',
  combo: '/optimized/productos/M53.webp',
  proteina: '/optimized/productos/M3.webp',
  bebida: '/optimized/productos/M16.webp',
  extra: '/optimized/productos/M4.webp',
  default: '/optimized/productos/M1.webp'
}

function getProductImage(product: Product): string {
  if (product.imageUrl) {
    const match = product.imageUrl.match(/^\/productos\/([^/?#]+)\.(?:png|jpe?g|webp)([?#].*)?$/i)
    return match ? `/optimized/productos/${match[1]}.webp${match[2] || ''}` : product.imageUrl
  }
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
const CAJA_PRODUCTS_CACHE_KEY = 'fullchina:caja-products:v1'
const CAJA_DRAFT_KEY = 'fullchina:caja-draft:v1'

function readCajaDraft(): { cart?: CartItem[]; orderType?: OrderType; tableNumber?: number | null; deliveryFee?: string; customerName?: string; orderNotes?: string } | null {
  try { return JSON.parse(localStorage.getItem(CAJA_DRAFT_KEY) || 'null') as ReturnType<typeof readCajaDraft> } catch { return null }
}

let cajaCache: {
  products: Product[]
  todayOrders: TodayOrder[]
} | null = null

function readCachedProducts(): Product[] {
  if (cajaCache?.products.length) return cajaCache.products
  try {
    const parsed = JSON.parse(localStorage.getItem(CAJA_PRODUCTS_CACHE_KEY) || 'null') as { products?: Product[] } | null
    return Array.isArray(parsed?.products) ? parsed.products : []
  } catch {
    return []
  }
}

function cacheProducts(products: Product[]) {
  cajaCache = { products, todayOrders: cajaCache?.todayOrders ?? [] }
  try {
    localStorage.setItem(CAJA_PRODUCTS_CACHE_KEY, JSON.stringify({ products, savedAt: Date.now() }))
  } catch {
    // El catálogo sigue disponible en memoria cuando el almacenamiento está bloqueado o lleno.
  }
}

interface CustomerOption {
  id: string
  name: string
  initials: string
  phone: string
}

interface CajaProps {
  embedded?: boolean
  onClose?: () => void
  onOrderCreated?: () => void
}

export function Caja({ embedded = false, onClose, onOrderCreated }: CajaProps = {}) {
  const { user } = useAuth()
  const { bcvRate, updatedAt: bcvUpdatedAt, stale: bcvStale, error: bcvError, loading: bcvLoading, refresh: refreshBcv } = useRates()
  const navigate = useNavigate()
  const location = useLocation()

  const [products, setProducts] = useState<Product[]>(readCachedProducts)
  const [, setTodayOrders] = useState<TodayOrder[]>(cajaCache?.todayOrders ?? [])
  const [loading, setLoading] = useState(!cajaCache)
  const [productsError, setProductsError] = useState('')
  const [salesRank, setSalesRank] = useState<Map<string, number>>(new Map())

  const draft = useMemo(readCajaDraft, [])
  const [cart, setCart] = useState<CartItem[]>(() => draft?.cart ?? [])
  const [productsWithModifiers, setProductsWithModifiers] = useState<Set<string>>(new Set())
  // Selector de modificadores
  const [modifierProduct, setModifierProduct] = useState<Product | null>(null)
  const [closingModifier, setClosingModifier] = useState(false)
  const [modifierGroups, setModifierGroups] = useState<ProductModifierGroup[]>([])
  const [modifierSelections, setModifierSelections] = useState<Record<string, Record<string, number>>>({})
  const [modifierLoading, setModifierLoading] = useState(false)
  const [modifierError, setModifierError] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [activeCategory, setActiveCategory] = useState<string>('all')
  const [sortBy, setSortBy] = useState<'popular' | 'price' | 'name'>('name')
  const [selectedProductGroup, setSelectedProductGroup] = useState<MenuProductGroup | null>(null)
  const [closingProductGroup, setClosingProductGroup] = useState(false)

  const [orderType, setOrderType] = useState<OrderType>(() => draft?.orderType ?? 'dine-in')
  const [tableNumber, setTableNumber] = useState<number | null>(() => draft?.tableNumber ?? null)
  const [occupiedTables, setOccupiedTables] = useState<Set<number>>(new Set())
  const [deliveryFee, setDeliveryFee] = useState(() => draft?.deliveryFee ?? '')
  const [customerName, setCustomerName] = useState(() => draft?.customerName ?? '')
  const [orderNotes, setOrderNotes] = useState(() => draft?.orderNotes ?? '')

  useEffect(() => {
    if (cart.length === 0 && !customerName && !orderNotes && !deliveryFee) {
      localStorage.removeItem(CAJA_DRAFT_KEY)
      return
    }
    localStorage.setItem(CAJA_DRAFT_KEY, JSON.stringify({ cart, orderType, tableNumber, deliveryFee, customerName, orderNotes }))
  }, [cart, orderType, tableNumber, deliveryFee, customerName, orderNotes])

  // Customer Search & Auto-complete state
  const [customerList, setCustomerList] = useState<CustomerOption[]>([])
  const customersRequested = useRef(false)
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false)
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerOption | null>(null)

  // New Client Modal state
  const [showNewClientModal, setShowNewClientModal] = useState(false)
  const [closingNewClient, setClosingNewClient] = useState(false)
  const [newClientName, setNewClientName] = useState('')
  const [newClientLastName, setNewClientLastName] = useState('')
  const [newClientIdentification, setNewClientIdentification] = useState('')
  const [newClientPhone, setNewClientPhone] = useState('')
  const [newClientAddress, setNewClientAddress] = useState('')
  const [birthMonth, setBirthMonth] = useState('')
  const [birthDay, setBirthDay] = useState('')
  const [creatingCustomer, setCreatingCustomer] = useState(false)
  const [customerCreateError, setCustomerCreateError] = useState('')
  const [bcvSuccessToast, setBcvSuccessToast] = useState('')

  const filteredCustomers = useMemo(() => {
    if (!customerName.trim()) return customerList
    const q = normalizeForSearch(customerName)
    return customerList.filter(c =>
      normalizeForSearch(c.name).includes(q) ||
      c.phone.includes(customerName)
    )
  }, [customerList, customerName])

  const loadCustomers = useCallback(() => {
    if (customersRequested.current) return
    customersRequested.current = true
    getCustomers().then(customers => setCustomerList(customers.map(customer => ({
      id: customer.id,
      name: customer.name,
      initials: customer.name.split(' ').slice(0, 2).map(part => part[0] || '').join('').toUpperCase(),
      phone: customer.phone,
    })))).catch(error => {
      customersRequested.current = false
      console.error('getCustomers error:', error)
    })
  }, [])

  useEffect(() => {
    const timer = window.setTimeout(loadCustomers, 1500)
    return () => window.clearTimeout(timer)
  }, [loadCustomers])

  // Cliente pre-seleccionado al venir desde el perfil de un cliente ("Nuevo pedido"),
  // o mesa pre-seleccionada al venir desde el mapa de Mesas.
  useEffect(() => {
    const incoming = location.state as { customerName?: string; tableNumber?: number } | null
    if (incoming?.customerName) {
      setCustomerName(incoming.customerName)
    }
    if (incoming?.tableNumber) {
      setOrderType('dine-in')
      setTableNumber(incoming.tableNumber)
      setSelectedPaymentTab(defaultPaymentForOrderType('dine-in'))
    }
    if (incoming) {
      // Limpiar el state para que no reaparezca al refrescar o volver.
      navigate(location.pathname, { replace: true, state: null })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const closeNewClientModal = (then?: () => void) => {
    if (!showNewClientModal || closingNewClient) return
    setClosingNewClient(true)
    window.setTimeout(() => {
      setShowNewClientModal(false)
      setClosingNewClient(false)
      then?.()
    }, 200)
  }

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
      setSelectedCustomer(newCust)
      setShowCustomerDropdown(false)
      closeNewClientModal()
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
  const [closingPayment, setClosingPayment] = useState(false)
  const [selectedPaymentTab, setSelectedPaymentTab] = useState<PaymentMethod | 'split'>(defaultPaymentForOrderType('dine-in'))
  const [refNumber, setRefNumber] = useState('')
  const [extraRefs, setExtraRefs] = useState<string[]>([])
  const [amountReceived, setAmountReceived] = useState('0.00')
  const [splitPrimaryMethod, setSplitPrimaryMethod] = useState<SplitPaymentMethod>('cash')
  const [splitSecondaryMethod, setSplitSecondaryMethod] = useState<SplitPaymentMethod>('mobile')
  const [splitPrimaryReference, setSplitPrimaryReference] = useState('')
  const [splitSecondaryReference, setSplitSecondaryReference] = useState('')
  const [splitPrimaryExtraRefs, setSplitPrimaryExtraRefs] = useState<string[]>([])
  const [splitSecondaryExtraRefs, setSplitSecondaryExtraRefs] = useState<string[]>([])
  const [paymentNote, setPaymentNote] = useState('')
  const [financialAccounts, setFinancialAccounts] = useState<FinancialAccount[]>([])
  const [paymentAccountId, setPaymentAccountId] = useState('')
  const [splitPrimaryAccountId, setSplitPrimaryAccountId] = useState('')
  const [splitSecondaryAccountId, setSplitSecondaryAccountId] = useState('')

  const [paying, setPaying] = useState(false)
  const [cashCurrency, setCashCurrency] = useState<'USD' | 'VES'>('USD')
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

  const refreshSalesRank = useCallback(async () => {
    try {
      setSalesRank(await getTopSellingProducts())
    } catch (e) {
      console.error('refreshSalesRank error:', e)
    }
  }, [])

  const refreshOccupiedTables = useCallback(async () => {
    try {
      setOccupiedTables(new Set(await getOccupiedTables()))
    } catch (e) {
      console.error('getOccupiedTables error:', e)
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    setLoading(true)

    // El catálogo es la ruta crítica: se pinta desde caché y se refresca sin
    // esperar comandas, categorías ni modificadores.
    getProducts()
      .then((prods) => {
        if (cancelled) return
        setProductsError('')
        setProducts(prods)
        cacheProducts(prods)
      })
      .catch((e) => {
        console.error('getProducts error:', e)
        if (!cancelled) setProductsError('No se pudo cargar el menú. Revisa la conexión e inténtalo de nuevo.')
      })
      .finally(() => { if (!cancelled) setLoading(false) })

    void getTodayOrders()
      .then((orders) => {
        if (cancelled) return
        setTodayOrders(orders)
        cajaCache = { products: cajaCache?.products ?? readCachedProducts(), todayOrders: orders }
      })
      .catch((e) => console.error('getTodayOrders error:', e))
    void getAllProductModifiers().then((modMap) => {
      if (!cancelled) setProductsWithModifiers(new Set(modMap.keys()))
    }).catch((e) => console.error('getAllProductModifiers error:', e))
    void getMenuCategories().then((cats) => {
      if (!cancelled && cats.length) hydrateMenuCategories(cats)
    }).catch((e) => console.error('getMenuCategories error:', e))
    void refreshOccupiedTables()
    void getTopSellingProducts().then((rank) => {
      if (!cancelled) setSalesRank(rank)
    }).catch((e) => console.error('getTopSellingProducts error:', e))
    return () => { cancelled = true }
  }, [refreshOccupiedTables])

  useEffect(() => {
    getActiveCashSession()
      .then(setCashSession)
      .catch(() => setCashSession(null))
  }, [])

  useEffect(() => {
    getFinancialAccounts().then(setFinancialAccounts).catch(() => setFinancialAccounts([]))
  }, [])

  const accountsForMethod = (method: SplitPaymentMethod) => {
    const paymentAccounts = financialAccounts.filter((account) => account.acceptsCustomerPayments)
    if (method === 'cash') return paymentAccounts.filter((a) => a.accountType === 'cash' && a.currency === cashCurrency)
    if (method === 'mobile') return paymentAccounts
      .filter((a) => a.currency === 'VES' && a.accountType === 'bank' && ['Banco Exterior', 'Banesco'].includes(a.name))
      .sort((a, b) => Number(b.name === 'Banco Exterior') - Number(a.name === 'Banco Exterior'))
    if (method === 'transfer') return paymentAccounts.filter((a) => a.currency === 'VES' && a.accountType === 'bank')
    if (method === 'card') return paymentAccounts.filter((a) => a.currency === 'VES' && a.name === 'Banesco')
    if (method === 'zelle' || method === 'binance') return paymentAccounts.filter((a) => a.currency === 'USD' && ['bank', 'digital'].includes(a.accountType))
    return paymentAccounts
  }

  const ensureAccountForMethod = (method: SplitPaymentMethod) => {
    const options = accountsForMethod(method)
    return options[0]?.id ?? ''
  }

  // Respeta la categoría guardada si ya es válida; si no, la deduce por nombre.
  const resolveCat = useCallback((product: Product) =>
    product.category !== 'otros' && isKnownCategory(product.category)
      ? product.category
      : classifyMenuCategory(product.name, product.category), [])
  // Conjunto completo de categorías de un plato (principal resuelta + adicionales).
  const resolveCats = useCallback((product: Product): string[] => {
    const primary = resolveCat(product)
    const extras = product.categories.filter((c) => c !== product.category)
    return Array.from(new Set([primary, ...extras]))
  }, [resolveCat])

  const categories = useMemo(() => {
    const present = new Set(products.flatMap((p) => resolveCats(p)))
    return menuCategoryKeys().filter((c) => present.has(c))
  }, [products, resolveCats])

  const filteredProductGroups = useMemo(() => {
    const categoryProducts = products.filter((product) => {
      const matchCat = activeCategory === 'all' || resolveCats(product).includes(activeCategory)
      return matchCat && product.active
    })
    let result = groupMenuProducts(categoryProducts)
    const query = normalizeForSearch(searchTerm)
    if (query) {
      result = result.filter(group =>
        normalizeForSearch(group.name).includes(query) ||
        group.variants.some(({ product, label }) =>
          normalizeForSearch(label).includes(query) ||
          normalizeForSearch(product.name).includes(query) ||
          (product.description && normalizeForSearch(product.description).includes(query))
        )
      )
    }
    if (sortBy === 'popular' && salesRank.size > 0) {
      result = [...result].sort((a, b) => {
        const aCount = a.variants.reduce((sum, v) => sum + (salesRank.get(v.product.id) ?? 0), 0)
        const bCount = b.variants.reduce((sum, v) => sum + (salesRank.get(v.product.id) ?? 0), 0)
        return bCount - aCount
      })
    } else if (sortBy === 'price') {
      result = [...result].sort((a, b) => a.minPrice - b.minPrice)
    } else if (sortBy === 'name') {
      result = [...result].sort((a, b) => a.name.localeCompare(b.name))
    }
    return result
  }, [products, searchTerm, activeCategory, sortBy, salesRank, resolveCats])

    // Top 5 productos más vendidos hoy (para rank 1-5)
    const topProductRanks = useMemo(() => {
      if (salesRank.size === 0) return new Map<string, number>()
      const ranked = filteredProductGroups
        .map(g => ({
          key: g.key,
          count: g.variants.reduce((sum, v) => sum + (salesRank.get(v.product.id) ?? 0), 0),
        }))
        .filter(r => r.count > 0)
        .sort((a, b) => b.count - a.count)
        .slice(0, 5)
      
      const ranksMap = new Map<string, number>()
      ranked.forEach((r, idx) => ranksMap.set(r.key, idx + 1))
      return ranksMap
    }, [filteredProductGroups, salesRank])


  const genLineId = () =>
    (typeof crypto !== 'undefined' && crypto.randomUUID)
      ? crypto.randomUUID()
      : `l_${Date.now()}_${Math.random().toString(36).slice(2)}`

  const addToCart = (product: Product) => {
    if (productsWithModifiers.has(product.id)) {
      void openModifierPicker(product)
      return
    }
    setCart((prev) => {
      const existing = prev.find((i) => i.productId === product.id && (!i.selectedModifiers || i.selectedModifiers.length === 0))
      if (existing) return prev.map((i) => i === existing ? { ...i, quantity: i.quantity + 1 } : i)
      return [...prev, { lineId: genLineId(), productId: product.id, productName: formatProductTitle(product.name), price: product.price, quantity: 1, emoji: product.emoji }]
    })
  }

  const updateQty = (lineId: string, delta: number) => {
    setCart((prev) => prev.map((i) => i.lineId === lineId ? { ...i, quantity: i.quantity + delta } : i).filter((i) => i.quantity > 0))
  }

  const removeFromCart = (lineId: string) => {
    setCart((prev) => prev.filter((i) => i.lineId !== lineId))
  }

  // --- Selector de modificadores ---
  const openModifierPicker = async (product: Product) => {
    setModifierProduct(product)
    setModifierGroups([])
    setModifierSelections({})
    setModifierError('')
    setModifierLoading(true)
    try {
      const groups = await getProductModifiers(product.id)
      setModifierGroups(groups)
      const init: Record<string, Record<string, number>> = {}
      for (const g of groups) {
        init[g.modifierId] = {}
        // Grupo obligatorio de selección única: preselecciona la primera opción.
        if (g.minSelections >= 1 && g.maxSelections === 1 && g.options.length > 0) {
          init[g.modifierId][g.options[0].id] = 1
        }
      }
      setModifierSelections(init)
    } catch (e) {
      setModifierError(e instanceof Error ? e.message : 'No se pudieron cargar los modificadores')
    } finally {
      setModifierLoading(false)
    }
  }

  const closeModifierPicker = (then?: () => void) => {
    if (!modifierProduct || closingModifier) return
    setClosingModifier(true)
    window.setTimeout(() => {
      setModifierProduct(null)
      setModifierGroups([])
      setModifierSelections({})
      setModifierError('')
      setClosingModifier(false)
      then?.()
    }, 200)
  }

  const toggleModifierOption = (group: ProductModifierGroup, optionId: string) => {
    setModifierError('')
    setModifierSelections((prev) => {
      const groupSel = { ...(prev[group.modifierId] ?? {}) }
      if (group.maxSelections === 1) {
        return { ...prev, [group.modifierId]: { [optionId]: 1 } }
      }
      const current = groupSel[optionId] ?? 0
      const totalSelected = Object.values(groupSel).reduce((s, n) => s + n, 0)
      if (current > 0 && !group.allowRepeat) {
        delete groupSel[optionId]
      } else {
        if (group.maxSelections != null && totalSelected >= group.maxSelections) return prev
        groupSel[optionId] = group.allowRepeat ? current + 1 : 1
      }
      return { ...prev, [group.modifierId]: groupSel }
    })
  }

  const modifierExtraPrice = useMemo(() => {
    let extra = 0
    for (const g of modifierGroups) {
      const sel = modifierSelections[g.modifierId] ?? {}
      for (const [optId, qty] of Object.entries(sel)) {
        const opt = g.options.find((o) => o.id === optId)
        if (opt) extra += opt.price * qty
      }
    }
    return extra
  }, [modifierGroups, modifierSelections])

  const confirmModifierSelection = () => {
    if (!modifierProduct) return
    for (const g of modifierGroups) {
      const sel = modifierSelections[g.modifierId] ?? {}
      const count = Object.values(sel).reduce((s, n) => s + n, 0)
      if (count < g.minSelections) {
        setModifierError(`Elige al menos ${g.minSelections} en "${g.name}"`)
        return
      }
      if (g.maxSelections != null && count > g.maxSelections) {
        setModifierError(`Máximo ${g.maxSelections} en "${g.name}"`)
        return
      }
    }
    const selected: SelectedModifier[] = []
    for (const g of modifierGroups) {
      const sel = modifierSelections[g.modifierId] ?? {}
      for (const [optId, qty] of Object.entries(sel)) {
        if (qty <= 0) continue
        const opt = g.options.find((o) => o.id === optId)
        if (opt) selected.push({ optionId: optId, optionName: opt.name, modifierName: g.name, price: opt.price, quantity: qty })
      }
    }
    setCart((prev) => [...prev, {
      lineId: genLineId(),
      productId: modifierProduct.id,
      productName: formatProductTitle(modifierProduct.name),
      price: modifierProduct.price + modifierExtraPrice,
      quantity: 1,
      emoji: modifierProduct.emoji,
      selectedModifiers: selected,
    }])
    closeModifierPicker()
  }

  const subtotal = cart.reduce((s, i) => s + i.price * i.quantity, 0)
  const deliveryFeeUsd = orderType === 'delivery' ? Math.max(0, parseFloat(deliveryFee.replace(',', '.')) || 0) : 0
  const total = subtotal + deliveryFeeUsd
  const splitPrimaryAmountUsd = paymentInputToUsd(amountReceived, splitPrimaryMethod, bcvRate)

  // Action 1: Enviar a Cocina -> Saves order WITHOUT payment and navigates to /comandas
  const handleSendToKitchen = async () => {
    if (cart.length === 0) return
    if (orderType === 'dine-in' && !tableNumber) {
      setPayError('Selecciona el número de mesa')
      return
    }
    setPaying(true)
    setPayError('')
    try {
      const order = await sendToKitchen({
        items: cart,
        bcvRate,
        userId: user!.id,
        notes: orderNotes || null,
        orderType,
        tableNumber,
        customerName: customerName || 'Cliente general',
        deliveryFee: deliveryFeeUsd,
      })
      setCurrentOrder(order)
      setCart([])
      setCustomerName('')
      setSelectedCustomer(null)
      setOrderNotes('')
      setDeliveryFee('')
      setTableNumber(null)
      refreshTodayOrders()
      refreshSalesRank()
      refreshOccupiedTables()
      onOrderCreated?.()
      if (embedded) onClose?.()
      else navigate('/comandas')
    } catch (e) {
      setPayError(e instanceof Error ? e.message : 'Error al enviar a cocina')
    } finally {
      setPaying(false)
    }
  }

  // Open Payment Modal (Image 1)
  const handleOpenPaymentModal = async (preferredMethod: PaymentMethod | 'split' = 'cash') => {
    if (cart.length === 0) return
    if (orderType === 'dine-in' && !tableNumber) {
      setPayError('Selecciona el número de mesa')
      return
    }
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
    setExtraRefs([])
    const initialMethod: SplitPaymentMethod = preferredMethod === 'split' || preferredMethod === 'other' ? 'cash' : preferredMethod
    setAmountReceived(usdToPaymentInput(preferredMethod === 'split' ? total / 2 : total, initialMethod, bcvRate))
    setSplitPrimaryMethod('cash')
    setSplitSecondaryMethod('mobile')
    setSplitPrimaryReference('')
    setSplitSecondaryReference('')
    setSplitPrimaryExtraRefs([])
    setSplitSecondaryExtraRefs([])
    setPaymentAccountId(initialMethod === 'cash' ? ensureAccountForMethod(cashCurrency === 'USD' ? 'cash' : 'cash') : ensureAccountForMethod(initialMethod))
    setSplitPrimaryAccountId(ensureAccountForMethod('cash'))
    setSplitSecondaryAccountId(ensureAccountForMethod('mobile'))
    setPaymentNote('')
    setPayError('')
    setShowPaymentModal(true)
  }

  const closePaymentModal = (then?: () => void) => {
    if (!showPaymentModal || closingPayment) return
    setClosingPayment(true)
    window.setTimeout(() => {
      setShowPaymentModal(false)
      setClosingPayment(false)
      then?.()
    }, 200)
  }

  const selectMenuGroup = (group: MenuProductGroup) => {
    if (group.isGrouped) setSelectedProductGroup(group)
    else addToCart(group.variants[0].product)
  }

  const closeProductGroupModal = (then?: () => void) => {
    if (!selectedProductGroup || closingProductGroup) return
    setClosingProductGroup(true)
    window.setTimeout(() => {
      setSelectedProductGroup(null)
      setClosingProductGroup(false)
      then?.()
    }, 200)
  }

  const addVariantToCart = (product: Product) => {
    addToCart(product)
    closeProductGroupModal()
  }

  const handleSelectPaymentTab = (method: PaymentMethod | 'split') => {
    setSelectedPaymentTab(method)
    setRefNumber('')
    setExtraRefs([])
    setSplitPrimaryReference('')
    setSplitSecondaryReference('')
    setSplitPrimaryExtraRefs([])
    setSplitSecondaryExtraRefs([])
    const inputMethod: SplitPaymentMethod = method === 'split' ? 'cash' : method === 'other' ? 'cash' : method
    if (method === 'split') {
      setSplitPrimaryAccountId(ensureAccountForMethod(splitPrimaryMethod))
      setSplitSecondaryAccountId(ensureAccountForMethod(splitSecondaryMethod))
    } else {
      setPaymentAccountId(ensureAccountForMethod(inputMethod))
    }
    setPayError('')
    setAmountReceived(usdToPaymentInput(method === 'split' ? total / 2 : total, inputMethod, bcvRate))
  }

  // Confirm Payment in Modal -> Triggers Confirmation Screen (Image 2)
  const handleConfirmPayment = async () => {
    setPaying(true)
    setPayError('')
    try {
      // Re-validar que la caja sigue abierta antes de procesar el pago
      const activeSession = await getActiveCashSession()
      if (!activeSession) {
        throw new Error('La caja se cerró. Abre la caja nuevamente para cobrar.')
      }
      setCashSession(activeSession)

      const enteredAmountRaw = Number(amountReceived)
      if (!Number.isFinite(enteredAmountRaw) || enteredAmountRaw <= 0) {
        throw new Error('Ingresa un monto válido')
      }
      const enteredAmount = (selectedPaymentTab === 'cash' && cashCurrency === 'VES' && bcvRate && bcvRate > 0)
        ? enteredAmountRaw / bcvRate
        : enteredAmountRaw

      const requiresReference = selectedPaymentTab !== 'split'
        && selectedPaymentTab !== 'other'
        && requiresPaymentReference(selectedPaymentTab)
      if (requiresReference && !refNumber.trim()) {
        throw new Error('La referencia es obligatoria para este método')
      }
      if (selectedPaymentTab !== 'split' && selectedPaymentTab !== 'other' && !paymentAccountId) {
        throw new Error('Selecciona la cuenta donde ingresó el dinero')
      }
      const combinedRefs = [refNumber, ...extraRefs].map(r => r.trim()).filter(Boolean).join(', ')

      let paymentComponents
      let finalMethod: PaymentMethod
      if (selectedPaymentTab === 'split') {
        const totalCents = Math.round(total * 100)
        const primaryCents = Math.round(splitPrimaryAmountUsd * 100)
        const primaryAmount = primaryCents / 100
        const secondaryAmount = (totalCents - primaryCents) / 100
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
        if (!splitPrimaryAccountId || !splitSecondaryAccountId) {
          throw new Error('Selecciona la cuenta de cada método de pago')
        }
        finalMethod = 'other'
        const primaryRefs = [splitPrimaryReference, ...splitPrimaryExtraRefs].map(r => r.trim()).filter(Boolean).join(', ')
        const secondaryRefs = [splitSecondaryReference, ...splitSecondaryExtraRefs].map(r => r.trim()).filter(Boolean).join(', ')
        paymentComponents = [
          {
            method: splitPrimaryMethod,
            amount: primaryAmount,
            referenceNumber: primaryRefs || undefined,
            accountId: splitPrimaryAccountId || null,
            receivedAmount: splitPrimaryMethod === 'cash' ? primaryAmount : undefined,
            notes: paymentNote || undefined,
          },
          {
            method: splitSecondaryMethod,
            amount: secondaryAmount,
            referenceNumber: secondaryRefs || undefined,
            accountId: splitSecondaryAccountId || null,
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
          referenceNumber: combinedRefs || undefined,
          accountId: paymentAccountId || null,
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
        tableNumber,
        customerName: customerName || 'Cliente general',
        deliveryFee: deliveryFeeUsd,
        referenceNumber: selectedPaymentTab === 'split'
          ? (splitPrimaryReference.trim() || splitSecondaryReference.trim() || null)
          : (combinedRefs || null),
        receivedAmount: selectedPaymentTab === 'cash' ? enteredAmount : null,
        payments: paymentComponents,
      })
      setCurrentOrder(order)
      closePaymentModal(() => setShowConfirmation(true))
      setTableNumber(null)
      refreshTodayOrders()
      refreshSalesRank()
      refreshOccupiedTables()
      onOrderCreated?.()
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
        paymentMethod: currentOrder.paymentMethod || 'other',
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
                : currentOrder.paymentMethod === 'other'
                  ? 'Pago combinado'
                  : 'Sin pago'

    return (
      <div className={`page animate-fade-in ${embedded ? 'caja-embedded' : ''}`}>
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
                <span className="badge-status green"><CheckCircle2 size={14} className="text-green" /> Pagado</span>
                <span className="badge-status gold"><ChefHat size={14} /> Enviado a cocina</span>
              </div>
            </div>

            {/* Action Buttons Bar */}
            <div className="success-actions-bar mt-4">
              <button
                className="btn-success-primary"
                onClick={() => { setShowConfirmation(false); setCart([]); setCurrentOrder(null); setCustomerName(''); setSelectedCustomer(null); setDeliveryFee('') }}
              >
                <span>+</span> Nueva venta
              </button>
              <button className="btn-success-secondary" onClick={() => embedded ? onClose?.() : navigate('/comandas')}>
                <ListOrdered size={16} /> Ver comanda
              </button>
              <button className="btn-success-secondary" onClick={handlePrintReceipt}>
                <Printer size={16} /> Imprimir recibo
              </button>
              <button className="btn-success-secondary" onClick={async () => {
                const text = `Pedido #${orderNo} · Total ${currentOrder ? formatUsd(currentOrder.total) : ''}`
                if (navigator.share) await navigator.share({ title: 'Comprobante Full China', text })
                else if (navigator.clipboard) await navigator.clipboard.writeText(text)
              }}>
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
                <span className="ticket-logo-icon"><Flame size={20} /></span>
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
                      <img src={imgUrl} alt={item.productName} className="ticket-item-thumb" loading="lazy" decoding="async" />
                      <div className="ticket-item-info">
                        <span className="ticket-item-name">{formatProductTitle(item.productName)}</span>
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

  const handleRefreshBcv = async () => {
    await refreshBcv()
    setBcvSuccessToast('Tasa BCV actualizada correctamente.')
  }

  return (
    <div className={`page animate-fade-in ${embedded ? 'caja-embedded' : ''}`}>
      {bcvSuccessToast && (
        <Toast
          type="success"
          message={bcvSuccessToast}
          onClose={() => setBcvSuccessToast('')}
        />
      )}
      <div className={`cash-session-strip ${cashSession ? 'open' : 'closed'}`}>
        <div className="cash-session-info">
          <span className="cash-session-title">
            <i className="cash-session-status-dot" aria-hidden="true" />
            {cashSession ? `Caja abierta · Turno #${cashSession.sessionNumber}` : 'Caja operativa sin verificar'}
          </span>
          <small className={bcvStale || bcvError ? 'bcv-warning' : ''}>
            {bcvLoading && !bcvRate
              ? 'Consultando tasa BCV…'
              : bcvRate
                ? `BCV: $1 = ${formatVes(bcvRate)} · ${bcvStale ? 'referencia guardada' : `actualizada ${formatRateDate(bcvUpdatedAt)}`}`
                : 'Tasa BCV no disponible'}
          </small>
        </div>
        <div className="cash-session-actions">
          <button type="button" className="bcv-refresh-btn" onClick={() => void handleRefreshBcv()} disabled={bcvLoading}>
            <RefreshCw size={15} className={bcvLoading ? 'is-spinning' : ''} aria-hidden="true" />
            {bcvLoading ? 'Actualizando' : 'Actualizar BCV'}
          </button>
          <button type="button" className="cash-session-primary-btn" onClick={() => navigate('/caja-operativa')}>
            <WalletCards size={15} aria-hidden="true" />
            {cashSession ? 'Ver turno' : 'Abrir caja'}
          </button>
        </div>
      </div>
      <div className="caja-layout">
        {/* LEFT: Products */}
        <div className="products-section">
          {/* Hero Wok Flame Banner */}
          <div className="caja-hero-banner">
            <div className="hero-banner-left">
              <div>
                <h1 className="page-title"><ShoppingCart size={22} className="page-title-icon" /> Nueva venta</h1>
                <p className="hero-subtitle">Crea pedidos, cobra y envía a cocina.</p>
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
                {categoryLabel(cat)}
              </button>
            ))}
          </div>

          {/* Toolbar */}
          <div className="products-toolbar">
            <div className="search-box">
              <span className="search-icon"><Search size={16} /></span>
              <input
                type="text"
                placeholder="Buscar en el menú..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="search-input-caja"
              />
              {searchTerm && (
                <button type="button" className="search-clear-btn" onClick={() => setSearchTerm('')} aria-label="Borrar búsqueda">
                  <X size={13} />
                </button>
              )}
            </div>
            <StyledSelect
              className="sort-select"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
            >
              {salesRank.size > 0 && <option value="popular">Más vendidos</option>}
              <option value="price">Precio</option>
              <option value="name">Nombre</option>
            </StyledSelect>
          </div>

          {/* Products Grid */}
          <div className="products-container grid">
            {loading && products.length === 0 ? (
              Array.from({ length: 8 }, (_, index) => <div className="product-card product-card-skeleton" key={`product-skeleton-${index}`} aria-hidden><div className="product-skeleton-image" /><div className="product-skeleton-line wide" /><div className="product-skeleton-line" /></div>)
            ) : productsError && products.length === 0 ? (
              <div className="empty-message products-load-error"><strong>{productsError}</strong><button type="button" onClick={() => window.location.reload()}>Reintentar</button></div>
            ) : filteredProductGroups.length === 0 ? (
              <p className="empty-message">No hay productos en esta categoría</p>
            ) : (
              filteredProductGroups.map((group, index) => {
                const product = group.variants[0].product
                const imgUrl = getProductImage(product)
                const rank = topProductRanks.get(group.key)
                return (
                  <div key={group.key} className={`product-card ${group.isGrouped ? 'product-family-card' : ''}`} onClick={() => selectMenuGroup(group)}>
                    <div className="product-image-area">
                      <img
                        className="product-card-image"
                        src={imgUrl}
                        alt=""
                        loading={index < 4 ? 'eager' : 'lazy'}
                        fetchPriority={index < 4 ? 'high' : 'auto'}
                        decoding="async"
                      />
                      {rank && sortBy === 'popular' && <span className="product-badge badge-popular"><strong>#{rank}</strong> Más vendido</span>}
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
                      <h3 className="product-card-title">{formatProductTitle(group.name)}</h3>
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
                      </div>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>

        {selectedProductGroup && createPortal(
          <div className={`modal-overlay-dark ${closingProductGroup ? 'closing' : ''}`} onClick={() => closeProductGroupModal()}>
            <section className="variant-selector-modal animate-pop" role="dialog" aria-modal="true" aria-labelledby="variant-selector-title" onClick={(event) => event.stopPropagation()}>
              <div className="variant-selector-header">
                <div>
                  <span className="variant-selector-eyebrow">Selecciona una presentación</span>
                  <h2 id="variant-selector-title">{formatProductTitle(selectedProductGroup.name)}</h2>
                </div>
                <button type="button" className="payment-modal-close" onClick={() => closeProductGroupModal()} aria-label="Cerrar selector">
                  <X size={18} />
                </button>
              </div>
              <div className="variant-selector-list">
                {selectedProductGroup.variants.map(({ product, label }) => {
                  const imgUrl = getProductImage(product)
                  return (
                    <button key={product.id} type="button" className="variant-option-card" onClick={() => addVariantToCart(product)}>
                      <img src={imgUrl} alt="" className="variant-option-img" />
                      <span className="variant-option-copy">
                        <strong>{label}</strong>
                        {product.description && <small>{formatSpanishText(product.description)}</small>}
                      </span>
                      <MoneyWithBcv usd={product.price} className="variant-option-price" compact />
                      <span className="variant-option-add">Agregar</span>
                    </button>
                  )
                })}
              </div>
            </section>
          </div>,
          document.body
        )}

        {modifierProduct && createPortal(
          <div className={`modal-overlay-dark ${closingModifier ? 'closing' : ''}`} onClick={() => closeModifierPicker()}>
            <section className="variant-selector-modal animate-pop" role="dialog" aria-modal="true" aria-labelledby="modifier-selector-title" onClick={(event) => event.stopPropagation()}>
              <div className="variant-selector-header">
                <div>
                  <span className="variant-selector-eyebrow">Personaliza el producto</span>
                  <h2 id="modifier-selector-title">{formatProductTitle(modifierProduct.name)}</h2>
                </div>
                <button type="button" className="payment-modal-close" onClick={() => closeModifierPicker()} aria-label="Cerrar selector">
                  <X size={18} />
                </button>
              </div>
              <div className="variant-selector-list">
                {modifierLoading && <p className="page" role="status">Cargando opciones…</p>}
                {!modifierLoading && modifierGroups.length === 0 && (
                  <p className="page" role="status">Este producto no tiene opciones configuradas.</p>
                )}
                {modifierGroups.map((group) => {
                  const sel = modifierSelections[group.modifierId] ?? {}
                  const rule = group.maxSelections === 1
                    ? (group.minSelections >= 1 ? 'Elige 1' : 'Elige 1 (opcional)')
                    : `Elige ${group.minSelections}${group.maxSelections != null ? `–${group.maxSelections}` : '+'}`
                  return (
                    <div key={group.modifierId} style={{ marginBottom: 14 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
                      <strong>{formatProductTitle(group.name)}</strong>
                        <small style={{ opacity: 0.7 }}>{rule}</small>
                      </div>
                      {group.options.map((opt) => {
                        const qty = sel[opt.id] ?? 0
                        const selected = qty > 0
                        return (
                          <button
                            key={opt.id}
                            type="button"
                            className="variant-option-card"
                            onClick={() => toggleModifierOption(group, opt.id)}
                            style={selected ? { outline: '2px solid var(--accent, #f97316)', outlineOffset: -2 } : undefined}
                          >
                            <span className="variant-option-emoji">{selected ? <CheckCircle2 size={16} /> : <Circle size={16} />}</span>
                            <span className="variant-option-copy">
                              <strong>{formatProductTitle(opt.name)}{qty > 1 ? ` ×${qty}` : ''}</strong>
                            </span>
                            {opt.price > 0
                              ? <MoneyWithBcv usd={opt.price} className="variant-option-price" compact />
                              : <span className="variant-option-price" style={{ opacity: 0.6 }}>Incluido</span>}
                            <span className="variant-option-add">{selected ? 'Quitar' : 'Elegir'}</span>
                          </button>
                        )
                      })}
                    </div>
                  )
                })}
                {modifierError && <p style={{ color: '#dc2626', margin: '4px 0' }}>{modifierError}</p>}
              </div>
              {!modifierLoading && modifierGroups.length > 0 && (
                <div className="variant-selector-footer">
                  <div className="variant-selector-total">
                    <span className="variant-selector-total-label">Total</span>
                    <MoneyWithBcv
                      usd={modifierProduct.price + modifierExtraPrice}
                      align="start"
                      className="variant-selector-total-money"
                    />
                  </div>
                  <button type="button" className="btn-primary variant-selector-cta" onClick={confirmModifierSelection}>
                    Agregar al pedido
                  </button>
                </div>
              )}
            </section>
          </div>,
          document.body
        )}

        {/* RIGHT: Cart Sidebar */}
        <div className="cart-sidebar">
          <div className="cart-sidebar-header">
            <div className="cart-order-title-group">
              <span className="cart-eyebrow">Comanda activa</span>
              <h3 className="cart-order-title">
                Pedido <span className="cart-order-number">#FC-Nuevo</span>
              </h3>
              <div className="cart-header-badges">
                <span className="cart-badge-type">{ORDER_TYPE_LABELS[orderType].label}</span>
                <span className="cart-time">{new Date().toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit' })}</span>
              </div>
            </div>
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

                  const lineKey = item.lineId ?? item.productId
                  const mods = item.selectedModifiers && item.selectedModifiers.length > 0
                    ? item.selectedModifiers.map((m) => m.optionName).join(', ')
                    : null
                  return (
                    <div key={lineKey} className="cart-item-row">
                      <img src={imgUrl} alt={item.productName} className="cart-item-thumb" loading="lazy" decoding="async" />
                      <div className="cart-item-details">
                        <span className="cart-item-name">{formatProductTitle(item.productName)}</span>
                        {mods && <span className="cart-item-sub">{mods}</span>}
                      </div>
                      <div className="cart-item-controls">
                        <button className="qty-btn-sm" aria-label={`Restar ${item.productName}`} onClick={() => updateQty(lineKey, -1)}><Minus size={18} /></button>
                        <span className="qty-display">{item.quantity}</span>
                        <button className="qty-btn-sm" aria-label={`Agregar ${item.productName}`} onClick={() => updateQty(lineKey, 1)}><Plus size={18} /></button>
                      </div>
                      <MoneyWithBcv usd={item.price * item.quantity} className="cart-item-price" compact />
                      <button className="cart-item-remove" aria-label={`Eliminar ${item.productName}`} onClick={() => removeFromCart(lineKey)}><Trash2 size={18} /></button>
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
                {selectedCustomer ? (
                  <div className="customer-selected-chip">
                    <div className="customer-chip-avatar">{selectedCustomer.initials}</div>
                    <div className="customer-chip-info">
                      <span className="customer-chip-badge"><Check size={12} /> Cliente seleccionado</span>
                      <span className="customer-chip-name">{selectedCustomer.name}</span>
                      {selectedCustomer.phone && <span className="customer-chip-phone">{selectedCustomer.phone}</span>}
                    </div>
                    <button
                      type="button"
                      className="customer-chip-clear"
                      title="Quitar cliente"
                      aria-label="Quitar cliente"
                      onClick={() => {
                        setSelectedCustomer(null)
                        setCustomerName('')
                        setShowCustomerDropdown(false)
                      }}
                    >
                      <X size={15} />
                    </button>
                  </div>
                ) : (
                <div className="customer-input-wrap">
                  <span className="input-search-icon"><Search size={15} /></span>
                  <input
                    type="text"
                    placeholder="Buscar cliente (opcional)"
                    value={customerName}
                    onChange={(e) => {
                      setCustomerName(e.target.value)
                      setSelectedCustomer(null)
                      setShowCustomerDropdown(true)
                    }}
                    onFocus={() => {
                      loadCustomers()
                      setShowCustomerDropdown(true)
                    }}
                    onBlur={() => {
                      setShowCustomerDropdown(false)
                    }}
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
                    <Plus size={18} />
                  </button>
                </div>
                )}

                {/* Autocomplete Dropdown List */}
                {!selectedCustomer && showCustomerDropdown && filteredCustomers.length > 0 && (
                  <div className="customer-dropdown-menu">
                    {filteredCustomers.map((cust) => (
                      <div
                        key={cust.id}
                        className="customer-dropdown-item"
                        onPointerDown={(e) => {
                          e.preventDefault(); // prevent blur
                          setCustomerName(cust.name)
                          setSelectedCustomer(cust)
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
                        onClick={() => {
                          setOrderType(key)
                          setSelectedPaymentTab(defaultPaymentForOrderType(key))
                          if (key !== 'dine-in') setTableNumber(null)
                        }}
                      >
                        <span className="order-type-icon">{val.icon}</span>
                        <span className="order-type-text">{val.label}</span>
                      </button>
                  ))}
                </div>
              </div>

              {orderType === 'dine-in' && (
                <div className="cart-field-col mt-2">
                  <label className="cart-label">Número de mesa</label>
                  <div className="table-picker-grid">
                    {Array.from({ length: TABLE_COUNT }, (_, i) => i + 1).map((n) => {
                      const isOccupied = occupiedTables.has(n)
                      const isSelected = tableNumber === n
                      return (
                        <button
                          key={n}
                          type="button"
                          disabled={isOccupied && !isSelected}
                          className={`table-picker-btn ${isSelected ? 'selected' : ''} ${isOccupied && !isSelected ? 'occupied' : ''}`}
                          onClick={() => setTableNumber(n)}
                          title={isOccupied ? `Mesa ${n} · con pedido abierto` : `Mesa ${n}`}
                        >
                          {n}
                        </button>
                      )
                    })}
                  </div>
                  {occupiedTables.size > 0 && (
                    <small className="delivery-fee-hint">Las mesas resaltadas ya tienen un pedido abierto sin cobrar.</small>
                  )}
                </div>
              )}

              {orderType === 'delivery' && (
                <div className="cart-field-col mt-2">
                  <label className="cart-label">Costo del delivery (USD)</label>
                  <div className="delivery-fee-input">
                    <Bike size={16} className="delivery-fee-icon" />
                    <span className="delivery-fee-currency">$</span>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={deliveryFee}
                      onChange={e => setDeliveryFee(e.target.value.replace(/[^0-9.,]/g, ''))}
                      placeholder="0,00"
                    />
                    {deliveryFeeUsd > 0 && bcvRate && (
                      <span className="delivery-fee-bs">Bs. {(deliveryFeeUsd * bcvRate).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    )}
                  </div>
                  <small className="delivery-fee-hint">Monto cotizado por WhatsApp según la ubicación del cliente.</small>
                </div>
              )}
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
              {orderType === 'delivery' && deliveryFeeUsd > 0 && (
                <div className="cart-total-row">
                  <span className="total-label">Delivery</span>
                  <MoneyWithBcv usd={deliveryFeeUsd} className="total-val" compact />
                </div>
              )}
              <div className="cart-divide-row">
                {(() => {
                  const currentPay = PAYMENT_DETAILS[selectedPaymentTab] || PAYMENT_DETAILS.card
                  return (
                    <button
                      type="button"
                      className="divide-payment-link"
                      disabled={cart.length === 0 || paying}
                      onClick={() => handleOpenPaymentModal(selectedPaymentTab)}
                    >
                      <span className="divide-payment-icon">{currentPay.icon}</span>
                      <span className="divide-payment-copy">
                        <strong>{currentPay.label}</strong>
                        <small>{currentPay.desc}</small>
                      </span>
                      <span className="divide-payment-arrow">›</span>
                    </button>
                  )
                })()}
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
                aria-label="Cobrar pedido"
                disabled={cart.length === 0 || paying}
                onClick={() => handleOpenPaymentModal(selectedPaymentTab)}
              >
                <WalletCards size={18} />
                <span className="cart-action-label-full">Cobrar pedido</span>
                <span className="cart-action-label-short" aria-hidden="true">Cobrar</span>
              </button>
              <button
                className="btn-kitchen-red"
                aria-label="Enviar a cocina"
                disabled={cart.length === 0 || paying}
                onClick={handleSendToKitchen}
              >
                <Flame size={18} />
                <span className="cart-action-label-full">Enviar a cocina</span>
                <span className="cart-action-label-short" aria-hidden="true">Cocina</span>
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
      {showPaymentModal && createPortal(
        <div className={`modal-overlay-dark ${closingPayment ? 'closing' : ''}`} onClick={() => closePaymentModal()}>
          <div className="payment-modal-box animate-pop caja-payment-modal-glow" onClick={(e) => e.stopPropagation()}>
            {/* Modal Header */}
            <div className="payment-modal-header caja-payment-header-glow">
              <h2 className="payment-modal-title">
                Cobrar pedido <span className="payment-order-tag">Nueva venta</span>
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

            {/* Modal Body: Left Details + Right Summary */}
            <div className="payment-modal-body">
              {/* Left Column: Details */}
              <div className="payment-body-left">
                <h3 className="payment-sub-heading">
                  Detalles del pago ({PAYMENT_METHODS.find(p => p.method === selectedPaymentTab)?.label})
                </h3>

                {selectedPaymentTab !== 'split' && selectedPaymentTab !== 'other' && (
                  <div className="payment-field-group mt-2">
                    <label className="payment-field-label">Cuenta donde ingresa el dinero *</label>
                    <StyledSelect value={paymentAccountId} onChange={(e) => setPaymentAccountId(e.target.value)}>
                      <option value="">{selectedPaymentTab === 'card' ? 'Banesco' : 'Selecciona una cuenta'}</option>
                      {accountsForMethod(selectedPaymentTab).map((a) => <option key={a.id} value={a.id}>{a.name} · {a.currency}</option>)}
                    </StyledSelect>
                    {selectedPaymentTab === 'mobile' && <span className="payment-hint-sub">Por defecto: Banco Exterior. Puedes cambiar a Banesco.</span>}
                    {selectedPaymentTab === 'card' && <span className="payment-hint-sub">Los cobros del punto ingresan en Banesco.</span>}
                  </div>
                )}

                {selectedPaymentTab !== 'split' && selectedPaymentTab !== 'other' && requiresPaymentReference(selectedPaymentTab) && (
                  <div className="payment-field-group mt-2">
                    <label className="payment-field-label">{paymentReferenceLabel(selectedPaymentTab)}</label>
                    <div className="payment-ref-row">
                      <div className="payment-input-wrap" style={{ flex: 1 }}>
                        <input
                          type="text"
                          className="payment-field-input"
                          value={refNumber}
                          onChange={(e) => setRefNumber(e.target.value)}
                          placeholder="Ej. 458921"
                        />
                        <QrCode size={16} className="qr-icon-right" />
                      </div>
                      <button type="button" className="cmd-add-ref-btn" title="Agregar otra referencia" onClick={() => setExtraRefs(prev => [...prev, ''])}>
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
                          setSplitPrimaryExtraRefs([])
                          setPayError('')
                          setSplitPrimaryAccountId(ensureAccountForMethod(nextMethod))
                        }}
                      />
                      <label className="payment-field-label">Cuenta de ingreso *</label>
                      <StyledSelect value={splitPrimaryAccountId} onChange={(e) => setSplitPrimaryAccountId(e.target.value)}>
                        <option value="">Selecciona una cuenta</option>
                        {accountsForMethod(splitPrimaryMethod).map((a) => <option key={a.id} value={a.id}>{a.name} · {a.currency}</option>)}
                      </StyledSelect>
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
                          <div className="payment-ref-row">
                            <input
                              type="text"
                              className="payment-field-input"
                              style={{ flex: 1 }}
                              value={splitPrimaryReference}
                              onChange={(e) => setSplitPrimaryReference(e.target.value)}
                              placeholder="Ej. 458921"
                            />
                            <button type="button" className="cmd-add-ref-btn" title="Agregar otra referencia" onClick={() => setSplitPrimaryExtraRefs(prev => [...prev, ''])}>
                              <Plus size={18} />
                            </button>
                          </div>
                          {splitPrimaryExtraRefs.map((ref, idx) => (
                            <div className="payment-ref-row mt-1" key={idx}>
                              <input
                                type="text"
                                className="payment-field-input"
                                style={{ flex: 1 }}
                                value={ref}
                                onChange={(e) => { const v = e.target.value; setSplitPrimaryExtraRefs(prev => prev.map((r, i) => i === idx ? v : r)) }}
                                placeholder={`Referencia ${idx + 2}`}
                              />
                              <button type="button" className="cmd-remove-ref-btn" title="Quitar" onClick={() => setSplitPrimaryExtraRefs(prev => prev.filter((_, i) => i !== idx))}>
                                <X size={16} />
                              </button>
                            </div>
                          ))}
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
                          setSplitSecondaryExtraRefs([])
                          setPayError('')
                          setSplitSecondaryAccountId(ensureAccountForMethod(nextMethod))
                        }}
                      />
                      <label className="payment-field-label">Cuenta de ingreso *</label>
                      <StyledSelect value={splitSecondaryAccountId} onChange={(e) => setSplitSecondaryAccountId(e.target.value)}>
                        <option value="">Selecciona una cuenta</option>
                        {accountsForMethod(splitSecondaryMethod).map((a) => <option key={a.id} value={a.id}>{a.name} · {a.currency}</option>)}
                      </StyledSelect>
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
                          <div className="payment-ref-row">
                            <input
                              type="text"
                              className="payment-field-input"
                              style={{ flex: 1 }}
                              value={splitSecondaryReference}
                              onChange={(e) => setSplitSecondaryReference(e.target.value)}
                              placeholder="Ej. 458921"
                            />
                            <button type="button" className="cmd-add-ref-btn" title="Agregar otra referencia" onClick={() => setSplitSecondaryExtraRefs(prev => [...prev, ''])}>
                              <Plus size={18} />
                            </button>
                          </div>
                          {splitSecondaryExtraRefs.map((ref, idx) => (
                            <div className="payment-ref-row mt-1" key={idx}>
                              <input
                                type="text"
                                className="payment-field-input"
                                style={{ flex: 1 }}
                                value={ref}
                                onChange={(e) => { const v = e.target.value; setSplitSecondaryExtraRefs(prev => prev.map((r, i) => i === idx ? v : r)) }}
                                placeholder={`Referencia ${idx + 2}`}
                              />
                              <button type="button" className="cmd-remove-ref-btn" title="Quitar" onClick={() => setSplitSecondaryExtraRefs(prev => prev.filter((_, i) => i !== idx))}>
                                <X size={16} />
                              </button>
                            </div>
                          ))}
                        </>
                      )}
                    </section>
                  </div>
                )}

                {selectedPaymentTab !== 'split' && <div className="payment-field-group mt-3">
                  <label className="payment-field-label">
                    {selectedPaymentTab === 'cash' ? 'MONTO RECIBIDO' : 'MONTO A COBRAR'} <span className="text-red">*</span>
                  </label>
                  {selectedPaymentTab === 'cash' && (
                    <div className="cash-currency-toggle">
                      <button
                        type="button"
                        className={`cash-currency-btn ${cashCurrency === 'USD' ? 'active' : ''}`}
                        onClick={() => { setCashCurrency('USD'); setAmountReceived(total.toFixed(2)) }}
                      >USD</button>
                      <button
                        type="button"
                        className={`cash-currency-btn ${cashCurrency === 'VES' ? 'active' : ''}`}
                        onClick={() => { setCashCurrency('VES'); setAmountReceived(bcvRate ? (total * bcvRate).toFixed(2) : '') }}
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
                    <span className="currency-tag-right">
                      {selectedPaymentTab === 'cash' ? (cashCurrency === 'USD' ? 'USD' : 'Bs') : (selectedPaymentTab !== 'other' && usesBolivares(selectedPaymentTab) ? 'Bs' : 'USD')}
                    </span>
                  </div>
                  <span className="payment-hint-sub">
                    {selectedPaymentTab === 'cash'
                      ? (cashCurrency === 'USD'
                        ? bcvRate ? `Ref. ${formatVes(total * bcvRate)}` : 'Referencia BCV no disponible'
                        : `Ref. ${formatUsd(total)}`)
                      : selectedPaymentTab !== 'other' && usesBolivares(selectedPaymentTab)
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
                <div className="order-summary-box caja-order-summary-accent">
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

                    <div className="summary-box-total-line caja-summary-total-highlight mt-3">
                      <span className="summary-total-label">Total</span>
                      <MoneyWithBcv usd={total} className="summary-total-val" />
                    </div>
                  </div>

                  {/* Customer field */}
                  <div className="summary-box-customer mt-4">
                    <span className="customer-box-label">Cliente</span>
                    <div className="customer-box-card">
                      <span className="customer-box-name"><User size={14} /> {customerName || 'Cliente general'}</span>
                      <span className="customer-edit-btn" title="El cliente se define al crear la venta"><Pencil size={14} /></span>
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
              <button className="btn-modal-action-ghost" onClick={() => closePaymentModal()}>
                <X size={18} /> Cancelar
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Modal Nuevo Cliente desde Caja */}
      {showNewClientModal && createPortal(
        <div className={`modal-overlay-dark ${closingNewClient ? 'closing' : ''}`} onClick={() => !creatingCustomer && closeNewClientModal()}>
          <div className="client-modal-box animate-pop caja-modal-glow" role="dialog" aria-modal="true" aria-labelledby="new-client-title" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header-line caja-modal-header-glow">
              <div>
                <span className="client-modal-eyebrow">Directorio de clientes</span>
                <h3 className="modal-title" id="new-client-title">Nuevo cliente</h3>
                <p className="modal-sub-desc">Registra un nuevo cliente en el sistema</p>
              </div>
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
                    <StyledSelect
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
                    </StyledSelect>
                  </div>
                  <div className="select-col">
                    <span className="select-sub-label">Día</span>
                    <StyledSelect
                      className="modal-select-dark"
                      value={birthDay}
                      onChange={(e) => setBirthDay(e.target.value)}
                    >
                      <option value="">Día</option>
                      {Array.from({ length: getDaysInBirthMonth(birthMonth) }, (_, i) => i + 1).map((d) => (
                        <option key={d} value={d}>{d}</option>
                      ))}
                    </StyledSelect>
                  </div>
                </div>
                <span className="birthday-hint mt-1">
                  Solo para promociones y recordatorios
                </span>
              </div>

              {customerCreateError && <div className="client-modal-error" role="alert">{customerCreateError}</div>}

              <div className="modal-actions-row-right mt-4">
                <button type="button" className="btn-modal-cancel" disabled={creatingCustomer} onClick={() => closeNewClientModal()}>
                  Cancelar
                </button>
                <button type="submit" className="btn-modal-submit-red" disabled={creatingCustomer}>
                  {creatingCustomer ? 'Guardando…' : 'Guardar cliente'}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}
