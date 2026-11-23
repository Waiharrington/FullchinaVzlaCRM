import { beforeEach, describe, expect, it, vi } from 'vitest'

const calls: Array<[number, number]> = []
const TOTAL = 1203

vi.mock('../supabase', () => {
  const makeQuery = () => {
    const q: Record<string, unknown> = {}
    for (const m of ['select', 'in', 'gte', 'lt', 'lte', 'order']) q[m] = () => q
    q.range = async (from: number, to: number) => {
      calls.push([from, to])
      const rows = []
      for (let i = from; i <= Math.min(to, TOTAL - 1); i++) {
        rows.push({ id: `o${i}`, order_number: i, status: 'paid', created_at: '2026-01-01T00:00:00Z', items: [], payments: [] })
      }
      return { data: rows, error: null, count: TOTAL }
    }
    return q
  }
  return { supabase: { from: () => makeQuery() }, subscribeToDataChanges: () => () => {} }
})

import { getOrdersWithItems } from './orders'

describe('getOrdersWithItems · allPages', () => {
  beforeEach(() => { calls.length = 0 })

  it('trae todas las páginas, sin duplicados y en orden', async () => {
    const orders = await getOrdersWithItems(undefined, undefined, true)
    expect(orders).toHaveLength(TOTAL)
    expect(orders.map(o => o.orderNumber)).toEqual(Array.from({ length: TOTAL }, (_, i) => i))
    expect(calls).toEqual([[0, 499], [500, 999], [1000, 1499], [1500, 1999]])
  })
})
