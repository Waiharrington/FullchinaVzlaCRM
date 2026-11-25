import { client } from './client'
import type { RecipeSummary, RecipeComponent, PortionRecipe } from './types'

/**
 * Resumen de receta por producto: cantidad de componentes, costo y margen.
 * El costo/margen viene del RPC (solo owner/manager); el conteo se calcula
 * contando recipe_components. Devuelve un Map por sellable_product_id.
 */
export async function getRecipeSummaries(): Promise<Map<string, RecipeSummary>> {
  const sb = client()
  const map = new Map<string, RecipeSummary>()

  // Conteo de componentes por producto (liviano: solo la FK).
  const { data: comps, error: compErr } = await sb
    .from('recipe_components')
    .select('sellable_product_id')
  if (compErr) throw compErr
  for (const row of comps ?? []) {
    const pid = row.sellable_product_id as string
    const cur = map.get(pid) ?? { componentCount: 0, recipeCost: null, marginEstimated: null }
    cur.componentCount += 1
    map.set(pid, cur)
  }

  // Costo/margen por producto (owner/manager). Si falla por rol, se omite.
  try {
    const { data: costs, error: costErr } = await sb.rpc('fn_get_product_recipe_cost')
    if (costErr) throw costErr
    for (const row of (costs as Array<Record<string, unknown>>) ?? []) {
      const pid = row.sellable_product_id as string
      const cur = map.get(pid) ?? { componentCount: 0, recipeCost: null, marginEstimated: null }
      cur.recipeCost = row.recipe_cost == null ? null : Number(row.recipe_cost)
      cur.marginEstimated = row.margin_estimated == null ? null : Number(row.margin_estimated)
      map.set(pid, cur)
    }
  } catch (err) {
    console.warn('No se pudo obtener costo de recetas (rol sin acceso a costos):', err)
  }

  return map
}

export async function getRecipeComponents(sellableProductId: string): Promise<RecipeComponent[]> {
  const sb = client()
  // El costo por ingrediente NO se puede leer con un embed de ingredient_costs
  // (la RLS de esa tabla lo bloquea al cliente). Se toma de v_current_stock, que
  // sí expone price_per_unit a owner/manager. Para cashier viene null (correcto).
  const [componentsRes, stockRes] = await Promise.all([
    sb
      .from('recipe_components')
      .select('id,sellable_product_id,ingredient_id,preparation_batch_id,portion_recipe_id,quantity,unit_id,ingredients(name),units(symbol)')
      .eq('sellable_product_id', sellableProductId)
      .order('created_at', { ascending: true }),
    sb.from('v_current_stock').select('ingredient_id,price_per_unit'),
  ])

  if (componentsRes.error) throw componentsRes.error
  const costMap = new Map<string, number>()
  for (const s of (stockRes.data as Array<Record<string, unknown>> | null) ?? []) {
    if (s.price_per_unit != null) costMap.set(s.ingredient_id as string, Number(s.price_per_unit))
  }
  // PostgREST devuelve las relaciones to-one como objeto (no array); toleramos
  // ambos por si la versión del cliente las envuelve en array.
  const toOne = (value: unknown): Record<string, unknown> | null =>
    Array.isArray(value) ? (value[0] as Record<string, unknown>) ?? null : (value as Record<string, unknown>) ?? null
  return (componentsRes.data ?? []).map((r) => {
    const ingr = toOne(r.ingredients)
    const unit = toOne(r.units)
    const ingredientId = (r.ingredient_id as string) ?? null
    return {
      id: r.id as string,
      sellableProductId: r.sellable_product_id as string,
      ingredientId,
      preparationBatchId: (r.preparation_batch_id as string) ?? null,
      portionRecipeId: (r.portion_recipe_id as string) ?? null,
      ingredientName: (ingr?.name as string) ?? null,
      quantity: Number(r.quantity),
      unitId: r.unit_id as string,
      unitSymbol: (unit?.symbol as string) ?? '',
      costPerUnit: ingredientId && costMap.has(ingredientId) ? costMap.get(ingredientId)! : null,
    }
  })
}

