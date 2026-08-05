import { useState, useMemo, useEffect, useCallback } from 'react'
import { getOrdersWithItems, type FullOrder } from '../lib/dataService'
import {
  Search,
  Plus,
  Users,
  Bell,
  Calendar,
  ChevronDown,
  Filter,
  Clock,
  CheckCircle,
  Package,
  AlertCircle
} from 'lucide-react'
import './Comandas.css'

type StatusFilter = 'all' | string

const STATUSES: { key: string; label: string; icon: React.ReactNode; color: string }[] = [
  { key: 'open', label: 'Nuevas', icon: <AlertCircle size={16} />, color: '#ef4444' },
  { key: 'confirmed', label: 'Confirmadas', icon: <Clock size={16} />, color: '#f59e0b' },
  { key: 'preparing', label: 'En preparación', icon: <Clock size={16} />, color: '#f97316' },
  { key: 'ready', label: 'Listas', icon: <CheckCircle size={16} />, color: '#10b981' },
]

const ORDER_TYPES: Record<string, string> = {
  'delivery': 'Delivery',
  'takeaway': 'Para llevar',
  'dine-in': 'En mesas',
}

const ORDER_TYPE_ICONS: Record<string, string> = {
  'delivery': '🚗',
  'takeaway': '🛍️',
  'dine-in': '🍽️',
}

const STATUS_LABELS: Record<string, string> = {
  'open': 'Nueva',
  'confirmed': 'Confirmada',
  'preparing': 'En preparación',
  'ready': 'Lista',
  'paid': 'Pagada',
  'cancelled': 'Cancelada',
}

