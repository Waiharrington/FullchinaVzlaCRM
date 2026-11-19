import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const feedMock = vi.hoisted(() => {
  const callbacks: Array<(status: string) => void> = []
  const channelHandlers: Array<(payload: { new: Record<string, unknown> }) => void> = []
  const select = vi.fn()
  const removeChannel = vi.fn()
  const channel = {
    on: vi.fn((_event: string, _filter: unknown, handler: (payload: { new: Record<string, unknown> }) => void) => {
      channelHandlers.push(handler)
      return channel
    }),
    subscribe: vi.fn((callback: (status: string) => void) => {
      callbacks.push(callback)
      return channel
    }),
  }

  return { callbacks, channelHandlers, channel, select, removeChannel }
})

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    from: () => ({ select: feedMock.select }),
    channel: () => feedMock.channel,
    removeChannel: feedMock.removeChannel,
  }),
}))

let startDataChangeFeed: typeof import('./supabase')['startDataChangeFeed']
let stopDataChangeFeed: typeof import('./supabase')['stopDataChangeFeed']
let subscribeToDataChanges: typeof import('./supabase')['subscribeToDataChanges']

beforeEach(async () => {
  vi.resetModules()
  vi.stubEnv('VITE_SUPABASE_URL', 'http://127.0.0.1:54321')
  vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'local-test-anon-key')
  feedMock.callbacks.length = 0
  feedMock.channelHandlers.length = 0
  feedMock.select.mockReset()
  feedMock.removeChannel.mockReset()
  feedMock.channel.on.mockClear()
  feedMock.channel.subscribe.mockClear()
  ;({ startDataChangeFeed, stopDataChangeFeed, subscribeToDataChanges } = await import('./supabase'))
})

afterEach(() => {
  stopDataChangeFeed?.()
  vi.unstubAllEnvs()
})

describe('Supabase version feed lifecycle', () => {
  it('detects changes that happen while the Realtime channel is connecting', async () => {
    feedMock.select
      .mockResolvedValueOnce({ data: [{ table_name: 'orders', version: 1 }], error: null })
      .mockResolvedValueOnce({ data: [{ table_name: 'orders', version: 2 }], error: null })
    const listener = vi.fn()
    subscribeToDataChanges(listener)

    startDataChangeFeed('user-a')
    await vi.waitFor(() => expect(feedMock.callbacks).toHaveLength(1))
    feedMock.callbacks[0]('SUBSCRIBED')

    await vi.waitFor(() => expect(listener).toHaveBeenCalledWith('orders'))
  })

  it('reconciles missed changes when the tab becomes visible even if Realtime is connected', async () => {
    feedMock.select
      .mockResolvedValueOnce({ data: [{ table_name: 'orders', version: 1 }], error: null })
      .mockResolvedValueOnce({ data: [{ table_name: 'orders', version: 1 }], error: null })
    const listener = vi.fn()
    subscribeToDataChanges(listener)

    startDataChangeFeed('user-a')
    await vi.waitFor(() => expect(feedMock.callbacks).toHaveLength(1))
    feedMock.callbacks[0]('SUBSCRIBED')
    await vi.waitFor(() => expect(feedMock.select).toHaveBeenCalledTimes(2))

    feedMock.select.mockResolvedValueOnce({ data: [{ table_name: 'orders', version: 2 }], error: null })
    document.dispatchEvent(new Event('visibilitychange'))
    await vi.waitFor(() => expect(listener).toHaveBeenCalledWith('orders'))
  })

  it('ignores a delayed version response from a session that has already ended', async () => {
    let resolveOldRead!: (result: { data: Array<{ table_name: string; version: number }>; error: null }) => void
    feedMock.select
      .mockImplementationOnce(() => new Promise(resolve => { resolveOldRead = resolve }))
      .mockResolvedValueOnce({ data: [{ table_name: 'orders', version: 10 }], error: null })

    const listener = vi.fn()
    subscribeToDataChanges(listener)
    startDataChangeFeed('user-a')
    await vi.waitFor(() => expect(feedMock.select).toHaveBeenCalledTimes(1))

    startDataChangeFeed('user-b')
    await vi.waitFor(() => expect(feedMock.select).toHaveBeenCalledTimes(2))
    await vi.waitFor(() => expect(feedMock.callbacks).toHaveLength(1))
    feedMock.callbacks[0]('SUBSCRIBED')
    resolveOldRead({ data: [{ table_name: 'orders', version: 99 }], error: null })
    await Promise.resolve()

    expect(listener).not.toHaveBeenCalled()
    expect(feedMock.removeChannel).not.toHaveBeenCalled()
  })
})
