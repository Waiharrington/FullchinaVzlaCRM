import type { FinancialAccount, FullOrder, PaymentMethod } from './dataService'

export interface PaymentBreakdownEntry {
  key: string
  method: PaymentMethod
  currency: 'USD' | 'VES'
  amountUsd: number
  amountNative: number
}

const legacyCurrency = (method: PaymentMethod): 'USD' | 'VES' =>
  method === 'mobile' || method === 'card' ? 'VES' : 'USD'

export function buildPaymentBreakdown(
  orders: FullOrder[],
  accounts: FinancialAccount[],
  fallbackBcvRate: number | null,
): Record<string, PaymentBreakdownEntry> {
  const accountCurrencies = new Map(accounts.map(account => [account.id, account.currency]))
  const result: Record<string, PaymentBreakdownEntry> = {}

  for (const order of orders) {
    const historicalRate = order.bcvRate && order.bcvRate > 0 ? order.bcvRate : fallbackBcvRate || 0
    for (const payment of order.payments) {
      const currency = (payment.accountId ? accountCurrencies.get(payment.accountId) : null) ?? legacyCurrency(payment.method)
      const key = `${payment.method}:${currency}`
      const amountUsd = Number(payment.amount) || 0
      const amountNative = currency === 'VES' ? amountUsd * historicalRate : amountUsd
      const current = result[key]

      if (current) {
        current.amountUsd += amountUsd
        current.amountNative += amountNative
      } else {
        result[key] = { key, method: payment.method, currency, amountUsd, amountNative }
      }
    }
  }

  return result
}
