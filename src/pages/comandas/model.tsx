/* eslint-disable react-refresh/only-export-components -- módulo de constantes/helpers con iconos JSX, no se recarga como componente */
import { type PaymentMethod, type FullOrder } from '../../lib/dataService'
import { type ComandaStatus } from '../../lib/comandaWorkflow'
import { type ThermalReceiptData } from '../../lib/thermalReceipt'
import { Clock, CheckCircle, Package, Truck, CreditCard, Banknote, Smartphone, Landmark, Hexagon, Split, WalletCards } from 'lucide-react'


export const PAYMENT_METHODS = [
  { method: 'cash', label: 'Efectivo', icon: <Banknote size={16} strokeWidth={1.8} /> },
  { method: 'mobile', label: 'Pago móvil', icon: <Smartphone size={16} strokeWidth={1.8} /> },
  { method: 'card', label: 'Punto', icon: <CreditCard size={16} strokeWidth={1.8} /> },
  { method: 'transfer', label: 'Transferencia', icon: <Landmark size={16} strokeWidth={1.8} /> },
  { method: 'binance', label: 'Binance', icon: <Hexagon size={16} strokeWidth={1.8} /> },
  { method: 'personal_account', label: 'Cuenta personal', icon: <WalletCards size={16} strokeWidth={1.8} /> },
  { method: 'credit', label: 'Crédito', icon: <CreditCard size={16} strokeWidth={1.8} /> },
  { method: 'split', label: 'Pago combinado', icon: <Split size={16} strokeWidth={1.8} /> },
] as const

export type ActivePaymentMethod = Exclude<PaymentMethod, 'other' | 'zelle'> | 'credit'
export type SplitPaymentMethod = Exclude<PaymentMethod, 'other' | 'zelle' | 'personal_account'>
export const SPLIT_PAYMENT_METHODS = PAYMENT_METHODS.filter(
  (item): item is (typeof PAYMENT_METHODS)[number] & { method: SplitPaymentMethod } => item.method !== 'split' && item.method !== 'personal_account',
)
export const usesBolivares = (method: SplitPaymentMethod) => method === 'mobile' || method === 'card' || method === 'transfer'
export const requiresPaymentReference = (method: SplitPaymentMethod) => method !== 'cash'
export const paymentReferenceLabel = (method: SplitPaymentMethod) => {
  if (method === 'card') return 'Referencia del voucher del punto *'
  if (method === 'binance') return 'ID de transacción de Binance *'
  return 'Número de referencia *'
}
export const paymentInputToUsd = (value: string, method: SplitPaymentMethod, rate: number | null) => {
  const amount = Number(value)
  if (!Number.isFinite(amount)) return 0
  return usesBolivares(method) ? (rate && rate > 0 ? amount / rate : 0) : amount
}
export const usdToPaymentInput = (usd: number, method: SplitPaymentMethod, rate: number | null) =>
  (usesBolivares(method) ? usd * (rate || 0) : usd).toFixed(2)

export interface ComandaItem {
  id: string
  name: string
  quantity: number
  unitPrice?: number
  subtotal?: number
  observations?: string
  modifiers?: Array<{ optionName: string; modifierName: string; quantity: number; price: number }>
}

export interface ComandaOrder {
  id: string
  orderNumber: string
  time: string
  date?: string
  createdAt?: string
  isRetraso?: boolean
  customerId?: string | null
  customerName: string
  customerPhone?: string
  customerIdentification?: string
  address?: string
  reference?: string
  paymentReference?: string
  orderType: string
  deliveryProvider?: string
  items: ComandaItem[]
  notes?: string
  paymentMethod: string
  payments?: Array<{ method: PaymentMethod; amount: number; referenceNumber?: string | null; receivedAmount?: number | null; receivedCurrency?: 'USD' | 'VES' | null; changeAmount?: number | null; changeCurrency?: 'USD' | 'VES' | null }>
  paymentType: 'card' | 'cash' | 'app' | 'pending'
  isPaid: boolean
  creditAuthorized?: boolean
  totalAmount?: number
  balanceDue?: number
  serviceCharge?: number
  discount?: number
  bcvRate?: number
  elapsedMins: number
  status: ComandaStatus
  deliveredTime?: string
  attendedBy?: string
  source?: 'pos' | 'web'
  webRequestId?: string
}

