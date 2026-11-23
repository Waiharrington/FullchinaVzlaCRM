import { client } from './client'
import type { Expense, FinancialOperation, FinancialAccount, PersonalAccount, PersonalAccountOption } from './types'

export async function getExpenses(dateStart?: string, dateEnd?: string, allPages = false): Promise<Expense[]> {
  const rows: Record<string, unknown>[] = []
  let offset = 0
  for (;;) {
    let query = client().from('expenses').select('*, expense_payments(id, account_id, amount, amount_usd, currency, exchange_rate, method, reference, bank_fee_amount, financial_accounts(name))')
    if (dateStart) query = query.gte('expense_date', dateStart)
    if (dateEnd) query = query.lte('expense_date', dateEnd)
    query = query.order('expense_date', { ascending: false }).order('id', { ascending: false })
    if (allPages) query = query.range(offset, offset + 499)
    const { data, error } = await query
    if (error) throw error
    const batch = (data ?? []) as Record<string, unknown>[]
    rows.push(...batch)
    if (!allPages || batch.length < 500) break
    offset += 500
  }

  return rows.map((e) => ({
    id: e.id as string,
    concept: e.concept as string,
    amount: Number(e.amount),
    category: e.category as string,
    expenseDate: e.expense_date as string,
    notes: (e.notes as string) ?? null,
    createdBy: e.created_by as string,
    createdAt: e.created_at as string,
    accountId: (e.account_id as string) ?? null,
    exchangeRate: e.exchange_rate == null ? null : Number(e.exchange_rate),
    payments: ((e.expense_payments as Array<Record<string, unknown>>) ?? []).map((pp) => ({
      id: pp.id as string,
      accountId: pp.account_id as string,
      accountName: ((pp.financial_accounts as unknown as Record<string, unknown>)?.name as string) ?? '',
      amount: Number(pp.amount),
      amountUsd: Number(pp.amount_usd),
      currency: pp.currency as 'USD' | 'VES',
      exchangeRate: pp.exchange_rate == null ? null : Number(pp.exchange_rate),
      method: (pp.method as string) ?? null,
      reference: (pp.reference as string) ?? null,
      bankFeeAmount: Number(pp.bank_fee_amount ?? 0),
    })),
    purchaseExpenseItemId: (e.purchase_expense_item_id as string) ?? null,
  }))
}

/** Reemplaza las filas de pago de un gasto (borra e inserta). */
async function writeExpensePayments(expenseId: string, payments: Array<{ accountId: string; amount: number; currency: 'USD' | 'VES'; exchangeRate?: number | null; method?: string | null; reference?: string | null; bankFeeAmount?: number }>): Promise<void> {
  const sb = client()
  await sb.from('expense_payments').delete().eq('expense_id', expenseId)
  if (payments.length === 0) return
  const { error } = await sb.from('expense_payments').insert(payments.map((s) => ({
    expense_id: expenseId, account_id: s.accountId,
    amount: Math.round(s.amount * 100) / 100,
    amount_usd: Math.round((s.currency === 'VES' ? s.amount / (Number(s.exchangeRate) || 1) : s.amount) * 100) / 100,
    currency: s.currency, exchange_rate: s.exchangeRate ?? null, method: s.method ?? null, reference: s.reference ?? null, bank_fee_amount: Math.round((s.bankFeeAmount ?? 0) * 100) / 100,
  })))
  if (error) throw error
}

