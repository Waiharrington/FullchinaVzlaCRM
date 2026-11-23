import { client } from './client'
import type { PaymentMethod, Credit, CreditPayment, FinancialAccountCreditPayment } from './types'

export async function getCredits(allPages = false): Promise<Credit[]> {
  const rows: Record<string, unknown>[] = []
  let offset = 0
  for (;;) {
    let query = client().from('v_credit_balances').select('*').order('created_at', { ascending: false }).order('credit_id', { ascending: false })
    if (allPages) query = query.range(offset, offset + 499)
    const { data, error } = await query
    if (error) throw error
    const batch = (data ?? []) as Record<string, unknown>[]
    rows.push(...batch)
    if (!allPages || batch.length < 500) break
    offset += 500
  }

  return rows.map((c) => ({
    id: c.credit_id as string,
    customerId: (c.customer_id as string) ?? null,
    customerName: c.customer_name as string,
    totalAmount: Number(c.total_amount),
    totalPaid: Number(c.total_paid),
    balancePending: Number(c.balance_pending),
    status: c.status as string,
    orderId: c.order_id as string,
    createdAt: c.created_at as string,
    dueDate: (c.due_date as string) ?? null,
    isIndefinite: Boolean(c.is_indefinite ?? true),
  }))
}

export async function createCredit(params: {
  orderId?: string | null
  customerId?: string | null
  customerName: string
  totalAmount: number
  dueDate?: string | null
  isIndefinite?: boolean
  notes?: string
  userId: string
}): Promise<string> {
  const { data, error } = await client()
    .from('credits')
    .insert({
      order_id: params.orderId,
      customer_id: params.customerId ?? null,
      customer_name: params.customerName,
      total_amount: params.totalAmount,
      due_date: params.isIndefinite ? null : (params.dueDate ?? null),
      is_indefinite: params.isIndefinite ?? true,
      notes: params.notes ?? null,
      created_by: params.userId,
    })
    .select('id')
    .single()
  if (error) throw error
  return data.id as string
}

export async function authorizeOrderCredit(params: { orderId: string; pin: string }): Promise<void> {
  const { error } = await client().rpc('fn_authorize_order_credit', {
    p_order_id: params.orderId,
    p_pin: params.pin,
  })
  if (error) throw error
}

export async function addCreditPayment(params: {
  creditId: string
  amount?: number
  method?: PaymentMethod
  accountId?: string
  exchangeRate?: number | null
  referenceNumber?: string
  notes?: string
  userId?: string
  payments?: Array<{
    amount: number
    method: Exclude<PaymentMethod, 'personal_account' | 'zelle'>
    accountId: string
    exchangeRate?: number | null
    referenceNumber?: string
    receivedAmount?: number
    receivedCurrency?: 'USD' | 'VES'
    receivedExchangeRate?: number | null
    changeAmount?: number
    changeCurrency?: 'USD' | 'VES'
    changeAccountId?: string
    changeExchangeRate?: number | null
  }>
}): Promise<void> {
  if (params.payments) {
    if (params.payments.length === 0) throw new Error('Agrega al menos un método de pago')
    const { error } = await client().rpc('fn_record_receivable_payment_batch', {
      p_credit_id: params.creditId,
      p_payments: params.payments,
      p_notes: params.notes ?? null,
    })
    if (error) throw error
    return
  }
  if (!params.method || !params.accountId) {
    if (!params.userId) throw new Error('Usuario requerido para registrar este abono')
    if (params.amount == null) throw new Error('Monto de abono requerido')
    const { error } = await client().from('credit_payments').insert({
      credit_id: params.creditId, amount: params.amount,
      notes: params.notes ?? null, created_by: params.userId,
    })
    if (error) throw error
    return
  }
  if (params.amount == null) throw new Error('Monto de abono requerido')
  const { error } = await client().rpc('fn_record_receivable_payment', {
    p_credit_id: params.creditId,
    p_amount: params.amount,
    p_method: params.method,
    p_account_id: params.accountId,
    p_exchange_rate: params.exchangeRate ?? null,
    p_reference_number: params.referenceNumber ?? null,
    p_notes: params.notes ?? null,
  })
  if (error) throw error
}

