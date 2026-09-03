import { useMemo, useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useRates } from '../context/rates-context'
import { useAuth } from '../context/auth-context'
import { MoneyWithBcv } from '../components/MoneyWithBcv'
import { GlobalSearch } from '../components/GlobalSearch'
import { StyledSelect } from '../components/StyledSelect'
import { canAccessModule } from '../components/navItems'
import { formatRateDate, formatVes } from '../lib/money'
import { formatProductTitle, formatSpanishText } from '../lib/textFormat'
import { getTodayStats, getOrdersWithItems, getDailySales, getProductRanking, getCredits, getPaymentMethodSales, getProductionStats, getIngredients, type TodayStats, type FullOrder, type DailySales, type ProductRanking, type Credit, type PaymentMethodSales, type ProductionStats, type Ingredient } from '../lib/dataService'
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, BarElement, ArcElement, Title, Tooltip, Legend, Filler } from 'chart.js'
import { Line, Doughnut } from 'react-chartjs-2'
import {
  Flame,
  Calendar,
  Bell,
  RefreshCw,
  TrendingUp,
  DollarSign,
  ClipboardList,
  CreditCard,
  AlertTriangle,
  UtensilsCrossed
} from 'lucide-react'
import Toast from '../components/Toast'
import { PageSkeleton } from '../components/PageSkeleton'
import './Inicio.css'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, ArcElement, Title, Tooltip, Legend, Filler)

// Cache a nivel de módulo: al volver al Dashboard se muestran los datos de
// la última visita al instante, sin el parpadeo de "Cargando...", mientras
// se refrescan en segundo plano.
let inicioCache: {
  stats: TodayStats | null
  todayOrders: FullOrder[]
  dailySales: DailySales[]
  productRanking: ProductRanking[]
  credits: Credit[]
  paymentMethods: PaymentMethodSales[]
  productionStats: ProductionStats | null
} | null = null

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  cash: 'Efectivo', card: 'Tarjeta / Punto', mobile: 'Pago móvil',
  transfer: 'Transferencia', binance: 'Binance', zelle: 'Zelle', other: 'Otro',
}
const PAYMENT_COLORS = ['#ef4444', '#f59e0b', '#fbbf24', '#3b82f6', '#a855f7', '#10b981', '#8b5cf6']

