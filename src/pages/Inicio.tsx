import { useMemo, useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useDemoData } from '../context/DemoDataContext'
import { getTodayStats, getOrdersWithItems, getDailySales, getProductRanking, getCredits, type TodayStats, type FullOrder, type DailySales, type ProductRanking, type Credit } from '../lib/dataService'
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

export function Inicio() {
  const navigate = useNavigate()
  const { todayStats } = useDemoData()
  const [stats, setStats] = useState<TodayStats | null>(null)
  const [todayOrders, setTodayOrders] = useState<FullOrder[]>([])
  const [dailySales, setDailySales] = useState<DailySales[]>([])
  const [productRanking, setProductRanking] = useState<ProductRanking[]>([])
  const [credits, setCredits] = useState<Credit[]>([])
  const [loading, setLoading] = useState(true)

  const fetchData = useCallback(async () => {
    try {
      const [statsData, ordersData, salesData, rankingData, creditsData] = await Promise.all([
        getTodayStats(),
        getOrdersWithItems(),
        getDailySales(7),
        getProductRanking(),
        getCredits(),
      ])
      setStats(statsData)
      setTodayOrders(ordersData)
      setDailySales(salesData)
      setProductRanking(rankingData)
      setCredits(creditsData)
    } catch (e) {
      console.error('Error:', e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const totalSales = (stats?.totalSales && stats.totalSales > 0) ? stats.totalSales : (todayStats.totalSales > 0 ? todayStats.totalSales : 1840)
  const ordersCount = (stats?.ordersCount && stats.ordersCount > 0) ? stats.ordersCount : (todayStats.ordersCount > 0 ? todayStats.ordersCount : 48)
  const pendingCredits = credits.filter(c => c.status !== 'paid')
  const totalPendingCredits = pendingCredits.length > 0 ? pendingCredits.reduce((s, c) => s + c.balancePending, 0) : 340

  const paidOrdersToday = useMemo(() =>
    todayOrders.filter(o => o.status === 'paid'),
    [todayOrders]
  )

  const recentOrders = useMemo(() => {
    if (paidOrdersToday.length > 0) return paidOrdersToday.slice(0, 5)
    return [
      { id: '1467', createdAt: new Date().toISOString(), orderNumber: 1467, status: 'paid', totalAmount: 42.00 },
      { id: '1466', createdAt: new Date().toISOString(), orderNumber: 1466, status: 'paid', totalAmount: 35.00 },
      { id: '1465', createdAt: new Date().toISOString(), orderNumber: 1465, status: 'paid', totalAmount: 67.50 },
      { id: '1464', createdAt: new Date().toISOString(), orderNumber: 1464, status: 'paid', totalAmount: 54.00 },
      { id: '1463', createdAt: new Date().toISOString(), orderNumber: 1463, status: 'paid', totalAmount: 28.00 },
    ]
  }, [paidOrdersToday])

  const chartData = useMemo(() => {
    const labels = dailySales.length > 0
      ? dailySales.map(d => new Date(d.date + 'T12:00:00').toLocaleDateString('es', { day: 'numeric', month: 'short' }))
      : ['08:00', '10:00', '12:00', '14:00', '16:00', '18:00', '20:00', '22:00']
    const data = dailySales.length > 0
      ? dailySales.map(d => d.total)
      : [120, 180, 340, 420, 380, 260, 190, 90]

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
        callbacks: { label: (ctx: { parsed: { y: number | null } }) => `$${(ctx.parsed.y ?? 0).toLocaleString()}` }
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
      labels: ['Efectivo', 'Tarjeta', 'Transferencia'],
      datasets: [{ data: [58, 28, 14], backgroundColor: ['#ef4444', '#f59e0b', '#fbbf24'], borderWidth: 0 }]
    }
  }, [])

  const productionData = useMemo(() => {
    return {
      labels: ['Completado', 'Pendiente'],
      datasets: [{ data: [68, 32], backgroundColor: ['#10b981', '#27272a'], borderWidth: 0 }]
    }
  }, [])

  const doughnutOptions = { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, cutout: '72%' }

  if (loading) {
    return (
      <div className="db-page animate-fade-in">
        <header className="db-header">
          <div className="db-header-left">
            <h1 className="db-greeting">Cargando...</h1>
          </div>
        </header>
      </div>
    )
  }

  return (
    <div className="db-page animate-fade-in">
      <header className="db-header">
        <div className="db-header-left">
          <h1 className="db-greeting">¡Buen día, Chef! <Flame size={24} className="greeting-flame" /></h1>
          <div className="db-greeting-sub-row">
            <p className="db-greeting-sub">Aquí tienes el resumen de tu food truck.</p>
            <span className="db-greeting-rates">
              <DollarSign size={12} /> BCV <strong>Bs. 36,50</strong>
              <span className="db-rate-sep">·</span>
              EUR <strong>Bs. 40,20</strong>
            </span>
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
                <span className="kpi-value">${totalSales.toLocaleString('es-VE')}</span>
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
                <span className="kpi-value">${(stats?.avgTicket && stats.avgTicket > 0 ? stats.avgTicket : 38.33).toFixed(2)}</span>
              </div>
            </div>
            <div className="kpi-card">
              <div className="kpi-icon-circle red"><CreditCard size={20} /></div>
              <div className="kpi-data">
                <span className="kpi-label">CUENTAS POR COBRAR</span>
                <span className="kpi-value">${totalPendingCredits.toLocaleString('es-VE')}</span>
                <span className="kpi-sub">{pendingCredits.length > 0 ? pendingCredits.length : 3} clientes</span>
              </div>
            </div>
          </div>
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
                { c: '#ef4444', n: 'Efectivo', p: '58%', v: '$1,067' },
                { c: '#f59e0b', n: 'Tarjeta', p: '28%', v: '$515' },
                { c: '#fbbf24', n: 'Yape / Plin', p: '10%', v: '$184' },
                { c: '#52525b', n: 'Mixto', p: '4%', v: '$74' },
              ].map((r, i) => (
                <div key={i} className="pago-legend-row">
                  <span className="pago-dot" style={{ background: r.c }}></span>
                  <span className="pago-name">{r.n}</span>
                  <span className="pago-pct">{r.p}</span>
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
                <span className="ord-total">${(o.totalAmount || 0).toFixed(2)}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="db-card">
          <div className="db-card-head">
            <h3>PLATOS MÁS VENDIDOS</h3>
          </div>
          <div className="db-sellers-list">
            {(productRanking.length > 0 ? productRanking.slice(0, 5) : [
              { name: 'Arroz Chaufa Full', count: 24, revenue: 600, emoji: '🍚' },
              { name: 'Chow Mein Especial', count: 19, revenue: 475, emoji: '🍜' },
              { name: 'Lumpias (6 und)', count: 16, revenue: 368, emoji: '🥢' },
              { name: 'Pollo Agridulce', count: 14, revenue: 238, emoji: '🍗' },
              { name: 'Arroz con Pollo', count: 12, revenue: 180, emoji: '🍚' },
            ]).map((d, i) => (
              <div key={d.name} className="seller-row-v2">
                <span className={`seller-rank r${i + 1}`}>{i + 1}</span>
                <div className="seller-meta">
                  <span className="seller-name-v2">{'emoji' in d ? d.emoji : '🥢'} {d.name}</span>
                  <span className="seller-sub">{d.count} platos</span>
                </div>
                <span className="seller-rev">$ {d.revenue.toLocaleString()}</span>
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
              <span className="cobrar-big-value">$340</span>
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
                <span className="cobrar-row-val">${c.total.toFixed(2)}</span>
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
          <div className="fm-text"><span className="fm-label">INVENTARIO TOTAL</span><span className="fm-val">$2,450</span><span className="fm-sub">Valor actual</span></div>
        </div>
        <div className="db-footer-metric">
          <div className="fm-icon"><ChefHat size={16} /></div>
          <div className="fm-text"><span className="fm-label">COSTO DE INSUMOS USADOS</span><span className="fm-val">$640</span><span className="fm-sub">Hoy</span></div>
        </div>
        <div className="db-footer-metric">
          <div className="fm-icon"><Receipt size={16} /></div>
          <div className="fm-text"><span className="fm-label">GASTOS OPERATIVOS</span><span className="fm-val">$320</span><span className="fm-sub">Hoy</span></div>
        </div>
        <div className="db-footer-metric highlight-green">
          <div className="fm-icon green-glow"><TrendingUp size={16} /></div>
          <div className="fm-text"><span className="fm-label">UTILIDAD NETA ESTIMADA</span><span className="fm-val green-text">$880</span><span className="fm-sub">Hoy</span></div>
        </div>
      </div>
    </div>
  )
}