export function mapFullOrderToComanda(order: FullOrder): ComandaOrder {
  const date = new Date(order.createdAt)
  const paymentMethods = [...new Set(order.payments.map(payment => payment.method))]
  const paymentLabels: Partial<Record<PaymentMethod, string>> = {
    cash: 'Efectivo', mobile: 'Pago móvil', card: 'Punto', transfer: 'Transferencia',
    binance: 'Binance', zelle: 'Zelle', other: 'Otro', personal_account: 'Cuenta personal',
  }
  const paymentMethod = paymentMethods.length > 1
    ? 'Pago combinado'
    : paymentMethods.length === 1
      ? `Pago: ${paymentLabels[paymentMethods[0]] ?? 'Pago registrado'}`
      : 'Pago registrado'

  return {
    id: order.id,
    orderNumber: `#FC-${String(order.orderNumber).padStart(6, '0')}`,
    time: date.toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit' }),
    date: date.toLocaleDateString('es-VE', { day: '2-digit', month: '2-digit', year: 'numeric' }),
    createdAt: order.createdAt,
    customerId: order.customerId,
    customerName: order.customerName || 'Cliente general',
    customerPhone: order.customerPhone || undefined,
    customerIdentification: order.customerIdentification || undefined,
    address: order.orderType === 'delivery' ? order.customerAddress || '' : '',
    orderType: order.orderType === 'takeaway' ? 'Para llevar' : order.orderType === 'delivery' ? 'Delivery' : order.tableNumber ? `Mesa ${order.tableNumber}` : 'Mesa',
    items: order.items.map(item => ({
      id: item.id,
      name: item.productName,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      subtotal: item.quantity * item.unitPrice,
      modifiers: item.modifiers ?? [],
    })),
    notes: order.notes || '',
    paymentMethod: order.status === 'paid' ? paymentMethod : '⚠️ Sin pagar',
    payments: order.payments.map(payment => ({ method: payment.method, amount: payment.amount, referenceNumber: payment.referenceNumber, receivedAmount: payment.receivedAmount, receivedCurrency: payment.receivedCurrency, changeAmount: payment.changeAmount, changeCurrency: payment.changeCurrency })),
    paymentType: order.status !== 'paid' ? 'pending' : paymentMethods.includes('cash') ? 'cash' : paymentMethods.includes('mobile') || paymentMethods.includes('transfer') ? 'app' : 'card',
    isPaid: order.status === 'paid',
    creditAuthorized: order.creditAuthorized,
    totalAmount: order.totalAmount,
    balanceDue: Math.max(0, order.totalAmount - order.payments.reduce((sum, payment) => sum + payment.amount, 0)),
    serviceCharge: 0,
    discount: 0,
    bcvRate: order.bcvRate || undefined,
    elapsedMins: Math.max(0, Math.floor((Date.now() - date.getTime()) / 60000)),
    status: order.fulfillmentStatus,
    deliveredTime: order.fulfillmentStatus === 'delivered' ? date.toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit' }) : undefined,
    attendedBy: 'Usuario del sistema',
    source: 'pos',
  }
}

export function thermalReceiptForComanda(order: ComandaOrder): ThermalReceiptData {
  const table = order.orderType.match(/^Mesa\s+(\d+)/i)?.[1]
  const fallbackDate = order.date?.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
  const createdAt = order.createdAt ?? (fallbackDate
    ? new Date(Number(fallbackDate[3]), Number(fallbackDate[2]) - 1, Number(fallbackDate[1])).toISOString()
    : new Date().toISOString())
  return {
    kind: order.isPaid ? 'venta' : 'precuenta',
    orderNumber: order.orderNumber,
    createdAt,
    orderType: order.orderType,
    tableNumber: table ? Number(table) : null,
    employeeName: order.attendedBy || 'Usuario del sistema',
    customerName: order.customerName || 'Cliente general',
    notes: order.notes,
    items: order.items.map(item => ({
      name: item.name,
      quantity: item.quantity,
      unitPrice: item.unitPrice ?? 0,
      modifiers: item.modifiers?.map(modifier => ({
        name: modifier.optionName,
        quantity: modifier.quantity,
        unitPrice: modifier.price,
      })),
    })),
    totalUsd: order.totalAmount ?? 0,
    bcvRate: order.bcvRate,
    payments: order.payments?.map(payment => ({
      method: payment.method,
      amount: payment.amount,
      referenceNumber: payment.referenceNumber,
      receivedAmount: payment.receivedAmount,
      receivedCurrency: payment.receivedCurrency,
      changeAmount: payment.changeAmount,
      changeCurrency: payment.changeCurrency,
    })) ?? (order.paymentReference ? [{ method: 'other', amount: order.totalAmount ?? 0, referenceNumber: order.paymentReference }] : []),
  }
}

