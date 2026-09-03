import { useState, useEffect, useCallback, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useAuth } from '../context/auth-context'
import {
  Users, UserPlus, Shield, CheckCircle2, MinusCircle, XCircle, Loader2, Edit3,
  KeyRound, Mail, UserCog, Ban, Clock, Hash, Trash2, MoreVertical,
} from 'lucide-react'
import { PageSkeleton } from '../components/PageSkeleton'
import { StyledSelect } from '../components/StyledSelect'
import Toast from '../components/Toast'
import NumberStepper from '../components/NumberStepper'
import { confirmDialog } from '../components/ConfirmDialog'
import {
  getAllEmployees, createEmployee, updateEmployee, deleteEmployee,
  listAuthUsers, adminCreateUser, adminSetUserPassword, adminSetUserEmail,
  adminSetUserRole, adminSetUserActive, adminSetUserPin, getErrorMessage,
  adminDeleteUser,
} from '../lib/dataService'
import { adminSetUserModules } from '../lib/dataService'
import type { Employee, AuthUser } from '../lib/dataService'
import { allNavItems, type Role } from '../components/navItems'
import { EmptyState } from '../components/EmptyState'
import './Equipo.css'

const ROLE_LABEL: Record<Role, string> = { owner: 'Dueño', manager: 'Gerente', cashier: 'Cajero' }

const MODULE_GROUPS = allNavItems.reduce<Array<{
  group: string
  items: (typeof allNavItems)[number][]
}>>((groups, item) => {
  const existingGroup = groups.find(group => group.group === item.group)
  if (existingGroup) existingGroup.items.push(item)
  else groups.push({ group: item.group, items: [item] })
  return groups
}, [])

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

