import { REAL_FULL_CHINA_MENU } from './realMenuData'

export interface Product {
  id: string
  name: string
  price: number
  cost: number
  category: 'combo' | 'plato' | 'arroz' | 'noodles' | 'wok' | 'racion' | 'extra' | string
  emoji: string
  active: boolean
}

export interface Ingredient {
  id: string
  name: string
  stock: number
  unit: string
  minStock: number
  costPerUnit: number
}

export interface StockMovement {
  id: string
  ingredientId: string
  type: 'entry' | 'exit' | 'adjustment'
  amount: number
  reason: string
  createdAt: string
}

export interface Order {
  id: string
  items: OrderItem[]
  total: number
  status: 'pending' | 'paid' | 'cancelled'
  paymentMethod?: 'cash' | 'card' | 'transfer'
  createdAt: string
  staffId?: string
}

export interface OrderItem {
  productId: string
  productName: string
  price: number
  quantity: number
}

export interface Staff {
  id: string
  name: string
  role: 'cashier' | 'cook' | 'assistant'
  commissionPct: number
  active: boolean
}

export interface CreditPayment {
  id: string
  creditId: string
  amount: number
  createdAt: string
}

export const STAFF: Staff[] = [
  { id: 's1', name: 'Ana García', role: 'cashier', commissionPct: 5, active: true },
  { id: 's2', name: 'Carlos Ruiz', role: 'cook', commissionPct: 10, active: true },
  { id: 's3', name: 'María López', role: 'assistant', commissionPct: 3, active: true },
]

export const PRODUCTS: Product[] = REAL_FULL_CHINA_MENU as unknown as Product[]

export const INGREDIENTS: Ingredient[] = [
  { id: 'i1', name: 'Pan hamburguesa', stock: 50, unit: 'und', minStock: 10, costPerUnit: 0.40 },
  { id: 'i2', name: 'Carne molida', stock: 10, unit: 'lb', minStock: 5, costPerUnit: 3.50 },
  { id: 'i3', name: 'Papas', stock: 15, unit: 'lb', minStock: 5, costPerUnit: 1.00 },
  { id: 'i4', name: 'Lechuga', stock: 8, unit: 'lb', minStock: 3, costPerUnit: 1.20 },
  { id: 'i5', name: 'Tomate', stock: 6, unit: 'lb', minStock: 3, costPerUnit: 1.50 },
  { id: 'i6', name: 'Queso', stock: 5, unit: 'lb', minStock: 3, costPerUnit: 4.00 },
  { id: 'i7', name: 'Salchicha', stock: 30, unit: 'und', minStock: 10, costPerUnit: 0.50 },
  { id: 'i8', name: 'Tortilla', stock: 40, unit: 'und', minStock: 15, costPerUnit: 0.30 },
  { id: 'i9', name: 'Cebolla', stock: 4, unit: 'lb', minStock: 2, costPerUnit: 1.00 },
  { id: 'i10', name: 'Salsa de tomate', stock: 3, unit: 'botella', minStock: 2, costPerUnit: 2.50 },
  { id: 'i11', name: 'Mostaza', stock: 2, unit: 'botella', minStock: 1, costPerUnit: 2.00 },
  { id: 'i12', name: 'Mayonesa', stock: 2, unit: 'botella', minStock: 1, costPerUnit: 2.00 },
  { id: 'i13', name: 'Bolsas de papel', stock: 100, unit: 'und', minStock: 30, costPerUnit: 0.05 },
  { id: 'i14', name: 'Servilletas', stock: 200, unit: 'und', minStock: 50, costPerUnit: 0.02 },
  { id: 'i15', name: 'Aceite de freír', stock: 3, unit: 'litro', minStock: 2, costPerUnit: 3.00 },
]

