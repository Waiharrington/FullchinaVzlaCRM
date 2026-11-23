/* eslint-disable react-refresh/only-export-components -- constantes y helpers con iconos JSX */
import { type ReactNode } from 'react'
import { type OrderType } from '../../lib/orderDefaults'
import { type Product, type CartItem, type PaymentMethod } from '../../lib/dataService'
import { Split, WalletCards, UtensilsCrossed, ShoppingBag as TakeawayBag, Bike, Banknote, Smartphone, CreditCard, Landmark, Hexagon } from 'lucide-react'


export const BIRTH_MONTHS = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
] as const
export const getDaysInBirthMonth = (month: string) => month ? new Date(2000, Number(month), 0).getDate() : 31

export const TABLE_COUNT = 10

export const ORDER_TYPE_LABELS: Record<OrderType, { label: string; icon: ReactNode }> = {
  'dine-in': { label: 'Mesa', icon: <UtensilsCrossed size={18} strokeWidth={1.8} /> },
  takeaway: { label: 'Para llevar', icon: <TakeawayBag size={18} strokeWidth={1.8} /> },
  delivery: { label: 'Delivery', icon: <Bike size={18} strokeWidth={1.8} /> },
}

export type ActivePaymentMethod = Exclude<PaymentMethod, 'zelle'>
export type SplitPaymentMethod = Exclude<ActivePaymentMethod, 'other' | 'personal_account'>

export const PAYMENT_DETAILS: Record<ActivePaymentMethod | 'split', { label: string; desc: string; icon: ReactNode }> = {
  card: { label: 'Punto de venta', desc: 'Tarjeta de débito o crédito', icon: <CreditCard size={16} strokeWidth={1.8} /> },
  mobile: { label: 'Pago móvil', desc: 'Transferencia móvil inmediata', icon: <Smartphone size={16} strokeWidth={1.8} /> },
  cash: { label: 'Efectivo', desc: 'Dólares o bolívares en efectivo', icon: <Banknote size={16} strokeWidth={1.8} /> },
  transfer: { label: 'Transferencia', desc: 'Transferencia bancaria', icon: <Landmark size={16} strokeWidth={1.8} /> },
  binance: { label: 'Binance Pay', desc: 'Pago en cripto USDT', icon: <Hexagon size={16} strokeWidth={1.8} /> },
  split: { label: 'Pago combinado', desc: 'Cobrar con dos métodos', icon: <Split size={16} strokeWidth={1.8} /> },
  other: { label: 'Otro método', desc: 'Método especial', icon: <CreditCard size={16} strokeWidth={1.8} /> },
  personal_account: { label: 'Cuenta personal', desc: 'Consumo interno · no ingresa a caja', icon: <WalletCards size={16} strokeWidth={1.8} /> },
}

export const PAYMENT_METHODS: Array<{ method: ActivePaymentMethod | 'split'; label: string; icon: ReactNode }> = [
  { method: 'cash', label: 'Efectivo', icon: <Banknote size={16} strokeWidth={1.8} /> },
  { method: 'mobile', label: 'Pago móvil', icon: <Smartphone size={16} strokeWidth={1.8} /> },
  { method: 'card', label: 'Punto', icon: <CreditCard size={16} strokeWidth={1.8} /> },
  { method: 'transfer', label: 'Transferencia', icon: <Landmark size={16} strokeWidth={1.8} /> },
  { method: 'binance', label: 'Binance', icon: <Hexagon size={16} strokeWidth={1.8} /> },
  { method: 'personal_account', label: 'Cuenta personal', icon: <WalletCards size={16} strokeWidth={1.8} /> },
  { method: 'split', label: 'Pago combinado', icon: <Split size={16} strokeWidth={1.8} /> },
]

export const SPLIT_PAYMENT_METHODS = PAYMENT_METHODS.filter(
  (item): item is { method: SplitPaymentMethod; label: string; icon: ReactNode } => item.method !== 'split' && item.method !== 'other' && item.method !== 'personal_account',
)
export const MOBILE_CART_TRIGGER_EXIT_MS = 180