function UserActionsMenu({
  isActive, canDelete, onPassword, onPin, onToggleActive, onDelete,
}: {
  isActive: boolean
  canDelete: boolean
  onPassword: () => void
  onPin: () => void
  onToggleActive: () => void
  onDelete: () => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const run = (fn: () => void) => { setOpen(false); fn() }

  return (
    <div className="user-menu" ref={ref}>
      <button type="button" className="user-menu-trigger" onClick={() => setOpen(o => !o)} aria-label="Más acciones" aria-expanded={open}>
        <MoreVertical size={16} />
      </button>
      {open && (
        <div className="user-menu-dropdown" role="menu">
          <button type="button" role="menuitem" onClick={() => run(onPassword)}><KeyRound size={14} /> Cambiar clave</button>
          <button type="button" role="menuitem" onClick={() => run(onPin)}><Hash size={14} /> Cambiar PIN</button>
          <button type="button" role="menuitem" onClick={() => run(onToggleActive)}>
            {isActive ? <><Ban size={14} /> Suspender</> : <><CheckCircle2 size={14} /> Activar</>}
          </button>
          {canDelete && (
            <button type="button" role="menuitem" className="danger" onClick={() => run(onDelete)}>
              <Trash2 size={14} /> Eliminar
            </button>
          )}
        </div>
      )}
    </div>
  )
}

type PermLevel = 'total' | 'partial' | 'blocked'
const PERM_ICON: Record<PermLevel, typeof CheckCircle2> = { total: CheckCircle2, partial: MinusCircle, blocked: XCircle }
function PermCell({ level, label }: { level: PermLevel; label: string }) {
  const Icon = PERM_ICON[level]
  return <span className={`perm-pill perm-${level}`}><Icon size={13} /> {label}</span>
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
  const [closingModal, setClosingModal] = useState(false)
  const closeModal = () => {
    if (closingModal) return
    setClosingModal(true)
    window.setTimeout(() => {
      setShowModal(false)
      setClosingModal(false)
    }, 200)
  }
  const [editingId, setEditingId] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [hourlyRate, setHourlyRate] = useState(0)
  const [weeklySalary, setWeeklySalary] = useState(0)
  const [overtimeRate, setOvertimeRate] = useState(0)

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
      setError(getErrorMessage(e, 'Error cargando empleados'))
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
      setUsersError(getErrorMessage(e, 'Error cargando usuarios de acceso'))
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
      setHourlyRate(emp.hourlyRate)
      setWeeklySalary(emp.weeklySalary)
      setOvertimeRate(emp.overtimeRate)
    } else {
      setEditingId(null); setName(''); setHourlyRate(0); setWeeklySalary(0); setOvertimeRate(0)
    }
    setShowModal(true)
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    try {
      if (editingId) {
        await updateEmployee(editingId, { fullName: name.trim(), hourlyRate, weeklySalary, overtimeRate })
        const refreshedTeam = await getAllEmployees()
        const savedEmployee = refreshedTeam.find(employee => employee.id === editingId)
        if (!savedEmployee || Math.abs(savedEmployee.weeklySalary - weeklySalary) > 0.005) {
          throw new Error('El sueldo no quedó guardado. Intenta nuevamente.')
        }
        setTeam(refreshedTeam)
        flash(`"${name.trim()}" actualizado con éxito`)
      } else {
        await createEmployee({ fullName: name.trim(), hourlyRate, weeklySalary, overtimeRate })
        setTeam(await getAllEmployees())
        flash(`"${name.trim()}" registrado correctamente`)
      }
      closeModal()
      await load()
    } catch (e) {
      setError(getErrorMessage(e, 'Error guardando miembro del equipo'))
    }
  }

  const toggleActive = async (emp: Employee) => {
    try {
      await updateEmployee(emp.id, { isActive: !emp.isActive })
      await load()
    } catch (e) {
      setError(getErrorMessage(e, 'Error actualizando'))
    }
  }

  const handleDelete = async (emp: Employee) => {
    const ok = await confirmDialog({ title: 'Eliminar empleado', message: `¿Eliminar a "${emp.fullName}" de la nómina?`, confirmText: 'Eliminar', danger: true })
    if (!ok) return
    try {
      await deleteEmployee(emp.id)
      flash(`"${emp.fullName}" eliminado`)
      await load()
    } catch (e) {
      setError(getErrorMessage(e, 'Error eliminando empleado'))
    }
  }

  // --- Handlers usuarios de acceso ---
  const [showUserModal, setShowUserModal] = useState(false)
  const [closingUserModal, setClosingUserModal] = useState(false)
  const closeUserModal = () => {
    if (closingUserModal) return
    setClosingUserModal(true)
    window.setTimeout(() => {
      setShowUserModal(false)
      setClosingUserModal(false)
    }, 200)
  }
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
  const [closingPwModal, setClosingPwModal] = useState(false)
  const closePwModal = () => {
    if (closingPwModal) return
    setClosingPwModal(true)
    window.setTimeout(() => {
      setShowPwModal(false)
      setClosingPwModal(false)
    }, 200)
  }
  const [pwUser, setPwUser] = useState<AuthUser | null>(null)
  const [pwValue, setPwValue] = useState('')
  const [pwSaving, setPwSaving] = useState(false)

  const [showPinModal, setShowPinModal] = useState(false)
  const [closingPinModal, setClosingPinModal] = useState(false)
  const closePinModal = () => {
    if (closingPinModal) return
    setClosingPinModal(true)
    window.setTimeout(() => {
      setShowPinModal(false)
      setClosingPinModal(false)
    }, 200)
  }
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
  const toggleModuleGroup = (paths: string[], enable: boolean) => {
    setUModules(prev => enable
      ? Array.from(new Set([...prev, ...paths]))
      : prev.filter(path => !paths.includes(path)))
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
      closeUserModal()
      await loadUsers()
    } catch (e) {
      setUsersError(getErrorMessage(e, 'Error guardando usuario'))
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
      closePwModal()
    } catch (e) {
      setUsersError(getErrorMessage(e, 'Error cambiando contraseña'))
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
      closePinModal()
    } catch (e) {
      setUsersError(getErrorMessage(e, 'Error cambiando el PIN'))
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
      setUsersError(getErrorMessage(e, 'Error actualizando acceso'))
    }
  }

  const handleDeleteUser = async (u: AuthUser) => {
    const ok = await confirmDialog({
      title: 'Eliminar usuario de acceso',
      message: `¿Eliminar el acceso de "${u.fullName || u.email}"? Ya no podrá iniciar sesión con correo, contraseña ni PIN. El historial operativo se conservará.`,
      confirmText: 'Eliminar acceso',
      danger: true,
    })
    if (!ok) return
    setUsersError('')
    try {
      await adminDeleteUser(u.id)
      flash(`Acceso de "${u.fullName || u.email}" eliminado`)
      await loadUsers()
    } catch (e) {
      setUsersError(getErrorMessage(e, 'Error eliminando usuario de acceso'))
    }
  }

  if (loading) {
    return <PageSkeleton cards={3} rows={5} />
  }

  return (
    <div className="page equipo-page animate-fade-in management-workspace management-workspace--team">
      {/* Encabezado */}
      <div className="equipo-hero management-workspace-header">
        <div className="header-title-group">
          <div>
            <h1 className="page-title"><Users size={22} className="page-title-icon" /> Gestión de Equipo y Personal</h1>
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

      {error && <Toast type="error" message={error} onClose={() => setError('')} />}
      {notice && <Toast type="success" message={notice} onClose={() => setNotice('')} />}

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

          {usersError && <Toast type="error" message={usersError} onClose={() => setUsersError('')} />}

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
                    <button className="user-act primary" title="Editar correo y rol" onClick={() => openEditUser(u)}>
                      <Edit3 size={15} /> Editar
                    </button>
                    <UserActionsMenu
                      isActive={u.isActive}
                      canDelete={u.id !== user?.id}
                      onPassword={() => openPwModal(u)}
                      onPin={() => openPinModal(u)}
                      onToggleActive={() => toggleUserActive(u)}
                      onDelete={() => handleDeleteUser(u)}
                    />
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
        {team.length === 0 ? (
          <EmptyState
            title="No hay empleados registrados"
            description="Crea el primero para empezar a gestionar tu equipo."
            actionLabel="Nuevo empleado"
            onAction={() => handleOpenModal()}
          />
        ) : (
          <div className="team-table-wrap">
            <table className="team-table">
              <thead>
                <tr><th>Empleado</th><th>Sueldo semanal</th><th>Estado</th><th></th></tr>
              </thead>
              <tbody>
                {team.map(emp => (
                  <tr key={emp.id} className={!emp.isActive ? 'inactive' : ''}>
                    <td>
                      <div className="team-row-id">
                        <div className="team-avatar">{emp.fullName.charAt(0).toUpperCase()}</div>
                        <strong>{emp.fullName}</strong>
                      </div>
                    </td>
                    <td>${emp.weeklySalary.toFixed(2)} / semana</td>
                    <td>
                      <button className={`status-toggle-btn ${emp.isActive ? 'active' : 'inactive'}`} onClick={() => toggleActive(emp)}>
                        {emp.isActive ? <CheckCircle2 size={14} /> : <XCircle size={14} />}
                        {emp.isActive ? 'Activo' : 'Suspendido'}
                      </button>
                    </td>
                    <td>
                      <div className="team-row-actions">
                        <button className="icon-action-btn" title="Editar" onClick={() => handleOpenModal(emp)}>
                          <Edit3 size={16} />
                        </button>
                        <button className="icon-action-btn danger" title="Eliminar" onClick={() => handleDelete(emp)}>
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
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
                <td><PermCell level="total" label="Total" /></td>
                <td><PermCell level="total" label="Total" /></td>
                <td><PermCell level="total" label="Total" /></td>
              </tr>
              <tr>
                <td>Costos y Márgenes</td>
                <td><PermCell level="total" label="Visibles" /></td>
                <td><PermCell level="total" label="Visibles" /></td>
                <td><PermCell level="blocked" label="Ocultos" /></td>
              </tr>
              <tr>
                <td>Inventario y Almacén</td>
                <td><PermCell level="total" label="Total" /></td>
                <td><PermCell level="partial" label="Transferencias" /></td>
                <td><PermCell level="partial" label="Solo lectura" /></td>
              </tr>
              <tr>
                <td>Nómina y Finanzas</td>
                <td><PermCell level="total" label="Total" /></td>
                <td><PermCell level="partial" label="Cierre operativo" /></td>
                <td><PermCell level="blocked" label="Bloqueado" /></td>
              </tr>
              <tr>
                <td>Gestión de Usuarios</td>
                <td><PermCell level="total" label="Total" /></td>
                <td><PermCell level="partial" label="Sólo empleados" /></td>
                <td><PermCell level="blocked" label="Bloqueado" /></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal empleado */}
      {showModal && createPortal(
        <div className={`modal-overlay ${closingModal ? 'closing' : ''}`} onClick={() => closeModal()}>
          <div className="modal-content-custom" onClick={e => e.stopPropagation()}>
            <div className="modal-header-custom">
              <h3>{editingId ? 'Editar Miembro' : 'Crear Nuevo Miembro del Equipo'}</h3>
            </div>
            <form onSubmit={handleSave} className="modal-form">
              <div className="form-group">
                <label>Nombre completo</label>
                <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Ej. Pedro Pérez" required autoFocus />
              </div>
              <div className="form-row-2">
                <div className="form-group">
                  <label>Sueldo semanal (USD)</label>
                  <NumberStepper min={0} step={1} value={String(weeklySalary)} onChange={(v) => setWeeklySalary(parseFloat(v) || 0)} />
                </div>
                <div className="form-group">
                  <label>Tarifa hora extra (USD)</label>
                  <NumberStepper min={0} step={0.5} value={String(overtimeRate)} onChange={(v) => setOvertimeRate(parseFloat(v) || 0)} />
                </div>
              </div>
              <div className="form-group">
                <label style={{ color: '#71717a' }}>Tarifa histórica por hora (opcional)</label>
                <NumberStepper min={0} step={1} value={String(hourlyRate)} onChange={(v) => setHourlyRate(parseFloat(v) || 0)} />
              </div>
              <div className="modal-actions-bar">
                <button type="button" className="btn-cancel" onClick={() => closeModal()}>Cancelar</button>
                <button type="submit" className="btn-save">{editingId ? 'Guardar Cambios' : 'Crear Miembro'}</button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* Modal usuario de acceso (crear / editar) */}
      {showUserModal && createPortal(
        <div className={`modal-overlay ${closingUserModal ? 'closing' : ''}`} onClick={() => closeUserModal()}>
          <div className="modal-content-custom user-access-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header-custom user-access-header">
              <div className="user-access-heading">
                <span className="user-access-heading-icon"><UserCog size={20} /></span>
                <div>
                  <div className="user-access-title-row">
                    <h3>{userModalMode === 'create' ? 'Crear usuario de acceso' : 'Editar usuario'}</h3>
                    <span className={`user-role-badge ${uRole}`}>{ROLE_LABEL[uRole]}</span>
                  </div>
                  <p>Identidad, rol y módulos disponibles en un solo lugar.</p>
                </div>
              </div>
            </div>

            <form onSubmit={handleSaveUser} className="modal-form user-access-form">
              <div className="user-access-body">
                <section className="user-access-identity" aria-labelledby="user-data-title">
                  <div className="user-pane-heading">
                    <span className="user-pane-number">1</span>
                    <div>
                      <h4 id="user-data-title">Datos y rol</h4>
                      <p>Información para iniciar sesión.</p>
                    </div>
                  </div>

                  <div className="user-identity-fields">
                    {userModalMode === 'create' && (
                      <div className="form-group">
                        <label>Nombre completo</label>
                        <input type="text" value={uName} onChange={e => setUName(e.target.value)} placeholder="Ej. María Pérez" required />
                      </div>
                    )}
                    <div className="form-group">
                      <label>Correo de acceso</label>
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
                      <StyledSelect
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
                      </StyledSelect>
                    </div>
                  </div>

                  <div className={`user-role-summary ${uRole}`}>
                    <Shield size={18} />
                    <div>
                      <strong>{ROLE_LABEL[uRole]}</strong>
                      <span>{uRole === 'owner' ? 'Control total del sistema' : uRole === 'manager' ? 'Gestión operativa y administrativa' : 'Operación de ventas y caja'}</span>
                    </div>
                  </div>

                  {userModalMode === 'edit' && uRole !== 'owner' && (
                    <label className="user-custom-toggle">
                      <span>
                        <strong>Accesos personalizados</strong>
                        <small>Elige módulos distintos a los del rol.</small>
                      </span>
                      <input
                        type="checkbox"
                        checked={uCustomModules}
                        onChange={e => {
                          setUCustomModules(e.target.checked)
                          if (!e.target.checked) setUModules(defaultModulesForRole(uRole))
                        }}
                      />
                      <i aria-hidden="true" />
                    </label>
                  )}
                </section>

                <section className="user-access-permissions" aria-labelledby="user-permissions-title">
                  <div className="user-permissions-top">
                    <div className="user-pane-heading">
                      <span className="user-pane-number">2</span>
                      <div>
                        <h4 id="user-permissions-title">Módulos visibles</h4>
                        <p>{uRole === 'owner' ? 'El dueño siempre tiene acceso total.' : uCustomModules && userModalMode === 'edit' ? `${uModules.length} de ${allNavItems.length} módulos habilitados.` : 'Vista previa de los accesos incluidos en el rol.'}</p>
                      </div>
                    </div>
                    {userModalMode === 'edit' && uRole !== 'owner' && uCustomModules && (
                      <button type="button" className="user-reset-modules" onClick={() => setUModules(defaultModulesForRole(uRole))}>
                        Restaurar rol
                      </button>
                    )}
                  </div>

                  <div className={`user-permission-groups ${uCustomModules && userModalMode === 'edit' && uRole !== 'owner' ? '' : 'is-preview'}`}>
                    {MODULE_GROUPS.map(group => {
                      const groupPaths = group.items.map(item => item.path)
                      const activeModules = uCustomModules && userModalMode === 'edit' && uRole !== 'owner'
                        ? uModules
                        : defaultModulesForRole(uRole)
                      const selectedCount = groupPaths.filter(path => activeModules.includes(path)).length
                      const allSelected = selectedCount === groupPaths.length

                      return (
                        <div className="user-module-group" key={group.group}>
                          <div className="user-module-group-heading">
                            <div>
                              <strong>{group.group}</strong>
                              <span>{selectedCount}/{group.items.length}</span>
                            </div>
                            {uCustomModules && userModalMode === 'edit' && uRole !== 'owner' && (
                              <button type="button" onClick={() => toggleModuleGroup(groupPaths, !allSelected)}>
                                {allSelected ? 'Quitar grupo' : 'Elegir grupo'}
                              </button>
                            )}
                          </div>
                          <div className="user-module-grid">
                            {group.items.map(item => {
                              const selected = activeModules.includes(item.path)
                              const ItemIcon = item.icon
                              return (
                                <label key={item.path} className={`user-module-card ${selected ? 'on' : ''}`}>
                                  <input
                                    type="checkbox"
                                    checked={selected}
                                    disabled={!(uCustomModules && userModalMode === 'edit' && uRole !== 'owner')}
                                    onChange={() => toggleModule(item.path)}
                                  />
                                  <span className="user-module-icon"><ItemIcon size={15} /></span>
                                  <span>{item.label}</span>
                                  {selected && <CheckCircle2 className="user-module-checkmark" size={15} />}
                                </label>
                              )
                            })}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </section>
              </div>

              <div className="modal-actions-bar user-access-actions">
                <p>Los cambios se aplicarán al próximo acceso del usuario.</p>
                <div>
                  <button type="button" className="btn-cancel" onClick={() => closeUserModal()}>Cancelar</button>
                  <button type="submit" className="btn-save" disabled={uSaving}>
                    {uSaving ? 'Guardando…' : userModalMode === 'create' ? 'Crear usuario' : 'Guardar cambios'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* Modal cambiar PIN */}
      {showPinModal && pinUser && createPortal(
        <div className={`modal-overlay ${closingPinModal ? 'closing' : ''}`} onClick={() => closePinModal()}>
          <div className="modal-content-custom" onClick={e => e.stopPropagation()}>
            <div className="modal-header-custom">
              <h3>Cambiar PIN de acceso</h3>
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
                <button type="button" className="btn-cancel" onClick={() => closePinModal()}>Cancelar</button>
                <button type="submit" className="btn-save" disabled={pinSaving || pinValue.length !== 4}>
                  {pinSaving ? 'Guardando…' : 'Guardar PIN'}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* Modal cambiar contraseña */}
      {showPwModal && pwUser && createPortal(
        <div className={`modal-overlay ${closingPwModal ? 'closing' : ''}`} onClick={() => closePwModal()}>
          <div className="modal-content-custom" onClick={e => e.stopPropagation()}>
            <div className="modal-header-custom">
              <h3>Cambiar contraseña</h3>
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
                <button type="button" className="btn-cancel" onClick={() => closePwModal()}>Cancelar</button>
                <button type="submit" className="btn-save" disabled={pwSaving}>
                  {pwSaving ? 'Guardando…' : 'Cambiar contraseña'}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}
