import { dayRangeInTimeZone } from '../money'
import { client } from './client'
import type { CartItem, PaymentMethod, OrderPaymentComponent, OrderResult, TodayOrder, FullOrder, FloorTable } from './types'

export async function checkout(params: {
  items: CartItem[]
  method: PaymentMethod
  bcvRate: number | null
  userId: string
  notes?: string | null
  orderType?: string
  tableNumber?: number | null
  customerName?: string
  referenceNumber?: string | null
  receivedAmount?: number | null
  payments?: OrderPaymentComponent[]
  deliveryFee?: number
  employeeName?: string
}): Promise<OrderResult> {
  const deliveryFee = params.orderType === 'delivery' ? (params.deliveryFee ?? 0) : 0
  const total = params.items.reduce((sum, i) => sum + i.price * i.quantity, 0) + deliveryFee

  const paymentComponents = params.payments ?? [{
    method: params.method,
    amount: total,
    referenceNumber: params.referenceNumber,
    receivedAmount: params.receivedAmount,
    notes: params.notes,
  }]

  const { data: order, error: checkoutErr } = await client().rpc('fn_checkout_order', {
    p_items: params.items.map((item) => ({
      productId: item.productId,
      quantity: item.quantity,
      ...(item.selectedModifiers && item.selectedModifiers.length > 0
        ? {
            modifiers: item.selectedModifiers.map((m) => ({
              optionId: m.optionId,
              quantity: m.quantity,
            })),
          }
        : {}),
    })),
    p_payments: paymentComponents,
    p_bcv_rate: params.bcvRate,
    p_notes: params.notes ?? null,
    p_order_type: params.orderType ?? 'takeaway',
    p_customer_name: params.customerName ?? 'Cliente',
    p_delivery_fee: deliveryFee,
    p_table_number: params.orderType === 'dine-in' ? (params.tableNumber ?? null) : null,
  })
  if (checkoutErr) throw checkoutErr

  const checkoutResult = order as {
    id: string
    orderNumber: number
    status: string
    total: number
    createdAt: string
  }

  return {
    id: checkoutResult.id,
    orderNumber: checkoutResult.orderNumber,
    status: checkoutResult.status,
    total: Number(checkoutResult.total),
    bcvRate: params.bcvRate,
    createdAt: checkoutResult.createdAt,
    paymentMethod: params.method,
    items: params.items,
    customerName: params.customerName ?? 'Cliente general',
    orderType: params.orderType ?? 'takeaway',
    tableNumber: params.tableNumber ?? null,
    employeeName: params.employeeName ?? '',
    deliveryFeeUsd: deliveryFee,
    payments: paymentComponents,
  }
}

// --- Enviar a cocina (sin pago) ----------------------------------------------

/** Id del producto oculto "Delivery" (para agregar el cargo como renglón). */
export async function getDeliveryProductId(): Promise<string | null> {
  const { data, error } = await client()
    .from('sellable_products')
    .select('id')
    .eq('is_delivery', true)
    .limit(1)
    .maybeSingle()
  if (error) throw error
  return (data?.id as string) ?? null
}

