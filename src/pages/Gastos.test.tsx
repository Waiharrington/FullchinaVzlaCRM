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
    expect(screen.getByRole('dialog', { name: 'Registrar Nuevo Gasto' })).toBeInTheDocument()
  })

  it('abre el mismo formulario desde el estado vacío', async () => {
    render(<Gastos />)
    await screen.findByText('No hay gastos registrados')
    fireEvent.click(await screen.findByRole('button', { name: 'Registrar gasto' }))
    await waitFor(() => expect(screen.getByLabelText('Descripción del gasto')).toHaveFocus())
    expect(document.querySelector('.gst-form-col')).toHaveClass('open')
  })

  it('cierra la ventana emergente con Escape', async () => {
    render(<Gastos />)
    await screen.findByText('No hay gastos registrados')
    fireEvent.click(screen.getAllByRole('button', { name: 'Registrar Gasto' })[0])
    await screen.findByRole('dialog', { name: 'Registrar Nuevo Gasto' })
    fireEvent.keyDown(window, { key: 'Escape' })
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Registrar Nuevo Gasto' })).not.toBeInTheDocument())
  })

  it('incluye Otros como tipo de gasto y filtro', async () => {
    render(<Gastos />)
    await screen.findByText('No hay gastos registrados')
    fireEvent.click(screen.getByRole('button', { name: 'Filtros' }))
    expect(screen.getByRole('button', { name: 'Otros' })).toBeInTheDocument()
    fireEvent.click(screen.getAllByRole('button', { name: 'Registrar Gasto' })[0])
    fireEvent.click(await screen.findByRole('button', { name: 'Gasto Variable' }))
    expect(await screen.findByRole('option', { name: 'Otro' })).toBeInTheDocument()
  })
})