export async function registerStaffMealRecipeConsumption(params: {
  mealType: 'lunch' | 'dinner'
  servings: number
  productId: string
  notes?: string
}): Promise<void> {
  const { error } = await client().rpc('fn_register_staff_meal_recipe_consumption', {
    p_meal_type: params.mealType,
    p_servings: params.servings,
    p_product_id: params.productId,
    p_notes: params.notes?.trim() || null,
  })
  if (error) throw error
}

export async function getPortionRecipes(): Promise<PortionRecipe[]> {
  const { data, error } = await client().from('portion_recipes').select('id,name,ingredient_id,portion_quantity,portion_unit_id,is_active,notes,ingredients(name),units(symbol)').eq('is_active', true).order('name')
  if (error) throw error
  const one = (value: unknown) => Array.isArray(value) ? (value[0] as Record<string, unknown> | undefined) : value as Record<string, unknown> | undefined
  return (data ?? []).map((r) => ({ id: r.id as string, name: r.name as string, ingredientId: r.ingredient_id as string, ingredientName: String(one(r.ingredients)?.name ?? ''), quantity: Number(r.portion_quantity), unitId: r.portion_unit_id as string, unitSymbol: String(one(r.units)?.symbol ?? ''), isActive: Boolean(r.is_active), notes: (r.notes as string) ?? null }))
}

export async function createPortionRecipe(params: { name: string; ingredientId: string; quantity: number; unitId: string; notes?: string }): Promise<string> {
  const { data, error } = await client().from('portion_recipes').insert({ name: params.name.trim(), ingredient_id: params.ingredientId, portion_quantity: params.quantity, portion_unit_id: params.unitId, notes: params.notes?.trim() || null }).select('id').single()
  if (error) throw error
  return data.id as string
}

export async function updatePortionRecipe(
  id: string,
  params: { name?: string; ingredientId?: string; quantity?: number; unitId?: string; notes?: string; isActive?: boolean },
): Promise<void> {
  const updates: Record<string, unknown> = {}
  if (params.name !== undefined) updates.name = params.name.trim()
  if (params.ingredientId !== undefined) updates.ingredient_id = params.ingredientId
  if (params.quantity !== undefined) updates.portion_quantity = params.quantity
  if (params.unitId !== undefined) updates.portion_unit_id = params.unitId
  if (params.notes !== undefined) updates.notes = params.notes?.trim() || null
  if (params.isActive !== undefined) updates.is_active = params.isActive

  const { error } = await client().from('portion_recipes').update(updates).eq('id', id)
  if (error) throw error
}

export async function deletePortionRecipe(id: string): Promise<void> {
  const { error } = await client().from('portion_recipes').update({ is_active: false }).eq('id', id)
  if (error) throw error
}

export async function createRecipeComponent(params: {
  sellableProductId: string
  ingredientId?: string
  preparationBatchId?: string
  portionRecipeId?: string
  quantity: number
  unitId: string
}): Promise<string> {
  const { data, error } = await client()
    .from('recipe_components')
    .insert({
      sellable_product_id: params.sellableProductId,
      ingredient_id: params.ingredientId ?? null,
      preparation_batch_id: params.preparationBatchId ?? null,
      portion_recipe_id: params.portionRecipeId ?? null,
      quantity: params.quantity,
      unit_id: params.unitId,
    })
    .select('id')
    .single()
  if (error) throw error
  return data.id as string
}

export async function deleteRecipeComponent(id: string): Promise<void> {
  const { error } = await client()
    .from('recipe_components')
    .delete()
    .eq('id', id)
  if (error) throw error
}

export async function updateRecipeComponent(id: string, updates: { quantity: number; unitId: string; ingredientId?: string | null }): Promise<void> {
  const payload: Record<string, unknown> = { quantity: updates.quantity, unit_id: updates.unitId }
  if (updates.ingredientId !== undefined) payload.ingredient_id = updates.ingredientId
  const { error } = await client()
    .from('recipe_components')
    .update(payload)
    .eq('id', id)
  if (error) throw error
}

// --- Auditoría ----------------------------------------------------------------

