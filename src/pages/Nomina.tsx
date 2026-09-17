import { useEffect, useMemo, useState, useCallback } from 'react'
import { createPortal } from 'react-dom'
import {
  getAllEmployees, getPayrollPeriods, createPayrollPeriod, getPayrollEntries, upsertPayrollEntry,
  deletePayrollPeriod,
  getAdvances, createAdvance, setAdvanceDeducted, getProductionBonusRecords, createProductionBonus,
  getPayrollPayments, createPayrollPayment, getFinancialAccounts, liquidatePayrollPeriod, getDeliveryAssignments, payDeliveryCommissions,
  type Employee, type PayrollPeriod, type PayrollEntry, type Advance, type ProductionBonusRecord, type PayrollPayment, type FinancialAccount, type DeliveryAssignment,
} from '../lib/dataService'
import { formatUsd, formatVes, dateKeyInTimeZone } from '../lib/money'
import { useRates } from '../context/rates-context'
import { PageSkeleton } from '../components/PageSkeleton'
import { DateField } from '../components/DateField'
import { StyledSelect } from '../components/StyledSelect'
import NumberStepper from '../components/NumberStepper'
import {
  Plus, Loader2, Users, Banknote, Gift, Hourglass,
  HelpCircle, Save,
  Trash2, X, Bike,
} from 'lucide-react'
import Toast from '../components/Toast'
import './Nomina.css'
import { confirmDialog } from '../components/ConfirmDialog'

const initials = (name: string) => name.split(' ').filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase()