function generateOrders(): Order[] {
  const now = new Date()
  const orders: Order[] = []
  let orderId = 1

  const daysData = [
    { dayOffset: 0, orderCount: 8, paidCount: 7 },
    { dayOffset: -1, orderCount: 12, paidCount: 12 },
    { dayOffset: -2, orderCount: 10, paidCount: 10 },
    { dayOffset: -3, orderCount: 15, paidCount: 14 },
    { dayOffset: -4, orderCount: 9, paidCount: 9 },
    { dayOffset: -5, orderCount: 11, paidCount: 11 },
    { dayOffset: -6, orderCount: 7, paidCount: 7 },
  ]

  const paymentMethods: Array<'cash' | 'card' | 'transfer'> = ['cash', 'card', 'transfer']
  const hours = [9, 10, 11, 12, 13, 14, 15, 16, 17, 18]

  for (const day of daysData) {
    const dayDate = new Date(now)
    dayDate.setDate(dayDate.getDate() + day.dayOffset)

    for (let i = 0; i < day.orderCount; i++) {
      const itemCount = Math.floor(Math.random() * 3) + 1
      const items: OrderItem[] = []
      const usedProducts = new Set<string>()

      for (let j = 0; j < itemCount; j++) {
        let product: Product
        do {
          product = PRODUCTS[Math.floor(Math.random() * PRODUCTS.length)]
        } while (usedProducts.has(product.id) && usedProducts.size < PRODUCTS.length)
        usedProducts.add(product.id)

        const qty = Math.floor(Math.random() * 3) + 1
        items.push({
          productId: product.id,
          productName: product.name,
          price: product.price,
          quantity: qty,
        })
      }

      const total = items.reduce((sum, item) => sum + item.price * item.quantity, 0)
      const isPaid = i < day.paidCount
      const hour = hours[Math.floor(Math.random() * hours.length)]
      const minute = Math.floor(Math.random() * 60)
      const date = new Date(dayDate)
      date.setHours(hour, minute, 0, 0)

      orders.push({
        id: `ord-${String(orderId++).padStart(3, '0')}`,
        items,
        total,
        status: isPaid ? 'paid' : 'pending',
        paymentMethod: isPaid ? paymentMethods[Math.floor(Math.random() * paymentMethods.length)] : undefined,
        createdAt: date.toISOString(),
        staffId: STAFF[Math.floor(Math.random() * STAFF.length)].id,
      })
    }
  }

  return orders.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
}

export const DEMO_ORDERS: Order[] = generateOrders()

export const DEMO_STOCK_MOVEMENTS: StockMovement[] = [
  { id: 'sm-001', ingredientId: 'i2', type: 'exit', amount: 2, reason: 'Uso: 5 hamburguesas', createdAt: new Date(Date.now() - 3600000).toISOString() },
  { id: 'sm-002', ingredientId: 'i1', type: 'exit', amount: 10, reason: 'Uso: 10 hamburguesas', createdAt: new Date(Date.now() - 7200000).toISOString() },
  { id: 'sm-003', ingredientId: 'i3', type: 'entry', amount: 5, reason: 'Compra proveedor', createdAt: new Date(Date.now() - 86400000).toISOString() },
  { id: 'sm-004', ingredientId: 'i13', type: 'entry', amount: 50, reason: 'Compra proveedor', createdAt: new Date(Date.now() - 86400000).toISOString() },
  { id: 'sm-005', ingredientId: 'i6', type: 'exit', amount: 1, reason: 'Uso: nachos', createdAt: new Date(Date.now() - 1800000).toISOString() },
]

export const DEMO_CREDITS = [
  { id: 'cr-001', client: 'María López', phone: '+58 412 123 4567', amount: 50.00, paid: 30.00, remaining: 20.00, date: '2026-08-01', status: 'active' as const },
  { id: 'cr-002', client: 'Carlos García', phone: '+58 414 555 1234', amount: 25.00, paid: 25.00, remaining: 0, date: '2026-08-02', status: 'settled' as const },
  { id: 'cr-003', client: 'Ana Martínez', phone: '+58 416 789 0123', amount: 40.00, paid: 10.00, remaining: 30.00, date: '2026-08-03', status: 'active' as const },
  { id: 'cr-004', client: 'Pedro Sánchez', phone: '+58 412 333 4444', amount: 35.00, paid: 35.00, remaining: 0, date: '2026-07-30', status: 'settled' as const },
  { id: 'cr-005', client: 'Laura Díaz', phone: '+58 414 666 7777', amount: 60.00, paid: 15.00, remaining: 45.00, date: '2026-07-28', status: 'active' as const },
]

export const DEMO_CREDIT_PAYMENTS: CreditPayment[] = [
  { id: 'cp-001', creditId: 'cr-001', amount: 20.00, createdAt: '2026-08-02T10:00:00' },
  { id: 'cp-002', creditId: 'cr-001', amount: 10.00, createdAt: '2026-08-03T14:30:00' },
  { id: 'cp-003', creditId: 'cr-003', amount: 10.00, createdAt: '2026-08-03T16:00:00' },
  { id: 'cp-004', creditId: 'cr-005', amount: 15.00, createdAt: '2026-08-01T11:00:00' },
]

