import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useDemoData } from '../context/demo-data-context'
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, BarElement, ArcElement, Title, Tooltip, Legend, Filler } from 'chart.js'
import { Line, Doughnut } from 'react-chartjs-2'
import { 
  AlertTriangle, 
  Calendar, 
  ChefHat,
  Flame,
  BarChart3,
  Package,
  ChevronDown,
  Bell,
  Plus,
  TrendingUp,
  CreditCard,
  Users,
  DollarSign,
  ShoppingCart,
  Receipt,
  FileText,
  Search,
  ClipboardList
} from 'lucide-react'
import './Inicio.css'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, ArcElement, Title, Tooltip, Legend, Filler)

export function Inicio() {
  const { todayStats } = useDemoData()
  const navigate = useNavigate()

  const totalSales = todayStats.totalSales > 0 ? todayStats.totalSales : 25780
  const ordersCount = todayStats.ordersCount > 0 ? todayStats.ordersCount : 146
  const platosVendidos = 312
  const utilidadNeta = totalSales * 0.347

  const recentOrders = useMemo(() => {
    const mock = [
      { id: '#1467', time: '22:15', status: 'Pagada', total: 78.00 },
      { id: '#1466', time: '22:37', status: 'Pago mixto', total: 64.00 },
      { id: '#1465', time: '22:32', status: 'Pagada', total: 112.00 },
      { id: '#1464', time: '21:55', status: 'Por cobrar', total: 98.00 },
      { id: '#1463', time: '21:50', status: 'Pagada', total: 54.00 },
    ]
    return mock
  }, [])

  const chartData = useMemo(() => {
    const labels = ['08:00', '10:00', '12:00', '14:00', '16:00', '18:00', '20:00', '22:00']
    const data = [800, 1200, 2100, 3200, 3980, 3500, 2800, 1900]
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
  }, [])

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

  const paymentData = useMemo(() => ({
    labels: ['Efectivo', 'Tarjeta', 'Yape / Plin', 'Mixto'],
    datasets: [{ data: [58, 28, 10, 4], backgroundColor: ['#ef4444', '#f59e0b', '#fbbf24', '#52525b'], borderWidth: 0 }]
  }), [])

  const doughnutOptions = { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, cutout: '72%' }

  const productionData = useMemo(() => ({
    labels: ['Completado', 'Restante'],
    datasets: [{ data: [68, 32], backgroundColor: ['#ef4444', '#27272a'], borderWidth: 0 }]
  }), [])

  const productionDoughnutOpts = { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, cutout: '75%' }

  return (
    <div className="db-page animate-fade-in">

      {/* ═══════ HEADER ═══════ */}
      <header className="db-header">
        <div className="db-header-left">
          <h1 className="db-greeting">¡Buen día, Chef! <Flame size={24} className="greeting-flame" /></h1>
          <p className="db-greeting-sub">Aquí tienes el resumen de tu food truck.</p>
        </div>
        <div className="db-header-right">
          <button className="db-header-pill">
            <Calendar size={14} /><span>Hoy, 24 de mayo 2025</span><ChevronDown size={14} />
          </button>
          <div className="db-header-search">
            <input placeholder="Buscar..." />
            <Search size={16} />
          </div>
          <button className="db-header-icon-btn">
            <Bell size={18} /><span className="db-bell-dot">8</span>
          </button>
          <button className="db-primary-btn" onClick={() => navigate('/comandas')}>
            <Plus size={16} /><span>Nueva comanda</span><ChefHat size={16} />
          </button>
        </div>
      </header>

      {/* ═══════ KPI BANNER WITH BG IMAGE ═══════ */}
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
                <span className="kpi-trend up">▲ 18.6% vs ayer</span>
              </div>
            </div>
            <div className="kpi-card">
              <div className="kpi-icon-circle orange"><ClipboardList size={20} /></div>
              <div className="kpi-data">
                <span className="kpi-label">COMANDAS</span>
                <span className="kpi-value">{ordersCount}</span>
                <span className="kpi-trend up">▲ 12.3% vs ayer</span>
              </div>
            </div>
            <div className="kpi-card">
              <div className="kpi-icon-circle red"><Flame size={20} /></div>
              <div className="kpi-data">
                <span className="kpi-label">PLATOS VENDIDOS</span>
                <span className="kpi-value">{platosVendidos}</span>
                <span className="kpi-trend up">▲ 15.9% vs ayer</span>
              </div>
            </div>
            <div className="kpi-card">
              <div className="kpi-icon-circle green"><TrendingUp size={20} /></div>
              <div className="kpi-data">
                <span className="kpi-label">UTILIDAD NETA ESTIMADA</span>
                <span className="kpi-value">${utilidadNeta.toLocaleString('es-VE', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</span>
                <span className="kpi-trend up">▲ 20.1% vs ayer</span>
              </div>
            </div>
          </div>
        </div>
        <div className="kpi-banner-img-wrap">
          <img src="/kpi-bg.png" alt="" className="kpi-banner-img" />
          <div className="kpi-banner-gradient"></div>
        </div>
      </div>

      {/* ═══════ MIDDLE 4-COL GRID ═══════ */}
      <div className="db-grid-4">

        {/* Chart: Resumen de Ventas */}
        <div className="db-card">
          <div className="db-card-head">
            <h3>RESUMEN DE VENTAS</h3>
            <button className="db-card-pill-sm">Hoy <ChevronDown size={12} /></button>
          </div>
          <div className="db-chart-box"><Line data={chartData} options={chartOptions} /></div>
        </div>

        {/* Doughnut: Método de pago */}
        <div className="db-card">
          <div className="db-card-head"><h3>VENTAS POR MÉTODO DE PAGO</h3></div>
          <div className="db-pago-layout">
            <div className="db-donut-wrap">
              <Doughnut data={paymentData} options={doughnutOptions} />
            </div>
            <div className="db-pago-legend">
              {[
                { c: '#ef4444', n: 'Efectivo', p: '58%', v: '$14,936' },
                { c: '#f59e0b', n: 'Tarjeta', p: '28%', v: '$7,218' },
                { c: '#fbbf24', n: 'Yape / Plin', p: '10%', v: '$2,578' },
                { c: '#52525b', n: 'Mixto', p: '4%', v: '$1,048' },
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

        {/* Últimas Comandas */}
        <div className="db-card">
          <div className="db-card-head">
            <h3>ÚLTIMAS COMANDAS</h3>
            <button className="db-link-btn">Ver todas</button>
          </div>
          <div className="db-orders-list">
            {recentOrders.map((o, i) => (
              <div key={i} className="db-order-row">
                <span className="ord-time">{o.time}</span>
                <span className="ord-folio">{o.id}</span>
                <span className={`ord-badge ${o.status === 'Pagada' ? 'paid' : o.status === 'Por cobrar' ? 'pending' : 'mixed'}`}>{o.status}</span>
                <span className="ord-total">${o.total.toFixed(2)}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Platos Más Vendidos */}
        <div className="db-card">
          <div className="db-card-head">
            <h3>PLATOS MÁS VENDIDOS</h3>
          </div>
          <div className="db-sellers-list">
            {[
              { rank: 1, name: 'Arroz Chaufa Full', sold: 86, total: 1160, img: '/login-carousel/slide1.webp' },
              { rank: 2, name: 'Chow Mein Especial', sold: 72, total: 1008, img: '/login-carousel/slide2.webp' },
              { rank: 3, name: 'Lumpias (6 und)', sold: 54, total: 972, img: '/login-carousel/slide3.png' },
              { rank: 4, name: 'Pollo Agridulce', sold: 42, total: 714, img: '/logo.png' },
              { rank: 5, name: 'Arroz con Pollo', sold: 38, total: 570, img: '/logo.png' },
            ].map((d, i) => (
              <div key={i} className="seller-row-v2">
                <span className={`seller-rank r${d.rank}`}>{d.rank}</span>
                <img src={d.img} alt={d.name} className="seller-thumb" />
                <div className="seller-meta">
                  <span className="seller-name-v2">{d.name}</span>
                  <span className="seller-sub">{d.sold} platos</span>
                </div>
                <span className="seller-rev">$ {d.total.toLocaleString()}</span>
              </div>
            ))}
            <button className="db-link-btn full-w">👁 Ver menú completo</button>
          </div>
        </div>
      </div>

      {/* ═══════ BOTTOM 3-COL GRID ═══════ */}
      <div className="db-grid-3">

        {/* Alertas de Inventario */}
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
          <button className="db-link-btn full-w mt">Ir a inventario</button>
        </div>

        {/* Producción de hoy */}
        <div className="db-card">
          <div className="db-card-head"><h3>PRODUCCIÓN DE HOY</h3></div>
          <div className="db-prod-layout">
            <div className="db-prod-donut-wrap">
              <Doughnut data={productionData} options={productionDoughnutOpts} />
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
          <button className="db-link-btn full-w mt">Ver plan de producción</button>
        </div>

        {/* Cuentas por cobrar */}
        <div className="db-card">
          <div className="db-card-head"><h3>CUENTAS POR COBRAR</h3></div>
          <div className="db-cobrar-summary">
            <div className="cobrar-icon-wrap"><CreditCard size={22} /></div>
            <div className="cobrar-data">
              <span className="cobrar-label">Total por cobrar</span>
              <span className="cobrar-big-value">$2,156</span>
              <span className="cobrar-sub">6 comandas pendientes</span>
            </div>
          </div>
          <div className="db-cobrar-list">
            {[
              { id: '#1458', total: 78.00 },
              { id: '#1451', total: 64.00 },
              { id: '#1442', total: 112.00 },
            ].map((c, i) => (
              <div key={i} className="cobrar-row">
                <span className="cobrar-row-id">Coma. {c.id}</span>
                <span className="cobrar-row-val">${c.total.toFixed(2)}</span>
              </div>
            ))}
          </div>
          <button className="db-link-btn full-w mt">Ver todas las cuentas</button>
        </div>
      </div>

      {/* ═══════ ACCIONES RÁPIDAS ═══════ */}
      <div className="db-card db-actions-card">
        <div className="db-card-head"><h3>ACCIONES RÁPIDAS</h3></div>
        <div className="db-quick-actions">
          <button className="qa-btn"><div className="qa-icon-wrap"><FileText size={22} /></div><span>Nueva comanda</span></button>
          <button className="qa-btn"><div className="qa-icon-wrap"><ShoppingCart size={22} /></div><span>Registrar compra</span></button>
          <button className="qa-btn"><div className="qa-icon-wrap"><ChefHat size={22} /></div><span>Producción</span></button>
          <button className="qa-btn"><div className="qa-icon-wrap"><Users size={22} /></div><span>Clientes</span></button>
          <button className="qa-btn"><div className="qa-icon-wrap"><BarChart3 size={22} /></div><span>Reportes</span></button>
        </div>
      </div>

      {/* ═══════ FOOTER METRICS ═══════ */}
      <div className="db-footer-strip">
        <div className="db-footer-metric">
          <div className="fm-icon"><Package size={16} /></div>
          <div className="fm-text"><span className="fm-label">INVENTARIO TOTAL</span><span className="fm-val">$18,750</span><span className="fm-sub">Valor actual</span></div>
        </div>
        <div className="db-footer-metric">
          <div className="fm-icon"><ChefHat size={16} /></div>
          <div className="fm-text"><span className="fm-label">COSTO DE INSUMOS USADOS</span><span className="fm-val">$7,840</span><span className="fm-sub">Hoy</span></div>
        </div>
        <div className="db-footer-metric">
          <div className="fm-icon"><Receipt size={16} /></div>
          <div className="fm-text"><span className="fm-label">GASTOS OPERATIVOS</span><span className="fm-val">$3,970</span><span className="fm-sub">Hoy</span></div>
        </div>
        <div className="db-footer-metric highlight-green">
          <div className="fm-icon green-glow"><TrendingUp size={16} /></div>
          <div className="fm-text"><span className="fm-label">UTILIDAD NETA ESTIMADA</span><span className="fm-val green-text">$8,940</span><span className="fm-sub">Hoy</span></div>
        </div>
      </div>

    </div>
  )
}
