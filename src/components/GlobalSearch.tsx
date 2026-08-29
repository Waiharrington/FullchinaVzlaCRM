import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSearch } from '../context/search-context'
import {
  Search,
  Home,
  UtensilsCrossed,
  ClipboardList,
  Wallet,
  LayoutGrid,
  BadgeDollarSign,
  Users,
  Building2,
  Package,
  Beef,
  BookOpen,
  ShoppingCart,
  Receipt,
  PiggyBank,
  Award,
  Tag,
  MessageSquare,
  DollarSign,
  BarChart3,
  Settings,
  Utensils,
  X,
  ArrowRight,
} from 'lucide-react'
import {
  getProducts,
  getCustomers,
  getOrdersWithItems,
  getSuppliers,
  type Product,
  type Customer,
  type FullOrder,
  type Supplier,
} from '../lib/dataService'
import { allNavItems, type Role } from './navItems'
import { useAuth } from '../context/auth-context'
import { EmptyState } from './EmptyState'
import './GlobalSearch.css'

interface ResultGroup {
  title: string
  items: SearchResult[]
}

interface SearchResult {
  id: string
  title: string
  subtitle?: string
  icon: typeof Home
  path: string
  type: 'module' | 'product' | 'customer' | 'order' | 'supplier'
  accentColor?: string
}

const MODULE_ICONS: Record<string, typeof Home> = {
  '/': Home,
  '/comandas': ClipboardList,
  '/caja': Wallet,
  '/mesas': LayoutGrid,
  '/caja-operativa': BadgeDollarSign,
  '/clientes': Users,
  '/proveedores': Building2,
  '/almacen': Building2,
  '/inventario': Package,
  '/produccion': Beef,
  '/menu': UtensilsCrossed,
  '/recetas': BookOpen,
  '/menu-semanal': Utensils,
  '/compras': ShoppingCart,
  '/gastos': Receipt,
  '/finanzas': PiggyBank,
  '/fidelizacion': Award,
  '/promociones': Tag,
  '/marketing': MessageSquare,
  '/nomina': DollarSign,
  '/equipo': Users,
  '/reportes': BarChart3,
  '/mas': Settings,
  '/cocina': UtensilsCrossed,
  '/auditoria': BarChart3,
}

const MAX_PER_GROUP = 5

interface SearchableModule {
  path: string
  label: string
  icon: typeof Home
  roles: Role[]
  group: string
  keywords?: string[]
}

const SEARCH_ONLY_MODULES: SearchableModule[] = [
  { path: '/menu-semanal', label: 'Menú semanal', icon: Utensils, roles: ['owner', 'manager'], group: 'Operación', keywords: ['planificación', 'semana', 'platos de la semana'] },
  { path: '/cocina', label: 'Cocina', icon: UtensilsCrossed, roles: ['owner', 'manager'], group: 'Operación', keywords: ['preparación', 'pedidos en cocina'] },
  { path: '/auditoria', label: 'Auditoría', icon: BarChart3, roles: ['owner'], group: 'Configuración', keywords: ['actividad', 'historial', 'seguridad'] },
]

const SEARCHABLE_MODULES: SearchableModule[] = [...allNavItems, ...SEARCH_ONLY_MODULES]

function normalizeSearchText(value: string | number | null | undefined) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
}

function includesSearchTerm(query: string, ...values: Array<string | number | null | undefined>) {
  return values.some(value => normalizeSearchText(value).includes(query))
}

