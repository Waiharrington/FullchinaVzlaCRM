import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
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
    expect(dialog).toHaveTextContent(/Control diario de saldos/i)
    expect(dialog).toHaveTextContent('Caja Full China')
    expect(dialog).toHaveClass('fin-dialog', 'fin-account-modal', 'fin-ledger-modal')
    expect(dialog.parentElement?.parentElement).toBe(document.body)
    await waitFor(() => expect(mocks.getFinancialAccounts).toHaveBeenCalled())
  })

  it('usa el mismo sistema visual y permite cerrar las ventanas con Escape', async () => {
    render(<Finanzas />)

    expect(await screen.findByText('Caja Full China')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Caja Full China/i }))

    const accountDialog = await screen.findByRole('dialog', { name: 'Caja Full China' })
    expect(accountDialog).toHaveClass('fin-dialog', 'fin-account-modal')
    expect(accountDialog.querySelector('.fin-dialog-header')).toBeInTheDocument()
    expect(accountDialog.querySelector('.fin-dialog-actions')).toBeInTheDocument()

    fireEvent.keyDown(document, { key: 'Escape' })
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Caja Full China' })).not.toBeInTheDocument())

    fireEvent.click(screen.getByRole('button', { name: /Registrar transferencia/i }))
    const transferDialog = await screen.findByRole('dialog', { name: 'Registrar transferencia' })
    expect(transferDialog).toHaveClass('fin-dialog', 'fin-transfer-modal')
    expect(screen.getByLabelText(/Concepto/i)).toHaveClass('fin-field-control')
    expect(screen.getByRole('button', { name: /Guardar transferencia/i })).toHaveClass('fin-dialog-primary')
  })

  it('prioriza bolívares en cobros VES y deja USD como referencia secundaria', async () => {
    mocks.getFinancialAccounts.mockResolvedValue([
      { id: 'banesco', name: 'Banesco', accountType: 'bank', currency: 'VES', isActive: true, acceptsCustomerPayments: true, openingBalance: 0, currentBalance: 8000 },
      { id: 'cash-usd', name: 'Caja Full China', accountType: 'cash', currency: 'USD', isActive: true, acceptsCustomerPayments: true, openingBalance: 0, currentBalance: 20 },
    ])
    mocks.getOrdersWithItems.mockResolvedValue([{
      id: 'order-1', orderNumber: 1, status: 'paid', fulfillmentStatus: 'delivered', notes: null,
      orderType: 'takeaway', tableNumber: null, customerName: 'Cliente', customerPhone: null,
      customerAddress: null, customerIdentification: null, bcvRate: 800, createdBy: 'owner-1',
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), items: [], totalAmount: 30,
      payments: [
        { id: 'pay-ves', method: 'mobile', amount: 10, accountId: 'banesco', createdAt: new Date().toISOString() },
        { id: 'pay-usd', method: 'cash', amount: 20, accountId: 'cash-usd', createdAt: new Date().toISOString() },
      ],
    }])

    render(<Finanzas />)

    const heading = await screen.findByRole('heading', { name: 'Cierre por Método de Pago' })
    const card = heading.closest('.fin-card')
    expect(card).not.toBeNull()
    expect(within(card as HTMLElement).getByText('Bs. 8.000,00')).toBeInTheDocument()
    expect(within(card as HTMLElement).getByText('$10,00 de referencia')).toBeInTheDocument()
    expect(within(card as HTMLElement).getByText('$20,00')).toBeInTheDocument()
  })
})
