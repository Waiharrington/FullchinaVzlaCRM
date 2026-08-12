import { useState, useEffect, useCallback } from 'react'
import {
  getEmployees, getPayrollPeriods, createPayrollPeriod,
  getPayrollEntries, upsertPayrollEntry, getAdvances, createAdvance, setAdvanceDeducted,
  getProductionBonusRecords, createProductionBonus,
  type Employee, type PayrollPeriod, type PayrollEntry, type Advance, type ProductionBonusRecord,
} from '../lib/dataService'
import {
  Plus, CheckCircle2, AlertTriangle, Loader2, Clock,
} from 'lucide-react'
import './Nomina.css'

export function Nomina() {
  const [employees, setEmployees] = useState<Employee[]>([])
  const [periods, setPeriods] = useState<PayrollPeriod[]>([])
  const [selectedPeriod, setSelectedPeriod] = useState<PayrollPeriod | null>(null)
  const [entries, setEntries] = useState<PayrollEntry[]>([])
  const [advances, setAdvances] = useState<Advance[]>([])
  const [bonuses, setBonuses] = useState<ProductionBonusRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  // Period form
  const [showPeriodForm, setShowPeriodForm] = useState(false)
  const [periodStart, setPeriodStart] = useState('')
  const [periodEnd, setPeriodEnd] = useState('')
  const [periodNotes, setPeriodNotes] = useState('')

  // Advance form
  const [showAdvanceForm, setShowAdvanceForm] = useState(false)
  const [advanceEmployeeId, setAdvanceEmployeeId] = useState('')
  const [advanceAmount, setAdvanceAmount] = useState('')
  const [advanceDate, setAdvanceDate] = useState(new Date().toISOString().split('T')[0])
  const [advanceNotes, setAdvanceNotes] = useState('')

  // Bonus form
  const [showBonusForm, setShowBonusForm] = useState(false)
  const [bonusEmployeeId, setBonusEmployeeId] = useState('')
  const [bonusAmount, setBonusAmount] = useState('')
  const [bonusDate, setBonusDate] = useState(new Date().toISOString().split('T')[0])
  const [bonusReason, setBonusReason] = useState('')

  // Entry editing
  const [editingEntry, setEditingEntry] = useState<Record<string, { hours: string; salary: string; deductions: string; notes: string }>>({})

  const load = useCallback(async () => {
    try {
      setLoading(true)
      setError('')
      const [emp, per, adv, bon] = await Promise.all([
        getEmployees(),
        getPayrollPeriods(),
        getAdvances(),
        getProductionBonusRecords(),
      ])
      setEmployees(emp)
      setPeriods(per)
      setAdvances(adv)
      setBonuses(bon)
      if (per.length > 0 && !selectedPeriod) setSelectedPeriod(per[0])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error cargando nómina')
    } finally {
      setLoading(false)
    }
  }, [selectedPeriod])

  useEffect(() => { void load() }, [load])

  // Load entries when period changes
  useEffect(() => {
    if (!selectedPeriod) { setEntries([]); return }
    getPayrollEntries(selectedPeriod.id)
      .then(setEntries)
      .catch(e => setError(e instanceof Error ? e.message : 'Error cargando liquidaciones'))
  }, [selectedPeriod])

  // Initialize entry editing state for employees not yet in the period
  useEffect(() => {
    if (!selectedPeriod) return
    const existing = new Set(entries.map(e => e.employeeId))
    const newEditing: typeof editingEntry = {}
    for (const emp of employees) {
      if (existing.has(emp.id)) {
        const entry = entries.find(e => e.employeeId === emp.id)!
        newEditing[emp.id] = {
          hours: String(entry.hoursWorked),
          salary: String(entry.baseSalary),
          deductions: String(entry.deductions),
          notes: entry.notes ?? '',
        }
      } else {
        newEditing[emp.id] = { hours: '0', salary: '0', deductions: '0', notes: '' }
      }
    }
    setEditingEntry(newEditing)
  }, [entries, employees, selectedPeriod])

  const handleCreatePeriod = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!periodStart || !periodEnd) return
    try {
      setError('')
      await createPayrollPeriod({ startDate: periodStart, endDate: periodEnd, notes: periodNotes.trim() || undefined })
      setNotice('Periodo creado')
      setShowPeriodForm(false)
      setPeriodStart('')
      setPeriodEnd('')
      setPeriodNotes('')
      await load()
      setTimeout(() => setNotice(''), 3000)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error creando periodo')
    }
  }

  const handleSaveEntry = async (employeeId: string) => {
    if (!selectedPeriod) return
    const ed = editingEntry[employeeId]
    if (!ed) return
    try {
      setError('')
      await upsertPayrollEntry({
        payrollPeriodId: selectedPeriod.id,
        employeeId,
        hoursWorked: parseFloat(ed.hours) || 0,
        baseSalary: parseFloat(ed.salary) || 0,
        deductions: parseFloat(ed.deductions) || 0,
        notes: ed.notes.trim() || undefined,
      })
      setNotice('Liquidación guardada')
      const updated = await getPayrollEntries(selectedPeriod.id)
      setEntries(updated)
      setTimeout(() => setNotice(''), 2000)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error guardando liquidación')
    }
  }

  const handleCreateAdvance = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!advanceEmployeeId || !advanceAmount) return
    try {
      setError('')
      await createAdvance({
        employeeId: advanceEmployeeId,
        amount: parseFloat(advanceAmount) || 0,
        advanceDate,
        notes: advanceNotes.trim() || undefined,
      })
      setNotice('Adelanto registrado')
      setShowAdvanceForm(false)
      setAdvanceAmount('')
      setAdvanceNotes('')
      await load()
      setTimeout(() => setNotice(''), 3000)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error registrando adelanto')
    }
  }

  const handleMarkDeducted = async (id: string, deducted: boolean) => {
    try {
      setError('')
      await setAdvanceDeducted(id, deducted)
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error actualizando')
    }
  }

  const handleCreateBonus = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!bonusEmployeeId || !bonusAmount) return
    try {
      setError('')
      await createProductionBonus({
        employeeId: bonusEmployeeId,
        amount: parseFloat(bonusAmount) || 0,
        bonusDate,
        reason: bonusReason.trim() || undefined,
      })
      setNotice('Bono registrado')
      setShowBonusForm(false)
      setBonusAmount('')
      setBonusReason('')
      await load()
      setTimeout(() => setNotice(''), 3000)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error registrando bono')
    }
  }

  const activeEmpCount = employees.length
  const totalPayroll = entries.reduce((sum, e) => sum + e.netPay, 0)
  const totalBonuses = bonuses.reduce((sum, b) => sum + b.amount, 0)
  const pendingAdvances = advances.filter(a => !a.isDeducted).reduce((sum, a) => sum + a.amount, 0)

  if (loading) {
    return (
      <div className="page animate-fade-in">
        <div style={{ display: 'flex', justifyContent: 'center', padding: '64px 0' }}>
          <Loader2 size={32} className="animate-spin" style={{ color: '#ef4444' }} />
        </div>
      </div>
    )
  }

  return (
    <div className="page animate-fade-in">
      <header className="page-header">
        <div>
          <h1 className="page-title text-gradient">Nómina y Personal</h1>
          <p className="page-subtitle">Liquidaciones por periodo, adelantos y bonos de producción</p>
        </div>
      </header>

      {error && (
        <div className="whatsapp-notice-banner" style={{ background: 'rgba(239,68,68,0.15)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)' }}>
          <AlertTriangle size={18} /> {error}
        </div>
      )}
      {notice && (
        <div className="whatsapp-notice-banner" style={{ background: 'rgba(16,185,129,0.15)', color: '#10b981', border: '1px solid rgba(16,185,129,0.3)' }}>
          <CheckCircle2 size={18} /> {notice}
        </div>
      )}

      {/* Stats */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon">👥</div>
          <div className="stat-info">
            <span className="stat-value">{activeEmpCount}</span>
            <span className="stat-label">Empleados activos</span>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">💵</div>
          <div className="stat-info">
            <span className="stat-value">${totalPayroll.toFixed(2)}</span>
            <span className="stat-label">Liquidación periodo</span>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">🎁</div>
          <div className="stat-info">
            <span className="stat-value">${totalBonuses.toFixed(2)}</span>
            <span className="stat-label">Bonos totales</span>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">⏳</div>
          <div className="stat-info">
            <span className="stat-value">${pendingAdvances.toFixed(2)}</span>
            <span className="stat-label">Adelantos pendientes</span>
          </div>
        </div>
      </div>

      {/* Periods */}
      <div className="nomina-section">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <h3 style={{ margin: 0 }}>Periodos de Nómina</h3>
          <button className="btn-transfer-submit" style={{ margin: 0, padding: '6px 12px', fontSize: '12px' }} onClick={() => setShowPeriodForm(!showPeriodForm)}>
            <Plus size={14} /> Nuevo Periodo
          </button>
        </div>

        {showPeriodForm && (
          <form onSubmit={handleCreatePeriod} style={{ display: 'flex', gap: '8px', alignItems: 'end', marginBottom: '12px', flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: '140px' }}>
              <label style={{ color: '#a1a1aa', fontSize: '11px', display: 'block', marginBottom: '4px' }}>Inicio *</label>
              <input type="date" className="nomina-input" value={periodStart} onChange={e => setPeriodStart(e.target.value)} required />
            </div>
            <div style={{ flex: 1, minWidth: '140px' }}>
              <label style={{ color: '#a1a1aa', fontSize: '11px', display: 'block', marginBottom: '4px' }}>Fin *</label>
              <input type="date" className="nomina-input" value={periodEnd} onChange={e => setPeriodEnd(e.target.value)} required />
            </div>
            <div style={{ flex: 2, minWidth: '160px' }}>
              <label style={{ color: '#a1a1aa', fontSize: '11px', display: 'block', marginBottom: '4px' }}>Notas</label>
              <input type="text" className="nomina-input" value={periodNotes} onChange={e => setPeriodNotes(e.target.value)} placeholder="Opcional" />
            </div>
            <button type="submit" className="btn-transfer-submit" style={{ margin: 0 }}>Crear</button>
          </form>
        )}

        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {periods.map(p => (
            <button
              key={p.id}
              type="button"
              className={`period-chip ${selectedPeriod?.id === p.id ? 'active' : ''}`}
              onClick={() => setSelectedPeriod(p)}
            >
              <Clock size={14} />
              {new Date(p.startDate).toLocaleDateString('es-VE')} — {new Date(p.endDate).toLocaleDateString('es-VE')}
              <span style={{ fontSize: '11px', opacity: 0.7 }}>{p.status}</span>
            </button>
          ))}
          {periods.length === 0 && <span style={{ color: '#71717a', fontSize: '13px' }}>No hay periodos. Crea uno con el botón de arriba.</span>}
        </div>
      </div>

      {/* Entries for selected period */}
      {selectedPeriod && (
        <div className="nomina-section">
          <h3>
            Liquidaciones — {new Date(selectedPeriod.startDate).toLocaleDateString('es-VE')} a {new Date(selectedPeriod.endDate).toLocaleDateString('es-VE')}
            {selectedPeriod.status !== 'open' && (
              <span style={{ fontSize: '12px', color: '#a1a1aa', marginLeft: '8px' }}>({selectedPeriod.status})</span>
            )}
          </h3>

          {employees.length === 0 && <p style={{ color: '#71717a', fontSize: '13px' }}>No hay empleados activos para liquidar.</p>}

          {employees.map(emp => {
            const ed = editingEntry[emp.id]
            if (!ed) return null
            const netPay = (parseFloat(ed.salary) || 0) - (parseFloat(ed.deductions) || 0)
            return (
              <div key={emp.id} style={{ background: 'rgba(255,255,255,0.02)', borderRadius: '8px', padding: '12px', marginBottom: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <strong style={{ color: '#fff', fontSize: '14px' }}>{emp.fullName}</strong>
                  <span style={{ color: '#10b981', fontWeight: 700, fontSize: '14px' }}>${netPay.toFixed(2)}</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))', gap: '8px', alignItems: 'end' }}>
                  <div>
                    <label style={{ color: '#a1a1aa', fontSize: '11px', display: 'block', marginBottom: '2px' }}>Horas</label>
                    <input type="number" step="any" min="0" className="nomina-input" value={ed.hours} onChange={e => setEditingEntry(prev => ({ ...prev, [emp.id]: { ...prev[emp.id], hours: e.target.value } }))} />
                  </div>
                  <div>
                    <label style={{ color: '#a1a1aa', fontSize: '11px', display: 'block', marginBottom: '2px' }}>Sueldo base ($)</label>
                    <input type="number" step="any" min="0" className="nomina-input" value={ed.salary} onChange={e => setEditingEntry(prev => ({ ...prev, [emp.id]: { ...prev[emp.id], salary: e.target.value } }))} />
                  </div>
                  <div>
                    <label style={{ color: '#a1a1aa', fontSize: '11px', display: 'block', marginBottom: '2px' }}>Deducciones ($)</label>
                    <input type="number" step="any" min="0" className="nomina-input" value={ed.deductions} onChange={e => setEditingEntry(prev => ({ ...prev, [emp.id]: { ...prev[emp.id], deductions: e.target.value } }))} />
                  </div>
                  <div>
                    <label style={{ color: '#a1a1aa', fontSize: '11px', display: 'block', marginBottom: '2px' }}>Notas</label>
                    <input type="text" className="nomina-input" value={ed.notes} onChange={e => setEditingEntry(prev => ({ ...prev, [emp.id]: { ...prev[emp.id], notes: e.target.value } }))} placeholder="Opcional" />
                  </div>
                  <div>
                    <button type="button" className="btn-transfer-submit" style={{ margin: 0, padding: '6px 12px', fontSize: '12px', width: '100%' }} onClick={() => handleSaveEntry(emp.id)}>
                      Guardar
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Advances */}
      <div className="nomina-section">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <h3 style={{ margin: 0 }}>Adelantos de Salario</h3>
          <button className="btn-transfer-submit" style={{ margin: 0, padding: '6px 12px', fontSize: '12px' }} onClick={() => setShowAdvanceForm(!showAdvanceForm)}>
            <Plus size={14} /> Nuevo Adelanto
          </button>
        </div>

        {showAdvanceForm && (
          <form onSubmit={handleCreateAdvance} style={{ display: 'flex', gap: '8px', alignItems: 'end', marginBottom: '12px', flexWrap: 'wrap' }}>
            <div style={{ flex: 2, minWidth: '180px' }}>
              <label style={{ color: '#a1a1aa', fontSize: '11px', display: 'block', marginBottom: '2px' }}>Empleado *</label>
              <select className="nomina-select" value={advanceEmployeeId} onChange={e => setAdvanceEmployeeId(e.target.value)} required>
                <option value="">Seleccionar...</option>
                {employees.map(e => <option key={e.id} value={e.id}>{e.fullName}</option>)}
              </select>
            </div>
            <div style={{ flex: 1, minWidth: '100px' }}>
              <label style={{ color: '#a1a1aa', fontSize: '11px', display: 'block', marginBottom: '2px' }}>Monto ($) *</label>
              <input type="number" step="any" min="0.01" className="nomina-input" value={advanceAmount} onChange={e => setAdvanceAmount(e.target.value)} required />
            </div>
            <div style={{ flex: 1, minWidth: '130px' }}>
              <label style={{ color: '#a1a1aa', fontSize: '11px', display: 'block', marginBottom: '2px' }}>Fecha</label>
              <input type="date" className="nomina-input" value={advanceDate} onChange={e => setAdvanceDate(e.target.value)} />
            </div>
            <div style={{ flex: 2, minWidth: '140px' }}>
              <label style={{ color: '#a1a1aa', fontSize: '11px', display: 'block', marginBottom: '2px' }}>Notas</label>
              <input type="text" className="nomina-input" value={advanceNotes} onChange={e => setAdvanceNotes(e.target.value)} placeholder="Opcional" />
            </div>
            <button type="submit" className="btn-transfer-submit" style={{ margin: 0 }}>Registrar</button>
          </form>
        )}

        <div className="table-responsive-wrapper">
          <table className="almacen-table">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Empleado</th>
                <th>Monto</th>
                <th>Estado</th>
                <th>Notas</th>
              </tr>
            </thead>
            <tbody>
              {advances.map(a => (
                <tr key={a.id}>
                  <td>{new Date(a.advanceDate).toLocaleDateString('es-VE')}</td>
                  <td>{a.employeeName}</td>
                  <td><strong>${a.amount.toFixed(2)}</strong></td>
                  <td>
                    <button
                      type="button"
                      onClick={() => handleMarkDeducted(a.id, !a.isDeducted)}
                      style={{
                        background: a.isDeducted ? 'rgba(16,185,129,0.15)' : 'rgba(234,179,8,0.15)',
                        color: a.isDeducted ? '#10b981' : '#eab308',
                        border: `1px solid ${a.isDeducted ? 'rgba(16,185,129,0.3)' : 'rgba(234,179,8,0.3)'}`,
                        borderRadius: '6px', padding: '4px 10px', cursor: 'pointer', fontSize: '12px',
                      }}
                    >
                      {a.isDeducted ? 'Deducido' : 'Pendiente'}
                    </button>
                  </td>
                  <td style={{ color: '#a1a1aa', fontSize: '12px' }}>{a.notes || '—'}</td>
                </tr>
              ))}
              {advances.length === 0 && (
                <tr><td colSpan={5} style={{ textAlign: 'center', color: '#71717a' }}>No hay adelantos registrados.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Bonuses */}
      <div className="nomina-section">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <h3 style={{ margin: 0 }}>Bonos de Producción</h3>
          <button className="btn-transfer-submit" style={{ margin: 0, padding: '6px 12px', fontSize: '12px' }} onClick={() => setShowBonusForm(!showBonusForm)}>
            <Plus size={14} /> Nuevo Bono
          </button>
        </div>

        {showBonusForm && (
          <form onSubmit={handleCreateBonus} style={{ display: 'flex', gap: '8px', alignItems: 'end', marginBottom: '12px', flexWrap: 'wrap' }}>
            <div style={{ flex: 2, minWidth: '180px' }}>
              <label style={{ color: '#a1a1aa', fontSize: '11px', display: 'block', marginBottom: '2px' }}>Empleado *</label>
              <select className="nomina-select" value={bonusEmployeeId} onChange={e => setBonusEmployeeId(e.target.value)} required>
                <option value="">Seleccionar...</option>
                {employees.map(e => <option key={e.id} value={e.id}>{e.fullName}</option>)}
              </select>
            </div>
            <div style={{ flex: 1, minWidth: '100px' }}>
              <label style={{ color: '#a1a1aa', fontSize: '11px', display: 'block', marginBottom: '2px' }}>Monto ($) *</label>
              <input type="number" step="any" min="0.01" className="nomina-input" value={bonusAmount} onChange={e => setBonusAmount(e.target.value)} required />
            </div>
            <div style={{ flex: 1, minWidth: '130px' }}>
              <label style={{ color: '#a1a1aa', fontSize: '11px', display: 'block', marginBottom: '2px' }}>Fecha</label>
              <input type="date" className="nomina-input" value={bonusDate} onChange={e => setBonusDate(e.target.value)} />
            </div>
            <div style={{ flex: 2, minWidth: '140px' }}>
              <label style={{ color: '#a1a1aa', fontSize: '11px', display: 'block', marginBottom: '2px' }}>Motivo</label>
              <input type="text" className="nomina-input" value={bonusReason} onChange={e => setBonusReason(e.target.value)} placeholder="Opcional" />
            </div>
            <button type="submit" className="btn-transfer-submit" style={{ margin: 0 }}>Registrar</button>
          </form>
        )}

        <div className="table-responsive-wrapper">
          <table className="almacen-table">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Empleado</th>
                <th>Monto</th>
                <th>Motivo</th>
              </tr>
            </thead>
            <tbody>
              {bonuses.map(b => (
                <tr key={b.id}>
                  <td>{new Date(b.bonusDate).toLocaleDateString('es-VE')}</td>
                  <td>{b.employeeName}</td>
                  <td><strong className="text-success">${b.amount.toFixed(2)}</strong></td>
                  <td style={{ color: '#a1a1aa', fontSize: '12px' }}>{b.reason || '—'}</td>
                </tr>
              ))}
              {bonuses.length === 0 && (
                <tr><td colSpan={4} style={{ textAlign: 'center', color: '#71717a' }}>No hay bonos registrados.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