export async function sendToKitchen(params: {
  items: CartItem[]
  bcvRate: number | null
  userId: string
  notes?: string | null
  orderType?: string
  tableNumber?: number | null
  customerName?: string
  deliveryFee?: number
  employeeName?: string
}): Promise<OrderResult> {
  const deliveryFee = params.orderType === 'delivery' ? (params.deliveryFee ?? 0) : 0
  const total = params.items.reduce((sum, i) => sum + i.price * i.quantity, 0) + deliveryFee

  const sb = client()

  const { data: order, error: orderErr } = await sb
    .from('orders')
    .insert({
      created_by: params.userId,
      bcv_rate: params.bcvRate,
      notes: params.notes ?? null,
      order_type: params.orderType ?? 'takeaway',
      table_number: params.orderType === 'dine-in' ? (params.tableNumber ?? null) : null,
      customer_name: params.customerName ?? 'Cliente',
      status: 'open',
    })
    .select('id, order_number, created_at')
    .single()
  if (orderErr) throw orderErr

  // Renglones de producto + (opcional) el cargo de delivery como renglón extra.
  const itemRows = params.items.map((i) => ({
    order_id: order.id,
    sellable_product_id: i.productId,
    quantity: i.quantity,
    unit_price: i.price,
  }))
  if (deliveryFee > 0) {
    const deliveryId = await getDeliveryProductId()
    if (!deliveryId) throw new Error('No existe el producto de Delivery configurado')
    itemRows.push({ order_id: order.id, sellable_product_id: deliveryId, quantity: 1, unit_price: Math.round(deliveryFee * 100) / 100 })
  }

  const { data: insertedItems, error: itemsErr } = await sb.from('order_items').insert(itemRows).select('id')
  if (itemsErr) throw itemsErr

  // Persistir las opciones de modificador elegidas por renglón. Los ids se
  // devuelven en el mismo orden en que se insertaron, así que se mapean por
  // índice. Esto dispara el consumo de inventario por modificador.
  const modifierRows = (insertedItems ?? []).flatMap((row, idx) => {
    const mods = params.items[idx]?.selectedModifiers ?? []
    return mods.map((m) => ({
      order_item_id: row.id as string,
      modifier_option_id: m.optionId,
      quantity: m.quantity,
      unit_price: m.price,
    }))
  })
  if (modifierRows.length > 0) {
    const { error: modErr } = await sb.from('order_item_modifiers').insert(modifierRows)
    if (modErr) throw modErr
  }

  // NO payment inserted — the order stays unpaid until cobro

  return {
    id: order.id as string,
    orderNumber: order.order_number as number,
    status: 'open',
    total,
    bcvRate: params.bcvRate,
    createdAt: order.created_at as string,
    paymentMethod: 'cash',
    items: params.items,
    customerName: params.customerName ?? 'Cliente general',
    orderType: params.orderType ?? 'takeaway',
    tableNumber: params.tableNumber ?? null,
    employeeName: params.employeeName ?? '',
    deliveryFeeUsd: deliveryFee,
    payments: [],
  }
}

// --- Agregar productos a un pedido existente (sin cobrar) --------------------

/**
 * Inserta ítems adicionales en un pedido ya creado que aún no se ha cobrado.
 * Reutiliza la misma mecánica que sendToKitchen: order_items + los
 * order_item_modifiers elegidos por renglón (esto dispara el consumo de
 * inventario). No crea pedido ni registra pago; el total se recalcula solo
 * desde los ítems.
 */
export async function addItemsToOrder(orderId: string, items: CartItem[]): Promise<void> {
  if (items.length === 0) return
  const sb = client()

  const { data: insertedItems, error: itemsErr } = await sb.from('order_items').insert(
    items.map((i) => ({
      order_id: orderId,
      sellable_product_id: i.productId,
      quantity: i.quantity,
      unit_price: i.price,
    })),
  ).select('id')
  if (itemsErr) throw itemsErr

  const modifierRows = (insertedItems ?? []).flatMap((row, idx) => {
    const mods = items[idx]?.selectedModifiers ?? []
    return mods.map((m) => ({
      order_item_id: row.id as string,
      modifier_option_id: m.optionId,
      quantity: m.quantity,
      unit_price: m.price,
    }))
  })
  if (modifierRows.length > 0) {
    const { error: modErr } = await sb.from('order_item_modifiers').insert(modifierRows)
    if (modErr) throw modErr
  }
}

/**
 * Elimina un producto de una comanda sin cobrar y revierte su consumo de
 * inventario (vía RPC SECURITY DEFINER que inserta un ajuste compensatorio).
 */
export async function removeOrderItem(orderItemId: string): Promise<void> {
  const { error } = await client().rpc('fn_remove_order_item', { p_item_id: orderItemId })
  if (error) throw error
}

/**
 * Elimina una comanda completa, revierte el inventario y borra sus efectos de
 * pago/caja. La RPC bloquea el borrado si la comisión de delivery ya se liquidó.
 */
export async function deleteOrder(orderId: string): Promise<void> {
  const { error } = await client().rpc('fn_delete_order', { p_order_id: orderId })
  if (error) throw new Error(error.message || 'No se pudo eliminar la comanda')
}

export async function validateMyPin(pin: string): Promise<boolean> {
  const { data, error } = await client().rpc('fn_validate_my_pin', { p_pin: pin })
  if (error) throw new Error(error.message || 'No se pudo validar el PIN')
  return data === true
}

/**
 * Elimina un pedido web pendiente (web_order_requests) y sus items.
 */
export async function deleteWebOrder(requestId: string): Promise<void> {
  const { error } = await client().rpc('fn_delete_web_order', { p_request_id: requestId })
  if (error) throw new Error(error.message || 'No se pudo eliminar el pedido web')
}

