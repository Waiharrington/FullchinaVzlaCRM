import { supabase, subscribeToDataChanges } from '../supabase'
import { client } from './client'
import type { Product, ModifierOption, ProductModifierGroup, SellableProduct, MenuCategoryRow } from './types'

type SellableProductRow = {
  id: string; name: string; description: string | null; price: number; cost: number | null
  category: string; emoji: string; is_active: boolean; image_url: string | null
  is_delivery?: boolean; menu_label: Product['menuLabel']; allow_protein_extras?: boolean | null
  public_visible?: boolean; public_carousel?: boolean; public_carousel_order?: number | null
}

type SellableProductsResult = { data: SellableProductRow[] | null; error: { code?: string; message?: string } | null }


/** Mapa productoId -> categorías adicionales (más allá de la principal). */
async function getProductExtraCategoriesMap(): Promise<Map<string, string[]>> {
  const { data, error } = await client()
    .from('sellable_product_categories')
    .select('sellable_product_id,category_key')
  if (error) throw error
  const map = new Map<string, string[]>()
  for (const r of data ?? []) {
    const id = r.sellable_product_id as string
    const list = map.get(id) ?? []
    list.push(r.category_key as string)
    map.set(id, list)
  }
  return map
}

/** Conjunto completo de categorías de un plato: principal + adicionales, sin duplicar. */
function mergeCategories(primary: string, extras: string[] | undefined): string[] {
  return Array.from(new Set([primary, ...(extras ?? [])]))
}

function isMissingProteinExtrasColumn(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false
  const detail = `${error.code ?? ''} ${error.message ?? ''}`.toLowerCase()
  return detail.includes('allow_protein_extras')
    && (detail.includes('column') || error.code === 'PGRST204' || error.code === '42703')
}

export async function getProducts(): Promise<Product[]> {
  if (!supabase) throw new Error('Supabase no está configurado')
  try {
    const queryProducts = async (withProteinExtras: boolean): Promise<SellableProductsResult> => await (supabase!
        .from('sellable_products')
        .select(withProteinExtras
          ? 'id,name,description,price,cost,category,emoji,is_active,image_url,menu_label,allow_protein_extras'
          : 'id,name,description,price,cost,category,emoji,is_active,image_url,menu_label')
        .eq('is_active', true)
        .order('category', { ascending: true })
        .order('name', { ascending: true }) as unknown as Promise<SellableProductsResult>)
    const [initialProducts, extraMap] = await Promise.all([
      queryProducts(true),
      getProductExtraCategoriesMap().catch(() => new Map<string, string[]>()),
    ])

    let { data, error } = initialProducts
    if (isMissingProteinExtrasColumn(error)) ({ data, error } = await queryProducts(false))
    if (error) throw error
    return (data ?? []).map((r) => ({
      id: r.id as string,
      name: r.name as string,
      description: (r.description as string) ?? null,
      price: Number(r.price),
      cost: r.cost === null ? null : Number(r.cost),
      category: r.category as string,
      categories: mergeCategories(r.category as string, extraMap.get(r.id as string)),
      emoji: r.emoji as string,
      active: Boolean(r.is_active),
      imageUrl: (r.image_url as string) ?? null,
      allowProteinExtras: r.allow_protein_extras == null ? (r.category as string) !== 'bebidas' : Boolean(r.allow_protein_extras),
      menuLabel: (r.menu_label as Product['menuLabel']) ?? null,
    }))
  } catch (err) {
    console.error('Error cargando productos de Supabase:', err)
    throw err
  }
}

