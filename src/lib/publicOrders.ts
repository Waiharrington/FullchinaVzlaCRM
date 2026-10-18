import { customerSupabase, supabase } from './supabase'
import type { Product } from './dataService'

export interface WebOrderCartItem {
  productId: string
  productName: string
  price: number
  quantity: number
  imageUrl?: string
  /** Indicaciones y extras elegidos para esta línea; se envían a cocina en las notas. */
  notes?: string
  modifiers?: Array<{ optionId: string; quantity: number }>
}

export interface CustomerRepeatOrder {
  orderId: string
  orderType: 'takeaway' | 'delivery'
  customerName: string
  customerPhone: string
  customerIdentification: string
  deliveryAddress: string | null
  deliveryLat: number | null
  deliveryLng: number | null
  customerNotes: string
  items: Array<{
    productId: string
    productName: string
    available: boolean
    quantity: number
    notes?: string
    modifiers: Array<{ optionId: string; quantity: number }>
  }>
}

export interface Promotion {
  id: string
  tag: string
  title: string
  subtitle: string
  price: string | null
  oldPrice: string | null
  note: string
  icon: string
  color: string
  sortOrder: number
}

export interface WebOrderResult {
  id: string
  code: string
  total: number
  subtotal?: number
  deliveryFee?: number
  priceChanged?: boolean
  legacyReview?: boolean
  items?: Array<{ lineNumber: number; productId: string; unitPrice: number }>
}

export interface PendingWebOrder {
  id: string
  code: string
  customerName: string
  customerPhone: string
  customerIdentification: string
  orderType: 'takeaway' | 'delivery'
  deliveryAddress: string | null
  notes: string | null
  subtotal: number
  bcvRate: number | null
  createdAt: string
  items: Array<Omit<WebOrderCartItem, 'modifiers'> & {
    id: string
    modifiers: Array<{ optionId: string; modifierId: string; groupName: string; optionName: string; quantity: number; unitPrice: number }>
  }>
}

function db() {
  if (!supabase) throw new Error('El menú no está disponible en este momento')
  return supabase
}

async function customerDb() {
  if (!customerSupabase) throw new Error('El perfil del cliente no está disponible en este momento')
  const { data, error } = await customerSupabase.auth.getSession()
  if (error) throw error
  if (!data.session) throw new Error('Inicia sesión en Mi perfil para consultar tus pedidos.')
  return customerSupabase
}

async function webOrderWriteDb() {
  if (!customerSupabase) return db()
  const customerClient = customerSupabase
  const { data, error } = await customerClient.auth.getSession()
  if (error) throw error
  return data.session ? customerClient : db()
}

export async function getCustomerOrderForRepeat(orderId: string): Promise<CustomerRepeatOrder> {
  const { data, error } = await (await customerDb()).rpc('fn_get_customer_order_for_repeat', { p_order_id: orderId })
  if (error) throw error
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('No pudimos leer el pedido para repetirlo.')
  const row = data as Record<string, unknown>
  const orderType = row.orderType === 'delivery' ? 'delivery' : row.orderType === 'takeaway' ? 'takeaway' : null
  if (!orderType) throw new Error('Este pedido tiene una modalidad que ya no está disponible.')
  const items = Array.isArray(row.items) ? row.items as Record<string, unknown>[] : []
  return {
    orderId: String(row.orderId ?? orderId),
    orderType,
    customerName: String(row.customerName ?? ''),
    customerPhone: String(row.customerPhone ?? ''),
    customerIdentification: String(row.customerIdentification ?? ''),
    deliveryAddress: row.deliveryAddress == null ? null : String(row.deliveryAddress),
    deliveryLat: row.deliveryLat == null ? null : Number(row.deliveryLat),
    deliveryLng: row.deliveryLng == null ? null : Number(row.deliveryLng),
    customerNotes: String(row.customerNotes ?? ''),
    items: items.map(item => ({
      productId: String(item.productId),
      productName: String(item.productName ?? ''),
      available: Boolean(item.available),
      quantity: Number(item.quantity),
      notes: item.notes == null ? undefined : String(item.notes),
      modifiers: (Array.isArray(item.modifiers) ? item.modifiers as Record<string, unknown>[] : []).map(modifier => ({
        optionId: String(modifier.optionId),
        quantity: Number(modifier.quantity),
      })),
    })),
  }
}

