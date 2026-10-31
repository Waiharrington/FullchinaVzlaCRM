import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Inicio } from './Inicio'
import { dateKeyInTimeZone } from '../lib/money'

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  refreshBcv: vi.fn(),
  user: { id: 'owner-1', email: 'owner@fullchina.test', role: 'owner' as 'owner' | 'manager' | 'cashier', allowedModules: null as string[] | null },
  getTodayStats: vi.fn(),
  getOrdersWithItems: vi.fn(),
  getDailySales: vi.fn(),
  getDailySalesFromOrders: vi.fn(),
  getProductRanking: vi.fn(),
  getCredits: vi.fn(),
  getPaymentMethodSales: vi.fn(),
  getRecentProductionBatches: vi.fn(),
  getIngredients: vi.fn(),
  getPersonalAccountOptions: vi.fn(),
  getActiveCashSession: vi.fn(),
  getRecentCashSessionDiscrepancy: vi.fn(),
  getTodayProductionYieldAlerts: vi.fn(),
  syncDashboardAlertEvents: vi.fn(),
}))

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return { ...actual, useNavigate: () => mocks.navigate }
})

vi.mock('../context/auth-context', () => ({
  useAuth: () => ({ user: mocks.user }),
}))

vi.mock('../context/rates-context', () => ({
  useRates: () => ({ bcvRate: 791.67, updatedAt: new Date('2026-08-28T12:00:00Z'), stale: false, loading: false, refresh: mocks.refreshBcv }),
}))

vi.mock('../components/GlobalSearch', () => ({
  GlobalSearch: () => <input aria-label="Búsqueda global" />,
}))

vi.mock('../components/DashboardQuickAccess', () => ({
  DashboardQuickAccess: ({ shortcut, onClose }: { shortcut: string; onClose: () => void }) => (
    <section role="dialog" aria-label={`Acceso directo: ${shortcut}`}>
      <button type="button" onClick={onClose}>Cerrar panel</button>
    </section>
  ),
}))

vi.mock('../components/MoneyWithBcv', () => ({
  MoneyWithBcv: ({ usd, className = '' }: { usd: number; className?: string }) => <span className={className}>${usd.toFixed(2)}</span>,
}))

vi.mock('react-chartjs-2', () => ({
  Line: () => <div data-testid="sales-chart" />,
  Doughnut: ({ options }: { options?: { plugins?: { tooltip?: { enabled?: boolean } } } }) => <div data-testid="doughnut-chart" data-tooltip-enabled={String(options?.plugins?.tooltip?.enabled ?? true)} />,
}))

vi.mock('chart.js', () => ({
  Chart: { register: vi.fn() },
  CategoryScale: {},
  LinearScale: {},
  PointElement: {},
  LineElement: {},
  BarElement: {},
  ArcElement: {},
  Title: {},
  Tooltip: {},
  Legend: {},
  Filler: {},
}))

vi.mock('../lib/dataService', () => ({
  getTodayStats: mocks.getTodayStats,
  getOrdersWithItems: mocks.getOrdersWithItems,
  getDailySales: mocks.getDailySales,
  getDailySalesFromOrders: mocks.getDailySalesFromOrders,
  getProductRanking: mocks.getProductRanking,
  getCredits: mocks.getCredits,
  getPaymentMethodSales: mocks.getPaymentMethodSales,
  getRecentProductionBatches: mocks.getRecentProductionBatches,
  getIngredients: mocks.getIngredients,
  getPersonalAccountOptions: mocks.getPersonalAccountOptions,
  getActiveCashSession: mocks.getActiveCashSession,
  getRecentCashSessionDiscrepancy: mocks.getRecentCashSessionDiscrepancy,
  getTodayProductionYieldAlerts: mocks.getTodayProductionYieldAlerts,
  syncDashboardAlertEvents: mocks.syncDashboardAlertEvents,
  isPersonalAccountOrder: (order: { payments: Array<{ method: string }> }) => order.payments.some(payment => payment.method === 'personal_account'),
  isCreditAuthorizedOrder: (order: { creditAuthorized?: boolean }) => order.creditAuthorized === true,
}))