// --- Producción demo --------------------------------------------------------

export interface DemoBatchItem {
  ingredientId: string
  ingredientName: string
  quantityUsed: number
  unitSymbol: string
  costPerUnit: number
}

export interface DemoProductionBatch {
  id: string
  batchNumber: number
  name: string
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
  items: DemoBatchItem[]
  createdAt: string
}

export interface DemoProductionBonus {
  employeeId: string
  employeeName: string
  initials: string
  piecesCount: number
  bonusAmount: number
  percentage: number
}

export const DEMO_SELLABLE_PRODUCTS = [
  { id: 'sp1', name: 'Porcionado de pollo', description: 'Convierte pollo crudo en porciones listas para servir.', emoji: '🍗', category: 'pollo_camaron' },
  { id: 'sp2', name: 'Lumpias (carne)', description: 'Lumpias rellenas de carne preparadas para freír.', emoji: '🥟', category: 'plato' },
  { id: 'sp3', name: 'Camarones empanizados', description: 'Camarones empanizados listos para freír.', emoji: '🦐', category: 'pollo_camaron' },
  { id: 'sp4', name: 'Lumpias (pollo)', description: 'Lumpias rellenas de pollo preparadas para freír.', emoji: '🥟', category: 'plato' },
  { id: 'sp5', name: 'Arroz preparado', description: 'Arroz blanco cocido listo para servir.', emoji: '🍚', category: 'arroz' },
]

const now = new Date()
const d = (offset: number, h: number, m: number) => {
  const date = new Date(now)
  date.setDate(date.getDate() + offset)
  date.setHours(h, m, 0, 0)
  return date.toISOString()
}

export const DEMO_PRODUCTION_BATCHES: DemoProductionBatch[] = [
  {
    id: 'pb-001', batchNumber: 8, name: 'Porcionado de pollo', productName: 'Porcionado de pollo',
    productionDate: now.toISOString().split('T')[0], quantityProduced: 40, unitProduced: 'porción',
    wasteQuantity: 0.5, wastePercentage: 5.0, totalCost: 120.00, costPerPortion: 3.00,
    operator: 'María Chávez', status: 'Completado', createdAt: d(0, 12, 45),
    items: [
      { ingredientId: 'i2', ingredientName: 'Pechuga de pollo', quantityUsed: 10, unitSymbol: 'kg', costPerUnit: 11.00 },
      { ingredientId: 'i9', ingredientName: 'Sal', quantityUsed: 0.10, unitSymbol: 'kg', costPerUnit: 1.00 },
      { ingredientId: 'i15', ingredientName: 'Aceite vegetal', quantityUsed: 0.10, unitSymbol: 'L', costPerUnit: 4.00 },
    ],
  },
  {
    id: 'pb-002', batchNumber: 7, name: 'Lumpias (carne)', productName: 'Lumpias (carne)',
    productionDate: now.toISOString().split('T')[0], quantityProduced: 60, unitProduced: 'pieza',
    wasteQuantity: 0.3, wastePercentage: 4.8, totalCost: 90.00, costPerPortion: 1.50,
    operator: 'Juan Pérez', status: 'Completado', createdAt: d(0, 11, 20),
    items: [
      { ingredientId: 'i2', ingredientName: 'Carne molida', quantityUsed: 5, unitSymbol: 'lb', costPerUnit: 3.50 },
      { ingredientId: 'i1', ingredientName: 'Pan hamburguesa', quantityUsed: 30, unitSymbol: 'und', costPerUnit: 0.40 },
    ],
  },
  {
    id: 'pb-003', batchNumber: 6, name: 'Camarones empanizados', productName: 'Camarones empanizados',
    productionDate: now.toISOString().split('T')[0], quantityProduced: 25, unitProduced: 'pieza',
    wasteQuantity: 0.4, wastePercentage: 6.0, totalCost: 75.00, costPerPortion: 3.00,
    operator: 'Ana López', status: 'Completado', createdAt: d(0, 9, 35),
    items: [
      { ingredientId: 'i3', ingredientName: 'Camarones', quantityUsed: 3, unitSymbol: 'lb', costPerUnit: 8.00 },
    ],
  },
  {
    id: 'pb-004', batchNumber: 5, name: 'Porcionado de pollo', productName: 'Porcionado de pollo',
    productionDate: d(-1, 0, 0).split('T')[0], quantityProduced: 35, unitProduced: 'porción',
    wasteQuantity: 0.7, wastePercentage: 8.9, totalCost: 105.00, costPerPortion: 3.00,
    operator: 'Roberto Vargas', status: 'Parcial', createdAt: d(-1, 17, 10),
    items: [
      { ingredientId: 'i2', ingredientName: 'Pechuga de pollo', quantityUsed: 9, unitSymbol: 'kg', costPerUnit: 11.00 },
    ],
  },
  {
    id: 'pb-005', batchNumber: 4, name: 'Lumpias (pollo)', productName: 'Lumpias (pollo)',
    productionDate: d(-1, 0, 0).split('T')[0], quantityProduced: 50, unitProduced: 'pieza',
    wasteQuantity: 0.3, wastePercentage: 5.7, totalCost: 60.00, costPerPortion: 1.20,
    operator: 'María Chávez', status: 'Completado', createdAt: d(-1, 15, 15),
    items: [
      { ingredientId: 'i2', ingredientName: 'Pollo molido', quantityUsed: 4, unitSymbol: 'lb', costPerUnit: 3.00 },
      { ingredientId: 'i1', ingredientName: 'Pan hamburguesa', quantityUsed: 25, unitSymbol: 'und', costPerUnit: 0.40 },
    ],
  },
]

