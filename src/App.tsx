import { useCallback } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { DemoDataProvider } from './context/DemoDataProvider'

import { useAuth } from './context/auth-context'
import { SplashScreen } from './components/SplashScreen'
import { Layout } from './components/Layout'
import { Login } from './pages/Login'
import { Inicio } from './pages/Inicio'
import { Caja } from './pages/Caja'
import { Comandas } from './pages/Comandas'
import { Cocina } from './pages/Cocina'
import { Clientes } from './pages/Clientes'
import { Inventario } from './pages/Inventario'
import { Produccion } from './pages/Produccion'
import { Recetas } from './pages/Recetas'
import { Compras } from './pages/Compras'
import { Finanzas } from './pages/Finanzas'
import { Nomina } from './pages/Nomina'
import { Auditoria } from './pages/Auditoria'
import { Mas } from './pages/Mas'
import { Reportes } from './pages/Reportes'
import { Almacen } from './pages/Almacen'
import { MarketingWhatsApp } from './pages/MarketingWhatsApp'
import { Fidelizacion } from './pages/Fidelizacion'
import { MenuSemanal } from './pages/MenuSemanal'
import { Gastos } from './pages/Gastos'
import { Equipo } from './pages/Equipo'

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
    <Routes>
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
        <Route path="/" element={<Inicio />} />
        <Route path="/caja" element={<Caja />} />
        <Route path="/comandas" element={<Comandas />} />
        <Route path="/cocina" element={<Cocina />} />
        <Route path="/clientes" element={<Clientes />} />
        <Route path="/almacen" element={<Almacen />} />
        <Route path="/inventario" element={<Inventario />} />
        <Route path="/produccion" element={<Produccion />} />
        <Route path="/recetas" element={<Recetas />} />
        <Route path="/menu-semanal" element={<MenuSemanal />} />
        <Route path="/compras" element={<Compras />} />
        <Route path="/gastos" element={<Gastos />} />
        <Route path="/finanzas" element={<Finanzas />} />
        <Route path="/equipo" element={<Equipo />} />
        <Route path="/fidelizacion" element={<Fidelizacion />} />
        <Route path="/marketing" element={<MarketingWhatsApp />} />
        <Route path="/nomina" element={<Nomina />} />
        <Route path="/auditoria" element={<Auditoria />} />
        <Route path="/mas" element={<Mas />} />
        <Route path="/reportes" element={<Reportes />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <DemoDataProvider>
          <AppRoutes />
        </DemoDataProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}
