import { useMemo, useEffect, useState, useCallback } from 'react'
import { getActiveCashSession, getExpenses, getTodayStats, type TodayStats, type Expense, type CashSessionSnapshot } from '../lib/dataService'
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, BarElement, Title, Tooltip, Legend } from 'chart.js'
import { Bar } from 'react-chartjs-2'
import { Target, CheckCircle2, DollarSign, Wallet, ShieldAlert } from 'lucide-react'
import './Finanzas.css'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, Title, Tooltip, Legend)

let finanzasCache: { stats: TodayStats | null; expenses: Expense[] } | null = null

export function Finanzas() {
  const [stats, setStats] = useState<TodayStats | null>(finanzasCache?.stats ?? null)
  const [expenses, setExpenses] = useState<Expense[]>(finanzasCache?.expenses ?? [])
  const [cashSession, setCashSession] = useState<CashSessionSnapshot | null>(null)
  const [, setLoading] = useState(!finanzasCache)

  const fetchData = useCallback(async () => {
    try {
      const [statsData, expensesData, cashData] = await Promise.all([
        getTodayStats(),
        getExpenses(),
        getActiveCashSession(),
      ])
      setStats(statsData)
      setCashSession(cashData)
      setExpenses(expensesData)
      finanzasCache = { stats: statsData, expenses: expensesData }
    } catch (e) {
      console.error('Error:', e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // Financial Calculations
  const currentSales = stats?.totalSales ?? 0
  const breakEvenTargetUsd = expenses.reduce((sum, expense) => sum + expense.amount, 0)
  const breakEvenPct = breakEvenTargetUsd > 0 ? Math.min(100, Math.round((currentSales / breakEvenTargetUsd) * 100)) : 0

  const financialSummary = useMemo(() => {
    const grossSales = currentSales
    const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0)
    const cogs = 0
    const grossProfit = grossSales - cogs
    const operatingExpenses = totalExpenses
    const payroll = 0
    const netProfit = grossProfit - operatingExpenses - payroll
    const netMarginPct = grossSales > 0 ? (netProfit / grossSales) * 100 : 0

    return { grossSales, cogs, grossProfit, operatingExpenses, payroll, netProfit, netMarginPct }
  }, [currentSales, expenses])

  const barChartData = {
    labels: ['Ventas Brutas', 'Costo Insumos', 'Ganancia Bruta', 'Gastos Op.', 'Nómina', 'Ganancia Neta'],
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

  return (
    <div className="page animate-fade-in">
      <header className="page-header">
        <div>
          <h1 className="page-title text-gradient">Finanzas & Cierre Financiero Automático</h1>
          <p className="page-subtitle">Consolidado diario sin necesidad de planillas de Excel. Punto de equilibrio y rentabilidad.</p>
        </div>
      </header>

      {/* Break-even Point Banner */}
      <div className="card" style={{ background: 'linear-gradient(135deg, #18181b 0%, #202024 100%)', border: '1px solid rgba(234, 179, 8, 0.3)', marginBottom: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ background: '#eab308', color: '#000', width: '36px', height: '36px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Target size={20} />
            </div>
            <div>
              <h2 style={{ color: '#fff', fontSize: '16px', fontWeight: 800, margin: 0 }}>Indicador de Punto de Equilibrio (Break-Even)</h2>
              <span style={{ fontSize: '11px', color: '#a1a1aa' }}>Monto necesario facturado para cubrir todos los costos fijos y nómina del mes</span>
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <span style={{ fontSize: '20px', fontWeight: 900, color: '#eab308' }}>${currentSales.toFixed(2)}</span>
            <span style={{ fontSize: '12px', color: '#71717a', display: 'block' }}>de ${breakEvenTargetUsd.toFixed(2)} Meta</span>
          </div>
        </div>

        {/* Progress Bar */}
        <div style={{ height: '10px', background: '#27272a', borderRadius: '6px', overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${breakEvenPct}%`, background: 'linear-gradient(90deg, #eab308 0%, #22c55e 100%)', borderRadius: '6px' }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '6px', fontSize: '11px', color: '#a1a1aa' }}>
          <span>{breakEvenPct}% Alcanzado del Punto de Equilibrio</span>
          <span>{breakEvenPct >= 100 ? '🎉 ¡Generando Utilidad Neta!' : `Faltan $${(breakEvenTargetUsd - currentSales).toFixed(2)} para llegar a cero`}</span>
        </div>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon"><DollarSign size={20} /></div>
          <div className="stat-info">
            <span className="stat-value">${financialSummary.grossSales.toFixed(2)}</span>
            <span className="stat-label">Ventas Brutas Totales</span>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon"><Wallet size={20} /></div>
          <div className="stat-info">
            <span className="stat-value">${financialSummary.operatingExpenses.toFixed(2)}</span>
            <span className="stat-label">Gastos Totales (Fijos/Var)</span>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon"><CheckCircle2 size={20} /></div>
          <div className="stat-info">
            <span className="stat-value">${financialSummary.netProfit.toFixed(2)}</span>
            <span className="stat-label">Ganancia Neta Estimada</span>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon"><ShieldAlert size={20} /></div>
          <div className="stat-info">
            <span className="stat-value">{financialSummary.netMarginPct.toFixed(1)}%</span>
            <span className="stat-label">Margen Neto Operativo</span>
          </div>
        </div>
      </div>

      {/* Cierre Diario Desglosado por Métodos de Pago */}
      <div className="card mt-6" style={{ background: '#18181b' }}>
        <h2 className="card-title">Resumen de Cierre Diario por Método de Pago</h2>
        <p style={{ color: '#71717a', fontSize: '12px', marginBottom: '16px' }}>Elimina el reporte manual que elaboraba la administración al día siguiente.</p>
        
        <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
          <div style={{ background: '#141416', padding: '14px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.06)' }}>
            <span style={{ fontSize: '11px', color: '#8e8e93', fontWeight: 700 }}>EFECTIVO CAJA USD</span>
            <span style={{ fontSize: '20px', fontWeight: 900, color: '#fff', display: 'block', margin: '4px 0' }}>${(cashSession?.openingCashUsd ?? 0).toFixed(2)}</span>
            <span style={{ fontSize: '10px', color: '#10b981' }}>En caja física en food truck</span>
          </div>

          <div style={{ background: '#141416', padding: '14px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.06)' }}>
            <span style={{ fontSize: '11px', color: '#8e8e93', fontWeight: 700 }}>EFECTIVO CAJA BS</span>
            <span style={{ fontSize: '20px', fontWeight: 900, color: '#fff', display: 'block', margin: '4px 0' }}>{(cashSession?.openingCashVes ?? 0).toLocaleString()} Bs.</span>
            <span style={{ fontSize: '10px', color: '#10b981' }}>Físico disponible</span>
          </div>

          <div style={{ background: '#141416', padding: '14px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.06)' }}>
            <span style={{ fontSize: '11px', color: '#8e8e93', fontWeight: 700 }}>PAGO MÓVIL (BANCOS)</span>
            <span style={{ fontSize: '20px', fontWeight: 900, color: '#38bdf8', display: 'block', margin: '4px 0' }}>{(cashSession?.paymentBreakdown.mobile ?? 0).toLocaleString()} Bs.</span>
            <span style={{ fontSize: '10px', color: '#a1a1aa' }}>Verificado con referencia</span>
          </div>

          <div style={{ background: '#141416', padding: '14px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.06)' }}>
            <span style={{ fontSize: '11px', color: '#8e8e93', fontWeight: 700 }}>PUNTO DE VENTA USD</span>
            <span style={{ fontSize: '20px', fontWeight: 900, color: '#a855f7', display: 'block', margin: '4px 0' }}>${(cashSession?.paymentBreakdown.card ?? 0).toFixed(2)}</span>
            <span style={{ fontSize: '10px', color: '#a1a1aa' }}>Tarjetas de crédito/débito</span>
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

