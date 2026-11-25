import { createClient } from '@supabase/supabase-js'
import { createResponseCache } from './responseCache'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || ''
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || ''

// Keep read responses available while the user moves between modules. Real
// changes invalidate the affected tables through the data-change feed; this
// TTL is only a safety net if the feed is unavailable.
const RESPONSE_CACHE_MS = 15 * 60 * 1000
// Realtime is the primary feed. While it reconnects, keep cross-device changes
// visible quickly instead of allowing the old 30-second polling gap.
const CHANGE_CHECK_INTERVAL_MS = 2 * 1000
const TABLE_CACHE_DEPENDENCIES: Record<string, readonly string[]> = {
  orders: ['payments', 'order_items', 'order_item_modifiers', 'customers', 'profiles', 'sellable_products', 'modifiers', 'modifier_options'],
  order_items: ['orders', 'sellable_products', 'order_item_modifiers', 'modifiers', 'modifier_options'],
  credit_payments: ['credits'],
  credits: ['customers', 'orders', 'payments'],
  sellable_product_modifiers: ['modifiers', 'modifier_options'],
  expenses: ['expense_payments', 'financial_accounts'],
  financial_operations: ['financial_accounts'],
  purchases: ['purchase_items', 'purchase_expense_items', 'purchase_payments', 'suppliers', 'financial_accounts', 'ingredients', 'units'],
  purchase_items: ['ingredients', 'units'],
  purchase_expense_items: ['purchases', 'units'],
  preparation_batches: ['preparation_batch_items', 'preparation_batch_costs', 'ingredients', 'units'],
  production_bonuses: ['employees', 'financial_accounts'],
  delivery_assignments: ['employees'],
  payroll_payments: ['employees', 'financial_accounts'],
  payroll_adjustments: ['employees'],
  advances: ['employees', 'financial_accounts'],
  stock_movements: ['ingredients', 'units'],
  inventory_requisitions: ['ingredients', 'units'],
  recipe_components: ['ingredients', 'units', 'preparation_batches', 'portion_recipes'],
  portion_recipes: ['ingredients', 'units'],
  weekly_menu_items: ['weekly_menu_activations'],
  whatsapp_messages: ['customers'],
  whatsapp_segments: ['whatsapp_segment_members'],
  gift_cards: ['gift_card_transactions'],
  preparation_batch_items: ['preparation_batches', 'ingredients', 'units'],
  preparation_batch_costs: ['preparation_batches'],
  expense_payments: ['expenses', 'financial_accounts'],
  purchase_payments: ['purchases', 'financial_accounts'],
  order_item_modifiers: ['order_items', 'modifiers', 'modifier_options'],
  v_orders_with_items: ['orders', 'order_items', 'order_item_modifiers', 'payments', 'customers', 'sellable_products', 'modifiers', 'modifier_options'],
  // Comandas reads this credit-aware view. Keep it invalidated whenever an
  // underlying order changes, or the 15-minute safety cache hides new sales.
  v_orders_with_credit_status: ['orders', 'order_items', 'order_item_modifiers', 'payments', 'customers', 'sellable_products', 'modifiers', 'modifier_options', 'credits'],
  v_credit_balances: ['credits', 'credit_payments', 'orders', 'payments', 'customers'],
  v_current_stock: ['ingredients', 'units', 'ingredient_costs', 'stock_movements', 'purchase_items', 'preparation_batch_items', 'recipe_components'],
  v_warehouse_stock: ['ingredients', 'units', 'ingredient_costs', 'stock_movements', 'purchase_items'],
  v_floor_tables_status: ['floor_tables', 'orders', 'order_items', 'profiles'],
}
// Supabase sends every RPC through POST, so the generic fetch layer cannot
// infer whether it changed data from the HTTP method alone. Keep this list
// beside the cache invalidation map so successful writes notify local tabs.
const RPC_CHANGE_TABLES: Record<string, readonly string[]> = {
  fn_delete_sellable_product: ['sellable_products', 'sellable_product_categories', 'recipe_components'],
  fn_checkout_order: ['orders', 'order_items', 'payments', 'cash_movements', 'cash_sessions', 'stock_movements', 'customers', 'customer_loyalty_visits', 'customer_loyalty_rewards'],
  fn_remove_order_item: ['order_items', 'order_item_modifiers', 'stock_movements', 'ingredients'],
  fn_delete_order: ['orders', 'order_items', 'order_item_modifiers', 'payments', 'credits', 'credit_payments', 'cash_movements', 'cash_sessions', 'stock_movements', 'customers', 'customer_loyalty_visits', 'customer_loyalty_rewards', 'gift_card_transactions', 'order_adjustments', 'order_event_logs', 'delivery_assignments', 'financial_operations', 'system_activity_logs'],
  fn_delete_web_order: ['web_order_requests', 'web_order_items'],
  // Marking an order as paid can create a delivery assignment through a DB
  // trigger. Publish it locally too so payroll/finance views refresh without
  // waiting for the remote version-feed event.
  fn_record_order_payments: ['orders', 'payments', 'cash_movements', 'cash_sessions', 'financial_accounts', 'delivery_assignments', 'order_event_logs', 'customers', 'customer_loyalty_visits', 'customer_loyalty_rewards'],
  fn_authorize_order_credit: ['orders', 'credits', 'order_event_logs'],
  fn_record_receivable_payment_batch: ['credit_payments', 'credits', 'financial_operations', 'financial_accounts'],
  fn_record_receivable_payment: ['credit_payments', 'credits', 'financial_operations', 'financial_accounts'],
  fn_open_cash_session: ['cash_sessions'],
  fn_add_cash_movement: ['cash_movements', 'cash_sessions'],
  fn_close_cash_session: ['cash_sessions', 'daily_closes', 'daily_close_financials'],
  fn_create_daily_close: ['daily_closes', 'daily_close_financials', 'cash_sessions'],
  fn_create_customer: ['customers', 'customer_accounts', 'customer_account_identifiers'],
  fn_update_customer: ['customers', 'customer_accounts', 'customer_account_identifiers'],
  fn_register_customer_visit: ['customers', 'customer_loyalty_visits', 'customer_loyalty_rewards', 'gift_cards', 'gift_card_transactions'],
  fn_sync_weekly_dish_to_catalog: ['weekly_menu_items', 'sellable_products', 'sellable_product_categories'],
  fn_create_personal_account: ['financial_accounts'],
  fn_deactivate_personal_account: ['financial_accounts'],
  fn_apply_inventory_snapshot: ['ingredients', 'stock_movements'],
  add_stock_movement: ['stock_movements', 'ingredients'],
  fn_transfer_stock: ['ingredients', 'stock_movements', 'inventory_requisitions'],
  fn_admin_set_modules: ['profiles'],
  fn_admin_set_password: ['profiles'],
  fn_admin_set_email: ['profiles'],
  fn_admin_set_role: ['profiles'],
  fn_admin_set_active: ['profiles'],
  fn_admin_delete_user: ['profiles', 'employees'],
  fn_set_user_pin: ['profiles'],
  fn_admin_create_user: ['profiles', 'employees'],
  fn_register_staff_meal_consumption: ['stock_movements', 'ingredients'],
  fn_register_staff_meal_recipe_consumption: ['stock_movements', 'ingredients'],
  fn_delete_payroll_period: ['payroll_periods', 'payroll_entries', 'payroll_payments', 'payroll_adjustments'],
  fn_delete_demo_credit: ['credits', 'credit_payments'],
  fn_record_payroll_card_payment_with_fee: ['payroll_payments', 'financial_operations', 'financial_accounts'],
  fn_create_employee_advance: ['advances', 'financial_operations', 'employees'],
  fn_create_production_bonus: ['production_bonuses', 'employees'],
  fn_liquidate_payroll_period: ['payroll_periods', 'payroll_entries', 'payroll_payments', 'financial_operations', 'financial_accounts'],
  fn_liquidate_payroll_period_split: ['payroll_periods', 'payroll_entries', 'payroll_payments', 'financial_operations', 'financial_accounts'],
  fn_void_purchase: ['purchases', 'purchase_items', 'purchase_payments', 'stock_movements', 'ingredients'],
  fn_delete_voided_purchase: ['purchases', 'purchase_items', 'purchase_payments', 'stock_movements', 'ingredients'],
  fn_delete_purchase: ['purchases', 'purchase_items', 'purchase_expense_items', 'purchase_payments', 'stock_movements', 'ingredients'],
  fn_save_mixed_purchase: ['purchases', 'purchase_items', 'purchase_expense_items', 'purchase_payments', 'stock_movements', 'ingredients'],
  fn_update_purchase: ['purchases', 'purchase_items', 'purchase_expense_items', 'purchase_payments', 'stock_movements', 'ingredients'],
  fn_create_web_order: ['web_order_requests', 'web_order_items'],
  fn_sync_customer_favorites: ['customer_favorites'],
  fn_claim_customer_loyalty_celebration: ['customer_loyalty_rewards'],
  fn_admin_set_loyalty_reward_config: ['loyalty_settings', 'loyalty_reward_sequence'],
  fn_admin_set_loyalty_choice_reward: ['loyalty_settings', 'loyalty_reward_sequence', 'loyalty_reward_choices'],
  fn_admin_redeem_customer_loyalty_reward: ['customer_loyalty_rewards', 'customers'],
  fn_admin_update_public_order_page_settings: ['public_order_page_settings'],
  fn_admin_update_public_order_contact: ['public_order_page_settings'],
  fn_admin_update_public_order_reels: ['public_order_page_settings'],
  fn_admin_set_public_order_carousel: ['public_order_page_settings'],
  // Confirming a web order may create/update a customer, which in turn links
  // the corresponding customer account and identifier through DB triggers.
  fn_confirm_web_order: ['orders', 'order_items', 'order_item_modifiers', 'web_order_requests', 'customers', 'customer_accounts', 'customer_account_identifiers'],
  fn_register_push_subscription: ['push_subscriptions'],
  fn_delete_push_subscription: ['push_subscriptions'],
}
const RPC_READ_ONLY_NAMES = new Set(['fn_admin_customer_accounts'])
const RPC_DERIVED_WRITE_NAMES = new Set(['fn_sync_dashboard_alerts'])
const READ_ONLY_RPC_PREFIXES = [
  'fn_get_', 'fn_admin_get_', 'fn_admin_list_', 'fn_validate_', 'fn_check_',
  'fn_search_', 'fn_preview_', 'fn_calculate_', 'fn_generate_',
]
const responseCache = createResponseCache({
  ttlMs: RESPONSE_CACHE_MS,
  maxEntries: 300,
  tableDependencies: TABLE_CACHE_DEPENDENCIES,
})
const dataChangeListeners = new Set<(table: string) => void>()
const CROSS_TAB_CHANGE_CHANNEL = 'fullchina-data-change'
const CROSS_TAB_CHANGE_STORAGE_KEY_PREFIX = 'fullchina:data-change:'
let crossTabChannel: BroadcastChannel | null = null
let crossTabListenerAttached = false
let dataChangeEpoch = 0
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

