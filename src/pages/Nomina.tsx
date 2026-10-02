import { useEffect, useMemo, useState, useCallback } from 'react'
import { createPortal } from 'react-dom'
import {
  getAllEmployees, getPayrollPeriods, getPayrollEntries,
  getAdvances, createAdvance, getProductionBonusRecords,
  getPayrollPayments, createPayrollPayment, getPayrollAdjustments, createPayrollAdjustment, getFinancialAccounts, getDeliveryAssignments,
  type Employee, type PayrollPeriod, type PayrollEntry, type Advance, type ProductionBonusRecord, type PayrollPayment, type PayrollAdjustment, type FinancialAccount, type DeliveryAssignment,
} from '../lib/dataService'
import { formatUsd, formatVes, dateKeyInTimeZone } from '../lib/money'
import { useRates } from '../context/rates-context'
import { PageSkeleton } from '../components/PageSkeleton'
import { DateField } from '../components/DateField'
import { StyledSelect } from '../components/StyledSelect'
import NumberStepper from '../components/NumberStepper'
import {
  Loader2, Users, Banknote, Gift, Hourglass,
  HelpCircle, X, Bike,
} from 'lucide-react'
import Toast from '../components/Toast'
import './Nomina.css'

const initials = (name: string) => name.split(' ').filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase()

