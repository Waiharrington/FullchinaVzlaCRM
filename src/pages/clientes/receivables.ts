import type { Credit, CustomerOrderSummary } from '../../lib/dataService'

const DAY_MS = 86400000

// Créditos con saldo pendiente: lo único que se muestra en cuentas por cobrar.
export function activeCredits(credits: Credit[]): Credit[] {
  return credits.filter(credit => credit.balancePending > 0)
}

// Créditos con saldo ligados a una comanda y a un cliente (los que se pueden detallar).
export function linkedCredits(credits: Credit[]): Credit[] {
  return activeCredits(credits).filter(credit => credit.orderId && credit.customerId)
}

export function daysOutstanding(createdAt: string, now = Date.now()): number {
  return Math.max(0, Math.floor((now - new Date(createdAt).getTime()) / DAY_MS))
}

export function creditInitials(customerName: string): string {
  return customerName.split(' ').filter(Boolean).slice(0, 2).map(part => part[0]).join('').toUpperCase()
}

export function receivablePaymentNote(order: Pick<CustomerOrderSummary, 'orderNumber'> | undefined): string {
  return order?.orderNumber ? `Pago de comanda #${order.orderNumber}` : 'Abono a cuenta por cobrar'
}
