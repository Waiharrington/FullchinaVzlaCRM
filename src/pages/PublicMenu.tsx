import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent as ReactKeyboardEvent, type MouseEvent as ReactMouseEvent, type SyntheticEvent, type WheelEvent as ReactWheelEvent } from 'react'
import { createPortal } from 'react-dom'
import { ChevronRight, CircleAlert, CircleCheck, LoaderCircle, ShoppingBag, ShoppingCart } from 'lucide-react'
import { groupMenuProducts, type MenuProductGroup } from '../lib/menuGrouping'
import { getCartCarouselGroups, getCartRecommendations } from '../lib/cartRecommendations'
import { publicCartIncludedCopy } from '../lib/publicMenuLabels'
import { createWebOrder, describeWebOrderError, getPublicCatalog, getPublicMenuCategories, getPublicDeliverySettings, getPublicProductModifiers, type CustomerRepeatOrder, type WebOrderCartItem } from '../lib/publicOrders'
import { estimateDelivery, getDeliveryRoute, type DeliveryEstimate, type DeliveryRoute, type DeliverySettings } from '../lib/delivery'
import { reverseGoogleAddress, searchGoogleAddresses } from '../lib/googleMaps'
import { appendRequiredOrderMetadata, describePickupTime, getPublicPickupSlots, PUBLIC_ORDER_MIN_SUBTOTAL,isValidPublicIdentification, normalizeVenezuelanPhone, calculateModifierTotal, getDefaultModifierSelection, getModifierSelectionError, getPublicCartLimitViolation, hasInvalidModifierSelection, isIncludedProteinGroup, PUBLIC_ORDER_MAX_DISTINCT_LINES, PUBLIC_ORDER_MAX_UNITS_PER_PRESENTATION, type PublicModifierSelection, type PublicCartLimitViolation } from '../lib/publicOrderRules'
import { type ProductModifierGroup } from '../lib/dataService'
import { getExchangeRates } from '../lib/rates'
import type { Product } from '../lib/dataService'
import { PublicMenuWelcomeModal } from '../components/PublicMenuWelcomeModal'
import { consumePublicMenuWelcomeDismissal, PUBLIC_MENU_WELCOME_DISMISSED_KEY } from '../lib/publicMenuWelcome'
import { getCustomerOrderProfile } from '../lib/customerOrderProfile'
import { getCustomerFavorites, syncCustomerFavorites } from '../lib/customerFavorites'
import { DEFAULT_PUBLIC_ORDER_PAGE_SETTINGS, DEFAULT_PUBLIC_ORDER_REELS, getPublicOrderMapEmbedUrl, getPublicOrderPageSettings, type PublicOrderPageSettings, type PublicOrderReel } from '../lib/publicOrderPageSettings'
import { preserveEmptyPublicCarousel, selectPublicCarouselGroups } from '../lib/publicOrderCarousel'
import { recordLocalOrderTestOrder } from '../lib/localOrderTestMode'
import { useLiveDataRefresh } from '../lib/liveDataRefresh'
import { customerSupabase, startCustomerDataChangeFeed, stopCustomerDataChangeFeed, startPublicMenuDataChangeFeed, stopPublicMenuDataChangeFeed, subscribeToDataChanges } from '../lib/supabase'
import { formatProductTitle, formatSpanishText, normalizeForSearch } from '../lib/textFormat'
import { categoryLabel, classifyMenuCategory, menuItemRank, menuCategoryRank, isKnownCategory, hydrateMenuCategories, MENU_CATEGORY_ORDER } from '../lib/menuCategories'
import Toast from '../components/Toast'
import { ProductCard } from '../components/public-menu/ProductCard'
import { DesktopProductCard } from '../components/public-menu/DesktopProductCard'
import { DesktopPromoCard } from '../components/public-menu/DesktopPromoCard'
import { CATEGORY_ACCENT_CYCLE } from '../lib/publicMenuConfig'
import { preloadCustomerLoyaltyProfile } from '../components/public-menu/lazyViews'
import { PublicTopBar } from '../components/public-menu/PublicTopBar'
import { PublicMobileView } from '../components/public-menu/PublicMobileView'
import { PublicDesktopLayout } from '../components/public-menu/PublicDesktopLayout'
import { QuickVariantDialog } from '../components/public-menu/QuickVariantDialog'
import { QuickProteinDialog } from '../components/public-menu/QuickProteinDialog'
import { ProductDetailDialog } from '../components/public-menu/ProductDetailDialog'
import { CartExtrasCatalog } from '../components/public-menu/CartExtrasCatalog'
import { StoreClosedNotice } from '../components/public-menu/StoreClosedNotice'
import { CartStep } from '../components/public-checkout/CartStep'
import { DeliveryStep } from '../components/public-checkout/DeliveryStep'
import { PickupStep } from '../components/public-checkout/PickupStep'
import { AddressStep } from '../components/public-checkout/AddressStep'
import { DetailsStep } from '../components/public-checkout/DetailsStep'
import { ConfirmStep } from '../components/public-checkout/ConfirmStep'
import { SentStep } from '../components/public-checkout/SentStep'
import { formatStoreSchedule, formatStoreTime, getStoreClock } from '../lib/publicStoreClock'
import { CART_KEY, CHECKOUT_ATTEMPT_KEY, DESKTOP_MEDIA_QUERY, DESKTOP_SIDEBAR_MEDIA_QUERY, DESKTOP_TAB_KEY, FAVORITES_KEY, FLOW_STATE_KEY, LAST_ORDER_KEY, LOCAL_ORDER_TEST_MODE, ORDER_HOURS_BLOCK_ENABLED, PREVIEW_LOADING, PUBLIC_MODIFIER_CACHE, PUBLIC_WHATSAPP_PHONE, WHATSAPP_SENT_KEY, isRecentSentState } from '../lib/publicMenuConfig'
import { readCatalogCache, readCheckoutAttempt, readDesktopTab, saveCatalogCache } from '../lib/publicMenuStorage'
import { BS_FORMATTER, PAY_OPTIONS, PayMethod, cartLineKey, filterProteinExtraGroups, isProteinCatalogExtra, money, optimizedProductImage, previewImageSource, productImage } from '../lib/publicMenuFormat'
import { revealCheckoutField } from '../lib/publicCheckoutDom'
import type { MapCoordinates, DesktopTab, CheckoutStep } from '../lib/publicMenuTypes'
import './PublicMenu.css'


declare global { interface Window { __removeFCSplash?: () => void } }

// Selección curada para la sección "Date un banquete en Full China" del inicio.
// Curados para no solaparse con "Nuestras Promociones" (categorías promociones/ejecutivos/individuales).
const FEATURED_DISH_QUERIES = ['arroz frito especial', 'chop suey especial', 'costillas agridulce', 'vermicelli especial']

// Tinte de fondo (RGB) para el efecto de "profundidad" que acompaña el
// scroll en la vista "Todos" — sutil, no reemplaza la imagen de fondo de la
// marca, solo la tiñe levemente según lo que se está viendo. Solo usa los
// colores de la marca (rojo, dorado, naranja), intercalados por categoría.

const DEFAULT_INSTAGRAM_PROFILE_URL = 'https://www.instagram.com/_u/fullchinavzla/'
function handleInstagramProfileClick(event: ReactMouseEvent<HTMLAnchorElement>) {
  const userAgent = navigator.userAgent
  const isIOS = /iPad|iPhone|iPod/.test(userAgent)
    || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  const isAndroid = /Android/i.test(userAgent)
  if (!isIOS && !isAndroid) return

  event.preventDefault()
  const profileUrl = event.currentTarget.href
  const profilePath = new URL(profileUrl).pathname.split('/').filter(Boolean).pop() || 'fullchinavzla'
  const appUrl = isIOS
    ? `instagram://user?username=${encodeURIComponent(profilePath.replace(/^_u$/, 'fullchinavzla'))}`
    : `intent://www.instagram.com/${profilePath}/#Intent;scheme=https;package=com.instagram.android;S.browser_fallback_url=${encodeURIComponent(profileUrl)};end`
  // No agregar un fallback temporizado aquí: iOS puede dejar Safari como
  // visible aunque ya haya abierto Instagram, y eso sacaría al cliente de la app.
  // Android ya lleva su fallback web dentro del intent si Instagram no existe.
  window.location.assign(appUrl)
}

function instagramReelOrder(reels: PublicOrderReel[], activeIndex: number) {
  return Array.from({ length: reels.length }, (_, position) => ({
    reel: reels[(activeIndex - 2 + position + reels.length) % reels.length],
    position,
  }))
}

function startInstagramVideo(video: HTMLVideoElement) {
  if (!video.src) {
    const source = video.dataset.src || video.querySelector('source')?.dataset.src
    if (!source) return
    video.src = source
  }
  // The selected reel is the only one allowed to buffer after the customer
  // explicitly asks to watch it. Metadata is warmed separately on tab entry.
  if (video.preload !== 'auto') {
    video.preload = 'auto'
    video.load()
  }
  // Los videos ya visitados conservan src. Aun así deben reproducirse de
  // nuevo al seleccionarlos o cuando el carrusel completa su vuelta.
  void video.play().catch(() => undefined)
}


// Se mantienen decodificados mientras el cliente cambia entre pestañas.
const profileBackgroundImages = new Map<string, HTMLImageElement>()
const publicMenuImageWarmups = new Map<string, HTMLImageElement>()

function getImageWarmupRootMargin() {
  const connection = (navigator as Navigator & {
    connection?: { effectiveType?: string; saveData?: boolean }
  }).connection
  const slowConnection = connection?.saveData
    || ['slow-2g', '2g', '3g'].includes(connection?.effectiveType || '')
  return `${slowConnection ? 320 : 800}px 0px`
}

function warmPublicMenuImages(products: Product[]) {
  const productSources = products
    .map(product => optimizedProductImage(product.imageUrl))
    .filter((source): source is string => Boolean(source))
  const previewSources = productSources
    .map(source => previewImageSource(source))
    .filter((source): source is string => Boolean(source))
  // Solo precarga las primeras seis miniaturas del catálogo. Calentar todos
  // los productos, perfiles, reels y fondos al abrir Pedir competía con el
  // contenido visible, sobre todo en 3G y conexiones con ahorro de datos.
  const sources = [...new Set(previewSources.slice(0, 6))]

  // Las miniaturas caben en una descarga ligera y evitan tarjetas negras al
  // cambiar de pestaña o recorrer categorías. La versión completa se sigue
  // actualizando cerca de pantalla para no competir con el primer render.
  let nextIndex = 0
  let active = 0
  const maxConcurrent = 3
  const loadNext = () => {
    while (active < maxConcurrent && nextIndex < sources.length) {
      const source = sources[nextIndex++]
      if (publicMenuImageWarmups.has(source)) continue
      const image = new Image()
      image.decoding = 'async'
      image.fetchPriority = 'low'
      publicMenuImageWarmups.set(source, image)
      active += 1
      let finished = false
      const finish = () => {
        if (finished) return
        finished = true
        active -= 1
        loadNext()
      }
      image.onload = () => { void image.decode().catch(() => undefined).finally(finish) }
      image.onerror = () => { publicMenuImageWarmups.delete(source); finish() }
      image.src = source
      if (image.complete) {
        if (image.naturalWidth > 0) void image.decode().catch(() => undefined).finally(finish)
        else { publicMenuImageWarmups.delete(source); finish() }
      }
    }
  }
  loadNext()
}

const PUBLIC_CATALOG_REQUEST_TTL_MS = 15_000
let publicCatalogRequestId = 0
let publicCatalogRequest: { id: number; startedAt: number; promise: Promise<Product[]> } | null = null

function getPublicCatalogWithRetry(forceRefresh = false): Promise<Product[]> {
  const now = Date.now()
  if (!forceRefresh && publicCatalogRequest && now - publicCatalogRequest.startedAt < PUBLIC_CATALOG_REQUEST_TTL_MS) {
    return publicCatalogRequest.promise
  }

  const startedAt = now
  const requestId = ++publicCatalogRequestId
  const request = (async () => {
    try {
      return await getPublicCatalog()
    } catch (error) {
      const status = error && typeof error === 'object' && 'status' in error
        ? Number((error as { status: unknown }).status)
        : null
      const missingClient = error instanceof Error && error.message === 'El menú no está disponible en este momento'
      if (missingClient || (status !== null && status > 0 && status < 500 && status !== 429)) throw error

      await new Promise(resolve => window.setTimeout(resolve, 900))
      return getPublicCatalog()
    }
  })().catch(error => {
    if (publicCatalogRequest?.id === requestId) publicCatalogRequest = null
    throw error
  })
  publicCatalogRequest = { id: requestId, startedAt, promise: request }
  return request
}

function warmProfileBackgroundImages(prioritizeAuth = false) {
  const desktop = window.matchMedia('(min-width: 1280px), (min-width: 900px) and (orientation: landscape)').matches
  const suffix = desktop ? 'desktop' : 'phone'
  const sources = [
    `/optimized/customer-profile/login-${suffix}.webp`,
    `/optimized/customer-profile/register-${suffix}.webp`,
    '/optimized/customer-profile/profile-bg.webp',
    '/optimized/customer-profile/profile-desktop-quiet.webp',
    '/optimized/customer-profile/loyalty-bg.webp',
    '/optimized/customer-profile/welcome-card-bg.webp',
  ]

  sources.forEach(source => {
    const isAuthBackground = source.includes('/login-') || source.includes('/register-')
    const existing = profileBackgroundImages.get(source)
    if (existing) {
      if (prioritizeAuth && isAuthBackground) existing.fetchPriority = 'high'
      return
    }
    const image = new Image()
    image.fetchPriority = prioritizeAuth && isAuthBackground ? 'high' : 'low'
    profileBackgroundImages.set(source, image)
    image.src = source
    void image.decode().catch(() => {
      // El fondo CSS seguirá intentando cargarlo si esta solicitud falla.
      profileBackgroundImages.delete(source)
    })
  })
}


function prepareCatalog(catalog: Product[]) {
  const resolveCategory = (product: { name: string; category: string }) =>
    product.category !== 'otros' && isKnownCategory(product.category)
      ? product.category
      : classifyMenuCategory(product.name, product.category)

  return catalog.map(product => {
    const primary = resolveCategory(product)
    const extras = (product.categories ?? []).filter(category => category !== product.category)
    const categories = Array.from(new Set([primary, ...extras]))
    const isBeverage = categories.includes('bebidas')
    return { ...product, category: primary, categories, allowProteinExtras: product.allowProteinExtras ?? !isBeverage }
  }).sort((a, b) => {
    const categoryDelta = menuCategoryRank(a.category) - menuCategoryRank(b.category)
    return categoryDelta || menuItemRank(a.name, a.category) - menuItemRank(b.name, b.category)
  })
}

// The public entry uses this route-level hook to share the catalog request before React mounts.
// eslint-disable-next-line react-refresh/only-export-components
export async function preloadPublicMenuCatalog() {
  const cached = readCatalogCache()
  const request = getPublicCatalogWithRetry()

  try {
    const catalog = await request
    if (publicCatalogRequest?.promise !== request) return
    saveCatalogCache(prepareCatalog(catalog), cached?.categories ?? [])
  } catch {
    // La carta repetirá la consulta al abrirse y mostrará su propio estado de carga.
  }
}

