import { useState, useEffect, useCallback } from 'react'
import { getAuditLogs, type AuditLog } from '../lib/dataService'
import { Shield, AlertTriangle, RefreshCw } from 'lucide-react'
import './Auditoria.css'
import { PageSkeleton } from '../components/PageSkeleton'
import Toast from '../components/Toast'

export function Auditoria() {
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [migrationNeeded, setMigrationNeeded] = useState(false)

  const load = useCallback(async () => {
    try {
      setLoading(true)
      setError('')
      setMigrationNeeded(false)
      const data = await getAuditLogs()
      setLogs(data)
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Error cargando auditoría'
      if (msg.includes('relation') && msg.includes('does not exist')) {
        setMigrationNeeded(true)
        setLogs([])
      } else {
        setError(msg)
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  const getSeverityBadge = (severity: AuditLog['severity']) => {
    switch (severity) {
      case 'danger':
        return <span className="badge badge-danger">PELIGRO</span>
      case 'warning':
        return <span className="badge badge-warning">ALERTA</span>
      case 'info':
      default:
        return <span className="badge badge-info">INFO</span>
    }
  }

  if (loading) {
    return <PageSkeleton cards={2} rows={5} />
  }

  if (migrationNeeded) {
    return (
      <div className="page animate-fade-in" key="auditoria-migration-needed">
        <header className="page-header">
          <div>
            <h1 className="page-title"><Shield size={22} className="page-title-icon" /> Registro de Actividad y Auditoría</h1>
            <p className="page-subtitle">Bitácora de acciones sensibles del sistema</p>
          </div>
        </header>
        <div className="card table-card" style={{ textAlign: 'center', padding: '48px 16px' }}>
          <AlertTriangle size={48} style={{ color: '#eab308', marginBottom: '16px', opacity: 0.6 }} />
          <h3 style={{ color: '#fff', fontSize: '16px', marginBottom: '8px' }}>Migración pendiente</h3>
          <p style={{ color: '#a1a1aa', fontSize: '14px', maxWidth: '480px', margin: '0 auto' }}>
            La tabla <code style={{ color: '#ef4444' }}>audit_logs</code> aún no existe en el esquema remoto.
            Ejecuta la migración <code>20260811000000_audit_logs.sql</code> en el VPS con backup previo.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="page animate-fade-in" key="auditoria-full">
      <header className="page-header">
        <div>
          <h1 className="page-title"><Shield size={22} className="page-title-icon" /> Registro de Actividad y Auditoría</h1>
          <p className="page-subtitle">
            {logs.length} registros · Solo el rol Owner tiene acceso
          </p>
        </div>
        <button className="btn-transfer-submit" style={{ margin: 0 }} onClick={() => load()}>
          <RefreshCw size={16} /> Actualizar
        </button>
      </header>

      {error && <Toast type="error" message={error} onClose={() => setError('')} />}

      <div className="card table-card mt-6">
        <div className="card-header">
          <h2 className="card-title">
            <Shield size={18} style={{ verticalAlign: 'middle', marginRight: '8px', color: '#dc2626' }} />
            Bitácora de Operaciones Sensibles
          </h2>
        </div>
        <div className="table-responsive-wrapper">
          <table className="almacen-table">
            <thead>
              <tr>
                <th>Hora</th>
                <th>Usuario</th>
                <th>Módulo</th>
                <th>Acción</th>
                <th>Detalle</th>
                <th>Nivel</th>
              </tr>
            </thead>
            <tbody>
              {logs.map(log => (
                <tr key={log.id}>
                  <td>{new Date(log.occurredAt).toLocaleString('es-VE')}</td>
                  <td>{log.actorName}</td>
                  <td>
                    <span className="badge badge-outline">{log.module}</span>
                  </td>
                  <td><strong>{log.action}</strong></td>
                  <td style={{ color: '#a1a1aa', fontSize: '12px', maxWidth: '300px' }}>{log.details || '—'}</td>
                  <td>{getSeverityBadge(log.severity)}</td>
                </tr>
              ))}
              {logs.length === 0 && (
                <tr><td colSpan={6} style={{ textAlign: 'center', color: '#71717a' }}>No hay registros de auditoría.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
