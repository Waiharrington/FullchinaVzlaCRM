import { describe, expect, it } from 'vitest'
import { buildDailyFinancialRows, sumFinancialRows, weekRangeFor } from './dailyFinancialSummary'

describe('resumen financiero diario', () => {
  it('separa compras y categorías de gasto y calcula la diferencia', () => {
    const rows = buildDailyFinancialRows('2026-08',
      [{ createdAt: '2026-08-17T15:00:00Z', status: 'paid', totalAmount: 802.77 }, { createdAt: '2026-08-17T16:00:00Z', status: 'open', totalAmount: 50 }],
      [{ purchaseDate: '2026-08-17', totalAmount: 540.10 }],
      [{ expenseDate: '2026-08-17', category: 'fixed', amount: 256.32 }, { expenseDate: '2026-08-17', category: 'variable', amount: 26.21 }, { expenseDate: '2026-08-17', category: 'other', amount: 86.20 }],
    )
    const day = rows[16]
    expect(day.totalOutflows).toBeCloseTo(908.83)
    expect(day.difference).toBeCloseTo(-106.06)
  })

  it('obtiene semana lunes a domingo y suma sus filas', () => {
    expect(weekRangeFor('2026-08-20')).toEqual({ start: '2026-08-17', end: '2026-08-23' })
    const rows = buildDailyFinancialRows('2026-08', [{ createdAt: '2026-08-20T12:00:00', status: 'paid', totalAmount: 100 }], [], [])
    expect(sumFinancialRows(rows.filter(row => row.date >= '2026-08-17' && row.date <= '2026-08-23')).sales).toBe(100)
  })
})
