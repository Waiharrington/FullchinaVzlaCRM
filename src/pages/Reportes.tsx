import { useMemo, useEffect, useState, useCallback } from 'react'
import { useAuth } from '../context/auth-context'
import { getDailySales, getProductRanking, getCategorySales, getPaymentMethodSales, type DailySales, type ProductRanking, type CategorySales, type PaymentMethodSales } from '../lib/dataService'
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, BarElement, ArcElement, Title, Tooltip, Legend, Filler } from 'chart.js'
import { Line, Bar, Doughnut } from 'react-chartjs-2'
import './Reportes.css'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, ArcElement, Title, Tooltip, Legend, Filler)

// Cache a nivel de módulo: al volver a Reportes se muestran los datos de la
// última visita al instante, sin el parpadeo de "Cargando...", mientras se
// refrescan en segundo plano.
let reportesCache: {
  dailySales: DailySales[]
  productRanking: ProductRanking[]
  categorySales: CategorySales[]
  paymentMethodSales: PaymentMethodSales[]
} | null = null

export function Reportes() {
  const { user } = useAuth()
  const [dailySales, setDailySales] = useState<DailySales[]>(reportesCache?.dailySales ?? [])
  const [productRanking, setProductRanking] = useState<ProductRanking[]>(reportesCache?.productRanking ?? [])
  const [categorySales, setCategorySales] = useState<CategorySales[]>(reportesCache?.categorySales ?? [])
  const [paymentMethodSales, setPaymentMethodSales] = useState<PaymentMethodSales[]>(reportesCache?.paymentMethodSales ?? [])
  const [, setLoading] = useState(!reportesCache)

  const fetchData = useCallback(async () => {
    try {
      const [daily, ranking, categories, payments] = await Promise.all([
        getDailySales(30),
        getProductRanking(),
        getCategorySales(),
        getPaymentMethodSales(),
      ])
      setDailySales(daily)
      setProductRanking(ranking)
      setCategorySales(categories)
      setPaymentMethodSales(payments)
      reportesCache = { dailySales: daily, productRanking: ranking, categorySales: categories, paymentMethodSales: payments }
    } catch (e) {
      console.error('Error:', e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const weeklySales = useMemo(() => dailySales.slice(-7), [dailySales])
  const monthlySales = dailySales

  const totalWeek = weeklySales.reduce((s, d) => s + d.total, 0)
  const totalMonth = monthlySales.reduce((s, d) => s + d.total, 0)
  const avgDaily = monthlySales.length > 0 ? totalMonth / monthlySales.length : 0

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

  const categoryChartData = useMemo(() => {
    const catMap: Record<string, number> = {}
    categorySales.forEach(c => { catMap[c.category] = c.total })
    return {
      labels: Object.keys(catMap).map(k => k.charAt(0).toUpperCase() + k.slice(1)),
      datasets: [{
        data: Object.values(catMap),
        backgroundColor: [
          'rgba(249, 115, 22, 0.8)',
          'rgba(59, 130, 246, 0.8)',
          'rgba(168, 85, 247, 0.8)',
          'rgba(16, 185, 129, 0.8)',
          'rgba(245, 158, 11, 0.8)',
          'rgba(239, 68, 68, 0.8)',
        ],
        borderWidth: 2,
      }]
    }
  }, [categorySales])

  const paymentChartData = useMemo(() => {
    const methodMap: Record<string, number> = {}
    paymentMethodSales.forEach(p => { methodMap[p.method] = p.total })
    return {
      labels: Object.keys(methodMap).map(k =>
        k === 'cash' ? 'Efectivo' : k === 'card' ? 'Tarjeta' : k === 'transfer' ? 'Transferencia' : k
      ),
      datasets: [{
        data: Object.values(methodMap),
        backgroundColor: ['rgba(34, 197, 94, 0.8)', 'rgba(59, 130, 246, 0.8)', 'rgba(168, 85, 247, 0.8)', 'rgba(245, 158, 11, 0.8)'],
        borderWidth: 2,
      }]
    }
  }, [paymentMethodSales])

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
          <span className="stat-value">{dailySales.reduce((s, d) => s + d.count, 0)}</span>
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
                  <span className="ranking-name">{p.emoji} {p.name}</span>
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