function dispatchDataChange(table: string) {
  dataChangeEpoch += 1
  invalidateTable(table)
  for (const listener of dataChangeListeners) {
    try {
      listener(table)
    } catch (error) {
      // A broken view subscriber must not prevent the rest of the app from
      // receiving the same realtime update.
      console.error('No se pudo notificar un cambio en tiempo real:', error)
    }
  }
}

function isReadOnlyRpc(rpcName: string | null) {
  return Boolean(rpcName && (
    RPC_READ_ONLY_NAMES.has(rpcName)
    || READ_ONLY_RPC_PREFIXES.some(prefix => rpcName.startsWith(prefix))
  ))
}

function publishMutationChanges(tables: readonly string[]) {
  // Row-level activity triggers write their own log as part of the same
  // transaction. Notify the mounted audit view locally instead of waiting for
  // the database Realtime round trip to report that secondary write.
  for (const table of new Set([...tables, 'system_activity_logs'])) publishDataChange(table)
}

function receiveCrossTabChange(value: unknown) {
  if (!value || typeof value !== 'object' || !('table' in value)) return
  const table = (value as { table?: unknown }).table
  if (typeof table !== 'string' || table.length === 0 || table.length > 100) return
  dispatchDataChange(table)
}

function ensureCrossTabChangeFeed() {
  if (crossTabListenerAttached || typeof window === 'undefined') return
  crossTabListenerAttached = true

  if (typeof BroadcastChannel !== 'undefined') {
    try {
      crossTabChannel = new BroadcastChannel(CROSS_TAB_CHANGE_CHANNEL)
      crossTabChannel.addEventListener('message', event => receiveCrossTabChange(event.data))
      return
    } catch {
      crossTabChannel = null
    }
  }

  window.addEventListener('storage', event => {
    if (!event.key?.startsWith(CROSS_TAB_CHANGE_STORAGE_KEY_PREFIX) || !event.newValue) return
    try { receiveCrossTabChange(JSON.parse(event.newValue)) } catch { /* Ignore malformed cross-tab notices. */ }
  })
}

