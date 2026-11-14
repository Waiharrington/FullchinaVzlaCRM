const DISMISSED_KEY = 'fullchina_public_welcome_dismissed_v1'
const PENDING_DISMISS_KEY = 'fullchina_public_welcome_pending_dismiss'

const root = document.getElementById('root')
const staticWelcome = document.getElementById('public-welcome-static')
const button = document.getElementById('public-welcome-start') as HTMLButtonElement | null
const checkbox = document.getElementById('public-welcome-dismiss') as HTMLInputElement | null
const status = document.getElementById('public-welcome-status')

let appLoad: Promise<unknown> | null = null

window.addEventListener('fullchina:public-menu-ready', () => staticWelcome?.remove(), { once: true })

function loadMenuFonts() {
  const fonts = document.createElement('link')
  fonts.rel = 'stylesheet'
  fonts.href = 'https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&family=Graduate&family=Outfit:wght@300;400;500;600;700;800;900&display=swap'
  fonts.media = 'print'
  fonts.onload = () => { fonts.media = 'all' }
  document.head.append(fonts)
}

function loadCustomerApp() {
  if (appLoad) return appLoad
  if (button) {
    button.disabled = true
    button.setAttribute('aria-busy', 'true')
    button.textContent = 'Abriendo la carta…'
  }
  if (status) status.textContent = 'Cargando el menú. Esto solo toma un momento.'
  loadMenuFonts()

  appLoad = import('./main').catch(error => {
    appLoad = null
    try { sessionStorage.removeItem(PENDING_DISMISS_KEY) } catch { /* acceso a almacenamiento opcional */ }
    if (button) {
      button.disabled = false
      button.removeAttribute('aria-busy')
      button.textContent = 'Reintentar abrir la carta'
    }
    if (status) status.textContent = 'No se pudo cargar el menú. Revisa tu conexión e inténtalo de nuevo.'
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
  void loadCustomerApp()
} else {
  button.addEventListener('click', () => {
    try {
      if (checkbox.checked) {
        localStorage.setItem(DISMISSED_KEY, 'true')
        sessionStorage.removeItem(PENDING_DISMISS_KEY)
      } else {
        sessionStorage.setItem(PENDING_DISMISS_KEY, 'true')
      }
    } catch { /* la carta también puede abrirse si el navegador bloquea almacenamiento */ }
    void loadCustomerApp()
  })
}
