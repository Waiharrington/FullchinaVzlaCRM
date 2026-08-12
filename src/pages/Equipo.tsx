import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../context/auth-context'
import { Users, UserPlus, Shield, CheckCircle2, XCircle, Loader2, Edit3, AlertTriangle } from 'lucide-react'
import { getAllEmployees, createEmployee, updateEmployee } from '../lib/dataService'
import type { Employee } from '../lib/dataService'
import './Equipo.css'

export function Equipo() {
  const { user } = useAuth()
  const [team, setTeam] = useState<Employee[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [showModal, setShowModal] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [position, setPosition] = useState('')
  const [hourlyRate, setHourlyRate] = useState(0)
  const [notice, setNotice] = useState('')

  const load = useCallback(async () => {
    try {
      setLoading(true)
      setError('')
      setTeam(await getAllEmployees())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error cargando empleados')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  const handleOpenModal = (emp?: Employee) => {
    if (emp) {
      setEditingId(emp.id)
      setName(emp.fullName)
      setPosition(emp.position ?? '')
      setHourlyRate(emp.hourlyRate)
    } else {
      setEditingId(null)
      setName('')
      setPosition('')
      setHourlyRate(0)
    }
    setShowModal(true)
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    try {
      if (editingId) {
        await updateEmployee(editingId, { fullName: name.trim(), position: position.trim() || null, hourlyRate })
        setNotice(`"${name.trim()}" actualizado con éxito`)
      } else {
        await createEmployee({ fullName: name.trim(), position: position.trim() || null, hourlyRate })
        setNotice(`"${name.trim()}" registrado correctamente`)
      }
      setShowModal(false)
      await load()
      setTimeout(() => setNotice(''), 4000)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error guardando')
    }
  }

  const toggleActive = async (emp: Employee) => {
    try {
      await updateEmployee(emp.id, { isActive: !emp.isActive })
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error actualizando')
    }
  }

  if (loading) {
    return (
      <div className="page animate-fade-in">
        <div style={{ display: 'flex', justifyContent: 'center', padding: '64px 0' }}>
          <Loader2 size={32} className="animate-spin" style={{ color: '#ef4444' }} />
        </div>
      </div>
    )
  }

  return (
    <div className="equipo-page">
      <div className="almacen-card" style={{ background: 'linear-gradient(135deg, #18181b 0%, #27272a 100%)' }}>
        <div className="prod-card-header-bar">
          <div className="header-title-group">
            <div className="card-header-icon-red" style={{ background: '#dc2626' }}>
              <Users size={20} />
            </div>
            <div>
              <h2 className="prod-card-title">Gestión de Equipo y Personal</h2>
              <span className="metric-sub-text">
                {team.length} empleados · {team.filter(e => e.isActive).length} activos
              </span>
            </div>
          </div>
          {user?.role === 'owner' || user?.role === 'manager' ? (
            <button className="btn-transfer-submit" style={{ margin: 0, padding: '8px 16px', fontSize: '13px' }} onClick={() => handleOpenModal()}>
              <UserPlus size={16} /> Crear Miembro
            </button>
          ) : null}
        </div>
      </div>

      {error && (
        <div className="whatsapp-notice-banner" style={{ background: 'rgba(239,68,68,0.15)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)' }}>
          <AlertTriangle size={18} /> {error}
          <button onClick={() => setError('')} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer' }}>✕</button>
        </div>
      )}

      {notice && (
        <div className="whatsapp-notice-banner" style={{ background: 'rgba(16,185,129,0.15)', color: '#10b981', border: '1px solid rgba(16,185,129,0.3)' }}>
          <CheckCircle2 size={18} /> {notice}
        </div>
      )}

      <div className="team-grid">
        {team.map(emp => (
          <div key={emp.id} className={`team-card ${!emp.isActive ? 'inactive' : ''}`}>
            <div className="team-card-header">
              <div className="team-avatar">
                {emp.fullName.charAt(0).toUpperCase()}
              </div>
              <div className="team-info-header">
                <h3 className="team-name">{emp.fullName}</h3>
                <span className="team-badge">{emp.position || 'Sin cargo'}</span>
              </div>
            </div>

            <div className="team-card-details">
              <div className="detail-row">
                <span style={{ color: '#a1a1aa', fontSize: '13px' }}>Tarifa/hora:</span>
                <span style={{ color: '#fff', fontSize: '13px' }}>${emp.hourlyRate.toFixed(2)}</span>
              </div>
            </div>

            <div className="team-card-actions">
              <button
                className={`status-toggle-btn ${emp.isActive ? 'active' : 'inactive'}`}
                onClick={() => toggleActive(emp)}
              >
                {emp.isActive ? <CheckCircle2 size={14} /> : <XCircle size={14} />}
                {emp.isActive ? 'Activo' : 'Suspendido'}
              </button>

              <button className="icon-action-btn" title="Editar" onClick={() => handleOpenModal(emp)}>
                <Edit3 size={16} />
              </button>
            </div>
          </div>
        ))}

        {team.length === 0 && (
          <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '48px 16px', color: '#71717a' }}>
            <Users size={48} style={{ marginBottom: '12px', opacity: 0.3 }} />
            <p>No hay empleados registrados. Crea el primero con el botón de arriba.</p>
          </div>
        )}
      </div>

      <div className="almacen-card mt-6">
        <h3 style={{ color: '#fff', fontSize: '16px', fontWeight: 800, marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Shield size={18} style={{ color: '#dc2626' }} /> Matriz de Permisos por Rol
        </h3>
        <div style={{ overflowX: 'auto' }}>
          <table className="perm-table">
            <thead>
              <tr>
                <th>Módulo</th>
                <th>Owner</th>
                <th>Manager</th>
                <th>Cashier</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Ventas y Caja</td>
                <td><CheckCircle2 size={14} className="text-green" /> Total</td>
                <td><CheckCircle2 size={14} className="text-green" /> Total</td>
                <td><CheckCircle2 size={14} className="text-green" /> Total</td>
              </tr>
              <tr>
                <td>Costos y Márgenes</td>
                <td><CheckCircle2 size={14} className="text-green" /> Visibles</td>
                <td><CheckCircle2 size={14} className="text-green" /> Visibles</td>
                <td><XCircle size={14} className="text-red" /> Ocultos</td>
              </tr>
              <tr>
                <td>Inventario y Almacén</td>
                <td><CheckCircle2 size={14} className="text-green" /> Total</td>
                <td><CheckCircle2 size={14} className="text-green" /> Transferencias</td>
                <td><XCircle size={14} className="text-red" /> Solo lectura</td>
              </tr>
              <tr>
                <td>Nómina y Finanzas</td>
                <td><CheckCircle2 size={14} className="text-green" /> Total</td>
                <td><XCircle size={14} className="text-red" /> Cierre operativo</td>
                <td><XCircle size={14} className="text-red" /> Bloqueado</td>
              </tr>
              <tr>
                <td>Gestión de Equipo</td>
                <td><CheckCircle2 size={14} className="text-green" /> Total</td>
                <td><CheckCircle2 size={14} className="text-green" /> Crear empleados</td>
                <td><XCircle size={14} className="text-red" /> Bloqueado</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <div className="modal-overlay">
          <div className="modal-content-custom">
            <div className="modal-header-custom">
              <h3>{editingId ? 'Editar Miembro' : 'Crear Nuevo Miembro del Equipo'}</h3>
              <button className="close-btn" onClick={() => setShowModal(false)}>✕</button>
            </div>
            <form onSubmit={handleSave} className="modal-form">
              <div className="form-group">
                <label>Nombre completo</label>
                <input
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="Ej. Pedro Pérez"
                  required
                />
              </div>

              <div className="form-group">
                <label>Cargo / Posición</label>
                <input
                  type="text"
                  value={position}
                  onChange={e => setPosition(e.target.value)}
                  placeholder="Ej. Cajero, Cocinero, Encargado"
                />
              </div>

              <div className="form-group">
                <label>Tarifa por hora (USD)</label>
                <input
                  type="number"
                  min="0"
                  step="0.25"
                  value={hourlyRate}
                  onChange={e => setHourlyRate(parseFloat(e.target.value) || 0)}
                />
              </div>

              <div className="modal-actions-bar">
                <button type="button" className="btn-cancel" onClick={() => setShowModal(false)}>Cancelar</button>
                <button type="submit" className="btn-save">{editingId ? 'Guardar Cambios' : 'Crear Miembro'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
