import { useState, useRef, useCallback } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { useAuth } from '../context/auth-context'
import { useDemoData } from '../context/demo-data-context'
import {
  Home,
  Wallet,
  ClipboardList,
  Package,
  Beef,
  BookOpen,
  ShoppingCart,
  PiggyBank,
  Users,
  DollarSign,
  ShieldCheck,
  BarChart3,
  Settings,
  LogOut,
  Truck,
  ChevronLeft
} from 'lucide-react'
import './Sidebar.css'

const allNavItems = [
  { path: '/', label: 'Dashboard', icon: Home, roles: ['owner', 'manager', 'cashier'] },
  { path: '/comandas', label: 'Comandas', icon: ClipboardList, roles: ['owner', 'manager', 'cashier'] },
  { path: '/caja', label: 'Ventas', icon: Wallet, roles: ['owner', 'manager', 'cashier'] },
  { path: '/clientes', label: 'Clientes', icon: Users, roles: ['owner', 'manager', 'cashier'] },
  { path: '/inventario', label: 'Inventario', icon: Package, roles: ['owner', 'manager', 'cashier'] },
  { path: '/produccion', label: 'Producción', icon: Beef, roles: ['owner', 'manager'] },
  { path: '/recetas', label: 'Recetas', icon: BookOpen, roles: ['owner', 'manager'] },
  { path: '/compras', label: 'Compras', icon: ShoppingCart, roles: ['owner', 'manager'] },
  { path: '/finanzas', label: 'Finanzas', icon: PiggyBank, roles: ['owner'] },
  { path: '/nomina', label: 'Nómina', icon: DollarSign, roles: ['owner'] },
  { path: '/auditoria', label: 'Auditoría', icon: ShieldCheck, roles: ['owner'] },
  { path: '/reportes', label: 'Reportes', icon: BarChart3, roles: ['owner', 'manager'] },
  { path: '/mas', label: 'Configuración', icon: Settings, roles: ['owner', 'manager'] }
]

interface SidebarProps {
  collapsed: boolean
  onToggle: () => void
}

interface TooltipState {
  text: string
  top: number
  left: number
}

export function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const location = useLocation()
  const { user, signOut } = useAuth()
  const { todayStats } = useDemoData()
  const [tooltip, setTooltip] = useState<TooltipState | null>(null)
  const tooltipTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const navItems = allNavItems.filter(item =>
    user?.role ? item.roles.includes(user.role) : true
  )

  const showTooltip = useCallback((text: string, e: React.MouseEvent) => {
    if (tooltipTimer.current) clearTimeout(tooltipTimer.current)
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    setTooltip({
      text,
      top: rect.top + rect.height / 2,
      left: rect.right + 10
    })
  }, [])

  const hideTooltip = useCallback(() => {
    tooltipTimer.current = setTimeout(() => setTooltip(null), 100)
  }, [])

  return (
    <aside className={`sidebar ${collapsed ? 'collapsed' : ''}`}>
      <div className="sidebar-brand">
        <img src="/logo.png" alt="Full China" className="sidebar-logo-img" />
        <button
          className="sidebar-toggle"
          onClick={onToggle}
          onMouseEnter={(e) => showTooltip(collapsed ? 'Expandir menú' : 'Contraer menú', e)}
          onMouseLeave={hideTooltip}
        >
          <ChevronLeft size={16} className={`sidebar-toggle-icon ${collapsed ? 'rotated' : ''}`} />
        </button>
      </div>

      <nav className="sidebar-nav">
        {navItems.map((item) => {
          const Icon = item.icon
          const isActive = isActiveItem(item.path, location.pathname)
          return (
            <NavLink
              key={item.path}
              to={item.path}
              className={`sidebar-link ${isActive ? 'active' : ''}`}
              onMouseEnter={(e) => collapsed && showTooltip(item.label, e)}
              onMouseLeave={hideTooltip}
            >
              <Icon size={18} strokeWidth={1.8} className="sidebar-icon" />
              <span className="sidebar-label">{item.label}</span>
            </NavLink>
          )
        })}

        <button 
          className="sidebar-link sidebar-logout-btn-item" 
          onClick={signOut}
          onMouseEnter={(e) => collapsed && showTooltip('Cerrar sesión', e)}
          onMouseLeave={hideTooltip}
        >
          <LogOut size={18} strokeWidth={1.8} className="sidebar-icon" />
          <span className="sidebar-label">Cerrar sesión</span>
        </button>
      </nav>

      {!collapsed && (
        <div className="sidebar-active-orders-card">
          <div className="orders-card-icon-wrapper">
            <Truck size={20} className="orders-card-icon" />
          </div>
          <div className="orders-card-content">
            <span className="orders-card-title">Pedidos hoy</span>
            <div className="orders-card-data">
              <span className="orders-card-value">{todayStats?.ordersCount || 0}</span>
              <span className="orders-card-pct">+12% vs ayer</span>
            </div>
          </div>
        </div>
      )}

      {!collapsed && (
        <div className="sidebar-user-profile">
          <img 
            src="/login-carousel/slide7.jpg" 
            alt="Avatar" 
            className="sidebar-user-avatar" 
          />
          <div className="sidebar-user-info">
            <span className="sidebar-user-name">{user?.email || 'Admin'}</span>
            <span className="sidebar-user-sub">Full China</span>
          </div>
        </div>
      )}

      {tooltip && (
        <div 
          className="sidebar-tooltip-portal"
          style={{ 
            position: 'fixed',
            top: tooltip.top,
            left: tooltip.left,
            transform: 'translateY(-50%)',
            zIndex: 9999
          }}
        >
          <div className="sidebar-tooltip">{tooltip.text}</div>
        </div>
      )}
    </aside>
  )
}

function isActiveItem(path: string, pathname: string): boolean {
  if (path === '/') return pathname === '/'
  return pathname === path || pathname.startsWith(path + '/')
}
