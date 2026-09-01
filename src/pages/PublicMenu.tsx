import { lazy, Suspense, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type SyntheticEvent } from 'react'
import { ArrowUpRight, Bike, Check, ChevronRight, CircleAlert, CircleCheck, Clock, Flame, Heart, LoaderCircle, Wallet, MapPin, MessageSquareText, Minus, Phone, Plus, Search, Navigation, RotateCcw, ShieldCheck, ShoppingBag, ShoppingCart, Star, Store, Trash2, UserRound, Utensils, X, Zap } from 'lucide-react'
import { groupMenuProducts, type MenuProductGroup } from '../lib/menuGrouping'
import { createWebOrder, getPublicCatalog, getPublicMenuCategories, getPublicDeliverySettings, getPublicProductModifiers, type WebOrderCartItem } from '../lib/publicOrders'
import { estimateDelivery, type DeliverySettings, type DeliveryEstimate } from '../lib/delivery'
import { type ProductModifierGroup } from '../lib/dataService'
import { getExchangeRates } from '../lib/rates'
import type { Product } from '../lib/dataService'
import { PublicMenuSkeleton } from '../components/PublicMenuSkeleton'
import { HeroWokEmbers } from '../components/HeroWokEmbers'
import { formatProductTitle, formatSpanishText, normalizeForSearch } from '../lib/textFormat'
import { categoryLabel, classifyMenuCategory, menuItemRank, menuCategoryRank, isKnownCategory, hydrateMenuCategories, MENU_CATEGORY_ORDER } from '../lib/menuCategories'
import Toast from '../components/Toast'
import './PublicMenu.css'

declare global { interface Window { __removeFCSplash?: () => void } }

// Selección curada para la sección "Date un banquete en Full China" del inicio.
// Curados para no solaparse con "Nuestras Promociones" (categorías promociones/ejecutivos/individuales).
const FEATURED_DISH_QUERIES = ['arroz frito especial', 'chop suey especial', 'costillas agridulce', 'vermicelli especial']

const CATEGORY_ICONS: Record<string, string> = {
  Todos: '/optimized/menu-icons/menu.webp',
  arroz: '/optimized/menu-icons/arroz chino.webp',
  chopsuey: '/optimized/menu-icons/Chopsuey.webp',
  tallarines: '/optimized/menu-icons/tallarines.webp',
  pastas: '/optimized/menu-icons/pastas.webp',
  promociones: '/optimized/menu-icons/promociones.webp',
  bebidas: '/optimized/menu-icons/bebidas.webp',
  individuales: '/optimized/menu-icons/individuales.webp',
  ejecutivos: '/optimized/menu-icons/ejecutivo.webp',
  raciones: '/optimized/menu-icons/raciones.webp',
  extras: '/optimized/menu-icons/raciones.webp',
  otros: '/optimized/menu-icons/menu.webp',
}

// Tinte de fondo (RGB) para el efecto de "profundidad" que acompaña el
// scroll en la vista "Todos" — sutil, no reemplaza la imagen de fondo de la
// marca, solo la tiñe levemente según lo que se está viendo. Solo usa los
// colores de la marca (rojo, dorado, naranja), intercalados por categoría.
const CATEGORY_ACCENT_CYCLE = ['227, 27, 43', '255, 200, 61', '234, 88, 12']

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
const AddressMap = lazy(() => import('../components/PublicAddressMap').then(module => ({ default: module.PublicAddressMap })))

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
// v2 intentionally drops caches created while the public RPC still returned
// inline Base64 images (those entries could occupy several megabytes).
const CATALOG_CACHE_KEY = 'fullchina_public_catalog_v2'
const CATALOG_CACHE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000
// Debe coincidir exactamente con el breakpoint de PublicMenu.css: escritorio
// desde 1280px, o desde 1024px cuando el dispositivo (iPad/tablet) está en horizontal.
const DESKTOP_MEDIA_QUERY = '(min-width: 1280px), (min-width: 1024px) and (orientation: landscape)'

type DesktopTab = 'inicio' | 'menu' | 'contacto'

const readDesktopTab = (): DesktopTab => {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function' || !window.matchMedia(DESKTOP_MEDIA_QUERY).matches) return 'inicio'
  try {
    const savedTab = localStorage.getItem(DESKTOP_TAB_KEY)
    return savedTab === 'menu' || savedTab === 'contacto' ? savedTab : 'inicio'
  } catch {
    return 'inicio'
  }
}

type PublicMenuCategory = { key: string; label: string; sortOrder: number }
type CatalogCache = { products: Product[]; categories: PublicMenuCategory[]; savedAt: number }

function readCatalogCache(): CatalogCache | null {
  try {
    const cached = JSON.parse(localStorage.getItem(CATALOG_CACHE_KEY) || 'null') as CatalogCache | null
    if (!cached || !Array.isArray(cached.products) || cached.products.length === 0 || !Number.isFinite(cached.savedAt)) return null
    if (Date.now() - cached.savedAt > CATALOG_CACHE_MAX_AGE_MS) return null
    return cached
  } catch {
    return null
  }
}

function saveCatalogCache(products: Product[], categories: PublicMenuCategory[]) {
  try {
    localStorage.setItem(CATALOG_CACHE_KEY, JSON.stringify({ products, categories, savedAt: Date.now() } satisfies CatalogCache))
  } catch {
    // El catálogo sigue funcionando aunque el navegador no permita almacenamiento.
  }
}

function prepareCatalog(catalog: Product[]) {
  const resolveCategory = (product: { name: string; category: string }) =>
    product.category !== 'otros' && isKnownCategory(product.category)
      ? product.category
      : classifyMenuCategory(product.name, product.category)

  return catalog.map(product => {
    const primary = resolveCategory(product)
    const extras = (product.categories ?? []).filter(category => category !== product.category)
    return { ...product, category: primary, categories: Array.from(new Set([primary, ...extras])) }
  }).sort((a, b) => {
    const categoryDelta = menuCategoryRank(a.category) - menuCategoryRank(b.category)
    return categoryDelta || menuItemRank(a.name, a.category) - menuItemRank(b.name, b.category)
  })
}

