import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowUpRight, Bike, Check, ChevronRight, CircleAlert, Clock, Flame, Heart, LoaderCircle, Wallet, MapPin, MessageSquareText, Minus, Phone, Plus, Search, Navigation, RotateCcw, ShieldCheck, ShoppingBag, ShoppingCart, Star, Store, Trash2, UserRound, Utensils, X, Zap } from 'lucide-react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { groupMenuProducts, type MenuProductGroup } from '../lib/menuGrouping'
import { createWebOrder, getPublicCatalog, getPublicMenuCategories, type WebOrderCartItem } from '../lib/publicOrders'
import { getProductModifiers, type ProductModifierGroup } from '../lib/dataService'
import { getExchangeRates } from '../lib/rates'
import type { Product } from '../lib/dataService'
import { PublicMenuSkeleton } from '../components/PublicMenuSkeleton'
import { HeroWokEmbers } from '../components/HeroWokEmbers'
import { formatProductTitle, formatSpanishText } from '../lib/textFormat'
import { getEditorialDescription } from '../lib/menuEditorial'
import { categoryLabel, classifyMenuCategory, menuItemRank, menuCategoryRank, isKnownCategory, hydrateMenuCategories } from '../lib/menuCategories'
import './PublicMenu.css'

declare global { interface Window { __removeFCSplash?: () => void } }

const CATEGORY_ICONS: Record<string, string> = {
  Todos: '/optimized/menu-icons/menu.webp',
  arroz: '/optimized/menu-icons/arroz chino.webp',
  chopsuey: '/optimized/menu-icons/Chopsuey.webp',
  tallarines: '/optimized/menu-icons/pastas.webp',
  pastas: '/optimized/menu-icons/pastas.webp',
  promociones: '/optimized/menu-icons/promociones.webp',
  bebidas: '/optimized/menu-icons/bebidas.webp',
  individuales: '/optimized/menu-icons/individuales.webp',
  ejecutivos: '/optimized/menu-icons/individuales.webp',
  raciones: '/optimized/menu-icons/raciones.webp',
  extras: '/optimized/menu-icons/raciones.webp',
  otros: '/optimized/menu-icons/menu.webp',
}

const DESKTOP_CATEGORY_CARDS = [
  { id: 'Todos', label: 'Todo', icon: '/optimized/menu-icons/menu.webp' },
  { id: 'arroz', label: 'Arroz', icon: '/optimized/menu-icons/arroz chino.webp' },
  { id: 'chopsuey', label: 'Chopsuey', icon: '/optimized/menu-icons/Chopsuey.webp' },
  { id: 'tallarines', label: 'Tallarines', icon: '/optimized/menu-icons/pastas.webp' },
  { id: 'pastas', label: 'Pastas', icon: '/optimized/menu-icons/pastas.webp' },
  { id: 'promociones', label: 'Promociones', icon: '/optimized/menu-icons/promociones.webp', isPromo: true },
  { id: 'bebidas', label: 'Bebidas', icon: '/optimized/menu-icons/bebidas.webp' },
  { id: 'individuales', label: 'Individuales', icon: '/optimized/menu-icons/individuales.webp' },
  { id: 'raciones', label: 'Raciones', icon: '/optimized/menu-icons/raciones.webp' },
]

const DESKTOP_CATEGORY_LABELS: Record<string, string> = {
  promociones: 'Promos',
  ejecutivos: 'Ejecutivo',
}

const INSTAGRAM_REELS = [
  { src: '/videos/instagram/reel-1.mp4', href: 'https://www.instagram.com/p/DR7aYwlDsTD/?hl=es' },
  { src: '/videos/instagram/reel-2.mp4', href: 'https://www.instagram.com/p/DPj331MCW87/?hl=es' },
  { src: '/videos/instagram/reel-3.mp4', href: 'https://www.instagram.com/p/DQANX2cCVkj/?hl=es' },
  { src: '/videos/instagram/reel-4.mp4', href: 'https://www.instagram.com/p/DZLUKT5sKeW/?hl=es' },
  { src: '/videos/instagram/reel-5.mp4', href: 'https://www.instagram.com/p/DYnlFGtNg93/?hl=es' },
  { src: '/videos/instagram/reel-6.mp4', href: 'https://www.instagram.com/p/DLA5ITEy_GH/?hl=es' },
] as const

type MapCoordinates = { lat: number; lng: number }

function AddressMap({ coordinates, onPick }: { coordinates: MapCoordinates | null; onPick: (coordinates: MapCoordinates) => void }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)
  const markerRef = useRef<L.Marker | null>(null)
  const initialCoordinatesRef = useRef(coordinates)
  const onPickRef = useRef(onPick)
  onPickRef.current = onPick

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return
    const defaultCenter: L.LatLngExpression = [10.2447, -67.5958]
    const initialCoordinates = initialCoordinatesRef.current
    const map = L.map(containerRef.current, { zoomControl: false, attributionControl: true }).setView(initialCoordinates ? [initialCoordinates.lat, initialCoordinates.lng] : defaultCenter, initialCoordinates ? 16 : 13)
    L.control.zoom({ position: 'bottomright' }).addTo(map)
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '&copy; OpenStreetMap', maxZoom: 19 }).addTo(map)
    map.on('click', event => onPickRef.current({ lat: event.latlng.lat, lng: event.latlng.lng }))
    mapRef.current = map
    setTimeout(() => map.invalidateSize(), 0)
    return () => { map.remove(); mapRef.current = null; markerRef.current = null }
  }, [])

  useEffect(() => {
    if (!mapRef.current || !coordinates) return
    const point: L.LatLngExpression = [coordinates.lat, coordinates.lng]
    mapRef.current.setView(point, Math.max(mapRef.current.getZoom(), 16), { animate: true })
    if (!markerRef.current) {
      markerRef.current = L.marker(point, { title: 'Ubicación seleccionada', icon: L.divIcon({ className: 'public-leaflet-pin', html: '<span></span>', iconSize: [30, 38], iconAnchor: [15, 38] }) }).addTo(mapRef.current)
    } else markerRef.current.setLatLng(point)
  }, [coordinates])

  return <div ref={containerRef} className="public-address-map" aria-label="Mapa interactivo. Toca para elegir tu ubicación" />
}

const CATEGORY_IMAGES = [
  '/optimized/login-carousel/slide1.webp', '/optimized/login-carousel/slide2.webp', '/optimized/login-carousel/slide3.webp',
  '/optimized/login-carousel/slide4.webp', '/optimized/login-carousel/slide5.webp', '/optimized/login-carousel/slide6.webp',
]
const FAVORITES_KEY = 'fullchina_public_favorites'
const CART_KEY = 'fullchina_public_cart'
const LAST_ORDER_KEY = 'fullchina_public_last_order'
const FLOW_STATE_KEY = 'fullchina_public_flow_state'
const CHECKOUT_ATTEMPT_KEY = 'fullchina_public_checkout_attempt'
const DESKTOP_TAB_KEY = 'fullchina_public_desktop_tab'

type DesktopTab = 'inicio' | 'menu' | 'promos' | 'contacto'

const readDesktopTab = (): DesktopTab => {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function' || !window.matchMedia('(min-width: 1024px)').matches) return 'inicio'
  try {
    const savedTab = localStorage.getItem(DESKTOP_TAB_KEY)
    return savedTab === 'menu' || savedTab === 'promos' || savedTab === 'contacto' ? savedTab : 'inicio'
  } catch {
    return 'inicio'
  }
}

// Métodos de pago que el cliente puede indicar en la web. Los códigos coinciden
// con los del sistema de cobro para poder pre-seleccionarlos en la comanda.
const PAY_OPTIONS = [
  { code: 'cash', label: 'Efectivo' },
  { code: 'mobile', label: 'Pago móvil' },
  { code: 'transfer', label: 'Transferencia' },
  { code: 'card', label: 'Punto' },
  { code: 'zelle', label: 'Zelle' },
  { code: 'binance', label: 'Binance' },
] as const
type PayMethod = (typeof PAY_OPTIONS)[number]['code']
const payLabel = (code: string) => PAY_OPTIONS.find((o) => o.code === code)?.label ?? code

/* Desplegable de pago personalizado (reemplaza el <select> nativo).
   No cambia la lógica: recibe el valor actual y notifica el cambio. */
