import { useState, useCallback, useMemo, type ReactNode } from 'react'
import { DemoDataContext } from './demo-data-context'
import { PRODUCTS, INGREDIENTS, DEMO_ORDERS, DEMO_CREDITS, DEMO_STOCK_MOVEMENTS, DEMO_CREDIT_PAYMENTS, STAFF, DEMO_PRODUCTION_BATCHES, DEMO_PRODUCTION_BONUSES } from '../lib/demoData'
import type { Product, Ingredient, Order, OrderItem, StockMovement, CreditPayment, DemoProductionBatch, DemoProductionBonus } from '../lib/demoData'
import type { Credit, TodayStats } from './demo-data-context'

export function DemoDataProvider({ children }: { children: ReactNode }) {
  const [products] = useState<Product[]>(PRODUCTS)
  const [ingredients, setIngredients] = useState<Ingredient[]>(INGREDIENTS)
  const [orders, setOrders] = useState<Order[]>(DEMO_ORDERS)
  const [credits, setCredits] = useState<Credit[]>(DEMO_CREDITS)
  const [stockMovements, setStockMovements] = useState<StockMovement[]>(DEMO_STOCK_MOVEMENTS)
  const [creditPayments, setCreditPayments] = useState<CreditPayment[]>(DEMO_CREDIT_PAYMENTS)
  const [productionBatches, setProductionBatches] = useState<DemoProductionBatch[]>(DEMO_PRODUCTION_BATCHES)
  const [productionBonuses] = useState<DemoProductionBonus[]>(DEMO_PRODUCTION_BONUSES)

  const staff = useMemo(() => STAFF, [])

  const createOrder = useCallback((items: OrderItem[]): Order => {
    const newOrder: Order = {
      id: `ord-${Date.now()}`,
      items,
      total: items.reduce((sum, item) => sum + item.price * item.quantity, 0),
      status: 'pending',
      createdAt: new Date().toISOString()
    }
    setOrders(prev => [newOrder, ...prev])
    return newOrder
  }, [])

  const completeOrder = useCallback((orderId: string, paymentMethod: 'cash' | 'card' | 'transfer') => {
    setOrders(prev => prev.map(order =>
      order.id === orderId
        ? { ...order, status: 'paid' as const, paymentMethod }
        : order
    ))
  }, [])

  const cancelOrder = useCallback((orderId: string) => {
    setOrders(prev => prev.map(order =>
      order.id === orderId
        ? { ...order, status: 'cancelled' as const }
        : order
    ))
  }, [])

  const updateOrderStatus = useCallback((orderId: string, status: 'pending' | 'paid' | 'cancelled') => {
    setOrders(prev => prev.map(order =>
      order.id === orderId
        ? { ...order, status }
        : order
    ))
  }, [])

  const addCreditPayment = useCallback((creditId: string, amount: number) => {
    const payment: CreditPayment = {
      id: `cp-${Date.now()}`,
      creditId,
      amount,
      createdAt: new Date().toISOString()
    }
    setCreditPayments(prev => [...prev, payment])
    setCredits(prev => prev.map(credit =>
      credit.id === creditId
        ? {
            ...credit,
            paid: credit.paid + amount,
            remaining: Math.max(0, credit.remaining - amount),
            status: Math.max(0, credit.remaining - amount) === 0 ? 'settled' as const : 'active' as const
          }
        : credit
    ))
  }, [])

  const addCredit = useCallback((client: string, amount: number, phone?: string) => {
    const newCredit: Credit = {
      id: `cr-${Date.now()}`,
      client,
      phone,
      amount,
      paid: 0,
      remaining: amount,
      date: new Date().toISOString().split('T')[0],
      status: 'active'
    }
    setCredits(prev => [...prev, newCredit])
    return newCredit
  }, [])

  const adjustStock = useCallback((ingredientId: string, amount: number, reason: string) => {
    const movement: StockMovement = {
      id: `sm-${Date.now()}`,
      ingredientId,
      type: amount > 0 ? 'entry' : 'exit',
      amount: Math.abs(amount),
      reason,
      createdAt: new Date().toISOString()
    }
    setStockMovements(prev => [movement, ...prev])
    setIngredients(prev => prev.map(ing =>
      ing.id === ingredientId
        ? { ...ing, stock: Math.max(0, ing.stock + amount) }
        : ing
    ))
  }, [])

  const addIngredient = useCallback((ingredient: Omit<Ingredient, 'id'>) => {
    const newIngredient: Ingredient = {
      ...ingredient,
      id: `ing-${Date.now()}`
    }
    setIngredients(prev => [...prev, newIngredient])
  }, [])

  const updateIngredient = useCallback((id: string, updates: Partial<Ingredient>) => {
    setIngredients(prev => prev.map(ing =>
      ing.id === id ? { ...ing, ...updates } : ing
    ))
  }, [])

  const deleteIngredient = useCallback((id: string) => {
    setIngredients(prev => prev.filter(ing => ing.id !== id))
  }, [])

  const createProductionBatch = useCallback((batch: Omit<DemoProductionBatch, 'id' | 'batchNumber' | 'createdAt'>): DemoProductionBatch => {
    const newBatch: DemoProductionBatch = {
      ...batch,
      id: `pb-${Date.now()}`,
      batchNumber: productionBatches.length + 1,
      createdAt: new Date().toISOString(),
    }
    setProductionBatches(prev => [newBatch, ...prev])
    return newBatch
  }, [productionBatches.length])

  const getOrdersByDateRange = useCallback((start: Date, end: Date) => {
    return orders.filter(o => {
      const d = new Date(o.createdAt)
      return d >= start && d <= end && o.status === 'paid'
    })
  }, [orders])

  const getDailySales = useCallback((days: number) => {
    const result: Array<{ date: string; total: number; count: number }> = []
    const now = new Date()

    for (let i = days - 1; i >= 0; i--) {
      const date = new Date(now)
      date.setDate(date.getDate() - i)
      const dateStr = date.toISOString().split('T')[0]

      const dayOrders = orders.filter(o => {
        const oDate = o.createdAt.split('T')[0]
        return oDate === dateStr && o.status === 'paid'
      })

      result.push({
        date: dateStr,
        total: dayOrders.reduce((sum, o) => sum + o.total, 0),
        count: dayOrders.length,
      })
    }
    return result
  }, [orders])

  const getProductRanking = useCallback(() => {
    const map = new Map<string, { name: string; count: number; revenue: number }>()
    const paidOrders = orders.filter(o => o.status === 'paid')

    for (const order of paidOrders) {
      for (const item of order.items) {
        const existing = map.get(item.productId)
        if (existing) {
          existing.count += item.quantity
          existing.revenue += item.price * item.quantity
        } else {
          map.set(item.productId, {
            name: item.productName,
            count: item.quantity,
            revenue: item.price * item.quantity,
          })
        }
      }
    }

    return Array.from(map.values()).sort((a, b) => b.revenue - a.revenue)
  }, [orders])

  const todayStats = useMemo<TodayStats>(() => {
    const today = new Date().toISOString().split('T')[0]
    const todayOrders = orders.filter(o => o.createdAt.split('T')[0] === today && o.status === 'paid')
    const totalSales = todayOrders.reduce((sum, o) => sum + o.total, 0)
    const pendingOrders = orders.filter(o => o.status === 'pending').length
    const lowStock = ingredients.filter(i => i.stock <= i.minStock).length
    const avgTicket = todayOrders.length > 0 ? totalSales / todayOrders.length : 0

    const productCounts = new Map<string, number>()
    for (const order of todayOrders) {
      for (const item of order.items) {
        productCounts.set(item.productName, (productCounts.get(item.productName) || 0) + item.quantity)
      }
    }
    let topProduct = '-'
    let maxCount = 0
    for (const [name, count] of productCounts) {
      if (count > maxCount) {
        maxCount = count
        topProduct = name
      }
    }

    return { totalSales, ordersCount: todayOrders.length, pendingOrders, lowStock, avgTicket, topProduct }
  }, [orders, ingredients])

  return (
    <DemoDataContext.Provider value={{
      products,
      ingredients,
      orders,
      credits,
      staff,
      stockMovements,
      creditPayments,
      todayStats,
      productionBatches,
      productionBonuses,
      createOrder,
      completeOrder,
      cancelOrder,
      updateOrderStatus,
      addCreditPayment,
      addCredit,
      adjustStock,
      addIngredient,
      updateIngredient,
      deleteIngredient,
      createProductionBatch,
      getOrdersByDateRange,
      getDailySales,
      getProductRanking
    }}>
      {children}
    </DemoDataContext.Provider>
  )
}
