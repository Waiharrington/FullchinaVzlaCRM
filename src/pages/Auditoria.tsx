import { useState } from 'react'
import './Auditoria.css'

interface AuditLog {
  id: string
  timestamp: string
  user: string
  action: string
  module: string
  details: string
  severity: 'info' | 'warning' | 'danger'
}

export function Auditoria() {
  const [logs] = useState<AuditLog[]>([
    {
      id: 'LOG-001',
      timestamp: new Date().toLocaleTimeString('es'),
      user: 'Ana García (Cajera)',
      action: 'Venta Anulada',
      module: 'Caja POS',
      details: 'Anulación de orden ORD-042 por monto $15.00 (Cliente cambió de opinión)',
      severity: 'warning',
    },
    {
      id: 'LOG-002',
      timestamp: new Date(Date.now() - 3600000).toLocaleTimeString('es'),
      user: 'Carlos Ruiz (Manager)',
      action: 'Ajuste Manual de Inventario',
      module: 'Inventario',
      details: 'Salida de 2.0 kg Pechuga de Pollo por merma/daño',
      severity: 'danger',
    },
    {
      id: 'LOG-003',
      timestamp: new Date(Date.now() - 7200000).toLocaleTimeString('es'),
      user: 'Ana García (Cajera)',
      action: 'Apertura de Caja',
      module: 'Caja',
      details: 'Apertura de turno con monto base $50.00 en efectivo',
      severity: 'info',
    },
  ])

  return (
    <div className="page animate-fade-in">
      <header className="page-header">
        <div>
          <h1 className="page-title text-gradient">Registro de Actividad y Auditoría</h1>
          <p className="page-subtitle">Rastreo de acciones sensibles, modificaciones de precios y anulaciones</p>
        </div>
      </header>

      <div className="card table-card mt-6">
        <div className="card-header">
          <h2 className="card-title">Bitácora de Operaciones Sensibles</h2>
        </div>
        <table className="data-table">
          <thead>
            <tr>
              <th>ID Log</th>
              <th>Hora</th>
              <th>Usuario</th>
              <th>Módulo</th>
              <th>Acción Realizada</th>
              <th>Detalle de la Operación</th>
              <th>Nivel</th>
            </tr>
          </thead>
          <tbody>
            {logs.map(log => (
              <tr key={log.id}>
                <td>
                  <strong>{log.id}</strong>
                </td>
                <td>{log.timestamp}</td>
                <td>{log.user}</td>
                <td>
                  <span className="badge badge-outline">{log.module}</span>
                </td>
                <td>
                  <strong>{log.action}</strong>
                </td>
                <td>{log.details}</td>
                <td>
                  <span
                    className={`badge ${
                      log.severity === 'danger'
                        ? 'badge-danger'
                        : log.severity === 'warning'
                        ? 'badge-warning'
                        : 'badge-info'
                    }`}
                  >
                    {log.severity.toUpperCase()}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
