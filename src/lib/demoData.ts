export interface Product {
  id: string
  name: string
  price: number
  cost: number
  category: 'food' | 'drink' | 'dessert'
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

export const PRODUCTS: Product[] = [
  { id: 'p1', name: 'Hamburguesa Clásica', price: 8.00, cost: 3.20, category: 'food', emoji: '🍔', active: true },
  { id: 'p2', name: 'Hamburguesa Doble', price: 10.00, cost: 4.50, category: 'food', emoji: '🍔', active: true },
  { id: 'p3', name: 'Papas Fritas', price: 4.00, cost: 1.20, category: 'food', emoji: '🍟', active: true },
  { id: 'p4', name: 'Hot Dog', price: 5.00, cost: 1.80, category: 'food', emoji: '🌭', active: true },
  { id: 'p5', name: 'Tacos (3 und)', price: 6.00, cost: 2.10, category: 'food', emoji: '🌮', active: true },
  { id: 'p6', name: 'Refresco', price: 2.00, cost: 0.60, category: 'drink', emoji: '🥤', active: true },
  { id: 'p7', name: 'Agua', price: 1.50, cost: 0.30, category: 'drink', emoji: '💧', active: true },
  { id: 'p8', name: 'Postre del día', price: 3.50, cost: 1.40, category: 'dessert', emoji: '🍰', active: true },
  { id: 'p9', name: 'Combo Burguer + Papas', price: 11.00, cost: 4.80, category: 'food', emoji: '🎯', active: true },
  { id: 'p10', name: 'Nachos con Queso', price: 5.50, cost: 2.00, category: 'food', emoji: '🧀', active: true },
  { id: 'p11', name: 'Jugo Natural', price: 3.00, cost: 0.90, category: 'drink', emoji: '🧃', active: true },
  { id: 'p12', name: 'Helado', price: 2.50, cost: 0.80, category: 'dessert', emoji: '🍦', active: true },
]

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
