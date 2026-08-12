import { supabase, isDemoMode } from './supabase'

const DEMO_ORDERS_KEY = 'fullchinavzla_demo_orders'
const DEMO_CASH_SESSIONS_KEY = 'fullchinavzla_demo_cash_sessions'

function getLocalDemoOrders(): FullOrder[] {
  try {
    const raw = localStorage.getItem(DEMO_ORDERS_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function saveLocalDemoOrder(order: FullOrder): void {
  try {
    const existing = getLocalDemoOrders()
    localStorage.setItem(DEMO_ORDERS_KEY, JSON.stringify([order, ...existing]))
  } catch (e) {
    console.error('Error guardando orden demo:', e)
  }
}

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
  emoji?: string
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
  customerName: string
  totalAmount: number
  totalPaid: number
  balancePending: number
  status: string
  orderId: string
  createdAt: string
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
  emoji: string
  isActive: boolean
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
  isActive: boolean
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

export async function getProducts(): Promise<Product[]> {
  if (!supabase) throw new Error('Supabase no está configurado')
  try {
    const { data, error } = await supabase
      .from('sellable_products')
      .select('id,name,description,price,cost,category,emoji,is_active')
      .order('category', { ascending: true })
      .order('name', { ascending: true })

    if (error) throw error
    return data.map((r) => ({
      id: r.id as string,
      name: r.name as string,
      description: (r.description as string) ?? null,
      price: Number(r.price),
      cost: r.cost === null ? null : Number(r.cost),
      category: r.category as string,
      emoji: r.emoji as string,
      active: Boolean(r.is_active),
    }))
  } catch (err) {
    console.error('Error cargando productos de Supabase:', err)
    throw err
  }
}

// --- Cobro (checkout) --------------------------------------------------------

export async function checkout(params: {
  items: CartItem[]
  method: PaymentMethod
  bcvRate: number | null
  userId: string
  notes?: string | null
  orderType?: string
  customerName?: string
  referenceNumber?: string | null
  receivedAmount?: number | null
  payments?: OrderPaymentComponent[]
}): Promise<OrderResult> {
  const total = params.items.reduce((sum, i) => sum + i.price * i.quantity, 0)
  const now = new Date().toISOString()
  const orderNumber = Math.floor(1000 + Math.random() * 9000)

  if (isDemoMode || !supabase) {
    const demoId = `demo-${Date.now()}`
    const fullOrder: FullOrder = {
      id: demoId,
      orderNumber,
      status: 'paid',
      fulfillmentStatus: 'new',
      notes: params.notes ?? null,
      orderType: params.orderType ?? 'takeaway',
      customerName: params.customerName ?? 'Cliente',
      bcvRate: params.bcvRate,
      createdBy: params.userId,
      createdAt: now,
      updatedAt: now,
      items: params.items.map((i, idx) => ({
        id: `item-${demoId}-${idx}`,
        sellableProductId: i.productId,
        productName: i.productName,
        emoji: i.emoji || '🍽️',
        category: 'Plato',
        quantity: i.quantity,
        unitPrice: i.price,
      })),
      payments: (params.payments ?? [{
        method: params.method,
        amount: total,
        referenceNumber: params.referenceNumber,
        receivedAmount: params.receivedAmount,
        notes: params.notes,
      }]).map((payment, idx) => ({
        ...payment,
        id: `payment-${demoId}-${idx}`,
        createdAt: now,
      })),
      totalAmount: total,
    }
    saveLocalDemoOrder(fullOrder)
    return {
      id: demoId,
      orderNumber,
      status: 'paid',
      total,
      bcvRate: params.bcvRate,
      createdAt: now,
      paymentMethod: params.method,
      items: params.items,
    }
  }

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
    })),
    p_payments: paymentComponents,
    p_bcv_rate: params.bcvRate,
    p_notes: params.notes ?? null,
    p_order_type: params.orderType ?? 'takeaway',
    p_customer_name: params.customerName ?? 'Cliente',
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

export async function sendToKitchen(params: {
  items: CartItem[]
  bcvRate: number | null
  userId: string
  notes?: string | null
  orderType?: string
  customerName?: string
}): Promise<OrderResult> {
  const total = params.items.reduce((sum, i) => sum + i.price * i.quantity, 0)
  const now = new Date().toISOString()
  const orderNumber = Math.floor(1000 + Math.random() * 9000)

  if (isDemoMode || !supabase) {
    const demoId = `demo-${Date.now()}`
    const fullOrder: FullOrder = {
      id: demoId,
      orderNumber,
      status: 'open',
      fulfillmentStatus: 'new',
      notes: params.notes ?? null,
      orderType: params.orderType ?? 'takeaway',
      customerName: params.customerName ?? 'Cliente',
      bcvRate: params.bcvRate,
      createdBy: params.userId,
      createdAt: now,
      updatedAt: now,
      items: params.items.map((i, idx) => ({
        id: `item-${demoId}-${idx}`,
        sellableProductId: i.productId,
        productName: i.productName,
        emoji: i.emoji || '🍽️',
        category: 'Plato',
        quantity: i.quantity,
        unitPrice: i.price,
      })),
      payments: [],
      totalAmount: total,
    }
    saveLocalDemoOrder(fullOrder)
    return {
      id: demoId,
      orderNumber,
      status: 'open',
      total,
      bcvRate: params.bcvRate,
      createdAt: now,
      paymentMethod: 'cash',
      items: params.items,
    }
  }

  const sb = client()

  const { data: order, error: orderErr } = await sb
    .from('orders')
    .insert({
      created_by: params.userId,
      bcv_rate: params.bcvRate,
      notes: params.notes ?? null,
      order_type: params.orderType ?? 'takeaway',
      customer_name: params.customerName ?? 'Cliente',
      status: 'open',
    })
    .select('id, order_number, created_at')
    .single()
  if (orderErr) throw orderErr

  const { error: itemsErr } = await sb.from('order_items').insert(
    params.items.map((i) => ({
      order_id: order.id,
      sellable_product_id: i.productId,
      quantity: i.quantity,
      unit_price: i.price,
    })),
  )
  if (itemsErr) throw itemsErr

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

// --- Órdenes completas (para Comandas/Cocina) --------------------------------

export async function getOrdersWithItems(dateStart?: string, dateEnd?: string): Promise<FullOrder[]> {
  const localOrders = getLocalDemoOrders()

  if (isDemoMode || !supabase) {
    return localOrders
  }

  try {
    let query = client().from('v_orders_with_items').select('*')
    if (dateStart) query = query.gte('created_at', dateStart)
    if (dateEnd) query = query.lte('created_at', dateEnd)
    query = query.order('created_at', { ascending: false })

    const { data, error } = await query
    if (error) throw error

    const dbOrders: FullOrder[] = (data ?? []).map((o) => ({
      id: o.id as string,
      orderNumber: o.order_number as number,
      status: o.status as string,
      fulfillmentStatus: (o.fulfillment_status as FullOrder['fulfillmentStatus']) ?? 'new',
      notes: (o.notes as string) ?? null,
      orderType: (o.order_type as string) ?? 'takeaway',
      customerName: (o.customer_name as string) ?? 'Cliente',
      bcvRate: o.bcv_rate ? Number(o.bcv_rate) : null,
      createdBy: o.created_by as string,
      createdAt: o.created_at as string,
      updatedAt: o.updated_at as string,
      items: Array.isArray(o.items) ? o.items.map((i: Record<string, unknown>) => ({
        id: i.id as string,
        sellableProductId: i.sellable_product_id as string,
        productName: i.product_name as string,
        emoji: (i.emoji as string) ?? '🍽️',
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

    return [...localOrders, ...dbOrders]
  } catch (e) {
    console.warn('Fallo Supabase al obtener órdenes, usando locales:', e)
    return localOrders
  }
}

// --- Actualizar estado de orden (para Cocina) --------------------------------

export async function updateOrderStatus(orderId: string, newStatus: string): Promise<void> {
  if (isDemoMode || !supabase) {
    const localOrders = getLocalDemoOrders()
    const updated = localOrders.map(o => o.id === orderId ? { ...o, fulfillmentStatus: newStatus as FullOrder['fulfillmentStatus'] } : o)
    localStorage.setItem(DEMO_ORDERS_KEY, JSON.stringify(updated))
    return
  }

  try {
    const { error } = await supabase
      .from('orders')
      .update({ fulfillment_status: newStatus })
      .eq('id', orderId)

    if (error) {
      console.warn('Fallo Supabase al actualizar estado de orden, guardando en local:', error)
      const localOrders = getLocalDemoOrders()
      const updated = localOrders.map(o => o.id === orderId ? { ...o, fulfillmentStatus: newStatus as FullOrder['fulfillmentStatus'] } : o)
      localStorage.setItem(DEMO_ORDERS_KEY, JSON.stringify(updated))
    }
  } catch (e) {
    console.warn('Excepción actualizando estado de orden:', e)
    const localOrders = getLocalDemoOrders()
    const updated = localOrders.map(o => o.id === orderId ? { ...o, fulfillmentStatus: newStatus as FullOrder['fulfillmentStatus'] } : o)
    localStorage.setItem(DEMO_ORDERS_KEY, JSON.stringify(updated))
  }
}

export async function recordOrderPayments(params: {
  orderId: string
  payments: OrderPaymentComponent[]
  notes?: string | null
}): Promise<void> {
  if (params.payments.length === 0) throw new Error('Debe registrar al menos un pago')

  if (isDemoMode || !supabase) {
    const now = new Date().toISOString()
    const localOrders = getLocalDemoOrders()
    const updated = localOrders.map((order) => order.id === params.orderId
      ? {
          ...order,
          status: 'paid',
          updatedAt: now,
          payments: params.payments.map((payment, idx) => ({
            ...payment,
            id: `payment-${params.orderId}-${Date.now()}-${idx}`,
            createdAt: now,
          })),
        }
      : order)
    localStorage.setItem(DEMO_ORDERS_KEY, JSON.stringify(updated))
    return
  }

  const { error } = await supabase.rpc('fn_record_order_payments', {
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
  email: string
  totalVisits: number
  rewardsUnlocked: number
  lastVisit: string
  favoriteProduct: string
  birthday: string
  isActive: boolean
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
    customerName: c.customer_name as string,
    totalAmount: Number(c.total_amount),
    totalPaid: Number(c.total_paid),
    balancePending: Number(c.balance_pending),
    status: c.status as string,
    orderId: c.order_id as string,
    createdAt: c.created_at as string,
  }))
}

export async function createCredit(params: {
  orderId: string
  customerName: string
  totalAmount: number
  notes?: string
  userId: string
}): Promise<string> {
  const { data, error } = await client()
    .from('credits')
    .insert({
      order_id: params.orderId,
      customer_name: params.customerName,
      total_amount: params.totalAmount,
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
    emoji: (r.emoji as string) ?? '🍽️',
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

function getDemoCashSessions(): CashSessionSnapshot[] {
  try {
    return JSON.parse(localStorage.getItem(DEMO_CASH_SESSIONS_KEY) || '[]')
  } catch {
    return []
  }
}

function saveDemoCashSessions(sessions: CashSessionSnapshot[]): void {
  localStorage.setItem(DEMO_CASH_SESSIONS_KEY, JSON.stringify(sessions))
}

function refreshDemoCashSnapshot(session: CashSessionSnapshot): CashSessionSnapshot {
  const cashSalesUsd = getLocalDemoOrders()
    .filter(order => order.status === 'paid' && order.createdAt >= session.openedAt)
    .flatMap(order => order.payments)
    .filter(payment => payment.method === 'cash')
    .reduce((sum, payment) => sum + Number(payment.amount), 0)
  const totals = session.movements.reduce((result, movement) => {
    const key = `${movement.direction}${movement.currency}` as 'inUSD' | 'outUSD' | 'inVES' | 'outVES'
    result[key] += movement.amount
    return result
  }, { inUSD: 0, outUSD: 0, inVES: 0, outVES: 0 })
  return {
    ...session,
    cashSalesUsd,
    paymentTotal: cashSalesUsd,
    paymentBreakdown: { cash: cashSalesUsd },
    movementInUsd: totals.inUSD,
    movementOutUsd: totals.outUSD,
    movementInVes: totals.inVES,
    movementOutVes: totals.outVES,
    expectedCashUsd: session.openingCashUsd + cashSalesUsd + totals.inUSD - totals.outUSD,
    expectedCashVes: session.openingCashVes + totals.inVES - totals.outVES,
  }
}

export async function getActiveCashSession(): Promise<CashSessionSnapshot | null> {
  if (isDemoMode || !supabase) {
    const session = getDemoCashSessions().find(item => item.status === 'open')
    return session ? refreshDemoCashSnapshot(session) : null
  }
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
  if (isDemoMode || !supabase) {
    const sessions = getDemoCashSessions()
    if (sessions.some(item => item.status === 'open')) throw new Error('Esta caja ya tiene un turno abierto')
    const now = new Date().toISOString()
    const id = `cash-session-${Date.now()}`
    sessions.unshift({
      id, sessionNumber: sessions.length + 1, registerId: 'demo-register', registerCode: 'caja-principal',
      registerName: 'Caja principal', status: 'open', openedAt: now, openedBy: params.userId,
      openingCashUsd: params.openingCashUsd, openingCashVes: params.openingCashVes,
      cashSalesUsd: 0, paymentTotal: 0, paymentBreakdown: {}, movementInUsd: 0, movementOutUsd: 0,
      movementInVes: 0, movementOutVes: 0, expectedCashUsd: params.openingCashUsd,
      expectedCashVes: params.openingCashVes, countedCashUsd: null, countedCashVes: null,
      differenceUsd: null, differenceVes: null, closedAt: null, movements: [],
    })
    saveDemoCashSessions(sessions)
    return id
  }
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
  if (isDemoMode || !supabase) {
    const sessions = getDemoCashSessions()
    const index = sessions.findIndex(item => item.id === params.sessionId && item.status === 'open')
    if (index < 0) throw new Error('La sesión de caja no está abierta')
    const id = `cash-movement-${Date.now()}`
    sessions[index].movements.unshift({
      id, direction: params.direction, movementType: params.movementType, currency: params.currency,
      amount: params.amount, description: params.description, referenceNumber: params.referenceNumber ?? null,
      createdAt: new Date().toISOString(),
    })
    saveDemoCashSessions(sessions)
    return id
  }
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
  if (isDemoMode || !supabase) {
    const sessions = getDemoCashSessions()
    const index = sessions.findIndex(item => item.id === params.sessionId && item.status === 'open')
    if (index < 0) throw new Error('La sesión de caja no está abierta')
    const snapshot = refreshDemoCashSnapshot(sessions[index])
    sessions[index] = {
      ...snapshot, status: 'closed', closedAt: new Date().toISOString(),
      countedCashUsd: params.countedCashUsd, countedCashVes: params.countedCashVes,
      differenceUsd: params.countedCashUsd - snapshot.expectedCashUsd,
      differenceVes: params.countedCashVes - snapshot.expectedCashVes,
    }
    saveDemoCashSessions(sessions)
    return sessions[index]
  }
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
  if (isDemoMode || !supabase) {
    return getDemoCashSessions().filter(item => item.status === 'closed').map(refreshDemoCashSnapshot).slice(0, limit)
  }
  const { data, error } = await client().rpc('fn_get_cash_session_history', { p_limit: limit })
  if (error) throw error
  return (data ?? []).map((item: Record<string, unknown>) => mapCashSession(item))
}

export async function createDailyClose(date: string, notes?: string): Promise<string> {
  if (isDemoMode || !supabase) return `demo-close-${date}`
  const { data, error } = await client().rpc('fn_create_daily_close', {
    p_close_date: date,
    p_notes: notes ?? null,
  })
  if (error) throw error
  return data as string
}

export async function getDailyCloses(): Promise<DailyCloseSummary[]> {
  if (isDemoMode || !supabase) return []
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

// --- Clientes y fidelización ------------------------------------------------

export async function getCustomers(): Promise<Customer[]> {
  const { data, error } = await client().from('customers')
    .select('id,full_name,identification,phone,email,total_visits,rewards_unlocked,last_visit,favorite_product,birth_date,is_active')
    .order('full_name')
  if (error) throw error
  return (data ?? []).map((row) => ({
    id: row.id as string,
    name: row.full_name as string,
    identification: (row.identification as string) ?? '',
    phone: (row.phone as string) ?? '',
    email: (row.email as string) ?? '',
    totalVisits: Number(row.total_visits ?? 0),
    rewardsUnlocked: Number(row.rewards_unlocked ?? 0),
    lastVisit: (row.last_visit as string) ?? '',
    favoriteProduct: (row.favorite_product as string) ?? '',
    birthday: (row.birth_date as string) ?? '',
    isActive: Boolean(row.is_active),
  }))
}

export async function createCustomer(params: { name: string; phone?: string; birthDate?: string }): Promise<Customer> {
  const { data, error } = await client().from('customers').insert({
    full_name: params.name, phone: params.phone || null, birth_date: params.birthDate || null,
    source_system: 'fullchina', source_key: `app:${crypto.randomUUID()}`, is_active: true,
  }).select('*').single()
  if (error) throw error
  return {
    id: data.id as string, name: data.full_name as string, identification: (data.identification as string) ?? '', phone: (data.phone as string) ?? '',
    email: (data.email as string) ?? '', totalVisits: Number(data.total_visits ?? 0),
    rewardsUnlocked: Number(data.rewards_unlocked ?? 0), lastVisit: (data.last_visit as string) ?? '',
    favoriteProduct: (data.favorite_product as string) ?? '', birthday: (data.birth_date as string) ?? '',
    isActive: Boolean(data.is_active),
  }
}

export async function registerCustomerVisit(customerId: string): Promise<Customer> {
  const { data, error } = await client().rpc('fn_register_customer_visit', { p_customer_id: customerId })
  if (error) throw error
  const row = data as Record<string, unknown>
  return {
    id: row.id as string, name: row.full_name as string, identification: (row.identification as string) ?? '',
    phone: (row.phone as string) ?? '', email: (row.email as string) ?? '',
    totalVisits: Number(row.total_visits ?? 0), rewardsUnlocked: Number(row.rewards_unlocked ?? 0),
    lastVisit: (row.last_visit as string) ?? '', favoriteProduct: (row.favorite_product as string) ?? '',
    birthday: (row.birth_date as string) ?? '', isActive: Boolean(row.is_active),
  }
}

// --- Menú semanal -----------------------------------------------------------

export async function getWeeklyDishes(): Promise<WeeklyDish[]> {
  const { data, error } = await client().from('weekly_menu_items').select('*').order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []).map((row) => ({
    id: row.id as string, name: row.name as string, description: (row.description as string) ?? '',
    price: Number(row.price), cost: Number(row.cost ?? 0), emoji: row.emoji as string,
    status: row.is_active ? 'active' : 'inactive', weekTag: (row.week_tag as string) ?? '',
  }))
}

export async function createWeeklyDish(dish: Omit<WeeklyDish, 'id' | 'status'>, userId: string): Promise<WeeklyDish> {
  const { data, error } = await client().from('weekly_menu_items').insert({
    name: dish.name, description: dish.description, price: dish.price, cost: dish.cost,
    emoji: dish.emoji, week_tag: dish.weekTag, is_active: true, created_by: userId,
  }).select('*').single()
  if (error) throw error
  return { id: data.id as string, name: data.name as string, description: (data.description as string) ?? '',
    price: Number(data.price), cost: Number(data.cost ?? 0), emoji: data.emoji as string,
    status: data.is_active ? 'active' : 'inactive', weekTag: (data.week_tag as string) ?? '' }
}

export async function setWeeklyDishActive(id: string, active: boolean): Promise<void> {
  const { error } = await client().from('weekly_menu_items').update({ is_active: active }).eq('id', id)
  if (error) throw error
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
    .select('id,name,description,price,cost,category,emoji,is_active')
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
    emoji: r.emoji as string,
    isActive: r.is_active as boolean,
  }))
}

export async function getRecipeComponents(sellableProductId: string): Promise<RecipeComponent[]> {
  const { data, error } = await client()
    .from('recipe_components')
    .select('id,sellable_product_id,ingredient_id,preparation_batch_id,quantity,unit_id,ingredients(name),units(symbol),ingredient_costs(price_per_unit)')
    .eq('sellable_product_id', sellableProductId)
    .order('created_at', { ascending: true })

  if (error) throw error
  return (data ?? []).map((r) => ({
    id: r.id as string,
    sellableProductId: r.sellable_product_id as string,
    ingredientId: (r.ingredient_id as string) ?? null,
    preparationBatchId: (r.preparation_batch_id as string) ?? null,
    ingredientName: Array.isArray(r.ingredients) ? (r.ingredients[0] as Record<string, unknown>)?.name as string ?? null : null,
    quantity: Number(r.quantity),
    unitId: r.unit_id as string,
    unitSymbol: Array.isArray(r.units) ? (r.units[0] as Record<string, unknown>)?.symbol as string ?? '' : '',
    costPerUnit: Array.isArray(r.ingredient_costs) && r.ingredient_costs.length > 0
      ? Number((r.ingredient_costs[0] as Record<string, unknown>)?.price_per_unit)
      : null,
  }))
}

export async function getEmployees(): Promise<Employee[]> {
  const { data, error } = await client()
    .from('employees')
    .select('id,full_name,position,hourly_rate,is_active')
    .eq('is_active', true)
    .order('full_name', { ascending: true })

  if (error) throw error
  return (data ?? []).map((r) => ({
    id: r.id as string,
    fullName: r.full_name as string,
    position: (r.position as string) ?? null,
    hourlyRate: Number(r.hourly_rate),
    isActive: r.is_active as boolean,
  }))
}

export async function getProductionBatches(dateStart?: string, dateEnd?: string): Promise<ProductionBatch[]> {
  let query = client()
    .from('preparation_batches')
    .select(`
      id,name,production_date,quantity_produced,waste_quantity,waste_percentage,notes,created_at,
      preparation_batch_costs(total_input_cost),
      preparation_batch_items(
        id,ingredient_id,quantity_used,unit_id,
        ingredients(name),units(symbol),ingredient_costs(price_per_unit)
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
          costPerUnit: Array.isArray(item.ingredient_costs) && item.ingredient_costs.length > 0
            ? Number((item.ingredient_costs[0] as Record<string, unknown>)?.price_per_unit)
            : 0,
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
  const today = new Date().toISOString().split('T')[0]
  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0]

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
      id, supplier_id, purchase_date, invoice_number, notes, created_by, created_at,
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
    }
  })
}

export async function createPurchase(params: {
  supplierId: string
  purchaseDate: string
  invoiceNumber?: string
  notes?: string
  userId: string
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
    customerName: (data.customer_name as string) ?? 'Cliente',
    bcvRate: data.bcv_rate ? Number(data.bcv_rate) : null,
    createdBy: data.created_by as string,
    createdAt: data.created_at as string,
    updatedAt: data.updated_at as string,
    items: Array.isArray(data.items) ? data.items.map((i: Record<string, unknown>) => ({
      id: i.id as string,
      sellableProductId: i.sellable_product_id as string,
      productName: i.product_name as string,
      emoji: (i.emoji as string) ?? '🍽️',
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
