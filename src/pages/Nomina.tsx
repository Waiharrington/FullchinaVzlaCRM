import { useEffect, useMemo, useState, useCallback } from 'react'
import { createPortal } from 'react-dom'
import {
  getAllEmployees, getPayrollPeriods, createPayrollPeriod, getPayrollEntries, upsertPayrollEntry,
  getAdvances, createAdvance, setAdvanceDeducted, getProductionBonusRecords, createProductionBonus,
  getPayrollPayments, createPayrollPayment,
  type Employee, type PayrollPeriod, type PayrollEntry, type Advance, type ProductionBonusRecord, type PayrollPayment,
} from '../lib/dataService'
import { formatUsd, dateKeyInTimeZone } from '../lib/money'
import { PageSkeleton } from '../components/PageSkeleton'
import { StyledSelect } from '../components/StyledSelect'
import NumberStepper from '../components/NumberStepper'
import {
  Plus, Loader2, Users, Banknote, Gift, Hourglass,
  HelpCircle, Save,
} from 'lucide-react'
import Toast from '../components/Toast'
import './Nomina.css'

const initials = (name: string) => name.split(' ').filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase()

export function Nomina() {
  const [employees, setEmployees] = useState<Employee[]>([])
  const [periods, setPeriods] = useState<PayrollPeriod[]>([])
  const [entriesByPeriod, setEntriesByPeriod] = useState<Record<string, PayrollEntry[]>>({})
  const [advances, setAdvances] = useState<Advance[]>([])
  const [bonuses, setBonuses] = useState<ProductionBonusRecord[]>([])
  const [payments, setPayments] = useState<PayrollPayment[]>([])
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
      const [emp, per, adv, bon, pays] = await Promise.all([getAllEmployees(), getPayrollPeriods(), getAdvances(), getProductionBonusRecords(), getPayrollPayments()])
      setEmployees(emp); setPeriods(per); setAdvances(adv); setBonuses(bon); setPayments(pays)
      const byPeriod: Record<string, PayrollEntry[]> = {}
      await Promise.all(per.map(async (p) => { byPeriod[p.id] = await getPayrollEntries(p.id).catch(() => []) }))
      setEntriesByPeriod(byPeriod)
      setSelectedId((cur) => cur ?? (per[0]?.id ?? null))
    } catch (e) { setError(e instanceof Error ? e.message : 'Error cargando nómina') }
    finally { setLoading(false) }
  }, [])
  useEffect(() => { void load() }, [load])

  const flash = (m: string) => { setNotice(m); setTimeout(() => setNotice(''), 3000) }

  const activeEmployees = useMemo(() => employees.filter((e) => e.isActive), [employees])
  const paidByEmployee = useMemo(() => payments.reduce((m, p) => m.set(p.employeeId, (m.get(p.employeeId) ?? 0) + p.amount), new Map<string, number>()), [payments])
  const selected = periods.find((p) => p.id === selectedId) ?? null

  // Bonos de un empleado dentro del período seleccionado
  const bonusForEmp = useCallback((empId: string) => {
    if (!selected) return 0
    return bonuses.filter((b) => b.employeeId === empId && b.bonusDate >= selected.startDate && b.bonusDate <= selected.endDate).reduce((s, b) => s + b.amount, 0)
  }, [bonuses, selected])

  // Inicializar edición al cambiar de período
  useEffect(() => {
    if (!selected) return
    const selectedEntries = selectedId ? entriesByPeriod[selectedId] ?? [] : []
    const init: Record<string, { bonus: string; overtimeHours: string; transport: string; absenceDays: string; extraDeductions: string }> = {}
    for (const emp of activeEmployees) {
      const ex = selectedEntries.find((e) => e.employeeId === emp.id)
      init[emp.id] = { bonus: ex ? String(ex.bonusAmount) : String(bonusForEmp(emp.id)), overtimeHours: ex ? String(ex.overtimeHours) : '0', transport: ex ? String(ex.transportAmount) : '0', absenceDays: ex ? String(ex.absenceDays) : '0', extraDeductions: '0' }
    }
    setEdit(init)
  }, [selectedId, entriesByPeriod, activeEmployees, selected])

  const periodNet = useCallback((p: PayrollPeriod) => {
    const ents = entriesByPeriod[p.id] ?? []
    const base = ents.reduce((s, e) => s + e.netPay, 0)
    const bon = bonuses.filter((b) => b.bonusDate >= p.startDate && b.bonusDate <= p.endDate).reduce((s, b) => s + b.amount, 0)
    return base + bon
  }, [entriesByPeriod, bonuses])

  // Totales de la tabla del período seleccionado (desde la edición en vivo)
  const rows = activeEmployees.map((emp) => {
    const ed = edit[emp.id] ?? { bonus: '0', overtimeHours: '0', transport: '0', absenceDays: '0', extraDeductions: '0' }
    const weekly = emp.weeklySalary || emp.hourlyRate * 48
    const bonus = parseFloat(ed.bonus) || 0
    const overtimeHours = parseFloat(ed.overtimeHours) || 0
    const overtime = overtimeHours * (emp.overtimeRate || emp.hourlyRate)
    const transport = parseFloat(ed.transport) || 0
    const absenceDays = parseFloat(ed.absenceDays) || 0
    const absenceDeduction = weekly / 6 * absenceDays
    const advance = advances.filter((a) => a.employeeId === emp.id && !a.isDeducted && (!selected || a.advanceDate <= selected.endDate)).reduce((s, a) => s + a.amount, 0)
    const extra = parseFloat(ed.extraDeductions) || 0
    const bruto = weekly + bonus + overtime + transport
    const ded = absenceDeduction + advance + extra
    return { emp, weekly, bonus, overtimeHours, overtime, transport, absenceDays, absenceDeduction, advance, extra, bruto, ded, neto: bruto - ded }
  })
  const tot = rows.reduce((a, r) => ({ hours: a.hours + r.overtimeHours, bruto: a.bruto + r.bruto, ded: a.ded + r.ded, bon: a.bon + r.bonus, neto: a.neto + r.neto }), { hours: 0, bruto: 0, ded: 0, bon: 0, neto: 0 })

  const handleSaveAll = async () => {
    if (!selected) return
    setSaving(true); setError('')
    try {
      for (const r of rows) {
        await upsertPayrollEntry({ payrollPeriodId: selected.id, employeeId: r.emp.id, hoursWorked: r.overtimeHours, baseSalary: r.bruto, deductions: r.ded, weeklySalary: r.weekly, bonusAmount: r.bonus, overtimeHours: r.overtimeHours, overtimeAmount: r.overtime, transportAmount: r.transport, absenceDays: r.absenceDays, absenceDeduction: r.absenceDeduction, advanceDeduction: r.advance })
      }
      const updated = await getPayrollEntries(selected.id)
      setEntriesByPeriod((prev) => ({ ...prev, [selected.id]: updated }))
      flash('Liquidación guardada')
    } catch (e) { setError(e instanceof Error ? e.message : 'Error guardando liquidación') }
    finally { setSaving(false) }
  }

  const submitPeriod = async (e: React.FormEvent) => {
    e.preventDefault(); if (!pStart || !pEnd) return
    try { await createPayrollPeriod({ startDate: pStart, endDate: pEnd, notes: pNotes.trim() || undefined }); closePeriod(() => { setPStart(''); setPEnd(''); setPNotes('') }); await load(); flash('Período creado') }
    catch (e) { setError(e instanceof Error ? e.message : 'Error creando período') }
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

  if (loading) return <PageSkeleton cards={3} rows={5} />

  const pendingAdvances = advances.filter((a) => !a.isDeducted).reduce((s, a) => s + a.amount, 0)
  const pendingCount = advances.filter((a) => !a.isDeducted).length
  const periodBonuses = selected ? bonuses.filter((b) => b.bonusDate >= selected.startDate && b.bonusDate <= selected.endDate).reduce((s, b) => s + b.amount, 0) : 0
  const statusCls = (s: string) => s === 'open' ? 'open' : s === 'paid' ? 'paid' : 'closed'
  const statusLbl = (s: string) => s === 'open' ? 'Abierto' : s === 'paid' ? 'Pagado' : 'Cerrado'
  const fmtRange = (p: PayrollPeriod) => `${new Date(p.startDate).toLocaleDateString('es-VE')} - ${new Date(p.endDate).toLocaleDateString('es-VE')}`

  return (
    <div className="page nom-page animate-fade-in">
      <header className="page-header">
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
      <div className="nom-summary">
        <div className="nom-sum">
          <div className="nom-sum-top"><span className="nom-sum-ic" style={{ background: 'rgba(124,58,237,0.15)', color: '#a78bfa' }}><Users size={20} /></span>
            <div><div className="nom-sum-lbl">Empleados activos</div><div className="nom-sum-val">{activeEmployees.length}</div><div className="nom-sum-sub">de {employees.length} registrados</div></div></div>
        </div>
        <div className="nom-sum">
          <div className="nom-sum-top"><span className="nom-sum-ic" style={{ background: 'rgba(34,197,94,0.15)', color: '#22c55e' }}><Banknote size={20} /></span>
            <div><div className="nom-sum-lbl">Liquidación del período</div><div className="nom-sum-val">{formatUsd(tot.neto)}</div><div className="nom-sum-sub">{selected ? `Período actual` : 'Sin período'}</div></div></div>
        </div>
        <div className="nom-sum">
          <div className="nom-sum-top"><span className="nom-sum-ic" style={{ background: 'rgba(234,179,8,0.15)', color: '#eab308' }}><Gift size={20} /></span>
            <div><div className="nom-sum-lbl">Bonos totales</div><div className="nom-sum-val">{formatUsd(periodBonuses)}</div><div className="nom-sum-sub">Período actual</div></div></div>
        </div>
        <div className="nom-sum">
          <div className="nom-sum-top"><span className="nom-sum-ic" style={{ background: 'rgba(239,68,68,0.15)', color: '#ef4444' }}><Hourglass size={20} /></span>
            <div><div className="nom-sum-lbl">Adelantos pendientes</div><div className="nom-sum-val">{formatUsd(pendingAdvances)}</div><div className="nom-sum-sub">{pendingCount} adelanto{pendingCount === 1 ? '' : 's'} pendiente{pendingCount === 1 ? '' : 's'}</div></div></div>
        </div>
      </div>

      <div className="nom-card">
        <div className="nom-card-head"><div><h2>Personal y pagos directos</h2><p>Registra pagos sin crear un período. Los períodos quedan disponibles para reportes.</p></div><button className="nom-btn" onClick={() => setShowPayment(true)}><Plus size={16} /> Registrar pago</button></div>
        <div className="nom-periods">
          {activeEmployees.map((emp) => <div className="nom-period" key={emp.id}><div className="nom-period-top"><strong>{emp.fullName}</strong><span className="nom-status open">{emp.position || 'Empleado'}</span></div><div className="liq">Pagado acumulado: {formatUsd(paidByEmployee.get(emp.id) ?? 0)}</div><small>{payments.filter((p) => p.employeeId === emp.id).length} pagos registrados · {emp.hourlyRate ? `Tarifa ${formatUsd(emp.hourlyRate)}/h` : 'Pago directo o comisión'}</small></div>)}
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
                <div className="nom-period-top"><strong>{fmtRange(p)}</strong><span className={`nom-status ${statusCls(p.status)}`}>{statusLbl(p.status)}</span></div>
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
            <button className="nom-btn" onClick={handleSaveAll} disabled={saving}>{saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} Guardar liquidación</button>
          </div>
          {activeEmployees.length === 0 ? <p style={{ color: '#71717a' }}>No hay empleados activos. Agrégalos en Equipo / Usuarios.</p> : (
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
                          <small className="nom-cell-sub">base</small>
                        </div>
                      </td>
                      <td className="nom-col-center">
                        <div className="nom-cell-wrap nom-cell-amount">
                          <strong style={{ color: r.advance > 0 ? '#ef4444' : '#a1a1aa' }}>
                            {r.advance > 0 ? `-${formatUsd(r.advance)}` : '$0,00'}
                          </strong>
                          <small className="nom-cell-sub">{r.advance > 0 ? 'pendiente' : 'sin adelanto'}</small>
                        </div>
                      </td>
                      <td className="nom-col-center">
                        <div className="nom-stepper-cell">
                          <NumberStepper
                            step={1}
                            min={0}
                            value={edit[r.emp.id]?.bonus ?? '0'}
                            onChange={(v) => setEdit((p) => ({ ...p, [r.emp.id]: { ...p[r.emp.id], bonus: v } }))}
                          />
                          <small className="nom-stepper-hint" style={{ color: '#22c55e' }}>+{formatUsd(r.bonus)}</small>
                        </div>
                      </td>
                      <td className="nom-col-center">
                        <div className="nom-stepper-cell">
                          <NumberStepper
                            step={0.5}
                            min={0}
                            value={edit[r.emp.id]?.overtimeHours ?? '0'}
                            onChange={(v) => setEdit((p) => ({ ...p, [r.emp.id]: { ...p[r.emp.id], overtimeHours: v } }))}
                          />
                          <small className="nom-stepper-hint" style={{ color: '#22c55e' }}>+{formatUsd(r.overtime)}</small>
                        </div>
                      </td>
                      <td className="nom-col-center">
                        <div className="nom-stepper-cell">
                          <NumberStepper
                            step={1}
                            min={0}
                            value={edit[r.emp.id]?.transport ?? '0'}
                            onChange={(v) => setEdit((p) => ({ ...p, [r.emp.id]: { ...p[r.emp.id], transport: v } }))}
                          />
                          <small className="nom-stepper-hint" style={{ color: '#22c55e' }}>+{formatUsd(r.transport)}</small>
                        </div>
                      </td>
                      <td className="nom-col-center">
                        <div className="nom-stepper-cell">
                          <NumberStepper
                            step={1}
                            min={0}
                            value={edit[r.emp.id]?.absenceDays ?? '0'}
                            onChange={(v) => setEdit((p) => ({ ...p, [r.emp.id]: { ...p[r.emp.id], absenceDays: v } }))}
                          />
                          <small className="nom-stepper-hint" style={{ color: '#ef4444' }}>-{formatUsd(r.absenceDeduction)}</small>
                        </div>
                      </td>
                      <td className="nom-col-right">
                        <div className="nom-cell-wrap nom-cell-right">
                          <strong className="nom-net">{formatUsd(r.neto)}</strong>
                          <small className="nom-cell-sub" style={{ color: '#22c55e' }}>a liquidar</small>
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
                        <small className="nom-cell-sub">total base</small>
                      </div>
                    </td>
                    <td className="nom-col-center">
                      <div className="nom-cell-wrap nom-cell-amount">
                        <strong style={{ color: '#ef4444' }}>-{formatUsd(rows.reduce((s, r) => s + r.advance, 0))}</strong>
                        <small className="nom-cell-sub">adelantos</small>
                      </div>
                    </td>
                    <td className="nom-col-center">
                      <div className="nom-cell-wrap nom-cell-amount">
                        <strong style={{ color: '#22c55e' }}>+{formatUsd(tot.bon)}</strong>
                        <small className="nom-cell-sub">bonos</small>
                      </div>
                    </td>
                    <td className="nom-col-center">
                      <div className="nom-cell-wrap nom-cell-amount">
                        <strong style={{ color: '#22c55e' }}>+{formatUsd(rows.reduce((s, r) => s + r.overtime, 0))}</strong>
                        <small className="nom-cell-sub">{tot.hours}h extra</small>
                      </div>
                    </td>
                    <td className="nom-col-center">
                      <div className="nom-cell-wrap nom-cell-amount">
                        <strong style={{ color: '#22c55e' }}>+{formatUsd(rows.reduce((s, r) => s + r.transport, 0))}</strong>
                        <small className="nom-cell-sub">transporte</small>
                      </div>
                    </td>
                    <td className="nom-col-center">
                      <div className="nom-cell-wrap nom-cell-amount">
                        <strong style={{ color: '#ef4444' }}>-{formatUsd(rows.reduce((s, r) => s + r.absenceDeduction, 0))}</strong>
                        <small className="nom-cell-sub">ausencias</small>
                      </div>
                    </td>
                    <td className="nom-col-right">
                      <div className="nom-cell-wrap nom-cell-right">
                        <strong className="nom-net" style={{ fontSize: 16 }}>{formatUsd(tot.neto)}</strong>
                        <small className="nom-cell-sub" style={{ color: '#22c55e' }}>gran total</small>
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
              {advances.slice(0, 5).map((a) => (
                <tr key={a.id}>
                  <td style={{ color: '#a1a1aa' }}>{new Date(a.advanceDate).toLocaleDateString('es-VE')}</td>
                  <td>{a.employeeName}</td><td><strong>{formatUsd(a.amount)}</strong></td>
                  <td><span className={`nom-pill ${a.isDeducted ? 'done' : 'pend'}`} onClick={() => setAdvanceDeducted(a.id, !a.isDeducted).then(load)}>{a.isDeducted ? 'Deducido' : 'Pendiente'}</span></td>
                </tr>
              ))}
              {advances.length === 0 && <tr><td colSpan={4} style={{ textAlign: 'center', color: '#71717a', padding: 16 }}>Sin adelantos.</td></tr>}
            </tbody>
          </table>
        </div>

        <div className="nom-card">
          <div className="nom-card-head"><div><h2>Bonos de Producción</h2></div><button className="nom-btn" style={{ padding: '7px 12px', fontSize: 13 }} onClick={() => setShowBonus(true)}><Plus size={14} /> Nuevo</button></div>
          <table className="nom-mini-table">
            <thead><tr><th>Fecha</th><th>Empleado</th><th>Monto</th><th>Motivo</th></tr></thead>
            <tbody>
              {bonuses.slice(0, 5).map((b) => (
                <tr key={b.id}><td style={{ color: '#a1a1aa' }}>{new Date(b.bonusDate).toLocaleDateString('es-VE')}</td><td>{b.employeeName}</td><td style={{ color: '#22c55e' }}><strong>{formatUsd(b.amount)}</strong></td><td style={{ color: '#a1a1aa' }}>{b.reason || '—'}</td></tr>
              ))}
              {bonuses.length === 0 && <tr><td colSpan={4} style={{ textAlign: 'center', color: '#71717a', padding: 16 }}>Sin bonos.</td></tr>}
            </tbody>
          </table>
        </div>

        <div className="nom-card">
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
        </div>
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
              <div className="nom-field"><label>Inicio *</label><input type="date" value={pStart} onChange={(e) => setPStart(e.target.value)} required /></div>
              <div className="nom-field"><label>Fin *</label><input type="date" value={pEnd} onChange={(e) => setPEnd(e.target.value)} required /></div>
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
              <div className="nom-field"><label>Fecha</label><input type="date" value={advDate} onChange={(e) => setAdvDate(e.target.value)} /></div>
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
              <div className="nom-field"><label>Fecha</label><input type="date" value={bonDate} onChange={(e) => setBonDate(e.target.value)} /></div>
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
    </div>
  )
}

// build: nomina redesign v2 (2026-08-17)
