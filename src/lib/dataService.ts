// Capa de datos real contra el schema `fullchinavzla` en Supabase.
// Reemplaza gradualmente a DemoDataProvider. Empezamos por Caja (POS).
//
// Moneda: todo en USD. La tasa BCV del día se estampa en orders.bcv_rate.
// Flujo de cobro: insertar order -> order_items -> payment. Los triggers del
// schema derivan el estado de la orden a 'paid' cuando el pago cubre el total
// (fn_derive_order_status_from_payments) y previenen sobrepago.

import { supabase } from './supabase'

export interface Product {
  id: string
  name: string
  description: string | null
  price: number
  cost: number | null
  category: string
  emoji: string
  active: boolean
}

export interface CartItem {
  productId: string
  productName: string
  price: number
  quantity: number
}

export type PaymentMethod = 'cash' | 'card' | 'transfer' | 'other'

export interface OrderResult {
  id: string
  orderNumber: number
  status: string
  total: number
  bcvRate: number | null
  createdAt: string
  paymentMethod: PaymentMethod
  items: CartItem[]
}

export interface TodayOrder {
  id: string
  orderNumber: number
  status: string
  total: number
  paymentMethod: PaymentMethod | null
  createdAt: string
}

function client() {
  if (!supabase) throw new Error('Supabase no está configurado (revisa el .env)')
  return supabase
}

// --- Productos ---------------------------------------------------------------

export async function getProducts(): Promise<Product[]> {
  const { data, error } = await client()
    .from('sellable_products')
    .select('id,name,description,price,cost,category,emoji,is_active')
    .eq('is_active', true)
    .order('category', { ascending: true })
    .order('name', { ascending: true })

  if (error) throw error
  return (data ?? []).map((r) => ({
    id: r.id as string,
    name: r.name as string,
    description: (r.description as string) ?? null,
    price: Number(r.price),
    cost: r.cost === null ? null : Number(r.cost),
    category: r.category as string,
    emoji: r.emoji as string,
    active: r.is_active as boolean,
  }))
}

// --- Cobro (checkout) --------------------------------------------------------

export async function checkout(params: {
  items: CartItem[]
  method: PaymentMethod
  bcvRate: number | null
  userId: string
  notes?: string | null
}): Promise<OrderResult> {
  const sb = client()
  const total = params.items.reduce((sum, i) => sum + i.price * i.quantity, 0)

  // 1) Orden (status 'open' por defecto)
  const { data: order, error: orderErr } = await sb
    .from('orders')
    .insert({
      created_by: params.userId,
      bcv_rate: params.bcvRate,
      notes: params.notes ?? null,
    })
    .select('id, order_number, created_at')
    .single()
  if (orderErr) throw orderErr

  // 2) Líneas de la orden (necesarias antes del pago: el trigger valida contra su suma)
  const { error: itemsErr } = await sb.from('order_items').insert(
    params.items.map((i) => ({
      order_id: order.id,
      sellable_product_id: i.productId,
      quantity: i.quantity,
      unit_price: i.price,
    })),
  )
  if (itemsErr) throw itemsErr

  // 3) Pago — el trigger deriva la orden a 'paid' al cubrir el total
  const { error: payErr } = await sb.from('payments').insert({
    order_id: order.id,
    method: params.method,
    amount: total,
    created_by: params.userId,
  })
  if (payErr) throw payErr

  return {
    id: order.id as string,
    orderNumber: order.order_number as number,
    status: 'paid',
    total,
    bcvRate: params.bcvRate,
    createdAt: order.created_at as string,
    paymentMethod: params.method,
    items: params.items,
  }
}

// --- Ventas de hoy -----------------------------------------------------------

export async function getTodayOrders(): Promise<TodayOrder[]> {
  const start = new Date()
  start.setHours(0, 0, 0, 0)

  const { data, error } = await client()
    .from('orders')
    .select('id, order_number, status, created_at, payments(method, amount)')
    .eq('status', 'paid')
    .gte('created_at', start.toISOString())
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
