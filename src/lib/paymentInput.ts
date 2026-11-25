import type { PaymentMethod } from './dataService'

/** Métodos que se pueden combinar en un pago dividido. */
export type SplitPaymentMethod = Exclude<PaymentMethod, 'zelle' | 'other' | 'personal_account'>

/** ¿El monto de este método se captura en bolívares? (efectivo solo si la moneda es VES) */
export const usesBolivares = (method: SplitPaymentMethod, cashCurrency: 'USD' | 'VES' = 'USD') =>
  method === 'mobile' || method === 'card' || method === 'transfer' || (method === 'cash' && cashCurrency === 'VES')

export const requiresPaymentReference = (method: SplitPaymentMethod) => method !== 'cash'

export const paymentReferenceLabel = (method: SplitPaymentMethod) => {
  if (method === 'card') return 'Referencia del voucher del punto *'
  if (method === 'binance') return 'ID de transacción de Binance *'
  return 'Número de referencia *'
}

/** Convierte lo que escribió el cajero (en la moneda del método) a USD. */
export const paymentInputToUsd = (value: string, method: SplitPaymentMethod, rate: number | null, cashCurrency: 'USD' | 'VES' = 'USD') => {
  const amount = Number(value)
  if (!Number.isFinite(amount)) return 0
  return usesBolivares(method, cashCurrency) ? (rate && rate > 0 ? amount / rate : 0) : amount
}

/** Convierte USD al texto que se muestra en el campo de monto del método. */
export const usdToPaymentInput = (usd: number, method: SplitPaymentMethod, rate: number | null, cashCurrency: 'USD' | 'VES' = 'USD') =>
  (usesBolivares(method, cashCurrency) ? usd * (rate || 0) : usd).toFixed(2)
