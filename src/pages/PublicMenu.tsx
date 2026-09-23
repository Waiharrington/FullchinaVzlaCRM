import { lazy, Suspense, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent as ReactKeyboardEvent, type MouseEvent as ReactMouseEvent, type SyntheticEvent } from 'react'
import { createPortal } from 'react-dom'
import { ArrowUpRight, Bike, Check, ChevronRight, CircleAlert, CircleCheck, Clock, CupSoda, Flame, Heart, LoaderCircle, Pencil, Wallet, MapPin, MessageSquareText, Minus, Phone, Plus, Search, Navigation, ShieldCheck, ShoppingBag, ShoppingCart, Star, Store, Trash2, UserRound, Utensils, X, Zap } from 'lucide-react'
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
  { src: '/videos/instagram/reel-1.mp4', poster: '/optimized/instagram/reel-1.webp', href: 'https://www.instagram.com/p/DR7aYwlDsTD/?hl=es' },
  { src: '/videos/instagram/reel-2.mp4', poster: '/optimized/instagram/reel-2.webp', href: 'https://www.instagram.com/p/DPj331MCW87/?hl=es' },
  { src: '/videos/instagram/reel-3.mp4', poster: '/optimized/instagram/reel-3.webp', href: 'https://www.instagram.com/p/DQANX2cCVkj/?hl=es' },
  { src: '/videos/instagram/reel-4.mp4', poster: '/optimized/instagram/reel-4.webp', href: 'https://www.instagram.com/p/DZLUKT5sKeW/?hl=es' },
  { src: '/videos/instagram/reel-5.mp4', poster: '/optimized/instagram/reel-5.webp', href: 'https://www.instagram.com/p/DYnlFGtNg93/?hl=es' },
  { src: '/videos/instagram/reel-6.mp4', poster: '/optimized/instagram/reel-6.webp', href: 'https://www.instagram.com/p/DLA5ITEy_GH/?hl=es' },
] as const

function instagramReelOrder(activeIndex: number) {
  return Array.from({ length: INSTAGRAM_REELS.length }, (_, position) => ({
    reel: INSTAGRAM_REELS[(activeIndex - 2 + position + INSTAGRAM_REELS.length) % INSTAGRAM_REELS.length],
    position,
  }))
}

function startInstagramVideo(video: HTMLVideoElement) {
  if (video.src) return
  const source = video.dataset.src || video.querySelector('source')?.dataset.src
  if (!source) return
  video.src = source
  video.load()
  void video.play().catch(() => undefined)
}

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
const WHATSAPP_SENT_KEY = 'fullchina_public_whatsapp_sent'
const CHECKOUT_ATTEMPT_KEY = 'fullchina_public_checkout_attempt'
const DESKTOP_TAB_KEY = 'fullchina_public_desktop_tab'
const PUBLIC_MODIFIER_CACHE = new Map<string, ProductModifierGroup[]>()
// v2 intentionally drops caches created while the public RPC still returned
// inline Base64 images (those entries could occupy several megabytes).
// v3 descarta catálogos que guardaron las rutas estáticas antiguas M*.jpg.
const CATALOG_CACHE_KEY = 'fullchina_public_catalog_v4'
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

