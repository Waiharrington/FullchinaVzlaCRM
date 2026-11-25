import { dateKeyInTimeZone } from '../money'
import { client, fetchRows } from './client'
import { getProductionBonusRecords } from './production'
import type { Employee, PayrollPeriod, PayrollEntry, DeliveryAssignment, PayrollPayment, PayrollAdjustment, Advance } from './types'

export async function updateDeliveryEmployeePercent(employeePercent: number): Promise<void> {
  const { data, error } = await client().from('delivery_payroll_config').update({ employee_percent: employeePercent }).eq('id', 1).select('id').maybeSingle()
  if (error) throw error
  if (!data) throw new Error('No tienes permiso para modificar la comisión de delivery.')
}

export async function getEmployees(): Promise<Employee[]> {
  const sb = client()
  const { data, error } = await sb
    .from('employees')
    .select('id,full_name,position,hourly_rate,weekly_salary,overtime_rate,is_active')
    .eq('is_active', true)
    .order('full_name', { ascending: true })

  if (!error && data) {
    return data.map((r) => ({
      id: r.id as string,
      fullName: r.full_name as string,
      photoUrl: null,
      position: (r.position as string) ?? null,
      hourlyRate: Number(r.hourly_rate),
      weeklySalary: Number(r.weekly_salary ?? 0),
      overtimeRate: Number(r.overtime_rate ?? 0),
      isActive: r.is_active as boolean,
    }))
  }

  // Fallback si weekly_salary o overtime_rate aún no existen en la BD
  if (error && (error.message?.includes('weekly_salary') || error.message?.includes('overtime_rate') || error.code === '42703' || error.code === 'PGRST204')) {
    const { data: fallbackData, error: fallbackError } = await sb
      .from('employees')
      .select('id,full_name,position,hourly_rate,is_active')
      .eq('is_active', true)
      .order('full_name', { ascending: true })

    if (fallbackError) throw fallbackError
    return (fallbackData ?? []).map((r) => ({
      id: r.id as string,
      fullName: r.full_name as string,
      photoUrl: null,
      position: (r.position as string) ?? null,
      hourlyRate: Number(r.hourly_rate),
      weeklySalary: Number(r.hourly_rate ?? 0),
      overtimeRate: 0,
      isActive: r.is_active as boolean,
    }))
  }

  if (error) throw error
  return []
}

export async function getAllEmployees(): Promise<Employee[]> {
  const { data, error } = await client()
    .from('employees')
    .select('*')
    .order('is_active', { ascending: false })
    .order('full_name', { ascending: true })
  if (error) throw error
  return (data ?? []).map((r) => ({
    id: r.id as string,
    fullName: r.full_name as string,
    photoUrl: (r.photo_url as string) ?? null,
    position: (r.position as string) ?? null,
    hourlyRate: Number(r.hourly_rate ?? 0),
    weeklySalary: Number(r.weekly_salary ?? r.hourly_rate ?? 0),
    overtimeRate: Number(r.overtime_rate ?? 0),
    isActive: r.is_active as boolean,
    hasWeeklyPayrollColumns: 'weekly_salary' in r && 'overtime_rate' in r,
  }))
}

export async function getDeliveryAssignments(): Promise<DeliveryAssignment[]> {
  const rows: Record<string, unknown>[] = []
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await client().from('delivery_assignments')
      .select('id,order_id,employee_id,delivery_fee,employee_percent,employee_amount,company_amount,status,assigned_at,payroll_period_id,employees(full_name)')
      .order('assigned_at', { ascending: false }).order('id', { ascending: false }).range(offset, offset + 499)
    if (error) throw error
    const batch = (data ?? []) as Record<string, unknown>[]
    rows.push(...batch)
    if (batch.length < 500) break
  }
  return rows.map((row) => ({
    id: String(row.id), orderId: String(row.order_id), employeeId: String(row.employee_id),
    employeeName: Array.isArray(row.employees) ? String((row.employees[0] as Record<string, unknown>)?.full_name ?? '') : '',
    deliveryFee: Number(row.delivery_fee), employeePercent: Number(row.employee_percent),
    employeeAmount: Number(row.employee_amount), companyAmount: Number(row.company_amount),
    status: row.status as DeliveryAssignment['status'], assignedAt: String(row.assigned_at),
    payrollPeriodId: (row.payroll_period_id as string) ?? null,
  }))
}