export const usesBolivares = (method: SplitPaymentMethod, cashCurrency: 'USD' | 'VES' = 'USD') =>
  method === 'mobile' || method === 'card' || method === 'transfer' || (method === 'cash' && cashCurrency === 'VES')
export const requiresPaymentReference = (method: SplitPaymentMethod) => method !== 'cash'
export const paymentReferenceLabel = (method: SplitPaymentMethod) => {
  if (method === 'card') return 'Referencia del voucher del punto *'
  if (method === 'binance') return 'ID de transacción de Binance *'
  return 'Número de referencia *'
}
export const paymentInputToUsd = (value: string, method: SplitPaymentMethod, rate: number | null, cashCurrency: 'USD' | 'VES' = 'USD') => {
  const amount = Number(value)
  if (!Number.isFinite(amount)) return 0
  return usesBolivares(method, cashCurrency) ? (rate && rate > 0 ? amount / rate : 0) : amount
}
export const usdToPaymentInput = (usd: number, method: SplitPaymentMethod, rate: number | null, cashCurrency: 'USD' | 'VES' = 'USD') =>
  (usesBolivares(method, cashCurrency) ? usd * (rate || 0) : usd).toFixed(2)

export const FOOD_IMAGES: Record<string, string> = {
  arroz: '/optimized/productos/M1.webp',
  noodles: '/optimized/productos/M2.webp',
  lumpia: '/optimized/productos/M13.webp',
  combo: '/optimized/productos/M53.webp',
  proteina: '/optimized/productos/M3.webp',
  bebida: '/optimized/productos/M16.webp',
  extra: '/optimized/productos/M4.webp',
  default: '/optimized/productos/M1.webp'
}

export function getProductImage(product: Product): string {
  if (product.imageUrl) {
    const match = product.imageUrl.match(/^\/productos\/([^/?#]+)\.(?:png|jpe?g|webp)([?#].*)?$/i)
    return match ? `/optimized/productos/${match[1]}.webp${match[2] || ''}` : product.imageUrl
  }
  const nameLower = product.name.toLowerCase()
  if (nameLower.includes('chaufa') || nameLower.includes('arroz')) return FOOD_IMAGES.arroz
  if (nameLower.includes('chow mein') || nameLower.includes('noodle')) return FOOD_IMAGES.noodles
  if (nameLower.includes('lumpia')) return FOOD_IMAGES.lumpia
  if (nameLower.includes('agridulce') || nameLower.includes('pollo')) return FOOD_IMAGES.proteina
  if (nameLower.includes('camaron') || nameLower.includes('camarón')) return FOOD_IMAGES.extra
  if (nameLower.includes('refresco') || nameLower.includes('agua') || nameLower.includes('bebida')) return FOOD_IMAGES.bebida
  return FOOD_IMAGES[product.category] || FOOD_IMAGES.default
}

// Cache a nivel de módulo: al volver a Ventas se muestra el catálogo de la
// última visita al instante, sin el parpadeo de "Cargando...", mientras se
// refresca en segundo plano.
export const CAJA_PRODUCTS_CACHE_KEY = 'fullchina:caja-products:v1'
export const CAJA_DRAFT_KEY = 'fullchina:caja-draft:v1'
export const CAJA_DRAFT_MAX_AGE_MS = 10 * 60 * 1000

export type CajaDraft = {
  cart?: CartItem[]
  orderType?: OrderType
  tableNumber?: number | null
  deliveryFee?: string
  customerName?: string
  orderNotes?: string
  savedAt?: number
}

export function clearCajaDraft() {
  try { localStorage.removeItem(CAJA_DRAFT_KEY) } catch { /* storage bloqueado */ }
}

export function readCajaDraft(): CajaDraft | null {
  try {
    const draft = JSON.parse(localStorage.getItem(CAJA_DRAFT_KEY) || 'null') as CajaDraft | null
    if (!draft || typeof draft.savedAt !== 'number' || !Number.isFinite(draft.savedAt) || Date.now() - draft.savedAt > CAJA_DRAFT_MAX_AGE_MS) {
      if (draft) clearCajaDraft()
      return null
    }
    return draft
  } catch { return null }
}

