import { NavLink, useLocation } from 'react-router-dom'
import { useAuth } from '../context/auth-context'
import './Sidebar.css'

const allNavItems = [
  { path: '/', label: 'Inicio', icon: '🏠', roles: ['owner', 'manager', 'cashier'] },
  { path: '/caja', label: 'Caja POS', icon: '💰', roles: ['owner', 'manager', 'cashier'] },
  { path: '/comandas', label: 'Comandas', icon: '📋', roles: ['owner', 'manager', 'cashier'] },
  { path: '/cocina', label: 'Cocina KDS', icon: '🍳', roles: ['owner', 'manager', 'cashier'] },
  { path: '/inventario', label: 'Inventario', icon: '📦', roles: ['owner', 'manager', 'cashier'] },
  { path: '/produccion', label: 'Producción', icon: '🥩', roles: ['owner', 'manager'] },
  { path: '/recetas', label: 'Recetas', icon: '📖', roles: ['owner', 'manager'] },
  { path: '/compras', label: 'Compras', icon: '🛍️', roles: ['owner', 'manager'] },
  { path: '/finanzas', label: 'Finanzas P&L', icon: '📈', roles: ['owner'] },
  { path: '/clientes', label: 'Clientes CRM', icon: '👥', roles: ['owner', 'manager', 'cashier'] },
  { path: '/nomina', label: 'Nómina', icon: '💸', roles: ['owner'] },
  { path: '/auditoria', label: 'Auditoría', icon: '🛡️', roles: ['owner'] },
  { path: '/reportes', label: 'Reportes', icon: '📊', roles: ['owner', 'manager'] },
  { path: '/mas', label: 'Más', icon: '⚙️', roles: ['owner', 'manager'] }
]

export function Sidebar() {
  const location = useLocation()
  const { user, signOut } = useAuth()

  const navItems = allNavItems.filter(item =>
    user?.role ? item.roles.includes(user.role) : true
  )

  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <span className="sidebar-logo">🚚</span>
        <div>
          <span className="sidebar-title">Clienta CRM</span>
          <span className="sidebar-subtitle">Food Truck System</span>
        </div>
      </div>
      <nav className="sidebar-nav">
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) =>
              `sidebar-link ${isActive || (item.path !== '/' && location.pathname.startsWith(item.path)) ? 'active' : ''}`
            }
          >
            <span className="sidebar-icon">{item.icon}</span>
            <span className="sidebar-label">{item.label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="sidebar-user-footer">
        <div className="user-info-box">
          <div className="user-role-badge">
            {user?.role === 'owner' ? '👑 Owner' : user?.role === 'manager' ? '📋 Manager' : '💰 Cashier'}
          </div>
          <span className="user-email">{user?.email || 'Usuario Demo'}</span>
        </div>
        <button className="sidebar-logout-btn" onClick={signOut} title="Cerrar sesión / Cambiar Rol">
          🚪 Salir
        </button>
      </div>
    </aside>
  )
}
