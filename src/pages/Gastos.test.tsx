import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Gastos } from './Gastos'

const mocks = vi.hoisted(() => ({
  createExpense: vi.fn(),
  getExpenses: vi.fn(),
  getFinancialAccounts: vi.fn(),
  getExchangeRates: vi.fn(),
}))

vi.mock('../context/auth-context', () => ({
  useAuth: () => ({ user: { id: 'owner-1', role: 'owner' } }),
}))

vi.mock('../lib/dataService', () => ({
  createExpense: mocks.createExpense,
  getExpenses: mocks.getExpenses,
  getFinancialAccounts: mocks.getFinancialAccounts,
}))

vi.mock('../lib/rates', () => ({ getExchangeRates: mocks.getExchangeRates }))

describe('Acciones de Gastos', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getExpenses.mockResolvedValue([])
    mocks.getFinancialAccounts.mockResolvedValue([])
    mocks.getExchangeRates.mockResolvedValue({ bcv: 800 })
  })

  it('abre el formulario y enfoca la descripción desde el botón principal', async () => {
    render(<Gastos />)
    await screen.findByText('No hay gastos registrados')
    const primaryButton = screen.getAllByRole('button', { name: 'Registrar Gasto' })
      .find(button => button.getAttribute('aria-controls') === 'expense-form')
    expect(primaryButton).toBeDefined()
    fireEvent.click(primaryButton!)
    await waitFor(() => expect(screen.getByLabelText('Descripción del gasto')).toHaveFocus())
    expect(document.querySelector('.gst-form-col')).toHaveClass('open')
  })

  it('abre el mismo formulario desde el estado vacío', async () => {
    render(<Gastos />)
    await screen.findByText('No hay gastos registrados')
    fireEvent.click(await screen.findByRole('button', { name: 'Registrar gasto' }))
    await waitFor(() => expect(screen.getByLabelText('Descripción del gasto')).toHaveFocus())
    expect(document.querySelector('.gst-form-col')).toHaveClass('open')
  })
})
