import { useState, useMemo, useEffect, useCallback } from 'react'
import { getOrdersWithItems, updateOrderStatus, type FullOrder } from '../lib/dataService'
import './Cocina.css'

type StationFilter = 'all' | 'wok' | 'fryer' | 'prep'

const STATIONS = [
  { key: 'all', label: 'Todas las Estaciones', icon: '🍳' },
  { key: 'wok', label: 'Arroz & Wok', icon: '🥘' },
  { key: 'fryer', label: 'Freidora & Lumpias', icon: '🥢' },
  { key: 'prep', label: 'Salsas & Empaque', icon: '📦' },
]

// Cache a nivel de módulo: al volver a Cocina se muestran las órdenes de la
// última visita al instante, sin el parpadeo de "Cargando...", mientras se
// refrescan en segundo plano.
let cocinaCache: FullOrder[] | null = null

export function Cocina() {
  const [orders, setOrders] = useState<FullOrder[]>(cocinaCache ?? [])
  const [, setLoading] = useState(!cocinaCache)
  const [stationFilter, setStationFilter] = useState<StationFilter>('all')
  const [soundEnabled, setSoundEnabled] = useState(true)
  const [updatingId, setUpdatingId] = useState<string | null>(null)

  const fetchOrders = useCallback(async () => {
    try {
      const today = new Date().toISOString().split('T')[0]
      const data = await getOrdersWithItems(today + 'T00:00:00', today + 'T23:59:59')
      const active = data.filter(o => ['open', 'confirmed', 'preparing', 'ready'].includes(o.status))
      setOrders(active)
      cocinaCache = active
    } catch (e) {
      console.error('Error cargando órdenes:', e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchOrders()
    const interval = setInterval(fetchOrders, 15000)
    return () => clearInterval(interval)
  }, [fetchOrders])

  const activeOrders = useMemo(() => {
    return orders.filter(o => o.status === 'open' || o.status === 'confirmed' || o.status === 'preparing')
  }, [orders])

  const getElapsedTime = (createdAt: string) => {
    const minutes = Math.floor((Date.now() - new Date(createdAt).getTime()) / 60000)
    return minutes
  }

  const getTimerBadge = (minutes: number) => {
    if (minutes >= 15) return { text: `${minutes} MIN - RETRASADO`, class: 'kds-timer-urgent' }
    if (minutes >= 10) return { text: `${minutes} MIN - ALERTA`, class: 'kds-timer-warning' }
    return { text: `${minutes} MIN`, class: 'kds-timer-normal' }
  }

  const handleStatusChange = async (orderId: string, newStatus: string) => {
    setUpdatingId(orderId)
    try {
      await updateOrderStatus(orderId, newStatus)
      setOrders(prev => prev.map(o =>
        o.id === orderId ? { ...o, status: newStatus } : o
      ))
    } catch (e) {
      console.error('Error actualizando estado:', e)
    } finally {
      setUpdatingId(null)
    }
  }

  return (
    <div className="kds-page animate-fade-in">
      <header className="kds-header">
        <div className="kds-header-title">
          <h1>🍳 KDS - Pantalla de Cocina</h1>
          <span className="kds-live-badge">🔴 EN VIVO</span>
        </div>

        <div className="kds-header-actions">
          <div className="station-filters">
            {STATIONS.map(st => (
              <button
                key={st.key}
                className={`kds-btn-station ${stationFilter === st.key ? 'active' : ''}`}
                onClick={() => setStationFilter(st.key as StationFilter)}
              >
                {st.icon} {st.label}
              </button>
            ))}
          </div>

          <button
            className={`kds-btn-sound ${soundEnabled ? 'active' : ''}`}
            onClick={() => setSoundEnabled(!soundEnabled)}
            title="Toggle alerta de sonido"
          >
            {soundEnabled ? '🔔 Alertas ON' : '🔕 Alertas OFF'}
          </button>
        </div>
      </header>

      <main className="kds-grid">
        {activeOrders.length === 0 ? (
          <div className="kds-empty-state">
            <span className="kds-empty-icon">✨</span>
            <h2>¡Sin comandas pendientes!</h2>
            <p>La cocina está al día con todos los pedidos.</p>
          </div>
        ) : (
          activeOrders.map(order => {
            const elapsedMins = getElapsedTime(order.createdAt)
            const timerInfo = getTimerBadge(elapsedMins)

            return (
              <div key={order.id} className={`kds-card ${order.status === 'preparing' ? 'in-prep' : 'new-order'}`}>
                <div className="kds-card-header">
                  <div className="kds-order-info">
                    <span className="kds-order-id">#{String(order.orderNumber).padStart(4, '0')}</span>
                    <span className="kds-order-time">
                      {new Date(order.createdAt).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <span className={`kds-timer ${timerInfo.class}`}>{timerInfo.text}</span>
                </div>

                <div className="kds-card-body">
                  <ul className="kds-items-list">
                    {order.items.map((item) => (
                      <li key={item.id} className="kds-item">
                        <span className="kds-item-qty">{item.quantity}</span>
                        <span className="kds-item-name">{item.emoji} {item.productName}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="kds-card-footer">
                  {order.status === 'open' || order.status === 'confirmed' ? (
                    <button
                      className="kds-btn-action kds-btn-start"
                      onClick={() => handleStatusChange(order.id, 'preparing')}
                      disabled={updatingId === order.id}
                    >
                      {updatingId === order.id ? '⏳...' : '👨‍🍳 EMPEZAR A PREPARAR'}
                    </button>
                  ) : order.status === 'preparing' ? (
                    <button
                      className="kds-btn-action kds-btn-finish"
                      onClick={() => handleStatusChange(order.id, 'ready')}
                      disabled={updatingId === order.id}
                    >
                      {updatingId === order.id ? '⏳...' : '✅ LISTO PARA ENTREGAR'}
                    </button>
                  ) : null}
                </div>
              </div>
            )
          })
        )}
      </main>
    </div>
  )
}
