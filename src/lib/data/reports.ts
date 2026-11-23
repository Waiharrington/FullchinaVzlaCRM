import { dateKeyInTimeZone } from '../money'
import { client } from './client'
import type { TodayStats, DailySales, ProductRanking, CategorySales, PaymentMethodSales, LegacySaleReportRow, LegacyDeletedOrderReportRow, LegacyPurchaseOrderReportRow, ReportEventRow, ReportAdjustmentRow, ReportAttendanceRow, ReportRequisitionRow, ReportGiftCardRow, DashboardAlertInput, DashboardAlertEvent } from './types'

/** Synchronizes dashboard alert transitions and returns the latest active/recent history. */
export async function syncDashboardAlertEvents(alerts: DashboardAlertInput[], observedKeys: DashboardAlertInput['key'][]): Promise<DashboardAlertEvent[]> {
  const { data, error } = await client().rpc('fn_sync_dashboard_alerts', { p_alerts: alerts, p_observed_keys: observedKeys })
  if (error) throw error
  return ((data ?? []) as Array<Record<string, unknown>>).map(row => ({
    id: String(row.id),
    key: String(row.alert_key) as DashboardAlertInput['key'],
    title: String(row.title),
    detail: String(row.detail),
    path: String(row.target_path),
    tone: String(row.tone) as DashboardAlertInput['tone'],
    detectedAt: String(row.detected_at),
    lastDetectedAt: String(row.last_detected_at),
    resolvedAt: row.resolved_at == null ? null : String(row.resolved_at),
  }))
}

export async function getTodayStats(): Promise<TodayStats> {
  const { data, error } = await client().rpc('fn_get_today_stats')
  if (error) throw error
  const stats = data as Record<string, number>
  return {
    totalSales: Number(stats.totalSales ?? 0),
    ordersCount: Number(stats.ordersCount ?? 0),
    pendingOrders: Number(stats.pendingOrders ?? 0),
    readyOrders: Number(stats.readyOrders ?? 0),
    avgTicket: Number(stats.avgTicket ?? 0),
  }
}

// --- Ventas diarias (RPC) ----------------------------------------------------

export async function getDailySales(days: number = 30): Promise<DailySales[]> {
  const { data, error } = await client().rpc('fn_get_daily_sales', { p_days: days })
  if (error) throw error

  return (data ?? []).map((d: Record<string, unknown>) => ({
    date: d.sale_date as string,
    total: Number(d.total ?? 0),
    count: Number(d.order_count ?? 0),
  }))
}

/**
 * Consulta compacta de respaldo para el gráfico y para fechas seleccionadas:
 * agrega los pagos de órdenes por día de Caracas sin depender de un RPC que
 * solo devuelve rangos terminados en la fecha actual.
 */
export async function getDailySalesFromOrders(days: number = 30, throughDate = dateKeyInTimeZone()): Promise<DailySales[]> {
  const count = Math.max(1, Math.floor(days))
  const [year, month, day] = throughDate.split('-').map(Number)
  const firstDay = new Date(Date.UTC(year, month - 1, day - count + 1)).toISOString().slice(0, 10)
  const endDate = new Date(Date.UTC(year, month - 1, day + 1)).toISOString().slice(0, 10)
  const start = `${firstDay}T00:00:00-04:00`
  const end = `${endDate}T00:00:00-04:00`
  const byDate = new Map<string, { total: number; orderIds: Set<string> }>()
  let offset = 0

  while (true) {
    const { data, error } = await client()
      .from('orders')
      .select('id,created_at,payments(method,amount)')
      .eq('status', 'paid')
      .gte('created_at', start)
      .lt('created_at', end)
      .order('created_at', { ascending: true })
      .range(offset, offset + 499)

    if (error) throw error
    const rows = (data ?? []) as Array<{ id: string; created_at: string; payments?: Array<{ method: string; amount: number }> }>
    for (const order of rows) {
      if (order.payments?.some(payment => payment.method === 'personal_account')) continue
      const date = dateKeyInTimeZone(new Date(order.created_at))
      const daySales = byDate.get(date) ?? { total: 0, orderIds: new Set<string>() }
      let orderHasSale = false
      for (const payment of order.payments ?? []) {
        daySales.total += Number(payment.amount) || 0
        orderHasSale = true
      }
      if (orderHasSale) daySales.orderIds.add(order.id)
      byDate.set(date, daySales)
    }

    if (rows.length < 500) break
    offset += rows.length
  }

  return Array.from({ length: count }, (_, index) => {
    const date = new Date(Date.UTC(year, month - 1, day - count + 1 + index)).toISOString().slice(0, 10)
    const daySales = byDate.get(date)
    return { date, total: daySales?.total ?? 0, count: daySales?.orderIds.size ?? 0 }
  })
}

