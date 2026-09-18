import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { createExpense, updateExpense, deleteExpense, getExpenses, getFinancialAccounts, type FinancialAccount } from '../lib/dataService'
import { useAuth } from '../context/auth-context'
import { StyledSelect } from '../components/StyledSelect'
import { getExchangeRates } from '../lib/rates'
import { formatUsd, formatVes, dateKeyInTimeZone } from '../lib/money'
import { normalizeForSearch } from '../lib/textFormat'
import {
  Receipt, Store, Plus, TrendingDown, Wallet, Activity,
  Search, Filter, Download, HelpCircle, X, Trash2, Pencil,
} from 'lucide-react'
import Toast from '../components/Toast'
import { EmptyState } from '../components/EmptyState'
import { confirmDialog } from '../components/ConfirmDialog'
import './Gastos.css'

type ExpenseType = 'fixed' | 'variable' | 'other'
type ExpenseSourceView = { accountId: string; amount: number; currency: 'USD' | 'VES'; reference: string | null }
type ExpenseView = { id: string; description: string; type: ExpenseType; category: string; vendor: string; amountUsd: number; date: string; paymentMethod: string; reference?: string; accountId: string | null; exchangeRate: number | null; extra: string; payments: ExpenseSourceView[] }
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
const emptyForm = { description: '', type: 'variable' as ExpenseType, category: 'supermarket', vendor: '', amountUsd: '', paymentMethod: 'pago_movil', accountId: '', reference: '', notes: '' }

