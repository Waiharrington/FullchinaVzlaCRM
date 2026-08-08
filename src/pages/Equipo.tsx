import { useState } from 'react'
import { useAuth } from '../context/auth-context'
import { Users, UserPlus, Shield, CheckCircle2, XCircle, Mail, Phone, Edit3, Award } from 'lucide-react'
import './Equipo.css'

export interface TeamMember {
  id: string
  name: string
  email: string
  phone: string
  role: 'owner' | 'manager' | 'cashier' | 'cook'
  active: boolean
  commissionPct: number
  createdAt: string
}

const INITIAL_TEAM: TeamMember[] = [
  {
    id: 'u1',
    name: 'Andrea (Dueña)',
    email: 'duena@fullchinavzla.com',
    phone: '0424-3510719',
    role: 'owner',
    active: true,
    commissionPct: 0,
    createdAt: '2026-08-01'
  },
  {
    id: 'u2',
    name: 'Carlos Rodríguez (Encargado)',
    email: 'carlos@fullchinavzla.com',
    phone: '0412-9876543',
    role: 'manager',
    active: true,
    commissionPct: 5,
    createdAt: '2026-08-02'
  },
  {
    id: 'u3',
    name: 'María García (Cajera)',
    email: 'maria@fullchinavzla.com',
    phone: '0414-1234567',
    role: 'cashier',
    active: true,
    commissionPct: 3,
    createdAt: '2026-08-03'
  },
  {
    id: 'u4',
    name: 'José Martínez (Cocinero / Wok Master)',
    email: 'jose@fullchinavzla.com',
    phone: '0416-5554433',
    role: 'cook',
    active: true,
    commissionPct: 10,
    createdAt: '2026-08-04'
  }
]

