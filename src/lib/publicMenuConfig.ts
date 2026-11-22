import type { ProductModifierGroup } from './dataService'
import { isLocalOrderTestMode } from './localOrderTestMode'

export const FAVORITES_KEY = 'fullchina_public_favorites'
export const CART_KEY = 'fullchina_public_cart'
export const LAST_ORDER_KEY = 'fullchina_public_last_order'
export const FLOW_STATE_KEY = 'fullchina_public_flow_state'
export const WHATSAPP_SENT_KEY = 'fullchina_public_whatsapp_sent'
export const SENT_STATE_MAX_AGE_MS = 3 * 60 * 60 * 1000
export const isRecentSentState = (sent: { sentAt?: number } | null) => Boolean(sent?.sentAt && Date.now() - sent.sentAt < SENT_STATE_MAX_AGE_MS)
export const PUBLIC_WHATSAPP_PHONE = String(import.meta.env.VITE_FULLCHINA_WHATSAPP || '').replace(/\D/g, '')
export const CHECKOUT_ATTEMPT_KEY = 'fullchina_public_checkout_attempt'
export const LOCAL_ORDER_TEST_MODE = isLocalOrderTestMode()
// El checkout público solo permite pedidos durante el horario configurado.
export const ORDER_HOURS_BLOCK_ENABLED = true
export const DESKTOP_TAB_KEY = 'fullchina_public_desktop_tab'
export const PUBLIC_MODIFIER_CACHE = new Map<string, ProductModifierGroup[]>()
// v2 intentionally drops caches created while the public RPC still returned
// inline Base64 images (those entries could occupy several megabytes).
// v3 descarta catálogos que guardaron las rutas estáticas antiguas M*.jpg.
export const CATALOG_CACHE_KEY = 'fullchina_public_catalog_v4'
// Solo en desarrollo: /pedir?previewLoading=1 deja el menú en estado de carga
// para revisar los esqueletos (como ?showClosedNotice=1 con el aviso de cerrado).
export const PREVIEW_LOADING = import.meta.env.DEV
  && typeof window !== 'undefined'
  && new URLSearchParams(window.location.search).get('previewLoading') === '1'
export const CATALOG_CACHE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000
// Debe coincidir exactamente con el breakpoint de PublicMenu.css: escritorio
// desde 1280px, o desde 1024px cuando el dispositivo (iPad/tablet) está en horizontal.
export const DESKTOP_MEDIA_QUERY = '(min-width: 1280px), (min-width: 1024px) and (orientation: landscape)'
// Debe coincidir con la media query que muestra .public-desktop-sidebar en PublicMenu.css.
// Con la tarjeta lateral visible, ella es el paso 'Tu pedido': el checkout no debe
// mostrar su propia versión móvil del carrito al volver.
export const DESKTOP_SIDEBAR_MEDIA_QUERY = '(min-width: 1280px), (min-width: 900px) and (orientation: landscape)'

export const CATEGORY_ICONS: Record<string, string> = {
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

export const CATEGORY_ACCENT_CYCLE = ['227, 27, 43', '255, 200, 61', '234, 88, 12']

export const DESKTOP_CATEGORY_LABELS: Record<string, string> = {
  promociones: 'Promos',
  ejecutivos: 'Ejecutivo',
}