export function Gastos() {
  const { user } = useAuth()
  const [expenses, setExpenses] = useState<ExpenseView[]>([])
  const [rate, setRate] = useState(40.56)
  const [accounts, setAccounts] = useState<FinancialAccount[]>([])
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')

  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<'todos' | ExpenseType>('todos')
  const [showFilters, setShowFilters] = useState(false)
  const [page, setPage] = useState(1)

  const [form, setForm] = useState(emptyForm)
  const [expenseSources, setExpenseSources] = useState<Array<{ accountId: string; amount: string; reference: string }>>([{ accountId: '', amount: '', reference: '' }])
  const [keepOpen, setKeepOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deletingExpenseId, setDeletingExpenseId] = useState<string | null>(null)
  const [editingExpenseId, setEditingExpenseId] = useState<string | null>(null)
  const [expenseModalOpen, setExpenseModalOpen] = useState(false)
  const [closingExpense, setClosingExpense] = useState(false)
  const descriptionInputRef = useRef<HTMLInputElement>(null)

  const openExpenseForm = () => {
    setEditingExpenseId(null)
    setForm(emptyForm)
    setExpenseSources([{ accountId: '', amount: '', reference: '' }])
    setClosingExpense(false)
    setExpenseModalOpen(true)
  }

  const openEditExpense = (e: ExpenseView) => {
    setEditingExpenseId(e.id)
    setForm({
      description: e.description, type: e.type, category: e.category, vendor: e.vendor === 'Sin proveedor' ? '' : e.vendor,
      amountUsd: '', paymentMethod: e.paymentMethod === 'other' ? 'pago_movil' : e.paymentMethod,
      accountId: e.accountId ?? '', reference: e.reference ?? '', notes: e.extra ?? '',
    })
    setExpenseSources(e.payments.length > 0
      ? e.payments.map((pp) => ({ accountId: pp.accountId, amount: String(pp.amount), reference: pp.reference ?? '' }))
      : [{ accountId: e.accountId ?? '', amount: e.amountUsd ? String(Math.round(e.amountUsd * 100) / 100) : '', reference: e.reference ?? '' }])
    setClosingExpense(false)
    setExpenseModalOpen(true)
  }

  const closeExpenseForm = useCallback(() => {
    if (saving || closingExpense) return
    setClosingExpense(true)
    window.setTimeout(() => {
      setExpenseModalOpen(false)
      setClosingExpense(false)
      setEditingExpenseId(null)
    }, 200)
  }, [closingExpense, saving])

  useEffect(() => {
    if (!expenseModalOpen) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const focusTimer = window.setTimeout(() => descriptionInputRef.current?.focus(), 50)
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeExpenseForm()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.clearTimeout(focusTimer)
      window.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = previousOverflow
    }
  }, [closeExpenseForm, expenseModalOpen])

  useEffect(() => {
    getExchangeRates().then((r) => { if (r.bcv > 0) setRate(r.bcv) }).catch(() => {})
    getFinancialAccounts().then(setAccounts).catch(() => setAccounts([]))
    getExpenses().then((data) => setExpenses(data.map((item) => {
      let meta: Record<string, string> = {}
      try { meta = item.notes ? JSON.parse(item.notes) as Record<string, string> : {} } catch { meta = {} }
      const type: ExpenseType = item.category === 'fixed' || item.category === 'variable' ? item.category : 'other'
      return { id: item.id, description: item.concept, type, category: meta.category || 'other', vendor: meta.vendor || 'Sin proveedor', amountUsd: item.amount, date: item.expenseDate, paymentMethod: meta.paymentMethod || 'other', reference: meta.reference || undefined, accountId: item.accountId, exchangeRate: item.exchangeRate, extra: meta.extra || '', payments: item.payments.map((pp) => ({ accountId: pp.accountId, amount: pp.amount, currency: pp.currency, reference: pp.reference })) }
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
    const other = thisMonth.filter((e) => e.type === 'other').reduce((s, e) => s + e.amountUsd, 0)
    const pct = prev > 0 ? ((total - prev) / prev) * 100 : null
    return { total, fixed, variable, other, pct, pctFixed: total > 0 ? (fixed / total) * 100 : 0, pctVar: total > 0 ? (variable / total) * 100 : 0, pctOther: total > 0 ? (other / total) * 100 : 0 }
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

  // Pago con varias cuentas: el total del gasto es la suma de las fuentes.
  const methodForExpenseAccount = (account: FinancialAccount | undefined): string => {
    if (!account) return 'pago_movil'
    if (account.accountType === 'pos') return 'punto'
    if (account.accountType === 'cash') return account.currency === 'VES' ? 'efectivo_bs' : 'efectivo_usd'
    return account.currency === 'VES' ? 'pago_movil' : 'transferencia'
  }
  const expenseSourceUsd = (row: { accountId: string; amount: string }) => {
    const acc = accounts.find((a) => a.id === row.accountId)
    const amt = parseFloat(row.amount) || 0
    if (!acc || amt <= 0) return 0
    return acc.currency === 'VES' ? (rate > 0 ? amt / rate : 0) : amt
  }
  const expenseTotalUsd = expenseSources.reduce((s, r) => s + expenseSourceUsd(r), 0)
  const expenseSourcesValid = expenseSources.length > 0 && expenseSources.every((r) => {
    const acc = accounts.find((a) => a.id === r.accountId)
    return !!acc && (parseFloat(r.amount) || 0) > 0
  })
  const updateExpenseSource = (i: number, patch: Partial<{ accountId: string; amount: string; reference: string }>) =>
    setExpenseSources((prev) => prev.map((row, idx) => idx === i ? { ...row, ...patch } : row))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user || !form.description.trim()) return
    if (!expenseSourcesValid || expenseTotalUsd <= 0) { setError('Completa las cuentas de pago (cuenta y monto).'); return }
    if (expenseSources.some((r) => accounts.find((a) => a.id === r.accountId)?.currency === 'VES') && rate <= 0) { setError('No hay una tasa BCV válida para pagos en bolívares'); return }
    setSaving(true); setError('')
    const firstSourceMethod = methodForExpenseAccount(accounts.find((a) => a.id === expenseSources[0]?.accountId))
    const firstRef = expenseSources[0]?.reference.trim() ?? ''
    const notesJson = JSON.stringify({ category: form.category, vendor: form.vendor.trim() || 'Sin proveedor', paymentMethod: firstSourceMethod, reference: firstRef, extra: form.notes.trim() })
    const payments = expenseSources.map((r) => {
      const acc = accounts.find((a) => a.id === r.accountId)!
      return { accountId: r.accountId, amount: parseFloat(r.amount) || 0, currency: acc.currency, exchangeRate: acc.currency === 'VES' ? rate : null, method: methodForExpenseAccount(acc), reference: r.reference.trim() || null }
    })
    const viewPayments = payments.map((p) => ({ accountId: p.accountId, amount: p.amount, currency: p.currency, reference: p.reference }))
    const totalUsd = Math.round(expenseTotalUsd * 100) / 100
    try {
      if (editingExpenseId) {
        await updateExpense(editingExpenseId, {
          concept: form.description.trim(), amount: totalUsd, category: form.type,
          expenseDate: dateKeyInTimeZone(), accountId: payments[0].accountId, exchangeRate: rate, notes: notesJson,
          payments,
        })
        setExpenses((prev) => prev.map((item) => item.id === editingExpenseId ? { ...item, description: form.description.trim(), type: form.type, category: form.category, vendor: form.vendor.trim() || 'Sin proveedor', amountUsd: totalUsd, paymentMethod: firstSourceMethod, reference: firstRef || undefined, accountId: payments[0].accountId, exchangeRate: rate, extra: form.notes.trim(), payments: viewPayments } : item))
        flash('Gasto actualizado')
        setEditingExpenseId(null); setForm(emptyForm)
        setClosingExpense(true)
        window.setTimeout(() => { setExpenseModalOpen(false); setClosingExpense(false) }, 200)
      } else {
        const saved = await createExpense({
          concept: form.description.trim(), amount: totalUsd, category: form.type,
          expenseDate: dateKeyInTimeZone(), userId: user.id,
          accountId: payments[0].accountId, exchangeRate: rate, notes: notesJson,
          payments,
        })
        setExpenses((prev) => [{ id: saved.id, description: form.description.trim(), type: form.type, category: form.category, vendor: form.vendor.trim() || 'Sin proveedor', amountUsd: totalUsd, date: saved.expenseDate, paymentMethod: firstSourceMethod, reference: firstRef || undefined, accountId: payments[0].accountId, exchangeRate: rate, extra: form.notes.trim(), payments: viewPayments }, ...prev])
        flash(`Gasto de ${formatUsd(totalUsd)} registrado`)
        if (keepOpen) { setForm({ ...emptyForm, type: form.type, category: form.category, vendor: form.vendor }); setExpenseSources([{ accountId: '', amount: '', reference: '' }]) }
        else {
          setForm(emptyForm)
          setClosingExpense(true)
          window.setTimeout(() => { setExpenseModalOpen(false); setClosingExpense(false) }, 200)
        }
      }
    } catch (e) { setError(e instanceof Error ? e.message : 'Error al registrar el gasto') }
    finally { setSaving(false) }
  }

  const handleDeleteExpense = async (expense: ExpenseView) => {
    const ok = await confirmDialog({
      title: 'Eliminar gasto',
      message: `¿Eliminar el gasto “${expense.description}” por ${formatUsd(expense.amountUsd)}?\n\nEsta acción actualizará el saldo de la cuenta y no se puede deshacer.`,
      confirmText: 'Eliminar gasto',
      danger: true,
    })
    if (!ok) return
    setDeletingExpenseId(expense.id); setError('')
    try {
      await deleteExpense(expense.id)
      setExpenses((prev) => prev.filter((item) => item.id !== expense.id))
      flash('Gasto eliminado y saldo actualizado')
      getFinancialAccounts().then(setAccounts).catch(() => {})
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo eliminar el gasto')
    } finally { setDeletingExpenseId(null) }
  }

  const exportCsv = () => {
    const rows = [['Fecha', 'Descripción', 'Tipo', 'Categoría', 'Proveedor', 'Monto USD', 'Monto Bs', 'Método', 'Ref']]
    filtered.forEach((e) => rows.push([e.date, e.description, e.type === 'fixed' ? 'Fijo' : e.type === 'variable' ? 'Variable' : 'Otro', catLabel(e.category), e.vendor, e.amountUsd.toFixed(2), (e.amountUsd * rate).toFixed(2), methodLabel(e.paymentMethod), e.reference ?? '']))
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n')
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }))
    const a = document.createElement('a'); a.href = url; a.download = `gastos_${dateKeyInTimeZone()}.csv`; a.click(); URL.revokeObjectURL(url)
  }

  return (
    <div className="page gst-page animate-fade-in management-workspace management-workspace--expenses">
      <header className="page-header management-workspace-header">
        <div>
          <h1 className="page-title"><Wallet size={22} className="page-title-icon" /> Gastos</h1>
          <p className="page-subtitle">Registra y controla todos los egresos operativos del negocio que no son compras de inventario.</p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="gst-help" onClick={() => flash('Registra egresos que no son inventario (nómina, delivery, comisiones, servicios…). Compras de insumos van en el módulo Compras.')}><HelpCircle size={15} /> ¿Cómo funciona?</button>
          <button type="button" className="gst-btn" aria-controls="expense-form" onClick={openExpenseForm}><Plus size={16} /> Registrar Gasto</button>
        </div>
      </header>

      {error && <Toast type="error" message={error} onClose={() => setError('')} />}
      {notice && <Toast type="success" message={notice} onClose={() => setNotice('')} />}

      {/* Resumen */}
      <div className="gst-summary management-workspace-metrics">
        <div className="gst-sum red">
          <span className="gst-sum-ic"><TrendingDown size={22} /></span>
          <div><div className="gst-sum-lbl">Egresos totales (este mes)</div><div className="gst-sum-val">{formatUsd(summary.total)}</div>
            {summary.pct != null && <div className={`gst-sum-sub ${summary.pct > 0 ? 'up' : 'down'}`}>{summary.pct > 0 ? '▲' : '▼'} {Math.abs(summary.pct).toFixed(0)}% vs. mes anterior</div>}
          </div>
        </div>
        <div className="gst-sum purple">
          <span className="gst-sum-ic"><Receipt size={22} /></span>
          <div><div className="gst-sum-lbl">Gastos Fijos (este mes)</div><div className="gst-sum-val">{formatUsd(summary.fixed)}</div><div className="gst-sum-sub">{summary.pctFixed.toFixed(0)}% del total</div></div>
        </div>
        <div className="gst-sum orange">
          <span className="gst-sum-ic"><Activity size={22} /></span>
          <div><div className="gst-sum-lbl">Gastos Variables (este mes)</div><div className="gst-sum-val">{formatUsd(summary.variable)}</div><div className="gst-sum-sub">{summary.pctVar.toFixed(0)}% del total</div></div>
        </div>
        <div className="gst-sum green">
          <span className="gst-sum-ic"><Store size={22} /></span>
          <div><div className="gst-sum-lbl">Otros gastos (este mes)</div><div className="gst-sum-val">{formatUsd(summary.other)}</div><div className="gst-sum-sub">{summary.pctOther.toFixed(0)}% del total</div></div>
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
            <div className="gst-filter-row">
              {(['todos', 'fixed', 'variable', 'other'] as const).map((t) => (
                <button key={t} className="gst-tool" style={typeFilter === t ? { background: '#e11d2a', borderColor: '#e11d2a', color: '#fff' } : undefined} onClick={() => setTypeFilter(t)}>
                  {t === 'todos' ? 'Todos' : t === 'fixed' ? 'Fijos' : t === 'variable' ? 'Variables' : 'Otros'}
                </button>
              ))}
            </div>
          )}

          <div className="gst-table-wrap">
            <table className="gst-table">
              <thead><tr><th>Fecha</th><th>Descripción</th><th>Tipo</th><th>Categoría</th><th>Proveedor</th><th>Monto (USD)</th><th>Monto (Bs)</th><th>Acción</th></tr></thead>
              <tbody>
                {pageItems.map((e) => (
                  <tr key={e.id}>
                    <td style={{ color: '#a1a1aa', fontSize: 12 }}>{new Date(e.date).toLocaleDateString('es-VE')}</td>
                    <td style={{ fontWeight: 600 }}>{e.description}</td>
                    <td><span className={`gst-badge ${e.type === 'fixed' ? 'fijo' : e.type === 'variable' ? 'variable' : 'otro'}`}>{e.type === 'fixed' ? 'Fijo' : e.type === 'variable' ? 'Variable' : 'Otro'}</span></td>
                    <td><span className="gst-cat">{catLabel(e.category)}</span></td>
                    <td>{e.vendor}</td>
                    <td className="gst-usd">{formatUsd(e.amountUsd)}</td>
                    <td className="gst-bs">{formatVes(e.amountUsd * rate)}</td>
                    <td><div className="gst-row-actions"><button type="button" className="gst-icon-btn" title="Editar gasto" aria-label={`Editar gasto ${e.description}`} onClick={() => openEditExpense(e)}><Pencil size={15} /></button><button type="button" className="gst-icon-btn gst-icon-danger" title="Eliminar gasto" aria-label={`Eliminar gasto ${e.description}`} onClick={() => void handleDeleteExpense(e)} disabled={deletingExpenseId === e.id}>{deletingExpenseId === e.id ? <span className="gst-spinner" /> : <Trash2 size={15} />}</button></div></td>
                  </tr>
                ))}
                {pageItems.length === 0 && (
                  <tr><td colSpan={8}>
                    <EmptyState
                      compact
                      title="No hay gastos registrados"
                      description="Registra tu primer gasto para llevar el control de tus finanzas."
                      actionLabel="Registrar gasto"
                      onAction={openExpenseForm}
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

      </div>

      {expenseModalOpen && createPortal(
        <div className={`gst-form-col open ${closingExpense ? 'closing' : ''}`} role="presentation" onMouseDown={(ev) => { if (ev.target === ev.currentTarget) closeExpenseForm() }}>
          <form id="expense-form" className="gst-card gst-expense-modal" role="dialog" aria-modal="true" aria-labelledby="expense-modal-title" onSubmit={handleSubmit}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div><h3 id="expense-modal-title" className="gst-form-title">{editingExpenseId ? 'Editar Gasto' : 'Registrar Nuevo Gasto'}</h3><p className="gst-form-sub">Carga egresos desde el teléfono o laptop</p></div>
              <button type="button" className="gst-close" aria-label="Cerrar" onClick={closeExpenseForm}><X size={18} /></button>
            </div>

            <div className="gst-field"><label>Descripción del Gasto <span className="gst-req">*</span></label>
              <input ref={descriptionInputRef} aria-label="Descripción del gasto" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Ej: Compras de verduras y pollo" required /></div>

            <div className="gst-row2">
              <div className="gst-field"><label>Tipo de Gasto <span className="gst-req">*</span></label>
                <StyledSelect value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as ExpenseType })}><option value="variable">Gasto Variable</option><option value="fixed">Gasto Fijo</option><option value="other">Otro</option></StyledSelect></div>
              <div className="gst-field"><label>Categoría <span className="gst-req">*</span></label>
                <StyledSelect value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>{CATEGORIES.map((c) => <option key={c.v} value={c.v}>{c.l}</option>)}</StyledSelect></div>
            </div>

            <div className="gst-field"><label>Establecimiento / Proveedor</label>
              <input list="gst-vendors" value={form.vendor} onChange={(e) => setForm({ ...form, vendor: e.target.value })} placeholder="Ej: Aradito" />
              <datalist id="gst-vendors">{vendors.map((v) => <option key={v} value={v} />)}</datalist>
            </div>

            <label className="gst-field"><span className="gst-field-label-txt">Pago <span className="gst-req">*</span> <small style={{ color: '#71717a', fontWeight: 400 }}>· puedes usar varias cuentas</small></span></label>
            <div className="gst-src-block">
              {expenseSources.map((row, i) => {
                const acc = accounts.find((a) => a.id === row.accountId)
                const isVes = acc?.currency === 'VES'
                const amt = parseFloat(row.amount) || 0
                const insufficient = acc ? amt > (acc.currentBalance ?? 0) : false
                return <div className="gst-src-row" key={i}>
                  <div className="gst-src-grid">
                    <div className="gst-field"><label>Cuenta {expenseSources.length > 1 ? `#${i + 1}` : ''}</label><StyledSelect value={row.accountId} onChange={(e) => updateExpenseSource(i, { accountId: e.target.value })}><option value="">Selecciona una cuenta</option>{accounts.map((a) => <option key={a.id} value={a.id}>{a.name} · {a.currency}</option>)}</StyledSelect></div>
                    <div className="gst-field"><label>Monto {acc ? (isVes ? '(Bs)' : '(USD)') : ''}</label><input type="number" inputMode="decimal" min="0" step="any" value={row.amount} onChange={(e) => updateExpenseSource(i, { amount: e.target.value })} placeholder="0,00" /></div>
                    <div className="gst-field"><label>Referencia</label><input value={row.reference} onChange={(e) => updateExpenseSource(i, { reference: e.target.value })} placeholder="N° operación" /></div>
                  </div>
                  <div className="gst-src-meta">
                    {acc && <span className={insufficient ? 'gst-src-warn' : ''}>Disponible: {isVes ? formatVes(acc.currentBalance) : formatUsd(acc.currentBalance)}{amt > 0 ? ` · ${formatUsd(expenseSourceUsd(row))}` : ''}</span>}
                    <span className="gst-src-actions"><button type="button" className="gst-src-remove" onClick={() => setExpenseSources((prev) => prev.length > 1 ? prev.filter((_, idx) => idx !== i) : prev)} style={{ visibility: expenseSources.length > 1 ? 'visible' : 'hidden' }}>Quitar</button></span>
                  </div>
                </div>
              })}
              <div className="gst-src-foot">
                <button type="button" className="gst-src-add" onClick={() => setExpenseSources((prev) => [...prev, { accountId: '', amount: '', reference: '' }])}><Plus size={14} /> Agregar cuenta</button>
                <span className="gst-src-total">Total: <strong>{formatUsd(Math.round(expenseTotalUsd * 100) / 100)}</strong></span>
              </div>
            </div>

            <div className="gst-field"><label>Notas (Opcional)</label>
              <textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Agregar notas adicionales..." /></div>

            <div className="gst-form-actions">
              {!editingExpenseId && <label className="gst-check"><input type="checkbox" checked={keepOpen} onChange={(e) => setKeepOpen(e.target.checked)} /> Registrar otro</label>}
              <button type="submit" className="gst-btn" disabled={saving || !form.description.trim() || !expenseSourcesValid || expenseTotalUsd <= 0}>{saving ? '...' : <><Plus size={16} /> {editingExpenseId ? 'Guardar cambios' : 'Registrar Gasto'}</>}</button>
            </div>
          </form>
        </div>,
        document.body,
      )}
    </div>
  )
}