export const DEMO_EMPLOYEES = [
  { id: 'e1', name: 'María Chávez', role: 'cook' },
  { id: 'e2', name: 'Juan Pérez', role: 'cook' },
  { id: 'e3', name: 'Ana López', role: 'assistant' },
  { id: 'e4', name: 'Roberto Vargas', role: 'assistant' },
]

export const DEMO_PRODUCTION_BONUSES: DemoProductionBonus[] = [
  { employeeId: 'e1', employeeName: 'María Chávez', initials: 'MC', piecesCount: 120, bonusAmount: 18.00, percentage: 38 },
  { employeeId: 'e2', employeeName: 'Juan Pérez', initials: 'JP', piecesCount: 90, bonusAmount: 13.50, percentage: 28 },
  { employeeId: 'e3', employeeName: 'Ana López', initials: 'AL', piecesCount: 70, bonusAmount: 10.50, percentage: 22 },
  { employeeId: 'e4', employeeName: 'Roberto Vargas', initials: 'RV', piecesCount: 40, bonusAmount: 6.00, percentage: 12 },
]

// --- Almacén Principal ------------------------------------------------------
export interface WarehouseItem {
  id: string
  name: string
  quantity: number
  unit: string
  minStock: number
  category: string
  costPerUnit: number
}

export interface WarehouseTransfer {
  id: string
  itemName: string
  quantityTransferred: number
  unit: string
  date: string
  operator: string
  destination: string
  status: 'completed' | 'pending'
}

export const DEMO_WAREHOUSE_ITEMS: WarehouseItem[] = [
  { id: 'w1', name: 'Pollo Crudo Entero', quantity: 150, unit: 'kg', minStock: 30, category: 'Carnes', costPerUnit: 4.50 },
  { id: 'w2', name: 'Camarones Frescos', quantity: 45, unit: 'kg', minStock: 10, category: 'Mariscos', costPerUnit: 9.00 },
  { id: 'w3', name: 'Carne Molida Especial', quantity: 60, unit: 'kg', minStock: 15, category: 'Carnes', costPerUnit: 6.00 },
  { id: 'w4', name: 'Salsa de Soya (Garrafón 5L)', quantity: 20, unit: 'und', minStock: 5, category: 'Insumos', costPerUnit: 12.00 },
  { id: 'w5', name: 'Aceite Vegetal (Caja 12L)', quantity: 15, unit: 'caja', minStock: 4, category: 'Aceites', costPerUnit: 32.00 },
  { id: 'w6', name: 'Harina de Trigo (Saco 25kg)', quantity: 10, unit: 'saco', minStock: 2, category: 'Granos/Harinas', costPerUnit: 22.00 },
]

