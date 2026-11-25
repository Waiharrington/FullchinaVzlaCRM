import { client, fetchRows } from './client'
import type { Supplier, Purchase, CustomerPurchaseMetric, LegacyPurchaseOrder } from './types'

// Totales reales por nombre de cliente para la tabla principal. Las órdenes
// todavía no tienen customer_id, por eso la agrupación conserva la clave textual.
export async function getCustomerPurchaseMetrics(): Promise<CustomerPurchaseMetric[]> {
  const { data, error } = await client()
    .from('v_orders_with_items')
    .select('customer_id,customer_name,total_amount,created_at')
    .order('created_at', { ascending: false })
    .limit(5000)
  if (error) throw error

  const grouped = new Map<string, CustomerPurchaseMetric>()
  for (const row of data ?? []) {
    const customerName = String(row.customer_name ?? '').trim()
    if (!customerName || customerName.toLocaleLowerCase('es-VE') === 'cliente general') continue
    const customerId = (row.customer_id as string) ?? null
    const key = customerId ? `id:${customerId}` : `name:${customerName.toLocaleLowerCase('es-VE')}`
    const current = grouped.get(key)
    if (current) {
      current.orderCount += 1
      current.totalPurchased += Number(row.total_amount ?? 0)
    } else {
      grouped.set(key, {
        customerId,
        customerName,
        orderCount: 1,
        totalPurchased: Number(row.total_amount ?? 0),
        lastPurchase: String(row.created_at ?? ''),
      })
    }
  }
  return [...grouped.values()]
}

export async function getLegacyPurchaseOrders(): Promise<LegacyPurchaseOrder[]> {
  const { data, error } = await client().from('legacy_purchase_orders')
    .select('id,po_code,supplier_text,po_date,creation_date,total,invoice_number,status')
    .order('po_date', { ascending: false }).limit(1000)
  if (error) throw error
  return (data ?? []).map(row => ({
    id: row.id as string, code: (row.po_code as string) ?? '', supplier: (row.supplier_text as string) ?? '',
    date: ((row.po_date ?? row.creation_date) as string) ?? '', total: Number(row.total ?? 0),
    invoiceNumber: (row.invoice_number as string) ?? '', status: (row.status as string) ?? '',
  }))
}

// --- Inventario --------------------------------------------------------------

export async function getSuppliers(): Promise<Supplier[]> {
  const { data, error } = await client()
    .from('suppliers')
    .select('id,name,contact,phone,email,notes,is_active')
    .eq('is_active', true)
    .order('name', { ascending: true })

  if (error) throw error
  return (data ?? []).map((s) => ({
    id: s.id as string,
    name: s.name as string,
    contact: (s.contact as string) ?? null,
    phone: (s.phone as string) ?? null,
    email: (s.email as string) ?? null,
    notes: (s.notes as string) ?? null,
    isActive: s.is_active as boolean,
  }))
}

export async function createSupplier(params: {
  name: string
  contact?: string
  phone?: string
  email?: string
  notes?: string
}): Promise<string> {
  const { data, error } = await client()
    .from('suppliers')
    .insert({
      name: params.name,
      contact: params.contact ?? null,
      phone: params.phone ?? null,
      email: params.email ?? null,
      notes: params.notes ?? null,
    })
    .select('id')
    .single()
  if (error) throw error
  return data.id as string
}

export async function updateSupplier(
  id: string,
  params: {
    name?: string
    contact?: string
    phone?: string
    email?: string
    notes?: string
    isActive?: boolean
  },
): Promise<void> {
  const updates: Record<string, unknown> = {}
  if (params.name !== undefined) updates.name = params.name
  if (params.contact !== undefined) updates.contact = params.contact || null
  if (params.phone !== undefined) updates.phone = params.phone || null
  if (params.email !== undefined) updates.email = params.email || null
  if (params.notes !== undefined) updates.notes = params.notes || null
  if (params.isActive !== undefined) updates.is_active = params.isActive

  const { error } = await client()
    .from('suppliers')
    .update(updates)
    .eq('id', id)
  if (error) throw error
}

