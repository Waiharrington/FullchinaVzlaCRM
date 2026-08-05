import { NavLink, useLocation } from 'react-router-dom'
import { useAuth } from '../context/auth-context'
import './BottomNav.css'

const allNavItems = [
  { path: '/', label: 'Inicio', icon: '🏠', roles: ['owner', 'manager', 'cashier'] },
  { path: '/caja', label: 'Caja', icon: '💰', roles: ['owner', 'manager', 'cashier'] },
  { path: '/comandas', label: 'Comandas', icon: '📋', roles: ['owner', 'manager', 'cashier'] },
  { path: '/clientes', label: 'Clientes', icon: '👥', roles: ['owner', 'manager', 'cashier'] },
  { path: '/inventario', label: 'Inventario', icon: '📦', roles: ['owner', 'manager', 'cashier'] },
  { path: '/mas', label: 'Más', icon: '⚙️', roles: ['owner', 'manager'] }
]

export function BottomNav() {
  const location = useLocation()
  const { user } = useAuth()

  const navItems = allNavItems.filter(item =>
    user?.role ? item.roles.includes(user.role) : true
  )

  return (
    <nav className="bottom-nav">
      {navItems.map((item) => (
        <NavLink
          key={item.path}
          to={item.path}
          className={({ isActive }) =>
            `bottom-nav-item ${isActive || (item.path !== '/' && location.pathname.startsWith(item.path)) ? 'active' : ''}`
          }
        >
          <span className="bottom-nav-icon">{item.icon}</span>
          <span className="bottom-nav-label">{item.label}</span>
        </NavLink>
      ))}
    </nav>
  )
}
