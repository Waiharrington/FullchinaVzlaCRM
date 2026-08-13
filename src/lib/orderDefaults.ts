import type { PaymentMethod } from './dataService'

export type OrderType = 'dine-in' | 'takeaway' | 'delivery'

// En mesa se sugiere el punto; para llevar y delivery suelen confirmarse por
// pago móvil. La persona puede cambiar el método dentro del modal de cobro.
export function defaultPaymentForOrderType(orderType: OrderType): PaymentMethod {
  return orderType === 'dine-in' ? 'card' : 'mobile'
}
