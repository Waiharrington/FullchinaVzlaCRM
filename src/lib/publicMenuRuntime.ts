import { optimizedProductImage, previewImageSource } from './publicMenuFormat'
import { readCatalogCache, saveCatalogCache } from './publicMenuStorage'
import { type MouseEvent as ReactMouseEvent } from 'react'
import { getPublicCatalog } from './publicOrders'
import type { Product } from './dataService'
import { type PublicOrderReel } from './publicOrderPageSettings'
import { classifyMenuCategory, menuItemRank, menuCategoryRank, isKnownCategory } from './menuCategories'
// Selección curada para la sección "Date un banquete en Full China" del inicio.
// Curados para no solaparse con "Nuestras Promociones" (categorías promociones/ejecutivos/individuales).
export const FEATURED_DISH_QUERIES = ['arroz frito especial', 'chop suey especial', 'costillas agridulce', 'vermicelli especial']

// Tinte de fondo (RGB) para el efecto de "profundidad" que acompaña el
// scroll en la vista "Todos" — sutil, no reemplaza la imagen de fondo de la
// marca, solo la tiñe levemente según lo que se está viendo. Solo usa los
// colores de la marca (rojo, dorado, naranja), intercalados por categoría.

export const DEFAULT_INSTAGRAM_PROFILE_URL = 'https://www.instagram.com/_u/fullchinavzla/'
export function handleInstagramProfileClick(event: ReactMouseEvent<HTMLAnchorElement>) {
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

export function instagramReelOrder(reels: PublicOrderReel[], activeIndex: number) {
  return Array.from({ length: reels.length }, (_, position) => ({
    reel: reels[(activeIndex - 2 + position + reels.length) % reels.length],
    position,
  }))
}

export function startInstagramVideo(video: HTMLVideoElement) {
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
export const profileBackgroundImages = new Map<string, HTMLImageElement>()
export const publicMenuImageWarmups = new Map<string, HTMLImageElement>()

export function getImageWarmupRootMargin() {
  const connection = (navigator as Navigator & {
    connection?: { effectiveType?: string; saveData?: boolean }
  }).connection
  const slowConnection = connection?.saveData
    || ['slow-2g', '2g', '3g'].includes(connection?.effectiveType || '')
  return `${slowConnection ? 320 : 800}px 0px`
}

export function warmPublicMenuImages(products: Product[]) {
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

export const PUBLIC_CATALOG_REQUEST_TTL_MS = 15_000
export let publicCatalogRequestId = 0
export let publicCatalogRequest: { id: number; startedAt: number; promise: Promise<Product[]> } | null = null

export function getPublicCatalogWithRetry(forceRefresh = false): Promise<Product[]> {
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

export function warmProfileBackgroundImages(prioritizeAuth = false) {
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


export function prepareCatalog(catalog: Product[]) {
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
export async function preloadCatalogRuntime() {
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
