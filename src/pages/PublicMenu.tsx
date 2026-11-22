import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import { ChevronRight, CircleAlert, CircleCheck, LoaderCircle, ShoppingBag, ShoppingCart } from 'lucide-react'
import { type MenuProductGroup } from '../lib/menuGrouping'
import { type WebOrderCartItem } from '../lib/publicOrders'
import { type DeliveryEstimate, type DeliveryRoute, type DeliverySettings } from '../lib/delivery'
import { PUBLIC_ORDER_MIN_SUBTOTAL, getPublicCartLimitViolation } from '../lib/publicOrderRules'
import { type ProductModifierGroup } from '../lib/dataService'
import type { Product } from '../lib/dataService'
import { PublicMenuWelcomeModal } from '../components/PublicMenuWelcomeModal'
import { consumePublicMenuWelcomeDismissal } from '../lib/publicMenuWelcome'
import { DEFAULT_PUBLIC_ORDER_PAGE_SETTINGS, type PublicOrderPageSettings } from '../lib/publicOrderPageSettings'
import { startPublicMenuDataChangeFeed, stopPublicMenuDataChangeFeed } from '../lib/supabase'
import { normalizeForSearch } from '../lib/textFormat'
import { menuCategoryRank, hydrateMenuCategories } from '../lib/menuCategories'
import Toast from '../components/Toast'
import { useFavorites } from '../hooks/public-menu/useFavorites'
import { useStoreStatus } from '../hooks/public-menu/useStoreStatus'
import { useDeliveryAddress } from '../hooks/public-menu/useDeliveryAddress'
import { useCart } from '../hooks/public-menu/useCart'
import { useCatalog } from '../hooks/public-menu/useCatalog'
import { useCheckout } from '../hooks/public-menu/useCheckout'
import { useProductDetail } from '../hooks/public-menu/useProductDetail'
import { useMenuBrowse } from '../hooks/public-menu/useMenuBrowse'
import { useRecommended } from '../hooks/public-menu/useRecommended'
import { useInstagramReels } from '../hooks/public-menu/useInstagramReels'
import { usePublicImages } from '../hooks/public-menu/usePublicImages'
import { preloadCatalogRuntime, handleInstagramProfileClick, warmProfileBackgroundImages } from '../lib/publicMenuRuntime'
import { ProductCard } from '../components/public-menu/ProductCard'
import { DesktopProductCard } from '../components/public-menu/DesktopProductCard'
import { DesktopPromoCard } from '../components/public-menu/DesktopPromoCard'
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
import { CART_KEY, DESKTOP_MEDIA_QUERY, DESKTOP_SIDEBAR_MEDIA_QUERY, DESKTOP_TAB_KEY, FAVORITES_KEY, PREVIEW_LOADING } from '../lib/publicMenuConfig'
import { readCatalogCache, readDesktopTab } from '../lib/publicMenuStorage'
import { BS_FORMATTER, PayMethod, money } from '../lib/publicMenuFormat'
import type { DesktopTab, CheckoutStep } from '../lib/publicMenuTypes'
import './PublicMenu.css'


declare global { interface Window { __removeFCSplash?: () => void } }

