import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Inicio } from './Inicio'

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  refreshBcv: vi.fn(),
  user: { id: 'owner-1', email: 'owner@fullchina.test', role: 'owner' as 'owner' | 'manager' | 'cashier', allowedModules: null as string[] | null },
  getTodayStats: vi.fn(),
  getOrdersWithItems: vi.fn(),
  getDailySales: vi.fn(),
  getProductRanking: vi.fn(),
  getCredits: vi.fn(),
  getPaymentMethodSales: vi.fn(),
  getProductionStats: vi.fn(),
  getIngredients: vi.fn(),
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
  getProductRanking: mocks.getProductRanking,
  getCredits: mocks.getCredits,
  getPaymentMethodSales: mocks.getPaymentMethodSales,
  getProductionStats: mocks.getProductionStats,
  getIngredients: mocks.getIngredients,
}))

describe('Dashboard Inicio', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.user = { id: 'owner-1', email: 'owner@fullchina.test', role: 'owner', allowedModules: null }
    mocks.getTodayStats.mockResolvedValue({ totalSales: 45, ordersCount: 3, avgTicket: 15 })
    mocks.getOrdersWithItems.mockResolvedValue([])
    mocks.getDailySales.mockResolvedValue([{ date: '2026-08-28', total: 45 }])
    mocks.getProductRanking.mockResolvedValue([])
    mocks.getCredits.mockResolvedValue([{ id: 'credit-1', customerName: 'Cliente', balancePending: 10, status: 'pending' }])
    mocks.getPaymentMethodSales.mockResolvedValue([])
    mocks.getProductionStats.mockResolvedValue({ batchesToday: 0, avgYield: 0, totalWaste: 0, avgCostPerPortion: 0 })
    mocks.getIngredients.mockResolvedValue([{ id: 'ingredient-1', name: 'Aceite', currentStock: -2, unitSymbol: 'L', stockValue: 0 }])
  })

  it('muestra el bloque de accesos rápidos del dashboard', async () => {
    render(<Inicio />)

    await screen.findByText('Resumen del día')
    expect(screen.getByText('Acciones rápidas')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^comandas$/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^ventas$/i })).toBeInTheDocument()
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

  it('presenta el acceso al plan cuando todavía no hay lotes de producción', async () => {
    render(<Inicio />)

    expect(await screen.findByText('Aún no hay producción')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Ver plan de producción' })).toBeInTheDocument()
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

    const bell = await screen.findByRole('button', { name: /notificaciones: 2 pendientes/i })
    fireEvent.click(bell)

    expect(screen.getByText('Inventario requiere atención')).toBeInTheDocument()
    expect(screen.getByText('Cobros pendientes')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Abrir alerta: Inventario requiere atención' }))
    expect(mocks.navigate).toHaveBeenCalledWith('/inventario')
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
