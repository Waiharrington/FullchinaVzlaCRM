import { client } from './client'
import { getDeliveryProductId, removeOrderItem } from './orders'
import type { DeliveryConfigRow, DeliveryZoneRow } from './types'

export async function getDeliverySettings(): Promise<{ config: DeliveryConfigRow; zones: DeliveryZoneRow[] }> {
  const [configRes, zonesRes, payrollConfigRes] = await Promise.all([
    client().from('delivery_config').select('origin_lat,origin_lng,road_factor,is_enabled').eq('id', 1).maybeSingle(),
    client().from('delivery_zones').select('id,min_km,max_km,price,sort_order,is_active').order('sort_order', { ascending: true }),
    client().from('delivery_payroll_config').select('employee_percent').eq('id', 1).maybeSingle(),
  ])
  if (configRes.error) throw configRes.error
  if (zonesRes.error) throw zonesRes.error
  if (payrollConfigRes.error) throw payrollConfigRes.error
  const c = configRes.data
  return {
    config: {
      originLat: c?.origin_lat == null ? null : Number(c.origin_lat),
      originLng: c?.origin_lng == null ? null : Number(c.origin_lng),
      roadFactor: c?.road_factor == null ? 1.3 : Number(c.road_factor),
      enabled: c?.is_enabled ?? true,
      employeePercent: Number(payrollConfigRes.data?.employee_percent ?? 70),
    },
    zones: (zonesRes.data ?? []).map((z) => ({
      id: z.id as string, minKm: Number(z.min_km), maxKm: z.max_km == null ? null : Number(z.max_km),
      price: Number(z.price), sortOrder: Number(z.sort_order), isActive: z.is_active as boolean,
    })),
  }
}

export async function updateDeliveryConfig(updates: Partial<{ originLat: number | null; originLng: number | null; roadFactor: number; enabled: boolean }>): Promise<void> {
  const payload: Record<string, unknown> = {}
  if (updates.originLat !== undefined) payload.origin_lat = updates.originLat
  if (updates.originLng !== undefined) payload.origin_lng = updates.originLng
  if (updates.roadFactor !== undefined) payload.road_factor = updates.roadFactor
  if (updates.enabled !== undefined) payload.is_enabled = updates.enabled
  if (Object.keys(payload).length === 0) return
  const { error } = await client().from('delivery_config').update(payload).eq('id', 1)
  if (error) throw error
}

export async function createDeliveryZone(input: { minKm: number; maxKm: number | null; price: number; sortOrder: number }): Promise<string> {
  const { data, error } = await client().from('delivery_zones').insert({
    min_km: input.minKm, max_km: input.maxKm, price: input.price, sort_order: input.sortOrder,
  }).select('id').single()
  if (error) throw error
  return data.id as string
}

export async function updateDeliveryZone(id: string, updates: Partial<{ minKm: number; maxKm: number | null; price: number; sortOrder: number; isActive: boolean }>): Promise<void> {
  const payload: Record<string, unknown> = {}
  if (updates.minKm !== undefined) payload.min_km = updates.minKm
  if (updates.maxKm !== undefined) payload.max_km = updates.maxKm
  if (updates.price !== undefined) payload.price = updates.price
  if (updates.sortOrder !== undefined) payload.sort_order = updates.sortOrder
  if (updates.isActive !== undefined) payload.is_active = updates.isActive
  if (Object.keys(payload).length === 0) return
  const { error } = await client().from('delivery_zones').update(payload).eq('id', id)
  if (error) throw error
}

export async function deleteDeliveryZone(id: string): Promise<void> {
  const { error } = await client().from('delivery_zones').delete().eq('id', id)
  if (error) throw error
}

// --- Modificadores -----------------------------------------------------------

/**
 * Fija (o quita) el costo de delivery de una comanda sin cobrar. El cargo se
 * guarda como el renglón del producto oculto "Delivery". Se elimina el renglón
 * previo (si existe) y se inserta uno nuevo con el monto; fee 0 sólo lo quita.
 */
export async function setOrderDeliveryFee(orderId: string, fee: number): Promise<void> {
  const sb = client()
  const deliveryId = await getDeliveryProductId()
  if (!deliveryId) throw new Error('No existe el producto de Delivery configurado')

  const { data: existing, error: findErr } = await sb
    .from('order_items')
    .select('id')
    .eq('order_id', orderId)
    .eq('sellable_product_id', deliveryId)
    .limit(1)
    .maybeSingle()
  if (findErr) throw findErr

  if (existing?.id) {
    await removeOrderItem(existing.id as string)
  }
  const rounded = Math.round(Math.max(0, fee) * 100) / 100
  if (rounded > 0) {
    const { error: insErr } = await sb.from('order_items').insert({
      order_id: orderId,
      sellable_product_id: deliveryId,
      quantity: 1,
      unit_price: rounded,
    })
    if (insErr) throw insErr
  }
}

// --- Ventas de hoy -----------------------------------------------------------