export function Nomina() {
  const { bcvRate } = useRates()
  const [employees, setEmployees] = useState<Employee[]>([])
  const [periods, setPeriods] = useState<PayrollPeriod[]>([])
  const [entriesByPeriod, setEntriesByPeriod] = useState<Record<string, PayrollEntry[]>>({})
  const [advances, setAdvances] = useState<Advance[]>([])
  const [bonuses, setBonuses] = useState<ProductionBonusRecord[]>([])
  const [payments, setPayments] = useState<PayrollPayment[]>([])
  const [adjustments, setAdjustments] = useState<PayrollAdjustment[]>([])
  const [accounts, setAccounts] = useState<FinancialAccount[]>([])
  const [deliveryAssignments, setDeliveryAssignments] = useState<DeliveryAssignment[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [saving, setSaving] = useState(false)

  // Modales
  const [showAdvance, setShowAdvance] = useState(false)
  const [closingAdvance, setClosingAdvance] = useState(false)
  const [advEmp, setAdvEmp] = useState(''); const [advAmt, setAdvAmt] = useState(''); const [advAccount, setAdvAccount] = useState(''); const [advRate, setAdvRate] = useState(''); const [advDate, setAdvDate] = useState(dateKeyInTimeZone()); const [advNotes, setAdvNotes] = useState('')
  const [showPayment, setShowPayment] = useState(false)
  const [closingPayment, setClosingPayment] = useState(false)
  const [payEmp, setPayEmp] = useState(''); const [payAmt, setPayAmt] = useState(''); const [payAccount, setPayAccount] = useState(''); const [payRef, setPayRef] = useState(''); const [payNotes, setPayNotes] = useState('')
  const [payRate, setPayRate] = useState('')
  const [detailEmp, setDetailEmp] = useState<Employee | null>(null)
  const [detailMonth, setDetailMonth] = useState(dateKeyInTimeZone().slice(0, 7))
  const [adjustmentModal, setAdjustmentModal] = useState<{ employee: Employee; type: 'salary' | 'bonus' | 'discount'; amount: string; description: string; date: string } | null>(null)

  const closeAdvance = (then?: () => void) => {
    if (closingAdvance) return
    setClosingAdvance(true)
    window.setTimeout(() => { setShowAdvance(false); setClosingAdvance(false); then?.() }, 200)
  }
  const closePayment = (then?: () => void) => {
    if (closingPayment) return
    setClosingPayment(true)
    window.setTimeout(() => { setShowPayment(false); setClosingPayment(false); then?.() }, 200)
  }

  const load = useCallback(async () => {
    try {
      setLoading(true); setError('')
      const [emp, per, adv, bon, pays, adj, financialAccounts, deliveries] = await Promise.all([getAllEmployees(), getPayrollPeriods(), getAdvances(), getProductionBonusRecords(), getPayrollPayments(true), getPayrollAdjustments(), typeof getFinancialAccounts === 'function' ? getFinancialAccounts() : Promise.resolve([]), typeof getDeliveryAssignments === 'function' ? getDeliveryAssignments() : Promise.resolve([])])
      setEmployees(emp); setPeriods(per); setAdvances(adv); setBonuses(bon); setPayments(pays); setAdjustments(adj); setAccounts(financialAccounts); setDeliveryAssignments(deliveries)
      const byPeriod: Record<string, PayrollEntry[]> = {}
      await Promise.all(per.map(async (p) => { byPeriod[p.id] = await getPayrollEntries(p.id) }))
      setEntriesByPeriod(byPeriod)
    } catch (e) { setError(e instanceof Error ? e.message : 'Error cargando nómina') }
    finally { setLoading(false) }
  }, [])
  useEffect(() => { void load() }, [load])

  const flash = (m: string) => { setNotice(m); setTimeout(() => setNotice(''), 3000) }

  const activeEmployees = useMemo(() => employees.filter((e) => e.isActive), [employees])
  const paidByEmployee = useMemo(() => payments.reduce((m, p) => m.set(p.employeeId, (m.get(p.employeeId) ?? 0) + (p.currency === 'Bs' && p.exchangeRate ? p.amount / p.exchangeRate : p.amount)), new Map<string, number>()), [payments])
  const payrollBalanceByEmployee = useMemo(() => {
    const earned = new Map<string, number>()
    Object.values(entriesByPeriod).flat().forEach((entry) => earned.set(entry.employeeId, (earned.get(entry.employeeId) ?? 0) + entry.netPay))
    adjustments.forEach((item) => earned.set(item.employeeId, (earned.get(item.employeeId) ?? 0) + (item.direction === 'add' ? item.amount : -item.amount)))
    deliveryAssignments.filter((item) => item.status !== 'cancelled').forEach((item) => earned.set(item.employeeId, (earned.get(item.employeeId) ?? 0) + item.employeeAmount))
    advances.filter((item) => !item.isDeducted).forEach((item) => earned.set(item.employeeId, (earned.get(item.employeeId) ?? 0) - item.amount))
    payments.forEach((item) => earned.set(item.employeeId, (earned.get(item.employeeId) ?? 0) - (item.currency === 'Bs' && item.exchangeRate ? item.amount / item.exchangeRate : item.amount)))
    return earned
  }, [entriesByPeriod, adjustments, deliveryAssignments, advances, payments])
  const bsReference = (usd: number) => bcvRate && bcvRate > 0 ? formatVes(usd * bcvRate) : 'Bs. —'
  const activeAccounts = accounts.filter((account) => account.isActive && (account.currency === 'USD' || account.currency === 'VES'))

  const latestMovementMonth = (employeeId: string) => {
    const dates = [
      ...Object.values(entriesByPeriod).flat().filter((entry) => entry.employeeId === employeeId).map((entry) => periods.find((period) => period.id === entry.payrollPeriodId)?.endDate ?? ''),
      ...adjustments.filter((item) => item.employeeId === employeeId).map((item) => item.adjustmentDate),
      ...payments.filter((item) => item.employeeId === employeeId).map((item) => item.paymentDate),
      ...advances.filter((item) => item.employeeId === employeeId).map((item) => item.advanceDate),
      ...deliveryAssignments.filter((item) => item.employeeId === employeeId && item.status !== 'cancelled').map((item) => item.assignedAt.slice(0, 10)),
      ...bonuses.filter((item) => item.employeeId === employeeId).map((item) => item.bonusDate),
    ].filter(Boolean).sort((a, b) => b.localeCompare(a))
    return dates[0]?.slice(0, 7) ?? dateKeyInTimeZone().slice(0, 7)
  }
  const selectedAdvanceAccount = activeAccounts.find((account) => account.id === advAccount)

  const submitAdvance = async (e: React.FormEvent) => {
    e.preventDefault(); if (!advEmp || !advAmt) return
    const account = accounts.find((item) => item.id === advAccount)
    if (!account) { setError('Selecciona la cuenta desde la que saldrá el adelanto'); return }
    const rate = account.currency === 'VES' ? (parseFloat(advRate) || bcvRate || 0) : 1
    if (account.currency === 'VES' && rate <= 0) { setError('Indica la tasa BCV para registrar el adelanto en bolívares'); return }
    try { await createAdvance({ employeeId: advEmp, amount: parseFloat(advAmt) || 0, accountId: account.id, exchangeRate: rate, advanceDate: advDate, notes: advNotes.trim() || undefined }); closeAdvance(() => { setAdvEmp(''); setAdvAmt(''); setAdvAccount(''); setAdvRate(''); setAdvNotes('') }); await load(); flash('Adelanto registrado y descontado de Finanzas') }
    catch (e) { setError(e instanceof Error ? e.message : 'Error registrando adelanto') }
  }
  const submitPayment = async (e: React.FormEvent) => {
    e.preventDefault(); if (!payEmp || !payAmt) return
    const account = accounts.find((item) => item.id === payAccount)
    if (!account) { setError('Selecciona la cuenta desde la que saldrá el pago'); return }
    const rate = account.currency === 'VES' ? (parseFloat(payRate) || bcvRate || 0) : 1
    const amount = parseFloat(payAmt) || 0
    if (account.currency === 'VES' && rate <= 0) { setError('Indica la tasa BCV para registrar el pago en bolívares'); return }
    if (amount > account.currentBalance + 0.01) { setError(`La cuenta seleccionada solo tiene ${account.currency === 'VES' ? formatVes(account.currentBalance) : formatUsd(account.currentBalance)} disponible`); return }
    const usdAmount = account.currency === 'VES' ? amount / rate : amount
    const balance = payrollBalanceByEmployee.get(payEmp) ?? 0
    if (usdAmount <= 0 || usdAmount > balance + 0.01) { setError(`El pago no puede superar el saldo pendiente de ${formatUsd(Math.max(0, balance))}`); return }
    try { await createPayrollPayment({ employeeId: payEmp, amount, currency: account.currency === 'VES' ? 'Bs' : 'USD', exchangeRate: rate, paymentAccount: account.name, accountId: account.id, reference: payRef.trim() || null, notes: payNotes.trim() || null }); closePayment(() => { setPayEmp(''); setPayAmt(''); setPayAccount(''); setPayRate(''); setPayRef(''); setPayNotes('') }); await load(); flash('Abono registrado') }
    catch (e) { setError(e instanceof Error ? e.message : 'Error registrando pago') }
  }

  const submitAdjustment = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!adjustmentModal) return
    const amount = Number(adjustmentModal.amount.replace(',', '.'))
    if (!Number.isFinite(amount) || amount <= 0) { setError('El monto debe ser mayor que cero'); return }
    setSaving(true); setError('')
    try {
      await createPayrollAdjustment({ employeeId: adjustmentModal.employee.id, type: adjustmentModal.type, amount, date: adjustmentModal.date, description: adjustmentModal.description })
      setAdjustmentModal(null); await load()
      flash(adjustmentModal.type === 'salary' ? 'Salario añadido al saldo' : adjustmentModal.type === 'bonus' ? 'Bono añadido al saldo' : 'Descuento registrado')
    } catch (e) { setError(e instanceof Error ? e.message : 'No se pudo guardar el movimiento') }
    finally { setSaving(false) }
  }

  if (loading) return <PageSkeleton cards={3} rows={5} />

  return (
    <div className="page nom-page animate-fade-in management-workspace management-workspace--payroll">
      <header className="page-header management-workspace-header">
        <div>
          <h1 className="page-title"><Banknote size={22} className="page-title-icon" /> Nómina y Personal</h1>
          <p className="page-subtitle">Saldos acumulados por empleado, pagos parciales y movimientos organizados por mes.</p>
        </div>
        <div className="nom-head-actions">
          <button className="nom-ghost" onClick={() => flash('Añade salario, bono, descuento o adelanto desde la tarjeta. Registra pagos completos o parciales; el saldo pendiente se acumula y el detalle se consulta por mes.')}><HelpCircle size={15} /> ¿Cómo funciona?</button>
        </div>
      </header>

      {error && <Toast type="error" message={error} onClose={() => setError('')} />}
      {notice && <Toast type="success" message={notice} onClose={() => setNotice('')} />}

      <div className="nom-card">
        <div className="nom-card-head"><div><h2>Cuenta corriente del personal</h2><p>Saldo acumulado por empleado. Añade conceptos y registra pagos parciales; el detalle se organiza por mes y abre en el movimiento más reciente.</p></div></div>
        <div className="nom-employee-grid">
          {activeEmployees.map((emp) => {
            const isDelivery = emp.position?.toLowerCase() === 'delivery' || employees.find((item) => item.id === emp.id)?.position?.toLowerCase() === 'delivery'
            const balance = payrollBalanceByEmployee.get(emp.id) ?? 0
            const employeePayments = payments.filter((payment) => payment.employeeId === emp.id)
            const directPayments = employeePayments.length
            const paid = paidByEmployee.get(emp.id) ?? 0
            const pendingEmployeeAdvances = advances.filter((advance) => advance.employeeId === emp.id && !advance.isDeducted).reduce((sum, advance) => sum + advance.amount, 0)
            const earned = balance + paid + pendingEmployeeAdvances
            const deductions = paid + pendingEmployeeAdvances
            const paymentBreakdown = new Map<string, number>()
            employeePayments.forEach((payment) => {
              const accountName = payment.paymentAccount || 'Cuenta no indicada'
              const amountUsd = payment.currency === 'Bs' && payment.exchangeRate ? payment.amount / payment.exchangeRate : payment.amount
              paymentBreakdown.set(accountName, (paymentBreakdown.get(accountName) ?? 0) + amountUsd)
            })
            const adjustmentCount = adjustments.filter((item) => item.employeeId === emp.id).length
            const cardAdjust = (type: 'salary' | 'bonus' | 'discount') => setAdjustmentModal({ employee: emp, type, amount: type === 'salary' ? String(emp.weeklySalary || '') : '', description: '', date: dateKeyInTimeZone() })
            return <article className={`nom-employee-card${isDelivery ? ' nom-employee-card--delivery' : ''}`} key={emp.id}>
              <div className="nom-employee-card-head">
                <div className="nom-employee-identity">
                  <span className="nom-employee-avatar" aria-hidden="true">{emp.photoUrl ? <img src={emp.photoUrl} alt="" /> : initials(emp.fullName)}</span>
                  <div className="nom-employee-name-wrap"><strong title={emp.fullName}>{emp.fullName}</strong><span>{emp.position || (isDelivery ? 'Delivery' : 'Empleado')}</span></div>
                </div>
                <span className={`nom-employee-due${balance <= 0.005 ? ' nom-employee-due--paid' : ''}`}>{balance > 0.005 ? `◉ ${formatUsd(balance)} USD` : '✓ Al día'}</span>
              </div>

              <div className={`nom-employee-balance${balance < -0.005 ? ' nom-employee-balance--negative' : ''}`}>
                <div className="nom-employee-balance-head">
                  <div><span className="nom-employee-eyebrow">{balance < -0.005 ? 'Saldo por recuperar' : 'Por pagar (saldo neto)'}</span>
                    <strong>{bcvRate && bcvRate > 0 ? formatVes(Math.abs(balance) * bcvRate) : formatUsd(Math.abs(balance))}</strong></div>
                  <span className="nom-employee-usd">{balance < -0.005 ? '−' : '≈ '}{formatUsd(Math.abs(balance))} USD</span>
                </div>
                <div className="nom-employee-totals">
                  <div><span className="nom-employee-total-label"><span className="nom-trend nom-trend--up">↗</span> Generado neto</span><strong>{bcvRate && bcvRate > 0 ? formatVes(earned * bcvRate) : formatUsd(earned)}</strong></div>
                  <div><span className="nom-employee-total-label"><span className="nom-trend nom-trend--down">↘</span> Vales / pagos</span><strong className="nom-employee-deduction">−{bcvRate && bcvRate > 0 ? formatVes(deductions * bcvRate) : formatUsd(deductions)}</strong></div>
                </div>
              </div>

              <div className="nom-employee-meta">{directPayments} pagos registrados <span>·</span> {adjustmentCount} ajustes</div>

              {paymentBreakdown.size > 0 && <div className="nom-employee-payment-methods">
                <span className="nom-employee-eyebrow">Desglose de pago</span>
                <div>{[...paymentBreakdown.entries()].sort((a, b) => b[1] - a[1]).map(([accountName, amount]) => <span className="nom-employee-payment-chip" key={accountName}><span>{accountName}</span><strong>{formatUsd(amount)}</strong></span>)}</div>
              </div>}

              <div className="nom-employee-actions">
                <button type="button" className="nom-employee-action" onClick={() => cardAdjust('salary')}>+ Salario</button>
                <button type="button" className="nom-employee-action" onClick={() => cardAdjust('bonus')}>+ Bono</button>
                <button type="button" className="nom-employee-action nom-employee-action--discount" onClick={() => cardAdjust('discount')}>− Descuento</button>
                <button type="button" className="nom-employee-action" onClick={() => { setAdvEmp(emp.id); setAdvAmt(''); setAdvAccount(''); setAdvRate(''); setAdvDate(dateKeyInTimeZone()); setShowAdvance(true) }}>Adelanto</button>
                <button type="button" className="nom-employee-action nom-employee-action--detail" onClick={() => { setDetailMonth(latestMovementMonth(emp.id)); setDetailEmp(emp) }}>Detalle <span aria-hidden="true">→</span></button>
                <button type="button" className="nom-employee-pay" disabled={balance <= 0.005} onClick={() => { setPayEmp(emp.id); setPayAmt(''); setPayAccount(''); setPayRate(String(bcvRate || '')); setPayRef(''); setPayNotes(''); setShowPayment(true) }}>{balance > 0.005 ? `▣  Liquidar saldo (${formatUsd(balance)} USD)` : '✓  Al día · sin saldo pendiente'}</button>
              </div>
            </article>
          })}
        </div>
      </div>

      {/* Modales */}
      {showAdvance && createPortal(
        <div className={`nom-modal-overlay ${closingAdvance ? 'closing' : ''}`} onClick={() => closeAdvance()}>
          <form className="nom-modal nom-modal--advance" onClick={(e) => e.stopPropagation()} onSubmit={submitAdvance}>
            <div className="nom-modal-header">
              <div className="nom-modal-header-icon"><Banknote size={18} /></div>
              <h3>Nuevo adelanto</h3>
            </div>
            <div className="nom-field"><label>Empleado *</label><StyledSelect value={advEmp} onChange={(e) => setAdvEmp(e.target.value)} required><option value="">Seleccionar...</option>{activeEmployees.map((e) => <option key={e.id} value={e.id}>{e.fullName}</option>)}</StyledSelect></div>
            <div className="nom-field"><label>Cuenta de salida *</label><StyledSelect value={advAccount} onChange={(e) => { const account = activeAccounts.find((item) => item.id === e.target.value); setAdvAccount(e.target.value); setAdvRate(account?.currency === 'VES' ? String(bcvRate || '') : '') }} required><option value="">Seleccionar cuenta...</option>{activeAccounts.map((account) => <option key={account.id} value={account.id}>{account.name} · {account.currency === 'VES' ? 'Bs' : 'USD'}</option>)}</StyledSelect><small className="nom-field-help">El adelanto se descuenta inmediatamente de esta cuenta y queda pendiente de descontar en nómina.</small></div>
            <div className="nom-row2">
              <div className="nom-field"><label>Monto {selectedAdvanceAccount ? `(${selectedAdvanceAccount.currency === 'VES' ? 'Bs' : 'USD'})` : ''} *</label><NumberStepper step={0.01} min={0.01} value={advAmt} onChange={(v) => setAdvAmt(v)} required /></div>
              <div className="nom-field"><label>Fecha</label><DateField value={advDate} onChange={setAdvDate} /></div>
            </div>
            {selectedAdvanceAccount?.currency === 'VES' && <div className="nom-field"><label>Tasa BCV *</label><input type="number" inputMode="decimal" min="0" step="0.01" value={advRate} onChange={(e) => setAdvRate(e.target.value)} placeholder={String(bcvRate || '')} required /><small className="nom-field-help">Se guardará el monto en bolívares y su equivalente en USD para la nómina.</small></div>}
            <div className="nom-field"><label>Notas</label><input value={advNotes} onChange={(e) => setAdvNotes(e.target.value)} placeholder="Opcional" /></div>
            <div className="nom-modal-actions"><button type="button" className="nom-cancel" onClick={() => closeAdvance()}>Cancelar</button><button type="submit" className="nom-btn">Registrar</button></div>
          </form>
        </div>,
        document.body
      )}
      {adjustmentModal && createPortal(
        <div className="nom-modal-overlay" onClick={() => setAdjustmentModal(null)}>
          <form className="nom-modal nom-modal--bonus" onClick={(event) => event.stopPropagation()} onSubmit={submitAdjustment}>
            <div className="nom-modal-header"><div className="nom-modal-header-icon">{adjustmentModal.type === 'bonus' ? <Gift size={18} /> : adjustmentModal.type === 'salary' ? <Banknote size={18} /> : <Hourglass size={18} />}</div>
              <h3>{adjustmentModal.type === 'salary' ? 'Añadir salario' : adjustmentModal.type === 'bonus' ? 'Añadir bono' : 'Registrar descuento'}</h3></div>
            <p className="nom-history-note">{adjustmentModal.employee.fullName} · Este movimiento se suma al historial del mes y actualiza el saldo acumulado.</p>
            <div className="nom-row2"><div className="nom-field"><label>Monto (USD) *</label><NumberStepper step={0.01} min={0.01} value={adjustmentModal.amount} onChange={(value) => setAdjustmentModal((current) => current ? { ...current, amount: value } : current)} required /></div><div className="nom-field"><label>Fecha *</label><DateField value={adjustmentModal.date} onChange={(date) => setAdjustmentModal((current) => current ? { ...current, date } : current)} required /></div></div>
            <div className="nom-field"><label>{adjustmentModal.type === 'discount' ? 'Motivo del descuento' : 'Descripción'}</label><input value={adjustmentModal.description} onChange={(event) => setAdjustmentModal((current) => current ? { ...current, description: event.target.value } : current)} placeholder={adjustmentModal.type === 'salary' ? 'Ej. Salario semanal' : adjustmentModal.type === 'bonus' ? 'Ej. Bono de producción' : 'Ej. Ausencia, corrección'} /></div>
            <div className="nom-modal-actions"><button type="button" className="nom-cancel" onClick={() => setAdjustmentModal(null)}>Cancelar</button><button type="submit" className="nom-btn" disabled={saving}>{saving ? <Loader2 size={16} className="animate-spin" /> : 'Guardar movimiento'}</button></div>
          </form>
        </div>, document.body
      )}
      {showPayment && createPortal(
        <div className={`nom-modal-overlay ${closingPayment ? 'closing' : ''}`} onClick={() => closePayment()}>
          <form className="nom-modal nom-modal--payment" onClick={(e) => e.stopPropagation()} onSubmit={submitPayment}>
            <div className="nom-modal-header">
              <div className="nom-modal-header-icon"><Banknote size={18} /></div>
              <h3>Registrar pago directo</h3>
            </div>
            <div className="nom-field"><label>Empleado *</label><StyledSelect value={payEmp} onChange={(e) => setPayEmp(e.target.value)} required><option value="">Seleccionar...</option>{activeEmployees.map((e) => <option key={e.id} value={e.id}>{e.fullName} — {e.position || 'Empleado'}</option>)}</StyledSelect></div>
            <p className="nom-history-note">Saldo pendiente: {formatUsd(Math.max(0, payrollBalanceByEmployee.get(payEmp) ?? 0))}. Puedes registrar un abono y el resto seguirá pendiente.</p>
            <div className="nom-row2">
              <div className="nom-field"><label>Monto {accounts.find((item) => item.id === payAccount)?.currency === 'VES' ? '(Bs)' : '($)'} *</label><NumberStepper step={0.01} min={0.01} value={payAmt} onChange={(v) => setPayAmt(v)} required /></div>
              <div className="nom-field"><label>Cuenta de salida *</label><StyledSelect value={payAccount} onChange={(e) => { const account = accounts.find((item) => item.id === e.target.value); setPayAccount(e.target.value); setPayRate(account?.currency === 'VES' ? String(bcvRate || '') : '') }} required><option value="">Seleccionar cuenta...</option>{accounts.filter((item) => item.isActive && ['USD', 'VES'].includes(item.currency)).map((account) => <option key={account.id} value={account.id}>{account.name} · {account.currency === 'VES' ? 'Bs' : 'USD'}</option>)}</StyledSelect></div>
            </div>
            {accounts.find((item) => item.id === payAccount)?.currency === 'VES' && <div className="nom-field"><label>Tasa BCV *</label><input type="number" inputMode="decimal" min="0" step="0.01" value={payRate} onChange={(event) => setPayRate(event.target.value)} required /></div>}
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
        const monthMatches = (date: string) => date.slice(0, 7) === detailMonth
        const entries = Object.values(entriesByPeriod).flat().filter((entry) => entry.employeeId === emp.id && periods.some((period) => period.id === entry.payrollPeriodId && monthMatches(period.endDate))).map((entry) => ({ id: `entry:${entry.id}`, date: periods.find((period) => period.id === entry.payrollPeriodId)?.endDate ?? '', label: 'Nómina de período', amount: entry.netPay, direction: 'add' as const, note: periods.find((period) => period.id === entry.payrollPeriodId)?.notes || '' }))
        const items = [
          ...entries,
          ...adjustments.filter((item) => item.employeeId === emp.id && monthMatches(item.adjustmentDate)).map((item) => ({ id: `adjust:${item.id}`, date: item.adjustmentDate, label: item.direction === 'add' ? (item.adjustmentType === 'bonus' ? 'Bono' : 'Salario añadido') : 'Descuento', amount: item.amount, direction: item.direction, note: item.description || '' })),
          ...payments.filter((item) => item.employeeId === emp.id && monthMatches(item.paymentDate)).map((item) => ({ id: `payment:${item.id}`, date: item.paymentDate, label: 'Pago / abono', amount: item.currency === 'Bs' && item.exchangeRate ? item.amount / item.exchangeRate : item.amount, direction: 'deduct' as const, note: `${item.paymentAccount || 'Cuenta no indicada'}${item.reference ? ` · ${item.reference}` : ''}` })),
          ...advances.filter((item) => item.employeeId === emp.id && monthMatches(item.advanceDate)).map((item) => ({ id: `advance:${item.id}`, date: item.advanceDate, label: 'Adelanto', amount: item.amount, direction: 'deduct' as const, note: item.notes || item.accountName || '' })),
          ...deliveryAssignments.filter((item) => item.employeeId === emp.id && item.status !== 'cancelled' && monthMatches(item.assignedAt.slice(0, 10))).map((item) => ({ id: `delivery:${item.id}`, date: item.assignedAt.slice(0, 10), label: `Comisión delivery · ${item.status === 'paid' ? 'pagada' : 'pendiente'}`, amount: item.employeeAmount, direction: 'add' as const, note: `Domicilio ${formatUsd(item.deliveryFee)} · ${Math.round(item.employeePercent)}%` })),
          ...bonuses.filter((item) => item.employeeId === emp.id && monthMatches(item.bonusDate)).map((item) => ({ id: `legacy-bonus:${item.id}`, date: item.bonusDate, label: 'Bono histórico (registrado)', amount: item.amount, direction: 'info' as const, note: `${item.reason || 'Registrado anteriormente'} · conserva el registro previo` })),
        ].sort((a, b) => b.date.localeCompare(a.date))
        const balance = payrollBalanceByEmployee.get(emp.id) ?? 0
        const empPayments = payments.filter((item) => item.employeeId === emp.id).sort((a, b) => b.paymentDate.localeCompare(a.paymentDate))
        return (
          <div className="nom-modal-overlay" onClick={() => setDetailEmp(null)}>
            <div className="nom-modal nom-modal--detail" onClick={(e) => e.stopPropagation()}>
              <div className="nom-modal-header">
                <div className="nom-modal-header-icon">{emp.position?.toLowerCase() === 'delivery' ? <Bike size={18} /> : <Users size={18} />}</div>
                <h3>{emp.fullName}</h3>
                <span className="nom-status open">{emp.position || 'Empleado'}</span>
                <button type="button" className="nom-detail-close" onClick={() => setDetailEmp(null)} aria-label="Cerrar"><X size={18} /></button>
              </div>
              <div className="nom-detail-summary"><div className="nom-detail-stat"><span>Saldo pendiente</span><strong>{formatUsd(Math.max(0, balance))}</strong><small>{bsReference(Math.max(0, balance))}</small></div><div className="nom-detail-stat"><span>Generado acumulado</span><strong>{formatUsd(balance + (paidByEmployee.get(emp.id) ?? 0) + advances.filter((item) => item.employeeId === emp.id && !item.isDeducted).reduce((sum, item) => sum + item.amount, 0))}</strong><small>Incluye períodos, ajustes y delivery</small></div><div className="nom-detail-stat"><span>Vales y pagos acumulados</span><strong>{formatUsd((paidByEmployee.get(emp.id) ?? 0) + advances.filter((item) => item.employeeId === emp.id && !item.isDeducted).reduce((sum, item) => sum + item.amount, 0))}</strong><small>Pagos registrados y adelantos pendientes</small></div></div>
              <div className="nom-detail-section"><h4>Movimientos del mes <input aria-label="Mes del detalle" type="month" value={detailMonth} onChange={(event) => setDetailMonth(event.target.value)} /></h4>
                {items.length === 0 ? <p className="nom-detail-empty">No hay movimientos registrados este mes.</p> : <div className="nom-mini-table-wrap"><table className="nom-mini-table"><thead><tr><th>Fecha</th><th>Concepto</th><th>Monto USD</th><th>Detalle</th></tr></thead><tbody>{items.map((item) => <tr key={item.id}><td>{new Date(`${item.date}T00:00:00`).toLocaleDateString('es-VE')}</td><td>{item.label}</td><td><strong style={{ color: item.direction === 'add' ? '#22c55e' : item.direction === 'deduct' ? '#ef4444' : '#a1a1aa' }}>{item.direction === 'add' ? '+' : item.direction === 'deduct' ? '−' : ''}{formatUsd(item.amount)}</strong></td><td>{item.note || '—'}</td></tr>)}</tbody></table></div>}
              </div>
              <div className="nom-detail-section"><h4>Historial acumulado de pagos <span>{empPayments.length}</span><small style={{ display: 'block', color: '#a1a1aa', fontWeight: 400 }}>Pagado acumulado: {formatUsd(paidByEmployee.get(emp.id) ?? 0)}</small></h4>
                {empPayments.length === 0 ? <p className="nom-detail-empty">Todavía no hay pagos registrados.</p> : <div className="nom-mini-table-wrap"><table className="nom-mini-table"><thead><tr><th>Mes</th><th>Fecha</th><th>Pagado</th><th>Cuenta</th><th>Referencia</th></tr></thead><tbody>{empPayments.map((payment) => <tr key={payment.id}><td>{payment.paymentDate.slice(0, 7)}</td><td>{new Date(`${payment.paymentDate}T00:00:00`).toLocaleDateString('es-VE')}</td><td><strong>{payment.currency === 'Bs' ? formatVes(payment.amount) : formatUsd(payment.amount)}</strong></td><td>{payment.paymentAccount || '—'}</td><td>{payment.reference || '—'}</td></tr>)}</tbody></table></div>}
              </div>

              <div className="nom-modal-actions"><button type="button" className="nom-cancel" onClick={() => setDetailEmp(null)}>Cerrar</button></div>
            </div>
          </div>
        )
      })(), document.body)}
    </div>
  )
}

// build: nomina redesign v2 (2026-08-17)
