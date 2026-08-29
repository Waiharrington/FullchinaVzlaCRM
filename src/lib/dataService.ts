import { supabase } from './supabase'
import { dateKeyInTimeZone, dayRangeInTimeZone } from './money'

export interface Product {
  id: string
  name: string
  description: string | null
  price: number
  cost: number | null
  category: string
  categories: string[]
  emoji: string
  active: boolean
  imageUrl: string | null
}

export interface SelectedModifier {
  optionId: string
  optionName: string
  modifierName: string
  price: number
  quantity: number
}

export interface CartItem {
  productId: string
  productName: string
  price: number
  quantity: number
  emoji?: string
  /** Identificador único de la línea del carrito (necesario para modificadores). */
  lineId?: string
  /** Opciones de modificador elegidas para esta línea. */
  selectedModifiers?: SelectedModifier[]
}

export interface ModifierOption {
  id: string
  name: string
  price: number
}

export interface ProductModifierGroup {
  modifierId: string
  name: string
  minSelections: number
  maxSelections: number | null
  allowRepeat: boolean
  options: ModifierOption[]
}

export type PaymentMethod = 'cash' | 'mobile' | 'card' | 'transfer' | 'binance' | 'zelle' | 'other'

export interface OrderPaymentComponent {
  method: PaymentMethod
  amount: number
  referenceNumber?: string | null
  receivedAmount?: number | null
  notes?: string | null
}

export interface RecordedOrderPayment extends OrderPaymentComponent {
  id: string
  createdAt: string
}

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

export interface FullOrder {
  id: string
  orderNumber: number
  status: string
  fulfillmentStatus: 'new' | 'preparing' | 'ready' | 'delivered'
  notes: string | null
  orderType: string
  tableNumber: number | null
  customerName: string
  bcvRate: number | null
  createdBy: string
  createdAt: string
  updatedAt: string
  items: OrderItem[]
  payments: RecordedOrderPayment[]
  totalAmount: number
}

export interface OrderItem {
  id: string
  sellableProductId: string
  productName: string
  emoji: string
  category: string
  quantity: number
  unitPrice: number
}

export interface Credit {
  id: string
  customerId: string | null
  customerName: string
  totalAmount: number
  totalPaid: number
  balancePending: number
  status: string
  orderId: string
  createdAt: string
  dueDate?: string | null
  isIndefinite?: boolean
}

export interface CreditPayment {
  id: string
  creditId: string
  amount: number
  notes: string | null
  createdBy: string
  createdAt: string
}

export interface DailyClose {
  id: string
  closeDate: string
  totalSales: number
  totalPayments: number
  notes: string | null
  closedBy: string
  createdAt: string
}

export interface DailyCloseSummary {
  id: string
  closeDate: string
  totalSales: number
  totalPayments: number
  totalExpenses: number
  totalCredits: number
  balance: number
  notes: string | null
  closedBy: string
}

export interface Expense {
  id: string
  concept: string
  amount: number
  category: string
  expenseDate: string
  notes: string | null
  createdBy: string
  createdAt: string
}

export interface FinancialOperation {
  id: string
  type: 'transfer' | 'receivable' | 'receivable_collection' | 'tip' | 'tip_distribution' | 'employee_advance' | 'loan' | 'loan_payment' | 'bank_fee' | 'adjustment'
  concept: string
  operationDate: string
  amountUsd: number
  originalCurrency: 'USD' | 'VES'
  originalAmount: number
  counterparty: string | null
  referenceNumber: string | null
  affectsProfit: boolean
  fromAccount: string | null
  toAccount: string | null
}

export interface TodayStats {
  totalSales: number
  ordersCount: number
  pendingOrders: number
  readyOrders: number
  avgTicket: number
}

export interface DailySales {
  date: string
  total: number
  count: number
}

export interface ProductRanking {
  name: string
  emoji: string
  count: number
  revenue: number
}

export interface CategorySales {
  category: string
  total: number
}

export interface PaymentMethodSales {
  method: string
  total: number
  count: number
}

export interface Ingredient {
  id: string
  name: string
  unitId: string
  unitName: string
  unitSymbol: string
  isActive: boolean
  currentStock: number
  pricePerUnit: number | null
  stockValue: number | null
}

export interface StockMovement {
  id: string
  ingredientId: string
  ingredientName: string
  quantity: number
  unitId: string
  unitSymbol: string
  movementType: string
  referenceType: string | null
  referenceId: string | null
  notes: string | null
  createdBy: string | null
  createdAt: string
}

export interface Supplier {
  id: string
  name: string
  contact: string | null
  phone: string | null
  email: string | null
  notes: string | null
  isActive: boolean
}

export interface Purchase {
  id: string
  supplierId: string
  supplierName: string
  purchaseDate: string
  invoiceNumber: string | null
  notes: string | null
  createdBy: string
  createdAt: string
  items: PurchaseItem[]
  totalAmount: number
  isPaid: boolean
}

export interface PurchaseItem {
  id: string
  purchaseId: string
  ingredientId: string
  ingredientName: string
  quantity: number
  unitId: string
  unitSymbol: string
  unitCost: number
  total: number
}

export interface SellableProduct {
  id: string
  name: string
  description: string | null
  salePrice: number
  cost: number | null
  category: string
  categories: string[]
  emoji: string
  isActive: boolean
  imageUrl: string | null
  isDelivery: boolean
}

export interface RecipeSummary {
  componentCount: number
  recipeCost: number | null
  marginEstimated: number | null
}

export interface RecipeComponent {
  id: string
  sellableProductId: string
  ingredientId: string | null
  preparationBatchId: string | null
  ingredientName: string | null
  quantity: number
  unitId: string
  unitSymbol: string
  costPerUnit: number | null
}

export interface Employee {
  id: string
  fullName: string
  position: string | null
  hourlyRate: number
  weeklySalary: number
  overtimeRate: number
  isActive: boolean
}

export interface PayrollPeriod {
  id: string
  startDate: string
  endDate: string
  status: 'open' | 'closed' | 'paid'
  notes: string | null
  createdAt: string
}

export interface PayrollEntry {
  id: string
  payrollPeriodId: string
  employeeId: string
  employeeName: string
  position: string | null
  hoursWorked: number
  baseSalary: number
  deductions: number
  netPay: number
  notes: string | null
  weeklySalary: number
  bonusAmount: number
  overtimeHours: number
  overtimeAmount: number
  transportAmount: number
  absenceDays: number
  absenceDeduction: number
  advanceDeduction: number
}

export interface PayrollPayment {
  id: string
  employeeId: string
  employeeName: string
  amount: number
  currency: 'USD' | 'Bs'
  exchangeRate: number | null
  paymentAccount: string | null
  paymentDate: string
  reference: string | null
  notes: string | null
}

export interface Advance {
  id: string
  employeeId: string
  employeeName: string
  amount: number
  advanceDate: string
  isDeducted: boolean
  notes: string | null
  createdAt: string
}

export interface AuditLog {
  id: string
  occurredAt: string
  actorName: string
  module: string
  action: string
  details: string | null
  severity: 'info' | 'warning' | 'danger'
}

export interface BatchItem {
  id: string
  ingredientId: string
  ingredientName: string
  quantityUsed: number
  unitId: string
  unitSymbol: string
  costPerUnit: number
}

export interface ProductionBatch {
  id: string
  batchNumber: number
  name: string
  sellableProductId: string | null
  productName: string
  productionDate: string
  quantityProduced: number
  unitProduced: string
  wasteQuantity: number
  wastePercentage: number
  totalCost: number
  costPerPortion: number
  operator: string
  status: string
  items: BatchItem[]
  notes: string | null
  createdAt: string
}

export interface ProductionStats {
  batchesToday: number
  avgYield: number
  totalWaste: number
  avgCostPerPortion: number
  batchesYesterday: number
  yieldChange: number
  wasteChange: number
  costChange: number
}

export interface ProductionBonus {
  employeeId: string
  employeeName: string
  initials: string
  piecesCount: number
  bonusAmount: number
  percentage: number
}

function client() {
  if (!supabase) throw new Error('Supabase no está configurado (revisa el .env)')
  return supabase
}

// --- Productos ---------------------------------------------------------------

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

export async function getProducts(): Promise<Product[]> {
  if (!supabase) throw new Error('Supabase no está configurado')
  try {
    const [{ data, error }, extraMap] = await Promise.all([
      supabase
        .from('sellable_products')
        .select('id,name,description,price,cost,category,emoji,is_active,image_url')
        .eq('is_active', true)
        .order('category', { ascending: true })
        .order('name', { ascending: true }),
      getProductExtraCategoriesMap().catch(() => new Map<string, string[]>()),
    ])

    if (error) throw error
    return data.map((r) => ({
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
    }))
  } catch (err) {
    console.error('Error cargando productos de Supabase:', err)
    throw err
  }
}