/** Todos los productos vendibles (activos e inactivos) para el módulo Menú. */
export async function getAllSellableProducts(): Promise<SellableProduct[]> {
    const queryProducts = async (): Promise<SellableProductsResult> => await (client()
      .from('sellable_products')
      .select('id,name,description,price,cost,category,emoji,is_active,image_url,is_delivery,menu_label,allow_protein_extras,public_visible,public_carousel,public_carousel_order')
      .order('name', { ascending: true }) as unknown as Promise<SellableProductsResult>)
  const [productResult, extraMap] = await Promise.all([
    queryProducts(),
    getProductExtraCategoriesMap().catch(() => new Map<string, string[]>()),
  ])
  const { data, error } = productResult
  if (error) throw error
  return (data ?? []).map((r) => ({
    id: r.id as string, name: r.name as string, description: (r.description as string) ?? null,
    salePrice: Number(r.price), cost: r.cost === null ? null : Number(r.cost),
    category: r.category as string, categories: mergeCategories(r.category as string, extraMap.get(r.id as string)),
    emoji: r.emoji as string, isActive: r.is_active as boolean,
    imageUrl: (r.image_url as string) ?? null, isDelivery: (r.is_delivery as boolean) ?? false,
    allowProteinExtras: r.allow_protein_extras == null ? (r.category as string) !== 'bebidas' : Boolean(r.allow_protein_extras),
    menuLabel: (r.menu_label as SellableProduct['menuLabel']) ?? null,
    publicVisible: r.public_visible == null ? true : Boolean(r.public_visible),
    publicCarousel: Boolean(r.public_carousel),
    publicCarouselOrder: Number(r.public_carousel_order ?? 0),
  }))
}

export async function createProduct(p: {
  name: string; description?: string | null; price: number; cost?: number | null
  category: string; emoji?: string; imageUrl?: string | null; isActive?: boolean; allowProteinExtras?: boolean; menuLabel?: SellableProduct['menuLabel']
}): Promise<string> {
  const { data, error } = await client().from('sellable_products').insert({
    name: p.name, description: p.description ?? null, price: p.price, cost: p.cost ?? null,
    category: p.category, emoji: p.emoji ?? '🍽️', /* DB default: emoji */ image_url: p.imageUrl ?? null,
    is_active: p.isActive ?? true, menu_label: p.menuLabel ?? null,
    allow_protein_extras: p.allowProteinExtras ?? p.category !== 'bebidas',
  }).select('id').single()
  if (error) throw error
  return data.id as string
}

export async function updateProduct(id: string, updates: Partial<{
  name: string; description: string | null; price: number; cost: number | null
  category: string; emoji: string; imageUrl: string | null; isActive: boolean; allowProteinExtras: boolean; menuLabel: SellableProduct['menuLabel']
  publicVisible: boolean; publicCarousel: boolean; publicCarouselOrder: number
}>): Promise<void> {
  const payload: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (updates.name !== undefined) payload.name = updates.name
  if (updates.description !== undefined) payload.description = updates.description
  if (updates.price !== undefined) payload.price = updates.price
  if (updates.cost !== undefined) payload.cost = updates.cost
  if (updates.category !== undefined) payload.category = updates.category
  if (updates.emoji !== undefined) payload.emoji = updates.emoji
  if (updates.imageUrl !== undefined) payload.image_url = updates.imageUrl
  if (updates.isActive !== undefined) payload.is_active = updates.isActive
  if (updates.allowProteinExtras !== undefined) payload.allow_protein_extras = updates.allowProteinExtras
  if (updates.menuLabel !== undefined) payload.menu_label = updates.menuLabel
  if (updates.publicVisible !== undefined) payload.public_visible = updates.publicVisible
  if (updates.publicCarousel !== undefined) payload.public_carousel = updates.publicCarousel
  if (updates.publicCarouselOrder !== undefined) payload.public_carousel_order = updates.publicCarouselOrder
  const { error } = await client().from('sellable_products').update(payload).eq('id', id)
  if (error) throw error
}

/**
 * Reemplaza las categorías ADICIONALES de un plato (todas menos la principal).
 * `primaryCategory` es la categoría guardada en sellable_products.category, que
 * se excluye para no duplicarla en la tabla de relación.
 */
export async function setProductExtraCategories(productId: string, allCategories: string[], primaryCategory: string): Promise<void> {
  const extras = Array.from(new Set(allCategories)).filter((c) => c && c !== primaryCategory)
  const del = await client().from('sellable_product_categories').delete().eq('sellable_product_id', productId)
  if (del.error) throw del.error
  if (extras.length === 0) return
  const rows = extras.map((category_key) => ({ sellable_product_id: productId, category_key }))
  const ins = await client().from('sellable_product_categories').insert(rows)
  if (ins.error) throw ins.error
}