export async function getPublicCatalog(): Promise<Product[]> {
  const { data, error } = await db().rpc('fn_get_public_catalog')
  if (error) throw error
  const rows = Array.isArray(data) ? data : []
  return rows.map((row: Record<string, unknown>) => {
    const category = String(row.category || 'plato')
    const categories = Array.isArray(row.categories) && row.categories.length
      ? Array.from(new Set((row.categories as unknown[]).map((c) => String(c))))
      : [category]
    return {
      id: String(row.id),
      name: String(row.name),
      description: row.description ? String(row.description) : null,
      price: Number(row.price),
      cost: null,
      category,
      categories,
      emoji: String(row.emoji || '🥡'), /* DB default: emoji */
      active: true,
      imageUrl: row.image_url ? String(row.image_url) : null,
      menuLabel: (row.menu_label as Product['menuLabel']) ?? null,
    }
  })
}

export async function getPublicMenuCategories(): Promise<{ key: string; label: string; sortOrder: number }[]> {
  const { data, error } = await db().rpc('fn_get_menu_categories')
  if (error) throw error
  const rows = Array.isArray(data) ? data : []
  return rows.map((row: Record<string, unknown>) => ({
    key: String(row.key),
    label: String(row.label),
    sortOrder: Number(row.sort_order),
  }))
}

export async function getPublicProductModifiers(productId: string): Promise<import('./dataService').ProductModifierGroup[]> {
  const { data, error } = await db().rpc('fn_get_product_modifiers', { p_product_id: productId })
  if (error) throw error
  const rows = Array.isArray(data) ? data as Record<string, unknown>[] : []
  return rows.map((g) => ({
    modifierId: String(g.modifierId),
    name: String(g.name),
    minSelections: Number(g.minSelections ?? 0),
    maxSelections: g.maxSelections == null ? null : Number(g.maxSelections),
    allowRepeat: Boolean(g.allowRepeat),
    options: (Array.isArray(g.options) ? g.options as Record<string, unknown>[] : []).map((o) => ({
      id: String(o.id), name: String(o.name), price: Number(o.price ?? 0),
    })),
  }))
}

export async function getPublicDeliverySettings(): Promise<import('./delivery').DeliverySettings> {
  const { data, error } = await db().rpc('fn_get_delivery_settings')
  if (error) throw error
  const raw = (data ?? {}) as Record<string, unknown>
  const zones = Array.isArray(raw.zones) ? raw.zones as Record<string, unknown>[] : []
  return {
    originLat: raw.originLat == null ? null : Number(raw.originLat),
    originLng: raw.originLng == null ? null : Number(raw.originLng),
    roadFactor: raw.roadFactor == null ? 1.3 : Number(raw.roadFactor),
    enabled: raw.enabled == null ? true : Boolean(raw.enabled),
    zones: zones.map((z) => ({
      id: String(z.id), minKm: Number(z.minKm), maxKm: z.maxKm == null ? null : Number(z.maxKm),
      price: Number(z.price), sortOrder: Number(z.sortOrder),
    })),
  }
}

export async function getPublicPromotions(): Promise<Promotion[]> {
  const { data, error } = await db()
    .from('promotions')
    .select('id,tag,title,subtitle,price,old_price,note,icon,color,sort_order')
    .eq('is_active', true)
    .order('sort_order', { ascending: true })
  if (error) throw error
  return (data ?? []).map((row: Record<string, unknown>) => ({
    id: String(row.id),
    tag: String(row.tag),
    title: String(row.title),
    subtitle: String(row.subtitle),
    price: row.price ? String(row.price) : null,
    oldPrice: row.old_price ? String(row.old_price) : null,
    note: String(row.note),
    icon: String(row.icon),
    color: String(row.color),
    sortOrder: Number(row.sort_order),
  }))
}

