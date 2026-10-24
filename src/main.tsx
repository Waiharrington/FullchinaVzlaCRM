import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './styles/motion.css'
import App from './App'
import { registerSW } from 'virtual:pwa-register'

// Auto-recuperación de chunks vencidos: tras un nuevo deploy, los archivos
// JS/CSS de los módulos cambian de hash. Una pestaña abierta con el service
// worker viejo puede pedir un chunk que ya no existe -> 404 -> el módulo se ve
// sin estilos o no carga. Vite emite `vite:preloadError` en ese caso; recargamos
// una sola vez (guarda por tiempo) para traer los assets nuevos sin bucles.
window.addEventListener('vite:preloadError', () => {
  const KEY = 'fc-last-chunk-reload'
  const last = Number(sessionStorage.getItem(KEY) || '0')
  if (Date.now() - last < 10000) return
  sessionStorage.setItem(KEY, String(Date.now()))
  window.location.reload()
})

// Las actualizaciones se descargan en segundo plano, pero no toman control ni
// recargan el sitio hasta que la persona elija aplicarlas.
const updateServiceWorker = registerSW({
  immediate: true,
  onNeedRefresh() {
    ;(window as typeof window & { fullChinaUpdateAvailable?: boolean }).fullChinaUpdateAvailable = true
    window.dispatchEvent(new Event('fullchina:pwa-update-available'))
  },
})

window.addEventListener('fullchina:pwa-apply-update', () => {
  void updateServiceWorker(true)
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
)