// The public entry uses this route-level hook to share the catalog request before React mounts.
// eslint-disable-next-line react-refresh/only-export-components
export async function preloadPublicMenuCatalog() {
  return preloadCatalogRuntime()
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
  const { handleImageLoad, handleImageError } = usePublicImages({ pageRef })

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
  const [selectedGroup, setSelectedGroup] = useState<MenuProductGroup | null>(null)
  const [closingDetail, setClosingDetail] = useState(false)
  const [detailOrigin, setDetailOrigin] = useState<{ x: number; y: number } | null>(null)
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(null)
  const [quickVariantGroup, setQuickVariantGroup] = useState<MenuProductGroup | null>(null)
  const [quickVariantId, setQuickVariantId] = useState<string | null>(null)
  const [quickVariantHasModifiers, setQuickVariantHasModifiers] = useState(false)
  const [quickVariantOptionsLabel, setQuickVariantOptionsLabel] = useState('Ver opciones')
  const [quickVariantProteinGroup, setQuickVariantProteinGroup] = useState<ProductModifierGroup | null>(null)
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
  const requiredModifierRef = useRef<HTMLDivElement>(null)
  const [activeCategory, setActiveCategory] = useState('Todos')
  const [scrollCategory, setScrollCategory] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [favoriteIds, setFavoriteIds] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem(FAVORITES_KEY) || '[]') as string[] } catch { return [] }
  })
  const { toggleFavorite } = useFavorites({ favoriteIds, setFavoriteIds })

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
  const storeClosedNoticeButtonRef = useRef<HTMLButtonElement>(null)
  const [closingAllExtras, setClosingAllExtras] = useState(false)
  const [extrasSearch, setExtrasSearch] = useState('')
  const closeAllExtras = () => {
    setClosingAllExtras(true)
    window.setTimeout(() => {
      setShowAllExtras(false)
      setClosingAllExtras(false)
      setExtrasSearch('')
    }, 220)
  }
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
  const addressActionRef = useRef(0)
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
  const [loading, setLoading] = useState(() => !initialCatalog)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const { deliveryFee, deliveryCoverageUnavailable, deliveryFeeText, deliveryDisabled, requestCurrentLocation, clearAddress, readableAddress, searchAddress, selectMapLocation, selectSuggestion } = useDeliveryAddress({ address, addressActionRef, addressRef, deliveryEstimate, deliveryQuoteStatus, deliveryRetryVersion, deliverySettings, deliverySettingsRetryVersion, deliverySettingsStatus, geoCoords, locationError, locationErrorRef, orderType, serverDeliveryFeeOverride, setAddress, setAddressFieldError, setAddressMethod, setAddressSuggestions, setDeliveryEstimate, setDeliveryQuoteStatus, setDeliveryRoute, setDeliverySettings, setDeliverySettingsStatus, setError, setGeoCoords, setLocating, setLocationError, setOrderType, setSearchingAddress, setShowSuggestions, setStep })

  const [fieldError, setFieldError] = useState<'' | 'name' | 'phone' | 'identification'>('')
  const nameRef = useRef<HTMLInputElement>(null)
  const phoneRef = useRef<HTMLInputElement>(null)
  const identificationRef = useRef<HTMLInputElement>(null)
  const [cartGuardMessage, setCartGuardMessage] = useState('')
  const [cartGuardClosing, setCartGuardClosing] = useState(false)
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
  const { currentInstagramReels, blockClosedStoreAdd, publicWhatsappPhone, formattedOpenTime, formattedCloseTime, publicInstagramUrl, publicFacebookUrl, mapPreviewUrl, isStoreOpen, storeScheduleLabel, pickupSlots, dismissWelcomeNotice } = useStoreStatus({ closingWelcomeNotice, dontShowWelcomeAgain, pageSettings, pageSettingsLoaded, pickupTime, setClosingWelcomeNotice, setPageSettings, setPageSettingsLoaded, setPickupTime, setShowStoreClosedNotice, setShowWelcomeNotice, showStoreClosedNotice, showWelcomeNotice, storeClosedNoticeButtonRef, welcomeNoticeButtonRef })

  const recommendedSwipeStart = useRef<number | null>(null)
  const recommendedWasSwiped = useRef(false)
  const [sidebarRecoIndex, setSidebarRecoIndex] = useState(0)
  const [instagramActiveIndex, setInstagramActiveIndex] = useState(0)
  const [instagramAudioEnabled, setInstagramAudioEnabled] = useState(false)
  const [instagramPlaybackStarted, setInstagramPlaybackStarted] = useState(false)
  const [instagramDesktopPlaybackConfirmed, setInstagramDesktopPlaybackConfirmed] = useState(false)
  const [instagramPaused, setInstagramPaused] = useState(false)
  const sidebarRecoTimer = useRef<ReturnType<typeof setInterval> | null>(null)
  const [confirmingQuickVariant, setConfirmingQuickVariant] = useState(false)
  const modifierRequestRef = useRef(0)
  const { groups, categories, retryPublicCatalog } = useCatalog({ activeCategory, initialCatalog, loading, modifierRequestRef, orderType, products, search, selectedGroup, selectedVariantId, setBcvRate, setDeliverySettings, setDeliverySettingsStatus, setDetailModifierGroups, setError, setExtrasProducts, setLoading, setPageSettings, setPageSettingsLoaded, setProducts, setSelectedExtras, setSelectedGroup })

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
  // Resumen que se muestra en 'sent' aunque el carrito ya se haya vaciado.
  const [sentSummary, setSentSummary] = useState<{ items: WebOrderCartItem[]; total: number; orderType: 'takeaway' | 'delivery'; address: string; phone: string } | null>(null)
  const [currentTab, setCurrentTab] = useState<DesktopTab>(readDesktopTab)
  const { instagramReels, toggleInstagramAudio, toggleInstagramPlayback, startInstagramReelWithSound } = useInstagramReels({ currentInstagramReels, currentTab, instagramActiveIndex, instagramAudioEnabled, instagramDesktopPlaybackConfirmed, instagramPaused, instagramPlaybackStarted, setInstagramAudioEnabled, setInstagramDesktopPlaybackConfirmed, setInstagramPaused, setInstagramPlaybackStarted })

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

  useEffect(() => {
    try { localStorage.setItem(DESKTOP_TAB_KEY, currentTab) } catch { /* storage unavailable */ }
  }, [currentTab])

  const [cardQtys, setCardQtys] = useState<Record<string, number>>({})

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

  const [deletingKeys, setDeletingKeys] = useState<string[]>([])
  const { total, commitCart, handleRemoveSidebarItem, itemCount, updateQuantity } = useCart({ cart, cartOpen, cartRef, setCart, setCartOpen, setClosingCart, setDeletingKeys, setError, step })

  const { requestQuickAdd, openGroup, editCartItem, closeQuickVariant, confirmQuickVariant, openQuickProteinDialog, personalizeQuickVariant, quickSelectedVariant, applyQuickProteinDraft, toggleQuickProteinDraft, selectedProduct, addSelectedProduct, catalogExtraProducts, closeProductDetail, complementaryProducts, detailExtrasTotal, invalidModifierSelection, modifierSelectionError, selectedCatalogExtrasTotal, toggleProteinExclusion } = useProductDetail({ blockClosedStoreAdd, cart, cartRef, closingDetail, closingQuickVariant, commitCart, detailModifierGroups, detailNotes, detailNotesRef, detailQuantity, editingCartLineKey, extrasProducts, groups, loadingModifiers, modifierLoadError, modifierRequestRef, products, quickVariantGroup, quickVariantId, quickVariantProteinDraft, quickVariantProteinGroup, quickVariantQuantity, requiredModifierRef, returnToConfirmAfterEdit, selectedCatalogExtras, selectedExtras, selectedGroup, selectedVariantId, setAddFeedback, setAddFeedbackClosing, setAddingSelectedProduct, setCardQtys, setCartOpen, setCartPulse, setClosingCart, setClosingDetail, setClosingQuickVariant, setConfirmingQuickVariant, setDetailModifierGroups, setDetailNotes, setDetailOrigin, setDetailQuantity, setEditingCartLineKey, setError, setLoadingModifiers, setModifierLoadError, setModifierValidationError, setPendingQuickAdds, setQuickProteinDialogOpen, setQuickVariantGroup, setQuickVariantHasModifiers, setQuickVariantId, setQuickVariantOptionsLabel, setQuickVariantProteinDraft, setQuickVariantProteinGroup, setQuickVariantQuantity, setReturnToConfirmAfterEdit, setSelectedCatalogExtras, setSelectedExtras, setSelectedGroup, setSelectedVariantId, setShowModifierGuidance, setStep, step })

  const { repeatPreviousOrder, continueFromAddress, continueToConfirmation, submitOrder, returnToMenuAfterSent } = useCheckout({ address, addressActionRef, addressMethod, addressRef, addressReference, addressSelectedRef, bcvRate, blockClosedStoreAdd, cart, cartOpen, closeCart, commitCart, customerDetailsTouched, deliveryChosen, deliveryCoverageUnavailable, deliveryEstimate, deliveryFee, deliveryNotes, deliveryQuoteStatus, deliverySettings, deliverySettingsStatus, error, geoCoords, identification, identificationRef, name, nameRef, notes, orderType, payMode, payPrimary, paySecondary, phone, phoneRef, pickupTime, publicWhatsappPhone, referenceRef, returnToConfirmAfterEdit, setAddress, setAddressFieldError, setAddressMethod, setAddressReference, setAutofillingDetails, setCartOpen, setClosingCart, setCurrentTab, setCustomerDetailsAutofilled, setDeliveryChosen, setDeliveryNotes, setError, setExtrasProducts, setFieldError, setGeoCoords, setIdPrefix, setIdentification, setLocalTestOrderLinkedToProfile, setLocating, setName, setNotes, setOrderCode, setOrderType, setPayMode, setPayPrimary, setPaySecondary, setPhone, setPickupTime, setProducts, setReturnToConfirmAfterEdit, setSentSummary, setServerDeliveryFeeOverride, setStep, setSubmitting, step, submitting })

  const { allCatalogGroups, cartProductIds, accentRgb, handleRecommendedWheel, isLoyaltyRecommended, moveRecommended, pauseRecommendedAutoplay, recommendedGroup, recommendedSlideCount, recommendedSlides, recommendedVariant, resumeRecommendedAutoplay, getCartIncludedCopy, recommendations, cartCarouselGroups } = useRecommended({ activeCategory, address, cart, categories, currentTab, extrasProducts, groups, orderType, pageSettings, products, recommendedIndex, requestedRecommendedIndex, scrollCategory, setRecommendedImageSrc, setRecommendedIndex, setRequestedRecommendedIndex, setSidebarHasOverflow, setSidebarRecoIndex, sidebarCardRef, sidebarRecoTimer, total })

  const { openProductFromCard, openProductFromCardKeyboard, stopProductCardInteraction, changeCardQty, getCardQty, handleCardAdd, categorySections, visibleGroups, homeSearchSuggestions, homeSearchTerm, popularGroups, promoGroups } = useMenuBrowse({ activeCategory, cardQtys, categories, currentTab, desktopHeroPaused, favoriteIds, groups, openGroup, popularScrollRef, products, requestQuickAdd, search, setCanScrollPopular, setCardQtys, setDesktopHeroSlide, setScrollCategory, showFavorites })

  const orderTotal = total + deliveryFee
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
