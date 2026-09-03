import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Finanzas } from './Finanzas'

const mocks = vi.hoisted(() => ({
  getOrdersWithItems: vi.fn(),
  getExpenses: vi.fn(),
  getPurchases: vi.fn(),
  getRecipeSummaries: vi.fn(),
  getPayrollSummary: vi.fn(),
  getFinancialOperations: vi.fn(),
  getFinancialAccounts: vi.fn(),
}))

vi.mock('../lib/dataService', () => ({
  ...mocks,
  updateFinancialAccountOpeningBalance: vi.fn(),
  createFinancialTransfer: vi.fn(),
}))
vi.mock('../context/rates-context', () => ({ useRates: () => ({ bcvRate: 800 }) }))
vi.mock('../context/auth-context', () => ({ useAuth: () => ({ user: { id: 'owner-1' } }) }))

describe('Finanzas', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getOrdersWithItems.mockResolvedValue([])
    mocks.getExpenses.mockResolvedValue([])
    mocks.getPurchases.mockRejectedValue(new Error('compras no disponibles'))
    mocks.getRecipeSummaries.mockResolvedValue(new Map())
    mocks.getPayrollSummary.mockResolvedValue({ periods: [], bonuses: [] })
    mocks.getFinancialOperations.mockResolvedValue([])
    mocks.getFinancialAccounts.mockResolvedValue([{
      id: 'cash-usd', name: 'Caja Full China', accountType: 'cash', currency: 'USD',
      isActive: true, acceptsCustomerPayments: true, openingBalance: 10, currentBalance: 10,
    }])
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
  })

  it('mantiene las cuentas visibles y abre el control diario aunque falle Compras', async () => {
    render(<Finanzas />)

    expect(await screen.findByText('Caja Full China')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Cobros recibidos en dólares/i }))

    const dialog = await screen.findByRole('dialog')
    expect(dialog).toHaveTextContent('CONTROL DIARIO DE SALDOS')
    expect(dialog).toHaveTextContent('Caja Full China')
    expect(dialog.parentElement).toBe(document.body)
    await waitFor(() => expect(mocks.getFinancialAccounts).toHaveBeenCalled())
  })
})
