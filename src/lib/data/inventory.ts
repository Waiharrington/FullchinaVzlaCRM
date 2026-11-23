import { client } from './client'
import type { Ingredient, WarehouseIngredient, InventorySnapshotItem, InventorySnapshotUpdate, StockMovement } from './types'

export async function getIngredients(): Promise<Ingredient[]> {
  const [{ data, error }, { data: metadata, error: metadataError }] = await Promise.all([
    client().from('v_current_stock')
      .select('ingredient_id,ingredient_name,unit_id,unit_name,unit_symbol,current_stock,price_per_unit,stock_value')
      .order('ingredient_name', { ascending: true }),
    client().from('ingredients').select('id,inventory_class,is_active'),
  ])

  if (error) throw error
  if (metadataError) throw metadataError

  const activeMap = new Map((metadata ?? []).map(row => [row.id as string, row.is_active !== false]))
  const inventoryClasses = new Map((metadata ?? []).map(row => [row.id as string, row.inventory_class as Ingredient['inventoryClass']]))

  return (data ?? [])
    .filter(i => activeMap.get(i.ingredient_id as string) !== false)
    .map((i) => ({
      id: i.ingredient_id as string,
      name: i.ingredient_name as string,
      unitId: i.unit_id as string,
      unitName: i.unit_name as string,
      unitSymbol: i.unit_symbol as string,
      isActive: true,
      currentStock: Number(i.current_stock),
      pricePerUnit: i.price_per_unit !== null ? Number(i.price_per_unit) : null,
      stockValue: i.stock_value !== null ? Number(i.stock_value) : null,
      inventoryClass: inventoryClasses.get(i.ingredient_id as string) ?? 'raw_material',
    }))
}

export async function getWarehouseIngredients(): Promise<WarehouseIngredient[]> {
  const [{ data, error }, { data: metadata, error: metadataError }] = await Promise.all([
    client().from('v_warehouse_stock').select('*').order('ingredient_name', { ascending: true }),
    client().from('ingredients').select('id,inventory_class,is_active'),
  ])
  if (error) throw error
  if (metadataError) throw metadataError
  const activeMap = new Map((metadata ?? []).map(row => [row.id as string, row.is_active !== false]))
  const classes = new Map((metadata ?? []).map(row => [row.id as string, row.inventory_class as Ingredient['inventoryClass']]))
  return (data ?? [])
    .filter(i => activeMap.get(i.ingredient_id as string) !== false)
    .map(i => ({
      id: i.ingredient_id as string, name: i.ingredient_name as string, unitId: i.unit_id as string,
      unitName: i.unit_name as string, unitSymbol: i.unit_symbol as string, isActive: true,
      currentStock: Number(i.current_stock), pricePerUnit: i.price_per_unit === null ? null : Number(i.price_per_unit),
      stockValue: i.stock_value === null ? null : Number(i.stock_value),
      inventoryClass: classes.get(i.ingredient_id as string) ?? 'raw_material',
    }))
}

/** Saldo por ubicación y claves de origen para importar/exportar inventario. */
export async function getInventorySnapshot(): Promise<InventorySnapshotItem[]> {
  const [{ data: metadata, error: metadataError }, operational, warehouse] = await Promise.all([
    client().from('ingredients').select('id,source_system,source_key,source_code').eq('is_active', true),
    getIngredients(),
    getWarehouseIngredients(),
  ])
  if (metadataError) throw metadataError
  const metadataById = new Map((metadata ?? []).map(row => [String(row.id), row]))
  const warehouseById = new Map(warehouse.map(item => [item.id, item]))
  return operational.map(item => {
    const source = metadataById.get(item.id)
    return {
      ...item,
      sourceSystem: source?.source_system == null ? null : String(source.source_system),
      sourceKey: source?.source_key == null ? null : String(source.source_key),
      sourceCode: source?.source_code == null ? null : String(source.source_code),
      operationalStock: item.currentStock,
      warehouseStock: warehouseById.get(item.id)?.currentStock ?? 0,
    }
  })
}

/** Aplica una fotografía de saldos mediante una única operación atómica en la BD. */
export async function applyInventorySnapshot(items: InventorySnapshotUpdate[], sourceFile: string): Promise<number> {
  if (items.length === 0) throw new Error('No hay productos válidos para importar.')
  const { data, error } = await client().rpc('fn_apply_inventory_snapshot', {
    p_items: items.map(item => ({
      ingredient_id: item.ingredientId,
      operational_stock: item.operationalStock,
      warehouse_stock: item.warehouseStock,
    })),
    p_source_file: sourceFile,
  })
  if (error) throw error
  return Number(data ?? 0)
}

