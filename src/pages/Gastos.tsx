import { useEffect, useMemo, useState } from 'react'
import { createExpense, getExpenses } from '../lib/dataService'
import { useAuth } from '../context/auth-context'
import { StyledSelect } from '../components/StyledSelect'
import NumberStepper from '../components/NumberStepper'
import { getExchangeRates } from '../lib/rates'
import { formatUsd, formatVes, dateKeyInTimeZone } from '../lib/money'
import { normalizeForSearch } from '../lib/textFormat'
import {
  Receipt, Store, Plus, TrendingDown, Wallet, Activity,
  Search, Filter, Download, HelpCircle, X,
} from 'lucide-react'
import Toast from '../components/Toast'
import { EmptyState } from '../components/EmptyState'
import './Gastos.css'

type ExpenseView = { id: string; description: string; type: 'fixed' | 'variable'; category: string; vendor: string; amountUsd: number; date: string; paymentMethod: string; reference?: string }
const CATEGORIES = [
  { v: 'supermarket', l: 'Supermercado' }, { v: 'delivery', l: 'Delivery' }, { v: 'pos_commission', l: 'Comisión' },
  { v: 'payroll', l: 'Nómina' }, { v: 'cleaning', l: 'Limpieza' }, { v: 'services', l: 'Servicios' },
  { v: 'maintenance', l: 'Mantenimiento' }, { v: 'other', l: 'Otro' },
]
const catLabel = (v: string) => CATEGORIES.find((c) => c.v === v)?.l ?? v
const METHODS = [
  { v: 'pago_movil', l: 'Pago Móvil' }, { v: 'efectivo_usd', l: 'Efectivo USD' },
  { v: 'efectivo_bs', l: 'Efectivo Bs' }, { v: 'transferencia', l: 'Transferencia' }, { v: 'punto', l: 'Punto' },
]
const methodLabel = (v: string) => METHODS.find((m) => m.v === v)?.l ?? v
const PAGE_SIZE = 8
const emptyForm = { description: '', type: 'variable' as 'fixed' | 'variable', category: 'supermarket', vendor: '', amountUsd: '', paymentMethod: 'pago_movil', reference: '', notes: '' }