/**
 * Liquida (paga) todas las comisiones de delivery pendientes de un repartidor:
 * registra un pago directo por el total y marca las asignaciones como pagadas,
 * enlazándolas al pago creado. Lee lo pendiente en el momento para evitar
 * pagar de más si algo cambió entre la vista y el clic.
 */
export async function payDeliveryCommissions(params: {
  employeeId: string; paymentAccount?: string | null; reference?: string | null; notes?: string | null
}): Promise<{ paidCount: number; amount: number }> {
  const supabase = client()
  const { data: pending, error: readErr } = await supabase.from('delivery_assignments')
    .select('id,employee_amount').eq('employee_id', params.employeeId).eq('status', 'pending')
  if (readErr) throw readErr
  const rows = (pending ?? []) as Record<string, unknown>[]
  const ids = rows.map((r) => String(r.id))
  const amount = Math.round(rows.reduce((sum, r) => sum + Number(r.employee_amount), 0) * 100) / 100
  if (ids.length === 0 || amount <= 0) return { paidCount: 0, amount: 0 }
  const { data: payment, error: payErr } = await supabase.from('payroll_payments').insert({
    employee_id: params.employeeId, amount, currency: 'USD', exchange_rate: null,
    payment_account: params.paymentAccount ?? null, payment_date: dateKeyInTimeZone(),
    reference: params.reference ?? null, notes: params.notes ?? 'Pago de comisiones de delivery',
  }).select('id').single()
  if (payErr) throw payErr
  const { error: updErr } = await supabase.from('delivery_assignments')
    .update({ status: 'paid', paid_at: new Date().toISOString(), payroll_payment_id: (payment as Record<string, unknown>).id })
    .in('id', ids)
  if (updErr) throw updErr
  return { paidCount: ids.length, amount }
}

export async function createEmployee(params: {
  fullName: string
  photoUrl?: string | null
  position?: string | null
  hourlyRate?: number
  weeklySalary?: number
  overtimeRate?: number
}): Promise<Employee> {
  const sb = client()
  const { data, error } = await sb
    .from('employees')
    .insert({
      full_name: params.fullName,
      photo_url: params.photoUrl ?? null,
      position: params.position ?? null,
      hourly_rate: params.hourlyRate ?? 0,
      weekly_salary: params.weeklySalary ?? 0,
      overtime_rate: params.overtimeRate ?? 0,
      is_active: true,
    })
    .select('id,full_name,photo_url,position,hourly_rate,weekly_salary,overtime_rate,is_active')
    .single()

  if (!error && data) {
    return {
      id: data.id as string,
      fullName: data.full_name as string,
      photoUrl: (data.photo_url as string) ?? null,
      position: (data.position as string) ?? null,
      hourlyRate: Number(data.hourly_rate),
      weeklySalary: Number(data.weekly_salary ?? 0),
      overtimeRate: Number(data.overtime_rate ?? 0),
      isActive: data.is_active as boolean,
    }
  }

  // Si falló por columnas que aún no existen en la BD, reintentar sin ellas persistiendo el sueldo en hourly_rate
  if (error && (error.message?.includes('weekly_salary') || error.message?.includes('overtime_rate') || error.code === '42703' || error.code === 'PGRST204')) {
    const salaryToStore = params.weeklySalary ?? params.hourlyRate ?? 0
    const { data: fallbackData, error: fallbackError } = await sb
      .from('employees')
      .insert({
        full_name: params.fullName,
        photo_url: params.photoUrl ?? null,
        position: params.position ?? null,
        hourly_rate: salaryToStore,
        is_active: true,
      })
      .select('id,full_name,photo_url,position,hourly_rate,is_active')
      .single()

    if (fallbackError) throw fallbackError
    return {
      id: fallbackData.id as string,
      fullName: fallbackData.full_name as string,
      photoUrl: (fallbackData.photo_url as string) ?? null,
      position: (fallbackData.position as string) ?? null,
      hourlyRate: Number(fallbackData.hourly_rate),
      weeklySalary: Number(fallbackData.hourly_rate),
      overtimeRate: params.overtimeRate ?? 0,
      isActive: fallbackData.is_active as boolean,
    }
  }

  if (error) throw error
  throw new Error('No se pudo crear el empleado')
}