export const DEMO_WAREHOUSE_TRANSFERS: WarehouseTransfer[] = [
  { id: 'wt-01', itemName: 'Porcionado de Pollo (40 porciones)', quantityTransferred: 40, unit: 'porción', date: new Date().toISOString().split('T')[0], operator: 'María Chávez', destination: 'Food Truck Inventario', status: 'completed' },
  { id: 'wt-02', itemName: 'Lumpias de Carne', quantityTransferred: 60, unit: 'pieza', date: new Date().toISOString().split('T')[0], operator: 'Juan Pérez', destination: 'Food Truck Inventario', status: 'completed' },
  { id: 'wt-03', itemName: 'Camarones Empanizados', quantityTransferred: 25, unit: 'pieza', date: new Date().toISOString().split('T')[0], operator: 'Ana López', destination: 'Food Truck Inventario', status: 'completed' },
]

// --- Caja Física -------------------------------------------------------------
export interface CashSession {
  id: string
  sessionNumber: number
  openedAt: string
  closedAt?: string
  openedBy: string
  initialCashUsd: number
  initialCashBs: number
  finalCashUsd?: number
  finalCashBs?: number
  digitalPaymentsBs?: number
  cardPaymentsUsd?: number
  status: 'open' | 'closed'
}

export const DEMO_CASH_SESSIONS: CashSession[] = [
  {
    id: 'cs-101',
    sessionNumber: 142,
    openedAt: `${new Date().toISOString().split('T')[0]}T09:00:00`,
    openedBy: 'Ana García (Cajera)',
    initialCashUsd: 50.00,
    initialCashBs: 1800.00,
    digitalPaymentsBs: 8400.00,
    cardPaymentsUsd: 120.00,
    status: 'open'
  }
]

// --- Clientes & Fidelización -------------------------------------------------
export interface Customer {
  id: string
  name: string
  phone: string
  cedula?: string
  birthday?: string
  totalVisits: number
  lastVisit: string
  totalSpent: number
  favoriteProduct: string
  rewardsUnlocked: number
  creditLimit: number
  creditUsed: number
}

export const DEMO_CUSTOMERS: Customer[] = [
  { id: 'c1', name: 'Waiharrington González', phone: '0424-3334186', cedula: 'V-30102609', birthday: '1998-08-15', totalVisits: 14, lastVisit: '2026-08-06', totalSpent: 184.00, favoriteProduct: 'Chow Mein Especial', rewardsUnlocked: 2, creditLimit: 50.00, creditUsed: 0 },
  { id: 'c2', name: 'Laura Rodríguez', phone: '0412-5551234', cedula: 'V-18452109', birthday: new Date().toISOString().split('T')[0], totalVisits: 9, lastVisit: new Date().toISOString().split('T')[0], totalSpent: 110.00, favoriteProduct: 'Arroz Frito Cantonés', rewardsUnlocked: 1, creditLimit: 30.00, creditUsed: 15.00 },
  { id: 'c3', name: 'Ricardo Mendoza', phone: '0414-7778899', cedula: 'V-15200344', birthday: '1985-11-20', totalVisits: 22, lastVisit: '2026-08-04', totalSpent: 340.00, favoriteProduct: 'Pollo Agridulce', rewardsUnlocked: 4, creditLimit: 100.00, creditUsed: 0 },
  { id: 'c4', name: 'Kelita de Hispano', phone: '0416-9990011', cedula: 'V-12888444', birthday: '1979-05-12', totalVisits: 18, lastVisit: '2026-08-05', totalSpent: 260.00, favoriteProduct: 'Lumpias de Carne', rewardsUnlocked: 3, creditLimit: 40.00, creditUsed: 0 },
  { id: 'c5', name: 'José Alvarado (Inactivo)', phone: '0424-1112233', cedula: 'V-20111222', birthday: '1992-03-08', totalVisits: 4, lastVisit: '2026-07-10', totalSpent: 48.00, favoriteProduct: 'Costillas Sal y Pimienta', rewardsUnlocked: 0, creditLimit: 0, creditUsed: 0 }
]

// --- Platos de la Semana ----------------------------------------------------
export interface WeeklyDish {
  id: string
  name: string
  description: string
  price: number
  cost: number
  emoji: string
  status: 'active' | 'inactive' | 'scheduled'
  weekTag: string
}

