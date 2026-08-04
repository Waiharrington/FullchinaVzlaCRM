import { useMemo } from 'react'
import { useAuth } from '../context/auth-context'
import { useDemoData } from '../context/demo-data-context'
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, BarElement, ArcElement, Title, Tooltip, Legend, Filler } from 'chart.js'
import { Line, Bar, Doughnut } from 'react-chartjs-2'
import './Reportes.css'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, ArcElement, Title, Tooltip, Legend, Filler)

export function Reportes() {
  const { user } = useAuth()
  const { orders, products, getDailySales, getProductRanking } = useDemoData()

  const dailySales = useMemo(() => getDailySales(30), [getDailySales])
  const productRanking = useMemo(() => getProductRanking(), [getProductRanking])

  const paidOrders = useMemo(() => orders.filter(o => o.status === 'paid'), [orders])

  const weeklySales = useMemo(() => getDailySales(7), [getDailySales])
  const monthlySales = useMemo(() => getDailySales(30), [getDailySales])

  const totalWeek = weeklySales.reduce((s, d) => s + d.total, 0)
  const totalMonth = monthlySales.reduce((s, d) => s + d.total, 0)
  const avgDaily = monthlySales.length > 0 ? totalMonth / monthlySales.length : 0

  const categorySales = useMemo(() => {
    const map = new Map<string, number>()
    for (const order of paidOrders) {
      for (const item of order.items) {
        const product = products.find(p => p.id === item.productId)
        const cat = product?.category || 'food'
        map.set(cat, (map.get(cat) || 0) + item.price * item.quantity)
      }
    }
    return map
  }, [paidOrders, products])

  const revenueChartData = useMemo(() => ({
    labels: dailySales.map(d => {
      const date = new Date(d.date + 'T12:00:00')
      return date.toLocaleDateString('es', { day: 'numeric', month: 'short' })
    }),
    datasets: [{
      label: 'Ventas ($)',
      data: dailySales.map(d => d.total),
      borderColor: '#f97316',
      backgroundColor: 'rgba(249, 115, 22, 0.1)',
      borderWidth: 2,
      fill: true,
      tension: 0.4,
      pointRadius: 3,
      pointHoverRadius: 6,
    }]
  }), [dailySales])

  const ordersChartData = useMemo(() => ({
    labels: dailySales.map(d => {
      const date = new Date(d.date + 'T12:00:00')
      return date.toLocaleDateString('es', { day: 'numeric', month: 'short' })
    }),
    datasets: [{
      label: 'Órdenes',
      data: dailySales.map(d => d.count),
      backgroundColor: 'rgba(59, 130, 246, 0.6)',
      borderColor: '#3b82f6',
      borderWidth: 1,
      borderRadius: 4,
    }]
  }), [dailySales])

  const categoryChartData = useMemo(() => ({
    labels: ['Comida', 'Bebidas', 'Postres'],
    datasets: [{
      data: [
        categorySales.get('food') || 0,
        categorySales.get('drink') || 0,
        categorySales.get('dessert') || 0,
      ],
      backgroundColor: [
        'rgba(249, 115, 22, 0.8)',
        'rgba(59, 130, 246, 0.8)',
        'rgba(168, 85, 247, 0.8)',
      ],
      borderColor: ['#f97316', '#3b82f6', '#a855f7'],
      borderWidth: 2,
    }]
  }), [categorySales])

  const paymentChartData = useMemo(() => {
    const cash = paidOrders.filter(o => o.paymentMethod === 'cash').reduce((s, o) => s + o.total, 0)
    const card = paidOrders.filter(o => o.paymentMethod === 'card').reduce((s, o) => s + o.total, 0)
    const transfer = paidOrders.filter(o => o.paymentMethod === 'transfer').reduce((s, o) => s + o.total, 0)
    return {
      labels: ['Efectivo', 'Tarjeta', 'Transferencia'],
      datasets: [{
        data: [cash, card, transfer],
        backgroundColor: ['rgba(34, 197, 94, 0.8)', 'rgba(59, 130, 246, 0.8)', 'rgba(168, 85, 247, 0.8)'],
        borderColor: ['#22c55e', '#3b82f6', '#a855f7'],
        borderWidth: 2,
      }]
    }
  }, [paidOrders])

  const lineOptions = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false }, tooltip: { backgroundColor: 'rgba(28,28,30,0.95)', titleColor: '#fff', bodyColor: '#aeaeb2', borderColor: 'rgba(249,115,22,0.3)', borderWidth: 1, padding: 12, cornerRadius: 8 } },
    scales: {
      x: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#aeaeb2', font: { size: 10 }, maxRotation: 45 } },
      y: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#aeaeb2', callback: (v: string | number) => `$${v}` }, beginAtZero: true }
    }
  }), [])

  const barOptions = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false } },
    scales: {
      x: { grid: { display: false }, ticks: { color: '#aeaeb2', font: { size: 10 }, maxRotation: 45 } },
      y: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#aeaeb2' }, beginAtZero: true }
    }
  }), [])

  const doughnutOptions = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { position: 'bottom' as const, labels: { color: '#aeaeb2', padding: 16, usePointStyle: true, font: { size: 12 } } } },
    cutout: '60%',
  }), [])

  if (user?.role === 'cashier') {
    return (
      <div className="page animate-fade-in">
        <header className="page-header">
          <h1 className="page-title text-gradient">Reportes</h1>
          <p className="page-subtitle">Acceso restringido</p>
        </header>
        <div className="card restricted-card">
          <p>No tiene permisos para ver reportes financieros.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="page animate-fade-in">
      <header className="page-header">
        <h1 className="page-title text-gradient">Reportes</h1>
        <p className="page-subtitle">Análisis de ventas y rendimiento</p>
      </header>

      <div className="stats-row">
        <div className="stat-card">
          <span className="stat-label">Esta semana</span>
          <span className="stat-value text-gradient">${totalWeek.toFixed(2)}</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Este mes</span>
          <span className="stat-value">${totalMonth.toFixed(2)}</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Promedio diario</span>
          <span className="stat-value">${avgDaily.toFixed(2)}</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Total órdenes</span>
          <span className="stat-value">{paidOrders.length}</span>
        </div>
      </div>

      <div className="charts-grid">
        <div className="card chart-card">
          <h2 className="card-title">Ingresos últimos 30 días</h2>
          <div className="chart-container">
            <Line data={revenueChartData} options={lineOptions} />
          </div>
        </div>

        <div className="card chart-card">
          <h2 className="card-title">Órdenes por día</h2>
          <div className="chart-container">
            <Bar data={ordersChartData} options={barOptions} />
          </div>
        </div>
      </div>

      <div className="charts-grid three-col">
        <div className="card chart-card">
          <h2 className="card-title">Ventas por categoría</h2>
          <div className="chart-container-sm">
            <Doughnut data={categoryChartData} options={doughnutOptions} />
          </div>
        </div>

        <div className="card chart-card">
          <h2 className="card-title">Métodos de pago</h2>
          <div className="chart-container-sm">
            <Doughnut data={paymentChartData} options={doughnutOptions} />
          </div>
        </div>

        <div className="card">
          <h2 className="card-title">Ranking de productos</h2>
          <div className="ranking-list">
            {productRanking.slice(0, 8).map((p, i) => (
              <div key={p.name} className="ranking-item">
                <span className="ranking-pos">{i + 1}</span>
                <div className="ranking-info">
                  <span className="ranking-name">{p.name}</span>
                  <span className="ranking-stat">{p.count} und · ${p.revenue.toFixed(2)}</span>
                </div>
                <div className="ranking-bar-container">
                  <div
                    className="ranking-bar"
                    style={{ width: `${productRanking.length > 0 ? (p.revenue / productRanking[0].revenue * 100) : 0}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