export async function updateEmployee(id: string, updates: {
  fullName?: string
  photoUrl?: string | null
  position?: string | null
  hourlyRate?: number
  weeklySalary?: number
  overtimeRate?: number
  isActive?: boolean
}): Promise<void> {
  const patch: Record<string, unknown> = {}
  if (updates.fullName !== undefined) patch.full_name = updates.fullName
  if (updates.photoUrl !== undefined) patch.photo_url = updates.photoUrl
  if (updates.position !== undefined) patch.position = updates.position
  if (updates.hourlyRate !== undefined) patch.hourly_rate = updates.hourlyRate
  if (updates.weeklySalary !== undefined) patch.weekly_salary = updates.weeklySalary
  if (updates.overtimeRate !== undefined) patch.overtime_rate = updates.overtimeRate
  if (updates.isActive !== undefined) patch.is_active = updates.isActive

  const sb = client()
  const { error } = await sb
    .from('employees')
    .update(patch)
    .eq('id', id)

  if (error) {
    if (error.message?.includes('weekly_salary') || error.message?.includes('overtime_rate') || error.code === '42703' || error.code === 'PGRST204') {
      delete patch.weekly_salary
      delete patch.overtime_rate
      // En instalaciones anteriores a weekly_salary, hourly_rate es la única
      // columna disponible para conservar el sueldo. El formulario de Equipo
      // envía ambos valores, así que el sueldo semanal debe tener prioridad y
      // no quedar sobrescrito por el hourlyRate predeterminado en cero.
      if (updates.weeklySalary !== undefined) {
        patch.hourly_rate = updates.weeklySalary
      }
      const { error: retryErr } = await sb
        .from('employees')
        .update(patch)
        .eq('id', id)
      if (retryErr) throw retryErr
      return
    }
    throw error
  }
}

/**
 * Archiva al empleado en vez de borrarlo físicamente. Nómina, delivery y
 * asistencia dependen de su ID; conservarlo mantiene íntegro el historial.
 */
export async function archiveEmployee(id: string): Promise<void> {
  const { error } = await client()
    .from('employees')
    .update({ is_active: false })
    .eq('id', id)
  if (error) throw error
}

// --- Usuarios de acceso (login) ---------------------------------------------
// Administración de auth.users vía RPC SECURITY DEFINER (owner-only). El
// navegador nunca ve la service_role; toda la validación vive en la BD.

export async function getPayrollPeriods(): Promise<PayrollPeriod[]> {
  const { data, error } = await client()
    .from('payroll_periods')
    .select('id,start_date,end_date,status,notes,created_at')
    .order('start_date', { ascending: false })
  if (error) throw error
  return (data ?? []).map((r) => ({
    id: r.id as string,
    startDate: r.start_date as string,
    endDate: r.end_date as string,
    status: r.status as PayrollPeriod['status'],
    notes: (r.notes as string) ?? null,
    createdAt: r.created_at as string,
  }))
}

export async function createPayrollPeriod(params: {
  startDate: string
  endDate: string
  notes?: string | null
}): Promise<string> {
  const { data, error } = await client()
    .from('payroll_periods')
    .insert({ start_date: params.startDate, end_date: params.endDate, notes: params.notes ?? null })
    .select('id')
    .single()
  if (error) throw error
  return data.id as string
}

export async function deletePayrollPeriod(id: string): Promise<void> {
  const { error } = await client().rpc('fn_delete_payroll_period', { p_period_id: id })
  if (!error) return
  if (error.code !== 'PGRST202' && error.code !== '42883') throw error

  // En instalaciones anteriores a la RPC, RLS permite borrar solo al owner.
  // Los pagos/ajustes usan ON DELETE RESTRICT y las liquidaciones ON DELETE CASCADE.
  const { data, error: deleteError } = await client()
    .from('payroll_periods')
    .delete()
    .eq('id', id)
    .eq('status', 'open')
    .select('id')
  if (deleteError) throw deleteError
  if (!data?.length) throw new Error('El período no existe, no está abierto o no tienes permiso para eliminarlo')
}

export async function updatePayrollPeriodStatus(id: string, status: PayrollPeriod['status']): Promise<void> {
  const { error } = await client()
    .from('payroll_periods')
    .update({ status })
    .eq('id', id)
  if (error) throw error
}

