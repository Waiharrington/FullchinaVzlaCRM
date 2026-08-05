import { useState, useMemo } from 'react'
import { useDemoData } from '../context/demo-data-context'
import './Cocina.css'

type StationFilter = 'all' | 'wok' | 'fryer' | 'prep'

const STATIONS = [
  { key: 'all', label: 'Todas las Estaciones', icon: '🍳' },
  { key: 'wok', label: 'Arroz & Wok', icon: '🥘' },
  { key: 'fryer', label: 'Freidora & Lumpias', icon: '🥢' },
  { key: 'prep', label: 'Salsas & Empaque', icon: '📦' },
]

export function Cocina() {
  const { orders, updateOrderStatus } = useDemoData()
  const [stationFilter, setStationFilter] = useState<StationFilter>('all')
  const [soundEnabled, setSoundEnabled] = useState(true)

  const activeOrders = useMemo(() => {
    return orders.filter(o => o.status === 'pending' || o.status === 'paid')
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
              <div key={order.id} className={`kds-card ${order.status === 'paid' ? 'in-prep' : 'new-order'}`}>
                <div className="kds-card-header">
                  <div className="kds-order-info">
                    <span className="kds-order-id">{order.id}</span>
                    <span className="kds-order-time">
                      {new Date(order.createdAt).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <span className={`kds-timer ${timerInfo.class}`}>{timerInfo.text}</span>
                </div>

                <div className="kds-card-body">
                  <ul className="kds-items-list">
                    {order.items.map((item, idx) => (
                      <li key={`${item.productId}-${idx}`} className="kds-item">
                        <span className="kds-item-qty">{item.quantity}</span>
                        <span className="kds-item-name">{item.productName}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="kds-card-footer">
                  {order.status === 'pending' ? (
                    <button
                      className="kds-btn-action kds-btn-start"
                      onClick={() => updateOrderStatus(order.id, 'paid')}
                    >
                      👨‍🍳 EMPEZAR A PREPARAR
                    </button>
                  ) : (
                    <button
                      className="kds-btn-action kds-btn-finish"
                      onClick={() => updateOrderStatus(order.id, 'paid')}
                    >
                      ✅ LISTO PARA ENTREGAR
                    </button>
                  )}
                </div>
              </div>
            )
          })
        )}
      </main>
    </div>
  )
}
