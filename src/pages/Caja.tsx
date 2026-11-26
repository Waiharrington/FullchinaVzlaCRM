import { useState, useMemo, useEffect, useCallback, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/auth-context'
import { useRates } from '../context/rates-context'
import { MoneyWithBcv } from '../components/MoneyWithBcv'
import { PrintChoiceDialog } from '../components/PrintChoiceDialog'
import Toast from '../components/Toast'
import { printThermalReceipt, type ThermalReceiptData } from '../lib/thermalReceipt'
import { formatRateDate, formatUsd, formatVes } from '../lib/money'
import { groupMenuProducts, type MenuProductGroup } from '../lib/menuGrouping'
import { classifyMenuCategory, menuCategoryKeys, isKnownCategory, hydrateMenuCategories } from '../lib/menuCategories'
import { defaultPaymentForOrderType, type OrderType } from '../lib/orderDefaults'
import { accountsForPaymentMethod } from '../lib/paymentAccounts'
import { getProducts, getTodayOrders, getTopSellingProducts, getActiveCashSession, checkout, sendToKitchen, getCustomers, createCustomer, getProductModifiers, getAllProductModifiers, getOccupiedTables, getMenuCategories, getFinancialAccounts, getPersonalAccountOptions, isQuantityModifierGroup, type Product, type CartItem, type OrderResult, type TodayOrder, type CashSessionSnapshot, type ProductModifierGroup, type SelectedModifier } from '../lib/dataService'
import { X, ShoppingCart, WalletCards, RefreshCw } from 'lucide-react'
import './Caja.css'
import { useLiveDataRefresh } from '../lib/liveDataRefresh'
import { formatProductTitle, formatSpanishText, normalizeForSearch } from '../lib/textFormat'

import { ActivePaymentMethod, SplitPaymentMethod, MOBILE_CART_TRIGGER_EXIT_MS, paymentInputToUsd, usdToPaymentInput, getProductImage, CAJA_PRODUCTS_CACHE_KEY, CAJA_DRAFT_KEY, clearCajaDraft, readCajaDraft, type CustomerOption } from './caja/model'
import { buildPayment } from './caja/buildPayment'
import { usePaymentForm } from './caja/usePaymentForm'
import { CartSidebar } from './caja/CartSidebar'
import { VariantSelectorModal } from './caja/VariantSelectorModal'
import { ProductsSection } from './caja/ProductsSection'
import { SaleSuccessScreen } from './caja/SaleSuccessScreen'
import { PaymentModal } from './caja/PaymentModal'
import { NewClientModal } from './caja/NewClientModal'

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
  const [mobileCartOpen, setMobileCartOpen] = useState(false)
  const [mobileCartClosing, setMobileCartClosing] = useState(false)
  const mobileCartCloseTimer = useRef<number | null>(null)
  const [mobileCartTriggerVisible, setMobileCartTriggerVisible] = useState(false)
  const [mobileCartTriggerClosing, setMobileCartTriggerClosing] = useState(false)
  const mobileCartTriggerTimer = useRef<number | null>(null)
  const [isPhoneViewport, setIsPhoneViewport] = useState(() => typeof window !== 'undefined' && window.matchMedia('(max-width: 767px)').matches)
  const [productsWithModifiers, setProductsWithModifiers] = useState<Set<string>>(new Set())
  // Selector de modificadores
  const [modifierProduct, setModifierProduct] = useState<Product | null>(null)
  const [closingModifier, setClosingModifier] = useState(false)
  const [modifierGroups, setModifierGroups] = useState<ProductModifierGroup[]>([])
  const [modifierSelections, setModifierSelections] = useState<Record<string, Record<string, number>>>({})
  const [modifierLoading, setModifierLoading] = useState(false)
  const [modifierError, setModifierError] = useState('')

  const openMobileCart = () => {
    if (mobileCartCloseTimer.current !== null) {
      window.clearTimeout(mobileCartCloseTimer.current)
      mobileCartCloseTimer.current = null
    }
    setMobileCartClosing(false)
    setMobileCartOpen(true)
  }

  const closeMobileCart = () => {
    if (!mobileCartOpen || mobileCartClosing) return
    setMobileCartClosing(true)
    mobileCartCloseTimer.current = window.setTimeout(() => {
      setMobileCartOpen(false)
      setMobileCartClosing(false)
      mobileCartCloseTimer.current = null
    }, 200)
  }

  useEffect(() => () => {
    if (mobileCartCloseTimer.current !== null) window.clearTimeout(mobileCartCloseTimer.current)
    if (mobileCartTriggerTimer.current !== null) window.clearTimeout(mobileCartTriggerTimer.current)
  }, [])

  useEffect(() => {
    if (!mobileCartOpen || !isPhoneViewport) return

    const root = document.documentElement
    const body = document.body
    const previousRootOverflow = root.style.overflow
    const previousBodyOverflow = body.style.overflow

    root.style.overflow = 'hidden'
    body.style.overflow = 'hidden'

    return () => {
      root.style.overflow = previousRootOverflow
      body.style.overflow = previousBodyOverflow
    }
  }, [mobileCartOpen, isPhoneViewport])

  useEffect(() => {
    const phoneQuery = window.matchMedia('(max-width: 767px)')
    const syncPhoneViewport = () => {
      setIsPhoneViewport(phoneQuery.matches)
      if (!phoneQuery.matches && embedded) {
        if (mobileCartCloseTimer.current !== null) window.clearTimeout(mobileCartCloseTimer.current)
        mobileCartCloseTimer.current = null
        setMobileCartClosing(false)
        setMobileCartOpen(false)
      }
    }
    syncPhoneViewport()
    phoneQuery.addEventListener('change', syncPhoneViewport)
    return () => phoneQuery.removeEventListener('change', syncPhoneViewport)
  }, [embedded])
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
      clearCajaDraft()
      return
    }
    try {
      localStorage.setItem(CAJA_DRAFT_KEY, JSON.stringify({
        cart, orderType, tableNumber, deliveryFee, customerName, orderNotes, savedAt: Date.now(),
      }))
    } catch { /* el pedido sigue funcionando aunque el storage no esté disponible */ }
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
  const paymentForm = usePaymentForm()
  const {
    selectedPaymentTab,
    setSelectedPaymentTab,
    refNumber,
    setRefNumber,
    extraRefs,
    setExtraRefs,
    amountReceived,
    setAmountReceived,
    amountReceivedSecondary,
    setAmountReceivedSecondary,
    splitPrimaryCashReceived,
    setSplitPrimaryCashReceived,
    splitSecondaryCashReceived,
    setSplitSecondaryCashReceived,
    splitPrimaryMethod,
    setSplitPrimaryMethod,
    splitSecondaryMethod,
    setSplitSecondaryMethod,
    splitPrimaryCashCurrency,
    splitSecondaryCashCurrency,
    splitPrimaryReference,
    setSplitPrimaryReference,
    splitSecondaryReference,
    setSplitSecondaryReference,
    splitPrimaryExtraRefs,
    setSplitPrimaryExtraRefs,
    splitSecondaryExtraRefs,
    setSplitSecondaryExtraRefs,
    paymentNote,
    setPaymentNote,
    financialAccounts,
    setFinancialAccounts,
    personalAccounts,
    setPersonalAccounts,
    paymentAccountId,
    setPaymentAccountId,
    paymentPersonalAccountId,
    setPaymentPersonalAccountId,
    splitPrimaryAccountId,
    setSplitPrimaryAccountId,
    splitSecondaryAccountId,
    setSplitSecondaryAccountId,
    cashCurrency,
    changeAccountId,
    setChangeAccountId,
  } = paymentForm

  const [paying, setPaying] = useState(false)
  const [payError, setPayError] = useState('')
  const [cashSession, setCashSession] = useState<CashSessionSnapshot | null>(null)
  const [currentOrder, setCurrentOrder] = useState<OrderResult | null>(null)
  const [showConfirmation, setShowConfirmation] = useState(false)
  const [printPrompt, setPrintPrompt] = useState<ThermalReceiptData | null>(null)
  const [printPromptDestination, setPrintPromptDestination] = useState<'comandas' | 'close' | null>(null)

  const thermalReceiptForOrder = (order: OrderResult, kind: ThermalReceiptData['kind']): ThermalReceiptData => ({
    kind,
    orderNumber: `#FC-${String(order.orderNumber).padStart(6, '0')}`,
    createdAt: order.createdAt,
    orderType: order.orderType === 'dine-in' && order.tableNumber ? `Mesa ${order.tableNumber}`
      : order.orderType === 'delivery' ? 'Delivery'
        : order.orderType === 'dine-in' ? 'Mesa' : 'Para llevar',
    tableNumber: order.orderType === 'dine-in' ? order.tableNumber : null,
    employeeName: order.employeeName || user?.fullName || 'Usuario del sistema',
    customerName: order.customerName || 'Cliente general',
    notes: orderNotes || null,
    items: order.items.map(item => {
      const modifiers = (item.selectedModifiers ?? []).map(modifier => ({
        name: modifier.optionName,
        quantity: modifier.quantity,
        unitPrice: modifier.price,
      }))
      const modifierUnitTotal = modifiers.reduce((sum, modifier) => sum + modifier.unitPrice * modifier.quantity, 0)
      return {
        name: item.productName,
        quantity: item.quantity,
        unitPrice: item.price - modifierUnitTotal,
        modifiers,
      }
    }),
    totalUsd: order.total,
    deliveryFeeUsd: order.deliveryFeeUsd,
    bcvRate: order.bcvRate || bcvRate,
    payments: order.payments?.map(payment => ({
      method: payment.method,
      amount: payment.amount,
      referenceNumber: payment.referenceNumber,
      receivedAmount: payment.receivedAmount,
      receivedCurrency: payment.receivedCurrency,
      changeAmount: payment.changeAmount,
      changeCurrency: payment.changeCurrency,
    })) ?? [],
  })

  const resolvePrintPrompt = async (shouldPrint: boolean) => {
    const printJob = shouldPrint && printPrompt ? printThermalReceipt(printPrompt) : Promise.resolve()
    setPrintPrompt(null)
    const destination = printPromptDestination
    setPrintPromptDestination(null)
    if (shouldPrint) await printJob
    if (destination === 'close') onClose?.()
    else if (destination === 'comandas') navigate('/comandas')
  }

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
    getPersonalAccountOptions().then(setPersonalAccounts).catch(() => setPersonalAccounts([]))
  }, [setFinancialAccounts, setPersonalAccounts])

  useLiveDataRefresh('caja', async () => {
    const [productsData, ordersData, modifiers, categoriesData, occupied, ranking, session, accounts, personal] = await Promise.all([
      getProducts(), getTodayOrders(), getAllProductModifiers(), getMenuCategories(),
      getOccupiedTables(), getTopSellingProducts(), getActiveCashSession(), getFinancialAccounts(), getPersonalAccountOptions(),
    ])
    setProducts(productsData)
    cacheProducts(productsData)
    setTodayOrders(ordersData)
    setProductsWithModifiers(new Set(modifiers.keys()))
    if (categoriesData.length) hydrateMenuCategories(categoriesData)
    setOccupiedTables(new Set(occupied))
    setSalesRank(ranking)
    setCashSession(session)
    setFinancialAccounts(accounts)
    setPersonalAccounts(personal)
  })

  const accountsForMethod = (method: SplitPaymentMethod, cashCurrencyOverride: 'USD' | 'VES' = cashCurrency) =>
    accountsForPaymentMethod(financialAccounts, method, cashCurrencyOverride)

  const ensureAccountForMethod = (method: SplitPaymentMethod, cashCurrencyOverride: 'USD' | 'VES' = cashCurrency) => {
    const options = accountsForMethod(method, cashCurrencyOverride)
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
        } else if (isQuantityModifierGroup(g)) {
          g.options.slice(0, g.maxSelections ?? g.options.length).forEach((option) => { init[g.modifierId][option.id] = 1 })
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
      if (isQuantityModifierGroup(group)) {
        if (current > 0) {
          delete groupSel[optionId]
        } else if (group.maxSelections == null || totalSelected < group.maxSelections) {
          groupSel[optionId] = 1
        }
      } else if (current > 0 && !group.allowRepeat) {
        delete groupSel[optionId]
      } else {
        if (group.maxSelections != null && totalSelected >= group.maxSelections) return prev
        groupSel[optionId] = group.allowRepeat ? current + 1 : 1
      }
      return { ...prev, [group.modifierId]: groupSel }
    })
  }

  const changeQuantityModifier = (group: ProductModifierGroup, optionId: string, delta: number) => {
    if (!isQuantityModifierGroup(group)) return
    setModifierSelections((prev) => {
      const current = prev[group.modifierId]?.[optionId] ?? 0
      const total = Object.values(prev[group.modifierId] ?? {}).reduce((sum, qty) => sum + qty, 0)
      const next = Math.max(0, Math.min(current + delta, group.maxSelections ?? Number.MAX_SAFE_INTEGER))
      if (delta > 0 && total >= (group.maxSelections ?? Number.MAX_SAFE_INTEGER)) return prev
      const groupSel = { ...(prev[group.modifierId] ?? {}) }
      if (next === 0) delete groupSel[optionId]
      else groupSel[optionId] = next
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
  const mobileCartItemCount = cart.reduce((sum, item) => sum + item.quantity, 0)

  useEffect(() => {
    const shouldShowTrigger = mobileCartItemCount > 0 && !mobileCartOpen
    if (shouldShowTrigger) {
      if (mobileCartTriggerTimer.current !== null) {
        window.clearTimeout(mobileCartTriggerTimer.current)
        mobileCartTriggerTimer.current = null
      }
      setMobileCartTriggerClosing(false)
      setMobileCartTriggerVisible(true)
      return
    }

    if (!mobileCartTriggerVisible || mobileCartTriggerClosing) return
    setMobileCartTriggerClosing(true)
    mobileCartTriggerTimer.current = window.setTimeout(() => {
      setMobileCartTriggerVisible(false)
      setMobileCartTriggerClosing(false)
      mobileCartTriggerTimer.current = null
    }, MOBILE_CART_TRIGGER_EXIT_MS)
  }, [mobileCartItemCount, mobileCartOpen, mobileCartTriggerClosing, mobileCartTriggerVisible])

  const deliveryFeeUsd = orderType === 'delivery' ? Math.max(0, parseFloat(deliveryFee.replace(',', '.')) || 0) : 0
  const total = subtotal + deliveryFeeUsd
  const splitPrimaryAmountUsd = paymentInputToUsd(amountReceived, splitPrimaryMethod, bcvRate, splitPrimaryCashCurrency)
  const splitSecondaryAmountUsd = paymentInputToUsd(amountReceivedSecondary, splitSecondaryMethod, bcvRate, splitSecondaryCashCurrency)
  // Los dos métodos del pago combinado están enlazados: editar uno recalcula el
  // otro para que siempre sumen el total (bidireccional Bs<->USD).
  const syncSplitFromPrimary = (input: string) => {
    setAmountReceived(input)
    const primaryUsd = paymentInputToUsd(input, splitPrimaryMethod, bcvRate, splitPrimaryCashCurrency)
    const secUsd = Math.max(0, Math.round((total - primaryUsd) * 100) / 100)
    setAmountReceivedSecondary(usdToPaymentInput(secUsd, splitSecondaryMethod, bcvRate, splitSecondaryCashCurrency))
  }
  const syncSplitFromSecondary = (input: string) => {
    setAmountReceivedSecondary(input)
    const secUsd = paymentInputToUsd(input, splitSecondaryMethod, bcvRate, splitSecondaryCashCurrency)
    const priUsd = Math.max(0, Math.round((total - secUsd) * 100) / 100)
    setAmountReceived(usdToPaymentInput(priUsd, splitPrimaryMethod, bcvRate, splitPrimaryCashCurrency))
  }

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
        employeeName: user?.fullName,
      })
      setCurrentOrder(order)
      // La comanda ya salió de Ventas: no debe reaparecer como borrador al volver.
      clearCajaDraft()
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
      setPrintPrompt(thermalReceiptForOrder(order, 'precuenta'))
      setPrintPromptDestination(embedded ? 'close' : 'comandas')
    } catch (e) {
      setPayError(e instanceof Error ? e.message : 'Error al enviar a cocina')
    } finally {
      setPaying(false)
    }
  }

  // Open Payment Modal (Image 1)
  const handleOpenPaymentModal = async (preferredMethod: ActivePaymentMethod | 'split' = 'cash') => {
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
    setChangeAccountId('')
    setRefNumber('')
    setExtraRefs([])
    const initialMethod: SplitPaymentMethod = preferredMethod === 'split' || preferredMethod === 'other' || preferredMethod === 'personal_account' ? 'cash' : preferredMethod
    setAmountReceived(usdToPaymentInput(preferredMethod === 'split' ? total / 2 : total, initialMethod, bcvRate))
    if (preferredMethod === 'split') setAmountReceivedSecondary(usdToPaymentInput(total - total / 2, splitSecondaryMethod, bcvRate))
    setSplitPrimaryCashReceived(usdToPaymentInput(preferredMethod === 'split' ? total / 2 : total, 'cash', bcvRate, splitPrimaryCashCurrency))
    setSplitSecondaryCashReceived(usdToPaymentInput(preferredMethod === 'split' ? total - total / 2 : total / 2, 'cash', bcvRate, splitSecondaryCashCurrency))
    setSplitPrimaryMethod('cash')
    setSplitSecondaryMethod('mobile')
    setSplitPrimaryReference('')
    setSplitSecondaryReference('')
    setSplitPrimaryExtraRefs([])
    setSplitSecondaryExtraRefs([])
    setPaymentAccountId(initialMethod === 'cash' ? ensureAccountForMethod(cashCurrency === 'USD' ? 'cash' : 'cash') : ensureAccountForMethod(initialMethod))
    setPaymentPersonalAccountId(personalAccounts.find(account => account.isActive)?.id ?? '')
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

  const handleSelectPaymentTab = (method: ActivePaymentMethod | 'split') => {
    setSelectedPaymentTab(method)
    setRefNumber('')
    setExtraRefs([])
    setSplitPrimaryReference('')
    setSplitSecondaryReference('')
    setSplitPrimaryExtraRefs([])
    setSplitSecondaryExtraRefs([])
    const inputMethod: SplitPaymentMethod = method === 'split' || method === 'other' || method === 'personal_account' ? 'cash' : method
    if (method === 'split') {
      setSplitPrimaryAccountId(ensureAccountForMethod(splitPrimaryMethod))
      setSplitSecondaryAccountId(ensureAccountForMethod(splitSecondaryMethod))
    } else if (method !== 'personal_account') {
      setPaymentAccountId(ensureAccountForMethod(inputMethod))
    }
    if (method === 'personal_account') setPaymentPersonalAccountId(personalAccounts.find(account => account.isActive)?.id ?? '')
    setPayError('')
    setAmountReceived(usdToPaymentInput(method === 'split' ? total / 2 : total, inputMethod, bcvRate))
    if (method === 'split') setAmountReceivedSecondary(usdToPaymentInput(total - total / 2, splitSecondaryMethod, bcvRate))
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

      const { finalMethod, payments: paymentComponents, combinedRefs, enteredAmountUsd: enteredAmount } = buildPayment({
        tab: selectedPaymentTab,
        total,
        bcvRate,
        amountReceived,
        cashCurrency,
        refNumber,
        extraRefs,
        paymentAccountId,
        paymentPersonalAccountId,
        personalAccounts,
        changeAccountId,
        financialAccounts,
        paymentNote,
        splitPrimaryAmountUsd,
        splitPrimary: {
          method: splitPrimaryMethod,
          accountId: splitPrimaryAccountId,
          reference: splitPrimaryReference,
          extraRefs: splitPrimaryExtraRefs,
          cashReceived: splitPrimaryCashReceived,
          cashCurrency: splitPrimaryCashCurrency,
        },
        splitSecondary: {
          method: splitSecondaryMethod,
          accountId: splitSecondaryAccountId,
          reference: splitSecondaryReference,
          extraRefs: splitSecondaryExtraRefs,
          cashReceived: splitSecondaryCashReceived,
          cashCurrency: splitSecondaryCashCurrency,
        },
      })

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
        employeeName: user?.fullName,
      })
      setCurrentOrder(order)
      setPrintPrompt(thermalReceiptForOrder(order, 'venta'))
      setPrintPromptDestination(null)
      // Una venta cobrada tampoco debe volver como borrador al regresar a Ventas.
      clearCajaDraft()
      closePaymentModal(() => setShowConfirmation(true))
      // Vaciar el formulario en el mismo ciclo evita que el guardado automático
      // vuelva a persistir la venta mientras se muestra la confirmación.
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
    } catch (e) {
      setPayError(e instanceof Error ? e.message : 'Error al confirmar pago')
    } finally {
      setPaying(false)
    }
  }

  const handlePrintReceipt = () => {
    if (currentOrder) printThermalReceipt(thermalReceiptForOrder(currentOrder, 'venta'))
  }

  // Image 2 Target: Confirmation Screen "¡Pedido cobrado con éxito!"
  if (showConfirmation && currentOrder) {
    const orderNo = `#FC-${String(currentOrder.orderNumber).padStart(6, '0')}`
    const formattedDate = new Date(currentOrder.createdAt).toLocaleDateString('es-VE', { day: '2-digit', month: '2-digit', year: 'numeric' })
    const formattedTime = new Date(currentOrder.createdAt).toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit', hour12: true })
    const paymentLabel = currentOrder.paymentMethod === 'personal_account'
      ? `Cuenta personal · ${personalAccounts.find(account => account.id === currentOrder.payments?.[0]?.personalAccountId)?.name ?? 'Consumo interno'}`
      : currentOrder.paymentMethod === 'cash'
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
      <SaleSuccessScreen embedded={embedded} printPrompt={printPrompt} resolvePrintPrompt={resolvePrintPrompt} currentOrder={currentOrder} orderNo={orderNo} bcvRate={bcvRate} paymentLabel={paymentLabel} setShowConfirmation={setShowConfirmation} setCart={setCart} setCurrentOrder={setCurrentOrder} setCustomerName={setCustomerName} setSelectedCustomer={setSelectedCustomer} setDeliveryFee={setDeliveryFee} onClose={onClose} navigate={navigate} handlePrintReceipt={handlePrintReceipt} formattedTime={formattedTime} formattedDate={formattedDate} orderType={orderType} products={products} />
    )
  }

  const handleRefreshBcv = async () => {
    await refreshBcv()
    setBcvSuccessToast('Tasa BCV actualizada correctamente.')
  }

  return (
    <div className={`page animate-fade-in ${embedded ? 'caja-embedded' : ''}`}>
      {printPrompt && <PrintChoiceDialog documentName="la precuenta de comanda" onPrint={() => resolvePrintPrompt(true)} onSkip={() => resolvePrintPrompt(false)} />}
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
        <ProductsSection activeCategory={activeCategory} setActiveCategory={setActiveCategory} categories={categories} searchTerm={searchTerm} setSearchTerm={setSearchTerm} sortBy={sortBy} setSortBy={setSortBy} salesRank={salesRank} loading={loading} products={products} productsError={productsError} filteredProductGroups={filteredProductGroups} topProductRanks={topProductRanks} selectMenuGroup={selectMenuGroup} />

        {selectedProductGroup && createPortal(
          <div className={`modal-overlay-dark variant-selector-overlay ${closingProductGroup ? 'closing' : ''}`} onClick={() => closeProductGroupModal()}>
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
          <VariantSelectorModal closingModifier={closingModifier} closeModifierPicker={closeModifierPicker} modifierProduct={modifierProduct} modifierLoading={modifierLoading} modifierGroups={modifierGroups} modifierSelections={modifierSelections} toggleModifierOption={toggleModifierOption} changeQuantityModifier={changeQuantityModifier} modifierError={modifierError} modifierExtraPrice={modifierExtraPrice} confirmModifierSelection={confirmModifierSelection} />,
          document.body
        )}

        {/* El resumen fijo permite abrir el pedido sin recorrer todo el catálogo. */}
        {createPortal(
          <>
            {mobileCartTriggerVisible && (
              <button
                type="button"
                className={`mobile-cart-trigger${embedded ? ' mobile-cart-trigger--modal' : ''}${mobileCartTriggerClosing ? ' closing' : ''}`}
                aria-expanded={mobileCartOpen}
                disabled={mobileCartTriggerClosing}
                onClick={openMobileCart}
              >
                <span className="mobile-cart-trigger-summary">
                  <ShoppingCart size={18} aria-hidden="true" />
                  <span>{mobileCartItemCount === 1 ? '1 artículo' : `${mobileCartItemCount} artículos`}</span>
                  <strong>{formatUsd(total)}</strong>
                </span>
                <span className="mobile-cart-trigger-action">Ver pedido</span>
              </button>
            )}
          </>,
          document.body,
        )}

        {/* RIGHT: Cart Sidebar */}
        {(() => {
          const cartSidebar = (
        <CartSidebar mobileCartOpen={mobileCartOpen} embedded={embedded} isPhoneViewport={isPhoneViewport} mobileCartClosing={mobileCartClosing} orderType={orderType} Date={Date} closeMobileCart={closeMobileCart} cart={cart} products={products} updateQty={updateQty} removeFromCart={removeFromCart} orderNotes={orderNotes} setOrderNotes={setOrderNotes} selectedCustomer={selectedCustomer} setSelectedCustomer={setSelectedCustomer} setCustomerName={setCustomerName} setShowCustomerDropdown={setShowCustomerDropdown} customerName={customerName} loadCustomers={loadCustomers} setCustomerCreateError={setCustomerCreateError} setShowNewClientModal={setShowNewClientModal} showCustomerDropdown={showCustomerDropdown} filteredCustomers={filteredCustomers} Object={Object} Array={Array} setOrderType={setOrderType} setSelectedPaymentTab={setSelectedPaymentTab} setTableNumber={setTableNumber} occupiedTables={occupiedTables} tableNumber={tableNumber} deliveryFee={deliveryFee} setDeliveryFee={setDeliveryFee} deliveryFeeUsd={deliveryFeeUsd} bcvRate={bcvRate} subtotal={subtotal} selectedPaymentTab={selectedPaymentTab} paying={paying} handleOpenPaymentModal={handleOpenPaymentModal} total={total} payError={payError} handleSendToKitchen={handleSendToKitchen} />
          )

          return mobileCartOpen && isPhoneViewport
            ? createPortal(
                <div className={`mobile-cart-modal-overlay${mobileCartClosing ? ' closing' : ''}`} role="dialog" aria-modal="true" aria-label="Comanda activa" aria-hidden={mobileCartClosing} onClick={closeMobileCart}>
                  {cartSidebar}
                </div>,
                document.body,
              )
            : cartSidebar
        })()}
      </div>

      {/* Image 1 Target: Payment Modal "Cobrar pedido" */}
      {showPaymentModal && (
        <PaymentModal
          form={paymentForm}
          bcvRate={bcvRate}
          customerName={customerName}
          closingPayment={closingPayment}
          paying={paying}
          payError={payError}
          setPayError={setPayError}
          accountsForMethod={accountsForMethod}
          ensureAccountForMethod={ensureAccountForMethod}
          subtotal={subtotal}
          total={total}
          splitPrimaryAmountUsd={splitPrimaryAmountUsd}
          splitSecondaryAmountUsd={splitSecondaryAmountUsd}
          syncSplitFromPrimary={syncSplitFromPrimary}
          syncSplitFromSecondary={syncSplitFromSecondary}
          closePaymentModal={closePaymentModal}
          handleSelectPaymentTab={handleSelectPaymentTab}
          handleConfirmPayment={handleConfirmPayment}
          handlePrintReceipt={handlePrintReceipt}
        />
      )}

      {/* Modal Nuevo Cliente desde Caja */}
      {showNewClientModal && (
        <NewClientModal
          closing={closingNewClient}
          creating={creatingCustomer}
          error={customerCreateError}
          newClientName={newClientName} setNewClientName={setNewClientName}
          newClientLastName={newClientLastName} setNewClientLastName={setNewClientLastName}
          newClientIdentification={newClientIdentification} setNewClientIdentification={setNewClientIdentification}
          newClientPhone={newClientPhone} setNewClientPhone={setNewClientPhone}
          newClientAddress={newClientAddress} setNewClientAddress={setNewClientAddress}
          birthMonth={birthMonth} setBirthMonth={setBirthMonth}
          birthDay={birthDay} setBirthDay={setBirthDay}
          onSubmit={handleCreateNewClientFromCaja}
          onClose={() => closeNewClientModal()}
        />
      )}
    </div>
  )
}