export function GlobalSearch({ inline = false }: { inline?: boolean }) {
  const [query, setQuery] = useState('')
  const { isOpen, open: ctxOpen, close: ctxClose } = useSearch()
  const [activeIndex, setActiveIndex] = useState(0)
  const [results, setResults] = useState<ResultGroup[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()
  const { user } = useAuth()

  const allResults = useMemo(() => results.flatMap(g => g.items), [results])
  const totalResults = allResults.length
  const showDropdown = inline ? query.trim().length > 0 : isOpen

  const close = useCallback(() => {
    if (!inline) ctxClose()
    setQuery('')
    setResults([])
    setActiveIndex(0)
  }, [ctxClose, inline])

  const canAccessPath = useCallback((path: string, roles: Role[]) => {
    if (!user?.role || user.role === 'owner') return true
    if (user.allowedModules) return user.allowedModules.includes(path)
    return roles.includes(user.role)
  }, [user?.role, user?.allowedModules])

  // Keyboard shortcut: Cmd+K / Ctrl+K
  useEffect(() => {
    if (inline) return
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        ctxOpen()
        setTimeout(() => inputRef.current?.focus(), 50)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [ctxOpen, inline])

  // Click outside to close
  useEffect(() => {
    if (!showDropdown) return
    const handler = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        close()
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [showDropdown, close])

  // Search logic
  useEffect(() => {
    if (!query.trim() || query.trim().length < 1) {
      setResults([])
      setActiveIndex(0)
      setIsLoading(false)
      return
    }

    let cancelled = false
    const q = normalizeSearchText(query.trim())

    const searchAll = async () => {
      setIsLoading(true)
      const groups: ResultGroup[] = []

      // 1. Modules — instant, no async
      const moduleMatches = SEARCHABLE_MODULES
        .filter(item => canAccessPath(item.path, item.roles))
        .filter(item => {
          return includesSearchTerm(q, item.label, item.path, item.group, ...(item.keywords ?? []))
        })
        .map(item => ({
          id: `mod-${item.path}`,
          title: item.label,
          subtitle: item.group,
          icon: MODULE_ICONS[item.path] || item.icon,
          path: item.path,
          type: 'module' as const,
        }))

      if (moduleMatches.length) {
        groups.push({ title: 'Módulos', items: moduleMatches })
      }

      // 2. Fetch data in parallel
      try {
        const [products, customers, orders, suppliers] = await Promise.all([
          canAccessPath('/menu', ['owner', 'manager']) ? getProducts().catch(() => [] as Product[]) : Promise.resolve([] as Product[]),
          canAccessPath('/clientes', ['owner', 'manager']) ? getCustomers().catch(() => [] as Customer[]) : Promise.resolve([] as Customer[]),
          canAccessPath('/comandas', ['owner', 'manager', 'cashier']) || canAccessPath('/caja', ['owner', 'manager', 'cashier'])
            ? getOrdersWithItems().catch(() => [] as FullOrder[])
            : Promise.resolve([] as FullOrder[]),
          canAccessPath('/proveedores', ['owner', 'manager']) ? getSuppliers().catch(() => [] as Supplier[]) : Promise.resolve([] as Supplier[]),
        ])

        if (cancelled) return

        const productMatches = canAccessPath('/menu', ['owner', 'manager']) ? products
          .filter(p => includesSearchTerm(q, p.name, p.description, p.category, ...(p.categories ?? [])))
          .slice(0, MAX_PER_GROUP)
          .map(p => ({
            id: `prod-${p.id}`,
            title: p.name,
            subtitle: `$${p.price.toFixed(2)} · ${p.category}`,
            icon: UtensilsCrossed,
            path: '/menu',
            type: 'product' as const,
            accentColor: '#22c55e',
          })) : []

        if (productMatches.length) {
          groups.push({ title: 'Productos', items: productMatches })
        }

        const customerMatches = canAccessPath('/clientes', ['owner', 'manager']) ? customers
          .filter(c => includesSearchTerm(q, c.name, c.identification, c.phone, c.email, c.favoriteProduct))
          .slice(0, MAX_PER_GROUP)
          .map(c => ({
            id: `cust-${c.id}`,
            title: c.name,
            subtitle: c.phone || c.email || '',
            icon: Users,
            path: '/clientes',
            type: 'customer' as const,
            accentColor: '#3b82f6',
          })) : []

        if (customerMatches.length) {
          groups.push({ title: 'Clientes', items: customerMatches })
        }

        const recentOrders = orders.slice(0, 100)
        const orderMatches = recentOrders
          .filter(o => {
            const destination = o.orderType === 'delivery' ? '/comandas' : '/caja'
            return canAccessPath(destination, ['owner', 'manager', 'cashier'])
              && includesSearchTerm(q, `#${o.orderNumber}`, o.orderNumber, o.customerName, o.orderType, o.status, o.fulfillmentStatus, o.notes, ...o.items.map(item => item.productName))
          })
          .slice(0, MAX_PER_GROUP)
          .map(o => ({
            id: `ord-${o.id}`,
            title: `Orden #${o.orderNumber}`,
            subtitle: o.customerName || o.orderType,
            icon: ClipboardList,
            path: o.orderType === 'delivery' ? '/comandas' : '/caja',
            type: 'order' as const,
            accentColor: '#f59e0b',
          }))

        if (orderMatches.length) {
          groups.push({ title: 'Órdenes recientes', items: orderMatches })
        }

        const supplierMatches = canAccessPath('/proveedores', ['owner', 'manager']) ? suppliers
          .filter(s => includesSearchTerm(q, s.name, s.contact, s.phone, s.email, s.notes))
          .slice(0, MAX_PER_GROUP)
          .map(s => ({
            id: `sup-${s.id}`,
            title: s.name,
            subtitle: s.contact || s.phone || '',
            icon: Building2,
            path: '/proveedores',
            type: 'supplier' as const,
            accentColor: '#8b5cf6',
          })) : []

        if (supplierMatches.length) {
          groups.push({ title: 'Proveedores', items: supplierMatches })
        }
      } catch {
        // Data fetch failed — still show module results
      }

      if (!cancelled) {
        setResults(groups)
        setActiveIndex(0)
        setIsLoading(false)
      }
    }

    searchAll()
    return () => { cancelled = true }
  }, [query, canAccessPath])

  const navigateTo = useCallback((path: string) => {
    navigate(path)
    close()
  }, [navigate, close])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIndex(i => Math.min(i + 1, totalResults - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIndex(i => Math.max(i - 1, 0))
    } else if (e.key === 'Enter' && allResults[activeIndex]) {
      e.preventDefault()
      navigateTo(allResults[activeIndex].path)
    } else if (e.key === 'Escape') {
      close()
    }
  }, [allResults, activeIndex, totalResults, navigateTo, close])

  // Scroll active item into view
  useEffect(() => {
    if (!showDropdown) return
    const el = wrapperRef.current?.querySelector(`[data-idx="${activeIndex}"]`)
    el?.scrollIntoView({ block: 'nearest' })
  }, [activeIndex, showDropdown])

  // ── Inline mode: input + dropdown in a relative wrapper ──
  if (inline) {
    return (
      <div className="gs-inline-wrapper" ref={wrapperRef}>
        <Search size={16} className="gs-inline-icon" />
        <input
          ref={inputRef}
          className="gs-inline-field"
          placeholder="Buscar..."
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          aria-label="Buscar en el sistema"
          role="combobox"
          aria-expanded={showDropdown}
          aria-controls="global-search-inline-results"
        />
        {query && (
          <button className="gs-inline-clear" onClick={() => { setQuery(''); inputRef.current?.focus() }} aria-label="Limpiar">
            <X size={13} />
          </button>
        )}

        {showDropdown && (
          <div className="gs-inline-dropdown" id="global-search-inline-results">
            {query.trim().length === 0 && (
              <div className="gs-empty-inline">Escribe para buscar...</div>
            )}

            {query.trim().length > 0 && totalResults === 0 && !isLoading && (
              <div className="gs-empty-inline">
                <EmptyState compact title="Sin resultados" description={`No encontramos nada para "${query}"`} />
              </div>
            )}

            {isLoading && <div className="gs-empty-inline"><div className="gs-spinner" /> Buscando...</div>}

            {results.map((group, gi) => (
              <div key={group.title} className="gs-group">
                <div className="gs-group-title">{group.title}</div>
                {group.items.map((item) => {
                  const globalIdx = results
                    .slice(0, gi)
                    .reduce((acc, g) => acc + g.items.length, 0) + group.items.indexOf(item)
                  const Icon = item.icon
                  return (
                    <button
                      key={item.id}
                      className={`gs-item ${globalIdx === activeIndex ? 'active' : ''}`}
                      data-idx={globalIdx}
                      onMouseEnter={() => setActiveIndex(globalIdx)}
                      onClick={() => navigateTo(item.path)}
                    >
                      <span className="gs-item-icon" style={item.accentColor ? { color: item.accentColor } : undefined}>
                        <Icon size={15} />
                      </span>
                      <span className="gs-item-text">
                        <span className="gs-item-title">{item.title}</span>
                        {item.subtitle && <span className="gs-item-sub">{item.subtitle}</span>}
                      </span>
                      <ArrowRight size={13} className="gs-item-arrow" />
                    </button>
                  )
                })}
              </div>
            ))}
          </div>
        )}
      </div>
    )
  }

  // ── Modal mode: ⌘K command palette ──
  return (
    <>
      {isOpen && (
        <div className="gs-overlay" onClick={close}>
          <div className="gs-dropdown" ref={wrapperRef} onClick={e => e.stopPropagation()}>
            <div className="gs-input-row">
              <Search size={18} className="gs-input-icon" />
              <input
                ref={inputRef}
                className="gs-input"
                placeholder="Buscar módulos, productos, clientes, órdenes..."
                value={query}
                onChange={e => setQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                autoFocus
              />
              {query && (
                <button className="gs-clear" onClick={() => setQuery('')} aria-label="Limpiar">
                  <X size={14} />
                </button>
              )}
              <button className="gs-close-btn" onClick={close} aria-label="Cerrar">Esc</button>
            </div>

            <div className="gs-results">
              {query.trim().length === 0 && (
                <div className="gs-empty"><span>Escribe para buscar en todo el sistema</span></div>
              )}
              {query.trim().length > 0 && totalResults === 0 && !isLoading && (
                <div className="gs-empty">
                  <EmptyState compact title="Sin resultados" description={`No encontramos nada para "${query}"`} />
                </div>
              )}
              {isLoading && <div className="gs-empty"><div className="gs-spinner" /> <span>Buscando...</span></div>}

              {results.map((group, gi) => (
                <div key={group.title} className="gs-group">
                  <div className="gs-group-title">{group.title}</div>
                  {group.items.map((item) => {
                    const globalIdx = results
                      .slice(0, gi)
                      .reduce((acc, g) => acc + g.items.length, 0) + group.items.indexOf(item)
                    const Icon = item.icon
                    return (
                      <button
                        key={item.id}
                        className={`gs-item ${globalIdx === activeIndex ? 'active' : ''}`}
                        data-idx={globalIdx}
                        onMouseEnter={() => setActiveIndex(globalIdx)}
                        onClick={() => navigateTo(item.path)}
                      >
                        <span className="gs-item-icon" style={item.accentColor ? { color: item.accentColor } : undefined}>
                          <Icon size={16} />
                        </span>
                        <span className="gs-item-text">
                          <span className="gs-item-title">{item.title}</span>
                          {item.subtitle && <span className="gs-item-sub">{item.subtitle}</span>}
                        </span>
                        <ArrowRight size={14} className="gs-item-arrow" />
                      </button>
                    )
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
