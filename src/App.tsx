import { lazy, Suspense, useEffect, useLayoutEffect, useState } from 'react'
import { BrowserRouter, useLocation } from 'react-router-dom'
import { PublicMenuSkeleton } from './components/PublicMenuSkeleton'

const PublicMenu = lazy(() => import('./pages/PublicMenu').then(module => ({ default: module.PublicMenu })))
const AdminApp = lazy(() => import('./AdminApp'))

function AppContent() {
  const location = useLocation()
  const isPublicMenu = /^\/pedir\/?$/i.test(location.pathname)
  const [updateAvailable, setUpdateAvailable] = useState(() =>
    Boolean((window as typeof window & { fullChinaUpdateAvailable?: boolean }).fullChinaUpdateAvailable),
  )

  useEffect(() => {
    const showUpdate = () => setUpdateAvailable(true)
    window.addEventListener('fullchina:pwa-update-available', showUpdate)
    return () => window.removeEventListener('fullchina:pwa-update-available', showUpdate)
  }, [])

  useLayoutEffect(() => {
    window.scrollTo(0, 0)
  }, [location.key])

  useEffect(() => {
    const link = document.getElementById('pwa-manifest')
    if (!link) return
    const href = isPublicMenu ? '/manifest-cliente.webmanifest' : '/manifest-admin.webmanifest'
    if (link.getAttribute('href') !== href) link.setAttribute('href', href)
  }, [isPublicMenu])

  const updateNotice = updateAvailable && (
    <aside
      role="status"
      style={{
        position: 'fixed',
        zIndex: 2000,
        right: 20,
        bottom: isPublicMenu ? 96 : 20,
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        maxWidth: 'calc(100vw - 32px)',
        padding: '12px 14px',
        border: '1px solid rgba(255, 200, 61, .45)',
        borderRadius: 14,
        background: 'rgba(17, 17, 20, .96)',
        color: '#fff',
        boxShadow: '0 12px 32px rgba(0,0,0,.4)',
        font: '500 14px/1.35 Inter, system-ui, sans-serif',
      }}
    >
      <span>Hay una actualización lista.</span>
      <button
        type="button"
        onClick={() => window.dispatchEvent(new Event('fullchina:pwa-apply-update'))}
        style={{
          flexShrink: 0,
          border: 0,
          borderRadius: 9,
          padding: '9px 12px',
          background: '#e31b2b',
          color: '#fff',
          font: '700 13px Inter, system-ui, sans-serif',
          cursor: 'pointer',
        }}
      >
        Actualizar
      </button>
      <button
        type="button"
        aria-label="Cerrar aviso de actualización"
        onClick={() => setUpdateAvailable(false)}
        style={{ border: 0, background: 'transparent', color: '#aaa', fontSize: 18, cursor: 'pointer' }}
      >
        ×
      </button>
    </aside>
  )

  if (isPublicMenu) return <>{updateNotice}<Suspense fallback={<PublicMenuSkeleton />}><PublicMenu /></Suspense></>
  // El bundle de AdminApp (login + dashboard + AuthProvider, que es quien
  // controla el splash real con barra de progreso) se descarga aquí. Antes
  // de que exista ese AuthProvider no hay forma de mostrar el splash real,
  // así que este fallback debe ser un fondo liso (nunca el ModuleLoader con
  // spinner) para no mostrar una "segunda pantalla de carga" distinta.
  return <>{updateNotice}<Suspense fallback={<div style={{ backgroundColor: '#000', width: '100vw', height: '100dvh' }} />}><AdminApp /></Suspense></>
}

export default function App() {
  return <BrowserRouter><AppContent /></BrowserRouter>
}