export const MOCK_COMANDAS: ComandaOrder[] = []

export const DEMO_CUSTOMERS = [
  'María González', 'Carlos Ramírez', 'Andrea Pérez', 'José Martínez', 'Valentina Rojas',
  'Luis Hernández', 'Gabriela Silva', 'Miguel Torres', 'Daniela Vargas', 'Ricardo Mendoza',
  'Paola Castillo', 'Santiago Núñez', 'Camila Ortega', 'Diego Salazar', 'Natalia Romero',
]

export const DEMO_PRODUCTS = [
  { name: 'Arroz Camarón y Pollo', price: 6 },
  { name: 'Arroz Frito Especial', price: 7 },
  { name: 'Tallarín de Arroz Mixto', price: 8 },
  { name: 'Lumpias', price: 3 },
  { name: 'Costillas Agridulces', price: 9 },
  { name: 'Chop Suey Mixto', price: 8.5 },
  { name: 'Wonton', price: 3 },
  { name: 'Papas Fritas', price: 3 },
]

export function createDemoComandas(): ComandaOrder[] {
  const now = Date.now()
  const statusGroups: Array<{ status: ComandaOrder['status']; count: number; baseMinutes: number }> = [
    { status: 'new', count: 9, baseMinutes: 3 },
    { status: 'preparing', count: 8, baseMinutes: 9 },
    { status: 'ready', count: 7, baseMinutes: 16 },
    { status: 'delivered', count: 3, baseMinutes: 28 },
  ]
  let orderIndex = 0

  return statusGroups.flatMap(({ status, count, baseMinutes }) =>
    Array.from({ length: count }, (_, statusIndex) => {
      const index = orderIndex++
      const elapsedMins = baseMinutes + statusIndex * (status === 'preparing' ? 4 : 3)
      const createdAt = new Date(now - elapsedMins * 60_000)
      const itemCount = 2 + (index % 3)
      const items = Array.from({ length: itemCount }, (__, itemIndex) => {
        const product = DEMO_PRODUCTS[(index + itemIndex * 2) % DEMO_PRODUCTS.length]
        const quantity = itemIndex === 0 && index % 4 === 0 ? 2 : 1
        return {
          id: `demo-item-${index}-${itemIndex}`,
          name: product.name,
          quantity,
          unitPrice: product.price,
          subtotal: product.price * quantity,
          observations: itemIndex === 0 && index % 5 === 0 ? 'Sin cebollín' : undefined,
        }
      })
      const orderType = index % 3 === 0 ? `Mesa ${(index % 8) + 1}` : index % 3 === 1 ? 'Para llevar' : 'Delivery'
      const isPaid = index % 4 !== 0
      const totalAmount = items.reduce((total, item) => total + (item.subtotal ?? 0), 0) + (orderType === 'Delivery' ? 2 : 0)

      return {
        id: `demo-order-${index + 1}`,
        orderNumber: `#FC-D${String(index + 1).padStart(3, '0')}`,
        time: createdAt.toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit' }),
        date: createdAt.toLocaleDateString('es-VE'),
        createdAt: createdAt.toISOString(),
        isRetraso: status !== 'ready' && status !== 'delivered' && elapsedMins >= 20,
        customerName: DEMO_CUSTOMERS[index % DEMO_CUSTOMERS.length],
        customerPhone: `0414-${String(1200000 + index * 731).slice(0, 7)}`,
        address: orderType === 'Delivery' ? `Sector ${index % 2 === 0 ? 'La Floresta' : 'Centro'}, punto de referencia demo` : '',
        reference: orderType === 'Delivery' ? 'Frente a la plaza' : '',
        orderType,
        items,
        notes: index % 6 === 0 ? 'Empacar salsas por separado.' : '',
        paymentMethod: isPaid ? (index % 2 === 0 ? 'Pago: Pago móvil' : 'Pago: Efectivo $') : '⚠️ Sin pagar',
        paymentType: isPaid ? (index % 2 === 0 ? 'app' : 'cash') : 'pending',
        isPaid,
        totalAmount,
        serviceCharge: 0,
        discount: 0,
        bcvRate: 798.33,
        elapsedMins,
        status,
        deliveredTime: status === 'delivered' ? createdAt.toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit' }) : undefined,
        attendedBy: index % 2 === 0 ? 'Ana · Caja' : 'Luis · Caja',
        source: 'pos',
      }
    })
  )
}