export function publishDataChange(table: string) {
  ensureCrossTabChangeFeed()
  dispatchDataChange(table)
  if (crossTabChannel) {
    try { crossTabChannel.postMessage({ table }) } catch { /* The local refresh still succeeds. */ }
    return
  }
  if (typeof window !== 'undefined') {
    const eventKey = `${CROSS_TAB_CHANGE_STORAGE_KEY_PREFIX}${Date.now()}:${Math.random().toString(36).slice(2)}`
    try {
      localStorage.setItem(eventKey, JSON.stringify({ table, at: Date.now() }))
      window.setTimeout(() => {
        try { localStorage.removeItem(eventKey) } catch { /* Expired notices may remain until browser storage is cleared. */ }
      }, 30_000)
    } catch { /* Storage may be disabled; same-tab subscribers still refresh. */ }
  }
}

function reportLocalRequest(details: ReturnType<typeof requestDetails>, status: number, durationMs: number) {
  if (!import.meta.env.DEV || typeof window === 'undefined' || (!details.table && !details.rpcName)) return
  const resource = details.rpcName ? `rpc:${details.rpcName}` : `table:${details.table}`
  void fetch('/__dev/performance', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ route: window.location.pathname, resource, method: details.method, status, durationMs }),
    keepalive: true,
  }).catch(() => { /* La medición local nunca debe afectar la consulta de datos. */ })
}

