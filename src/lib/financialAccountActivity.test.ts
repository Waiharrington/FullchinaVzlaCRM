import { describe, expect, it } from 'vitest'
import { buildFinancialAccountActivity } from './financialAccountActivity'

describe('buildFinancialAccountActivity', () => {
  it('reconcilia cobros y egresos por cuenta respetando su moneda', () => {
    const result = buildFinancialAccountActivity(
      [{ id: 'usd', currency: 'USD' }, { id: 'ves', currency: 'VES' }],
      [{ status: 'paid', createdAt: '2026-08-23T16:00:00-04:00', bcvRate: 800, payments: [{ amount: 20, accountId: 'usd' }, { amount: 10, accountId: 'ves' }] }],
      [{ expenseDate: '2026-08-23', amount: 2, accountId: 'ves', exchangeRate: 800 }],
      [{ purchaseDate: '2026-08-23', totalAmount: 5, accountId: 'usd', exchangeRate: null, isPaid: true }],
      '2026-08-23',
      '2026-08-23',
    )

    expect(result.get('usd')).toEqual({ inflows: 20, outflows: 5, net: 15 })
    expect(result.get('ves')).toEqual({ inflows: 8000, outflows: 1600, net: 6400 })
  })

  it('excluye compras pendientes y movimientos fuera del período', () => {
    const result = buildFinancialAccountActivity(
      [{ id: 'usd', currency: 'USD' }],
      [],
      [{ expenseDate: '2026-08-22', amount: 3, accountId: 'usd', exchangeRate: null }],
      [{ purchaseDate: '2026-08-23', totalAmount: 8, accountId: 'usd', exchangeRate: null, isPaid: false }],
      '2026-08-23',
      '2026-08-23',
    )
    expect(result.get('usd')).toEqual({ inflows: 0, outflows: 0, net: 0 })
  })
})
