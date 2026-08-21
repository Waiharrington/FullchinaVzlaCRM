import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../context/auth-context'
import {
  Users, UserPlus, Shield, CheckCircle2, XCircle, Loader2, Edit3, AlertTriangle,
  KeyRound, Mail, UserCog, Ban, Clock, Hash,
} from 'lucide-react'
import {
  getAllEmployees, createEmployee, updateEmployee,
  listAuthUsers, adminCreateUser, adminSetUserPassword, adminSetUserEmail,
  adminSetUserRole, adminSetUserActive, adminSetUserPin,
} from '../lib/dataService'
import { adminSetUserModules } from '../lib/dataService'
import type { Employee, AuthUser } from '../lib/dataService'
import { allNavItems, type Role } from '../components/navItems'
import './Equipo.css'

const ROLE_LABEL: Record<Role, string> = { owner: 'Dueño', manager: 'Gerente', cashier: 'Cajero' }

// Módulos que un rol ve por defecto (para pre-marcar el selector).
function defaultModulesForRole(role: Role): string[] {
  return allNavItems.filter(i => i.roles.includes(role)).map(i => i.path)
}

function timeAgo(iso: string | null): string {
  if (!iso) return 'Nunca'
  const d = new Date(iso).getTime()
  const diff = Date.now() - d
  const min = Math.floor(diff / 60000)
  if (min < 1) return 'Hace instantes'
  if (min < 60) return `Hace ${min} min`
  const h = Math.floor(min / 60)
  if (h < 24) return `Hace ${h} h`
  const days = Math.floor(h / 24)
  if (days < 30) return `Hace ${days} d`
  return new Date(iso).toLocaleDateString('es-VE', { day: '2-digit', month: 'short', year: 'numeric' })
}

