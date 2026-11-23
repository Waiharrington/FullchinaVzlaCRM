 
import { type FullOrder } from '../../lib/dataService'
import { type PaymentBreakdownEntry } from '../../lib/paymentBreakdown'
import { Wallet, DollarSign, Percent, Banknote, Smartphone, CreditCard, Building2, Pencil, Check, CircleCheckBig, ArrowRightLeft, Clock, Gift, Users, Landmark } from 'lucide-react'

export type Period = 'hoy' | 'ayer' | 'semana' | 'mes' | 'rango'
export interface PL {
  grossSales: number; cogs: number; opex: number; payroll: number
  grossProfit: number; netProfit: number; margin: number
  ordersCount: number; avgTicket: number; payments: Record<string, PaymentBreakdownEntry>
}
export const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0)
export const endOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999)
export function parseFinancialAmount(value: string): number {
  const normalized = value.trim().replace(/\s/g, '').replace(/\.(?=.*[,])/g, '').replace(',', '.')
  return normalized ? Number(normalized) : Number.NaN
}
export const addDays = (d: Date, n: number) => { const x = new Date(d); x.setDate(x.getDate() + n); return x }
export const isoDate = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
export const pct = (cur: number, prev: number) => (prev > 0 ? ((cur - prev) / prev) * 100 : null)
export const isDeliveryItem = (item: FullOrder['items'][number]) => item.productName.trim().toLowerCase() === 'delivery'

export type FinanceTab = 'overview' | 'daily' | 'closing' | 'history'
export type ManualFinanceMode = 'income' | 'expense'
export type HistoryDirection = 'in' | 'out' | 'transfer'
export interface FinancialHistoryEntry {
  id: string
  date: string
  direction: HistoryDirection
  category: string
  concept: string
  detail: string
  account: string
  amountUsd: number
  nativeAmount: number
  currency: 'USD' | 'VES'
}

export interface AccountDayMovement {
  id: string
  direction: 'in' | 'out'
  category: string
  concept: string
  detail: string
  amount: number
  occurredAt: string | null
}

export interface AccountHistoryMovement extends AccountDayMovement {
  date: string
  balanceAfter: number
}

export const PAY_META: Record<string, { label: string; icon: React.ReactNode; color: string; sub?: string }> = {
  cash: { label: 'Efectivo', icon: <Banknote size={16} />, color: '#22c55e', sub: 'En caja física' },
  mobile: { label: 'Pago Móvil (Bancos)', icon: <Smartphone size={16} />, color: '#facc15', sub: 'Verificado con referencia' },
  card: { label: 'Punto de Venta', icon: <CreditCard size={16} />, color: '#eab308', sub: 'Tarjeta crédito/débito' },
  transfer: { label: 'Transferencia', icon: <Building2 size={16} />, color: '#fde047' },
  binance: { label: 'Binance', icon: <DollarSign size={16} />, color: '#eab308' },
  zelle: { label: 'Zelle', icon: <DollarSign size={16} />, color: '#6366f1' },
  other: { label: 'Otro', icon: <Wallet size={16} />, color: '#71717a' },
}

export const OP_META: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  transfer: { label: 'Transferencia', icon: <ArrowRightLeft size={15} />, color: '#eab308' },
  receivable: { label: 'Cuenta por cobrar', icon: <Clock size={15} />, color: '#fde047' },
  receivable_collection: { label: 'Cobro recibido', icon: <CircleCheckBig size={15} />, color: '#22c55e' },
  tip: { label: 'Propina', icon: <Gift size={15} />, color: '#eab308' },
  tip_distribution: { label: 'Reparto de propinas', icon: <Users size={15} />, color: '#facc15' },
  employee_advance: { label: 'Adelanto', icon: <Wallet size={15} />, color: '#facc15' },
  loan: { label: 'Préstamo', icon: <Landmark size={15} />, color: '#818cf8' },
  loan_payment: { label: 'Pago de préstamo', icon: <Check size={15} />, color: '#4ade80' },
  bank_fee: { label: 'Comisión bancaria', icon: <Percent size={15} />, color: '#f87171' },
  adjustment: { label: 'Ajuste', icon: <Pencil size={15} />, color: '#a1a1aa' },
  payroll: { label: 'Nómina', icon: <Users size={15} />, color: '#fb7185' },
}