export const DEMO_WEEKLY_DISHES: WeeklyDish[] = [
  { id: 'wd-1', name: 'Papas Especiales Szechuan', description: 'Papas fritas crujientes con especias chinas y topping de carne picante.', price: 6.50, cost: 2.10, emoji: '🍟', status: 'active', weekTag: 'Semana 1 - Agosto' },
  { id: 'wd-2', name: 'Tallarines Singapur con Curri', description: 'Vermicelli salteados con camarones, vegetales y curri aromático.', price: 9.50, cost: 3.40, emoji: '🍜', status: 'active', weekTag: 'Semana 1 - Agosto' },
  { id: 'wd-3', name: 'Cerdo Char Siu BBQ', description: 'Lomito de cerdo marinado al estilo barbacoa china tradicional.', price: 11.00, cost: 4.20, emoji: '🥩', status: 'scheduled', weekTag: 'Semana 2 - Agosto' },
  { id: 'wd-4', name: 'Won Ton Frito con Salsa Camarón', description: 'Empanaditas crujientes rellenas bañadas en crema de mariscos.', price: 7.00, cost: 2.30, emoji: '🥟', status: 'inactive', weekTag: 'Semana Anterior' }
]

// --- Gastos & Categorías ----------------------------------------------------
export interface Expense {
  id: string
  description: string
  type: 'fixed' | 'variable'
  category: 'supermarket' | 'payroll' | 'delivery' | 'maintenance' | 'pos_commission' | 'cleaning' | 'utilities' | 'other'
  vendor: string
  amountUsd: number
  amountBs: number
  date: string
  paymentMethod: 'efectivo_usd' | 'efectivo_bs' | 'pago_movil' | 'transferencia'
  reference?: string
}

export const DEMO_EXPENSES: Expense[] = [
  { id: 'ex-01', description: 'Compras de verduras y charcutería', type: 'variable', category: 'supermarket', vendor: 'Aradito Supermercado', amountUsd: 30.00, amountBs: 1080.00, date: new Date().toISOString().split('T')[0], paymentMethod: 'pago_movil', reference: '984521' },
  { id: 'ex-02', description: 'Mantenimiento preventivo punto de venta', type: 'fixed', category: 'maintenance', vendor: 'Credicard Service', amountUsd: 15.00, amountBs: 540.00, date: new Date().toISOString().split('T')[0], paymentMethod: 'pago_movil', reference: '112049' },
  { id: 'ex-03', description: 'Insumos de limpieza y desinfección', type: 'fixed', category: 'cleaning', vendor: 'Euro-Mercado', amountUsd: 22.00, amountBs: 792.00, date: new Date().toISOString().split('T')[0], paymentMethod: 'efectivo_usd' },
  { id: 'ex-04', description: 'Comisiones de Pago Móvil bancario', type: 'fixed', category: 'pos_commission', vendor: 'Banesco / BDV', amountUsd: 8.50, amountBs: 306.00, date: new Date().toISOString().split('T')[0], paymentMethod: 'transferencia', reference: 'TRF-9081' },
  { id: 'ex-05', description: 'Pago de motorizados Delivery turno', type: 'fixed', category: 'delivery', vendor: 'Equipo Delivery', amountUsd: 25.00, amountBs: 900.00, date: new Date().toISOString().split('T')[0], paymentMethod: 'efectivo_usd' },
]

// --- WhatsApp Automatizaciones ----------------------------------------------
export interface WhatsAppMessage {
  id: string
  templateType: 'birthday' | 'thanks' | 'reactivation' | 'promo'
  customerName: string
  phone: string
  message: string
  sentAt: string
  status: 'sent' | 'scheduled'
}

export const DEMO_WHATSAPP_MESSAGES: WhatsAppMessage[] = [
  { id: 'wm-01', templateType: 'birthday', customerName: 'Laura Rodríguez', phone: '0412-5551234', message: '¡Feliz Cumpleaños Laura! 🎉 En Full China te regalamos una ración de lumpias gratis hoy en tu compra.', sentAt: `${new Date().toISOString().split('T')[0]} 08:30`, status: 'sent' },
  { id: 'wm-02', templateType: 'reactivation', customerName: 'José Alvarado', phone: '0424-1112233', message: '¡Hola José! Te extrañamos en Full China. 🍜 Muestra este mensaje y recibe un 15% de descuento en tu plato favorito esta semana.', sentAt: `${new Date().toISOString().split('T')[0]} 10:15`, status: 'sent' },
  { id: 'wm-03', templateType: 'thanks', customerName: 'Waiharrington González', phone: '0424-3334186', message: '¡Muchas gracias por tu compra en Full China! 🥡 Esperamos que disfrutes tu pedido. ¡Vuelve pronto!', sentAt: '2026-08-06 20:40', status: 'sent' }
]