const USD_FORMATTER = new Intl.NumberFormat('es-VE', { style: 'currency', currency: 'USD' })
const BS_FORMATTER = new Intl.NumberFormat('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

function money(value: number) {
  return USD_FORMATTER.format(value)
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

const menuLabelMeta = {
  top_sales: { text: 'Más vendido', icon: Flame, className: 'top-sales' },
  new: { text: 'Nuevo', icon: Zap, className: 'new' },
  recommended: { text: 'Recomendado', icon: Star, className: 'recommended' },
  free_drink: { text: 'Refresco gratis', icon: CupSoda, className: 'free-drink' },
} as const

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
  const showDemoTools = designMode || window.location.hostname === 'localhost'
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
  const [quickVariantGroup, setQuickVariantGroup] = useState<MenuProductGroup | null>(null)
  const [quickVariantId, setQuickVariantId] = useState<string | null>(null)
  const [quickVariantQuantity, setQuickVariantQuantity] = useState(1)
  const [closingQuickVariant, setClosingQuickVariant] = useState(false)
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
  const [step, setStep] = useState<'cart' | 'delivery' | 'address' | 'details' | 'confirm' | 'preparing' | 'whatsapp' | 'sent'>('cart')
  const [returnToConfirmAfterEdit, setReturnToConfirmAfterEdit] = useState(false)
  const [editingCartLineKey, setEditingCartLineKey] = useState<string | null>(null)

  // Regla global de overlays: mientras exista una ventana abierta, el
  // documento que queda detrás no puede desplazarse. El scroll pertenece
  // exclusivamente al modal o drawer activo.
  useEffect(() => {
    const overlayOpen = Boolean(quickVariantGroup || selectedGroup || cartOpen || showAllExtras)
    const root = document.documentElement
    const body = document.body

    if (!overlayOpen) return

    const previousRootOverflow = root.style.overflow
    const previousRootOverscroll = root.style.overscrollBehavior
    const previousBodyOverflow = body.style.overflow
    const previousBodyOverscroll = body.style.overscrollBehavior
    const previousBodyPaddingRight = body.style.paddingRight
    const scrollbarWidth = window.innerWidth - root.clientWidth

    root.style.overflow = 'hidden'
    root.style.overscrollBehavior = 'none'
    body.style.overflow = 'hidden'
    body.style.overscrollBehavior = 'none'
    if (scrollbarWidth > 0) body.style.paddingRight = `${scrollbarWidth}px`

    return () => {
      root.style.overflow = previousRootOverflow
      root.style.overscrollBehavior = previousRootOverscroll
      body.style.overflow = previousBodyOverflow
      body.style.overscrollBehavior = previousBodyOverscroll
      body.style.paddingRight = previousBodyPaddingRight
    }
  }, [cartOpen, quickVariantGroup, selectedGroup, showAllExtras])

  const previousStepRef = useRef(step)
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [identification, setIdentification] = useState('')
  const [idPrefix, setIdPrefix] = useState<'V' | 'E' | 'J'>('V')
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
  const [addressFieldError, setAddressFieldError] = useState<'' | 'address' | 'geo' | 'reference'>('')
  const addressRef = useRef<HTMLInputElement>(null)
  const referenceRef = useRef<HTMLInputElement>(null)
  const addressSelectedRef = useRef<HTMLDivElement>(null)
  const addressSearchTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [notes, setNotes] = useState('')
  const [bcvRate, setBcvRate] = useState<number | null>(null)
  const [deliverySettings, setDeliverySettings] = useState<DeliverySettings | null>(null)
  const [deliveryEstimate, setDeliveryEstimate] = useState<DeliveryEstimate | null>(null)
  const [loading, setLoading] = useState(() => !initialCatalog)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  // Al aparecer un error de validación, subir la tarjeta al tope para que se vea
  // Las imágenes de checkout se cargan cuando el cliente llega a ese paso;
  // precargarlas aquí competía con el catálogo en conexiones móviles lentas.
  useEffect(() => {
    if (!error) return
    document.querySelector('.public-cart-drawer')?.scrollTo({ top: 0, behavior: 'smooth' })
  }, [error])
  const [fieldError, setFieldError] = useState<'' | 'name' | 'phone' | 'identification'>('')
  const nameRef = useRef<HTMLInputElement>(null)
  const phoneRef = useRef<HTMLInputElement>(null)
  const identificationRef = useRef<HTMLInputElement>(null)
  // Al fallar la validación de un campo puntual, llevar al cliente directo a
  // ese campo (en vez de un aviso genérico perdido en la pantalla).
  useEffect(() => {
    if (!fieldError) return
    const ref = fieldError === 'name' ? nameRef : fieldError === 'phone' ? phoneRef : identificationRef
    ref.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    ref.current?.focus()
  }, [fieldError])
  useEffect(() => {
    if (!addressFieldError) return
    const ref = addressFieldError === 'reference' ? referenceRef : addressFieldError === 'address' ? addressRef : addressSelectedRef
    ref.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    if (addressFieldError === 'address') addressRef.current?.focus()
    if (addressFieldError === 'reference') referenceRef.current?.focus()
  }, [addressFieldError])
  const [cartGuardMessage, setCartGuardMessage] = useState('')
  const [cartGuardClosing, setCartGuardClosing] = useState(false)
  const restoringFlow = useRef(true)
  const [orderCode, setOrderCode] = useState('')
  const [draftOrderCode, setDraftOrderCode] = useState('')
  const [whatsappUrl, setWhatsappUrl] = useState('')
  const [addFeedback, setAddFeedback] = useState<{ name: string; imageUrl?: string } | null>(null)
  const [addFeedbackClosing, setAddFeedbackClosing] = useState(false)
  const [cartPulse, setCartPulse] = useState(false)
  const sidebarCardRef = useRef<HTMLDivElement>(null)
  const [sidebarHasOverflow, setSidebarHasOverflow] = useState(false)
  const [recommendedIndex, setRecommendedIndex] = useState(0)
  const [recommendedPaused, setRecommendedPaused] = useState(false)
  const recommendedTimer = useRef<ReturnType<typeof setInterval> | null>(null)
  const recommendedResumeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const recommendedSwipeStart = useRef<number | null>(null)
  const recommendedWasSwiped = useRef(false)
  const [sidebarRecoIndex, setSidebarRecoIndex] = useState(0)
  const [instagramActiveIndex, setInstagramActiveIndex] = useState(0)
  const instagramReels = useMemo(() => instagramReelOrder(instagramActiveIndex), [instagramActiveIndex])
  const sidebarRecoTimer = useRef<ReturnType<typeof setInterval> | null>(null)
  const addFeedbackTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const addFeedbackExitTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const cartPulseTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const modifierRequestRef = useRef(0)
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
  const [, setLastOrder] = useState<WebOrderCartItem[]>(() => {
    try { return JSON.parse(localStorage.getItem(LAST_ORDER_KEY) || '[]') as WebOrderCartItem[] } catch { return [] }
  })
  const [currentTab, setCurrentTab] = useState<DesktopTab>(readDesktopTab)

  // Cuando Editar se pulsa desde el resumen, el flujo vuelve al carrito para
  // modificar el producto. Al continuar (o cerrar ese carrito) debe regresar
  // al resumen que originó la edición, no reiniciar checkout desde entrega.
  useEffect(() => {
    const previousStep = previousStepRef.current
    if (cart.length === 0 && step === 'confirm') {
      setReturnToConfirmAfterEdit(false)
      setStep('cart')
    } else if (cart.length > 0 && step === 'cart' && previousStep === 'confirm') {
      setReturnToConfirmAfterEdit(true)
    } else if (cart.length > 0 && returnToConfirmAfterEdit && step === 'delivery') {
      setReturnToConfirmAfterEdit(false)
      setStep('confirm')
    }
    previousStepRef.current = step
  }, [cart, cartOpen, returnToConfirmAfterEdit, step])

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

  const prepareImagesIn = (root: ParentNode) => {
    const images: HTMLImageElement[] = []
    if (root instanceof HTMLImageElement) images.push(root)
    root.querySelectorAll('img').forEach(image => images.push(image))
    images.forEach(image => {
      const source = image.currentSrc || image.src
      if (image.dataset.revealedSrc !== source) image.classList.remove('public-image-ready', 'public-image-error')
      prepareImage(image)
    })
  }
  const prepareImagesInRef = useRef(prepareImagesIn)
  prepareImagesInRef.current = prepareImagesIn

  // Las imágenes se preparan al montarse y cuando React añade o cambia un
  // nodo. Antes este escaneo recorría todos los <img> después de cada render,
  // incluso al escribir en un formulario o cambiar una cantidad del carrito.
  useLayoutEffect(() => {
    const root = pageRef.current
    if (!root) return
    prepareImagesInRef.current(root)
    const observer = new MutationObserver(records => {
      records.forEach(record => {
        if (record.type === 'attributes' && record.target instanceof HTMLImageElement) {
          prepareImagesInRef.current(record.target)
          return
        }
        record.addedNodes.forEach(node => {
          if (node instanceof HTMLElement) prepareImagesInRef.current(node)
        })
      })
    })
    observer.observe(root, { childList: true, subtree: true, attributes: true, attributeFilter: ['src'] })
    return () => observer.disconnect()
  }, [])

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
    let active = true
    let secondaryTimer: number | null = null

    // Solo el catálogo es crítico para pintar el menú. Las categorías, la tasa
    // y delivery llegan después para que una respuesta lenta no mantenga al
    // cliente mirando la pantalla de carga.
    const catalogPromise = getPublicCatalog()
      .then(catalog => {
        const resolved = prepareCatalog(catalog)
        if (!active) return resolved
        saveCatalogCache(resolved, initialCatalog?.categories ?? [])
        setExtrasProducts(resolved.filter(p => p.categories.includes('extras')))
        setProducts(resolved.filter(p => !p.categories.includes('extras')))
        setLoading(false)
        window.__removeFCSplash?.()
        return resolved
      })
      .catch(() => {
        if (active) {
          if (!initialCatalog) setError('No pudimos cargar el menú. Intenta nuevamente.')
          setLoading(false)
          window.__removeFCSplash?.()
        }
        return null
      })

    void catalogPromise.then(resolved => {
      if (!resolved || !active) return

      void getPublicMenuCategories()
        .then(cats => {
          if (!active || !cats.length) return
          hydrateMenuCategories(cats)
          saveCatalogCache(resolved, cats)
          // hydrateMenuCategories actualiza un mapa compartido; clonar la
          // lista fuerza el render que refresca etiquetas y búsquedas.
          setProducts(current => [...current])
        })
        .catch(() => { /* el catálogo ya puede funcionar con categorías locales */ })

      // La tasa y la configuración de delivery son secundarias. Se difieren
      // un poco más para dejar libre la conexión durante el primer render.
      secondaryTimer = window.setTimeout(() => {
        if (!active) return
        getExchangeRates().then(rates => setBcvRate(rates.bcv || null)).catch(() => setBcvRate(null))
      }, 500)
    })

    return () => {
      active = false
      if (secondaryTimer !== null) window.clearTimeout(secondaryTimer)
    }
  }, [designMode, initialCatalog])

  useEffect(() => {
    if (!loading) {
      window.__removeFCSplash?.()
    }
  }, [loading])

  // Delivery solo se necesita cuando el cliente escoge esa modalidad. No
  // descargues zonas y coordenadas en cada visita al menú: en conexiones
  // móviles esa RPC competía con el catálogo aunque el cliente fuera a
  // retirar el pedido en el local.
  useEffect(() => {
    if (designMode || orderType !== 'delivery' || deliverySettings) return
    let active = true
    getPublicDeliverySettings()
      .then(settings => { if (active) setDeliverySettings(settings) })
      .catch(() => { if (active) setDeliverySettings(null) })
    return () => { active = false }
  }, [designMode, orderType, deliverySettings])

  const categories = useMemo(() => {
    const extracted = Array.from(new Set(products.flatMap(p => p.categories)));
    const allCats = Array.from(new Set([...MENU_CATEGORY_ORDER, ...extracted]));
    allCats.sort((a, b) => menuCategoryRank(a) - menuCategoryRank(b));
    return ['Todos', ...allCats.filter(c => c !== 'otros' && c !== 'extras')];
  }, [products]);
  const groups = useMemo(() => groupMenuProducts(products.filter(product => {
    const categoryMatch = activeCategory === 'Todos' || product.categories.includes(activeCategory)
    const term = normalizeForSearch(search)
    const searchableText = [
      product.name,
      product.description || '',
      product.category,
      ...product.categories.flatMap(category => [category, categoryLabel(category)]),
    ].join(' ')
    return categoryMatch && (!term || normalizeForSearch(searchableText).includes(term))
  })), [products, activeCategory, search])
  const homeSearchTerm = normalizeForSearch(search.trim())
  const homeSearchSuggestions = useMemo(() => {
    if (homeSearchTerm.length < 2) return []
    return groupMenuProducts(products)
      .filter(group => normalizeForSearch([
        group.name,
        categoryLabel(group.category),
        ...group.variants.flatMap(variant => [variant.label, variant.product.name, variant.product.description || '']),
      ].join(' ')).includes(homeSearchTerm))
      .slice(0, 5)
  }, [products, homeSearchTerm])
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
    requestQuickAdd(group, qty)
  }
  const stopProductCardInteraction = (event: SyntheticEvent) => {
    // Algunos navegadores entregan el click del control después del pointer
    // al contenedor. Cancelar ambos niveles evita que la tarjeta abra detalle.
    event.preventDefault()
    event.stopPropagation()
    event.nativeEvent.stopImmediatePropagation()
  }
  const openProductFromCard = (group: MenuProductGroup, event: ReactMouseEvent<HTMLElement>) => {
    if (event.defaultPrevented || (event.target as HTMLElement).closest('button, a, input, select, textarea')) return
    openGroup(group, event)
  }
  const openProductFromCardKeyboard = (group: MenuProductGroup, event: ReactKeyboardEvent<HTMLElement>) => {
    if (event.target !== event.currentTarget || (event.key !== 'Enter' && event.key !== ' ')) return
    event.preventDefault()
    openGroup(group)
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

  // Las previews se muestran de inmediato. Solo se activa el video que ocupa
  // el centro; las demás tarjetas permanecen pausadas hasta su turno.
  useEffect(() => {
    if (currentTab !== 'contacto') return
    const timer = window.setTimeout(() => {
      const videos = Array.from(document.querySelectorAll<HTMLVideoElement>('.public-instagram-reel video'))
      videos.forEach(video => {
        if (video.dataset.active === 'true' && video.offsetParent !== null) startInstagramVideo(video)
        else { video.pause(); video.currentTime = 0 }
      })
    }, 1200)
    return () => window.clearTimeout(timer)
  }, [currentTab, instagramActiveIndex])

  const displayAccentCategory = activeCategory !== 'Todos' ? activeCategory : scrollCategory
  const orderedCategories = useMemo(() => categories.filter(category => category !== 'Todos'), [categories])
  const accentIndex = displayAccentCategory ? orderedCategories.indexOf(displayAccentCategory) : -1
  const accentRgb = accentIndex === -1 ? CATEGORY_ACCENT_CYCLE[0] : CATEGORY_ACCENT_CYCLE[accentIndex % CATEGORY_ACCENT_CYCLE.length]

  const recommendedPool = useMemo(() => {
    const source = activeCategory === 'Todos'
      ? groups
      : groups.filter(group => group.variants.some(v => v.product.categories.includes(activeCategory)))
    // El pool debe ser estable durante el montaje. Un shuffle con Math.random
    // aquí cambia de recomendación cada vez que llegan los productos, y en
    // desarrollo StrictMode puede hacer que se vean varias tarjetas entrando
    // fugazmente al recargar la página.
    return [...(source.length > 0 ? source : groups)]
      .sort((a, b) => a.key.localeCompare(b.key))
      .slice(0, 8)
  }, [groups, activeCategory])

  useEffect(() => {
    setRecommendedIndex(0)
  }, [activeCategory])

  useEffect(() => {
    if (recommendedPool.length <= 1 || recommendedPaused) return
    recommendedTimer.current = setInterval(() => {
      setRecommendedIndex(prev => (prev + 1) % recommendedPool.length)
    }, 4500)
    return () => { if (recommendedTimer.current) clearInterval(recommendedTimer.current) }
  }, [recommendedPool.length, recommendedPaused])

  const clearRecommendedResumeTimer = () => {
    if (recommendedResumeTimer.current) {
      clearTimeout(recommendedResumeTimer.current)
      recommendedResumeTimer.current = null
    }
  }

  const resumeRecommendedAutoplay = () => {
    clearRecommendedResumeTimer()
    recommendedResumeTimer.current = setTimeout(() => {
      setRecommendedPaused(false)
      recommendedResumeTimer.current = null
    }, 5200)
  }

  const pauseRecommendedAutoplay = () => {
    clearRecommendedResumeTimer()
    setRecommendedPaused(true)
  }

  const moveRecommended = (direction: 1 | -1) => {
    if (recommendedPool.length <= 1) return
    setRecommendedIndex(prev => (prev + direction + recommendedPool.length) % recommendedPool.length)
    pauseRecommendedAutoplay()
    resumeRecommendedAutoplay()
  }

  useEffect(() => () => clearRecommendedResumeTimer(), [])

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
    const card = sidebarCardRef.current
    if (!card) return
    const checkOverflow = () => {
      // Ignoramos diferencias mínimas producidas por redondeos del viewport;
      // un scroll debe aparecer solo cuando realmente haya contenido oculto.
      setSidebarHasOverflow(card.scrollHeight - card.clientHeight > 8)
    }
    checkOverflow()
    const observer = new ResizeObserver(checkOverflow)
    observer.observe(card)
    return () => observer.disconnect()
  }, [cart, recommendations, orderType, address, total, currentTab])

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
        // El modo diseño siempre empieza desde el carrito para poder recorrer
        // el checkout y probar el botón de datos demo.
        setReturnToConfirmAfterEdit(false)
        setStep('cart')
        restoringFlow.current = false
        return
      }
      const saved = JSON.parse(localStorage.getItem(FLOW_STATE_KEY) || 'null') as Partial<{ cartOpen: boolean; step: string; name: string; phone: string; identification: string; email: string; orderType: 'takeaway' | 'delivery'; deliveryChosen: boolean; address: string; addressReference: string; notes: string; geoCoords: MapCoordinates; addressMethod: 'gps' | 'map' | 'search' }> | null
      const sent = JSON.parse(localStorage.getItem(WHATSAPP_SENT_KEY) || 'null') as { code?: string; sentAt?: number } | null
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
        if (sent?.sentAt) {
          setOrderCode(sent.code || '')
          setWhatsappUrl('')
          setCartOpen(true)
          setStep('sent')
        } else {
          // Persistimos los datos para no perder el pedido en progreso, pero no
          // reabrimos el drawer después de una recarga. El usuario debe decidir
          // cuándo volver a entrar al checkout.
          setCartOpen(false)
          setStep('cart')
        }
      }
    } catch { /* ignore malformed local flow state */ }
    restoringFlow.current = false
  }, [cart.length, designMode])
  useEffect(() => {
    // Volver desde WhatsApp puede recuperar esta página desde el bfcache sin
    // montar de nuevo React. Sincronizamos el estado también en pageshow para
    // que el resultado sea el mismo con recarga o con el botón Atrás.
    const restoreSentState = () => {
      try {
        const sent = JSON.parse(localStorage.getItem(WHATSAPP_SENT_KEY) || 'null') as { code?: string; sentAt?: number } | null
        if (!sent?.sentAt || cart.length === 0) return
        setOrderCode(sent.code || '')
        setWhatsappUrl('')
        setCartOpen(true)
        setStep('sent')
      } catch { /* ignore malformed sent state */ }
    }
    window.addEventListener('pageshow', restoreSentState)
    return () => window.removeEventListener('pageshow', restoreSentState)
  }, [cart.length])
  useEffect(() => { localStorage.setItem(CART_KEY, JSON.stringify(cart)) }, [cart])
  useEffect(() => { localStorage.setItem(FAVORITES_KEY, JSON.stringify(favoriteIds)) }, [favoriteIds])
  useEffect(() => {
    // Cambiar al menú siempre debe cerrar el drawer del carrito; de lo
    // contrario el menú queda debajo del overlay y parece que el botón no
    // respondió.
    if (currentTab === 'menu' && cartOpen && cart.length === 0) {
      setCartOpen(false)
      setClosingCart(false)
    }
  }, [currentTab, cartOpen, cart.length])
  useEffect(() => {
    if (restoringFlow.current) return
    localStorage.setItem(FLOW_STATE_KEY, JSON.stringify({ cartOpen, step, name, phone, identification, email, orderType, deliveryChosen, address, addressReference, notes, geoCoords, addressMethod }))
  }, [cartOpen, step, name, phone, identification, email, orderType, deliveryChosen, address, addressReference, notes, geoCoords, addressMethod])

  const toggleFavorite = (groupKey: string) => setFavoriteIds(current => current.includes(groupKey) ? current.filter(id => id !== groupKey) : [...current, groupKey])
  const fillDemoData = () => {
    setName('Cliente Demo')
    setIdPrefix('V')
    setIdentification('V-12345678')
    setPhone('04120000000')
    setFieldError('')
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
      localStorage.removeItem(WHATSAPP_SENT_KEY)
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
  const showDesktopMenu = (category = 'Todos', preserveSearch = false) => {
    if (!preserveSearch) setSearch('')
    setActiveCategory(category)
    setShowFavorites(false)
    if (cartOpen) closeCart()
    setCurrentTab('menu')
    window.scrollTo({ top: 0, behavior: 'smooth' })
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

  const closeQuickVariant = () => {
    if (!quickVariantGroup || closingQuickVariant) return
    setClosingQuickVariant(true)
    window.setTimeout(() => {
      setQuickVariantGroup(null)
      setQuickVariantId(null)
      setQuickVariantQuantity(1)
      setClosingQuickVariant(false)
    }, 200)
  }

  const requestQuickAdd = (group: MenuProductGroup, quantity = 1) => {
    if (group.variants.length <= 1) {
      const product = group.variants[0]?.product
      if (product) {
        addProduct(product, quantity)
        setCardQtys(prev => ({ ...prev, [group.key]: 1 }))
      }
      return
    }

    setQuickVariantGroup(group)
    setQuickVariantId(null)
    setQuickVariantQuantity(Math.max(1, quantity))
    setClosingQuickVariant(false)
  }

  const confirmQuickVariant = () => {
    const variant = quickVariantGroup?.variants.find(({ product }) => product.id === quickVariantId)
    if (!variant || !quickVariantGroup) return
    addProduct(variant.product, quickVariantQuantity)
    setCardQtys(prev => ({ ...prev, [quickVariantGroup.key]: 1 }))
    closeQuickVariant()
  }

  const personalizeQuickVariant = () => {
    const group = quickVariantGroup
    const variant = group?.variants.find(({ product }) => product.id === quickVariantId)
    if (!group || !variant || closingQuickVariant) return
    setClosingQuickVariant(true)
    window.setTimeout(() => {
      setQuickVariantGroup(null)
      setQuickVariantId(null)
      setQuickVariantQuantity(1)
      setClosingQuickVariant(false)
      openGroup(group, undefined, variant.product.id)
    }, 200)
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
    modifierRequestRef.current += 1
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

  const openGroup = (group: MenuProductGroup, originEvent?: { clientX: number; clientY: number }, initialVariantId?: string) => {
    const requestId = modifierRequestRef.current + 1
    modifierRequestRef.current = requestId
    const initialVariant = group.variants.find(({ product }) => product.id === initialVariantId) ?? group.variants[0]
    setDetailOrigin(originEvent ? { x: originEvent.clientX, y: originEvent.clientY } : null)
    setClosingDetail(false)
    setSelectedGroup(group)
    setSelectedVariantId(initialVariant?.product.id ?? null)
    setDetailQuantity(1)
    setDetailNotes('')
    setSelectedExtras([])
    const productId = initialVariant?.product.id
    const isExtrasEligible = !group.variants.some(v =>
      v.product.categories.includes('bebidas') || v.product.categories.includes('extras')
    )
    const prepareModifierGroups = (remoteGroups: ProductModifierGroup[]) => {
      const resolved = remoteGroups
        .filter(item => item.options.length > 0)
        .map(item => ({ ...item, options: [...item.options] }))
      if (isExtrasEligible && extrasProducts.length > 0) {
        resolved.push({
          modifierId: '__catalog_extras__',
          name: 'Extras',
          minSelections: 0,
          maxSelections: null,
          allowRepeat: false,
          options: extrasProducts.map(product => ({
            id: product.id,
            name: product.name.replace(/^[^—]+—\s*/, ''),
            price: product.price,
          })),
        })
      }
      return resolved
    }

    if (!productId) {
      setDetailModifierGroups(prepareModifierGroups([]))
      setLoadingModifiers(false)
      return
    }

    const cachedGroups = PUBLIC_MODIFIER_CACHE.get(productId)
    if (cachedGroups) {
      setDetailModifierGroups(prepareModifierGroups(cachedGroups))
      setLoadingModifiers(false)
      return
    }

    // Los extras del catálogo ya están disponibles: se muestran de inmediato
    // mientras cualquier modificador específico del producto carga en segundo plano.
    setDetailModifierGroups(prepareModifierGroups([]))
    setLoadingModifiers(true)
    getPublicProductModifiers(productId)
      .then(remoteGroups => {
        PUBLIC_MODIFIER_CACHE.set(productId, remoteGroups)
        if (modifierRequestRef.current !== requestId) return
        setDetailModifierGroups(prepareModifierGroups(remoteGroups))
      })
      .catch(() => {
        if (modifierRequestRef.current === requestId) setDetailModifierGroups(prepareModifierGroups([]))
      })
      .finally(() => {
        if (modifierRequestRef.current === requestId) setLoadingModifiers(false)
      })
  }

  const selectedProduct = selectedGroup?.variants.find(({ product }) => product.id === selectedVariantId)?.product
    ?? selectedGroup?.variants[0]?.product
  const quickSelectedVariant = quickVariantGroup?.variants.find(({ product }) => product.id === quickVariantId)
  const detailExtrasTotal = detailModifierGroups
    .flatMap(g => g.options.filter(o => selectedExtras.includes(o.id)))
    .reduce((sum, o) => sum + o.price, 0)

  const addSelectedProduct = () => {
    if (selectedProduct) {
      const chosen = detailModifierGroups.flatMap(group => group.options.filter(option => selectedExtras.includes(option.id)))
      const extrasPrice = chosen.reduce((sum, option) => sum + option.price, 0)
      const extras = chosen.map(option => option.price > 0 ? `${option.name} (+${money(option.price)})` : option.name)
      const lineNotes = [extras.length ? `Extras: ${extras.join(', ')}` : '', detailNotes.trim()].filter(Boolean).join(' · ')
      if (editingCartLineKey) {
        const imageUrl = optimizedProductImage(selectedProduct.imageUrl) || undefined
        const editedLine = { productId: selectedProduct.id, productName: formatProductTitle(selectedProduct.name), price: selectedProduct.price + extrasPrice, quantity: detailQuantity, imageUrl, notes: lineNotes || undefined }
        setCart(current => [...current.filter(item => cartLineKey(item) !== editingCartLineKey), editedLine])
        setEditingCartLineKey(null)
        closeProductDetail()
        setReturnToConfirmAfterEdit(true)
        setCartOpen(true)
        setStep('confirm')
      } else {
        addProduct(selectedProduct, detailQuantity, lineNotes, extrasPrice)
      }
    }
  }

  const editCartItem = (item: WebOrderCartItem) => {
    const group = groups.find(candidate => candidate.variants.some(variant => variant.product.id === item.productId))
    if (!group) return
    setEditingCartLineKey(cartLineKey(item))
    setReturnToConfirmAfterEdit(true)
    setCartOpen(true)
    setStep('cart')
    openGroup(group, undefined, item.productId)
    setDetailQuantity(item.quantity)
    setDetailNotes(item.notes || '')
  }

  const useMyLocation = () => {
    if (!navigator.geolocation) return setError('Tu navegador no soporta geolocalización.')
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude: lat, longitude: lng } = pos.coords
        setGeoCoords({ lat, lng })
        setAddressMethod('gps')
        setAddressFieldError('')
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
    setAddressFieldError(value => value === 'reference' ? value : '')
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
    setAddressFieldError(value => value === 'reference' ? value : '')
    setShowSuggestions(false)
    setAddressSuggestions([])
  }

  const selectMapLocation = async (coordinates: MapCoordinates) => {
    setGeoCoords(coordinates)
    setAddressMethod('map')
    setAddressFieldError(value => value === 'reference' ? value : '')
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
    if (address.trim().length < 8) return setAddressFieldError('address')
    if (!geoCoords) return setAddressFieldError('geo')
    if (orderType === 'delivery' && !addressReference.trim()) return setAddressFieldError('reference')
    setAddressFieldError('')
    setStep('details')
  }

  const continueToConfirmation = () => {
    setError('')
    setFieldError('')
    if (name.trim().length < 2) return setFieldError('name')
    if (!/^(?:[VEJ]-?)?\d{6,8}$/i.test(identification.trim())) return setFieldError('identification')
    if (phone.replace(/\D/g, '').length !== 11) return setFieldError('phone')
    if (orderType === 'delivery' && (address.trim().length < 8 || !geoCoords || !addressReference.trim())) {
      setStep('address')
      if (address.trim().length < 8) return setAddressFieldError('address')
      if (!geoCoords) return setAddressFieldError('geo')
      return setAddressFieldError('reference')
    }
    if (!cart.length) return setError('Tu carrito está vacío.')
    if (!draftOrderCode) setDraftOrderCode(`WEB-${crypto.randomUUID().slice(0, 6).toUpperCase()}`)
    setStep('confirm')
  }

  const openWhatsApp = () => {
    if (!whatsappUrl) return
    try {
      localStorage.setItem(WHATSAPP_SENT_KEY, JSON.stringify({
        code: orderCode || draftOrderCode || '',
        sentAt: Date.now(),
      }))
      localStorage.setItem(FLOW_STATE_KEY, JSON.stringify({ cartOpen: true, step: 'sent', name, phone, identification, email, orderType, deliveryChosen, address, addressReference, notes, geoCoords, addressMethod }))
    } catch { /* storage unavailable */ }
    // Navegar en la pestaña actual evita duplicar WhatsApp en una pestaña
    // nueva y conserva una sola salida clara del checkout.
    window.location.assign(whatsappUrl)
  }

  const returnToOrderReview = () => {
    if (submitting) return
    setWhatsappUrl('')
    setStep('confirm')
  }

  const returnToMenuAfterSent = () => {
    startNewOrder()
    setCurrentTab('menu')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const submitOrder = async () => {
    if (submitLockRef.current || submitting) return
    if (designMode) {
      setError('')
      setOrderCode('WEB-DEMO')
      setSubmitting(false)
      setWhatsappUrl('https://wa.me/?text=Pedido%20de%20demostraci%C3%B3n%20Full%20China')
      setStep('whatsapp')
      return
    }
    setError('')
    setFieldError('')
    if (name.trim().length < 2) { setStep('details'); return setFieldError('name') }
    if (!/^(?:[VEJ]-?)?\d{6,8}$/i.test(identification.trim())) { setStep('details'); return setFieldError('identification') }
    if (phone.replace(/\D/g, '').length !== 11) { setStep('details'); return setFieldError('phone') }
    if (orderType === 'delivery' && address.trim().length < 8) { setStep('address'); return setAddressFieldError('address') }
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
    // Mantener la pantalla final visible durante la petición evita mostrar la
    // antigua pantalla intermedia antes de que esté listo el mensaje.
    setStep('whatsapp')
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
        'Envía este mensaje para que podamos confirmar tu pedido.',
      ].join('\n')
      const configuredPhone = String(import.meta.env.VITE_FULLCHINA_WHATSAPP || '').replace(/\D/g, '')
      if (configuredPhone.length < 7) throw new Error('WhatsApp no está configurado todavía. Completa VITE_FULLCHINA_WHATSAPP para continuar.')
      const whatsappFallback = `https://wa.me/${configuredPhone}?text=${encodeURIComponent(message)}`
      setWhatsappUrl(whatsappFallback)
      setStep('whatsapp')
    } catch (cause) {
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
    bcvRate ? `Bs. ${BS_FORMATTER.format(usd * bcvRate)}` : null

  const configuredPhone = String(import.meta.env.VITE_FULLCHINA_WHATSAPP || '').replace(/\D/g, '')


  const renderProductCard = (group: MenuProductGroup, priority = false) => {
    const isBeverage = group.variants.some(({ product }) => product.categories.includes('bebidas'))
    const isTallBottle = /^(agua|refresco\s+2\s+litros)$/i.test(group.name.trim())
    const isLiptonBottle = /^lipton\b/i.test(group.name.trim())
    const hasOptions = group.variants.length > 1
    return (
      <article className="public-prod-card" key={group.key}>
        {group.variants.find(v => v.product.menuLabel)?.product.menuLabel === 'free_drink' && (
          <img src="/icons/free-drink-badge.png" alt="Refresco gratis" className="public-free-drink-sticker" />
        )}
        <div className="public-prod-img-wrap" onClick={event => openProductFromCard(group, event)} tabIndex={0} onKeyDown={event => openProductFromCardKeyboard(group, event)}>
          {(() => {
            const label = menuLabelMeta[group.variants.find(v => v.product.menuLabel)?.product.menuLabel as keyof typeof menuLabelMeta]
            if (!label || label.className === 'free-drink') return null
            const LabelIcon = label.icon
            return <span className={`public-menu-label ${label.className}`}><LabelIcon size={12} strokeWidth={2.4} aria-hidden="true" /> {label.text}</span>
          })()}
          <img src={optimizedProductImage(group.variants[0]?.product.imageUrl) || productImage(group.category)} className={`public-prod-img ${isBeverage ? 'public-prod-img--beverage' : ''} ${isTallBottle ? 'public-prod-img--tall-bottle' : ''} ${isLiptonBottle ? 'public-prod-img--lipton' : ''}`} alt={group.name} loading={priority ? 'eager' : 'lazy'} fetchPriority={priority ? 'high' : 'auto'} decoding="async" />
          <button type="button" className={`public-favorite-btn ${favoriteIds.includes(group.key) ? 'active' : ''}`} onPointerDown={stopProductCardInteraction} onClick={event => { event.stopPropagation(); toggleFavorite(group.key) }} aria-label={favoriteIds.includes(group.key) ? `Quitar ${group.name} de favoritos` : `Guardar ${group.name} en favoritos`}><Heart size={16} fill={favoriteIds.includes(group.key) ? 'currentColor' : 'none'} /></button>
        </div>
        <button type="button" className="public-prod-add" aria-label={hasOptions ? `Ver opciones de ${group.name}` : `Agregar ${group.name} al carrito`} onPointerDown={stopProductCardInteraction} onClick={(e) => { e.stopPropagation(); requestQuickAdd(group) }}>
          {hasOptions
            ? <ChevronRight size={18} strokeWidth={2.4} aria-hidden="true" />
            : <ShoppingCart size={18} strokeWidth={2.4} aria-hidden="true" />}
          <span className="public-prod-add-label-full">{hasOptions ? 'Ver opciones' : 'Agregar al carrito'}</span>
          <span className="public-prod-add-label-short">{hasOptions ? 'Opciones' : 'Agregar'}</span>
        </button>
        <div className="public-prod-info" onClick={event => openProductFromCard(group, event)} tabIndex={0} onKeyDown={event => openProductFromCardKeyboard(group, event)}>
          <h3 className="public-prod-title">{productTitle(group.name)}</h3>
          <p className="public-prod-desc">{groupDescription(group)}</p>
          <div className="public-prod-footer-row">
            <div className="public-prod-price-wrap">
              <span className="public-prod-price">{group.isGrouped && group.minPrice !== group.maxPrice ? 'Desde ' : ''}{money(group.minPrice)}</span>
              {priceBs(group.minPrice) && <span className="public-prod-price-bs">{priceBs(group.minPrice)}</span>}
            </div>
          </div>
        </div>
      </article>
    )
  }

  const renderDesktopProductCard = (group: MenuProductGroup) => {
    const qty = getCardQty(group.key)

    return (
      <article className="public-home-product-card" key={group.key} onClick={event => openProductFromCard(group, event)} tabIndex={0} onKeyDown={event => openProductFromCardKeyboard(group, event)}>
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
            onPointerDown={stopProductCardInteraction}
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
              <button type="button" onPointerDown={stopProductCardInteraction} onClick={() => changeCardQty(group.key, -1)} aria-label="Disminuir">
                <Minus size={13} />
              </button>
              <span>{qty}</span>
              <button type="button" onPointerDown={stopProductCardInteraction} onClick={() => changeCardQty(group.key, 1)} aria-label="Aumentar">
                <Plus size={13} />
              </button>
            </div>
            <button 
              type="button" 
              className="public-home-add-btn"
              onPointerDown={stopProductCardInteraction}
              onClick={(event) => { event.stopPropagation(); handleCardAdd(group) }}
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
      <article className="public-home-promo-card" key={group.key} onClick={event => openProductFromCard(group, event)} tabIndex={0} onKeyDown={event => openProductFromCardKeyboard(group, event)}>
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
            onPointerDown={stopProductCardInteraction}
            onClick={(event) => { event.stopPropagation(); handleCardAdd(group) }}
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
      className={`public-menu-page ${cartOpen ? 'has-public-drawer' : ''}`}
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
                onClick={() => showDesktopMenu()}>
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
        <div
          className="public-recommended-card"
          onClick={(event) => {
            if (recommendedWasSwiped.current) {
              recommendedWasSwiped.current = false
              return
            }
            if ((event.target as HTMLElement).closest('button, .public-recommended-dots-overlay')) return
            if (recommendedGroup) openGroup(recommendedGroup)
          }}
          onPointerDown={(event) => {
            recommendedSwipeStart.current = event.clientX
            recommendedWasSwiped.current = false
            pauseRecommendedAutoplay()
          }}
          onPointerUp={(event) => {
            const start = recommendedSwipeStart.current
            recommendedSwipeStart.current = null
            if (start == null || recommendedPool.length <= 1) {
              resumeRecommendedAutoplay()
              return
            }
            const distance = event.clientX - start
            if (Math.abs(distance) >= 42) {
              recommendedWasSwiped.current = true
              moveRecommended(distance < 0 ? 1 : -1)
            } else {
              resumeRecommendedAutoplay()
            }
          }}
          onPointerCancel={() => {
            recommendedSwipeStart.current = null
            resumeRecommendedAutoplay()
          }}
          onMouseEnter={pauseRecommendedAutoplay}
          onMouseLeave={resumeRecommendedAutoplay}
        >
          <div className="public-recommended-copy" key={`copy-${recommendedGroup?.key ?? 'empty'}`}>
            <small>RECOMENDADO <Flame size={12} /></small>
            <h2>{productTitle(recommendedGroup?.name ?? 'Explora nuestro menú')}</h2>
            <p>{recommendedGroup?.variants[0]?.product.description || 'Elige tu favorito y arma tu pedido.'}</p>
            {recommendedGroup && <span className="public-recommended-price">{money(recommendedGroup.minPrice)}</span>}
            {recommendedGroup && priceBs(recommendedGroup.minPrice) && <span className="public-prod-price-bs">{priceBs(recommendedGroup.minPrice)}</span>}
            <button
              className="public-recommended-btn"
              onClick={(event) => { event.stopPropagation(); if (recommendedGroup) openGroup(recommendedGroup) }}
              aria-label={`Ver ${productTitle(recommendedGroup?.name ?? 'producto')}`}
            >Ver producto <ChevronRight size={14} strokeWidth={2.5} aria-hidden="true" /></button>
          </div>
          <img key={`img-${recommendedGroup?.key ?? 'empty'}`} src={optimizedProductImage(recommendedGroup?.variants[0]?.product.imageUrl) || (recommendedGroup ? productImage(recommendedGroup.category) : '/optimized/login-carousel/slide3.webp')} alt={productTitle(recommendedGroup?.name ?? 'Menú Full China')} className={`public-recommended-img${['Agua', 'Refresco 2 Litros'].includes(recommendedGroup?.name ?? '') ? ' public-recommended-img--bottle' : ''}`} fetchPriority="high" decoding="async" />
          <div className="public-recommended-dots-overlay">
            {recommendedPool.map((_, i) => (
              <button key={i} type="button" className={i === recommendedIndex ? 'active' : ''} aria-label={`Ver recomendación ${i + 1}`} aria-current={i === recommendedIndex ? 'true' : undefined} onClick={(event) => {
                event.stopPropagation()
                if (i === recommendedIndex) return
                setRecommendedIndex(i)
                pauseRecommendedAutoplay()
                resumeRecommendedAutoplay()
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
                  <div className="public-category-grid">{section.groups.map((group, groupIndex) => renderProductCard(group, sectionIndex === 0 && groupIndex < (isDesktopViewport ? 4 : 2)))}</div>
                </section>
              )) : visibleGroups.map((group, groupIndex) => renderProductCard(group, groupIndex < (isDesktopViewport ? 4 : 2)))}
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
                  {instagramReels.map(({ reel, position }) => {
                    const reelIndex = INSTAGRAM_REELS.indexOf(reel)
                    const isActive = reelIndex === instagramActiveIndex
                    return (
                    <a
                      key={reel.href}
                      href={reel.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`public-instagram-reel is-reel-${position + 1}`}
                      onPointerEnter={() => setInstagramActiveIndex(reelIndex)}
                      onClick={(event) => {
                        if (!isActive) {
                          event.preventDefault()
                          setInstagramActiveIndex(reelIndex)
                        }
                      }}
                      aria-label={`Ver reel ${position + 1} de Full China en Instagram`}
                    >
                      <video autoPlay={isActive} muted playsInline preload="none" poster={reel.poster} data-active={isActive ? 'true' : undefined} onEnded={() => isActive && setInstagramActiveIndex((instagramActiveIndex + 1) % INSTAGRAM_REELS.length)}>
                        <source data-src={reel.src} type="video/mp4" />
                      </video>
                      <span className="public-instagram-reel-shade" aria-hidden="true" />
                      <span className="public-instagram-reel-link-icon" aria-hidden="true"><ArrowUpRight size={13} /></span>
                    </a>
                    )
                  })}
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
              <section className={`public-cinematic-hero ${homeSearchTerm.length >= 2 ? 'has-search-results' : ''}`}>
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
                    Sabor real, recién salido del wok.<span className="public-hero-desc-extra"> Arroces, tallarines y más, con tradición y porciones generosas.</span>
                  </p>

                  <div className="public-hero-search-row">
                    <div className="public-hero-search-shell">
                      <div className="public-hero-search-box">
                        <Search size={18} />
                        <input
                          placeholder="Buscar platos, combos o bebidas..."
                          value={search}
                          onChange={event => setSearch(event.target.value)}
                          onKeyDown={event => {
                            if (event.key !== 'Enter' || !search.trim()) return
                            showDesktopMenu('Todos', true)
                          }}
                          role="combobox"
                          aria-autocomplete="list"
                          aria-expanded={homeSearchTerm.length >= 2}
                          aria-controls="public-home-search-results"
                        />
                        {search && <button type="button" className="public-hero-search-clear" onClick={() => setSearch('')} aria-label="Limpiar búsqueda"><X size={14} /></button>}
                      </div>
                      {homeSearchTerm.length >= 2 && (
                        <div className="public-hero-search-results" id="public-home-search-results" role="listbox">
                          {homeSearchSuggestions.length > 0 ? (
                            <>
                              {homeSearchSuggestions.map(group => (
                                <button
                                  type="button"
                                  className="public-hero-search-result"
                                  key={group.key}
                                  role="option"
                                  aria-selected="false"
                                  onClick={event => {
                                    openGroup(group, event)
                                  }}
                                >
                                  <img src={optimizedProductImage(group.variants[0]?.product.imageUrl) || productImage(group.category)} alt="" />
                                  <span>
                                    <strong>{productTitle(group.name)}</strong>
                                    <small>{categoryLabel(group.category)}</small>
                                  </span>
                                  <b>{money(group.minPrice)}</b>
                                  <ChevronRight size={15} aria-hidden="true" />
                                </button>
                              ))}
                              <button
                                type="button"
                                className="public-hero-search-all"
                                onClick={() => showDesktopMenu('Todos', true)}
                              >
                                Ver todos los resultados <ChevronRight size={14} aria-hidden="true" />
                              </button>
                            </>
                          ) : (
                            <div className="public-hero-search-empty">
                              <strong>No encontramos productos</strong>
                              <span>Prueba con otro nombre.</span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                    <button 
                      type="button" 
                      className="public-hero-cta-btn" 
                      onClick={() => showDesktopMenu()}
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
                    onClick={() => showDesktopMenu()}
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
                      onClick={() => showDesktopMenu(category)}
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
                    onClick={() => showDesktopMenu('promociones')}
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
              <section className="public-menu-discovery" aria-labelledby="public-menu-discovery-title">
                <div className="public-menu-discovery-heading">
                  <span><Flame size={20} aria-hidden="true" /></span>
                  <div>
                    <h1 id="public-menu-discovery-title">{search.trim() ? `Resultados para “${search.trim()}”` : '¿Qué se te antoja hoy?'}</h1>
                    <p>{search.trim() ? `${visibleGroups.length} ${visibleGroups.length === 1 ? 'plato encontrado' : 'platos encontrados'} en nuestro menú.` : 'Encuentra tu plato favorito y pídelo preparado al momento.'}</p>
                  </div>
                </div>
                <button className={`public-favorites-inline ${showFavorites ? 'active' : ''}`} onClick={() => setShowFavorites(value => !value)} aria-label="Filtrar favoritos"><Heart size={16} fill={showFavorites ? 'currentColor' : 'none'} /><span>Favoritos</span>{favoriteIds.length > 0 && <b>{favoriteIds.length}</b>}</button>
                <label className="public-menu-search">
                  <Search size={18} aria-hidden="true" />
                  <input
                    type="search"
                    aria-label="Buscar en todo el menú"
                    value={search}
                    placeholder="Buscar arroz, promociones, bebidas…"
                    onChange={event => {
                      setActiveCategory('Todos')
                      setShowFavorites(false)
                      setSearch(event.target.value)
                    }}
                    onKeyDown={event => {
                      if (event.key !== 'Escape') return
                      setSearch('')
                      setActiveCategory('Todos')
                      setShowFavorites(false)
                      event.currentTarget.blur()
                    }}
                  />
                  {search && (
                    <button type="button" onClick={() => { setSearch(''); setActiveCategory('Todos'); setShowFavorites(false) }} aria-label="Limpiar búsqueda">
                      <X size={14} />
                    </button>
                  )}
                </label>
              </section>

              {/* Categories Nav (Floating Circular Dish Selector in Desktop) */}
              {categories.length > 4 && <div className="public-category-hint" aria-hidden="true">Desliza para ver más <ChevronRight size={13} /></div>}
              <nav className="public-categories-scroll" id="menu-section">
                 <button
                   className={`public-cat-btn ${activeCategory === 'Todos' ? 'active' : ''}`} 
                   onClick={() => { setSearch(''); setActiveCategory('Todos'); setShowFavorites(false) }}>
                   <div className="public-cat-dish-circle">
                     <img src={CATEGORY_ICONS.Todos} alt="" width={44} height={44} decoding="async" />
                   </div>
                   <span className="public-cat-label-vector"><Star size={13} fill="currentColor" aria-hidden="true" />Todos</span>
                </button>
                {categories.filter(c => c !== 'Todos').map(category => (
                   <button 
                      key={category}
                      className={`public-cat-btn ${activeCategory === category ? 'active' : ''}`}
                      onClick={() => { setSearch(''); setActiveCategory(category); setShowFavorites(false) }}
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
                {activeCategory !== 'Todos' && (
                  <div className="public-selected-category-heading">
                    <div><span /><h2>{categoryLabel(activeCategory)}</h2></div>
                    <b>{visibleGroups.length} {visibleGroups.length === 1 ? 'plato' : 'platos'}</b>
                  </div>
                )}

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
                        <div className="public-category-grid">{section.groups.map((group, groupIndex) => renderProductCard(group, sectionIndex === 0 && groupIndex < (isDesktopViewport ? 4 : 2)))}</div>
                      </section>
                    )) : (
                      <div className="public-category-grid">
                        {visibleGroups.map((group, groupIndex) => renderProductCard(group, groupIndex < (isDesktopViewport ? 4 : 2)))}
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
                    {instagramReels.map(({ reel, position }) => {
                      const reelIndex = INSTAGRAM_REELS.indexOf(reel)
                      const isActive = reelIndex === instagramActiveIndex
                      return (
                      <a
                        key={reel.href}
                        href={reel.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`public-instagram-reel is-reel-${position + 1}`}
                        onPointerEnter={() => setInstagramActiveIndex(reelIndex)}
                        onClick={(event) => {
                          if (!isActive) {
                            event.preventDefault()
                            setInstagramActiveIndex(reelIndex)
                          }
                        }}
                        aria-label={`Ver reel ${position + 1} de Full China en Instagram`}
                      >
                        <video autoPlay={isActive} muted playsInline preload="none" poster={reel.poster} data-active={isActive ? 'true' : undefined} onEnded={() => isActive && setInstagramActiveIndex((instagramActiveIndex + 1) % INSTAGRAM_REELS.length)}>
                          <source data-src={reel.src} type="video/mp4" />
                        </video>
                        <span className="public-instagram-reel-shade" aria-hidden="true" />
                        <span className="public-instagram-reel-link-icon" aria-hidden="true"><ArrowUpRight size={13} /></span>
                      </a>
                      )
                    })}
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
          <div ref={sidebarCardRef} className={`public-sidebar-card ${cartPulse ? 'is-pulsing' : ''} ${sidebarHasOverflow ? 'has-overflow' : ''}`}>
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
                    showDesktopMenu()
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

                <div className="public-sidebar-secondary">
                {/* Sidebar Recommendations (carrusel: una tarjeta a la vez,
                    rota sola — el espacio es angosto para varias en fila) */}
                {recommendations.length > 0 && (() => {
                  const activeReco = recommendations[sidebarRecoIndex] ?? recommendations[0]
                  return (
                    <section className="public-cart-recommendations public-sidebar-recommendations public-sidebar-reco-carousel">
                      <div className="public-cart-recommendations-head">
                        <h3><Flame size={18} color="#FF5A52" className="fire-icon-pulse" /> ¿Algo más?</h3>
                        <button type="button" onClick={() => { setReturnToConfirmAfterEdit(false); setStep('cart'); setCartOpen(true); setShowAllExtras(true) }}>Ver todos <ChevronRight size={13} /></button>
                      </div>
                      <div className="public-sidebar-reco-card" key={activeReco.key}>
                        <img src={optimizedProductImage(activeReco.variants[0]?.product.imageUrl) || productImage(activeReco.category)} alt="" />
                        <div>
                          <strong>{productTitle(activeReco.name)}</strong>
                          <b>{money(activeReco.minPrice)}{priceBs(activeReco.minPrice) && <small className="public-reco-bs">{priceBs(activeReco.minPrice)}</small>}</b>
                        </div>
                        <button type="button" onClick={() => requestQuickAdd(activeReco)}><Plus size={15} /></button>
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
                </div>

                {/* Big Checkout CTA Button */}
                <button 
                  type="button" 
                  className="public-sidebar-checkout-btn"
                  disabled={!cart.length || submitting}
                  onClick={() => {
                    if (!cart.length) return;
                    setCartOpen(true);
                    // Desde el resumen siempre se inicia el flujo de entrega;
                    // todavía faltan tipo de entrega, dirección y datos.
                    setStep('delivery');
                  }}
                >
                  <div className="public-sidebar-checkout-main">
                    <span>Continuar con el pedido</span>
                    <MessageSquareText size={18} />
                  </div>
                  <small>Configura la entrega y tus datos</small>
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
          <button className="public-cart-fab" onClick={() => { setReturnToConfirmAfterEdit(false); setCartOpen(true); setStep('cart') }}>
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

      {quickVariantGroup && createPortal(
        <div className={`public-variant-backdrop ${closingQuickVariant ? 'closing' : ''}`} onClick={closeQuickVariant}>
          <section className="public-variant-picker" role="dialog" aria-modal="true" aria-labelledby="public-variant-title" onClick={event => event.stopPropagation()}>
            <header className="public-variant-header">
              <span className="public-variant-header-icon"><Utensils size={20} /></span>
              <div>
                <small>ESCOGE ANTES DE AGREGAR</small>
                <h2 id="public-variant-title">¿Cuál presentación quieres?</h2>
                <p>{productTitle(quickVariantGroup.name)}</p>
              </div>
              <button type="button" className="public-variant-close" onClick={closeQuickVariant} aria-label="Cerrar selector"><X size={18} /></button>
            </header>

            <div className={`public-variant-options ${quickVariantGroup.variants.length > 4 ? 'is-many' : ''}`}>
              {quickVariantGroup.variants.map(({ product, label }) => {
                const selected = product.id === quickVariantId
                const inheritedImage = optimizedProductImage(product.imageUrl)
                  || optimizedProductImage(quickVariantGroup.variants[0]?.product.imageUrl)
                  || productImage(quickVariantGroup.category)
                return (
                  <button
                    type="button"
                    className={`public-variant-option ${selected ? 'selected' : ''}`}
                    key={product.id}
                    onClick={() => setQuickVariantId(product.id)}
                    aria-pressed={selected}
                  >
                    <span className="public-variant-option-media">
                      <img src={inheritedImage} alt="" />
                      {selected && <span className="public-variant-option-badge">Elegido</span>}
                      <span className="public-variant-option-check"><Check size={16} /></span>
                    </span>
                    <span className="public-variant-option-copy">
                      <small>Presentación</small>
                      <strong>{formatSpanishText(label)}</strong>
                      <span className="public-variant-option-description">
                        {formatSpanishText(product.description || 'Preparación Full China')}
                      </span>
                      <span className="public-variant-option-price">{money(product.price)}{priceBs(product.price) && <em>{priceBs(product.price)}</em>}</span>
                    </span>
                  </button>
                )
              })}
            </div>

            <footer className="public-variant-footer">
              <div className="public-variant-quantity" aria-label="Cantidad">
                <button type="button" onClick={() => setQuickVariantQuantity(value => Math.max(1, value - 1))} aria-label="Disminuir cantidad"><Minus size={15} /></button>
                <span><small>Cantidad</small><strong>{quickVariantQuantity}</strong></span>
                <button type="button" onClick={() => setQuickVariantQuantity(value => value + 1)} aria-label="Aumentar cantidad"><Plus size={15} /></button>
              </div>
              <div className="public-variant-actions">
                <button type="button" className="public-variant-customize" disabled={!quickSelectedVariant} onClick={personalizeQuickVariant}>Personalizar</button>
                <button type="button" className="public-variant-add" disabled={!quickSelectedVariant} onClick={confirmQuickVariant}>
                  <ShoppingCart size={16} />
                  <span>{quickSelectedVariant ? <>Agregar · {money(quickSelectedVariant.product.price * quickVariantQuantity)}</> : 'Elige una presentación'}</span>
                </button>
              </div>
            </footer>
          </section>
        </div>,
        document.body
      )}

      {selectedGroup && selectedProduct && createPortal(
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
              {loadingModifiers && detailModifierGroups.length === 0 ? (
                <div className="ppdm-section ppdm-extras-section">
                  <div className="ppdm-section-header"><h3>Extras <small>(cargando…)</small></h3></div>
                  <div className="ppdm-chip-row">
                    {[0, 1, 2, 3, 4, 5].map(i => (
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
        </div>,
        document.body
      )}

      {cartOpen && step === 'whatsapp' && createPortal(
        <div className={`public-whatsapp-ready-backdrop ${closingCart ? 'closing' : ''}`}>
          <section className={`public-whatsapp-ready-page ${closingCart ? 'closing' : ''}`} aria-labelledby="whatsapp-ready-title">
            <header className="public-whatsapp-ready-header"><img src="/optimized/root/logo.webp" alt="Full China" /><button type="button" className="public-whatsapp-ready-close" onClick={closeCart} aria-label="Cerrar confirmación"><X size={20} /></button></header>
            <div className="public-preparing-visual public-whatsapp-ready-visual" aria-hidden="true"><img className="preparing-layer preparing-fire-red" src="/optimized/cargando-pedido/fuego-circulo-rojo.webp" alt="" /><span className="preparing-composition-arrow preparing-composition-arrow-left"><ChevronRight size={20} /></span><img className="preparing-layer preparing-wok-new" src="/optimized/cargando-pedido/wok-nuevo.webp" alt="" /><span className="preparing-composition-arrow preparing-composition-arrow-right"><ChevronRight size={20} /></span><img className="preparing-layer preparing-whatsapp-green" src="/optimized/cargando-pedido/whatsapp-circulo-verde.webp" alt="" /></div>
            <div className="public-whatsapp-ready-content">
              <div className="public-whatsapp-ready-hero">
              <span className="public-whatsapp-ready-icon" aria-hidden="true"><span className="public-whatsapp-mark"><svg viewBox="0 0 32 32"><circle cx="16" cy="16" r="13" /><path d="M11.5 10.8c.4-.5 1-.5 1.4-.1l1.7 1.8c.4.4.4 1 0 1.4l-1 1c1 2 2.4 3.4 4.4 4.4l1-1c.4-.4 1-.4 1.4 0l1.8 1.7c.4.4 0 1-.1 1.4-.8.8-2 1.1-3.1.7-4.5-1.4-7.7-4.6-9.1-9.1-.4-1.1-.1-2.3.7-3.1Z" /></svg></span></span>
              <h1 id="whatsapp-ready-title">¡Pedido registrado!</h1>
              <strong>#{orderCode || 'WEB-PENDIENTE'}</strong>
              {submitting && <span className="public-whatsapp-ready-loading" role="status" aria-live="polite"><span className="public-loading-dots" aria-hidden="true"><i /><i /><i /></span>Preparando tu enlace de WhatsApp…</span>}
              </div>
              <section className="public-whatsapp-ready-card">
              <span className="public-whatsapp-ready-kicker">Muy importante:</span>
              <h2>Como último paso, envía tu pedido por WhatsApp a Full China para coordinar los detalles finales.</h2>
              <p>Presiona ahora el botón de “Enviar pedido por WhatsApp” y se abrirá una conversación donde debes enviar el mensaje que hemos preparado para ti.</p>
              <span className="public-whatsapp-ready-arrow" aria-hidden="true">↓</span>
              <button type="button" className="public-whatsapp-ready-btn" onClick={openWhatsApp} disabled={!whatsappUrl}>
                <span className="public-whatsapp-mark" aria-hidden="true"><svg viewBox="0 0 32 32"><circle cx="16" cy="16" r="13" /><path d="M11.5 10.8c.4-.5 1-.5 1.4-.1l1.7 1.8c.4.4.4 1 0 1.4l-1 1c1 2 2.4 3.4 4.4 4.4l1-1c.4-.4 1-.4 1.4 0l1.8 1.7c.4.4 0 1-.1 1.4-.8.8-2 1.1-3.1.7-4.5-1.4-7.7-4.6-9.1-9.1-.4-1.1-.1-2.3-.7-3.1Z" /></svg></span>
                <span>Enviar pedido por WhatsApp</span><ChevronRight aria-hidden="true" />
              </button>
              <button type="button" className="public-whatsapp-review-link" onClick={returnToOrderReview} disabled={submitting}>← Revisar mi pedido</button>
              <small className="public-whatsapp-ready-footnote">Full China recibirá tu solicitud por esta conversación.</small>
              </section>
            </div>
          </section>
        </div>, document.body
      )}
      {cartOpen && step !== 'whatsapp' && createPortal(
        <div className={`public-drawer-backdrop ${closingCart ? 'closing' : ''}`} onClick={closeCart}><aside className={`public-cart-drawer ${step === 'details' ? 'public-data-drawer' : ''} public-step-${step}`} onClick={event => event.stopPropagation()}>
        <header className="public-review-header">{step !== 'sent' && <button className="public-review-back" onClick={() => { const isDesktop = typeof window.matchMedia === 'function' && window.matchMedia(DESKTOP_MEDIA_QUERY).matches; if (step === 'details') { setStep(orderType === 'delivery' ? 'address' : 'delivery'); } else if (step === 'confirm') { setStep('details'); } else if (step === 'address') { setStep('delivery'); } else if (step === 'delivery') { if (isDesktop) closeCart(); else setStep('cart'); } else if (step === 'preparing') { closeCart(); } else { closeCart(); } }} aria-label="Volver"><ChevronRight /></button>}<img src="/optimized/root/logo.webp" alt="Full China" />{step !== 'sent' && <div className="public-review-heading"><h2><ShoppingBag size={20} className="public-review-heading-icon" /> {step === 'delivery' ? '¿Cómo quieres recibirlo?' : step === 'address' ? '¿Dónde te lo llevamos?' : step === 'details' ? 'Tus datos' : step === 'confirm' ? 'Revisa y confirma tu pedido' : step === 'preparing' ? 'Preparando tu pedido' : 'Tu pedido'}</h2><p>{step === 'delivery' ? 'Selecciona la forma de entrega de tu pedido.' : step === 'address' ? '¿Dónde te lo llevamos?' : step === 'details' ? 'Necesitamos esta información para preparar tu pedido.' : step === 'confirm' ? 'Confirma que todo esté correcto antes de enviarlo.' : step === 'preparing' ? 'Estamos creando tu solicitud segura.' : 'Revisa tu pedido antes de continuar.'}</p></div>}{step === 'cart' && cart.length > 0 && <div className="public-estimate-card" aria-label="Entrega estimada"><span className="public-estimate-dot" /><div><small>Entrega estimada</small><strong>35–50 min</strong></div></div>}</header>
        {cartGuardMessage && <div className={`public-cart-guard ${cartGuardClosing ? 'closing' : ''}`} role="alert"><CircleAlert /><div><strong>Tu carrito está vacío</strong><span>{cartGuardMessage}</span></div></div>}
        {step === 'cart' && <div className="public-review-page"><div className="public-cart-items">{cart.length === 0 ? <div className="public-sidebar-empty"><div className="public-empty-box-art"><img src="/optimized/fondos/carrito-vacio.webp" alt="Tu pedido está vacío" className="public-empty-cart-img" /></div><h3 className="public-empty-cart-title">Tu pedido está vacío</h3><p className="public-empty-cart-msg">Parece que aún no has agregado nada a tu pedido.</p><p className="public-empty-cart-sub">¡Explora nuestro menú y encuentra tu próximo favorito!</p><button type="button" className="public-empty-explore-btn" onClick={() => { setCurrentTab('menu'); window.scrollTo({ top: 0, behavior: 'smooth' }); }}><ShoppingBag size={18} /><span>Explorar menú</span></button></div> : cart.map(item => <div className="public-cart-item" key={cartLineKey(item)}><img className="public-cart-item-image" src={optimizedProductImage(item.imageUrl) || '/optimized/login-carousel/slide3.webp'} alt="" /><div className="public-cart-item-main"><strong>{cartProductName(item.productName)}</strong><span>{item.quantity} {item.quantity === 1 ? 'porción' : 'porciones'}</span>{item.notes && <small className="public-cart-item-notes">✦ {item.notes}</small>}<div className="public-review-qty"><button onClick={() => updateQuantity(item.productId, -1, item.notes || '')}>{item.quantity === 1 ? <Trash2 /> : <Minus />}</button><b>{item.quantity}</b><button onClick={() => updateQuantity(item.productId, 1, item.notes || '')}><Plus /></button></div></div><strong className="public-cart-item-total">{money(item.price * item.quantity)}{priceBs(item.price * item.quantity) && <small className="public-cart-item-bs">{priceBs(item.price * item.quantity)}</small>}</strong><button className="public-review-edit" onClick={() => { closeCart(); setTimeout(() => { editCartItem(item) }, 240) }}>Editar</button></div>)}</div>{cart.length > 0 && recommendations.length > 0 && <section className="public-cart-recommendations"><div className="public-cart-recommendations-head"><h3><Flame size={18} color="#FF5A52" className="fire-icon-pulse" /> ¿Algo más?</h3><button type="button" onClick={() => setShowAllExtras(true)}>Ver todos <ChevronRight size={13} /></button></div><div className="public-recommendation-row">{recommendations.map(group => <article key={group.key}><img src={optimizedProductImage(group.variants[0]?.product.imageUrl) || productImage(group.category)} alt="" /><div><strong>{productTitle(group.name)}</strong><b>{money(group.minPrice)}{priceBs(group.minPrice) && <small className="public-reco-bs">{priceBs(group.minPrice)}</small>}</b></div><button type="button" onClick={() => requestQuickAdd(group)}><Plus size={15} /></button></article>)}</div></section>}{cart.length > 0 && <div className="public-total public-review-total"><span>Subtotal productos</span><strong>{money(total)}{priceBs(total) && <small className="public-total-bs">{priceBs(total)}</small>}</strong><small>Productos seleccionados</small><b>Total productos <em>{money(total)}{priceBs(total) && <small className="public-total-bs">{priceBs(total)}</small>}</em></b></div>}{cart.length > 0 && <button className="public-primary" onClick={() => requireCart() && setStep('delivery')}>Continuar <ChevronRight /></button>}</div>}
        {step === 'delivery' && <div className="public-delivery-step"><div className={`public-delivery-choice ${orderType === 'takeaway' ? 'selected' : ''}`} onClick={() => { setOrderType('takeaway'); setDeliveryChosen(true) }}><img src="/optimized/fondos/pickup-card.webp" alt="Retirar en Full China" /><div><strong>Retirar en Full China</strong><span>Lo prepararemos para que vengas a buscarlo.</span></div><span className="public-choice-radio" /></div><div className={`public-delivery-choice ${orderType === 'delivery' ? 'selected' : ''}`} onClick={() => { setOrderType('delivery'); setDeliveryChosen(true) }}><img src="/optimized/fondos/delivery-card.webp" alt="Delivery" /><div><strong>Delivery</strong><span>Te lo llevamos hasta donde estés.</span></div><span className="public-choice-radio" /></div><p className="public-delivery-hint">⌖ Podrás indicar la dirección en el siguiente paso.</p><button className="public-primary public-delivery-continue" disabled={!cart.length} onClick={() => { setDeliveryChosen(true); setStep(orderType === 'delivery' ? 'address' : 'details') }}>Continuar <ChevronRight /></button></div>}
        {step === 'address' && <div className="public-address-step"><div className="public-address-search"><Search /><input ref={addressRef} value={address} onChange={event => searchAddress(event.target.value)} placeholder="Buscar dirección, urbanización o ciudad" /></div>{showSuggestions && address.trim().length >= 4 && <div className="public-address-suggestions public-address-step-suggestions">{searchingAddress ? <div className="public-suggestion-status"><span className="public-search-spinner" />Buscando direcciones…</div> : addressSuggestions.length > 0 ? <><div className="public-suggestion-heading">Direcciones encontradas</div>{addressSuggestions.map((s, i) => { const parts = s.display_name.split(','); const primary = parts.shift() || s.display_name; return <button key={i} type="button" className="public-suggestion-item" onMouseDown={() => selectSuggestion(s)}><span className="public-suggestion-icon"><MapPin size={14} /></span><span className="public-suggestion-copy"><strong>{primary}</strong><small>{parts.join(',').trim() || 'Ubicación en el mapa'}</small></span><ChevronRight size={14} className="public-suggestion-arrow" /></button> })}</> : <div className="public-suggestion-status">No encontramos esa dirección.<small>Prueba con ciudad y urbanización.</small></div>}</div>}<Suspense fallback={<div className="public-address-map" aria-label="Cargando mapa" />}><AddressMap coordinates={geoCoords} onPick={selectMapLocation} /></Suspense><div className={`public-address-selected${addressFieldError === 'address' || addressFieldError === 'geo' ? ' invalid' : ''}`} ref={addressSelectedRef}><MapPin /><div><small>Dirección seleccionada</small><strong>{address || 'Toca el mapa o busca una dirección'}</strong><span>{addressMethod === 'gps' ? 'Ubicación GPS confirmada' : addressMethod === 'map' ? 'Punto elegido en el mapa' : addressMethod === 'search' ? 'Dirección encontrada' : 'Pendiente de confirmar'}</span>{addressFieldError === 'address' && <em className="public-field-error" role="alert">Escribe una dirección o toca un punto del mapa para seleccionarla.</em>}{addressFieldError === 'geo' && <em className="public-field-error" role="alert">Confirma la ubicación tocando el mapa o eligiendo una sugerencia.</em>}</div><button type="button" onClick={() => addressRef.current?.focus()}>Editar</button></div><button type="button" className="public-location-row" onClick={useMyLocation} disabled={locating}><Navigation /><strong>{locating ? 'Obteniendo ubicación…' : 'Usar mi ubicación actual'}</strong><ChevronRight /></button><label className={`public-address-extra${addressFieldError === 'reference' ? ' invalid' : ''}`}><span>Casa / edificio / referencia</span><input ref={referenceRef} value={addressReference} onChange={event => { setAddressReference(event.target.value); if (addressFieldError === 'reference') setAddressFieldError('') }} placeholder="Ej. Torre B, Piso 4, Apt. 4B" />{addressFieldError === 'reference' && <em className="public-field-error" role="alert">Agrega una referencia para que el repartidor encuentre el lugar fácilmente.</em>}</label><label className="public-address-extra"><span>Indicaciones adicionales <small>(opcional)</small></span><textarea value={notes} maxLength={500} onChange={event => setNotes(event.target.value)} placeholder="Ej. Timbre 04B, dejar con el conserje, etc." /></label><div className="public-address-summary"><div><small>Entrega estimada</small><strong>35–50 min</strong></div><span>{geoCoords ? 'Ubicación confirmada' : 'Selecciona una ubicación'}</span></div><button className="public-primary public-address-continue" disabled={!cart.length} onClick={continueFromAddress}>Continuar <ChevronRight /></button></div>}
        {step === 'details' && (
          <div className="public-checkout">
            <div className="public-data-intro">
              <strong>¿A nombre de quién?</strong>
              <span>Solo para coordinar tu pedido.</span>
            </div>
            {showDemoTools && <button type="button" className="public-demo-data-button" onClick={fillDemoData}><Zap size={15} /> Rellenar datos demo</button>}
            <div className="public-data-form-card">
              <label className={`public-data-field${fieldError === 'name' ? ' invalid' : ''}`}><span className="public-data-icon"><UserRound /></span><span className="public-data-field-copy"><span>Tu nombre <em className="public-data-req">*</em></span><div className="public-data-input"><input ref={nameRef} autoComplete="name" value={name} onChange={event => { setName(event.target.value); if (fieldError === 'name') setFieldError('') }} placeholder="Nombre y apellido" /></div>{fieldError === 'name' && <em className="public-field-error" role="alert">Escribe tu nombre.</em>}</span></label>
              <label className={`public-data-field${fieldError === 'identification' ? ' invalid' : ''}`}><span className="public-data-icon"><UserRound /></span><span className="public-data-field-copy"><span>Tu cédula <em className="public-data-req">*</em></span><div className="public-data-input"><div className="public-id-prefix-toggle">{(['V', 'E', 'J'] as const).map(p => <button key={p} type="button" className={idPrefix === p ? 'active' : ''} onClick={() => { setIdPrefix(p); setIdentification(`${p}-${identification.replace(/^[VEJ]-?/i, '')}`); if (fieldError === 'identification') setFieldError('') }}>{p}</button>)}</div><input ref={identificationRef} inputMode="numeric" autoComplete="off" value={identification.replace(/^[VEJ]-?/i, '')} maxLength={8} onChange={event => { const digits = event.target.value.replace(/\D/g, ''); setIdentification(`${idPrefix}-${digits}`); if (fieldError === 'identification') setFieldError('') }} onBlur={() => { const digits = identification.replace(/^[VEJ]-?/i, ''); if (digits && (digits.length < 6 || digits.length > 8)) setFieldError('identification') }} placeholder="12345678" /></div>{fieldError === 'identification' ? <em className="public-field-error" role="alert">La cédula debe tener entre 6 y 8 dígitos.</em> : <small>La usaremos para conservar tu historial de pedidos</small>}</span></label>
              <label className={`public-data-field${fieldError === 'phone' ? ' invalid' : ''}`}><span className="public-data-icon"><Phone /></span><span className="public-data-field-copy"><span>Tu WhatsApp <em className="public-data-req">*</em></span><div className="public-data-input"><input ref={phoneRef} type="tel" inputMode="tel" autoComplete="tel" value={phone} maxLength={15} onChange={event => { setPhone(event.target.value); if (fieldError === 'phone') setFieldError('') }} onBlur={() => { if (phone.trim() && phone.replace(/\D/g, '').length !== 11) setFieldError('phone') }} placeholder="0412 000 0000" /></div>{fieldError === 'phone' ? <em className="public-field-error" role="alert">Debe tener exactamente 11 dígitos, ej. 0412 000 0000.</em> : <small>Te escribiremos aquí para confirmar</small>}</span></label>
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
            <button className="public-primary whatsapp" disabled={submitting} onClick={continueToConfirmation}>Revisar pedido <ChevronRight /></button>
          </div>
        )}
        {step === 'confirm' && <div className="public-confirm-page"><div className="public-receipt"><div className="public-receipt-head"><img src="/optimized/root/logo.webp" alt="Full China" /><div><span>Solicitud</span><strong>{orderCode || draftOrderCode || 'WEB-PENDIENTE'}</strong><small>Ahora · pedido web</small></div></div>
          <div className="public-confirm-items">{cart.map(item => <div className="public-confirm-item" key={cartLineKey(item)}><img src={optimizedProductImage(item.imageUrl) || '/optimized/login-carousel/slide3.webp'} alt="" /><div><div className="public-confirm-item-name-row"><strong>{cartProductName(item.productName)}</strong><button type="button" aria-label={`Editar ${item.productName}`} onClick={() => { setReturnToConfirmAfterEdit(true); setStep('cart'); closeCart() }}><Pencil aria-hidden="true" /><span>Editar</span></button></div><span>{item.quantity} {item.quantity === 1 ? 'porción' : 'porciones'}</span>{item.notes && <small>{item.notes}</small>}</div><b>{money(item.price * item.quantity)}{priceBs(item.price * item.quantity) && <small className="public-cart-item-bs">{priceBs(item.price * item.quantity)}</small>}</b></div>)}</div>
          <div className="public-total public-review-total"><span>Subtotal productos</span><strong>{money(total)}{priceBs(total) && <small className="public-total-bs">{priceBs(total)}</small>}</strong><div className="public-delivery-total-label">{orderType === 'delivery' ? 'Delivery' : 'Retiro'}</div><div className={`public-delivery-total-value ${orderType === 'takeaway' ? 'is-pickup' : ''}`}>{orderType === 'delivery' ? deliveryFeeText : 'En el local'}</div><b>Total del pedido <em>{money(orderTotal)}{priceBs(orderTotal) && <small className="public-total-bs">{priceBs(orderTotal)}</small>}</em></b></div>
          <div className="public-confirm-info"><button type="button" onClick={() => setStep(orderType === 'delivery' ? 'address' : 'delivery')}><MapPin /><div><strong>{orderType === 'delivery' ? 'Dirección de entrega' : 'Entrega'}</strong><span>{orderType === 'delivery' ? address : 'Retirar en Full China'}</span><small>{orderType === 'delivery' ? addressReference || 'Sin referencia adicional' : 'Listo para retirar en el local'}</small></div><b>Editar</b></button><button type="button" onClick={() => setStep('details')}><UserRound /><div><strong>Datos de contacto</strong><span>{name}</span><small>{phone}</small></div><b>Editar</b></button></div>{error && <Toast type="error" message={error} onClose={() => setError('')} />}</div>
          <button className="public-primary whatsapp public-whatsapp-cta" disabled={submitting} onClick={submitOrder}><span className="public-confirm-check" aria-hidden="true"><Check /></span><span className="public-whatsapp-copy"><strong>{submitting ? 'Preparando pedido…' : 'Confirmar pedido'}</strong></span></button><p className="public-order-security">⌕ &nbsp; Tu pedido será confirmado directamente por Full China</p>
        </div>}
        {step === 'preparing' && <div className="public-preparing-page"><img className="preparing-logo" src="/optimized/root/logo.webp" alt="Full China" /><div className="public-preparing-visual" aria-hidden="true"><img className="preparing-layer preparing-fire-red" src="/optimized/cargando-pedido/fuego-circulo-rojo.webp" alt="" /><span className="preparing-composition-arrow preparing-composition-arrow-left"><ChevronRight size={20} /></span><img className="preparing-layer preparing-wok-new" src="/optimized/cargando-pedido/wok-nuevo.webp" alt="" /><span className="preparing-composition-arrow preparing-composition-arrow-right"><ChevronRight size={20} /></span><img className="preparing-layer preparing-whatsapp-green" src="/optimized/cargando-pedido/whatsapp-circulo-verde.webp" alt="" /></div><h3>Preparando tu pedido<br />para WhatsApp<span className="preparing-ellipsis">…</span></h3><p>Estamos creando tu solicitud segura.</p><div className="public-preparing-progress" aria-label="Progreso del pedido"><div className="public-progress-rail"><span /></div><div className="public-progress-step progress-step-one"><i><Check size={22} /></i><strong>Solicitud<br />creada</strong></div><div className="public-progress-step progress-step-two"><i><Check size={22} /></i><strong>Armando tu<br />pedido</strong></div><div className="public-progress-step progress-step-three"><i><LoaderCircle size={22} /></i><strong>Abriendo<br />WhatsApp</strong></div></div><div className="public-preparing-security"><ShieldCheck size={20} /><div><strong>Tus datos viajan seguros</strong><span>Solo los usamos para confirmar tu pedido.</span></div></div></div>}
        {step === 'sent' && <div className="public-success"><span><Check /></span><h3>¡Enviado!</h3><strong>{orderCode || 'WEB-PENDIENTE'}</strong><p>Espera la confirmación de Full China por <b>WhatsApp</b>.</p><div className="public-status-timeline"><div className="complete"><i><Check size={18} /></i><div><strong>Solicitud creada</strong><small>Tu pedido fue registrado correctamente.</small></div><time>Ahora</time></div><div className="complete"><i><Check size={18} /></i><div><strong>Enviado por WhatsApp</strong><small>Tu solicitud fue enviada a Full China.</small></div><time>Ahora</time></div><div className="pending"><i>3</i><div><strong>Esperando confirmación</strong><small>Te confirmaremos tu pedido por WhatsApp.</small></div><time>◷</time></div></div><div className="public-success-actions"><button type="button" className="public-primary" onClick={returnToMenuAfterSent}>Volver al menú</button></div></div>}
        {showAllExtras && step === 'cart' && <div className={`public-cart-all-extras ${closingAllExtras ? 'closing' : ''}`}><div className="public-cart-all-extras-head"><div><span>CATÁLOGO RÁPIDO</span><h3>Agrega algo más</h3></div><button type="button" onClick={() => { const isDesktop = window.matchMedia(DESKTOP_MEDIA_QUERY).matches; closeAllExtras(); if (isDesktop) closeCart() }} aria-label="Cerrar">×</button></div><label className="public-cart-extras-search"><Search size={16} /><input value={extrasSearch} onChange={event => setExtrasSearch(event.target.value)} placeholder="Buscar un plato, bebida o extra" /><button type="button" onClick={() => setExtrasSearch('')} aria-label="Limpiar búsqueda">×</button></label><div className="public-cart-extra-sections">{extrasSections.length === 0 ? <p className="public-cart-extras-empty">No encontramos ese producto. Prueba con otro nombre.</p> : extrasSections.map(([category, categoryGroups]) => <section key={category}><div className="public-cart-extra-section-head"><h4>{categoryLabel(category)}</h4><span>{categoryGroups.length}</span></div><div className="public-cart-all-extras-grid">{categoryGroups.map(group => <article key={group.key}><img src={optimizedProductImage(group.variants[0]?.product.imageUrl) || productImage(group.category)} alt="" /><div><strong>{productTitle(group.name)}</strong><b>{money(group.minPrice)}{priceBs(group.minPrice) && <small className="public-reco-bs">{priceBs(group.minPrice)}</small>}</b></div><button type="button" onClick={() => requestQuickAdd(group)}><Plus size={15} /></button></article>)}</div></section>)}</div></div>}
      </aside></div>,
        document.body
      )}
    </main>
  )
}
