import { NavLink, useLocation } from 'react-router-dom'
import { useAuth } from '../context/auth-context'
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
  ChevronDown
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

export function Sidebar() {
  const location = useLocation()
  const { user, signOut } = useAuth()

  const navItems = allNavItems.filter(item =>
    user?.role ? item.roles.includes(user.role) : true
  )

  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <img src="/logo.png" alt="Full China" className="sidebar-logo-img" />
      </div>

      <nav className="sidebar-nav">
        {navItems.map((item) => {
          const Icon = item.icon
          return (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                `sidebar-link ${isActive || (item.path !== '/' && location.pathname.startsWith(item.path)) ? 'active' : ''}`
              }
            >
              <Icon size={18} strokeWidth={1.8} className="sidebar-icon" />
              <span className="sidebar-label">{item.label}</span>
            </NavLink>
          )
        })}

        <button className="sidebar-link sidebar-logout-btn-item" onClick={signOut}>
          <LogOut size={18} strokeWidth={1.8} className="sidebar-icon" />
          <span className="sidebar-label">Cerrar sesión</span>
        </button>
      </nav>

      <div className="sidebar-active-orders-card">
        <div className="orders-card-icon-wrapper">
          <Truck size={20} className="orders-card-icon" />
        </div>
        <div className="orders-card-content">
          <span className="orders-card-title">Full China Vzla</span>
          <div className="orders-card-data">
            <span className="orders-card-value">{user?.role === 'owner' ? 'Admin' : user?.role === 'manager' ? 'Manager' : 'Cajero'}</span>
          </div>
        </div>
      </div>

      <div className="sidebar-user-profile">
        <img
          src="/login-carousel/slide7.jpg"
          alt="Avatar"
          className="sidebar-user-avatar"
        />
        <div className="sidebar-user-info">
          <span className="sidebar-user-name">{user?.email || 'Usuario'}</span>
          <span className="sidebar-user-sub">Full China</span>
        </div>
        <ChevronDown size={14} className="sidebar-user-chevron" />
      </div>
    </aside>
  )
}
