import { lazy, Suspense, useCallback } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { RatesProvider } from './context/RatesProvider'

import { useAuth } from './context/auth-context'
import { SplashScreen } from './components/SplashScreen'
import { Layout } from './components/Layout'
const Login = lazy(() => import('./pages/Login').then(module => ({ default: module.Login })))
const Inicio = lazy(() => import('./pages/Inicio').then(module => ({ default: module.Inicio })))
const Caja = lazy(() => import('./pages/Caja').then(module => ({ default: module.Caja })))
const CajaOperativa = lazy(() => import('./pages/CajaOperativa').then(module => ({ default: module.CajaOperativa })))
const Comandas = lazy(() => import('./pages/Comandas').then(module => ({ default: module.Comandas })))
const Cocina = lazy(() => import('./pages/Cocina').then(module => ({ default: module.Cocina })))
const Clientes = lazy(() => import('./pages/Clientes').then(module => ({ default: module.Clientes })))
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
const PublicMenu = lazy(() => import('./pages/PublicMenu').then(module => ({ default: module.PublicMenu })))

type Role = 'owner' | 'manager' | 'cashier'

function RoleRoute({ roles, children }: { roles: Role[]; children: React.ReactNode }) {
  const { user } = useAuth()
  if (!user || !roles.includes(user.role)) return <Navigate to="/caja" replace />
  return <>{children}</>
}

const forRoles = (roles: Role[], element: React.ReactNode) => (
  <RoleRoute roles={roles}>{element}</RoleRoute>
)

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading, splashDone, setSplashDone } = useAuth()

  const handleSplashDone = useCallback(() => {
    setSplashDone(true)
  }, [setSplashDone])

  if (!splashDone || loading) return <SplashScreen onDone={handleSplashDone} minDuration={2800} />
  if (!user) return <Navigate to="/login" replace />
  return <>{children}</>
}

function AppRoutes() {
  const { user } = useAuth()

  return (
    <Suspense fallback={<div className="page" role="status">Cargando módulo…</div>}>
    <Routes>
      <Route path="/pedir" element={<PublicMenu />} />
      <Route
        path="/login"
        element={user ? <Navigate to="/" replace /> : <Login />}
      />
      <Route
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route path="/" element={forRoles(['owner', 'manager'], <Inicio />)} />
        <Route path="/caja" element={<Caja />} />
        <Route path="/caja-operativa" element={forRoles(['owner', 'manager'], <CajaOperativa />)} />
        <Route path="/comandas" element={<Comandas />} />
        <Route path="/cocina" element={forRoles(['owner', 'manager'], <Cocina />)} />
        <Route path="/clientes" element={forRoles(['owner', 'manager'], <Clientes />)} />
        <Route path="/almacen" element={forRoles(['owner', 'manager'], <Almacen />)} />
        <Route path="/inventario" element={forRoles(['owner', 'manager'], <Inventario />)} />
        <Route path="/produccion" element={forRoles(['owner', 'manager'], <Produccion />)} />
        <Route path="/recetas" element={forRoles(['owner', 'manager'], <Recetas />)} />
        <Route path="/menu" element={forRoles(['owner', 'manager'], <Menu />)} />
        <Route path="/menu-semanal" element={forRoles(['owner', 'manager'], <MenuSemanal />)} />
        <Route path="/compras" element={forRoles(['owner', 'manager'], <Compras />)} />
        <Route path="/gastos" element={forRoles(['owner', 'manager'], <Gastos />)} />
        <Route path="/finanzas" element={forRoles(['owner'], <Finanzas />)} />
        <Route path="/equipo" element={forRoles(['owner', 'manager'], <Equipo />)} />
        <Route path="/fidelizacion" element={forRoles(['owner', 'manager'], <Fidelizacion />)} />
        <Route path="/marketing" element={forRoles(['owner', 'manager'], <MarketingWhatsApp />)} />
        <Route path="/nomina" element={forRoles(['owner'], <Nomina />)} />
        <Route path="/auditoria" element={forRoles(['owner'], <Auditoria />)} />
        <Route path="/mas" element={forRoles(['owner', 'manager'], <Mas />)} />
        <Route path="/reportes" element={forRoles(['owner', 'manager'], <Reportes />)} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
    </Suspense>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <RatesProvider>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </RatesProvider>
    </BrowserRouter>
  )
}