export async function getTodayOrders(): Promise<TodayOrder[]> {
  // El día del negocio es en horario de Venezuela (UTC-4), no en la zona del
  // navegador ni en UTC. Ver dayRangeInTimeZone en ./money.
  const { start, end } = dayRangeInTimeZone()

  const { data, error } = await client()
    .from('orders')
    .select('id, order_number, status, created_at, payments(method, amount)')
    .eq('status', 'paid')
    .gte('created_at', start)
    .lt('created_at', end)
    .order('created_at', { ascending: false })

  if (error) throw error

  return (data ?? []).map((o) => {
    const payments = (o.payments as Array<{ method: string; amount: number }>) ?? []
    const total = payments.reduce((sum, p) => sum + Number(p.amount), 0)
    return {
      id: o.id as string,
      orderNumber: o.order_number as number,
      status: o.status as string,
      total,
      paymentMethod: (payments[0]?.method as PaymentMethod) ?? null,
      createdAt: o.created_at as string,
    }
  })
}

/**
 * Devuelve un mapa productId → cantidad total vendida hoy.
 * Query ligera: solo cuenta order_items de órdenes pagadas del día actual.
 */
export async function getTopSellingProducts(): Promise<Map<string, number>> {
  const { start, end } = dayRangeInTimeZone()

  // Supabase JS v2: filtro sobre la relación orders vía !inner join.
  const { data, error } = await client()
    .from('order_items')
    .select('sellable_product_id, quantity, order:orders!inner(status, created_at)')
    .eq('orders.status', 'paid')
    .gte('orders.created_at', start)
    .lt('orders.created_at', end)

  if (error) throw error

  const map = new Map<string, number>()
  for (const row of data ?? []) {
    const id = row.sellable_product_id as string
    const qty = Number(row.quantity)
    map.set(id, (map.get(id) ?? 0) + qty)
  }
  return map
}

// --- Mapa de mesas (módulo Mesas) --------------------------------------------

export async function getFloorTables(): Promise<FloorTable[]> {
  const { data, error } = await client()
    .from('v_floor_tables_status')
    .select('*')
    .order('number', { ascending: true })
  if (error) throw error
  return (data ?? []).map((t) => ({
    id: t.id as string,
    number: Number(t.number),
    zone: (t.zone as string) ?? 'Salón',
    shape: (t.shape as FloorTable['shape']) ?? 'square',
    seats: Number(t.seats ?? 4),
    posX: Number(t.pos_x ?? 10),
    posY: Number(t.pos_y ?? 10),
    isActive: Boolean(t.is_active),
    openOrderId: (t.open_order_id as string) ?? null,
    openOrderNumber: t.open_order_number == null ? null : Number(t.open_order_number),
    openOrderCustomer: (t.open_order_customer as string) ?? null,
    openOrderCreatedBy: (t.open_order_created_by as string) ?? null,
    openOrderCreatedByName: (t.open_order_created_name as string) ?? null,
    openOrderCreatedAt: (t.open_order_created_at as string) ?? null,
    openOrderTotal: Number(t.open_order_total ?? 0),
  }))
}

export async function createFloorTable(params: {
  number: number
  zone: string
  shape: 'square' | 'round'
  seats: number
  posX: number
  posY: number
}): Promise<string> {
  const { data, error } = await client()
    .from('floor_tables')
    .insert({
      number: params.number,
      zone: params.zone,
      shape: params.shape,
      seats: params.seats,
      pos_x: params.posX,
      pos_y: params.posY,
    })
    .select('id')
    .single()
  if (error) throw error
  return data.id as string
}

export async function updateFloorTable(id: string, params: Partial<{
  number: number
  zone: string
  shape: 'square' | 'round'
  seats: number
  posX: number
  posY: number
  isActive: boolean
}>): Promise<void> {
  const patch: Record<string, unknown> = {}
  if (params.number !== undefined) patch.number = params.number
  if (params.zone !== undefined) patch.zone = params.zone
  if (params.shape !== undefined) patch.shape = params.shape
  if (params.seats !== undefined) patch.seats = params.seats
  if (params.posX !== undefined) patch.pos_x = params.posX
  if (params.posY !== undefined) patch.pos_y = params.posY
  if (params.isActive !== undefined) patch.is_active = params.isActive

  const { error } = await client().from('floor_tables').update(patch).eq('id', id)
  if (error) throw error
}

export async function deleteFloorTable(id: string): Promise<void> {
  const { error } = await client().from('floor_tables').delete().eq('id', id)
  if (error) throw error
}