describe('Dashboard Inicio', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.user = { id: 'owner-1', email: 'owner@fullchina.test', role: 'owner', allowedModules: null }
    mocks.getTodayStats.mockResolvedValue({ totalSales: 45, ordersCount: 3, avgTicket: 15 })
    mocks.getOrdersWithItems.mockResolvedValue([])
    mocks.getDailySales.mockResolvedValue([{ date: dateKeyInTimeZone(), total: 45 }])
    mocks.getDailySalesFromOrders.mockResolvedValue([{ date: dateKeyInTimeZone(), total: 45 }])
    mocks.getProductRanking.mockResolvedValue([])
    mocks.getCredits.mockResolvedValue([{ id: 'credit-1', customerName: 'Cliente', balancePending: 10, status: 'pending', dueDate: '2000-01-01' }])
    mocks.getPaymentMethodSales.mockResolvedValue([])
    mocks.getRecentProductionBatches.mockResolvedValue([])
    mocks.getIngredients.mockResolvedValue([{ id: 'ingredient-1', name: 'Aceite', isActive: true, currentStock: -2, unitSymbol: 'L', stockValue: 0 }])
    mocks.getPersonalAccountOptions.mockResolvedValue([])
    mocks.getActiveCashSession.mockResolvedValue(null)
    mocks.getRecentCashSessionDiscrepancy.mockResolvedValue(null)
    mocks.getTodayProductionYieldAlerts.mockResolvedValue([])
    mocks.syncDashboardAlertEvents.mockImplementation(async (alerts: Array<{ key: string; title: string; detail: string; path: string; tone: string }>) => alerts.map(alert => ({ ...alert, id: alert.key, key: alert.key, detectedAt: '', lastDetectedAt: '', resolvedAt: null })))
  })

  it('muestra el bloque de accesos rápidos del dashboard', async () => {
    render(<Inicio />)

    await screen.findByText('Resumen del día')
    expect(screen.getByText('Acciones rápidas')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^comandas$/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^ventas$/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^menú$/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^mesas$/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^inventario$/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^clientes$/i })).toBeInTheDocument()
  })

  it('abre los accesos rápidos dentro del dashboard sin cambiar de ruta', async () => {
    render(<Inicio />)
    await screen.findByText('Resumen del día')

    const quickActions = screen.getByRole('heading', { name: 'Acciones rápidas' }).closest('.db-quick-card')
    expect(quickActions).not.toBeNull()
    const actions = within(quickActions as HTMLElement)
    const shortcuts = [
      ['Comandas', 'comandas'],
      ['Ventas', 'ventas'],
      ['Menú', 'menu'],
      ['Mesas', 'mesas'],
      ['Inventario', 'inventario'],
      ['Clientes', 'clientes'],
    ]

    for (const [label, shortcut] of shortcuts) {
      fireEvent.click(actions.getByRole('button', { name: new RegExp(`^${label}$`) }))
      expect(screen.getByRole('dialog', { name: `Acceso directo: ${shortcut}` })).toBeInTheDocument()
      expect(mocks.navigate).not.toHaveBeenCalled()
      fireEvent.click(screen.getByRole('button', { name: 'Cerrar panel' }))
    }
  })

  it('identifica los créditos autorizados y abre la comanda elegida desde el detalle del día', async () => {
    const createdAt = new Date().toISOString()
    mocks.getOrdersWithItems.mockResolvedValue([
      { id: 'credit-order', orderNumber: 466, status: 'pending', creditAuthorized: true, customerName: 'Elias Acosta', createdAt, totalAmount: 47.28, payments: [], items: [] },
      { id: 'pending-order', orderNumber: 465, status: 'pending', creditAuthorized: false, customerName: 'Cliente general', createdAt, totalAmount: 13.48, payments: [], items: [] },
    ] as never)
    render(<Inicio />)

    fireEvent.click(await screen.findByRole('button', { name: 'Ver 2 comandas de hoy' }))

    expect(await screen.findByRole('heading', { name: 'Comandas de hoy' })).toBeInTheDocument()
    expect(screen.getByText('Crédito autorizado')).toBeInTheDocument()
    expect(screen.getByText('Pendiente')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Abrir comanda #0466' }))

    expect(mocks.navigate).toHaveBeenCalledWith('/comandas', { state: { openOrderId: 'credit-order' } })
  })

  it('muestra la foto del plato y aclara cuántas unidades se vendieron', async () => {
    mocks.getProductRanking.mockResolvedValue([{
      name: 'Promo Full Kilo y Refresco',
      emoji: '🍱',
      imageUrl: '/optimized/productos/full-kilo.webp',
      count: 14,
      revenue: 165.2,
    }])
    const { container } = render(<Inicio />)

    expect(await screen.findByText('Platos más vendidos')).toBeInTheDocument()
    expect(container.querySelector('.st-thumb img')).toHaveAttribute('src', '/optimized/productos/full-kilo.webp')
    expect(screen.getByText('unidades')).toBeInTheDocument()
    expect(screen.getByText('14')).toBeInTheDocument()
  })

  it('evita que el tooltip tape el total del método de pago', async () => {
    mocks.getPaymentMethodSales.mockResolvedValue([{ method: 'cash', total: 45, count: 3 }])
    render(<Inicio />)

    await screen.findByText('Método de pago')
    expect(screen.getAllByTestId('doughnut-chart')[0]).toHaveAttribute('data-tooltip-enabled', 'false')
  })

  it('muestra un estado vacío compacto si todavía no hay cobros', async () => {
    render(<Inicio />)

    expect(await screen.findByText('Aún no hay cobros hoy')).toBeInTheDocument()
    expect(screen.queryByTestId('doughnut-chart[data-tooltip-enabled="false"]')).not.toBeInTheDocument()
  })

  it('arma el desglose de cobros desde las comandas cuando el RPC devuelve cero medios', async () => {
    mocks.getPaymentMethodSales.mockResolvedValue([])
    mocks.getOrdersWithItems.mockResolvedValue([{
      id: 'paid-order-1',
      status: 'paid',
      createdAt: `${dateKeyInTimeZone()}T12:00:00-04:00`,
      payments: [{ method: 'cash', amount: 45 }],
    }] as never)

    render(<Inicio />)

    expect(await screen.findByText('Efectivo')).toBeInTheDocument()
    expect(screen.queryByText('Aún no hay cobros hoy')).not.toBeInTheDocument()
  })

  it('reconstruye el gráfico desde las órdenes si el resumen tiene ventas pero el RPC del gráfico da cero', async () => {
    const today = dateKeyInTimeZone()
    mocks.getDailySales.mockResolvedValue([{ date: today, total: 0, count: 0 }])
    mocks.getDailySalesFromOrders.mockResolvedValue([{ date: today, total: 45, count: 3 }])

    render(<Inicio />)

    await waitFor(() => expect(mocks.getDailySalesFromOrders).toHaveBeenCalledWith(7))
    expect(await screen.findByTestId('sales-chart')).toBeInTheDocument()
  })

  it('reemplaza el resumen de producción de hoy por las producciones recientes en la misma fila', async () => {
    mocks.getRecentProductionBatches.mockResolvedValue([{
      id: 'batch-1',
      name: 'Porcionamiento de Pollo',
      productionDate: '2026-10-12',
      quantityProduced: 68,
      wasteQuantity: 1.5,
    }])
    render(<Inicio />)

    expect(await screen.findByText('Últimas producciones')).toBeInTheDocument()
    expect(await screen.findByText('Porcionamiento de Pollo')).toBeInTheDocument()
    expect(screen.getByText(/68 producidas/)).toBeInTheDocument()
    expect(screen.queryByText('Producción de hoy')).not.toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Últimas producciones' }).closest('.db-grid-3')).not.toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Ver historial' }))
    expect(mocks.navigate).toHaveBeenCalledWith('/produccion')
  })

  it('permite cambiar el período de la gráfica de ventas', async () => {
    render(<Inicio />)

    const period = await screen.findByRole('button', { name: 'Período de ventas' })
    fireEvent.click(period)
    fireEvent.click(screen.getByRole('option', { name: 'Últimos 30 días' }))

    await waitFor(() => expect(mocks.getDailySales).toHaveBeenCalledWith(30))
    fireEvent.click(screen.getByRole('button', { name: /actualizar datos de hoy/i }))
    await waitFor(() => expect(mocks.getDailySales).toHaveBeenLastCalledWith(30))
  })

  it('muestra alertas operativas y navega a su módulo', async () => {
    render(<Inicio />)

    await waitFor(() => expect(mocks.syncDashboardAlertEvents).toHaveBeenCalled())
    expect(mocks.syncDashboardAlertEvents.mock.calls[0]?.[0]).toEqual(expect.arrayContaining([expect.objectContaining({ key: 'inventory' }), expect.objectContaining({ key: 'credits' })]))

    const bell = await screen.findByRole('button', { name: /notificaciones: 2 pendientes/i })
    fireEvent.click(bell)

    expect(screen.getByText('Inventario requiere atención')).toBeInTheDocument()
    expect(screen.getByText('Créditos vencidos')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Abrir alerta: Inventario requiere atención' }))
    expect(mocks.navigate).toHaveBeenCalledWith('/inventario')
  })

  it('mantiene la página de alertas durante la animación de salida', async () => {
    const { container } = render(<Inicio />)

    fireEvent.click(await screen.findByRole('button', { name: /notificaciones: 2 pendientes/i }))
    const alertsPage = container.querySelector('.db-notifications')
    expect(alertsPage).not.toBeNull()

    fireEvent.click((alertsPage as HTMLElement).querySelector('.db-notifications-back') as HTMLButtonElement)

    expect(alertsPage).toHaveClass('closing')
    await waitFor(() => expect(container.querySelector('.db-notifications')).not.toBeInTheDocument())
  })

  it('muestra fecha y hora reales del historial persistido', async () => {
    mocks.syncDashboardAlertEvents.mockResolvedValueOnce([{
      id: 'event-1', key: 'inventory', title: 'Inventario requiere atención',
      detail: '1 producto agotado o con saldo negativo', path: '/inventario', tone: 'critical',
      detectedAt: '2026-10-13T16:05:00Z', lastDetectedAt: '2026-10-13T16:05:00Z', resolvedAt: null,
    }])
    const { container } = render(<Inicio />)

    fireEvent.click(await screen.findByRole('button', { name: /notificaciones: 1 pendiente/i }))

    expect(container.querySelector('time[datetime="2026-10-13T16:05:00Z"]')).toBeInTheDocument()
    expect(screen.queryByText('Activa')).not.toBeInTheDocument()
  })

  it('muestra cuándo detectó localmente una alerta si el historial no está instalado', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    mocks.syncDashboardAlertEvents.mockRejectedValueOnce(new Error('función de historial no instalada'))
    const { container } = render(<Inicio />)

    await waitFor(() => expect(mocks.syncDashboardAlertEvents).toHaveBeenCalled())
    fireEvent.click(await screen.findByRole('button', { name: /notificaciones: 2 pendientes/i }))

    expect(container.querySelectorAll('.db-notification-meta time[datetime]').length).toBeGreaterThan(0)
    expect(screen.queryByText(/Fecha y hora disponibles al instalar el historial de alertas/)).not.toBeInTheDocument()
    errorSpy.mockRestore()
  })

  it('permite marcar todas las alertas como leídas y borrarlas del panel', async () => {
    render(<Inicio />)

    fireEvent.click(await screen.findByRole('button', { name: /notificaciones: 2 pendientes/i }))
    fireEvent.click(screen.getByRole('button', { name: 'Marcar todas como leídas' }))
    expect(screen.getByRole('button', { name: /notificaciones: 2 pendientes, 0 sin leer/i })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Borrar todas las notificaciones' }))
    expect(screen.queryByText('Inventario requiere atención')).not.toBeInTheDocument()
    expect(screen.getByText('No hay alertas para mostrar')).toBeInTheDocument()
  })

  it('oculta accesos rápidos que el usuario no tiene autorizados', async () => {
    mocks.user = { id: 'manager-1', email: 'manager@fullchina.test', role: 'manager', allowedModules: ['/'] }
    render(<Inicio />)

    await screen.findByText('Resumen del día')
    expect(screen.queryByRole('button', { name: /nueva comanda/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^reportes$/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^inventario$/i })).not.toBeInTheDocument()
  })

  it('informa el error y permite reintentar la carga', async () => {
    mocks.getTodayStats.mockRejectedValueOnce(new Error('sin conexión')).mockResolvedValueOnce({ totalSales: 45, ordersCount: 3, avgTicket: 15 })
    render(<Inicio />)

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('1 sección no pudo actualizarse')
    fireEvent.click(screen.getByRole('button', { name: /reintentar/i }))

    await waitFor(() => expect(mocks.getTodayStats).toHaveBeenCalledTimes(2))
  })
})