export async function getPayrollEntries(periodId: string): Promise<PayrollEntry[]> {
  const { data, error } = await client()
    .from('payroll_entries')
    .select('*')
    .eq('payroll_period_id', periodId)
    .order('created_at', { ascending: true })
  if (error) throw error
  return (data ?? []).map((r) => ({
    id: r.id as string,
    payrollPeriodId: r.payroll_period_id as string,
    employeeId: r.employee_id as string,
    employeeName: '',
    position: null,
    hoursWorked: Number(r.hours_worked ?? 0),
    baseSalary: Number(r.base_salary ?? 0),
    deductions: Number(r.deductions ?? 0),
    netPay: Number(r.net_pay ?? 0),
    notes: (r.notes as string) ?? null,
    weeklySalary: Number(r.weekly_salary ?? 0), bonusAmount: Number(r.bonus_amount ?? 0),
    overtimeHours: Number(r.overtime_hours ?? 0), overtimeAmount: Number(r.overtime_amount ?? 0),
    transportAmount: Number(r.transport_amount ?? 0), absenceDays: Number(r.absence_days ?? 0),
    absenceDeduction: Number(r.absence_deduction ?? 0), advanceDeduction: Number(r.advance_deduction ?? 0),
    hasBreakdown: Number(r.weekly_salary ?? 0) > 0 || Number(r.base_salary ?? 0) === 0 ||
      Number(r.bonus_amount ?? 0) > 0 || Number(r.overtime_amount ?? 0) > 0 || Number(r.transport_amount ?? 0) > 0,
  }))
}

export async function upsertPayrollEntry(params: {
  payrollPeriodId: string
  employeeId: string
  hoursWorked: number
  baseSalary: number
  deductions: number
  weeklySalary?: number
  bonusAmount?: number
  overtimeHours?: number
  overtimeAmount?: number
  transportAmount?: number
  absenceDays?: number
  absenceDeduction?: number
  advanceDeduction?: number
  notes?: string | null
}): Promise<void> {
  try {
    const { error } = await client()
      .from('payroll_entries')
      .upsert({
        payroll_period_id: params.payrollPeriodId,
        employee_id: params.employeeId,
        hours_worked: params.hoursWorked,
        base_salary: params.baseSalary,
        deductions: params.deductions,
        weekly_salary: params.weeklySalary ?? params.baseSalary,
        bonus_amount: params.bonusAmount ?? 0,
        overtime_hours: params.overtimeHours ?? 0,
        overtime_amount: params.overtimeAmount ?? 0,
        transport_amount: params.transportAmount ?? 0,
        absence_days: params.absenceDays ?? 0,
        absence_deduction: params.absenceDeduction ?? 0,
        advance_deduction: params.advanceDeduction ?? 0,
        notes: params.notes ?? null,
      }, { onConflict: 'payroll_period_id,employee_id' })
    if (error) throw error
  } catch (err: unknown) {
    const isColErr = err && typeof err === 'object' && ('code' in err) && ((err as { code: string }).code === '42703' || (err as { code: string }).code === 'PGRST204')
    if (isColErr) throw new Error('Falta la migración de nómina semanal en el servidor. No se guardó la liquidación para evitar perder el desglose de bonos y ajustes.')
    throw err
  }
}

export async function getPayrollPayments(allPages = false): Promise<PayrollPayment[]> {
  const rows = await fetchRows(() => {
  const query = client().from('payroll_payments')
  .select('id,employee_id,payroll_period_id,amount,currency,exchange_rate,payment_account,account_id,payment_date,reference,notes,bank_fee_amount,employees(full_name)')
  .order('payment_date', { ascending: false }).order('created_at', { ascending: false })
    return query
  }, allPages)
  return rows.map((r) => ({
    id: r.id as string, employeeId: r.employee_id as string,
    employeeName: Array.isArray(r.employees) ? String((r.employees[0] as Record<string, unknown>)?.full_name ?? '') : '',
    amount: Number(r.amount), currency: r.currency as 'USD' | 'Bs',
    exchangeRate: r.exchange_rate == null ? null : Number(r.exchange_rate),
    paymentAccount: (r.payment_account as string) ?? null, accountId: (r.account_id as string) ?? null,
    payrollPeriodId: (r.payroll_period_id as string) ?? null, paymentDate: r.payment_date as string,
    reference: (r.reference as string) ?? null, notes: (r.notes as string) ?? null, bankFeeAmount: Number(r.bank_fee_amount ?? 0),
  }))
}