/** Mesas con un pedido abierto (sin cobrar) ahora mismo, para el selector de Caja. */
export async function getOccupiedTables(): Promise<number[]> {
  const { data, error } = await client()
    .from('orders')
    .select('table_number')
    .eq('status', 'open')
    .eq('order_type', 'dine-in')
    .not('table_number', 'is', null)

  if (error) throw error
  return [...new Set((data ?? []).map((o) => Number(o.table_number)))]
}

// --- Órdenes completas (para Comandas/Cocina) --------------------------------

export async function getOrdersWithItems(dateStart?: string, dateEnd?: string, allPages = false, statuses?: string[]): Promise<FullOrder[]> {
  const PAGE = 500
  const buildQuery = () => {
    let query = client().from('v_orders_with_credit_status').select('*', allPages ? { count: 'exact' } : undefined)
    if (statuses?.length) query = query.in('status', statuses)
    if (dateStart) query = query.gte('created_at', dateStart)
    if (dateEnd) query = allPages ? query.lt('created_at', dateEnd) : query.lte('created_at', dateEnd)
    return query.order('created_at', { ascending: false }).order('id', { ascending: false })
  }

  const rows: Record<string, unknown>[] = []
  if (!allPages) {
    const { data, error } = await buildQuery()
    if (error) throw error
    rows.push(...((data ?? []) as Record<string, unknown>[]))
  } else {
    // La primera página trae también el total; el resto se pide en paralelo
    // en vez de una por una (historial completo de Finanzas e Inicio).
    const first = await buildQuery().range(0, PAGE - 1)
    if (first.error) throw first.error
    const firstBatch = (first.data ?? []) as Record<string, unknown>[]
    rows.push(...firstBatch)
    const total = first.count ?? firstBatch.length
    if (firstBatch.length === PAGE && total > PAGE) {
      const offsets: number[] = []
      for (let offset = PAGE; offset < total; offset += PAGE) offsets.push(offset)
      const pages = await Promise.all(offsets.map(async offset => {
        const { data, error } = await buildQuery().range(offset, offset + PAGE - 1)
        if (error) throw error
        return (data ?? []) as Record<string, unknown>[]
      }))
      for (const page of pages) rows.push(...page)
    }
  }

  return rows.map((o) => ({
    id: o.id as string,
    orderNumber: o.order_number as number,
    status: o.status as string,
    creditAuthorized: Boolean(o.credit_authorized),
    customerId: (o.customer_id as string) ?? null,
    fulfillmentStatus: (o.fulfillment_status as FullOrder['fulfillmentStatus']) ?? 'new',
    notes: (o.notes as string) ?? null,
    orderType: (o.order_type as string) ?? 'takeaway',
    tableNumber: o.table_number == null ? null : Number(o.table_number),
    customerName: (o.customer_name as string) ?? 'Cliente',
    customerPhone: (o.customer_phone as string) ?? null,
    customerAddress: (o.customer_address as string) ?? null,
    customerIdentification: (o.customer_identification as string) ?? null,
    bcvRate: o.bcv_rate ? Number(o.bcv_rate) : null,
    createdBy: o.created_by as string,
    createdAt: o.created_at as string,
    updatedAt: o.updated_at as string,
    items: Array.isArray(o.items) ? o.items.map((i: Record<string, unknown>) => ({
      id: i.id as string,
      sellableProductId: i.sellable_product_id as string,
      productName: i.product_name as string,
      emoji: (i.emoji as string) ?? '🍽️', /* DB default: emoji */
      category: (i.category as string) ?? 'plato',
      quantity: Number(i.quantity),
      unitPrice: Number(i.unit_price),
      modifiers: Array.isArray(i.modifiers) ? i.modifiers.map((modifier: Record<string, unknown>) => ({
        optionId: modifier.option_id as string,
        optionName: modifier.option_name as string,
        modifierName: (modifier.modifier_name as string) ?? 'Modificador',
        price: Number(modifier.price ?? 0),
        quantity: Number(modifier.quantity ?? 1),
      })) : [],
    })) : [],
    payments: Array.isArray(o.payments) ? o.payments.map((p: Record<string, unknown>) => ({
      id: p.id as string,
      method: p.method as PaymentMethod,
      amount: Number(p.amount),
      accountId: (p.account_id as string) ?? null,
      personalAccountId: (p.personal_account_id as string) ?? null,
      referenceNumber: (p.reference_number as string) ?? null,
      receivedAmount: p.received_amount == null ? null : Number(p.received_amount),
      receivedCurrency: (p.received_currency as 'USD' | 'VES') ?? null,
      receivedExchangeRate: p.received_exchange_rate == null ? null : Number(p.received_exchange_rate),
      changeAmount: Number(p.change_amount ?? 0),
      changeCurrency: (p.change_currency as 'USD' | 'VES') ?? null,
      changeAccountId: (p.change_account_id as string) ?? null,
      changeExchangeRate: p.change_exchange_rate == null ? null : Number(p.change_exchange_rate),
      notes: (p.notes as string) ?? null,
      createdAt: p.created_at as string,
    })) : [],
    totalAmount: Number(o.total_amount),
  }))
}

