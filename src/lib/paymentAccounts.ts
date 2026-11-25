import type { FinancialAccount } from './dataService'
import type { SplitPaymentMethod } from './paymentInput'

/** Cuentas donde puede ingresar el dinero de un método de pago (misma regla en Ventas y Comandas). */
export function accountsForPaymentMethod(
  financialAccounts: FinancialAccount[],
  method: SplitPaymentMethod,
  cashCurrency: 'USD' | 'VES',
): FinancialAccount[] {
  const paymentAccounts = financialAccounts.filter(account => account.acceptsCustomerPayments)
  if (method === 'cash') return paymentAccounts.filter(a => a.accountType === 'cash' && a.currency === cashCurrency)
  if (method === 'mobile') return paymentAccounts
    .filter(a => a.currency === 'VES' && a.accountType === 'bank' && ['Banco Exterior', 'Banesco'].includes(a.name))
    .sort((a, b) => Number(b.name === 'Banco Exterior') - Number(a.name === 'Banco Exterior'))
  if (method === 'transfer') return paymentAccounts.filter(a => a.currency === 'VES' && a.accountType === 'bank')
  if (method === 'card') return paymentAccounts.filter(a => a.currency === 'VES' && a.name === 'Punto de venta')
  if (method === 'binance') return paymentAccounts.filter(a => a.currency === 'USD' && ['bank', 'digital'].includes(a.accountType))
  return paymentAccounts
}

/** Respeta la elección si sigue siendo válida para el método; si no, usa la primera cuenta disponible. */
export function resolveAccountChoice(choice: string, options: FinancialAccount[]): string {
  return options.some(account => account.id === choice) ? choice : options[0]?.id ?? ''
}
