/* eslint-disable react-refresh/only-export-components -- constantes y helpers de Clientes */
import { type Credit as CreditType, type CreditPayment, type Customer, type CustomerOrderSummary, type CustomerPurchaseMetric, type Product } from '../../lib/dataService'
import { CreditCard, Bike, Utensils, Package, Banknote, Smartphone, ArrowLeftRight, Coins, Wallet } from 'lucide-react'

export interface CustomerRow {
  id: string
  initials: string
  avatarBg: string
  name: string
  phone: string
  identification: string
  identificationStatus: 'verified_format' | 'legacy_review' | 'missing'
  lastPurchase: string
  totalPurchased: number
  pendingBalance: number
  status: 'Crédito' | 'Frecuente' | 'Activo' | 'Inactivo'
}

export function formatTenure(value: string): string {
  if (!value) return 'Cliente nuevo'
  const start = new Date(value.length <= 10 ? `${value}T12:00:00` : value)
  if (Number.isNaN(start.getTime())) return 'Cliente nuevo'
  const days = Math.max(0, Math.floor((Date.now() - start.getTime()) / 86400000))
  if (days < 1) return 'Cliente nuevo'
  if (days < 30) return `${days} día${days === 1 ? '' : 's'}`
  if (days < 365) { const m = Math.floor(days / 30); return `${m} mes${m === 1 ? '' : 'es'}` }
  const years = Math.floor(days / 365)
  const months = Math.floor((days % 365) / 30)
  return months > 0 ? `${years} año${years === 1 ? '' : 's'} y ${months} mes${months === 1 ? '' : 'es'}` : `${years} año${years === 1 ? '' : 's'}`
}

export function formatRelativeDays(value: string): string {
  if (!value) return ''
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return ''
  const days = Math.max(0, Math.floor((Date.now() - d.getTime()) / 86400000))
  if (days < 1) return 'Hoy'
  if (days === 1) return 'Ayer'
  return `Hace ${days} días`
}

