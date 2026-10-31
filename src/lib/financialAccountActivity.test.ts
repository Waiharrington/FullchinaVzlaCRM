import { describe, expect, it } from 'vitest'
import { buildFinancialAccountActivity } from './financialAccountActivity'

describe('buildFinancialAccountActivity', () => {
  it('registra el efectivo recibido y descuenta el vuelto de una cuenta bancaria en otra moneda', () => {
    const result = buildFinancialAccountActivity(
      [{ id: 'cash-usd', currency: 'USD' }, { id: 'bank-ves', currency: 'VES' }],
      [{ status: 'paid', createdAt: '2026-08-23T16:00:00-04:00', bcvRate: 800, payments: [{
        method: 'cash', amount: 22, accountId: 'cash-usd', receivedAmount: 25, receivedCurrency: 'USD',
        receivedExchangeRate: null, changeAmount: 2400, changeCurrency: 'VES', changeAccountId: 'bank-ves', changeExchangeRate: 800,
      }] }],
      [], [], '2026-08-23', '2026-08-23',
    )

    expect(result.get('cash-usd')).toEqual({ inflows: 25, outflows: 0, net: 25 })
    expect(result.get('bank-ves')).toEqual({ inflows: 0, outflows: 2400, net: -2400 })
  })

  it('reconcilia el neto cuando el vuelto sale de la misma cuenta que recibe el efectivo', () => {
    const result = buildFinancialAccountActivity(
      [{ id: 'cash-usd', currency: 'USD' }],
      [{ status: 'paid', createdAt: '2026-08-23T16:00:00-04:00', bcvRate: 800, payments: [{
        method: 'cash', amount: 22, accountId: 'cash-usd', receivedAmount: 25, receivedCurrency: 'USD',
        changeAmount: 3, changeCurrency: 'USD', changeAccountId: 'cash-usd',
      }] }],
      [], [], '2026-08-23', '2026-08-23',
    )

    expect(result.get('cash-usd')).toEqual({ inflows: 25, outflows: 3, net: 22 })
  })

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