async function cachedSupabaseFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const details = requestDetails(input, init)
  const startedAt = performance.now()
  let observedChangeEpoch = dataChangeEpoch
  try {
    let response = details.cacheable
      ? await responseCache.fetch(details.key, details.table, () => fetch(input, init))
      : await fetch(input, init)

    // Some read RPCs use POST and are intentionally not cached. If any table
    // changed while one was in flight, read again before returning old data.
    while (response.ok && !details.cacheable && details.method === 'POST' && isReadOnlyRpc(details.rpcName)
      && observedChangeEpoch !== dataChangeEpoch) {
      observedChangeEpoch = dataChangeEpoch
      response = await fetch(input, init)
    }

    const isMutation = ['POST', 'PATCH', 'DELETE'].includes(details.method)
    if (response.ok && isMutation) {
      if (details.table) {
        // Direct REST writes identify their table in the request URL.
        publishMutationChanges([details.table])
      } else if (details.rpcName) {
        const changedTables = RPC_CHANGE_TABLES[details.rpcName]
        if (changedTables) {
          publishMutationChanges(changedTables)
        } else if (!RPC_DERIVED_WRITE_NAMES.has(details.rpcName)
          && !RPC_READ_ONLY_NAMES.has(details.rpcName)
          && !READ_ONLY_RPC_PREFIXES.some(prefix => details.rpcName!.startsWith(prefix))) {
          // Unknown RPCs may mutate data. Refresh all mounted modules and
          // caches rather than letting a new write silently leave stale UI.
          publishMutationChanges(['*'])
        }
      }
    }
    reportLocalRequest(details, response.status, performance.now() - startedAt)
    return response
  } catch (error) {
    reportLocalRequest(details, 0, performance.now() - startedAt)
    throw error
  }
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

// Customer loyalty accounts and staff accounts are different identity spaces.
// Keep their persisted sessions separate so an open admin tab cannot treat a
// customer login as an invalid staff session and sign it out (or vice versa).
export const customerSupabase =
  supabaseUrl && supabaseAnonKey
    ? createClient(supabaseUrl, supabaseAnonKey, {
        db: { schema: 'fullchinavzla' },
        auth: {
          storageKey: 'fullchina-customer-auth',
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: false,
        },
        global: { fetch: cachedSupabaseFetch },
      })
    : null

