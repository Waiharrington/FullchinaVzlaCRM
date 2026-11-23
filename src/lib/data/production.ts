import { dateKeyInTimeZone } from '../money'
import { client } from './client'
import type { BatchItem, ProductionBatch, ProductionStats, RecentProductionBatch, ProductionBonus, ProductionBonusRecord } from './types'

export async function getProductionBatches(dateStart?: string, dateEnd?: string): Promise<ProductionBatch[]> {
  let query = client()
    .from('preparation_batches')
    .select(`
      id,name,production_date,quantity_produced,waste_quantity,waste_percentage,notes,created_at,
      preparation_batch_costs(total_input_cost),
      preparation_batch_items(
        id,ingredient_id,quantity_used,unit_id,
        ingredients(name),units(symbol)
      ),
      units(symbol)
    `)
    .order('production_date', { ascending: false })
    .order('created_at', { ascending: false })

  if (dateStart) query = query.gte('production_date', dateStart)
  if (dateEnd) query = query.lte('production_date', dateEnd)

  const { data, error } = await query
  if (error) throw error

  return (data ?? []).map((row, idx) => {
    const costs = Array.isArray(row.preparation_batch_costs) && row.preparation_batch_costs.length > 0
      ? row.preparation_batch_costs[0] as Record<string, unknown>
      : null
    const totalCost = costs ? Number(costs.total_input_cost ?? 0) : 0
    const qtyProduced = Number(row.quantity_produced)
    const items: BatchItem[] = Array.isArray(row.preparation_batch_items)
      ? row.preparation_batch_items.map((item: Record<string, unknown>) => ({
          id: item.id as string,
          ingredientId: item.ingredient_id as string,
          ingredientName: Array.isArray(item.ingredients) ? (item.ingredients[0] as Record<string, unknown>)?.name as string ?? '-' : '-',
          quantityUsed: Number(item.quantity_used),
          unitId: item.unit_id as string,
          unitSymbol: Array.isArray(item.units) ? (item.units[0] as Record<string, unknown>)?.symbol as string ?? '' : '',
          costPerUnit: 0,
        }))
      : []

    return {
      id: row.id as string,
      batchNumber: idx + 1,
      name: row.name as string,
      sellableProductId: null,
      productName: row.name as string,
      productionDate: row.production_date as string,
      quantityProduced: qtyProduced,
      unitProduced: Array.isArray(row.units) ? (row.units[0] as Record<string, unknown>)?.symbol as string ?? '' : '',
      wasteQuantity: Number(row.waste_quantity),
      wastePercentage: Number(row.waste_percentage ?? 0),
      totalCost,
      costPerPortion: qtyProduced > 0 ? totalCost / qtyProduced : 0,
      operator: items[0]?.ingredientName ?? 'Operador',
      status: Number(row.waste_percentage ?? 0) <= 10 ? 'Completado' : 'Parcial',
      items,
      notes: (row.notes as string) ?? null,
      createdAt: row.created_at as string,
    }
  })
}

export async function getProductionStats(availableBatches?: ProductionBatch[]): Promise<ProductionStats> {
  // Fechas en horario de Venezuela (UTC-4), no en UTC.
  const today = dateKeyInTimeZone()
  const yesterday = dateKeyInTimeZone(new Date(Date.now() - 86400000))

  const [todayBatches, yesterdayBatches] = availableBatches
    ? [
        availableBatches.filter(batch => batch.productionDate.slice(0, 10) === today),
        availableBatches.filter(batch => batch.productionDate.slice(0, 10) === yesterday),
      ]
    : await Promise.all([
        getProductionBatches(today, today),
        getProductionBatches(yesterday, yesterday),
      ])

  const batchesToday = todayBatches.length
  const batchesYesterday = yesterdayBatches.length

  const avgYield = todayBatches.length > 0
    ? todayBatches.reduce((sum, b) => sum + (100 - b.wastePercentage), 0) / todayBatches.length
    : 0
  const avgYieldYesterday = yesterdayBatches.length > 0
    ? yesterdayBatches.reduce((sum, b) => sum + (100 - b.wastePercentage), 0) / yesterdayBatches.length
    : 0

  const totalWaste = todayBatches.reduce((sum, b) => sum + b.wasteQuantity, 0)
  const totalWasteYesterday = yesterdayBatches.reduce((sum, b) => sum + b.wasteQuantity, 0)

  const avgCostPerPortion = todayBatches.length > 0
    ? todayBatches.reduce((sum, b) => sum + b.costPerPortion, 0) / todayBatches.length
    : 0
  const avgCostPerPortionYesterday = yesterdayBatches.length > 0
    ? yesterdayBatches.reduce((sum, b) => sum + b.costPerPortion, 0) / yesterdayBatches.length
    : 0

  return {
    batchesToday,
    avgYield: Math.round(avgYield * 10) / 10,
    totalWaste: Math.round(totalWaste * 100) / 100,
    avgCostPerPortion: Math.round(avgCostPerPortion * 100) / 100,
    batchesYesterday,
    yieldChange: Math.round((avgYield - avgYieldYesterday) * 10) / 10,
    wasteChange: Math.round((totalWaste - totalWasteYesterday) * 100) / 100,
    costChange: Math.round((avgCostPerPortion - avgCostPerPortionYesterday) * 100) / 100,
  }
}