export async function getStockMovements(ingredientId?: string): Promise<StockMovement[]> {
  let query = client()
    .from('stock_movements')
    .select('*, ingredients(name), units(symbol)')
    .order('created_at', { ascending: false })
    .limit(ingredientId ? 250 : 100)

  if (ingredientId) query = query.eq('ingredient_id', ingredientId)
  const { data, error } = await query

  if (error) throw error

  return (data ?? []).map((m) => ({
    id: m.id as string,
    ingredientId: m.ingredient_id as string,
    ingredientName: (m.ingredients as Record<string, unknown>)?.name as string ?? '-',
    quantity: Number(m.quantity),
    unitId: m.unit_id as string,
    unitSymbol: (m.units as Record<string, unknown>)?.symbol as string ?? '',
    movementType: m.movement_type as string,
    stockLocation: (m.stock_location as 'warehouse' | 'operational') ?? 'operational',
    referenceType: (m.reference_type as string) ?? null,
    referenceId: (m.reference_id as string) ?? null,
    notes: (m.notes as string) ?? null,
    createdBy: (m.created_by as string) ?? null,
    createdAt: m.created_at as string,
  }))
}

export async function adjustStock(params: {
  ingredientId: string
  quantity: number
  unitId: string
  movementType: string
  referenceType?: string
  referenceId?: string
  notes?: string
}): Promise<void> {
  const { error } = await client().rpc('add_stock_movement', {
    p_ingredient_id: params.ingredientId,
    p_quantity: params.quantity,
    p_unit_id: params.unitId,
    p_movement_type: params.movementType,
    p_reference_type: params.referenceType ?? 'manual',
    p_reference_id: params.referenceId ?? null,
    p_notes: params.notes ?? null,
  })
  if (error) throw error
}

export async function transferStock(params: {
  ingredientId: string; quantity: number; unitId: string; from: 'warehouse' | 'operational'; to: 'warehouse' | 'operational'; notes?: string
}): Promise<string> {
  const { data, error } = await client().rpc('fn_transfer_stock', {
    p_ingredient_id: params.ingredientId, p_quantity: params.quantity, p_unit_id: params.unitId,
    p_from: params.from, p_to: params.to, p_notes: params.notes ?? null,
  })
  if (error) throw error
  return String(data)
}

export async function getUnits(): Promise<Array<{ id: string; name: string; symbol: string }>> {
  const { data, error } = await client()
    .from('units')
    .select('id, name, symbol')
    .order('name')

  if (error) throw error
  return (data ?? []).map((u) => ({
    id: u.id as string,
    name: u.name as string,
    symbol: u.symbol as string,
  }))
}

export async function createIngredient(params: {
  name: string
  unitId: string
}): Promise<string> {
  const { data, error } = await client()
    .from('ingredients')
    .insert({ name: params.name, unit_id: params.unitId })
    .select('id')
    .single()
  if (error) throw error
  return data.id as string
}

export async function updateIngredient(id: string, updates: {
  name?: string
  unit_id?: string
  inventory_class?: Ingredient['inventoryClass']
  is_active?: boolean
}): Promise<void> {
  const { error } = await client()
    .from('ingredients')
    .update(updates)
    .eq('id', id)
  if (error) throw error
}

export async function deleteIngredient(id: string): Promise<void> {
  const { error } = await client()
    .from('ingredients')
    .update({ is_active: false })
    .eq('id', id)
  if (error) throw error
}

export async function updateIngredientCost(ingredientId: string, pricePerUnit: number, userId: string): Promise<void> {
  const { error } = await client()
    .from('ingredient_costs')
    .upsert({
      ingredient_id: ingredientId,
      price_per_unit: pricePerUnit,
      updated_by: userId,
      last_updated: new Date().toISOString(),
    }, { onConflict: 'ingredient_id' })
  if (error) throw error
}

// --- Producción --------------------------------------------------------------

/** Reportes: recorre todas las páginas del historial en el rango seleccionado. */
export async function getReportStockMovements(dateStart: string, dateEnd: string): Promise<StockMovement[]> {
  const rows: Record<string, unknown>[] = []
  let offset = 0
  for (;;) {
    const { data, error } = await client()
      .from('stock_movements')
      .select('*, ingredients(name), units(symbol)')
      .gte('created_at', dateStart)
      .lt('created_at', dateEnd)
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .range(offset, offset + 499)
    if (error) throw error
    const batch = (data ?? []) as Record<string, unknown>[]
    rows.push(...batch)
    if (batch.length < 500) break
    offset += 500
  }
  return rows.map(m => ({
    id: m.id as string,
    ingredientId: m.ingredient_id as string,
    ingredientName: ((m.ingredients as Record<string, unknown>)?.name as string) ?? '-',
    quantity: Number(m.quantity),
    unitId: m.unit_id as string,
    unitSymbol: ((m.units as Record<string, unknown>)?.symbol as string) ?? '',
    movementType: m.movement_type as string,
    stockLocation: (m.stock_location as 'warehouse' | 'operational') ?? 'operational',
    referenceType: (m.reference_type as string) ?? null,
    referenceId: (m.reference_id as string) ?? null,
    notes: (m.notes as string) ?? null,
    createdBy: (m.created_by as string) ?? null,
    createdAt: m.created_at as string,
  }))
}

export async function registerStaffMealConsumption(params: {
  mealType: 'lunch' | 'dinner'
  servings: number
  items: Array<{ ingredientId: string; unitId: string; quantity: number }>
  notes?: string
}): Promise<void> {
  const { error } = await client().rpc('fn_register_staff_meal_consumption', {
    p_meal_type: params.mealType,
    p_servings: params.servings,
    p_items: params.items,
    p_notes: params.notes?.trim() || null,
  })
  if (error) throw error
}