export async function createWebOrder(params: {
  customerName: string
  customerPhone: string
  customerIdentification: string
  orderType: 'takeaway' | 'delivery'
  deliveryAddress: string
  notes: string
  items: WebOrderCartItem[]
  bcvRate: number | null
  idempotencyKey: string
  deliveryFee?: number
  deliveryLat?: number | null
  deliveryLng?: number | null
}): Promise<WebOrderResult> {
  const customerClient = await webOrderWriteDb()
  const { data, error } = await customerClient.rpc('fn_create_web_order', {
    p_customer_name: params.customerName,
    p_customer_phone: params.customerPhone,
    p_customer_identification: params.customerIdentification,
    p_order_type: params.orderType,
    p_delivery_address: params.deliveryAddress || null,
    p_notes: params.notes || null,
    p_items: params.items.map(item => ({ productId: item.productId, quantity: item.quantity, expectedUnitPrice: item.price, notes: item.notes || undefined, modifiers: item.modifiers ?? [] })),
    p_bcv_rate: params.bcvRate,
    p_idempotency_key: params.idempotencyKey,
    p_delivery_fee: params.deliveryFee ?? 0,
    p_delivery_lat: params.deliveryLat ?? null,
    p_delivery_lng: params.deliveryLng ?? null,
  })
  if (error) throw error
  const result = data as Record<string, unknown>
  return {
    id: result.id == null ? '' : String(result.id),
    code: result.code == null ? '' : String(result.code),
    total: Number(result.total),
    subtotal: result.subtotal == null ? undefined : Number(result.subtotal),
    deliveryFee: result.deliveryFee == null ? undefined : Number(result.deliveryFee),
    priceChanged: result.status === 'price_changed',
    legacyReview: result.status === 'legacy_review',
    items: Array.isArray(result.items) ? (result.items as Record<string, unknown>[]).map(item => ({
      lineNumber: Number(item.lineNumber), productId: String(item.productId), unitPrice: Number(item.unitPrice),
    })) : undefined,
  }
}

export async function getPendingWebOrders(): Promise<PendingWebOrder[]> {
  const { data, error } = await db()
    .from('web_order_requests')
    .select('id,request_number,customer_name,customer_phone,customer_identification,order_type,delivery_address,notes,subtotal,bcv_rate,created_at,web_order_items(id,sellable_product_id,product_name,quantity,unit_price,notes,modifiers,line_number)')
    .eq('status', 'pending_confirmation')
    .order('created_at', { ascending: false })
  if (error) throw error

  return (data ?? []).map((row: Record<string, unknown>) => ({
    id: String(row.id),
    code: `WEB-${String(row.request_number).padStart(6, '0')}`,
    customerName: String(row.customer_name),
    customerPhone: String(row.customer_phone),
    customerIdentification: String(row.customer_identification ?? ''),
    orderType: row.order_type as 'takeaway' | 'delivery',
    deliveryAddress: row.delivery_address ? String(row.delivery_address) : null,
    notes: row.notes ? String(row.notes) : null,
    subtotal: Number(row.subtotal),
    bcvRate: row.bcv_rate ? Number(row.bcv_rate) : null,
    createdAt: String(row.created_at),
    items: ((row.web_order_items as Array<Record<string, unknown>>) ?? []).map(item => ({
      id: String(item.id),
      productId: String(item.sellable_product_id),
      productName: String(item.product_name),
      quantity: Number(item.quantity),
      price: Number(item.unit_price),
      notes: item.notes ? String(item.notes) : undefined,
      modifiers: Array.isArray(item.modifiers) ? (item.modifiers as Array<Record<string, unknown>>).map(modifier => ({
        optionId: String(modifier.optionId),
        modifierId: String(modifier.modifierId),
        groupName: String(modifier.groupName),
        optionName: String(modifier.optionName),
        quantity: Number(modifier.quantity),
        unitPrice: Number(modifier.unitPrice),
      })) : [],
    })),
  }))
}

export async function confirmWebOrder(requestId: string): Promise<{ id: string; orderNumber: number }> {
  const { data, error } = await db().rpc('fn_confirm_web_order', { p_request_id: requestId })
  if (error) throw error
  const result = data as Record<string, unknown>
  return { id: String(result.id), orderNumber: Number(result.orderNumber) }
}
