import { lazy, Suspense, useEffect } from 'react'
import { BrowserRouter, useLocation } from 'react-router-dom'
import { ModuleLoader } from './components/ModuleLoader'

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
  return <Suspense fallback={<ModuleLoader />}><AdminApp /></Suspense>
}

export default function App() {
  return <BrowserRouter><AppContent /></BrowserRouter>
}
