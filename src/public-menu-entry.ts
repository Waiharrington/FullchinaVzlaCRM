import { clearLegacyPwaRuntimeCaches } from './lib/pwaRuntimeCache'

const DISMISSED_KEY = 'fullchina_public_welcome_dismissed_v1'
const PENDING_DISMISS_KEY = 'fullchina_public_welcome_pending_dismiss'
const PENDING_OPEN_KEY = 'fullchina_public_menu_pending_open_v1'
const VERSION_RETRY_KEY = 'fullchina_public_menu_version_retry_v1'

const root = document.getElementById('root')
const staticWelcome = document.getElementById('public-welcome-static')
const button = document.getElementById('public-welcome-start') as HTMLButtonElement | null
const checkbox = document.getElementById('public-welcome-dismiss') as HTMLInputElement | null
const status = document.getElementById('public-welcome-status')

declare global {
  interface Window {
    __fullChinaSkipWelcomeForCurrentLoad?: boolean
    __fullChinaOpenPublicMenu?: () => void
    __fullChinaQueuePublicMenuOpen?: () => void
    __fullChinaRecoverPublicMenu?: () => void
    __fullChinaPublicMenuOpenQueued?: boolean
    __fullChinaCheckPublicMenuVersion?: () => Promise<boolean>
  }
}

let appLoad: Promise<unknown> | null = null
let menuModuleLoad: Promise<typeof import('./pages/PublicMenu')> | null = null
let menuCatalogWarmupStarted = false
let needsVersionRefresh = false

window.addEventListener('fullchina:public-menu-ready', () => {
  staticWelcome?.remove()
  try {
    sessionStorage.removeItem(PENDING_OPEN_KEY)
    sessionStorage.removeItem(VERSION_RETRY_KEY)
  } catch { /* el menú no depende del almacenamiento */ }
}, { once: true })

function loadMenuFonts() {
  const fonts = document.createElement('link')
  fonts.rel = 'stylesheet'
  fonts.href = 'https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&family=Graduate&family=Outfit:wght@300;400;500;600;700;800;900&display=swap'
  fonts.media = 'print'
  fonts.onload = () => { fonts.media = 'all' }
  document.head.append(fonts)
}

async function refreshCustomerVersion() {
  if (button) {
    setButtonState('Actualizando…', true)
  }
  try {
    const registration = await navigator.serviceWorker?.getRegistration()
    await registration?.update()
    const waitingWorker = registration?.waiting
    if (waitingWorker) {
      await new Promise<void>(resolve => {
        const timeout = window.setTimeout(resolve, 8000)
        waitingWorker.addEventListener('statechange', () => {
          if (waitingWorker.state === 'activated') {
            window.clearTimeout(timeout)
            resolve()
          }
        })
        waitingWorker.postMessage({ type: 'SKIP_WAITING' })
      })
    }
  } catch (error) {
    console.warn('No se pudo consultar la actualización del service worker:', error)
  }
  try {
    await clearLegacyPwaRuntimeCaches()
    // Vacía también el shell precargado para que la siguiente navegación use
    // los archivos de la versión publicada.
    if ('caches' in window) {
      const appCaches = await caches.keys()
      await Promise.all(appCaches
        .filter(name => name.startsWith('workbox-precache-'))
        .map(name => caches.delete(name)))
    }
  } catch (error) {
    console.warn('No se pudo limpiar por completo la caché de navegación:', error)
  }
  try {
    sessionStorage.setItem(PENDING_OPEN_KEY, 'true')
    sessionStorage.setItem(VERSION_RETRY_KEY, 'true')
  } catch { /* la ruta con query única sigue solicitando el HTML actual */ }
  const url = new URL('/pedir', window.location.origin)
  url.searchParams.set('_fc_refresh', String(Date.now()))
  window.location.replace(url)
}

function loadCustomerApp() {
  if (appLoad) return appLoad
  if (button) {
    setButtonState('Abriendo la carta…', true)
  }
  loadMenuFonts()
  void preloadPublicMenu().catch(() => undefined)

  appLoad = import('./main').catch(error => {
    appLoad = null
    document.documentElement.removeAttribute('data-skip-public-welcome')
    try { sessionStorage.removeItem(PENDING_DISMISS_KEY) } catch { /* acceso a almacenamiento opcional */ }
    if (staticWelcome && !staticWelcome.isConnected) document.body.prepend(staticWelcome)
    needsVersionRefresh = true
    if (button) {
      setButtonState('Actualizar menú', false)
    }
    if (status) status.textContent = 'Hay una nueva versión del menú. Actualiza para ver la carta más reciente.'
    console.error('No se pudo abrir la carta de Full China:', error)
    if (navigator.onLine) window.__fullChinaRecoverPublicMenu?.()
    return undefined
  })
  return appLoad
}

