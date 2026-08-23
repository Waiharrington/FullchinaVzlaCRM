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
  BarChart3,
  Settings,
  Building2,
  Award,
  MessageSquare,
  Utensils,
  UtensilsCrossed,
  Receipt,
  BadgeDollarSign,
  Tag,
  LayoutGrid
} from 'lucide-react'

export type Role = 'owner' | 'manager' | 'cashier'

export interface NavItem {
  path: string
  label: string
  icon: typeof Home
  roles: Role[]
  group: string
}

export const allNavItems: NavItem[] = [
  { path: '/', label: 'Dashboard', icon: Home, roles: ['owner', 'manager'], group: 'Operación' },
  { path: '/comandas', label: 'Comandas', icon: ClipboardList, roles: ['owner', 'manager', 'cashier'], group: 'Operación' },
  { path: '/caja', label: 'Ventas', icon: Wallet, roles: ['owner', 'manager', 'cashier'], group: 'Operación' },
  { path: '/mesas', label: 'Mesas', icon: LayoutGrid, roles: ['owner', 'manager', 'cashier'], group: 'Operación' },
  { path: '/caja-operativa', label: 'Apertura y cierre', icon: BadgeDollarSign, roles: ['owner', 'manager'], group: 'Operación' },
  { path: '/clientes', label: 'Clientes', icon: Users, roles: ['owner', 'manager'], group: 'Operación' },
  { path: '/almacen', label: 'Almacén', icon: Building2, roles: ['owner', 'manager'], group: 'Operación' },
  { path: '/inventario', label: 'Inventario Truck', icon: Package, roles: ['owner', 'manager'], group: 'Operación' },
  { path: '/produccion', label: 'Producción', icon: Beef, roles: ['owner', 'manager'], group: 'Operación' },
  { path: '/menu', label: 'Menú', icon: UtensilsCrossed, roles: ['owner', 'manager'], group: 'Operación' },
  { path: '/recetas', label: 'Recetas', icon: BookOpen, roles: ['owner', 'manager'], group: 'Operación' },
  { path: '/menu-semanal', label: 'Menú Semanal', icon: Utensils, roles: ['owner', 'manager'], group: 'Operación' },
  { path: '/compras', label: 'Compras', icon: ShoppingCart, roles: ['owner', 'manager'], group: 'Operación' },
  { path: '/gastos', label: 'Gastos', icon: Receipt, roles: ['owner', 'manager'], group: 'Gestión' },
  { path: '/finanzas', label: 'Finanzas', icon: PiggyBank, roles: ['owner'], group: 'Gestión' },
  { path: '/fidelizacion', label: 'Fidelización', icon: Award, roles: ['owner', 'manager'], group: 'Gestión' },
  { path: '/promociones', label: 'Promociones', icon: Tag, roles: ['owner', 'manager'], group: 'Gestión' },
  { path: '/marketing', label: 'WhatsApp Bot', icon: MessageSquare, roles: ['owner', 'manager'], group: 'Gestión' },
  { path: '/nomina', label: 'Nómina', icon: DollarSign, roles: ['owner'], group: 'Gestión' },
  { path: '/equipo', label: 'Equipo / Usuarios', icon: Users, roles: ['owner', 'manager'], group: 'Gestión' },
  { path: '/reportes', label: 'Reportes', icon: BarChart3, roles: ['owner', 'manager'], group: 'Gestión' },
  { path: '/mas', label: 'Configuración', icon: Settings, roles: ['owner', 'manager'], group: 'Gestión' }
]

/**
 * Determina si un usuario puede acceder a un módulo/ruta.
 * - El owner siempre ve todo (no se puede auto-bloquear).
 * - Si el usuario tiene `allowedModules` definido (override), sólo ve esos
 *   módulos del nav; los defaults del rol se ignoran.
 * - Si `allowedModules` es null/undefined, se usan los permisos del rol.
 * Para rutas fuera del nav (ej. /cocina, /auditoria) se usa `fallbackRoles`.
 */
export function canAccessModule(
  path: string,
  role: Role | undefined,
  allowedModules: string[] | null | undefined,
  fallbackRoles?: Role[],
): boolean {
  if (!role) return true
  if (role === 'owner') return true
  const item = allNavItems.find(i => i.path === path)
  if (item && allowedModules) return allowedModules.includes(path)
  if (item) return item.roles.includes(role)
  return fallbackRoles ? fallbackRoles.includes(role) : false
}