// --- Actualizar estado de orden (para Cocina) --------------------------------

export async function updateOrderStatus(
  orderId: string,
  newStatus: FullOrder['fulfillmentStatus'],
): Promise<void> {
  const { data, error } = await client()
    .from('orders')
    .update({ fulfillment_status: newStatus })
    .eq('id', orderId)
    .select('id, fulfillment_status')
    .maybeSingle()

  if (error) throw error
  if (!data) throw new Error('No se encontró la comanda o no tienes permiso para cambiar su estado')
  if (data.fulfillment_status !== newStatus) {
    throw new Error(`El servidor mantuvo la comanda en “${String(data.fulfillment_status)}”`)
  }
}

export async function recordOrderPayments(params: {
  orderId: string
  payments: OrderPaymentComponent[]
  notes?: string | null
}): Promise<void> {
  if (params.payments.length === 0) throw new Error('Debe registrar al menos un pago')

  const { error } = await client().rpc('fn_record_order_payments', {
    p_order_id: params.orderId,
    p_payments: params.payments,
    p_notes: params.notes ?? null,
  })
  if (error) throw error
}

export async function getOrderById(orderId: string): Promise<FullOrder | null> {
  const { data, error } = await client()
    .from('v_orders_with_credit_status')
    .select('*')
    .eq('id', orderId)
    .single()

  if (error) return null
  if (!data) return null

  return {
    id: data.id as string,
    orderNumber: data.order_number as number,
    status: data.status as string,
    creditAuthorized: Boolean(data.credit_authorized),
    customerId: (data.customer_id as string) ?? null,
    fulfillmentStatus: (data.fulfillment_status as FullOrder['fulfillmentStatus']) ?? 'new',
    notes: (data.notes as string) ?? null,
    orderType: (data.order_type as string) ?? 'takeaway',
    tableNumber: data.table_number == null ? null : Number(data.table_number),
    customerName: (data.customer_name as string) ?? 'Cliente',
    customerPhone: (data.customer_phone as string) ?? null,
    customerAddress: (data.customer_address as string) ?? null,
    customerIdentification: (data.customer_identification as string) ?? null,
    bcvRate: data.bcv_rate ? Number(data.bcv_rate) : null,
    createdBy: data.created_by as string,
    createdAt: data.created_at as string,
    updatedAt: data.updated_at as string,
    items: Array.isArray(data.items) ? data.items.map((i: Record<string, unknown>) => ({
      id: i.id as string,
      sellableProductId: i.sellable_product_id as string,
      productName: i.product_name as string,
      emoji: (i.emoji as string) ?? '🍽️', /* DB default: emoji */
      category: (i.category as string) ?? 'plato',
      quantity: Number(i.quantity),
      unitPrice: Number(i.unit_price),
      modifiers: Array.isArray(i.modifiers) ? i.modifiers.map((modifier: Record<string, unknown>) => ({
        optionId: modifier.option_id as string,
        optionName: modifier.option_name as string,
        modifierName: (modifier.modifier_name as string) ?? 'Modificador',
        price: Number(modifier.price ?? 0),
        quantity: Number(modifier.quantity ?? 1),
      })) : [],
    })) : [],
    payments: Array.isArray(data.payments) ? data.payments.map((p: Record<string, unknown>) => ({
      id: p.id as string,
      method: p.method as PaymentMethod,
      amount: Number(p.amount),
      accountId: (p.account_id as string) ?? null,
      personalAccountId: (p.personal_account_id as string) ?? null,
      referenceNumber: (p.reference_number as string) ?? null,
      receivedAmount: p.received_amount == null ? null : Number(p.received_amount),
      notes: (p.notes as string) ?? null,
      createdAt: p.created_at as string,
    })) : [],
    totalAmount: Number(data.total_amount),
  }
}

