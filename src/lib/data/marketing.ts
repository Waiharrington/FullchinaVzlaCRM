import { client } from './client'
import type { Customer, WeeklyDish, WhatsAppMessage, WhatsAppSegment, WhatsAppTemplate } from './types'

function mapWeeklyRow(row: Record<string, unknown>): WeeklyDish {
  const acts = Array.isArray(row.weekly_menu_activations)
    ? (row.weekly_menu_activations as Array<Record<string, unknown>>).map((a) => a.week_start as string)
    : []
  const lastUsed = acts.length > 0 ? acts.sort().slice(-1)[0] : null
  return {
    id: row.id as string, name: row.name as string, description: (row.description as string) ?? '',
    price: Number(row.price), cost: Number(row.cost ?? 0), emoji: row.emoji as string,
    status: row.is_active ? 'active' : 'inactive', weekTag: (row.week_tag as string) ?? '',
    sellableProductId: (row.sellable_product_id as string) ?? null,
    imageUrl: (row.image_url as string) ?? null,
    lastUsedWeekStart: lastUsed,
  }
}

export async function getWeeklyDishes(): Promise<WeeklyDish[]> {
  const { data, error } = await client()
    .from('weekly_menu_items')
    .select('*, weekly_menu_activations(week_start)')
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []).map(mapWeeklyRow)
}

export async function createWeeklyDish(
  dish: { name: string; description: string; price: number; cost: number; emoji: string; weekTag: string; imageUrl?: string | null },
  userId: string,
): Promise<WeeklyDish> {
  const { data, error } = await client().from('weekly_menu_items').insert({
    name: dish.name, description: dish.description, price: dish.price, cost: dish.cost,
    emoji: dish.emoji, week_tag: dish.weekTag, image_url: dish.imageUrl ?? null,
    is_active: true, created_by: userId,
  }).select('*').single()
  if (error) throw error
  return mapWeeklyRow(data as Record<string, unknown>)
}

export async function setWeeklyDishActive(id: string, active: boolean): Promise<void> {
  const { error } = await client().from('weekly_menu_items').update({ is_active: active }).eq('id', id)
  if (error) throw error
}

/** Registra (o confirma) que un plato estuvo activo en una semana (lun–dom). */
export async function recordWeeklyActivation(dishId: string, weekStart: string, weekEnd: string, userId: string): Promise<void> {
  const { error } = await client().from('weekly_menu_activations').upsert(
    { weekly_dish_id: dishId, week_start: weekStart, week_end: weekEnd, activated_by: userId },
    { onConflict: 'weekly_dish_id,week_start' },
  )
  if (error) throw error
}

/** Quita la activación de un plato para una semana concreta. */
export async function removeWeeklyActivation(dishId: string, weekStart: string): Promise<void> {
  const { error } = await client().from('weekly_menu_activations')
    .delete().eq('weekly_dish_id', dishId).eq('week_start', weekStart)
  if (error) throw error
}

/** Ids de platos que estuvieron activos en una semana dada. */
export async function getWeekActivations(weekStart: string): Promise<string[]> {
  const { data, error } = await client().from('weekly_menu_activations')
    .select('weekly_dish_id').eq('week_start', weekStart)
  if (error) throw error
  return (data ?? []).map((r) => r.weekly_dish_id as string)
}

/** Resumen de semanas con actividad: week_start → cantidad de platos. */
export async function getWeeklyActivationSummary(): Promise<Array<{ weekStart: string; weekEnd: string; count: number }>> {
  const { data, error } = await client().from('weekly_menu_activations')
    .select('week_start, week_end').order('week_start', { ascending: false })
  if (error) throw error
  const map = new Map<string, { weekEnd: string; count: number }>()
  for (const r of data ?? []) {
    const ws = r.week_start as string
    const cur = map.get(ws) ?? { weekEnd: r.week_end as string, count: 0 }
    cur.count += 1
    map.set(ws, cur)
  }
  return Array.from(map.entries()).map(([weekStart, v]) => ({ weekStart, weekEnd: v.weekEnd, count: v.count }))
}

