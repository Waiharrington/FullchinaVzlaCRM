import { useMemo, useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useRates } from '../context/rates-context'
import { MoneyWithBcv } from '../components/MoneyWithBcv'
import { dateKeyInTimeZone, formatRateDate, formatVes } from '../lib/money'
import { formatProductTitle, formatSpanishText } from '../lib/textFormat'
import { getTodayStats, getOrdersWithItems, getDailySales, getProductRanking, getCredits, getPaymentMethodSales, getProductionStats, getIngredients, getExpenses, type TodayStats, type FullOrder, type DailySales, type ProductRanking, type Credit, type PaymentMethodSales, type ProductionStats, type Ingredient, type Expense } from '../lib/dataService'
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, BarElement, ArcElement, Title, Tooltip, Legend, Filler } from 'chart.js'
import { Line, Doughnut } from 'react-chartjs-2'
import {
  Flame,
  Calendar,
  ChevronDown,
  Bell,
  Plus,
  TrendingUp,
  DollarSign,
  ChefHat,
  ClipboardList,
  CreditCard,
  Users,
  ShoppingCart,
  BarChart3,
  Search,
  Package,
  FileText,
  AlertTriangle,
  Receipt
} from 'lucide-react'
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
  const { bcvRate, updatedAt: bcvUpdatedAt, stale: bcvStale, loading: bcvLoading, refresh: refreshBcv } = useRates()
  const [stats, setStats] = useState<TodayStats | null>(inicioCache?.stats ?? null)
  const [todayOrders, setTodayOrders] = useState<FullOrder[]>(inicioCache?.todayOrders ?? [])
  const [dailySales, setDailySales] = useState<DailySales[]>(inicioCache?.dailySales ?? [])
  const [productRanking, setProductRanking] = useState<ProductRanking[]>(inicioCache?.productRanking ?? [])
  const [credits, setCredits] = useState<Credit[]>(inicioCache?.credits ?? [])
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethodSales[]>(inicioCache?.paymentMethods ?? [])
  const [productionStats, setProductionStats] = useState<ProductionStats | null>(inicioCache?.productionStats ?? null)
  const [ingredients, setIngredients] = useState<Ingredient[]>([])
  const [todayExpenses, setTodayExpenses] = useState<Expense[]>([])
  const [, setLoading] = useState(!inicioCache)

  const fetchData = useCallback(async () => {
    try {
      const today = dateKeyInTimeZone()
      const [statsData, ordersData, salesData, rankingData, creditsData, paymentData, productionData, ingredientsData, expensesData] = await Promise.all([
        getTodayStats(),
        getOrdersWithItems(),
        getDailySales(7),
        getProductRanking(),
        getCredits(),
        getPaymentMethodSales(),
        getProductionStats(),
        getIngredients().catch(() => []),
        getExpenses(today, today).catch(() => []),
      ])
      setStats(statsData)
      setTodayOrders(ordersData)
      setDailySales(salesData)
      setProductRanking(rankingData)
      setCredits(creditsData)
      setPaymentMethods(paymentData)
      setProductionStats(productionData)
      setIngredients(ingredientsData)
      setTodayExpenses(expensesData)
      inicioCache = { stats: statsData, todayOrders: ordersData, dailySales: salesData, productRanking: rankingData, credits: creditsData, paymentMethods: paymentData, productionStats: productionData }
    } catch (e) {
      console.error('Error:', e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const totalSales = stats?.totalSales ?? 0
  const ordersCount = stats?.ordersCount ?? 0
  const pendingCredits = credits.filter(c => c.status !== 'paid')
  const totalPendingCredits = pendingCredits.reduce((s, c) => s + c.balancePending, 0)
  const inventoryTotal = useMemo(() => ingredients.reduce((s, i) => s + (i.stockValue ?? 0), 0), [ingredients])
  const todayExpensesTotal = useMemo(() => todayExpenses.reduce((s, e) => s + e.amount, 0), [todayExpenses])
  const operatingBalance = totalSales - todayExpensesTotal
  const lowStockItems = useMemo(() => [...ingredients].sort((a, b) => a.currentStock - b.currentStock).slice(0, 5), [ingredients])
  const paymentTotal = useMemo(() => paymentMethods.reduce((s, m) => s + m.total, 0), [paymentMethods])

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
      x: { grid: { display: false }, ticks: { color: '#52525b', font: { size: 9 } } },
      y: {
        grid: { color: 'rgba(255,255,255,0.03)' },
        ticks: { color: '#52525b', font: { size: 9 }, callback: (v: number | string) => `$${Number(v) >= 1000 ? (Number(v)/1000)+'K' : v}` },
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

  return (
    <div className="db-page animate-fade-in">
      <header className="db-header">
        <div className="db-header-left">
          <h1 className="db-greeting">¡Buen día, Chef! <Flame size={24} className="greeting-flame" /></h1>
          <div className="db-greeting-sub-row">
            <p className="db-greeting-sub">Aquí tienes el resumen de tu food truck.</p>
            <button className={`db-greeting-rates ${bcvStale ? 'stale' : ''}`} type="button" onClick={() => void refreshBcv()} disabled={bcvLoading} title="Actualizar tasa BCV">
              <DollarSign size={12} /> BCV
              <strong>{bcvRate ? `$1 = ${formatVes(bcvRate)}` : bcvLoading ? 'Consultando…' : 'No disponible'}</strong>
              {bcvRate && <span className="db-rate-date">{bcvStale ? 'guardada' : formatRateDate(bcvUpdatedAt)}</span>}
            </button>
          </div>
        </div>
        <div className="db-header-right">
          <span className="db-header-pill" aria-label="Período actual">
            <Calendar size={14} /><span>Hoy</span><ChevronDown size={14} />
          </span>
          <div className="db-header-search">
            <input placeholder="Buscar..." />
            <Search size={16} />
          </div>
          <span className="db-header-icon-btn" aria-label="Notificaciones">
            <Bell size={18} />
          </span>
          <button className="db-primary-btn" onClick={() => navigate('/comandas')}>
            <Plus size={16} /><span>Nueva comanda</span><ChefHat size={16} />
          </button>
        </div>
      </header>

      <div className="kpi-banner">
        <div className="kpi-banner-content">
          <div className="db-section-label">
            <Flame size={14} className="section-label-icon" />
            <span>RESUMEN DEL DÍA</span>
          </div>
          <div className="kpi-row">
            <div className="kpi-card">
              <div className="kpi-icon-circle red"><DollarSign size={20} /></div>
              <div className="kpi-data">
                <span className="kpi-label">VENTAS DE HOY</span>
                <MoneyWithBcv usd={totalSales} className="kpi-value" align="start" />
              </div>
            </div>
            <div className="kpi-card">
              <div className="kpi-icon-circle orange"><ClipboardList size={20} /></div>
              <div className="kpi-data">
                <span className="kpi-label">COMANDAS</span>
                <span className="kpi-value">{ordersCount}</span>
              </div>
            </div>
            <div className="kpi-card">
              <div className="kpi-icon-circle green"><TrendingUp size={20} /></div>
              <div className="kpi-data">
                <span className="kpi-label">TICKET PROMEDIO</span>
                <MoneyWithBcv usd={stats?.avgTicket ?? 0} className="kpi-value" align="start" />
              </div>
            </div>
            <div className="kpi-card">
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
          <img src="/optimized/root/kpi-bg.webp" alt="" className="kpi-banner-img" />
          <div className="kpi-banner-gradient"></div>
        </div>
      </div>

      <div className="db-grid-4">
        <div className="db-card">
          <div className="db-card-head">
            <h3>RESUMEN DE VENTAS</h3>
            <span className="db-card-pill-sm">Últimos 7 días</span>
          </div>
          <div className="db-chart-box"><Line data={chartData} options={chartOptions} /></div>
        </div>

        <div className="db-card">
          <div className="db-card-head"><h3>MÉTODO DE PAGO</h3></div>
          <div className="db-pago-layout">
            <div className="db-donut-wrap">
              <Doughnut data={paymentData} options={doughnutOptions} />
            </div>
            <div className="db-pago-legend">
              {paymentMethods.length === 0 ? (
                <div className="pago-legend-row"><span className="pago-name">Sin ventas registradas hoy</span></div>
              ) : paymentMethods.map((m, i) => (
                <div key={m.method} className="pago-legend-row">
                  <span className="pago-dot" style={{ background: PAYMENT_COLORS[i % PAYMENT_COLORS.length] }}></span>
                  <span className="pago-name">{PAYMENT_METHOD_LABELS[m.method] ?? m.method}</span>
                  <span className="pago-pct">{paymentTotal > 0 ? Math.round((m.total / paymentTotal) * 100) : 0}%</span>
                  <MoneyWithBcv usd={m.total} compact />
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="db-card">
          <div className="db-card-head">
            <h3>ÚLTIMAS COMANDAS</h3>
            <button className="db-link-btn" onClick={() => navigate('/comandas')}>Ver todas</button>
          </div>
          <div className="db-orders-list">
            {recentOrders.map((o) => (
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
            <h3>PLATOS MÁS VENDIDOS</h3>
          </div>
          <div className="db-sellers-list">
            {productRanking.slice(0, 5).map((d, i) => (
              <div key={d.name} className="seller-row-v2">
                <span className={`seller-rank r${i + 1}`}>{i + 1}</span>
                <div className="seller-meta">
                  <span className="seller-name-v2">{'emoji' in d ? d.emoji : '🥢'} {formatProductTitle(d.name)}</span>
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
            <h3>EXISTENCIAS MÁS BAJAS</h3>
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
          <button className="db-link-btn full-w mt" onClick={() => navigate('/inventario')}>Ir a inventario</button>
        </div>

        <div className="db-card">
          <div className="db-card-head"><h3>PRODUCCIÓN DE HOY</h3></div>
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
          <button className="db-link-btn full-w mt" onClick={() => navigate('/produccion')}>Ver plan de producción</button>
        </div>

        <div className="db-card">
          <div className="db-card-head"><h3>CUENTAS POR COBRAR</h3></div>
          <div className="db-cobrar-summary">
            <div className="cobrar-icon-wrap"><CreditCard size={22} /></div>
            <div className="cobrar-data">
              <span className="cobrar-label">Total por cobrar</span>
              <MoneyWithBcv usd={totalPendingCredits} className="cobrar-big-value" align="start" />
              <span className="cobrar-sub">{pendingCredits.length} crédito{pendingCredits.length === 1 ? '' : 's'} pendiente{pendingCredits.length === 1 ? '' : 's'}</span>
            </div>
          </div>
          <div className="db-cobrar-list">
            {pendingCredits.length === 0 ? (
              <div className="cobrar-row"><span className="cobrar-row-id">Sin cuentas por cobrar</span></div>
            ) : pendingCredits.slice(0, 4).map((c) => (
              <div key={c.id} className="cobrar-row">
                <span className="cobrar-row-id">{c.customerName}</span>
                <MoneyWithBcv usd={c.balancePending} className="cobrar-row-val" compact />
              </div>
            ))}
          </div>
          <button className="db-link-btn full-w mt" onClick={() => navigate('/clientes')}>Ver todas las cuentas</button>
        </div>
      </div>

      <div className="db-card db-actions-card">
        <div className="db-card-head"><h3>ACCIONES RÁPIDAS</h3></div>
        <div className="db-quick-actions">
          <button className="qa-btn" onClick={() => navigate('/caja')}><div className="qa-icon-wrap"><ShoppingCart size={22} /></div><span>Caja</span></button>
          <button className="qa-btn" onClick={() => navigate('/comandas')}><div className="qa-icon-wrap"><FileText size={22} /></div><span>Comandas</span></button>
          <button className="qa-btn" onClick={() => navigate('/clientes')}><div className="qa-icon-wrap"><Users size={22} /></div><span>Clientes</span></button>
          <button className="qa-btn" onClick={() => navigate('/reportes')}><div className="qa-icon-wrap"><BarChart3 size={22} /></div><span>Reportes</span></button>
          <button className="qa-btn" onClick={() => navigate('/inventario')}><div className="qa-icon-wrap"><Package size={22} /></div><span>Inventario</span></button>
        </div>
      </div>

      <div className="db-footer-strip">
        <div className="db-footer-metric">
          <div className="fm-icon"><Package size={16} /></div>
          <div className="fm-text"><span className="fm-label">INVENTARIO TOTAL</span><MoneyWithBcv usd={inventoryTotal} className="fm-val" align="start" compact /><span className="fm-sub">Valor a costo</span></div>
        </div>
        <div className="db-footer-metric">
          <div className="fm-icon"><DollarSign size={16} /></div>
          <div className="fm-text"><span className="fm-label">VENTAS DE HOY</span><MoneyWithBcv usd={totalSales} className="fm-val" align="start" compact /><span className="fm-sub">Hoy</span></div>
        </div>
        <div className="db-footer-metric">
          <div className="fm-icon"><Receipt size={16} /></div>
          <div className="fm-text"><span className="fm-label">GASTOS OPERATIVOS</span><MoneyWithBcv usd={todayExpensesTotal} className="fm-val" align="start" compact /><span className="fm-sub">Hoy</span></div>
        </div>
        <div className="db-footer-metric highlight-green">
          <div className="fm-icon green-glow"><TrendingUp size={16} /></div>
          <div className="fm-text"><span className="fm-label">SALDO OPERATIVO PARCIAL</span><MoneyWithBcv usd={operatingBalance} className="fm-val green-text" align="start" compact /><span className="fm-sub">Ventas − gastos; no incluye insumos</span></div>
        </div>
      </div>
    </div>
  )
}
