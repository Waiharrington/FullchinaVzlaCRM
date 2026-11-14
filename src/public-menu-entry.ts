const DISMISSED_KEY = 'fullchina_public_welcome_dismissed_v1'
const PENDING_DISMISS_KEY = 'fullchina_public_welcome_pending_dismiss'

const root = document.getElementById('root')
const staticWelcome = document.getElementById('public-welcome-static')
const button = document.getElementById('public-welcome-start') as HTMLButtonElement | null
const checkbox = document.getElementById('public-welcome-dismiss') as HTMLInputElement | null
const status = document.getElementById('public-welcome-status')

let appLoad: Promise<unknown> | null = null
let needsVersionRefresh = false
let menuFontsRequested = false

window.addEventListener('fullchina:public-menu-ready', () => {
  staticWelcome?.remove()
}, { once: true })

function loadMenuFonts() {
  if (menuFontsRequested) return
  menuFontsRequested = true
  const fonts = document.createElement('link')
  fonts.rel = 'stylesheet'
  fonts.href = 'https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&family=Graduate&family=Outfit:wght@300;400;500;600;700;800;900&display=swap'
  fonts.media = 'print'
  fonts.onload = () => { fonts.media = 'all' }
  document.head.append(fonts)
}

function warmCustomerMenu() {
  // Descarga en paralelo los módulos y el catálogo al abrir la carta. La
  // bienvenida permanece visible hasta que la vista real esté montada.
  loadMenuFonts()
  void import('./App').catch(() => undefined)
  void import('./pages/PublicMenu').catch(() => undefined)
  void import('./lib/publicOrders')
    .then(({ getPublicCatalog }) => getPublicCatalog())
    .catch(() => undefined)
}

async function refreshCustomerVersion() {
  if (button) {
    button.disabled = true
    button.textContent = 'Actualizando…'
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
    // Vacía únicamente el shell y los JS/CSS cacheados de la app. Se conservan
    // las imágenes del menú y los datos locales del cliente.
    if ('caches' in window) {
      const appCaches = await caches.keys()
      await Promise.all(appCaches
        .filter(name => name === 'app-assets' || name.startsWith('workbox-precache-'))
        .map(name => caches.delete(name)))
    }
  } catch (error) {
    console.warn('No se pudo limpiar por completo la caché de navegación:', error)
  }
  const url = new URL('/pedir', window.location.origin)
  url.searchParams.set('actualizar', String(Date.now()))
  window.location.replace(url)
}

function loadCustomerApp() {
  if (appLoad) return appLoad
  if (button) {
    button.disabled = true
    button.setAttribute('aria-busy', 'true')
    button.textContent = 'Abriendo la carta…'
  }
  loadMenuFonts()

  appLoad = import('./main').catch(error => {
    appLoad = null
    document.documentElement.removeAttribute('data-skip-public-welcome')
    try { sessionStorage.removeItem(PENDING_DISMISS_KEY) } catch { /* acceso a almacenamiento opcional */ }
    if (staticWelcome && !staticWelcome.isConnected) document.body.prepend(staticWelcome)
    needsVersionRefresh = true
    if (button) {
      button.disabled = false
      button.removeAttribute('aria-busy')
      button.textContent = 'Actualizar menú'
    }
    if (status) status.textContent = 'Hay una nueva versión del menú. Actualiza para ver la carta más reciente.'
    console.error('No se pudo abrir la carta de Full China:', error)
    return undefined
  })
  return appLoad
}

let skipWelcome = false
try {
  skipWelcome = localStorage.getItem(DISMISSED_KEY) === 'true'
    || sessionStorage.getItem(PENDING_DISMISS_KEY) === 'true'
} catch { /* sin almacenamiento se conserva la bienvenida */ }

if (skipWelcome || !root || !button || !checkbox) {
  staticWelcome?.remove()
  warmCustomerMenu()
  void loadCustomerApp()
} else {
  button.addEventListener('click', () => {
    if (needsVersionRefresh) {
      void refreshCustomerVersion()
      return
    }
    try {
      if (checkbox.checked) {
        localStorage.setItem(DISMISSED_KEY, 'true')
        sessionStorage.removeItem(PENDING_DISMISS_KEY)
      } else {
        sessionStorage.setItem(PENDING_DISMISS_KEY, 'true')
      }
    } catch { /* la carta también puede abrirse si el navegador bloquea almacenamiento */ }
    warmCustomerMenu()
    // Mantén la bienvenida como superficie visible mientras se descargan y
    // montan los módulos. `fullchina:public-menu-ready` la retira al primer
    // render del menú para evitar un destello negro entre ambas vistas.
    void loadCustomerApp()
  })
}
