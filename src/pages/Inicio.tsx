import { useMemo, useEffect, useState, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { useRates } from '../context/rates-context'
import { useAuth } from '../context/auth-context'
import { MoneyWithBcv } from '../components/MoneyWithBcv'
import { useSearch } from '../context/search-context'
import { StyledSelect } from '../components/StyledSelect'
import { DashboardQuickAccess, type DashboardShortcut } from '../components/DashboardQuickAccess'
import { canAccessModule } from '../components/navItems'
import { dateKeyInTimeZone, formatRateDate, formatVes } from '../lib/money'
import { formatProductTitle, formatSpanishText } from '../lib/textFormat'
import { getTodayStats, getOrdersWithItems, getDailySales, getProductRanking, getCredits, getPaymentMethodSales, getProductionStats, getIngredients, isPersonalAccountOrder, type TodayStats, type FullOrder, type DailySales, type ProductRanking, type Credit, type PaymentMethodSales, type ProductionStats, type Ingredient } from '../lib/dataService'
import { useLiveDataRefresh } from '../lib/liveDataRefresh'
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, BarElement, ArcElement, Title, Tooltip, Legend, Filler } from 'chart.js'
import { Line, Doughnut } from 'react-chartjs-2'
import {
  Flame,
  Bell,
  Search,
  RefreshCw,
  TrendingUp,
  DollarSign,
  ClipboardList,
  CreditCard,
  AlertTriangle,
  UtensilsCrossed,
  X,
  CheckCheck,
  Trash2,
  ExternalLink
} from 'lucide-react'
import Toast from '../components/Toast'
import { PageSkeleton } from '../components/PageSkeleton'
import './Inicio.css'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, ArcElement, Title, Tooltip, Legend, Filler)

// Cache a nivel de módulo: al volver al Dashboard se muestran los datos de
// la última visita al instante, sin el parpadeo de "Cargando...", mientras
// se refrescan en segundo plano.
type DashboardCache = {
  stats: TodayStats | null
  todayOrders: FullOrder[]
  dailySales: DailySales[]
  productRanking: ProductRanking[]
  credits: Credit[]
  paymentMethods: PaymentMethodSales[]
  productionStats: ProductionStats | null
}
let inicioCache: DashboardCache | null = null
let inicioCacheOwner: string | null = null
const DASHBOARD_CACHE_KEY = 'fullchina-dashboard-cache-v1'
const DASHBOARD_CACHE_MAX_AGE_MS = 5 * 60 * 1000

function readDashboardCache(ownerId: string | undefined) {
  const owner = ownerId ?? 'anonymous'
  if (inicioCacheOwner && inicioCacheOwner !== owner) inicioCache = null
  inicioCacheOwner = owner
  if (inicioCache) return inicioCache
  try {
    const stored = localStorage.getItem(DASHBOARD_CACHE_KEY)
    if (!stored) return null
    const parsed = JSON.parse(stored) as { owner?: string; savedAt?: number; data?: DashboardCache }
    if (parsed.owner !== owner || !parsed.data || !parsed.savedAt || Date.now() - parsed.savedAt > DASHBOARD_CACHE_MAX_AGE_MS) return null
    inicioCache = parsed.data
    return inicioCache
  } catch {
    return null
  }
}

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  cash: 'Efectivo', card: 'Tarjeta / Punto', mobile: 'Pago móvil',
  transfer: 'Transferencia', binance: 'Binance', zelle: 'Zelle', other: 'Otro',
}
const PAYMENT_COLORS = ['#ef4444', '#f59e0b', '#fbbf24', '#3b82f6', '#a855f7', '#10b981', '#8b5cf6']

