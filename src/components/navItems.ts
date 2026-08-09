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
  Building2,
  Award,
  MessageSquare,
  Utensils,
  Receipt,
  BadgeDollarSign
} from 'lucide-react'

export interface NavItem {
  path: string
  label: string
  icon: typeof Home
  roles: Array<'owner' | 'manager' | 'cashier'>
  group: string
}

export const allNavItems: NavItem[] = [
  { path: '/', label: 'Dashboard', icon: Home, roles: ['owner', 'manager', 'cashier'], group: 'Operación' },
  { path: '/comandas', label: 'Comandas', icon: ClipboardList, roles: ['owner', 'manager', 'cashier'], group: 'Operación' },
  { path: '/caja', label: 'Ventas', icon: Wallet, roles: ['owner', 'manager', 'cashier'], group: 'Operación' },
  { path: '/caja-operativa', label: 'Apertura y cierre', icon: BadgeDollarSign, roles: ['owner', 'manager', 'cashier'], group: 'Operación' },
  { path: '/clientes', label: 'Clientes', icon: Users, roles: ['owner', 'manager', 'cashier'], group: 'Operación' },
  { path: '/almacen', label: 'Almacén', icon: Building2, roles: ['owner', 'manager'], group: 'Operación' },
  { path: '/inventario', label: 'Inventario Truck', icon: Package, roles: ['owner', 'manager', 'cashier'], group: 'Operación' },
  { path: '/produccion', label: 'Producción', icon: Beef, roles: ['owner', 'manager'], group: 'Operación' },
  { path: '/recetas', label: 'Recetas', icon: BookOpen, roles: ['owner', 'manager'], group: 'Operación' },
  { path: '/menu-semanal', label: 'Menú Semanal', icon: Utensils, roles: ['owner', 'manager'], group: 'Operación' },
  { path: '/compras', label: 'Compras', icon: ShoppingCart, roles: ['owner', 'manager'], group: 'Operación' },
  { path: '/gastos', label: 'Gastos', icon: Receipt, roles: ['owner', 'manager'], group: 'Gestión' },
  { path: '/finanzas', label: 'Finanzas', icon: PiggyBank, roles: ['owner'], group: 'Gestión' },
  { path: '/fidelizacion', label: 'Fidelización', icon: Award, roles: ['owner', 'manager'], group: 'Gestión' },
  { path: '/marketing', label: 'WhatsApp Bot', icon: MessageSquare, roles: ['owner', 'manager'], group: 'Gestión' },
  { path: '/nomina', label: 'Nómina', icon: DollarSign, roles: ['owner'], group: 'Gestión' },
  { path: '/equipo', label: 'Equipo / Usuarios', icon: Users, roles: ['owner', 'manager'], group: 'Gestión' },
  { path: '/auditoria', label: 'Auditoría', icon: ShieldCheck, roles: ['owner'], group: 'Gestión' },
  { path: '/reportes', label: 'Reportes', icon: BarChart3, roles: ['owner', 'manager'], group: 'Gestión' },
  { path: '/mas', label: 'Configuración', icon: Settings, roles: ['owner', 'manager'], group: 'Gestión' }
]