export function Equipo() {
  const { user } = useAuth()
  const isOwner = user?.role === 'owner'
  const canManage = user?.role === 'owner' || user?.role === 'manager'

  const [team, setTeam] = useState<Employee[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  // --- Empleados (nómina) ---
  const [showModal, setShowModal] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [position, setPosition] = useState('')
  const [hourlyRate, setHourlyRate] = useState(0)

  // --- Usuarios de acceso ---
  const [authUsers, setAuthUsers] = useState<AuthUser[]>([])
  const [usersLoading, setUsersLoading] = useState(true)
  const [usersError, setUsersError] = useState('')

  const flash = (msg: string) => { setNotice(msg); setTimeout(() => setNotice(''), 4000) }

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

  const loadUsers = useCallback(async () => {
    if (!isOwner) { setUsersLoading(false); return }
    try {
      setUsersLoading(true)
      setUsersError('')
      setAuthUsers(await listAuthUsers())
    } catch (e) {
      setUsersError(e instanceof Error ? e.message : 'Error cargando usuarios de acceso')
    } finally {
      setUsersLoading(false)
    }
  }, [isOwner])

  useEffect(() => { void load(); void loadUsers() }, [load, loadUsers])

  // --- Handlers empleados ---
  const handleOpenModal = (emp?: Employee) => {
    if (emp) {
      setEditingId(emp.id)
      setName(emp.fullName)
      setPosition(emp.position ?? '')
      setHourlyRate(emp.hourlyRate)
    } else {
      setEditingId(null); setName(''); setPosition(''); setHourlyRate(0)
    }
    setShowModal(true)
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    try {
      if (editingId) {
        await updateEmployee(editingId, { fullName: name.trim(), position: position.trim() || null, hourlyRate })
        flash(`"${name.trim()}" actualizado con éxito`)
      } else {
        await createEmployee({ fullName: name.trim(), position: position.trim() || null, hourlyRate })
        flash(`"${name.trim()}" registrado correctamente`)
      }
      setShowModal(false)
      await load()
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

  // --- Handlers usuarios de acceso ---
  const [showUserModal, setShowUserModal] = useState(false)
  const [userModalMode, setUserModalMode] = useState<'create' | 'edit'>('create')
  const [uEditing, setUEditing] = useState<AuthUser | null>(null)
  const [uEmail, setUEmail] = useState('')
  const [uName, setUName] = useState('')
  const [uRole, setURole] = useState<Role>('cashier')
  const [uPassword, setUPassword] = useState('')
  const [uSaving, setUSaving] = useState(false)
  const [uCustomModules, setUCustomModules] = useState(false)
  const [uModules, setUModules] = useState<string[]>([])

  const [showPwModal, setShowPwModal] = useState(false)
  const [pwUser, setPwUser] = useState<AuthUser | null>(null)
  const [pwValue, setPwValue] = useState('')
  const [pwSaving, setPwSaving] = useState(false)

  const [showPinModal, setShowPinModal] = useState(false)
  const [pinUser, setPinUser] = useState<AuthUser | null>(null)
  const [pinValue, setPinValue] = useState('')
  const [pinSaving, setPinSaving] = useState(false)

  const openCreateUser = () => {
    setUserModalMode('create'); setUEditing(null)
    setUEmail(''); setUName(''); setURole('cashier'); setUPassword('')
    setUCustomModules(false); setUModules(defaultModulesForRole('cashier'))
    setShowUserModal(true)
  }
  const openEditUser = (u: AuthUser) => {
    setUserModalMode('edit'); setUEditing(u)
    setUEmail(u.email); setUName(u.fullName); setURole(u.role); setUPassword('')
    setUCustomModules(u.allowedModules !== null)
    setUModules(u.allowedModules ?? defaultModulesForRole(u.role))
    setShowUserModal(true)
  }
  const toggleModule = (path: string) => {
    setUModules(prev => prev.includes(path) ? prev.filter(p => p !== path) : [...prev, path])
  }

  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault()
    setUSaving(true)
    setUsersError('')
    try {
      if (userModalMode === 'create') {
        await adminCreateUser({ email: uEmail.trim(), password: uPassword, fullName: uName.trim(), role: uRole })
        flash(`Usuario "${uEmail.trim()}" creado`)
      } else if (uEditing) {
        if (uEmail.trim().toLowerCase() !== uEditing.email.toLowerCase()) {
          await adminSetUserEmail(uEditing.id, uEmail.trim())
        }
        if (uRole !== uEditing.role) {
          await adminSetUserRole(uEditing.id, uRole)
        }
        if (uRole !== 'owner') {
          await adminSetUserModules(uEditing.id, uCustomModules ? uModules : null)
        } else if (uEditing.allowedModules !== null) {
          await adminSetUserModules(uEditing.id, null)
        }
        flash(`Usuario "${uEmail.trim()}" actualizado`)
      }
      setShowUserModal(false)
      await loadUsers()
    } catch (e) {
      setUsersError(e instanceof Error ? e.message : 'Error guardando usuario')
    } finally {
      setUSaving(false)
    }
  }

  const openPwModal = (u: AuthUser) => { setPwUser(u); setPwValue(''); setShowPwModal(true) }
  const handleSavePw = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!pwUser) return
    setPwSaving(true)
    setUsersError('')
    try {
      await adminSetUserPassword(pwUser.id, pwValue)
      flash(`Contraseña de "${pwUser.email}" actualizada`)
      setShowPwModal(false)
    } catch (e) {
      setUsersError(e instanceof Error ? e.message : 'Error cambiando contraseña')
    } finally {
      setPwSaving(false)
    }
  }

  const openPinModal = (u: AuthUser) => { setPinUser(u); setPinValue(''); setShowPinModal(true) }
  const handleSavePin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!pinUser) return
    setPinSaving(true)
    setUsersError('')
    try {
      await adminSetUserPin(pinUser.id, pinValue)
      flash(`PIN de "${pinUser.email}" actualizado`)
      setShowPinModal(false)
    } catch (e) {
      setUsersError(e instanceof Error ? e.message : 'Error cambiando el PIN')
    } finally {
      setPinSaving(false)
    }
  }

  const toggleUserActive = async (u: AuthUser) => {
    setUsersError('')
    try {
      await adminSetUserActive(u.id, !u.isActive)
      await loadUsers()
    } catch (e) {
      setUsersError(e instanceof Error ? e.message : 'Error actualizando acceso')
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
      {/* Encabezado */}
      <div className="equipo-hero">
        <div className="header-title-group">
          <div className="card-header-icon-red equipo-hero-icon"><Users size={22} /></div>
          <div>
            <h2 className="prod-card-title">Gestión de Equipo y Personal</h2>
            <span className="metric-sub-text">
              {team.length} empleados · {team.filter(e => e.isActive).length} activos
              {isOwner && ` · ${authUsers.length} usuarios de acceso`}
            </span>
          </div>
        </div>
        {canManage && (
          <button className="equipo-primary-btn" onClick={() => handleOpenModal()}>
            <UserPlus size={16} /> Crear Miembro
          </button>
        )}
      </div>

      {error && (
        <div className="equipo-banner error">
          <AlertTriangle size={18} /> {error}
          <button onClick={() => setError('')} className="equipo-banner-close">✕</button>
        </div>
      )}
      {notice && (
        <div className="equipo-banner ok"><CheckCircle2 size={18} /> {notice}</div>
      )}

      {/* ===================== USUARIOS DE ACCESO ===================== */}
      {isOwner && (
        <div className="almacen-card">
          <div className="equipo-section-head">
            <h3 className="equipo-section-title"><UserCog size={18} /> Usuarios de acceso (login)</h3>
            <button className="equipo-primary-btn sm" onClick={openCreateUser}>
              <UserPlus size={15} /> Crear usuario
            </button>
          </div>
          <p className="equipo-section-hint">
            Estos son los usuarios que pueden iniciar sesión en el sistema. Cambia su correo, contraseña o rol.
          </p>

          {usersError && (
            <div className="equipo-banner error" style={{ marginTop: 12 }}>
              <AlertTriangle size={16} /> {usersError}
              <button onClick={() => setUsersError('')} className="equipo-banner-close">✕</button>
            </div>
          )}

          {usersLoading ? (
            <div style={{ padding: '24px', textAlign: 'center' }}>
              <Loader2 size={22} className="animate-spin" style={{ color: '#ef4444' }} />
            </div>
          ) : (
            <div className="users-grid">
              {authUsers.map(u => (
                <div key={u.id} className={`user-card ${!u.isActive ? 'inactive' : ''}`}>
                  <div className="user-card-top">
                    <div className={`user-avatar ${u.role}`}>{(u.fullName || u.email).charAt(0).toUpperCase()}</div>
                    <div className="user-id-block">
                      <strong className="user-name">{u.fullName || '—'}</strong>
                      <span className="user-email"><Mail size={12} /> {u.email}</span>
                    </div>
                    <span className={`team-badge ${u.role}`}>{ROLE_LABEL[u.role]}</span>
                  </div>
                  <div className="user-meta-row">
                    <span className="user-meta"><Clock size={12} /> {timeAgo(u.lastSignInAt)}</span>
                    <span className={`user-status-dot ${u.isActive ? 'on' : 'off'}`}>
                      {u.isActive ? 'Acceso activo' : 'Suspendido'}
                    </span>
                  </div>
                  <div className="user-card-actions">
                    <button className="user-act" title="Editar correo y rol" onClick={() => openEditUser(u)}>
                      <Edit3 size={15} /> Editar
                    </button>
                    <button className="user-act" title="Cambiar contraseña" onClick={() => openPwModal(u)}>
                      <KeyRound size={15} /> Clave
                    </button>
                    <button className="user-act" title="Cambiar PIN de acceso" onClick={() => openPinModal(u)}>
                      <Hash size={15} /> PIN
                    </button>
                    <button
                      className={`user-act ${u.isActive ? 'danger' : 'ok'}`}
                      title={u.isActive ? 'Suspender acceso' : 'Reactivar acceso'}
                      onClick={() => toggleUserActive(u)}
                    >
                      {u.isActive ? <Ban size={15} /> : <CheckCircle2 size={15} />}
                      {u.isActive ? 'Suspender' : 'Activar'}
                    </button>
                  </div>
                </div>
              ))}
              {authUsers.length === 0 && (
                <div className="users-empty">
                  <UserCog size={40} style={{ opacity: 0.3, marginBottom: 8 }} />
                  <p>No hay usuarios de acceso. Crea el primero con "Crear usuario".</p>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ===================== EMPLEADOS / NÓMINA ===================== */}
      <div className="almacen-card">
        <div className="equipo-section-head">
          <h3 className="equipo-section-title"><Users size={18} /> Empleados (nómina)</h3>
        </div>
        <div className="team-grid" style={{ marginTop: 4 }}>
          {team.map(emp => (
            <div key={emp.id} className={`team-card ${!emp.isActive ? 'inactive' : ''}`}>
              <div className="team-card-header">
                <div className="team-avatar">{emp.fullName.charAt(0).toUpperCase()}</div>
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
                <button className={`status-toggle-btn ${emp.isActive ? 'active' : 'inactive'}`} onClick={() => toggleActive(emp)}>
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
      </div>

      {/* ===================== MATRIZ DE PERMISOS ===================== */}
      <div className="almacen-card">
        <h3 className="equipo-section-title" style={{ marginBottom: 12 }}>
          <Shield size={18} style={{ color: '#dc2626' }} /> Matriz de Permisos por Rol
        </h3>
        <div style={{ overflowX: 'auto' }}>
          <table className="perm-table">
            <thead>
              <tr><th>Módulo</th><th>Owner</th><th>Manager</th><th>Cashier</th></tr>
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
                <td>Gestión de Usuarios</td>
                <td><CheckCircle2 size={14} className="text-green" /> Total</td>
                <td><XCircle size={14} className="text-red" /> Sólo empleados</td>
                <td><XCircle size={14} className="text-red" /> Bloqueado</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal empleado */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content-custom" onClick={e => e.stopPropagation()}>
            <div className="modal-header-custom">
              <h3>{editingId ? 'Editar Miembro' : 'Crear Nuevo Miembro del Equipo'}</h3>
              <button className="close-btn" onClick={() => setShowModal(false)}>✕</button>
            </div>
            <form onSubmit={handleSave} className="modal-form">
              <div className="form-group">
                <label>Nombre completo</label>
                <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Ej. Pedro Pérez" required />
              </div>
              <div className="form-group">
                <label>Cargo / Posición</label>
                <input type="text" value={position} onChange={e => setPosition(e.target.value)} placeholder="Ej. Cajero, Cocinero, Encargado" />
              </div>
              <div className="form-group">
                <label>Tarifa por hora (USD)</label>
                <input type="number" min="0" step="0.25" value={hourlyRate} onChange={e => setHourlyRate(parseFloat(e.target.value) || 0)} />
              </div>
              <div className="modal-actions-bar">
                <button type="button" className="btn-cancel" onClick={() => setShowModal(false)}>Cancelar</button>
                <button type="submit" className="btn-save">{editingId ? 'Guardar Cambios' : 'Crear Miembro'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal usuario de acceso (crear / editar) */}
      {showUserModal && (
        <div className="modal-overlay" onClick={() => setShowUserModal(false)}>
          <div className="modal-content-custom" onClick={e => e.stopPropagation()}>
            <div className="modal-header-custom">
              <h3>{userModalMode === 'create' ? 'Crear usuario de acceso' : 'Editar usuario'}</h3>
              <button className="close-btn" onClick={() => setShowUserModal(false)}>✕</button>
            </div>
            <form onSubmit={handleSaveUser} className="modal-form">
              {userModalMode === 'create' && (
                <div className="form-group">
                  <label>Nombre completo</label>
                  <input type="text" value={uName} onChange={e => setUName(e.target.value)} placeholder="Ej. María Pérez" required />
                </div>
              )}
              <div className="form-group">
                <label>Correo (usuario de login)</label>
                <input type="email" value={uEmail} onChange={e => setUEmail(e.target.value)} placeholder="usuario@fullchinavzla.com" required />
              </div>
              {userModalMode === 'create' && (
                <div className="form-group">
                  <label>Contraseña inicial</label>
                  <input type="text" value={uPassword} onChange={e => setUPassword(e.target.value)} placeholder="Mínimo 6 caracteres" minLength={6} required />
                </div>
              )}
              <div className="form-group">
                <label>Rol / accesos</label>
                <select
                  value={uRole}
                  onChange={e => {
                    const r = e.target.value as Role
                    setURole(r)
                    if (!uCustomModules) setUModules(defaultModulesForRole(r))
                  }}
                >
                  <option value="owner">Dueño (acceso total)</option>
                  <option value="manager">Gerente (gestión operativa)</option>
                  <option value="cashier">Cajero (sólo ventas)</option>
                </select>
              </div>

              {userModalMode === 'edit' && uRole !== 'owner' && (
                <div className="form-group">
                  <label className="promo-toggle-label" style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={uCustomModules}
                      onChange={e => {
                        setUCustomModules(e.target.checked)
                        if (!e.target.checked) setUModules(defaultModulesForRole(uRole))
                      }}
                    />
                    <span>Personalizar módulos visibles para este usuario</span>
                  </label>
                  {uCustomModules && (
                    <div className="module-checklist">
                      {allNavItems.map(item => (
                        <label key={item.path} className={`module-check ${uModules.includes(item.path) ? 'on' : ''}`}>
                          <input
                            type="checkbox"
                            checked={uModules.includes(item.path)}
                            onChange={() => toggleModule(item.path)}
                          />
                          <span>{item.label}</span>
                        </label>
                      ))}
                    </div>
                  )}
                  {!uCustomModules && (
                    <p className="equipo-section-hint" style={{ margin: '6px 0 0' }}>
                      Usa los permisos por defecto del rol. Actívalo para bloquear o habilitar módulos específicos.
                    </p>
                  )}
                </div>
              )}

              <div className="modal-actions-bar">
                <button type="button" className="btn-cancel" onClick={() => setShowUserModal(false)}>Cancelar</button>
                <button type="submit" className="btn-save" disabled={uSaving}>
                  {uSaving ? 'Guardando…' : userModalMode === 'create' ? 'Crear usuario' : 'Guardar cambios'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal cambiar PIN */}
      {showPinModal && pinUser && (
        <div className="modal-overlay" onClick={() => setShowPinModal(false)}>
          <div className="modal-content-custom" onClick={e => e.stopPropagation()}>
            <div className="modal-header-custom">
              <h3>Cambiar PIN de acceso</h3>
              <button className="close-btn" onClick={() => setShowPinModal(false)}>✕</button>
            </div>
            <form onSubmit={handleSavePin} className="modal-form">
              <p className="equipo-section-hint" style={{ margin: 0 }}>
                Usuario: <strong style={{ color: '#fff' }}>{pinUser.email}</strong>. El PIN de 4 dígitos
                sirve para iniciar sesión rápido desde la caja.
              </p>
              <div className="form-group">
                <label>Nuevo PIN (4 dígitos)</label>
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]{4}"
                  maxLength={4}
                  value={pinValue}
                  onChange={e => setPinValue(e.target.value.replace(/\D/g, '').slice(0, 4))}
                  placeholder="0000"
                  required
                  autoFocus
                  style={{ letterSpacing: '8px', textAlign: 'center', fontSize: '22px' }}
                />
              </div>
              <div className="modal-actions-bar">
                <button type="button" className="btn-cancel" onClick={() => setShowPinModal(false)}>Cancelar</button>
                <button type="submit" className="btn-save" disabled={pinSaving || pinValue.length !== 4}>
                  {pinSaving ? 'Guardando…' : 'Guardar PIN'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal cambiar contraseña */}
      {showPwModal && pwUser && (
        <div className="modal-overlay" onClick={() => setShowPwModal(false)}>
          <div className="modal-content-custom" onClick={e => e.stopPropagation()}>
            <div className="modal-header-custom">
              <h3>Cambiar contraseña</h3>
              <button className="close-btn" onClick={() => setShowPwModal(false)}>✕</button>
            </div>
            <form onSubmit={handleSavePw} className="modal-form">
              <p className="equipo-section-hint" style={{ margin: 0 }}>
                Usuario: <strong style={{ color: '#fff' }}>{pwUser.email}</strong>
              </p>
              <div className="form-group">
                <label>Nueva contraseña</label>
                <input type="text" value={pwValue} onChange={e => setPwValue(e.target.value)} placeholder="Mínimo 6 caracteres" minLength={6} required autoFocus />
              </div>
              <div className="modal-actions-bar">
                <button type="button" className="btn-cancel" onClick={() => setShowPwModal(false)}>Cancelar</button>
                <button type="submit" className="btn-save" disabled={pwSaving}>
                  {pwSaving ? 'Guardando…' : 'Cambiar contraseña'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
