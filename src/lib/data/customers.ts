import { subscribeToDataChanges } from '../supabase'
import { client } from './client'
import type { Customer, CustomerOrderSummary } from './types'

export async function updateOrderCustomer(orderId: string, customer: Customer): Promise<void> {
  const { data, error } = await client()
    .from('orders')
    .update({
      customer_id: customer.id,
      customer_name: customer.name,
    })
    .eq('id', orderId)
    .is('customer_id', null)
    .select('id')
    .maybeSingle()

  if (error) throw error
  if (!data) throw new Error('Esta comanda ya tiene un cliente asociado')
}

let customersCache: Customer[] | null = null

export function invalidateCustomersCache() {
  customersCache = null
}

subscribeToDataChanges(table => {
  if (table === '*' || [
    'customers', 'customer_loyalty_visits', 'customer_loyalty_rewards', 'customer_favorites',
  ].includes(table)) {
    invalidateCustomersCache()
  }
})

export async function getCustomers(forceRefresh = false): Promise<Customer[]> {
  if (customersCache && !forceRefresh) {
    return customersCache
  }
  const { data, error } = await client().from('customers')
    .select('id,full_name,identification,phone,address,email,total_visits,rewards_unlocked,last_visit,favorite_product,birth_date,created_at,is_active')
    .order('full_name')
  if (error) throw error
  const mapped = (data ?? []).map((row) => ({
    id: row.id as string,
    name: row.full_name as string,
    identification: (row.identification as string) ?? '',
    phone: (row.phone as string) ?? '',
    address: (row.address as string) ?? '',
    email: (row.email as string) ?? '',
    totalVisits: Number(row.total_visits ?? 0),
    rewardsUnlocked: Number(row.rewards_unlocked ?? 0),
    lastVisit: (row.last_visit as string) ?? '',
    favoriteProduct: (row.favorite_product as string) ?? '',
    birthday: (row.birth_date as string) ?? '',
    createdAt: (row.created_at as string) ?? '',
    isActive: Boolean(row.is_active),
  }))
  customersCache = mapped
  return mapped
}

/** Resumen de fidelización: solo cuenta las visitas iniciadas tras el registro web. */
export async function getLoyaltyCustomers(): Promise<Customer[]> {
  const { data, error } = await client().rpc('fn_get_loyalty_customers')
  if (error) throw error
  return ((data ?? []) as Record<string, unknown>[]).map(row => ({
    id: String(row.id), name: String(row.full_name ?? ''), identification: String(row.identification ?? ''),
    phone: String(row.phone ?? ''), address: String(row.address ?? ''), email: String(row.email ?? ''),
    totalVisits: Number(row.total_visits ?? 0), rewardsUnlocked: Number(row.rewards_unlocked ?? 0),
    lastVisit: String(row.last_visit ?? ''), favoriteProduct: String(row.favorite_product ?? ''),
    birthday: String(row.birth_date ?? ''), createdAt: String(row.created_at ?? ''), isActive: Boolean(row.is_active),
  }))
}

export async function setCustomerActive(id: string, isActive: boolean): Promise<void> {
  invalidateCustomersCache()
  const { error } = await client().from('customers').update({ is_active: isActive }).eq('id', id)
  if (error) throw error
}