export function Nomina() {
  const { bcvRate } = useRates()
  const [employees, setEmployees] = useState<Employee[]>([])
  const [periods, setPeriods] = useState<PayrollPeriod[]>([])
  const [entriesByPeriod, setEntriesByPeriod] = useState<Record<string, PayrollEntry[]>>({})
  const [advances, setAdvances] = useState<Advance[]>([])
  const [bonuses, setBonuses] = useState<ProductionBonusRecord[]>([])
  const [payments, setPayments] = useState<PayrollPayment[]>([])
  const [accounts, setAccounts] = useState<FinancialAccount[]>([])
  const [deliveryAssignments, setDeliveryAssignments] = useState<DeliveryAssignment[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [saving, setSaving] = useState(false)

  // Edición de horas/deducciones por empleado
  const [edit, setEdit] = useState<Record<string, { bonus: string; overtimeHours: string; transport: string; absenceDays: string; extraDeductions: string }>>({})

  // Modales
  const [showPeriod, setShowPeriod] = useState(false)
  const [closingPeriod, setClosingPeriod] = useState(false)
  const [pStart, setPStart] = useState(''); const [pEnd, setPEnd] = useState(''); const [pNotes, setPNotes] = useState('')
  const [showAdvance, setShowAdvance] = useState(false)
  const [closingAdvance, setClosingAdvance] = useState(false)
  const [advEmp, setAdvEmp] = useState(''); const [advAmt, setAdvAmt] = useState(''); const [advDate, setAdvDate] = useState(dateKeyInTimeZone()); const [advNotes, setAdvNotes] = useState('')
  const [showBonus, setShowBonus] = useState(false)
  const [closingBonus, setClosingBonus] = useState(false)
  const [showPayment, setShowPayment] = useState(false)
  const [closingPayment, setClosingPayment] = useState(false)
  const [payEmp, setPayEmp] = useState(''); const [payAmt, setPayAmt] = useState(''); const [payAccount, setPayAccount] = useState(''); const [payRef, setPayRef] = useState(''); const [payNotes, setPayNotes] = useState('')
  const [detailEmp, setDetailEmp] = useState<Employee | null>(null)
  const [payingDelivery, setPayingDelivery] = useState(false)
  const [showSettlement, setShowSettlement] = useState(false)
  const [settlementAccount, setSettlementAccount] = useState('')
  const [settlementReference, setSettlementReference] = useState('')
  const [settlementNotes, setSettlementNotes] = useState('')
  const [bonEmp, setBonEmp] = useState(''); const [bonAmt, setBonAmt] = useState(''); const [bonDate, setBonDate] = useState(dateKeyInTimeZone()); const [bonReason, setBonReason] = useState('')

  const closePeriod = (then?: () => void) => {
    if (closingPeriod) return
    setClosingPeriod(true)
    window.setTimeout(() => { setShowPeriod(false); setClosingPeriod(false); then?.() }, 200)
  }
  const closeAdvance = (then?: () => void) => {
    if (closingAdvance) return
    setClosingAdvance(true)
    window.setTimeout(() => { setShowAdvance(false); setClosingAdvance(false); then?.() }, 200)
  }
  const closeBonus = (then?: () => void) => {
    if (closingBonus) return
    setClosingBonus(true)
    window.setTimeout(() => { setShowBonus(false); setClosingBonus(false); then?.() }, 200)
  }
  const closePayment = (then?: () => void) => {
    if (closingPayment) return
    setClosingPayment(true)
    window.setTimeout(() => { setShowPayment(false); setClosingPayment(false); then?.() }, 200)
  }

  const load = useCallback(async () => {
    try {
      setLoading(true); setError('')
      const [emp, per, adv, bon, pays, financialAccounts, deliveries] = await Promise.all([getAllEmployees(), getPayrollPeriods(), getAdvances(), getProductionBonusRecords(), getPayrollPayments(), typeof getFinancialAccounts === 'function' ? getFinancialAccounts() : Promise.resolve([]), typeof getDeliveryAssignments === 'function' ? getDeliveryAssignments() : Promise.resolve([])])
      setEmployees(emp); setPeriods(per); setAdvances(adv); setBonuses(bon); setPayments(pays); setAccounts(financialAccounts); setDeliveryAssignments(deliveries)
      const byPeriod: Record<string, PayrollEntry[]> = {}
      await Promise.all(per.map(async (p) => { byPeriod[p.id] = await getPayrollEntries(p.id) }))
      setEntriesByPeriod(byPeriod)
      setSelectedId((cur) => cur ?? (per[0]?.id ?? null))
    } catch (e) { setError(e instanceof Error ? e.message : 'Error cargando nómina') }
    finally { setLoading(false) }
  }, [])
  useEffect(() => { void load() }, [load])

  const flash = (m: string) => { setNotice(m); setTimeout(() => setNotice(''), 3000) }

  const activeEmployees = useMemo(() => employees.filter((e) => e.isActive), [employees])
  const weeklySchemaAvailable = employees.every((employee) => employee.hasWeeklyPayrollColumns !== false)
  const paidByEmployee = useMemo(() => payments.reduce((m, p) => m.set(p.employeeId, (m.get(p.employeeId) ?? 0) + (p.currency === 'Bs' && p.exchangeRate ? p.amount / p.exchangeRate : p.amount)), new Map<string, number>()), [payments])
  const deliveryByEmployee = useMemo(() => deliveryAssignments.reduce((m, assignment) => {
    if (assignment.status === 'pending') m.set(assignment.employeeId, (m.get(assignment.employeeId) ?? 0) + assignment.employeeAmount)
    return m
  }, new Map<string, number>()), [deliveryAssignments])
  const selected = periods.find((p) => p.id === selectedId) ?? null
  const selectedEntries = useMemo(() => selectedId ? entriesByPeriod[selectedId] ?? [] : [], [entriesByPeriod, selectedId])
  const legacySaved = selectedEntries.some((entry) => !entry.hasBreakdown)
  const periodEmployees = useMemo(() => {
    if (selectedEntries.length === 0) return activeEmployees
    const map = new Map<string, Employee>()
    for (const entry of selectedEntries) {
      const employee = employees.find((item) => item.id === entry.employeeId)
      if (employee) map.set(employee.id, employee)
      else map.set(entry.employeeId, { id: entry.employeeId, fullName: entry.employeeName || 'Empleado', position: entry.position, hourlyRate: 0, weeklySalary: entry.weeklySalary, overtimeRate: 0, isActive: false })
    }
    for (const assignment of deliveryAssignments) {
      const inPeriod = selected && (assignment.payrollPeriodId === selected.id || (assignment.assignedAt.slice(0, 10) >= selected.startDate && assignment.assignedAt.slice(0, 10) <= selected.endDate))
      if (assignment.status !== 'cancelled' && inPeriod) {
        const employee = employees.find((item) => item.id === assignment.employeeId)
        if (employee) map.set(employee.id, employee)
      }
    }
    return [...map.values()]
  }, [activeEmployees, deliveryAssignments, employees, selected, selectedEntries])
  const savedNet = selectedEntries.reduce((sum, entry) => sum + entry.netPay, 0)
  const bsReference = (usd: number) => bcvRate && bcvRate > 0 ? formatVes(usd * bcvRate) : 'Bs. —'

  const deliveryForEmp = useCallback((empId: string) => {
    if (!selected) return 0
    return deliveryAssignments.filter((assignment) => assignment.employeeId === empId && assignment.status !== 'cancelled' && (assignment.payrollPeriodId === selected.id || (assignment.assignedAt.slice(0, 10) >= selected.startDate && assignment.assignedAt.slice(0, 10) <= selected.endDate))).reduce((sum, assignment) => sum + assignment.employeeAmount, 0)
  }, [deliveryAssignments, selected])

  // Bonos de un empleado dentro del período seleccionado
  const bonusForEmp = useCallback((empId: string) => {
    if (!selected) return 0
    return bonuses.filter((b) => b.employeeId === empId && b.bonusDate >= selected.startDate && b.bonusDate <= selected.endDate).reduce((s, b) => s + b.amount, 0)
  }, [bonuses, selected])

  // Inicializar edición al cambiar de período
  useEffect(() => {
    if (!selected) return
    const init: Record<string, { bonus: string; overtimeHours: string; transport: string; absenceDays: string; extraDeductions: string }> = {}
    for (const emp of periodEmployees) {
      const ex = selectedEntries.find((e) => e.employeeId === emp.id)
      init[emp.id] = { bonus: ex ? String(ex.bonusAmount) : String(bonusForEmp(emp.id)), overtimeHours: ex ? String(ex.overtimeHours) : '0', transport: ex ? String(ex.transportAmount) : '0', absenceDays: ex ? String(ex.absenceDays) : '0', extraDeductions: ex ? String(Math.max(0, ex.deductions - ex.absenceDeduction - ex.advanceDeduction)) : '0' }
    }
    setEdit(init)
  }, [selectedId, selectedEntries, periodEmployees, selected, bonusForEmp])

  const periodNet = useCallback((p: PayrollPeriod) => {
    const delivery = deliveryAssignments.filter((assignment) => assignment.status !== 'cancelled' && (assignment.payrollPeriodId === p.id || (assignment.assignedAt.slice(0, 10) >= p.startDate && assignment.assignedAt.slice(0, 10) <= p.endDate))).reduce((sum, assignment) => sum + assignment.employeeAmount, 0)
    return (entriesByPeriod[p.id] ?? []).reduce((sum, entry) => sum + entry.netPay, 0) + delivery
  }, [deliveryAssignments, entriesByPeriod])

  // Totales de la tabla del período seleccionado (desde la edición en vivo)
  const rows = periodEmployees.map((emp) => {
    const stored = selectedEntries.find((entry) => entry.employeeId === emp.id)
    const ed = edit[emp.id] ?? { bonus: '0', overtimeHours: '0', transport: '0', absenceDays: '0', extraDeductions: '0' }
    const weekly = stored?.hasBreakdown ? stored.weeklySalary : emp.weeklySalary || emp.hourlyRate * 48
    const bonus = parseFloat(ed.bonus) || 0
    const overtimeHours = parseFloat(ed.overtimeHours) || 0
    const overtimeRate = stored?.hasBreakdown && stored.overtimeHours > 0 ? stored.overtimeAmount / stored.overtimeHours : emp.overtimeRate || emp.hourlyRate
    const overtime = overtimeHours * overtimeRate
    const transport = parseFloat(ed.transport) || 0
    const absenceDays = parseFloat(ed.absenceDays) || 0
    const absenceDeduction = stored?.hasBreakdown && absenceDays === stored.absenceDays ? stored.absenceDeduction : weekly / 6 * absenceDays
    const advance = stored?.hasBreakdown ? stored.advanceDeduction : advances.filter((a) => a.employeeId === emp.id && !a.isDeducted && (!selected || a.advanceDate <= selected.endDate)).reduce((s, a) => s + a.amount, 0)
    const extra = parseFloat(ed.extraDeductions) || 0
    const bruto = weekly + bonus + overtime + transport
    const ded = absenceDeduction + advance + extra
    const delivery = deliveryForEmp(emp.id)
    return { emp, weekly, bonus, delivery, overtimeHours, overtime, transport, absenceDays, absenceDeduction, advance, extra, bruto, ded, neto: bruto - ded + delivery }
  })
  const tot = rows.reduce((a, r) => ({ hours: a.hours + r.overtimeHours, bruto: a.bruto + r.bruto, ded: a.ded + r.ded, bon: a.bon + r.bonus, delivery: a.delivery + r.delivery, neto: a.neto + r.neto }), { hours: 0, bruto: 0, ded: 0, bon: 0, delivery: 0, neto: 0 })

  const saveEntries = async () => {
    if (!selected) return
    if (!weeklySchemaAvailable) { setError('El servidor aún no tiene la migración semanal de nómina. No se pueden guardar bonos y ajustes por empleado hasta aplicarla.'); return }
    if (legacySaved) { setError('Este período tiene liquidaciones antiguas sin desglose. Se conserva su total histórico; no se puede sobrescribir con sueldos actuales.'); return }
    setSaving(true); setError('')
    try {
      for (const r of rows) {
        await upsertPayrollEntry({ payrollPeriodId: selected.id, employeeId: r.emp.id, hoursWorked: r.overtimeHours, baseSalary: r.bruto, deductions: r.ded, weeklySalary: r.weekly, bonusAmount: r.bonus, overtimeHours: r.overtimeHours, overtimeAmount: r.overtime, transportAmount: r.transport, absenceDays: r.absenceDays, absenceDeduction: r.absenceDeduction, advanceDeduction: r.advance })
      }
      const updated = await getPayrollEntries(selected.id)
      setEntriesByPeriod((prev) => ({ ...prev, [selected.id]: updated }))
      return true
    } catch (e) { setError(e instanceof Error ? e.message : 'Error guardando liquidación') }
    finally { setSaving(false) }
  }

  const handleSaveAll = async () => {
    const saved = await saveEntries()
    if (saved) flash('Liquidación guardada')
  }

  const openSettlement = async () => {
    if (!selected || selected.status === 'paid') return
    const saved = await saveEntries()
    if (saved) {
      setSettlementAccount(accounts.find((account) => account.isActive && (account.currency === 'USD' || account.currency === 'VES'))?.id ?? '')
      setShowSettlement(true)
    }
  }

  const submitSettlement = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selected || !settlementAccount) return
    const account = accounts.find((item) => item.id === settlementAccount)
    if (!account) return
    setSaving(true); setError('')
    try {
      const result = await liquidatePayrollPeriod({ periodId: selected.id, accountId: account.id, currency: account.currency === 'VES' ? 'Bs' : 'USD', exchangeRate: account.currency === 'VES' ? bcvRate : 1, reference: settlementReference.trim() || null, notes: settlementNotes.trim() || null })
      setShowSettlement(false); setSettlementReference(''); setSettlementNotes(''); await load()
      flash(result.alreadyPaid ? 'Este período ya estaba liquidado' : `Nómina liquidada desde ${account.name}`)
    } catch (e) { setError(e instanceof Error ? e.message : 'Error liquidando nómina') }
    finally { setSaving(false) }
  }

  const submitPeriod = async (e: React.FormEvent) => {
    e.preventDefault(); if (!pStart || !pEnd) return
    try { await createPayrollPeriod({ startDate: pStart, endDate: pEnd, notes: pNotes.trim() || undefined }); closePeriod(() => { setPStart(''); setPEnd(''); setPNotes('') }); await load(); flash('Período creado') }
    catch (e) { setError(e instanceof Error ? e.message : 'Error creando período') }
  }
  const handleDeletePeriod = async (period: PayrollPeriod) => {
    const ok = await confirmDialog({
      title: 'Eliminar período de nómina',
      message: `¿Eliminar el período ${fmtRange(period)}?\n\nSolo se puede borrar si está abierto y todavía no tiene pagos ni ajustes asociados. Sus liquidaciones se eliminarán junto con el período.`,
      confirmText: 'Eliminar período', danger: true,
    })
    if (!ok) return
    try {
      await deletePayrollPeriod(period.id)
      if (selectedId === period.id) setSelectedId(null)
      await load()
      flash('Período eliminado')
    } catch (e) { setError(e instanceof Error ? e.message : 'No se pudo eliminar el período') }
  }
  const submitAdvance = async (e: React.FormEvent) => {
    e.preventDefault(); if (!advEmp || !advAmt) return
    try { await createAdvance({ employeeId: advEmp, amount: parseFloat(advAmt) || 0, advanceDate: advDate, notes: advNotes.trim() || undefined }); closeAdvance(() => { setAdvEmp(''); setAdvAmt(''); setAdvNotes('') }); await load(); flash('Adelanto registrado') }
    catch (e) { setError(e instanceof Error ? e.message : 'Error registrando adelanto') }
  }
  const submitBonus = async (e: React.FormEvent) => {
    e.preventDefault(); if (!bonEmp || !bonAmt) return
    try { await createProductionBonus({ employeeId: bonEmp, amount: parseFloat(bonAmt) || 0, bonusDate: bonDate, reason: bonReason.trim() || undefined }); closeBonus(() => { setBonEmp(''); setBonAmt(''); setBonReason('') }); await load(); flash('Bono registrado') }
    catch (e) { setError(e instanceof Error ? e.message : 'Error registrando bono') }
  }
  const submitPayment = async (e: React.FormEvent) => {
    e.preventDefault(); if (!payEmp || !payAmt) return
    try { await createPayrollPayment({ employeeId: payEmp, amount: parseFloat(payAmt) || 0, paymentAccount: payAccount.trim() || null, reference: payRef.trim() || null, notes: payNotes.trim() || null }); closePayment(() => { setPayEmp(''); setPayAmt(''); setPayAccount(''); setPayRef(''); setPayNotes('') }); await load(); flash('Pago registrado') }
    catch (e) { setError(e instanceof Error ? e.message : 'Error registrando pago') }
  }

  const handlePayDelivery = async (emp: Employee) => {
    const pending = deliveryAssignments.filter((d) => d.employeeId === emp.id && d.status === 'pending')
    const amount = Math.round(pending.reduce((sum, d) => sum + d.employeeAmount, 0) * 100) / 100
    if (pending.length === 0 || amount <= 0) return
    const ok = await confirmDialog({
      title: 'Pagar comisiones de delivery',
      message: `Se registrará un pago de ${formatUsd(amount)} a ${emp.fullName} y se marcarán ${pending.length} comisión${pending.length === 1 ? '' : 'es'} como pagada${pending.length === 1 ? '' : 's'}. ¿Continuar?`,
      confirmText: 'Pagar',
    })
    if (!ok) return
    setPayingDelivery(true); setError('')
    try {
      const result = await payDeliveryCommissions({ employeeId: emp.id, notes: 'Pago de comisiones de delivery' })
      await load(); flash(`Pagadas ${result.paidCount} comisiones (${formatUsd(result.amount)})`)
    } catch (e) { setError(e instanceof Error ? e.message : 'No se pudieron pagar las comisiones') }
    finally { setPayingDelivery(false) }
  }

  if (loading) return <PageSkeleton cards={3} rows={5} />

  const pendingAdvances = advances.filter((a) => !a.isDeducted).reduce((s, a) => s + a.amount, 0)
  const pendingCount = advances.filter((a) => !a.isDeducted).length
  const periodBonuses = selectedEntries.length ? selectedEntries.reduce((s, entry) => s + entry.bonusAmount, 0) : selected ? bonuses.filter((b) => b.bonusDate >= selected.startDate && b.bonusDate <= selected.endDate).reduce((s, b) => s + b.amount, 0) : 0
  const displayedNet = legacySaved ? savedNet : tot.neto
  const shownBonuses = selectedEntries.length > 0
    ? selectedEntries.filter((entry) => entry.bonusAmount > 0).map((entry) => ({
      id: entry.id, date: selected?.endDate ?? '', employeeName: entry.employeeName || employees.find((emp) => emp.id === entry.employeeId)?.fullName || 'Empleado',
      amount: entry.bonusAmount, reason: 'Liquidación guardada',
    }))
    : bonuses.filter((bonus) => !selected || bonus.bonusDate >= selected.startDate && bonus.bonusDate <= selected.endDate).map((bonus) => ({
      id: bonus.id, date: bonus.bonusDate, employeeName: bonus.employeeName, amount: bonus.amount, reason: bonus.reason || '—',
    }))
  const shownAdvances = selectedEntries.length > 0
    ? selectedEntries.filter((entry) => entry.advanceDeduction > 0).map((entry) => ({
      id: entry.id, date: selected?.endDate ?? '', employeeName: entry.employeeName || employees.find((emp) => emp.id === entry.employeeId)?.fullName || 'Empleado',
      amount: entry.advanceDeduction, deducted: true, advanceId: null,
    }))
    : advances.filter((advance) => !selected || advance.advanceDate <= selected.endDate).map((advance) => ({
      id: advance.id, date: advance.advanceDate, employeeName: advance.employeeName, amount: advance.amount, deducted: advance.isDeducted, advanceId: advance.id,
    }))
  const statusCls = (s: string) => s === 'open' ? 'open' : s === 'paid' ? 'paid' : 'closed'
  const statusLbl = (s: string) => s === 'open' ? 'Abierto' : s === 'paid' ? 'Pagado' : 'Cerrado'
  const fmtDateOnly = (value: string) => new Date(`${value}T00:00:00`).toLocaleDateString('es-VE')
  const fmtRange = (p: PayrollPeriod) => `${fmtDateOnly(p.startDate)} - ${fmtDateOnly(p.endDate)}`

  return (
    <div className="page nom-page animate-fade-in management-workspace management-workspace--payroll">
      <header className="page-header management-workspace-header">
        <div>
          <h1 className="page-title"><Banknote size={22} className="page-title-icon" /> Nómina y Personal</h1>
          <p className="page-subtitle">Liquida sueldos por período, adelantos y bonos de producción.</p>
        </div>
        <div className="nom-head-actions">
          <button className="nom-ghost" onClick={() => flash('La nómina es semanal: sueldo base + bono + horas extra + transporte - ausencias - adelantos pendientes.')}><HelpCircle size={15} /> ¿Cómo funciona?</button>
          <button className="nom-btn" onClick={() => setShowPeriod(true)}><Plus size={16} /> Nuevo Período</button>
        </div>
      </header>

      {error && <Toast type="error" message={error} onClose={() => setError('')} />}
      {notice && <Toast type="success" message={notice} onClose={() => setNotice('')} />}

      {/* Resumen */}
      <div className="nom-summary management-workspace-metrics">
        <div className="nom-sum">
          <div className="nom-sum-top"><span className="nom-sum-ic" style={{ background: 'rgba(250, 204, 21,0.15)', color: '#facc15' }}><Users size={20} /></span>
            <div><div className="nom-sum-lbl">Empleados activos</div><div className="nom-sum-val">{activeEmployees.length}</div><div className="nom-sum-sub">de {employees.length} registrados</div></div></div>
        </div>
        <div className="nom-sum">
          <div className="nom-sum-top"><span className="nom-sum-ic" style={{ background: 'rgba(34,197,94,0.15)', color: '#22c55e' }}><Banknote size={20} /></span>
            <div><div className="nom-sum-lbl">Liquidación del período</div><div className="nom-sum-val">{formatUsd(displayedNet)}</div><div className="nom-sum-sub">{selected ? `Período seleccionado` : 'Sin período'}</div></div></div>
        </div>
        <div className="nom-sum">
          <div className="nom-sum-top"><span className="nom-sum-ic" style={{ background: 'rgba(250, 204, 21,0.15)', color: '#facc15' }}><Gift size={20} /></span>
            <div><div className="nom-sum-lbl">Bonos totales</div><div className="nom-sum-val">{legacySaved ? '—' : formatUsd(periodBonuses)}</div><div className="nom-sum-sub">{legacySaved ? 'Desglose histórico no disponible' : 'Período seleccionado'}</div></div></div>
        </div>
        <div className="nom-sum">
          <div className="nom-sum-top"><span className="nom-sum-ic" style={{ background: 'rgba(239,68,68,0.15)', color: '#ef4444' }}><Hourglass size={20} /></span>
            <div><div className="nom-sum-lbl">Adelantos pendientes</div><div className="nom-sum-val">{formatUsd(pendingAdvances)}</div><div className="nom-sum-sub">{pendingCount} adelanto{pendingCount === 1 ? '' : 's'} pendiente{pendingCount === 1 ? '' : 's'}</div></div></div>
        </div>
      </div>

      <div className="nom-card">
        <div className="nom-card-head"><div><h2>Personal y pagos directos</h2><p>Registra pagos sin crear un período. Los períodos quedan disponibles para reportes.</p></div><button className="nom-btn" onClick={() => setShowPayment(true)}><Plus size={16} /> Registrar pago</button></div>
        <div className="nom-periods">
          {activeEmployees.map((emp) => {
            const isDelivery = emp.position?.toLowerCase() === 'delivery' || employees.find((item) => item.id === emp.id)?.position?.toLowerCase() === 'delivery'
            const directPayments = payments.filter((p) => p.employeeId === emp.id).length
            const accrued = paidByEmployee.get(emp.id) ?? 0
            const deliveryAccrued = deliveryByEmployee.get(emp.id) ?? 0
            return <button type="button" className="nom-period nom-period--clickable" key={emp.id} onClick={() => setDetailEmp(emp)}><div className="nom-period-top"><strong>{emp.fullName}</strong><span className="nom-status open">{emp.position || 'Empleado'}</span></div><div className="liq">{isDelivery ? `Comisión acumulada: ${formatUsd(deliveryAccrued)}` : `Pagado acumulado: ${formatUsd(accrued)}`}</div><small>{isDelivery ? `${deliveryAccrued > 0 ? 'Comisión pendiente de liquidar' : 'Sin comisiones registradas'} · ${directPayments} pagos directos` : `${directPayments} pagos registrados · ${emp.hourlyRate ? `Tarifa ${formatUsd(emp.hourlyRate)}/h` : 'Pago directo o comisión'}`}</small><span className="nom-period-more">Ver detalle →</span></button>
          })}
        </div>
        {payments.length > 0 && <div className="nom-mini-table-wrap"><table className="nom-mini-table"><thead><tr><th>Fecha</th><th>Empleado</th><th>Monto</th><th>Cuenta</th><th>Referencia</th></tr></thead><tbody>{payments.slice(0, 8).map((p) => <tr key={p.id}><td>{new Date(p.paymentDate).toLocaleDateString('es-VE')}</td><td>{p.employeeName}</td><td><strong>{formatUsd(p.amount)}</strong></td><td>{p.paymentAccount || '—'}</td><td>{p.reference || '—'}</td></tr>)}</tbody></table></div>}
      </div>

      {/* Períodos */}
      <div className="nom-card">
        <div className="nom-card-head"><div><h2>Períodos de Nómina</h2><p>Gestiona y selecciona el período que deseas liquidar.</p></div>
          <button className="nom-btn" onClick={() => setShowPeriod(true)}><Plus size={16} /> Nuevo Período</button></div>
        {periods.length === 0 ? <p style={{ color: '#71717a' }}>No hay períodos. Crea uno con el botón de arriba.</p> : (
          <div className="nom-periods">
            {periods.map((p) => (
              <button key={p.id} className={`nom-period${selectedId === p.id ? ' active' : ''}`} onClick={() => setSelectedId(p.id)}>
                <div className="nom-period-top"><strong>{fmtRange(p)}</strong><span className={`nom-status ${statusCls(p.status)}`}>{statusLbl(p.status)}</span><span className="nom-period-actions"><span className="nom-period-delete" role="button" tabIndex={0} title="Eliminar período" aria-label={`Eliminar período ${fmtRange(p)}`} onClick={(e) => { e.stopPropagation(); void handleDeletePeriod(p) }} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); void handleDeletePeriod(p) } }}><Trash2 size={15} /></span></span></div>
                {p.notes && <small>{p.notes}</small>}
                <div className="liq">Liquidación: {formatUsd(periodNet(p))}</div>
                <small>{(entriesByPeriod[p.id] ?? []).length} liquidados · {activeEmployees.length} empleados</small>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Liquidación */}
      {selected && (
        <div className="nom-card">
          <div className="nom-card-head">
            <div><h2>Liquidación del Período: {fmtRange(selected)} <span className={`nom-status ${statusCls(selected.status)}`}>{statusLbl(selected.status)}</span></h2><p>Sueldo semanal, bonos, extras, transporte, ausencias y adelantos pendientes.</p></div>
            {!legacySaved && selected.status === 'open' && <div className="nom-head-actions"><button className="nom-ghost" onClick={handleSaveAll} disabled={saving || !weeklySchemaAvailable}><Save size={16} /> Guardar liquidación</button><button className="nom-btn" onClick={() => void openSettlement()} disabled={saving || !weeklySchemaAvailable}>{saving ? <Loader2 size={16} className="animate-spin" /> : <Banknote size={16} />} Liquidar y pagar</button></div>}
          </div>
          {!weeklySchemaAvailable && !legacySaved && <p className="nom-history-note">El servidor aún no tiene la migración semanal de nómina. Puedes consultar los períodos existentes; para guardar nuevos bonos y ajustes hay que actualizar la base de datos.</p>}
          {legacySaved ? (
            <div className="nom-table-wrap">
              <p className="nom-history-note">Este período conserva el monto guardado, pero las liquidaciones antiguas no registraron los bonos y ajustes por separado. No se puede reconstruir ese desglose con certeza.</p>
              <table className="nom-table nom-history-table">
                <thead><tr><th>Empleado</th><th>Monto guardado</th><th>Deducciones guardadas</th><th>Neto guardado</th></tr></thead>
                <tbody>
                  {selectedEntries.map((entry) => <tr key={entry.id}><td>{entry.employeeName || employees.find((emp) => emp.id === entry.employeeId)?.fullName || 'Empleado'}</td><td>{formatUsd(entry.baseSalary)}</td><td>{formatUsd(entry.deductions)}</td><td className="nom-net">{formatUsd(entry.netPay)}</td></tr>)}
                  <tr className="nom-tot-row"><td>TOTAL GUARDADO</td><td>{formatUsd(selectedEntries.reduce((sum, entry) => sum + entry.baseSalary, 0))}</td><td>{formatUsd(selectedEntries.reduce((sum, entry) => sum + entry.deductions, 0))}</td><td className="nom-net">{formatUsd(savedNet)}</td></tr>
                </tbody>
              </table>
            </div>
          ) : periodEmployees.length === 0 ? <p style={{ color: '#71717a' }}>No hay empleados activos. Agrégalos en Equipo / Usuarios.</p> : (
            <div className="nom-table-wrap">
              <table className="nom-table">
                <thead>
                  <tr>
                    <th className="nom-col-avatar" style={{ width: 36 }}></th>
                    <th className="nom-col-left">Empleado / Cargo</th>
                    <th className="nom-col-center">Sueldo semanal</th>
                    <th className="nom-col-center">Adelanto</th>
                    <th className="nom-col-center">Bono</th>
                    <th className="nom-col-center">Horas extra</th>
                    <th className="nom-col-center">Transporte</th>
                    <th className="nom-col-center">Día no laborado</th>
                    <th className="nom-col-right">Neto a pagar</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.emp.id}>
                      <td className="nom-col-avatar"><span className="nom-avatar">{initials(r.emp.fullName)}</span></td>
                      <td className="nom-col-left">
                        <div className="nom-cell-wrap nom-cell-emp">
                          <strong style={{ fontSize: 14 }}>{r.emp.fullName}</strong>
                          <small className="nom-cell-sub">{r.emp.position || 'Empleado'}</small>
                        </div>
                      </td>
                      <td className="nom-col-center">
                        <div className="nom-cell-wrap nom-cell-amount">
                          <strong>{formatUsd(r.weekly)}</strong>
                          <small className="nom-bs-ref">{bsReference(r.weekly)}</small>
                        </div>
                      </td>
                      <td className="nom-col-center">
                        <div className="nom-cell-wrap nom-cell-amount">
                          <strong style={{ color: r.advance > 0 ? '#ef4444' : '#a1a1aa' }}>
                            {r.advance > 0 ? `-${formatUsd(r.advance)}` : '$0,00'}
                          </strong>
                          <small className="nom-bs-ref">{r.advance > 0 ? `-${bsReference(r.advance)}` : bsReference(0)}</small>
                        </div>
                      </td>
                      <td className="nom-col-center">
                        <div className="nom-adjust-cell">
                          <input className="nom-adjust-input" type="number" inputMode="decimal" min="0" step="0.01" value={edit[r.emp.id]?.bonus ?? '0'} aria-label={`Bono de ${r.emp.fullName}`} onChange={(e) => setEdit((p) => ({ ...p, [r.emp.id]: { ...p[r.emp.id], bonus: e.target.value } }))} />
                          <small className="nom-stepper-hint" style={{ color: '#22c55e' }}>+{bsReference(r.bonus)}</small>
                          {r.delivery > 0 && <small className="nom-stepper-hint" style={{ color: '#f97316' }}>Delivery: {formatUsd(r.delivery)}</small>}
                        </div>
                      </td>
                      <td className="nom-col-center">
                        <div className="nom-adjust-cell">
                          <input className="nom-adjust-input" type="number" inputMode="decimal" min="0" step="0.5" value={edit[r.emp.id]?.overtimeHours ?? '0'} aria-label={`Horas extra de ${r.emp.fullName}`} onChange={(e) => setEdit((p) => ({ ...p, [r.emp.id]: { ...p[r.emp.id], overtimeHours: e.target.value } }))} />
                          <small className="nom-stepper-hint" style={{ color: '#22c55e' }}>+{bsReference(r.overtime)}</small>
                        </div>
                      </td>
                      <td className="nom-col-center">
                        <div className="nom-adjust-cell">
                          <input className="nom-adjust-input" type="number" inputMode="decimal" min="0" step="0.01" value={edit[r.emp.id]?.transport ?? '0'} aria-label={`Transporte de ${r.emp.fullName}`} onChange={(e) => setEdit((p) => ({ ...p, [r.emp.id]: { ...p[r.emp.id], transport: e.target.value } }))} />
                          <small className="nom-stepper-hint" style={{ color: '#22c55e' }}>+{bsReference(r.transport)}</small>
                        </div>
                      </td>
                      <td className="nom-col-center">
                        <div className="nom-adjust-cell">
                          <input className="nom-adjust-input" type="number" inputMode="decimal" min="0" step="1" value={edit[r.emp.id]?.absenceDays ?? '0'} aria-label={`Días no laborados de ${r.emp.fullName}`} onChange={(e) => setEdit((p) => ({ ...p, [r.emp.id]: { ...p[r.emp.id], absenceDays: e.target.value } }))} />
                          <small className="nom-stepper-hint" style={{ color: '#ef4444' }}>-{bsReference(r.absenceDeduction)}</small>
                        </div>
                      </td>
                      <td className="nom-col-right">
                        <div className="nom-cell-wrap nom-cell-right">
                          <strong className="nom-net">{formatUsd(r.neto)}</strong>
                          <small className="nom-bs-ref nom-bs-ref--green">{bsReference(r.neto)}</small>
                        </div>
                      </td>
                    </tr>
                  ))}
                  <tr className="nom-tot-row">
                    <td className="nom-col-avatar"></td>
                    <td className="nom-col-left">
                      <div className="nom-cell-wrap nom-cell-emp">
                        <strong style={{ fontSize: 13, textTransform: 'uppercase', letterSpacing: 0.5 }}>TOTALES</strong>
                        <small className="nom-cell-sub">{rows.length} empleados</small>
                      </div>
                    </td>
                    <td className="nom-col-center">
                      <div className="nom-cell-wrap nom-cell-amount">
                        <strong>{formatUsd(rows.reduce((s, r) => s + r.weekly, 0))}</strong>
                        <small className="nom-bs-ref">{bsReference(rows.reduce((s, r) => s + r.weekly, 0))}</small>
                      </div>
                    </td>
                    <td className="nom-col-center">
                      <div className="nom-cell-wrap nom-cell-amount">
                        <strong style={{ color: '#ef4444' }}>-{formatUsd(rows.reduce((s, r) => s + r.advance, 0))}</strong>
                        <small className="nom-bs-ref">-{bsReference(rows.reduce((s, r) => s + r.advance, 0))}</small>
                      </div>
                    </td>
                    <td className="nom-col-center">
                      <div className="nom-cell-wrap nom-cell-amount">
                        <strong style={{ color: '#22c55e' }}>+{formatUsd(tot.bon)}</strong>
                        <small className="nom-bs-ref">+{bsReference(tot.bon)}</small>
                      </div>
                    </td>
                    <td className="nom-col-center">
                      <div className="nom-cell-wrap nom-cell-amount">
                        <strong style={{ color: '#22c55e' }}>+{formatUsd(rows.reduce((s, r) => s + r.overtime, 0))}</strong>
                        <small className="nom-bs-ref">+{bsReference(rows.reduce((s, r) => s + r.overtime, 0))}</small>
                      </div>
                    </td>
                    <td className="nom-col-center">
                      <div className="nom-cell-wrap nom-cell-amount">
                        <strong style={{ color: '#22c55e' }}>+{formatUsd(rows.reduce((s, r) => s + r.transport, 0))}</strong>
                        <small className="nom-bs-ref">+{bsReference(rows.reduce((s, r) => s + r.transport, 0))}</small>
                      </div>
                    </td>
                    <td className="nom-col-center">
                      <div className="nom-cell-wrap nom-cell-amount">
                        <strong style={{ color: '#ef4444' }}>-{formatUsd(rows.reduce((s, r) => s + r.absenceDeduction, 0))}</strong>
                        <small className="nom-bs-ref">-{bsReference(rows.reduce((s, r) => s + r.absenceDeduction, 0))}</small>
                      </div>
                    </td>
                    <td className="nom-col-right">
                      <div className="nom-cell-wrap nom-cell-right">
                        <strong className="nom-net" style={{ fontSize: 16 }}>{formatUsd(tot.neto)}</strong>
                        <small className="nom-bs-ref nom-bs-ref--green">{bsReference(tot.neto)}</small>
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Adelantos / Bonos / Resumen */}
      <div className="nom-grid3">
        <div className="nom-card">
          <div className="nom-card-head"><div><h2>Adelantos de Salario</h2></div><button className="nom-btn" style={{ padding: '7px 12px', fontSize: 13 }} onClick={() => setShowAdvance(true)}><Plus size={14} /> Nuevo</button></div>
          <table className="nom-mini-table">
            <thead><tr><th>Fecha</th><th>Empleado</th><th>Monto</th><th>Estado</th></tr></thead>
            <tbody>
              {shownAdvances.slice(0, 5).map((a) => (
                <tr key={a.id}>
                  <td style={{ color: '#a1a1aa' }}>{new Date(a.date).toLocaleDateString('es-VE')}</td>
                  <td>{a.employeeName}</td><td><strong>{formatUsd(a.amount)}</strong></td>
                  <td><span className={`nom-pill ${a.deducted ? 'done' : 'pend'}`} onClick={a.advanceId ? () => { void setAdvanceDeducted(a.advanceId, !a.deducted).then(load) } : undefined}>{a.deducted ? 'Deducido' : 'Pendiente'}</span></td>
                </tr>
              ))}
              {shownAdvances.length === 0 && <tr><td colSpan={4} style={{ textAlign: 'center', color: '#71717a', padding: 16 }}>{legacySaved ? 'Desglose antiguo no disponible.' : 'Sin adelantos en este período.'}</td></tr>}
            </tbody>
          </table>
        </div>

        <div className="nom-card">
          <div className="nom-card-head"><div><h2>Bonos de Producción</h2></div><button className="nom-btn" style={{ padding: '7px 12px', fontSize: 13 }} onClick={() => setShowBonus(true)}><Plus size={14} /> Nuevo</button></div>
          <table className="nom-mini-table">
            <thead><tr><th>Fecha</th><th>Empleado</th><th>Monto</th><th>Motivo</th></tr></thead>
            <tbody>
              {shownBonuses.slice(0, 5).map((b) => (
                <tr key={b.id}><td style={{ color: '#a1a1aa' }}>{new Date(b.date).toLocaleDateString('es-VE')}</td><td>{b.employeeName}</td><td style={{ color: '#22c55e' }}><strong>{formatUsd(b.amount)}</strong></td><td style={{ color: '#a1a1aa' }}>{b.reason}</td></tr>
              ))}
              {shownBonuses.length === 0 && <tr><td colSpan={4} style={{ textAlign: 'center', color: '#71717a', padding: 16 }}>{legacySaved ? 'Desglose antiguo no disponible.' : 'Sin bonos en este período.'}</td></tr>}
            </tbody>
          </table>
        </div>

        {legacySaved ? <div className="nom-card">
          <h2 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 2px' }}>Resumen del Período</h2>
          <p style={{ fontSize: 12, color: '#a1a1aa', margin: '0 0 12px' }}>{selected ? fmtRange(selected) : 'Sin período'}</p>
          <div className="nom-res-row total"><span>TOTAL GUARDADO</span><span className="nom-net">{formatUsd(savedNet)}</span></div>
          <p style={{ fontSize: 11, color: '#a1a1aa', marginTop: 10 }}>El desglose de bonos y ajustes no quedó registrado en estas liquidaciones.</p>
        </div> : <div className="nom-card">
          <h2 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 2px' }}>Resumen del Período</h2>
          <p style={{ fontSize: 12, color: '#a1a1aa', margin: '0 0 12px' }}>{selected ? fmtRange(selected) : 'Sin período'}</p>
          <div className="nom-res-row"><span className="k">Total Sueldos Base</span><span>{formatUsd(rows.reduce((s, r) => s + r.weekly, 0))}</span></div>
          <div className="nom-res-row"><span className="k">Total Bonos</span><span style={{ color: '#22c55e' }}>+ {formatUsd(tot.bon)}</span></div>
          <div className="nom-res-row"><span className="k">Total Horas Extras</span><span style={{ color: '#22c55e' }}>+ {formatUsd(rows.reduce((s, r) => s + r.overtime, 0))}</span></div>
          <div className="nom-res-row"><span className="k">Total Transporte</span><span style={{ color: '#22c55e' }}>+ {formatUsd(rows.reduce((s, r) => s + r.transport, 0))}</span></div>
          <div className="nom-res-row"><span className="k">Total Adelantos</span><span style={{ color: '#ef4444' }}>- {formatUsd(rows.reduce((s, r) => s + r.advance, 0))}</span></div>
          <div className="nom-res-row"><span className="k">Total Días no laborados</span><span style={{ color: '#ef4444' }}>- {formatUsd(rows.reduce((s, r) => s + r.absenceDeduction, 0))}</span></div>
          <div className="nom-res-row total"><span>TOTAL NETO A PAGAR</span><span className="nom-net">{formatUsd(tot.neto)}</span></div>
          <p style={{ fontSize: 11, color: '#71717a', marginTop: 10 }}>{activeEmployees.length} empleados a liquidar</p>
        </div>}
      </div>

      {/* Modales */}
      {showPeriod && createPortal(
        <div className={`nom-modal-overlay ${closingPeriod ? 'closing' : ''}`} onClick={() => closePeriod()}>
          <form className="nom-modal nom-modal--period" onClick={(e) => e.stopPropagation()} onSubmit={submitPeriod}>
            <div className="nom-modal-header">
              <div className="nom-modal-header-icon"><Hourglass size={18} /></div>
              <h3>Nuevo período de nómina</h3>
            </div>
            <div className="nom-row2">
              <div className="nom-field"><label>Inicio *</label><DateField value={pStart} onChange={setPStart} required /></div>
              <div className="nom-field"><label>Fin *</label><DateField value={pEnd} onChange={setPEnd} required /></div>
            </div>
            <div className="nom-field"><label>Notas</label><input value={pNotes} onChange={(e) => setPNotes(e.target.value)} placeholder="Ej: Semana 3 - Agosto" /></div>
            <div className="nom-modal-actions"><button type="button" className="nom-cancel" onClick={() => closePeriod()}>Cancelar</button><button type="submit" className="nom-btn">Crear período</button></div>
          </form>
        </div>,
        document.body
      )}
      {showAdvance && createPortal(
        <div className={`nom-modal-overlay ${closingAdvance ? 'closing' : ''}`} onClick={() => closeAdvance()}>
          <form className="nom-modal nom-modal--advance" onClick={(e) => e.stopPropagation()} onSubmit={submitAdvance}>
            <div className="nom-modal-header">
              <div className="nom-modal-header-icon"><Banknote size={18} /></div>
              <h3>Nuevo adelanto</h3>
            </div>
            <div className="nom-field"><label>Empleado *</label><StyledSelect value={advEmp} onChange={(e) => setAdvEmp(e.target.value)} required><option value="">Seleccionar...</option>{activeEmployees.map((e) => <option key={e.id} value={e.id}>{e.fullName}</option>)}</StyledSelect></div>
            <div className="nom-row2">
              <div className="nom-field"><label>Monto ($) *</label><NumberStepper step={0.01} min={0.01} value={advAmt} onChange={(v) => setAdvAmt(v)} required /></div>
              <div className="nom-field"><label>Fecha</label><DateField value={advDate} onChange={setAdvDate} /></div>
            </div>
            <div className="nom-field"><label>Notas</label><input value={advNotes} onChange={(e) => setAdvNotes(e.target.value)} placeholder="Opcional" /></div>
            <div className="nom-modal-actions"><button type="button" className="nom-cancel" onClick={() => closeAdvance()}>Cancelar</button><button type="submit" className="nom-btn">Registrar</button></div>
          </form>
        </div>,
        document.body
      )}
      {showBonus && createPortal(
        <div className={`nom-modal-overlay ${closingBonus ? 'closing' : ''}`} onClick={() => closeBonus()}>
          <form className="nom-modal nom-modal--bonus" onClick={(e) => e.stopPropagation()} onSubmit={submitBonus}>
            <div className="nom-modal-header">
              <div className="nom-modal-header-icon"><Gift size={18} /></div>
              <h3>Nuevo bono de producción</h3>
            </div>
            <div className="nom-field"><label>Empleado *</label><StyledSelect value={bonEmp} onChange={(e) => setBonEmp(e.target.value)} required><option value="">Seleccionar...</option>{activeEmployees.map((e) => <option key={e.id} value={e.id}>{e.fullName}</option>)}</StyledSelect></div>
            <div className="nom-row2">
              <div className="nom-field"><label>Monto ($) *</label><NumberStepper step={0.01} min={0.01} value={bonAmt} onChange={(v) => setBonAmt(v)} required /></div>
              <div className="nom-field"><label>Fecha</label><DateField value={bonDate} onChange={setBonDate} /></div>
            </div>
            <div className="nom-field"><label>Motivo</label><input value={bonReason} onChange={(e) => setBonReason(e.target.value)} placeholder="Ej: Ventas destacadas" /></div>
            <div className="nom-modal-actions"><button type="button" className="nom-cancel" onClick={() => closeBonus()}>Cancelar</button><button type="submit" className="nom-btn">Registrar</button></div>
          </form>
        </div>,
        document.body
      )}
      {showPayment && createPortal(
        <div className={`nom-modal-overlay ${closingPayment ? 'closing' : ''}`} onClick={() => closePayment()}>
          <form className="nom-modal nom-modal--payment" onClick={(e) => e.stopPropagation()} onSubmit={submitPayment}>
            <div className="nom-modal-header">
              <div className="nom-modal-header-icon"><Banknote size={18} /></div>
              <h3>Registrar pago directo</h3>
            </div>
            <div className="nom-field"><label>Empleado *</label><StyledSelect value={payEmp} onChange={(e) => setPayEmp(e.target.value)} required><option value="">Seleccionar...</option>{activeEmployees.map((e) => <option key={e.id} value={e.id}>{e.fullName} — {e.position || 'Empleado'}</option>)}</StyledSelect></div>
            <div className="nom-row2">
              <div className="nom-field"><label>Monto ($) *</label><NumberStepper step={0.01} min={0.01} value={payAmt} onChange={(v) => setPayAmt(v)} required /></div>
              <div className="nom-field"><label>Cuenta</label><input value={payAccount} onChange={(e) => setPayAccount(e.target.value)} placeholder="Banesco, efectivo..." /></div>
            </div>
            <div className="nom-row2">
              <div className="nom-field"><label>Referencia</label><input value={payRef} onChange={(e) => setPayRef(e.target.value)} /></div>
              <div className="nom-field"><label>Notas</label><input value={payNotes} onChange={(e) => setPayNotes(e.target.value)} /></div>
            </div>
            <div className="nom-modal-actions"><button type="button" className="nom-cancel" onClick={() => closePayment()}>Cancelar</button><button type="submit" className="nom-btn">Guardar pago</button></div>
          </form>
        </div>,
        document.body
      )}
      {detailEmp && createPortal((() => {
        const emp = detailEmp
        const isDelivery = emp.position?.toLowerCase() === 'delivery'
        const empPayments = payments.filter((p) => p.employeeId === emp.id).sort((a, b) => b.paymentDate.localeCompare(a.paymentDate))
        const paidTotal = paidByEmployee.get(emp.id) ?? 0
        const empDeliveries = deliveryAssignments.filter((d) => d.employeeId === emp.id && d.status !== 'cancelled').sort((a, b) => b.assignedAt.localeCompare(a.assignedAt))
        const pendingDeliveries = empDeliveries.filter((d) => d.status === 'pending')
        const deliveryPending = pendingDeliveries.reduce((s, d) => s + d.employeeAmount, 0)
        const pendingAdvances = advances.filter((a) => a.employeeId === emp.id && !a.isDeducted)
        const advancesPending = pendingAdvances.reduce((s, a) => s + a.amount, 0)
        const fmtDate = (iso: string) => new Date(iso).toLocaleDateString('es-VE', { day: '2-digit', month: 'short' })
        return (
          <div className="nom-modal-overlay" onClick={() => setDetailEmp(null)}>
            <div className="nom-modal nom-modal--detail" onClick={(e) => e.stopPropagation()}>
              <div className="nom-modal-header">
                <div className="nom-modal-header-icon">{isDelivery ? <Bike size={18} /> : <Users size={18} />}</div>
                <h3>{emp.fullName}</h3>
                <span className="nom-status open">{emp.position || 'Empleado'}</span>
                <button type="button" className="nom-detail-close" onClick={() => setDetailEmp(null)} aria-label="Cerrar"><X size={18} /></button>
              </div>

              <div className="nom-detail-summary">
                {isDelivery && <div className="nom-detail-stat"><span>Comisión pendiente</span><strong>{formatUsd(deliveryPending)}</strong><small>{bsReference(deliveryPending)}</small></div>}
                <div className="nom-detail-stat"><span>Pagado acumulado</span><strong>{formatUsd(paidTotal)}</strong><small>{empPayments.length} pago{empPayments.length === 1 ? '' : 's'}</small></div>
                {advancesPending > 0 && <div className="nom-detail-stat"><span>Adelantos pendientes</span><strong className="nom-neg">-{formatUsd(advancesPending)}</strong><small>{pendingAdvances.length} sin descontar</small></div>}
              </div>

              {isDelivery && (
                <div className="nom-detail-section">
                  <h4>Comisiones de delivery <span>{pendingDeliveries.length} pendiente{pendingDeliveries.length === 1 ? '' : 's'}</span></h4>
                  {empDeliveries.length === 0 ? <p className="nom-detail-empty">Sin entregas registradas.</p> : (
                    <div className="nom-mini-table-wrap"><table className="nom-mini-table"><thead><tr><th>Fecha</th><th>Domicilio</th><th>%</th><th>Comisión</th><th>Estado</th></tr></thead><tbody>
                      {empDeliveries.slice(0, 30).map((d) => <tr key={d.id}><td>{fmtDate(d.assignedAt)}</td><td>{formatUsd(d.deliveryFee)}</td><td>{Math.round(d.employeePercent)}%</td><td><strong>{formatUsd(d.employeeAmount)}</strong></td><td><span className={`nom-chip ${d.status === 'paid' ? 'nom-chip--paid' : 'nom-chip--pending'}`}>{d.status === 'paid' ? 'Pagada' : 'Pendiente'}</span></td></tr>)}
                    </tbody><tfoot><tr><td colSpan={3}>Pendiente por liquidar</td><td colSpan={2}><strong>{formatUsd(deliveryPending)}</strong></td></tr></tfoot></table></div>
                  )}
                  <p className="nom-detail-hint">Cada entrega paga {pendingDeliveries[0] ? `${Math.round(pendingDeliveries[0].employeePercent)}%` : 'un %'} del domicilio cobrado. La suma de las pendientes es la comisión acumulada.</p>
                  {deliveryPending > 0 && <button type="button" className="nom-btn nom-detail-pay" disabled={payingDelivery} onClick={() => handlePayDelivery(emp)}><Banknote size={16} /> {payingDelivery ? 'Pagando…' : `Pagar comisión pendiente (${formatUsd(deliveryPending)})`}</button>}
                </div>
              )}

              <div className="nom-detail-section">
                <h4>Pagos directos <span>{empPayments.length}</span></h4>
                {empPayments.length === 0 ? <p className="nom-detail-empty">Todavía no se le han registrado pagos directos.</p> : (
                  <div className="nom-mini-table-wrap"><table className="nom-mini-table"><thead><tr><th>Fecha</th><th>Monto</th><th>Cuenta</th><th>Referencia</th></tr></thead><tbody>
                    {empPayments.slice(0, 30).map((p) => <tr key={p.id}><td>{fmtDate(p.paymentDate)}</td><td><strong>{p.currency === 'Bs' ? formatVes(p.amount) : formatUsd(p.amount)}</strong></td><td>{p.paymentAccount || '—'}</td><td>{p.reference || '—'}</td></tr>)}
                  </tbody></table></div>
                )}
              </div>

              {pendingAdvances.length > 0 && (
                <div className="nom-detail-section">
                  <h4>Adelantos sin descontar <span>{pendingAdvances.length}</span></h4>
                  <div className="nom-mini-table-wrap"><table className="nom-mini-table"><thead><tr><th>Fecha</th><th>Monto</th><th>Nota</th></tr></thead><tbody>
                    {pendingAdvances.map((a) => <tr key={a.id}><td>{fmtDate(a.advanceDate)}</td><td><strong className="nom-neg">-{formatUsd(a.amount)}</strong></td><td>{a.notes || '—'}</td></tr>)}
                  </tbody></table></div>
                  <p className="nom-detail-hint">Se descontarán del neto cuando se liquide un período.</p>
                </div>
              )}

              <div className="nom-modal-actions"><button type="button" className="nom-cancel" onClick={() => setDetailEmp(null)}>Cerrar</button></div>
            </div>
          </div>
        )
      })(), document.body)}
      {showSettlement && selected && createPortal(
        <div className="nom-modal-overlay" onClick={() => setShowSettlement(false)}>
          <form className="nom-modal nom-modal--payment" onClick={(e) => e.stopPropagation()} onSubmit={submitSettlement}>
            <div className="nom-modal-header">
              <div className="nom-modal-header-icon"><Banknote size={18} /></div>
              <h3>Liquidar período de nómina</h3>
            </div>
            <p className="nom-history-note">El período se marcará como pagado y se registrará un movimiento de salida en la cuenta seleccionada.</p>
            <div className="nom-field"><label>Cuenta de salida *</label><StyledSelect value={settlementAccount} onChange={(e) => setSettlementAccount(e.target.value)} required><option value="">Seleccionar cuenta...</option>{accounts.filter((account) => account.isActive && (account.currency === 'USD' || account.currency === 'VES')).map((account) => <option key={account.id} value={account.id}>{account.name} · {account.currency === 'VES' ? 'Bs' : 'USD'} · saldo {account.currency === 'VES' ? formatVes(account.currentBalance) : formatUsd(account.currentBalance)}</option>)}</StyledSelect></div>
            {(() => {
              const acc = accounts.find((a) => a.id === settlementAccount)
              if (!acc) return null
              const totalNative = acc.currency === 'VES' ? tot.neto * (bcvRate || 0) : tot.neto
              const insufficient = totalNative > (acc.currentBalance ?? 0)
              return <div className="nom-settlement-balance"><span>Disponible en {acc.name}: <strong>{acc.currency === 'VES' ? formatVes(acc.currentBalance) : formatUsd(acc.currentBalance)}</strong></span>{insufficient && <span className="nom-settlement-warn">El total a pagar ({acc.currency === 'VES' ? formatVes(totalNative) : formatUsd(totalNative)}) supera el disponible.</span>}</div>
            })()}
            <div className="nom-settlement-total"><strong>Total a liquidar: {formatUsd(tot.neto)}</strong><span>{bsReference(tot.neto)} · la moneda se toma de la cuenta</span></div>
            <div className="nom-row2">
              <div className="nom-field"><label>Referencia</label><input value={settlementReference} onChange={(e) => setSettlementReference(e.target.value)} placeholder="Ej. transferencia nómina" /></div>
              <div className="nom-field"><label>Notas</label><input value={settlementNotes} onChange={(e) => setSettlementNotes(e.target.value)} placeholder="Opcional" /></div>
            </div>
            <div className="nom-modal-actions"><button type="button" className="nom-cancel" onClick={() => setShowSettlement(false)}>Cancelar</button><button type="submit" className="nom-btn" disabled={saving}>Confirmar y pagar</button></div>
          </form>
        </div>,
        document.body
      )}
    </div>
  )
}

// build: nomina redesign v2 (2026-08-17)
