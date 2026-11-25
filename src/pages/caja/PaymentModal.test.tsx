import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { FinancialAccount } from '../../lib/dataService'
vi.mock('../../context/rates-context', () => ({ useRates: () => ({ bcvRate: 800, updatedAt: null, stale: false, error: null, loading: false, refresh: () => undefined }) }))

import { PaymentModal } from './PaymentModal'
import { usePaymentForm } from './usePaymentForm'

const cashAccount = { id: 'acc-usd', name: 'Caja USD', currency: 'USD', accountType: 'cash', acceptsCustomerPayments: true, isActive: true } as FinancialAccount

function Harness(props: { payError?: string; paying?: boolean; onConfirm?: () => void; onSelectTab?: (m: string) => void; onClose?: () => void }) {
  const form = usePaymentForm()
  return (
    <PaymentModal
      form={form}
      bcvRate={800}
      customerName="Cliente general"
      closingPayment={false}
      paying={props.paying ?? false}
      payError={props.payError ?? ''}
      setPayError={() => undefined}
      accountsForMethod={() => [cashAccount]}
      ensureAccountForMethod={() => 'acc-usd'}
      subtotal={20}
      total={22}
      splitPrimaryAmountUsd={0}
      splitSecondaryAmountUsd={0}
      syncSplitFromPrimary={() => undefined}
      syncSplitFromSecondary={() => undefined}
      closePaymentModal={props.onClose ?? (() => undefined)}
      handleSelectPaymentTab={props.onSelectTab ?? (() => undefined)}
      handleConfirmPayment={props.onConfirm ?? (() => undefined)}
      handlePrintReceipt={() => undefined}
    />
  )
}

describe('PaymentModal', () => {
  it('muestra los métodos de pago y las acciones del cobro', () => {
    render(<Harness />)
    expect(screen.getByText(/Cobrar pedido/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Efectivo/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Pago combinado/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Confirmar pago/ })).toBeEnabled()
  })

  it('confirma, cancela y cambia de método llamando a los manejadores', () => {
    const onConfirm = vi.fn()
    const onClose = vi.fn()
    const onSelectTab = vi.fn()
    render(<Harness onConfirm={onConfirm} onClose={onClose} onSelectTab={onSelectTab} />)
    fireEvent.click(screen.getByRole('button', { name: /Confirmar pago/ }))
    fireEvent.click(screen.getByRole('button', { name: /Cancelar/ }))
    fireEvent.click(screen.getByRole('button', { name: /Pago combinado/ }))
    expect(onConfirm).toHaveBeenCalledTimes(1)
    expect(onClose).toHaveBeenCalled()
    expect(onSelectTab).toHaveBeenCalledWith('split')
  })

  it('muestra el error del cobro y bloquea la confirmación mientras se paga', () => {
    render(<Harness payError="El efectivo recibido no cubre el total" paying />)
    expect(screen.getByRole('alert')).toHaveTextContent('El efectivo recibido no cubre el total')
    expect(screen.getByRole('button', { name: /Confirmar pago/ })).toBeDisabled()
  })
})