export async function createPayrollPayment(params: {
  employeeId: string; amount: number; currency?: 'USD' | 'Bs'; exchangeRate?: number | null
  paymentAccount?: string | null; accountId?: string | null; paymentDate?: string; reference?: string | null; notes?: string | null; paymentMethod?: string | null; bankFeeAmount?: number
}): Promise<void> {
  if (params.accountId) {
    const { error } = await client().rpc('fn_record_payroll_card_payment_with_fee', {
      p_employee_id: params.employeeId,
      p_amount: params.amount,
      p_account_id: params.accountId,
      p_exchange_rate: params.exchangeRate ?? null,
      p_payment_date: params.paymentDate ?? dateKeyInTimeZone(),
      p_reference: params.reference ?? null,
      p_notes: params.notes ?? null,
      p_payment_method: params.paymentMethod ?? null,
      p_bank_fee_amount: params.bankFeeAmount ?? 0,
    })
    if (error) throw error
    return
  }
  const { error } = await client().from('payroll_payments').insert({
    employee_id: params.employeeId, amount: params.amount, currency: params.currency ?? 'USD',
    exchange_rate: params.exchangeRate ?? null, payment_account: params.paymentAccount ?? null,
    payment_date: params.paymentDate ?? dateKeyInTimeZone(), reference: params.reference ?? null,
    notes: params.notes ?? null, payment_method: params.paymentMethod ?? null, bank_fee_amount: params.bankFeeAmount ?? 0,
  })
  if (error) throw error
}

export async function getPayrollAdjustments(): Promise<PayrollAdjustment[]> {
  const { data, error } = await client().from('payroll_adjustments')
    .select('id,employee_id,adjustment_type,amount,direction,adjustment_date,description,employees(full_name)')
    .order('adjustment_date', { ascending: false }).order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []).map((row) => ({
    id: row.id as string,
    employeeId: row.employee_id as string,
    employeeName: Array.isArray(row.employees) ? String((row.employees[0] as Record<string, unknown>)?.full_name ?? '') : '',
    adjustmentType: row.adjustment_type as string,
    amount: Number(row.amount),
    direction: row.direction as 'add' | 'deduct',
    adjustmentDate: row.adjustment_date as string,
    description: (row.description as string) ?? null,
  }))
}

export async function createPayrollAdjustment(params: {
  employeeId: string; type: 'salary' | 'bonus' | 'discount'; amount: number; date?: string; description?: string | null
}): Promise<void> {
  const { error } = await client().from('payroll_adjustments').insert({
    employee_id: params.employeeId,
    adjustment_type: params.type === 'bonus' ? 'bonus' : 'other',
    amount: params.amount,
    direction: params.type === 'discount' ? 'deduct' : 'add',
    adjustment_date: params.date ?? dateKeyInTimeZone(),
    description: params.description?.trim() || (params.type === 'salary' ? 'Salario añadido' : params.type === 'bonus' ? 'Bono' : 'Descuento'),
    source_system: 'payroll_card',
  })
  if (error) throw error
}

export async function getAdvances(dateStart?: string, dateEnd?: string, allPages = false): Promise<Advance[]> {
  const rows = await fetchRows(() => {
  let query = client()
  .from('advances')
  .select('id,employee_id,amount,account_id,currency,original_amount,exchange_rate,advance_date,is_deducted,notes,created_at,employees(full_name),financial_accounts(name)')
  .order('advance_date', { ascending: false })
if (dateStart) query = query.gte('advance_date', dateStart)
if (dateEnd) query = query.lte('advance_date', dateEnd)
    return query
  }, allPages)
  return rows.map((r) => ({
    id: r.id as string,
    employeeId: r.employee_id as string,
    employeeName: Array.isArray(r.employees) ? (r.employees[0] as Record<string, unknown>)?.full_name as string ?? '' : '',
    amount: Number(r.amount),
    accountId: (r.account_id as string) ?? null,
    accountName: Array.isArray(r.financial_accounts) ? String((r.financial_accounts[0] as Record<string, unknown>)?.name ?? '') : null,
    currency: (r.currency as Advance['currency']) ?? null,
    originalAmount: r.original_amount == null ? null : Number(r.original_amount),
    exchangeRate: r.exchange_rate == null ? null : Number(r.exchange_rate),
    advanceDate: r.advance_date as string,
    isDeducted: r.is_deducted as boolean,
    notes: (r.notes as string) ?? null,
    createdAt: r.created_at as string,
  }))
}

