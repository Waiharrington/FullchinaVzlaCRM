import { lazy, Suspense, useCallback, useEffect, useState } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { RatesProvider } from './context/RatesProvider'
import { useAuth } from './context/auth-context'
import { SplashScreen } from './components/SplashScreen'
import { ModuleLoader } from './components/ModuleLoader'
import { Layout } from './components/Layout'
import { Login } from './pages/Login'
import { canAccessModule, type Role } from './components/navItems'

const Inicio = lazy(() => import('./pages/Inicio').then(module => ({ default: module.Inicio })))
const Caja = lazy(() => import('./pages/Caja').then(module => ({ default: module.Caja })))
const CajaOperativa = lazy(() => import('./pages/CajaOperativa').then(module => ({ default: module.CajaOperativa })))
const Comandas = lazy(() => import('./pages/Comandas').then(module => ({ default: module.Comandas })))
const Mesas = lazy(() => import('./pages/Mesas').then(module => ({ default: module.Mesas })))
const Cocina = lazy(() => import('./pages/Cocina').then(module => ({ default: module.Cocina })))
const Clientes = lazy(() => import('./pages/Clientes').then(module => ({ default: module.Clientes })))
const Proveedores = lazy(() => import('./pages/Proveedores').then(module => ({ default: module.Proveedores })))
const Inventario = lazy(() => import('./pages/Inventario').then(module => ({ default: module.Inventario })))
const Produccion = lazy(() => import('./pages/ProduccionReal').then(module => ({ default: module.ProduccionReal })))
const Recetas = lazy(() => import('./pages/RecetasReal').then(module => ({ default: module.RecetasReal })))
const Compras = lazy(() => import('./pages/ComprasReal').then(module => ({ default: module.ComprasReal })))
const Finanzas = lazy(() => import('./pages/Finanzas').then(module => ({ default: module.Finanzas })))
const Nomina = lazy(() => import('./pages/Nomina').then(module => ({ default: module.Nomina })))
const Auditoria = lazy(() => import('./pages/Auditoria').then(module => ({ default: module.Auditoria })))
const Mas = lazy(() => import('./pages/Mas').then(module => ({ default: module.Mas })))
const Reportes = lazy(() => import('./pages/Reportes').then(module => ({ default: module.Reportes })))
const Almacen = lazy(() => import('./pages/Almacen').then(module => ({ default: module.Almacen })))
const MarketingWhatsApp = lazy(() => import('./pages/MarketingWhatsApp').then(module => ({ default: module.MarketingWhatsApp })))
const Fidelizacion = lazy(() => import('./pages/Fidelizacion').then(module => ({ default: module.Fidelizacion })))
const MenuSemanal = lazy(() => import('./pages/MenuSemanal').then(module => ({ default: module.MenuSemanal })))
const Menu = lazy(() => import('./pages/Menu').then(module => ({ default: module.Menu })))
const Gastos = lazy(() => import('./pages/Gastos').then(module => ({ default: module.Gastos })))
const Equipo = lazy(() => import('./pages/Equipo').then(module => ({ default: module.Equipo })))
const Promociones = lazy(() => import('./pages/Promociones').then(module => ({ default: module.Promociones })))

function ModuleRoute({ path, fallbackRoles, children }: { path: string; fallbackRoles?: Role[]; children: React.ReactNode }) {
  const { user } = useAuth()
  if (!user || !canAccessModule(path, user.role, user.allowedModules, fallbackRoles)) return <Navigate to="/caja" replace />
  return <>{children}</>
}

const forModule = (path: string, element: React.ReactNode, fallbackRoles?: Role[]) => (
  <ModuleRoute path={path} fallbackRoles={fallbackRoles}>{element}</ModuleRoute>
)

function InitialRouteContent({ children, onReady }: { children: React.ReactNode; onReady: () => void }) {
  useEffect(() => { onReady() }, [onReady])
  return <>{children}</>
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading, splashDone, setSplashDone } = useAuth()
  const location = useLocation()
  const [initialRouteReady, setInitialRouteReady] = useState(false)
  const handleSplashDone = useCallback(() => setSplashDone(true), [setSplashDone])
  const handleInitialRouteReady = useCallback(() => setInitialRouteReady(true), [])
  const splashReady = !loading && (!user || initialRouteReady)

  return (
    <>
      {!splashDone ? <SplashScreen onDone={handleSplashDone} minDuration={1200} ready={splashReady} /> : null}
      {!loading && user ? (
        <Suspense fallback={!splashDone ? null : <ModuleLoader />}>
          <InitialRouteContent onReady={handleInitialRouteReady}>{children}</InitialRouteContent>
        </Suspense>
      ) : null}
      {!loading && !user && splashDone ? <Navigate to={location.pathname === '/' ? '/pedir' : '/login'} replace /> : null}
    </>
  )
}

function AdminRoutes() {
  const { user, loading, splashDone } = useAuth()
  return (
    <Suspense fallback={splashDone ? <ModuleLoader /> : null}>
      <Routes>
        <Route path="/login" element={loading ? null : user ? <Navigate to="/" replace /> : <Login />} />
        <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
          <Route path="/" element={forModule('/', <Inicio />)} />
          <Route path="/caja" element={forModule('/caja', <Caja />)} />
          <Route path="/mesas" element={forModule('/mesas', <Mesas />)} />
          <Route path="/caja-operativa" element={forModule('/caja-operativa', <CajaOperativa />)} />
          <Route path="/comandas" element={forModule('/comandas', <Comandas />)} />
          <Route path="/cocina" element={forModule('/cocina', <Cocina />, ['owner', 'manager'])} />
          <Route path="/clientes" element={forModule('/clientes', <Clientes />)} />
          <Route path="/proveedores" element={forModule('/proveedores', <Proveedores />, ['owner', 'manager'])} />
          <Route path="/almacen" element={forModule('/almacen', <Almacen />)} />
          <Route path="/inventario" element={forModule('/inventario', <Inventario />)} />
          <Route path="/produccion" element={forModule('/produccion', <Produccion />)} />
          <Route path="/recetas" element={forModule('/recetas', <Recetas />)} />
          <Route path="/menu" element={forModule('/menu', <Menu />)} />
          <Route path="/menu-semanal" element={forModule('/menu-semanal', <MenuSemanal />)} />
          <Route path="/compras" element={forModule('/compras', <Compras />)} />
          <Route path="/gastos" element={forModule('/gastos', <Gastos />)} />
          <Route path="/finanzas" element={forModule('/finanzas', <Finanzas />)} />
          <Route path="/equipo" element={forModule('/equipo', <Equipo />)} />
          <Route path="/fidelizacion" element={forModule('/fidelizacion', <Fidelizacion />)} />
          <Route path="/marketing" element={forModule('/marketing', <MarketingWhatsApp />)} />
          <Route path="/nomina" element={forModule('/nomina', <Nomina />)} />
          <Route path="/creditos" element={forModule('/creditos', <Mas />)} />
          <Route path="/auditoria" element={forModule('/auditoria', <Auditoria />, ['owner'])} />
          <Route path="/mas" element={forModule('/mas', <Mas />)} />
          <Route path="/promociones" element={forModule('/promociones', <Promociones />)} />
          <Route path="/reportes" element={forModule('/reportes', <Reportes />)} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  )
}

export default function AdminApp() {
  return <RatesProvider><AuthProvider><AdminRoutes /></AuthProvider></RatesProvider>
}