export async function createExpense(params: {
  concept: string
  amount: number
  category: 'fixed' | 'variable' | 'other'
  expenseDate: string
  notes?: string | null
  accountId?: string | null
  exchangeRate?: number | null
  userId: string
  /** Pago dividido: una fila por cuenta. Si se omite, se deriva del pago único. */
  payments?: Array<{ accountId: string; amount: number; currency: 'USD' | 'VES'; exchangeRate?: number | null; method?: string | null; reference?: string | null; bankFeeAmount?: number }>
}): Promise<Expense> {
  const sb = client()
  const primary = params.payments && params.payments.length > 0 ? params.payments[0] : null
  const { data, error } = await sb.from('expenses').insert({
    concept: params.concept,
    amount: params.amount,
    category: params.category,
    expense_date: params.expenseDate,
    notes: params.notes ?? null,
    account_id: primary?.accountId ?? params.accountId ?? null,
    exchange_rate: primary?.exchangeRate ?? params.exchangeRate ?? null,
    created_by: params.userId,
  }).select('*').single()
  if (error) throw error
  await writeExpensePayments(data.id as string, params.payments ?? [])
  return {
    id: data.id as string,
    concept: data.concept as string,
    amount: Number(data.amount),
    category: data.category as string,
    expenseDate: data.expense_date as string,
    notes: (data.notes as string) ?? null,
    createdBy: data.created_by as string,
    createdAt: data.created_at as string,
    accountId: (data.account_id as string) ?? null,
    exchangeRate: data.exchange_rate == null ? null : Number(data.exchange_rate),
    payments: (params.payments ?? []).map((p, i) => ({ id: String(i), accountId: p.accountId, accountName: '', amount: p.amount, amountUsd: p.currency === 'VES' ? p.amount / (Number(p.exchangeRate) || 1) : p.amount, currency: p.currency, exchangeRate: p.exchangeRate ?? null, method: p.method ?? null, reference: p.reference ?? null, bankFeeAmount: p.bankFeeAmount ?? 0 })),
    purchaseExpenseItemId: null,
  }
}

/** Elimina un gasto. El saldo de la cuenta se recalcula desde los movimientos registrados. */
export async function deleteExpense(id: string): Promise<void> {
  const { error } = await client().from('expenses').delete().eq('id', id)
  if (error) throw new Error(error.message || 'No se pudo eliminar el gasto')
}

/** Edita un gasto en sitio. El saldo de la cuenta se recalcula solo desde la tabla. */
export async function updateExpense(id: string, params: {
  concept: string
  amount: number
  category: 'fixed' | 'variable' | 'other'
  expenseDate: string
  notes?: string | null
  accountId?: string | null
  exchangeRate?: number | null
  payments?: Array<{ accountId: string; amount: number; currency: 'USD' | 'VES'; exchangeRate?: number | null; method?: string | null; reference?: string | null }>
}): Promise<void> {
  const primary = params.payments && params.payments.length > 0 ? params.payments[0] : null
  const { error } = await client().from('expenses').update({
    concept: params.concept,
    amount: params.amount,
    category: params.category,
    expense_date: params.expenseDate,
    notes: params.notes ?? null,
    account_id: primary?.accountId ?? params.accountId ?? null,
    exchange_rate: primary?.exchangeRate ?? params.exchangeRate ?? null,
  }).eq('id', id)
  if (error) throw new Error(error.message || 'No se pudo actualizar el gasto')
  if (params.payments) await writeExpensePayments(id, params.payments)
}

