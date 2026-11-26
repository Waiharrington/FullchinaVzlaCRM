import { useState, useMemo, useEffect, useCallback, useRef } from 'react'
import { getOrdersWithItems, updateOrderStatus, type FullOrder } from '../lib/dataService'
import { dayRangeInTimeZone } from '../lib/money'
import './Cocina.css'
import { formatProductTitle } from '../lib/textFormat'
import { ChefHat, CookingPot, Utensils, Package, Bell, BellOff, Sparkles, Loader2, CheckCircle2 } from 'lucide-react'
import { PageSkeleton } from '../components/PageSkeleton'
import { useLiveDataRefresh } from '../lib/liveDataRefresh'

type StationFilter = 'all' | 'wok' | 'fryer' | 'prep'

const STATIONS = [
  { key: 'all', label: 'Todas', icon: <ChefHat size={16} /> },
  { key: 'wok', label: 'Arroz y wok', icon: <CookingPot size={16} /> },
  { key: 'fryer', label: 'Freidora', icon: <Utensils size={16} /> },
  { key: 'prep', label: 'Empaque', icon: <Package size={16} /> },
]

// Cache a nivel de módulo: al volver a Cocina se muestran las órdenes de la
// última visita al instante, sin el parpadeo de "Cargando...", mientras se
// refrescan en segundo plano.
let cocinaCache: FullOrder[] | null = null

export function Cocina() {
  const [orders, setOrders] = useState<FullOrder[]>(cocinaCache ?? [])
  const [loading, setLoading] = useState(!cocinaCache)
  const [stationFilter, setStationFilter] = useState<StationFilter>('all')
  const [soundEnabled, setSoundEnabled] = useState(true)
  const [updatingId, setUpdatingId] = useState<string | null>(null)
  const latestFetchRef = useRef(0)

  const fetchOrders = useCallback(async (silent = false) => {
    const fetchId = ++latestFetchRef.current
    try {
      const { start, end } = dayRangeInTimeZone()
      const data = await getOrdersWithItems(start, end)
      if (fetchId !== latestFetchRef.current) return
      const active = data.filter(o => ['new', 'preparing', 'ready'].includes(o.fulfillmentStatus))
      setOrders(active)
      cocinaCache = active
    } catch (e) {
      if (fetchId === latestFetchRef.current) console.error('Error cargando órdenes:', e)
    } finally {
      if (fetchId === latestFetchRef.current && !silent) setLoading(false)
    }
  }, [])

  useEffect(() => {
    void fetchOrders()
  }, [fetchOrders])
  useLiveDataRefresh('cocina', () => fetchOrders(true))

  const activeOrders = useMemo(() => {
    return orders.filter(o => o.fulfillmentStatus === 'new' || o.fulfillmentStatus === 'preparing')
  }, [orders])

  const getElapsedTime = (createdAt: string) => {
    const minutes = Math.floor((Date.now() - new Date(createdAt).getTime()) / 60000)
    return minutes
  }

  const getTimerBadge = (minutes: number) => {
    if (minutes >= 15) return { text: `${minutes} min · Retrasado`, class: 'kds-timer-urgent' }
    if (minutes >= 10) return { text: `${minutes} min · Atención`, class: 'kds-timer-warning' }
    return { text: `${minutes} min`, class: 'kds-timer-normal' }
  }

  const handleStatusChange = async (orderId: string, newStatus: FullOrder['fulfillmentStatus']) => {
    const previous = orders.find(order => order.id === orderId)
    if (!previous || updatingId) return
    setUpdatingId(orderId)
    setOrders(current => {
      const next = current.map(order =>
        order.id === orderId ? { ...order, fulfillmentStatus: newStatus } : order
      )
      cocinaCache = next
      return next
    })
    try {
      await updateOrderStatus(orderId, newStatus)
    } catch (e) {
      console.error('Error actualizando estado:', e)
      // Read the server's latest state instead of blindly rolling back; another
      // device may have made a newer status change while this write was pending.
      await fetchOrders(true)
    } finally {
      setUpdatingId(null)
    }
  }

  if (loading) return <PageSkeleton cards={0} rows={6} hasTable={false} />

  return (
    <div className="kds-page animate-fade-in">
      <header className="kds-header">
        <div className="kds-header-title">
          <h1 className="page-title"><ChefHat size={22} className="page-title-icon" /> Cocina</h1>
          <span className="kds-live-badge"><span className="kds-live-dot" /> EN VIVO</span>
          <button
            className={`kds-btn-sound ${soundEnabled ? 'active' : ''}`}
            onClick={() => setSoundEnabled(!soundEnabled)}
            aria-pressed={soundEnabled}
            title={soundEnabled ? 'Avisos activados' : 'Avisos apagados'}
          >
            {soundEnabled ? <><Bell size={14} /> Avisos</> : <><BellOff size={14} /> Sin avisos</>}
          </button>
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
        </div>
      </header>

      <main className="kds-grid">
        {activeOrders.length === 0 ? (
          <div className="kds-empty-state">
            <span className="kds-empty-icon"><Sparkles size={40} /></span>
            <h2>¡Sin comandas pendientes!</h2>
            <p>La cocina está al día con todos los pedidos.</p>
          </div>
        ) : (
          activeOrders.map(order => {
            const elapsedMins = getElapsedTime(order.createdAt)
            const timerInfo = getTimerBadge(elapsedMins)

            return (
              <div key={order.id} className={`kds-card ${order.fulfillmentStatus === 'preparing' ? 'in-prep' : 'new-order'}`}>
                <div className="kds-card-header">
                  <div className="kds-order-info">
                    <span className="kds-order-id">#{String(order.orderNumber).padStart(4, '0')}</span>
                    <span className="kds-order-time">
                      {new Date(order.createdAt).toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit', hour12: true })}
                    </span>
                  </div>
                  <span className="kds-status">{order.fulfillmentStatus === 'preparing' ? 'Preparando' : 'Nueva'}</span>
                  <span className={`kds-timer ${timerInfo.class}`}>{timerInfo.text}</span>
                </div>

                <div className="kds-card-body">
                  <ul className="kds-items-list">
                    {order.items.map((item) => (
                      <li key={item.id} className="kds-item">
                        <span className="kds-item-qty">{item.quantity}</span>
                        <span className="kds-item-name">{formatProductTitle(item.productName)}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="kds-card-footer">
                  {order.fulfillmentStatus === 'new' ? (
                    <button
                      className="kds-btn-action kds-btn-start"
                      onClick={() => handleStatusChange(order.id, 'preparing')}
                      disabled={updatingId === order.id}
                    >
                      {updatingId === order.id ? <><Loader2 size={14} className="spin" />...</> : <><ChefHat size={14} /> EMPEZAR A PREPARAR</>}
                    </button>
                  ) : order.fulfillmentStatus === 'preparing' ? (
                    <button
                      className="kds-btn-action kds-btn-finish"
                      onClick={() => handleStatusChange(order.id, 'ready')}
                      disabled={updatingId === order.id}
                    >
                      {updatingId === order.id ? <><Loader2 size={14} className="spin" />...</> : <><CheckCircle2 size={14} /> LISTO PARA ENTREGAR</>}
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