/** Todos los productos vendibles (activos e inactivos) para el módulo Menú. */
export async function getAllSellableProducts(): Promise<SellableProduct[]> {
  const [{ data, error }, extraMap] = await Promise.all([
    client()
      .from('sellable_products')
      .select('id,name,description,price,cost,category,emoji,is_active,image_url,is_delivery')
      .order('name', { ascending: true }),
    getProductExtraCategoriesMap().catch(() => new Map<string, string[]>()),
  ])
  if (error) throw error
  return (data ?? []).map((r) => ({
    id: r.id as string, name: r.name as string, description: (r.description as string) ?? null,
    salePrice: Number(r.price), cost: r.cost === null ? null : Number(r.cost),
    category: r.category as string, categories: mergeCategories(r.category as string, extraMap.get(r.id as string)),
    emoji: r.emoji as string, isActive: r.is_active as boolean,
    imageUrl: (r.image_url as string) ?? null, isDelivery: (r.is_delivery as boolean) ?? false,
  }))
}

export async function createProduct(p: {
  name: string; description?: string | null; price: number; cost?: number | null
  category: string; emoji?: string; imageUrl?: string | null; isActive?: boolean
}): Promise<string> {
  const { data, error } = await client().from('sellable_products').insert({
    name: p.name, description: p.description ?? null, price: p.price, cost: p.cost ?? null,
    category: p.category, emoji: p.emoji ?? '🍽️', /* DB default: emoji */ image_url: p.imageUrl ?? null,
    is_active: p.isActive ?? true,
  }).select('id').single()
  if (error) throw error
  return data.id as string
}