export function formatDate(value: string): string {
  if (!value) return '—'
  const d = new Date(value.length <= 10 ? `${value}T12:00:00` : value)
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('es-VE', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

export function formatDateTime(value: string): string {
  if (!value) return '—'
  const date = new Date(value)
  return Number.isNaN(date.getTime())
    ? '—'
    : date.toLocaleString('es-VE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export function formatUsdText(value: number): string {
  return new Intl.NumberFormat('es-VE', { style: 'currency', currency: 'USD' }).format(value)
}

export function WhatsAppIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" />
      <path d="M12.001 2C6.478 2 2 6.478 2 12c0 1.79.47 3.548 1.362 5.096L2 22l4.99-1.331A9.956 9.956 0 0 0 12.001 22C17.523 22 22 17.523 22 12S17.523 2 12.001 2zm0 18.15a8.126 8.126 0 0 1-4.15-1.132l-.297-.176-3.11.83.83-3.033-.194-.312A8.104 8.104 0 0 1 3.85 12c0-4.49 3.66-8.15 8.15-8.15S20.15 7.51 20.15 12 16.49 20.15 12 20.15z" />
    </svg>
  )
}

export const normalizeCustomerName = (value: string) => value.trim().toLocaleLowerCase('es-VE')

export const AVATAR_COLORS = ['#E31B2B', '#FF4D3D', '#FF9E1B', '#FFC83D', '#b91c1c', '#c2410c']

export function avatarColorFor(name: string): string {
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0
  return AVATAR_COLORS[hash % AVATAR_COLORS.length]
}

// Genera un cliente ficticio con historial completo para previsualizar el
// diseño del perfil localmente. Solo vive en memoria (?demoClient=1 en la
// URL): no lee ni escribe nada en Supabase.
export function buildDemoClientData() {
  const now = Date.now()
  const daysAgo = (n: number) => new Date(now - n * 86400000).toISOString()

  const customer: Customer = {
    id: 'demo-client-001',
    name: 'Valentina Torres (Demo)',
    identification: '27458901',
    phone: '+58 412-555-0198',
    address: 'Av. Principal de Las Mercedes, Res. Los Nardos, Piso 4, Caracas',
    email: 'demo@fullchina.dev',
    totalVisits: 14,
    rewardsUnlocked: 2,
    lastVisit: daysAgo(3),
    favoriteProduct: 'Arroz Chino Especial',
    birthday: '1994-07-22',
    createdAt: daysAgo(430),
    isActive: true,
  }

  const orders: CustomerOrderSummary[] = [
    { id: 'demo-o1', orderNumber: 1042, createdAt: daysAgo(3), orderType: 'delivery', status: 'paid', fulfillmentStatus: 'delivered', total: 28.5, itemsText: '2x Arroz Chino Especial, 1x Wantán Frito', items: [{ productName: 'Arroz Chino Especial', quantity: 2 }, { productName: 'Wantán Frito', quantity: 1 }], paymentMethods: ['mobile'] },
    { id: 'demo-o2', orderNumber: 1017, createdAt: daysAgo(11), orderType: 'dine-in', status: 'paid', fulfillmentStatus: 'delivered', total: 41.9, itemsText: '1x Pollo Agridulce, 2x Tallarines Salteados', items: [{ productName: 'Pollo Agridulce', quantity: 1 }, { productName: 'Tallarines Salteados', quantity: 2 }], paymentMethods: ['card'] },
    { id: 'demo-o3', orderNumber: 986, createdAt: daysAgo(24), orderType: 'takeaway', status: 'paid', fulfillmentStatus: 'delivered', total: 19.0, itemsText: '1x Arroz Chino Especial', items: [{ productName: 'Arroz Chino Especial', quantity: 1 }], paymentMethods: ['cash'] },
    { id: 'demo-o4', orderNumber: 951, createdAt: daysAgo(45), orderType: 'delivery', status: 'paid', fulfillmentStatus: 'delivered', total: 33.2, itemsText: '3x Wantán Frito, 1x Arroz Chino Especial', items: [{ productName: 'Wantán Frito', quantity: 3 }, { productName: 'Arroz Chino Especial', quantity: 1 }], paymentMethods: ['cash'] },
    { id: 'demo-o5', orderNumber: 903, createdAt: daysAgo(80), orderType: 'dine-in', status: 'paid', fulfillmentStatus: 'delivered', total: 52.4, itemsText: '2x Pollo Agridulce, 2x Tallarines Salteados', items: [{ productName: 'Pollo Agridulce', quantity: 2 }, { productName: 'Tallarines Salteados', quantity: 2 }], paymentMethods: ['mobile', 'cash'] },
    { id: 'demo-o6', orderNumber: 844, createdAt: daysAgo(140), orderType: 'delivery', status: 'pending', fulfillmentStatus: 'preparing', total: 22.75, itemsText: '1x Arroz Chino Especial, 1x Wantán Frito', items: [{ productName: 'Arroz Chino Especial', quantity: 1 }, { productName: 'Wantán Frito', quantity: 1 }], paymentMethods: [] },
  ]

  const credits: CreditType[] = [
    { id: 'demo-c1', customerId: customer.id, customerName: customer.name, totalAmount: 60, totalPaid: 35, balancePending: 25, status: 'partial', orderId: 'demo-o6', createdAt: daysAgo(20) },
    { id: 'demo-c2', customerId: customer.id, customerName: customer.name, totalAmount: 40, totalPaid: 40, balancePending: 0, status: 'paid', orderId: 'demo-o4', createdAt: daysAgo(60) },
  ]

  const payments: CreditPayment[] = [
    { id: 'demo-p1', creditId: 'demo-c1', amount: 20, notes: 'Abono parcial', createdBy: 'demo', createdAt: daysAgo(9) },
    { id: 'demo-p2', creditId: 'demo-c1', amount: 15, notes: null, createdBy: 'demo', createdAt: daysAgo(20) },
    { id: 'demo-p3', creditId: 'demo-c2', amount: 40, notes: 'Pago completo', createdBy: 'demo', createdAt: daysAgo(58) },
  ]

  const totalPurchased = orders.filter((o) => o.status === 'paid').reduce((s, o) => s + o.total, 0)

  const metric: CustomerPurchaseMetric = {
    customerId: customer.id,
    customerName: customer.name,
    orderCount: orders.length,
    totalPurchased,
    lastPurchase: orders[0].createdAt,
  }

  const row: CustomerRow = {
    id: customer.id,
    initials: 'VT',
    avatarBg: avatarColorFor(customer.name),
    name: customer.name,
    phone: customer.phone,
    identification: customer.identification,
    identificationStatus: 'verified_format',
    lastPurchase: orders[0].createdAt,
    totalPurchased,
    pendingBalance: credits.reduce((s, c) => s + c.balancePending, 0),
    status: 'Frecuente',
  }

  const demoProducts: Product[] = [
    { id: 'demo-p1', name: 'Arroz Chino Especial', description: null, price: 9.5, cost: null, category: 'Arroz', categories: ['Arroz'], emoji: '🍚', active: true, imageUrl: null },
    { id: 'demo-p2', name: 'Wantán Frito', description: null, price: 6.0, cost: null, category: 'Entradas', categories: ['Entradas'], emoji: '🥟', active: true, imageUrl: null },
    { id: 'demo-p3', name: 'Pollo Agridulce', description: null, price: 12.5, cost: null, category: 'Pollo', categories: ['Pollo'], emoji: '🍗', active: true, imageUrl: null },
    { id: 'demo-p4', name: 'Tallarines Salteados', description: null, price: 8.75, cost: null, category: 'Tallarines', categories: ['Tallarines'], emoji: '🍜', active: true, imageUrl: null },
    { id: 'demo-p5', name: 'Costillas Agridulce', description: null, price: 13.9, cost: null, category: 'Costillas', categories: ['Costillas'], emoji: '🍖', active: true, imageUrl: null },
    { id: 'demo-p6', name: 'Chop Suey Especial', description: null, price: 10.25, cost: null, category: 'Chop Suey', categories: ['Chop Suey'], emoji: '🥡', active: true, imageUrl: null },
  ]

  return { customer, orders, credits, payments, metric, row, products: demoProducts }
}

export const ORDER_TYPE_LABELS: Record<string, string> = {
  'dine-in': 'Mesa', takeaway: 'Para llevar', delivery: 'Delivery',
}

export const ORDER_TYPE_ICONS: Record<string, typeof Utensils> = {
  'dine-in': Utensils, takeaway: Package, delivery: Bike,
}

export const FULFILLMENT_LABELS: Record<string, string> = {
  new: 'Nueva', preparing: 'En preparación', ready: 'Lista', delivered: 'Entregada', cancelled: 'Cancelada',
}

export function formatBirthday(value: string): string {
  if (!value) return ''
  const d = new Date(`${value.slice(0, 10)}T12:00:00`)
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('es-VE', { day: 'numeric', month: 'long' })
}

export const PAYMENT_LABELS: Record<string, string> = {
  cash: 'Efectivo', mobile: 'Pago móvil', card: 'Punto',
  transfer: 'Transferencia', binance: 'Binance', zelle: 'Zelle', other: 'Otro',
}

export const PAYMENT_ICONS: Record<string, typeof Banknote> = {
  cash: Banknote, mobile: Smartphone, card: CreditCard,
  transfer: ArrowLeftRight, binance: Coins, zelle: Wallet, other: Wallet,
}

export function classifyIdentification(value: string): CustomerRow['identificationStatus'] {
  const normalized = value.trim()
  if (!normalized) return 'missing'
  const digits = normalized.replace(/\D/g, '')
  const acceptedFormat = /^(?:[VE]-?)?\d{6,10}$/i.test(normalized)
  const repeatedPlaceholder = /^(\d)\1+$/.test(digits)
  return acceptedFormat && !repeatedPlaceholder ? 'verified_format' : 'legacy_review'
}

