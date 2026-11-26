import { describe, expect, it, vi } from 'vitest'

const rpc = vi.hoisted(() => vi.fn(() => Promise.resolve({ error: null })))
vi.mock('./supabase', () => {
  const query = {
    select: () => query, eq: () => query, gte: () => query,
    order: () => Promise.resolve({ data: [], error: null }),
  }
  const client = { rpc, from: () => query }
  return { supabase: client, customerSupabase: client }
})

import { getPendingWebOrders } from './publicOrders'

describe('getPendingWebOrders', () => {
  it('pide el vencimiento una sola vez por día, no en cada lectura', async () => {
    // Cada ejecución es una escritura que avisa un cambio: repetirla recargaba Comandas sin fin.
    await getPendingWebOrders()
    await getPendingWebOrders()
    await getPendingWebOrders()
    expect(rpc).toHaveBeenCalledTimes(1)
  })
})