export async function getCreditPayments(creditId: string): Promise<CreditPayment[]> {
  const { data, error } = await client()
    .from('credit_payments')
    .select('*')
    .eq('credit_id', creditId)
    .order('created_at', { ascending: false })

  if (error) throw error

  return (data ?? []).map((p) => ({
    id: p.id as string,
    creditId: p.credit_id as string,
    amount: Number(p.amount),
    notes: (p.notes as string) ?? null,
    createdBy: p.created_by as string,
    createdAt: p.created_at as string,
    method: (p.method as PaymentMethod) ?? null,
    accountId: (p.account_id as string) ?? null,
    referenceNumber: (p.reference_number as string) ?? null,
    receivedAmount: p.received_amount == null ? null : Number(p.received_amount),
    receivedCurrency: (p.received_currency as 'USD' | 'VES') ?? null,
    changeAmount: p.change_amount == null ? null : Number(p.change_amount),
    changeCurrency: (p.change_currency as 'USD' | 'VES') ?? null,
    changeAccountId: (p.change_account_id as string) ?? null,
  }))
}

export async function getFinancialAccountCreditPayments(allPages = false): Promise<FinancialAccountCreditPayment[]> {
  const rows: Record<string, unknown>[] = []
  let offset = 0
  for (;;) {
    let query = client().from('credit_payments').select(`
      id,credit_id,amount,account_id,method,reference_number,exchange_rate,received_amount,received_currency,
      received_exchange_rate,change_amount,change_currency,change_account_id,change_exchange_rate,created_at,
      credit:credits(customer_name,order_id)
    `).order('created_at', { ascending: true }).order('id', { ascending: true })
    if (allPages) query = query.range(offset, offset + 499)
    const { data, error } = await query
    if (error) throw error
    const batch = (data ?? []) as Record<string, unknown>[]
    rows.push(...batch)
    if (!allPages || batch.length < 500) break
    offset += 500
  }
  const relationRow = (value: unknown) => {
    const row = Array.isArray(value) ? value[0] : value
    return row && typeof row === 'object' ? row as Record<string, unknown> : {}
  }
  return rows.map(row => {
    const credit = relationRow(row.credit)
    return {
      id: String(row.id), creditId: String(row.credit_id),
      creditOrderId: credit.order_id == null ? null : String(credit.order_id),
      customerName: String(credit.customer_name ?? 'Cliente sin nombre'), amount: Number(row.amount),
      accountId: row.account_id == null ? null : String(row.account_id),
      method: row.method == null ? null : row.method as PaymentMethod,
      referenceNumber: row.reference_number == null ? null : String(row.reference_number),
      exchangeRate: row.exchange_rate == null ? null : Number(row.exchange_rate),
      receivedAmount: row.received_amount == null ? null : Number(row.received_amount),
      receivedCurrency: row.received_currency == null ? null : row.received_currency as 'USD' | 'VES',
      receivedExchangeRate: row.received_exchange_rate == null ? null : Number(row.received_exchange_rate),
      changeAmount: Number(row.change_amount ?? 0),
      changeCurrency: row.change_currency == null ? null : row.change_currency as 'USD' | 'VES',
      changeAccountId: row.change_account_id == null ? null : String(row.change_account_id),
      changeExchangeRate: row.change_exchange_rate == null ? null : Number(row.change_exchange_rate),
      createdAt: String(row.created_at),
    }
  })
}

// --- Estadísticas de hoy (RPC) -----------------------------------------------

export async function deleteCredit(creditId: string): Promise<void> {
  const { error } = await client()
    .from('credits')
    .delete()
    .eq('id', creditId)
  if (error) throw error
}

export async function deleteDemoCredit(creditId: string): Promise<void> {
  const { error } = await client().rpc('fn_delete_demo_credit', { p_credit_id: creditId })
  if (error) throw error
}

