import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ReceivablePaymentEditor } from './ReceivablePaymentEditor'
import type { FinancialAccount } from '../lib/dataService'

const accounts: FinancialAccount[] = [
  { id: 'cash-usd', name: 'Efectivo USD', accountType: 'cash', currency: 'USD', isActive: true, acceptsCustomerPayments: true, openingBalance: 0, currentBalance: 0 },
  { id: 'cash-ves', name: 'Efectivo Bs', accountType: 'cash', currency: 'VES', isActive: true, acceptsCustomerPayments: true, openingBalance: 0, currentBalance: 0 },
  { id: 'bank-ves', name: 'Banco Exterior', accountType: 'bank', currency: 'VES', isActive: true, acceptsCustomerPayments: true, openingBalance: 0, currentBalance: 0 },
]

describe('ReceivablePaymentEditor', () => {
  it('suma métodos mixtos y calcula vuelto a una cuenta distinta y en otra moneda', () => {
    const onSubmit = vi.fn()
    render(<ReceivablePaymentEditor credit={{ balancePending: 22 }} accounts={accounts} exchangeRate={800} saving={false} error="" onSubmit={onSubmit} />)

    const cashPart = screen.getByRole('region', { name: 'Método de pago 1' })
    fireEvent.change(within(cashPart).getByLabelText('Monto recibido ($)'), { target: { value: '20' } })
    fireEvent.change(within(cashPart).getByLabelText('Monto que abona al saldo (USD)'), { target: { value: '15' } })
    expect(within(cashPart).getByText('Vuelto a entregar: $5.00')).toBeInTheDocument()
    fireEvent.change(within(cashPart).getByLabelText('Moneda del vuelto'), { target: { value: 'VES' } })
    expect(within(cashPart).getByText('Vuelto a entregar: Bs. 4000.00')).toBeInTheDocument()
    expect((within(cashPart).getByLabelText('¿De qué cuenta sale el vuelto?') as HTMLSelectElement).value).toBe('cash-ves')

    fireEvent.click(screen.getByRole('button', { name: /agregar otro método/i }))
    const mobilePart = screen.getByRole('region', { name: 'Método de pago 2' })
    fireEvent.change(within(mobilePart).getAllByRole('spinbutton')[0], { target: { value: '7' } })
    fireEvent.change(within(mobilePart).getByLabelText('Referencia del pago'), { target: { value: 'MIX-22' } })
    expect(screen.getByText('$22.00 / $22.00')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Confirmar abono' }))
    expect(onSubmit).toHaveBeenCalledWith([
      expect.objectContaining({ amount: 15, method: 'cash', receivedAmount: 20, receivedCurrency: 'USD', changeAmount: 4000, changeCurrency: 'VES', changeAccountId: 'cash-ves', changeExchangeRate: 800 }),
      expect.objectContaining({ amount: 7, method: 'mobile', accountId: 'bank-ves', exchangeRate: 800, referenceNumber: 'MIX-22' }),
    ], '')
  })
})
