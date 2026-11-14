import { lazy, Suspense, useEffect, useLayoutEffect, useState } from 'react'
import { BrowserRouter, Navigate, useLocation } from 'react-router-dom'

const PublicMenu = lazy(() => import('./pages/PublicMenu').then(module => ({ default: module.PublicMenu })))
const PwaInstallPrompt = lazy(() => import('./components/PwaInstallPrompt').then(module => ({ default: module.PwaInstallPrompt })))
const AdminApp = lazy(() => import('./AdminApp'))

function AppContent() {
  const location = useLocation()
  const isPublicMenu = /^\/pedir\/?$/i.test(location.pathname)
  const isPublicEntry = location.pathname === '/'
  const [updateStatus, setUpdateStatus] = useState<'available' | 'applying' | null>(() =>
    (window as typeof window & { fullChinaUpdateAvailable?: boolean }).fullChinaUpdateAvailable ? 'available' : null,
  )

  useEffect(() => {
    const showUpdate = () => setUpdateStatus(current => current === 'applying' ? current : 'available')
    const markApplying = () => setUpdateStatus('applying')
    // No dejar un aviso de error persistente ni ofrecer un reintento que no
    // haya podido completar. La app puede volver a anunciar otra actualización.
    const markFailed = () => setUpdateStatus(null)
    window.addEventListener('fullchina:pwa-update-available', showUpdate)
    window.addEventListener('fullchina:pwa-update-applying', markApplying)
    window.addEventListener('fullchina:pwa-update-apply-failed', markFailed)
    return () => {
      window.removeEventListener('fullchina:pwa-update-available', showUpdate)
      window.removeEventListener('fullchina:pwa-update-applying', markApplying)
      window.removeEventListener('fullchina:pwa-update-apply-failed', markFailed)
    }
  }, [])

  useLayoutEffect(() => {
    window.scrollTo(0, 0)
  }, [location.key])

  useLayoutEffect(() => {
    // If the public route was reached through an SPA transition, the browser
    // still has the admin HTML document and may bind installation to its
    // manifest. Reload once through Vercel's dedicated customer HTML entry.
    if (isPublicMenu && document.documentElement.dataset.pwaEntry !== 'cliente') {
      window.location.replace('/pedir')
    }
  }, [isPublicMenu])

  useEffect(() => {
    const link = document.getElementById('pwa-manifest')
    if (!link) return
    const href = isPublicMenu || isPublicEntry ? '/manifest-cliente.webmanifest' : '/manifest-admin.webmanifest'
    if (link.getAttribute('href') !== href) link.setAttribute('href', href)
  }, [isPublicMenu, isPublicEntry])

  const updateNotice = updateStatus && (
    <aside
      role="status"
      style={{
        position: 'fixed',
        zIndex: 2000,
        right: 20,
        bottom: isPublicMenu ? 170 : 20,
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
      <span role="status" aria-live="polite">
        {updateStatus === 'applying' ? 'Aplicando la actualización…' : 'Hay una actualización lista.'}
      </span>
      <button
        type="button"
        disabled={updateStatus === 'applying'}
        aria-busy={updateStatus === 'applying'}
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
          opacity: updateStatus === 'applying' ? .7 : 1,
        }}
      >
        {updateStatus === 'applying' ? 'Aplicando…' : 'Actualizar'}
      </button>
      <button
        type="button"
        aria-label="Cerrar aviso de actualización"
        disabled={updateStatus === 'applying'}
        onClick={() => setUpdateStatus(null)}
        style={{ border: 0, background: 'transparent', color: '#aaa', fontSize: 18, cursor: 'pointer' }}
      >
        ×
      </button>
    </aside>
  )

  if (isPublicEntry) return <Navigate to="/pedir" replace />
  if (isPublicMenu) return <>
    {updateNotice}
    <Suspense fallback={<div style={{ backgroundColor: '#0a0b0e', width: '100vw', height: '100dvh' }} />}><PublicMenu /></Suspense>
    <Suspense fallback={null}><PwaInstallPrompt /></Suspense>
  </>
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
