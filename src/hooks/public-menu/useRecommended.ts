import { useRef, useState, useMemo, useEffect, WheelEvent as ReactWheelEvent, type Dispatch, type SetStateAction, type RefObject } from 'react'
import { CATEGORY_ACCENT_CYCLE } from '../../lib/publicMenuConfig'
import { selectPublicCarouselGroups, preserveEmptyPublicCarousel } from '../../lib/publicOrderCarousel'
import { optimizedProductImage, productImage } from '../../lib/publicMenuFormat'
import { normalizeForSearch } from '../../lib/textFormat'
import { groupMenuProducts, type MenuProductGroup } from '../../lib/menuGrouping'
import { WebOrderCartItem } from '../../lib/publicOrders'
import { publicCartIncludedCopy } from '../../lib/publicMenuLabels'
import { getCartRecommendations, getCartCarouselGroups } from '../../lib/cartRecommendations'
import { type DesktopTab } from '../../lib/publicMenuTypes'
import { type Product } from '../../lib/dataService'
import { type PublicOrderPageSettings } from '../../lib/publicOrderPageSettings'

interface UseRecommendedArgs {
  activeCategory: string
  address: string
  cart: WebOrderCartItem[]
  categories: string[]
  currentTab: DesktopTab
  extrasProducts: Product[]
  groups: MenuProductGroup[]
  orderType: "takeaway" | "delivery"
  pageSettings: PublicOrderPageSettings
  products: Product[]
  recommendedIndex: number
  requestedRecommendedIndex: number | null
  scrollCategory: string | null
  setRecommendedImageSrc: Dispatch<SetStateAction<string>>
  setRecommendedIndex: Dispatch<SetStateAction<number>>
  setRequestedRecommendedIndex: Dispatch<SetStateAction<number | null>>
  setSidebarHasOverflow: Dispatch<SetStateAction<boolean>>
  setSidebarRecoIndex: Dispatch<SetStateAction<number>>
  sidebarCardRef: RefObject<HTMLDivElement | null>
  sidebarRecoTimer: RefObject<ReturnType<typeof setTimeout> | null>
  total: number
}

export function useRecommended({ activeCategory, address, cart, categories, currentTab, extrasProducts, groups, orderType, pageSettings, products, recommendedIndex, requestedRecommendedIndex, scrollCategory, setRecommendedImageSrc, setRecommendedIndex, setRequestedRecommendedIndex, setSidebarHasOverflow, setSidebarRecoIndex, sidebarCardRef, sidebarRecoTimer, total }: UseRecommendedArgs) {
  const loadedRecommendedImageKey = useRef<string | null>(null)
  const [recommendedPaused, setRecommendedPaused] = useState(false)
  const recommendedTimer = useRef<ReturnType<typeof setInterval> | null>(null)
  const recommendedResumeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const recommendedWheelDelta = useRef(0)
  const recommendedWheelLocked = useRef(false)
  const recommendedWheelUnlockTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

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
  }, [activeCategory, setRecommendedIndex, setRequestedRecommendedIndex])

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
  }, [recommendedIndex, recommendedSlides, requestedRecommendedIndex, setRecommendedImageSrc, setRecommendedIndex, setRequestedRecommendedIndex])

  useEffect(() => {
  if (recommendedSlideCount <= 1 || recommendedPaused || requestedRecommendedIndex != null) return
    recommendedTimer.current = setInterval(() => {
      setRequestedRecommendedIndex(prev => ((prev ?? recommendedIndex) + 1) % recommendedSlideCount)
    }, 4500)
    return () => { if (recommendedTimer.current) clearInterval(recommendedTimer.current) }
  }, [recommendedSlideCount, recommendedPaused, recommendedIndex, requestedRecommendedIndex, setRequestedRecommendedIndex])

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
  }, [cart, recommendations, orderType, address, total, currentTab, setSidebarHasOverflow, sidebarCardRef])

  useEffect(() => {
    setSidebarRecoIndex(0)
  }, [recommendations, setSidebarRecoIndex])

  useEffect(() => {
    if (recommendations.length <= 1) return
    sidebarRecoTimer.current = setInterval(() => {
      setSidebarRecoIndex(prev => (prev + 1) % recommendations.length)
    }, 4500)
    return () => { if (sidebarRecoTimer.current) clearInterval(sidebarRecoTimer.current) }
  }, [recommendations.length, setSidebarRecoIndex, sidebarRecoTimer])
  return { allCatalogGroups, cartProductIds, accentRgb, handleRecommendedWheel, isLoyaltyRecommended, moveRecommended, pauseRecommendedAutoplay, recommendedGroup, recommendedSlideCount, recommendedSlides, recommendedVariant, resumeRecommendedAutoplay, getCartIncludedCopy, recommendations, cartCarouselGroups }
}