// La ubicación GPS del cliente llega dentro de las notas del pedido web como un
// link de Google Maps. Estos helpers la extraen para mostrar un botón de mapa y
// limpian esa línea del texto de notas visible.
export const MAPS_URL_RE = /https?:\/\/(?:maps\.google\.[a-z.]+|www\.google\.[a-z.]+\/maps|maps\.app\.goo\.gl|goo\.gl\/maps)\S*/i

export function formatElapsed(mins: number): string {
  if (mins < 60) return `${mins} min`
  const hours = Math.floor(mins / 60)
  const rest = mins % 60
  if (hours < 24) return rest > 0 ? `${hours}h ${rest}min` : `${hours}h`
  const days = Math.floor(hours / 24)
  const restHours = hours % 24
  return restHours > 0 ? `${days}d ${restHours}h` : `${days}d`
}

export function compactPaymentLabel(label: string): string {
  return label.replace(/^pago:\s*/i, '')
}

export function compactCardTime(time?: string): string {
  return (time || '').replace(/\s*[ap]\.\s*m\.$/i, '')
}

export function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[1][0]).toUpperCase()
}

export function extractMapsUrl(notes?: string): string | null {
  if (!notes) return null
  const url = notes.match(MAPS_URL_RE)
  if (url) return url[0]
  const coords = notes.match(/(-?\d{1,3}\.\d+)\s*,\s*(-?\d{1,3}\.\d+)/)
  return coords ? `https://maps.google.com/?q=${coords[1]},${coords[2]}` : null
}

export function cleanNotes(notes?: string): string {
  if (!notes) return ''
  return notes
    .split('\n')
    .filter((line) => !MAPS_URL_RE.test(line) && !/ubicaci[oó]n gps/i.test(line) && !/pago preferido/i.test(line))
    .join('\n')
    .trim()
}

// El método de pago que el cliente eligió en la web viaja en las notas como
// "Pago preferido: <codigos>" (p. ej. "cash" o "cash+mobile"). Se extrae para
// pre-seleccionarlo al cobrar y mostrarlo en la comanda.
export const PAY_METHOD_LABELS: Record<string, string> = {
  cash: 'Efectivo', mobile: 'Pago móvil', card: 'Punto', transfer: 'Transferencia', binance: 'Binance',
}

export function extractPreferredPayment(notes?: string | null): { methods: SplitPaymentMethod[]; label: string } | null {
  if (!notes) return null
  const match = notes.match(/pago preferido:\s*([a-z+]+)/i)
  if (!match) return null
  const methods = match[1]
    .split('+')
    .map((s) => s.trim().toLowerCase())
    .filter((c): c is SplitPaymentMethod => c in PAY_METHOD_LABELS)
  if (methods.length === 0) return null
  return { methods, label: methods.map((c) => PAY_METHOD_LABELS[c]).join(' + ') }
}

export const COLUMNS: Array<{ key: ComandaStatus; label: string; icon: React.ReactNode; color: string }> = [
  { key: 'new', label: 'Nuevas', icon: <Package size={16} />, color: '#ff4d3d' },
  { key: 'preparing', label: 'En preparación', icon: <Clock size={16} />, color: '#f97316' },
  { key: 'ready', label: 'Listas', icon: <CheckCircle size={16} />, color: '#10b981' },
  { key: 'delivered', label: 'Entregadas', icon: <Truck size={16} />, color: '#3b82f6' },
]

export const COLUMN_PREVIEW_LIMIT = 6
