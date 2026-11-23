import { describe, expect, it, vi } from 'vitest'

vi.mock('../supabase', () => ({ supabase: {}, subscribeToDataChanges: () => () => {} }))

import { fetchRows } from './client'

const makeQuery = (total: number, ranges: Array<[number, number]>) => {
  const rows = (from: number, to: number) => Array.from({ length: Math.max(0, Math.min(to, total - 1) - from + 1) }, (_, i) => ({ n: from + i }))
  const q = {
    range: async (from: number, to: number) => { ranges.push([from, to]); return { data: rows(from, to), error: null } },
    then: (resolve: (v: unknown) => void) => resolve({ data: rows(0, total - 1), error: null }),
  }
  return q as unknown as Parameters<typeof fetchRows>[0] extends () => infer R ? R : never
}

describe('fetchRows', () => {
  it('una sola petición cuando allPages es false', async () => {
    const ranges: Array<[number, number]> = []
    const rows = await fetchRows(() => makeQuery(3, ranges), false)
    expect(rows).toHaveLength(3)
    expect(ranges).toEqual([])
  })

  it('junta todas las páginas en orden y se detiene en la página incompleta', async () => {
    const ranges: Array<[number, number]> = []
    const rows = await fetchRows(() => makeQuery(1203, ranges), true)
    expect(rows.map(r => r.n)).toEqual(Array.from({ length: 1203 }, (_, i) => i))
    expect(ranges).toHaveLength(4)
  })

  it('pide otra tanda si todas las páginas vienen llenas', async () => {
    const ranges: Array<[number, number]> = []
    const rows = await fetchRows(() => makeQuery(2000, ranges), true)
    expect(rows).toHaveLength(2000)
    expect(ranges).toHaveLength(8)
  })
})
