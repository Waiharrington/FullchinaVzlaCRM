export interface AccountActivityInput {
  id: string
  currency: 'USD' | 'VES'
}

interface PaymentInput { amount: number; accountId?: string | null }
interface OrderInput { status: string; createdAt: string; bcvRate: number | null; payments: PaymentInput[] }
interface ExpenseInput { expenseDate: string; amount: number; accountId: string | null; exchangeRate: number | null }
interface PurchaseInput { purchaseDate: string; totalAmount: number; accountId: string | null; exchangeRate: number | null; isPaid: boolean }

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
      if (!payment.accountId || !result.has(payment.accountId)) continue
      const row = result.get(payment.accountId)!
      row.inflows += accountAmount(payment.amount, currencies.get(payment.accountId)!, order.bcvRate)
    }
  }
  for (const expense of expenses) {
    if (!expense.accountId || !result.has(expense.accountId) || !inRange(expense.expenseDate, start, end)) continue
    result.get(expense.accountId)!.outflows += accountAmount(expense.amount, currencies.get(expense.accountId)!, expense.exchangeRate)
  }
  for (const purchase of purchases) {
    if (!purchase.isPaid || !purchase.accountId || !result.has(purchase.accountId) || !inRange(purchase.purchaseDate, start, end)) continue
    result.get(purchase.accountId)!.outflows += accountAmount(purchase.totalAmount, currencies.get(purchase.accountId)!, purchase.exchangeRate)
  }
  for (const row of result.values()) row.net = row.inflows - row.outflows
  return result
}
