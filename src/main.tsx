import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'

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

// Cuando el service worker NUEVO toma control tras un deploy, recargar para
// traer index/JS/CSS frescos antes de que falle algún chunk. El guard por
// `controller` evita recargar en la primera visita (instalación inicial).
if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
  let reloaded = false
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (reloaded) return
    reloaded = true
    window.location.reload()
  })
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
)