export async function updateWeeklyDish(id: string, fields: Partial<{
  name: string; description: string; price: number; cost: number; emoji: string; weekTag: string; imageUrl: string | null
}>): Promise<void> {
  const payload: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (fields.name !== undefined) payload.name = fields.name
  if (fields.description !== undefined) payload.description = fields.description
  if (fields.price !== undefined) payload.price = fields.price
  if (fields.cost !== undefined) payload.cost = fields.cost
  if (fields.emoji !== undefined) payload.emoji = fields.emoji
  if (fields.weekTag !== undefined) payload.week_tag = fields.weekTag
  if (fields.imageUrl !== undefined) payload.image_url = fields.imageUrl
  const { error } = await client().from('weekly_menu_items').update(payload).eq('id', id)
  if (error) throw error
}

export async function syncWeeklyDishToCatalog(weeklyDishId: string): Promise<string> {
  const { data, error } = await client().rpc('fn_sync_weekly_dish_to_catalog', { p_weekly_dish_id: weeklyDishId })
  if (error) throw error
  return data as string
}

// --- Cola de WhatsApp -------------------------------------------------------

export async function getWhatsAppMessages(): Promise<WhatsAppMessage[]> {
  const { data, error } = await client().from('whatsapp_messages')
    .select('id,template_type,phone,message,status,sent_at,created_at,error_message,customers(full_name)')
    .order('created_at', { ascending: false }).limit(200)
  if (error) throw error
  return (data ?? []).map((row) => ({
    id: row.id as string, templateType: row.template_type as string,
    customerName: ((row.customers as Array<{ full_name?: string }> | null)?.[0]?.full_name) ?? 'Cliente',
    phone: row.phone as string, message: row.message as string,
    sentAt: ((row.sent_at ?? row.created_at) as string), status: row.status as WhatsAppMessage['status'],
    errorMessage: (row.error_message as string | null) ?? null,
  }))
}

export async function queueWhatsAppMessage(params: { customerId: string; phone: string; message: string; userId: string }): Promise<void> {
  const { error } = await client().from('whatsapp_messages').insert({
    customer_id: params.customerId, phone: params.phone, message: params.message,
    template_type: 'custom', status: 'queued', created_by: params.userId,
  })
  if (error) throw error
}

export async function queueWhatsAppMessages(params: { customerIds: string[]; customers: Customer[]; message: string; userId: string }): Promise<{ count: number; batchId: string }> {
  const batchId = crypto.randomUUID()
  const rows = params.customers
    .filter(customer => params.customerIds.includes(customer.id) && customer.phone.trim())
    .map(customer => ({
      customer_id: customer.id, phone: customer.phone,
      message: params.message.replace(/\[Nombre\]/g, customer.name.trim().split(/\s+/)[0] || 'cliente'),
      template_type: 'custom', status: 'queued', created_by: params.userId, batch_id: batchId,
    }))
  if (rows.length === 0) throw new Error('No hay destinatarios con teléfono en esta selección')
  const { error } = await client().from('whatsapp_messages').insert(rows)
  if (error) throw error
  return { count: rows.length, batchId }
}