export function Comandas() {
  const [orders, setOrders] = useState<FullOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter] = useState<StatusFilter>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedOrder, setSelectedOrder] = useState<FullOrder | null>(null)
  const [showAllOrders, setShowAllOrders] = useState<string | null>(null)

  const fetchOrders = useCallback(async () => {
    try {
      const today = new Date().toISOString().split('T')[0]
      const data = await getOrdersWithItems(today + 'T00:00:00', today + 'T23:59:59')
      setOrders(data.filter(o => o.status !== 'paid' && o.status !== 'cancelled'))
    } catch (e) {
      console.error('Error cargando órdenes:', e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchOrders()
    const interval = setInterval(fetchOrders, 30000)
    return () => clearInterval(interval)
  }, [fetchOrders])

  const filteredOrders = useMemo(() => {
    return orders.filter(order => {
      const matchesStatus = statusFilter === 'all' || order.status === statusFilter
      const matchesSearch =
        order.orderNumber.toString().includes(searchQuery.toLowerCase()) ||
        order.customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        order.items.some(i => i.productName.toLowerCase().includes(searchQuery.toLowerCase()))
      return matchesStatus && matchesSearch
    })
  }, [orders, statusFilter, searchQuery])

  const getElapsedTime = (createdAt: string) => {
    const minutes = Math.floor((Date.now() - new Date(createdAt).getTime()) / 60000)
    if (minutes < 1) return 'Hace un momento'
    if (minutes < 60) return `${minutes} min`
    const hours = Math.floor(minutes / 60)
    return `${hours}h ${minutes % 60}m`
  }

  const getTimerClass = (createdAt: string, status: string) => {
    if (status === 'ready' || status === 'paid') return 'timer-normal'
    const minutes = Math.floor((Date.now() - new Date(createdAt).getTime()) / 60000)
    if (minutes >= 15) return 'timer-urgent'
    if (minutes >= 10) return 'timer-warning'
    return 'timer-normal'
  }

  const getFormattedTime = (createdAt: string) => {
    const date = new Date(createdAt)
    return date.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })
  }

  const getTodayStats = () => {
    const total = orders.length
    const pending = orders.filter(o => o.status === 'open' || o.status === 'confirmed' || o.status === 'preparing').length
    const ready = orders.filter(o => o.status === 'ready').length
    return { total, pending, ready }
  }

  const stats = getTodayStats()

  const getVisibleOrders = (statusKey: string) => {
    if (showAllOrders === statusKey) {
      return filteredOrders.filter(o => o.status === statusKey)
    }
    return filteredOrders.filter(o => o.status === statusKey).slice(0, 3)
  }

  const getOrderCount = (statusKey: string) => {
    return filteredOrders.filter(o => o.status === statusKey).length
  }

  if (loading) {
    return (
      <div className="comandas-page">
        <div className="comandas-topbar">
          <div className="topbar-search">
            <Search size={16} />
            <input type="text" placeholder="Buscar productos, clientes, comandas..." readOnly />
            <span className="search-shortcut">⌘K</span>
          </div>
        </div>
        <div className="comandas-header-row">
          <div className="comandas-header-left">
            <div className="header-icon-box"><AlertCircle size={22} /></div>
            <div>
              <h1 className="comandas-title">Comandas</h1>
              <p className="comandas-subtitle">Cargando...</p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="comandas-page">
      {/* Top Bar */}
      <div className="comandas-topbar">
        <div className="topbar-search">
          <Search size={16} />
          <input
            type="text"
            placeholder="Buscar productos, clientes, comandas..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
          <span className="search-shortcut">⌘K</span>
        </div>
        <div className="topbar-actions">
          <button className="db-primary-btn">
            <Plus size={14} />
            <span>Nueva comanda</span>
          </button>
          <button className="db-header-pill">
            <Users size={14} />
            <span>Mesa rápida</span>
          </button>
          <div className="db-header-pill">
            <Calendar size={14} />
            <span>{new Date().toLocaleDateString('es-PE', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
          </div>
          <button className="db-header-icon-btn">
            <Bell size={18} />
            <span className="db-bell-dot">5</span>
          </button>
          <div className="user-pill">
            <img src="/login-carousel/slide7.jpg" alt="Admin" className="user-pill-avatar" />
            <div className="user-pill-info">
              <span className="user-pill-name">Admin</span>
              <span className="user-pill-role">Administrador</span>
            </div>
          </div>
        </div>
      </div>

      {/* Header + Stats */}
      <div className="comandas-header-row">
        <div className="comandas-header-left">
          <div className="header-icon-box">
            <AlertCircle size={22} />
          </div>
          <div>
            <h1 className="comandas-title">Comandas</h1>
            <p className="comandas-subtitle">Gestiona el estado de tus pedidos en tiempo real.</p>
          </div>
        </div>
        <div className="comandas-stats-row">
          <div className="kpi-mini-card">
            <div className="kpi-mini-icon red"><AlertCircle size={16} /></div>
            <div className="kpi-mini-data">
              <span className="kpi-mini-value">{stats.total}</span>
              <span className="kpi-mini-label">Total comandas</span>
              <span className="kpi-mini-sub">Hoy</span>
            </div>
          </div>
          <div className="kpi-mini-card">
            <div className="kpi-mini-icon orange"><Clock size={16} /></div>
            <div className="kpi-mini-data">
              <span className="kpi-mini-value">{stats.pending}</span>
              <span className="kpi-mini-label">Pendientes</span>
              <span className="kpi-mini-sub">Nuevas + En preparación</span>
            </div>
          </div>
          <div className="kpi-mini-card">
            <div className="kpi-mini-icon green"><CheckCircle size={16} /></div>
            <div className="kpi-mini-data">
              <span className="kpi-mini-value">{stats.ready}</span>
              <span className="kpi-mini-label">Listas</span>
              <span className="kpi-mini-sub">Para entrega</span>
            </div>
          </div>
          <div className="kpi-mini-card">
            <div className="kpi-mini-icon blue"><Clock size={16} /></div>
            <div className="kpi-mini-data">
              <span className="kpi-mini-value">28 min</span>
              <span className="kpi-mini-label">Tiempo promedio</span>
              <span className="kpi-mini-sub">Hoy</span>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="comandas-filters">
        <div className="filter-left">
          <div className="filter-group">
            <Calendar size={14} />
            <span>Hoy</span>
            <ChevronDown size={12} />
          </div>
          <div className="filter-group">
            <Filter size={14} />
            <span>Estado</span>
            <ChevronDown size={12} />
          </div>
          <div className="filter-group">
            <Package size={14} />
            <span>Tipo de pedido</span>
            <ChevronDown size={12} />
          </div>
          <div className="filter-search-inline">
            <Search size={14} />
            <input
              type="text"
              placeholder="Buscar por número, cliente o teléfono..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
          </div>
          <button className="filter-group filter-btn">
            <Filter size={14} />
            <span>Filtros</span>
          </button>
        </div>
      </div>

      {/* Kanban Board */}
      <div className="kanban-board">
        {STATUSES.map(st => {
          const colOrders = getVisibleOrders(st.key)
          const totalCount = getOrderCount(st.key)
          return (
            <div key={st.key} className="kanban-col">
              <div className="kanban-col-header" style={{ borderBottomColor: st.color }}>
                <span className="col-title">
                  {st.icon} {st.label}
                </span>
                <span className="col-count">{totalCount}</span>
              </div>

              <div className="kanban-col-body">
                {colOrders.length === 0 ? (
                  <div className="empty-col">Sin comandas</div>
                ) : (
                  colOrders.map(order => (
                    <div
                      key={order.id}
                      className={`comanda-card card-${order.status}`}
                      onClick={() => setSelectedOrder(order)}
                    >
                      <div className="card-header">
                        <div className="card-id-section">
                          <span className="card-id">#{String(order.orderNumber).padStart(4, '0')}</span>
                          <span className="card-time">{getFormattedTime(order.createdAt)}</span>
                        </div>
                        {order.status === 'ready' && (
                          <span className="status-badge badge-ready">
                            <CheckCircle size={10} /> Listo
                          </span>
                        )}
                      </div>

                      <div className="card-customer">
                        <span className="customer-icon">👤</span>
                        <span>{order.customerName}</span>
                      </div>

                      <div className="card-order-type">
                        <span className="type-icon">{ORDER_TYPE_ICONS[order.orderType] || '🛍️'}</span>
                        <span>{ORDER_TYPES[order.orderType] || order.orderType}</span>
                      </div>

                      <div className="card-items">
                        {order.items.map((item) => (
                          <div key={item.id} className="item-row">
                            <span className="item-dot" style={{ backgroundColor: st.color }}></span>
                            <span className="item-name">{item.emoji} {item.productName}</span>
                            <span className="item-qty">× {item.quantity}</span>
                          </div>
                        ))}
                      </div>

                      <div className="card-footer">
                        <div className="payment-info">
                          <span className="payment-label">Total:</span>
                          <span className="payment-method method-paid">
                            ${order.totalAmount.toFixed(2)}
                          </span>
                        </div>
                        {order.status !== 'ready' && (
                          <span className={`timer-text ${getTimerClass(order.createdAt, order.status)}`}>
                            <Clock size={12} /> {getElapsedTime(order.createdAt)}
                          </span>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>

              {totalCount > 3 && (
                <div className="kanban-col-footer">
                  <button
                    className="show-all-btn"
                    onClick={() => setShowAllOrders(showAllOrders === st.key ? null : st.key)}
                  >
                    + Ver todas ({totalCount})
                  </button>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Modal */}
      {selectedOrder && (
        <div className="modal-overlay" onClick={() => setSelectedOrder(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <header className="modal-header">
              <h2>Detalle de Comanda #{String(selectedOrder.orderNumber).padStart(4, '0')}</h2>
              <button className="modal-close" onClick={() => setSelectedOrder(null)}>✕</button>
            </header>
            <div className="modal-body">
              <div className="order-detail-meta">
                <p><strong>Cliente:</strong> {selectedOrder.customerName}</p>
                <p><strong>Tipo:</strong> {ORDER_TYPES[selectedOrder.orderType] || selectedOrder.orderType}</p>
                <p><strong>Creación:</strong> {new Date(selectedOrder.createdAt).toLocaleString('es')}</p>
                <p><strong>Estado:</strong> {STATUS_LABELS[selectedOrder.status] || selectedOrder.status}</p>
              </div>
              <h3>Ítems del Pedido</h3>
              <div className="detail-items-list">
                {selectedOrder.items.map((item) => (
                  <div key={item.id} className="detail-item-row">
                    <span>{item.emoji} {item.quantity}x {item.productName}</span>
                    <span>${(item.unitPrice * item.quantity).toFixed(2)}</span>
                  </div>
                ))}
              </div>
              <div className="detail-total-row">
                <span>Total:</span>
                <span>${selectedOrder.totalAmount.toFixed(2)}</span>
              </div>
            </div>
            <footer className="modal-footer">
              <button className="btn-outline" onClick={() => setSelectedOrder(null)}>Cerrar</button>
            </footer>
          </div>
        </div>
      )}
    </div>
  )
}
