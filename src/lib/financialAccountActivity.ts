export interface AccountActivityInput {
  id: string
  currency: 'USD' | 'VES'
}

interface PaymentInput {
  amount: number
  accountId?: string | null
  method?: string | null
  receivedAmount?: number | null
  receivedCurrency?: 'USD' | 'VES' | null
  receivedExchangeRate?: number | null
  changeAmount?: number | null
  changeCurrency?: 'USD' | 'VES' | null
  changeExchangeRate?: number | null
  changeAccountId?: string | null
}
interface OrderInput { status: string; createdAt: string; bcvRate: number | null; payments: PaymentInput[] }
interface ExpenseInput { expenseDate: string; amount: number; accountId: string | null; exchangeRate: number | null; payments?: PaymentInput[] }
interface PurchaseInput { purchaseDate: string; totalAmount: number; accountId: string | null; exchangeRate: number | null; isPaid: boolean; isVoided?: boolean; payments?: PaymentInput[] }

export interface AccountActivity {
  inflows: number
  outflows: number
  net: number
}

const isoDate = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
const inRange = (date: string, start: string, end: string) => date >= start && date <= end
const accountAmount = (usd: number, currency: 'USD' | 'VES', rate: number | null) => currency === 'VES' ? usd * (rate || 0) : usd

export function buildFinancialAccountActivity(
  accounts: AccountActivityInput[],
  orders: OrderInput[],
  expenses: ExpenseInput[],
  purchases: PurchaseInput[],
  start: string,
  end: string,
): Map<string, AccountActivity> {
  const result = new Map(accounts.map(account => [account.id, { inflows: 0, outflows: 0, net: 0 }]))
  const currencies = new Map(accounts.map(account => [account.id, account.currency]))

  for (const order of orders) {
    if (order.status !== 'paid' || !inRange(isoDate(new Date(order.createdAt)), start, end)) continue
    for (const payment of order.payments) {
      if (payment.accountId && result.has(payment.accountId)) {
        const currency = currencies.get(payment.accountId)!
        const row = result.get(payment.accountId)!
        const nativeCash = payment.method === 'cash' && payment.receivedAmount != null && payment.receivedCurrency
        row.inflows += nativeCash
          ? payment.receivedCurrency === currency
            ? payment.receivedAmount!
            : payment.receivedCurrency === 'VES'
              ? payment.receivedAmount! / (payment.receivedExchangeRate || order.bcvRate || 0)
              : payment.receivedAmount! * (payment.receivedExchangeRate || order.bcvRate || 0)
          : accountAmount(payment.amount, currency, order.bcvRate)
      }
      if (payment.changeAccountId && payment.changeAmount != null && payment.changeCurrency && result.has(payment.changeAccountId)) {
        const currency = currencies.get(payment.changeAccountId)!
        const row = result.get(payment.changeAccountId)!
        const change = payment.changeCurrency === currency
          ? payment.changeAmount
          : payment.changeCurrency === 'VES'
            ? payment.changeAmount / (payment.changeExchangeRate || order.bcvRate || 0)
            : payment.changeAmount * (payment.changeExchangeRate || order.bcvRate || 0)
        row.outflows += change
      }
    }
  }
  for (const expense of expenses) {
    if (!inRange(expense.expenseDate, start, end)) continue
    if (expense.payments?.length) {
      for (const payment of expense.payments) {
        if (payment.accountId && result.has(payment.accountId)) result.get(payment.accountId)!.outflows += payment.amount
      }
    } else if (expense.accountId && result.has(expense.accountId)) {
      result.get(expense.accountId)!.outflows += accountAmount(expense.amount, currencies.get(expense.accountId)!, expense.exchangeRate)
    }
  }
  for (const purchase of purchases) {
    if (purchase.isVoided || !purchase.isPaid || !inRange(purchase.purchaseDate, start, end)) continue
    if (purchase.payments?.length) {
      for (const payment of purchase.payments) {
        if (payment.accountId && result.has(payment.accountId)) result.get(payment.accountId)!.outflows += payment.amount
      }
    } else if (purchase.accountId && result.has(purchase.accountId)) {
      result.get(purchase.accountId)!.outflows += accountAmount(purchase.totalAmount, currencies.get(purchase.accountId)!, purchase.exchangeRate)
    }
  }
  for (const row of result.values()) row.net = row.inflows - row.outflows
  return result
}