export async function getFinancialOperations(dateStart?: string, dateEnd?: string, allPages = false): Promise<FinancialOperation[]> {
  const rows: Record<string, unknown>[] = []
  let offset = 0
  for (;;) {
    let query = client().from('financial_operations').select(`
    id,operation_type,concept,operation_date,amount_usd,original_currency,original_amount,exchange_rate,from_account_id,to_account_id,
    counterparty,reference_number,affects_profit,
    from_account:financial_accounts!financial_operations_from_account_id_fkey(name),
    to_account:financial_accounts!financial_operations_to_account_id_fkey(name)
  `).eq('status', 'confirmed')
    if (dateStart) query = query.gte('operation_date', dateStart)
    if (dateEnd) query = query.lte('operation_date', dateEnd)
    query = query.order('operation_date', { ascending: false }).order('id', { ascending: false })
    if (allPages) query = query.range(offset, offset + 499)
    const { data, error } = await query
    if (error) throw error
    const batch = (data ?? []) as Record<string, unknown>[]
    rows.push(...batch)
    if (!allPages || batch.length < 500) break
    offset += 500
  }
  const relationName = (value: unknown) => {
    const row = Array.isArray(value) ? value[0] : value
    return row && typeof row === 'object' && 'name' in row ? String(row.name) : null
  }
  return rows.map((row) => ({
    id: String(row.id), type: row.operation_type as FinancialOperation['type'], concept: String(row.concept),
    operationDate: String(row.operation_date), amountUsd: Number(row.amount_usd),
    originalCurrency: row.original_currency as 'USD' | 'VES', originalAmount: Number(row.original_amount),
    exchangeRate: row.exchange_rate == null ? null : Number(row.exchange_rate),
    counterparty: row.counterparty ? String(row.counterparty) : null,
    referenceNumber: row.reference_number ? String(row.reference_number) : null,
    affectsProfit: Boolean(row.affects_profit),
    fromAccountId: row.from_account_id == null ? null : String(row.from_account_id),
    toAccountId: row.to_account_id == null ? null : String(row.to_account_id),
    fromAccount: relationName(row.from_account), toAccount: relationName(row.to_account),
  }))
}

export async function getFinancialAccounts(): Promise<FinancialAccount[]> {
  const { data, error } = await client().rpc('fn_get_financial_account_balances')
  if (!error && data) return (data as Array<Record<string, unknown>>).map((a) => ({
    id: String(a.id), name: String(a.name), accountType: String(a.account_type),
    currency: a.currency as 'USD' | 'VES', isActive: true,
    acceptsCustomerPayments: a.accepts_customer_payments !== false,
    openingBalance: Number(a.opening_balance ?? 0), currentBalance: Number(a.current_balance ?? 0),
  }))

  // Si la RPC falla por una política temporal o por caché de PostgREST,
  // mostramos al menos las cuentas configuradas en lugar de reportar que no
  // existen. El saldo calculado se conserva en la RPC cuando vuelve a estar
  // disponible.
  const fallback = await client().from('financial_accounts')
    .select('id,name,account_type,currency,opening_balance,accepts_customer_payments')
    .eq('is_active', true)
    .order('name', { ascending: true })
  if (fallback.error) throw error ?? fallback.error
  return (fallback.data ?? []).map((a) => ({
    id: String(a.id), name: String(a.name), accountType: String(a.account_type),
    currency: a.currency as 'USD' | 'VES', isActive: true,
    acceptsCustomerPayments: a.accepts_customer_payments !== false,
    openingBalance: Number(a.opening_balance ?? 0), currentBalance: Number(a.opening_balance ?? 0),
  }))
}

export async function getCustomerPaymentAccounts(): Promise<FinancialAccount[]> {
  const { data, error } = await client().from('financial_accounts')
    .select('id,name,account_type,currency,opening_balance,accepts_customer_payments')
    .eq('is_active', true)
    .order('name', { ascending: true })
  if (error) throw error
  return (data ?? []).map((account) => ({
    id: String(account.id), name: String(account.name), accountType: String(account.account_type),
    currency: account.currency as 'USD' | 'VES', isActive: true,
    acceptsCustomerPayments: account.accepts_customer_payments !== false,
    openingBalance: Number(account.opening_balance ?? 0), currentBalance: Number(account.opening_balance ?? 0),
  }))
}

export async function getPersonalAccounts(): Promise<PersonalAccount[]> {
  const { data, error } = await client().rpc('fn_get_personal_accounts')
  if (error) throw error
  return ((data ?? []) as Array<Record<string, unknown>>).map(account => ({
    id: String(account.id), name: String(account.name), isActive: account.is_active !== false,
    totalConsumption: Number(account.total_consumption ?? 0), movementCount: Number(account.movement_count ?? 0),
  }))
}

