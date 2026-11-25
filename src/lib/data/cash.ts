import { client } from './client'
import type { DailyCloseSummary, CashMovement, CashSessionSnapshot, CashTransaction } from './types'

function mapCashSession(value: Record<string, unknown>): CashSessionSnapshot {
  const numberValue = (key: string): number => Number(value[key] ?? 0)
  const nullableNumber = (key: string): number | null => value[key] == null ? null : Number(value[key])
  const breakdown = (value.paymentBreakdown ?? {}) as Record<string, unknown>
  const breakdownVes = (value.paymentBreakdownVes ?? {}) as Record<string, unknown>
  return {
    id: String(value.id),
    sessionNumber: numberValue('sessionNumber'),
    registerId: String(value.registerId),
    registerCode: String(value.registerCode),
    registerName: String(value.registerName),
    status: value.status as 'open' | 'closed',
    openedAt: String(value.openedAt),
    openedBy: String(value.openedBy),
    openingCashUsd: numberValue('openingCashUsd'),
    openingCashVes: numberValue('openingCashVes'),
    cashSalesUsd: numberValue('cashSalesUsd'),
    cashSalesVes: numberValue('cashSalesVes'),
    paymentTotal: numberValue('paymentTotal'),
    paymentBreakdown: Object.fromEntries(Object.entries(breakdown).map(([key, amount]) => [key, Number(amount)])),
    paymentBreakdownVes: Object.fromEntries(Object.entries(breakdownVes).map(([key, amount]) => [key, Number(amount)])),
    movementInUsd: numberValue('movementInUsd'),
    movementOutUsd: numberValue('movementOutUsd'),
    movementInVes: numberValue('movementInVes'),
    movementOutVes: numberValue('movementOutVes'),
    expectedCashUsd: numberValue('expectedCashUsd'),
    expectedCashVes: numberValue('expectedCashVes'),
    countedCashUsd: nullableNumber('countedCashUsd'),
    countedCashVes: nullableNumber('countedCashVes'),
    differenceUsd: nullableNumber('differenceUsd'),
    differenceVes: nullableNumber('differenceVes'),
    closedAt: value.closedAt == null ? null : String(value.closedAt),
    movements: Array.isArray(value.movements)
      ? value.movements.map((movement: Record<string, unknown>) => ({
          id: String(movement.id),
          direction: movement.direction as 'in' | 'out',
          movementType: movement.movementType as CashMovement['movementType'],
          currency: movement.currency as 'USD' | 'VES',
          amount: Number(movement.amount),
          description: String(movement.description),
          referenceNumber: movement.referenceNumber == null ? null : String(movement.referenceNumber),
          createdAt: String(movement.createdAt),
        }))
      : [],
  }
}

export async function getActiveCashSession(): Promise<CashSessionSnapshot | null> {
  const { data, error } = await client().rpc('fn_get_active_cash_session', { p_register_code: 'caja-principal' })
  if (error) throw error
  return data ? mapCashSession(data as Record<string, unknown>) : null
}

export async function openCashSession(params: {
  openingCashUsd: number
  openingCashVes: number
  notes?: string | null
  userId: string
}): Promise<string> {
  const { data, error } = await client().rpc('fn_open_cash_session', {
    p_register_code: 'caja-principal',
    p_opening_cash_usd: params.openingCashUsd,
    p_opening_cash_ves: params.openingCashVes,
    p_notes: params.notes ?? null,
  })
  if (error) throw error
  return data as string
}

export async function addCashMovement(params: {
  sessionId: string
  direction: 'in' | 'out'
  movementType: CashMovement['movementType']
  currency: 'USD' | 'VES'
  amount: number
  description: string
  referenceNumber?: string | null
  userId: string
}): Promise<string> {
  const { data, error } = await client().rpc('fn_add_cash_movement', {
    p_session_id: params.sessionId,
    p_direction: params.direction,
    p_movement_type: params.movementType,
    p_currency: params.currency,
    p_amount: params.amount,
    p_description: params.description,
    p_reference_number: params.referenceNumber ?? null,
  })
  if (error) throw error
  return data as string
}

export async function closeCashSession(params: {
  sessionId: string
  countedCashUsd: number
  countedCashVes: number
  notes?: string | null
}): Promise<CashSessionSnapshot> {
  const { data, error } = await client().rpc('fn_close_cash_session', {
    p_session_id: params.sessionId,
    p_counted_cash_usd: params.countedCashUsd,
    p_counted_cash_ves: params.countedCashVes,
    p_notes: params.notes ?? null,
  })
  if (error) throw error
  return mapCashSession(data as Record<string, unknown>)
}

export async function getCashSessionHistory(limit = 20): Promise<CashSessionSnapshot[]> {
  const { data, error } = await client().rpc('fn_get_cash_session_history', { p_limit: limit })
  if (error) throw error
  return (data ?? []).map((item: Record<string, unknown>) => mapCashSession(item))
}

export async function getRecentCashSessionDiscrepancy(): Promise<CashSessionSnapshot | null> {
  const sessions = await getCashSessionHistory(1)
  const latest = sessions[0]
  return latest?.status === 'closed' && (Math.abs(latest.differenceUsd ?? 0) >= 0.01 || Math.abs(latest.differenceVes ?? 0) >= 0.01)
    ? latest
    : null
}

export async function getCashSessionTransactions(sessionId: string): Promise<CashTransaction[]> {
  const { data, error } = await client().rpc('fn_get_cash_session_transactions', { p_session_id: sessionId })
  if (error) throw error
  return ((data ?? []) as Record<string, unknown>[]).map(t => ({
    id: String(t.id),
    kind: t.kind as 'payment' | 'movement',
    direction: t.direction as 'in' | 'out',
    orderNumber: t.orderNumber != null ? Number(t.orderNumber) : null,
    orderType: t.orderType as string | null,
    customerName: t.customerName as string | null,
    method: String(t.method),
    currency: t.currency === 'VES' ? 'VES' : 'USD',
    amount: Number(t.amount),
    referenceNumber: t.referenceNumber as string | null,
    createdAt: String(t.createdAt),
    itemsSummary: t.itemsSummary as string | null,
  }))
}

export async function createDailyClose(date: string, notes?: string): Promise<string> {
  const { data, error } = await client().rpc('fn_create_daily_close', {
    p_close_date: date,
    p_notes: notes ?? null,
  })
  if (error) throw error
  return data as string
}

export async function getDailyCloses(): Promise<DailyCloseSummary[]> {
  const { data, error } = await client().rpc('fn_get_daily_close_summary')

  if (error) throw error

  return (data ?? []).map((d: Record<string, unknown>) => ({
    id: d.id as string,
    closeDate: d.close_date as string,
    totalSales: Number(d.total_sales),
    totalPayments: Number(d.total_payments),
    totalExpenses: Number(d.total_expenses ?? 0),
    totalCredits: Number(d.total_credits ?? 0),
    balance: Number(d.balance ?? 0),
    notes: (d.notes as string) ?? null,
    closedBy: d.closed_by as string,
  }))
}

// --- Gastos ------------------------------------------------------------------