export async function updateProduct(id: string, updates: Partial<{
  name: string; description: string | null; price: number; cost: number | null
  category: string; emoji: string; imageUrl: string | null; isActive: boolean
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

export interface MenuCategoryRow { id: string; key: string; label: string; sortOrder: number; isActive: boolean }

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

export interface DeliveryConfigRow { originLat: number | null; originLng: number | null; roadFactor: number; enabled: boolean }
export interface DeliveryZoneRow { id: string; minKm: number; maxKm: number | null; price: number; sortOrder: number; isActive: boolean }

export async function getDeliverySettings(): Promise<{ config: DeliveryConfigRow; zones: DeliveryZoneRow[] }> {
  const [configRes, zonesRes] = await Promise.all([
    client().from('delivery_config').select('origin_lat,origin_lng,road_factor,is_enabled').eq('id', 1).maybeSingle(),
    client().from('delivery_zones').select('id,min_km,max_km,price,sort_order,is_active').order('sort_order', { ascending: true }),
  ])
  if (configRes.error) throw configRes.error
  if (zonesRes.error) throw zonesRes.error
  const c = configRes.data
  return {
    config: {
      originLat: c?.origin_lat == null ? null : Number(c.origin_lat),
      originLng: c?.origin_lng == null ? null : Number(c.origin_lng),
      roadFactor: c?.road_factor == null ? 1.3 : Number(c.road_factor),
      enabled: c?.is_enabled ?? true,
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

/** Conjunto de ids de productos que tienen al menos un modificador asignado. */
export async function getProductsWithModifiers(): Promise<Set<string>> {
  const { data, error } = await client()
    .from('sellable_product_modifiers')
    .select('sellable_product_id')

  if (error) throw error
  return new Set((data ?? []).map((r) => r.sellable_product_id as string))
}

/** Grupos de modificadores (con sus opciones) de un producto. */
export async function getProductModifiers(productId: string): Promise<ProductModifierGroup[]> {
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
  return groups.sort((a, b) => a.name.localeCompare(b.name))
}

// --- Cobro (checkout) --------------------------------------------------------

export async function checkout(params: {
  items: CartItem[]
  method: PaymentMethod
  bcvRate: number | null
  userId: string
  notes?: string | null
  orderType?: string
  tableNumber?: number | null
  customerName?: string
  referenceNumber?: string | null
  receivedAmount?: number | null
  payments?: OrderPaymentComponent[]
  deliveryFee?: number
}): Promise<OrderResult> {
  const deliveryFee = params.orderType === 'delivery' ? (params.deliveryFee ?? 0) : 0
  const total = params.items.reduce((sum, i) => sum + i.price * i.quantity, 0) + deliveryFee

  const paymentComponents = params.payments ?? [{
    method: params.method,
    amount: total,
    referenceNumber: params.referenceNumber,
    receivedAmount: params.receivedAmount,
    notes: params.notes,
  }]

  const { data: order, error: checkoutErr } = await client().rpc('fn_checkout_order', {
    p_items: params.items.map((item) => ({
      productId: item.productId,
      quantity: item.quantity,
      ...(item.selectedModifiers && item.selectedModifiers.length > 0
        ? {
            modifiers: item.selectedModifiers.map((m) => ({
              optionId: m.optionId,
              quantity: m.quantity,
            })),
          }
        : {}),
    })),
    p_payments: paymentComponents,
    p_bcv_rate: params.bcvRate,
    p_notes: params.notes ?? null,
    p_order_type: params.orderType ?? 'takeaway',
    p_customer_name: params.customerName ?? 'Cliente',
    p_delivery_fee: deliveryFee,
    p_table_number: params.orderType === 'dine-in' ? (params.tableNumber ?? null) : null,
  })
  if (checkoutErr) throw checkoutErr

  const checkoutResult = order as {
    id: string
    orderNumber: number
    status: string
    total: number
    createdAt: string
  }

  return {
    id: checkoutResult.id,
    orderNumber: checkoutResult.orderNumber,
    status: checkoutResult.status,
    total: Number(checkoutResult.total),
    bcvRate: params.bcvRate,
    createdAt: checkoutResult.createdAt,
    paymentMethod: params.method,
    items: params.items,
  }
}

// --- Enviar a cocina (sin pago) ----------------------------------------------

/** Id del producto oculto "Delivery" (para agregar el cargo como renglón). */
export async function getDeliveryProductId(): Promise<string | null> {
  const { data, error } = await client()
    .from('sellable_products')
    .select('id')
    .eq('is_delivery', true)
    .limit(1)
    .maybeSingle()
  if (error) throw error
  return (data?.id as string) ?? null
}

export async function sendToKitchen(params: {
  items: CartItem[]
  bcvRate: number | null
  userId: string
  notes?: string | null
  orderType?: string
  tableNumber?: number | null
  customerName?: string
  deliveryFee?: number
}): Promise<OrderResult> {
  const deliveryFee = params.orderType === 'delivery' ? (params.deliveryFee ?? 0) : 0
  const total = params.items.reduce((sum, i) => sum + i.price * i.quantity, 0) + deliveryFee

  const sb = client()

  const { data: order, error: orderErr } = await sb
    .from('orders')
    .insert({
      created_by: params.userId,
      bcv_rate: params.bcvRate,
      notes: params.notes ?? null,
      order_type: params.orderType ?? 'takeaway',
      table_number: params.orderType === 'dine-in' ? (params.tableNumber ?? null) : null,
      customer_name: params.customerName ?? 'Cliente',
      status: 'open',
    })
    .select('id, order_number, created_at')
    .single()
  if (orderErr) throw orderErr

  // Renglones de producto + (opcional) el cargo de delivery como renglón extra.
  const itemRows = params.items.map((i) => ({
    order_id: order.id,
    sellable_product_id: i.productId,
    quantity: i.quantity,
    unit_price: i.price,
  }))
  if (deliveryFee > 0) {
    const deliveryId = await getDeliveryProductId()
    if (!deliveryId) throw new Error('No existe el producto de Delivery configurado')
    itemRows.push({ order_id: order.id, sellable_product_id: deliveryId, quantity: 1, unit_price: Math.round(deliveryFee * 100) / 100 })
  }

  const { data: insertedItems, error: itemsErr } = await sb.from('order_items').insert(itemRows).select('id')
  if (itemsErr) throw itemsErr

  // Persistir las opciones de modificador elegidas por renglón. Los ids se
  // devuelven en el mismo orden en que se insertaron, así que se mapean por
  // índice. Esto dispara el consumo de inventario por modificador.
  const modifierRows = (insertedItems ?? []).flatMap((row, idx) => {
    const mods = params.items[idx]?.selectedModifiers ?? []
    return mods.map((m) => ({
      order_item_id: row.id as string,
      modifier_option_id: m.optionId,
      quantity: m.quantity,
      unit_price: m.price,
    }))
  })
  if (modifierRows.length > 0) {
    const { error: modErr } = await sb.from('order_item_modifiers').insert(modifierRows)
    if (modErr) throw modErr
  }

  // NO payment inserted — the order stays unpaid until cobro

  return {
    id: order.id as string,
    orderNumber: order.order_number as number,
    status: 'open',
    total,
    bcvRate: params.bcvRate,
    createdAt: order.created_at as string,
    paymentMethod: 'cash',
    items: params.items,
  }
}

// --- Agregar productos a un pedido existente (sin cobrar) --------------------

/**
 * Inserta ítems adicionales en un pedido ya creado que aún no se ha cobrado.
 * Reutiliza la misma mecánica que sendToKitchen: order_items + los
 * order_item_modifiers elegidos por renglón (esto dispara el consumo de
 * inventario). No crea pedido ni registra pago; el total se recalcula solo
 * desde los ítems.
 */
export async function addItemsToOrder(orderId: string, items: CartItem[]): Promise<void> {
  if (items.length === 0) return
  const sb = client()

  const { data: insertedItems, error: itemsErr } = await sb.from('order_items').insert(
    items.map((i) => ({
      order_id: orderId,
      sellable_product_id: i.productId,
      quantity: i.quantity,
      unit_price: i.price,
    })),
  ).select('id')
  if (itemsErr) throw itemsErr

  const modifierRows = (insertedItems ?? []).flatMap((row, idx) => {
    const mods = items[idx]?.selectedModifiers ?? []
    return mods.map((m) => ({
      order_item_id: row.id as string,
      modifier_option_id: m.optionId,
      quantity: m.quantity,
      unit_price: m.price,
    }))
  })
  if (modifierRows.length > 0) {
    const { error: modErr } = await sb.from('order_item_modifiers').insert(modifierRows)
    if (modErr) throw modErr
  }
}

/**
 * Elimina un producto de una comanda sin cobrar y revierte su consumo de
 * inventario (vía RPC SECURITY DEFINER que inserta un ajuste compensatorio).
 */
export async function removeOrderItem(orderItemId: string): Promise<void> {
  const { error } = await client().rpc('fn_remove_order_item', { p_item_id: orderItemId })
  if (error) throw error
}

/**
 * Elimina una comanda completa y revierte el consumo de inventario de todos sus
 * items. Solo permite eliminar comandas no cobradas.
 */
export async function deleteOrder(orderId: string): Promise<void> {
  const { error } = await client().rpc('fn_delete_order', { p_order_id: orderId })
  if (error) throw new Error(error.message || 'No se pudo eliminar la comanda')
}

export async function validateMyPin(pin: string): Promise<boolean> {
  const { data, error } = await client().rpc('fn_validate_my_pin', { p_pin: pin })
  if (error) throw new Error(error.message || 'No se pudo validar el PIN')
  return data === true
}

/**
 * Elimina un pedido web pendiente (web_order_requests) y sus items.
 */
export async function deleteWebOrder(requestId: string): Promise<void> {
  const { error } = await client().rpc('fn_delete_web_order', { p_request_id: requestId })
  if (error) throw new Error(error.message || 'No se pudo eliminar el pedido web')
}

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

export async function getTodayOrders(): Promise<TodayOrder[]> {
  // El día del negocio es en horario de Venezuela (UTC-4), no en la zona del
  // navegador ni en UTC. Ver dayRangeInTimeZone en ./money.
  const { start, end } = dayRangeInTimeZone()

  const { data, error } = await client()
    .from('orders')
    .select('id, order_number, status, created_at, payments(method, amount)')
    .eq('status', 'paid')
    .gte('created_at', start)
    .lt('created_at', end)
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

// --- Mapa de mesas (módulo Mesas) --------------------------------------------

export interface FloorTable {
  id: string
  number: number
  zone: string
  shape: 'square' | 'round'
  seats: number
  posX: number
  posY: number
  isActive: boolean
  openOrderId: string | null
  openOrderNumber: number | null
  openOrderCustomer: string | null
  openOrderCreatedBy: string | null
  openOrderCreatedByName: string | null
  openOrderCreatedAt: string | null
  openOrderTotal: number
}

export async function getFloorTables(): Promise<FloorTable[]> {
  const { data, error } = await client()
    .from('v_floor_tables_status')
    .select('*')
    .order('number', { ascending: true })
  if (error) throw error
  return (data ?? []).map((t) => ({
    id: t.id as string,
    number: Number(t.number),
    zone: (t.zone as string) ?? 'Salón',
    shape: (t.shape as FloorTable['shape']) ?? 'square',
    seats: Number(t.seats ?? 4),
    posX: Number(t.pos_x ?? 10),
    posY: Number(t.pos_y ?? 10),
    isActive: Boolean(t.is_active),
    openOrderId: (t.open_order_id as string) ?? null,
    openOrderNumber: t.open_order_number == null ? null : Number(t.open_order_number),
    openOrderCustomer: (t.open_order_customer as string) ?? null,
    openOrderCreatedBy: (t.open_order_created_by as string) ?? null,
    openOrderCreatedByName: (t.open_order_created_name as string) ?? null,
    openOrderCreatedAt: (t.open_order_created_at as string) ?? null,
    openOrderTotal: Number(t.open_order_total ?? 0),
  }))
}

export async function createFloorTable(params: {
  number: number
  zone: string
  shape: 'square' | 'round'
  seats: number
  posX: number
  posY: number
}): Promise<string> {
  const { data, error } = await client()
    .from('floor_tables')
    .insert({
      number: params.number,
      zone: params.zone,
      shape: params.shape,
      seats: params.seats,
      pos_x: params.posX,
      pos_y: params.posY,
    })
    .select('id')
    .single()
  if (error) throw error
  return data.id as string
}

export async function updateFloorTable(id: string, params: Partial<{
  number: number
  zone: string
  shape: 'square' | 'round'
  seats: number
  posX: number
  posY: number
  isActive: boolean
}>): Promise<void> {
  const patch: Record<string, unknown> = {}
  if (params.number !== undefined) patch.number = params.number
  if (params.zone !== undefined) patch.zone = params.zone
  if (params.shape !== undefined) patch.shape = params.shape
  if (params.seats !== undefined) patch.seats = params.seats
  if (params.posX !== undefined) patch.pos_x = params.posX
  if (params.posY !== undefined) patch.pos_y = params.posY
  if (params.isActive !== undefined) patch.is_active = params.isActive

  const { error } = await client().from('floor_tables').update(patch).eq('id', id)
  if (error) throw error
}

export async function deleteFloorTable(id: string): Promise<void> {
  const { error } = await client().from('floor_tables').delete().eq('id', id)
  if (error) throw error
}

/** Mesas con un pedido abierto (sin cobrar) ahora mismo, para el selector de Caja. */
export async function getOccupiedTables(): Promise<number[]> {
  const { data, error } = await client()
    .from('orders')
    .select('table_number')
    .eq('status', 'open')
    .eq('order_type', 'dine-in')
    .not('table_number', 'is', null)

  if (error) throw error
  return [...new Set((data ?? []).map((o) => Number(o.table_number)))]
}

// --- Órdenes completas (para Comandas/Cocina) --------------------------------

export async function getOrdersWithItems(dateStart?: string, dateEnd?: string): Promise<FullOrder[]> {
  let query = client().from('v_orders_with_items').select('*')
  if (dateStart) query = query.gte('created_at', dateStart)
  if (dateEnd) query = query.lte('created_at', dateEnd)
  query = query.order('created_at', { ascending: false })

  const { data, error } = await query
  if (error) throw error

  return (data ?? []).map((o) => ({
    id: o.id as string,
    orderNumber: o.order_number as number,
    status: o.status as string,
    fulfillmentStatus: (o.fulfillment_status as FullOrder['fulfillmentStatus']) ?? 'new',
    notes: (o.notes as string) ?? null,
    orderType: (o.order_type as string) ?? 'takeaway',
    tableNumber: o.table_number == null ? null : Number(o.table_number),
    customerName: (o.customer_name as string) ?? 'Cliente',
    bcvRate: o.bcv_rate ? Number(o.bcv_rate) : null,
    createdBy: o.created_by as string,
    createdAt: o.created_at as string,
    updatedAt: o.updated_at as string,
    items: Array.isArray(o.items) ? o.items.map((i: Record<string, unknown>) => ({
      id: i.id as string,
      sellableProductId: i.sellable_product_id as string,
      productName: i.product_name as string,
      emoji: (i.emoji as string) ?? '🍽️', /* DB default: emoji */
      category: (i.category as string) ?? 'plato',
      quantity: Number(i.quantity),
      unitPrice: Number(i.unit_price),
    })) : [],
    payments: Array.isArray(o.payments) ? o.payments.map((p: Record<string, unknown>) => ({
      id: p.id as string,
      method: p.method as PaymentMethod,
      amount: Number(p.amount),
      referenceNumber: (p.reference_number as string) ?? null,
      receivedAmount: p.received_amount == null ? null : Number(p.received_amount),
      notes: (p.notes as string) ?? null,
      createdAt: p.created_at as string,
    })) : [],
    totalAmount: Number(o.total_amount),
  }))
}

// --- Actualizar estado de orden (para Cocina) --------------------------------

export async function updateOrderStatus(orderId: string, newStatus: string): Promise<void> {
  const { error } = await client()
    .from('orders')
    .update({ fulfillment_status: newStatus })
    .eq('id', orderId)

  if (error) throw error
}

export async function recordOrderPayments(params: {
  orderId: string
  payments: OrderPaymentComponent[]
  notes?: string | null
}): Promise<void> {
  if (params.payments.length === 0) throw new Error('Debe registrar al menos un pago')

  const { error } = await client().rpc('fn_record_order_payments', {
    p_order_id: params.orderId,
    p_payments: params.payments,
    p_notes: params.notes ?? null,
  })
  if (error) throw error
}

export interface Customer {
  id: string
  name: string
  identification: string
  phone: string
  address?: string
  email: string
  totalVisits: number
  rewardsUnlocked: number
  lastVisit: string
  favoriteProduct: string
  birthday: string
  createdAt: string
  isActive: boolean
}

export interface CustomerOrderSummary {
  id: string
  orderNumber: number
  createdAt: string
  orderType: string
  status: string
  fulfillmentStatus: string
  total: number
  itemsText: string
  items: Array<{ productName: string; quantity: number }>
  paymentMethods: string[]
}

export interface CustomerPurchaseMetric {
  customerId: string | null
  customerName: string
  orderCount: number
  totalPurchased: number
  lastPurchase: string
}

export interface WeeklyDish {
  id: string
  name: string
  description: string
  price: number
  cost: number
  emoji: string
  status: 'active' | 'inactive'
  weekTag: string
  sellableProductId: string | null
  imageUrl: string | null
  /** Fecha (YYYY-MM-DD) del lunes de la última semana en que estuvo activo. */
  lastUsedWeekStart: string | null
}

export interface WhatsAppMessage {
  id: string
  templateType: string
  customerName: string
  phone: string
  message: string
  sentAt: string
  status: 'queued' | 'sent' | 'failed' | 'cancelled'
}

export interface LegacyPurchaseOrder {
  id: string
  code: string
  supplier: string
  date: string
  total: number
  invoiceNumber: string
  status: string
}

export interface CashMovement {
  id: string
  direction: 'in' | 'out'
  movementType: 'cash_in' | 'cash_out' | 'withdrawal' | 'expense' | 'adjustment'
  currency: 'USD' | 'VES'
  amount: number
  description: string
  referenceNumber: string | null
  createdAt: string
}

export interface CashSessionSnapshot {
  id: string
  sessionNumber: number
  registerId: string
  registerCode: string
  registerName: string
  status: 'open' | 'closed'
  openedAt: string
  openedBy: string
  openingCashUsd: number
  openingCashVes: number
  cashSalesUsd: number
  paymentTotal: number
  paymentBreakdown: Record<string, number>
  paymentBreakdownVes: Record<string, number>
  movementInUsd: number
  movementOutUsd: number
  movementInVes: number
  movementOutVes: number
  expectedCashUsd: number
  expectedCashVes: number
  countedCashUsd: number | null
  countedCashVes: number | null
  differenceUsd: number | null
  differenceVes: number | null
  closedAt: string | null
  movements: CashMovement[]
}

// --- Créditos ----------------------------------------------------------------

export async function getCredits(): Promise<Credit[]> {
  const { data, error } = await client()
    .from('v_credit_balances')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) throw error

  return (data ?? []).map((c) => ({
    id: c.credit_id as string,
    customerId: (c.customer_id as string) ?? null,
    customerName: c.customer_name as string,
    totalAmount: Number(c.total_amount),
    totalPaid: Number(c.total_paid),
    balancePending: Number(c.balance_pending),
    status: c.status as string,
    orderId: c.order_id as string,
    createdAt: c.created_at as string,
    dueDate: (c.due_date as string) ?? null,
    isIndefinite: Boolean(c.is_indefinite ?? true),
  }))
}

export async function createCredit(params: {
  orderId?: string | null
  customerId?: string | null
  customerName: string
  totalAmount: number
  dueDate?: string | null
  isIndefinite?: boolean
  notes?: string
  userId: string
}): Promise<string> {
  const { data, error } = await client()
    .from('credits')
    .insert({
      order_id: params.orderId,
      customer_id: params.customerId ?? null,
      customer_name: params.customerName,
      total_amount: params.totalAmount,
      due_date: params.isIndefinite ? null : (params.dueDate ?? null),
      is_indefinite: params.isIndefinite ?? true,
      notes: params.notes ?? null,
      created_by: params.userId,
    })
    .select('id')
    .single()
  if (error) throw error
  return data.id as string
}

export async function addCreditPayment(params: {
  creditId: string
  amount: number
  notes?: string
  userId: string
}): Promise<void> {
  const { error } = await client()
    .from('credit_payments')
    .insert({
      credit_id: params.creditId,
      amount: params.amount,
      notes: params.notes ?? null,
      created_by: params.userId,
    })
  if (error) throw error
}

export async function getCreditPayments(creditId: string): Promise<CreditPayment[]> {
  const { data, error } = await client()
    .from('credit_payments')
    .select('*')
    .eq('credit_id', creditId)
    .order('created_at', { ascending: false })

  if (error) throw error

  return (data ?? []).map((p) => ({
    id: p.id as string,
    creditId: p.credit_id as string,
    amount: Number(p.amount),
    notes: (p.notes as string) ?? null,
    createdBy: p.created_by as string,
    createdAt: p.created_at as string,
  }))
}

// --- Estadísticas de hoy (RPC) -----------------------------------------------

export async function getTodayStats(): Promise<TodayStats> {
  const { data, error } = await client().rpc('fn_get_today_stats')
  if (error) throw error
  const stats = data as Record<string, number>
  return {
    totalSales: Number(stats.totalSales ?? 0),
    ordersCount: Number(stats.ordersCount ?? 0),
    pendingOrders: Number(stats.pendingOrders ?? 0),
    readyOrders: Number(stats.readyOrders ?? 0),
    avgTicket: Number(stats.avgTicket ?? 0),
  }
}

// --- Ventas diarias (RPC) ----------------------------------------------------

export async function getDailySales(days: number = 30): Promise<DailySales[]> {
  const { data, error } = await client().rpc('fn_get_daily_sales', { p_days: days })
  if (error) throw error

  return (data ?? []).map((d: Record<string, unknown>) => ({
    date: d.sale_date as string,
    total: Number(d.total ?? 0),
    count: Number(d.order_count ?? 0),
  }))
}

// --- Ranking de productos (RPC) ----------------------------------------------

export async function getProductRanking(): Promise<ProductRanking[]> {
  const { data, error } = await client().rpc('fn_get_product_ranking')
  if (error) throw error

  return (data ?? []).map((r: Record<string, unknown>) => ({
    name: r.product_name as string,
    emoji: (r.emoji as string) ?? '🍽️', /* DB default: emoji */
    count: Number(r.total_quantity ?? 0),
    revenue: Number(r.total_revenue ?? 0),
  }))
}

// --- Ventas por categoría (RPC) ----------------------------------------------

export async function getCategorySales(): Promise<CategorySales[]> {
  const { data, error } = await client().rpc('fn_get_category_sales')
  if (error) throw error

  return (data ?? []).map((r: Record<string, unknown>) => ({
    category: r.category as string,
    total: Number(r.total ?? 0),
  }))
}

// --- Ventas por método de pago (RPC) -----------------------------------------

export async function getPaymentMethodSales(): Promise<PaymentMethodSales[]> {
  const { data, error } = await client().rpc('fn_get_payment_method_sales')
  if (error) throw error

  return (data ?? []).map((r: Record<string, unknown>) => ({
    method: r.method as string,
    total: Number(r.total ?? 0),
    count: Number(r.count ?? 0),
  }))
}

// --- Cierre de caja ----------------------------------------------------------

function mapCashSession(value: Record<string, unknown>): CashSessionSnapshot {
  const numberValue = (key: string): number => Number(value[key] ?? 0)
  const nullableNumber = (key: string): number | null => value[key] == null ? null : Number(value[key])
  const breakdown = (value.paymentBreakdown ?? {}) as Record<string, unknown>
  const breakdownVes = (value.paymentBreakdownVes ?? {}) as Record<string, unknown>
  return {
    id: String(value.id),
    sessionNumber: numberValue('sessionNumber'),
    registerId: String(value.registerId),
    registerCode: String(value.registerCode),
    registerName: String(value.registerName),
    status: value.status as 'open' | 'closed',
    openedAt: String(value.openedAt),
    openedBy: String(value.openedBy),
    openingCashUsd: numberValue('openingCashUsd'),
    openingCashVes: numberValue('openingCashVes'),
    cashSalesUsd: numberValue('cashSalesUsd'),
    paymentTotal: numberValue('paymentTotal'),
    paymentBreakdown: Object.fromEntries(Object.entries(breakdown).map(([key, amount]) => [key, Number(amount)])),
    paymentBreakdownVes: Object.fromEntries(Object.entries(breakdownVes).map(([key, amount]) => [key, Number(amount)])),
    movementInUsd: numberValue('movementInUsd'),
    movementOutUsd: numberValue('movementOutUsd'),
    movementInVes: numberValue('movementInVes'),
    movementOutVes: numberValue('movementOutVes'),
    expectedCashUsd: numberValue('expectedCashUsd'),
    expectedCashVes: numberValue('expectedCashVes'),
    countedCashUsd: nullableNumber('countedCashUsd'),
    countedCashVes: nullableNumber('countedCashVes'),
    differenceUsd: nullableNumber('differenceUsd'),
    differenceVes: nullableNumber('differenceVes'),
    closedAt: value.closedAt == null ? null : String(value.closedAt),
    movements: Array.isArray(value.movements)
      ? value.movements.map((movement: Record<string, unknown>) => ({
          id: String(movement.id),
          direction: movement.direction as 'in' | 'out',
          movementType: movement.movementType as CashMovement['movementType'],
          currency: movement.currency as 'USD' | 'VES',
          amount: Number(movement.amount),
          description: String(movement.description),
          referenceNumber: movement.referenceNumber == null ? null : String(movement.referenceNumber),
          createdAt: String(movement.createdAt),
        }))
      : [],
  }
}

export async function getActiveCashSession(): Promise<CashSessionSnapshot | null> {
  const { data, error } = await client().rpc('fn_get_active_cash_session', { p_register_code: 'caja-principal' })
  if (error) throw error
  return data ? mapCashSession(data as Record<string, unknown>) : null
}

export async function openCashSession(params: {
  openingCashUsd: number
  openingCashVes: number
  notes?: string | null
  userId: string
}): Promise<string> {
  const { data, error } = await client().rpc('fn_open_cash_session', {
    p_register_code: 'caja-principal',
    p_opening_cash_usd: params.openingCashUsd,
    p_opening_cash_ves: params.openingCashVes,
    p_notes: params.notes ?? null,
  })
  if (error) throw error
  return data as string
}

export async function addCashMovement(params: {
  sessionId: string
  direction: 'in' | 'out'
  movementType: CashMovement['movementType']
  currency: 'USD' | 'VES'
  amount: number
  description: string
  referenceNumber?: string | null
  userId: string
}): Promise<string> {
  const { data, error } = await client().rpc('fn_add_cash_movement', {
    p_session_id: params.sessionId,
    p_direction: params.direction,
    p_movement_type: params.movementType,
    p_currency: params.currency,
    p_amount: params.amount,
    p_description: params.description,
    p_reference_number: params.referenceNumber ?? null,
  })
  if (error) throw error
  return data as string
}

export async function closeCashSession(params: {
  sessionId: string
  countedCashUsd: number
  countedCashVes: number
  notes?: string | null
}): Promise<CashSessionSnapshot> {
  const { data, error } = await client().rpc('fn_close_cash_session', {
    p_session_id: params.sessionId,
    p_counted_cash_usd: params.countedCashUsd,
    p_counted_cash_ves: params.countedCashVes,
    p_notes: params.notes ?? null,
  })
  if (error) throw error
  return mapCashSession(data as Record<string, unknown>)
}

export async function getCashSessionHistory(limit = 20): Promise<CashSessionSnapshot[]> {
  const { data, error } = await client().rpc('fn_get_cash_session_history', { p_limit: limit })
  if (error) throw error
  return (data ?? []).map((item: Record<string, unknown>) => mapCashSession(item))
}

export interface CashTransaction {
  id: string
  kind: 'payment' | 'movement'
  direction: 'in' | 'out'
  orderNumber: number | null
  orderType: string | null
  customerName: string | null
  method: string
  amount: number
  referenceNumber: string | null
  createdAt: string
  itemsSummary: string | null
}

export async function getCashSessionTransactions(sessionId: string): Promise<CashTransaction[]> {
  const { data, error } = await client().rpc('fn_get_cash_session_transactions', { p_session_id: sessionId })
  if (error) throw error
  return ((data ?? []) as Record<string, unknown>[]).map(t => ({
    id: String(t.id),
    kind: t.kind as 'payment' | 'movement',
    direction: t.direction as 'in' | 'out',
    orderNumber: t.orderNumber != null ? Number(t.orderNumber) : null,
    orderType: t.orderType as string | null,
    customerName: t.customerName as string | null,
    method: String(t.method),
    amount: Number(t.amount),
    referenceNumber: t.referenceNumber as string | null,
    createdAt: String(t.createdAt),
    itemsSummary: t.itemsSummary as string | null,
  }))
}

export async function createDailyClose(date: string, notes?: string): Promise<string> {
  const { data, error } = await client().rpc('fn_create_daily_close', {
    p_close_date: date,
    p_notes: notes ?? null,
  })
  if (error) throw error
  return data as string
}

export async function getDailyCloses(): Promise<DailyCloseSummary[]> {
  const { data, error } = await client().rpc('fn_get_daily_close_summary')

  if (error) throw error

  return (data ?? []).map((d: Record<string, unknown>) => ({
    id: d.id as string,
    closeDate: d.close_date as string,
    totalSales: Number(d.total_sales),
    totalPayments: Number(d.total_payments),
    totalExpenses: Number(d.total_expenses ?? 0),
    totalCredits: Number(d.total_credits ?? 0),
    balance: Number(d.balance ?? 0),
    notes: (d.notes as string) ?? null,
    closedBy: d.closed_by as string,
  }))
}

// --- Gastos ------------------------------------------------------------------

export async function getExpenses(dateStart?: string, dateEnd?: string): Promise<Expense[]> {
  let query = client().from('expenses').select('*')
  if (dateStart) query = query.gte('expense_date', dateStart)
  if (dateEnd) query = query.lte('expense_date', dateEnd)
  query = query.order('expense_date', { ascending: false })

  const { data, error } = await query
  if (error) throw error

  return (data ?? []).map((e) => ({
    id: e.id as string,
    concept: e.concept as string,
    amount: Number(e.amount),
    category: e.category as string,
    expenseDate: e.expense_date as string,
    notes: (e.notes as string) ?? null,
    createdBy: e.created_by as string,
    createdAt: e.created_at as string,
  }))
}

export async function createExpense(params: {
  concept: string
  amount: number
  category: 'fixed' | 'variable' | 'other'
  expenseDate: string
  notes?: string | null
  userId: string
}): Promise<Expense> {
  const { data, error } = await client().from('expenses').insert({
    concept: params.concept,
    amount: params.amount,
    category: params.category,
    expense_date: params.expenseDate,
    notes: params.notes ?? null,
    created_by: params.userId,
  }).select('*').single()
  if (error) throw error
  return {
    id: data.id as string,
    concept: data.concept as string,
    amount: Number(data.amount),
    category: data.category as string,
    expenseDate: data.expense_date as string,
    notes: (data.notes as string) ?? null,
    createdBy: data.created_by as string,
    createdAt: data.created_at as string,
  }
}

export async function getFinancialOperations(dateStart?: string, dateEnd?: string): Promise<FinancialOperation[]> {
  let query = client().from('financial_operations').select(`
    id,operation_type,concept,operation_date,amount_usd,original_currency,original_amount,
    counterparty,reference_number,affects_profit,
    from_account:financial_accounts!financial_operations_from_account_id_fkey(name),
    to_account:financial_accounts!financial_operations_to_account_id_fkey(name)
  `).eq('status', 'confirmed')
  if (dateStart) query = query.gte('operation_date', dateStart)
  if (dateEnd) query = query.lte('operation_date', dateEnd)
  const { data, error } = await query.order('operation_date', { ascending: false }).limit(100)
  if (error) throw error
  const relationName = (value: unknown) => {
    const row = Array.isArray(value) ? value[0] : value
    return row && typeof row === 'object' && 'name' in row ? String(row.name) : null
  }
  return (data ?? []).map((row) => ({
    id: String(row.id), type: row.operation_type as FinancialOperation['type'], concept: String(row.concept),
    operationDate: String(row.operation_date), amountUsd: Number(row.amount_usd),
    originalCurrency: row.original_currency as 'USD' | 'VES', originalAmount: Number(row.original_amount),
    counterparty: row.counterparty ? String(row.counterparty) : null,
    referenceNumber: row.reference_number ? String(row.reference_number) : null,
    affectsProfit: Boolean(row.affects_profit), fromAccount: relationName(row.from_account), toAccount: relationName(row.to_account),
  }))
}

// --- Clientes y fidelización ------------------------------------------------

export async function getCustomers(): Promise<Customer[]> {
  const { data, error } = await client().from('customers')
    .select('id,full_name,identification,phone,address,email,total_visits,rewards_unlocked,last_visit,favorite_product,birth_date,created_at,is_active')
    .order('full_name')
  if (error) throw error
  return (data ?? []).map((row) => ({
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
}

// Órdenes reales de un cliente (para la ficha del cliente).
export async function getCustomerOrders(customerId: string, customerName: string): Promise<CustomerOrderSummary[]> {
  if (!customerName.trim()) return []
  const primary = await client()
    .from('v_orders_with_items')
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

// Totales reales por nombre de cliente para la tabla principal. Las órdenes
// todavía no tienen customer_id, por eso la agrupación conserva la clave textual.
export async function getCustomerPurchaseMetrics(): Promise<CustomerPurchaseMetric[]> {
  const { data, error } = await client()
    .from('v_orders_with_items')
    .select('customer_id,customer_name,total_amount,created_at')
    .order('created_at', { ascending: false })
    .limit(5000)
  if (error) throw error

  const grouped = new Map<string, CustomerPurchaseMetric>()
  for (const row of data ?? []) {
    const customerName = String(row.customer_name ?? '').trim()
    if (!customerName || customerName.toLocaleLowerCase('es-VE') === 'cliente general') continue
    const customerId = (row.customer_id as string) ?? null
    const key = customerId ? `id:${customerId}` : `name:${customerName.toLocaleLowerCase('es-VE')}`
    const current = grouped.get(key)
    if (current) {
      current.orderCount += 1
      current.totalPurchased += Number(row.total_amount ?? 0)
    } else {
      grouped.set(key, {
        customerId,
        customerName,
        orderCount: 1,
        totalPurchased: Number(row.total_amount ?? 0),
        lastPurchase: String(row.created_at ?? ''),
      })
    }
  }
  return [...grouped.values()]
}

export async function createCustomer(params: { name: string; identification?: string; phone?: string; address?: string; birthDate?: string }): Promise<Customer> {
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
    .select('id,template_type,phone,message,status,sent_at,created_at,customers(full_name)')
    .order('created_at', { ascending: false }).limit(200)
  if (error) throw error
  return (data ?? []).map((row) => ({
    id: row.id as string, templateType: row.template_type as string,
    customerName: ((row.customers as Array<{ full_name?: string }> | null)?.[0]?.full_name) ?? 'Cliente',
    phone: row.phone as string, message: row.message as string,
    sentAt: ((row.sent_at ?? row.created_at) as string), status: row.status as WhatsAppMessage['status'],
  }))
}

export async function queueWhatsAppMessage(params: { customerId: string; phone: string; message: string; userId: string }): Promise<void> {
  const { error } = await client().from('whatsapp_messages').insert({
    customer_id: params.customerId, phone: params.phone, message: params.message,
    template_type: 'custom', status: 'queued', created_by: params.userId,
  })
  if (error) throw error
}

export async function getLegacyPurchaseOrders(): Promise<LegacyPurchaseOrder[]> {
  const { data, error } = await client().from('legacy_purchase_orders')
    .select('id,po_code,supplier_text,po_date,creation_date,total,invoice_number,status')
    .order('po_date', { ascending: false }).limit(1000)
  if (error) throw error
  return (data ?? []).map(row => ({
    id: row.id as string, code: (row.po_code as string) ?? '', supplier: (row.supplier_text as string) ?? '',
    date: ((row.po_date ?? row.creation_date) as string) ?? '', total: Number(row.total ?? 0),
    invoiceNumber: (row.invoice_number as string) ?? '', status: (row.status as string) ?? '',
  }))
}

// --- Inventario --------------------------------------------------------------

export async function getIngredients(): Promise<Ingredient[]> {
  const { data, error } = await client()
    .from('v_current_stock')
    .select('*')
    .order('ingredient_name', { ascending: true })

  if (error) throw error

  return (data ?? []).map((i) => ({
    id: i.ingredient_id as string,
    name: i.ingredient_name as string,
    unitId: i.unit_id as string,
    unitName: i.unit_name as string,
    unitSymbol: i.unit_symbol as string,
    isActive: true,
    currentStock: Number(i.current_stock),
    pricePerUnit: i.price_per_unit ? Number(i.price_per_unit) : null,
    stockValue: i.stock_value ? Number(i.stock_value) : null,
  }))
}

export async function getStockMovements(): Promise<StockMovement[]> {
  const { data, error } = await client()
    .from('stock_movements')
    .select('*, ingredients(name), units(symbol)')
    .order('created_at', { ascending: false })
    .limit(100)

  if (error) throw error

  return (data ?? []).map((m) => ({
    id: m.id as string,
    ingredientId: m.ingredient_id as string,
    ingredientName: (m.ingredients as Record<string, unknown>)?.name as string ?? '-',
    quantity: Number(m.quantity),
    unitId: m.unit_id as string,
    unitSymbol: (m.units as Record<string, unknown>)?.symbol as string ?? '',
    movementType: m.movement_type as string,
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

export async function updateIngredient(id: string, updates: { name?: string; is_active?: boolean }): Promise<void> {
  const { error } = await client()
    .from('ingredients')
    .update(updates)
    .eq('id', id)
  if (error) throw error
}

// --- Producción --------------------------------------------------------------

export async function getSellableProducts(): Promise<SellableProduct[]> {
  const { data, error } = await client()
    .from('sellable_products')
    .select('id,name,description,price,cost,category,emoji,is_active,image_url,is_delivery')
    .eq('is_active', true)
    .order('name', { ascending: true })

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
  }))
}

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
      .select('id,sellable_product_id,ingredient_id,preparation_batch_id,quantity,unit_id,ingredients(name),units(symbol)')
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
      ingredientName: (ingr?.name as string) ?? null,
      quantity: Number(r.quantity),
      unitId: r.unit_id as string,
      unitSymbol: (unit?.symbol as string) ?? '',
      costPerUnit: ingredientId && costMap.has(ingredientId) ? costMap.get(ingredientId)! : null,
    }
  })
}

export async function getEmployees(): Promise<Employee[]> {
  const { data, error } = await client()
    .from('employees')
    .select('id,full_name,position,hourly_rate,weekly_salary,overtime_rate,is_active')
    .eq('is_active', true)
    .order('full_name', { ascending: true })

  if (error) throw error
  return (data ?? []).map((r) => ({
    id: r.id as string,
    fullName: r.full_name as string,
    position: (r.position as string) ?? null,
    hourlyRate: Number(r.hourly_rate),
    weeklySalary: Number(r.weekly_salary ?? 0),
    overtimeRate: Number(r.overtime_rate ?? 0),
    isActive: r.is_active as boolean,
  }))
}

export async function getAllEmployees(): Promise<Employee[]> {
  const { data, error } = await client()
    .from('employees')
    .select('id,full_name,position,hourly_rate,weekly_salary,overtime_rate,is_active')
    .order('is_active', { ascending: false })
    .order('full_name', { ascending: true })

  if (error) throw error
  return (data ?? []).map((r) => ({
    id: r.id as string,
    fullName: r.full_name as string,
    position: (r.position as string) ?? null,
    hourlyRate: Number(r.hourly_rate),
    weeklySalary: Number(r.weekly_salary ?? 0),
    overtimeRate: Number(r.overtime_rate ?? 0),
    isActive: r.is_active as boolean,
  }))
}

export async function createEmployee(params: {
  fullName: string
  position?: string | null
  hourlyRate?: number
}): Promise<Employee> {
  const { data, error } = await client()
    .from('employees')
    .insert({
      full_name: params.fullName,
      position: params.position ?? null,
      hourly_rate: params.hourlyRate ?? 0,
      is_active: true,
    })
    .select('id,full_name,position,hourly_rate,weekly_salary,overtime_rate,is_active')
    .single()
  if (error) throw error
  return {
    id: data.id as string,
    fullName: data.full_name as string,
    position: (data.position as string) ?? null,
    hourlyRate: Number(data.hourly_rate),
    weeklySalary: Number(data.weekly_salary ?? 0),
    overtimeRate: Number(data.overtime_rate ?? 0),
    isActive: data.is_active as boolean,
  }
}

export async function updateEmployee(id: string, updates: {
  fullName?: string
  position?: string | null
  hourlyRate?: number
  isActive?: boolean
}): Promise<void> {
  const patch: Record<string, unknown> = {}
  if (updates.fullName !== undefined) patch.full_name = updates.fullName
  if (updates.position !== undefined) patch.position = updates.position
  if (updates.hourlyRate !== undefined) patch.hourly_rate = updates.hourlyRate
  if (updates.isActive !== undefined) patch.is_active = updates.isActive
  const { error } = await client()
    .from('employees')
    .update(patch)
    .eq('id', id)
  if (error) throw error
}

export async function deleteEmployee(id: string): Promise<void> {
  const { error } = await client()
    .from('employees')
    .delete()
    .eq('id', id)
  if (error) throw error
}

// --- Usuarios de acceso (login) ---------------------------------------------
// Administración de auth.users vía RPC SECURITY DEFINER (owner-only). El
// navegador nunca ve la service_role; toda la validación vive en la BD.

export interface AuthUser {
  id: string
  email: string
  fullName: string
  role: 'owner' | 'manager' | 'cashier'
  isActive: boolean
  allowedModules: string[] | null
  createdAt: string
  lastSignInAt: string | null
}

export async function listAuthUsers(): Promise<AuthUser[]> {
  const { data, error } = await client().rpc('fn_admin_list_users')
  if (error) throw error
  return (data ?? []).map((r: Record<string, unknown>) => ({
    id: String(r.id),
    email: String(r.email),
    fullName: r.full_name ? String(r.full_name) : '',
    role: String(r.role) as AuthUser['role'],
    isActive: Boolean(r.is_active),
    allowedModules: Array.isArray(r.allowed_modules) ? (r.allowed_modules as string[]) : null,
    createdAt: String(r.created_at),
    lastSignInAt: r.last_sign_in_at ? String(r.last_sign_in_at) : null,
  }))
}

// p_modules null -> vuelve a los defaults del rol; array -> sólo esos módulos.
export async function adminSetUserModules(userId: string, modules: string[] | null): Promise<void> {
  const { error } = await client().rpc('fn_admin_set_modules', { p_user_id: userId, p_modules: modules })
  if (error) throw error
}

export async function adminSetUserPassword(userId: string, password: string): Promise<void> {
  const { error } = await client().rpc('fn_admin_set_password', { p_user_id: userId, p_password: password })
  if (error) throw error
}

export async function adminSetUserEmail(userId: string, email: string): Promise<void> {
  const { error } = await client().rpc('fn_admin_set_email', { p_user_id: userId, p_email: email })
  if (error) throw error
}

export async function adminSetUserRole(userId: string, role: AuthUser['role']): Promise<void> {
  const { error } = await client().rpc('fn_admin_set_role', { p_user_id: userId, p_role: role })
  if (error) throw error
}

export async function adminSetUserActive(userId: string, isActive: boolean): Promise<void> {
  const { error } = await client().rpc('fn_admin_set_active', { p_user_id: userId, p_active: isActive })
  if (error) throw error
}

const PIN_ERROR_MESSAGES: Record<string, string> = {
  not_authorized: 'No autorizado para cambiar el PIN.',
  pin_must_have_four_digits: 'El PIN debe tener exactamente 4 dígitos.',
  active_profile_not_found: 'El usuario no está activo o no existe.',
  pin_already_in_use: 'Ese PIN ya lo usa otro usuario. Elige otro.',
}

export async function adminSetUserPin(userId: string, pin: string): Promise<void> {
  const { error } = await client().rpc('fn_set_user_pin', { p_user_id: userId, p_pin: pin })
  if (error) {
    const key = (error.message || '').trim()
    throw new Error(PIN_ERROR_MESSAGES[key] ?? error.message)
  }
}

export async function adminCreateUser(params: {
  email: string
  password: string
  fullName: string
  role: AuthUser['role']
}): Promise<string> {
  const { data, error } = await client().rpc('fn_admin_create_user', {
    p_email: params.email,
    p_password: params.password,
    p_full_name: params.fullName,
    p_role: params.role,
  })
  if (error) throw error
  return String(data)
}

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

export async function getProductionStats(): Promise<ProductionStats> {
  // Fechas en horario de Venezuela (UTC-4), no en UTC.
  const today = dateKeyInTimeZone()
  const yesterday = dateKeyInTimeZone(new Date(Date.now() - 86400000))

  const [todayBatches, yesterdayBatches] = await Promise.all([
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

export async function getPayrollPeriods(): Promise<PayrollPeriod[]> {
  const { data, error } = await client()
    .from('payroll_periods')
    .select('id,start_date,end_date,status,notes,created_at')
    .order('start_date', { ascending: false })
  if (error) throw error
  return (data ?? []).map((r) => ({
    id: r.id as string,
    startDate: r.start_date as string,
    endDate: r.end_date as string,
    status: r.status as PayrollPeriod['status'],
    notes: (r.notes as string) ?? null,
    createdAt: r.created_at as string,
  }))
}

export async function createPayrollPeriod(params: {
  startDate: string
  endDate: string
  notes?: string | null
}): Promise<string> {
  const { data, error } = await client()
    .from('payroll_periods')
    .insert({ start_date: params.startDate, end_date: params.endDate, notes: params.notes ?? null })
    .select('id')
    .single()
  if (error) throw error
  return data.id as string
}

export async function updatePayrollPeriodStatus(id: string, status: PayrollPeriod['status']): Promise<void> {
  const { error } = await client()
    .from('payroll_periods')
    .update({ status })
    .eq('id', id)
  if (error) throw error
}

export async function getPayrollEntries(periodId: string): Promise<PayrollEntry[]> {
  const { data, error } = await client()
    .from('payroll_entries')
    .select('id,payroll_period_id,employee_id,hours_worked,base_salary,deductions,net_pay,notes,weekly_salary,bonus_amount,overtime_hours,overtime_amount,transport_amount,absence_days,absence_deduction,advance_deduction,employees(full_name,position)')
    .eq('payroll_period_id', periodId)
    .order('created_at', { ascending: true })
  if (error) throw error
  return (data ?? []).map((r) => ({
    id: r.id as string,
    payrollPeriodId: r.payroll_period_id as string,
    employeeId: r.employee_id as string,
    employeeName: Array.isArray(r.employees) ? (r.employees[0] as Record<string, unknown>)?.full_name as string ?? '' : '',
    position: Array.isArray(r.employees) ? (r.employees[0] as Record<string, unknown>)?.position as string ?? null : null,
    hoursWorked: Number(r.hours_worked),
    baseSalary: Number(r.base_salary),
    deductions: Number(r.deductions),
    netPay: Number(r.net_pay),
    notes: (r.notes as string) ?? null,
    weeklySalary: Number(r.weekly_salary ?? 0), bonusAmount: Number(r.bonus_amount ?? 0),
    overtimeHours: Number(r.overtime_hours ?? 0), overtimeAmount: Number(r.overtime_amount ?? 0),
    transportAmount: Number(r.transport_amount ?? 0), absenceDays: Number(r.absence_days ?? 0),
    absenceDeduction: Number(r.absence_deduction ?? 0), advanceDeduction: Number(r.advance_deduction ?? 0),
  }))
}

export async function upsertPayrollEntry(params: {
  payrollPeriodId: string
  employeeId: string
  hoursWorked: number
  baseSalary: number
  deductions: number
  weeklySalary?: number
  bonusAmount?: number
  overtimeHours?: number
  overtimeAmount?: number
  transportAmount?: number
  absenceDays?: number
  absenceDeduction?: number
  advanceDeduction?: number
  notes?: string | null
}): Promise<void> {
  const { error } = await client()
    .from('payroll_entries')
    .upsert({
      payroll_period_id: params.payrollPeriodId,
      employee_id: params.employeeId,
      hours_worked: params.hoursWorked,
      base_salary: params.baseSalary,
      deductions: params.deductions,
      weekly_salary: params.weeklySalary ?? params.baseSalary,
      bonus_amount: params.bonusAmount ?? 0,
      overtime_hours: params.overtimeHours ?? 0,
      overtime_amount: params.overtimeAmount ?? 0,
      transport_amount: params.transportAmount ?? 0,
      absence_days: params.absenceDays ?? 0,
      absence_deduction: params.absenceDeduction ?? 0,
      advance_deduction: params.advanceDeduction ?? 0,
      notes: params.notes ?? null,
    }, { onConflict: 'payroll_period_id,employee_id' })
  if (error) throw error
}

export async function deleteCredit(creditId: string): Promise<void> {
  const { error } = await client()
    .from('credits')
    .delete()
    .eq('id', creditId)
  if (error) throw error
}

export async function getPayrollPayments(): Promise<PayrollPayment[]> {
  const { data, error } = await client().from('payroll_payments')
    .select('id,employee_id,amount,currency,exchange_rate,payment_account,payment_date,reference,notes,employees(full_name)')
    .order('payment_date', { ascending: false }).order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []).map((r) => ({
    id: r.id as string, employeeId: r.employee_id as string,
    employeeName: Array.isArray(r.employees) ? String((r.employees[0] as Record<string, unknown>)?.full_name ?? '') : '',
    amount: Number(r.amount), currency: r.currency as 'USD' | 'Bs',
    exchangeRate: r.exchange_rate == null ? null : Number(r.exchange_rate),
    paymentAccount: (r.payment_account as string) ?? null, paymentDate: r.payment_date as string,
    reference: (r.reference as string) ?? null, notes: (r.notes as string) ?? null,
  }))
}

export async function createPayrollPayment(params: {
  employeeId: string; amount: number; currency?: 'USD' | 'Bs'; exchangeRate?: number | null
  paymentAccount?: string | null; paymentDate?: string; reference?: string | null; notes?: string | null
}): Promise<void> {
  const { error } = await client().from('payroll_payments').insert({
    employee_id: params.employeeId, amount: params.amount, currency: params.currency ?? 'USD',
    exchange_rate: params.exchangeRate ?? null, payment_account: params.paymentAccount ?? null,
    payment_date: params.paymentDate ?? dateKeyInTimeZone(), reference: params.reference ?? null,
    notes: params.notes ?? null,
  })
  if (error) throw error
}

export async function getAdvances(dateStart?: string, dateEnd?: string): Promise<Advance[]> {
  let query = client()
    .from('advances')
    .select('id,employee_id,amount,advance_date,is_deducted,notes,created_at,employees(full_name)')
    .order('advance_date', { ascending: false })
  if (dateStart) query = query.gte('advance_date', dateStart)
  if (dateEnd) query = query.lte('advance_date', dateEnd)
  const { data, error } = await query
  if (error) throw error
  return (data ?? []).map((r) => ({
    id: r.id as string,
    employeeId: r.employee_id as string,
    employeeName: Array.isArray(r.employees) ? (r.employees[0] as Record<string, unknown>)?.full_name as string ?? '' : '',
    amount: Number(r.amount),
    advanceDate: r.advance_date as string,
    isDeducted: r.is_deducted as boolean,
    notes: (r.notes as string) ?? null,
    createdAt: r.created_at as string,
  }))
}

export async function createAdvance(params: {
  employeeId: string
  amount: number
  advanceDate?: string
  notes?: string | null
}): Promise<void> {
  const { error } = await client().from('advances').insert({
    employee_id: params.employeeId,
    amount: params.amount,
    advance_date: params.advanceDate ?? dateKeyInTimeZone(),
    notes: params.notes ?? null,
  })
  if (error) throw error
}

export async function setAdvanceDeducted(id: string, deducted: boolean): Promise<void> {
  const { error } = await client()
    .from('advances')
    .update({ is_deducted: deducted })
    .eq('id', id)
  if (error) throw error
}

export async function createProductionBonus(params: {
  employeeId: string
  amount: number
  bonusDate?: string
  reason?: string | null
}): Promise<void> {
  const { error } = await client().from('production_bonuses').insert({
    employee_id: params.employeeId,
    amount: params.amount,
    bonus_date: params.bonusDate ?? dateKeyInTimeZone(),
    reason: params.reason ?? null,
  })
  if (error) throw error
}

export interface ProductionBonusRecord {
  id: string
  employeeId: string
  employeeName: string
  amount: number
  bonusDate: string
  reason: string | null
  createdAt: string
}

/**
 * Resumen de nómina para Finanzas: net_pay por período (con su fecha de cierre)
 * y bonos de producción por fecha. Permite sumar la nómina de cualquier rango
 * en el cliente sin múltiples viajes por período.
 */
export async function getPayrollSummary(): Promise<{
  periods: Array<{ endDate: string; total: number }>
  bonuses: Array<{ date: string; amount: number }>
}> {
  const periods = await getPayrollPeriods()
  const periodTotals: Array<{ endDate: string; total: number }> = []
  for (const p of periods) {
    const entries = await getPayrollEntries(p.id)
    periodTotals.push({ endDate: p.endDate, total: entries.reduce((s, e) => s + e.netPay, 0) })
  }
  const bonuses = (await getProductionBonusRecords()).map((b) => ({ date: b.bonusDate, amount: b.amount }))
  return { periods: periodTotals, bonuses }
}

export async function getProductionBonusRecords(): Promise<ProductionBonusRecord[]> {
  const { data, error } = await client()
    .from('production_bonuses')
    .select('id,employee_id,amount,bonus_date,reason,created_at,employees(full_name)')
    .order('bonus_date', { ascending: false })
  if (error) throw error
  return (data ?? []).map((r) => ({
    id: r.id as string,
    employeeId: r.employee_id as string,
    employeeName: Array.isArray(r.employees) ? (r.employees[0] as Record<string, unknown>)?.full_name as string ?? '' : '',
    amount: Number(r.amount),
    bonusDate: r.bonus_date as string,
    reason: (r.reason as string) ?? null,
    createdAt: r.created_at as string,
  }))
}

// --- Recetas ------------------------------------------------------------------

export async function createRecipeComponent(params: {
  sellableProductId: string
  ingredientId?: string
  preparationBatchId?: string
  quantity: number
  unitId: string
}): Promise<string> {
  const { data, error } = await client()
    .from('recipe_components')
    .insert({
      sellable_product_id: params.sellableProductId,
      ingredient_id: params.ingredientId ?? null,
      preparation_batch_id: params.preparationBatchId ?? null,
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

// --- Auditoría ----------------------------------------------------------------

export async function getAuditLogs(limit = 200): Promise<AuditLog[]> {
  const { data, error } = await client()
    .from('audit_logs')
    .select('id,occurred_at,actor_name,module,action,details,severity')
    .order('occurred_at', { ascending: false })
    .limit(limit)
  if (error) throw error
  return (data ?? []).map((r) => ({
    id: r.id as string,
    occurredAt: r.occurred_at as string,
    actorName: r.actor_name as string,
    module: r.module as string,
    action: r.action as string,
    details: (r.details as string) ?? null,
    severity: r.severity as AuditLog['severity'],
  }))
}

// --- Helpers -----------------------------------------------------------------

// --- Proveedores -------------------------------------------------------------

export async function getSuppliers(): Promise<Supplier[]> {
  const { data, error } = await client()
    .from('suppliers')
    .select('id,name,contact,phone,email,notes,is_active')
    .eq('is_active', true)
    .order('name', { ascending: true })

  if (error) throw error
  return (data ?? []).map((s) => ({
    id: s.id as string,
    name: s.name as string,
    contact: (s.contact as string) ?? null,
    phone: (s.phone as string) ?? null,
    email: (s.email as string) ?? null,
    notes: (s.notes as string) ?? null,
    isActive: s.is_active as boolean,
  }))
}

export async function createSupplier(params: {
  name: string
  contact?: string
  phone?: string
  email?: string
  notes?: string
}): Promise<string> {
  const { data, error } = await client()
    .from('suppliers')
    .insert({
      name: params.name,
      contact: params.contact ?? null,
      phone: params.phone ?? null,
      email: params.email ?? null,
      notes: params.notes ?? null,
    })
    .select('id')
    .single()
  if (error) throw error
  return data.id as string
}

// --- Compras ------------------------------------------------------------------

export async function getPurchases(): Promise<Purchase[]> {
  const { data, error } = await client()
    .from('purchases')
    .select(`
      id, supplier_id, purchase_date, invoice_number, notes, created_by, created_at, is_paid,
      suppliers(name),
      purchase_items(id, purchase_id, ingredient_id, quantity, unit_id, unit_cost, ingredients(name), units(symbol))
    `)
    .order('purchase_date', { ascending: false })

  if (error) throw error

  return (data ?? []).map((p) => {
    const items = ((p.purchase_items as Array<Record<string, unknown>>) ?? []).map((pi) => ({
      id: pi.id as string,
      purchaseId: pi.purchase_id as string,
      ingredientId: pi.ingredient_id as string,
      ingredientName: ((pi.ingredients as unknown as Record<string, unknown>)?.name as string) ?? '',
      quantity: Number(pi.quantity),
      unitId: pi.unit_id as string,
      unitSymbol: ((pi.units as unknown as Record<string, unknown>)?.symbol as string) ?? '',
      unitCost: Number(pi.unit_cost),
      total: Number(pi.quantity) * Number(pi.unit_cost),
    }))
    return {
      id: p.id as string,
      supplierId: p.supplier_id as string,
      supplierName: ((p.suppliers as unknown as Record<string, unknown>)?.name as string) ?? '',
      purchaseDate: p.purchase_date as string,
      invoiceNumber: (p.invoice_number as string) ?? null,
      notes: (p.notes as string) ?? null,
      createdBy: p.created_by as string,
      createdAt: p.created_at as string,
      items,
      totalAmount: items.reduce((sum, i) => sum + i.total, 0),
      isPaid: p.is_paid !== false,
    }
  })
}

export async function setPurchasePaid(id: string, isPaid: boolean): Promise<void> {
  const { error } = await client().from('purchases').update({ is_paid: isPaid }).eq('id', id)
  if (error) throw error
}

export async function createPurchase(params: {
  supplierId: string
  purchaseDate: string
  invoiceNumber?: string
  notes?: string
  userId: string
  isPaid?: boolean
  items: Array<{
    ingredientId: string
    quantity: number
    unitId: string
    unitCost: number
  }>
}): Promise<string> {
  const sb = client()

  const { data: purchase, error: purchaseErr } = await sb
    .from('purchases')
    .insert({
      supplier_id: params.supplierId,
      purchase_date: params.purchaseDate,
      invoice_number: params.invoiceNumber ?? null,
      notes: params.notes ?? null,
      is_paid: params.isPaid ?? true,
      created_by: params.userId,
    })
    .select('id')
    .single()
  if (purchaseErr) throw purchaseErr

  if (params.items.length > 0) {
    const { error: itemsErr } = await sb.from('purchase_items').insert(
      params.items.map((item) => ({
        purchase_id: purchase.id,
        ingredient_id: item.ingredientId,
        quantity: item.quantity,
        unit_id: item.unitId,
        unit_cost: item.unitCost,
      })),
    )
    if (itemsErr) throw itemsErr
  }

  return purchase.id as string
}

export async function getOrderById(orderId: string): Promise<FullOrder | null> {
  const { data, error } = await client()
    .from('v_orders_with_items')
    .select('*')
    .eq('id', orderId)
    .single()

  if (error) return null
  if (!data) return null

  return {
    id: data.id as string,
    orderNumber: data.order_number as number,
    status: data.status as string,
    fulfillmentStatus: (data.fulfillment_status as FullOrder['fulfillmentStatus']) ?? 'new',
    notes: (data.notes as string) ?? null,
    orderType: (data.order_type as string) ?? 'takeaway',
    tableNumber: data.table_number == null ? null : Number(data.table_number),
    customerName: (data.customer_name as string) ?? 'Cliente',
    bcvRate: data.bcv_rate ? Number(data.bcv_rate) : null,
    createdBy: data.created_by as string,
    createdAt: data.created_at as string,
    updatedAt: data.updated_at as string,
    items: Array.isArray(data.items) ? data.items.map((i: Record<string, unknown>) => ({
      id: i.id as string,
      sellableProductId: i.sellable_product_id as string,
      productName: i.product_name as string,
      emoji: (i.emoji as string) ?? '🍽️', /* DB default: emoji */
      category: (i.category as string) ?? 'plato',
      quantity: Number(i.quantity),
      unitPrice: Number(i.unit_price),
    })) : [],
    payments: Array.isArray(data.payments) ? data.payments.map((p: Record<string, unknown>) => ({
      id: p.id as string,
      method: p.method as PaymentMethod,
      amount: Number(p.amount),
      referenceNumber: (p.reference_number as string) ?? null,
      receivedAmount: p.received_amount == null ? null : Number(p.received_amount),
      notes: (p.notes as string) ?? null,
      createdAt: p.created_at as string,
    })) : [],
    totalAmount: Number(data.total_amount),
  }
}