export function Equipo() {
  const { user } = useAuth()
  const [team, setTeam] = useState<TeamMember[]>(INITIAL_TEAM)
  
  // Form State
  const [showModal, setShowModal] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [role, setRole] = useState<TeamMember['role']>('cashier')
  const [commissionPct, setCommissionPct] = useState(5)
  const [notice, setNotice] = useState('')

  const handleOpenModal = (member?: TeamMember) => {
    if (member) {
      setEditingId(member.id)
      setName(member.name)
      setEmail(member.email)
      setPhone(member.phone)
      setRole(member.role)
      setCommissionPct(member.commissionPct)
    } else {
      setEditingId(null)
      setName('')
      setEmail('')
      setPhone('')
      setRole('cashier')
      setCommissionPct(5)
    }
    setShowModal(true)
  }

  const handleSaveMember = (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim() || !email.trim()) return

    if (editingId) {
      setTeam(prev => prev.map(m => m.id === editingId ? { ...m, name, email, phone, role, commissionPct } : m))
      setNotice(`¡Usuario "${name}" actualizado con éxito!`)
    } else {
      const newMember: TeamMember = {
        id: `u-${Date.now()}`,
        name,
        email,
        phone,
        role,
        active: true,
        commissionPct,
        createdAt: new Date().toISOString().split('T')[0]
      }
      setTeam(prev => [newMember, ...prev])
      setNotice(`¡Nuevo miembro "${name}" registrado correctamente!`)
    }

    setShowModal(false)
    setTimeout(() => setNotice(''), 4000)
  }

  const toggleMemberActive = (id: string) => {
    setTeam(prev => prev.map(m => {
      if (m.id === id) {
        return { ...m, active: !m.active }
      }
      return m
    }))
  }

  const getRoleBadge = (r: TeamMember['role']) => {
    switch (r) {
      case 'owner':
        return <span className="team-badge owner">👑 Dueño / Owner</span>
      case 'manager':
        return <span className="team-badge manager">🛡️ Encargado / Manager</span>
      case 'cashier':
        return <span className="team-badge cashier">💵 Cajero / POS</span>
      case 'cook':
        return <span className="team-badge cook">👨‍🍳 Cocinero / Wok</span>
    }
  }

  return (
    <div className="equipo-page">
      {/* Header Banner */}
      <div className="almacen-card" style={{ background: 'linear-gradient(135deg, #18181b 0%, #27272a 100%)' }}>
        <div className="prod-card-header-bar">
          <div className="header-title-group">
            <div className="card-header-icon-red" style={{ background: '#dc2626' }}>
              <Users size={20} />
            </div>
            <div>
              <h2 className="prod-card-title">Gestión de Equipo y Usuarios</h2>
              <span className="metric-sub-text">
                Crea miembros del personal, asigna roles y controla los accesos de cada empleado.
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

      {notice && (
        <div className="whatsapp-notice-banner" style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#10b981', border: '1px solid rgba(16, 185, 129, 0.3)' }}>
          <CheckCircle2 size={18} /> {notice}
        </div>
      )}

      {/* Team Cards Grid */}
      <div className="team-grid">
        {team.map(member => (
          <div key={member.id} className={`team-card ${!member.active ? 'inactive' : ''}`}>
            <div className="team-card-header">
              <div className="team-avatar">
                {member.name.charAt(0).toUpperCase()}
              </div>
              <div className="team-info-header">
                <h3 className="team-name">{member.name}</h3>
                {getRoleBadge(member.role)}
              </div>
            </div>

            <div className="team-card-details">
              <div className="detail-row">
                <Mail size={14} className="detail-icon" />
                <span>{member.email}</span>
              </div>
              <div className="detail-row">
                <Phone size={14} className="detail-icon" />
                <span>{member.phone || 'Sin teléfono'}</span>
              </div>
              <div className="detail-row">
                <Award size={14} className="detail-icon" />
                <span>Comisión: <strong>{member.commissionPct}%</strong> por venta</span>
              </div>
            </div>

            <div className="team-card-actions">
              <button 
                className={`status-toggle-btn ${member.active ? 'active' : 'inactive'}`}
                onClick={() => toggleMemberActive(member.id)}
              >
                {member.active ? <CheckCircle2 size={14} /> : <XCircle size={14} />}
                {member.active ? 'Acceso Activo' : 'Acceso Suspendido'}
              </button>
              
              <button className="icon-action-btn" title="Editar Miembro" onClick={() => handleOpenModal(member)}>
                <Edit3 size={16} />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Role Matrix Permissions Summary */}
      <div className="almacen-card mt-6">
        <h3 style={{ color: '#fff', fontSize: '16px', fontWeight: 800, marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Shield size={18} style={{ color: '#dc2626' }} /> Matriz de Permisos por Rol
        </h3>
        <div style={{ overflowX: 'auto' }}>
          <table className="perm-table">
            <thead>
              <tr>
                <th>Módulo / Funcionalidad</th>
                <th>👑 Owner</th>
                <th>🛡️ Manager</th>
                <th>💵 Cashier (Cajero)</th>
                <th>👨‍🍳 Cook (Cocinero)</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Ventas y Caja (POS)</td>
                <td><CheckCircle2 size={16} className="text-green" /> Acceso Total</td>
                <td><CheckCircle2 size={16} className="text-green" /> Acceso Total</td>
                <td><CheckCircle2 size={16} className="text-green" /> Acceso Total</td>
                <td><XCircle size={16} className="text-gray" /> No accesible</td>
              </tr>
              <tr>
                <td>Ver Costos de Insumos y Márgenes</td>
                <td><CheckCircle2 size={16} className="text-green" /> Visibles</td>
                <td><CheckCircle2 size={16} className="text-green" /> Visibles</td>
                <td><XCircle size={16} className="text-red" /> Ocultos estrictamente</td>
                <td><XCircle size={16} className="text-red" /> Ocultos estrictamente</td>
              </tr>
              <tr>
                <td>Inventario Operativo y Almacén</td>
                <td><CheckCircle2 size={16} className="text-green" /> Control Total</td>
                <td><CheckCircle2 size={16} className="text-green" /> Transferencias</td>
                <td><CheckCircle2 size={16} className="text-green" /> Solo lectura (stock)</td>
                <td><CheckCircle2 size={16} className="text-green" /> Descuento por receta</td>
              </tr>
              <tr>
                <td>Cierres Financieros y Nómina</td>
                <td><CheckCircle2 size={16} className="text-green" /> Acceso Total</td>
                <td><CheckCircle2 size={16} className="text-green" /> Cierre operativo</td>
                <td><XCircle size={16} className="text-red" /> Bloqueado</td>
                <td><XCircle size={16} className="text-red" /> Bloqueado</td>
              </tr>
              <tr>
                <td>Gestión de Equipo y Roles</td>
                <td><CheckCircle2 size={16} className="text-green" /> Exclusivo Owner</td>
                <td><CheckCircle2 size={16} className="text-green" /> Crear Empleados</td>
                <td><XCircle size={16} className="text-red" /> Bloqueado</td>
                <td><XCircle size={16} className="text-red" /> Bloqueado</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Create / Edit Modal */}
      {showModal && (
        <div className="modal-overlay">
          <div className="modal-content-custom">
            <div className="modal-header-custom">
              <h3>{editingId ? 'Editar Miembro' : 'Crear Nuevo Miembro del Equipo'}</h3>
              <button className="close-btn" onClick={() => setShowModal(false)}>✕</button>
            </div>
            <form onSubmit={handleSaveMember} className="modal-form">
              <div className="form-group">
                <label>Nombre y Apellido</label>
                <input 
                  type="text" 
                  value={name} 
                  onChange={e => setName(e.target.value)}
                  placeholder="Ej. Pedro Pérez"
                  required
                />
              </div>

              <div className="form-group">
                <label>Correo Electrónico (Login Supabase)</label>
                <input 
                  type="email" 
                  value={email} 
                  onChange={e => setEmail(e.target.value)}
                  placeholder="ejemplo@fullchina.com"
                  required
                />
              </div>

              <div className="form-group">
                <label>Teléfono de Contacto</label>
                <input 
                  type="text" 
                  value={phone} 
                  onChange={e => setPhone(e.target.value)}
                  placeholder="0412-1234567"
                />
              </div>

              <div className="form-group">
                <label>Rol y Accesos</label>
                <select value={role} onChange={e => setRole(e.target.value as TeamMember['role'])}>
                  <option value="cashier">💵 Cajero (Solo ventas y cobros)</option>
                  <option value="cook">👨‍🍳 Cocinero / Wok (Comandas y producción)</option>
                  <option value="manager">🛡️ Encargado / Manager (Operaciones y compras)</option>
                  <option value="owner">👑 Dueño / Owner (Acceso Total + Financiero)</option>
                </select>
              </div>

              <div className="form-group">
                <label>Comisión por Venta (% USD)</label>
                <input 
                  type="number" 
                  min="0"
                  max="100"
                  step="0.5"
                  value={commissionPct} 
                  onChange={e => setCommissionPct(parseFloat(e.target.value) || 0)}
                />
              </div>

              <div className="modal-actions-bar">
                <button type="button" className="btn-cancel" onClick={() => setShowModal(false)}>Cancelar</button>
                <button type="submit" className="btn-save">{editingId ? 'Guardar Cambios' : 'Crear Usuario'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
