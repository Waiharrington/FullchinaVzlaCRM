import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { CajaOperativa } from './CajaOperativa'
import type { CashSessionSnapshot } from '../lib/dataService'

const mocks = vi.hoisted(() => ({
  getActiveCashSession: vi.fn(),
  getCashSessionHistory: vi.fn(),
  openCashSession: vi.fn(),
  addCashMovement: vi.fn(),
  closeCashSession: vi.fn(),
}))

vi.mock('../context/auth-context', () => ({
  useAuth: () => ({ user: { id: 'demo-cashier', email: 'caja@fullchinavzla.com', role: 'cashier' } }),
}))

vi.mock('../lib/dataService', async () => {
  const actual = await vi.importActual('../lib/dataService')
  return { ...actual, ...mocks }
})

const activeSession: CashSessionSnapshot = {
  id: 'session-1', sessionNumber: 7, registerId: 'register-1', registerCode: 'caja-principal',
  registerName: 'Caja principal', status: 'open', openedAt: '2026-08-08T12:00:00.000Z',
  openedBy: 'demo-cashier', openingCashUsd: 20, openingCashVes: 100,
  cashSalesUsd: 35, paymentTotal: 50, paymentBreakdown: { cash: 35, mobile: 15 },
  movementInUsd: 0, movementOutUsd: 5, movementInVes: 0, movementOutVes: 0,
  expectedCashUsd: 50, expectedCashVes: 100, countedCashUsd: null, countedCashVes: null,
  differenceUsd: null, differenceVes: null, closedAt: null, movements: [],
}

describe('CajaOperativa', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getCashSessionHistory.mockResolvedValue([])
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

  it('muestra el efectivo esperado y el desglose del turno activo', async () => {
    mocks.getActiveCashSession.mockResolvedValue(activeSession)

    render(<CajaOperativa />)

    expect(await screen.findByText('Turno activo')).toBeInTheDocument()
    expect(screen.getByText('Efectivo esperado USD')).toBeInTheDocument()
    expect(screen.getByText('Pago móvil')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /iniciar arqueo y cierre/i })).toBeEnabled()
  })
})