// Métodos de pago que el cliente puede indicar en la web. Los códigos coinciden
// con los del sistema de cobro para poder pre-seleccionarlos en la comanda.
const PAY_OPTIONS = [
  { code: 'cash', label: 'Efectivo' },
  { code: 'mobile', label: 'Pago móvil' },
  { code: 'transfer', label: 'Transferencia' },
  { code: 'card', label: 'Punto' },
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
function productImage(category: string) {
  const sum = [...category].reduce((acc, char) => acc + char.charCodeAt(0), 0)
  return CATEGORY_IMAGES[sum % CATEGORY_IMAGES.length]
}

function optimizedProductImage(imageUrl: string | null | undefined) {
  if (!imageUrl) return null
  const match = imageUrl.match(/^\/productos\/([^/?#]+)\.(?:png|jpe?g|webp)([?#].*)?$/i)
  return match ? `/optimized/productos/${match[1]}.webp${match[2] || ''}` : imageUrl
}

function previewImageSource(source: string) {
  const match = source.match(/^\/optimized\/(productos|fondos|login-carousel)\/([^?#]+\.webp)([?#].*)?$/i)
  return match ? `/optimized/previews/${match[1]}/${match[2]}${match[3] || ''}` : null
}

function money(value: number) {
  return new Intl.NumberFormat('es-VE', { style: 'currency', currency: 'USD' }).format(value)
}

function productTitle(name: string) {
  // Keep the em dash with the variant that follows it. This lets the line
  // break happen before the dash instead of leaving a dangling dash above.
  return formatProductTitle(name).replace(/\s+—\s+/g, ' —\u00a0')
}

function groupDescription(group: MenuProductGroup) {
  if (group.isGrouped) return group.variants.map(item => formatSpanishText(item.label)).join(' • ')
  return group.variants[0].product.description || ''
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
  const pageRef = useRef<HTMLElement>(null)
  const designMode = new URLSearchParams(window.location.search).get('modo') === 'diseno'
  const isDesktopViewport = typeof window.matchMedia === 'function' && window.matchMedia(DESKTOP_MEDIA_QUERY).matches
  const initialCatalog = useMemo(() => {
    const cached = designMode ? null : readCatalogCache()
    if (cached?.categories.length) hydrateMenuCategories(cached.categories)
    return cached
  }, [designMode])
  const [products, setProducts] = useState<Product[]>(() => initialCatalog?.products.filter(product => !product.categories.includes('extras')) ?? [])
  // Los productos de categoría "extras" no se muestran como tarjeta en el menú;
  // solo se ofrecen como add-on dentro del detalle de cada plato (el check).
  const [extrasProducts, setExtrasProducts] = useState<Product[]>(() => initialCatalog?.products.filter(product => product.categories.includes('extras')) ?? [])
  const [cart, setCart] = useState<WebOrderCartItem[]>(() => {
    try { return JSON.parse(localStorage.getItem(CART_KEY) || '[]') as WebOrderCartItem[] } catch { return [] }
  })
  const [selectedGroup, setSelectedGroup] = useState<MenuProductGroup | null>(null)
  const [closingDetail, setClosingDetail] = useState(false)
  const [detailOrigin, setDetailOrigin] = useState<{ x: number; y: number } | null>(null)
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(null)
  const [detailQuantity, setDetailQuantity] = useState(1)
  const [detailNotes, setDetailNotes] = useState('')
  const [detailModifierGroups, setDetailModifierGroups] = useState<ProductModifierGroup[]>([])
  const [loadingModifiers, setLoadingModifiers] = useState(false)
  const [selectedExtras, setSelectedExtras] = useState<string[]>([])
  const [activeCategory, setActiveCategory] = useState('Todos')
  const [scrollCategory, setScrollCategory] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [favoriteIds, setFavoriteIds] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem(FAVORITES_KEY) || '[]') as string[] } catch { return [] }
  })
  const [showFavorites, setShowFavorites] = useState(false)
  const [showAllExtras, setShowAllExtras] = useState(false)
  const [closingAllExtras, setClosingAllExtras] = useState(false)
  const closeAllExtras = () => {
    setClosingAllExtras(true)
    window.setTimeout(() => {
      setShowAllExtras(false)
      setClosingAllExtras(false)
      setExtrasSearch('')
    }, 220)
  }
  const [extrasSearch, setExtrasSearch] = useState('')
  const [showSearch, setShowSearch] = useState(false)
  const [cartOpen, setCartOpen] = useState(false)
  const [closingCart, setClosingCart] = useState(false)
  const [step, setStep] = useState<'cart' | 'delivery' | 'address' | 'details' | 'confirm' | 'preparing' | 'sent'>('cart')
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [identification, setIdentification] = useState('')
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
  const [deliverySettings, setDeliverySettings] = useState<DeliverySettings | null>(null)
  const [deliveryEstimate, setDeliveryEstimate] = useState<DeliveryEstimate | null>(null)
  const [loading, setLoading] = useState(() => !initialCatalog)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  // Al aparecer un error de validación, subir la tarjeta al tope para que se vea
  useEffect(() => {
    if (!error) return
    document.querySelector('.public-cart-drawer')?.scrollTo({ top: 0, behavior: 'smooth' })
  }, [error])
  const [cartGuardMessage, setCartGuardMessage] = useState('')
  const [cartGuardClosing, setCartGuardClosing] = useState(false)
  const restoringFlow = useRef(true)
  const [orderCode, setOrderCode] = useState('')
  const [draftOrderCode, setDraftOrderCode] = useState('')
  const [whatsappUrl, setWhatsappUrl] = useState('')
  const [addFeedback, setAddFeedback] = useState<{ name: string; imageUrl?: string } | null>(null)
  const [addFeedbackClosing, setAddFeedbackClosing] = useState(false)
  const [cartPulse, setCartPulse] = useState(false)
  const [recommendedIndex, setRecommendedIndex] = useState(0)
  const recommendedTimer = useRef<ReturnType<typeof setInterval> | null>(null)
  const [sidebarRecoIndex, setSidebarRecoIndex] = useState(0)
  const sidebarRecoTimer = useRef<ReturnType<typeof setInterval> | null>(null)
  const addFeedbackTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const addFeedbackExitTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const cartPulseTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const heroSearchRef = useRef<HTMLInputElement>(null)
  const popularScrollRef = useRef<HTMLDivElement>(null)
  const [canScrollPopular, setCanScrollPopular] = useState(false)
  const scrollPopular = (direction: 1 | -1) => {
    const el = popularScrollRef.current
    if (!el) return
    const card = el.querySelector<HTMLElement>('.public-home-product-card')
    const step = card ? card.offsetWidth + 16 : el.clientWidth * 0.8
    el.scrollBy({ left: step * direction, behavior: 'smooth' })
  }
  const submitLockRef = useRef(false)
  const checkoutAttemptRef = useRef<{ signature: string; key: string } | null>(readCheckoutAttempt())
  const [lastOrder, setLastOrder] = useState<WebOrderCartItem[]>(() => {
    try { return JSON.parse(localStorage.getItem(LAST_ORDER_KEY) || '[]') as WebOrderCartItem[] } catch { return [] }
  })
  const [currentTab, setCurrentTab] = useState<DesktopTab>(readDesktopTab)

  const revealDecodedImage = (image: HTMLImageElement) => {
    const source = image.currentSrc || image.src
    const reveal = () => {
      if ((image.currentSrc || image.src) !== source) return
      image.dataset.revealedSrc = source
      image.classList.add('public-image-ready')
    }
    if (typeof image.decode === 'function') void image.decode().then(reveal, reveal)
    else reveal()
  }

  const prepareImage = (image: HTMLImageElement) => {
    const domSource = image.getAttribute('src') || ''
    const trackedSource = image.dataset.fullSrc

    if (trackedSource && image.dataset.imageQuality === 'preview' && domSource === image.dataset.previewSrc) return
    if (trackedSource && image.dataset.imageQuality === 'full' && domSource === trackedSource) return

    const fullSource = domSource
    const previewSource = previewImageSource(fullSource)
    if (!previewSource || previewSource === fullSource) {
      image.dataset.fullSrc = fullSource
      image.dataset.imageQuality = 'full'
      if (image.complete && image.naturalWidth > 0) revealDecodedImage(image)
      return
    }

    image.dataset.fullSrc = fullSource
    image.dataset.previewSrc = previewSource
    image.dataset.imageQuality = 'preview'
    image.classList.remove('public-image-ready', 'public-image-error')
    image.src = previewSource

    const fullImage = new Image()
    fullImage.decoding = 'async'
    fullImage.src = fullSource
    fullImage.onload = () => {
      const decoded = typeof fullImage.decode === 'function' ? fullImage.decode() : Promise.resolve()
      void decoded.catch(() => undefined).then(() => {
        if (image.dataset.fullSrc !== fullSource) return
        image.dataset.imageQuality = 'full'
        image.src = fullSource
      })
    }
  }

  const handleImageLoad = (event: SyntheticEvent<HTMLElement>) => {
    const image = event.target
    if (image instanceof HTMLImageElement) revealDecodedImage(image)
  }

  const handleImageError = (event: SyntheticEvent<HTMLElement>) => {
    const image = event.target
    if (image instanceof HTMLImageElement) image.classList.add('public-image-error')
  }

  // Before every paint, hide any node whose src changed. It becomes visible
  // only after the browser confirms the replacement image is fully decoded.
  useLayoutEffect(() => {
    const images = pageRef.current?.querySelectorAll('img') ?? []
    images.forEach(image => {
      const source = image.currentSrc || image.src
      if (image.dataset.revealedSrc !== source) image.classList.remove('public-image-ready', 'public-image-error')
      prepareImage(image)
    })
  })

  useEffect(() => {
    if (typeof window.matchMedia !== 'function' || !window.matchMedia(DESKTOP_MEDIA_QUERY).matches) return
    try { localStorage.setItem(DESKTOP_TAB_KEY, currentTab) } catch { /* storage unavailable */ }
  }, [currentTab])

  useEffect(() => {
    if (showSearch) {
      const t = setTimeout(() => heroSearchRef.current?.focus(), 50)
      return () => clearTimeout(t)
    }
  }, [showSearch])

  useEffect(() => {
    if (designMode) {
      setProducts([])
      setBcvRate(null)
      setLoading(false)
      window.__removeFCSplash?.()
      return
    }
    getPublicDeliverySettings().then(setDeliverySettings).catch(() => setDeliverySettings(null))
    // La tasa es información secundaria: nunca debe bloquear la aparición del menú.
    getExchangeRates().then(rates => setBcvRate(rates.bcv || null)).catch(() => setBcvRate(null))
    Promise.all([getPublicCatalog(), getPublicMenuCategories().catch(() => [] as PublicMenuCategory[])])
      .then(([catalog, cats]) => {
        if (cats.length) hydrateMenuCategories(cats)
        const resolved = prepareCatalog(catalog)
        saveCatalogCache(resolved, cats)
        setExtrasProducts(resolved.filter(p => p.categories.includes('extras')))
        setProducts(resolved.filter(p => !p.categories.includes('extras')))
      })
      .catch(() => {
        if (!initialCatalog) setError('No pudimos cargar el menú. Intenta nuevamente.')
      })
      .finally(() => {
        setLoading(false)
        window.__removeFCSplash?.()
      })
  }, [designMode, initialCatalog])

  const categories = useMemo(() => {
    const extracted = Array.from(new Set(products.flatMap(p => p.categories)));
    const allCats = Array.from(new Set([...MENU_CATEGORY_ORDER, ...extracted]));
    allCats.sort((a, b) => menuCategoryRank(a) - menuCategoryRank(b));
    return ['Todos', ...allCats.filter(c => c !== 'otros' && c !== 'extras')];
  }, [products]);
  const groups = useMemo(() => groupMenuProducts(products.filter(product => {
    const categoryMatch = activeCategory === 'Todos' || product.categories.includes(activeCategory)
    const term = normalizeForSearch(search)
    return categoryMatch && (!term || normalizeForSearch(`${product.name} ${product.description || ''}`).includes(term))
  })), [products, activeCategory, search])
  const visibleGroups = useMemo(() => showFavorites ? groups.filter(group => favoriteIds.includes(group.key)) : groups, [groups, showFavorites, favoriteIds])
  const popularGroups = useMemo(() => {
    const all = groupMenuProducts(products)
    const stopWords = new Set(['el', 'la', 'los', 'las', 'un', 'una', 'de'])
    const curated = FEATURED_DISH_QUERIES
      .map(query => all.find(group => {
        const haystack = normalizeForSearch(`${group.name} ${group.category} ${group.variants.map(v => `${v.label} ${v.product.name}`).join(' ')}`)
        const words = normalizeForSearch(query).split(/\s+/).filter(w => w && !stopWords.has(w))
        return words.length > 0 && words.every(w => haystack.includes(w))
      }))
      .filter((group): group is MenuProductGroup => Boolean(group))
    return curated.length > 0 ? curated : all.slice(0, 4)
  }, [products])
  useEffect(() => {
    const el = popularScrollRef.current
    if (!el) return
    const check = () => setCanScrollPopular(el.scrollWidth > el.clientWidth + 1)
    check()
    const observer = new ResizeObserver(check)
    observer.observe(el)
    return () => observer.disconnect()
  }, [popularGroups])
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
    .map(category => ({ category, groups: visibleGroups.filter(group => group.variants.some(v => v.product.categories.includes(category))) }))
    .filter(section => section.groups.length > 0), [categories, visibleGroups])

  // Fondo dinámico por categoría: mientras se navega "Todos" en scroll, un
  // IntersectionObserver detecta qué sección de categoría está a la vista y
  // tiñe el fondo con su color de acento — un efecto de "profundidad" hecho
  // a propósito, no un adorno genérico. Se desactiva con "reducir movimiento".
  useEffect(() => {
    if (activeCategory !== 'Todos' || categorySections.length === 0) {
      setScrollCategory(null)
      return
    }
    const sections = Array.from(document.querySelectorAll<HTMLElement>('.public-category-section[data-category]'))
      .filter(el => el.offsetParent !== null)
    if (sections.length === 0) return

    const observer = new IntersectionObserver(
      entries => {
        const visible = entries.filter(e => e.isIntersecting)
        if (visible.length === 0) return
        const topMost = visible.reduce((a, b) => (a.boundingClientRect.top <= b.boundingClientRect.top ? a : b))
        const category = topMost.target.getAttribute('data-category')
        if (category) setScrollCategory(category)
      },
      { rootMargin: '-35% 0px -55% 0px', threshold: 0 }
    )
    sections.forEach(el => observer.observe(el))
    return () => observer.disconnect()
  }, [activeCategory, categorySections])

  const displayAccentCategory = activeCategory !== 'Todos' ? activeCategory : scrollCategory
  const orderedCategories = useMemo(() => categories.filter(category => category !== 'Todos'), [categories])
  const accentIndex = displayAccentCategory ? orderedCategories.indexOf(displayAccentCategory) : -1
  const accentRgb = accentIndex === -1 ? CATEGORY_ACCENT_CYCLE[0] : CATEGORY_ACCENT_CYCLE[accentIndex % CATEGORY_ACCENT_CYCLE.length]

  const recommendedPool = useMemo(() => {
    const source = activeCategory === 'Todos'
      ? groups
      : groups.filter(group => group.variants.some(v => v.product.categories.includes(activeCategory)))
    const pool = [...(source.length > 0 ? source : groups)]
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]]
    }
    return pool.slice(0, 8)
  }, [groups, activeCategory])

  useEffect(() => {
    setRecommendedIndex(0)
  }, [activeCategory])

  useEffect(() => {
    if (recommendedPool.length <= 1) return
    recommendedTimer.current = setInterval(() => {
      setRecommendedIndex(prev => (prev + 1) % recommendedPool.length)
    }, 4500)
    return () => { if (recommendedTimer.current) clearInterval(recommendedTimer.current) }
  }, [recommendedPool.length])

  const recommendedGroup = recommendedPool[recommendedIndex] ?? recommendedPool[0] ?? groups[0]
  const isStoreOpen = (() => {
    const hour = new Date().getHours()
    return hour >= 11 && hour < 22
  })()
  const itemCount = cart.reduce((sum, item) => sum + item.quantity, 0)
  const total = cart.reduce((sum, item) => sum + item.price * item.quantity, 0)
  const deliveryFee = orderType === 'delivery' && deliveryEstimate?.fee != null ? deliveryEstimate.fee : 0
  const orderTotal = total + deliveryFee
  useEffect(() => {
    if (orderType !== 'delivery' || !geoCoords || !deliverySettings?.enabled) {
      setDeliveryEstimate(null)
      return
    }
    setDeliveryEstimate(estimateDelivery(deliverySettings, geoCoords.lat, geoCoords.lng))
  }, [orderType, geoCoords, deliverySettings])
  const deliveryFeeText = orderType !== 'delivery'
    ? 'No aplica'
    : deliveryEstimate && deliveryEstimate.fee != null
      ? `$${deliveryEstimate.fee.toFixed(2)}`
      : 'Por confirmar'
  const cartProductIds = useMemo(() => new Set(cart.map(item => item.productId)), [cart])
  const recommendations = groups.filter(group => !group.variants.some(variant => cartProductIds.has(variant.product.id))).slice(0, 3)

  useEffect(() => {
    setSidebarRecoIndex(0)
  }, [recommendations.length])

  useEffect(() => {
    if (recommendations.length <= 1) return
    sidebarRecoTimer.current = setInterval(() => {
      setSidebarRecoIndex(prev => (prev + 1) % recommendations.length)
    }, 4500)
    return () => { if (sidebarRecoTimer.current) clearInterval(sidebarRecoTimer.current) }
  }, [recommendations.length])
  // "Ver todos" belongs to the cart, not to the currently selected menu tab.
  // Build it from the complete catalog so a mobile category filter cannot leak
  // into the quick catalog (e.g. Promociones showing only more promotions).
  const allCatalogGroups = useMemo(() => groupMenuProducts(products), [products])
  const allExtras = useMemo(
    () => allCatalogGroups.filter(group => !group.variants.some(variant => cartProductIds.has(variant.product.id))),
    [allCatalogGroups, cartProductIds],
  )
  const extrasSections = useMemo(() => {
    const query = normalizeForSearch(extrasSearch.trim())
    const filtered = allExtras.filter(group => !query || normalizeForSearch([
      group.name,
      group.category,
      ...group.variants.flatMap(variant => [variant.label, variant.product.name, variant.product.description || '']),
    ].join(' ')).includes(query))
    const sections = new Map<string, MenuProductGroup[]>()
    filtered.forEach(group => sections.set(group.category, [...(sections.get(group.category) || []), group]))
    return Array.from(sections.entries()).sort(([categoryA], [categoryB]) => menuCategoryRank(categoryA) - menuCategoryRank(categoryB))
  }, [allExtras, extrasSearch])

  useEffect(() => {
    try {
      if (designMode) {
        setCartOpen(true)
        setStep('preparing')
        restoringFlow.current = false
        return
      }
      const saved = JSON.parse(localStorage.getItem(FLOW_STATE_KEY) || 'null') as Partial<{ cartOpen: boolean; step: string; name: string; phone: string; identification: string; email: string; orderType: 'takeaway' | 'delivery'; deliveryChosen: boolean; address: string; addressReference: string; notes: string; geoCoords: MapCoordinates; addressMethod: 'gps' | 'map' | 'search' }> | null
      if (saved && cart.length > 0) {
        setName(saved.name || '')
        setPhone(saved.phone || '')
        setIdentification(saved.identification || '')
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
    localStorage.setItem(FLOW_STATE_KEY, JSON.stringify({ cartOpen, step, name, phone, identification, email, orderType, deliveryChosen, address, addressReference, notes, geoCoords, addressMethod }))
  }, [cartOpen, step, name, phone, identification, email, orderType, deliveryChosen, address, addressReference, notes, geoCoords, addressMethod])

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
    setIdentification('')
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
    setCartGuardClosing(false)
    window.setTimeout(() => {
      setCartGuardClosing(true)
      window.setTimeout(() => { setCartGuardMessage(''); setCartGuardClosing(false) }, 200)
    }, 3000)
    return false
  }
  const closeSearch = () => {
    setShowSearch(false)
    setSearch('')
  }

  const addProduct = (product: Product, quantity = 1, notes = '', extrasPrice = 0) => {
    const imageUrl = optimizedProductImage(product.imageUrl) || undefined
    const linePrice = product.price + extrasPrice
    setAddFeedback({ name: formatProductTitle(product.name), imageUrl })
    setAddFeedbackClosing(false)
    setCartPulse(true)
    if (addFeedbackTimer.current) window.clearTimeout(addFeedbackTimer.current)
    if (addFeedbackExitTimer.current) window.clearTimeout(addFeedbackExitTimer.current)
    if (cartPulseTimer.current) window.clearTimeout(cartPulseTimer.current)
    addFeedbackTimer.current = setTimeout(() => {
      setAddFeedbackClosing(true)
      addFeedbackExitTimer.current = setTimeout(() => setAddFeedback(null), 320)
    }, 1800)
    cartPulseTimer.current = setTimeout(() => setCartPulse(false), 520)
    setCart(current => {
      const existing = current.find(item => item.productId === product.id && (item.notes || '') === notes)
      return existing
        ? current.map(item => item.productId === product.id && (item.notes || '') === notes ? { ...item, quantity: item.quantity + quantity } : item)
        : [...current, { productId: product.id, productName: formatProductTitle(product.name), price: linePrice, quantity, imageUrl, notes: notes || undefined }]
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

  const openGroup = (group: MenuProductGroup, originEvent?: { clientX: number; clientY: number }) => {
    setDetailOrigin(originEvent ? { x: originEvent.clientX, y: originEvent.clientY } : null)
    setClosingDetail(false)
    setSelectedGroup(group)
    setSelectedVariantId(group.variants[0]?.product.id ?? null)
    setDetailQuantity(1)
    setDetailNotes('')
    setSelectedExtras([])
    setDetailModifierGroups([])
    const productId = group.variants[0]?.product.id
    const isExtrasEligible = !group.variants.some(v =>
      v.product.categories.includes('bebidas') || v.product.categories.includes('extras')
    )
    if (productId) {
      setLoadingModifiers(true)
      getPublicProductModifiers(productId)
        .then(groups => {
          const real = groups.filter(item => item.options.length > 0)
          if (isExtrasEligible) {
            if (extrasProducts.length > 0) {
              real.push({
                modifierId: '__catalog_extras__',
                name: 'Extras',
                minSelections: 0,
                maxSelections: null,
                allowRepeat: false,
                options: extrasProducts.map(p => ({
                  id: p.id,
                  name: p.name.replace(/^[^—]+—\s*/, ''),
                  price: p.price,
                })),
              })
            }
          }
          setDetailModifierGroups(real)
        })
        .catch(() => setDetailModifierGroups([]))
        .finally(() => setLoadingModifiers(false))
    }
  }

  const selectedProduct = selectedGroup?.variants.find(({ product }) => product.id === selectedVariantId)?.product
    ?? selectedGroup?.variants[0]?.product
  const detailExtrasTotal = detailModifierGroups
    .flatMap(g => g.options.filter(o => selectedExtras.includes(o.id)))
    .reduce((sum, o) => sum + o.price, 0)

  const addSelectedProduct = () => {
    if (selectedProduct) {
      const chosen = detailModifierGroups.flatMap(group => group.options.filter(option => selectedExtras.includes(option.id)))
      const extrasPrice = chosen.reduce((sum, option) => sum + option.price, 0)
      const extras = chosen.map(option => option.price > 0 ? `${option.name} (+${money(option.price)})` : option.name)
      const lineNotes = [extras.length ? `Extras: ${extras.join(', ')}` : '', detailNotes.trim()].filter(Boolean).join(' · ')
      addProduct(selectedProduct, detailQuantity, lineNotes, extrasPrice)
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
    if (!/^(?:[VE]-?)?\d{6,10}$/i.test(identification.trim())) return setError('Escribe una cédula válida, por ejemplo V-12345678.')
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
    if (!/^(?:[VE]-?)?\d{6,10}$/i.test(identification.trim())) return setError('Escribe una cédula válida, por ejemplo V-12345678.')
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
      name: name.trim(), phone: phone.trim(), identification: identification.trim().toUpperCase(), orderType, address: address.trim(), orderNotes,
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
        customerName: name.trim(), customerPhone: phone.trim(), customerIdentification: identification.trim().toUpperCase(), orderType,
        deliveryAddress: address.trim(), notes: orderNotes, items: cart, bcvRate,
        idempotencyKey, deliveryFee, deliveryLat: geoCoords?.lat, deliveryLng: geoCoords?.lng,
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
        `Cédula: ${identification.trim().toUpperCase()}`,
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
        `Subtotal productos: ${money(total)}`,
        `Delivery: ${deliveryFeeText}`,
        `*Total del pedido: ${money(result.total)}*`,
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


  const renderProductCard = (group: MenuProductGroup, priority = false) => {
    const isBeverage = group.variants.some(({ product }) => product.categories.includes('bebidas'))
    const isTallBottle = /^(agua|refresco\s+2\s+litros)$/i.test(group.name.trim())
    const isLiptonBottle = /^lipton\b/i.test(group.name.trim())
    return (
      <article className="public-prod-card" key={group.key} onClick={event => openGroup(group, event)} role="button" tabIndex={0} onKeyDown={event => event.key === 'Enter' && openGroup(group)}>
        <div className="public-prod-img-wrap">
          <img src={optimizedProductImage(group.variants[0]?.product.imageUrl) || productImage(group.category)} className={`public-prod-img ${isBeverage ? 'public-prod-img--beverage' : ''} ${isTallBottle ? 'public-prod-img--tall-bottle' : ''} ${isLiptonBottle ? 'public-prod-img--lipton' : ''}`} alt={group.name} loading={priority ? 'eager' : 'lazy'} fetchPriority={priority ? 'high' : 'auto'} decoding="async" />
          <button type="button" className={`public-favorite-btn ${favoriteIds.includes(group.key) ? 'active' : ''}`} onClick={event => { event.stopPropagation(); toggleFavorite(group.key) }} aria-label={favoriteIds.includes(group.key) ? `Quitar ${group.name} de favoritos` : `Guardar ${group.name} en favoritos`}><Heart size={16} fill={favoriteIds.includes(group.key) ? 'currentColor' : 'none'} /></button>
        </div>
        <div className="public-prod-info">
          <h3 className="public-prod-title">{productTitle(group.name)}</h3>
          <p className="public-prod-desc">{groupDescription(group)}</p>
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

  const renderDesktopProductCard = (group: MenuProductGroup) => {
    const qty = getCardQty(group.key)

    return (
      <article className="public-home-product-card" key={group.key} onClick={event => openGroup(group, event)} role="button" tabIndex={0} onKeyDown={event => event.key === 'Enter' && openGroup(group)}>
        <div className="public-home-prod-img-wrap">
          <img 
            src={optimizedProductImage(group.variants[0]?.product.imageUrl) || productImage(group.category)} 
            alt={group.name} 
            className={(group.name.toLowerCase().includes('agua') || group.name.toLowerCase().includes('2l') || group.name.toLowerCase().includes('2 l') || group.name.toLowerCase().includes('lipton')) ? 'public-img--beverage-recommended-align' : (group.category === 'bebidas' ? 'public-img--top-align' : '')}
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

  const renderDesktopPromoCard = (group: MenuProductGroup) => {
    return (
      <article className="public-home-promo-card" key={group.key} onClick={event => openGroup(group, event)} role="button" tabIndex={0} onKeyDown={event => event.key === 'Enter' && openGroup(group)}>
        <div className="public-home-promo-top">
          <h3 className="public-home-promo-title">{productTitle(group.name)}</h3>
          <div className="public-home-promo-price-row">
            <span className="public-home-promo-price">{money(group.minPrice)}</span>
          </div>

        </div>

        <div className="public-home-promo-img-wrap">
          <img 
            src={optimizedProductImage(group.variants[0]?.product.imageUrl) || productImage(group.category)} 
            alt={group.name} 
            className={(group.name.toLowerCase().includes('agua') || group.name.toLowerCase().includes('2l') || group.name.toLowerCase().includes('2 l') || group.name.toLowerCase().includes('lipton')) ? 'public-img--beverage-recommended-align' : (group.category === 'bebidas' ? 'public-img--top-align' : '')}
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
    <main
      ref={pageRef}
      className="public-menu-page"
      style={{ '--cat-accent': accentRgb } as CSSProperties}
      onLoadCapture={handleImageLoad}
      onErrorCapture={handleImageError}
    >
      {/* Top Navbar */}
      <header className="public-top-bar" id="inicio">
          <>
            {/* Mobile: empty left spacer */}
            <div className="mobile-only" style={{ width: 24 }} />

            {/* Logo — centered on mobile, left on desktop */}
            <div className="public-top-bar-center">
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

          </>
      </header>

      {/* =========================================================================
          MOBILE VIEWPORT (< 1280px) — 100% ORIGINAL f88d057 LAYOUT
          ========================================================================= */}
      <div className="public-mobile-view mobile-only">

        {/* MENU VIEW */}
        {currentTab !== 'contacto' && (
          <div className="public-mobile-tab-content" key="menu">
        {/* 2. Hero Status */}
        <div className="public-hero-header">
          <div className="public-hero-title-row">
            <h1>¿Qué provoca hoy? <Flame size={22} className="fire-icon-pulse" /></h1>
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
          <div className={`public-hero-search-pill ${showSearch ? 'is-active' : ''}`} onClick={() => { if (!showSearch) setShowSearch(true) }}>
            <Search size={16} />
            {showSearch ? (
              <>
                <input
                  ref={heroSearchRef}
                  placeholder="Busca Arroz, combos, pollo..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  onClick={e => e.stopPropagation()}
                />
                {search && <button className="public-search-pill-clear" onClick={() => setSearch('')}><X size={14}/></button>}
                <button className="public-search-pill-cancel" onClick={closeSearch}>Cancelar</button>
              </>
            ) : (
              <span>Busca Arroz, combos, pollo...</span>
            )}
          </div>
        </div>

        {/* 3. Recommended Card */}
        <div className="public-recommended-card">
          <div className="public-recommended-copy" key={`copy-${recommendedGroup?.key ?? 'empty'}`}>
            <small>RECOMENDADO <Flame size={12} /></small>
            <h2>{productTitle(recommendedGroup?.name ?? 'Explora nuestro menú')}</h2>
            <p>{recommendedGroup?.variants[0]?.product.description || 'Elige tu favorito y arma tu pedido.'}</p>
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
          <img key={`img-${recommendedGroup?.key ?? 'empty'}`} src={optimizedProductImage(recommendedGroup?.variants[0]?.product.imageUrl) || (recommendedGroup ? productImage(recommendedGroup.category) : '/optimized/login-carousel/slide3.webp')} alt={productTitle(recommendedGroup?.name ?? 'Menú Full China')} className={`public-recommended-img${['Agua', 'Refresco 2 Litros'].includes(recommendedGroup?.name ?? '') ? ' public-recommended-img--bottle' : ''}`} fetchPriority="high" decoding="async" />
          <div className="public-recommended-dots-overlay">
            {recommendedPool.map((_, i) => (
              <span key={i} className={i === recommendedIndex ? 'active' : ''} onClick={() => {
                if (i === recommendedIndex) return
                if (recommendedTimer.current) clearInterval(recommendedTimer.current)
                setRecommendedIndex(i)
              }} />
            ))}
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

          {error && products.length > 0 && <Toast type="error" message={error} onClose={() => setError('')} />}
          {error && products.length === 0 ? <div className="public-state error">{error}</div> : (
            <div className={`public-product-list ${activeCategory === 'Todos' ? 'public-product-list-grouped' : ''}`}>
              {visibleGroups.length === 0 ? (
                <div className="public-empty-menu">
                  <span><Utensils size={42} /></span>
                  <h3>{showFavorites ? 'Todavía no tienes favoritos' : 'No encontramos ese plato'}</h3>
                  <p>{showFavorites ? 'Toca el corazón de un plato para guardarlo en este dispositivo.' : 'Prueba con otro nombre o vuelve a ver todo el menú.'}</p>
                  <button type="button" onClick={() => { setSearch(''); setActiveCategory('Todos'); setShowFavorites(false) }}>Ver todo el menú</button>
                </div>
              ) : activeCategory === 'Todos' ? categorySections.map((section, sectionIndex) => (
                <section className="public-category-section" key={section.category} data-category={section.category}>
                  <div className="public-category-section-header"><h3>{categoryLabel(section.category)}</h3><span>{section.groups.length} {section.groups.length === 1 ? 'plato' : 'platos'}</span></div>
                  <div className="public-category-grid">{section.groups.map((group, groupIndex) => renderProductCard(group, sectionIndex === 0 && groupIndex < 4))}</div>
                </section>
              )) : visibleGroups.map((group, groupIndex) => renderProductCard(group, groupIndex < 4))}
            </div>
          )}
        </section>
          </div>
        )}

        {/* CONTACT VIEW */}
        {currentTab === 'contacto' && (
          <div className="public-mobile-tab-content" key="contacto">
          <section className="public-contact-view public-contact-page">
            <section className="public-cinematic-hero public-contact-hero">
              <HeroWokEmbers />
              <div className="public-hero-left public-contact-hero-copy">
                <span className="public-hero-tag">
                  <Flame size={14} className="fire-icon-pulse" />
                  ESTAMOS PARA SERVIRTE
                </span>
                <h1 className="public-hero-main-title">
                  CONTÁCTANOS <br /><span className="public-hero-gold">TE ESCUCHAMOS</span>
                </h1>
                <p className="public-hero-desc">Escríbenos, estamos para servirte.</p>
                <div className="public-hero-search-row public-contact-hero-actions">
                  {configuredPhone && (
                    <a href={`https://wa.me/${configuredPhone}`} target="_blank" rel="noopener noreferrer" className="public-hero-cta-btn public-contact-hero-cta">
                      Escríbenos ahora <ChevronRight size={16} />
                    </a>
                  )}
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
                    <a href="https://maps.app.goo.gl/sh8SDNhhdD6is87y8" target="_blank" rel="noopener noreferrer" className="public-contact-footer-cta is-location">
                      <Navigation size={16} />
                      <span>Cómo llegar</span>
                      <ChevronRight size={17} />
                    </a>
                  </div>
                </div>
              </article>
            </section>
          </section>
          </div>
        )}

        {/* Bottom Tab Bar */}
        <nav className="public-mobile-tab-bar">
          <button className={`public-mobile-tab ${currentTab !== 'contacto' ? 'active' : ''}`} onClick={() => setCurrentTab('menu')}>
            <Utensils size={18} />
            <span>Menú</span>
          </button>
          <button className={`public-mobile-tab ${currentTab === 'contacto' ? 'active' : ''}`} onClick={() => setCurrentTab('contacto')}>
            <Store size={18} />
            <span>Contacto</span>
          </button>
        </nav>
      </div>

      {/* =========================================================================
          DESKTOP VIEWPORT (>= 1280px) — 2-COLUMN PRO LAYOUT
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
                    <Flame size={14} className="fire-icon-pulse" />
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
                      <Search size={18} />
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
                    src="/optimized/fondos/hero-banner-food.webp"
                    alt="Full China Wok y Arroz Chaufa" 
                    className="public-hero-dish-img" 
                    loading={isDesktopViewport ? 'eager' : 'lazy'}
                    fetchPriority={isDesktopViewport ? 'high' : 'low'}
                    decoding="async" 
                  />
                  <div className="public-hero-gradient-overlay" />
                </div>
              </section>

              {/* 3. NUESTRAS CATEGORÍAS */}
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
                  {categories.filter(c => c !== 'Todos').map(category => (
                    <button
                      key={category}
                      type="button"
                      className={`public-home-category-card ${activeCategory === category ? 'active' : ''} ${category === 'promociones' ? 'promo-card' : ''}`}
                      onClick={() => {
                        setActiveCategory(category);
                        setCurrentTab('menu');
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                      }}
                    >
                      <div className="public-home-cat-dish-circle">
                        <img src={CATEGORY_ICONS[category] || CATEGORY_ICONS.Todos} alt={categoryLabel(category)} loading="lazy" decoding="async" />
                      </div>
                      <span className="public-home-cat-name">{DESKTOP_CATEGORY_LABELS[category] || categoryLabel(category)}</span>
                    </button>
                  ))}
                </div>
              </section>

              {/* 3. LO MÁS PEDIDO 🔥 */}
              <section className="public-home-section">
                <div className="public-home-section-header">
                  <div className="public-home-section-title-wrap">
                    <h2 className="public-home-section-title"><Flame size={18} aria-hidden="true" /> DATE UN BANQUETE EN FULL CHINA</h2>
                    <p className="public-home-section-sub">Los favoritos de nuestros clientes.</p>
                  </div>
                </div>

                <div className="public-home-carousel">
                  {canScrollPopular && (
                    <button type="button" className="public-home-carousel-arrow prev" aria-label="Ver plato anterior" onClick={() => scrollPopular(-1)}>
                      <ChevronRight size={18} style={{ transform: 'rotate(180deg)' }} />
                    </button>
                  )}
                  <div className="public-home-products-grid" ref={popularScrollRef}>
                    {popularGroups.map(group => renderDesktopProductCard(group))}
                  </div>
                  {canScrollPopular && (
                    <button type="button" className="public-home-carousel-arrow next" aria-label="Ver siguiente plato" onClick={() => scrollPopular(1)}>
                      <ChevronRight size={18} />
                    </button>
                  )}
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
                    onClick={() => { setCurrentTab('menu'); setActiveCategory('promociones'); window.scrollTo({ top: 0, behavior: 'smooth' }) }}
                  >
                    <span>Ver todas</span>
                    <ChevronRight size={14} />
                  </button>
                </div>

                <div className="public-home-promos-grid">
                  {promoGroups.map(group => renderDesktopPromoCard(group))}
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

                {error && products.length > 0 && <Toast type="error" message={error} onClose={() => setError('')} />}
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
                      <section className="public-category-section" key={section.category} data-category={section.category}>
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

          {/* TAB 3: CONTACTO */}
          {currentTab === 'contacto' && (
            <section className="public-contact-view public-contact-page">
              <section className="public-cinematic-hero public-contact-hero">
                <HeroWokEmbers />
                <div className="public-hero-left public-contact-hero-copy">
                  <span className="public-hero-tag">
                    <Flame size={14} className="fire-icon-pulse" />
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
                <ShoppingBag size={18} />
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
                    src="/optimized/fondos/carrito-vacio.webp"
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

                {/* Sidebar Recommendations (carrusel: una tarjeta a la vez,
                    rota sola — el espacio es angosto para varias en fila) */}
                {recommendations.length > 0 && (() => {
                  const activeReco = recommendations[sidebarRecoIndex] ?? recommendations[0]
                  return (
                    <section className="public-cart-recommendations public-sidebar-recommendations public-sidebar-reco-carousel">
                      <div className="public-cart-recommendations-head">
                        <h3><Flame size={18} color="#FF5A52" className="fire-icon-pulse" /> ¿Algo más?</h3>
                        <button type="button" onClick={() => { setStep('cart'); setCartOpen(true); setShowAllExtras(true) }}>Ver todos <ChevronRight size={13} /></button>
                      </div>
                      <div className="public-sidebar-reco-card" key={activeReco.key}>
                        <img src={optimizedProductImage(activeReco.variants[0]?.product.imageUrl) || productImage(activeReco.category)} alt="" />
                        <div>
                          <strong>{productTitle(activeReco.name)}</strong>
                          <b>{money(activeReco.minPrice)}{priceBs(activeReco.minPrice) && <small className="public-reco-bs">{priceBs(activeReco.minPrice)}</small>}</b>
                        </div>
                        <button type="button" onClick={() => { const product = activeReco.variants[0]?.product; if (product) addProduct(product) }}><Plus size={15} /></button>
                      </div>
                      {recommendations.length > 1 && (
                        <div className="public-sidebar-reco-dots">
                          {recommendations.map((_, i) => (
                            <span
                              key={i}
                              className={i === sidebarRecoIndex ? 'active' : ''}
                              onClick={() => {
                                if (sidebarRecoTimer.current) clearInterval(sidebarRecoTimer.current)
                                setSidebarRecoIndex(i)
                              }}
                            />
                          ))}
                        </div>
                      )}
                    </section>
                  )
                })()}

                {/* Sidebar Financials */}
                <div className="public-sidebar-summary">
                  <div className="public-sidebar-row">
                    <span>Subtotal</span>
                    <strong key={total}>{money(total)}</strong>
                  </div>
                  <div className="public-sidebar-row">
                    <span>Delivery</span>
                    <small>{deliveryFeeText}</small>
                  </div>
                  <div className="public-sidebar-row total">
                    <span>Total</span>
                    <div className="public-sidebar-total-val">
                      <em key={orderTotal}>{money(orderTotal)}</em>
                      {priceBs(orderTotal) && <small className="public-sidebar-total-bs">{priceBs(orderTotal)}</small>}
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
                    <MapPin size={16} />
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

      {/* Floating Cart FAB for Mobile */}
      {itemCount > 0 && !cartOpen && currentTab !== 'contacto' && (
        <div className="public-cart-fab-wrap">
          <span className="public-cart-fab-tooltip">
            Toca aquí para ver tu pedido <ChevronRight size={14} />
          </span>
          <button className="public-cart-fab" onClick={() => { setCartOpen(true); setStep('cart') }}>
            <ShoppingCart size={24} />
            <span className="public-cart-fab-badge">{itemCount}</span>
          </button>
        </div>
      )}

      {/* Add-to-cart mini-toast */}
      {addFeedback && (
        <div className={`public-add-toast ${addFeedbackClosing ? 'closing' : ''}`} role="status" aria-live="polite">
          <span className="public-add-toast-img" aria-hidden="true">
            {addFeedback.imageUrl ? <img src={addFeedback.imageUrl} alt="" /> : <ShoppingBag size={16} />}
          </span>
          <span className="public-add-toast-copy">
            <strong className="public-add-toast-label">Agregado al carrito</strong>
            <span className="public-add-toast-name">{addFeedback.name}</span>
          </span>
          <span className="public-add-toast-check"><CircleCheck size={16} /></span>
        </div>
      )}

      {selectedGroup && selectedProduct && (
        <div className={`public-modal-backdrop ${closingDetail ? 'closing' : ''}`} onClick={closeProductDetail}>
          <section
            className="public-product-detail-modal"
            onClick={event => event.stopPropagation()}
            style={detailOrigin ? { transformOrigin: `${detailOrigin.x}px ${detailOrigin.y}px` } : undefined}
          >
            <div className="ppdm-image">
              <img src={optimizedProductImage(selectedProduct.imageUrl) || productImage(selectedGroup.category)} alt={selectedProduct.name} decoding="async" />
              <button className="ppdm-close" onClick={closeProductDetail} aria-label="Cerrar detalle"><X /></button>
              <div className="ppdm-image-gradient" />
              <div className="ppdm-hero-copy">
                <h1>{productTitle(selectedGroup.name)}</h1>
                <div className="ppdm-price">{money(selectedProduct.price)}{priceBs(selectedProduct.price) && <span className="ppdm-price-bs">{priceBs(selectedProduct.price)}</span>}</div>
              </div>
            </div>
            <div className="ppdm-content">
              <p className="ppdm-desc">{selectedProduct.description || 'Preparado al momento con el sabor de Full China.'}</p>
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
              {loadingModifiers ? (
                <div className="ppdm-section ppdm-extras-section">
                  <div className="ppdm-section-header"><h3 className="public-skeleton-block ppdm-extras-skeleton-title">&nbsp;</h3></div>
                  <div className="ppdm-chip-row">
                    {[0, 1, 2].map(i => (
                      <div className="ppdm-chip ppdm-chip-skeleton public-skeleton-block" key={i} />
                    ))}
                  </div>
                </div>
              ) : detailModifierGroups.length > 0 && (
                <div className="ppdm-section ppdm-extras-section">
                  <div className="ppdm-section-header"><h3>Extras <small>(opcionales)</small></h3></div>
                  <div className="ppdm-chip-row">
                    {detailModifierGroups.flatMap(group => group.options.map(option => {
                      const active = selectedExtras.includes(option.id)
                      return (
                        <button
                          type="button"
                          className={`ppdm-chip ${active ? 'active' : ''}`}
                          key={option.id}
                          onClick={() => setSelectedExtras(current => current.includes(option.id) ? current.filter(id => id !== option.id) : [...current, option.id])}
                        >
                          <span className="ppdm-chip-name">{option.name}</span>
                          {option.price > 0 && <span className="ppdm-chip-price">+{money(option.price)}</span>}
                          <span className="ppdm-chip-check"><Check size={12} /></span>
                        </button>
                      )
                    }))}
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
              <button type="button" className="ppdm-add-btn" onClick={addSelectedProduct}>Agregar · <span className="ppdm-add-btn-total" key={(selectedProduct.price + detailExtrasTotal) * detailQuantity}>{money((selectedProduct.price + detailExtrasTotal) * detailQuantity)}</span></button>
            </footer>
          </section>
        </div>
      )}

      {cartOpen && <div className={`public-drawer-backdrop ${closingCart ? 'closing' : ''}`} onClick={closeCart}><aside className={`public-cart-drawer ${step === 'details' ? 'public-data-drawer' : ''} public-step-${step}`} onClick={event => event.stopPropagation()}>
        <header className="public-review-header"><button className="public-review-back" onClick={() => { const isDesktop = window.matchMedia(DESKTOP_MEDIA_QUERY).matches; if (step === 'details') { if (isDesktop) { if (orderType === 'delivery') { setStep('address'); } else { closeCart(); } } else { setStep(orderType === 'delivery' ? 'address' : 'delivery'); } } else if (step === 'confirm') { setStep('details'); } else if (step === 'address') { if (isDesktop) { closeCart(); } else { setStep('delivery'); } } else if (step === 'delivery') { setStep('cart'); } else if (step === 'preparing' || step === 'sent') { closeCart(); } else { closeCart(); } }} aria-label="Volver"><ChevronRight /></button><img src="/optimized/root/logo.webp" alt="Full China" /><div className="public-review-heading"><h2><ShoppingBag size={20} className="public-review-heading-icon" /> {step === 'delivery' ? '¿Cómo quieres recibirlo?' : step === 'address' ? 'Dirección de entrega' : step === 'details' ? 'Tus datos' : step === 'confirm' ? 'Revisa y confirma tu pedido' : step === 'preparing' ? 'Preparando tu pedido' : step === 'sent' ? 'Pedido enviado' : 'Tu pedido'}</h2><p>{step === 'delivery' ? 'Selecciona la forma de entrega de tu pedido.' : step === 'address' ? '¿Dónde te lo llevamos?' : step === 'details' ? 'Necesitamos esta información para preparar tu pedido.' : step === 'confirm' ? <>Confirma que todo esté correcto antes de enviarlo.<br />Luego lo enviaremos por WhatsApp.</> : step === 'preparing' ? 'Estamos creando tu solicitud segura.' : step === 'sent' ? 'Tu solicitud fue registrada correctamente.' : 'Revisa tu pedido antes de continuar.'}</p></div>{step === 'cart' && cart.length > 0 && <div className="public-estimate-card" aria-label="Entrega estimada"><span className="public-estimate-dot" /><div><small>Entrega estimada</small><strong>35–50 min</strong></div></div>}</header>
        {cartGuardMessage && <div className={`public-cart-guard ${cartGuardClosing ? 'closing' : ''}`} role="alert"><CircleAlert /><div><strong>Tu carrito está vacío</strong><span>{cartGuardMessage}</span></div></div>}
        {step === 'cart' && <div className="public-review-page"><div className="public-cart-items">{cart.length === 0 ? <div className="public-sidebar-empty"><div className="public-empty-box-art"><img src="/optimized/fondos/carrito-vacio.webp" alt="Tu pedido está vacío" className="public-empty-cart-img" /></div><h3 className="public-empty-cart-title">Tu pedido está vacío</h3><p className="public-empty-cart-msg">Parece que aún no has agregado nada a tu pedido.</p><p className="public-empty-cart-sub">¡Explora nuestro menú y encuentra tu próximo favorito!</p><button type="button" className="public-empty-explore-btn" onClick={() => { setCurrentTab('menu'); window.scrollTo({ top: 0, behavior: 'smooth' }); }}><ShoppingBag size={18} /><span>Explorar menú</span></button></div> : cart.map(item => <div className="public-cart-item" key={cartLineKey(item)}><img className="public-cart-item-image" src={optimizedProductImage(item.imageUrl) || '/optimized/login-carousel/slide3.webp'} alt="" /><div className="public-cart-item-main"><strong>{cartProductName(item.productName)}</strong><span>{item.quantity} {item.quantity === 1 ? 'porción' : 'porciones'}</span>{item.notes && <small className="public-cart-item-notes">✦ {item.notes}</small>}<div className="public-review-qty"><button onClick={() => updateQuantity(item.productId, -1, item.notes || '')}>{item.quantity === 1 ? <Trash2 /> : <Minus />}</button><b>{item.quantity}</b><button onClick={() => updateQuantity(item.productId, 1, item.notes || '')}><Plus /></button></div></div><strong className="public-cart-item-total">{money(item.price * item.quantity)}{priceBs(item.price * item.quantity) && <small className="public-cart-item-bs">{priceBs(item.price * item.quantity)}</small>}</strong><button className="public-review-edit" onClick={() => { closeCart(); setTimeout(() => { const group = groups.find(candidate => candidate.variants.some(variant => variant.product.id === item.productId)); if (group) openGroup(group) }, 240) }}>Editar</button></div>)}</div>{cart.length > 0 && recommendations.length > 0 && <section className="public-cart-recommendations"><div className="public-cart-recommendations-head"><h3><Flame size={18} color="#FF5A52" className="fire-icon-pulse" /> ¿Algo más?</h3><button type="button" onClick={() => setShowAllExtras(true)}>Ver todos <ChevronRight size={13} /></button></div><div className="public-recommendation-row">{recommendations.map(group => <article key={group.key}><img src={optimizedProductImage(group.variants[0]?.product.imageUrl) || productImage(group.category)} alt="" /><div><strong>{productTitle(group.name)}</strong><b>{money(group.minPrice)}{priceBs(group.minPrice) && <small className="public-reco-bs">{priceBs(group.minPrice)}</small>}</b></div><button type="button" onClick={() => { const product = group.variants[0]?.product; if (product) addProduct(product) }}><Plus size={15} /></button></article>)}</div></section>}{cart.length > 0 && <div className="public-total public-review-total"><span>Subtotal productos</span><strong>{money(total)}{priceBs(total) && <small className="public-total-bs">{priceBs(total)}</small>}</strong><small>Productos seleccionados</small><b>Total productos <em>{money(total)}{priceBs(total) && <small className="public-total-bs">{priceBs(total)}</small>}</em></b></div>}{cart.length > 0 && <button className="public-primary" onClick={() => requireCart() && setStep('delivery')}>Continuar <ChevronRight /></button>}</div>}
        {step === 'delivery' && <div className="public-delivery-step"><div className={`public-delivery-choice ${orderType === 'takeaway' ? 'selected' : ''}`} onClick={() => { setOrderType('takeaway'); setDeliveryChosen(true) }}><img src="/optimized/fondos/pickup-card.webp" alt="Retirar en Full China" /><div><strong>Retirar en Full China</strong><span>Lo prepararemos para que vengas a buscarlo.</span></div><span className="public-choice-radio" /></div><div className={`public-delivery-choice ${orderType === 'delivery' ? 'selected' : ''}`} onClick={() => { setOrderType('delivery'); setDeliveryChosen(true) }}><img src="/optimized/fondos/delivery-card.webp" alt="Delivery" /><div><strong>Delivery</strong><span>Te lo llevamos hasta donde estés.</span></div><span className="public-choice-radio" /></div><p className="public-delivery-hint">⌖ Podrás indicar la dirección en el siguiente paso.</p><button className="public-primary public-delivery-continue" disabled={!cart.length} onClick={() => { setDeliveryChosen(true); setStep(orderType === 'delivery' ? 'address' : 'details') }}>Continuar <ChevronRight /></button></div>}
        {step === 'address' && <div className="public-address-step"><div className="public-address-search"><Search /><input ref={addressRef} value={address} onChange={event => searchAddress(event.target.value)} placeholder="Buscar dirección, urbanización o ciudad" /></div>{showSuggestions && address.trim().length >= 4 && <div className="public-address-suggestions public-address-step-suggestions">{searchingAddress ? <div className="public-suggestion-status"><span className="public-search-spinner" />Buscando direcciones…</div> : addressSuggestions.length > 0 ? <><div className="public-suggestion-heading">Direcciones encontradas</div>{addressSuggestions.map((s, i) => { const parts = s.display_name.split(','); const primary = parts.shift() || s.display_name; return <button key={i} type="button" className="public-suggestion-item" onMouseDown={() => selectSuggestion(s)}><span className="public-suggestion-icon"><MapPin size={14} /></span><span className="public-suggestion-copy"><strong>{primary}</strong><small>{parts.join(',').trim() || 'Ubicación en el mapa'}</small></span><ChevronRight size={14} className="public-suggestion-arrow" /></button> })}</> : <div className="public-suggestion-status">No encontramos esa dirección.<small>Prueba con ciudad y urbanización.</small></div>}</div>}<Suspense fallback={<div className="public-address-map" aria-label="Cargando mapa" />}><AddressMap coordinates={geoCoords} onPick={selectMapLocation} /></Suspense><div className="public-address-selected"><MapPin /><div><small>Dirección seleccionada</small><strong>{address || 'Toca el mapa o busca una dirección'}</strong><span>{addressMethod === 'gps' ? 'Ubicación GPS confirmada' : addressMethod === 'map' ? 'Punto elegido en el mapa' : addressMethod === 'search' ? 'Dirección encontrada' : 'Pendiente de confirmar'}</span></div><button type="button" onClick={() => addressRef.current?.focus()}>Editar</button></div><button type="button" className="public-location-row" onClick={useMyLocation} disabled={locating}><Navigation /><strong>{locating ? 'Obteniendo ubicación…' : 'Usar mi ubicación actual'}</strong><ChevronRight /></button><label className="public-address-extra"><span>Casa / edificio / referencia</span><input value={addressReference} onChange={event => setAddressReference(event.target.value)} placeholder="Ej. Torre B, Piso 4, Apt. 4B" /></label><label className="public-address-extra"><span>Indicaciones adicionales <small>(opcional)</small></span><textarea value={notes} maxLength={500} onChange={event => setNotes(event.target.value)} placeholder="Ej. Timbre 04B, dejar con el conserje, etc." /></label><div className="public-address-summary"><div><small>Entrega estimada</small><strong>35–50 min</strong></div><span>{geoCoords ? 'Ubicación confirmada' : 'Selecciona una ubicación'}</span></div>{addressError && <p className="public-address-error" role="alert">{addressError}</p>}<button className="public-primary public-address-continue" disabled={!cart.length} onClick={continueFromAddress}>Continuar <ChevronRight /></button></div>}
        {step === 'details' && (
          <div className="public-checkout">
            <div className="public-data-intro">
              <strong>¿A nombre de quién?</strong>
              <span>Solo para coordinar tu pedido.</span>
            </div>
            {error && <Toast type="error" message={error} onClose={() => setError('')} />}
            <div className="public-data-form-card">
              <label className="public-data-field"><span className="public-data-icon"><UserRound /></span><span className="public-data-field-copy"><span>Tu nombre</span><div className="public-data-input"><input autoComplete="name" value={name} onChange={event => setName(event.target.value)} placeholder="Nombre y apellido" /></div></span></label>
              <label className="public-data-field"><span className="public-data-icon"><UserRound /></span><span className="public-data-field-copy"><span>Tu cédula</span><div className="public-data-input"><input inputMode="text" autoComplete="off" value={identification} maxLength={12} onChange={event => setIdentification(event.target.value.toUpperCase().replace(/[^VE0-9-]/g, ''))} placeholder="V-12345678" /></div><small>La usaremos para conservar tu historial de pedidos</small></span></label>
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
          <div className="public-total public-review-total"><span>Subtotal productos</span><strong>{money(total)}{priceBs(total) && <small className="public-total-bs">{priceBs(total)}</small>}</strong><div className="public-delivery-total-label">{orderType === 'delivery' ? 'Delivery' : 'Retiro'}</div><div className={`public-delivery-total-value ${orderType === 'takeaway' ? 'is-pickup' : ''}`}>{orderType === 'delivery' ? deliveryFeeText : 'En el local'}</div><b>Total del pedido <em>{money(orderTotal)}{priceBs(orderTotal) && <small className="public-total-bs">{priceBs(orderTotal)}</small>}</em></b></div>
          <div className="public-confirm-info"><button type="button" onClick={() => setStep(orderType === 'delivery' ? 'address' : 'delivery')}><MapPin /><div><strong>{orderType === 'delivery' ? 'Dirección de entrega' : 'Entrega'}</strong><span>{orderType === 'delivery' ? address : 'Retirar en Full China'}</span><small>{orderType === 'delivery' ? addressReference || 'Sin referencia adicional' : 'Listo para retirar en el local'}</small></div><b>Editar</b></button><button type="button" onClick={() => setStep('details')}><UserRound /><div><strong>Datos de contacto</strong><span>{name}</span><small>{phone}</small></div><b>Editar</b></button></div>{error && <Toast type="error" message={error} onClose={() => setError('')} />}</div>
          <button className="public-primary whatsapp public-whatsapp-cta" disabled={submitting} onClick={submitOrder}><span className="public-whatsapp-mark" aria-hidden="true"><svg viewBox="0 0 32 32" role="img"><circle cx="16" cy="16" r="13" /><path d="M11.5 10.8c.4-.5 1-.5 1.4-.1l1.7 1.8c.4.4.4 1 0 1.4l-1 1c1 2 2.4 3.4 4.4 4.4l1-1c.4-.4 1-.4 1.4 0l1.8 1.7c.4.4.4 1-.1 1.4-.8.8-2 1.1-3.1.7-4.5-1.4-7.7-4.6-9.1-9.1-.4-1.1-.1-2.3.7-3.1Z" /></svg></span><span className="public-whatsapp-copy"><strong>{submitting ? 'Preparando pedido…' : 'Enviar pedido'}</strong><small>Se abrirá WhatsApp para confirmar</small></span><b className="public-whatsapp-total">{money(total)}{priceBs(total) && <small className="public-whatsapp-total-bs">{priceBs(total)}</small>}</b><span className="public-whatsapp-arrow"><ChevronRight /></span></button><p className="public-order-security">⌕ &nbsp; Tu pedido será confirmado directamente por Full China</p>
        </div>}
        {step === 'preparing' && <div className="public-preparing-page"><img className="preparing-logo" src="/optimized/root/logo.webp" alt="Full China" /><div className="public-preparing-visual" aria-hidden="true"><img className="preparing-layer preparing-fire-red" src="/optimized/cargando-pedido/fuego-circulo-rojo.webp" alt="" /><span className="preparing-composition-arrow preparing-composition-arrow-left"><ChevronRight size={20} /></span><img className="preparing-layer preparing-wok-new" src="/optimized/cargando-pedido/wok-nuevo.webp" alt="" /><span className="preparing-composition-arrow preparing-composition-arrow-right"><ChevronRight size={20} /></span><img className="preparing-layer preparing-whatsapp-green" src="/optimized/cargando-pedido/whatsapp-circulo-verde.webp" alt="" /></div><h3>Preparando tu pedido<br />para WhatsApp<span className="preparing-ellipsis">…</span></h3><p>Estamos creando tu solicitud segura.</p><div className="public-preparing-progress" aria-label="Progreso del pedido"><div className="public-progress-rail"><span /></div><div className="public-progress-step progress-step-one"><i><Check size={22} /></i><strong>Solicitud<br />creada</strong></div><div className="public-progress-step progress-step-two"><i><Check size={22} /></i><strong>Armando tu<br />pedido</strong></div><div className="public-progress-step progress-step-three"><i><LoaderCircle size={22} /></i><strong>Abriendo<br />WhatsApp</strong></div></div><div className="public-preparing-security"><ShieldCheck size={20} /><div><strong>Tus datos viajan seguros</strong><span>Solo los usamos para confirmar tu pedido.</span></div></div></div>}
        {step === 'sent' && <div className="public-success"><span><Check /></span><h3>¡Enviado!</h3><strong>{orderCode || 'WEB-PENDIENTE'}</strong><p>Ahora espera la confirmación de Full China por <b>WhatsApp</b>.</p><div className="public-status-timeline"><div className="complete"><i><Check size={18} /></i><div><strong>Solicitud creada</strong><small>Tu pedido fue registrado correctamente.</small></div><time>Ahora</time></div><div className="complete"><i><Check size={18} /></i><div><strong>Enviado por WhatsApp</strong><small>Tu solicitud fue enviada a Full China.</small></div><time>Ahora</time></div><div className="pending"><i>3</i><div><strong>Esperando confirmación</strong><small>Te confirmaremos tu pedido por WhatsApp.</small></div><time>◷</time></div></div><button className="public-primary" onClick={() => window.open(whatsappUrl || `https://wa.me/${String(import.meta.env.VITE_FULLCHINA_WHATSAPP || '').replace(/\D/g, '')}`, '_blank', 'noopener,noreferrer')}>Volver a WhatsApp</button>{lastOrder.length > 0 && <button className="public-repeat-order" onClick={repeatLastOrder}><RotateCcw size={16} /> Repetir este pedido</button>}<button className="public-primary" onClick={startNewOrder}>Hacer otro pedido</button></div>}
        {showAllExtras && step === 'cart' && <div className={`public-cart-all-extras ${closingAllExtras ? 'closing' : ''}`}><div className="public-cart-all-extras-head"><div><span>CATÁLOGO RÁPIDO</span><h3>Agrega algo más</h3></div><button type="button" onClick={() => { const isDesktop = window.matchMedia(DESKTOP_MEDIA_QUERY).matches; closeAllExtras(); if (isDesktop) closeCart() }} aria-label="Cerrar">×</button></div><label className="public-cart-extras-search"><Search size={16} /><input value={extrasSearch} onChange={event => setExtrasSearch(event.target.value)} placeholder="Buscar un plato, bebida o extra" /><button type="button" onClick={() => setExtrasSearch('')} aria-label="Limpiar búsqueda">×</button></label><div className="public-cart-extra-sections">{extrasSections.length === 0 ? <p className="public-cart-extras-empty">No encontramos ese producto. Prueba con otro nombre.</p> : extrasSections.map(([category, categoryGroups]) => <section key={category}><div className="public-cart-extra-section-head"><h4>{categoryLabel(category)}</h4><span>{categoryGroups.length}</span></div><div className="public-cart-all-extras-grid">{categoryGroups.map(group => <article key={group.key}><img src={optimizedProductImage(group.variants[0]?.product.imageUrl) || productImage(group.category)} alt="" /><div><strong>{productTitle(group.name)}</strong><b>{money(group.minPrice)}{priceBs(group.minPrice) && <small className="public-reco-bs">{priceBs(group.minPrice)}</small>}</b></div><button type="button" onClick={() => { const product = group.variants[0]?.product; if (product) addProduct(product) }}><Plus size={15} /></button></article>)}</div></section>)}</div></div>}
      </aside></div>}
    </main>
  )
}