// --- Ranking de productos (RPC) ----------------------------------------------

export async function getProductRanking(includeImages = true): Promise<ProductRanking[]> {
  const { data, error } = await client().rpc('fn_get_product_ranking')
  if (error) throw error

  const ranking: ProductRanking[] = (data ?? []).map((r: Record<string, unknown>) => ({
    name: r.product_name as string,
    emoji: (r.emoji as string) ?? '🍽️', /* DB default: emoji */
    imageUrl: null,
    count: Number(r.total_quantity ?? 0),
    revenue: Number(r.total_revenue ?? 0),
  }))

  if (!includeImages || ranking.length === 0) return ranking

  try {
    const { data: products, error: imagesError } = await client()
      .from('sellable_products')
      .select('name,image_url')
      .in('name', ranking.map(item => item.name))

    if (imagesError) throw imagesError

    const imageByName = new Map((products ?? []).map(product => [
      product.name as string,
      (product.image_url as string | null) ?? null,
    ]))

    return ranking.map(item => ({ ...item, imageUrl: imageByName.get(item.name) ?? null }))
  } catch (imageError) {
    // Las imágenes son decorativas: no ocultar el ranking si el catálogo no está disponible.
    console.warn('No se pudieron cargar las fotos de los platos más vendidos:', imageError)
    return ranking
  }
}

// --- Ventas por categoría (RPC) ----------------------------------------------

export async function getCategorySales(): Promise<CategorySales[]> {
  const { data, error } = await client().rpc('fn_get_category_sales')
  if (error) throw error

  return (data ?? []).map((r: Record<string, unknown>) => ({
    category: r.category as string,
    total: Number(r.total ?? 0),
  }))
}

// --- Ventas por método de pago (RPC) -----------------------------------------

export async function getPaymentMethodSales(): Promise<PaymentMethodSales[]> {
  const { data, error } = await client().rpc('fn_get_payment_method_sales')
  if (error) throw error

  return (data ?? []).map((r: Record<string, unknown>) => ({
    method: r.method as string,
    total: Number(r.total ?? 0),
    count: Number(r.count ?? 0),
  }))
}

// --- Cierre de caja ----------------------------------------------------------

/** Registros importados de Invu; son una fuente histórica y no se mezclan con ventas nuevas. */
export async function getLegacySalesReport(allPages = false): Promise<LegacySaleReportRow[]> {
  const rows: Record<string, unknown>[] = []
  let offset = 0
  for (;;) {
    let query = client().from('legacy_sales').select('id,order_label,customer_text,closed_at,order_type,subtotal,item_discount,order_discount,tax,total_tips,total,cash_paid,card_paid,cheque_paid,other_paid').order('closed_at', { ascending: false })
    if (allPages) query = query.range(offset, offset + 499)
    const { data, error } = await query
    if (error) throw error
    const batch = (data ?? []) as Record<string, unknown>[]
    rows.push(...batch)
    if (!allPages || batch.length < 500) break
    offset += 500
  }
  return rows.map(row => ({
    id: String(row.id), orderLabel: row.order_label == null ? null : String(row.order_label), customer: row.customer_text == null ? null : String(row.customer_text),
    closedAt: row.closed_at == null ? null : String(row.closed_at), orderType: row.order_type == null ? null : String(row.order_type),
    subtotal: Number(row.subtotal ?? 0), itemDiscount: Number(row.item_discount ?? 0), orderDiscount: Number(row.order_discount ?? 0), tax: Number(row.tax ?? 0), tips: Number(row.total_tips ?? 0), total: Number(row.total ?? 0),
    cashPaid: Number(row.cash_paid ?? 0), cardPaid: Number(row.card_paid ?? 0), chequePaid: Number(row.cheque_paid ?? 0), otherPaid: Number(row.other_paid ?? 0),
  }))
}