export function Gastos() {
  const { user } = useAuth()
  const [expenses, setExpenses] = useState<ExpenseView[]>([])
  const [rate, setRate] = useState(40.56)
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')

  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<'todos' | 'fixed' | 'variable'>('todos')
  const [showFilters, setShowFilters] = useState(false)
  const [page, setPage] = useState(1)

  const [form, setForm] = useState(emptyForm)
  const [keepOpen, setKeepOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [mobileFormOpen, setMobileFormOpen] = useState(false)

  useEffect(() => {
    getExchangeRates().then((r) => { if (r.bcv > 0) setRate(r.bcv) }).catch(() => {})
    getExpenses().then((data) => setExpenses(data.map((item) => {
      let meta: Record<string, string> = {}
      try { meta = item.notes ? JSON.parse(item.notes) as Record<string, string> : {} } catch { meta = {} }
      return { id: item.id, description: item.concept, type: item.category === 'fixed' ? 'fixed' : 'variable', category: meta.category || 'other', vendor: meta.vendor || 'Sin proveedor', amountUsd: item.amount, date: item.expenseDate, paymentMethod: meta.paymentMethod || 'other', reference: meta.reference || undefined }
    }))).catch((e) => setError(e instanceof Error ? e.message : 'No se pudieron cargar los gastos'))
  }, [])

  const flash = (m: string) => { setNotice(m); setTimeout(() => setNotice(''), 3500) }

  const summary = useMemo(() => {
    const now = new Date()
    const thisMonth = expenses.filter((e) => { const d = new Date(e.date); return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() })
    const prevMonth = expenses.filter((e) => { const d = new Date(e.date); return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() - 1 })
    const total = thisMonth.reduce((s, e) => s + e.amountUsd, 0)
    const prev = prevMonth.reduce((s, e) => s + e.amountUsd, 0)
    const fixed = thisMonth.filter((e) => e.type === 'fixed').reduce((s, e) => s + e.amountUsd, 0)
    const variable = thisMonth.filter((e) => e.type === 'variable').reduce((s, e) => s + e.amountUsd, 0)
    const aradito = thisMonth.filter((e) => e.vendor.toLowerCase().includes('aradito')).reduce((s, e) => s + e.amountUsd, 0)
    const pct = prev > 0 ? ((total - prev) / prev) * 100 : null
    return { total, fixed, variable, aradito, pct, pctFixed: total > 0 ? (fixed / total) * 100 : 0, pctVar: total > 0 ? (variable / total) * 100 : 0, pctArad: total > 0 ? (aradito / total) * 100 : 0 }
  }, [expenses])

  const vendors = useMemo(() => Array.from(new Set(expenses.map((e) => e.vendor).filter((v) => v && v !== 'Sin proveedor'))), [expenses])

  const filtered = useMemo(() => {
    const q = normalizeForSearch(search)
    return expenses.filter((e) => {
      if (q && !(normalizeForSearch(e.description).includes(q) || normalizeForSearch(e.vendor).includes(q))) return false
      if (typeFilter !== 'todos' && e.type !== typeFilter) return false
      return true
    })
  }, [expenses, search, typeFilter])
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const safePage = Math.min(page, totalPages)
  const pageItems = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)
  useEffect(() => { setPage(1) }, [search, typeFilter])

  const amountNum = parseFloat(form.amountUsd) || 0

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user || !form.description.trim() || amountNum <= 0) return
    setSaving(true); setError('')
    try {
      const saved = await createExpense({
        concept: form.description.trim(), amount: amountNum, category: form.type,
        expenseDate: dateKeyInTimeZone(), userId: user.id,
        notes: JSON.stringify({ category: form.category, vendor: form.vendor.trim() || 'Sin proveedor', paymentMethod: form.paymentMethod, reference: form.reference.trim(), extra: form.notes.trim() }),
      })
      setExpenses((prev) => [{ id: saved.id, description: form.description.trim(), type: form.type, category: form.category, vendor: form.vendor.trim() || 'Sin proveedor', amountUsd: amountNum, date: saved.expenseDate, paymentMethod: form.paymentMethod, reference: form.reference.trim() || undefined }, ...prev])
      flash(`Gasto de ${formatUsd(amountNum)} registrado`)
      if (keepOpen) setForm({ ...emptyForm, type: form.type, category: form.category, vendor: form.vendor, paymentMethod: form.paymentMethod })
      else { setForm(emptyForm); setMobileFormOpen(false) }
    } catch (e) { setError(e instanceof Error ? e.message : 'Error al registrar el gasto') }
    finally { setSaving(false) }
  }

  const exportCsv = () => {
    const rows = [['Fecha', 'Descripción', 'Tipo', 'Categoría', 'Proveedor', 'Monto USD', 'Monto Bs', 'Método', 'Ref']]
    filtered.forEach((e) => rows.push([e.date, e.description, e.type === 'fixed' ? 'Fijo' : 'Variable', catLabel(e.category), e.vendor, e.amountUsd.toFixed(2), (e.amountUsd * rate).toFixed(2), methodLabel(e.paymentMethod), e.reference ?? '']))
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n')
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }))
    const a = document.createElement('a'); a.href = url; a.download = `gastos_${dateKeyInTimeZone()}.csv`; a.click(); URL.revokeObjectURL(url)
  }

  return (
    <div className="page gst-page animate-fade-in">
      <header className="page-header">
        <div>
          <h1 className="page-title text-gradient"><Wallet size={22} style={{ verticalAlign: '-3px', marginRight: 8 }} />Gastos</h1>
          <p className="page-subtitle">Registra y controla todos los egresos operativos del negocio que no son compras de inventario.</p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="gst-help" onClick={() => flash('Registra egresos que no son inventario (nómina, delivery, comisiones, servicios…). Compras de insumos van en el módulo Compras.')}><HelpCircle size={15} /> ¿Cómo funciona?</button>
          <button className="gst-btn" onClick={() => setMobileFormOpen(true)}><Plus size={16} /> Registrar Gasto</button>
        </div>
      </header>

      {error && <Toast type="error" message={error} onClose={() => setError('')} />}
      {notice && <Toast type="success" message={notice} onClose={() => setNotice('')} />}

      {/* Resumen */}
      <div className="gst-summary">
        <div className="gst-sum">
          <span className="gst-sum-ic" style={{ background: 'rgba(225,29,42,0.15)', color: '#e11d2a' }}><TrendingDown size={22} /></span>
          <div><div className="gst-sum-lbl">Egresos totales (este mes)</div><div className="gst-sum-val">{formatUsd(summary.total)}</div>
            {summary.pct != null && <div className={`gst-sum-sub ${summary.pct > 0 ? 'up' : 'down'}`}>{summary.pct > 0 ? '▲' : '▼'} {Math.abs(summary.pct).toFixed(0)}% vs. mes anterior</div>}
          </div>
        </div>
        <div className="gst-sum">
          <span className="gst-sum-ic" style={{ background: 'rgba(124,58,237,0.15)', color: '#a78bfa' }}><Receipt size={22} /></span>
          <div><div className="gst-sum-lbl">Gastos Fijos (este mes)</div><div className="gst-sum-val">{formatUsd(summary.fixed)}</div><div className="gst-sum-sub">{summary.pctFixed.toFixed(0)}% del total</div></div>
        </div>
        <div className="gst-sum">
          <span className="gst-sum-ic" style={{ background: 'rgba(249,115,22,0.15)', color: '#f97316' }}><Activity size={22} /></span>
          <div><div className="gst-sum-lbl">Gastos Variables (este mes)</div><div className="gst-sum-val">{formatUsd(summary.variable)}</div><div className="gst-sum-sub">{summary.pctVar.toFixed(0)}% del total</div></div>
        </div>
        <div className="gst-sum">
          <span className="gst-sum-ic" style={{ background: 'rgba(16,185,129,0.15)', color: '#10b981' }}><Store size={22} /></span>
          <div><div className="gst-sum-lbl">Gastos en Aradito (este mes)</div><div className="gst-sum-val">{formatUsd(summary.aradito)}</div><div className="gst-sum-sub">{summary.pctArad.toFixed(0)}% del total</div></div>
        </div>
      </div>

      <div className="gst-layout">
        {/* Tabla */}
        <div className="gst-card">
          <div className="gst-card-head">
            <div className="gst-card-title">
              <span className="gst-sum-ic" style={{ width: 34, height: 34, background: 'rgba(225,29,42,0.15)', color: '#e11d2a' }}><Receipt size={16} /></span>
              <div><h2>Registro de Egresos y Gastos Operativos</h2><p>Desglose por tipo, categoría y establecimiento comercial.</p></div>
            </div>
            <div className="gst-tools">
              <div className="gst-search"><Search size={14} className="ic" /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar gasto..." />{search && <button type="button" className="search-clear-btn search-clear-btn--floating" onClick={() => setSearch('')} aria-label="Borrar búsqueda"><X size={13} /></button>}</div>
              <button className="gst-tool" onClick={() => setShowFilters(!showFilters)}><Filter size={14} /> Filtros</button>
              <button className="gst-tool" onClick={exportCsv}><Download size={14} /> Exportar</button>
            </div>
          </div>

          {showFilters && (
            <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
              {(['todos', 'fixed', 'variable'] as const).map((t) => (
                <button key={t} className="gst-tool" style={typeFilter === t ? { background: '#e11d2a', borderColor: '#e11d2a', color: '#fff' } : undefined} onClick={() => setTypeFilter(t)}>
                  {t === 'todos' ? 'Todos' : t === 'fixed' ? 'Fijos' : 'Variables'}
                </button>
              ))}
            </div>
          )}

          <div className="gst-table-wrap">
            <table className="gst-table">
              <thead><tr><th>Fecha</th><th>Descripción</th><th>Tipo</th><th>Categoría</th><th>Proveedor</th><th>Monto (USD)</th><th>Monto (Bs)</th></tr></thead>
              <tbody>
                {pageItems.map((e) => (
                  <tr key={e.id}>
                    <td style={{ color: '#a1a1aa', fontSize: 12 }}>{new Date(e.date).toLocaleDateString('es-VE')}</td>
                    <td style={{ fontWeight: 600 }}>{e.description}</td>
                    <td><span className={`gst-badge ${e.type === 'fixed' ? 'fijo' : 'variable'}`}>{e.type === 'fixed' ? 'Fijo' : 'Variable'}</span></td>
                    <td><span className="gst-cat">{catLabel(e.category)}</span></td>
                    <td>{e.vendor}</td>
                    <td className="gst-usd">{formatUsd(e.amountUsd)}</td>
                    <td className="gst-bs">{formatVes(e.amountUsd * rate)}</td>
                  </tr>
                ))}
                {pageItems.length === 0 && (
                  <tr><td colSpan={7}>
                    <EmptyState
                      compact
                      title="No hay gastos registrados"
                      description="Registra tu primer gasto para llevar el control de tus finanzas."
                      actionLabel="Registrar gasto"
                      onAction={() => setMobileFormOpen(true)}
                    />
                  </td></tr>
                )}
              </tbody>
            </table>
          </div>

          {filtered.length > 0 && (
            <div className="gst-pagination">
              <span className="cnt">Mostrando {pageItems.length} de {filtered.length} gastos</span>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((n) => <button key={n} className={n === safePage ? 'active' : ''} onClick={() => setPage(n)}>{n}</button>)}
            </div>
          )}
        </div>

        {/* Panel de registro (modal en móvil) */}
        <div className={`gst-form-col${mobileFormOpen ? ' open' : ''}`} onClick={(ev) => { if (ev.target === ev.currentTarget) setMobileFormOpen(false) }}>
          <form className="gst-card" onSubmit={handleSubmit}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div><h3 className="gst-form-title">Registrar Nuevo Gasto</h3><p className="gst-form-sub">Carga egresos desde el teléfono o laptop</p></div>
              <button type="button" className="gst-close" onClick={() => setMobileFormOpen(false)}><X size={18} /></button>
            </div>

            <div className="gst-field"><label>Descripción del Gasto <span className="gst-req">*</span></label>
              <input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Ej: Compras de verduras y pollo" required /></div>

            <div className="gst-row2">
              <div className="gst-field"><label>Tipo de Gasto <span className="gst-req">*</span></label>
                <StyledSelect value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as 'fixed' | 'variable' })}><option value="variable">Gasto Variable</option><option value="fixed">Gasto Fijo</option></StyledSelect></div>
              <div className="gst-field"><label>Categoría <span className="gst-req">*</span></label>
                <StyledSelect value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>{CATEGORIES.map((c) => <option key={c.v} value={c.v}>{c.l}</option>)}</StyledSelect></div>
            </div>

            <div className="gst-field"><label>Establecimiento / Proveedor</label>
              <input list="gst-vendors" value={form.vendor} onChange={(e) => setForm({ ...form, vendor: e.target.value })} placeholder="Ej: Aradito" />
              <datalist id="gst-vendors">{vendors.map((v) => <option key={v} value={v} />)}</datalist>
            </div>

            <div className="gst-row2">
              <div className="gst-field"><label>Monto (USD) <span className="gst-req">*</span></label>
                <NumberStepper step={0.5} min={0} value={form.amountUsd} onChange={(v) => setForm({ ...form, amountUsd: v })} placeholder="0.00" /></div>
              <div className="gst-field"><label>Monto (Bs)</label>
                <input value={amountNum > 0 ? formatVes(amountNum * rate) : ''} readOnly placeholder="Bs. 0.00" style={{ color: '#a1a1aa' }} /></div>
            </div>
            <div className="gst-rate-hint">Tasa BCV: {formatVes(rate)} por $1</div>

            <div className="gst-row2">
              <div className="gst-field"><label>Método de Pago <span className="gst-req">*</span></label>
                <StyledSelect value={form.paymentMethod} onChange={(e) => setForm({ ...form, paymentMethod: e.target.value })}>{METHODS.map((m) => <option key={m.v} value={m.v}>{m.l}</option>)}</StyledSelect></div>
              <div className="gst-field"><label>N° de Referencia</label>
                <input value={form.reference} onChange={(e) => setForm({ ...form, reference: e.target.value })} placeholder="Ej: 8841023" /></div>
            </div>

            <div className="gst-field"><label>Notas (Opcional)</label>
              <textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Agregar notas adicionales..." /></div>

            <div className="gst-form-actions">
              <label className="gst-check"><input type="checkbox" checked={keepOpen} onChange={(e) => setKeepOpen(e.target.checked)} /> Registrar otro</label>
              <button type="submit" className="gst-btn" disabled={saving || !form.description.trim() || amountNum <= 0}>{saving ? '...' : <><Plus size={16} /> Registrar Gasto</>}</button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
