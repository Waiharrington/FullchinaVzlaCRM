import { useMemo } from 'react'
import { useAuth } from '../context/auth-context'
import { useDemoData } from '../context/demo-data-context'
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, BarElement, ArcElement, Title, Tooltip, Legend, Filler } from 'chart.js'
import { Line, Doughnut } from 'react-chartjs-2'
import './Inicio.css'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, ArcElement, Title, Tooltip, Legend, Filler)

export function Inicio() {
  const { user, demoMode } = useAuth()
  const { todayStats, orders, ingredients, credits, getDailySales, getProductRanking } = useDemoData()

  const dailySales = useMemo(() => getDailySales(7), [getDailySales])
  const productRanking = useMemo(() => getProductRanking().slice(0, 5), [getProductRanking])

  const recentOrders = useMemo(() =>
    orders.filter(o => o.status === 'paid').slice(0, 8),
    [orders]
  )

  const lowStockItems = useMemo(() =>
    ingredients.filter(i => i.stock <= i.minStock).sort((a, b) => a.stock - b.stock),
    [ingredients]
  )

  const pendingCredits = useMemo(() => credits.filter(c => c.status === 'active'), [credits])
  const pendingCreditsAmount = pendingCredits.reduce((sum, c) => sum + c.remaining, 0)

  const chartData = useMemo(() => ({
    labels: dailySales.map(d => {
      const date = new Date(d.date + 'T12:00:00')
      return date.toLocaleDateString('es', { weekday: 'short', day: 'numeric' })
    }),
    datasets: [{
      label: 'Ventas ($)',
      data: dailySales.map(d => d.total),
      borderColor: '#f97316',
      backgroundColor: 'rgba(249, 115, 22, 0.1)',
      borderWidth: 3,
      fill: true,
      tension: 0.4,
      pointBackgroundColor: '#f97316',
      pointBorderColor: '#fff',
      pointBorderWidth: 2,
      pointRadius: 5,
      pointHoverRadius: 7,
    }]
  }), [dailySales])

  const chartOptions = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: 'rgba(28, 28, 30, 0.95)',
        titleColor: '#fff',
        bodyColor: '#aeaeb2',
        borderColor: 'rgba(249, 115, 22, 0.3)',
        borderWidth: 1,
        padding: 12,
        cornerRadius: 8,
        callbacks: {
          label: (ctx: { parsed: { y: number | null } }) => `$${(ctx.parsed.y ?? 0).toFixed(2)}`
        }
      }
    },
    scales: {
      x: {
        grid: { color: 'rgba(255,255,255,0.05)' },
        ticks: { color: '#aeaeb2', font: { size: 11 } }
      },
      y: {
        grid: { color: 'rgba(255,255,255,0.05)' },
        ticks: { color: '#aeaeb2', font: { size: 11 }, callback: (v: string | number) => `$${v}` },
        beginAtZero: true
      }
    }
  }), [])

  const paymentData = useMemo(() => {
    const paid = orders.filter(o => o.status === 'paid')
    const cash = paid.filter(o => o.paymentMethod === 'cash').length
    const card = paid.filter(o => o.paymentMethod === 'card').length
    const transfer = paid.filter(o => o.paymentMethod === 'transfer').length
    return {
      labels: ['Efectivo', 'Tarjeta', 'Transferencia'],
      datasets: [{
        data: [cash, card, transfer],
        backgroundColor: ['rgba(34, 197, 94, 0.8)', 'rgba(59, 130, 246, 0.8)', 'rgba(168, 85, 247, 0.8)'],
        borderColor: ['#22c55e', '#3b82f6', '#a855f7'],
        borderWidth: 2,
      }]
    }
  }, [orders])

  const doughnutOptions = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom' as const,
        labels: { color: '#aeaeb2', padding: 16, usePointStyle: true, pointStyleWidth: 10, font: { size: 12 } }
      }
    },
    cutout: '65%',
  }), [])

  return (
    <div className="page animate-fade-in">
      <header className="page-header">
        <div>
          <h1 className="page-title text-gradient">Dashboard CRM</h1>
          <p className="page-subtitle">
            Bienvenido{user ? `, ${user.email.split('@')[0]}` : ''}
            {demoMode && ' (Modo Demo Activo)'}
          </p>
        </div>
        <div className="role-indicator-tag">
          {user?.role === 'owner' && <span className="badge badge-owner">Dueño</span>}
          {user?.role === 'manager' && <span className="badge badge-manager">Manager</span>}
          {user?.role === 'cashier' && <span className="badge badge-cashier">Cajera</span>}
        </div>
      </header>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon">💰</div>
          <div className="stat-info">
            <span className="stat-value">${todayStats.totalSales.toFixed(2)}</span>
            <span className="stat-label">Ventas hoy</span>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">🛒</div>
          <div className="stat-info">
            <span className="stat-value">{todayStats.ordersCount}</span>
            <span className="stat-label">Órdenes cobradas</span>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">📊</div>
          <div className="stat-info">
            <span className="stat-value">${todayStats.avgTicket.toFixed(2)}</span>
            <span className="stat-label">Ticket promedio</span>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">⚠️</div>
          <div className="stat-info">
            <span className="stat-value">{todayStats.lowStock}</span>
            <span className="stat-label">Bajo stock</span>
          </div>
        </div>
      </div>

      <div className="dashboard-grid">
        <div className="card chart-card">
          <h2 className="card-title">Ventas últimos 7 días</h2>
          <div className="chart-container">
            <Line data={chartData} options={chartOptions} />
          </div>
        </div>

        <div className="card chart-card">
          <h2 className="card-title">Métodos de pago</h2>
          <div className="chart-container-sm">
            <Doughnut data={paymentData} options={doughnutOptions} />
          </div>
        </div>
      </div>

      <div className="dashboard-grid three-col">
        <div className="card">
          <h2 className="card-title">Top productos</h2>
          <div className="ranking-list">
            {productRanking.map((p, i) => (
              <div key={p.name} className="ranking-item">
                <span className="ranking-pos">{i + 1}</span>
                <div className="ranking-info">
                  <span className="ranking-name">{p.name}</span>
                  <span className="ranking-stat">{p.count} und · ${p.revenue.toFixed(2)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <h2 className="card-title">Últimas ventas</h2>
          {recentOrders.length === 0 ? (
            <p className="empty-message">No hay ventas hoy</p>
          ) : (
            <div className="order-list">
              {recentOrders.map(order => (
                <div key={order.id} className="order-item">
                  <div className="order-info">
                    <span className="order-id">{order.id}</span>
                    <span className="order-time">
                      {new Date(order.createdAt).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <div className="order-right">
                    <span className="order-total">${order.total.toFixed(2)}</span>
                    <span className={`order-method method-${order.paymentMethod}`}>
                      {order.paymentMethod === 'cash' ? '💵' : order.paymentMethod === 'card' ? '💳' : '📱'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card">
          <h2 className="card-title">Alertas</h2>
          <div className="alerts-list">
            {lowStockItems.length > 0 && (
              <div className="alert-section">
                <span className="alert-section-title">Bajo stock</span>
                {lowStockItems.map(item => (
                  <div key={item.id} className="alert-item warning">
                    <span className="alert-name">{item.name}</span>
                    <span className="alert-value">{item.stock} {item.unit}</span>
                  </div>
                ))}
              </div>
            )}
            {pendingCredits.length > 0 && (
              <div className="alert-section">
                <span className="alert-section-title">Créditos pendientes</span>
                <div className="alert-item info">
                  <span className="alert-name">{pendingCredits.length} clientes</span>
                  <span className="alert-value">${pendingCreditsAmount.toFixed(2)}</span>
                </div>
              </div>
            )}
            {todayStats.pendingOrders > 0 && (
              <div className="alert-section">
                <span className="alert-section-title">Órdenes sin cobrar</span>
                <div className="alert-item danger">
                  <span className="alert-name">{todayStats.pendingOrders} órdenes</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
