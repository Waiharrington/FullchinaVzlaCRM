import { useState, useMemo, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { getOrdersWithItems, type FullOrder } from '../lib/dataService'
import {
  Search,
  Calendar,
  ChevronDown,
  Filter,
  Clock,
  CheckCircle,
  Package,
  Truck,
  User,
  ShoppingBag,
  Bike,
  Plus
} from 'lucide-react'
import './Comandas.css'

export interface ComandaItem {
  id: string
  name: string
  quantity: number
}

export interface ComandaOrder {
  id: string
  orderNumber: string
  time: string
  isRetraso?: boolean
  customerName: string
  orderType: string
  deliveryProvider?: string
  items: ComandaItem[]
  paymentMethod: string
  paymentType: 'card' | 'cash' | 'app'
  elapsedMins: number
  status: 'new' | 'preparing' | 'ready' | 'delivered'
  deliveredTime?: string
}

const MOCK_COMANDAS: ComandaOrder[] = [
  // Nuevas
  {
    id: 'c-1',
    orderNumber: '#FC-000126',
    time: '12:48 PM',
    isRetraso: true,
    customerName: 'Juan Pérez',
    orderType: 'Delivery',
    items: [
      { id: 'i1', name: 'Arroz chaufa especial', quantity: 1 },
      { id: 'i2', name: 'Chow mein mixto', quantity: 1 },
    ],
    paymentMethod: 'Pago: Tarjeta',
    paymentType: 'card',
    elapsedMins: 32,
    status: 'new',
  },
  {
    id: 'c-2',
    orderNumber: '#FC-000127',
    time: '12:52 PM',
    customerName: 'María González',
    orderType: 'Para llevar',
    items: [
      { id: 'i3', name: 'Lumpias (3 pzs)', quantity: 1 },
      { id: 'i4', name: 'Pollo agridulce', quantity: 1 },
    ],
    paymentMethod: 'Pago: Efectivo',
    paymentType: 'cash',
    elapsedMins: 18,
    status: 'new',
  },
  {
    id: 'c-3',
    orderNumber: '#FC-000128',
    time: '12:55 PM',
    customerName: 'Uber Eats',
    orderType: 'Delivery',
    items: [
      { id: 'i5', name: 'Camarones saltados', quantity: 1 },
      { id: 'i6', name: 'Arroz chaufa especial', quantity: 1 },
    ],
    paymentMethod: 'Pago: En app',
    paymentType: 'app',
    elapsedMins: 15,
    status: 'new',
  },

  // En preparación
  {
    id: 'c-4',
    orderNumber: '#FC-000123',
    time: '12:30 PM',
    isRetraso: true,
    customerName: 'Pedro Ramírez',
    orderType: 'Delivery',
    items: [
      { id: 'i7', name: 'Chow mein mixto', quantity: 1 },
      { id: 'i8', name: 'Pollo agridulce', quantity: 1 },
    ],
    paymentMethod: 'Pago: En app',
    paymentType: 'app',
    elapsedMins: 36,
    status: 'preparing',
  },
  {
    id: 'c-5',
    orderNumber: '#FC-000124',
    time: '12:35 PM',
    customerName: 'Ana Torres',
    orderType: 'Para llevar',
    items: [
      { id: 'i9', name: 'Lumpias (3 pzs)', quantity: 2 },
      { id: 'i10', name: 'Arroz chaufa especial', quantity: 1 },
    ],
    paymentMethod: 'Pago: Efectivo',
    paymentType: 'cash',
    elapsedMins: 28,
    status: 'preparing',
  },
  {
    id: 'c-6',
    orderNumber: '#FC-000125',
    time: '12:45 PM',
    customerName: 'Rappi',
    orderType: 'Delivery',
    items: [
      { id: 'i11', name: 'Camarones saltados', quantity: 1 },
      { id: 'i12', name: 'Chow mein mixto', quantity: 1 },
    ],
    paymentMethod: 'Pago: En app',
    paymentType: 'app',
    elapsedMins: 22,
    status: 'preparing',
  },

  // Listas
  {
    id: 'c-7',
    orderNumber: '#FC-000121',
    time: '12:15 PM',
    customerName: 'Sofía Lima',
    orderType: 'Para llevar',
    items: [
      { id: 'i13', name: 'Pollo agridulce', quantity: 1 },
      { id: 'i14', name: 'Lumpias (3 pzs)', quantity: 1 },
    ],
    paymentMethod: 'Pago: Efectivo',
    paymentType: 'cash',
    elapsedMins: 8,
    status: 'ready',
  },
  {
    id: 'c-8',
    orderNumber: '#FC-000122',
    time: '12:18 PM',
    customerName: 'Uber Eats',
    orderType: 'Delivery',
    items: [
      { id: 'i15', name: 'Arroz chaufa especial', quantity: 1 },
      { id: 'i16', name: 'Camarones saltados', quantity: 1 },
    ],
    paymentMethod: 'Pago: En app',
    paymentType: 'app',
    elapsedMins: 6,
    status: 'ready',
  },
  {
    id: 'c-9',
    orderNumber: '#FC-000120',
    time: '12:10 PM',
    customerName: 'Marco Huamán',
    orderType: 'Para llevar',
    items: [
      { id: 'i17', name: 'Chow mein mixto', quantity: 1 },
      { id: 'i18', name: 'Pollo agridulce', quantity: 1 },
    ],
    paymentMethod: 'Pago: Efectivo',
    paymentType: 'cash',
    elapsedMins: 12,
    status: 'ready',
  },

  // Entregadas
  {
    id: 'c-10',
    orderNumber: '#FC-000119',
    time: '12:00 PM',
    customerName: 'Camila Rojas',
    orderType: 'Delivery',
    items: [
      { id: 'i19', name: 'Lumpias (3 pzs)', quantity: 1 },
      { id: 'i20', name: 'Arroz chaufa especial', quantity: 1 },
    ],
    paymentMethod: 'Pago: Tarjeta',
    paymentType: 'card',
    elapsedMins: 0,
    status: 'delivered',
    deliveredTime: '12:15 PM',
  },
  {
    id: 'c-11',
    orderNumber: '#FC-000118',
    time: '11:45 AM',
    customerName: 'Glovo',
    orderType: 'Delivery',
    items: [
      { id: 'i21', name: 'Pollo agridulce', quantity: 1 },
      { id: 'i22', name: 'Chow mein mixto', quantity: 1 },
    ],
    paymentMethod: 'Pago: En app',
    paymentType: 'app',
    elapsedMins: 0,
    status: 'delivered',
    deliveredTime: '11:58 AM',
  },
  {
    id: 'c-12',
    orderNumber: '#FC-000117',
    time: '11:30 AM',
    customerName: 'Luis Fernández',
    orderType: 'Para llevar',
    items: [
      { id: 'i23', name: 'Camarones saltados', quantity: 1 },
      { id: 'i24', name: 'Arroz chaufa especial', quantity: 1 },
    ],
    paymentMethod: 'Pago: Efectivo',
    paymentType: 'cash',
    elapsedMins: 0,
    status: 'delivered',
    deliveredTime: '11:42 AM',
  },
]

const COLUMNS = [
  { key: 'new', label: 'Nuevas', icon: <Package size={16} />, color: '#38bdf8', totalCount: 5 },
  { key: 'preparing', label: 'En preparación', icon: <Clock size={16} />, color: '#f97316', totalCount: 7 },
  { key: 'ready', label: 'Listas', icon: <CheckCircle size={16} />, color: '#10b981', totalCount: 15 },
  { key: 'delivered', label: 'Entregadas', icon: <Truck size={16} />, color: '#3b82f6', totalCount: 7 },
]

export function Comandas() {
  const navigate = useNavigate()
  const [comandas, setComandas] = useState<ComandaOrder[]>(MOCK_COMANDAS)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedOrder, setSelectedOrder] = useState<ComandaOrder | null>(null)

  // Fetch real orders from Supabase / dataService
  useEffect(() => {
    let active = true
    const loadRealOrders = async () => {
      try {
        const today = new Date().toISOString().split('T')[0]
        const realOrders: FullOrder[] = await getOrdersWithItems(today + 'T00:00:00', today + 'T23:59:59')
        if (realOrders && realOrders.length > 0 && active) {
          const mapped: ComandaOrder[] = realOrders.map((o) => {
            const date = new Date(o.createdAt)
            const elapsed = Math.floor((Date.now() - date.getTime()) / 60000)
            let status: ComandaOrder['status'] = 'new'
            if (o.status === 'preparing') status = 'preparing'
            else if (o.status === 'ready') status = 'ready'
            else if (o.status === 'paid' || o.status === 'delivered') status = 'delivered'

            return {
              id: o.id,
              orderNumber: `#FC-${String(o.orderNumber).padStart(6, '0')}`,
              time: date.toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit' }),
              isRetraso: elapsed > 15 && status !== 'delivered',
              customerName: o.customerName || 'Cliente general',
              orderType: o.orderType === 'takeaway' ? 'Para llevar' : o.orderType === 'delivery' ? 'Delivery' : 'Mostrador',
              items: o.items.map((item) => ({
                id: item.id,
                name: item.productName,
                quantity: item.quantity,
              })),
              paymentMethod: o.status === 'paid' ? 'Pago: Efectivo' : 'Pago: Tarjeta',
              paymentType: o.status === 'paid' ? 'cash' : 'card',
              elapsedMins: elapsed < 0 ? 1 : elapsed,
              status,
              deliveredTime: status === 'delivered' ? date.toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit' }) : undefined,
            }
          })
          setComandas(mapped)
        }
      } catch (e) {
        console.error('Error cargando comandas reales:', e)
      }
    }

    loadRealOrders()
    const interval = setInterval(loadRealOrders, 10000)
    return () => { active = false; clearInterval(interval) }
  }, [])

  // Simulation timer for elapsed mins
  useEffect(() => {
    const timer = setInterval(() => {
      setComandas(prev =>
        prev.map(c => (c.status !== 'delivered' ? { ...c, elapsedMins: c.elapsedMins + 1 } : c))
      )
    }, 60000)
    return () => clearInterval(timer)
  }, [])

  const filteredComandas = useMemo(() => {
    return comandas.filter(c => {
      const matchSearch =
        c.orderNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.items.some(i => i.name.toLowerCase().includes(searchQuery.toLowerCase()))
      return matchSearch
    })
  }, [comandas, searchQuery])

  const getOrdersByStatus = (statusKey: string) => {
    return filteredComandas.filter(c => c.status === statusKey)
  }

  const handleAdvanceStatus = (orderId: string, currentStatus: string) => {
    let nextStatus: ComandaOrder['status'] = 'preparing'
    if (currentStatus === 'new') nextStatus = 'preparing'
    else if (currentStatus === 'preparing') nextStatus = 'ready'
    else if (currentStatus === 'ready') nextStatus = 'delivered'

    setComandas(prev =>
      prev.map(c =>
        c.id === orderId
          ? {
              ...c,
              status: nextStatus,
              isRetraso: false,
              deliveredTime: nextStatus === 'delivered' ? new Date().toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' }) : c.deliveredTime
            }
          : c
      )
    )
  }

  return (
    <div className="comandas-page animate-fade-in">
      {/* Comandas Header + Stat Cards Row */}
      <div className="comandas-header-row">
        <div className="comandas-header-left">
          <div className="header-icon-box red">📋</div>
          <div>
            <h1 className="comandas-title">Comandas</h1>
            <p className="comandas-subtitle">Gestiona el estado de tus pedidos en tiempo real.</p>
          </div>
        </div>

        <div className="comandas-header-right">
          <div className="comandas-stats-row">
            <div className="stat-card-mini">
              <span className="stat-number text-red">34</span>
              <div className="stat-info">
                <span className="stat-title">Total comandas</span>
                <span className="stat-sub">Hoy</span>
              </div>
            </div>

            <div className="stat-card-mini">
              <span className="stat-number text-orange">12</span>
              <div className="stat-info">
                <span className="stat-title">Pendientes</span>
                <span className="stat-sub">Nuevas + En preparación</span>
              </div>
            </div>

            <div className="stat-card-mini">
              <span className="stat-number text-green">15</span>
              <div className="stat-info">
                <span className="stat-title">Listas</span>
                <span className="stat-sub">Para entrega</span>
              </div>
            </div>

            <div className="stat-card-mini">
              <div className="stat-time-group">
                <Clock size={16} className="text-blue" />
                <span className="stat-number text-white">28 min</span>
              </div>
              <div className="stat-info">
                <span className="stat-title">Tiempo promedio</span>
                <span className="stat-sub">Hoy</span>
              </div>
            </div>
          </div>

          <button className="btn-nueva-comanda" onClick={() => navigate('/caja')}>
            <Plus size={16} />
            <span>Nueva comanda</span>
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="comandas-filters">
        <div className="filter-group-item">
          <Calendar size={14} />
          <span>Hoy</span>
          <ChevronDown size={12} />
        </div>

        <div className="filter-group-item">
          <Filter size={14} />
          <span>Estado</span>
          <ChevronDown size={12} />
        </div>

        <div className="filter-group-item">
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

        <button className="filter-group-item filter-btn-dark">
          <Filter size={14} />
          <span>Filtros</span>
        </button>
      </div>

      {/* 4 Kanban Columns matching Target Mockup */}
      <div className="kanban-board-grid">
        {COLUMNS.map(col => {
          const colOrders = getOrdersByStatus(col.key)

          return (
            <div key={col.key} className="kanban-column">
              {/* Column Header */}
              <div className="kanban-col-header" style={{ borderBottomColor: col.color }}>
                <div className="col-header-left">
                  <span className="col-icon" style={{ color: col.color }}>{col.icon}</span>
                  <h3 className="col-title">{col.label}</h3>
                </div>
                <span className="col-count-badge">{col.totalCount}</span>
              </div>

              {/* Column Body / Order Cards */}
              <div className="kanban-col-body">
                {colOrders.length === 0 ? (
                  <div className="empty-col">Sin comandas</div>
                ) : (
                  colOrders.map(order => (
                    <div
                      key={order.id}
                      className={`comanda-card-item card-${order.status} ${order.isRetraso ? 'has-retraso' : ''}`}
                      onClick={() => setSelectedOrder(order)}
                    >
                      {/* Top Header line */}
                      <div className="card-top-line">
                        <span className="card-order-no">{order.orderNumber}</span>
                        <div className="card-time-wrap">
                          <span className="card-time-text">{order.time}</span>
                          {order.isRetraso && (
                            <span className="badge-retraso">⏰ Retraso</span>
                          )}
                        </div>
                      </div>

                      {/* Customer & Delivery line */}
                      <div className="card-customer-line">
                        <span className="customer-name">
                          <User size={13} className="meta-icon" /> {order.customerName}
                        </span>
                        <span className="order-type-tag">
                          {order.orderType === 'Delivery' ? <Bike size={13} /> : <ShoppingBag size={13} />} {order.orderType}
                        </span>
                      </div>

                      {/* Item list */}
                      <div className="card-items-list">
                        {order.items.map(item => (
                          <div key={item.id} className="card-item-row">
                            <span className="dot-indicator" style={{ backgroundColor: col.color }}></span>
                            <span className="item-name-text">{item.name}</span>
                            <span className="item-qty-text">× {item.quantity}</span>
                          </div>
                        ))}
                      </div>

                      {/* Footer Row */}
                      <div className="card-footer-line">
                        <span className={`payment-type-badge pay-${order.paymentType}`}>
                          {order.paymentMethod}
                        </span>

                        {order.status === 'ready' ? (
                          <div className="status-ready-group">
                            <span className="badge-ready-tag">✓ Listo</span>
                            <span className="timer-mins text-green">⏱️ {order.elapsedMins} min</span>
                          </div>
                        ) : order.status === 'delivered' ? (
                          <span className="badge-delivered-tag">
                            Entregado {order.deliveredTime} ✓
                          </span>
                        ) : (
                          <span className={`timer-mins ${order.isRetraso ? 'text-red-urgent' : 'text-orange'}`}>
                            {order.isRetraso ? '⏰' : '⏱️'} {order.elapsedMins} min
                          </span>
                        )}
                      </div>

                      {/* Quick Advance Status Action */}
                      {order.status !== 'delivered' && (
                        <button
                          className="quick-advance-btn"
                          onClick={e => {
                            e.stopPropagation()
                            handleAdvanceStatus(order.id, order.status)
                          }}
                        >
                          {order.status === 'new'
                            ? '👨‍🍳 Iniciar preparación'
                            : order.status === 'preparing'
                            ? '✅ Marcar como lista'
                            : '🚚 Marcar como entregada'}
                        </button>
                      )}
                    </div>
                  ))
                )}
              </div>

              {/* Column Footer */}
              <div className="kanban-col-footer">
                <button className="ver-todas-btn">
                  + Ver todas ({col.totalCount})
                </button>
              </div>
            </div>
          )
        })}
      </div>

      {/* Modal detail */}
      {selectedOrder && (
        <div className="modal-overlay" onClick={() => setSelectedOrder(null)}>
          <div className="modal-content animate-pop" onClick={e => e.stopPropagation()}>
            <header className="modal-header">
              <h2>Detalle de Comanda {selectedOrder.orderNumber}</h2>
              <button className="modal-close" onClick={() => setSelectedOrder(null)}>✕</button>
            </header>
            <div className="modal-body">
              <div className="order-detail-meta">
                <p><strong>Cliente:</strong> {selectedOrder.customerName}</p>
                <p><strong>Tipo:</strong> {selectedOrder.orderType}</p>
                <p><strong>Hora:</strong> {selectedOrder.time}</p>
                <p><strong>Pago:</strong> {selectedOrder.paymentMethod}</p>
              </div>
              <h3>Ítems del Pedido</h3>
              <div className="detail-items-list">
                {selectedOrder.items.map(item => (
                  <div key={item.id} className="detail-item-row">
                    <span>{item.quantity}x {item.name}</span>
                  </div>
                ))}
              </div>
            </div>
            <footer className="modal-footer">
              <button className="btn-accent" onClick={() => window.print()}>🖨️ Imprimir Ticket</button>
              <button className="btn-outline" onClick={() => setSelectedOrder(null)}>Cerrar</button>
            </footer>
          </div>
        </div>
      )}
    </div>
  )
}
