import { useMemo, useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useRates } from '../context/rates-context'
import { MoneyWithBcv } from '../components/MoneyWithBcv'
import { formatRateDate, formatVes } from '../lib/money'
import { getTodayStats, getOrdersWithItems, getDailySales, getProductRanking, getCredits, getPaymentMethodSales, getProductionStats, type TodayStats, type FullOrder, type DailySales, type ProductRanking, type Credit, type PaymentMethodSales, type ProductionStats } from '../lib/dataService'
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
  const [, setLoading] = useState(!inicioCache)

  const fetchData = useCallback(async () => {
    try {
      const [statsData, ordersData, salesData, rankingData, creditsData, paymentData, productionData] = await Promise.all([
        getTodayStats(),
        getOrdersWithItems(),
        getDailySales(7),
        getProductRanking(),
        getCredits(),
        getPaymentMethodSales(),
        getProductionStats(),
      ])
      setStats(statsData)
      setTodayOrders(ordersData)
      setDailySales(salesData)
      setProductRanking(rankingData)
      setCredits(creditsData)
      setPaymentMethods(paymentData)
      setProductionStats(productionData)
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
      labels: paymentMethods.map(item => item.method),
      datasets: [{ data: paymentMethods.map(item => item.total), backgroundColor: ['#ef4444', '#f59e0b', '#fbbf24', '#3b82f6', '#a855f7'], borderWidth: 0 }]
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
          <button className="db-header-pill">
            <Calendar size={14} /><span>Hoy</span><ChevronDown size={14} />
          </button>
          <div className="db-header-search">
            <input placeholder="Buscar..." />
            <Search size={16} />
          </div>
          <button className="db-header-icon-btn">
            <Bell size={18} />
          </button>
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
                <MoneyWithBcv usd={stats?.avgTicket && stats.avgTicket > 0 ? stats.avgTicket : 38.33} className="kpi-value" align="start" />
              </div>
            </div>
            <div className="kpi-card">
              <div className="kpi-icon-circle red"><CreditCard size={20} /></div>
              <div className="kpi-data">
                <span className="kpi-label">CUENTAS POR COBRAR</span>
                <MoneyWithBcv usd={totalPendingCredits} className="kpi-value" align="start" />
                <span className="kpi-sub">{pendingCredits.length > 0 ? pendingCredits.length : 3} clientes</span>
              </div>
            </div>
          </div>
        </div>
        <div className="kpi-banner-img-wrap">
          <img src="/kpi-bg.png" alt="" className="kpi-banner-img" />
          <div className="kpi-banner-gradient"></div>
        </div>
      </div>

      <div className="db-grid-4">
        <div className="db-card">
          <div className="db-card-head">
            <h3>RESUMEN DE VENTAS</h3>
            <button className="db-card-pill-sm">Últimos 7 días</button>
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
              {[
                { c: '#ef4444', n: 'Efectivo', p: '58%', v: 1067 },
                { c: '#f59e0b', n: 'Tarjeta', p: '28%', v: 515 },
                { c: '#fbbf24', n: 'Yape / Plin', p: '10%', v: 184 },
                { c: '#52525b', n: 'Mixto', p: '4%', v: 74 },
              ].map((r, i) => (
                <div key={i} className="pago-legend-row">
                  <span className="pago-dot" style={{ background: r.c }}></span>
                  <span className="pago-name">{r.n}</span>
                  <span className="pago-pct">{r.p}</span>
                  <MoneyWithBcv usd={r.v} compact />
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
                  <span className="seller-name-v2">{'emoji' in d ? d.emoji : '🥢'} {d.name}</span>
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
            <h3>ALERTAS DE INVENTARIO</h3>
          </div>
          <div className="db-inv-alerts">
            {[
              { name: 'Pollo troceado', qty: '12 porciones', level: 'Bajo' },
              { name: 'Camarón', qty: '8 porciones', level: 'Crítico' },
              { name: 'Salmón', qty: '6 porciones', level: 'Bajo' },
              { name: 'Salsa agridulce', qty: '10 porciones', level: 'Bajo' },
              { name: 'Arroz', qty: '15 porciones', level: 'OK' },
            ].map((a, i) => (
              <div key={i} className="inv-row">
                <div className="inv-row-icon">
                  <AlertTriangle size={14} />
                </div>
                <span className="inv-row-name">{a.name}</span>
                <span className="inv-row-qty">{a.qty}</span>
                <span className={`inv-badge inv-${a.level.toLowerCase()}`}>{a.level}</span>
              </div>
            ))}
          </div>
          <button className="db-link-btn full-w mt" onClick={() => navigate('/inventario')}>Ir a inventario</button>
        </div>

        <div className="db-card">
          <div className="db-card-head"><h3>PRODUCCIÓN DE HOY</h3></div>
          <div className="db-prod-layout">
            <div className="db-prod-donut-wrap">
              <Doughnut data={productionData} options={doughnutOptions} />
              <div className="db-prod-center">
                <span className="prod-center-pct">68%</span>
                <span className="prod-center-lbl">Completado</span>
              </div>
            </div>
            <div className="db-prod-items">
              {[
                { name: 'Lumpias', qty: '120 / 180 und' },
                { name: 'Arroz Chaufa', qty: '22 / 30 porciones' },
                { name: 'Chow Mein', qty: '18 / 25 porciones' },
                { name: 'Pollo Agridulce', qty: '15 / 25 porciones' },
              ].map((p, i) => (
                <div key={i} className="prod-item-row">
                  <span className="prod-item-dot"></span>
                  <span className="prod-item-name">{p.name}</span>
                  <span className="prod-item-qty">{p.qty}</span>
                </div>
              ))}
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
              <span className="cobrar-sub">3 comandas pendientes</span>
            </div>
          </div>
          <div className="db-cobrar-list">
            {[
              { id: '#1458', total: 54.00 },
              { id: '#1451', total: 135.00 },
              { id: '#1442', total: 151.00 },
            ].map((c, i) => (
              <div key={i} className="cobrar-row">
                <span className="cobrar-row-id">Coma. {c.id}</span>
                <MoneyWithBcv usd={c.total} className="cobrar-row-val" compact />
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
          <div className="fm-text"><span className="fm-label">INVENTARIO TOTAL</span><MoneyWithBcv usd={2450} className="fm-val" align="start" compact /><span className="fm-sub">Valor actual</span></div>
        </div>
        <div className="db-footer-metric">
          <div className="fm-icon"><ChefHat size={16} /></div>
          <div className="fm-text"><span className="fm-label">COSTO DE INSUMOS USADOS</span><MoneyWithBcv usd={640} className="fm-val" align="start" compact /><span className="fm-sub">Hoy</span></div>
        </div>
        <div className="db-footer-metric">
          <div className="fm-icon"><Receipt size={16} /></div>
          <div className="fm-text"><span className="fm-label">GASTOS OPERATIVOS</span><MoneyWithBcv usd={320} className="fm-val" align="start" compact /><span className="fm-sub">Hoy</span></div>
        </div>
        <div className="db-footer-metric highlight-green">
          <div className="fm-icon green-glow"><TrendingUp size={16} /></div>
          <div className="fm-text"><span className="fm-label">UTILIDAD NETA ESTIMADA</span><MoneyWithBcv usd={880} className="fm-val green-text" align="start" compact /><span className="fm-sub">Hoy</span></div>
        </div>
      </div>
    </div>
  )
}