/**
 * Elimina un plato de forma permanente (vía RPC SECURITY DEFINER). Falla con un
 * mensaje claro si el plato tiene ventas registradas; en ese caso hay que usar
 * "Ocultar" en lugar de eliminar.
 */
export async function deleteProduct(id: string): Promise<void> {
  const { error } = await client().rpc('fn_delete_sellable_product', { p_id: id })
  if (error) throw error
}

// --- Categorías del menú ------------------------------------------------------

/** Lee todas las categorías (incluidas inactivas) para administrarlas. */
export async function getMenuCategories(): Promise<MenuCategoryRow[]> {
  const { data, error } = await client()
    .from('menu_categories')
    .select('id,key,label,sort_order,is_active')
    .order('sort_order', { ascending: true })
  if (error) throw error
  return (data ?? []).map((r) => ({
    id: r.id as string, key: r.key as string, label: r.label as string,
    sortOrder: Number(r.sort_order), isActive: r.is_active as boolean,
  }))
}

/** Crea una categoría nueva. `key` debe ser un slug único. */
export async function createMenuCategory(input: { key: string; label: string; sortOrder: number }): Promise<string> {
  const { data, error } = await client().from('menu_categories').insert({
    key: input.key, label: input.label, sort_order: input.sortOrder,
  }).select('id').single()
  if (error) throw error
  return data.id as string
}

export async function updateMenuCategory(id: string, updates: Partial<{ label: string; sortOrder: number; isActive: boolean }>): Promise<void> {
  const payload: Record<string, unknown> = {}
  if (updates.label !== undefined) payload.label = updates.label
  if (updates.sortOrder !== undefined) payload.sort_order = updates.sortOrder
  if (updates.isActive !== undefined) payload.is_active = updates.isActive
  if (Object.keys(payload).length === 0) return
  const { error } = await client().from('menu_categories').update(payload).eq('id', id)
  if (error) throw error
}

export async function deleteMenuCategory(id: string): Promise<void> {
  const { error } = await client().from('menu_categories').delete().eq('id', id)
  if (error) throw error
}

// --- Delivery por distancia ---------------------------------------------------

const modifiersCache = new Map<string, ProductModifierGroup[]>()

/** Invalida la caché de modificadores */
export function invalidateModifiersCache() {
  modifiersCache.clear()
}

subscribeToDataChanges(table => {
  if (table === '*' || ['sellable_product_modifiers', 'modifiers', 'modifier_options'].includes(table)) {
    invalidateModifiersCache()
  }
})

/** Conjunto de ids de productos que tienen al menos un modificador asignado. */
export async function getProductsWithModifiers(): Promise<Set<string>> {
  if (modifiersCache.size > 0) {
    return new Set(modifiersCache.keys())
  }
  const { data, error } = await client()
    .from('sellable_product_modifiers')
    .select('sellable_product_id')

  if (error) throw error
  return new Set((data ?? []).map((r) => r.sellable_product_id as string))
}

