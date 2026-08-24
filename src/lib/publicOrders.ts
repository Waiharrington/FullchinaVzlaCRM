import { supabase } from './supabase'
import type { Product } from './dataService'

export interface WebOrderCartItem {
  productId: string
  productName: string
  price: number
  quantity: number
  imageUrl?: string
  /** Indicaciones y extras elegidos para esta línea; se envían a cocina en las notas. */
  notes?: string
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
}

export interface PendingWebOrder {
  id: string
  code: string
  customerName: string
  customerPhone: string
  orderType: 'takeaway' | 'delivery'
  deliveryAddress: string | null
  notes: string | null
  subtotal: number
  bcvRate: number | null
  createdAt: string
  items: Array<WebOrderCartItem & { id: string }>
}

function db() {
  if (!supabase) throw new Error('El menú no está disponible en este momento')
  return supabase
}

export async function getPublicCatalog(): Promise<Product[]> {
  const { data, error } = await db().rpc('fn_get_public_catalog')
  if (error) throw error
  const rows = Array.isArray(data) ? data : []
  return rows.map((row: Record<string, unknown>) => ({
    id: String(row.id),
    name: String(row.name),
    description: row.description ? String(row.description) : null,
    price: Number(row.price),
    cost: null,
    category: String(row.category || 'plato'),
    emoji: String(row.emoji || '🥡'),
    active: true,
    imageUrl: row.image_url ? String(row.image_url) : null,
  }))
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
  orderType: 'takeaway' | 'delivery'
  deliveryAddress: string
  notes: string
  items: WebOrderCartItem[]
  bcvRate: number | null
  idempotencyKey: string
}): Promise<WebOrderResult> {
  const { data, error } = await db().rpc('fn_create_web_order', {
    p_customer_name: params.customerName,
    p_customer_phone: params.customerPhone,
    p_order_type: params.orderType,
    p_delivery_address: params.deliveryAddress || null,
    p_notes: params.notes || null,
    p_items: params.items.map(item => ({ productId: item.productId, quantity: item.quantity, notes: item.notes || undefined })),
    p_bcv_rate: params.bcvRate,
    p_idempotency_key: params.idempotencyKey,
  })
  if (error) throw error
  const result = data as Record<string, unknown>
  return { id: String(result.id), code: String(result.code), total: Number(result.total) }
}

export async function getPendingWebOrders(): Promise<PendingWebOrder[]> {
  const { data, error } = await db()
    .from('web_order_requests')
    .select('id,request_number,customer_name,customer_phone,order_type,delivery_address,notes,subtotal,bcv_rate,created_at,web_order_items(id,sellable_product_id,product_name,quantity,unit_price)')
    .eq('status', 'pending_confirmation')
    .order('created_at', { ascending: false })
  if (error) throw error

  return (data ?? []).map((row: Record<string, unknown>) => ({
    id: String(row.id),
    code: `WEB-${String(row.request_number).padStart(6, '0')}`,
    customerName: String(row.customer_name),
    customerPhone: String(row.customer_phone),
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
    })),
  }))
}

export async function confirmWebOrder(requestId: string): Promise<{ id: string; orderNumber: number }> {
  const { data, error } = await db().rpc('fn_confirm_web_order', { p_request_id: requestId })
  if (error) throw error
  const result = data as Record<string, unknown>
  return { id: String(result.id), orderNumber: Number(result.orderNumber) }
}