// --- Compras ------------------------------------------------------------------

export async function getPurchases(allPages = false): Promise<Purchase[]> {
  const rows = await fetchRows(() => {
  const query = client().from('purchases').select(`
    id, supplier_id, purchase_date, invoice_number, notes, created_by, created_at, is_paid, is_voided, account_id, exchange_rate, payment_currency, payment_method, payment_reference,
    suppliers(name),
    financial_accounts(name,currency),
    purchase_items(id, purchase_id, ingredient_id, quantity, unit_id, unit_cost, stock_location, ingredients(name), units(symbol)),
    purchase_expense_items(id, description, quantity, unit_id, unit_cost, units(symbol)),
    purchase_payments(id, account_id, amount, amount_usd, currency, exchange_rate, method, reference, bank_fee_amount, financial_accounts(name))
  `).order('purchase_date', { ascending: false }).order('id', { ascending: false })
    return query
  }, allPages)

  return rows.map((p) => {
    const items = ((p.purchase_items as Array<Record<string, unknown>>) ?? []).map((pi) => ({
      id: pi.id as string,
      purchaseId: pi.purchase_id as string,
      ingredientId: pi.ingredient_id as string,
      ingredientName: ((pi.ingredients as unknown as Record<string, unknown>)?.name as string) ?? '',
      quantity: Number(pi.quantity),
      unitId: pi.unit_id as string,
      unitSymbol: ((pi.units as unknown as Record<string, unknown>)?.symbol as string) ?? '',
      unitCost: Number(pi.unit_cost),
      total: Number(pi.quantity) * Number(pi.unit_cost),
      stockLocation: (pi.stock_location as 'warehouse' | 'operational') ?? 'warehouse',
    }))
    const expenseItems = ((p.purchase_expense_items as Array<Record<string, unknown>>) ?? []).map((item) => ({
      id: item.id as string,
      description: item.description as string,
      quantity: Number(item.quantity),
      unitId: item.unit_id as string,
      unitSymbol: ((item.units as unknown as Record<string, unknown>)?.symbol as string) ?? '',
      unitCost: Number(item.unit_cost),
      total: Number(item.quantity) * Number(item.unit_cost),
    }))
    const inventoryTotalAmount = items.reduce((sum, item) => sum + item.total, 0)
    return {
      id: p.id as string,
      supplierId: p.supplier_id as string,
      supplierName: ((p.suppliers as unknown as Record<string, unknown>)?.name as string) ?? '',
      purchaseDate: p.purchase_date as string,
      invoiceNumber: (p.invoice_number as string) ?? null,
      notes: (p.notes as string) ?? null,
      createdBy: p.created_by as string,
      createdAt: p.created_at as string,
      items,
      expenseItems,
      inventoryTotalAmount,
      totalAmount: inventoryTotalAmount + expenseItems.reduce((sum, item) => sum + item.total, 0),
      isPaid: p.is_paid !== false,
      isVoided: p.is_voided === true,
      accountId: (p.account_id as string) ?? null,
      accountName: ((p.financial_accounts as unknown as Record<string, unknown>)?.name as string) ?? null,
      paymentCurrency: ((p.payment_currency ?? (p.financial_accounts as unknown as Record<string, unknown>)?.currency) as 'USD' | 'VES') ?? null,
      paymentMethod: (p.payment_method as string) ?? null,
      paymentReference: (p.payment_reference as string) ?? null,
      exchangeRate: p.exchange_rate == null ? null : Number(p.exchange_rate),
      payments: ((p.purchase_payments as Array<Record<string, unknown>>) ?? []).map((pp) => ({
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
    }
  })
}

export async function setPurchasePaid(id: string, isPaid: boolean): Promise<void> {
  const { error } = await client().from('purchases').update({ is_paid: isPaid }).eq('id', id)
  if (error) throw error
}

/** Anula una compra conservando su registro y movimientos históricos. */
export async function voidPurchase(id: string): Promise<void> {
  const { error } = await client().rpc('fn_void_purchase', { p_purchase_id: id })
  if (error) throw new Error(error.message || 'No se pudo anular la compra')
}

/** Borra definitivamente una compra previamente anulada, solo para demos. */
export async function deleteVoidedPurchase(id: string): Promise<void> {
  const { error } = await client().rpc('fn_delete_voided_purchase', { p_purchase_id: id })
  if (error) throw new Error(error.message || 'No se pudo borrar la compra anulada')
}

/** Elimina una compra y registra la reversa de inventario de forma atómica. */
export async function deletePurchase(id: string): Promise<void> {
  const { error } = await client().rpc('fn_delete_purchase', { p_purchase_id: id })
  if (error) throw new Error(error.message || 'No se pudo eliminar la compra')
}

/** Actualiza costos y pago conservando las filas originales y su historial de inventario. */
export async function saveMixedPurchase(params: {
  purchaseId?: string | null
  supplierId: string
  purchaseDate: string
  invoiceNumber?: string
  notes?: string
  isPaid: boolean
  exchangeRate?: number | null
  inventoryItems: Array<{ id?: string; ingredientId: string; quantity: number; unitId: string; unitCost: number; stockLocation: 'warehouse' | 'operational' }>
  expenseItems: Array<{ description: string; quantity: number; unitId: string; unitCost: number }>
  payments?: Array<{ accountId: string; amount: number; currency: 'USD' | 'VES'; exchangeRate?: number | null; method?: string | null; reference?: string | null; bankFeeAmount?: number }>
}): Promise<string> {
  const { data, error } = await client().rpc('fn_save_mixed_purchase', {
    p_purchase_id: params.purchaseId ?? null,
    p_supplier_id: params.supplierId,
    p_purchase_date: params.purchaseDate,
    p_invoice_number: params.invoiceNumber ?? null,
    p_notes: params.notes ?? null,
    p_is_paid: params.isPaid,
    p_exchange_rate: params.exchangeRate ?? null,
    p_inventory_items: params.inventoryItems.map((item) => ({
      id: item.id ?? null, ingredient_id: item.ingredientId, quantity: item.quantity,
      unit_id: item.unitId, unit_cost: item.unitCost, stock_location: item.stockLocation,
    })),
    p_expense_items: params.expenseItems.map((item) => ({
      description: item.description, quantity: item.quantity, unit_id: item.unitId, unit_cost: item.unitCost,
    })),
    p_payments: (params.payments ?? []).map((payment) => ({
      account_id: payment.accountId, amount: payment.amount, currency: payment.currency,
      exchange_rate: payment.exchangeRate ?? null, method: payment.method ?? null,
      reference: payment.reference ?? null, bank_fee_amount: payment.bankFeeAmount ?? 0,
    })),
  })
  if (error) throw new Error(error.message || 'No se pudo guardar la factura mixta')
  return data as string
}

/** Actualiza costos y pago conservando las filas originales y su historial de inventario. */
export async function updatePurchase(id: string, params: {
  supplierId: string
  purchaseDate: string
  invoiceNumber?: string
  notes?: string
  isPaid: boolean
  exchangeRate?: number | null
  items: Array<{ id?: string; ingredientId: string; quantity: number; unitId: string; unitCost: number; stockLocation: 'warehouse' | 'operational' }>
  payments?: Array<{ accountId: string; amount: number; currency: 'USD' | 'VES'; exchangeRate?: number | null; method?: string | null; reference?: string | null; bankFeeAmount?: number }>
}): Promise<void> {
  const { error } = await client().rpc('fn_update_purchase', {
    p_purchase_id: id,
    p_supplier_id: params.supplierId,
    p_purchase_date: params.purchaseDate,
    p_invoice_number: params.invoiceNumber ?? null,
    p_notes: params.notes ?? null,
    p_is_paid: params.isPaid,
    p_exchange_rate: params.exchangeRate ?? null,
    p_items: params.items.map((item) => ({
      id: item.id ?? null,
      ingredient_id: item.ingredientId,
      quantity: item.quantity,
      unit_id: item.unitId,
      unit_cost: item.unitCost,
      stock_location: item.stockLocation,
    })),
    p_payments: (params.payments ?? []).map((payment) => ({
      account_id: payment.accountId,
      amount: payment.amount,
      currency: payment.currency,
      exchange_rate: payment.exchangeRate ?? null,
      method: payment.method ?? null,
      reference: payment.reference ?? null,
      bank_fee_amount: payment.bankFeeAmount ?? 0,
    })),
  })
  if (error) throw new Error(error.message || 'No se pudo actualizar la compra')
}

export async function createPurchase(params: {
  supplierId: string
  purchaseDate: string
  invoiceNumber?: string
  notes?: string
  userId: string
  isPaid?: boolean
  accountId?: string | null
  paymentCurrency?: 'USD' | 'VES' | null
  paymentMethod?: string | null
  paymentReference?: string | null
  exchangeRate?: number | null
  /** Pago dividido: una fila por cuenta. Si se omite, se deriva del pago único. */
  payments?: Array<{ accountId: string; amount: number; currency: 'USD' | 'VES'; exchangeRate?: number | null; method?: string | null; reference?: string | null; bankFeeAmount?: number }>
  items: Array<{
    ingredientId: string
    quantity: number
    unitId: string
    unitCost: number
    stockLocation?: 'warehouse' | 'operational'
  }>
}): Promise<string> {
  const sb = client()
  const isPaid = params.isPaid ?? true
  const totalUsd = params.items.reduce((sum, it) => sum + it.quantity * it.unitCost, 0)
  // Fuentes de pago: las provistas, o una sola derivada del pago único legacy.
  const sources = (params.payments && params.payments.length > 0)
    ? params.payments
    : (isPaid && params.accountId
      ? [{ accountId: params.accountId, amount: params.paymentCurrency === 'VES' ? totalUsd * Number(params.exchangeRate ?? 0) : totalUsd, currency: (params.paymentCurrency ?? 'USD') as 'USD' | 'VES', exchangeRate: params.exchangeRate ?? null, method: params.paymentMethod ?? null, reference: params.paymentReference ?? null }]
      : [])
  const primary = sources[0]

  const { data: purchase, error: purchaseErr } = await sb
    .from('purchases')
    .insert({
      supplier_id: params.supplierId,
      purchase_date: params.purchaseDate,
      invoice_number: params.invoiceNumber ?? null,
      notes: params.notes ?? null,
      is_paid: isPaid,
      account_id: primary?.accountId ?? params.accountId ?? null,
      payment_currency: primary?.currency ?? params.paymentCurrency ?? null,
      payment_method: sources.length > 1 ? 'mixed' : (primary?.method ?? params.paymentMethod ?? null),
      payment_reference: primary?.reference ?? params.paymentReference ?? null,
      exchange_rate: primary?.exchangeRate ?? params.exchangeRate ?? null,
      created_by: params.userId,
    })
    .select('id')
    .single()
  if (purchaseErr) throw purchaseErr

  if (isPaid && sources.length > 0) {
    const { error: payErr } = await sb.from('purchase_payments').insert(
      sources.map((s) => ({
        purchase_id: purchase.id, account_id: s.accountId,
        amount: Math.round(s.amount * 100) / 100,
        amount_usd: Math.round((s.currency === 'VES' ? s.amount / (Number(s.exchangeRate) || 1) : s.amount) * 100) / 100,
        currency: s.currency, exchange_rate: s.exchangeRate ?? null, method: s.method ?? null, reference: s.reference ?? null, bank_fee_amount: Math.round((s.bankFeeAmount ?? 0) * 100) / 100,
      })),
    )
    if (payErr) throw payErr
  }

  if (params.items.length > 0) {
    const { error: itemsErr } = await sb.from('purchase_items').insert(
      params.items.map((item) => ({
        purchase_id: purchase.id,
        ingredient_id: item.ingredientId,
        quantity: item.quantity,
        unit_id: item.unitId,
        unit_cost: item.unitCost,
        stock_location: item.stockLocation ?? 'operational',
      })),
    )
    if (itemsErr) throw itemsErr
  }

  return purchase.id as string
}

