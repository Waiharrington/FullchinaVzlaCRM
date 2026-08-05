import { createContext, useContext } from 'react'
import type { Product, Ingredient, Order, OrderItem, Staff, StockMovement, CreditPayment } from '../lib/demoData'

export interface Credit {
  id: string
  client: string
  phone?: string
  amount: number
  paid: number
  remaining: number
  date: string
  status: 'active' | 'settled'
}

export interface TodayStats {
  totalSales: number
  ordersCount: number
  pendingOrders: number
  lowStock: number
  avgTicket: number
  topProduct: string
}

export interface DemoDataContextType {
  products: Product[]
  ingredients: Ingredient[]
  orders: Order[]
  credits: Credit[]
  staff: Staff[]
  stockMovements: StockMovement[]
  creditPayments: CreditPayment[]
  todayStats: TodayStats
  createOrder: (items: OrderItem[]) => Order
  completeOrder: (orderId: string, paymentMethod: 'cash' | 'card' | 'transfer') => void
  cancelOrder: (orderId: string) => void
  updateOrderStatus: (orderId: string, status: 'pending' | 'paid' | 'cancelled') => void
  addCreditPayment: (creditId: string, amount: number) => void
  addCredit: (client: string, amount: number, phone?: string) => Credit
  adjustStock: (ingredientId: string, amount: number, reason: string) => void
  addIngredient: (ingredient: Omit<Ingredient, 'id'>) => void
  updateIngredient: (id: string, updates: Partial<Ingredient>) => void
  deleteIngredient: (id: string) => void
  getOrdersByDateRange: (start: Date, end: Date) => Order[]
  getDailySales: (days: number) => Array<{ date: string; total: number; count: number }>
  getProductRanking: () => Array<{ name: string; count: number; revenue: number }>
}

export const DemoDataContext = createContext<DemoDataContextType | null>(null)

export function useDemoData() {
  const context = useContext(DemoDataContext)
  if (!context) throw new Error('useDemoData must be used within DemoDataProvider')
  return context
}