export function PublicMenu() {
  useEffect(() => {
    window.dispatchEvent(new Event('fullchina:public-menu-ready'))
  }, [])
  useEffect(() => {
    startPublicMenuDataChangeFeed()
    return stopPublicMenuDataChangeFeed
  }, [])

  const pageRef = useRef<HTMLElement>(null)
  const imageWarmupObserverRef = useRef<IntersectionObserver | null>(null)
  const fullImageRequestsRef = useRef(new WeakMap<HTMLImageElement, string>())
  const isDesktopViewport = typeof window.matchMedia === 'function' && window.matchMedia(DESKTOP_MEDIA_QUERY).matches
  const initialCatalog = useMemo(() => {
    if (PREVIEW_LOADING) return null
    const cached = readCatalogCache()
    if (cached?.categories.length) hydrateMenuCategories(cached.categories)
    return cached
  }, [])
  const [products, setProducts] = useState<Product[]>(() => initialCatalog?.products.filter(product => !product.categories.includes('extras')) ?? [])
  const [extrasProducts, setExtrasProducts] = useState<Product[]>(() => initialCatalog?.products.filter(product => product.categories.includes('extras')) ?? [])
  // Los extras de catálogo siguen disponibles desde sus propias tarjetas;
  // el configurador de platos solo muestra modificadores asociados al producto.
  const [cart, setCart] = useState<WebOrderCartItem[]>(() => {
    try { return JSON.parse(localStorage.getItem(CART_KEY) || '[]') as WebOrderCartItem[] } catch { return [] }
  })
  const cartRef = useRef(cart)
  useEffect(() => { cartRef.current = cart }, [cart])
  const commitCart = (update: WebOrderCartItem[] | ((current: WebOrderCartItem[]) => WebOrderCartItem[])) => {
    const next = typeof update === 'function' ? update(cartRef.current) : update
    cartRef.current = next
    setCart(next)
  }
  const [selectedGroup, setSelectedGroup] = useState<MenuProductGroup | null>(null)
  const [closingDetail, setClosingDetail] = useState(false)
  const [detailOrigin, setDetailOrigin] = useState<{ x: number; y: number } | null>(null)
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(null)
  const [quickVariantGroup, setQuickVariantGroup] = useState<MenuProductGroup | null>(null)
  const [quickVariantId, setQuickVariantId] = useState<string | null>(null)
  const [quickVariantHasModifiers, setQuickVariantHasModifiers] = useState(false)
  const [quickVariantOptionsLabel, setQuickVariantOptionsLabel] = useState('Ver opciones')
  const [quickVariantProteinGroup, setQuickVariantProteinGroup] = useState<ProductModifierGroup | null>(null)
  const [quickVariantProteinSelection, setQuickVariantProteinSelection] = useState<Record<string, number>>({})
  const [quickVariantProteinDraft, setQuickVariantProteinDraft] = useState<Record<string, number>>({})
  const [quickProteinDialogOpen, setQuickProteinDialogOpen] = useState(false)
  const [quickVariantQuantity, setQuickVariantQuantity] = useState(1)
  const [closingQuickVariant, setClosingQuickVariant] = useState(false)
  const [detailQuantity, setDetailQuantity] = useState(1)
  const [detailNotes, setDetailNotes] = useState('')
  const detailNotesRef = useRef<HTMLTextAreaElement>(null)
  const [detailModifierGroups, setDetailModifierGroups] = useState<ProductModifierGroup[]>([])
  const [loadingModifiers, setLoadingModifiers] = useState(false)
  const [modifierLoadError, setModifierLoadError] = useState(false)
  const [modifierValidationError, setModifierValidationError] = useState('')
  const [showModifierGuidance, setShowModifierGuidance] = useState(true)
  const [selectedExtras, setSelectedExtras] = useState<Record<string, number>>({})
  const [selectedCatalogExtras, setSelectedCatalogExtras] = useState<Record<string, number>>({})
  useEffect(() => {
    const textarea = detailNotesRef.current
    if (!textarea) return
    textarea.style.height = 'auto'
    textarea.style.height = `${Math.max(textarea.scrollHeight, 58)}px`
  }, [detailNotes, selectedGroup])
  const requiredModifierRef = useRef<HTMLDivElement>(null)
  const [activeCategory, setActiveCategory] = useState('Todos')
  const [scrollCategory, setScrollCategory] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [favoriteIds, setFavoriteIds] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem(FAVORITES_KEY) || '[]') as string[] } catch { return [] }
  })
  const favoriteIdsRef = useRef(favoriteIds)
  const remoteFavoriteSyncRef = useRef(false)
  const [favoriteAccountId, setFavoriteAccountId] = useState<string | null>(null)
  const [favoriteStorageMode, setFavoriteStorageMode] = useState<'loading' | 'guest' | 'account'>(customerSupabase ? 'loading' : 'guest')
  const [favoriteSyncReady, setFavoriteSyncReady] = useState(false)
  const favoriteSyncSequence = useRef(0)
  const [showFavorites, setShowFavorites] = useState(false)
  const [showAllExtras, setShowAllExtras] = useState(false)
  const [showStoreClosedNotice, setShowStoreClosedNotice] = useState(() => {
    const showPreviewNotice = import.meta.env.DEV
      && new URLSearchParams(window.location.search).get('showClosedNotice') === '1'
    return showPreviewNotice
  })
  const [showWelcomeNotice, setShowWelcomeNotice] = useState(() => {
    return !consumePublicMenuWelcomeDismissal()
  })
  const [dontShowWelcomeAgain, setDontShowWelcomeAgain] = useState(false)
  const [closingWelcomeNotice, setClosingWelcomeNotice] = useState(false)
  const welcomeNoticeButtonRef = useRef<HTMLButtonElement>(null)
  const welcomeCloseTimeoutRef = useRef<number | null>(null)
  const dismissWelcomeNotice = useCallback(() => {
    if (closingWelcomeNotice) return
    if (dontShowWelcomeAgain) {
      try { localStorage.setItem(PUBLIC_MENU_WELCOME_DISMISSED_KEY, 'true') } catch { /* la bienvenida se cierra aunque el navegador bloquee el almacenamiento */ }
    }
    setClosingWelcomeNotice(true)
    const duration = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 220
    welcomeCloseTimeoutRef.current = window.setTimeout(() => {
      setShowWelcomeNotice(false)
      setClosingWelcomeNotice(false)
      welcomeCloseTimeoutRef.current = null
    }, duration)
  }, [closingWelcomeNotice, dontShowWelcomeAgain])
  const dismissWelcomeNoticeRef = useRef(dismissWelcomeNotice)
  dismissWelcomeNoticeRef.current = dismissWelcomeNotice
  const storeClosedNoticeButtonRef = useRef<HTMLButtonElement>(null)
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
  const [step, setStep] = useState<CheckoutStep>('cart')
  const [returnToConfirmAfterEdit, setReturnToConfirmAfterEdit] = useState(false)
  const [editingCartLineKey, setEditingCartLineKey] = useState<string | null>(null)

  // Cada paso reaparece desde el inicio de su contenido. Es especialmente
  // importante al volver a "Tu pedido", cuyo alto puede superar el panel.
  useLayoutEffect(() => {
    if (!cartOpen) return
    const drawer = document.querySelector<HTMLElement>('.public-cart-drawer')
    drawer?.scrollTo({ top: 0, left: 0, behavior: 'auto' })
    drawer?.querySelector<HTMLElement>(
      '.public-review-page, .public-delivery-step, .public-pickup-step, .public-address-step, .public-checkout, .public-confirm-page, .public-preparing-page, .public-success, .public-track',
    )?.scrollTo({ top: 0, left: 0, behavior: 'auto' })
  }, [cartOpen, step])

  // En escritorio, el contenido del checkout tiene su propio scroll y la
  // página conserva el suyo fuera de la tarjeta. En móvil sí se bloquea el fondo.
  const desktopCheckoutCanScrollPage = typeof window !== 'undefined'
    && window.matchMedia('(min-width: 900px) and (orientation: landscape)').matches
  const hasBlockingOverlay = Boolean(
    quickVariantGroup
    || selectedGroup
    || (cartOpen && !desktopCheckoutCanScrollPage)
    || showAllExtras
    || showStoreClosedNotice
    || showWelcomeNotice
  )
  useEffect(() => {
    const root = document.documentElement
    const body = document.body

    if (!hasBlockingOverlay) return

    const previousRootOverflow = root.style.overflow
    const previousRootOverscroll = root.style.overscrollBehavior
    const previousBodyOverflow = body.style.overflow
    const previousBodyOverscroll = body.style.overscrollBehavior
    const previousBodyPaddingRight = body.style.paddingRight
    const previousBodyPosition = body.style.position
    const previousBodyTop = body.style.top
    const previousBodyLeft = body.style.left
    const previousBodyRight = body.style.right
    const previousBodyWidth = body.style.width
    const scrollX = window.scrollX
    const scrollY = window.scrollY
    const scrollbarWidth = window.innerWidth - root.clientWidth
    // Fijar todo el body evita saltos de scroll en navegadores móviles, pero
    // en escritorio rompe el contexto que usa position: sticky en el carrito.
    const pinBodyToViewport = window.matchMedia('(max-width: 767px)').matches

    root.style.overflow = 'hidden'
    root.style.overscrollBehavior = 'none'
    body.style.overflow = 'hidden'
    body.style.overscrollBehavior = 'none'
    if (pinBodyToViewport) {
      body.style.position = 'fixed'
      body.style.top = `${-scrollY}px`
      body.style.left = `${-scrollX}px`
      body.style.right = '0'
      body.style.width = '100%'
    }
    if (scrollbarWidth > 0) body.style.paddingRight = `${scrollbarWidth}px`

    return () => {
      root.style.overflow = previousRootOverflow
      root.style.overscrollBehavior = previousRootOverscroll
      body.style.overflow = previousBodyOverflow
      body.style.overscrollBehavior = previousBodyOverscroll
      body.style.paddingRight = previousBodyPaddingRight
      body.style.position = previousBodyPosition
      body.style.top = previousBodyTop
      body.style.left = previousBodyLeft
      body.style.right = previousBodyRight
      body.style.width = previousBodyWidth
      window.scrollTo(scrollX, scrollY)
    }
  }, [hasBlockingOverlay])

  useEffect(() => {
    if (!showStoreClosedNotice || showWelcomeNotice) return
    storeClosedNoticeButtonRef.current?.focus()
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setShowStoreClosedNotice(false)
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [showStoreClosedNotice, showWelcomeNotice])

  useEffect(() => {
    if (!showWelcomeNotice) return
    welcomeNoticeButtonRef.current?.focus()
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') dismissWelcomeNoticeRef.current()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [showWelcomeNotice])

  useEffect(() => () => {
    if (welcomeCloseTimeoutRef.current !== null) window.clearTimeout(welcomeCloseTimeoutRef.current)
  }, [])

  const previousStepRef = useRef(step)
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [identification, setIdentification] = useState('')
  const [idPrefix, setIdPrefix] = useState<'V' | 'E' | 'J'>('V')
  const [customerDetailsAutofilled, setCustomerDetailsAutofilled] = useState(false)
  const customerDetailsTouched = useRef(false)
  const [orderType, setOrderType] = useState<'takeaway' | 'delivery'>('takeaway')
  const [pickupTime, setPickupTime] = useState<string>('asap')
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
  const [locationError, setLocationError] = useState('')
  const [addressMethod, setAddressMethod] = useState<'gps' | 'map' | 'search' | null>(null)
  const [addressFieldError, setAddressFieldError] = useState<'' | 'address' | 'geo' | 'reference'>('')
  const addressRef = useRef<HTMLInputElement>(null)
  const locationErrorRef = useRef<HTMLDivElement>(null)
  const referenceRef = useRef<HTMLInputElement>(null)
  const addressSelectedRef = useRef<HTMLDivElement>(null)
  const addressSearchTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const addressActionRef = useRef(0)
  useEffect(() => {
    if (!locationError) return
    const timeout = window.setTimeout(() => {
      if (typeof locationErrorRef.current?.scrollIntoView === 'function') {
        locationErrorRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
      }
    }, 0)
    return () => window.clearTimeout(timeout)
  }, [locationError])
  // Notas para la cocina (paso datos) y para el repartidor (paso dirección): campos separados.
  const [notes, setNotes] = useState('')
  const [deliveryNotes, setDeliveryNotes] = useState('')
  const [bcvRate, setBcvRate] = useState<number | null>(null)
  const [deliverySettings, setDeliverySettings] = useState<DeliverySettings | null>(null)
  const [deliverySettingsStatus, setDeliverySettingsStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle')
  const [deliverySettingsRetryVersion, setDeliverySettingsRetryVersion] = useState(0)
  const [deliveryEstimate, setDeliveryEstimate] = useState<DeliveryEstimate | null>(null)
  const [deliveryQuoteStatus, setDeliveryQuoteStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle')
  const [deliveryRetryVersion, setDeliveryRetryVersion] = useState(0)
  const [deliveryRoute, setDeliveryRoute] = useState<DeliveryRoute | null>(null)
  const [serverDeliveryFeeOverride, setServerDeliveryFeeOverride] = useState<{ lat: number; lng: number; fee: number } | null>(null)
  const deliveryDestinationLat = geoCoords?.lat
  const deliveryDestinationLng = geoCoords?.lng
  useEffect(() => {
    if (orderType !== 'delivery' || deliveryDestinationLat == null || deliveryDestinationLng == null || !deliverySettings) {
      setDeliveryEstimate(null)
      setDeliveryQuoteStatus('idle')
      setDeliveryRoute(null)
      return
    }
    const destination = { lat: deliveryDestinationLat, lng: deliveryDestinationLng }
    const origin = deliverySettings.originLat != null && deliverySettings.originLng != null
      ? { lat: deliverySettings.originLat, lng: deliverySettings.originLng }
      : null
    let active = true
    setDeliveryEstimate(null)
    setDeliveryQuoteStatus('loading')
    setDeliveryRoute(null)
    // La tarifa usa la misma regla que fn_create_web_order (distancia en línea
    // recta × factor de carretera) para que el total mostrado sea el que se
    // cobra. La ruta OSRM solo se dibuja en el mapa como referencia.
    const estimate = estimateDelivery(deliverySettings, destination.lat, destination.lng)
    setDeliveryEstimate(estimate)
    setDeliveryQuoteStatus(estimate ? 'ready' : 'error')
    if (origin) {
      void getDeliveryRoute(origin, destination)
        .then(route => {
          if (!active) return
          setDeliveryRoute(route)
        })
        .catch(() => { if (active) setDeliveryRoute(null) })
    }
    return () => { active = false }
  }, [orderType, deliveryDestinationLat, deliveryDestinationLng, deliverySettings, deliveryRetryVersion])
  const deliveryCoverageUnavailable = orderType === 'delivery'
    && Boolean(geoCoords)
    && deliverySettingsStatus === 'ready'
    && deliveryQuoteStatus === 'ready'
    && (!deliverySettings?.enabled || deliveryEstimate?.fee == null)
  const readableAddress = address.replace(/^[23456789CFGHJMPQRVWX]{4,8}\+[23456789CFGHJMPQRVWX]{2,3},\s*/i, '').trim() || (address ? 'Ubicación marcada en el mapa' : '')
  const [loading, setLoading] = useState(() => !initialCatalog)
  const [catalogRetryVersion, setCatalogRetryVersion] = useState(0)
  const retryPublicCatalog = () => {
    setLoading(true)
    setCatalogRetryVersion(version => version + 1)
  }
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
  // Al pulsar Continuar/Revisar/Confirmar con un dato faltante, llevar al
  // cliente a ese campo cada vez que lo intenta. Los avisos que aparecen al
  // salir de un campo (onBlur) no mueven la vista ni roban el cursor.
  const [revealRequest, setRevealRequest] = useState<{ field: 'name' | 'phone' | 'identification' | 'address' | 'geo' | 'reference'; id: number } | null>(null)
  const showFieldError = (field: 'name' | 'phone' | 'identification') => {
    setFieldError(field)
    setRevealRequest(current => ({ field, id: (current?.id ?? 0) + 1 }))
  }
  const showAddressFieldError = (field: 'address' | 'geo' | 'reference') => {
    setAddressFieldError(field)
    setRevealRequest(current => ({ field, id: (current?.id ?? 0) + 1 }))
  }
  useEffect(() => {
    if (!revealRequest) return
    const { field } = revealRequest
    const frame = window.requestAnimationFrame(() => {
      const target = field === 'name' ? nameRef.current
        : field === 'phone' ? phoneRef.current
          : field === 'identification' ? identificationRef.current
            : field === 'reference' ? referenceRef.current
              : field === 'address' ? addressRef.current
                : addressSelectedRef.current
      revealCheckoutField(target, field !== 'geo')
    })
    return () => window.cancelAnimationFrame(frame)
  }, [revealRequest])
  const [cartGuardMessage, setCartGuardMessage] = useState('')
  const [cartGuardClosing, setCartGuardClosing] = useState(false)
  const restoringFlow = useRef(true)
  const [orderCode, setOrderCode] = useState('')
  const [localTestOrderLinkedToProfile, setLocalTestOrderLinkedToProfile] = useState(false)
  const [addFeedback, setAddFeedback] = useState<{ name: string; imageUrl?: string; productId: string; status: 'checking' | 'added' } | null>(null)
  const [addFeedbackClosing, setAddFeedbackClosing] = useState(false)
  const [pendingQuickAdds, setPendingQuickAdds] = useState<Set<string>>(() => new Set())
  const [addingSelectedProduct, setAddingSelectedProduct] = useState(false)
  const [cartPulse, setCartPulse] = useState(false)
  const sidebarCardRef = useRef<HTMLDivElement>(null)
  const [sidebarHasOverflow, setSidebarHasOverflow] = useState(false)
  const [recommendedIndex, setRecommendedIndex] = useState(0)
  const [desktopHeroSlide, setDesktopHeroSlide] = useState(0)
  const [desktopHeroPaused, setDesktopHeroPaused] = useState(false)
  const [requestedRecommendedIndex, setRequestedRecommendedIndex] = useState<number | null>(null)
  const [recommendedImageSrc, setRecommendedImageSrc] = useState('/optimized/fondos/hero-banner-food.webp')
  const [pageSettings, setPageSettings] = useState<PublicOrderPageSettings>(DEFAULT_PUBLIC_ORDER_PAGE_SETTINGS)
  const [pageSettingsLoaded, setPageSettingsLoaded] = useState(false)
  const currentInstagramReels = pageSettings.contactReels.length ? pageSettings.contactReels : DEFAULT_PUBLIC_ORDER_REELS
  const publicWhatsappPhone = (pageSettings.contactWhatsapp || PUBLIC_WHATSAPP_PHONE).replace(/\D/g, '')
  const publicInstagramUrl = pageSettings.contactInstagramUrl || DEFAULT_INSTAGRAM_PROFILE_URL
  const publicFacebookUrl = pageSettings.contactFacebookUrl
  const formattedOpenTime = formatStoreTime(pageSettings.contactOpenTime)
  const formattedCloseTime = formatStoreTime(pageSettings.contactCloseTime)
  const storeScheduleLabel = formatStoreSchedule(pageSettings)
  const mapPreviewUrl = getPublicOrderMapEmbedUrl(pageSettings.contactDirectionsUrl, pageSettings.contactAddress)
  const refreshPublicPageSettings = useCallback(async () => {
    setPageSettings(await getPublicOrderPageSettings())
    setPageSettingsLoaded(true)
  }, [])
  useEffect(() => { void refreshPublicPageSettings().catch(() => setPageSettingsLoaded(true)) }, [refreshPublicPageSettings])
  const refreshPublicMenuData = useCallback(async () => {
    // These modifier groups are cached separately from Supabase's response
    // cache. A feed event bypasses that first cache, so clear this one before
    // rebuilding the active catalogue and its selected product details.
    PUBLIC_MODIFIER_CACHE.clear()
    const detailsRequestId = modifierRequestRef.current
    const [catalogResult, settingsResult, categoriesResult] = await Promise.allSettled([
      getPublicCatalogWithRetry(true),
      getPublicOrderPageSettings(),
      getPublicMenuCategories(),
    ])

    if (settingsResult.status === 'fulfilled') {
      setPageSettings(settingsResult.value)
      setPageSettingsLoaded(true)
    }
    if (catalogResult.status === 'fulfilled') {
      const resolved = prepareCatalog(catalogResult.value)
      const categories = categoriesResult.status === 'fulfilled' && categoriesResult.value.length
        ? categoriesResult.value
        : initialCatalog?.categories ?? []
      if (categories.length) hydrateMenuCategories(categories)
      saveCatalogCache(resolved, categories)
      setExtrasProducts(resolved.filter(product => product.categories.includes('extras')))
      setProducts(resolved.filter(product => !product.categories.includes('extras')))
      setError('')

      if (selectedGroup) {
        const updatedGroup = groupMenuProducts(resolved).find(group => group.key === selectedGroup.key)
        if (updatedGroup) setSelectedGroup(updatedGroup)
      }
      if (selectedGroup && selectedVariantId && resolved.some(product => product.id === selectedVariantId)) {
        try {
          const remoteGroups = await getPublicProductModifiers(selectedVariantId)
          PUBLIC_MODIFIER_CACHE.set(selectedVariantId, remoteGroups)
          if (modifierRequestRef.current === detailsRequestId) {
            const product = resolved.find(item => item.id === selectedVariantId)
            const prepared = filterProteinExtraGroups(remoteGroups, product?.allowProteinExtras !== false)
              .filter(group => group.options.length > 0 || group.minSelections > 0)
            setDetailModifierGroups(prepared)
            const validOptionIds = new Set(prepared.flatMap(group => group.options.map(option => option.id)))
            setSelectedExtras(previous => Object.fromEntries(Object.entries(previous).filter(([optionId]) => validOptionIds.has(optionId))))
          }
        } catch {
          // El menú y el pedido siguen disponibles aunque fallen los modificadores.
        }
      }
    }

    if (orderType === 'delivery') {
      try { setDeliverySettings(await getPublicDeliverySettings()); setDeliverySettingsStatus('ready') }
      catch { setDeliverySettingsStatus('error') }
    }
  }, [initialCatalog?.categories, orderType, selectedGroup, selectedVariantId])
  useLiveDataRefresh('pagina-pedir', refreshPublicMenuData)
  const loadedRecommendedImageKey = useRef<string | null>(null)
  const [recommendedPaused, setRecommendedPaused] = useState(false)
  const recommendedTimer = useRef<ReturnType<typeof setInterval> | null>(null)
  const recommendedResumeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const recommendedSwipeStart = useRef<number | null>(null)
  const recommendedWasSwiped = useRef(false)
  const recommendedWheelDelta = useRef(0)
  const recommendedWheelLocked = useRef(false)
  const recommendedWheelUnlockTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [sidebarRecoIndex, setSidebarRecoIndex] = useState(0)
  const [instagramActiveIndex, setInstagramActiveIndex] = useState(0)
  const [instagramAudioEnabled, setInstagramAudioEnabled] = useState(false)
  const [instagramPlaybackStarted, setInstagramPlaybackStarted] = useState(false)
  const [instagramDesktopPlaybackConfirmed, setInstagramDesktopPlaybackConfirmed] = useState(false)
  const [instagramPaused, setInstagramPaused] = useState(false)
  const instagramReels = useMemo(() => instagramReelOrder(currentInstagramReels, instagramActiveIndex), [currentInstagramReels, instagramActiveIndex])
  const sidebarRecoTimer = useRef<ReturnType<typeof setInterval> | null>(null)
  const addFeedbackTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const addFeedbackExitTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pendingQuickAddsRef = useRef(new Set<string>())
  const addingSelectedProductRef = useRef(false)
  const quickVariantConfirmRef = useRef(false)
  const [confirmingQuickVariant, setConfirmingQuickVariant] = useState(false)
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
  // Resumen que se muestra en 'sent' aunque el carrito ya se haya vaciado.
  const [sentSummary, setSentSummary] = useState<{ items: WebOrderCartItem[]; total: number; orderType: 'takeaway' | 'delivery'; address: string; phone: string } | null>(null)
  const [, setLastOrder] = useState<WebOrderCartItem[]>(() => {
    try { return JSON.parse(localStorage.getItem(LAST_ORDER_KEY) || '[]') as WebOrderCartItem[] } catch { return [] }
  })
  const [currentTab, setCurrentTab] = useState<DesktopTab>(readDesktopTab)
  const [hasVisitedProfile, setHasVisitedProfile] = useState(() => readDesktopTab() === 'perfil')
  const [hasLeftMobileMenu, setHasLeftMobileMenu] = useState(() => {
    const savedTab = readDesktopTab()
    return savedTab === 'perfil' || savedTab === 'contacto'
  })
  const openCustomerProfile = () => {
    preloadCustomerLoyaltyProfile()
    warmProfileBackgroundImages(true)
    setHasLeftMobileMenu(true)
    setHasVisitedProfile(true)
    setCurrentTab('perfil')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  // Mientras llegan los datos de un cliente con sesión, sus campos muestran el
  // brillo de carga en vez de verse vacíos. Los invitados no lo ven.
  const [autofillingDetails, setAutofillingDetails] = useState(false)
  const autofillCustomerOrderDetails = useCallback(async () => {
    if (customerDetailsTouched.current) return
    let showedSkeleton = false
    try {
      if (customerSupabase) {
        const { data: sessionData } = await customerSupabase.auth.getSession()
        if (sessionData.session && !customerDetailsTouched.current) {
          showedSkeleton = true
          setAutofillingDetails(true)
        }
      }
      const customer = await getCustomerOrderProfile()
      if (!customer || customerDetailsTouched.current) return
      if (customer.fullName || customer.phone || customer.identification) setCustomerDetailsAutofilled(true)
      setName(current => current || customer.fullName)
      setPhone(current => current || customer.phone)
      const prefix = customer.identification.trim().match(/^([VEJ])\s*-/i)?.[1]?.toUpperCase()
      if (prefix === 'V' || prefix === 'E' || prefix === 'J') setIdPrefix(prefix)
      setIdentification(current => current || customer.identification)
    } catch {
      // El pedido sigue disponible si el RPC de perfil aún no está actualizado o la red falla.
    } finally {
      if (showedSkeleton) setAutofillingDetails(false)
    }
  }, [])

  useEffect(() => {
    void autofillCustomerOrderDetails()
    if (!customerSupabase) return
    const { data } = customerSupabase.auth.onAuthStateChange((event, session) => {
      if (session && (event === 'SIGNED_IN' || event === 'INITIAL_SESSION' || event === 'TOKEN_REFRESHED')) {
        window.setTimeout(() => { void autofillCustomerOrderDetails() }, 0)
      }
    })
    return () => data.subscription.unsubscribe()
  }, [autofillCustomerOrderDetails])

  useEffect(() => {
    if (step === 'details') void autofillCustomerOrderDetails()
  }, [autofillCustomerOrderDetails, step])

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

  const startFullImageUpgrade = (image: HTMLImageElement, fullSource: string) => {
    if (fullImageRequestsRef.current.get(image) === fullSource) return
    fullImageRequestsRef.current.set(image, fullSource)
    image.dataset.imageQuality = 'loading-full'

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
    fullImage.onerror = () => {
      if (image.dataset.fullSrc !== fullSource) return
      image.dataset.imageQuality = 'preview'
      fullImageRequestsRef.current.delete(image)
    }
  }

  const prepareImage = (image: HTMLImageElement) => {
    const domSource = image.getAttribute('src') || ''
    const trackedSource = image.dataset.fullSrc

    if (trackedSource && ['preview', 'loading-full'].includes(image.dataset.imageQuality || '') && domSource === image.dataset.previewSrc) {
      if (image.loading === 'eager') startFullImageUpgrade(image, trackedSource)
      return
    }
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
    if (image.loading === 'lazy' && imageWarmupObserverRef.current) imageWarmupObserverRef.current.observe(image)
    else startFullImageUpgrade(image, fullSource)
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
      // El banner tiene su propia precarga/decodificación antes de cambiar
      // de producto. No debe entrar al swap global de preview: ese flujo
      // oculta el <img> al cambiar src y deja ver el fondo oscuro un instante.
      if (image.classList.contains('public-recommended-img')) return
      const source = image.currentSrc || image.src
      const decodedFullUpgrade = image.dataset.imageQuality === 'full'
        && image.dataset.fullSrc === image.getAttribute('src')
        && image.classList.contains('public-image-ready')
      if (!decodedFullUpgrade && image.dataset.revealedSrc !== source) image.classList.remove('public-image-ready', 'public-image-error')
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
    const warmupObserver = typeof IntersectionObserver === 'undefined'
      ? null
      : new IntersectionObserver(entries => {
        entries.forEach(entry => {
          if (!entry.isIntersecting || !(entry.target instanceof HTMLImageElement)) return
          const image = entry.target
          warmupObserver?.unobserve(image)
          // Dos pantallas de anticipación dejan que la foto esté lista antes
          // de que el usuario llegue a su categoría, sin pedir todo el menú a la vez.
          image.loading = 'eager'
          const fullSource = image.dataset.fullSrc
          if (fullSource) startFullImageUpgrade(image, fullSource)
        })
      }, { rootMargin: getImageWarmupRootMargin() })
    imageWarmupObserverRef.current = warmupObserver
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
    return () => {
      observer.disconnect()
      warmupObserver?.disconnect()
      if (imageWarmupObserverRef.current === warmupObserver) imageWarmupObserverRef.current = null
    }
  }, [])

  useEffect(() => {
    try { localStorage.setItem(DESKTOP_TAB_KEY, currentTab) } catch { /* storage unavailable */ }
  }, [currentTab])

  useEffect(() => {
    let active = true
    let secondaryTimer: number | null = null

    // Solo el catálogo es crítico para pintar el menú. Las categorías, la tasa
    // y delivery llegan después para que una respuesta lenta no mantenga al
    // cliente mirando la pantalla de carga.
    const catalogPromise = getPublicCatalogWithRetry()
      .then(catalog => {
        if (PREVIEW_LOADING) {
          window.__removeFCSplash?.()
          return null
        }
        const resolved = prepareCatalog(catalog)
        if (!active) return resolved
        saveCatalogCache(resolved, initialCatalog?.categories ?? [])
        window.setTimeout(() => warmPublicMenuImages(resolved), 250)
        setExtrasProducts(resolved.filter(product => product.categories.includes('extras')))
        setProducts(resolved.filter(p => !p.categories.includes('extras')))
        setError('')
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
  }, [catalogRetryVersion, initialCatalog])

  useEffect(() => {
    if (!loading) {
      window.__removeFCSplash?.()
    }
  }, [loading])

  useEffect(() => {
    if (initialCatalog) {
      const menuImageTimer = window.setTimeout(() => warmPublicMenuImages(initialCatalog.products), 250)
      return () => {
        window.clearTimeout(menuImageTimer)
      }
    }
    return undefined
  }, [initialCatalog])

  // Delivery solo se necesita cuando el cliente escoge esa modalidad. No
  // descargues zonas y coordenadas en cada visita al menú: en conexiones
  // móviles esa RPC competía con el catálogo aunque el cliente fuera a
  // retirar el pedido en el local.
  useEffect(() => {
    if (orderType !== 'delivery' || deliverySettings) return
    let active = true
    setDeliverySettingsStatus('loading')
    getPublicDeliverySettings()
      .then(settings => { if (active) { setDeliverySettings(settings); setDeliverySettingsStatus('ready') } })
      .catch(() => { if (active) { setDeliverySettings(null); setDeliverySettingsStatus('error') } })
    return () => { active = false }
  }, [orderType, deliverySettings, deliverySettingsRetryVersion])

  // El delivery se desactiva si la configuración pública lo tiene apagado.
  const deliveryDisabled = deliverySettingsStatus === 'ready' && deliverySettings?.enabled === false
  useEffect(() => {
    if (!deliveryDisabled || orderType !== 'delivery') return
    addressActionRef.current += 1
    setLocating(false)
    setOrderType('takeaway')
    setStep(current => current === 'address' ? 'delivery' : current)
  }, [deliveryDisabled, orderType])

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
  useEffect(() => {
    if (homeSearchTerm.length >= 2) {
      setDesktopHeroSlide(0)
      return
    }
    if (currentTab !== 'inicio' || desktopHeroPaused || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const timer = window.setInterval(() => setDesktopHeroSlide(slide => (slide + 1) % 2), 3000)
    return () => window.clearInterval(timer)
  }, [currentTab, desktopHeroPaused, homeSearchTerm])
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

  // Warm only the selected reel's metadata while Contact is visible. That
  // resolves duration/container headers without autoplaying or downloading
  // the other five videos; full buffering starts only after an explicit tap.
  useEffect(() => {
    if (currentTab !== 'contacto') return
    const timer = window.setTimeout(() => {
      const videos = Array.from(document.querySelectorAll<HTMLVideoElement>('.public-instagram-reel video'))
      videos.forEach(video => {
        const playbackStarted = video.closest('.public-instagram-desktop-reel') ? instagramDesktopPlaybackConfirmed : instagramPlaybackStarted
        video.muted = !instagramAudioEnabled
        if (video.dataset.active === 'true' && video.offsetParent !== null && playbackStarted && !instagramPaused) startInstagramVideo(video)
        else if (video.dataset.active === 'true' && video.offsetParent !== null) {
          video.pause()
          video.preload = 'metadata'
          if (!video.src) {
            const source = video.dataset.src || video.querySelector('source')?.dataset.src
            if (source) {
              video.src = source
              video.load()
            }
          }
        }
        else { video.pause(); video.currentTime = 0 }
      })
    }, 180)
    return () => window.clearTimeout(timer)
  }, [currentTab, instagramActiveIndex, instagramAudioEnabled, instagramPlaybackStarted, instagramDesktopPlaybackConfirmed, instagramPaused])

  const toggleInstagramAudio = (event: ReactMouseEvent<HTMLButtonElement>) => {
    event.preventDefault()
    event.stopPropagation()
    const activeVideo = Array.from(document.querySelectorAll<HTMLVideoElement>('.public-instagram-reel video'))
      .find(video => video.dataset.active === 'true' && video.offsetParent !== null)
    const isDesktopPlayback = Boolean(activeVideo?.closest('.public-instagram-desktop-reel'))
    const hasStarted = isDesktopPlayback ? instagramDesktopPlaybackConfirmed : instagramPlaybackStarted
    const startingPlayback = !hasStarted
    const nextEnabled = startingPlayback ? true : !instagramAudioEnabled
    setInstagramAudioEnabled(nextEnabled)
    if (startingPlayback) {
      if (!isDesktopPlayback) setInstagramPlaybackStarted(true)
      setInstagramPaused(false)
    }
    document.querySelectorAll<HTMLVideoElement>('.public-instagram-reel video').forEach(video => {
      const isActiveReel = video.dataset.active === 'true' && video.offsetParent !== null
      if (!isActiveReel) {
        video.muted = true
        return
      }

      // The reel source is lazy-loaded after entering the tab. If the user
      // taps the audio control before that timer fires, attach it here so
      // unmuting and play() still happen in the same user gesture.
      if (!video.src) {
        const source = video.dataset.src || video.querySelector('source')?.dataset.src
        if (source) {
          video.src = source
          video.load()
        }
      }
      video.muted = !nextEnabled
      if (!startingPlayback && instagramPaused) video.pause()
      else void video.play().catch(() => undefined)
    })
  }

  const toggleInstagramPlayback = (event: ReactMouseEvent<HTMLElement>) => {
    event.preventDefault()
    event.stopPropagation()
    const video = event.currentTarget.closest<HTMLElement>('.public-instagram-reel')?.querySelector('video')
    if (!video || video.dataset.active !== 'true') return
    const isDesktopPlayback = Boolean(video.closest('.public-instagram-desktop-reel'))
    const hasStarted = isDesktopPlayback ? instagramDesktopPlaybackConfirmed : instagramPlaybackStarted

    if (!video.paused) {
      video.pause()
      setInstagramPaused(true)
      return
    }

    if (!video.src) {
      const source = video.dataset.src || video.querySelector('source')?.dataset.src
      if (source) {
        video.src = source
      }
    }
    if (video.preload !== 'auto') {
      video.preload = 'auto'
      video.load()
    }
    const firstPlayback = !hasStarted || video.currentTime === 0
    if (firstPlayback) {
      video.muted = false
      setInstagramAudioEnabled(true)
      if (!isDesktopPlayback) setInstagramPlaybackStarted(true)
    } else {
      video.muted = !instagramAudioEnabled
    }
    setInstagramPaused(false)
    void video.play().catch(() => undefined)
  }

  const startInstagramReelWithSound = (event: ReactMouseEvent<HTMLButtonElement>) => {
    event.preventDefault()
    event.stopPropagation()
    // En escritorio el CTA «Toca para ver» es hermano del frame del reel,
    // no descendiente suyo. Búscalo desde el stage antes de intentar play().
    const stage = event.currentTarget.closest<HTMLElement>('.public-instagram-desktop-stage')
    const reel = event.currentTarget.closest<HTMLElement>('.public-instagram-desktop-reel')
      ?? stage?.querySelector<HTMLElement>('.public-instagram-desktop-reel')
    const video = reel?.querySelector('video')
    if (!video || video.dataset.active !== 'true') return

    if (!video.src) {
      const source = video.dataset.src || video.querySelector('source')?.dataset.src
      if (source) {
        video.src = source
        video.load()
      }
    }

    video.muted = false
    setInstagramAudioEnabled(true)
    setInstagramDesktopPlaybackConfirmed(true)
    setInstagramPaused(false)
    void video.play().catch(() => undefined)
  }

  const displayAccentCategory = activeCategory !== 'Todos' ? activeCategory : scrollCategory
  const orderedCategories = useMemo(() => categories.filter(category => category !== 'Todos'), [categories])
  const accentIndex = displayAccentCategory ? orderedCategories.indexOf(displayAccentCategory) : -1
  const accentRgb = accentIndex === -1 ? CATEGORY_ACCENT_CYCLE[0] : CATEGORY_ACCENT_CYCLE[accentIndex % CATEGORY_ACCENT_CYCLE.length]

  const recommendedPool = useMemo(() => {
    const visibleGroups = groups
      .map(group => ({ ...group, variants: group.variants.filter(variant => variant.product.publicVisible !== false) }))
      .filter(group => group.variants.length > 0)
    const carouselGroups = visibleGroups.map(group => ({
      ...group,
      variants: group.variants.filter(variant => variant.product.publicCarousel),
    })).filter(group => group.variants.length > 0)
      .sort((a, b) => (a.variants[0].product.publicCarouselOrder ?? 0) - (b.variants[0].product.publicCarouselOrder ?? 0))
    const categoryGroups = selectPublicCarouselGroups(carouselGroups, visibleGroups, pageSettings.carouselSelectionConfigured)
    const source = activeCategory === 'Todos'
      ? categoryGroups
      : categoryGroups.filter(group => group.variants.some(v => v.product.categories.includes(activeCategory)))
    // El pool debe ser estable durante el montaje. Un shuffle con Math.random
    // aquí cambia de recomendación cada vez que llegan los productos, y en
    // desarrollo StrictMode puede hacer que se vean varias tarjetas entrando
    // fugazmente al recargar la página.
    const stableGroups = preserveEmptyPublicCarousel(source, groups, pageSettings.carouselSelectionConfigured && carouselGroups.length === 0)
    if (!carouselGroups.length && !pageSettings.carouselSelectionConfigured) stableGroups.sort((a, b) => a.key.localeCompare(b.key))
    return stableGroups.slice(0, 8)
  }, [groups, activeCategory, pageSettings.carouselSelectionConfigured])
  const recommendedSlides = useMemo(() => {
    const slides: Array<{ kind: 'product'; group: typeof recommendedPool[number] } | { kind: 'loyalty' }> = []
    slides.push({ kind: 'loyalty' })
    if (recommendedPool.length === 0) return slides
    // La tarjeta abre Recomendado; luego cada grupo de tres productos queda
    // entre dos apariciones de fidelidad, también al cruzar el final del loop.
    const productCount = Math.ceil(recommendedPool.length / 3) * 3
    for (let index = 0; index < productCount; index += 1) {
      slides.push({ kind: 'product', group: recommendedPool[index % recommendedPool.length] })
      if ((index + 1) % 3 === 0 && index + 1 < productCount) slides.push({ kind: 'loyalty' })
    }
    return slides
  }, [recommendedPool])
  const recommendedSlideCount = recommendedSlides.length
  const currentRecommendedSlide = recommendedSlides[recommendedIndex]
  const isLoyaltyRecommended = currentRecommendedSlide?.kind === 'loyalty'

  useEffect(() => {
    setRequestedRecommendedIndex(0)
    setRecommendedIndex(0)
  }, [activeCategory])

  useEffect(() => {
    const targetIndex = requestedRecommendedIndex ?? recommendedIndex
    if (recommendedSlides[targetIndex]?.kind === 'loyalty' && requestedRecommendedIndex != null) {
      setRecommendedIndex(targetIndex)
      if (requestedRecommendedIndex != null) setRequestedRecommendedIndex(null)
      return
    }
    const targetSlide = recommendedSlides[targetIndex]
    const targetGroup = targetSlide?.kind === 'product' ? targetSlide.group : null
    if (!targetGroup) return
    if (loadedRecommendedImageKey.current === targetGroup.key) {
      setRecommendedIndex(targetIndex)
      if (requestedRecommendedIndex != null) setRequestedRecommendedIndex(null)
      return
    }

    let cancelled = false
    const sources = Array.from(new Set([
      optimizedProductImage(targetGroup.variants[0]?.product.imageUrl),
      productImage(targetGroup.category),
      '/optimized/fondos/hero-banner-food.webp',
    ].filter((source): source is string => Boolean(source))))

    void (async () => {
      for (const source of sources) {
        const loaded = await new Promise<boolean>(resolve => {
          const image = new Image()
          image.onload = () => {
            if (typeof image.decode === 'function') image.decode().then(() => resolve(true)).catch(() => resolve(true))
            else resolve(true)
          }
          image.onerror = () => resolve(false)
          image.src = source
          if (image.complete && image.naturalWidth > 0) resolve(true)
        })
        if (!loaded || cancelled) continue
        loadedRecommendedImageKey.current = targetGroup.key
        setRecommendedImageSrc(source)
        setRecommendedIndex(targetIndex)
        setRequestedRecommendedIndex(current => current === targetIndex ? null : current)
        return
      }
      // Si la imagen actual y sus respaldos fallan, conserva el slide que sí
      // estaba visible: nunca lo reemplaza por un espacio negro/vacío.
      if (!cancelled && requestedRecommendedIndex != null) setRequestedRecommendedIndex(null)
    })()

    return () => { cancelled = true }
  }, [recommendedIndex, recommendedSlides, requestedRecommendedIndex])

  useEffect(() => {
  if (recommendedSlideCount <= 1 || recommendedPaused || requestedRecommendedIndex != null) return
    recommendedTimer.current = setInterval(() => {
      setRequestedRecommendedIndex(prev => ((prev ?? recommendedIndex) + 1) % recommendedSlideCount)
    }, 4500)
    return () => { if (recommendedTimer.current) clearInterval(recommendedTimer.current) }
  }, [recommendedSlideCount, recommendedPaused, recommendedIndex, requestedRecommendedIndex])

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
    if (recommendedSlideCount <= 1) return
    setRequestedRecommendedIndex(prev => ((prev ?? recommendedIndex) + direction + recommendedSlideCount) % recommendedSlideCount)
    pauseRecommendedAutoplay()
    resumeRecommendedAutoplay()
  }

  const handleRecommendedWheel = (event: ReactWheelEvent<HTMLDivElement>) => {
    // En laptop, el gesto horizontal del touchpad llega como WheelEvent,
    // no como PointerEvent. Ignoramos el scroll vertical normal.
    if (Math.abs(event.deltaX) <= Math.abs(event.deltaY) || Math.abs(event.deltaX) < 1) return
    event.preventDefault()

    if (recommendedWheelUnlockTimer.current) clearTimeout(recommendedWheelUnlockTimer.current)
    recommendedWheelUnlockTimer.current = setTimeout(() => {
      recommendedWheelLocked.current = false
      recommendedWheelDelta.current = 0
      recommendedWheelUnlockTimer.current = null
    }, 360)

    if (recommendedWheelLocked.current) return

    const deltaScale = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? event.currentTarget.clientWidth : 1
    recommendedWheelDelta.current += event.deltaX * deltaScale
    if (Math.abs(recommendedWheelDelta.current) < 36) return

    recommendedWheelLocked.current = true
    moveRecommended(recommendedWheelDelta.current > 0 ? 1 : -1)
    recommendedWheelDelta.current = 0
  }

  useEffect(() => () => {
    clearRecommendedResumeTimer()
    if (recommendedWheelUnlockTimer.current) clearTimeout(recommendedWheelUnlockTimer.current)
  }, [])

  const recommendedGroup = currentRecommendedSlide?.kind === 'product' ? currentRecommendedSlide.group : null
  const recommendedVariant = recommendedGroup?.variants.find(variant => variant.product.publicCarousel) ?? recommendedGroup?.variants.find(variant => {
    const groupName = normalizeForSearch(recommendedGroup.name)
    const variantName = normalizeForSearch(variant.product.name)
    if (groupName === 'costillas') return !variantName.includes('1 unidad') && !variantName.includes('1/2')
    if (groupName === 'lumpias') return variantName.includes('sencilla')
    return false
  }) ?? null
  const [storeClock, setStoreClock] = useState(() => getStoreClock(DEFAULT_PUBLIC_ORDER_PAGE_SETTINGS))
  useEffect(() => {
    setStoreClock(getStoreClock(pageSettings))
    const timer = window.setInterval(() => setStoreClock(getStoreClock(pageSettings)), 60_000)
    return () => window.clearInterval(timer)
  }, [pageSettings])
  const isStoreOpen = LOCAL_ORDER_TEST_MODE || pageSettings.storeStatusMode === 'open' || (pageSettings.storeStatusMode !== 'closed' && storeClock.isOpen)
  const isAcceptingOrders = LOCAL_ORDER_TEST_MODE || pageSettings.storeStatusMode === 'open' || (pageSettings.storeStatusMode !== 'closed' && storeClock.acceptingOrders)
  useEffect(() => {
    if (!pageSettingsLoaded) return
    setShowStoreClosedNotice(ORDER_HOURS_BLOCK_ENABLED && !LOCAL_ORDER_TEST_MODE && !isAcceptingOrders)
  }, [isAcceptingOrders, pageSettingsLoaded])
  const pickupSlots = useMemo(
    () => getPublicPickupSlots(storeClock.nowMinutes, pageSettings.contactOpenTime, pageSettings.contactCloseTime),
    [storeClock.nowMinutes, pageSettings.contactOpenTime, pageSettings.contactCloseTime],
  )
  useEffect(() => {
    // Si la hora elegida ya pasó (el reloj avanza), se vuelve a "Lo antes posible".
    if (pickupTime !== 'asap' && !pickupSlots.includes(pickupTime)) setPickupTime('asap')
  }, [pickupSlots, pickupTime])
  const blockClosedStoreAdd = () => {
    if (!pageSettingsLoaded || !ORDER_HOURS_BLOCK_ENABLED || isAcceptingOrders) return false
    setShowStoreClosedNotice(true)
    return true
  }
  const itemCount = cart.reduce((sum, item) => sum + item.quantity, 0)
  const total = cart.reduce((sum, item) => sum + item.price * item.quantity, 0)
  const deliveryFee = orderType === 'delivery' && deliveryEstimate?.fee != null
    ? serverDeliveryFeeOverride && serverDeliveryFeeOverride.lat === geoCoords?.lat && serverDeliveryFeeOverride.lng === geoCoords?.lng
      ? serverDeliveryFeeOverride.fee
      : deliveryEstimate.fee
    : 0
  const orderTotal = total + deliveryFee
  const deliveryFeeText = orderType !== 'delivery'
    ? 'No aplica'
    : deliveryQuoteStatus === 'loading' || deliverySettingsStatus === 'loading'
      ? 'Calculando tarifa…'
      : deliveryQuoteStatus === 'error' || deliverySettingsStatus === 'error'
        ? 'No disponible'
        : deliveryCoverageUnavailable
          ? 'Fuera de cobertura'
          : deliveryEstimate && deliveryEstimate.fee != null
      ? `$${deliveryFee.toFixed(2)}${serverDeliveryFeeOverride && serverDeliveryFeeOverride.lat === geoCoords?.lat && serverDeliveryFeeOverride.lng === geoCoords?.lng ? ' (actualizado)' : ''}`
      : 'Por confirmar'
  const cartProductIds = useMemo(() => new Set(cart.map(item => item.productId)), [cart])
  // "Ver todos" y las sugerencias se basan en el catálogo completo, no en la
  // categoría que el cliente tenga abierta en el menú.
  const allCatalogGroups = useMemo(() => groupMenuProducts([...products, ...extrasProducts]), [products, extrasProducts])
  const getCartIncludedCopy = (item: WebOrderCartItem) => {
    const product = [...products, ...extrasProducts].find(candidate => candidate.id === item.productId)
    return publicCartIncludedCopy(product?.description)
  }
  const recommendations = useMemo(
    () => getCartRecommendations(cart, allCatalogGroups),
    [cart, allCatalogGroups],
  )
  // El carrusel de "Tu pedido" muestra muchas más opciones que la tarjeta lateral.
  const cartCarouselGroups = useMemo(
    () => getCartCarouselGroups(cart, allCatalogGroups),
    [cart, allCatalogGroups],
  )
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
  }, [recommendations])

  useEffect(() => {
    if (recommendations.length <= 1) return
    sidebarRecoTimer.current = setInterval(() => {
      setSidebarRecoIndex(prev => (prev + 1) % recommendations.length)
    }, 4500)
    return () => { if (sidebarRecoTimer.current) clearInterval(sidebarRecoTimer.current) }
  }, [recommendations.length])
  // "Ver todos" belongs to the cart, not to the currently selected menu tab.
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
    if (!restoringFlow.current) return
    try {
      const saved = JSON.parse(localStorage.getItem(FLOW_STATE_KEY) || 'null') as Partial<{ cartOpen: boolean; step: string; name: string; phone: string; identification: string; orderType: 'takeaway' | 'delivery'; deliveryChosen: boolean; address: string; addressReference: string; notes: string; deliveryNotes: string; geoCoords: MapCoordinates; addressMethod: 'gps' | 'map' | 'search' }> | null
      const sent = JSON.parse(localStorage.getItem(WHATSAPP_SENT_KEY) || 'null') as { code?: string; sentAt?: number } | null
      if (saved && cart.length > 0) {
        if (saved.name || saved.phone || saved.identification) customerDetailsTouched.current = true
        setName(saved.name || '')
        setPhone(saved.phone || '')
        setIdentification(saved.identification || '')
        const savedPrefix = saved.identification?.match(/^[VEJ]/i)?.[0]?.toUpperCase()
        if (savedPrefix === 'V' || savedPrefix === 'E' || savedPrefix === 'J') setIdPrefix(savedPrefix)
        setOrderType(saved.orderType === 'delivery' ? 'delivery' : 'takeaway')
        setDeliveryChosen(Boolean(saved.deliveryChosen))
        setAddress(saved.address || '')
        setAddressReference(saved.addressReference || '')
        setNotes(saved.notes || '')
        setDeliveryNotes(saved.deliveryNotes || '')
        setGeoCoords(saved.geoCoords || null)
        setAddressMethod(saved.addressMethod || null)
        if (sent && isRecentSentState(sent)) {
          setOrderCode(sent.code || '')
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
  }, [cart.length])
  useEffect(() => {
    // Volver desde WhatsApp puede recuperar esta página desde el bfcache sin
    // montar de nuevo React. Sincronizamos el estado también en pageshow para
    // que el resultado sea el mismo con recarga o con el botón Atrás.
    const restoreSentState = () => {
      try {
        const sent = JSON.parse(localStorage.getItem(WHATSAPP_SENT_KEY) || 'null') as { code?: string; sentAt?: number } | null
        if (!isRecentSentState(sent) || !sent || cart.length === 0) return
        setOrderCode(sent.code || '')
        setCartOpen(true)
        setStep('sent')
      } catch { /* ignore malformed sent state */ }
    }
    window.addEventListener('pageshow', restoreSentState)
    return () => window.removeEventListener('pageshow', restoreSentState)
  }, [cart.length])
  useEffect(() => { localStorage.setItem(CART_KEY, JSON.stringify(cart)) }, [cart])
  useEffect(() => { favoriteIdsRef.current = favoriteIds }, [favoriteIds])
  useEffect(() => {
    if (favoriteStorageMode === 'guest') {
      try { localStorage.setItem(FAVORITES_KEY, JSON.stringify(favoriteIds)) } catch { /* el menú sigue funcionando sin almacenamiento */ }
      return
    }
    if (favoriteStorageMode !== 'account' || !favoriteAccountId) return
    const accountKey = `${FAVORITES_KEY}:${favoriteAccountId}`
    try { localStorage.setItem(accountKey, JSON.stringify(favoriteIds)) } catch { /* la cuenta sigue sincronizando en línea */ }
    if (remoteFavoriteSyncRef.current) { remoteFavoriteSyncRef.current = false; return }
    if (!favoriteSyncReady) return
    void syncCustomerFavorites(favoriteIds).catch(() => undefined)
  }, [favoriteAccountId, favoriteIds, favoriteStorageMode, favoriteSyncReady])
  useEffect(() => {
    if (favoriteStorageMode !== 'account' || !favoriteAccountId) return
    let active = true
    const unsubscribe = subscribeToDataChanges(table => {
      if (table !== 'customer_favorites') return
      void getCustomerFavorites().then(nextFavorites => {
        if (!active) return
        const current = [...favoriteIdsRef.current].sort()
        const incoming = [...nextFavorites].sort()
        if (current.length === incoming.length && current.every((key, index) => key === incoming[index])) return
        remoteFavoriteSyncRef.current = true
        favoriteIdsRef.current = nextFavorites
        setFavoriteIds(nextFavorites)
      }).catch(() => undefined)
    })
    return () => { active = false; unsubscribe() }
  }, [favoriteAccountId, favoriteStorageMode])
  useEffect(() => {
    if (!customerSupabase) return
    const customerClient = customerSupabase
    let active = true
    const localKeys = (key: string) => {
      try {
        const value: unknown = JSON.parse(localStorage.getItem(key) || '[]')
        return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []
      } catch { return [] }
    }
    const applySession = async (userId: string | null) => {
      if (!active) return
      const sequence = ++favoriteSyncSequence.current
      setFavoriteSyncReady(false)
      if (!userId) {
        stopCustomerDataChangeFeed()
        if (!active || sequence !== favoriteSyncSequence.current) return
        const guestFavorites = localKeys(FAVORITES_KEY)
        setFavoriteAccountId(null)
        setFavoriteIds(guestFavorites)
        setFavoriteStorageMode('guest')
        return
      }
      startCustomerDataChangeFeed(userId)
      const accountKey = `${FAVORITES_KEY}:${userId}`
      const importedGuestKey = `${FAVORITES_KEY}:imported:${userId}`
      const guestFavorites = localKeys(FAVORITES_KEY)
      const cachedAccountFavorites = localKeys(accountKey)
      const importedGuestFavorites = localKeys(importedGuestKey)
      let hasImportedGuestFavorites = false
      try { hasImportedGuestFavorites = localStorage.getItem(importedGuestKey) !== null } catch { /* continúa con favoritos en memoria */ }
      const newGuestFavorites = guestFavorites.filter(key => !importedGuestFavorites.includes(key))
      const removedGuestFavorites = importedGuestFavorites.filter(key => !guestFavorites.includes(key))
      let mergedFavorites = hasImportedGuestFavorites
        ? [...new Set([...favoriteIdsRef.current, ...newGuestFavorites])]
        : [...new Set([...cachedAccountFavorites, ...guestFavorites, ...favoriteIdsRef.current])]
      try {
        const serverFavorites = await getCustomerFavorites()
        if (!active || sequence !== favoriteSyncSequence.current) return
        mergedFavorites = hasImportedGuestFavorites
          ? [...new Set([...serverFavorites, ...newGuestFavorites])].filter(key => !removedGuestFavorites.includes(key))
          : [...new Set([...serverFavorites, ...mergedFavorites])]
        const syncedFavorites = await syncCustomerFavorites(mergedFavorites)
        if (!active || sequence !== favoriteSyncSequence.current) return
        mergedFavorites = syncedFavorites
        try { localStorage.setItem(importedGuestKey, JSON.stringify(guestFavorites)) } catch { /* la sincronización remota ya quedó guardada */ }
        setFavoriteSyncReady(true)
      } catch {
        if (!active || sequence !== favoriteSyncSequence.current) return
        // Mantiene visibles los favoritos del dispositivo y los de esta cuenta;
        // el efecto de persistencia vuelve a intentar la sincronización.
      }
      setFavoriteAccountId(userId)
      setFavoriteIds(mergedFavorites)
      setFavoriteStorageMode('account')
    }
    const { data } = customerClient.auth.onAuthStateChange((_event, session) => {
      window.setTimeout(() => { void applySession(session?.user.id ?? null) }, 0)
    })
    const refreshFavorites = () => {
      if (document.visibilityState === 'hidden') return
      void customerClient.auth.getSession().then(({ data: sessionData }) => applySession(sessionData.session?.user.id ?? null)).catch(() => undefined)
    }
    void customerClient.auth.getSession().then(({ data: sessionData }) => applySession(sessionData.session?.user.id ?? null)).catch(() => applySession(null))
    window.addEventListener('focus', refreshFavorites)
    window.addEventListener('pageshow', refreshFavorites)
    document.addEventListener('visibilitychange', refreshFavorites)
    return () => {
      active = false
      stopCustomerDataChangeFeed()
      data.subscription.unsubscribe()
      window.removeEventListener('focus', refreshFavorites)
      window.removeEventListener('pageshow', refreshFavorites)
      document.removeEventListener('visibilitychange', refreshFavorites)
    }
  }, [])
  useEffect(() => {
    if (restoringFlow.current) return
    // Tras un pedido exitoso no se guardan datos personales del cliente.
    const personal = step === 'sent' ? { name: '', phone: '', identification: '' } : { name, phone, identification }
    localStorage.setItem(FLOW_STATE_KEY, JSON.stringify({ cartOpen, step, ...personal, orderType, deliveryChosen, address, addressReference, notes, deliveryNotes, geoCoords, addressMethod }))
  }, [cartOpen, step, name, phone, identification, orderType, deliveryChosen, address, addressReference, notes, deliveryNotes, geoCoords, addressMethod])

  const toggleFavorite = (groupKey: string) => setFavoriteIds(current => current.includes(groupKey) ? current.filter(id => id !== groupKey) : [...current, groupKey])
  const startNewOrder = () => {
    setPickupTime('asap')
    addressActionRef.current += 1
    setLocating(false)
    commitCart([])
    setName('')
    setPhone('')
    setIdentification('')
    setIdPrefix('V')
    setOrderType('takeaway')
    setDeliveryChosen(false)
    setAddress('')
    setAddressReference('')
    setGeoCoords(null)
    setAddressMethod(null)
    setNotes('')
    setDeliveryNotes('')
    setSentSummary(null)
    setError('')
    setOrderCode('')
    setLocalTestOrderLinkedToProfile(false)
    checkoutAttemptRef.current = null
    try {
      localStorage.removeItem(CART_KEY)
      localStorage.removeItem(FLOW_STATE_KEY)
      localStorage.removeItem(WHATSAPP_SENT_KEY)
      sessionStorage.removeItem(CHECKOUT_ATTEMPT_KEY)
    } catch { /* storage unavailable */ }
    closeCart()
  }

  const repeatPreviousOrder = async (previousOrder: CustomerRepeatOrder) => {
    if (cart.length > 0 && !window.confirm('Tu carrito actual tiene productos. ¿Quieres reemplazarlo por el pedido anterior?')) return

    const catalog = await getPublicCatalog()
    const activeProducts = new Map(catalog.filter(product => product.active).map(product => [product.id, product]))
    const nextCart: WebOrderCartItem[] = []
    const unavailable: string[] = []
    let cartLimitViolation: PublicCartLimitViolation | null = null

    for (const historicalItem of previousOrder.items) {
      const product = activeProducts.get(historicalItem.productId)
      if (!historicalItem.available || !product || !Number.isInteger(historicalItem.quantity) || historicalItem.quantity < 1) {
        unavailable.push(historicalItem.productName || 'Un producto del pedido')
        continue
      }
      if (historicalItem.quantity > PUBLIC_ORDER_MAX_UNITS_PER_PRESENTATION) {
        cartLimitViolation = 'presentation-quantity'
        continue
      }

      const groups = filterProteinExtraGroups(await getPublicProductModifiers(product.id), product.allowProteinExtras !== false)
      const validOptionIds = new Set(groups.flatMap(group => group.options.map(option => option.id)))
      const modifiers = historicalItem.modifiers.filter(modifier => validOptionIds.has(modifier.optionId)).map(modifier => ({ optionId: modifier.optionId, quantity: modifier.quantity }))
      const selection = Object.fromEntries(modifiers.map(modifier => [modifier.optionId, modifier.quantity]))
      if (hasInvalidModifierSelection(groups, selection) || getModifierSelectionError(groups, selection)) {
        unavailable.push(historicalItem.productName || product.name)
        continue
      }

      const restoredItem: WebOrderCartItem = {
        productId: product.id,
        productName: formatProductTitle(product.name),
        price: product.price + calculateModifierTotal(groups, selection),
        quantity: historicalItem.quantity,
        imageUrl: optimizedProductImage(product.imageUrl) || undefined,
        notes: historicalItem.notes || undefined,
        modifiers,
      }
      const existingLine = nextCart.find(item => cartLineKey(item) === cartLineKey(restoredItem))
      if (existingLine) {
        existingLine.quantity += restoredItem.quantity
      } else if (nextCart.length < PUBLIC_ORDER_MAX_DISTINCT_LINES + 1) nextCart.push(restoredItem)
      const violation = getPublicCartLimitViolation(nextCart)
      if (violation) cartLimitViolation = violation
    }

    if (cartLimitViolation) {
      throw new Error(cartLimitViolation === 'presentation-quantity'
        ? 'Ese pedido supera el límite de 30 unidades de una misma presentación. No cambiamos tu carrito actual; ajusta la cantidad antes de volver a intentarlo.'
        : 'Ese pedido supera el límite de 40 productos distintos. No cambiamos tu carrito actual; repítelo en pedidos separados desde el menú.')
    }

    if (!nextCart.length) throw new Error('Los productos de ese pedido ya no están disponibles con las mismas opciones. Puedes volver a agregarlos desde el menú.')

    commitCart(nextCart)
    setProducts(catalog.filter(product => !product.categories.includes('extras')))
    setExtrasProducts(catalog.filter(product => product.categories.includes('extras')))
    customerDetailsTouched.current = true
    setName(previousOrder.customerName)
    setPhone(previousOrder.customerPhone)
    setIdentification(previousOrder.customerIdentification)
    setIdPrefix(previousOrder.customerIdentification.trim().charAt(0).toUpperCase() === 'E' ? 'E' : previousOrder.customerIdentification.trim().charAt(0).toUpperCase() === 'J' ? 'J' : 'V')
    setOrderType(previousOrder.orderType)
    setDeliveryChosen(false)
    setAddress(previousOrder.deliveryAddress || '')
    const savedNoteParts = previousOrder.customerNotes.split(/\s*·\s*/).map(part => part.trim())
    const savedReference = previousOrder.customerNotes.match(/(?:^|\n|·\s*)Referencia:\s*([^\n·]*)/i)?.[1]
    setAddressReference(savedReference?.trim() || '')
    const cleanNotePart = (part: string) => part.replace(/\n(?:Referencia|Ubicación GPS|Pago preferido|Hora de retiro):[^\n]*/gi, '').trim()
    const noteLabel = (label: string) => savedNoteParts.map(cleanNotePart).find(part => part.toLowerCase().startsWith(`${label}:`))?.slice(label.length + 1).trim() || ''
    setDeliveryNotes(noteLabel('Repartidor'))
    setNotes(savedNoteParts
      .map(cleanNotePart)
      .filter(part => part && !/^(Referencia:|Personalizaciones:|Ubicación GPS:|Pago preferido:|Repartidor:)/i.test(part))
      .map(part => part.replace(/^Cocina:\s*/i, ''))
      .join(' · ')
      .trim())
    const savedPayment = previousOrder.customerNotes.match(/(?:^|\n)Pago preferido:\s*([a-z_]+(?:\+[a-z_]+)?)/i)?.[1]
    const savedPaymentCodes = savedPayment?.split('+') ?? []
    if (savedPaymentCodes.length > 0 && savedPaymentCodes.length <= 2 && savedPaymentCodes.every(code => PAY_OPTIONS.some(option => option.code === code))) {
      setPayMode(savedPaymentCodes.length === 2 ? 'mixed' : 'single')
      setPayPrimary(savedPaymentCodes[0] as PayMethod)
      if (savedPaymentCodes.length === 2) setPaySecondary(savedPaymentCodes[1] as PayMethod)
    }
    const hasSavedCoordinates = Number.isFinite(previousOrder.deliveryLat) && Number.isFinite(previousOrder.deliveryLng)
    setGeoCoords(hasSavedCoordinates ? { lat: previousOrder.deliveryLat as number, lng: previousOrder.deliveryLng as number } : null)
    setAddressMethod(hasSavedCoordinates ? 'map' : null)
    setServerDeliveryFeeOverride(null)
    setReturnToConfirmAfterEdit(false)
    setError(unavailable.length
      ? `Cargamos los productos disponibles. No incluimos: ${[...new Set(unavailable)].join(', ')} porque ya no están disponibles con las opciones originales.`
      : '')
    setCurrentTab('menu')
    previousStepRef.current = 'cart'
    setStep('cart')
    setClosingCart(false)
    setCartOpen(true)
    checkoutAttemptRef.current = null
    try { sessionStorage.removeItem(CHECKOUT_ATTEMPT_KEY) } catch { /* el pedido anterior se conserva sin sessionStorage */ }
  }

  const closeCart = () => {
    if (!cartOpen || closingCart) return
    setClosingCart(true)
    window.setTimeout(() => {
      setCartOpen(false)
      setClosingCart(false)
    }, 360)
  }
  const openCartFromSidebar = (nextStep: typeof step) => {
    setCartOpen(true)
    setStep(nextStep)
  }
  const requireCart = () => {
    const cartLimitViolation = getPublicCartLimitViolation(cart)
    if (cartLimitViolation) {
      setError(cartLimitViolation === 'presentation-quantity'
        ? 'Tu carrito supera las 30 unidades de una misma presentación. Reduce la cantidad; no se ha eliminado ningún producto.'
        : 'Tu carrito supera los 40 productos distintos. Quita productos para continuar; no se ha eliminado ningún producto.')
      return false
    }
    if (cart.length > 0 && cart.reduce((sum, item) => sum + item.price * item.quantity, 0) < PUBLIC_ORDER_MIN_SUBTOTAL) {
      setError(`El pedido mínimo es de ${money(PUBLIC_ORDER_MIN_SUBTOTAL)} en productos.`)
      return false
    }
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

  const showAddedFeedback = (product: Product, imageUrl?: string) => {
    setAddFeedback({ productId: product.id, name: formatProductTitle(product.name), imageUrl, status: 'added' })
    setAddFeedbackClosing(false)
    if (addFeedbackTimer.current) window.clearTimeout(addFeedbackTimer.current)
    if (addFeedbackExitTimer.current) window.clearTimeout(addFeedbackExitTimer.current)
    addFeedbackTimer.current = setTimeout(() => {
      setAddFeedbackClosing(true)
      addFeedbackExitTimer.current = setTimeout(() => setAddFeedback(null), 320)
    }, 2800)
  }

  const addProduct = (product: Product, quantity = 1, notes = '', extrasPrice = 0, modifiers: WebOrderCartItem['modifiers'] = [], closeDetailAfterAdd = true) => {
    if (blockClosedStoreAdd()) return false
    const imageUrl = optimizedProductImage(product.imageUrl) || undefined
    const linePrice = product.price + extrasPrice
    const prospectiveLine = { productId: product.id, notes, modifiers }
    const prospectiveKey = cartLineKey(prospectiveLine)
    const currentCart = cartRef.current
    const existingLine = currentCart.find(item => cartLineKey(item) === prospectiveKey)
    const candidateCart = existingLine
      ? currentCart.map(item => cartLineKey(item) === prospectiveKey ? { ...item, quantity: item.quantity + quantity } : item)
      : [...currentCart, { productId: product.id, productName: formatProductTitle(product.name), price: linePrice, quantity, imageUrl, notes: notes || undefined, modifiers }]
    const cartLimitViolation = getPublicCartLimitViolation(candidateCart)
    if (cartLimitViolation) {
      setError(cartLimitViolation === 'presentation-quantity'
        ? 'Puedes pedir hasta 30 unidades de una misma presentación. Reduce la cantidad para continuar; tu pedido se conserva.'
        : 'Tu pedido ya tiene 40 productos distintos. Quita un producto para hacer espacio; lo que ya agregaste se conserva.')
      return false
    }
    showAddedFeedback(product, imageUrl)
    setCartPulse(true)
    if (cartPulseTimer.current) window.clearTimeout(cartPulseTimer.current)
    cartPulseTimer.current = setTimeout(() => setCartPulse(false), 520)
    commitCart(current => {
      const key = prospectiveKey
      const existing = current.find(item => cartLineKey(item) === key)
      return existing
        ? current.map(item => cartLineKey(item) === key ? { ...item, quantity: item.quantity + quantity } : item)
        : [...current, { productId: product.id, productName: formatProductTitle(product.name), price: linePrice, quantity, imageUrl, notes: notes || undefined, modifiers }]
    })
    if (closeDetailAfterAdd) closeProductDetail()
    return true
  }

  const closeQuickVariant = () => {
    if (!quickVariantGroup || closingQuickVariant) return
    setClosingQuickVariant(true)
    window.setTimeout(() => {
      setQuickVariantGroup(null)
      setQuickVariantId(null)
      setQuickVariantQuantity(1)
      setQuickVariantProteinGroup(null)
      setQuickVariantProteinSelection({})
      setQuickVariantProteinDraft({})
      setQuickProteinDialogOpen(false)
      setClosingQuickVariant(false)
    }, 200)
  }

  const openQuickProteinDialog = () => {
    if (!quickVariantProteinGroup) return
    setQuickVariantProteinDraft(quickVariantProteinSelection)
    setQuickProteinDialogOpen(true)
  }

  const toggleQuickProteinDraft = (optionId: string) => {
    setQuickVariantProteinDraft(current => ({ ...current, [optionId]: current[optionId] ? 0 : 1 }))
  }

  const applyQuickProteinDraft = () => {
    setQuickVariantProteinSelection(quickVariantProteinDraft)
    setQuickProteinDialogOpen(false)
  }

  const requestQuickAdd = async (group: MenuProductGroup, quantity = 1) => {
    if (blockClosedStoreAdd()) return
    if (group.variants.length <= 1) {
      const product = group.variants[0]?.product
      if (product) {
        if (pendingQuickAddsRef.current.has(group.key)) return
        pendingQuickAddsRef.current.add(group.key)
        setPendingQuickAdds(current => new Set(current).add(group.key))
        if (addFeedbackTimer.current) window.clearTimeout(addFeedbackTimer.current)
        if (addFeedbackExitTimer.current) window.clearTimeout(addFeedbackExitTimer.current)
        setAddFeedbackClosing(false)
        setAddFeedback({ productId: product.id, name: formatProductTitle(product.name), imageUrl: optimizedProductImage(product.imageUrl) || undefined, status: 'checking' })
        try {
          let modifierGroups = PUBLIC_MODIFIER_CACHE.get(product.id)
          if (!modifierGroups) {
            try {
              modifierGroups = await getPublicProductModifiers(product.id)
              PUBLIC_MODIFIER_CACHE.set(product.id, modifierGroups)
            } catch {
              setAddFeedback(current => current?.productId === product.id && current.status === 'checking' ? null : current)
              openGroup(group, undefined, product.id)
              return
            }
          }
          if (modifierGroups.some(modifier => modifier.minSelections > 0 || isIncludedProteinGroup(modifier))) {
            setAddFeedback(current => current?.productId === product.id && current.status === 'checking' ? null : current)
            openGroup(group, undefined, product.id)
            return
          }
          if (addProduct(product, quantity)) setCardQtys(prev => ({ ...prev, [group.key]: 1 }))
          else setAddFeedback(current => current?.productId === product.id && current.status === 'checking' ? null : current)
        } finally {
          pendingQuickAddsRef.current.delete(group.key)
          setPendingQuickAdds(current => {
            const next = new Set(current)
            next.delete(group.key)
            return next
          })
        }
      }
      return
    }

    setQuickVariantGroup(group)
    setQuickVariantId(null)
    setQuickVariantQuantity(Math.max(1, quantity))
    setClosingQuickVariant(false)
  }

  const confirmQuickVariant = async () => {
    if (blockClosedStoreAdd()) return
    const variant = quickVariantGroup?.variants.find(({ product }) => product.id === quickVariantId)
    if (!variant || !quickVariantGroup || quickVariantConfirmRef.current) return
    quickVariantConfirmRef.current = true
    setConfirmingQuickVariant(true)
    try {
      let modifierGroups = PUBLIC_MODIFIER_CACHE.get(variant.product.id)
      if (!modifierGroups) {
        modifierGroups = await getPublicProductModifiers(variant.product.id)
        PUBLIC_MODIFIER_CACHE.set(variant.product.id, modifierGroups)
      }
      if (modifierGroups.some(group => group.minSelections > 0 && !isIncludedProteinGroup(group))) {
        personalizeQuickVariant()
        return
      }
      const includedProteinGroup = modifierGroups.find(isIncludedProteinGroup)
      const selectedProteinGroup = includedProteinGroup && quickVariantProteinGroup?.modifierId === includedProteinGroup.modifierId
        ? quickVariantProteinGroup
        : includedProteinGroup
      const proteinSelection = selectedProteinGroup && quickVariantProteinGroup?.modifierId === selectedProteinGroup.modifierId
        ? quickVariantProteinSelection
        : selectedProteinGroup ? getDefaultModifierSelection([selectedProteinGroup]) : {}
      const proteinModifiers: WebOrderCartItem['modifiers'] = selectedProteinGroup
        ? selectedProteinGroup.options.flatMap(option => proteinSelection[option.id] > 0
          ? [{ optionId: option.id, quantity: proteinSelection[option.id] }]
          : [])
        : []
      const removedProteins = selectedProteinGroup?.options
        .filter(option => !(proteinSelection[option.id] ?? 0))
        .map(option => formatSpanishText(option.name)) ?? []
      const proteinNotes = removedProteins.length ? `Sin: ${removedProteins.join(', ')}` : ''
      if (addProduct(variant.product, quickVariantQuantity, proteinNotes, 0, proteinModifiers)) {
        setCardQtys(prev => ({ ...prev, [quickVariantGroup.key]: 1 }))
        closeQuickVariant()
      }
    } catch {
        setError('No pudimos verificar las opciones obligatorias. Inténtalo de nuevo.')
    } finally {
      quickVariantConfirmRef.current = false
      setConfirmingQuickVariant(false)
    }
  }

  const personalizeQuickVariant = () => {
    const group = quickVariantGroup
    const variant = group?.variants.find(({ product }) => product.id === quickVariantId)
    if (!group || !variant || closingQuickVariant) return
    const quantity = quickVariantQuantity
    setClosingQuickVariant(true)
    window.setTimeout(() => {
      setQuickVariantGroup(null)
      setQuickVariantId(null)
      setQuickVariantQuantity(1)
      setClosingQuickVariant(false)
      openGroup(group, undefined, variant.product.id, quickVariantProteinGroup ? quickVariantProteinSelection : undefined)
      setDetailQuantity(quantity)
    }, 200)
  }

  const [deletingKeys, setDeletingKeys] = useState<string[]>([])
  const updateQuantity = (itemKey: string, delta: number, legacyNotes?: string) => {
    const target = cartRef.current.find(item => cartLineKey(item) === itemKey || (item.productId === itemKey && (item.notes || '') === (legacyNotes || '')))
    const candidateCart = cartRef.current
      .map(item => (cartLineKey(item) === itemKey || (item.productId === itemKey && (item.notes || '') === (legacyNotes || ''))) ? { ...item, quantity: item.quantity + delta } : item)
      .filter(item => item.quantity > 0)
    const cartLimitViolation = getPublicCartLimitViolation(candidateCart)
    if (delta > 0 && cartLimitViolation) {
      setError(cartLimitViolation === 'presentation-quantity'
        ? 'Puedes pedir hasta 30 unidades de una misma presentación. Reduce la cantidad para continuar; tu pedido se conserva.'
        : 'Tu pedido ya tiene 40 productos distintos. Quita un producto para hacer espacio; lo que ya agregaste se conserva.')
      return
    }
    if (target && cart.length === 1 && target.quantity + delta <= 0 && cartOpen && step === 'cart') {
      const targetKey = cartLineKey(target)
      setClosingCart(true)
      window.setTimeout(() => {
        commitCart(current => current.filter(item => cartLineKey(item) !== targetKey))
        setCartOpen(false)
        setClosingCart(false)
      }, 360)
      return
    }
    commitCart(candidateCart)
  }

  const handleRemoveSidebarItem = (itemKey: string, qty: number) => {
    const key = itemKey
    setDeletingKeys(prev => [...prev, key])
    window.setTimeout(() => {
      updateQuantity(itemKey, -qty)
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
      setEditingCartLineKey(null)
      setDetailQuantity(1)
      setDetailNotes('')
      setDetailModifierGroups([])
      setSelectedExtras({})
      setSelectedCatalogExtras({})
      setModifierLoadError(false)
      setModifierValidationError('')
    }, 220)
  }

  const openGroup = (group: MenuProductGroup, originEvent?: { clientX: number; clientY: number }, initialVariantId?: string, initialModifiers?: PublicModifierSelection) => {
    const requestId = modifierRequestRef.current + 1
    modifierRequestRef.current = requestId
    const initialVariant = group.variants.find(({ product }) => product.id === initialVariantId) ?? group.variants[0]
    setDetailOrigin(originEvent ? { x: originEvent.clientX, y: originEvent.clientY } : null)
    setClosingDetail(false)
    setSelectedGroup(group)
    setSelectedVariantId(initialVariant?.product.id ?? null)
    setDetailQuantity(1)
    setDetailNotes('')
    setSelectedExtras(initialModifiers ?? {})
    setSelectedCatalogExtras({})
    setModifierLoadError(false)
    setModifierValidationError('')
    setShowModifierGuidance(true)
    const productId = initialVariant?.product.id
    const prepareModifierGroups = (remoteGroups: ProductModifierGroup[]) => {
      const resolved = filterProteinExtraGroups(remoteGroups, initialVariant?.product.allowProteinExtras !== false)
        .filter(item => item.options.length > 0 || item.minSelections > 0)
        .map(item => ({ ...item, options: [...item.options] }))
      // Los extras del catálogo son productos independientes, no modificadores.
      // No deben sumarse al producto como si fueran opciones sin una línea propia.
      return resolved
    }
    const applyModifierGroups = (remoteGroups: ProductModifierGroup[]) => {
      const prepared = prepareModifierGroups(remoteGroups)
      setDetailModifierGroups(prepared)
      const validOptionIds = new Set(prepared.flatMap(item => item.options.map(option => option.id)))
      const initialSelection = initialModifiers
        ? Object.fromEntries(Object.entries(initialModifiers).filter(([optionId]) => validOptionIds.has(optionId)))
        : getDefaultModifierSelection(prepared)
      setSelectedExtras(initialSelection)
    }

    if (!productId) {
      applyModifierGroups([])
      setLoadingModifiers(false)
      return
    }

    const cachedGroups = PUBLIC_MODIFIER_CACHE.get(productId)
    if (cachedGroups) {
      applyModifierGroups(cachedGroups)
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
        applyModifierGroups(remoteGroups)
      })
      .catch(() => {
        if (modifierRequestRef.current === requestId) {
          setDetailModifierGroups([])
          setModifierLoadError(true)
        }
      })
      .finally(() => {
        if (modifierRequestRef.current === requestId) setLoadingModifiers(false)
      })
  }

  const selectedProduct = selectedGroup?.variants.find(({ product }) => product.id === selectedVariantId)?.product
    ?? selectedGroup?.variants[0]?.product
  const quickSelectedVariant = quickVariantGroup?.variants.find(({ product }) => product.id === quickVariantId)
  useEffect(() => {
    let cancelled = false
    setQuickVariantHasModifiers(false)
    setQuickVariantOptionsLabel('Ver opciones')
    setQuickVariantProteinGroup(null)
    setQuickVariantProteinSelection({})
    setQuickVariantProteinDraft({})
    setQuickProteinDialogOpen(false)
    if (!quickSelectedVariant) return () => { cancelled = true }
    const productId = quickSelectedVariant.product.id
    const applyModifierSummary = (groups: ProductModifierGroup[]) => {
      const availableGroups = filterProteinExtraGroups(groups, quickSelectedVariant.product.allowProteinExtras !== false)
      const includedProteinGroup = availableGroups.find(group => group.options.length > 0 && isIncludedProteinGroup(group)) ?? null
      const hasOptions = availableGroups.some(group => group.options.length > 0)
      const defaultProteinSelection = includedProteinGroup ? getDefaultModifierSelection([includedProteinGroup]) : {}
      setQuickVariantProteinGroup(includedProteinGroup)
      setQuickVariantProteinSelection(defaultProteinSelection)
      setQuickVariantProteinDraft(defaultProteinSelection)
      setQuickVariantHasModifiers(hasOptions)
      setQuickVariantOptionsLabel(includedProteinGroup ? 'Quitar alguna proteína' : 'Ver opciones')
    }
    const cached = PUBLIC_MODIFIER_CACHE.get(productId)
    if (cached) {
      applyModifierSummary(cached)
      return () => { cancelled = true }
    }
    getPublicProductModifiers(productId).then(groups => {
      PUBLIC_MODIFIER_CACHE.set(productId, groups)
      if (!cancelled) applyModifierSummary(groups)
    }).catch(() => {
      if (!cancelled) {
        setQuickVariantHasModifiers(false)
        setQuickVariantOptionsLabel('Ver opciones')
        setQuickVariantProteinGroup(null)
        setQuickVariantProteinSelection({})
        setQuickVariantProteinDraft({})
      }
    })
    return () => { cancelled = true }
  }, [quickSelectedVariant])
  const detailExtrasTotal = calculateModifierTotal(detailModifierGroups, selectedExtras)
  const catalogExtraProducts = selectedProduct?.categories.includes('bebidas')
    ? []
    : extrasProducts.filter(product => !product.categories.includes('bebidas')
      && (selectedProduct?.allowProteinExtras !== false || !isProteinCatalogExtra(product)))
  const complementaryProducts = selectedProduct
    ? products.filter(product => product.id !== selectedProduct.id && (
      selectedProduct.categories.includes('bebidas')
        ? !product.categories.includes('bebidas')
        : product.categories.includes('bebidas')
    )).slice(0, 6)
    : []
  const catalogAddOnProducts = [...catalogExtraProducts, ...complementaryProducts]
  const selectedCatalogExtrasTotal = catalogAddOnProducts.reduce((sum, product) => sum + product.price * (selectedCatalogExtras[product.id] ?? 0), 0)
  const invalidModifierSelection = hasInvalidModifierSelection(detailModifierGroups, selectedExtras)
  const modifierSelectionError = getModifierSelectionError(detailModifierGroups, selectedExtras)
  const toggleProteinExclusion = (optionId: string) => {
    setSelectedExtras(current => {
      const next = { ...current }
      if (next[optionId]) delete next[optionId]
      else next[optionId] = 1
      return next
    })
  }

  const addSelectedProduct = () => {
    if (addingSelectedProductRef.current) return
    if (!editingCartLineKey && blockClosedStoreAdd()) return
    if (selectedProduct) {
      if (loadingModifiers) return
      if (modifierLoadError) {
        setModifierValidationError('No pudimos cargar las opciones. Cierra y vuelve a abrir el producto para intentarlo de nuevo.')
        return
      }
      if (modifierSelectionError) {
        setModifierValidationError(modifierSelectionError.options.length
          ? `Falta una opción obligatoria en “${formatSpanishText(modifierSelectionError.name)}”. Elígela arriba para agregar este plato.`
          : `“${formatSpanishText(modifierSelectionError.name)}” no tiene opciones disponibles. Elige otro producto o contacta al local.`)
        requiredModifierRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
        requiredModifierRef.current?.querySelector<HTMLButtonElement>('.ppdm-chip:not(:disabled)')?.focus({ preventScroll: true })
        return
      }
      if (invalidModifierSelection) {
        setModifierValidationError('Algunas opciones guardadas ya no están disponibles. Límpialas o vuelve al carrito y agrega este producto nuevamente.')
        return
      }
      const isAddingNewProduct = !editingCartLineKey
      if (isAddingNewProduct) {
        addingSelectedProductRef.current = true
        setAddingSelectedProduct(true)
      }
      const chosen = detailModifierGroups.flatMap(group => group.options.filter(option => (selectedExtras[option.id] ?? 0) > 0).map(option => ({ option, quantity: selectedExtras[option.id] })))
      const extrasPrice = chosen.reduce((sum, item) => sum + item.option.price * item.quantity, 0)
      const extras = detailModifierGroups.filter(group => !isIncludedProteinGroup(group))
        .flatMap(group => group.options.filter(option => (selectedExtras[option.id] ?? 0) > 0)
          .map(option => `${formatSpanishText(option.name)}${(selectedExtras[option.id] ?? 0) > 1 ? ` ×${selectedExtras[option.id]}` : ''}${option.price > 0 ? ` (+${money(option.price * (selectedExtras[option.id] ?? 0))})` : ''}`))
      const removedProteins = detailModifierGroups.filter(isIncludedProteinGroup)
        .flatMap(group => group.options.filter(option => !(selectedExtras[option.id] ?? 0)).map(option => formatSpanishText(option.name)))
      const lineNotes = [removedProteins.length ? `Sin: ${removedProteins.join(', ')}` : '', extras.length ? `Extras: ${extras.join(', ')}` : '', detailNotes.trim()].filter(Boolean).join(' · ')
      const modifiers = chosen.map(({ option, quantity }) => ({ optionId: option.id, quantity: quantity ?? 1 }))
      if (!editingCartLineKey) {
        const mainKey = cartLineKey({ productId: selectedProduct.id, notes: lineNotes, modifiers })
        const currentCart = cartRef.current
        const mainExisting = currentCart.find(item => cartLineKey(item) === mainKey)
        const picked = catalogAddOnProducts.filter(product => (selectedCatalogExtras[product.id] ?? 0) > 0)
        const extraRows = picked.map(product => {
          const notes = `Acompañamiento de ${formatProductTitle(selectedProduct.name)}`
          const key = cartLineKey({ productId: product.id, notes, modifiers: [] })
          const samePresentationQuantity = currentCart
            .filter(item => item.productId === product.id)
            .reduce((sum, item) => sum + item.quantity, 0)
          return { key, quantity: detailQuantity * (selectedCatalogExtras[product.id] ?? 0), samePresentationQuantity, existing: currentCart.find(item => cartLineKey(item) === key) }
        })
        const mainPresentationQuantity = currentCart
          .filter(item => item.productId === selectedProduct.id)
          .reduce((sum, item) => sum + item.quantity, 0)
        if (mainPresentationQuantity + detailQuantity > PUBLIC_ORDER_MAX_UNITS_PER_PRESENTATION || extraRows.some(row => row.samePresentationQuantity + row.quantity > PUBLIC_ORDER_MAX_UNITS_PER_PRESENTATION)) {
          setModifierValidationError('Puedes pedir hasta 30 unidades por presentación. Reduce la cantidad o los extras para guardar; tu carrito no cambiará.')
          addingSelectedProductRef.current = false
          setAddingSelectedProduct(false)
          return
        }
        const newRows = Number(!mainExisting) + extraRows.filter(row => !row.existing).length
        if (currentCart.length + newRows > PUBLIC_ORDER_MAX_DISTINCT_LINES) {
          setModifierValidationError('Tu pedido ya tiene 40 productos distintos. Quita uno desde el carrito para hacer espacio; no perderás lo agregado.')
          addingSelectedProductRef.current = false
          setAddingSelectedProduct(false)
          return
        }
      }
      if (editingCartLineKey) {
        const imageUrl = optimizedProductImage(selectedProduct.imageUrl) || undefined
        const editedLine = { productId: selectedProduct.id, productName: formatProductTitle(selectedProduct.name), price: selectedProduct.price + extrasPrice, quantity: detailQuantity, imageUrl, notes: lineNotes || undefined, modifiers }
        const pickedCatalogExtras = catalogAddOnProducts.filter(product => (selectedCatalogExtras[product.id] ?? 0) > 0)
        const currentCart = cartRef.current
        const originalLine = currentCart.find(item => cartLineKey(item) === editingCartLineKey)
        if (!originalLine) {
          setModifierValidationError('No encontramos ese producto en tu carrito. No se guardó ningún cambio.')
          return
        }
        const previousAccompanimentPrefix = `Acompañamiento de ${formatProductTitle(originalLine.productName)}`
        const accompanimentPrefix = `Acompañamiento de ${formatProductTitle(selectedProduct.name)}`
        const nextCart = [
          ...currentCart.filter(item => cartLineKey(item) !== editingCartLineKey && item.notes !== previousAccompanimentPrefix),
          editedLine,
        ]
        for (const product of pickedCatalogExtras) {
          const notes = accompanimentPrefix
          const quantity = detailQuantity * (selectedCatalogExtras[product.id] ?? 0)
          const key = cartLineKey({ productId: product.id, notes, modifiers: [] })
          const existingIndex = nextCart.findIndex(item => cartLineKey(item) === key)
          if (existingIndex >= 0) {
            nextCart[existingIndex] = { ...nextCart[existingIndex], quantity: nextCart[existingIndex].quantity + quantity }
          } else {
            nextCart.push({ productId: product.id, productName: formatProductTitle(product.name), price: product.price, quantity, imageUrl: optimizedProductImage(product.imageUrl) || undefined, notes, modifiers: [] })
          }
        }
        const cartLimitViolation = getPublicCartLimitViolation(nextCart)
        if (cartLimitViolation) {
          setModifierValidationError(cartLimitViolation === 'presentation-quantity'
            ? 'Puedes pedir hasta 30 unidades por presentación. Reduce la cantidad o los extras para guardar; tu carrito no cambiará.'
            : 'Tu pedido permite hasta 40 productos distintos. Quita uno desde el carrito antes de guardar; tus productos actuales se conservarán.')
          return
        }
        commitCart(nextCart)
        setEditingCartLineKey(null)
        closeProductDetail()
        const returnToReviewAfterEdit = returnToConfirmAfterEdit
        setReturnToConfirmAfterEdit(false)
        // Deja que termine la salida del editor antes de volver a montar el
        // contenido del carrito/recibo. Si se cambia el paso durante esos 220ms,
        // ambas vistas y sus animaciones se pisan en escritorio.
        window.setTimeout(() => {
          setClosingCart(false)
          setStep(returnToReviewAfterEdit ? 'confirm' : 'cart')
          const isDesktop = typeof window.matchMedia === 'function' && window.matchMedia(DESKTOP_MEDIA_QUERY).matches
          // En escritorio el carrito normal ya vive en la página; abrir encima
          // otro drawer duplica visualmente filas y recomendaciones al regresar.
          setCartOpen(!isDesktop || returnToReviewAfterEdit)
        }, 240)
      } else {
        const added = addProduct(selectedProduct, detailQuantity, lineNotes, extrasPrice, modifiers, false)
        if (!added) {
          addingSelectedProductRef.current = false
          setAddingSelectedProduct(false)
          return
        }
        const pickedCatalogExtras = catalogAddOnProducts.filter(product => (selectedCatalogExtras[product.id] ?? 0) > 0)
        if (pickedCatalogExtras.length) {
          commitCart(current => {
            let next = [...current]
            for (const product of pickedCatalogExtras) {
              const notes = `Acompañamiento de ${formatProductTitle(selectedProduct.name)}`
              const quantity = detailQuantity * (selectedCatalogExtras[product.id] ?? 0)
              const key = cartLineKey({ productId: product.id, notes, modifiers: [] })
              const existing = next.find(item => cartLineKey(item) === key)
              if (existing) next = next.map(item => cartLineKey(item) === key ? { ...item, quantity: item.quantity + quantity } : item)
              else next.push({ productId: product.id, productName: formatProductTitle(product.name), price: product.price, quantity, imageUrl: optimizedProductImage(product.imageUrl) || undefined, notes, modifiers: [] })
            }
            return next
          })
        }
        // Agregar cierra el detalle: el aviso "Agregado al carrito" queda a la
        // vista y el carrito (tarjeta lateral o botón flotante) muestra lo nuevo.
        closeProductDetail()
        window.setTimeout(() => {
          addingSelectedProductRef.current = false
          setAddingSelectedProduct(false)
        }, 450)
      }
    }
  }

  const editCartItem = (item: WebOrderCartItem) => {
    const group = groups.find(candidate => candidate.variants.some(variant => variant.product.id === item.productId))
    if (!group) return
    const isDesktop = typeof window.matchMedia === 'function' && window.matchMedia(DESKTOP_MEDIA_QUERY).matches
    setEditingCartLineKey(cartLineKey(item))
    setReturnToConfirmAfterEdit(step === 'confirm')
    setCartOpen(!isDesktop)
    setStep('cart')
    const savedModifiers = item.modifiers
      ? Object.fromEntries(item.modifiers.map(modifier => [modifier.optionId, modifier.quantity]))
      : undefined
    openGroup(group, undefined, item.productId, savedModifiers)
    setDetailQuantity(item.quantity)
    const accompanimentNote = `Acompañamiento de ${formatProductTitle(item.productName)}`
    const savedCatalogExtras = Object.fromEntries(
      extrasProducts.concat(products)
        .filter(product => product.categories.includes('extras') || product.categories.includes('bebidas'))
        .flatMap(product => {
          const companion = cart.find(candidate => candidate.productId === product.id && candidate.notes === accompanimentNote)
          return companion ? [[product.id, Math.max(1, Math.floor(companion.quantity / item.quantity))] as const] : []
        }),
    )
    setSelectedCatalogExtras(savedCatalogExtras)
    const savedNotes = item.notes || ''
    const userNotes = savedNotes.replace(/^Sin: [^·]+(?: · |$)/, '').replace(/^Extras: .*?(?: · |$)/, '')
    setDetailNotes(userNotes)
  }

  const requestCurrentLocation = () => {
    if (!navigator.geolocation) {
      setLocationError('Este navegador no permite obtener tu ubicación automáticamente. Puedes buscar tu dirección o elegir el punto en el mapa.')
      return
    }
    setError('')
    setLocationError('')
    const requestId = ++addressActionRef.current
    if (addressSearchTimer.current) clearTimeout(addressSearchTimer.current)
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        if (addressActionRef.current !== requestId) return
        const { latitude: lat, longitude: lng } = pos.coords
        setGeoCoords({ lat, lng })
        setAddressMethod('gps')
        setLocationError('')
        setAddressFieldError('')
        try {
          const formattedAddress = await reverseGoogleAddress({ lat, lng })
          if (addressActionRef.current !== requestId) return
          if (formattedAddress) {
            setAddress(formattedAddress.length > 120 ? `${formattedAddress.substring(0, 120)}…` : formattedAddress)
            setShowSuggestions(false)
          } else setAddress(`Ubicación seleccionada (${lat.toFixed(5)}, ${lng.toFixed(5)})`)
        } catch { if (addressActionRef.current === requestId) { setAddress(`Ubicación actual (${lat.toFixed(5)}, ${lng.toFixed(5)})`); setShowSuggestions(false) } }
        if (addressActionRef.current === requestId) setLocating(false)
      },
      (positionError) => {
        if (addressActionRef.current !== requestId) return
        setLocating(false)
        const message = positionError.code === positionError.PERMISSION_DENIED
          ? 'No diste permiso para compartir tu ubicación. Puedes buscar tu dirección o elegir el punto en el mapa.'
          : positionError.code === positionError.POSITION_UNAVAILABLE
            ? 'El dispositivo no pudo determinar tu ubicación. Puedes buscar tu dirección o elegir el punto en el mapa.'
            : 'La ubicación tardó demasiado en responder. Puedes buscar tu dirección o elegir el punto en el mapa.'
        setLocationError(message)
      },
      { enableHighAccuracy: true, timeout: 10000 }
    )
  }

  const searchAddress = (query: string) => {
    setError('')
    setLocationError('')
    const requestId = ++addressActionRef.current
    setLocating(false)
    setAddress(query)
    setShowSuggestions(true)
    setGeoCoords(null)
    setAddressMethod(null)
    setAddressFieldError(value => value === 'reference' ? value : '')
    if (addressSearchTimer.current) clearTimeout(addressSearchTimer.current)
    if (query.trim().length < 4) { setAddressSuggestions([]); setSearchingAddress(false); return }
    addressSearchTimer.current = setTimeout(async () => {
      if (addressActionRef.current !== requestId) return
      setSearchingAddress(true)
      try {
        const origin = deliverySettings?.originLat != null && deliverySettings.originLng != null
          ? { lat: deliverySettings.originLat, lng: deliverySettings.originLng }
          : undefined
        const suggestions = await searchGoogleAddresses(query, origin)
        if (addressActionRef.current === requestId) setAddressSuggestions(suggestions)
      } catch (searchError) {
        if (addressActionRef.current === requestId) {
          setAddressSuggestions([])
          setLocationError(searchError instanceof Error ? searchError.message : 'No se pudo buscar la dirección en Google Maps.')
        }
      }
      finally { if (addressActionRef.current === requestId) setSearchingAddress(false) }
    }, 350)
  }

  const clearAddress = () => {
    searchAddress('')
    setShowSuggestions(false)
    setAddressSuggestions([])
    setAddressFieldError('')
    addressRef.current?.focus()
  }

  useEffect(() => () => { if (addressSearchTimer.current) clearTimeout(addressSearchTimer.current) }, [])

  const selectSuggestion = (s: { display_name: string; lat: string; lon: string }) => {
    setError('')
    setLocationError('')
    addressActionRef.current += 1
    setLocating(false)
    setAddress(s.display_name.length > 120 ? s.display_name.substring(0, 120) + '…' : s.display_name)
    setGeoCoords({ lat: parseFloat(s.lat), lng: parseFloat(s.lon) })
    setAddressMethod('search')
    setAddressFieldError(value => value === 'reference' ? value : '')
    setShowSuggestions(false)
    setAddressSuggestions([])
  }

  const selectMapLocation = async (coordinates: MapCoordinates) => {
    setError('')
    setLocationError('')
    const requestId = ++addressActionRef.current
    setLocating(false)
    setGeoCoords(coordinates)
    setAddressMethod('map')
    setAddressFieldError(value => value === 'reference' ? value : '')
    setShowSuggestions(false)
    try {
      const formattedAddress = await reverseGoogleAddress(coordinates)
      if (addressActionRef.current !== requestId) return
      if (formattedAddress) setAddress(formattedAddress.length > 120 ? `${formattedAddress.substring(0, 120)}…` : formattedAddress)
    } catch {
      if (addressActionRef.current !== requestId) return
      setAddress(`Ubicación seleccionada (${coordinates.lat.toFixed(5)}, ${coordinates.lng.toFixed(5)})`)
    }
  }

  const continueFromAddress = () => {
    if (address.trim().length < 8) return showAddressFieldError('address')
    if (!geoCoords) return showAddressFieldError('geo')
    if (orderType === 'delivery' && !addressReference.trim()) return showAddressFieldError('reference')
    if (orderType === 'delivery' && (deliverySettingsStatus !== 'ready' || deliveryQuoteStatus !== 'ready' || deliveryCoverageUnavailable)) return
    setAddressFieldError('')
    setStep('details')
  }

  const continueToConfirmation = () => {
    setError('')
    setFieldError('')
    if (name.trim().length < 2) return showFieldError('name')
    if (!isValidPublicIdentification(identification)) return showFieldError('identification')
    const normalizedPhone = normalizeVenezuelanPhone(phone)
    if (!normalizedPhone) return showFieldError('phone')
    if (normalizedPhone !== phone) setPhone(normalizedPhone)
    if (orderType === 'delivery' && (address.trim().length < 8 || !geoCoords || !addressReference.trim())) {
      setStep('address')
      if (address.trim().length < 8) return showAddressFieldError('address')
      if (!geoCoords) return showAddressFieldError('geo')
      return showAddressFieldError('reference')
    }
    if (orderType === 'delivery' && (deliveryQuoteStatus !== 'ready' || !deliverySettings?.enabled || !deliveryEstimate || deliveryEstimate.fee == null)) {
      setStep('address')
      setError('No podemos confirmar el costo de entrega para esa ubicación. Revisa el punto en el mapa o elige retiro en el local.')
      return
    }
    if (!cart.length) return setError('Tu carrito está vacío.')
    setStep('confirm')
  }

  const returnToMenuAfterSent = () => {
    startNewOrder()
    setCurrentTab('menu')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const submitOrder = async () => {
    if (submitLockRef.current || submitting) return
    if (blockClosedStoreAdd()) return
    setError('')
    setFieldError('')
    if (name.trim().length < 2) { setStep('details'); return showFieldError('name') }
    if (!isValidPublicIdentification(identification)) { setStep('details'); return showFieldError('identification') }
    const normalizedPhone = normalizeVenezuelanPhone(phone)
    if (!normalizedPhone) { setStep('details'); return showFieldError('phone') }
    if (payMode === 'mixed' && payPrimary === paySecondary) { setStep('details'); setError('Elige dos métodos de pago distintos para el pago mixto.'); return }
    if (orderType === 'delivery' && deliverySettings?.enabled === false) { setStep('delivery'); setError('El delivery no está disponible por ahora. Elige retiro en el local.'); return }
    if (orderType === 'delivery') {
      if (address.trim().length < 8) { setStep('address'); return showAddressFieldError('address') }
      if (!geoCoords) { setStep('address'); return showAddressFieldError('geo') }
      if (!addressReference.trim()) { setStep('address'); return showAddressFieldError('reference') }
    }
    if (!cart.length) return setError('Tu carrito está vacío.')
    if (!LOCAL_ORDER_TEST_MODE && publicWhatsappPhone.length < 7) {
      setError('No podemos registrar el pedido porque el WhatsApp de Full China no está configurado. Inténtalo más tarde o contáctanos por otro medio.')
      return
    }
    if (orderType === 'delivery' && (deliveryQuoteStatus !== 'ready' || !deliverySettings?.enabled || !deliveryEstimate || deliveryEstimate.fee == null)) {
      setStep('address')
      setError('No podemos confirmar el costo de entrega para esa ubicación. Revisa el punto en el mapa o elige retiro en el local.')
      return
    }

    if (LOCAL_ORDER_TEST_MODE) {
      const testOrderCode = `PRUEBA-${crypto.randomUUID().slice(0, 6).toUpperCase()}`
      const linkedToProfile = recordLocalOrderTestOrder({
        orderNumber: testOrderCode,
        orderType,
        customerName: name.trim(),
        customerPhone: normalizedPhone,
        customerIdentification: identification.trim().toUpperCase(),
        deliveryAddress: address.trim() || null,
        customerNotes: [notes.trim(), orderType === 'delivery' ? deliveryNotes.trim() : ''].filter(Boolean).join(' · '),
        items: cart,
      })
      setLocalTestOrderLinkedToProfile(linkedToProfile)
      setOrderCode(testOrderCode)
      setSubmitting(false)
      submitLockRef.current = false
      setStep('sent')
      return
    }

    const lineNotes = cart.filter(item => item.notes).map(item => `${item.productName}: ${item.notes}`).join(' | ')
    // El link de Google Maps con las coordenadas va en su propia línea para que
    // Comandas lo muestre como "Ver ubicación" (y lo limpie del texto de notas).
    const mapsLine = orderType === 'delivery' && geoCoords
      ? `\nUbicación GPS: https://maps.google.com/?q=${geoCoords.lat},${geoCoords.lng}`
      : ''
    // Método de pago que el cliente indica. Va en su propia línea con códigos
    // para que Comandas lo pre-seleccione al cobrar (y lo limpie del texto).
    const paymentCodes = payMode === 'mixed' ? `${payPrimary}+${paySecondary}` : payPrimary
    const payLine = `\nPago preferido: ${paymentCodes}`
    // La referencia es obligatoria en delivery: va como metadato para que el
    // recorte a 500 caracteres nunca la pierda.
    const referenceLine = orderType === 'delivery' && addressReference.trim() ? `\nReferencia: ${addressReference.trim()}` : ''
    const primaryNotes = [
      notes.trim() ? `Cocina: ${notes.trim()}` : '',
      orderType === 'delivery' && deliveryNotes.trim() ? `Repartidor: ${deliveryNotes.trim()}` : '',
      lineNotes ? `Personalizaciones: ${lineNotes}` : '',
    ].filter(Boolean).join(' · ')
    const pickupLine = orderType === 'takeaway' ? `\nHora de retiro: ${describePickupTime(pickupTime)}` : ''
    const orderNotes = appendRequiredOrderMetadata(primaryNotes, `${referenceLine}${mapsLine}${payLine}${pickupLine}`)
    const checkoutSignature = JSON.stringify({
      cart: cart.map(item => ({ productId: item.productId, quantity: item.quantity, price: item.price, notes: item.notes || '', modifiers: item.modifiers ?? [] })),
      name: name.trim(), phone: normalizedPhone, identification: identification.trim().toUpperCase(), bcvRate, orderType, address: address.trim(), orderNotes,
      deliveryFee, deliveryLat: geoCoords?.lat ?? null, deliveryLng: geoCoords?.lng ?? null,
    })
    const savedAttempt = checkoutAttemptRef.current?.signature === checkoutSignature ? checkoutAttemptRef.current : null
    const idempotencyKey = savedAttempt?.key || crypto.randomUUID()
    checkoutAttemptRef.current = { signature: checkoutSignature, key: idempotencyKey }
    try { sessionStorage.setItem(CHECKOUT_ATTEMPT_KEY, JSON.stringify(checkoutAttemptRef.current)) } catch { /* storage unavailable */ }
    submitLockRef.current = true
    setSubmitting(true)
    // La petición dura pocos segundos: el cliente se queda en la revisión con el
    // botón en "Enviando pedido…" y pasa directo a "¡Pedido recibido!".
    try {
      const result = await createWebOrder({
        customerName: name.trim(), customerPhone: normalizedPhone, customerIdentification: identification.trim().toUpperCase(), orderType,
        deliveryAddress: address.trim(), notes: orderNotes, items: cart, bcvRate,
        idempotencyKey, deliveryFee, deliveryLat: geoCoords?.lat, deliveryLng: geoCoords?.lng,
      })
      if (result.legacyReview) {
        setOrderCode(result.code)
        setError('Encontramos una solicitud anterior con ese código y no la reenviamos para evitar duplicar el pedido. Comunícate con Full China para revisarla.')
        setStep('confirm')
        return
      }
      if (result.priceChanged) {
        const repricedCart = cart.map((item, index) => {
          const current = result.items?.find(line => line.lineNumber === index + 1 && line.productId === item.productId)
          return current ? { ...item, price: current.unitPrice } : item
        })
        commitCart(repricedCart)
        if (orderType === 'delivery' && result.deliveryFee != null && geoCoords) {
          setServerDeliveryFeeOverride({ lat: geoCoords.lat, lng: geoCoords.lng, fee: result.deliveryFee })
        }
        checkoutAttemptRef.current = null
        try { sessionStorage.removeItem(CHECKOUT_ATTEMPT_KEY) } catch { /* storage unavailable */ }
        setError('Actualizamos los precios vigentes del menú. Revisa el nuevo total y vuelve a confirmar para registrar el pedido.')
        setStep('confirm')
        return
      }
      const pricedCart = cart.map((item, index) => {
        const current = result.items?.find(line => line.lineNumber === index + 1 && line.productId === item.productId)
        return current ? { ...item, price: current.unitPrice } : item
      })
      try { localStorage.setItem(LAST_ORDER_KEY, JSON.stringify(pricedCart)) } catch { /* el pedido ya está registrado; no depende del almacenamiento local */ }
      checkoutAttemptRef.current = null
      try { sessionStorage.removeItem(CHECKOUT_ATTEMPT_KEY) } catch { /* storage unavailable */ }
      setLastOrder(pricedCart)
      // El resumen de "sent" se conserva aparte; el carrito se vacía para que no se pueda reenviar.
      setSentSummary({ items: pricedCart, total: pricedCart.reduce((sum, item) => sum + item.price * item.quantity, 0) + deliveryFee, orderType, address: address.trim(), phone: normalizedPhone })
      commitCart([])
      try { localStorage.removeItem(CART_KEY) } catch { /* el pedido ya está registrado */ }
      setOrderCode(result.code)
      try { localStorage.setItem(WHATSAPP_SENT_KEY, JSON.stringify({ code: result.code, sentAt: Date.now() })) } catch { /* el pedido ya está registrado; no depende del almacenamiento local */ }
      setStep('sent')
    } catch (cause) {
      setError(describeWebOrderError(cause))
      setStep('confirm')
    } finally {
      submitLockRef.current = false
      setSubmitting(false)
    }
  }

  // Monto en Bs (referencia) calculado con la tasa BCV actual. null si no hay tasa.
  const priceBs = (usd: number) =>
    bcvRate ? `Bs. ${BS_FORMATTER.format(usd * bcvRate)}` : null

  const renderProductCard = (group: MenuProductGroup, priority = false) => <ProductCard key={group.key} group={group} priority={priority} favoriteIds={favoriteIds} openProductFromCard={openProductFromCard} openProductFromCardKeyboard={openProductFromCardKeyboard} pendingQuickAdds={pendingQuickAdds} priceBs={priceBs} requestQuickAdd={requestQuickAdd} stopProductCardInteraction={stopProductCardInteraction} toggleFavorite={toggleFavorite} />

  const renderDesktopProductCard = (group: MenuProductGroup) => <DesktopProductCard key={group.key} group={group} changeCardQty={changeCardQty} favoriteIds={favoriteIds} getCardQty={getCardQty} handleCardAdd={handleCardAdd} openProductFromCard={openProductFromCard} openProductFromCardKeyboard={openProductFromCardKeyboard} pendingQuickAdds={pendingQuickAdds} priceBs={priceBs} stopProductCardInteraction={stopProductCardInteraction} toggleFavorite={toggleFavorite} />

  const renderDesktopPromoCard = (group: MenuProductGroup) => <DesktopPromoCard key={group.key} group={group} handleCardAdd={handleCardAdd} openProductFromCard={openProductFromCard} openProductFromCardKeyboard={openProductFromCardKeyboard} pendingQuickAdds={pendingQuickAdds} stopProductCardInteraction={stopProductCardInteraction} />

  const contactViewProps = {
    pageSettings,
    formattedOpenTime,
    formattedCloseTime,
    publicWhatsappPhone,
    publicInstagramUrl,
    publicFacebookUrl,
    mapPreviewUrl,
    currentInstagramReels,
    instagramReels,
    instagramActiveIndex,
    instagramAudioEnabled,
    instagramPlaybackStarted,
    instagramDesktopPlaybackConfirmed,
    instagramPaused,
    toggleInstagramAudio,
    toggleInstagramPlayback,
    startInstagramReelWithSound,
    handleInstagramProfileClick,
    setInstagramPaused,
    setInstagramActiveIndex,
    setInstagramDesktopPlaybackConfirmed,
    openCustomerProfile,
  }
  return (
    <main
      ref={pageRef}
      className={`public-menu-page ${cartOpen ? 'has-public-drawer' : ''} ${currentTab === 'perfil' ? 'public-profile-tab-active' : ''}`}
      style={{ '--cat-accent': accentRgb } as CSSProperties}
      onLoadCapture={handleImageLoad}
      onErrorCapture={handleImageError}
    >
      {/* Top Navbar */}
      <PublicTopBar bcvRate={bcvRate} currentTab={currentTab} formattedCloseTime={formattedCloseTime} isStoreOpen={isStoreOpen} openCustomerProfile={openCustomerProfile} setCurrentTab={setCurrentTab} showDesktopMenu={showDesktopMenu} storeScheduleLabel={storeScheduleLabel} />

      {/* =========================================================================
          MOBILE VIEWPORT (< 1280px) — 100% ORIGINAL f88d057 LAYOUT
          ========================================================================= */}
      <PublicMobileView activeCategory={activeCategory} bcvRate={bcvRate} cartOpen={cartOpen} categories={categories} categorySections={categorySections} closeSearch={closeSearch} contactViewProps={contactViewProps} currentTab={currentTab} error={error} favoriteIds={favoriteIds} formattedCloseTime={formattedCloseTime} handleRecommendedWheel={handleRecommendedWheel} hasLeftMobileMenu={hasLeftMobileMenu} hasVisitedProfile={hasVisitedProfile} heroSearchRef={heroSearchRef} isDesktopViewport={isDesktopViewport} isLoyaltyRecommended={isLoyaltyRecommended} isStoreOpen={isStoreOpen} loading={loading} moveRecommended={moveRecommended} openCustomerProfile={openCustomerProfile} openGroup={openGroup} pageSettings={pageSettings} pauseRecommendedAutoplay={pauseRecommendedAutoplay} priceBs={priceBs} products={products} recommendedGroup={recommendedGroup} recommendedImageSrc={recommendedImageSrc} recommendedIndex={recommendedIndex} recommendedSlideCount={recommendedSlideCount} recommendedSlides={recommendedSlides} recommendedSwipeStart={recommendedSwipeStart} recommendedVariant={recommendedVariant} recommendedWasSwiped={recommendedWasSwiped} renderProductCard={renderProductCard} repeatPreviousOrder={repeatPreviousOrder} resumeRecommendedAutoplay={resumeRecommendedAutoplay} retryPublicCatalog={retryPublicCatalog} search={search} setActiveCategory={setActiveCategory} setCurrentTab={setCurrentTab} setError={setError} setHasLeftMobileMenu={setHasLeftMobileMenu} setRecommendedImageSrc={setRecommendedImageSrc} setRequestedRecommendedIndex={setRequestedRecommendedIndex} setSearch={setSearch} setShowFavorites={setShowFavorites} setShowSearch={setShowSearch} showFavorites={showFavorites} showSearch={showSearch} storeScheduleLabel={storeScheduleLabel} toggleFavorite={toggleFavorite} visibleGroups={visibleGroups} />

      {/* =========================================================================
          DESKTOP VIEWPORT (>= 1280px) — 2-COLUMN PRO LAYOUT
          ========================================================================= */}
      <PublicDesktopLayout activeCategory={activeCategory} address={address} canScrollPopular={canScrollPopular} cart={cart} cartPulse={cartPulse} categories={categories} categorySections={categorySections} contactViewProps={contactViewProps} currentTab={currentTab} deletingKeys={deletingKeys} deliveryFeeText={deliveryFeeText} desktopHeroSlide={desktopHeroSlide} editCartItem={editCartItem} error={error} favoriteIds={favoriteIds} getCartIncludedCopy={getCartIncludedCopy} handleRemoveSidebarItem={handleRemoveSidebarItem} homeSearchSuggestions={homeSearchSuggestions} homeSearchTerm={homeSearchTerm} isDesktopViewport={isDesktopViewport} itemCount={itemCount} loading={loading} openCartFromSidebar={openCartFromSidebar} openCustomerProfile={openCustomerProfile} openGroup={openGroup} orderTotal={orderTotal} orderType={orderType} pageSettings={pageSettings} pendingQuickAdds={pendingQuickAdds} popularGroups={popularGroups} popularScrollRef={popularScrollRef} priceBs={priceBs} products={products} promoGroups={promoGroups} recommendations={recommendations} renderDesktopProductCard={renderDesktopProductCard} renderDesktopPromoCard={renderDesktopPromoCard} renderProductCard={renderProductCard} repeatPreviousOrder={repeatPreviousOrder} requestQuickAdd={requestQuickAdd} retryPublicCatalog={retryPublicCatalog} scrollPopular={scrollPopular} search={search} setActiveCategory={setActiveCategory} setCartOpen={setCartOpen} setDesktopHeroPaused={setDesktopHeroPaused} setDesktopHeroSlide={setDesktopHeroSlide} setOrderType={setOrderType} setReturnToConfirmAfterEdit={setReturnToConfirmAfterEdit} setSearch={setSearch} setShowAllExtras={setShowAllExtras} setShowFavorites={setShowFavorites} setSidebarRecoIndex={setSidebarRecoIndex} setStep={setStep} showDesktopMenu={showDesktopMenu} showFavorites={showFavorites} sidebarCardRef={sidebarCardRef} sidebarHasOverflow={sidebarHasOverflow} sidebarRecoIndex={sidebarRecoIndex} sidebarRecoTimer={sidebarRecoTimer} submitting={submitting} toggleFavorite={toggleFavorite} total={total} updateQuantity={updateQuantity} visibleGroups={visibleGroups} />

      <footer className="public-credits-footer">
        <span>Diseñado y desarrollado por</span>{' '}
        <a href="https://www.instagram.com/somosdostudio?vrfl=YmV5N2ZrY3FrM2th" aria-label="Abrir el perfil de SomosDos Studio en Instagram">
          SomosDos Studio
        </a>
      </footer>

      {/* Floating Cart FAB for Mobile */}
      {itemCount > 0 && !cartOpen && currentTab !== 'contacto' && currentTab !== 'perfil' && (
        <div className="public-cart-fab-wrap">
          <span className="public-cart-fab-tooltip">
            Toca aquí para ver tu pedido <ChevronRight size={14} />
          </span>
          <button className="public-cart-fab" onClick={() => { setReturnToConfirmAfterEdit(false); openCartFromSidebar('cart') }}>
            <ShoppingCart size={24} />
            <span className="public-cart-fab-badge">{itemCount}</span>
          </button>
        </div>
      )}

      {/* Add-to-cart mini-toast */}
      {addFeedback && (
        <div className={`public-add-toast ${addFeedback.status === 'checking' ? 'is-pending' : ''} ${addFeedbackClosing ? 'closing' : ''}`} role="status" aria-live="polite">
          <span className="public-add-toast-img" aria-hidden="true">
            {addFeedback.imageUrl ? <img src={addFeedback.imageUrl} alt="" /> : <ShoppingBag size={16} />}
          </span>
          <span className="public-add-toast-copy">
            <strong className="public-add-toast-label">{addFeedback.status === 'checking' ? 'Revisando opciones…' : 'Agregado al carrito'}</strong>
            <span className="public-add-toast-name">{addFeedback.name}</span>
          </span>
          <span className="public-add-toast-check">{addFeedback.status === 'checking' ? <LoaderCircle size={16} className="public-add-toast-spinner" /> : <CircleCheck size={16} />}</span>
          {addFeedback.status === 'added' && !window.matchMedia(DESKTOP_SIDEBAR_MEDIA_QUERY).matches && (
            <button type="button" className="public-add-toast-action" onClick={() => { setAddFeedback(null); setReturnToConfirmAfterEdit(false); openCartFromSidebar('cart') }}>
              Ver carrito
            </button>
          )}
        </div>
      )}

      {quickVariantGroup && <QuickVariantDialog closeQuickVariant={closeQuickVariant} closingQuickVariant={closingQuickVariant} confirmingQuickVariant={confirmingQuickVariant} confirmQuickVariant={confirmQuickVariant} openQuickProteinDialog={openQuickProteinDialog} personalizeQuickVariant={personalizeQuickVariant} priceBs={priceBs} quickSelectedVariant={quickSelectedVariant} quickVariantGroup={quickVariantGroup} quickVariantHasModifiers={quickVariantHasModifiers} quickVariantId={quickVariantId} quickVariantOptionsLabel={quickVariantOptionsLabel} quickVariantProteinGroup={quickVariantProteinGroup} quickVariantQuantity={quickVariantQuantity} setQuickVariantId={setQuickVariantId} setQuickVariantQuantity={setQuickVariantQuantity} />}

      {quickProteinDialogOpen && quickVariantProteinGroup && quickSelectedVariant && <QuickProteinDialog applyQuickProteinDraft={applyQuickProteinDraft} quickSelectedVariant={quickSelectedVariant} quickVariantGroup={quickVariantGroup} quickVariantProteinDraft={quickVariantProteinDraft} quickVariantProteinGroup={quickVariantProteinGroup} setQuickProteinDialogOpen={setQuickProteinDialogOpen} toggleQuickProteinDraft={toggleQuickProteinDraft} />}

      {selectedGroup && selectedProduct && <ProductDetailDialog addingSelectedProduct={addingSelectedProduct} addSelectedProduct={addSelectedProduct} catalogExtraProducts={catalogExtraProducts} closeProductDetail={closeProductDetail} closingDetail={closingDetail} complementaryProducts={complementaryProducts} detailExtrasTotal={detailExtrasTotal} detailModifierGroups={detailModifierGroups} detailNotes={detailNotes} detailNotesRef={detailNotesRef} detailOrigin={detailOrigin} detailQuantity={detailQuantity} editingCartLineKey={editingCartLineKey} invalidModifierSelection={invalidModifierSelection} loadingModifiers={loadingModifiers} modifierLoadError={modifierLoadError} modifierRequestRef={modifierRequestRef} modifierSelectionError={modifierSelectionError} modifierValidationError={modifierValidationError} priceBs={priceBs} requiredModifierRef={requiredModifierRef} selectedCatalogExtras={selectedCatalogExtras} selectedCatalogExtrasTotal={selectedCatalogExtrasTotal} selectedExtras={selectedExtras} selectedGroup={selectedGroup} selectedProduct={selectedProduct} selectedVariantId={selectedVariantId} setDetailModifierGroups={setDetailModifierGroups} setDetailNotes={setDetailNotes} setDetailQuantity={setDetailQuantity} setLoadingModifiers={setLoadingModifiers} setModifierLoadError={setModifierLoadError} setModifierValidationError={setModifierValidationError} setSelectedCatalogExtras={setSelectedCatalogExtras} setSelectedExtras={setSelectedExtras} setSelectedVariantId={setSelectedVariantId} showModifierGuidance={showModifierGuidance} toggleProteinExclusion={toggleProteinExclusion} />}

      {cartOpen && createPortal(
        <div className={`public-drawer-backdrop ${closingCart ? 'closing' : ''}`} onClick={closeCart}><aside className={`public-cart-drawer ${step === 'details' ? 'public-data-drawer' : ''} public-step-${step}${step === 'details' && autofillingDetails ? ' is-autofilling' : ''}`} onClick={event => event.stopPropagation()}>
        <header className="public-review-header">{step !== 'sent' && <button className="public-review-back" onClick={() => { if (step === 'details') { setStep(orderType === 'delivery' ? 'address' : 'pickup'); } else if (step === 'confirm') { setStep('details'); } else if (step === 'address' || step === 'pickup') { setStep('delivery'); } else if (step === 'delivery') { if (window.matchMedia(DESKTOP_SIDEBAR_MEDIA_QUERY).matches) { closeCart(); } else { setStep('cart'); } } else { closeCart(); } }} aria-label="Volver"><ChevronRight /></button>}<img src="/optimized/root/logo.webp" alt="Full China" />{step !== 'sent' && <div className="public-review-heading"><h2><ShoppingBag size={20} className="public-review-heading-icon" /> {step === 'delivery' ? '¿Cómo quieres recibirlo?' : step === 'pickup' ? 'Retira en Full China' : step === 'address' ? '¿Dónde te lo llevamos?' : step === 'details' ? 'Tus datos' : step === 'confirm' ? 'Revisa y confirma tu pedido' : 'Tu pedido'}</h2><p>{step === 'delivery' ? 'Elige delivery o retiro en el local.' : step === 'pickup' ? 'Dirección y horario para retirar tu pedido.' : step === 'address' ? 'Busca tu dirección o márcala en el mapa.' : step === 'details' ? 'Déjanos tus datos para preparar el pedido.' : step === 'confirm' ? 'Revisa los datos y el total antes de enviarlo.' : 'Revisa tus productos y ajusta cantidades.'}</p></div>}</header>
        {cartGuardMessage && <div className={`public-cart-guard ${cartGuardClosing ? 'closing' : ''}`} role="alert"><CircleAlert /><div><strong>Tu carrito está vacío</strong><span>{cartGuardMessage}</span></div></div>}
        {step === 'cart' && error && <Toast type="error" message={error} onClose={() => setError('')} />}
        {step === 'cart' && <CartStep cart={cart} cartCarouselGroups={cartCarouselGroups} closeCart={closeCart} deliveryChosen={deliveryChosen} editCartItem={editCartItem} getCartIncludedCopy={getCartIncludedCopy} orderType={orderType} priceBs={priceBs} requestQuickAdd={requestQuickAdd} requireCart={requireCart} setCurrentTab={setCurrentTab} setShowAllExtras={setShowAllExtras} setStep={setStep} total={total} updateQuantity={updateQuantity} />}
        {step === 'delivery' && <DeliveryStep addressActionRef={addressActionRef} cart={cart} deliveryDisabled={deliveryDisabled} orderType={orderType} requestCurrentLocation={requestCurrentLocation} setDeliveryChosen={setDeliveryChosen} setLocating={setLocating} setOrderType={setOrderType} setStep={setStep} />}

        {step === 'pickup' && <PickupStep cart={cart} formattedCloseTime={formattedCloseTime} formattedOpenTime={formattedOpenTime} mapPreviewUrl={mapPreviewUrl} pageSettings={pageSettings} pickupSlots={pickupSlots} pickupTime={pickupTime} setPickupTime={setPickupTime} setStep={setStep} />}
        {step === 'address' && <AddressStep address={address} addressFieldError={addressFieldError} addressMethod={addressMethod} addressRef={addressRef} addressReference={addressReference} addressSelectedRef={addressSelectedRef} addressSuggestions={addressSuggestions} cart={cart} clearAddress={clearAddress} continueFromAddress={continueFromAddress} deliveryCoverageUnavailable={deliveryCoverageUnavailable} deliveryEstimate={deliveryEstimate} deliveryFee={deliveryFee} deliveryNotes={deliveryNotes} deliveryQuoteStatus={deliveryQuoteStatus} deliveryRoute={deliveryRoute} deliverySettings={deliverySettings} deliverySettingsStatus={deliverySettingsStatus} geoCoords={geoCoords} locating={locating} locationError={locationError} locationErrorRef={locationErrorRef} readableAddress={readableAddress} referenceRef={referenceRef} requestCurrentLocation={requestCurrentLocation} searchAddress={searchAddress} searchingAddress={searchingAddress} selectMapLocation={selectMapLocation} selectSuggestion={selectSuggestion} setAddressFieldError={setAddressFieldError} setAddressReference={setAddressReference} setDeliveryChosen={setDeliveryChosen} setDeliveryNotes={setDeliveryNotes} setDeliveryRetryVersion={setDeliveryRetryVersion} setDeliverySettingsRetryVersion={setDeliverySettingsRetryVersion} setOrderType={setOrderType} setStep={setStep} showSuggestions={showSuggestions} />}
        {step === 'details' && <DetailsStep continueToConfirmation={continueToConfirmation} customerDetailsAutofilled={customerDetailsAutofilled} customerDetailsTouched={customerDetailsTouched} fieldError={fieldError} identification={identification} identificationRef={identificationRef} idPrefix={idPrefix} name={name} nameRef={nameRef} notes={notes} payMode={payMode} payPrimary={payPrimary} paySecondary={paySecondary} phone={phone} phoneRef={phoneRef} setFieldError={setFieldError} setIdentification={setIdentification} setIdPrefix={setIdPrefix} setName={setName} setNotes={setNotes} setPayMode={setPayMode} setPayPrimary={setPayPrimary} setPaySecondary={setPaySecondary} setPhone={setPhone} submitting={submitting} />}
        {step === 'confirm' && <ConfirmStep address={address} addressReference={addressReference} cart={cart} closeCart={closeCart} deliveryFeeText={deliveryFeeText} deliveryNotes={deliveryNotes} editCartItem={editCartItem} error={error} getCartIncludedCopy={getCartIncludedCopy} name={name} notes={notes} orderCode={orderCode} orderTotal={orderTotal} orderType={orderType} payMode={payMode} payPrimary={payPrimary} paySecondary={paySecondary} phone={phone} pickupTime={pickupTime} priceBs={priceBs} setError={setError} setStep={setStep} submitOrder={submitOrder} submitting={submitting} total={total} />}
        {step === 'sent' && <SentStep address={address} cart={cart} localTestOrderLinkedToProfile={localTestOrderLinkedToProfile} orderCode={orderCode} orderTotal={orderTotal} orderType={orderType} phone={phone} pickupTime={pickupTime} returnToMenuAfterSent={returnToMenuAfterSent} sentSummary={sentSummary} />}
        {showAllExtras && step === 'cart' && <CartExtrasCatalog closeAllExtras={closeAllExtras} closeCart={closeCart} closingAllExtras={closingAllExtras} extrasSearch={extrasSearch} extrasSections={extrasSections} openGroup={openGroup} priceBs={priceBs} requestQuickAdd={requestQuickAdd} setExtrasSearch={setExtrasSearch} />}
      </aside></div>,
        document.body
      )}

      {showStoreClosedNotice && <StoreClosedNotice formattedCloseTime={formattedCloseTime} formattedOpenTime={formattedOpenTime} pageSettings={pageSettings} setShowStoreClosedNotice={setShowStoreClosedNotice} storeClosedNoticeButtonRef={storeClosedNoticeButtonRef} />}

      {showWelcomeNotice && createPortal(
        <PublicMenuWelcomeModal
          dontShowAgain={dontShowWelcomeAgain}
          onDontShowAgainChange={setDontShowWelcomeAgain}
          onContinue={dismissWelcomeNotice}
          buttonRef={welcomeNoticeButtonRef}
          closing={closingWelcomeNotice}
        />,
        document.body
      )}
    </main>
  )
}
