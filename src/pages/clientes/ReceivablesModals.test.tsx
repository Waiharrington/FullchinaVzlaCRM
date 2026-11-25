import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Credit } from '../../lib/dataService'

const mocks = vi.hoisted(() => ({ addCreditPayment: vi.fn(), getCustomerOrders: vi.fn(), getCustomerPaymentAccounts: vi.fn() }))
vi.mock('../../lib/dataService', () => ({
  addCreditPayment: mocks.addCreditPayment,
  getCustomerOrders: mocks.getCustomerOrders,
  getCustomerPaymentAccounts: mocks.getCustomerPaymentAccounts,
}))
vi.mock('../../components/MoneyWithBcv', () => ({ MoneyWithBcv: ({ usd }: { usd: number }) => <span>{`USD ${usd}`}</span> }))
vi.mock('../../components/ReceivablePaymentEditor', () => ({
  ReceivablePaymentEditor: ({ onSubmit, error }: { onSubmit: (p: unknown[], n: string) => void; error?: string }) => (
    <div><button type="button" onClick={() => onSubmit([{ amount: 5 }], 'nota')}>Enviar pago</button>{error && <p>{error}</p>}</div>
  ),
}))

import { ReceivablesModals } from './ReceivablesModals'

const credits = [
  { id: 'k1', customerName: 'Ana Pérez', balancePending: 10, createdAt: '2026-11-20T00:00:00Z', orderId: null, customerId: null },
  { id: 'k2', customerName: 'Luis Gil', balancePending: 0, createdAt: '2026-11-20T00:00:00Z', orderId: null, customerId: null },
] as unknown as Credit[]

const renderModals = (overrides = {}) => {
  const props = { bcvRate: 900, credits, onClose: vi.fn(), onRefreshCredits: vi.fn().mockResolvedValue(undefined), pendingOrderCount: 0, totalOutstanding: 10, ...overrides }
  render(<ReceivablesModals {...props} />)
  return props
}

describe('ReceivablesModals', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    vi.clearAllMocks()
    mocks.addCreditPayment.mockResolvedValue(undefined)
    mocks.getCustomerOrders.mockResolvedValue([])
    mocks.getCustomerPaymentAccounts.mockResolvedValue([])
  })
  afterEach(() => vi.useRealTimers())

  it('lista solo las cuentas con saldo pendiente', () => {
    renderModals()
    expect(screen.getByText('Ana Pérez')).toBeTruthy()
    expect(screen.queryByText('Luis Gil')).toBeNull()
    expect(screen.getByText('1 cuentas activas')).toBeTruthy()
  })

  it('registra el pago, refresca los créditos y vuelve a la lista', async () => {
    const props = renderModals()
    fireEvent.click(screen.getByRole('button', { name: 'Registrar pago' }))
    await act(async () => { vi.advanceTimersByTime(250) })
    fireEvent.click(await screen.findByRole('button', { name: 'Enviar pago' }))
    await waitFor(() => expect(mocks.addCreditPayment).toHaveBeenCalledWith({ creditId: 'k1', payments: [{ amount: 5 }], notes: 'nota' }))
    await waitFor(() => expect(props.onRefreshCredits).toHaveBeenCalled())
    await act(async () => { vi.advanceTimersByTime(250) })
    expect(await screen.findByRole('button', { name: 'Registrar pago' })).toBeTruthy()
    expect(props.onClose).not.toHaveBeenCalled()
  })

  it('muestra el error si el pago falla y no cambia de vista', async () => {
    mocks.addCreditPayment.mockRejectedValue(new Error('sin cuenta'))
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    renderModals()
    fireEvent.click(screen.getByRole('button', { name: 'Registrar pago' }))
    await act(async () => { vi.advanceTimersByTime(250) })
    fireEvent.click(await screen.findByRole('button', { name: 'Enviar pago' }))
    expect(await screen.findByText('No se pudo registrar el pago: sin cuenta')).toBeTruthy()
    spy.mockRestore()
  })

  it('cancelar desde el abono cierra todo', async () => {
    const props = renderModals()
    fireEvent.click(screen.getByRole('button', { name: 'Registrar pago' }))
    await act(async () => { vi.advanceTimersByTime(250) })
    fireEvent.click(await screen.findByRole('button', { name: 'Cancelar' }))
    await act(async () => { vi.advanceTimersByTime(250) })
    expect(props.onClose).toHaveBeenCalled()
  })
})
