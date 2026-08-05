import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { useAuth } from './context/auth-context'
import { DemoDataProvider } from './context/DemoDataProvider'
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

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading, demoMode } = useAuth()

  if (loading) return <div className="login-page"><p>Cargando...</p></div>
  if (!user && !demoMode) return <Navigate to="/login" replace />
  return <>{children}</>
}

function AppRoutes() {
  const { user, demoMode } = useAuth()

  return (
    <Routes>
      <Route
        path="/login"
        element={user || demoMode ? <Navigate to="/" replace /> : <Login />}
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
        <Route path="/inventario" element={<Inventario />} />
        <Route path="/produccion" element={<Produccion />} />
        <Route path="/recetas" element={<Recetas />} />
        <Route path="/compras" element={<Compras />} />
        <Route path="/finanzas" element={<Finanzas />} />
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
