import { useState, useMemo } from 'react'
import { useDemoData } from '../context/demo-data-context'
import type { Order } from '../lib/demoData'
import './Comandas.css'

type ViewMode = 'kanban' | 'list'
type StatusFilter = 'all' | Order['status']

const STATUSES: { key: Order['status']; label: string; icon: string; color: string }[] = [
  { key: 'pending', label: 'Nueva', icon: '🆕', color: '#3b82f6' },
  { key: 'paid', label: 'En Preparación', icon: '👨‍🍳', color: '#f59e0b' },
  { key: 'cancelled', label: 'Cancelada', icon: '❌', color: '#ef4444' },
]

export function Comandas() {
  const { orders, updateOrderStatus } = useDemoData()
  const [viewMode, setViewMode] = useState<ViewMode>('kanban')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null)

  const filteredOrders = useMemo(() => {
    return orders.filter(order => {
      const matchesStatus = statusFilter === 'all' || order.status === statusFilter
      const matchesSearch =
        order.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
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

  const getTimerClass = (createdAt: string, status: Order['status']) => {
    if (status === 'cancelled') return 'timer-normal'
    const minutes = Math.floor((Date.now() - new Date(createdAt).getTime()) / 60000)
    if (minutes >= 15) return 'timer-urgent'
    if (minutes >= 10) return 'timer-warning'
    return 'timer-normal'
  }

  return (
    <div className="page animate-fade-in">
      <header className="page-header">
        <div>
          <h1 className="page-title text-gradient">Gestión de Comandas</h1>
          <p className="page-subtitle">Monitoreo y flujo de producción en tiempo real</p>
        </div>
        <div className="header-actions">
          <div className="view-toggle">
            <button
              className={`toggle-btn ${viewMode === 'kanban' ? 'active' : ''}`}
              onClick={() => setViewMode('kanban')}
            >
              📋 Kanban
            </button>
            <button
              className={`toggle-btn ${viewMode === 'list' ? 'active' : ''}`}
              onClick={() => setViewMode('list')}
            >
              📄 Lista
            </button>
          </div>
        </div>
      </header>

      <div className="comandas-toolbar">
        <div className="search-box">
          <span className="search-icon">🔍</span>
          <input
            type="text"
            className="search-input"
            placeholder="Buscar por ID de orden o producto..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
        </div>

        <div className="filter-chips">
          <button
            className={`chip ${statusFilter === 'all' ? 'active' : ''}`}
            onClick={() => setStatusFilter('all')}
          >
            Todas ({orders.length})
          </button>
          {STATUSES.map(st => {
            const count = orders.filter(o => o.status === st.key).length
            return (
              <button
                key={st.key}
                className={`chip ${statusFilter === st.key ? 'active' : ''}`}
                onClick={() => setStatusFilter(st.key)}
              >
                {st.icon} {st.label} ({count})
              </button>
            )
          })}
        </div>
      </div>

      {viewMode === 'kanban' ? (
        <div className="kanban-board">
          {STATUSES.map(st => {
            const colOrders = filteredOrders.filter(o => o.status === st.key)
            return (
              <div key={st.key} className="kanban-col">
                <div className="kanban-col-header" style={{ borderColor: st.color }}>
                  <span className="col-title">
                    {st.icon} {st.label}
                  </span>
                  <span className="col-count">{colOrders.length}</span>
                </div>

                <div className="kanban-col-body">
                  {colOrders.length === 0 ? (
                    <div className="empty-col">Sin comandas</div>
                  ) : (
                    colOrders.map(order => (
                      <div
                        key={order.id}
                        className="comanda-card"
                        onClick={() => setSelectedOrder(order)}
                      >
                        <div className="comanda-card-header">
                          <span className="order-badge">{order.id}</span>
                          <span className={`timer-badge ${getTimerClass(order.createdAt, order.status)}`}>
                            ⏱️ {getElapsedTime(order.createdAt)}
                          </span>
                        </div>

                        <div className="comanda-items-preview">
                          {order.items.map((item, idx) => (
                            <div key={`${item.productId}-${idx}`} className="item-row">
                              <span className="item-qty">{item.quantity}x</span>
                              <span className="item-name">{item.productName}</span>
                            </div>
                          ))}
                        </div>

                        <div className="comanda-card-footer">
                          <span className="comanda-total">${order.total.toFixed(2)}</span>
                          <div className="status-actions">
                            {order.status === 'pending' && (
                              <button
                                className="btn-status btn-prep"
                                onClick={e => {
                                  e.stopPropagation()
                                  updateOrderStatus(order.id, 'paid')
                                }}
                              >
                                👨‍🍳 Preparar
                              </button>
                            )}
                            {order.status === 'paid' && (
                              <button
                                className="btn-status btn-ready"
                                onClick={e => {
                                  e.stopPropagation()
                                  updateOrderStatus(order.id, 'cancelled')
                                }}
                              >
                                ❌ Anular
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        <div className="card table-card">
          <table className="data-table">
            <thead>
              <tr>
                <th>Orden</th>
                <th>Tiempo</th>
                <th>Productos</th>
                <th>Estado</th>
                <th>Método de Pago</th>
                <th>Total</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-4">
                    No se encontraron comandas
                  </td>
                </tr>
              ) : (
                filteredOrders.map(order => (
                  <tr key={order.id} onClick={() => setSelectedOrder(order)} className="clickable-row">
                    <td>
                      <strong>{order.id}</strong>
                    </td>
                    <td>
                      <span className={`timer-badge ${getTimerClass(order.createdAt, order.status)}`}>
                        {getElapsedTime(order.createdAt)}
                      </span>
                    </td>
                    <td>
                      {order.items.map(i => `${i.quantity}x ${i.productName}`).join(', ')}
                    </td>
                    <td>
                      <span className={`badge status-badge-${order.status}`}>
                        {STATUSES.find(s => s.key === order.status)?.icon} {STATUSES.find(s => s.key === order.status)?.label}
                      </span>
                    </td>
                    <td className="text-capitalize">{order.paymentMethod || 'Pendiente'}</td>
                    <td>
                      <strong>${order.total.toFixed(2)}</strong>
                    </td>
                    <td>
                      <button
                        className="btn-sm btn-outline"
                        onClick={e => {
                          e.stopPropagation()
                          setSelectedOrder(order)
                        }}
                      >
                        👁️ Ver
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {selectedOrder && (
        <div className="modal-overlay" onClick={() => setSelectedOrder(null)}>
          <div className="modal-content animate-pop" onClick={e => e.stopPropagation()}>
            <header className="modal-header">
              <h2>Detalle de Comanda {selectedOrder.id}</h2>
              <button className="modal-close" onClick={() => setSelectedOrder(null)}>
                ✕
              </button>
            </header>
            <div className="modal-body">
              <div className="order-detail-meta">
                <p>
                  <strong>Creación:</strong> {new Date(selectedOrder.createdAt).toLocaleString('es')}
                </p>
                <p>
                  <strong>Estado:</strong> {STATUSES.find(s => s.key === selectedOrder.status)?.label}
                </p>
                <p>
                  <strong>Método de pago:</strong> {selectedOrder.paymentMethod || 'Pendiente'}
                </p>
              </div>

              <h3>Ítems del Pedido</h3>
              <div className="detail-items-list">
                {selectedOrder.items.map((item, idx) => (
                  <div key={`${item.productId}-${idx}`} className="detail-item-row">
                    <span>
                      {item.quantity}x {item.productName}
                    </span>
                    <span>${(item.price * item.quantity).toFixed(2)}</span>
                  </div>
                ))}
              </div>

              <div className="detail-total-row">
                <span>Total:</span>
                <span>${selectedOrder.total.toFixed(2)}</span>
              </div>
            </div>
            <footer className="modal-footer">
              <button className="btn-accent" onClick={() => window.print()}>
                🖨️ Imprimir Ticket
              </button>
              <button className="btn-outline" onClick={() => setSelectedOrder(null)}>
                Cerrar
              </button>
            </footer>
          </div>
        </div>
      )}
    </div>
  )
}