export async function createAdvance(params: {
  employeeId: string
  amount: number
  accountId: string
  exchangeRate?: number | null
  advanceDate?: string
  notes?: string | null
}): Promise<void> {
  const { error } = await client().rpc('fn_create_employee_advance', {
    p_employee_id: params.employeeId,
    p_original_amount: params.amount,
    p_account_id: params.accountId,
    p_exchange_rate: params.exchangeRate ?? null,
    p_advance_date: params.advanceDate ?? dateKeyInTimeZone(),
    p_notes: params.notes ?? null,
  })
  if (error) throw error
}

export async function setAdvanceDeducted(id: string, deducted: boolean): Promise<void> {
  const { error } = await client()
    .from('advances')
    .update({ is_deducted: deducted })
    .eq('id', id)
  if (error) throw error
}

/**
 * Resumen de nómina para Finanzas: net_pay por período (con su fecha de cierre)
 * y bonos de producción por fecha. Permite sumar la nómina de cualquier rango
 * en el cliente sin múltiples viajes por período.
 */
export async function getPayrollSummary(): Promise<{
  periods: Array<{ endDate: string; total: number }>
  bonuses: Array<{ date: string; amount: number }>
}> {
  const periods = await getPayrollPeriods()
  const periodTotals: Array<{ endDate: string; total: number }> = []
  for (const p of periods) {
    const entries = await getPayrollEntries(p.id)
    periodTotals.push({ endDate: p.endDate, total: entries.reduce((s, e) => s + e.netPay, 0) })
  }
  const bonuses = (await getProductionBonusRecords()).map((b) => ({ date: b.bonusDate, amount: b.amount }))
  return { periods: periodTotals, bonuses }
}

export async function liquidatePayrollPeriod(params: {
  periodId: string
  accountId: string
  currency: 'USD' | 'Bs'
  exchangeRate?: number | null
  reference?: string | null
  notes?: string | null
}): Promise<{ totalUsd: number; totalOriginal: number; currency: string; alreadyPaid?: boolean }> {
  const { data, error } = await client().rpc('fn_liquidate_payroll_period', {
    p_period_id: params.periodId,
    p_account_id: params.accountId,
    p_currency: params.currency,
    p_exchange_rate: params.exchangeRate ?? null,
    p_reference: params.reference ?? null,
    p_notes: params.notes ?? null,
  })
  if (error) throw error
  const result = (data ?? {}) as Record<string, unknown>
  return {
    totalUsd: Number(result.total_usd ?? 0), totalOriginal: Number(result.total_original ?? 0),
    currency: String(result.currency ?? params.currency), alreadyPaid: result.already_paid === true,
  }
}

/**
 * Liquida un período pagando desde varias cuentas (pago dividido). Cada fuente
 * lleva el monto en la moneda de su cuenta y, si es en Bs, su tasa. El backend
 * valida que la suma en USD cuadre con el total del período.
 */
export async function liquidatePayrollPeriodSplit(params: {
  periodId: string
  sources: Array<{ accountId: string; amount: number; rate?: number | null }>
  reference?: string | null
  notes?: string | null
}): Promise<{ totalUsd: number; assignedUsd: number; sources: number; alreadyPaid?: boolean }> {
  const { data, error } = await client().rpc('fn_liquidate_payroll_period_split', {
    p_period_id: params.periodId,
    p_sources: params.sources.map((s) => ({ account_id: s.accountId, amount: s.amount, rate: s.rate ?? null })),
    p_reference: params.reference ?? null,
    p_notes: params.notes ?? null,
  })
  if (error) throw error
  const result = (data ?? {}) as Record<string, unknown>
  return {
    totalUsd: Number(result.total_usd ?? 0), assignedUsd: Number(result.assigned_usd ?? 0),
    sources: Number(result.sources ?? 0), alreadyPaid: result.already_paid === true,
  }
}