function PayDropdown({ value, onChange }: { value: PayMethod; onChange: (v: PayMethod) => void }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('mousedown', onDoc); document.removeEventListener('keydown', onKey) }
  }, [open])
  return (
    <div className={`public-paydd ${open ? 'open' : ''}`} ref={ref}>
      <button type="button" className="public-paydd-trigger" onClick={() => setOpen(o => !o)} aria-haspopup="listbox" aria-expanded={open}>
        <span>{payLabel(value)}</span>
        <ChevronRight className="public-paydd-caret" size={18} aria-hidden="true" />
      </button>
      {open && (
        <ul className="public-paydd-menu" role="listbox">
          {PAY_OPTIONS.map(o => (
            <li
              key={o.code}
              role="option"
              aria-selected={o.code === value}
              className={`public-paydd-option ${o.code === value ? 'selected' : ''}`}
              onClick={() => { onChange(o.code); setOpen(false) }}
            >
              <span>{o.label}</span>
              {o.code === value && <Check size={16} aria-hidden="true" />}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

// Opciones públicas de personalización. Se envían como indicaciones a cocina;
// el cobro automático se habilitará cuando el RPC público exponga modifiers.
const PUBLIC_EXTRA_OPTIONS: ProductModifierGroup = {
  modifierId: 'public-extras',
  name: 'Extras',
  minSelections: 0,
  maxSelections: null,
  allowRepeat: false,
  options: [
    { id: 'extra-camaron', name: 'Extra camarón', price: 0 },
    { id: 'salsa-agridulce', name: 'Salsa agridulce', price: 0 },
    { id: 'extra-vegetales', name: 'Extra vegetales', price: 0 },
  ],
}

function productImage(category: string) {
  const sum = [...category].reduce((acc, char) => acc + char.charCodeAt(0), 0)
  return CATEGORY_IMAGES[sum % CATEGORY_IMAGES.length]
}

function optimizedProductImage(imageUrl: string | null | undefined) {
  if (!imageUrl) return null
  const match = imageUrl.match(/^\/productos\/([^/?#]+)\.(?:png|jpe?g|webp)([?#].*)?$/i)
  return match ? `/optimized/productos/${match[1]}.webp${match[2] || ''}` : imageUrl
}

function money(value: number) {
  return new Intl.NumberFormat('es-VE', { style: 'currency', currency: 'USD' }).format(value)
}

function productTitle(name: string) {
  // Keep the em dash with the variant that follows it. This lets the line
  // break happen before the dash instead of leaving a dangling dash above.
  return formatProductTitle(name).replace(/\s+—\s+/g, ' —\u00a0')
}

function cartProductName(name: string) {
  const parts = productTitle(name).split(/\s+—\s+/)
  if (parts.length > 1) return `${parts[0]}\n${parts.slice(1).join(' — ')}`
  const words = productTitle(name).split(/\s+/)
  if (words.length <= 3) return words.join(' ')
  return `${words.slice(0, 3).join(' ')}\n${words.slice(3).join(' ')}`
}

function cartLineKey(item: Pick<WebOrderCartItem, 'productId' | 'notes'>) {
  return `${item.productId}::${item.notes || ''}`
}

function readCheckoutAttempt(): { signature: string; key: string } | null {
  try {
    const saved = JSON.parse(sessionStorage.getItem(CHECKOUT_ATTEMPT_KEY) || 'null') as { signature?: string; key?: string } | null
    return saved?.signature && saved.key ? { signature: saved.signature, key: saved.key } : null
  } catch { return null }
}

export function PublicMenu() {
  const designMode = new URLSearchParams(window.location.search).get('modo') === 'diseno'
  const [products, setProducts] = useState<Product[]>([])
  const [cart, setCart] = useState<WebOrderCartItem[]>(() => {
    try { return JSON.parse(localStorage.getItem(CART_KEY) || '[]') as WebOrderCartItem[] } catch { return [] }
  })
  const [selectedGroup, setSelectedGroup] = useState<MenuProductGroup | null>(null)
  const [closingDetail, setClosingDetail] = useState(false)
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(null)
  const [detailQuantity, setDetailQuantity] = useState(1)
  const [detailNotes, setDetailNotes] = useState('')
  const [detailModifierGroups, setDetailModifierGroups] = useState<ProductModifierGroup[]>([])
  const [selectedExtras, setSelectedExtras] = useState<string[]>([])
  const [activeCategory, setActiveCategory] = useState('Todos')
  const [search, setSearch] = useState('')
  const [closingSearch, setClosingSearch] = useState(false)
  const [favoriteIds, setFavoriteIds] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem(FAVORITES_KEY) || '[]') as string[] } catch { return [] }
  })
  const [showFavorites, setShowFavorites] = useState(false)
  const [showAllExtras, setShowAllExtras] = useState(false)
  const [extrasSearch, setExtrasSearch] = useState('')
  const [showSearch, setShowSearch] = useState(false)
  const [cartOpen, setCartOpen] = useState(false)
  const [closingCart, setClosingCart] = useState(false)
  const [step, setStep] = useState<'cart' | 'delivery' | 'address' | 'details' | 'confirm' | 'preparing' | 'sent'>('cart')
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [orderType, setOrderType] = useState<'takeaway' | 'delivery'>('takeaway')
  const [payMode, setPayMode] = useState<'single' | 'mixed'>('single')
  const [payPrimary, setPayPrimary] = useState<PayMethod>('cash')
  const [paySecondary, setPaySecondary] = useState<PayMethod>('mobile')
  const [deliveryChosen, setDeliveryChosen] = useState(false)
  const [address, setAddress] = useState('')
  const [addressReference, setAddressReference] = useState('')
  const [addressSuggestions, setAddressSuggestions] = useState<Array<{ display_name: string; lat: string; lon: string }>>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [searchingAddress, setSearchingAddress] = useState(false)
  const [geoCoords, setGeoCoords] = useState<{ lat: number; lng: number } | null>(null)
  const [locating, setLocating] = useState(false)
  const [addressMethod, setAddressMethod] = useState<'gps' | 'map' | 'search' | null>(null)
  const [addressError, setAddressError] = useState('')
  const addressRef = useRef<HTMLInputElement>(null)
  const addressSearchTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [notes, setNotes] = useState('')
  const [bcvRate, setBcvRate] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  // Al aparecer un error de validación, subir la tarjeta al tope para que se vea
  useEffect(() => {
    if (!error) return
    document.querySelector('.public-cart-drawer')?.scrollTo({ top: 0, behavior: 'smooth' })
  }, [error])
  const [cartGuardMessage, setCartGuardMessage] = useState('')
  const restoringFlow = useRef(true)
  const [orderCode, setOrderCode] = useState('')
  const [draftOrderCode, setDraftOrderCode] = useState('')
  const [whatsappUrl, setWhatsappUrl] = useState('')
  const [addFeedback, setAddFeedback] = useState<{ name: string; imageUrl?: string } | null>(null)
  const [cartPulse, setCartPulse] = useState(false)
  const addFeedbackTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const cartPulseTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const submitLockRef = useRef(false)
  const checkoutAttemptRef = useRef<{ signature: string; key: string } | null>(readCheckoutAttempt())
  const [lastOrder, setLastOrder] = useState<WebOrderCartItem[]>(() => {
    try { return JSON.parse(localStorage.getItem(LAST_ORDER_KEY) || '[]') as WebOrderCartItem[] } catch { return [] }
  })
  const [currentTab, setCurrentTab] = useState<DesktopTab>(readDesktopTab)

  useEffect(() => {
    if (typeof window.matchMedia !== 'function' || !window.matchMedia('(min-width: 1024px)').matches) return
    try { localStorage.setItem(DESKTOP_TAB_KEY, currentTab) } catch { /* storage unavailable */ }
  }, [currentTab])

  useEffect(() => {
    if (designMode) {
      setProducts([])
      setBcvRate(null)
      setLoading(false)
      window.__removeFCSplash?.()
      return
    }
    Promise.all([getPublicCatalog(), getExchangeRates(), getPublicMenuCategories().catch(() => [])])
      .then(([catalog, rates, cats]) => {
        if (cats.length) hydrateMenuCategories(cats)
        // Respeta la categoría guardada si ya es válida; si no, la deduce por nombre.
        const resolveCategory = (p: { name: string; category: string }) =>
          p.category !== 'otros' && isKnownCategory(p.category) ? p.category : classifyMenuCategory(p.name, p.category)
        setProducts(catalog.map(p => ({ ...p, category: resolveCategory(p) }))
          .sort((a, b) => {
            const categoryDelta = menuCategoryRank(a.category) - menuCategoryRank(b.category)
            return categoryDelta || menuItemRank(a.name, a.category) - menuItemRank(b.name, b.category)
          }))
        setBcvRate(rates.bcv || null)
      })
      .catch(() => setError('No pudimos cargar el menú. Intenta nuevamente.'))
      .finally(() => {
        setLoading(false)
        window.__removeFCSplash?.()
      })
  }, [designMode])

  const categories = useMemo(() => {
    const extracted = Array.from(new Set(products.map(p => p.category)));
    extracted.sort((a, b) => menuCategoryRank(a) - menuCategoryRank(b));
    return ['Todos', ...extracted];
  }, [products]);
  const groups = useMemo(() => groupMenuProducts(products.filter(product => {
    const categoryMatch = activeCategory === 'Todos' || product.category === activeCategory
    const term = search.trim().toLowerCase()
    return categoryMatch && (!term || `${product.name} ${product.description || ''}`.toLowerCase().includes(term))
  })), [products, activeCategory, search])
  const visibleGroups = useMemo(() => showFavorites ? groups.filter(group => favoriteIds.includes(group.key)) : groups, [groups, showFavorites, favoriteIds])
  const popularGroups = useMemo(() => {
    const all = groupMenuProducts(products)
    return all.slice(0, 4)
  }, [products])
  const promoGroups = useMemo(() => {
    const promoItems = products.filter(p => 
      p.category.toLowerCase().includes('promo') || 
      p.category.toLowerCase().includes('combo') ||
      p.name.toLowerCase().includes('combo') ||
      p.name.toLowerCase().includes('promo') ||
      p.category.toLowerCase().includes('ejecutivo') ||
      p.category.toLowerCase().includes('individual')
    )
    return (promoItems.length > 0 ? groupMenuProducts(promoItems) : groupMenuProducts(products)).slice(0, 4)
  }, [products])

  const [cardQtys, setCardQtys] = useState<Record<string, number>>({})
  const getCardQty = (key: string) => cardQtys[key] || 1
  const changeCardQty = (key: string, delta: number) => setCardQtys(prev => ({ ...prev, [key]: Math.max(1, (prev[key] || 1) + delta) }))
  
  const handleCardAdd = (group: MenuProductGroup) => {
    const qty = getCardQty(group.key)
    if (group.isGrouped && group.variants.length > 1) {
      openGroup(group)
    } else {
      const product = group.variants[0]?.product
      if (product) {
        addProduct(product, qty)
        setCardQtys(prev => ({ ...prev, [group.key]: 1 }))
      }
    }
  }
  const categorySections = useMemo(() => categories
    .filter(category => category !== 'Todos')
    .map(category => ({ category, groups: visibleGroups.filter(group => group.category === category) }))
    .filter(section => section.groups.length > 0), [categories, visibleGroups])
  const recommendedGroup = groups.find(group => group.name.toLowerCase().includes('full kilo')) ?? groups[0]
  const isStoreOpen = (() => {
    const hour = new Date().getHours()
    return hour >= 11 && hour < 22
  })()
  const itemCount = cart.reduce((sum, item) => sum + item.quantity, 0)
  const total = cart.reduce((sum, item) => sum + item.price * item.quantity, 0)
  const cartProductIds = new Set(cart.map(item => item.productId))
  const recommendations = groups.filter(group => !group.variants.some(variant => cartProductIds.has(variant.product.id))).slice(0, 3)
  const allExtras = groups.filter(group => !group.variants.some(variant => cartProductIds.has(variant.product.id)))
  const extrasSections = useMemo(() => {
    const query = extrasSearch.trim().toLocaleLowerCase()
    const filtered = allExtras.filter(group => !query || `${group.name} ${group.category}`.toLocaleLowerCase().includes(query))
    const sections = new Map<string, MenuProductGroup[]>()
    filtered.forEach(group => sections.set(group.category, [...(sections.get(group.category) || []), group]))
    return Array.from(sections.entries())
  }, [allExtras, extrasSearch])

  useEffect(() => {
    try {
      if (designMode) {
        setCartOpen(true)
        setStep('preparing')
        restoringFlow.current = false
        return
      }
      const saved = JSON.parse(localStorage.getItem(FLOW_STATE_KEY) || 'null') as Partial<{ cartOpen: boolean; step: string; name: string; phone: string; email: string; orderType: 'takeaway' | 'delivery'; deliveryChosen: boolean; address: string; addressReference: string; notes: string; geoCoords: MapCoordinates; addressMethod: 'gps' | 'map' | 'search' }> | null
      if (saved && cart.length > 0) {
        setName(saved.name || '')
        setPhone(saved.phone || '')
        setEmail(saved.email || '')
        setOrderType(saved.orderType === 'delivery' ? 'delivery' : 'takeaway')
        setDeliveryChosen(Boolean(saved.deliveryChosen))
        setAddress(saved.address || '')
        setAddressReference(saved.addressReference || '')
        setNotes(saved.notes || '')
        setGeoCoords(saved.geoCoords || null)
        setAddressMethod(saved.addressMethod || null)
        if (saved.cartOpen) {
          setCartOpen(true)
          setStep(saved.step === 'delivery' || saved.step === 'address' || saved.step === 'details' ? saved.step : 'cart')
        }
      }
    } catch { /* ignore malformed local flow state */ }
    restoringFlow.current = false
  }, [cart.length, designMode])
  useEffect(() => { localStorage.setItem(CART_KEY, JSON.stringify(cart)) }, [cart])
  useEffect(() => { localStorage.setItem(FAVORITES_KEY, JSON.stringify(favoriteIds)) }, [favoriteIds])
  useEffect(() => {
    if (restoringFlow.current) return
    localStorage.setItem(FLOW_STATE_KEY, JSON.stringify({ cartOpen, step, name, phone, email, orderType, deliveryChosen, address, addressReference, notes, geoCoords, addressMethod }))
  }, [cartOpen, step, name, phone, email, orderType, deliveryChosen, address, addressReference, notes, geoCoords, addressMethod])

  const toggleFavorite = (groupKey: string) => setFavoriteIds(current => current.includes(groupKey) ? current.filter(id => id !== groupKey) : [...current, groupKey])
  const repeatLastOrder = () => {
    if (!lastOrder.length) return
    setCart(lastOrder)
    setClosingCart(false)
    setCartOpen(true)
    setStep('cart')
  }
  const startNewOrder = () => {
    setCart([])
    setName('')
    setPhone('')
    setEmail('')
    setOrderType('takeaway')
    setDeliveryChosen(false)
    setAddress('')
    setAddressReference('')
    setGeoCoords(null)
    setAddressMethod(null)
    setNotes('')
    setError('')
    setOrderCode('')
    setDraftOrderCode('')
    checkoutAttemptRef.current = null
    try {
      localStorage.removeItem(CART_KEY)
      localStorage.removeItem(FLOW_STATE_KEY)
      sessionStorage.removeItem(CHECKOUT_ATTEMPT_KEY)
    } catch { /* storage unavailable */ }
    closeCart()
  }
  const closeCart = () => {
    if (!cartOpen || closingCart) return
    setClosingCart(true)
    window.setTimeout(() => {
      setCartOpen(false)
      setClosingCart(false)
    }, 240)
  }
  const requireCart = () => {
    if (cart.length > 0) return true
    setCartGuardMessage('Agrega un producto para continuar.')
    window.setTimeout(() => setCartGuardMessage(''), 3200)
    return false
  }
  const closeSearch = () => {
    setClosingSearch(true)
    window.setTimeout(() => {
      setShowSearch(false)
      setClosingSearch(false)
      setSearch('')
    }, 180)
  }

  const addProduct = (product: Product, quantity = 1, notes = '') => {
    const imageUrl = optimizedProductImage(product.imageUrl) || undefined
    setAddFeedback({ name: formatProductTitle(product.name), imageUrl })
    setCartPulse(true)
    if (addFeedbackTimer.current) window.clearTimeout(addFeedbackTimer.current)
    if (cartPulseTimer.current) window.clearTimeout(cartPulseTimer.current)
    addFeedbackTimer.current = setTimeout(() => setAddFeedback(null), 1800)
    cartPulseTimer.current = setTimeout(() => setCartPulse(false), 520)
    setCart(current => {
      const existing = current.find(item => item.productId === product.id && (item.notes || '') === notes)
      return existing
        ? current.map(item => item.productId === product.id && (item.notes || '') === notes ? { ...item, quantity: item.quantity + quantity } : item)
        : [...current, { productId: product.id, productName: formatProductTitle(product.name), price: product.price, quantity, imageUrl, notes: notes || undefined }]
    })
    closeProductDetail()
  }

  const [deletingKeys, setDeletingKeys] = useState<string[]>([])
  const updateQuantity = (productId: string, delta: number, notes = '') => setCart(current => current
    .map(item => item.productId === productId && (item.notes || '') === notes ? { ...item, quantity: item.quantity + delta } : item)
    .filter(item => item.quantity > 0))

  const handleRemoveSidebarItem = (productId: string, qty: number, notes = '') => {
    const key = `${productId}-${notes}`
    setDeletingKeys(prev => [...prev, key])
    window.setTimeout(() => {
      updateQuantity(productId, -qty, notes)
      setDeletingKeys(prev => prev.filter(k => k !== key))
    }, 220)
  }

  const closeProductDetail = () => {
    if (!selectedGroup || closingDetail) return
    setClosingDetail(true)
    window.setTimeout(() => {
      setSelectedGroup(null)
      setClosingDetail(false)
      setSelectedVariantId(null)
      setDetailQuantity(1)
      setDetailNotes('')
      setDetailModifierGroups([])
      setSelectedExtras([])
    }, 220)
  }

  const openGroup = (group: MenuProductGroup) => {
    setClosingDetail(false)
    setSelectedGroup(group)
    setSelectedVariantId(group.variants[0]?.product.id ?? null)
    setDetailQuantity(1)
    setDetailNotes('')
    setSelectedExtras([])
    setDetailModifierGroups([PUBLIC_EXTRA_OPTIONS])
    const productId = group.variants[0]?.product.id
    if (productId) {
      getProductModifiers(productId)
        .then(groups => setDetailModifierGroups(groups.filter(item => item.minSelections === 0).length > 0 ? groups.filter(item => item.minSelections === 0) : [PUBLIC_EXTRA_OPTIONS]))
        .catch(() => setDetailModifierGroups([PUBLIC_EXTRA_OPTIONS]))
    }
  }

  const selectedProduct = selectedGroup?.variants.find(({ product }) => product.id === selectedVariantId)?.product
    ?? selectedGroup?.variants[0]?.product

  const addSelectedProduct = () => {
    if (selectedProduct) {
      const extras = detailModifierGroups.flatMap(group => group.options.filter(option => selectedExtras.includes(option.id)).map(option => option.name))
      const lineNotes = [extras.length ? `Extras: ${extras.join(', ')}` : '', detailNotes.trim()].filter(Boolean).join(' · ')
      addProduct(selectedProduct, detailQuantity, lineNotes)
    }
  }

  const useMyLocation = () => {
    if (!navigator.geolocation) return setError('Tu navegador no soporta geolocalización.')
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude: lat, longitude: lng } = pos.coords
        setGeoCoords({ lat, lng })
        setAddressMethod('gps')
        setAddressError('')
        try {
          const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&addressdetails=1`, {
            headers: { 'Accept-Language': 'es' }
          })
          const data = await res.json()
          if (data.display_name) {
            setAddress(data.display_name.length > 120 ? data.display_name.substring(0, 120) + '…' : data.display_name)
            setShowSuggestions(false)
          }
        } catch { /* silently keep coordinates */ }
        setLocating(false)
      },
      () => { setLocating(false); setError('No pudimos ubicarte automáticamente. Puedes buscar tu dirección o elegirla directamente en el mapa.') },
      { enableHighAccuracy: true, timeout: 10000 }
    )
  }

  const searchAddress = (query: string) => {
    setAddress(query)
    setShowSuggestions(true)
    setGeoCoords(null)
    setAddressMethod(null)
    setAddressError('')
    if (addressSearchTimer.current) clearTimeout(addressSearchTimer.current)
    if (query.trim().length < 4) { setAddressSuggestions([]); setSearchingAddress(false); return }
    addressSearchTimer.current = setTimeout(async () => {
      setSearchingAddress(true)
      try {
        const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&countrycodes=ve&limit=5`, {
          headers: { 'Accept-Language': 'es' }
        })
        const data = await res.json()
        if (Array.isArray(data) && data.length > 0) setAddressSuggestions(data)
        else {
          const fallback = await fetch(`https://photon.komoot.io/api/?q=${encodeURIComponent(query)}&limit=5`)
          const photon = await fallback.json() as { features?: Array<{ geometry: { coordinates: [number, number] }; properties: Record<string, string> }> }
          setAddressSuggestions((photon.features || []).map(feature => ({
            lat: String(feature.geometry.coordinates[1]), lon: String(feature.geometry.coordinates[0]),
            display_name: [feature.properties.name, feature.properties.city, feature.properties.state].filter(Boolean).join(', ')
          })))
        }
      } catch { setAddressSuggestions([]) }
      finally { setSearchingAddress(false) }
    }, 350)
  }

  useEffect(() => () => { if (addressSearchTimer.current) clearTimeout(addressSearchTimer.current) }, [])

  const selectSuggestion = (s: { display_name: string; lat: string; lon: string }) => {
    setAddress(s.display_name.length > 120 ? s.display_name.substring(0, 120) + '…' : s.display_name)
    setGeoCoords({ lat: parseFloat(s.lat), lng: parseFloat(s.lon) })
    setAddressMethod('search')
    setAddressError('')
    setShowSuggestions(false)
    setAddressSuggestions([])
  }

  const selectMapLocation = async (coordinates: MapCoordinates) => {
    setGeoCoords(coordinates)
    setAddressMethod('map')
    setAddressError('')
    setShowSuggestions(false)
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${coordinates.lat}&lon=${coordinates.lng}&addressdetails=1`, { headers: { 'Accept-Language': 'es' } })
      const data = await res.json() as { display_name?: string }
      if (data.display_name) setAddress(data.display_name.length > 120 ? `${data.display_name.substring(0, 120)}…` : data.display_name)
    } catch {
      setAddress(`Ubicación seleccionada (${coordinates.lat.toFixed(5)}, ${coordinates.lng.toFixed(5)})`)
    }
  }

  const continueFromAddress = () => {
    if (address.trim().length < 8) return setAddressError('Escribe una dirección o toca un punto del mapa para seleccionarla.')
    if (!geoCoords) return setAddressError('Confirma la ubicación tocando el mapa o eligiendo una sugerencia.')
    if (orderType === 'delivery' && !addressReference.trim()) return setAddressError('Agrega una referencia para que el repartidor encuentre el lugar fácilmente.')
    setAddressError('')
    setStep('details')
  }

  const continueToConfirmation = () => {
    setError('')
    if (name.trim().length < 2) return setError('Escribe tu nombre.')
    if (phone.replace(/\D/g, '').length < 7) return setError('Escribe un teléfono válido.')
    if (orderType === 'delivery' && address.trim().length < 8) return setError('Escribe la dirección de entrega.')
    if (orderType === 'delivery' && !geoCoords) return setError('Confirma la ubicación tocando el mapa o eligiendo una sugerencia.')
    if (orderType === 'delivery' && !addressReference.trim()) return setError('Agrega una referencia para que el repartidor encuentre el lugar fácilmente.')
    if (!cart.length) return setError('Tu carrito está vacío.')
    if (!draftOrderCode) setDraftOrderCode(`WEB-${crypto.randomUUID().slice(0, 6).toUpperCase()}`)
    setStep('confirm')
  }

  const submitOrder = async () => {
    if (submitLockRef.current || submitting) return
    if (designMode) {
      setError('')
      setOrderCode('WEB-DEMO')
      setSubmitting(false)
      setStep('preparing')
      return
    }
    setError('')
    if (name.trim().length < 2) return setError('Escribe tu nombre.')
    if (phone.replace(/\D/g, '').length < 7) return setError('Escribe un teléfono válido.')
    if (orderType === 'delivery' && address.trim().length < 8) return setError('Escribe la dirección de entrega.')
    if (!cart.length) return setError('Tu carrito está vacío.')

    const lineNotes = cart.filter(item => item.notes).map(item => `${item.productName}: ${item.notes}`).join(' | ')
    // El link de Google Maps con las coordenadas va en su propia línea para que
    // Comandas lo muestre como "Ver ubicación" (y lo limpie del texto de notas).
    const mapsLine = orderType === 'delivery' && geoCoords
      ? `\nUbicación GPS: https://maps.google.com/?q=${geoCoords.lat},${geoCoords.lng}`
      : ''
    // Método de pago que el cliente indica. Va en su propia línea con códigos
    // para que Comandas lo pre-seleccione al cobrar (y lo limpie del texto).
    const paymentCodes = payMode === 'mixed' ? `${payPrimary}+${paySecondary}` : payPrimary
    const paymentLabels = payMode === 'mixed' ? `${payLabel(payPrimary)} + ${payLabel(paySecondary)}` : payLabel(payPrimary)
    const payLine = `\nPago preferido: ${paymentCodes}`
    const orderNotes = [addressReference.trim() ? `Referencia: ${addressReference.trim()}` : '', notes.trim(), lineNotes ? `Personalizaciones: ${lineNotes}` : ''].filter(Boolean).join(' · ').slice(0, 400) + mapsLine + payLine
    const checkoutSignature = JSON.stringify({
      cart: cart.map(item => ({ productId: item.productId, quantity: item.quantity, price: item.price, notes: item.notes || '' })),
      name: name.trim(), phone: phone.trim(), orderType, address: address.trim(), orderNotes,
    })
    const savedAttempt = checkoutAttemptRef.current?.signature === checkoutSignature ? checkoutAttemptRef.current : null
    const idempotencyKey = savedAttempt?.key || crypto.randomUUID()
    checkoutAttemptRef.current = { signature: checkoutSignature, key: idempotencyKey }
    try { sessionStorage.setItem(CHECKOUT_ATTEMPT_KEY, JSON.stringify(checkoutAttemptRef.current)) } catch { /* storage unavailable */ }
    submitLockRef.current = true
    setSubmitting(true)
    setStep('preparing')
    // Abrir la pestaña inmediatamente conserva el gesto del usuario y evita
    // que el navegador bloquee WhatsApp después de la respuesta del servidor.
    // OJO: sin 'noopener' a propósito — con noopener window.open devuelve null
    // y no podríamos redirigir la pestaña a WhatsApp (se quedaría en blanco).
    const whatsappWindow = window.open('about:blank', '_blank')
    try {
      const result = await createWebOrder({
        customerName: name.trim(), customerPhone: phone.trim(), orderType,
        deliveryAddress: address.trim(), notes: orderNotes, items: cart, bcvRate,
        idempotencyKey,
      })
      localStorage.setItem(LAST_ORDER_KEY, JSON.stringify(cart))
      checkoutAttemptRef.current = null
      try { sessionStorage.removeItem(CHECKOUT_ATTEMPT_KEY) } catch { /* storage unavailable */ }
      setLastOrder(cart)
      setOrderCode(result.code)
      const separator = '━━━━━━━━━━━━━━'
      const itemLines = cart.flatMap(item => [
        `• *${item.quantity}x ${item.productName}* — ${money(item.price * item.quantity)}`,
        ...(item.notes ? [`  _${item.notes}_`] : []),
        '',
      ])
      const customerLines = [
        `Nombre: ${name.trim()}`,
        `Teléfono: ${phone.trim()}`,
        `💳 Pago: ${paymentLabels}`,
        `Modalidad: ${orderType === 'delivery' ? '🛵 Delivery' : '🥡 Retiro en el local'}`,
        ...(orderType === 'delivery' ? ['', `🏠 ${address.trim()}`] : []),
        ...(orderType === 'delivery' && addressReference.trim() ? [`Referencia: ${addressReference.trim()}`] : []),
        ...(orderType === 'delivery' && geoCoords ? ['', '📍 Ubicación:', `https://maps.google.com/?q=${geoCoords.lat},${geoCoords.lng}`] : []),
      ]
      const message = [
        '¡Hola, Full China! 👋🏻',
        `Quiero confirmar mi pedido *${result.code}*.`,
        '',
        separator,
        '*🥡 RESUMEN DEL PEDIDO*',
        '',
        ...itemLines,
        separator,
        '*💰 RESUMEN DE PAGO*',
        '',
        `Subtotal: ${money(result.total)}`,
        `Delivery: ${orderType === 'delivery' ? 'Por confirmar' : 'No aplica'}`,
        `*Total productos: ${money(result.total)}*`,
        ...(bcvRate ? [`*Referencia BCV: Bs. ${(result.total * bcvRate).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}*`] : []),
        '',
        separator,
        '*👤 DATOS DEL CLIENTE*',
        '',
        ...customerLines,
        ...(notes.trim() ? ['', separator, '*📝 INDICACIONES*', '', notes.trim()] : []),
        '',
        separator,
        '☝🏻 Envía este mensaje para que podamos confirmar tu pedido.',
      ].join('\n')
      const configuredPhone = String(import.meta.env.VITE_FULLCHINA_WHATSAPP || '').replace(/\D/g, '')
      if (configuredPhone.length < 7) throw new Error('WhatsApp no está configurado todavía. Completa VITE_FULLCHINA_WHATSAPP para continuar.')
      const whatsappUrl = `https://wa.me/${configuredPhone}?text=${encodeURIComponent(message)}`
      setWhatsappUrl(whatsappUrl)
      if (whatsappWindow) whatsappWindow.location.href = whatsappUrl
      setStep('sent')
    } catch (cause) {
      whatsappWindow?.close()
      setError(cause instanceof Error ? cause.message : 'No pudimos registrar el pedido.')
      setStep('confirm')
    } finally {
      submitLockRef.current = false
      setSubmitting(false)
    }
  }

  if (loading) return <PublicMenuSkeleton />

  // Monto en Bs (referencia) calculado con la tasa BCV actual. null si no hay tasa.
  const priceBs = (usd: number) =>
    bcvRate ? `Bs. ${(usd * bcvRate).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : null

  const configuredPhone = String(import.meta.env.VITE_FULLCHINA_WHATSAPP || '').replace(/\D/g, '')

  const handleAddCombo = () => {
    const comboGroup = groups.find(g => 
      g.name.toLowerCase().includes('todos') || 
      g.name.toLowerCase().includes('pana') || 
      g.name.toLowerCase().includes('combo') || 
      g.category === 'combos'
    ) || popularGroups[0]

    if (comboGroup && comboGroup.variants[0]) {
      addProduct(comboGroup.variants[0].product, 1)
    }
  }

  const renderProductCard = (group: MenuProductGroup, priority = false) => {
    const isPopular = group.category.toLowerCase().includes('popular') || group.category === 'Todos' || group.minPrice > 20
    const isSpicy = group.name.toLowerCase().includes('saltado') || group.name.toLowerCase().includes('picante')
    const badgeLabel = isSpicy ? 'Picante' : isPopular ? 'Más pedido' : null

    return (
      <article className="public-prod-card" key={group.key} onClick={() => openGroup(group)} role="button" tabIndex={0} onKeyDown={event => event.key === 'Enter' && openGroup(group)}>
        <div className="public-prod-img-wrap">
          <img src={optimizedProductImage(group.variants[0]?.product.imageUrl) || productImage(group.category)} className="public-prod-img" alt={group.name} loading={priority ? 'eager' : 'lazy'} fetchPriority={priority ? 'high' : 'auto'} decoding="async" />
          {badgeLabel && (
            <span className={`public-prod-tag ${isSpicy ? 'spicy' : 'popular'}`}>
              <span className="mobile-only">{isSpicy ? '🌶️ Picante' : '🔥 Más pedido'}</span>
              <span className="desktop-only public-prod-tag-vector"><Flame size={12} aria-hidden="true" />{badgeLabel}</span>
            </span>
          )}
          <button type="button" className={`public-favorite-btn ${favoriteIds.includes(group.key) ? 'active' : ''}`} onClick={event => { event.stopPropagation(); toggleFavorite(group.key) }} aria-label={favoriteIds.includes(group.key) ? `Quitar ${group.name} de favoritos` : `Guardar ${group.name} en favoritos`}><Heart size={16} fill={favoriteIds.includes(group.key) ? 'currentColor' : 'none'} /></button>
        </div>
        <div className="public-prod-info">
          <h3 className="public-prod-title">{productTitle(group.name)}</h3>
          <p className="public-prod-desc">{group.isGrouped ? getEditorialDescription(group.name, group.variants.map(item => formatSpanishText(item.label)).join(' • ')) : getEditorialDescription(group.variants[0].product.name, group.variants[0].product.description || '')}</p>
          <div className="public-prod-footer-row">
            <div className="public-prod-price-wrap">
              <span className="public-prod-price">{group.isGrouped && group.minPrice !== group.maxPrice ? 'Desde ' : ''}{money(group.minPrice)}</span>
              {priceBs(group.minPrice) && <span className="public-prod-price-bs">{priceBs(group.minPrice)}</span>}
            </div>
            <button className="public-prod-add" aria-label={`Agregar ${group.name} al carrito`} onClick={(e) => { e.stopPropagation(); const defaultProduct = group.variants[0]?.product; if (defaultProduct) addProduct(defaultProduct) }}>
              <span>Agregar</span>
              <ShoppingCart size={15} />
            </button>
          </div>
        </div>
      </article>
    )
  }

  const renderDesktopProductCard = (group: MenuProductGroup, index: number) => {
    const badges = [
      { label: 'Más pedido', color: 'badge-red' },
      { label: 'Favorito', color: 'badge-amber' },
      { label: 'Popular', color: 'badge-gold' },
      { label: 'Nuevo', color: 'badge-green' },
    ]
    const badge = badges[index % badges.length]
    const qty = getCardQty(group.key)

    return (
      <article className="public-home-product-card" key={group.key} onClick={() => openGroup(group)} role="button" tabIndex={0} onKeyDown={event => event.key === 'Enter' && openGroup(group)}>
        <div className="public-home-prod-img-wrap">
          <span className={`public-home-prod-badge ${badge.color}`}>{badge.label}</span>
          <img 
            src={optimizedProductImage(group.variants[0]?.product.imageUrl) || productImage(group.category)} 
            alt={group.name} 
            loading="lazy" 
            decoding="async" 
          />
          <button 
            type="button" 
            className={`public-home-fav-btn ${favoriteIds.includes(group.key) ? 'active' : ''}`}
            onClick={(e) => { e.stopPropagation(); toggleFavorite(group.key) }}
            aria-label="Favorito"
          >
            <Heart size={16} fill={favoriteIds.includes(group.key) ? 'currentColor' : 'none'} />
          </button>
        </div>

        <div className="public-home-prod-body">
          <h3 className="public-home-prod-title">{productTitle(group.name)}</h3>
          <p className="public-home-prod-desc">
            {group.isGrouped ? getEditorialDescription(group.name, group.variants.map(item => formatSpanishText(item.label)).join(' • ')) : getEditorialDescription(group.variants[0].product.name, group.variants[0].product.description || '')}
          </p>

          <div className="public-home-prod-price-wrap">
            <span className="public-home-prod-price">
              {group.isGrouped && group.minPrice !== group.maxPrice ? 'Desde ' : ''}{money(group.minPrice)}
            </span>
            {priceBs(group.minPrice) && <span className="public-home-prod-price-bs">{priceBs(group.minPrice)}</span>}
          </div>

          <div className="public-home-prod-actions" onClick={(e) => e.stopPropagation()}>
            <div className="public-home-stepper">
              <button type="button" onClick={() => changeCardQty(group.key, -1)} aria-label="Disminuir">
                <Minus size={13} />
              </button>
              <span>{qty}</span>
              <button type="button" onClick={() => changeCardQty(group.key, 1)} aria-label="Aumentar">
                <Plus size={13} />
              </button>
            </div>
            <button 
              type="button" 
              className="public-home-add-btn"
              onClick={() => handleCardAdd(group)}
            >
              Agregar
            </button>
          </div>
        </div>
      </article>
    )
  }

  const renderDesktopPromoCard = (group: MenuProductGroup, index: number) => {
    const promoSavingsList = [15.00, 8.00, 10.00, 6.00]
    const savingAmount = promoSavingsList[index % promoSavingsList.length]
    const originalPrice = group.minPrice + savingAmount

    return (
      <article className="public-home-promo-card" key={group.key} onClick={() => openGroup(group)} role="button" tabIndex={0} onKeyDown={event => event.key === 'Enter' && openGroup(group)}>
        <div className="public-home-promo-top">
          <h3 className="public-home-promo-title">{productTitle(group.name)}</h3>
          <div className="public-home-promo-price-row">
            <span className="public-home-promo-price">{money(group.minPrice)}</span>
            <span className="public-home-promo-old-price">{money(originalPrice)}</span>
          </div>
          <div className="public-home-promo-savings">
            <span>Ahorras {money(savingAmount)}</span>
          </div>
        </div>

        <div className="public-home-promo-img-wrap">
          <img 
            src={optimizedProductImage(group.variants[0]?.product.imageUrl) || productImage(group.category)} 
            alt={group.name} 
            loading="lazy" 
            decoding="async" 
          />
        </div>

        <div className="public-home-promo-footer" onClick={(e) => e.stopPropagation()}>
          <button 
            type="button" 
            className="public-home-promo-add-btn"
            onClick={() => handleCardAdd(group)}
          >
            <Plus size={15} />
            <span>Pedir promo</span>
          </button>
        </div>
      </article>
    )
  }

  return (
    <main className="public-menu-page">
      {/* Top Navbar */}
      <header className="public-top-bar" id="inicio">
        {showSearch ? (
          <div className={`public-search-active-overlay ${closingSearch ? 'closing' : ''}`}>
            <div className="public-search-pill">
              <Search size={20} color="#FFD666" />
              <input 
                autoFocus 
                placeholder="Busca Arroz, combos, pollo..." 
                value={search} 
                onChange={e => setSearch(e.target.value)} 
              />
              {search && <button className="public-search-clear" onClick={() => setSearch('')}><X size={16}/></button>}
            </div>
            <button className="public-search-cancel" onClick={closeSearch}>
              Cancelar
            </button>
          </div>
        ) : (
          <>
            {/* Mobile: Search on Left */}
            <button className="public-top-bar-action-btn mobile-only" onClick={() => setShowSearch(true)} aria-label="Buscar en el menú">
              <Search size={24} />
            </button>

            {/* Logo */}
            <div className="public-top-bar-left">
              <img src="/optimized/root/logo.webp" alt="Full China" className="public-top-bar-logo" decoding="async" />
            </div>

            {/* Desktop Center Navigation Tabs */}
            <nav className="public-desktop-nav-links desktop-only" aria-label="Navegación principal">
              <button 
                type="button" 
                className={`public-nav-tab-btn ${currentTab === 'inicio' ? 'active' : ''}`} 
                onClick={() => { setCurrentTab('inicio'); window.scrollTo({ top: 0, behavior: 'smooth' }) }}>
                Inicio
              </button>
              <button 
                type="button" 
                className={`public-nav-tab-btn ${currentTab === 'menu' ? 'active' : ''}`} 
                onClick={() => { setCurrentTab('menu'); window.scrollTo({ top: 0, behavior: 'smooth' }) }}>
                Menú
              </button>
              <button 
                type="button" 
                className={`public-nav-tab-btn ${currentTab === 'promos' ? 'active' : ''}`} 
                onClick={() => { setCurrentTab('promos'); window.scrollTo({ top: 0, behavior: 'smooth' }) }}>
                Promos
              </button>
              <button 
                type="button" 
                className={`public-nav-tab-btn ${currentTab === 'contacto' ? 'active' : ''}`} 
                onClick={() => { setCurrentTab('contacto'); window.scrollTo({ top: 0, behavior: 'smooth' }) }}>
                Contacto
              </button>
            </nav>

            {/* Desktop Right Status Badges */}
            <div className="public-top-bar-right desktop-only">
              <div className="public-nav-status-badges">
                <div className="public-nav-status-pill">
                  <span className="public-nav-status-dot" />
                  <span>Abierto hoy</span>
                </div>
                {bcvRate && (
                  <div className="public-nav-bcv-pill" title="Tasa oficial del Banco Central de Venezuela">
                    <span className="public-nav-bcv-label">Dólar BCV</span>
                    <span className="public-nav-bcv-val">Bs. {bcvRate.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Mobile: Cart on Right */}
            <button className="public-top-bar-action-btn mobile-only" onClick={() => { setCartOpen(true); setStep('cart') }}>
              <ShoppingCart size={24} />
              {itemCount > 0 && <span className="public-cart-badge">{itemCount}</span>}
            </button>
          </>
        )}
      </header>

      {/* =========================================================================
          MOBILE VIEWPORT (< 1024px) — 100% ORIGINAL f88d057 LAYOUT
          ========================================================================= */}
      <div className="public-mobile-view mobile-only">
        {/* 2. Hero Status */}
        <div className="public-hero-header">
          <div className="public-hero-title-row">
            <h1>¿Qué provoca hoy? 🔥</h1>
            {bcvRate && (
              <span className="public-rate-badge" title="Tasa oficial del Banco Central de Venezuela">
                <span className="public-rate-badge-label">Dólar BCV</span>
                <span className="public-rate-badge-value">Bs. {bcvRate.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </span>
            )}
          </div>
          <span className={`public-status ${isStoreOpen ? 'is-open' : 'is-closed'}`}>
            <i /> <strong>{isStoreOpen ? 'Abierto' : 'Cerrado'}</strong>{isStoreOpen ? ' hasta las 10:00 PM' : ' · abre a las 11:00 AM'}
          </span>
        </div>

        {/* 3. Recommended Card */}
        <div className="public-recommended-card">
          <div className="public-recommended-copy">
            <small>RECOMENDADO 🔥</small>
            <h2>{productTitle(recommendedGroup?.name ?? 'Explora nuestro menú')}</h2>
            <p>{getEditorialDescription(recommendedGroup?.variants[0]?.product.name ?? '', recommendedGroup?.variants[0]?.product.description ?? 'Elige tu favorito y arma tu pedido.')}</p>
            {recommendedGroup && <span className="public-recommended-price">{money(recommendedGroup.minPrice)}</span>}
            {recommendedGroup && priceBs(recommendedGroup.minPrice) && <span className="public-prod-price-bs">{priceBs(recommendedGroup.minPrice)}</span>}
            <button
              className="public-recommended-btn"
              onClick={() => {
                if (recommendedGroup) openGroup(recommendedGroup)
              }}
              aria-label={`Ver ${productTitle(recommendedGroup?.name ?? 'producto')}`}
            >Ver producto <ChevronRight size={14} strokeWidth={2.5} aria-hidden="true" /></button>
          </div>
          <img src={optimizedProductImage(recommendedGroup?.variants[0]?.product.imageUrl) || (recommendedGroup ? productImage(recommendedGroup.category) : '/optimized/login-carousel/slide3.webp')} alt={productTitle(recommendedGroup?.name ?? 'Menú Full China')} className="public-recommended-img" fetchPriority="high" decoding="async" />
          <div className="public-recommended-dots-overlay">
            <span className="active"></span><span></span><span></span>
          </div>
        </div>

        {/* 4. Category Nav */}
        {categories.length > 4 && <div className="public-category-hint" aria-hidden="true">Desliza para ver más <ChevronRight size={13} /></div>}
        <nav className="public-categories-scroll">
          <button 
             className={`public-cat-btn ${activeCategory === 'Todos' ? 'active' : ''}`} 
             onClick={() => setActiveCategory('Todos')}>
             <img className="public-cat-icon-image" src={CATEGORY_ICONS.Todos} alt="" decoding="async" />
             <span>Menú</span>
          </button>
          {categories.filter(c => c !== 'Todos').map(category => (
             <button 
               key={category} 
               className={`public-cat-btn ${activeCategory === category ? 'active' : ''}`}
               onClick={() => setActiveCategory(category)}
             >
               <img className="public-cat-icon-image" src={CATEGORY_ICONS[category] || CATEGORY_ICONS.Todos} alt="" loading="lazy" decoding="async" />
               <span>{categoryLabel(category)}</span>
             </button>
          ))}
        </nav>

        {/* 5. Products Section */}
        <section className="public-content">
          <div className="public-list-header">
            <h2 className={activeCategory === 'Todos' ? 'public-main-list-title' : undefined}>{activeCategory === 'Todos' ? 'Menú' : categoryLabel(activeCategory)}</h2>
            <div className="public-list-actions">
              <button className={`public-favorites-inline ${showFavorites ? 'active' : ''}`} onClick={() => setShowFavorites(value => !value)} aria-label="Filtrar favoritos"><Heart size={16} fill={showFavorites ? 'currentColor' : 'none'} /><span>Favoritos</span>{favoriteIds.length > 0 && <b>{favoriteIds.length}</b>}</button>
            </div>
          </div>

          {error && products.length === 0 ? <div className="public-state error">{error}</div> : (
            <div className={`public-product-list ${activeCategory === 'Todos' ? 'public-product-list-grouped' : ''}`}>
              {visibleGroups.length === 0 ? (
                <div className="public-empty-menu">
                  <span>🍜</span>
                  <h3>{showFavorites ? 'Todavía no tienes favoritos' : 'No encontramos ese plato'}</h3>
                  <p>{showFavorites ? 'Toca el corazón de un plato para guardarlo en este dispositivo.' : 'Prueba con otro nombre o vuelve a ver todo el menú.'}</p>
                  <button type="button" onClick={() => { setSearch(''); setActiveCategory('Todos'); setShowFavorites(false) }}>Ver todo el menú</button>
                </div>
              ) : activeCategory === 'Todos' ? categorySections.map((section, sectionIndex) => (
                <section className="public-category-section" key={section.category}>
                  <div className="public-category-section-header"><h3>{categoryLabel(section.category)}</h3><span>{section.groups.length} {section.groups.length === 1 ? 'plato' : 'platos'}</span></div>
                  <div className="public-category-grid">{section.groups.map((group, groupIndex) => renderProductCard(group, sectionIndex === 0 && groupIndex < 4))}</div>
                </section>
              )) : visibleGroups.map((group, groupIndex) => renderProductCard(group, groupIndex < 4))}
            </div>
          )}
        </section>
      </div>

      {/* =========================================================================
          DESKTOP VIEWPORT (>= 1024px) — 2-COLUMN PRO LAYOUT
          ========================================================================= */}
      <div className={`public-desktop-layout desktop-only ${currentTab === 'contacto' ? 'is-contact-view' : ''}`}>
        {/* LEFT COLUMN: Tab-based views */}
        <div className="public-desktop-main">
          
          {/* TAB 1: INICIO (La Vitrina de Alto Impacto) */}
          {currentTab === 'inicio' && (
            <>
              {/* 1. Cinematic Hero Banner with 3D Depth */}
              <section className="public-cinematic-hero">
                {/* Organic Wok Fire Embers Canvas (Confined to Banner) */}
                <HeroWokEmbers />

                <div className="public-hero-left">
                  <span className="public-hero-tag">
                    <Flame size={14} color="#FF5A52" className="fire-icon-pulse" />
                    AUTÉNTICO SABOR AL WOK
                  </span>
                  <h1 className="public-hero-main-title">
                    HOY TOCA <br /><span className="public-hero-gold">FULL CHINA</span>
                  </h1>
                  <p className="public-hero-desc">
                    Arroces, tallarines y más. Hecho al wok, con tradición, sabor y porciones generosas.
                  </p>

                  <div className="public-hero-search-row">
                    <div className="public-hero-search-box">
                      <Search size={18} color="#9DA0A6" />
                      <input 
                        placeholder="Buscar platos, combos o bebidas..." 
                        value={search} 
                        onChange={e => {
                          setSearch(e.target.value);
                          if (e.target.value.trim()) {
                            setCurrentTab('menu');
                          }
                        }} 
                      />
                      {search && <button type="button" className="public-hero-search-clear" onClick={() => setSearch('')}><X size={14} /></button>}
                    </div>
                    <button 
                      type="button" 
                      className="public-hero-cta-btn" 
                      onClick={() => {
                        setCurrentTab('menu');
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                      }}
                    >
                      Ver menú completo <ChevronRight size={16} />
                    </button>
                  </div>
                </div>

                <div className="public-hero-right">
                  <span className="public-hero-glow-aura" aria-hidden="true" />
                  <img 
                    src="/fondos/hero-banner-food.png" 
                    alt="Full China Wok y Arroz Chaufa" 
                    className="public-hero-dish-img" 
                    fetchPriority="high" 
                    decoding="async" 
                  />
                  <div className="public-hero-gradient-overlay" />
                </div>
              </section>

              {/* 2. NUESTRAS CATEGORÍAS */}
              <section className="public-home-section">
                <div className="public-home-section-header">
                  <div className="public-home-section-title-wrap">
                    <h2 className="public-home-section-title">NUESTRAS CATEGORÍAS</h2>
                    <span className="public-home-section-accent-line" />
                  </div>
                  <button 
                    type="button" 
                    className="public-home-see-all-btn"
                    onClick={() => { setCurrentTab('menu'); setActiveCategory('Todos'); window.scrollTo({ top: 0, behavior: 'smooth' }) }}
                  >
                    <span>Ver todas</span>
                    <ChevronRight size={14} />
                  </button>
                </div>

                <div className="public-home-categories-grid">
                  {DESKTOP_CATEGORY_CARDS.map(cat => (
                    <button
                      key={cat.id}
                      type="button"
                      className={`public-home-category-card ${activeCategory === cat.id ? 'active' : ''} ${cat.isPromo ? 'promo-card' : ''}`}
                      onClick={() => {
                        setActiveCategory(cat.id);
                        setCurrentTab('menu');
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                      }}
                    >
                      <div className="public-home-cat-dish-circle">
                        <img src={cat.icon} alt={cat.label} loading="lazy" decoding="async" />
                      </div>
                      <span className="public-home-cat-name">{cat.label}</span>
                    </button>
                  ))}
                </div>
              </section>

              {/* 3. LO MÁS PEDIDO 🔥 */}
              <section className="public-home-section">
                <div className="public-home-section-header">
                  <div className="public-home-section-title-wrap">
                    <h2 className="public-home-section-title"><Flame size={18} aria-hidden="true" /> LO MÁS PEDIDO</h2>
                    <p className="public-home-section-sub">Los favoritos de nuestros clientes.</p>
                  </div>
                  <button 
                    type="button" 
                    className="public-home-see-all-btn"
                    onClick={() => { setCurrentTab('menu'); window.scrollTo({ top: 0, behavior: 'smooth' }) }}
                  >
                    <span>Ver todos</span>
                    <ChevronRight size={14} />
                  </button>
                </div>

                <div className="public-home-products-grid">
                  {popularGroups.map((group, groupIndex) => renderDesktopProductCard(group, groupIndex))}
                </div>
              </section>

              {/* 4. Panoramic Combo Promo Banner */}
              <section className="public-combo-banner">
                <div className="public-combo-left">
                  <div className="public-combo-title-stack">
                    <span className="public-combo-title-white">COMBO</span>
                    <span className="public-combo-title-gold">FULL CHINA</span>
                  </div>
                  <span className="public-combo-subtitle">Más sabor, más por tu plata.</span>
                </div>

                <div className="public-combo-visual">
                  <div className="public-combo-dish-wrap">
                    <img src="/productos/M1.jpg" alt="Arroz Chaufa Especial" className="public-combo-dish-img" />
                  </div>
                  <span className="public-combo-plus">+</span>
                  <div className="public-combo-dish-wrap">
                    <img src="/productos/M11.jpg" alt="Tallarín Saltado Especial" className="public-combo-dish-img" />
                  </div>
                  <span className="public-combo-plus">+</span>
                  <div className="public-combo-dish-wrap drink-wrap">
                    <img src="/optimized/menu-icons/bebidas.webp" alt="Gaseosa 1L" className="public-combo-drink-img" />
                  </div>
                </div>

                <div className="public-combo-items-list">
                  <span>Arroz Chaufa Especial</span>
                  <span>+ Tallarín Saltado Especial</span>
                  <span>+ Gaseosa 1L</span>
                </div>

                <div className="public-combo-right-price">
                  <div className="public-combo-price-stack">
                    <span className="public-combo-price">USD 22,90</span>
                    <span className="public-combo-badge">Ahorra $ 6.00</span>
                  </div>
                  <button 
                    type="button" 
                    className="public-combo-order-btn"
                    onClick={handleAddCombo}
                    aria-label="Agregar Combo Full China al pedido"
                  >
                    <Plus size={15} />
                    <span>Agregar combo</span>
                  </button>
                </div>
              </section>

              {/* 5. ¿CÓMO QUIERES RECIBIR TU PEDIDO? */}
              <section className="public-home-section">
                <div className="public-home-section-header">
                  <div className="public-home-section-title-wrap">
                    <h2 className="public-home-section-title">¿CÓMO QUIERES RECIBIR TU PEDIDO?</h2>
                  </div>
                </div>

                <div className="public-home-delivery-grid">
                  {/* Card 1: Delivery */}
                  <div className="public-home-delivery-card delivery-mode">
                    <div className="public-home-delivery-content">
                      <h3><Bike size={20} aria-hidden="true" /> Delivery</h3>
                      <p>Te lo llevamos hasta tu puerta.</p>
                      <div className="public-home-delivery-badges">
                        <span className="del-badge"><Zap size={13} /> Rápido</span>
                        <span className="del-badge"><ShieldCheck size={13} /> Seguro</span>
                        <span className="del-badge"><MapPin size={13} /> Cobertura</span>
                      </div>
                      <button 
                        type="button" 
                        className="public-home-delivery-btn"
                        onClick={() => {
                          setOrderType('delivery');
                          setCurrentTab('menu');
                          window.scrollTo({ top: 0, behavior: 'smooth' });
                        }}
                      >
                        <span>Pedir con delivery</span>
                        <ChevronRight size={15} />
                      </button>
                    </div>
                  </div>

                  {/* Card 2: Retiro en Full China */}
                  <div className="public-home-delivery-card pickup-mode">
                    <div className="public-home-delivery-content">
                      <h3>Retiro en Full China</h3>
                      <p>Retíralo directo en el food truck.</p>
                      <div className="public-home-delivery-badges">
                        <span className="del-badge"><Clock size={13} /> Inmediato</span>
                        <span className="del-badge"><ShoppingBag size={13} /> Listo</span>
                        <span className="del-badge"><Zap size={13} /> Veloz</span>
                      </div>
                      <button 
                        type="button" 
                        className="public-home-delivery-btn"
                        onClick={() => {
                          setOrderType('takeaway');
                          setCurrentTab('menu');
                          window.scrollTo({ top: 0, behavior: 'smooth' });
                        }}
                      >
                        <span>Pedir para retirar</span>
                        <ChevronRight size={15} />
                      </button>
                    </div>
                  </div>
                </div>
              </section>

              {/* 6. PEDIR ES MUY FÁCIL */}
              <section className="public-home-section">
                <div className="public-home-section-header">
                  <div className="public-home-section-title-wrap">
                    <h2 className="public-home-section-title">PEDIR ES MUY FÁCIL</h2>
                    <p className="public-home-section-sub">En solo 3 pasos, tu antojo en camino.</p>
                  </div>
                </div>

                <div className="public-home-steps-grid">
                  <div className="public-home-step-card step-orange">
                    <div className="public-home-step-icon-wrap">
                      <Utensils size={28} color="#FF9119" />
                    </div>
                    <div className="public-home-step-text">
                      <h4>Elige tus platos</h4>
                      <p>Explora el menú y agrega lo que más te guste.</p>
                    </div>
                  </div>

                  <div className="public-home-step-card step-red">
                    <div className="public-home-step-icon-wrap">
                      <ShoppingCart size={28} color="#FF3B30" />
                    </div>
                    <div className="public-home-step-text">
                      <h4>Arma tu pedido</h4>
                      <p>Revisa tu carrito y confirma tu selección.</p>
                    </div>
                  </div>

                  <div className="public-home-step-card step-green">
                    <div className="public-home-step-icon-wrap">
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="28" height="28">
                        <path fill="#25D366" d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413z"/>
                      </svg>
                    </div>
                    <div className="public-home-step-text">
                      <h4>Confirma por WhatsApp</h4>
                      <p>Te escribiremos para validar tu pedido.</p>
                    </div>
                  </div>
                </div>
              </section>

              {/* 7. NUESTRAS PROMOCIONES */}
              <section className="public-home-section">
                <div className="public-home-section-header">
                  <div className="public-home-section-title-wrap">
                    <h2 className="public-home-section-title">NUESTRAS PROMOCIONES</h2>
                    <p className="public-home-section-sub">Aprovecha y disfruta más por menos.</p>
                  </div>
                  <button 
                    type="button" 
                    className="public-home-see-all-btn"
                    onClick={() => { setCurrentTab('promos'); window.scrollTo({ top: 0, behavior: 'smooth' }) }}
                  >
                    <span>Ver todas</span>
                    <ChevronRight size={14} />
                  </button>
                </div>

                <div className="public-home-promos-grid">
                  {promoGroups.map((group, groupIndex) => renderDesktopPromoCard(group, groupIndex))}
                </div>
              </section>
            </>
          )}

          {/* TAB 2: MENU (Catálogo Completo) */}
          {currentTab === 'menu' && (
            <>
              {/* Categories Nav (Floating Circular Dish Selector in Desktop) */}
              {categories.length > 4 && <div className="public-category-hint" aria-hidden="true">Desliza para ver más <ChevronRight size={13} /></div>}
              <nav className="public-categories-scroll" id="menu-section">
                <button 
                   className={`public-cat-btn ${activeCategory === 'Todos' ? 'active' : ''}`} 
                   onClick={() => setActiveCategory('Todos')}>
                   <div className="public-cat-dish-circle">
                     <img src={CATEGORY_ICONS.Todos} alt="" width={44} height={44} decoding="async" />
                   </div>
                   <span className="public-cat-label-vector"><Star size={13} fill="currentColor" aria-hidden="true" />Todos</span>
                </button>
                {categories.filter(c => c !== 'Todos').map(category => (
                   <button 
                     key={category} 
                     className={`public-cat-btn ${activeCategory === category ? 'active' : ''}`}
                     onClick={() => setActiveCategory(category)}
                   >
                     <div className="public-cat-dish-circle">
                       <img src={CATEGORY_ICONS[category] || CATEGORY_ICONS.Todos} alt="" width={44} height={44} loading="lazy" decoding="async" />
                     </div>
                     <span>{DESKTOP_CATEGORY_LABELS[category] || categoryLabel(category)}</span>
                   </button>
                ))}
              </nav>

              {/* Products Catalog Section */}
              <section className="public-content">
                <div className="public-list-header">
                  <h2 className={activeCategory === 'Todos' ? 'public-main-list-title' : undefined}>
                    <span className="public-list-title-badge">{activeCategory === 'Todos' ? <><Utensils size={18} aria-hidden="true" /> NUESTRO MENÚ COMPLETO</> : categoryLabel(activeCategory)}</span>
                    <span className="public-list-title-sub">{activeCategory === 'Todos' ? 'Todo preparado al momento al wok' : `${visibleGroups.length} platos disponibles`}</span>
                  </h2>
                  <div className="public-list-actions">
                    <button className={`public-favorites-inline ${showFavorites ? 'active' : ''}`} onClick={() => setShowFavorites(value => !value)} aria-label="Filtrar favoritos"><Heart size={16} fill={showFavorites ? 'currentColor' : 'none'} /><span>Favoritos</span>{favoriteIds.length > 0 && <b>{favoriteIds.length}</b>}</button>
                  </div>
                </div>

                {error && products.length === 0 ? <div className="public-state error">{error}</div> : (
                  <div className={`public-product-list ${activeCategory === 'Todos' ? 'public-product-list-grouped' : ''}`}>
                    {visibleGroups.length === 0 ? (
                      <div className="public-empty-menu">
                        <span className="public-empty-menu-wok" aria-hidden="true">
                          <svg viewBox="0 0 72 72" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M14 31H51C50.2 43.4 43.1 51 32.5 51C21.9 51 14.8 43.4 14 31Z" className="public-wok-bowl" />
                            <path d="M50 34L65 27" className="public-wok-handle" />
                            <path d="M24 23C20.5 18.7 27.5 16.2 24.5 11" className="public-wok-steam" />
                            <path d="M33 22C29.8 17.5 36.8 15.1 33.6 9" className="public-wok-steam public-wok-steam-delay" />
                            <path d="M42 23C38.9 19 45.4 16.8 42.8 12" className="public-wok-steam public-wok-steam-late" />
                            <path d="M25 55H41" className="public-wok-base" />
                          </svg>
                        </span>
                        <h3>{showFavorites ? 'Todavía no tienes favoritos' : 'No encontramos ese plato'}</h3>
                        <p>{showFavorites ? 'Toca el corazón de un plato para guardarlo en este dispositivo.' : 'Prueba con otro nombre o vuelve a ver todo el menú.'}</p>
                        <button type="button" onClick={() => { setSearch(''); setActiveCategory('Todos'); setShowFavorites(false) }}>Ver todo el menú</button>
                      </div>
                    ) : activeCategory === 'Todos' ? categorySections.map((section, sectionIndex) => (
                      <section className="public-category-section" key={section.category}>
                        <div className="public-category-section-header">
                          <div className="public-category-title-group">
                            <span className="public-cat-section-bar" />
                            <h3>{categoryLabel(section.category)}</h3>
                          </div>
                          <span className="public-category-count-badge">{section.groups.length} {section.groups.length === 1 ? 'plato' : 'platos'}</span>
                        </div>
                        <div className="public-category-grid">{section.groups.map((group, groupIndex) => renderProductCard(group, sectionIndex === 0 && groupIndex < 4))}</div>
                      </section>
                    )) : (
                      <div className="public-category-grid">
                        {visibleGroups.map((group, groupIndex) => renderProductCard(group, groupIndex < 4))}
                      </div>
                    )}
                  </div>
                )}
              </section>
            </>
          )}

          {/* TAB 3: PROMOS */}
          {currentTab === 'promos' && (
            <section className="public-content">
              <div className="public-list-header">
                <div className="public-category-title-group">
                  <span className="public-cat-section-bar" />
                  <div>
                    <span className="public-list-title-badge"><Flame size={18} aria-hidden="true" /> COMBOS Y PROMOCIONES</span>
                    <span className="public-list-title-sub">Más comida y mejor precio para compartir</span>
                  </div>
                </div>
              </div>

              {/* Panoramic Combo Promo Banner */}
              <section className="public-combo-banner" style={{ margin: '0 0 24px 0' }}>
                <div className="public-combo-left">
                  <div className="public-combo-title-stack">
                    <span className="public-combo-title-white">COMBO</span>
                    <span className="public-combo-title-gold">FULL CHINA</span>
                  </div>
                  <span className="public-combo-subtitle">Más sabor, más por tu plata.</span>
                </div>

                <div className="public-combo-visual">
                  <div className="public-combo-dish-wrap">
                    <img src="/productos/M1.jpg" alt="Arroz Chaufa Especial" className="public-combo-dish-img" />
                  </div>
                  <span className="public-combo-plus">+</span>
                  <div className="public-combo-dish-wrap">
                    <img src="/productos/M11.jpg" alt="Tallarín Saltado Especial" className="public-combo-dish-img" />
                  </div>
                  <span className="public-combo-plus">+</span>
                  <div className="public-combo-dish-wrap drink-wrap">
                    <img src="/optimized/menu-icons/bebidas.webp" alt="Gaseosa 1L" className="public-combo-drink-img" />
                  </div>
                </div>

                <div className="public-combo-items-list">
                  <span>Arroz Chaufa Especial</span>
                  <span>+ Tallarín Saltado Especial</span>
                  <span>+ Gaseosa 1L</span>
                </div>

                <div className="public-combo-right-price">
                  <div className="public-combo-price-stack">
                    <span className="public-combo-price">USD 22,90</span>
                    <span className="public-combo-badge">Ahorra $ 6.00</span>
                  </div>
                  <button 
                    type="button" 
                    className="public-combo-order-btn"
                    onClick={handleAddCombo}
                    aria-label="Agregar Combo Full China al pedido"
                  >
                    <Plus size={15} />
                    <span>Pedir Combo</span>
                  </button>
                </div>
              </section>

              <div className="public-category-grid">
                {promoGroups.map((group, groupIndex) => renderProductCard(group, groupIndex < 6))}
              </div>
            </section>
          )}

          {/* TAB 4: CONTACTO */}
          {currentTab === 'contacto' && (
            <section className="public-contact-view public-contact-page">
              <section className="public-cinematic-hero public-contact-hero">
                <HeroWokEmbers />
                <div className="public-hero-left public-contact-hero-copy">
                  <span className="public-hero-tag">
                    <Flame size={14} color="#FF5A52" className="fire-icon-pulse" />
                    ESTAMOS PARA SERVIRTE
                  </span>
                  <h1 className="public-hero-main-title">
                    CONTÁCTANOS <br /><span className="public-hero-gold">TE ESCUCHAMOS</span>
                  </h1>
                  <p className="public-hero-desc">¿Tienes dudas o necesitas ayuda con tu pedido? Escríbenos. Nuestro equipo estará feliz de atenderte.</p>

                  <div className="public-hero-search-row public-contact-hero-actions">
                    {configuredPhone ? (
                      <a href={`https://wa.me/${configuredPhone}`} target="_blank" rel="noopener noreferrer" className="public-hero-cta-btn public-contact-hero-cta">
                        Escríbenos ahora <ChevronRight size={16} />
                      </a>
                    ) : null}
                  </div>
                </div>
              </section>

              <section className="public-contact-hub">
                <article className="public-contact-panel public-contact-talk">
                  <header className="public-order-ticket-head">
                    <span><Flame size={14} /> Pedido directo</span>
                    <h2>Pide sin complicarte</h2>
                  </header>
                  <div className="public-contact-status-row">
                    <span><Clock size={14} /> Horario de atención</span>
                    <strong>Martes a Domingo</strong>
                    <small>Desde las 11:30 AM</small>
                  </div>
                  <div className="public-contact-payment-block">
                    <span><Wallet size={17} /> Métodos de pago</span>
                    <ul className="public-payment-ticket-list">
                      <li><i>01</i><span>Efectivo USD</span></li>
                      <li><i>02</i><span>Efectivo Bs.</span></li>
                      <li><i>03</i><span>Pago móvil</span></li>
                      <li><i>04</i><span>Punto de venta</span></li>
                      <li><i>05</i><span>Binance</span></li>
                      <li><i>06</i><span>Transferencia Bs.</span></li>
                      <li className="is-mixed"><i>+</i><span>Pago mixto<small>Combina dos métodos</small></span></li>
                    </ul>
                  </div>
                  {configuredPhone ? (
                    <a href={`https://wa.me/${configuredPhone}`} target="_blank" rel="noopener noreferrer" className="public-contact-channel public-contact-footer-cta is-whatsapp">
                      <i className="is-whatsapp">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.149-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479s1.065 2.875 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.262.489 1.693.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.29.173-1.414-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.002-5.45 4.438-9.886 9.892-9.886 2.641 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.9 6.99c-.003 5.45-4.438 9.884-9.888 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z" />
                        </svg>
                      </i>
                      <span><small>Canal oficial</small><strong>Pedir por WhatsApp</strong></span>
                      <ChevronRight size={18} />
                    </a>
                  ) : null}
                </article>

                <article className="public-contact-panel public-contact-instagram-studio">
                  <header className="public-order-ticket-head public-instagram-ticket-head">
                    <span>
                      <svg className="public-instagram-header-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <rect width="18" height="18" x="3" y="3" rx="5" />
                        <circle cx="12" cy="12" r="4" />
                        <circle cx="17.5" cy="6.5" r="0.75" fill="currentColor" stroke="none" />
                      </svg>
                      Desde Instagram
                    </span>
                    <h2>El wok en movimiento</h2>
                  </header>
                  <div className="public-instagram-intro">
                    <p>Seis momentos, un solo antojo. Explora lo que está pasando en Full China.</p>
                  </div>
                  <div className="public-instagram-reel-stage" aria-label="Reels de Full China en Instagram">
                    {INSTAGRAM_REELS.map((reel, index) => (
                      <a
                        key={reel.href}
                        href={reel.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`public-instagram-reel is-reel-${index + 1}`}
                        aria-label={`Ver reel ${index + 1} de Full China en Instagram`}
                      >
                        <video autoPlay muted loop playsInline preload="metadata">
                          <source src={reel.src} type="video/mp4" />
                        </video>
                        <span className="public-instagram-reel-shade" aria-hidden="true" />
                        <span className="public-instagram-reel-link-icon" aria-hidden="true"><ArrowUpRight size={13} /></span>
                      </a>
                    ))}
                  </div>
                  <a
                    href="https://www.instagram.com/fullchinavzla/?hl=es"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="public-contact-footer-cta is-instagram"
                  >
                    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <rect width="18" height="18" x="3" y="3" rx="5" />
                      <circle cx="12" cy="12" r="4" />
                      <circle cx="17.5" cy="6.5" r="0.75" fill="currentColor" stroke="none" />
                    </svg>
                    <span>Seguir a <strong>@fullchinavzla</strong></span>
                    <ChevronRight size={18} />
                  </a>
                </article>

                <article className="public-contact-panel public-contact-location">
                  <div className="public-contact-location-stage">
                    <iframe
                      title="Ubicación de Full China en Google Maps"
                      src="https://www.google.com/maps?q=10.2547567,-67.5926267&z=17&output=embed"
                      loading="lazy"
                      referrerPolicy="no-referrer-when-downgrade"
                      allowFullScreen
                    />
                    <span className="public-contact-location-tint" aria-hidden="true" />
                    <span className="public-contact-location-tag"><MapPin size={14} /> Punto Full China</span>
                    <span className="public-contact-brand-pin" aria-hidden="true">
                      <img src="/optimized/root/logo.webp" alt="" />
                    </span>
                    <div className="public-contact-location-overlay">
                      <span>Maracay · Estado Aragua</span>
                      <strong>Ven, come<br />y disfruta.</strong>
                      <p>Quédate en nuestras mesas, retira tu pedido o pídelo por delivery.</p>
                      <a
                        href="https://maps.app.goo.gl/sh8SDNhhdD6is87y8"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="public-contact-footer-cta is-location"
                      >
                        <Navigation size={16} />
                        <span>Cómo llegar</span>
                        <ChevronRight size={17} />
                      </a>
                    </div>
                  </div>
                </article>
              </section>

            </section>
          )}

        </div>

        {/* Desktop Sticky Sidebar (Live Cart & Checkout) */}
        <aside className="public-desktop-sidebar">
          <div className={`public-sidebar-card ${cartPulse ? 'is-pulsing' : ''}`}>
            {/* Sidebar Header */}
            <div className="public-sidebar-head">
              <div className="public-sidebar-title">
                <ShoppingBag size={18} color="#FF3D2E" />
                <span>Tu pedido</span>
              </div>
              {cart.length > 0 && (
                <span key={itemCount} className="public-sidebar-count">
                  {itemCount} {itemCount === 1 ? 'ítem' : 'ítems'}
                </span>
              )}
            </div>

            {cart.length === 0 ? (
              <div className="public-sidebar-empty">
                <div className="public-empty-box-art">
                  <img 
                    src="/fondos/carrito-vacio.png" 
                    alt="Tu pedido está vacío" 
                    className="public-empty-cart-img"
                  />
                </div>
                <h3 className="public-empty-cart-title">Tu pedido está vacío</h3>
                <p className="public-empty-cart-msg">
                  Parece que aún no has agregado<br />nada a tu pedido.
                </p>
                <p className="public-empty-cart-sub">
                  ¡Explora nuestro menú y encuentra<br />tu próximo favorito!
                </p>
                <button 
                  type="button" 
                  className="public-empty-explore-btn"
                  onClick={() => {
                    setCurrentTab('menu');
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                >
                  <ShoppingBag size={18} />
                  <span>Explorar menú</span>
                </button>
              </div>
            ) : (
              <>
                {/* Sidebar Cart Items */}
                <div className="public-sidebar-items">
                  {cart.map(item => {
                    const lineKey = cartLineKey(item)
                    const isDeleting = deletingKeys.includes(`${item.productId}-${item.notes || ''}`)
                    return (
                      <div className={`public-sidebar-item ${isDeleting ? 'is-deleting' : ''}`} key={lineKey}>
                        <img 
                          src={optimizedProductImage(item.imageUrl) || '/optimized/login-carousel/slide3.webp'} 
                          alt="" 
                          className="public-sidebar-item-img" 
                        />
                        <div className="public-sidebar-item-info">
                          <strong>{cartProductName(item.productName)}</strong>
                          <span className="public-sidebar-item-price">{money(item.price * item.quantity)}</span>
                          <div className="public-sidebar-stepper">
                            <button 
                              type="button" 
                              onClick={() => {
                                if (item.quantity === 1) {
                                  handleRemoveSidebarItem(item.productId, 1, item.notes || '')
                                } else {
                                  updateQuantity(item.productId, -1, item.notes || '')
                                }
                              }} 
                              aria-label="Disminuir"
                            >
                              {item.quantity === 1 ? <Trash2 size={12} /> : <Minus size={12} />}
                            </button>
                            <span key={item.quantity} className="public-stepper-num">{item.quantity}</span>
                            <button type="button" onClick={() => updateQuantity(item.productId, 1, item.notes || '')} aria-label="Aumentar">
                              <Plus size={12} />
                            </button>
                          </div>
                        </div>
                        <button 
                          type="button" 
                          className="public-sidebar-trash" 
                          onClick={() => handleRemoveSidebarItem(item.productId, item.quantity, item.notes || '')}
                          aria-label="Eliminar producto"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    )
                  })}
                </div>

                {/* Sidebar Financials */}
                <div className="public-sidebar-summary">
                  <div className="public-sidebar-row">
                    <span>Subtotal</span>
                    <strong key={total}>{money(total)}</strong>
                  </div>
                  <div className="public-sidebar-row">
                    <span>Delivery</span>
                    <small>{orderType === 'delivery' ? 'Por confirmar' : 'No aplica'}</small>
                  </div>
                  <div className="public-sidebar-row total">
                    <span>Total</span>
                    <div className="public-sidebar-total-val">
                      <em key={total}>{money(total)}</em>
                      {priceBs(total) && <small className="public-sidebar-total-bs">{priceBs(total)}</small>}
                    </div>
                  </div>
                </div>

                {/* Delivery / Retiro Switch (Modern Vector Segmented Control) */}
                <div className="public-sidebar-type-toggle">
                  <button 
                    type="button" 
                    className={`public-sidebar-type-btn ${orderType === 'delivery' ? 'active' : ''}`}
                    onClick={() => setOrderType('delivery')}
                  >
                    <Bike size={16} />
                    <span>Delivery</span>
                  </button>
                  <button 
                    type="button" 
                    className={`public-sidebar-type-btn ${orderType === 'takeaway' ? 'active' : ''}`}
                    onClick={() => setOrderType('takeaway')}
                  >
                    <Store size={16} />
                    <span>Retiro en local</span>
                  </button>
                </div>

                {/* Address Input Box */}
                {orderType === 'delivery' && (
                  <div className="public-sidebar-address-box" onClick={() => { setCartOpen(true); setStep('address'); }}>
                    <MapPin size={16} color="#FF5A52" />
                    <input 
                      readOnly 
                      placeholder="Ingresa tu dirección de entrega" 
                      value={address || ''} 
                    />
                    <span className="public-sidebar-address-edit">Editar</span>
                  </div>
                )}

                {/* Big Checkout CTA Button */}
                <button 
                  type="button" 
                  className="public-sidebar-checkout-btn"
                  disabled={!cart.length || submitting}
                  onClick={() => {
                    if (!cart.length) return;
                    setCartOpen(true);
                    setStep(orderType === 'delivery' && !address ? 'address' : 'details');
                  }}
                >
                  <div className="public-sidebar-checkout-main">
                    <span>Finalizar pedido</span>
                    <MessageSquareText size={18} />
                  </div>
                  <small>Confirmación directa por WhatsApp</small>
                </button>
              </>
            )}
          </div>
        </aside>
      </div>

      {/* Floating Cart for Mobile */}
      {itemCount > 0 && !cartOpen && (
        <div className={`public-cart-bar ${addFeedback ? 'is-feedback' : ''}`} onClick={() => { setCartOpen(true); setStep('cart') }}>
          {addFeedback ? <div className="public-cart-bar-added" role="status" aria-live="polite">
            <span className="public-cart-bar-added-image" aria-hidden="true">
              {addFeedback.imageUrl ? <img src={addFeedback.imageUrl} alt="" /> : <ShoppingCart size={18} />}
            </span>
            <div className="public-cart-bar-text"><h4>{addFeedback.name}</h4><p>Añadido al carrito</p></div>
          </div> : <div className="public-cart-bar-info">
            <div className={`public-cart-bar-icon ${cartPulse ? 'is-pulsing' : ''}`}>
              <ShoppingCart size={24} color="#FFF" />
              <span className={`public-cart-bar-badge ${cartPulse ? 'is-pulsing' : ''}`}>{itemCount}</span>
            </div>
            <div className="public-cart-bar-text"><h4>{itemCount} producto{itemCount !== 1 ? 's' : ''}</h4><p>Ver tu pedido</p></div>
          </div>}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
             <span className="public-cart-bar-total-group">
               <span className="public-cart-bar-total">{money(total)}</span>
               {priceBs(total) && <span className="public-cart-bar-total-bs">{priceBs(total)}</span>}
             </span>
             <button className="public-cart-bar-btn">
                {addFeedback ? 'Ver carrito' : 'Ver pedido'} <ChevronRight size={18} />
             </button>
          </div>
        </div>
      )}

      {selectedGroup && selectedProduct && (
        <div className={`public-modal-backdrop ${closingDetail ? 'closing' : ''}`} onClick={closeProductDetail}>
          <section className="public-product-detail-modal" onClick={event => event.stopPropagation()}>
            <div className="ppdm-image">
              <img src={optimizedProductImage(selectedProduct.imageUrl) || productImage(selectedGroup.category)} alt={selectedProduct.name} decoding="async" />
              <button className="ppdm-close" onClick={closeProductDetail} aria-label="Cerrar detalle"><X /></button>
              <div className="ppdm-image-gradient" />
            </div>
            <div className="ppdm-content">
              <h1>{productTitle(selectedGroup.name)}</h1>
              <p className="ppdm-desc">{getEditorialDescription(selectedProduct.name, selectedProduct.description || 'Preparado al momento con el sabor de Full China.')}</p>
              <div className="ppdm-price">{money(selectedProduct.price)}{priceBs(selectedProduct.price) && <span className="ppdm-price-bs">{priceBs(selectedProduct.price)}</span>}</div>
              {selectedGroup.variants.length > 1 && (
                <div className="ppdm-section">
                  <div className="ppdm-section-header"><h3>Elige tu presentación</h3><span>Obligatorio</span></div>
                  <div className="ppdm-options">
                    {selectedGroup.variants.map(({ product, label }) => (
                      <button
                        type="button"
                        className="ppdm-option"
                        key={product.id}
                        onClick={() => setSelectedVariantId(product.id)}
                      >
                        <span className="ppdm-radio"><span className={`ppdm-radio-inner ${selectedProduct.id === product.id ? 'active' : ''}`} /></span>
                        <span className="ppdm-option-name">{label}</span>
                        <span className="ppdm-option-price">{money(product.price)}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {detailModifierGroups.length > 0 && (
                <div className="ppdm-section ppdm-extras-section">
                  <div className="ppdm-section-header"><h3>Extras <small>(opcionales)</small></h3></div>
                  <div className="ppdm-options">
                    {detailModifierGroups.flatMap(group => group.options.map(option => (
                      <label className="ppdm-option ppdm-extra-option" key={option.id}>
                        <input type="checkbox" checked={selectedExtras.includes(option.id)} onChange={() => setSelectedExtras(current => current.includes(option.id) ? current.filter(id => id !== option.id) : [...current, option.id])} />
                        <span className="ppdm-checkbox-mark" />
                        <span className="ppdm-option-name">{option.name}</span>
                        {option.price > 0 && <span className="ppdm-option-price">+{money(option.price)}</span>}
                      </label>
                    )))}
                  </div>
                </div>
              )}
              <label className="ppdm-instructions-field">Indicaciones <small>(opcional)</small><textarea value={detailNotes} maxLength={160} onChange={event => setDetailNotes(event.target.value)} placeholder="Ej. Sin cebollín, por favor…" /><span>{detailNotes.length}/160</span></label>
            </div>
            <footer className="ppdm-footer">
              <div className="ppdm-qty">
                <button type="button" onClick={() => setDetailQuantity(value => Math.max(1, value - 1))} aria-label="Disminuir cantidad"><Minus /></button>
                <span>{detailQuantity}</span>
                <button type="button" onClick={() => setDetailQuantity(value => value + 1)} aria-label="Aumentar cantidad"><Plus /></button>
              </div>
              <button type="button" className="ppdm-add-btn" onClick={addSelectedProduct}>Agregar · {money(selectedProduct.price * detailQuantity)}</button>
            </footer>
          </section>
        </div>
      )}

      {cartOpen && <div className={`public-drawer-backdrop ${closingCart ? 'closing' : ''}`} onClick={closeCart}><aside className={`public-cart-drawer ${step === 'details' ? 'public-data-drawer' : ''} public-step-${step}`} onClick={event => event.stopPropagation()}>
        <header className="public-review-header"><button className="public-review-back" onClick={() => { const isDesktop = window.matchMedia('(min-width: 1024px)').matches; if (step === 'details') { if (isDesktop) { if (orderType === 'delivery') { setStep('address'); } else { closeCart(); } } else { setStep(orderType === 'delivery' ? 'address' : 'delivery'); } } else if (step === 'confirm') { setStep('details'); } else if (step === 'address') { if (isDesktop) { closeCart(); } else { setStep('delivery'); } } else if (step === 'delivery') { setStep('cart'); } else if (step === 'preparing' || step === 'sent') { closeCart(); } else { closeCart(); } }} aria-label="Volver"><ChevronRight /></button><img src="/optimized/root/logo.webp" alt="Full China" /><div className="public-review-heading"><h2>{step !== 'confirm' && <Flame className="desktop-only public-review-heading-icon" size={24} aria-hidden="true" />}{step === 'delivery' ? '¿Cómo quieres recibirlo?' : step === 'address' ? 'Dirección de entrega' : step === 'details' ? 'Tus datos' : step === 'confirm' ? 'Revisa y confirma tu pedido' : step === 'preparing' ? 'Preparando tu pedido' : step === 'sent' ? 'Pedido enviado' : 'Tu pedido'}</h2><p>{step === 'delivery' ? 'Selecciona la forma de entrega de tu pedido.' : step === 'address' ? '¿Dónde te lo llevamos?' : step === 'details' ? 'Necesitamos esta información para preparar tu pedido.' : step === 'confirm' ? <>Confirma que todo esté correcto antes de enviarlo.<br />Luego lo enviaremos por WhatsApp.</> : step === 'preparing' ? 'Estamos creando tu solicitud segura.' : step === 'sent' ? 'Tu solicitud fue registrada correctamente.' : 'Revisa tu pedido antes de continuar.'}</p></div>{step === 'cart' && <div className="public-estimate-card" aria-label="Entrega estimada"><span className="public-estimate-dot" /><div><small>Entrega estimada</small><strong>35–50 min</strong></div></div>}</header>
        {cartGuardMessage && <div className="public-cart-guard" role="alert"><CircleAlert /><div><strong>Tu carrito está vacío</strong><span>{cartGuardMessage}</span></div></div>}
        {step === 'cart' && <div className="public-review-page"><div className="public-cart-items">{cart.length === 0 ? <div className="public-empty-cart"><ShoppingCart /><strong>Tu carrito está vacío</strong><span>Agrega un plato para comenzar tu pedido.</span></div> : cart.map(item => <div className="public-cart-item" key={cartLineKey(item)}><img className="public-cart-item-image" src={optimizedProductImage(item.imageUrl) || '/optimized/login-carousel/slide3.webp'} alt="" /><div className="public-cart-item-main"><strong>{cartProductName(item.productName)}</strong><span>{item.quantity} {item.quantity === 1 ? 'porción' : 'porciones'}</span>{item.notes && <small className="public-cart-item-notes">✦ {item.notes}</small>}<div className="public-review-qty"><button onClick={() => updateQuantity(item.productId, -1, item.notes || '')}>{item.quantity === 1 ? <Trash2 /> : <Minus />}</button><b>{item.quantity}</b><button onClick={() => updateQuantity(item.productId, 1, item.notes || '')}><Plus /></button></div></div><strong className="public-cart-item-total">{money(item.price * item.quantity)}{priceBs(item.price * item.quantity) && <small className="public-cart-item-bs">{priceBs(item.price * item.quantity)}</small>}</strong><button className="public-review-edit" onClick={() => { closeCart(); setTimeout(() => { const group = groups.find(candidate => candidate.variants.some(variant => variant.product.id === item.productId)); if (group) openGroup(group) }, 240) }}>Editar</button></div>)}</div>{cart.length > 0 && recommendations.length > 0 && <section className="public-cart-recommendations"><div className="public-cart-recommendations-head"><h3><span className="mobile-only">🔥</span><Flame className="desktop-only" size={18} aria-hidden="true" /> ¿Algo más?</h3><button type="button" onClick={() => setShowAllExtras(true)}>Ver todos <ChevronRight size={13} /></button></div><div className="public-recommendation-row">{recommendations.map(group => <article key={group.key}><img src={optimizedProductImage(group.variants[0]?.product.imageUrl) || productImage(group.category)} alt="" /><div><strong>{productTitle(group.name)}</strong><b>{money(group.minPrice)}{priceBs(group.minPrice) && <small className="public-reco-bs">{priceBs(group.minPrice)}</small>}</b></div><button type="button" onClick={() => { const product = group.variants[0]?.product; if (product) addProduct(product) }}><Plus size={15} /></button></article>)}</div></section>}<div className="public-total public-review-total"><span>Subtotal productos</span><strong>{money(total)}{priceBs(total) && <small className="public-total-bs">{priceBs(total)}</small>}</strong><small>{cart.length ? 'Productos seleccionados' : 'Agrega un producto para comenzar'}</small><b>Total productos <em>{money(total)}{priceBs(total) && <small className="public-total-bs">{priceBs(total)}</small>}</em></b></div><button className="public-primary" disabled={!cart.length} onClick={() => requireCart() && setStep('delivery')}>{cart.length ? 'Continuar' : 'Elegir productos'} <ChevronRight /></button></div>}
        {step === 'delivery' && <div className="public-delivery-step"><div className={`public-delivery-choice ${orderType === 'takeaway' ? 'selected' : ''}`} onClick={() => { setOrderType('takeaway'); setDeliveryChosen(true) }}><img src="/optimized/fondos/pickup-card.webp" alt="Retirar en Full China" /><div><strong>Retirar en Full China</strong><span>Lo prepararemos para que vengas a buscarlo.</span></div><span className="public-choice-radio" /></div><div className={`public-delivery-choice ${orderType === 'delivery' ? 'selected' : ''}`} onClick={() => { setOrderType('delivery'); setDeliveryChosen(true) }}><img src="/optimized/fondos/delivery-card.webp" alt="Delivery" /><div><strong>Delivery</strong><span>Te lo llevamos hasta donde estés.</span></div><span className="public-choice-radio" /></div><p className="public-delivery-hint">⌖ Podrás indicar la dirección en el siguiente paso.</p><button className="public-primary public-delivery-continue" disabled={!cart.length} onClick={() => { setDeliveryChosen(true); setStep(orderType === 'delivery' ? 'address' : 'details') }}>Continuar <ChevronRight /></button></div>}
        {step === 'address' && <div className="public-address-step"><div className="public-address-search"><Search /><input ref={addressRef} value={address} onChange={event => searchAddress(event.target.value)} placeholder="Buscar dirección, urbanización o ciudad" /></div>{showSuggestions && address.trim().length >= 4 && <div className="public-address-suggestions public-address-step-suggestions">{searchingAddress ? <div className="public-suggestion-status"><span className="public-search-spinner" />Buscando direcciones…</div> : addressSuggestions.length > 0 ? <><div className="public-suggestion-heading">Direcciones encontradas</div>{addressSuggestions.map((s, i) => { const parts = s.display_name.split(','); const primary = parts.shift() || s.display_name; return <button key={i} type="button" className="public-suggestion-item" onMouseDown={() => selectSuggestion(s)}><span className="public-suggestion-icon"><MapPin size={14} /></span><span className="public-suggestion-copy"><strong>{primary}</strong><small>{parts.join(',').trim() || 'Ubicación en el mapa'}</small></span><ChevronRight size={14} className="public-suggestion-arrow" /></button> })}</> : <div className="public-suggestion-status">No encontramos esa dirección.<small>Prueba con ciudad y urbanización.</small></div>}</div>}<AddressMap coordinates={geoCoords} onPick={selectMapLocation} /><div className="public-address-selected"><MapPin /><div><small>Dirección seleccionada</small><strong>{address || 'Toca el mapa o busca una dirección'}</strong><span>{addressMethod === 'gps' ? 'Ubicación GPS confirmada' : addressMethod === 'map' ? 'Punto elegido en el mapa' : addressMethod === 'search' ? 'Dirección encontrada' : 'Pendiente de confirmar'}</span></div><button type="button" onClick={() => addressRef.current?.focus()}>Editar</button></div><button type="button" className="public-location-row" onClick={useMyLocation} disabled={locating}><Navigation /><strong>{locating ? 'Obteniendo ubicación…' : 'Usar mi ubicación actual'}</strong><ChevronRight /></button><label className="public-address-extra"><span>Casa / edificio / referencia</span><input value={addressReference} onChange={event => setAddressReference(event.target.value)} placeholder="Ej. Torre B, Piso 4, Apt. 4B" /></label><label className="public-address-extra"><span>Indicaciones adicionales <small>(opcional)</small></span><textarea value={notes} maxLength={500} onChange={event => setNotes(event.target.value)} placeholder="Ej. Timbre 04B, dejar con el conserje, etc." /></label><div className="public-address-summary"><div><small>Entrega estimada</small><strong>35–50 min</strong></div><span>{geoCoords ? 'Ubicación confirmada' : 'Selecciona una ubicación'}</span></div>{addressError && <p className="public-address-error" role="alert">{addressError}</p>}<button className="public-primary public-address-continue" disabled={!cart.length} onClick={continueFromAddress}>Continuar <ChevronRight /></button></div>}
        {step === 'details' && (
          <div className="public-checkout">
            <div className="public-data-intro">
              <strong>¿A nombre de quién?</strong>
              <span>Solo para coordinar tu pedido.</span>
            </div>
            {error && <p className="public-form-error" role="alert">{error}</p>}
            <div className="public-data-form-card">
              <label className="public-data-field"><span className="public-data-icon"><UserRound /></span><span className="public-data-field-copy"><span>Tu nombre</span><div className="public-data-input"><input autoComplete="name" value={name} onChange={event => setName(event.target.value)} placeholder="Nombre y apellido" /></div></span></label>
              <label className="public-data-field"><span className="public-data-icon"><Phone /></span><span className="public-data-field-copy"><span>Tu WhatsApp</span><div className="public-data-input"><input type="tel" inputMode="tel" autoComplete="tel" value={phone} onChange={event => setPhone(event.target.value)} placeholder="0412 000 0000" /></div><small>Te escribiremos aquí para confirmar</small></span></label>
            </div>
            <div className="public-pay-card">
              <div className="public-pay-head"><Wallet size={17} /><span>¿Cómo vas a pagar?</span></div>
              <div className="public-pay-modes">
                <button type="button" className={`public-pay-mode ${payMode === 'single' ? 'active' : ''}`} onClick={() => setPayMode('single')}>Un método</button>
                <button type="button" className={`public-pay-mode ${payMode === 'mixed' ? 'active' : ''}`} onClick={() => setPayMode('mixed')}>Mixto (2 métodos)</button>
              </div>
              <div className="public-pay-selects">
                <div className="public-pay-select">
                  <span>{payMode === 'mixed' ? 'Primer método' : 'Método de pago'}</span>
                  <PayDropdown value={payPrimary} onChange={setPayPrimary} />
                </div>
                {payMode === 'mixed' && (
                  <div className="public-pay-select">
                    <span>Segundo método</span>
                    <PayDropdown value={paySecondary} onChange={setPaySecondary} />
                  </div>
                )}
              </div>
              {payMode === 'mixed' && <p className="public-pay-hint">Al cobrar coordinamos cuánto va por cada método.</p>}
            </div>
            <label className="public-data-notes"><span className="public-data-notes-title"><MessageSquareText /><span><strong>¿Algo para la cocina?</strong><small>Opcional</small></span></span><textarea value={notes} maxLength={500} onChange={event => setNotes(event.target.value)} placeholder="Ej. Sin cebollín, poca salsa…" /></label>
            <div className="public-data-privacy"><ShieldCheck /><span>Tus datos están seguros y solo se usarán para este pedido.</span></div>
            <button className="public-primary whatsapp" disabled={submitting} onClick={continueToConfirmation}>Revisar pedido <ChevronRight /></button>
          </div>
        )}
        {step === 'confirm' && <div className="public-confirm-page"><div className="public-receipt"><div className="public-receipt-head"><img src="/optimized/root/logo.webp" alt="Full China" /><div><span>Solicitud</span><strong>{orderCode || draftOrderCode || 'WEB-PENDIENTE'}</strong><small>Ahora · pedido web</small></div></div>
          <div className="public-confirm-items">{cart.map(item => <div className="public-confirm-item" key={cartLineKey(item)}><img src={optimizedProductImage(item.imageUrl) || '/optimized/login-carousel/slide3.webp'} alt="" /><div><strong>{cartProductName(item.productName)}</strong><span>{item.quantity} {item.quantity === 1 ? 'porción' : 'porciones'}</span>{item.notes && <small>{item.notes}</small>}</div><b>{money(item.price * item.quantity)}{priceBs(item.price * item.quantity) && <small className="public-cart-item-bs">{priceBs(item.price * item.quantity)}</small>}</b><button type="button" onClick={() => setStep('cart')}>Editar</button></div>)}</div>
          <div className="public-total public-review-total"><span>Subtotal productos</span><strong>{money(total)}{priceBs(total) && <small className="public-total-bs">{priceBs(total)}</small>}</strong><div className="public-delivery-total-label">{orderType === 'delivery' ? 'Delivery' : 'Retiro'}</div><div className={`public-delivery-total-value ${orderType === 'takeaway' ? 'is-pickup' : ''}`}>{orderType === 'delivery' ? 'Por confirmar' : 'En el local'}</div><b>Total productos <em>{money(total)}{priceBs(total) && <small className="public-total-bs">{priceBs(total)}</small>}</em></b></div>
          <div className="public-confirm-info"><button type="button" onClick={() => setStep(orderType === 'delivery' ? 'address' : 'delivery')}><MapPin /><div><strong>{orderType === 'delivery' ? 'Dirección de entrega' : 'Entrega'}</strong><span>{orderType === 'delivery' ? address : 'Retirar en Full China'}</span><small>{orderType === 'delivery' ? addressReference || 'Sin referencia adicional' : 'Listo para retirar en el local'}</small></div><b>Editar</b></button><button type="button" onClick={() => setStep('details')}><UserRound /><div><strong>Datos de contacto</strong><span>{name}</span><small>{phone}</small></div><b>Editar</b></button></div>{error && <p className="public-form-error">{error}</p>}</div>
          <button className="public-primary whatsapp public-whatsapp-cta" disabled={submitting} onClick={submitOrder}><span className="public-whatsapp-mark" aria-hidden="true"><svg viewBox="0 0 32 32" role="img"><circle cx="16" cy="16" r="13" /><path d="M11.5 10.8c.4-.5 1-.5 1.4-.1l1.7 1.8c.4.4.4 1 0 1.4l-1 1c1 2 2.4 3.4 4.4 4.4l1-1c.4-.4 1-.4 1.4 0l1.8 1.7c.4.4.4 1-.1 1.4-.8.8-2 1.1-3.1.7-4.5-1.4-7.7-4.6-9.1-9.1-.4-1.1-.1-2.3.7-3.1Z" /></svg></span><span className="public-whatsapp-copy"><strong>{submitting ? 'Preparando pedido…' : 'Enviar pedido'}</strong><small>Se abrirá WhatsApp para confirmar</small></span><b className="public-whatsapp-total">{money(total)}{priceBs(total) && <small className="public-whatsapp-total-bs">{priceBs(total)}</small>}</b><span className="public-whatsapp-arrow"><ChevronRight /></span></button><p className="public-order-security">⌕ &nbsp; Tu pedido será confirmado directamente por Full China</p>
        </div>}
        {step === 'preparing' && <div className="public-preparing-page"><img className="preparing-logo" src="/optimized/root/logo.webp" alt="Full China" /><div className="public-preparing-visual" aria-hidden="true"><img className="preparing-layer preparing-fire-red" src="/optimized/cargando-pedido/fuego-circulo-rojo.webp" alt="" /><span className="preparing-composition-arrow preparing-composition-arrow-left"><ChevronRight size={20} /></span><img className="preparing-layer preparing-wok-new" src="/optimized/cargando-pedido/wok-nuevo.webp" alt="" /><span className="preparing-composition-arrow preparing-composition-arrow-right"><ChevronRight size={20} /></span><img className="preparing-layer preparing-whatsapp-green" src="/optimized/cargando-pedido/whatsapp-circulo-verde.webp" alt="" /></div><h3>Preparando tu pedido<br />para WhatsApp<span className="preparing-ellipsis">…</span></h3><p>Estamos creando tu solicitud segura.</p><div className="public-preparing-progress" aria-label="Progreso del pedido"><div className="public-progress-rail"><span /></div><div className="public-progress-step progress-step-one"><i><Check size={22} /></i><strong>Solicitud<br />creada</strong></div><div className="public-progress-step progress-step-two"><i><Check size={22} /></i><strong>Armando tu<br />pedido</strong></div><div className="public-progress-step progress-step-three"><i><LoaderCircle size={22} /></i><strong>Abriendo<br />WhatsApp</strong></div></div><div className="public-preparing-security"><ShieldCheck size={20} /><div><strong>Tus datos viajan seguros</strong><span>Solo los usamos para confirmar tu pedido.</span></div></div></div>}
        {step === 'sent' && <div className="public-success"><span><Check /></span><h3>¡Enviado!</h3><strong>{orderCode || 'WEB-PENDIENTE'}</strong><p>Ahora espera la confirmación de Full China por <b>WhatsApp</b>.</p><div className="public-status-timeline"><div className="complete"><i><Check size={18} /></i><div><strong>Solicitud creada</strong><small>Tu pedido fue registrado correctamente.</small></div><time>Ahora</time></div><div className="complete"><i><Check size={18} /></i><div><strong>Enviado por WhatsApp</strong><small>Tu solicitud fue enviada a Full China.</small></div><time>Ahora</time></div><div className="pending"><i>3</i><div><strong>Esperando confirmación</strong><small>Te confirmaremos tu pedido por WhatsApp.</small></div><time>◷</time></div></div><button className="public-primary" onClick={() => window.open(whatsappUrl || `https://wa.me/${String(import.meta.env.VITE_FULLCHINA_WHATSAPP || '').replace(/\D/g, '')}`, '_blank', 'noopener,noreferrer')}>Volver a WhatsApp</button>{lastOrder.length > 0 && <button className="public-repeat-order" onClick={repeatLastOrder}><RotateCcw size={16} /> Repetir este pedido</button>}<button className="public-primary" onClick={startNewOrder}>Hacer otro pedido</button></div>}
        {showAllExtras && step === 'cart' && <div className="public-cart-all-extras"><div className="public-cart-all-extras-head"><div><span>CATÁLOGO RÁPIDO</span><h3>Agrega algo más</h3></div><button type="button" onClick={() => { setShowAllExtras(false); setExtrasSearch('') }} aria-label="Cerrar">×</button></div><label className="public-cart-extras-search"><Search size={16} /><input value={extrasSearch} onChange={event => setExtrasSearch(event.target.value)} placeholder="Buscar un plato, bebida o extra" /><button type="button" onClick={() => setExtrasSearch('')} aria-label="Limpiar búsqueda">×</button></label><div className="public-cart-extra-sections">{extrasSections.length === 0 ? <p className="public-cart-extras-empty">No encontramos ese producto. Prueba con otro nombre.</p> : extrasSections.map(([category, categoryGroups]) => <section key={category}><div className="public-cart-extra-section-head"><h4>{categoryLabel(category)}</h4><span>{categoryGroups.length}</span></div><div className="public-cart-all-extras-grid">{categoryGroups.map(group => <article key={group.key}><img src={optimizedProductImage(group.variants[0]?.product.imageUrl) || productImage(group.category)} alt="" /><div><strong>{productTitle(group.name)}</strong><b>{money(group.minPrice)}{priceBs(group.minPrice) && <small className="public-reco-bs">{priceBs(group.minPrice)}</small>}</b></div><button type="button" onClick={() => { const product = group.variants[0]?.product; if (product) addProduct(product) }}><Plus size={15} /></button></article>)}</div></section>)}</div></div>}
      </aside></div>}
    </main>
  )
}