function preloadPublicMenu() {
  if (!menuModuleLoad) {
    menuModuleLoad = import('./pages/PublicMenu').catch(error => {
      menuModuleLoad = null
      menuCatalogWarmupStarted = false
      throw error
    })
  }

  if (!menuCatalogWarmupStarted) {
    menuCatalogWarmupStarted = true
    void menuModuleLoad.then(module => module.preloadPublicMenuCatalog()).catch(() => undefined)
  }

  return menuModuleLoad
}

function schedulePublicMenuWarmup() {
  const connection = (navigator as Navigator & {
    connection?: { effectiveType?: string; saveData?: boolean }
  }).connection
  if (connection?.saveData || ['slow-2g', '2g', '3g'].includes(connection?.effectiveType || '')) return

  const warm = () => {
    if (!staticWelcome?.isConnected || window.__fullChinaPublicMenuOpenQueued) return
    void preloadPublicMenu().catch(() => undefined)
  }
  const idleWindow = window as Window & {
    requestIdleCallback?: (callback: () => void, options?: { timeout?: number }) => number
  }

  if (idleWindow.requestIdleCallback) idleWindow.requestIdleCallback.call(window, warm, { timeout: 2500 })
  else window.setTimeout(warm, 2500)
}

function setButtonState(label: string, loading: boolean) {
  if (!button) return
  button.disabled = loading
  button.classList.toggle('is-loading', loading)
  if (loading) button.setAttribute('aria-busy', 'true')
  else button.removeAttribute('aria-busy')
  const labelNode = Array.from(button.childNodes).find(node => node.nodeType === Node.TEXT_NODE)
  if (labelNode) labelNode.nodeValue = `${label} `
  else button.prepend(document.createTextNode(`${label} `))
}

async function openPublicMenu() {
  window.__fullChinaPublicMenuOpenQueued = false
  setButtonState('Abriendo la carta…', true)
  if (needsVersionRefresh) {
    try { sessionStorage.setItem(PENDING_OPEN_KEY, 'true') } catch { /* recuperación sigue con la URL */ }
    void refreshCustomerVersion()
    return
  }
  try {
    if (checkbox?.checked) {
      localStorage.setItem(DISMISSED_KEY, 'true')
      sessionStorage.removeItem(PENDING_DISMISS_KEY)
    } else {
      sessionStorage.removeItem(PENDING_DISMISS_KEY)
      window.__fullChinaSkipWelcomeForCurrentLoad = true
    }
  } catch { /* la carta también puede abrirse si el navegador bloquea almacenamiento */ }
  if (await window.__fullChinaCheckPublicMenuVersion?.()) {
    window.__fullChinaRecoverPublicMenu?.()
    return
  }
  // El listener inline captura toques antes de que cargue este módulo; esta
  // función global permite atender ese primer toque sin volver a pulsar.
  void loadCustomerApp()
}

let skipWelcome = false
let pendingOpen = false
try {
  skipWelcome = localStorage.getItem(DISMISSED_KEY) === 'true'
    || sessionStorage.getItem(PENDING_DISMISS_KEY) === 'true'
  pendingOpen = sessionStorage.getItem(PENDING_OPEN_KEY) === 'true'
  if (pendingOpen) sessionStorage.removeItem(PENDING_OPEN_KEY)
} catch { /* sin almacenamiento se conserva la bienvenida */ }
pendingOpen = pendingOpen || Boolean(window.__fullChinaPublicMenuOpenQueued)

window.__fullChinaOpenPublicMenu = openPublicMenu
button?.addEventListener('click', openPublicMenu)

if (pendingOpen) {
  // Una navegación de recuperación conserva la intención del primer toque.
  window.__fullChinaQueuePublicMenuOpen?.()
  void openPublicMenu()
} else if (skipWelcome || !root || !button || !checkbox) {
  staticWelcome?.remove()
  window.__fullChinaQueuePublicMenuOpen?.()
  void openPublicMenu()
} else {
  schedulePublicMenuWarmup()
}
