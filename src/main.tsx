import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './styles/motion.css'
import './styles/modalBackdrop.css'
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
let appServiceWorkerRegistration: ServiceWorkerRegistration | undefined

const checkForAppUpdate = () => {
  if (!navigator.onLine || document.visibilityState !== 'visible') return
  void appServiceWorkerRegistration?.update().catch(() => {
    // La próxima revisión (al volver a la pestaña, conectarse o por intervalo)
    // volverá a intentarlo sin interrumpir el uso de la app.
  })
}

const updateServiceWorker = registerSW({
  immediate: true,
  onRegisteredSW(_swUrl, registration) {
    appServiceWorkerRegistration = registration
  },
  onNeedRefresh() {
    ;(window as typeof window & { fullChinaUpdateAvailable?: boolean }).fullChinaUpdateAvailable = true
    window.dispatchEvent(new Event('fullchina:pwa-update-available'))
  },
})

const waitForWaitingWorker = (registration: ServiceWorkerRegistration, timeoutMs = 15000) => {
  if (registration.waiting) return Promise.resolve(registration.waiting)

  return new Promise<ServiceWorker | null>(resolve => {
    let settled = false
    let installingWorker: ServiceWorker | null = null
    const finish = (worker: ServiceWorker | null) => {
      if (settled) return
      settled = true
      window.clearTimeout(timeout)
      registration.removeEventListener('updatefound', onUpdateFound)
      installingWorker?.removeEventListener('statechange', onStateChange)
      resolve(worker)
    }
    const onStateChange = () => {
      if (registration.waiting) finish(registration.waiting)
      else if (installingWorker?.state === 'redundant') finish(null)
    }
    const watchInstallingWorker = () => {
      installingWorker?.removeEventListener('statechange', onStateChange)
      installingWorker = registration.installing
      installingWorker?.addEventListener('statechange', onStateChange)
      onStateChange()
    }
    const onUpdateFound = () => watchInstallingWorker()
    const timeout = window.setTimeout(() => finish(registration.waiting), timeoutMs)

    registration.addEventListener('updatefound', onUpdateFound)
    watchInstallingWorker()
    // También cubre el caso en que el navegador terminó la instalación entre
    // la primera comprobación y el registro de los listeners.
    if (registration.waiting) finish(registration.waiting)
  })
}

const waitForWorkerActivation = (worker: ServiceWorker, timeoutMs = 20000) => new Promise<boolean>(resolve => {
  let settled = false
  const finish = (activated: boolean) => {
    if (settled) return
    settled = true
    window.clearTimeout(timeout)
    worker.removeEventListener('statechange', onStateChange)
    resolve(activated)
  }
  const onStateChange = () => {
    if (worker.state === 'activated') finish(true)
    else if (worker.state === 'redundant') finish(false)
  }
  const timeout = window.setTimeout(() => finish(worker.state === 'activated'), timeoutMs)
  worker.addEventListener('statechange', onStateChange)
  onStateChange()
})

// Revisa actualizaciones cuando el usuario vuelve a la app, recupera internet
// o mantiene una pestaña abierta durante mucho tiempo (incluye WebView Android).
window.addEventListener('online', checkForAppUpdate)
window.addEventListener('pageshow', checkForAppUpdate)
document.addEventListener('visibilitychange', checkForAppUpdate)
window.setInterval(checkForAppUpdate, 30 * 60 * 1000)

window.addEventListener('fullchina:pwa-apply-update', () => {
  window.dispatchEvent(new Event('fullchina:pwa-update-applying'))
  void (async () => {
    const registration = appServiceWorkerRegistration
    if (!registration) {
      window.dispatchEvent(new Event('fullchina:pwa-update-apply-failed'))
      return
    }

    try {
      let waitingWorker = registration.waiting
      if (!waitingWorker) {
        const workerReady = waitForWaitingWorker(registration)
        await registration.update()
        waitingWorker = await workerReady
      }
      if (!waitingWorker || registration.waiting !== waitingWorker) {
        waitingWorker = registration.waiting
      }
      if (!waitingWorker) {
        window.dispatchEvent(new Event('fullchina:pwa-update-apply-failed'))
        return
      }

      // El SW actual no usa clientsClaim, por lo que controllerchange puede no
      // llegar aunque el nuevo worker sí se active. Espera su activación y
      // recarga explícitamente para que la pestaña pase a usar la versión nueva.
      const activation = waitForWorkerActivation(waitingWorker)
      await updateServiceWorker(true)
      if (!await activation) {
        window.dispatchEvent(new Event('fullchina:pwa-update-apply-failed'))
        return
      }

      ;(window as typeof window & { fullChinaUpdateAvailable?: boolean }).fullChinaUpdateAvailable = false
      window.location.reload()
    } catch {
      window.dispatchEvent(new Event('fullchina:pwa-update-apply-failed'))
    }
  })()
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
)
