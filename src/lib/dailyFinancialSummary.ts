export interface DailyFinancialRow {
  date: string
  day: number
  sales: number
  purchases: number
  fixedExpenses: number
  variableExpenses: number
  otherExpenses: number
  totalOutflows: number
  difference: number
}

interface OrderInput { createdAt: string; status: string; totalAmount: number }
interface PurchaseInput { purchaseDate: string; totalAmount: number }
interface ExpenseInput { expenseDate: string; category: string; amount: number }

const isoDate = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
const localDate = (dateTime: string) => isoDate(new Date(dateTime))

export function buildDailyFinancialRows(
  month: string,
  orders: OrderInput[],
  purchases: PurchaseInput[],
  expenses: ExpenseInput[],
): DailyFinancialRow[] {
  const [year, monthNumber] = month.split('-').map(Number)
  const days = new Date(year, monthNumber, 0).getDate()
  const rows = Array.from({ length: days }, (_, index) => {
    const day = index + 1
    const date = `${month}-${String(day).padStart(2, '0')}`
    const sales = orders.filter(order => order.status === 'paid' && localDate(order.createdAt) === date).reduce((sum, order) => sum + order.totalAmount, 0)
    const dayPurchases = purchases.filter(purchase => purchase.purchaseDate === date).reduce((sum, purchase) => sum + purchase.totalAmount, 0)
    const dayExpenses = expenses.filter(expense => expense.expenseDate === date)
    const fixedExpenses = dayExpenses.filter(expense => expense.category === 'fixed').reduce((sum, expense) => sum + expense.amount, 0)
    const variableExpenses = dayExpenses.filter(expense => expense.category === 'variable').reduce((sum, expense) => sum + expense.amount, 0)
    const otherExpenses = dayExpenses.filter(expense => !['fixed', 'variable'].includes(expense.category)).reduce((sum, expense) => sum + expense.amount, 0)
    const totalOutflows = dayPurchases + fixedExpenses + variableExpenses + otherExpenses
    return { date, day, sales, purchases: dayPurchases, fixedExpenses, variableExpenses, otherExpenses, totalOutflows, difference: sales - totalOutflows }
  })
  return rows
}

export function weekRangeFor(dateIso: string) {
  const date = new Date(`${dateIso}T12:00:00`)
  const monday = new Date(date)
  monday.setDate(date.getDate() - ((date.getDay() + 6) % 7))
  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)
  return { start: isoDate(monday), end: isoDate(sunday) }
}

export function sumFinancialRows(rows: DailyFinancialRow[]) {
  return rows.reduce((total, row) => ({
    sales: total.sales + row.sales,
    purchases: total.purchases + row.purchases,
    fixedExpenses: total.fixedExpenses + row.fixedExpenses,
    variableExpenses: total.variableExpenses + row.variableExpenses,
    otherExpenses: total.otherExpenses + row.otherExpenses,
    totalOutflows: total.totalOutflows + row.totalOutflows,
    difference: total.difference + row.difference,
  }), { sales: 0, purchases: 0, fixedExpenses: 0, variableExpenses: 0, otherExpenses: 0, totalOutflows: 0, difference: 0 })
}