/** Carga liviana para el resumen del dashboard: solo los últimos lotes. */
export async function getRecentProductionBatches(limit = 3): Promise<RecentProductionBatch[]> {
  const safeLimit = Math.max(1, Math.min(10, Math.floor(limit)))
  const { data, error } = await client()
    .from('preparation_batches')
    .select('id,name,production_date,quantity_produced,waste_quantity,waste_percentage,created_at')
    .order('production_date', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(safeLimit)

  if (error) throw error
  return (data ?? []).map(row => ({
    id: row.id as string,
    name: row.name as string,
    productionDate: row.production_date as string,
    quantityProduced: Number(row.quantity_produced ?? 0),
    wasteQuantity: Number(row.waste_quantity ?? 0),
    wastePercentage: Number(row.waste_percentage ?? 0),
  }))
}

/** Devuelve lotes del día que superan el umbral de merma ya usado por Producción (10%). */
export async function getTodayProductionYieldAlerts(): Promise<Array<Pick<RecentProductionBatch, 'id' | 'name' | 'wastePercentage'>>> {
  const today = dateKeyInTimeZone()
  const { data, error } = await client()
    .from('preparation_batches')
    .select('id,name,waste_percentage')
    .eq('production_date', today)
    .gt('waste_percentage', 10)
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []).map(row => ({ id: String(row.id), name: String(row.name), wastePercentage: Number(row.waste_percentage ?? 0) }))
}

export async function getProductionBonuses(dateStart?: string, dateEnd?: string): Promise<ProductionBonus[]> {
  let query = client()
    .from('production_bonuses')
    .select('id,employee_id,amount,bonus_date,employees(full_name)')
    .order('bonus_date', { ascending: false })

  if (dateStart) query = query.gte('bonus_date', dateStart)
  if (dateEnd) query = query.lte('bonus_date', dateEnd)

  const { data, error } = await query
  if (error) throw error

  const bonusMap = new Map<string, { name: string; pieces: number; amount: number }>()
  let totalPieces = 0

  for (const row of data ?? []) {
    const empId = row.employee_id as string
    const empName = Array.isArray(row.employees) ? (row.employees[0] as Record<string, unknown>)?.full_name as string ?? 'Desconocido' : 'Desconocido'
    const amount = Number(row.amount)
    const pieces = amount > 0 ? Math.round(amount / 0.15) : 0

    const existing = bonusMap.get(empId)
    if (existing) {
      existing.pieces += pieces
      existing.amount += amount
    } else {
      bonusMap.set(empId, { name: empName, pieces, amount })
    }
    totalPieces += pieces
  }

  return Array.from(bonusMap.entries()).map(([empId, info]) => ({
    employeeId: empId,
    employeeName: info.name,
    initials: info.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2),
    piecesCount: info.pieces,
    bonusAmount: info.amount,
    percentage: totalPieces > 0 ? Math.round((info.pieces / totalPieces) * 100) : 0,
  })).sort((a, b) => b.piecesCount - a.piecesCount)
}

export async function createProductionBatch(params: {
  name: string
  quantityProduced: number
  unitId: string
  wasteQuantity: number
  sourceStockLocation: 'warehouse' | 'operational'
  outputIngredientId: string | null
  notes?: string
  items: Array<{ ingredientId: string; quantityUsed: number; unitId: string }>
  createdBy: string
}): Promise<string> {
  const sb = client()

  const { data: batch, error: batchErr } = await sb
    .from('preparation_batches')
    .insert({
      name: params.name,
      quantity_produced: params.quantityProduced,
      unit_produced_id: params.unitId,
      waste_quantity: params.wasteQuantity,
      source_stock_location: params.sourceStockLocation,
      output_ingredient_id: params.outputIngredientId,
      notes: params.notes ?? null,
      created_by: params.createdBy,
    })
    .select('id')
    .single()

  if (batchErr) throw batchErr

  const batchId = batch.id as string

  const { error: itemsErr } = await sb.from('preparation_batch_items').insert(
    params.items.map((item) => ({
      preparation_batch_id: batchId,
      ingredient_id: item.ingredientId,
      quantity_used: item.quantityUsed,
      unit_id: item.unitId,
    })),
  )
  if (itemsErr) throw itemsErr

  return batchId
}

// --- Nómina -------------------------------------------------------------------

export async function createProductionBonus(params: {
  employeeId: string
  amount: number
  accountId: string
  exchangeRate?: number | null
  bonusDate?: string
  reason?: string | null
}): Promise<void> {
  const { error } = await client().rpc('fn_create_production_bonus', {
    p_employee_id: params.employeeId,
    p_original_amount: params.amount,
    p_account_id: params.accountId,
    p_exchange_rate: params.exchangeRate ?? null,
    p_bonus_date: params.bonusDate ?? dateKeyInTimeZone(),
    p_reason: params.reason ?? null,
  })
  if (error) throw error
}

export async function getProductionBonusRecords(): Promise<ProductionBonusRecord[]> {
  const { data, error } = await client()
    .from('production_bonuses')
    .select('id,employee_id,amount,account_id,currency,original_amount,exchange_rate,bonus_date,reason,created_at,employees(full_name),financial_accounts(name)')
    .order('bonus_date', { ascending: false })
  if (error) throw error
  return (data ?? []).map((r) => ({
    id: r.id as string,
    employeeId: r.employee_id as string,
    employeeName: Array.isArray(r.employees) ? (r.employees[0] as Record<string, unknown>)?.full_name as string ?? '' : '',
    amount: Number(r.amount),
    accountId: (r.account_id as string) ?? null,
    accountName: Array.isArray(r.financial_accounts) ? String((r.financial_accounts[0] as Record<string, unknown>)?.name ?? '') : null,
    currency: (r.currency as ProductionBonusRecord['currency']) ?? null,
    originalAmount: r.original_amount == null ? null : Number(r.original_amount),
    exchangeRate: r.exchange_rate == null ? null : Number(r.exchange_rate),
    bonusDate: r.bonus_date as string,
    reason: (r.reason as string) ?? null,
    createdAt: r.created_at as string,
  }))
}

// --- Recetas ------------------------------------------------------------------

