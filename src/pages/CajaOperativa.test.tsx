import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { CajaOperativa } from './CajaOperativa'
import type { CashSessionSnapshot, CashTransaction } from '../lib/dataService'

const mocks = vi.hoisted(() => ({
  getActiveCashSession: vi.fn(),
  getCashSessionHistory: vi.fn(),
  getCashSessionTransactions: vi.fn(),
  openCashSession: vi.fn(),
  addCashMovement: vi.fn(),
  closeCashSession: vi.fn(),
}))

vi.mock('../context/auth-context', () => ({
  useAuth: () => ({ user: { id: 'demo-cashier', email: 'caja@fullchinavzla.com', role: 'cashier', allowedModules: null } }),
}))

vi.mock('../lib/dataService', async () => {
  const actual = await vi.importActual('../lib/dataService')
  return { ...actual, ...mocks }
})

const activeSession: CashSessionSnapshot = {
  id: 'session-1', sessionNumber: 7, registerId: 'register-1', registerCode: 'caja-principal',
  registerName: 'Caja principal', status: 'open', openedAt: '2026-08-08T12:00:00.000Z',
  openedBy: 'demo-cashier', openingCashUsd: 20, openingCashVes: 100,
  cashSalesUsd: 35, cashSalesVes: 2500, paymentTotal: 38.12, paymentBreakdown: { cash: 38.12 }, paymentBreakdownVes: { cash: 2500 },
  movementInUsd: 0, movementOutUsd: 5, movementInVes: 0, movementOutVes: 0,
  expectedCashUsd: 50, expectedCashVes: 2600, countedCashUsd: null, countedCashVes: null,
  differenceUsd: null, differenceVes: null, closedAt: null, movements: [],
}

const manyCashTransactions: CashTransaction[] = Array.from({ length: 12 }, (_, index) => ({
  id: `payment-${index}`,
  kind: 'payment',
  direction: 'in',
  orderNumber: 100 + index,
  orderType: 'delivery',
  customerName: `Cliente ${index}`,
  method: 'cash',
  currency: 'USD',
  amount: 10 + index,
  referenceNumber: null,
  createdAt: '2026-10-16T12:00:00.000Z',
  itemsSummary: null,
}))

describe('CajaOperativa', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getCashSessionHistory.mockResolvedValue([])
    mocks.getCashSessionTransactions.mockResolvedValue([])
  })

  it('permite abrir la caja cuando no existe un turno', async () => {
    mocks.getActiveCashSession.mockResolvedValue(null)
    mocks.openCashSession.mockResolvedValue('session-1')

    render(<CajaOperativa />)

    expect(await screen.findByText('La caja está cerrada')).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Fondo inicial en USD'), { target: { value: '25.50' } })
    fireEvent.change(screen.getByLabelText('Fondo inicial en bolívares'), { target: { value: '1200' } })
    fireEvent.click(screen.getByRole('button', { name: /abrir caja principal/i }))

    await waitFor(() => expect(mocks.openCashSession).toHaveBeenCalledWith(expect.objectContaining({
      openingCashUsd: 25.5,
      openingCashVes: 1200,
      userId: 'demo-cashier',
    })))
  })

  it('separa el efectivo físico en USD y bolívares sin incluir el punto', async () => {
    mocks.getActiveCashSession.mockResolvedValue(activeSession)

    render(<CajaOperativa />)

    expect(await screen.findByText('Turno activo')).toBeInTheDocument()
    expect(screen.getByText('Efectivo en dólares')).toBeInTheDocument()
    expect(screen.getByText('Efectivo en bolívares')).toBeInTheDocument()
    expect(screen.getByText('Efectivo recibido')).toBeInTheDocument()
    expect(screen.queryByText('Punto')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /iniciar arqueo y cierre/i })).toBeEnabled()
  })

  it('muestra los movimientos en tandas manuales de diez y respeta el filtro', async () => {
    mocks.getActiveCashSession.mockResolvedValue(activeSession)
    mocks.getCashSessionTransactions.mockResolvedValue(manyCashTransactions)

    render(<CajaOperativa />)

    expect(await screen.findByText('#109 · Cliente 9')).toBeInTheDocument()
    expect(screen.queryByText('#110 · Cliente 10')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Ver 2 más' }))
    expect(await screen.findByText('#111 · Cliente 11')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Mostrar menos' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Salidas' }))
    expect(await screen.findByText('No hay salidas registradas')).toBeInTheDocument()
  })
})