export function Inicio() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { bcvRate, updatedAt: bcvUpdatedAt, stale: bcvStale, loading: bcvLoading, refresh: refreshBcv } = useRates()
  const [stats, setStats] = useState<TodayStats | null>(inicioCache?.stats ?? null)
  const [todayOrders, setTodayOrders] = useState<FullOrder[]>(inicioCache?.todayOrders ?? [])
  const [dailySales, setDailySales] = useState<DailySales[]>(inicioCache?.dailySales ?? [])
  const [productRanking, setProductRanking] = useState<ProductRanking[]>(inicioCache?.productRanking ?? [])
  const [credits, setCredits] = useState<Credit[]>(inicioCache?.credits ?? [])
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethodSales[]>(inicioCache?.paymentMethods ?? [])
  const [productionStats, setProductionStats] = useState<ProductionStats | null>(inicioCache?.productionStats ?? null)
  const [ingredients, setIngredients] = useState<Ingredient[]>([])
  const [loading, setLoading] = useState(!inicioCache)
  const [chartLoading, setChartLoading] = useState(false)
  const [salesRange, setSalesRange] = useState(7)
  const [dashboardError, setDashboardError] = useState('')
  const [notificationsOpen, setNotificationsOpen] = useState(false)

  const fetchData = useCallback(async (days: number = 7) => {
    setLoading(true)
    setDashboardError('')
    try {
      const [statsResult, ordersResult, salesResult, rankingResult, creditsResult, paymentResult, productionResult, ingredientsResult] = await Promise.allSettled([
        getTodayStats(),
        getOrdersWithItems(),
        getDailySales(days),
        getProductRanking(),
        getCredits(),
        getPaymentMethodSales(),
        getProductionStats(),
        getIngredients(),
      ])

      if (statsResult.status === 'fulfilled') setStats(statsResult.value)
      if (ordersResult.status === 'fulfilled') setTodayOrders(ordersResult.value)
      if (salesResult.status === 'fulfilled') setDailySales(salesResult.value)
      if (rankingResult.status === 'fulfilled') setProductRanking(rankingResult.value)
      if (creditsResult.status === 'fulfilled') setCredits(creditsResult.value)
      if (paymentResult.status === 'fulfilled') setPaymentMethods(paymentResult.value)
      if (productionResult.status === 'fulfilled') setProductionStats(productionResult.value)
      if (ingredientsResult.status === 'fulfilled') setIngredients(ingredientsResult.value)

      inicioCache = {
        stats: statsResult.status === 'fulfilled' ? statsResult.value : inicioCache?.stats ?? null,
        todayOrders: ordersResult.status === 'fulfilled' ? ordersResult.value : inicioCache?.todayOrders ?? [],
        dailySales: salesResult.status === 'fulfilled' ? salesResult.value : inicioCache?.dailySales ?? [],
        productRanking: rankingResult.status === 'fulfilled' ? rankingResult.value : inicioCache?.productRanking ?? [],
        credits: creditsResult.status === 'fulfilled' ? creditsResult.value : inicioCache?.credits ?? [],
        paymentMethods: paymentResult.status === 'fulfilled' ? paymentResult.value : inicioCache?.paymentMethods ?? [],
        productionStats: productionResult.status === 'fulfilled' ? productionResult.value : inicioCache?.productionStats ?? null,
      }

      const failedResults = [statsResult, ordersResult, salesResult, rankingResult, creditsResult, paymentResult, productionResult, ingredientsResult]
        .filter((result): result is PromiseRejectedResult => result.status === 'rejected')
      if (failedResults.length > 0) {
        console.error('Errores parciales del dashboard:', failedResults.map(result => result.reason))
        setDashboardError(`${failedResults.length} sección${failedResults.length === 1 ? '' : 'es'} no ${failedResults.length === 1 ? 'pudo' : 'pudieron'} actualizarse. El resto de la información sigue disponible.`)
      }
    } catch (e) {
      console.error('Error:', e)
      setDashboardError('No pudimos actualizar todos los datos del dashboard. Puedes reintentar sin perder la información visible.')
    } finally {
      setLoading(false)
    }
  }, [])

  const handleSalesRangeChange = useCallback(async (days: number) => {
    setSalesRange(days)
    setChartLoading(true)
    setDashboardError('')
    try {
      const salesData = await getDailySales(days)
      setDailySales(salesData)
      if (days === 7 && inicioCache) inicioCache = { ...inicioCache, dailySales: salesData }
    } catch (e) {
      console.error('Error actualizando el rango de ventas:', e)
      setDashboardError('No pudimos actualizar el período de ventas. Intenta nuevamente.')
    } finally {
      setChartLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

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

  const paidOrdersToday = useMemo(() =>
    todayOrders.filter(o => o.status === 'paid'),
    [todayOrders]
  )

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

  if (loading && !inicioCache) return <PageSkeleton cards={4} rows={4} hasTable={false} />

  return (
    <div className="db-page animate-fade-in">
      <header className="db-header">
        <div className="db-header-copy">
          <h1 className="page-title"><Flame size={22} className="page-title-icon" /> ¡Buen día, Chef!</h1>
          <p className="db-greeting-sub">Así marcha Full China hoy.</p>
        </div>

        <div className="db-header-tools">
          <div className="db-header-search-row">
            <div className="db-header-search">
              <GlobalSearch inline />
            </div>
            <button className="db-header-icon-btn" type="button" onClick={() => setNotificationsOpen(open => !open)} aria-expanded={notificationsOpen} aria-controls="dashboard-notifications" aria-label={`Notificaciones: ${notifications.length} pendiente${notifications.length === 1 ? '' : 's'}`}>
              <Bell size={18} />
              {notifications.length > 0 ? <span className="db-bell-dot">{notifications.length}</span> : null}
            </button>
          </div>

          <div className="db-header-meta-row">
              <button className="db-header-pill" type="button" onClick={() => void fetchData(salesRange)} disabled={loading} aria-label="Actualizar datos de hoy" title="Actualizar datos de hoy">
                <Calendar size={14} /><span>{loading ? 'Actualizando…' : 'Hoy'}</span><RefreshCw size={13} className={loading ? 'is-spinning' : ''} />
              </button>
              <button className={`db-greeting-rates ${bcvStale ? 'stale' : ''}`} type="button" onClick={() => void refreshBcv()} disabled={bcvLoading} title="Actualizar tasa BCV">
                <DollarSign size={12} />
                <span>BCV</span>
                <strong>{bcvRate ? `$1 = ${formatVes(bcvRate)}` : bcvLoading ? 'Consultando…' : 'No disponible'}</strong>
                {bcvRate && <span className="db-rate-date">{bcvStale ? 'guardada' : formatRateDate(bcvUpdatedAt)}</span>}
              </button>
          </div>

          {notificationsOpen ? (
            <div className="db-notifications" id="dashboard-notifications" role="region" aria-label="Alertas operativas">
              <div className="db-notifications-head"><strong>Alertas operativas</strong><span>{notifications.length}</span></div>
              {notifications.length === 0 ? (
                <div className="db-notifications-empty"><Bell size={22} /><span>No hay alertas pendientes</span></div>
              ) : notifications.map(notification => (
                <button key={notification.id} type="button" className={`db-notification-item ${notification.tone}`} onClick={() => { setNotificationsOpen(false); navigate(notification.path) }}>
                  <span className="db-notification-dot" />
                  <span><strong>{notification.title}</strong><small>{notification.detail}</small></span>
                </button>
              ))}
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

      <div className="kpi-banner">
        <div className="kpi-banner-content">
          <div className="db-section-label">
            <Flame size={14} className="section-label-icon" />
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
            <div className="kpi-card orange">
              <div className="kpi-icon-circle orange"><ClipboardList size={20} /></div>
              <div className="kpi-data">
                <span className="kpi-label">COMANDAS</span>
                <span className="kpi-value">{ordersCount}</span>
              </div>
            </div>
            <div className="kpi-card green">
              <div className="kpi-icon-circle green"><TrendingUp size={20} /></div>
              <div className="kpi-data">
                <span className="kpi-label">TICKET PROMEDIO</span>
                <MoneyWithBcv usd={stats?.avgTicket ?? 0} className="kpi-value" align="start" />
              </div>
            </div>
            <div className="kpi-card red">
              <div className="kpi-icon-circle red"><CreditCard size={20} /></div>
              <div className="kpi-data">
                <span className="kpi-label">CUENTAS POR COBRAR</span>
                <MoneyWithBcv usd={totalPendingCredits} className="kpi-value" align="start" />
                <span className="kpi-sub">{pendingCredits.length} cliente{pendingCredits.length === 1 ? '' : 's'}</span>
              </div>
            </div>
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
          <div className="db-pago-layout">
            <div className="db-pago-chart" aria-label={`Total cobrado hoy: ${paymentTotal.toLocaleString('es-VE', { style: 'currency', currency: 'USD' })}`}>
              <div className="db-donut-wrap">
                <Doughnut data={paymentData} options={paymentDoughnutOptions} />
                <div className="db-donut-center" aria-hidden="true">
                  <span>Total cobrado</span>
                  <strong>${paymentTotal.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
                </div>
              </div>
              <span className="db-pago-caption">Ingresos recibidos hoy</span>
            </div>
            <div className="db-pago-legend">
              {paymentMethods.length === 0 ? (
                <div className="db-pago-empty">
                  <CreditCard size={22} />
                  <span>Sin cobros registrados hoy</span>
                  <small>El desglose aparecerá con la primera venta.</small>
                </div>
              ) : paymentMethods.map((m, i) => {
                const share = paymentTotal > 0 ? Math.round((m.total / paymentTotal) * 100) : 0
                const color = PAYMENT_COLORS[i % PAYMENT_COLORS.length]
                return (
                  <div key={m.method} className="pago-legend-row">
                    <div className="pago-method">
                      <span className="pago-dot" style={{ background: color }} />
                      <span className="pago-name">{PAYMENT_METHOD_LABELS[m.method] ?? m.method}</span>
                    </div>
                    <span className="pago-pct">{share}%</span>
                    <MoneyWithBcv usd={m.total} className="pago-amount" compact />
                    <span className="pago-progress" aria-hidden="true">
                      <span style={{ width: `${share}%`, background: color }} />
                    </span>
                  </div>
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
          <div className="db-sellers-list">
            {productRanking.length === 0 ? (
              <div className="db-empty-state"><UtensilsCrossed size={20} /><span>Aún no hay platos vendidos</span></div>
            ) : productRanking.slice(0, 5).map((d, i) => (
              <div key={d.name} className="seller-row-v2">
                <span className={`seller-rank r${i + 1}`}>{i + 1}</span>
                <div className="seller-meta">
                  <span className="seller-name-v2"><UtensilsCrossed size={14} style={{opacity:.6}} /> {formatProductTitle(d.name)}</span>
                  <span className="seller-sub">{d.count} platos</span>
                </div>
                <MoneyWithBcv usd={d.revenue} className="seller-rev" compact />
              </div>
            ))}
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

        <div className="db-card">
          <div className="db-card-head"><h3>Producción de hoy</h3></div>
          <div className="db-prod-layout">
            <div className="db-prod-donut-wrap">
              <Doughnut data={productionData} options={doughnutOptions} />
              <div className="db-prod-center">
                <span className="prod-center-pct">{Math.round(productionStats?.avgYield ?? 0)}%</span>
                <span className="prod-center-lbl">Rendimiento</span>
              </div>
            </div>
            <div className="db-prod-items">
              {(productionStats?.batchesToday ?? 0) === 0 ? (
                <div className="prod-item-row"><span className="prod-item-name">Sin lotes de producción hoy</span></div>
              ) : (
                <>
                  <div className="prod-item-row"><span className="prod-item-dot"></span><span className="prod-item-name">Lotes de hoy</span><span className="prod-item-qty">{productionStats?.batchesToday ?? 0}</span></div>
                  <div className="prod-item-row"><span className="prod-item-dot"></span><span className="prod-item-name">Rendimiento promedio</span><span className="prod-item-qty">{(productionStats?.avgYield ?? 0).toFixed(1)}%</span></div>
                  <div className="prod-item-row"><span className="prod-item-dot"></span><span className="prod-item-name">Merma total</span><span className="prod-item-qty">{(productionStats?.totalWaste ?? 0).toFixed(2)}</span></div>
                  <div className="prod-item-row"><span className="prod-item-dot"></span><span className="prod-item-name">Costo/porción</span><span className="prod-item-qty">${(productionStats?.avgCostPerPortion ?? 0).toFixed(2)}</span></div>
                </>
              )}
            </div>
          </div>
          {hasAccess('/produccion') ? <button className="db-link-btn full-w mt" onClick={() => navigate('/produccion')}>Ver plan de producción</button> : null}
        </div>

        <div className="db-card db-credit-card">
          <div className="db-card-head db-credit-head">
            <div>
              <h3>Clientes con saldo pendiente</h3>
              <span className="db-card-support">Prioriza los cobros que requieren seguimiento</span>
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

    </div>
  )
}
