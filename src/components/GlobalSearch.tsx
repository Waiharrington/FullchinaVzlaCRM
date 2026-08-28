import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
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
  Hash,
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
import { allNavItems, canAccessModule } from './navItems'
import { useAuth } from '../context/auth-context'
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

export function GlobalSearch() {
  const [query, setQuery] = useState('')
  const [isOpen, setIsOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)
  const [results, setResults] = useState<ResultGroup[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()
  const { user } = useAuth()

  const allResults = useMemo(() => results.flatMap(g => g.items), [results])
  const totalResults = allResults.length

  const close = useCallback(() => {
    setIsOpen(false)
    setQuery('')
    setResults([])
    setActiveIndex(0)
  }, [])

  // Keyboard shortcut: Cmd+K / Ctrl+K
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setIsOpen(true)
        setTimeout(() => inputRef.current?.focus(), 50)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  // Click outside to close
  useEffect(() => {
    if (!isOpen) return
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        close()
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [isOpen, close])

  // Search logic
  useEffect(() => {
    if (!query.trim() || query.trim().length < 1) {
      setResults([])
      setActiveIndex(0)
      return
    }

    let cancelled = false
    const q = query.trim().toLowerCase()

    const searchAll = async () => {
      setIsLoading(true)
      const groups: ResultGroup[] = []

      // 1. Modules — instant, no async
      const moduleMatches = allNavItems
        .filter(item => canAccessModule(item.path, user?.role, user?.allowedModules))
        .filter(item => {
          const label = item.label.toLowerCase()
          const path = item.path.toLowerCase()
          return label.includes(q) || path.includes(q)
        })
        .slice(0, MAX_PER_GROUP)
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
          getProducts().catch(() => [] as Product[]),
          getCustomers().catch(() => [] as Customer[]),
          getOrdersWithItems().catch(() => [] as FullOrder[]),
          getSuppliers().catch(() => [] as Supplier[]),
        ])

        if (cancelled) return

        // Products
        const productMatches = products
          .filter(p => p.name.toLowerCase().includes(q))
          .slice(0, MAX_PER_GROUP)
          .map(p => ({
            id: `prod-${p.id}`,
            title: p.name,
            subtitle: `$${p.price.toFixed(2)} · ${p.category}`,
            icon: UtensilsCrossed,
            path: '/menu',
            type: 'product' as const,
            accentColor: '#22c55e',
          }))

        if (productMatches.length) {
          groups.push({ title: 'Productos', items: productMatches })
        }

        // Customers
        const customerMatches = customers
          .filter(c => c.name.toLowerCase().includes(q) || (c.phone && c.phone.includes(q)))
          .slice(0, MAX_PER_GROUP)
          .map(c => ({
            id: `cust-${c.id}`,
            title: c.name,
            subtitle: c.phone || c.email || '',
            icon: Users,
            path: '/clientes',
            type: 'customer' as const,
            accentColor: '#3b82f6',
          }))

        if (customerMatches.length) {
          groups.push({ title: 'Clientes', items: customerMatches })
        }

        // Orders (last 100)
        const recentOrders = orders.slice(0, 100)
        const orderMatches = recentOrders
          .filter(o => {
            const num = `#${o.orderNumber}`.toLowerCase()
            const name = (o.customerName || '').toLowerCase()
            return num.includes(q) || name.includes(q)
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

        // Suppliers
        const supplierMatches = suppliers
          .filter(s => s.name.toLowerCase().includes(q) || (s.contact && s.contact.toLowerCase().includes(q)))
          .slice(0, MAX_PER_GROUP)
          .map(s => ({
            id: `sup-${s.id}`,
            title: s.name,
            subtitle: s.contact || s.phone || '',
            icon: Building2,
            path: '/proveedores',
            type: 'supplier' as const,
            accentColor: '#8b5cf6',
          }))

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
  }, [query, user?.role])

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
    if (!isOpen) return
    const el = dropdownRef.current?.querySelector(`[data-idx="${activeIndex}"]`)
    el?.scrollIntoView({ block: 'nearest' })
  }, [activeIndex, isOpen])

  return (
    <>
      <button
        className="gs-trigger"
        onClick={() => { setIsOpen(true); setTimeout(() => inputRef.current?.focus(), 50) }}
        aria-label="Buscar"
      >
        <Search size={16} />
        <span className="gs-trigger-label">Buscar...</span>
        <kbd className="gs-trigger-kbd">⌘K</kbd>
      </button>

      {isOpen && (
        <div className="gs-overlay" onClick={close}>
          <div
            className="gs-dropdown"
            ref={dropdownRef}
            onClick={e => e.stopPropagation()}
          >
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
              <button className="gs-close-btn" onClick={close} aria-label="Cerrar">
                Esc
              </button>
            </div>

            <div className="gs-results" ref={dropdownRef}>
              {query.trim().length === 0 && (
                <div className="gs-empty">
                  <Hash size={20} style={{ opacity: 0.3 }} />
                  <span>Escribe para buscar en todo el sistema</span>
                </div>
              )}

              {query.trim().length > 0 && totalResults === 0 && !isLoading && (
                <div className="gs-empty">
                  <Search size={20} style={{ opacity: 0.3 }} />
                  <span>No se encontraron resultados para "{query}"</span>
                </div>
              )}

              {isLoading && (
                <div className="gs-empty">
                  <div className="gs-spinner" />
                  <span>Buscando...</span>
                </div>
              )}

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