export async function getLegacyDeletedOrdersReport(allPages = false): Promise<LegacyDeletedOrderReportRow[]> {
  const rows: Record<string, unknown>[] = []
  let offset = 0
  for (;;) {
    let query = client().from('legacy_deleted_orders').select('id,order_label,description,deleted_at,deleted_by').order('deleted_at', { ascending: false })
    if (allPages) query = query.range(offset, offset + 499)
    const { data, error } = await query
    if (error) throw error
    const batch = (data ?? []) as Record<string, unknown>[]
    rows.push(...batch)
    if (!allPages || batch.length < 500) break
    offset += 500
  }
  return rows.map(row => ({ id: String(row.id), orderLabel: row.order_label == null ? null : String(row.order_label), description: row.description == null ? null : String(row.description), deletedAt: row.deleted_at == null ? null : String(row.deleted_at), deletedBy: row.deleted_by == null ? null : String(row.deleted_by) }))
}

export async function getLegacyPurchaseOrdersReport(allPages = false): Promise<LegacyPurchaseOrderReportRow[]> {
  const rows: Record<string, unknown>[] = []
  let offset = 0
  for (;;) {
    let query = client().from('legacy_purchase_orders').select('id,po_code,supplier_text,po_date,tax,discount,total,status').order('po_date', { ascending: false })
    if (allPages) query = query.range(offset, offset + 499)
    const { data, error } = await query
    if (error) throw error
    const batch = (data ?? []) as Record<string, unknown>[]
    rows.push(...batch)
    if (!allPages || batch.length < 500) break
    offset += 500
  }
  return rows.map(row => ({ id: String(row.id), poCode: row.po_code == null ? null : String(row.po_code), supplier: row.supplier_text == null ? null : String(row.supplier_text), poDate: row.po_date == null ? null : String(row.po_date), tax: Number(row.tax ?? 0), discount: Number(row.discount ?? 0), total: Number(row.total ?? 0), status: row.status == null ? null : String(row.status) }))
}

export async function getReportEventLogs(allPages = false): Promise<ReportEventRow[]> {
  const rows: Record<string, unknown>[] = []; let offset = 0
  for (;;) {
    let query = client().from('order_event_logs').select('id,order_id,event_type,previous_value,current_value,actor_id,occurred_at').order('occurred_at', { ascending: false })
    if (allPages) query = query.range(offset, offset + 499)
    const { data, error } = await query; if (error) throw error
    const batch = (data ?? []) as Record<string, unknown>[]; rows.push(...batch)
    if (!allPages || batch.length < 500) break; offset += 500
  }
  return rows.map(row => ({ id: String(row.id), orderId: String(row.order_id), eventType: String(row.event_type), previousValue: row.previous_value == null ? null : String(row.previous_value), currentValue: row.current_value == null ? null : String(row.current_value), actorId: row.actor_id == null ? null : String(row.actor_id), occurredAt: String(row.occurred_at) }))
}

export async function getReportAdjustments(allPages = false): Promise<ReportAdjustmentRow[]> {
  const rows: Record<string, unknown>[] = []; let offset = 0
  for (;;) {
    let query = client().from('order_adjustments').select('id,order_id,order_item_id,adjustment_type,amount_usd,reason,employee_id,created_at').order('created_at', { ascending: false })
    if (allPages) query = query.range(offset, offset + 499)
    const { data, error } = await query; if (error) throw error
    const batch = (data ?? []) as Record<string, unknown>[]; rows.push(...batch)
    if (!allPages || batch.length < 500) break; offset += 500
  }
  return rows.map(row => ({ id: String(row.id), orderId: String(row.order_id), orderItemId: row.order_item_id == null ? null : String(row.order_item_id), adjustmentType: String(row.adjustment_type), amountUsd: Number(row.amount_usd), reason: row.reason == null ? null : String(row.reason), employeeId: row.employee_id == null ? null : String(row.employee_id), createdAt: String(row.created_at) }))
}

