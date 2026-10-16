import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { ReportExplorer } from './ReportExplorer'

const mocks = vi.hoisted(() => ({ getOrdersWithItems: vi.fn(), getExpenses: vi.fn(), getPurchases: vi.fn(), getCredits: vi.fn(), getDailyCloses: vi.fn(), getIngredients: vi.fn(), getReportStockMovements: vi.fn(), getProductionBatches: vi.fn(), getCustomers: vi.fn(), getProducts: vi.fn(), getFinancialOperations: vi.fn(), getPayrollPayments: vi.fn(), getAdvances: vi.fn(), getAuditLogs: vi.fn() }))
vi.mock('../lib/dataService', () => mocks)

beforeEach(() => {
  localStorage.clear()
  Object.values(mocks).forEach(mock => mock.mockReset().mockResolvedValue([]))
})

describe('Centro de reportes', () => {
  it('permite buscar y guardar un reporte favorito', () => {
    render(<ReportExplorer />)
    expect(screen.getByText(/reportes disponibles/)).toBeInTheDocument()
    fireEvent.change(screen.getByRole('textbox', { name: 'Buscar reportes' }), { target: { value: 'inventario' } })
    expect(screen.getByText('Historial de inventario')).toBeInTheDocument()
    expect(screen.queryByText('Ventas por ítem')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Añadir Historial de inventario a favoritos' }))
    expect(JSON.parse(localStorage.getItem('fullchina-report-favorites') ?? '[]')).toContain('movements')
  })

  it('muestra un skeleton mientras carga un reporte', async () => {
    let finishLoad!: (rows: never[]) => void
    mocks.getOrdersWithItems.mockImplementation(() => new Promise<never[]>(resolve => { finishLoad = resolve }))
    render(<ReportExplorer />)
    fireEvent.click(screen.getAllByRole('button', { name: /Órdenes cerradas/i })[0])
    await waitFor(() => expect(mocks.getOrdersWithItems).toHaveBeenCalled())
    expect(screen.getByLabelText('Cargando reporte')).toHaveAttribute('aria-busy', 'true')
    finishLoad([])
    expect(await screen.findByText('Sin datos para este período')).toBeInTheDocument()
  }, 10000)

  it('abre un reporte, muestra estado vacío y consulta todas las páginas', async () => {
    render(<ReportExplorer />)
    fireEvent.click(screen.getAllByRole('button', { name: /Órdenes cerradas/i })[0])
    await waitFor(() => expect(mocks.getOrdersWithItems).toHaveBeenCalledWith(expect.stringContaining('T00:00:00-04:00'), expect.stringContaining('T00:00:00-04:00'), true))
    expect(await screen.findByText('Sin datos para este período')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Todos los reportes/i }))
    expect(screen.getByText('Encuentra el dato que necesitas')).toBeInTheDocument()
  }, 10000)
})