// Órdenes reales de un cliente (para la ficha del cliente).
export async function getCustomerOrders(customerId: string, customerName: string): Promise<CustomerOrderSummary[]> {
  if (!customerName.trim()) return []
  const primary = await client()
    .from('v_orders_with_credit_status')
    .select('id, order_number, created_at, order_type, status, fulfillment_status, total_amount, items, payments')
    .eq('customer_id', customerId)
    .order('created_at', { ascending: false })
    .limit(50)
  if (primary.error) throw primary.error
  let data = primary.data
  if ((data ?? []).length === 0) {
    const fallback = await client()
      .from('v_orders_with_items')
      .select('id, order_number, created_at, order_type, status, fulfillment_status, total_amount, items, payments')
      .is('customer_id', null)
      .ilike('customer_name', customerName.trim())
      .order('created_at', { ascending: false })
      .limit(50)
    if (fallback.error) throw fallback.error
    data = fallback.data
  }
  return (data ?? []).map((o) => {
    const items = Array.isArray(o.items) ? o.items as Array<Record<string, unknown>> : []
    const mappedItems = items.map((it) => ({
      productName: String(it.product_name ?? 'Producto'),
      quantity: Number(it.quantity ?? 0),
    }))
    const itemsText = mappedItems.map((item) => `${item.quantity}× ${item.productName}`).join(', ')
    const payments = Array.isArray(o.payments) ? o.payments as Array<Record<string, unknown>> : []
    return {
      id: o.id as string,
      orderNumber: o.order_number as number,
      createdAt: o.created_at as string,
      orderType: (o.order_type as string) ?? '',
      status: o.status as string,
      fulfillmentStatus: (o.fulfillment_status as string) ?? '',
      total: Number(o.total_amount ?? 0),
      itemsText,
      items: mappedItems,
      paymentMethods: payments.map((payment) => String(payment.method ?? '')).filter(Boolean),
    }
  })
}

export async function createCustomer(params: { name: string; identification?: string; phone?: string; address?: string; birthDate?: string }): Promise<Customer> {
  invalidateCustomersCache()
  const { data, error } = await client().rpc('fn_create_customer', {
    p_full_name: params.name,
    p_identification: params.identification || null,
    p_phone: params.phone || null,
    p_address: params.address || null,
    p_birth_date: params.birthDate || null,
  }).single()
  if (error) throw error
  const row = data as Record<string, unknown>
  return {
    id: row.id as string, name: row.full_name as string, identification: (row.identification as string) ?? '', phone: (row.phone as string) ?? '', address: (row.address as string) ?? '',
    email: (row.email as string) ?? '', totalVisits: Number(row.total_visits ?? 0),
    rewardsUnlocked: Number(row.rewards_unlocked ?? 0), lastVisit: (row.last_visit as string) ?? '',
    favoriteProduct: (row.favorite_product as string) ?? '', birthday: (row.birth_date as string) ?? '',
    createdAt: (row.created_at as string) ?? '',
    isActive: Boolean(row.is_active),
  }
}

export async function updateCustomer(id: string, params: { name: string; identification?: string; phone?: string; address?: string; birthDate?: string }): Promise<Customer> {
  invalidateCustomersCache()
  const { data, error } = await client().rpc('fn_update_customer', {
    p_id: id,
    p_full_name: params.name,
    p_phone: params.phone || null,
    p_identification: params.identification || null,
    p_address: params.address || null,
    p_birth_date: params.birthDate || null,
  }).single()
  if (error) throw error
  const row = data as Record<string, unknown>
  return {
    id: row.id as string, name: row.full_name as string, identification: (row.identification as string) ?? '', phone: (row.phone as string) ?? '', address: (row.address as string) ?? '',
    email: (row.email as string) ?? '', totalVisits: Number(row.total_visits ?? 0),
    rewardsUnlocked: Number(row.rewards_unlocked ?? 0), lastVisit: (row.last_visit as string) ?? '',
    favoriteProduct: (row.favorite_product as string) ?? '', birthday: (row.birth_date as string) ?? '',
    createdAt: (row.created_at as string) ?? '',
    isActive: Boolean(row.is_active),
  }
}

export async function registerCustomerVisit(customerId: string): Promise<Customer> {
  const { data, error } = await client().rpc('fn_register_customer_visit', { p_customer_id: customerId })
  if (error) throw error
  const row = data as Record<string, unknown>
  return {
    id: row.id as string, name: row.full_name as string, identification: (row.identification as string) ?? '',
    phone: (row.phone as string) ?? '', address: (row.address as string) ?? '', email: (row.email as string) ?? '',
    totalVisits: Number(row.total_visits ?? 0), rewardsUnlocked: Number(row.rewards_unlocked ?? 0),
    lastVisit: (row.last_visit as string) ?? '', favoriteProduct: (row.favorite_product as string) ?? '',
    birthday: (row.birth_date as string) ?? '', createdAt: (row.created_at as string) ?? '', isActive: Boolean(row.is_active),
  }
}

// --- Menú semanal -----------------------------------------------------------

