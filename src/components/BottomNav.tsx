import { NavLink, useLocation } from 'react-router-dom'
import { useAuth } from '../context/auth-context'
import { Home, Wallet, ClipboardList, Users, Package, Settings } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import './BottomNav.css'

interface NavItem {
  path: string
  label: string
  icon: LucideIcon
  roles: string[]
}

const allNavItems: NavItem[] = [
  { path: '/', label: 'Inicio', icon: Home, roles: ['owner', 'manager', 'cashier'] },
  { path: '/caja', label: 'Caja', icon: Wallet, roles: ['owner', 'manager', 'cashier'] },
  { path: '/comandas', label: 'Comandas', icon: ClipboardList, roles: ['owner', 'manager', 'cashier'] },
  { path: '/clientes', label: 'Clientes', icon: Users, roles: ['owner', 'manager', 'cashier'] },
  { path: '/inventario', label: 'Inventario', icon: Package, roles: ['owner', 'manager', 'cashier'] },
  { path: '/mas', label: 'Más', icon: Settings, roles: ['owner', 'manager'] }
]

export function BottomNav() {
  const location = useLocation()
  const { user } = useAuth()

  const navItems = allNavItems.filter(item =>
    user?.role ? item.roles.includes(user.role) : true
  )

  return (
    <nav className="bottom-nav">
      <div className="bottom-nav-inner">
        {navItems.map((item) => {
          const Icon = item.icon
          const isActive = isActiveItem(item.path, location.pathname)
          return (
            <NavLink
              key={item.path}
              to={item.path}
              className={`bottom-nav-item ${isActive ? 'active' : ''}`}
            >
              <div className="bottom-nav-icon-wrap">
                <Icon size={20} strokeWidth={isActive ? 2.2 : 1.6} />
                {isActive && <div className="bottom-nav-active-dot" />}
              </div>
              <span className="bottom-nav-label">{item.label}</span>
            </NavLink>
          )
        })}
      </div>
    </nav>
  )
}

function isActiveItem(path: string, pathname: string): boolean {
  if (path === '/') return pathname === '/'
  return pathname === path || pathname.startsWith(path + '/')
}
