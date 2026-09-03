import { describe, expect, it } from 'vitest'
import { buildPaymentBreakdown } from './paymentBreakdown'
import type { FinancialAccount, FullOrder } from './dataService'

const order = (rate: number, payments: FullOrder['payments']): FullOrder => ({
  id: crypto.randomUUID(), orderNumber: 1, status: 'paid', fulfillmentStatus: 'delivered', notes: null,
  orderType: 'takeaway', tableNumber: null, customerName: 'Cliente', customerPhone: null,
  customerAddress: null, customerIdentification: null, bcvRate: rate, createdBy: 'owner',
  createdAt: '2026-09-02T16:00:00-04:00', updatedAt: '2026-09-02T16:00:00-04:00',
  items: [], payments, totalAmount: payments.reduce((sum, payment) => sum + payment.amount, 0),
})

const accounts: FinancialAccount[] = [
  { id: 'banesco', name: 'Banesco', accountType: 'bank', currency: 'VES', isActive: true, acceptsCustomerPayments: true, openingBalance: 0, currentBalance: 0 },
  { id: 'cash-usd', name: 'Caja Full China', accountType: 'cash', currency: 'USD', isActive: true, acceptsCustomerPayments: true, openingBalance: 0, currentBalance: 0 },
]

describe('buildPaymentBreakdown', () => {
  it('muestra como principal el monto histórico en Bs para cuentas VES', () => {
    const result = buildPaymentBreakdown([
      order(800, [{ id: 'p1', method: 'mobile', amount: 10, accountId: 'banesco', createdAt: '2026-09-02' }]),
      order(810, [{ id: 'p2', method: 'mobile', amount: 5, accountId: 'banesco', createdAt: '2026-09-02' }]),
    ], accounts, 900)

    expect(result['mobile:VES']).toMatchObject({ currency: 'VES', amountUsd: 15, amountNative: 12050 })
  })

  it('mantiene USD como monto principal sin convertirlo a Bs', () => {
    const result = buildPaymentBreakdown([
      order(800, [{ id: 'p1', method: 'cash', amount: 20, accountId: 'cash-usd', createdAt: '2026-09-02' }]),
    ], accounts, 900)

    expect(result['cash:USD']).toMatchObject({ currency: 'USD', amountUsd: 20, amountNative: 20 })
  })
})
