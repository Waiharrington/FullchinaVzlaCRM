import { createClient } from '@supabase/supabase-js'
import { createResponseCache } from './responseCache'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || ''
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || ''

const RESPONSE_CACHE_MS = 2 * 60 * 1000
const CHANGE_CHECK_INTERVAL_MS = 30 * 1000
const TABLE_CACHE_DEPENDENCIES: Record<string, readonly string[]> = {
  v_orders_with_items: ['orders', 'order_items', 'order_item_modifiers', 'payments', 'customers', 'sellable_products'],
  v_credit_balances: ['credits', 'credit_payments', 'orders', 'payments'],
  v_current_stock: ['ingredients', 'stock_movements', 'purchase_items', 'preparation_batch_items', 'recipe_components'],
  v_warehouse_stock: ['ingredients', 'stock_movements', 'purchase_items'],
  v_floor_tables_status: ['floor_tables', 'orders'],
}
const responseCache = createResponseCache({
  ttlMs: RESPONSE_CACHE_MS,
  maxEntries: 300,
  tableDependencies: TABLE_CACHE_DEPENDENCIES,
})
const dataChangeListeners = new Set<(table: string) => void>()
let realtimeChannel: ReturnType<NonNullable<typeof supabase>['channel']> | null = null
let realtimeOwnerId: string | null = null
let fallbackTimer: ReturnType<typeof setInterval> | null = null
let lastKnownVersions = new Map<string, number>()
let visibilityHandler: (() => void) | null = null
let feedGeneration = 0

function requestDetails(input: RequestInfo | URL, init?: RequestInit) {
  const request = input instanceof Request ? input : null
  const url = new URL(request?.url ?? input.toString())
  const method = (init?.method ?? request?.method ?? 'GET').toUpperCase()
  const headers = new Headers(init?.headers ?? request?.headers)
  const auth = headers.get('authorization') ?? ''
  const restPrefix = '/rest/v1/'
  const rpcName = url.pathname.includes('/rest/v1/rpc/')
    ? decodeURIComponent(url.pathname.split('/rest/v1/rpc/')[1] ?? '')
    : null
  const table = rpcName
    ? null
    : url.pathname.includes(restPrefix)
    ? decodeURIComponent(url.pathname.split(restPrefix)[1]?.split('/')[0] ?? '') || null
    : null
  const body = typeof init?.body === 'string' ? init.body : ''
  const cacheableRpc = method === 'POST' && rpcName?.startsWith('fn_get_')
  const cacheable = (method === 'GET' && table !== null && table !== 'data_change_versions') || cacheableRpc
  return {
    url,
    method,
    table,
    rpcName,
    cacheable,
    key: `${auth}|${method}|${url.toString()}|${headers.get('accept') ?? ''}|${headers.get('range') ?? ''}|${headers.get('prefer') ?? ''}|${cacheableRpc ? body : ''}`,
  }
}

function invalidateTable(table: string | null) {
  responseCache.invalidate(table)
}

export function publishDataChange(table: string) {
  invalidateTable(table)
  for (const listener of dataChangeListeners) listener(table)
}

async function cachedSupabaseFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const details = requestDetails(input, init)
  if (details.cacheable) {
    return responseCache.fetch(details.key, details.table, () => fetch(input, init))
  }

  const response = await fetch(input, init)
  if (response.ok && details.method !== 'GET') {
    // RPC writes do not expose their affected table, so invalidate broadly;
    // direct REST writes can invalidate only that table and its dependent views.
    publishDataChange(details.table ?? '*')
  }
  return response
}

export const supabase =
  supabaseUrl && supabaseAnonKey
    ? createClient(supabaseUrl, supabaseAnonKey, {
        db: { schema: 'fullchinavzla' },
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: false,
        },
        global: { fetch: cachedSupabaseFetch },
      })
    : null

export function subscribeToDataChanges(listener: (table: string) => void) {
  dataChangeListeners.add(listener)
  return () => dataChangeListeners.delete(listener)
}

export function startDataChangeFeed(userId: string | null) {
  if (!supabase || !userId || realtimeOwnerId === userId) return
  stopDataChangeFeed()
  const generation = feedGeneration
  realtimeOwnerId = userId
  let versionCheckInFlight = false
  const checkVersions = async () => {
    if (generation !== feedGeneration || versionCheckInFlight || document.visibilityState === 'hidden') return
    versionCheckInFlight = true
    try {
      const { data, error } = await supabase!.from('data_change_versions').select('table_name,version')
      if (generation !== feedGeneration || error || !data) return
      const nextVersions = new Map(data.map((row) => [String(row.table_name), Number(row.version)]))
      if (lastKnownVersions.size > 0) {
        for (const [table, version] of nextVersions) {
          if (lastKnownVersions.get(table) !== undefined && lastKnownVersions.get(table) !== version) publishDataChange(table)
        }
      }
      lastKnownVersions = nextVersions
    } finally {
      versionCheckInFlight = false
    }
  }
  const syncFallback = (enabled: boolean) => {
    if (generation !== feedGeneration) return
    if (!enabled) {
      if (fallbackTimer) clearInterval(fallbackTimer)
      fallbackTimer = null
      void checkVersions()
      return
    }
    if (fallbackTimer) return
    void checkVersions()
    fallbackTimer = setInterval(() => { void checkVersions() }, CHANGE_CHECK_INTERVAL_MS)
  }
  visibilityHandler = () => {
    if (document.visibilityState === 'visible') void checkVersions()
  }
  document.addEventListener('visibilitychange', visibilityHandler)
  realtimeChannel = supabase
    .channel('fullchina-data-change-feed')
    .on('postgres_changes', {
      event: '*',
      schema: 'fullchinavzla',
      table: 'data_change_versions',
    }, (payload) => {
      if (generation !== feedGeneration) return
      const changeRow = payload.new as { table_name?: unknown }
      const table = typeof changeRow.table_name === 'string' ? changeRow.table_name : '*'
      publishDataChange(table)
    })
    .subscribe((status) => {
      syncFallback(status !== 'SUBSCRIBED')
    })
}

export function stopDataChangeFeed() {
  feedGeneration += 1
  if (fallbackTimer) clearInterval(fallbackTimer)
  fallbackTimer = null
  if (visibilityHandler) document.removeEventListener('visibilitychange', visibilityHandler)
  visibilityHandler = null
  if (realtimeChannel && supabase) void supabase.removeChannel(realtimeChannel)
  realtimeChannel = null
  realtimeOwnerId = null
  lastKnownVersions.clear()
  responseCache.clear()
}
