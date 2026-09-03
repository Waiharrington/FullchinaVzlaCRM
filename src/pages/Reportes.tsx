import { useMemo, useEffect, useState, useCallback } from 'react'
import { useAuth } from '../context/auth-context'
import { getDailySales, getProductRanking, getCategorySales, getPaymentMethodSales, getOrdersWithItems, getExpenses, getRecipeSummaries, getPayrollSummary, type DailySales, type ProductRanking, type CategorySales, type PaymentMethodSales, type FullOrder, type Expense, type RecipeSummary } from '../lib/dataService'
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, BarElement, ArcElement, Title, Tooltip, Legend, Filler } from 'chart.js'
import { Line, Bar, Doughnut } from 'react-chartjs-2'
import './Reportes.css'
import { formatProductTitle } from '../lib/textFormat'
import { formatUsd } from '../lib/money'
import { UtensilsCrossed, BarChart3, CalendarDays, CalendarRange, Gauge, ShoppingBag } from 'lucide-react'
import { PageSkeleton } from '../components/PageSkeleton'

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
  const [loading, setLoading] = useState(!reportesCache)
  const [orders, setOrders] = useState<FullOrder[]>([])
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [recipeCosts, setRecipeCosts] = useState<Map<string, RecipeSummary>>(new Map())
  const [payroll, setPayroll] = useState<{ periods: Array<{ endDate: string; total: number }>; bonuses: Array<{ date: string; amount: number }> }>({ periods: [], bonuses: [] })

  const fetchData = useCallback(async () => {
    try {
      const [daily, ranking, categories, payments, orderRows, expenseRows, recipes, payrollRows] = await Promise.all([
        getDailySales(30),
        getProductRanking(),
        getCategorySales(),
        getPaymentMethodSales(),
        getOrdersWithItems(),
        getExpenses(),
        getRecipeSummaries().catch(() => new Map<string, RecipeSummary>()),
        getPayrollSummary().catch(() => ({ periods: [], bonuses: [] })),
      ])
      setDailySales(daily)
      setProductRanking(ranking)
      setCategorySales(categories)
      setPaymentMethodSales(payments)
      setOrders(orderRows)
      setExpenses(expenseRows)
      setRecipeCosts(recipes)
      setPayroll(payrollRows)
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

  const financialPeriods = useMemo(() => {
    const iso = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
    const now = new Date()
    const today = iso(now)
    const yesterdayDate = new Date(now); yesterdayDate.setDate(now.getDate() - 1)
    const mondayDate = new Date(now); mondayDate.setDate(now.getDate() - ((now.getDay() + 6) % 7))
    const monthDate = new Date(now.getFullYear(), now.getMonth(), 1)
    const calculate = (start: string, end: string) => {
      const paid = orders.filter(order => order.status === 'paid' && order.createdAt.slice(0, 10) >= start && order.createdAt.slice(0, 10) <= end)
      const grossSales = paid.reduce((sum, order) => sum + order.totalAmount, 0)
      const cogs = paid.reduce((sum, order) => sum + order.items.reduce((itemSum, item) => itemSum + item.quantity * (recipeCosts.get(item.sellableProductId)?.recipeCost ?? 0), 0), 0)
      const opex = expenses.filter(expense => expense.expenseDate >= start && expense.expenseDate <= end).reduce((sum, expense) => sum + expense.amount, 0)
      const payrollTotal = payroll.periods.filter(row => row.endDate >= start && row.endDate <= end).reduce((sum, row) => sum + row.total, 0)
        + payroll.bonuses.filter(row => row.date >= start && row.date <= end).reduce((sum, row) => sum + row.amount, 0)
      const grossProfit = grossSales - cogs
      const netProfit = grossProfit - opex - payrollTotal
      return { grossSales, cogs, opex, payroll: payrollTotal, grossProfit, netProfit, margin: grossSales > 0 ? netProfit / grossSales * 100 : 0, avgTicket: paid.length ? grossSales / paid.length : 0 }
    }
    return {
      hoy: calculate(today, today),
      ayer: calculate(iso(yesterdayDate), iso(yesterdayDate)),
      semana: calculate(iso(mondayDate), today),
      mes: calculate(iso(monthDate), today),
    }
  }, [orders, expenses, recipeCosts, payroll])

  const pl = financialPeriods.mes
  const plChartData = useMemo(() => ({
    labels: ['Ventas', 'Costo insumos', 'Ganancia bruta', 'Gastos', 'Nómina', 'Ganancia neta'],
    datasets: [{ data: [pl.grossSales, -pl.cogs, pl.grossProfit, -pl.opex, -pl.payroll, pl.netProfit], backgroundColor: ['#22c55e', '#ef4444', '#22c55e', '#ef4444', '#a855f7', pl.netProfit >= 0 ? '#22c55e' : '#ef4444'], borderRadius: 6 }],
  }), [pl])

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
        k === 'cash' ? 'Efectivo' : k === 'mobile' ? 'Pago móvil' : k === 'card' ? 'Punto' : k === 'transfer' ? 'Transferencia' : k === 'binance' ? 'Binance' : k === 'zelle' ? 'Zelle' : k
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
      <div className="page animate-fade-in management-workspace management-workspace--reports" key="reportes-restricted">
        <header className="page-header management-workspace-header">
          <div>
            <h1 className="page-title"><BarChart3 size={22} className="page-title-icon" /> Reportes</h1>
            <p className="page-subtitle">Acceso restringido</p>
          </div>
        </header>
        <div className="card restricted-card">
          <p>No tiene permisos para ver reportes financieros.</p>
        </div>
      </div>
    )
  }

  if (loading) return <PageSkeleton cards={4} rows={4} hasTable={false} />

  return (
    <div className="page animate-fade-in management-workspace management-workspace--reports" key="reportes-full">
      <header className="page-header management-workspace-header">
        <div>
          <h1 className="page-title"><BarChart3 size={22} className="page-title-icon" /> Reportes</h1>
          <p className="page-subtitle">Análisis de ventas y rendimiento</p>
        </div>
      </header>

      <div className="stats-row management-workspace-metrics">
        <div className="stat-card red">
          <span className="management-metric-icon"><CalendarDays size={20} /></span>
          <span className="management-metric-copy"><span className="stat-label">Esta semana</span><span className="stat-value text-gradient">${totalWeek.toFixed(2)}</span></span>
        </div>
        <div className="stat-card gold">
          <span className="management-metric-icon"><CalendarRange size={20} /></span>
          <span className="management-metric-copy"><span className="stat-label">Este mes</span><span className="stat-value">${totalMonth.toFixed(2)}</span></span>
        </div>
        <div className="stat-card green">
          <span className="management-metric-icon"><Gauge size={20} /></span>
          <span className="management-metric-copy"><span className="stat-label">Promedio diario</span><span className="stat-value">${avgDaily.toFixed(2)}</span></span>
        </div>
        <div className="stat-card muted">
          <span className="management-metric-icon"><ShoppingBag size={20} /></span>
          <span className="management-metric-copy"><span className="stat-label">Total órdenes</span><span className="stat-value">{dailySales.reduce((s, d) => s + d.count, 0)}</span></span>
        </div>
      </div>

      <section className="financial-report-grid">
        <div className="card financial-comparison-card">
          <h2 className="card-title">Comparativo financiero</h2>
          <p className="report-card-subtitle">Rendimiento de hoy frente a períodos anteriores.</p>
          <div className="report-table-wrap"><table className="financial-report-table">
            <thead><tr><th>Métrica</th><th>Hoy</th><th>Ayer</th><th>Semana</th><th>Mes</th></tr></thead>
            <tbody>
              <tr><td>Ventas brutas</td>{(['hoy','ayer','semana','mes'] as const).map(key => <td key={key}>{formatUsd(financialPeriods[key].grossSales)}</td>)}</tr>
              <tr><td>Ganancia neta</td>{(['hoy','ayer','semana','mes'] as const).map(key => <td key={key} className={financialPeriods[key].netProfit >= 0 ? 'positive' : 'negative'}>{formatUsd(financialPeriods[key].netProfit)}</td>)}</tr>
              <tr><td>Margen neto</td>{(['hoy','ayer','semana','mes'] as const).map(key => <td key={key}>{financialPeriods[key].margin.toFixed(1)}%</td>)}</tr>
              <tr><td>Ticket promedio</td>{(['hoy','ayer','semana','mes'] as const).map(key => <td key={key}>{formatUsd(financialPeriods[key].avgTicket)}</td>)}</tr>
            </tbody>
          </table></div>
        </div>
        <div className="card financial-pl-card">
          <h2 className="card-title">Estado de Resultados (P&amp;L)</h2>
          <p className="report-card-subtitle">Ventas menos insumos, gastos y nómina · Este mes</p>
          <div className="financial-pl-chart"><Bar data={plChartData} options={barOptions} /></div>
          <div className="financial-pl-summary"><span>Ganancia neta <strong className={pl.netProfit >= 0 ? 'positive' : 'negative'}>{formatUsd(pl.netProfit)}</strong></span><span>Margen <strong>{pl.margin.toFixed(1)}%</strong></span></div>
        </div>
      </section>

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
                  <span className="ranking-name"><UtensilsCrossed size={14} style={{opacity:.6}} /> {formatProductTitle(p.name)}</span>
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