// Cancela los mensajes pendientes de UNA campaña (batch). Si no se indica
// batch, se cancela el lote activo más reciente (fila en 'sending' incluida,
// que el bot re-verifica justo antes de enviar).
export async function cancelQueuedWhatsAppMessages(batchId?: string | null): Promise<number> {
  let target = batchId
  if (target === undefined) {
    const { data: latest, error: latestError } = await client().from('whatsapp_messages')
      .select('batch_id')
      .in('status', ['queued', 'sending'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (latestError) throw latestError
    if (!latest) return 0
    target = (latest.batch_id as string | null) ?? null
  }
  const cancelBatch = () => client().from('whatsapp_messages')
    .update({ status: 'cancelled' })
    .in('status', ['queued', 'sending'])
  const { data, error } = target === null
    ? await cancelBatch().is('batch_id', null).select('id')
    : await cancelBatch().eq('batch_id', target).select('id')
  if (error) throw error
  return data?.length ?? 0
}

export async function getWhatsAppTemplates(): Promise<WhatsAppTemplate[]> {
  const { data, error } = await client().from('whatsapp_templates')
    .select('id,name,category,description,message,schedule_label,is_active,created_at,updated_at')
    .order('name')
  if (error) throw error
  return (data ?? []).map(row => ({
    id: row.id as string, name: row.name as string, category: row.category as string,
    description: (row.description as string) ?? null, message: row.message as string,
    scheduleLabel: (row.schedule_label as string) ?? null, isActive: row.is_active as boolean,
    createdAt: row.created_at as string, updatedAt: row.updated_at as string,
  }))
}

export async function saveWhatsAppTemplate(params: { id?: string; name: string; category: string; description?: string; message: string; scheduleLabel?: string; isActive: boolean; userId: string }): Promise<WhatsAppTemplate> {
  const payload = { name: params.name.trim(), category: params.category.trim() || 'custom', description: params.description?.trim() || null, message: params.message.trim(), schedule_label: params.scheduleLabel?.trim() || null, is_active: params.isActive, created_by: params.userId }
  const sb = client()
  let query
  if (params.id) query = sb.from('whatsapp_templates').update(payload).eq('id', params.id)
  else query = sb.from('whatsapp_templates').insert(payload)
  const { error } = await query
  if (error) throw error
  const templates = await getWhatsAppTemplates()
  const saved = templates.find(template => template.id === params.id) ?? templates.find(template => template.name === payload.name)
  if (!saved) throw new Error('No se pudo cargar la plantilla guardada')
  return saved
}

export async function deleteWhatsAppTemplate(templateId: string): Promise<void> {
  const { error } = await client().from('whatsapp_templates').delete().eq('id', templateId)
  if (error) throw error
}

export async function getWhatsAppSegments(): Promise<WhatsAppSegment[]> {
  const { data, error } = await client().from('whatsapp_segments')
    .select('id,name,description,created_at,updated_at,whatsapp_segment_members(customer_id)')
    .order('name')
  if (error) throw error
  return (data ?? []).map(row => ({
    id: row.id as string,
    name: row.name as string,
    description: (row.description as string) ?? null,
    customerIds: ((row.whatsapp_segment_members as Array<{ customer_id: string }> | null) ?? []).map(member => member.customer_id),
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  }))
}

export async function saveWhatsAppSegment(params: { id?: string; name: string; description?: string; customerIds: string[]; userId: string }): Promise<WhatsAppSegment> {
  const sb = client()
  let segmentId = params.id
  if (segmentId) {
    const { error } = await sb.from('whatsapp_segments').update({ name: params.name.trim(), description: params.description?.trim() || null }).eq('id', segmentId)
    if (error) throw error
    const { error: deleteError } = await sb.from('whatsapp_segment_members').delete().eq('segment_id', segmentId)
    if (deleteError) throw deleteError
  } else {
    const { data, error } = await sb.from('whatsapp_segments').insert({ name: params.name.trim(), description: params.description?.trim() || null, created_by: params.userId }).select('id').single()
    if (error) throw error
    segmentId = data.id as string
  }
  const uniqueCustomerIds = [...new Set(params.customerIds)]
  if (uniqueCustomerIds.length > 0) {
    const { error } = await sb.from('whatsapp_segment_members').insert(uniqueCustomerIds.map(customerId => ({ segment_id: segmentId, customer_id: customerId })))
    if (error) throw error
  }
  const segments = await getWhatsAppSegments()
  const saved = segments.find(segment => segment.id === segmentId)
  if (!saved) throw new Error('No se pudo cargar el segmento guardado')
  return saved
}

export async function deleteWhatsAppSegment(segmentId: string): Promise<void> {
  const { error } = await client().from('whatsapp_segments').delete().eq('id', segmentId)
  if (error) throw error
}

