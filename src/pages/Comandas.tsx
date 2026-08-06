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
  Plus,
  MapPin,
  CreditCard,
  Printer,
  Edit3,
  Hash,
  Phone,
  FileText,
  X
} from 'lucide-react'
import './Comandas.css'

export interface ComandaItem {
  id: string
  name: string
  quantity: number
  unitPrice?: number
  subtotal?: number
  observations?: string
}

export interface ComandaOrder {
  id: string
  orderNumber: string
  time: string
  date?: string
  isRetraso?: boolean
  customerName: string
  customerPhone?: string
  address?: string
  reference?: string
  orderType: string
  deliveryProvider?: string
  items: ComandaItem[]
  notes?: string
  paymentMethod: string
  paymentType: 'card' | 'cash' | 'app' | 'pending'
  isPaid: boolean
  totalAmount?: number
  serviceCharge?: number
  discount?: number
  bcvRate?: number
  elapsedMins: number
  status: 'new' | 'preparing' | 'ready' | 'delivered'
  deliveredTime?: string
  attendedBy?: string
}

const MOCK_COMANDAS: ComandaOrder[] = [
  // Nuevas
  {
    id: 'c-1',
    orderNumber: '#FC-000126',
    time: '12:48 PM',
    date: '24/05/2025',
    isRetraso: true,
    customerName: 'Juan Pérez',
    customerPhone: '987 654 321',
    address: 'Av. Los Próceres 1234, Dpto. 501',
    reference: 'Frente al parque',
    orderType: 'Delivery',
    items: [
      { id: 'i1', name: 'Arroz chaufa especial', quantity: 1, unitPrice: 28, subtotal: 28, observations: 'Sin cebollín' },
      { id: 'i2', name: 'Chow mein mixto', quantity: 1, unitPrice: 26, subtotal: 26, observations: 'Extra salsa' },
    ],
    notes: 'Por favor, llamar antes de salir.\nTimbre no funciona, llamar al celular.',
    paymentMethod: 'Pago: Tarjeta',
    paymentType: 'card',
    isPaid: true,
    totalAmount: 54,
    serviceCharge: 5.4,
    discount: 5,
    bcvRate: 36.5,
    elapsedMins: 32,
    status: 'new',
    attendedBy: 'Admin',
  },
  {
    id: 'c-2',
    orderNumber: '#FC-000127',
    time: '12:52 PM',
    date: '24/05/2025',
    customerName: 'María González',
    customerPhone: '987 123 456',
    orderType: 'Para llevar',
    items: [
      { id: 'i3', name: 'Lumpias (3 pzs)', quantity: 1, unitPrice: 15, subtotal: 15 },
      { id: 'i4', name: 'Pollo agridulce', quantity: 1, unitPrice: 25, subtotal: 25 },
    ],
    paymentMethod: 'Pago: Efectivo',
    paymentType: 'cash',
    isPaid: true,
    totalAmount: 40,
    serviceCharge: 0,
    discount: 0,
    bcvRate: 36.5,
    elapsedMins: 18,
    status: 'new',
  },
  {
    id: 'c-3',
    orderNumber: '#FC-000128',
    time: '12:55 PM',
    date: '24/05/2025',
    customerName: 'Uber Eats',
    customerPhone: '-',
    orderType: 'Delivery',
    items: [
      { id: 'i5', name: 'Camarones saltados', quantity: 1, unitPrice: 35, subtotal: 35 },
      { id: 'i6', name: 'Arroz chaufa especial', quantity: 1, unitPrice: 28, subtotal: 28 },
    ],
    paymentMethod: 'Pago: En app',
    paymentType: 'app',
    isPaid: true,
    totalAmount: 63,
    serviceCharge: 6.3,
    discount: 0,
    bcvRate: 36.5,
    elapsedMins: 15,
    status: 'new',
  },

  // En preparación
  {
    id: 'c-4',
    orderNumber: '#FC-000123',
    time: '12:30 PM',
    date: '24/05/2025',
    isRetraso: true,
    customerName: 'Pedro Ramírez',
    customerPhone: '987 654 321',
    address: 'Av. Los Próceres 1234, Dpto. 501\nUrb. Los Sauces, Lima 15038',
    reference: 'Frente al parque',
    orderType: 'Delivery',
    items: [
      { id: 'i7', name: 'Chow mein mixto', quantity: 1, unitPrice: 28, subtotal: 28, observations: 'sin cebollín' },
      { id: 'i8', name: 'Pollo agridulce', quantity: 1, unitPrice: 26, subtotal: 26, observations: 'extra salsa' },
      { id: 'i9', name: 'Refresco (1.5 L)', quantity: 2, unitPrice: 6, subtotal: 12, observations: '—' }
    ],
    notes: 'Por favor, llamar antes de salir.\nTimbre no funciona, llamar al celular.',
    paymentMethod: 'Pago combinado',
    paymentType: 'app',
    isPaid: true,
    totalAmount: 66,
    serviceCharge: 6.6,
    discount: 5,
    bcvRate: 36.5,
    elapsedMins: 36,
    status: 'preparing',
    attendedBy: 'Admin',
  },
  {
    id: 'c-5',
    orderNumber: '#FC-000124',
    time: '12:35 PM',
    date: '24/05/2025',
    customerName: 'Ana Torres',
    customerPhone: '912 345 678',
    orderType: 'Para llevar',
    items: [
      { id: 'i9', name: 'Lumpias (3 pzs)', quantity: 2, unitPrice: 15, subtotal: 30 },
      { id: 'i10', name: 'Arroz chaufa especial', quantity: 1, unitPrice: 28, subtotal: 28 },
    ],
    paymentMethod: 'Pago: Efectivo',
    paymentType: 'cash',
    isPaid: true,
    totalAmount: 58,
    serviceCharge: 0,
    discount: 0,
    bcvRate: 36.5,
    elapsedMins: 28,
    status: 'preparing',
  },
  {
    id: 'c-6',
    orderNumber: '#FC-000125',
    time: '12:45 PM',
    date: '24/05/2025',
    customerName: 'Rappi',
    customerPhone: '-',
    orderType: 'Delivery',
    items: [
      { id: 'i11', name: 'Camarones saltados', quantity: 1, unitPrice: 35, subtotal: 35 },
      { id: 'i12', name: 'Chow mein mixto', quantity: 1, unitPrice: 26, subtotal: 26 },
    ],
    paymentMethod: 'Pago: En app',
    paymentType: 'app',
    isPaid: true,
    totalAmount: 61,
    serviceCharge: 6.1,
    discount: 0,
    bcvRate: 36.5,
    elapsedMins: 22,
    status: 'preparing',
  },

  // Listas
  {
    id: 'c-7',
    orderNumber: '#FC-000121',
    time: '12:15 PM',
    date: '24/05/2025',
    customerName: 'Sofía Lima',
    customerPhone: '988 777 666',
    orderType: 'Para llevar',
    items: [
      { id: 'i13', name: 'Pollo agridulce', quantity: 1, unitPrice: 25, subtotal: 25 },
      { id: 'i14', name: 'Lumpias (3 pzs)', quantity: 1, unitPrice: 15, subtotal: 15 },
    ],
    paymentMethod: 'Pago: Efectivo',
    paymentType: 'cash',
    isPaid: true,
    totalAmount: 40,
    serviceCharge: 0,
    discount: 0,
    bcvRate: 36.5,
    elapsedMins: 8,
    status: 'ready',
  },
  {
    id: 'c-8',
    orderNumber: '#FC-000122',
    time: '12:18 PM',
    date: '24/05/2025',
    customerName: 'Uber Eats',
    customerPhone: '-',
    orderType: 'Delivery',
    items: [
      { id: 'i15', name: 'Arroz chaufa especial', quantity: 1, unitPrice: 28, subtotal: 28 },
      { id: 'i16', name: 'Camarones saltados', quantity: 1, unitPrice: 35, subtotal: 35 },
    ],
    paymentMethod: 'Pago: En app',
    paymentType: 'app',
    isPaid: true,
    totalAmount: 63,
    serviceCharge: 6.3,
    discount: 0,
    bcvRate: 36.5,
    elapsedMins: 6,
    status: 'ready',
  },
  {
    id: 'c-9',
    orderNumber: '#FC-000120',
    time: '12:10 PM',
    date: '24/05/2025',
    customerName: 'Marco Huamán',
    customerPhone: '999 888 777',
    orderType: 'Para llevar',
    items: [
      { id: 'i17', name: 'Chow mein mixto', quantity: 1, unitPrice: 26, subtotal: 26 },
      { id: 'i18', name: 'Pollo agridulce', quantity: 1, unitPrice: 25, subtotal: 25 },
    ],
    paymentMethod: 'Pago: Efectivo',
    paymentType: 'cash',
    isPaid: true,
    totalAmount: 51,
    serviceCharge: 0,
    discount: 0,
    bcvRate: 36.5,
    elapsedMins: 12,
    status: 'ready',
  },

  // Entregadas
  {
    id: 'c-10',
    orderNumber: '#FC-000119',
    time: '12:00 PM',
    date: '24/05/2025',
    customerName: 'Camila Rojas',
    customerPhone: '911 222 333',
    orderType: 'Delivery',
    items: [
      { id: 'i19', name: 'Lumpias (3 pzs)', quantity: 1, unitPrice: 15, subtotal: 15 },
      { id: 'i20', name: 'Arroz chaufa especial', quantity: 1, unitPrice: 28, subtotal: 28 },
    ],
    paymentMethod: 'Pago: Tarjeta',
    paymentType: 'card',
    isPaid: true,
    totalAmount: 43,
    serviceCharge: 4.3,
    discount: 0,
    bcvRate: 36.5,
    elapsedMins: 0,
    status: 'delivered',
    deliveredTime: '12:15 PM',
  },
  {
    id: 'c-11',
    orderNumber: '#FC-000118',
    time: '11:45 AM',
    date: '24/05/2025',
    customerName: 'Glovo',
    customerPhone: '-',
    orderType: 'Delivery',
    items: [
      { id: 'i21', name: 'Pollo agridulce', quantity: 1, unitPrice: 25, subtotal: 25 },
      { id: 'i22', name: 'Chow mein mixto', quantity: 1, unitPrice: 26, subtotal: 26 },
    ],
    paymentMethod: 'Pago: En app',
    paymentType: 'app',
    isPaid: true,
    totalAmount: 51,
    serviceCharge: 5.1,
    discount: 0,
    bcvRate: 36.5,
    elapsedMins: 0,
    status: 'delivered',
    deliveredTime: '11:58 AM',
  },
  {
    id: 'c-12',
    orderNumber: '#FC-000117',
    time: '11:30 AM',
    date: '24/05/2025',
    customerName: 'Luis Fernández',
    customerPhone: '922 333 444',
    orderType: 'Para llevar',
    items: [
      { id: 'i23', name: 'Camarones saltados', quantity: 1, unitPrice: 35, subtotal: 35 },
      { id: 'i24', name: 'Arroz chaufa especial', quantity: 1, unitPrice: 28, subtotal: 28 },
    ],
    paymentMethod: 'Pago: Efectivo',
    paymentType: 'cash',
    isPaid: true,
    totalAmount: 63,
    serviceCharge: 0,
    discount: 0,
    bcvRate: 36.5,
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
            else if (o.status === 'delivered' || o.status === 'completed') status = 'delivered'
            else if (o.status === 'paid') status = 'delivered'
            // 'new' and 'pending' stay as 'new'

            const hasPaid = o.status === 'paid' || o.status === 'delivered' || o.status === 'completed'

            return {
              id: o.id,
              orderNumber: `#FC-${String(o.orderNumber).padStart(6, '0')}`,
              time: date.toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit' }),
              date: date.toLocaleDateString('es-VE', { day: '2-digit', month: '2-digit', year: 'numeric' }),
              isRetraso: elapsed > 15 && status !== 'delivered',
              customerName: o.customerName || 'Cliente general',
              customerPhone: '0412-1234567', // Dummy until DB adds this
              address: o.orderType === 'delivery' ? 'Av. Principal, Edificio Central' : '',
              reference: o.orderType === 'delivery' ? 'Dejar en recepción' : '',
              orderType: o.orderType === 'takeaway' ? 'Para llevar' : o.orderType === 'delivery' ? 'Delivery' : o.orderType === 'dine-in' ? 'Mostrador' : 'Para llevar',
              items: o.items.map((item) => ({
                id: item.id,
                name: item.productName,
                quantity: item.quantity,
                unitPrice: item.unitPrice || 0,
                subtotal: (item.quantity || 0) * (item.unitPrice || 0),
                observations: '',
              })),
              notes: o.notes || '',
              paymentMethod: hasPaid ? 'Pago: Efectivo' : '⚠️ Sin pagar',
              paymentType: hasPaid ? 'cash' : 'pending' as const,
              isPaid: hasPaid,
              totalAmount: o.totalAmount || 0,
              serviceCharge: 0,
              discount: 0,
              bcvRate: o.bcvRate || 36.5,
              elapsedMins: elapsed < 0 ? 1 : elapsed,
              status,
              deliveredTime: status === 'delivered' ? date.toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit' }) : undefined,
              attendedBy: o.createdBy || 'Admin',
            }
          })
          setComandas([...mapped, ...MOCK_COMANDAS])
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

                        {!order.isPaid && order.status !== 'delivered' && (
                          <span className="badge-sin-pagar">💰 Pendiente de pago</span>
                        )}

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
        <div className="cmd-modal-overlay" onClick={() => setSelectedOrder(null)}>
          <div className="cmd-modal-container animate-pop" onClick={e => e.stopPropagation()}>
            <header className="cmd-modal-header">
              <div className="cmd-modal-title">
                <Clock size={18} className="cmd-icon-title" />
                <span>Detalle de comanda</span>
                <h2>{selectedOrder.orderNumber}</h2>
                <div className={`cmd-badge ${selectedOrder.status}`}>
                  {selectedOrder.status === 'new' && 'Nueva'}
                  {selectedOrder.status === 'preparing' && 'En preparación'}
                  {selectedOrder.status === 'ready' && 'Lista'}
                  {selectedOrder.status === 'delivered' && 'Entregada'}
                </div>
                {selectedOrder.isPaid ? (
                  <div className="cmd-badge paid">Pagado</div>
                ) : (
                  <div className="cmd-badge sin-pagar">⚠️ Sin cobrar</div>
                )}
                <div className="cmd-badge delivery">{selectedOrder.orderType}</div>
              </div>
              <button className="cmd-close-btn" onClick={() => setSelectedOrder(null)}><X size={20} /></button>
            </header>

            <div className="cmd-modal-meta">
              <div className="cmd-meta-item">
                <User size={14} className="cmd-meta-icon" />
                <div>
                  <span className="cmd-meta-label">Cliente</span>
                  <span className="cmd-meta-val">{selectedOrder.customerName}</span>
                </div>
              </div>
              <div className="cmd-meta-item">
                <Phone size={14} className="cmd-meta-icon" />
                <div>
                  <span className="cmd-meta-label">Teléfono</span>
                  <span className="cmd-meta-val">{selectedOrder.customerPhone || '-'}</span>
                </div>
              </div>
              <div className="cmd-meta-item">
                <Calendar size={14} className="cmd-meta-icon" />
                <div>
                  <span className="cmd-meta-label">Fecha</span>
                  <span className="cmd-meta-val">{selectedOrder.date || '24/05/2025'}</span>
                </div>
              </div>
              <div className="cmd-meta-item">
                <Clock size={14} className="cmd-meta-icon" />
                <div>
                  <span className="cmd-meta-label">Hora</span>
                  <span className="cmd-meta-val">{selectedOrder.time}</span>
                </div>
              </div>
              <div className="cmd-meta-item">
                <User size={14} className="cmd-meta-icon" />
                <div>
                  <span className="cmd-meta-label">Atendido por</span>
                  <span className="cmd-meta-val">{selectedOrder.attendedBy || 'Admin'}</span>
                </div>
              </div>
              <div className="cmd-meta-item">
                <Hash size={14} className="cmd-meta-icon" />
                <div>
                  <span className="cmd-meta-label">Nº de pedido</span>
                  <span className="cmd-meta-val">{selectedOrder.orderNumber.replace('#FC-', '')}</span>
                </div>
              </div>
              <div className="cmd-meta-item cmd-time-elapsed">
                <Clock size={14} className="cmd-meta-icon text-orange" />
                <div>
                  <span className="cmd-meta-label text-orange">Tiempo transcurrido</span>
                  <span className="cmd-meta-val text-orange font-bold">{selectedOrder.elapsedMins} min</span>
                </div>
              </div>
            </div>

            <div className="cmd-modal-body">
              <div className="cmd-col-left">
                {selectedOrder.orderType === 'Delivery' && (
                  <div className="cmd-section cmd-address-section">
                    <div className="cmd-section-title"><MapPin size={16} /> Dirección de entrega</div>
                    <div className="cmd-address-content">
                      <div className="cmd-address-text">
                        <p>{selectedOrder.address || 'Sin dirección registrada'}</p>
                        {selectedOrder.reference && <p className="cmd-reference">Referencia: {selectedOrder.reference}</p>}
                      </div>
                      <div className="cmd-map-placeholder">
                        <MapPin size={24} className="cmd-map-icon" />
                      </div>
                    </div>
                  </div>
                )}

                <div className="cmd-section">
                  <div className="cmd-section-title"><ShoppingBag size={16} /> Producción del pedido</div>
                  <table className="cmd-items-table">
                    <thead>
                      <tr>
                        <th>Producto</th>
                        <th>Observaciones / Extras</th>
                        <th>Cant.</th>
                        <th>P. Unit.</th>
                        <th>Subtotal</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedOrder.items.map(item => (
                        <tr key={item.id}>
                          <td>
                            <div className="cmd-product-cell">
                              <div className="cmd-product-img">🍔</div>
                              <span>{item.name}</span>
                            </div>
                          </td>
                          <td className="cmd-obs">{item.observations || '—'}</td>
                          <td>x{item.quantity}</td>
                          <td>${(item.unitPrice || 0).toFixed(2)}</td>
                          <td>${(item.subtotal || 0).toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="cmd-section cmd-notes-section">
                  <div className="cmd-section-title"><FileText size={16} /> Notas del pedido</div>
                  <div className="cmd-notes-content">
                    {selectedOrder.notes ? selectedOrder.notes.split('\n').map((line, i) => <p key={i}>{line}</p>) : <p>Sin notas adicionales.</p>}
                  </div>
                </div>
              </div>

              <div className="cmd-col-right">
                <div className="cmd-section cmd-payment-section">
                  <div className="cmd-section-title"><CreditCard size={16} /> Resumen de pago</div>
                  
                  <div className="cmd-summary-row">
                    <span>Subtotal</span>
                    <span>${(selectedOrder.totalAmount! - (selectedOrder.serviceCharge || 0) + (selectedOrder.discount || 0)).toFixed(2)}</span>
                  </div>
                  {(selectedOrder.serviceCharge || 0) > 0 && (
                    <div className="cmd-summary-row">
                      <span>Cargo por servicio (10%)</span>
                      <span>${selectedOrder.serviceCharge?.toFixed(2)}</span>
                    </div>
                  )}
                  {(selectedOrder.discount || 0) > 0 && (
                    <div className="cmd-summary-row cmd-discount">
                      <span>Descuento</span>
                      <span>- ${selectedOrder.discount?.toFixed(2)}</span>
                    </div>
                  )}
                  
                  <div className="cmd-summary-total">
                    <span>TOTAL</span>
                    <div className="cmd-total-amounts">
                      <span className="cmd-total-usd">${selectedOrder.totalAmount?.toFixed(2) || '0.00'}</span>
                      <span className="cmd-total-bs">(Bs. {((selectedOrder.totalAmount || 0) * (selectedOrder.bcvRate || 36.5)).toFixed(2)})</span>
                    </div>
                  </div>

                  <div className="cmd-payment-method-row">
                    <span className="cmd-method-label">Método de pago</span>
                    <span className="cmd-method-badge">{selectedOrder.isPaid ? selectedOrder.paymentMethod : '⚠️ Sin cobrar'}</span>
                  </div>

                  <div className="cmd-breakdown-section">
                    <div className="cmd-summary-row cmd-breakdown-title">Desglose del pago</div>
                    {selectedOrder.isPaid ? (
                      <div className="cmd-summary-row cmd-breakdown-item">
                        <span className="cmd-paid-green">Pagado ({selectedOrder.paymentMethod})</span>
                        <span>${selectedOrder.totalAmount?.toFixed(2)}</span>
                      </div>
                    ) : (
                      <div className="cmd-summary-row cmd-breakdown-item">
                        <span className="cmd-paid-yellow">⚠️ Pendiente de cobro</span>
                        <span className="cmd-paid-yellow">${selectedOrder.totalAmount?.toFixed(2)}</span>
                      </div>
                    )}
                  </div>

                  <div className="cmd-summary-row cmd-total-paid">
                    <span>Total pagado</span>
                    <span className={selectedOrder.isPaid ? 'cmd-paid-green' : ''}>${selectedOrder.isPaid ? selectedOrder.totalAmount?.toFixed(2) : '0.00'}</span>
                  </div>
                  <div className="cmd-summary-row cmd-balance">
                    <span>Saldo restante</span>
                    <span className={!selectedOrder.isPaid ? 'cmd-paid-yellow' : 'cmd-paid-green'}>${selectedOrder.isPaid ? '0.00' : selectedOrder.totalAmount?.toFixed(2)}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="cmd-modal-timeline">
              <div className="cmd-timeline-header">
                <Clock size={14} className="cmd-tl-icon"/> Progreso del pedido
              </div>
              <div className="cmd-timeline-steps">
                <div className={`cmd-step ${['new', 'preparing', 'ready', 'delivered'].includes(selectedOrder.status) ? 'active' : ''}`}>
                  <div className="cmd-step-icon"><FileText size={16} /></div>
                  <div className="cmd-step-info">
                    <span className="cmd-step-name">Nueva</span>
                    <span className="cmd-step-time">{selectedOrder.time}</span>
                  </div>
                </div>
                <div className={`cmd-timeline-line ${['preparing', 'ready', 'delivered'].includes(selectedOrder.status) ? 'active' : ''}`}></div>
                <div className={`cmd-step ${['preparing', 'ready', 'delivered'].includes(selectedOrder.status) ? 'active' : ''}`}>
                  <div className="cmd-step-icon"><Clock size={16} /></div>
                  <div className="cmd-step-info">
                    <span className="cmd-step-name">En preparación</span>
                    <span className="cmd-step-time">{['preparing', 'ready', 'delivered'].includes(selectedOrder.status) ? selectedOrder.time : '—'}</span>
                  </div>
                </div>
                <div className={`cmd-timeline-line ${['ready', 'delivered'].includes(selectedOrder.status) ? 'active' : ''}`}></div>
                <div className={`cmd-step ${['ready', 'delivered'].includes(selectedOrder.status) ? 'active' : ''}`}>
                  <div className="cmd-step-icon"><CheckCircle size={16} /></div>
                  <div className="cmd-step-info">
                    <span className="cmd-step-name">Lista</span>
                    <span className="cmd-step-time">{['ready', 'delivered'].includes(selectedOrder.status) ? '—' : '—'}</span>
                  </div>
                </div>
                <div className={`cmd-timeline-line ${['delivered'].includes(selectedOrder.status) ? 'active' : ''}`}></div>
                <div className={`cmd-step ${['delivered'].includes(selectedOrder.status) ? 'active' : ''}`}>
                  <div className="cmd-step-icon"><Truck size={16} /></div>
                  <div className="cmd-step-info">
                    <span className="cmd-step-name">Entregada</span>
                    <span className="cmd-step-time">{selectedOrder.status === 'delivered' ? (selectedOrder.deliveredTime || '—') : '—'}</span>
                  </div>
                </div>
              </div>
            </div>

            <footer className="cmd-modal-footer">
              <div className="cmd-footer-left">
                <button className="cmd-btn-outline"><Edit3 size={16} /> Editar pedido</button>
                <button className="cmd-btn-outline" onClick={() => window.print()}><Printer size={16} /> Imprimir comanda</button>
              </div>
              <div className="cmd-footer-right">
                {!selectedOrder.isPaid && (
                  <button
                    className="cmd-btn-cobrar"
                    onClick={() => {
                      setSelectedOrder(null)
                      navigate('/caja')
                    }}
                  >
                    💲 Cobrar pedido
                  </button>
                )}
                <button
                  className="cmd-btn-primary"
                  onClick={() => {
                    handleAdvanceStatus(selectedOrder.id, selectedOrder.status)
                    setSelectedOrder(null)
                  }}
                >
                  <CheckCircle size={16} /> Marcar como {selectedOrder.status === 'new' ? 'preparación' : selectedOrder.status === 'preparing' ? 'lista' : 'entregada'}
                </button>
                <button className="cmd-btn-secondary" onClick={() => setSelectedOrder(null)}>Cerrar</button>
              </div>
            </footer>
          </div>
        </div>
      )}
    </div>
  )
}