export async function getReportAttendance(allPages = false): Promise<ReportAttendanceRow[]> {
  const rows: Record<string, unknown>[] = []; let offset = 0
  for (;;) {
    let query = client().from('employee_attendance').select('id,employee_id,work_date,clock_in,clock_out,notes').order('work_date', { ascending: false })
    if (allPages) query = query.range(offset, offset + 499)
    const { data, error } = await query; if (error) throw error
    const batch = (data ?? []) as Record<string, unknown>[]; rows.push(...batch)
    if (!allPages || batch.length < 500) break; offset += 500
  }
  return rows.map(row => ({ id: String(row.id), employeeId: String(row.employee_id), workDate: String(row.work_date), clockIn: row.clock_in == null ? null : String(row.clock_in), clockOut: row.clock_out == null ? null : String(row.clock_out), notes: row.notes == null ? null : String(row.notes) }))
}

export async function getReportRequisitions(allPages = false): Promise<ReportRequisitionRow[]> {
  const rows: Record<string, unknown>[] = []; let offset = 0
  for (;;) {
    let query = client().from('inventory_requisitions').select('id,ingredient_id,quantity,unit_id,from_location,to_location,status,requested_at,fulfilled_at').order('requested_at', { ascending: false })
    if (allPages) query = query.range(offset, offset + 499)
    const { data, error } = await query; if (error) throw error
    const batch = (data ?? []) as Record<string, unknown>[]; rows.push(...batch)
    if (!allPages || batch.length < 500) break; offset += 500
  }
  return rows.map(row => ({ id: String(row.id), ingredientId: String(row.ingredient_id), quantity: Number(row.quantity), unitId: String(row.unit_id), fromLocation: String(row.from_location), toLocation: String(row.to_location), status: String(row.status), requestedAt: String(row.requested_at), fulfilledAt: row.fulfilled_at == null ? null : String(row.fulfilled_at) }))
}

export async function getReportGiftCards(allPages = false): Promise<ReportGiftCardRow[]> {
  const rows: Record<string, unknown>[] = []; let offset = 0
  for (;;) {
    let query = client().from('gift_cards').select('id,code,initial_amount_usd,is_active,expires_at,created_at,gift_card_transactions(transaction_type,amount_usd,created_at,order_id)').order('created_at', { ascending: false })
    if (allPages) query = query.range(offset, offset + 499)
    const { data, error } = await query; if (error) throw error
    const batch = (data ?? []) as Record<string, unknown>[]; rows.push(...batch)
    if (!allPages || batch.length < 500) break; offset += 500
  }
  return rows.flatMap(row => {
    const transactions = Array.isArray(row.gift_card_transactions) ? row.gift_card_transactions as Record<string, unknown>[] : []
    if (transactions.length === 0) return [{ id: String(row.id), code: String(row.code), initialAmountUsd: Number(row.initial_amount_usd), isActive: Boolean(row.is_active), expiresAt: row.expires_at == null ? null : String(row.expires_at), createdAt: String(row.created_at) }]
    return transactions.map(transaction => ({ id: String(row.id), code: String(row.code), initialAmountUsd: Number(row.initial_amount_usd), isActive: Boolean(row.is_active), expiresAt: row.expires_at == null ? null : String(row.expires_at), createdAt: String(row.created_at), transactionType: String(transaction.transaction_type), transactionAmountUsd: Number(transaction.amount_usd), transactionAt: String(transaction.created_at), orderId: transaction.order_id == null ? null : String(transaction.order_id) }))
  })
}

// --- Clientes y fidelización ------------------------------------------------

