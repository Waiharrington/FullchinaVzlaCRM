import { lazy, Suspense, useEffect } from 'react'
import { BrowserRouter, useLocation } from 'react-router-dom'

const PublicOnboarding = lazy(() => import('./pages/PublicOnboarding').then(module => ({ default: module.PublicOnboarding })))
const AdminApp = lazy(() => import('./AdminApp'))

function AppContent() {
  const location = useLocation()
  const isPublicMenu = /^\/pedir\/?$/i.test(location.pathname)

  useEffect(() => {
    const link = document.getElementById('pwa-manifest')
    if (!link) return
    const href = isPublicMenu ? '/manifest-cliente.webmanifest' : '/manifest-admin.webmanifest'
    if (link.getAttribute('href') !== href) link.setAttribute('href', href)
  }, [isPublicMenu])

  if (isPublicMenu) return <Suspense fallback={<div style={{ backgroundColor: '#0b0c10', width: '100vw', height: '100dvh' }} />}><PublicOnboarding /></Suspense>
  // El bundle de AdminApp (login + dashboard + AuthProvider, que es quien
  // controla el splash real con barra de progreso) se descarga aquí. Antes
  // de que exista ese AuthProvider no hay forma de mostrar el splash real,
  // así que este fallback debe ser un fondo liso (nunca el ModuleLoader con
  // spinner) para no mostrar una "segunda pantalla de carga" distinta.
  return <Suspense fallback={<div style={{ backgroundColor: '#000', width: '100vw', height: '100dvh' }} />}><AdminApp /></Suspense>
}

export default function App() {
  return <BrowserRouter><AppContent /></BrowserRouter>
}
