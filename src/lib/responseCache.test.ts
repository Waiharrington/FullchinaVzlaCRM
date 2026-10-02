import { describe, expect, it, vi } from 'vitest'
import { createResponseCache } from './responseCache'

const cacheOptions = {
  ttlMs: 1_000,
  maxEntries: 10,
  tableDependencies: { v_orders: ['orders', 'order_items'] },
}

describe('shared Supabase response cache', () => {
  it('deduplicates simultaneous reads and returns independently readable responses', async () => {
    const cache = createResponseCache(cacheOptions)
    let resolveFetch!: (response: Response) => void
    const load = vi.fn(() => new Promise<Response>(resolve => { resolveFetch = resolve }))

    const first = cache.fetch('user-a|orders', 'orders', load)
    const second = cache.fetch('user-a|orders', 'orders', load)
    expect(load).toHaveBeenCalledTimes(1)
    resolveFetch(new Response('fresh data', { headers: { 'content-type': 'text/plain' } }))
    const [firstResponse, secondResponse] = await Promise.all([first, second])
    expect(await firstResponse.text()).toBe('fresh data')
    expect(await secondResponse.text()).toBe('fresh data')
  })

  it('serves cache hits and expires them on schedule', async () => {
    let now = 100
    const cache = createResponseCache({ ...cacheOptions, now: () => now })
    const load = vi.fn(async () => new Response(String(load.mock.calls.length)))

    expect(await (await cache.fetch('key', 'orders', load)).text()).toBe('1')
    expect(await (await cache.fetch('key', 'orders', load)).text()).toBe('1')
    now += 1_001
    expect(await (await cache.fetch('key', 'orders', load)).text()).toBe('2')
    expect(load).toHaveBeenCalledTimes(2)
  })

  it('invalidates direct rows, dependent views, and RPC results on mutations', async () => {
    const cache = createResponseCache(cacheOptions)
    const direct = vi.fn(async () => new Response('old direct'))
    const view = vi.fn(async () => new Response('old view'))
    const rpc = vi.fn(async () => new Response('old rpc'))
    const unrelated = vi.fn(async () => new Response('still cached'))

    await cache.fetch('orders', 'orders', direct)
    await cache.fetch('view', 'v_orders', view)
    await cache.fetch('rpc', null, rpc)
    await cache.fetch('customers', 'customers', unrelated)
    cache.invalidate('orders')

    await cache.fetch('orders', 'orders', direct)
    await cache.fetch('view', 'v_orders', view)
    await cache.fetch('rpc', null, rpc)
    await cache.fetch('customers', 'customers', unrelated)
    expect(direct).toHaveBeenCalledTimes(2)
    expect(view).toHaveBeenCalledTimes(2)
    expect(rpc).toHaveBeenCalledTimes(2)
    expect(unrelated).toHaveBeenCalledTimes(1)
  })

  it('does not repopulate stale cache when a read finishes after invalidation', async () => {
    const cache = createResponseCache(cacheOptions)
    let resolveOld!: (response: Response) => void
    const oldRead = cache.fetch('orders', 'orders', () => new Promise<Response>(resolve => { resolveOld = resolve }))
    cache.invalidate('orders')

    expect(await (await cache.fetch('orders', 'orders', async () => new Response('new'))).text()).toBe('new')
    resolveOld(new Response('stale'))
    expect(await (await oldRead).text()).toBe('stale')
    expect(await (await cache.fetch('orders', 'orders', async () => new Response('unexpected'))).text()).toBe('new')
  })

  it('partitions cache keys by caller identity and supports broad invalidation', async () => {
    const cache = createResponseCache(cacheOptions)
    const loader = (value: string) => vi.fn(async () => new Response(value))
    const userA = loader('A')
    const userB = loader('B')

    expect(await (await cache.fetch('token-A|orders', 'orders', userA)).text()).toBe('A')
    expect(await (await cache.fetch('token-B|orders', 'orders', userB)).text()).toBe('B')
    cache.invalidate('*')
    expect(await (await cache.fetch('token-A|orders', 'orders', userA)).text()).toBe('A')
    expect(userA).toHaveBeenCalledTimes(2)
    expect(userB).toHaveBeenCalledTimes(1)
  })
})
