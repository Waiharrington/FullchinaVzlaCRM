import { useMemo, useEffect, useState, useCallback } from 'react'
import { getExpenses, getTodayStats, type TodayStats, type Expense } from '../lib/dataService'
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, BarElement, Title, Tooltip, Legend } from 'chart.js'
import { Bar } from 'react-chartjs-2'
import './Finanzas.css'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, Title, Tooltip, Legend)

export function Finanzas() {
  const [stats, setStats] = useState<TodayStats | null>(null)
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [loading, setLoading] = useState(true)

  const fetchData = useCallback(async () => {
    try {
      const [statsData, expensesData] = await Promise.all([
        getTodayStats(),
        getExpenses(),
      ])
      setStats(statsData)
      setExpenses(expensesData)
    } catch (e) {
      console.error('Error:', e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const financialSummary = useMemo(() => {
    const grossSales = stats?.totalSales ?? 0
    const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0)
    const cogs = grossSales * 0.38
    const grossProfit = grossSales - cogs
    const operatingExpenses = totalExpenses > 0 ? totalExpenses : grossSales * 0.18
    const payroll = grossSales * 0.15
    const netProfit = grossProfit - operatingExpenses - payroll
    const netMarginPct = grossSales > 0 ? (netProfit / grossSales) * 100 : 0

    return { grossSales, cogs, grossProfit, operatingExpenses, payroll, netProfit, netMarginPct }
  }, [stats, expenses])

  const barChartData = {
    labels: ['Ventas Brutas', 'Costo Menú', 'Ganancia Bruta', 'Gastos Operativos', 'Nómina', 'Ganancia Neta'],
    datasets: [
      {
        label: 'Monto ($)',
        data: [
          financialSummary.grossSales,
          financialSummary.cogs,
          financialSummary.grossProfit,
          financialSummary.operatingExpenses,
          financialSummary.payroll,
          financialSummary.netProfit,
        ],
        backgroundColor: [
          'rgba(59, 130, 246, 0.8)',
          'rgba(239, 68, 68, 0.8)',
          'rgba(16, 185, 129, 0.8)',
          'rgba(245, 158, 11, 0.8)',
          'rgba(168, 85, 247, 0.8)',
          'rgba(34, 197, 94, 0.9)',
        ],
        borderRadius: 8,
      },
    ],
  }

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false } },
    scales: {
      x: { ticks: { color: '#aeaeb2' } },
      y: { ticks: { color: '#aeaeb2', callback: (v: string | number) => `$${v}` } },
    },
  }

  if (loading) {
    return (
      <div className="page animate-fade-in">
        <header className="page-header">
          <h1 className="page-title text-gradient">Finanzas y Estado de Resultados</h1>
          <p className="page-subtitle">Cargando...</p>
        </header>
      </div>
    )
  }

  return (
    <div className="page animate-fade-in">
      <header className="page-header">
        <div>
          <h1 className="page-title text-gradient">Finanzas y Estado de Resultados</h1>
          <p className="page-subtitle">P&L Simplificado: Ingresos, Costos, Gastos y Margen Neto de Ganancia</p>
        </div>
      </header>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon">📈</div>
          <div className="stat-info">
            <span className="stat-value">${financialSummary.grossSales.toFixed(2)}</span>
            <span className="stat-label">Ventas Brutas</span>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">🥩</div>
          <div className="stat-info">
            <span className="stat-value">${financialSummary.cogs.toFixed(2)}</span>
            <span className="stat-label">Costo Insumos (COGS)</span>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">💎</div>
          <div className="stat-info">
            <span className="stat-value">${financialSummary.netProfit.toFixed(2)}</span>
            <span className="stat-label">Ganancia Neta</span>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">🎯</div>
          <div className="stat-info">
            <span className="stat-value">{financialSummary.netMarginPct.toFixed(1)}%</span>
            <span className="stat-label">Margen Neto de Ganancia</span>
          </div>
        </div>
      </div>

      <div className="card chart-card mt-6">
        <h2 className="card-title">Desglose Financiero (P&L)</h2>
        <div className="chart-container" style={{ height: '320px' }}>
          <Bar data={barChartData} options={chartOptions} />
        </div>
      </div>

      <div className="card table-card mt-6">
        <div className="card-header">
          <h2 className="card-title">Estado de Resultados Resumido</h2>
        </div>
        <table className="data-table">
          <tbody>
            <tr>
              <td><strong>(+) Ventas Totales Brutas</strong></td>
              <td className="text-right font-bold">${financialSummary.grossSales.toFixed(2)}</td>
            </tr>
            <tr>
              <td>(-) Costo de Productos Vendidos (Materia Prima / Insumos)</td>
              <td className="text-right text-danger">-${financialSummary.cogs.toFixed(2)}</td>
            </tr>
            <tr className="bg-surface-light">
              <td><strong>(=) Ganancia Bruta</strong></td>
              <td className="text-right font-bold text-success">${financialSummary.grossProfit.toFixed(2)}</td>
            </tr>
            <tr>
              <td>(-) Gastos Operativos (Servicios, Mantenimiento, Transporte)</td>
              <td className="text-right text-danger">-${financialSummary.operatingExpenses.toFixed(2)}</td>
            </tr>
            <tr>
              <td>(-) Nómina Base y Bonos de Producción</td>
              <td className="text-right text-danger">-${financialSummary.payroll.toFixed(2)}</td>
            </tr>
            <tr className="bg-surface-light text-lg">
              <td><strong>(=) GANANCIA NETA FINAL</strong></td>
              <td className="text-right font-bold text-gradient">${financialSummary.netProfit.toFixed(2)}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}