export function subscribeToDataChanges(listener: (table: string) => void) {
  ensureCrossTabChangeFeed()
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
    } catch (error) {
      console.warn('No se pudo consultar el respaldo de cambios en tiempo real:', error)
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
  const attachRealtimeChannel = () => {
    if (generation !== feedGeneration) return
    realtimeChannel = supabase!
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

  // Take a baseline before opening the socket, then check again as soon as it
  // subscribes. Changes in the connection gap are detected by that second
  // read instead of being mistaken for the initial snapshot.
  void checkVersions().finally(attachRealtimeChannel)
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

type ChangeFeedClient = NonNullable<typeof supabase>
const PUBLIC_MENU_CHANGE_TABLES = [
  'sellable_products', 'sellable_product_categories', 'sellable_product_modifiers', 'modifiers', 'modifier_options',
  'menu_categories', 'promotions', 'delivery_config', 'delivery_zones', 'public_order_page_settings',
] as const
const CUSTOMER_PROFILE_CHANGE_TABLES = [
  'customers', 'orders', 'order_items', 'order_item_modifiers', 'modifiers',
  'modifier_options', 'sellable_products', 'customer_accounts', 'customer_account_identifiers',
  'customer_loyalty_visits', 'customer_loyalty_rewards', 'gift_cards',
  'gift_card_transactions', 'customer_favorites',
] as const
let stopPublicMenuFeed: (() => void) | null = null
let customerFeedOwnerId: string | null = null
let stopCustomerFeed: (() => void) | null = null

function startAuxiliaryDataChangeFeed(
  client: ChangeFeedClient,
  channelName: string,
  allowedTables?: readonly string[],
) {
  let active = true
  let timer: ReturnType<typeof setInterval> | null = null
  let checking = false
  let previousVersions = new Map<string, number>()
  let channel: ReturnType<ChangeFeedClient['channel']> | null = null
  const allowed = allowedTables ? new Set(allowedTables) : null

  const checkVersions = async () => {
    if (!active || checking || document.visibilityState === 'hidden') return
    checking = true
    try {
      let query = client.from('data_change_versions').select('table_name,version')
      if (allowedTables) query = query.in('table_name', [...allowedTables])
      const { data, error } = await query
      if (!active || error || !data) return
      const next = new Map(data.map(row => [String(row.table_name), Number(row.version)]))
      for (const [table, version] of next) {
        if (allowed?.has(table) === false) continue
        if (previousVersions.has(table) && previousVersions.get(table) !== version) publishDataChange(table)
      }
      previousVersions = next
    } catch (error) {
      console.warn(`No se pudo consultar el respaldo en tiempo real de ${channelName}:`, error)
    } finally {
      checking = false
    }
  }

  const syncFallback = (enabled: boolean) => {
    if (!active) return
    if (!enabled) {
      if (timer) clearInterval(timer)
      timer = null
      void checkVersions()
      return
    }
    if (!timer) {
      void checkVersions()
      timer = setInterval(() => { void checkVersions() }, CHANGE_CHECK_INTERVAL_MS)
    }
  }

  const onVisibilityChange = () => { if (document.visibilityState === 'visible') void checkVersions() }
  document.addEventListener('visibilitychange', onVisibilityChange)
  const attachRealtimeChannel = () => {
    if (!active) return
    channel = client.channel(channelName)
      .on('postgres_changes', {
        event: '*', schema: 'fullchinavzla', table: 'data_change_versions',
      }, payload => {
        if (!active) return
        const row = payload.new as { table_name?: unknown }
        const table = typeof row.table_name === 'string' ? row.table_name : ''
        if (table && (allowed?.has(table) ?? true)) publishDataChange(table)
      })
      .subscribe(status => syncFallback(status !== 'SUBSCRIBED'))
  }

  // Establish a version baseline first; the post-subscription check catches
  // writes that land while the websocket is being established.
  void checkVersions().finally(attachRealtimeChannel)

  return () => {
    active = false
    if (timer) clearInterval(timer)
    document.removeEventListener('visibilitychange', onVisibilityChange)
    if (channel) void client.removeChannel(channel)
  }
}

/** Realtime feed for the unauthenticated customer menu, limited by database RLS to public menu versions. */
export function startPublicMenuDataChangeFeed() {
  if (!supabase || stopPublicMenuFeed) return
  stopPublicMenuFeed = startAuxiliaryDataChangeFeed(supabase, 'fullchina-public-menu-change-feed', PUBLIC_MENU_CHANGE_TABLES)
}

export function stopPublicMenuDataChangeFeed() {
  stopPublicMenuFeed?.()
  stopPublicMenuFeed = null
}

/** Authenticated customer profile feed; the customer session stays separate from staff auth. */
export function startCustomerDataChangeFeed(userId: string | null) {
  if (!customerSupabase || !userId || customerFeedOwnerId === userId) return
  stopCustomerDataChangeFeed()
  customerFeedOwnerId = userId
  stopCustomerFeed = startAuxiliaryDataChangeFeed(
    customerSupabase,
    `fullchina-customer-change-feed-${userId}`,
    CUSTOMER_PROFILE_CHANGE_TABLES,
  )
}

export function stopCustomerDataChangeFeed() {
  stopCustomerFeed?.()
  stopCustomerFeed = null
  customerFeedOwnerId = null
}