/** Precarga todos los modificadores en 1 sola consulta para respuesta instantánea (0ms) en caja */
export async function getAllProductModifiers(): Promise<Map<string, ProductModifierGroup[]>> {
  if (modifiersCache.size > 0) {
    return new Map(modifiersCache)
  }
  const { data, error } = await client()
    .from('sellable_product_modifiers')
    .select('sellable_product_id, modifiers(id,name,min_selections,max_selections,allow_repeat,display_order,is_active,modifier_options(id,name,sale_price,display_order,is_active))')

  if (error) throw error

  const result = new Map<string, ProductModifierGroup[]>()
  for (const row of data ?? []) {
    const prodId = row.sellable_product_id as string
    const m = (Array.isArray(row.modifiers) ? row.modifiers[0] : row.modifiers) as Record<string, unknown> | null
    if (!m || m.is_active === false) continue
    const rawOptions = (m.modifier_options as Array<Record<string, unknown>>) ?? []
    const options: ModifierOption[] = rawOptions
      .filter((o) => o.is_active !== false)
      .sort((a, b) => Number(a.display_order ?? 0) - Number(b.display_order ?? 0))
      .map((o) => ({ id: o.id as string, name: o.name as string, price: Number(o.sale_price ?? 0) }))
    const group: ProductModifierGroup = {
      modifierId: m.id as string,
      name: m.name as string,
      minSelections: Number(m.min_selections ?? 0),
      maxSelections: m.max_selections == null ? null : Number(m.max_selections),
      allowRepeat: Boolean(m.allow_repeat),
      options,
    }
    const current = result.get(prodId) ?? []
    current.push(group)
    result.set(prodId, current)
    modifiersCache.set(prodId, current)
  }
  return result
}

/** Grupos de modificadores (con sus opciones) de un producto. */
export async function getProductModifiers(productId: string): Promise<ProductModifierGroup[]> {
  if (modifiersCache.has(productId)) {
    return modifiersCache.get(productId)!
  }
  const { data, error } = await client()
    .from('sellable_product_modifiers')
    .select('modifiers(id,name,min_selections,max_selections,allow_repeat,display_order,is_active,modifier_options(id,name,sale_price,display_order,is_active))')
    .eq('sellable_product_id', productId)

  if (error) throw error

  const groups: ProductModifierGroup[] = []
  for (const row of data ?? []) {
    const m = (Array.isArray(row.modifiers) ? row.modifiers[0] : row.modifiers) as Record<string, unknown> | null
    if (!m || m.is_active === false) continue
    const rawOptions = (m.modifier_options as Array<Record<string, unknown>>) ?? []
    const options: ModifierOption[] = rawOptions
      .filter((o) => o.is_active !== false)
      .sort((a, b) => Number(a.display_order ?? 0) - Number(b.display_order ?? 0))
      .map((o) => ({ id: o.id as string, name: o.name as string, price: Number(o.sale_price ?? 0) }))
    groups.push({
      modifierId: m.id as string,
      name: m.name as string,
      minSelections: Number(m.min_selections ?? 0),
      maxSelections: m.max_selections == null ? null : Number(m.max_selections),
      allowRepeat: Boolean(m.allow_repeat),
      options,
    })
  }
  const sorted = groups.sort((a, b) => a.name.localeCompare(b.name))
  modifiersCache.set(productId, sorted)
  return sorted
}

// --- Cobro (checkout) --------------------------------------------------------

export async function getSellableProducts(): Promise<SellableProduct[]> {
  const queryProducts = async (withProteinExtras: boolean): Promise<SellableProductsResult> => await (client()
    .from('sellable_products')
    .select(withProteinExtras
      ? 'id,name,description,price,cost,category,emoji,is_active,image_url,is_delivery,menu_label,allow_protein_extras'
      : 'id,name,description,price,cost,category,emoji,is_active,image_url,is_delivery,menu_label')
    .eq('is_active', true)
    .order('name', { ascending: true }) as unknown as Promise<SellableProductsResult>)
  let { data, error } = await queryProducts(true)
  if (isMissingProteinExtrasColumn(error)) ({ data, error } = await queryProducts(false))

  if (error) throw error
  return (data ?? []).map((r) => ({
    id: r.id as string,
    name: r.name as string,
    description: (r.description as string) ?? null,
    salePrice: Number(r.price),
    cost: r.cost === null ? null : Number(r.cost),
    category: r.category as string,
    categories: [r.category as string],
    emoji: r.emoji as string,
    isActive: r.is_active as boolean,
    imageUrl: (r.image_url as string) ?? null,
    isDelivery: (r.is_delivery as boolean) ?? false,
    allowProteinExtras: r.allow_protein_extras == null ? (r.category as string) !== 'bebidas' : Boolean(r.allow_protein_extras),
    menuLabel: (r.menu_label as SellableProduct['menuLabel']) ?? null,
  }))
}