function optimizedDashboardProductImage(imageUrl: string | null) {
  if (!imageUrl) return null
  const match = imageUrl.match(/^\/productos\/([^/?#]+)\.(?:png|jpe?g|webp)([?#].*)?$/i)
  return match ? `/optimized/productos/${match[1]}.webp${match[2] || ''}` : imageUrl
}

export function Inicio() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const initialCache = readDashboardCache(user?.id)
  const { open: openSearch } = useSearch()
  const { bcvRate, updatedAt: bcvUpdatedAt, stale: bcvStale, loading: bcvLoading, refresh: refreshBcv } = useRates()
  const [stats, setStats] = useState<TodayStats | null>(initialCache?.stats ?? null)
  const [todayOrders, setTodayOrders] = useState<FullOrder[]>(initialCache?.todayOrders ?? [])
  const [dailySales, setDailySales] = useState<DailySales[]>(initialCache?.dailySales ?? [])
  const [productRanking, setProductRanking] = useState<ProductRanking[]>(initialCache?.productRanking ?? [])
  const [credits, setCredits] = useState<Credit[]>(initialCache?.credits ?? [])
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethodSales[]>(initialCache?.paymentMethods ?? [])
  const [productionStats, setProductionStats] = useState<ProductionStats | null>(initialCache?.productionStats ?? null)
  const [ingredients, setIngredients] = useState<Ingredient[]>([])
  const [loading, setLoading] = useState(!initialCache)
  const [chartLoading, setChartLoading] = useState(false)
  const [salesRange, setSalesRange] = useState(7)
  const [activeQuickAccess, setActiveQuickAccess] = useState<DashboardShortcut | null>(null)
  const [dashboardError, setDashboardError] = useState('')
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const [readNotificationIds, setReadNotificationIds] = useState<Set<string>>(() => new Set())
  const [dismissedNotificationIds, setDismissedNotificationIds] = useState<Set<string>>(() => new Set())
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<string | null>(null)
  const [todayOrdersOpen, setTodayOrdersOpen] = useState(false)
  const [expandedPaymentOrderId, setExpandedPaymentOrderId] = useState<string | null>(null)

  const fetchData = useCallback(async (days: number = 7, silent = false) => {
    if (!silent) setLoading(true)
    setDashboardError('')
    try {
      const [statsResult, ordersResult, salesResult, creditsResult, paymentResult, ingredientsResult] = await Promise.allSettled([
        getTodayStats(),
        getOrdersWithItems(),
        getDailySales(days),
        getCredits(),
        getPaymentMethodSales(),
        getIngredients(),
      ])

      if (statsResult.status === 'fulfilled') setStats(statsResult.value)
      if (ordersResult.status === 'fulfilled') setTodayOrders(ordersResult.value)
      if (salesResult.status === 'fulfilled') setDailySales(salesResult.value)
      if (creditsResult.status === 'fulfilled') setCredits(creditsResult.value)
      if (paymentResult.status === 'fulfilled') setPaymentMethods(paymentResult.value)
      if (ingredientsResult.status === 'fulfilled') setIngredients(ingredientsResult.value)

      inicioCache = {
        stats: statsResult.status === 'fulfilled' ? statsResult.value : inicioCache?.stats ?? null,
        todayOrders: ordersResult.status === 'fulfilled' ? ordersResult.value : inicioCache?.todayOrders ?? [],
        dailySales: salesResult.status === 'fulfilled' ? salesResult.value : inicioCache?.dailySales ?? [],
        productRanking: inicioCache?.productRanking ?? [],
        credits: creditsResult.status === 'fulfilled' ? creditsResult.value : inicioCache?.credits ?? [],
        paymentMethods: paymentResult.status === 'fulfilled' ? paymentResult.value : inicioCache?.paymentMethods ?? [],
        productionStats: inicioCache?.productionStats ?? null,
      }
      try {
        localStorage.setItem(DASHBOARD_CACHE_KEY, JSON.stringify({ owner: user?.id ?? 'anonymous', savedAt: Date.now(), data: inicioCache }))
      } catch { /* El dashboard sigue funcionando si el almacenamiento está lleno o deshabilitado. */ }

      const failedResults = [statsResult, ordersResult, salesResult, creditsResult, paymentResult, ingredientsResult]
        .filter((result): result is PromiseRejectedResult => result.status === 'rejected')
      if (failedResults.length > 0) {
        console.error('Errores parciales del dashboard:', failedResults.map(result => result.reason))
        setDashboardError(`${failedResults.length} sección${failedResults.length === 1 ? '' : 'es'} no ${failedResults.length === 1 ? 'pudo' : 'pudieron'} actualizarse. El resto de la información sigue disponible.`)
      }
    } catch (e) {
      console.error('Error:', e)
      setDashboardError('No pudimos actualizar todos los datos del dashboard. Puedes reintentar sin perder la información visible.')
    } finally {
      if (!silent) setLoading(false)
    }
  }, [user?.id])

  const handleSalesRangeChange = useCallback(async (days: number) => {
    setSalesRange(days)
    setChartLoading(true)
    setDashboardError('')
    try {
      const salesData = await getDailySales(days)
      setDailySales(salesData)
      if (days === 7 && inicioCache) {
        inicioCache = { ...inicioCache, dailySales: salesData }
        try { localStorage.setItem(DASHBOARD_CACHE_KEY, JSON.stringify({ owner: user?.id ?? 'anonymous', savedAt: Date.now(), data: inicioCache })) } catch { /* opcional */ }
      }
    } catch (e) {
      console.error('Error actualizando el rango de ventas:', e)
      setDashboardError('No pudimos actualizar el período de ventas. Intenta nuevamente.')
    } finally {
      setChartLoading(false)
    }
  }, [user?.id])

  useEffect(() => {
    fetchData()
  }, [fetchData])
  useLiveDataRefresh('dashboard', () => fetchData(salesRange, true))

  // Secciones que aparecen más abajo no bloquean el primer render del tablero.
  useEffect(() => {
    let cancelled = false
    void Promise.allSettled([getProductRanking(), getProductionStats()]).then(([ranking, production]) => {
      if (cancelled) return
      if (ranking.status === 'fulfilled') setProductRanking(ranking.value)
      if (production.status === 'fulfilled') setProductionStats(production.value)
      if (inicioCache) {
        inicioCache = {
          ...inicioCache,
          productRanking: ranking.status === 'fulfilled' ? ranking.value : inicioCache.productRanking,
          productionStats: production.status === 'fulfilled' ? production.value : inicioCache.productionStats,
        }
        try { localStorage.setItem(DASHBOARD_CACHE_KEY, JSON.stringify({ owner: user?.id ?? 'anonymous', savedAt: Date.now(), data: inicioCache })) } catch { /* caché opcional */ }
      }
    })
    return () => { cancelled = true }
  }, [user?.id])

  const totalSales = stats?.totalSales ?? 0
  const ordersCount = stats?.ordersCount ?? 0
  const pendingCredits = useMemo(
    () => credits.filter(c => c.status !== 'paid').sort((a, b) => b.balancePending - a.balancePending),
    [credits]
  )
  const totalPendingCredits = pendingCredits.reduce((s, c) => s + c.balancePending, 0)
  const lowStockItems = useMemo(() => [...ingredients].sort((a, b) => a.currentStock - b.currentStock).slice(0, 5), [ingredients])
  const paymentTotal = useMemo(() => paymentMethods.reduce((s, m) => s + m.total, 0), [paymentMethods])
  const hasAccess = useCallback((path: string) => canAccessModule(path, user?.role, user?.allowedModules), [user?.role, user?.allowedModules])
  const closeQuickAccess = useCallback(() => setActiveQuickAccess(null), [])
  const notifications = useMemo(() => {
    const items: Array<{ id: string; title: string; detail: string; path: string; tone: 'critical' | 'warning' }> = []
    const unavailableItems = lowStockItems.filter(item => item.currentStock <= 0)
    if (unavailableItems.length > 0 && hasAccess('/inventario')) {
      items.push({
        id: 'inventory',
        title: 'Inventario requiere atención',
        detail: `${unavailableItems.length} producto${unavailableItems.length === 1 ? '' : 's'} agotado${unavailableItems.length === 1 ? '' : 's'} o con saldo negativo`,
        path: '/inventario',
        tone: 'critical',
      })
    }
    if (pendingCredits.length > 0 && hasAccess('/clientes')) {
      items.push({
        id: 'credits',
        title: 'Cobros pendientes',
        detail: `${pendingCredits.length} crédito${pendingCredits.length === 1 ? '' : 's'} por revisar`,
        path: '/clientes',
        tone: 'warning',
      })
    }
    return items
  }, [hasAccess, lowStockItems, pendingCredits.length])
  const visibleNotifications = useMemo(
    () => notifications.filter(notification => !dismissedNotificationIds.has(notification.id)),
    [notifications, dismissedNotificationIds]
  )
  const unreadNotificationCount = visibleNotifications.filter(notification => !readNotificationIds.has(notification.id)).length

  const markNotificationsAsRead = () => {
    setReadNotificationIds(previous => new Set([...previous, ...visibleNotifications.map(notification => notification.id)]))
  }

  const markNotificationAsRead = (id: string) => {
    setReadNotificationIds(previous => new Set(previous).add(id))
  }

  const dismissNotification = (id: string) => {
    setDismissedNotificationIds(previous => new Set(previous).add(id))
  }

  const dismissAllNotifications = () => {
    setDismissedNotificationIds(previous => new Set([...previous, ...visibleNotifications.map(notification => notification.id)]))
  }

  const ordersToday = useMemo(() =>
    todayOrders.filter(o => dateKeyInTimeZone(new Date(o.createdAt)) === dateKeyInTimeZone()),
    [todayOrders]
  )
  const paidOrdersToday = useMemo(() => ordersToday.filter(order => order.status === 'paid' && !isPersonalAccountOrder(order)), [ordersToday])

  const paymentMethodDetails = useMemo(() => {
    if (!selectedPaymentMethod) return []
    return paidOrdersToday.flatMap(order => order.payments
      .filter(payment => payment.method === selectedPaymentMethod)
      .map(payment => ({ order, payment })))
  }, [paidOrdersToday, selectedPaymentMethod])

  useEffect(() => {
    const modalOpen = Boolean(selectedPaymentMethod || todayOrdersOpen)
    if (!modalOpen) return
    const previousOverflow = document.body.style.overflow
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setSelectedPaymentMethod(null)
        setTodayOrdersOpen(false)
      }
    }
    document.body.style.overflow = 'hidden'
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [selectedPaymentMethod, todayOrdersOpen])

  const recentOrders = useMemo(() => {
    return paidOrdersToday.slice(0, 5)
  }, [paidOrdersToday])

  const chartData = useMemo(() => {
    const labels = dailySales.map(d => new Date(d.date + 'T12:00:00').toLocaleDateString('es', { day: 'numeric', month: 'short' }))
    const data = dailySales.map(d => d.total)

    return {
      labels,
      datasets: [{
        label: 'Ventas ($)',
        data,
        borderColor: '#ef4444',
        backgroundColor: (context: { chart: { ctx: CanvasRenderingContext2D } }) => {
          const ctx = context.chart.ctx
          const gradient = ctx.createLinearGradient(0, 0, 0, 200)
          gradient.addColorStop(0, 'rgba(239, 68, 68, 0.3)')
          gradient.addColorStop(1, 'rgba(239, 68, 68, 0.0)')
          return gradient
        },
        borderWidth: 2.5,
        fill: true,
        tension: 0.4,
        pointRadius: 3,
        pointBackgroundColor: '#ef4444',
        pointBorderColor: '#18181b',
        pointBorderWidth: 2,
        pointHoverRadius: 6,
      }]
    }
  }, [dailySales])

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: '#1c1c1e',
        titleColor: '#71717a',
        bodyColor: '#ffffff',
        borderColor: '#333',
        borderWidth: 1,
        padding: 8,
        displayColors: false,
        callbacks: {
          label: (ctx: { parsed: { y: number | null } }) => {
            const usd = ctx.parsed.y ?? 0
            const reference = bcvRate ? `Ref. ${formatVes(usd * bcvRate)}` : 'Ref. BCV no disponible'
            return [`$${usd.toLocaleString('es-VE')}`, reference]
          }
        }
      }
    },
    scales: {
      x: { grid: { display: false }, ticks: { color: '#8b8b95', font: { size: 10 } } },
      y: {
        grid: { color: 'rgba(255,255,255,0.055)' },
        ticks: { color: '#8b8b95', font: { size: 10 }, callback: (v: number | string) => `$${Number(v) >= 1000 ? (Number(v)/1000)+'K' : v}` },
        beginAtZero: true
      }
    }
  }

  const paymentData = useMemo(() => {
    return {
      labels: paymentMethods.map(item => PAYMENT_METHOD_LABELS[item.method] ?? item.method),
      datasets: [{ data: paymentMethods.map(item => item.total), backgroundColor: PAYMENT_COLORS, borderWidth: 0 }]
    }
  }, [paymentMethods])

  const productionData = useMemo(() => {
    return {
      labels: ['Completado', 'Pendiente'],
      datasets: [{ data: [productionStats?.batchesToday ?? 0, 0], backgroundColor: ['#10b981', '#27272a'], borderWidth: 0 }]
    }
  }, [productionStats])

  const doughnutOptions = { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, cutout: '72%' }
  const paymentDoughnutOptions = { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: { enabled: false } }, cutout: '72%' }

  if (loading && !initialCache) return <PageSkeleton cards={4} rows={4} hasTable={false} />

  return (
    <div className={`db-page animate-fade-in${notificationsOpen ? ' notifications-open' : ''}`}>
      <header className="db-header">
        <div className="db-header-copy">
          <h1 className="page-title"><Flame size={22} className="page-title-icon" /> ¡Buen día, Chef!</h1>
          <p className="db-greeting-sub">Así marcha Full China hoy.</p>
        </div>

        <div className="db-header-tools">
          <div className="db-header-search-row">
            <button className="db-header-icon-btn db-header-search-btn" type="button" onClick={openSearch} aria-label="Buscar">
              <Search size={18} />
            </button>
            <button className="db-header-icon-btn" type="button" onClick={() => setNotificationsOpen(open => !open)} aria-expanded={notificationsOpen} aria-controls="dashboard-notifications" aria-label={`Notificaciones: ${visibleNotifications.length} pendiente${visibleNotifications.length === 1 ? '' : 's'}, ${unreadNotificationCount} sin leer`}>
              <Bell size={18} />
              {unreadNotificationCount > 0 ? <span className="db-bell-dot">{unreadNotificationCount}</span> : null}
            </button>
          </div>

          <div className="db-header-meta-row">
              <button className={`db-greeting-rates ${bcvStale ? 'stale' : ''}`} type="button" onClick={() => void refreshBcv()} disabled={bcvLoading} title="Actualizar tasa BCV">
                <DollarSign size={12} />
                <span>BCV</span>
                <strong>{bcvRate ? `$1 = ${formatVes(bcvRate)}` : bcvLoading ? 'Consultando…' : 'No disponible'}</strong>
                {bcvRate && <span className="db-rate-date">{bcvStale ? 'guardada' : formatRateDate(bcvUpdatedAt)}</span>}
              </button>
          </div>

          {notificationsOpen ? (
            <div className="db-notifications" id="dashboard-notifications" role="region" aria-label="Alertas operativas">
              <div className="db-notifications-head">
                <strong>Alertas operativas</strong>
                <div className="db-notifications-tools">
                  <span aria-label={`${unreadNotificationCount} sin leer`}>{unreadNotificationCount}</span>
                  {visibleNotifications.some(notification => !readNotificationIds.has(notification.id)) ? (
                    <button type="button" onClick={markNotificationsAsRead} aria-label="Marcar todas como leídas" title="Marcar todas como leídas"><CheckCheck size={14} /></button>
                  ) : null}
                  {visibleNotifications.length > 0 ? (
                    <button type="button" onClick={dismissAllNotifications} aria-label="Borrar todas las notificaciones" title="Borrar todas"><Trash2 size={14} /></button>
                  ) : null}
                </div>
              </div>
              {visibleNotifications.length === 0 ? (
                <div className="db-notifications-empty"><Bell size={22} /><span>No hay alertas para mostrar</span></div>
              ) : visibleNotifications.map(notification => {
                const isRead = readNotificationIds.has(notification.id)
                return (
                  <div key={notification.id} className="db-notification-row">
                    <button type="button" className={`db-notification-item ${notification.tone}${isRead ? ' is-read' : ''}`} aria-label={`Abrir alerta: ${notification.title}`} onClick={() => { markNotificationAsRead(notification.id); setNotificationsOpen(false); navigate(notification.path) }}>
                      <span className="db-notification-dot" />
                      <span><strong>{notification.title}</strong><small>{notification.detail}</small></span>
                    </button>
                    <button type="button" className="db-notification-dismiss" onClick={() => dismissNotification(notification.id)} aria-label={`Borrar alerta: ${notification.title}`} title="Borrar alerta"><X size={14} /></button>
                  </div>
                )
              })}
            </div>
          ) : null}
        </div>
      </header>

      {dashboardError && (
        <Toast
          type="error"
          message={dashboardError}
          onClose={() => setDashboardError('')}
          actionLabel="Reintentar"
          onAction={() => void fetchData(salesRange)}
        />
      )}

      {activeQuickAccess ? <DashboardQuickAccess shortcut={activeQuickAccess} onClose={closeQuickAccess} /> : null}

      <div className="kpi-banner">
        <div className="kpi-banner-content">
          <div className="db-section-label">
            <span>Resumen del día</span>
          </div>
          <div className="kpi-row">
            <div className="kpi-card red">
              <div className="kpi-icon-circle red"><DollarSign size={20} /></div>
              <div className="kpi-data">
                <span className="kpi-label">VENTAS DE HOY</span>
                <MoneyWithBcv usd={totalSales} className="kpi-value" align="start" />
              </div>
            </div>
            <button className="kpi-card red kpi-card-button" type="button" onClick={() => setTodayOrdersOpen(true)} aria-label={`Ver ${ordersCount} comandas de hoy`}>
              <div className="kpi-icon-circle red"><ClipboardList size={20} /></div>
              <div className="kpi-data">
                <span className="kpi-label">COMANDAS</span>
                <span className="kpi-value">{ordersCount}</span>
              </div>
            </button>
            <div className="kpi-card green">
              <div className="kpi-icon-circle green"><TrendingUp size={20} /></div>
              <div className="kpi-data">
                <span className="kpi-label"><span className="kpi-lbl-full">TICKET PROMEDIO</span><span className="kpi-lbl-short">TICKET PROM.</span></span>
                <MoneyWithBcv usd={stats?.avgTicket ?? 0} className="kpi-value" align="start" />
              </div>
            </div>
            <button className="kpi-card red kpi-card-button" type="button" onClick={() => hasAccess('/clientes') && navigate('/clientes')} aria-label="Abrir cuentas por cobrar" disabled={!hasAccess('/clientes')}>
              <div className="kpi-icon-circle red"><CreditCard size={20} /></div>
              <div className="kpi-data">
                <span className="kpi-label"><span className="kpi-lbl-full">CUENTAS POR COBRAR</span><span className="kpi-lbl-short">POR COBRAR</span></span>
                <MoneyWithBcv usd={totalPendingCredits} className="kpi-value" align="start" />
              </div>
            </button>
          </div>
        </div>
        <div className="kpi-banner-img-wrap">
          <img src="/optimized/root/kpi-bg-new.png" alt="" className="kpi-banner-img" />
          <div className="kpi-banner-gradient"></div>
        </div>
      </div>

      <div className="db-grid-4">
        <div className="db-card">
          <div className="db-card-head">
            <div className="db-chart-heading-group">
              <h3>Resumen de ventas</h3>
              <label className="db-period-control">
                <span className="sr-only">Período de ventas</span>
                <StyledSelect aria-label="Período de ventas" value={salesRange} disabled={chartLoading} onChange={(event) => void handleSalesRangeChange(Number(event.target.value))}>
                  <option value={7}>Últimos 7 días</option>
                  <option value={14}>Últimos 14 días</option>
                  <option value={30}>Últimos 30 días</option>
                </StyledSelect>
                {chartLoading ? <RefreshCw size={12} className="is-spinning" /> : null}
              </label>
            </div>
            <button className="db-link-btn" type="button" onClick={() => void fetchData(salesRange)} disabled={loading || chartLoading} aria-label="Actualizar datos de hoy" title="Actualizar datos de hoy">
              <RefreshCw size={14} className={loading ? 'is-spinning' : ''} />
            </button>
          </div>
          <div className="db-chart-box"><Line data={chartData} options={chartOptions} /></div>
        </div>

        <div className="db-card db-payment-card">
          <div className="db-card-head db-payment-head">
            <div>
              <h3>Método de pago</h3>
              <span className="db-card-support">Distribución de los cobros de hoy</span>
            </div>
            <span className="db-payment-count">{paymentMethods.length} medio{paymentMethods.length === 1 ? '' : 's'}</span>
          </div>
          <div className={`db-pago-layout${paymentMethods.length === 0 ? ' is-empty' : ''}`}>
            {paymentMethods.length > 0 && (
              <div className="db-pago-chart" aria-label={`Total cobrado hoy: ${paymentTotal.toLocaleString('es-VE', { style: 'currency', currency: 'USD' })}`}>
                <div className="db-donut-wrap">
                  <Doughnut data={paymentData} options={paymentDoughnutOptions} />
                  <div className="db-donut-center" aria-hidden="true">
                    <strong>${paymentTotal.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
                    <span>cobrado hoy</span>
                  </div>
                </div>
              </div>
            )}
            <div className="db-pago-legend">
              {paymentMethods.length === 0 ? (
                <div className="db-pago-empty" role="status">
                  <CreditCard size={22} />
                  <span>Aún no hay cobros hoy</span>
                  <small>El desglose aparecerá al registrar el primer pago.</small>
                </div>
              ) : paymentMethods.map((m, i) => {
                const share = paymentTotal > 0 ? Math.round((m.total / paymentTotal) * 100) : 0
                const color = PAYMENT_COLORS[i % PAYMENT_COLORS.length]
                return (
                  <button key={m.method} type="button" className="pago-legend-row pago-legend-button" onClick={() => setSelectedPaymentMethod(m.method)} aria-label={`Ver cobros de ${PAYMENT_METHOD_LABELS[m.method] ?? m.method}`}>
                    <div className="pago-method">
                      <span className="pago-dot" style={{ background: color }} />
                      <span className="pago-name">{PAYMENT_METHOD_LABELS[m.method] ?? m.method}</span>
                    </div>
                    <span className="pago-pct">{share}%</span>
                    <MoneyWithBcv usd={m.total} className="pago-amount" compact />
                    <span className="pago-progress" aria-hidden="true">
                      <span style={{ width: `${share}%`, background: color }} />
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
        </div>

        <div className="db-card">
          <div className="db-card-head">
            <h3>Últimas comandas</h3>
            {hasAccess('/comandas') ? <button className="db-link-btn" onClick={() => navigate('/comandas')}>Ver todas</button> : null}
          </div>
          <div className="db-orders-list">
            {recentOrders.length === 0 ? (
              <div className="db-empty-state"><ClipboardList size={20} /><span>Sin comandas pagadas hoy</span></div>
            ) : recentOrders.map((o) => (
              <div key={o.id} className="db-order-row">
                <span className="ord-time">{new Date(o.createdAt).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })}</span>
                <span className="ord-folio">#{String(o.orderNumber).padStart(4, '0')}</span>
                <span className="ord-badge paid">Pagada</span>
                <MoneyWithBcv usd={o.totalAmount || 0} rate={'bcvRate' in o ? o.bcvRate : bcvRate} className="ord-total" compact />
              </div>
            ))}
          </div>
        </div>

        <div className="db-card">
          <div className="db-card-head">
            <h3>Platos más vendidos</h3>
          </div>
          {productRanking.length === 0 ? (
            <div className="db-empty-state"><UtensilsCrossed size={20} /><span>Aún no hay platos vendidos</span></div>
          ) : (
            <div className="db-sellers-table">
              <div className="st-header">
                <span>#</span>
                <span>Plato</span>
                <span>Uds</span>
                <span>Total</span>
              </div>
              {productRanking.slice(0, 5).map((d, i) => (
                <div key={d.name} className="st-row">
                  <span className={`st-idx${i < 3 ? ' top' : ''}`}>{i + 1}</span>
                  <span className="st-product-cell">
                    <span className="st-thumb" aria-hidden="true">
                      <span className="st-thumb-fallback">{d.emoji}</span>
                      {optimizedDashboardProductImage(d.imageUrl) && (
                        <img
                          src={optimizedDashboardProductImage(d.imageUrl) ?? undefined}
                          alt=""
                          loading="lazy"
                          onError={event => { event.currentTarget.hidden = true }}
                        />
                      )}
                    </span>
                    <span className="st-product-copy">
                      <span className="st-name">{formatProductTitle(d.name)}</span>
                      <span className="st-qty"><strong>{d.count}</strong><span>unidades</span></span>
                    </span>
                  </span>
                  <MoneyWithBcv usd={d.revenue} className="st-rev" compact />
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="db-card db-quick-card">
          <div className="db-card-head"><h3>Acciones rápidas</h3></div>
          <div className="db-quick-grid">
            {hasAccess('/comandas') && <button className="db-qa-btn" type="button" onClick={() => setActiveQuickAccess('comandas')}><ClipboardList size={20} /><span>Comandas</span></button>}
            {hasAccess('/caja') && <button className="db-qa-btn" type="button" onClick={() => setActiveQuickAccess('ventas')}><TrendingUp size={20} /><span>Ventas</span></button>}
            {hasAccess('/menu') && <button className="db-qa-btn" type="button" onClick={() => setActiveQuickAccess('menu')}><UtensilsCrossed size={20} /><span>Menú</span></button>}
            {hasAccess('/mesas') && <button className="db-qa-btn" type="button" onClick={() => setActiveQuickAccess('mesas')}><CreditCard size={20} /><span>Mesas</span></button>}
            {hasAccess('/inventario') && <button className="db-qa-btn" type="button" onClick={() => setActiveQuickAccess('inventario')}><AlertTriangle size={20} /><span>Inventario</span></button>}
            {hasAccess('/clientes') && <button className="db-qa-btn" type="button" onClick={() => setActiveQuickAccess('clientes')}><DollarSign size={20} /><span>Clientes</span></button>}
          </div>
        </div>

      </div>

      <div className="db-grid-3">
        <div className="db-card">
          <div className="db-card-head">
            <h3>Alertas de inventario</h3>
          </div>
          <div className="db-inv-alerts">
            {lowStockItems.length === 0 ? (
              <div className="inv-row"><span className="inv-row-name">Sin datos de inventario</span></div>
            ) : lowStockItems.map((it) => {
              const level = it.currentStock <= 0 ? 'Agotado' : 'Disponible'
              return (
                <div key={it.id} className="inv-row">
                  <div className="inv-row-icon">
                    <AlertTriangle size={14} />
                  </div>
                  <span className="inv-row-name">{formatSpanishText(it.name)}</span>
                  <span className="inv-row-qty">{it.currentStock.toLocaleString('es-VE', { maximumFractionDigits: 2 })} {it.unitSymbol}</span>
                  <span className={`inv-badge ${it.currentStock <= 0 ? 'inv-crítico' : 'inv-ok'}`}>{level}</span>
                </div>
              )
            })}
          </div>
          {hasAccess('/inventario') ? <button className="db-link-btn full-w mt" onClick={() => navigate('/inventario')}>Ir a inventario</button> : null}
        </div>

        <div className={`db-card db-production-card${(productionStats?.batchesToday ?? 0) === 0 ? ' is-empty' : ''}`}>
          <div className="db-card-head"><h3>Producción de hoy</h3></div>
          <div className={`db-prod-layout${(productionStats?.batchesToday ?? 0) === 0 ? ' is-empty' : ''}`}>
            {(productionStats?.batchesToday ?? 0) === 0 ? (
              <div className="db-prod-empty" role="status">
                <span className="db-prod-empty-icon"><ClipboardList size={19} /></span>
                <span className="db-prod-empty-copy">
                  <strong>Aún no hay producción</strong>
                  <small>Registra un lote para ver aquí el rendimiento y las mermas.</small>
                </span>
              </div>
            ) : (
              <>
                <div className="db-prod-donut-wrap">
                  <Doughnut data={productionData} options={doughnutOptions} />
                  <div className="db-prod-center">
                    <span className="prod-center-pct">{Math.round(productionStats?.avgYield ?? 0)}%</span>
                    <span className="prod-center-lbl">Rendimiento</span>
                  </div>
                </div>
                <div className="db-prod-items">
                  <div className="prod-item-row"><span className="prod-item-dot"></span><span className="prod-item-name">Lotes de hoy</span><span className="prod-item-qty">{productionStats?.batchesToday ?? 0}</span></div>
                  <div className="prod-item-row"><span className="prod-item-dot"></span><span className="prod-item-name">Rendimiento promedio</span><span className="prod-item-qty">{(productionStats?.avgYield ?? 0).toFixed(1)}%</span></div>
                  <div className="prod-item-row"><span className="prod-item-dot"></span><span className="prod-item-name">Merma total</span><span className="prod-item-qty">{(productionStats?.totalWaste ?? 0).toFixed(2)}</span></div>
                  <div className="prod-item-row"><span className="prod-item-dot"></span><span className="prod-item-name">Costo/porción</span><span className="prod-item-qty">${(productionStats?.avgCostPerPortion ?? 0).toFixed(2)}</span></div>
                </div>
              </>
            )}
          </div>
          {hasAccess('/produccion') ? <button className={`db-link-btn full-w mt${(productionStats?.batchesToday ?? 0) === 0 ? ' db-prod-plan-btn' : ''}`} onClick={() => navigate('/produccion')}>Ver plan de producción</button> : null}
        </div>

        <div className="db-card db-credit-card">
          <div className="db-card-head db-credit-head">
            <div>
              <h3>Clientes con saldo pendiente</h3>
              <span className="db-card-support">Da seguimiento a los cobros</span>
            </div>
            <span className="db-credit-count">{pendingCredits.length}</span>
          </div>
          <div className="db-cobrar-list">
            {pendingCredits.length === 0 ? (
              <div className="db-credit-empty">
                <CreditCard size={20} />
                <span>Todos los saldos están al día</span>
              </div>
            ) : pendingCredits.slice(0, 3).map((c) => {
              const createdAtTime = new Date(c.createdAt).getTime()
              const ageInDays = Number.isNaN(createdAtTime) ? 0 : Math.max(0, Math.floor((Date.now() - createdAtTime) / 86_400_000))
              return (
                <div key={c.id} className="cobrar-row">
                  <span className="cobrar-avatar" aria-hidden="true">{c.customerName.trim().charAt(0).toUpperCase() || '?'}</span>
                  <span className="cobrar-customer">
                    <strong>{c.customerName}</strong>
                    <small>{ageInDays === 0 ? 'Crédito de hoy' : `${ageInDays} día${ageInDays === 1 ? '' : 's'} pendiente`}</small>
                  </span>
                  <MoneyWithBcv usd={c.balancePending} className="cobrar-row-val" compact />
                </div>
              )
            })}
          </div>
          {hasAccess('/clientes') ? <button className="db-link-btn full-w mt" onClick={() => navigate('/clientes')}>Ver todas las cuentas</button> : null}
        </div>
      </div>

      {selectedPaymentMethod && createPortal(
        <div className="db-modal-backdrop" role="presentation" onClick={() => setSelectedPaymentMethod(null)}>
          <section className="db-modal db-payment-detail-modal" role="dialog" aria-modal="true" aria-labelledby="payment-detail-title" onClick={event => event.stopPropagation()}>
            <header className="db-modal-header">
              <div>
                <span className="db-modal-eyebrow">Cobros de hoy</span>
                <h2 id="payment-detail-title">{PAYMENT_METHOD_LABELS[selectedPaymentMethod] ?? selectedPaymentMethod}</h2>
                <p>Comandas cobradas con este método de pago.</p>
              </div>
              <button type="button" className="db-modal-close" aria-label="Cerrar detalle de pago" onClick={() => setSelectedPaymentMethod(null)}><X size={18} /></button>
            </header>
            <div className="db-modal-summary">
              <div><span>Total cobrado</span><MoneyWithBcv usd={paymentMethodDetails.reduce((sum, row) => sum + row.payment.amount, 0)} /></div>
              <div><span>Movimientos</span><strong>{paymentMethodDetails.length}</strong></div>
            </div>
            <div className="db-modal-list">
              {paymentMethodDetails.length === 0 ? <div className="db-modal-empty"><CreditCard size={24} /><span>No hay cobros registrados con este método hoy.</span></div> : paymentMethodDetails.map(({ order, payment }) => (
                <button className={`db-payment-detail-row ${expandedPaymentOrderId === order.id ? 'is-expanded' : ''}`} type="button" key={payment.id} onClick={() => setExpandedPaymentOrderId(current => current === order.id ? null : order.id)} aria-expanded={expandedPaymentOrderId === order.id}>
                  <div><strong>Comanda #{String(order.orderNumber).padStart(4, '0')}</strong><small>{new Date(payment.createdAt || order.createdAt).toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit' })} · {order.customerName}</small>{expandedPaymentOrderId === order.id && <div className="db-order-items-detail"><span className="db-order-items-title">Detalle de la orden</span>{order.items.map(item => <span key={item.id}>{item.quantity} × {formatProductTitle(item.productName)}</span>)}</div>}</div>
                  <MoneyWithBcv usd={payment.amount} className="db-payment-detail-amount" compact />
                </button>
              ))}
            </div>
          </section>
        </div>, document.body
      )}

      {todayOrdersOpen && createPortal(
        <div className="db-modal-backdrop" role="presentation" onClick={() => setTodayOrdersOpen(false)}>
          <section className="db-modal db-orders-detail-modal" role="dialog" aria-modal="true" aria-labelledby="today-orders-title" onClick={event => event.stopPropagation()}>
            <header className="db-modal-header">
              <div>
                <span className="db-modal-eyebrow">Resumen del día</span>
                <h2 id="today-orders-title">Comandas de hoy</h2>
                <p>{ordersToday.length} comandas registradas hoy · desglose por orden.</p>
              </div>
              <button type="button" className="db-modal-close" aria-label="Cerrar comandas de hoy" onClick={() => setTodayOrdersOpen(false)}><X size={18} /></button>
            </header>
            <div className="db-modal-list db-orders-detail-list">
              {ordersToday.length === 0 ? <div className="db-modal-empty"><ClipboardList size={24} /><span>No hay comandas registradas hoy.</span></div> : ordersToday.map(order => (
                <div className="db-order-detail-row" key={order.id}>
                  <div><strong>#{String(order.orderNumber).padStart(4, '0')}</strong><span className={`ord-badge ${order.status === 'paid' ? 'paid' : 'pending'}`}>{order.status === 'paid' ? 'Pagada' : 'Pendiente'}</span><small>{new Date(order.createdAt).toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit' })} · {order.customerName}</small></div>
                  <MoneyWithBcv usd={order.totalAmount} className="db-payment-detail-amount" compact />
                </div>
              ))}
            </div>
            <footer className="db-modal-footer"><button type="button" className="db-modal-secondary" onClick={() => { setTodayOrdersOpen(false); navigate('/comandas') }}><ExternalLink size={14} /> Ver módulo de comandas</button></footer>
          </section>
        </div>, document.body
      )}

    </div>
  )
}