export async function getPersonalAccountOptions(): Promise<PersonalAccountOption[]> {
  const { data, error } = await client().rpc('fn_get_personal_account_options')
  if (error) throw error
  return ((data ?? []) as Array<Record<string, unknown>>).map(account => ({
    id: String(account.id), name: String(account.name), isActive: true as const,
  }))
}

export async function createPersonalAccount(name: string): Promise<string> {
  const { data, error } = await client().rpc('fn_create_personal_account', { p_name: name })
  if (error) throw error
  return String(data)
}

export async function deactivatePersonalAccount(id: string): Promise<{ deactivated: boolean }> {
  const { data, error } = await client().rpc('fn_deactivate_personal_account', { p_account_id: id })
  if (error) throw error
  return data as { deactivated: boolean }
}

export async function updateFinancialAccountOpeningBalance(id: string, openingBalance: number): Promise<void> {
  const { error } = await client().from('financial_accounts').update({ opening_balance: openingBalance }).eq('id', id)
  if (error) throw error
}

export async function createFinancialTransfer(params: {
  concept: string; operationDate: string; fromAccountId: string; toAccountId: string;
  originalCurrency: 'USD' | 'VES'; originalAmount: number; exchangeRate?: number | null;
  referenceNumber?: string | null; notes?: string | null; userId: string;
}): Promise<void> {
  if (params.fromAccountId === params.toAccountId) throw new Error('Las cuentas deben ser diferentes')
  if (!Number.isFinite(params.originalAmount) || params.originalAmount <= 0) throw new Error('El monto debe ser mayor que cero')
  const amountUsd = params.originalCurrency === 'VES'
    ? params.originalAmount / Number(params.exchangeRate)
    : params.originalAmount
  if (!Number.isFinite(amountUsd) || amountUsd <= 0) throw new Error('La tasa es obligatoria para transferencias en Bs.')
  const { error } = await client().from('financial_operations').insert({
    operation_type: 'transfer', concept: params.concept.trim(), operation_date: params.operationDate,
    amount_usd: Math.round(amountUsd * 100) / 100, original_currency: params.originalCurrency,
    original_amount: params.originalAmount, exchange_rate: params.exchangeRate ?? null,
    from_account_id: params.fromAccountId, to_account_id: params.toAccountId,
    reference_number: params.referenceNumber?.trim() || null, notes: params.notes?.trim() || null,
    affects_profit: false, created_by: params.userId,
  })
  if (error) throw error
}

/** Registra un ingreso manual (por ejemplo, capital) como movimiento de cuenta, sin tratarlo como venta. */
export async function createManualFinancialIncome(params: {
  concept: string; operationDate: string; accountId: string;
  originalCurrency: 'USD' | 'VES'; originalAmount: number; exchangeRate?: number | null;
  notes?: string | null; userId: string;
}): Promise<void> {
  if (!params.concept.trim()) throw new Error('Indica el motivo del ingreso.')
  if (!params.accountId) throw new Error('Selecciona la cuenta donde entró el dinero.')
  if (!Number.isFinite(params.originalAmount) || params.originalAmount <= 0) throw new Error('El monto debe ser mayor que cero.')
  const amountUsd = params.originalCurrency === 'VES'
    ? params.originalAmount / Number(params.exchangeRate)
    : params.originalAmount
  if (!Number.isFinite(amountUsd) || amountUsd <= 0) throw new Error('La tasa BCV es necesaria para registrar un ingreso en bolívares.')
  const { error } = await client().from('financial_operations').insert({
    operation_type: 'adjustment', concept: params.concept.trim(), operation_date: params.operationDate,
    amount_usd: Math.round(amountUsd * 100) / 100, original_currency: params.originalCurrency,
    original_amount: params.originalAmount, exchange_rate: params.exchangeRate ?? null,
    to_account_id: params.accountId, notes: params.notes?.trim() || null,
    affects_profit: false, created_by: params.userId,
  })
  if (error) throw error
}

export async function deleteFinancialOperation(id: string): Promise<void> {
  const { error } = await client().from('financial_operations').delete().eq('id', id)
  if (error) throw error
}

