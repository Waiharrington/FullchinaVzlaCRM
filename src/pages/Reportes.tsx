import { useAuth } from '../context/auth-context'
import './Reportes.css'
import { BarChart3 } from 'lucide-react'
import { ReportExplorer } from '../components/ReportExplorer'

export function Reportes() {
  const { user } = useAuth()

  if (user?.role === 'cashier') {
    return (
      <div className="page animate-fade-in management-workspace management-workspace--reports" key="reportes-restricted">
        <header className="page-header management-workspace-header">
          <div>
            <h1 className="page-title"><BarChart3 size={22} className="page-title-icon" /> Reportes</h1>
            <p className="page-subtitle">Acceso restringido</p>
          </div>
        </header>
        <div className="card restricted-card">
          <p>No tiene permisos para ver reportes financieros.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="page animate-fade-in management-workspace management-workspace--reports" key="reportes-full">
      <header className="page-header management-workspace-header">
        <div>
          <h1 className="page-title"><BarChart3 size={22} className="page-title-icon" /> Reportes</h1>
          <p className="page-subtitle">Análisis de ventas y rendimiento</p>
        </div>
      </header>

      <ReportExplorer />
    </div>
  )
}
