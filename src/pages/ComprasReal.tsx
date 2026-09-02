import { useEffect, useMemo, useState, useCallback } from 'react'
import { createPortal } from 'react-dom'
import {
  getSuppliers, createSupplier, getPurchases, createPurchase, setPurchasePaid,
  getIngredients, getUnits, createIngredient, getFinancialAccounts,
  type Supplier, type Purchase, type Ingredient, type FinancialAccount,
} from '../lib/dataService'
import { SearchSelect } from '../components/SearchSelect'
import { PageSkeleton } from '../components/PageSkeleton'
import { StyledSelect } from '../components/StyledSelect'
import NumberStepper from '../components/NumberStepper'
import { useAuth } from '../context/auth-context'
import { useRates } from '../context/rates-context'
import { formatUsd, formatVes, dateKeyInTimeZone } from '../lib/money'
import { normalizeForSearch } from '../lib/textFormat'
import {
  ShoppingBag, Plus, Trash2, CheckCircle2, AlertTriangle, Loader2, ShoppingCart,
  ClipboardList, Package, CalendarClock, Search, Download, Eye, X,
} from 'lucide-react'
import Toast from '../components/Toast'
import { EmptyState } from '../components/EmptyState'
import './ComprasReal.css'

interface ItemForm { ingredientId: string; quantity: string; unitId: string; unitCost: string }
const PAGE_SIZE = 8
type PaidFilter = 'todos' | 'pagados' | 'pendientes'
const PAYMENT_METHODS = [
  { value: 'pago_movil', label: 'Pago móvil' }, { value: 'transferencia', label: 'Transferencia' },
  { value: 'punto', label: 'Punto de venta' }, { value: 'efectivo_bs', label: 'Efectivo Bs' },
  { value: 'efectivo_usd', label: 'Efectivo USD' }, { value: 'binance', label: 'Binance' },
  { value: 'zelle', label: 'Zelle' }, { value: 'other', label: 'Otro' },
]
const paymentMethodLabel = (value: string | null) => PAYMENT_METHODS.find(method => method.value === value)?.label ?? 'Sin registrar'

export function ComprasReal() {
  const { user } = useAuth()
  const { bcvRate } = useRates()
  const effectiveBcvRate = bcvRate ?? 0
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [purchases, setPurchases] = useState<Purchase[]>([])
  const [ingredients, setIngredients] = useState<Ingredient[]>([])
  const [units, setUnits] = useState<Array<{ id: string; name: string; symbol: string }>>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const [showForm, setShowForm] = useState(false)
  const [supplierId, setSupplierId] = useState('')
  const [purchaseDate, setPurchaseDate] = useState(dateKeyInTimeZone())
  const [invoiceNumber, setInvoiceNumber] = useState('')
  const [notes, setNotes] = useState('')
  const [markPaid, setMarkPaid] = useState(true)
  const [accountId, setAccountId] = useState('')
  const [paymentMethod, setPaymentMethod] = useState('pago_movil')
  const [paymentReference, setPaymentReference] = useState('')
  const [accounts, setAccounts] = useState<FinancialAccount[]>([])
  const [items, setItems] = useState<ItemForm[]>([])
  const [saving, setSaving] = useState(false)
  const selectedAccount = accounts.find(account => account.id === accountId) ?? null

  const [showSupplierForm, setShowSupplierForm] = useState(false)
  const [newSupplierName, setNewSupplierName] = useState('')
  const [newSupplierPhone, setNewSupplierPhone] = useState('')

  const [showIngredientForm, setShowIngredientForm] = useState(false)
  const [newIngredientName, setNewIngredientName] = useState('')
  const [newIngredientUnitId, setNewIngredientUnitId] = useState('')

  const [search, setSearch] = useState('')
  const [paidFilter, setPaidFilter] = useState<PaidFilter>('todos')
  const [page, setPage] = useState(1)
  const [detail, setDetail] = useState<Purchase | null>(null)
  const [closingDetail, setClosingDetail] = useState(false)
  const closeDetail = () => {
    if (closingDetail) return
    setClosingDetail(true)
    window.setTimeout(() => {
      setDetail(null)
      setClosingDetail(false)
    }, 200)
  }

  const load = useCallback(async () => {
    try {
      setLoading(true); setError('')
      const [sup, purch, ingr, un, accts] = await Promise.all([
        getSuppliers(), getPurchases().catch(() => []), getIngredients(), getUnits(), getFinancialAccounts().catch(() => []),
      ])
      setSuppliers(sup); setPurchases(purch); setIngredients(ingr); setUnits(un); setAccounts(accts)
    } catch (e) { setError(e instanceof Error ? e.message : 'Error cargando datos') }
    finally { setLoading(false) }
  }, [])
  useEffect(() => { void load() }, [load])

  const closePurchaseForm = useCallback(() => {
    if (!saving) setShowForm(false)
  }, [saving])

  useEffect(() => {
    if (!showForm) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') closePurchaseForm() }
    window.addEventListener('keydown', onKeyDown)
    return () => { document.body.style.overflow = previousOverflow; window.removeEventListener('keydown', onKeyDown) }
  }, [closePurchaseForm, showForm])

  const flash = (m: string) => { setNotice(m); setTimeout(() => setNotice(''), 3500) }

  // Resumen del mes
  const summary = useMemo(() => {
    const now = new Date()
    const inMonth = (d: string, offset = 0) => {
      const dt = new Date(d)
      return dt.getFullYear() === now.getFullYear() && dt.getMonth() === now.getMonth() - offset
    }
    const thisMonth = purchases.filter((p) => inMonth(p.purchaseDate))
    const prevMonth = purchases.filter((p) => inMonth(p.purchaseDate, 1))
    const totalThis = thisMonth.reduce((s, p) => s + p.totalAmount, 0)
    const totalPrev = prevMonth.reduce((s, p) => s + p.totalAmount, 0)
    const pct = totalPrev > 0 ? ((totalThis - totalPrev) / totalPrev) * 100 : null
    const itemsThis = thisMonth.reduce((s, p) => s + p.items.length, 0)
    return { totalThis, count: thisMonth.length, itemsThis, pct, last: purchases[0] ?? null }
  }, [purchases])

  const filtered = useMemo(() => {
    const q = normalizeForSearch(search)
    return purchases.filter((p) => {
      if (q && !(normalizeForSearch(p.supplierName).includes(q) || normalizeForSearch(p.invoiceNumber ?? '').includes(q))) return false
      if (paidFilter === 'pagados' && !p.isPaid) return false
      if (paidFilter === 'pendientes' && p.isPaid) return false
      return true
    })
  }, [purchases, search, paidFilter])
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const safePage = Math.min(page, totalPages)
  const pageItems = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)
  useEffect(() => { setPage(1) }, [search, paidFilter])

  const totalForm = items.reduce((s, it) => s + (parseFloat(it.quantity) || 0) * (parseFloat(it.unitCost) || 0), 0)

  const addItem = () => setItems([...items, { ingredientId: ingredients[0]?.id ?? '', quantity: '1', unitId: ingredients[0]?.unitId ?? units[0]?.id ?? '', unitCost: '0' }])
  const removeItem = (i: number) => setItems(items.filter((_, x) => x !== i))
  const changeItem = (i: number, f: keyof ItemForm, v: string) => setItems(items.map((it, x) => {
    if (x !== i) return it
    const up = { ...it, [f]: v }
    if (f === 'ingredientId') { const ing = ingredients.find((y) => y.id === v); if (ing) up.unitId = ing.unitId }
    return up
  }))

  const resetForm = () => { setSupplierId(''); setInvoiceNumber(''); setNotes(''); setItems([]); setMarkPaid(true); setAccountId(''); setPaymentMethod('pago_movil'); setPaymentReference(''); setPurchaseDate(dateKeyInTimeZone()) }

  const openPurchaseForm = () => {
    resetForm()
    setItems([{ ingredientId: ingredients[0]?.id ?? '', quantity: '1', unitId: ingredients[0]?.unitId ?? units[0]?.id ?? '', unitCost: '0' }])
    setShowForm(true)
  }

  const changePaymentAccount = (nextAccountId: string) => {
    setAccountId(nextAccountId)
    const account = accounts.find(item => item.id === nextAccountId)
    if (!account) return
    if (account.accountType === 'pos') setPaymentMethod('punto')
    else if (account.name.toLowerCase().includes('binance')) setPaymentMethod('binance')
    else if (account.accountType === 'cash') setPaymentMethod(account.currency === 'VES' ? 'efectivo_bs' : 'efectivo_usd')
    else if (account.currency === 'VES') setPaymentMethod('pago_movil')
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!supplierId || items.length === 0) return
    if (markPaid && !accountId) { setError('Selecciona la cuenta desde donde se pagó la compra'); return }
    if (markPaid && selectedAccount?.currency === 'VES' && effectiveBcvRate <= 0) { setError('No hay una tasa BCV válida para registrar el pago en bolívares'); return }
    setSaving(true); setError('')
    try {
      await createPurchase({
        supplierId, purchaseDate, invoiceNumber: invoiceNumber.trim() || undefined,
        notes: notes.trim() || undefined, userId: user?.id ?? '', isPaid: markPaid,
        accountId: markPaid ? accountId : null, exchangeRate: markPaid ? effectiveBcvRate : null,
        paymentCurrency: markPaid ? selectedAccount?.currency ?? null : null,
        paymentMethod: markPaid ? paymentMethod : null,
        paymentReference: markPaid ? paymentReference.trim() || null : null,
        items: items.map((it) => ({ ingredientId: it.ingredientId, quantity: parseFloat(it.quantity) || 0, unitId: it.unitId, unitCost: parseFloat(it.unitCost) || 0 })),
      })
      flash('Compra registrada · inventario actualizado')
      setShowForm(false); resetForm(); await load()
    } catch (e) { setError(e instanceof Error ? e.message : 'Error guardando compra') }
    finally { setSaving(false) }
  }

  const handleCreateSupplier = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newSupplierName.trim()) return
    try {
      const id = await createSupplier({ name: newSupplierName.trim(), phone: newSupplierPhone.trim() || undefined })
      setSuppliers((prev) => [...prev, { id, name: newSupplierName.trim(), contact: null, phone: newSupplierPhone.trim() || null, email: null, notes: null, isActive: true }])
      setSupplierId(id); setShowSupplierForm(false); setNewSupplierName(''); setNewSupplierPhone('')
    } catch (e) { setError(e instanceof Error ? e.message : 'Error creando proveedor') }
  }

  const handleCreateIngredient = async (e: React.FormEvent) => {
    e.preventDefault()
    const unitId = newIngredientUnitId || units[0]?.id
    if (!newIngredientName.trim() || !unitId) return
    try {
      const id = await createIngredient({ name: newIngredientName.trim(), unitId })
      const unit = units.find((u) => u.id === unitId)
      const ing: Ingredient = { id, name: newIngredientName.trim(), unitId, unitName: unit?.name ?? '', unitSymbol: unit?.symbol ?? '', isActive: true, currentStock: 0, pricePerUnit: null, stockValue: null, inventoryClass: 'raw_material' }
      setIngredients((prev) => [...prev, ing].sort((a, b) => a.name.localeCompare(b.name)))
      setItems((prev) => [...prev, { ingredientId: id, quantity: '1', unitId, unitCost: '0' }])
      setShowIngredientForm(false); setNewIngredientName(''); setNewIngredientUnitId('')
      flash(`Ingrediente "${ing.name}" creado y agregado a la compra`)
    } catch (e) { setError(e instanceof Error ? e.message : 'Error creando ingrediente') }
  }

  const togglePaid = async (p: Purchase) => {
    try { await setPurchasePaid(p.id, !p.isPaid); await load() }
    catch (e) { setError(e instanceof Error ? e.message : 'Error actualizando estado') }
  }

  const exportCsv = () => {
    const rows = [['Fecha', 'Proveedor', 'Factura', 'Items', 'Total USD', 'Total Bs', 'Tasa BCV', 'Método', 'Cuenta', 'Referencia', 'Pagado']]
    filtered.forEach((p) => rows.push([
      p.purchaseDate, p.supplierName, p.invoiceNumber ?? '', String(p.items.length), p.totalAmount.toFixed(2),
      p.paymentCurrency === 'VES' && p.exchangeRate ? (p.totalAmount * p.exchangeRate).toFixed(2) : '',
      p.paymentCurrency === 'VES' && p.exchangeRate ? p.exchangeRate.toFixed(2) : '',
      paymentMethodLabel(p.paymentMethod), p.accountName ?? '', p.paymentReference ?? '', p.isPaid ? 'Si' : 'No',
    ]))
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n')
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }))
    const a = document.createElement('a'); a.href = url; a.download = `compras_${dateKeyInTimeZone()}.csv`; a.click(); URL.revokeObjectURL(url)
  }

  if (loading) return <PageSkeleton cards={3} rows={5} />

  return (
    <div className="page cmp-page animate-fade-in management-workspace management-workspace--purchases">
      <header className="page-header management-workspace-header">
        <div>
          <h1 className="page-title"><ShoppingCart size={22} className="page-title-icon" /> Compras e Insumos</h1>
          <p className="page-subtitle">Registra tus compras a proveedores. El inventario se actualiza automáticamente.</p>
        </div>
        <button className="cmp-new-btn" onClick={openPurchaseForm}>
          <Plus size={16} /> Nueva Compra
        </button>
      </header>

      {error && <Toast type="error" message={error} onClose={() => setError('')} />}
      {notice && <Toast type="success" message={notice} onClose={() => setNotice('')} />}

      {/* Resumen */}
      <div className="cmp-summary management-workspace-metrics">
        <div className="cmp-sum red">
          <span className="cmp-sum-ic"><ShoppingBag size={20} /></span>
          <div><div className="cmp-sum-lbl">Total compras (este mes)</div><div className="cmp-sum-val">{formatUsd(summary.totalThis)}</div>
            {summary.pct != null && <div className={`cmp-sum-sub ${summary.pct >= 0 ? 'up' : 'down'}`}>{summary.pct >= 0 ? '▲' : '▼'} {Math.abs(summary.pct).toFixed(0)}% vs. mes anterior</div>}
          </div>
        </div>
        <div className="cmp-sum purple">
          <span className="cmp-sum-ic"><ClipboardList size={20} /></span>
          <div><div className="cmp-sum-lbl">Compras realizadas</div><div className="cmp-sum-val">{summary.count}</div><div className="cmp-sum-sub">Este mes</div></div>
        </div>
        <div className="cmp-sum green">
          <span className="cmp-sum-ic"><Package size={20} /></span>
          <div><div className="cmp-sum-lbl">Total ítems comprados</div><div className="cmp-sum-val">{summary.itemsThis}</div><div className="cmp-sum-sub">Este mes</div></div>
        </div>
        <div className="cmp-sum orange">
          <span className="cmp-sum-ic"><CalendarClock size={20} /></span>
          <div><div className="cmp-sum-lbl">Última compra</div>
            <div className="cmp-sum-val" style={{ fontSize: 16 }}>{summary.last ? new Date(summary.last.purchaseDate).toLocaleDateString('es-VE', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}</div>
            <div className="cmp-sum-sub">{summary.last ? `Proveedor: ${summary.last.supplierName}` : 'Sin compras'}</div>
          </div>
        </div>
      </div>

      {/* Nueva compra */}
      {showForm && createPortal(
        <div className="cmp-modal-overlay cmp-purchase-overlay" onMouseDown={(event) => { if (event.target === event.currentTarget) closePurchaseForm() }}>
        <div className="cmp-card cmp-purchase-modal" role="dialog" aria-modal="true" aria-labelledby="new-purchase-title">
          <div className="cmp-purchase-header"><h3 id="new-purchase-title" className="cmp-card-title"><ShoppingBag size={18} style={{ color: '#e11d2a' }} /> Nueva Compra</h3><button type="button" className="cmp-icon-btn" aria-label="Cerrar" onClick={closePurchaseForm}><X size={20} /></button></div>
          <form onSubmit={handleSubmit}>
            <div className="cmp-form-grid">
              <div className="cmp-field"><label>Proveedor *</label>
                <div className="cmp-prov-row">
                  <SearchSelect options={suppliers.map((s) => ({ value: s.id, label: s.name }))} value={supplierId} onChange={setSupplierId} placeholder="Buscar proveedor..." emptyText="Sin proveedores" />
                  <button type="button" className="cmp-ghost-btn" onClick={() => setShowSupplierForm(!showSupplierForm)}><Plus size={14} /> Nuevo Proveedor</button>
                </div>
              </div>
              <div className="cmp-field"><label>Fecha *</label><input type="date" value={purchaseDate} onChange={(e) => setPurchaseDate(e.target.value)} /></div>
              <div className="cmp-field"><label>N° de Factura</label><input value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)} placeholder="Ej: 0001-12345" /></div>
              <div className="cmp-field"><label>Notas (opcional)</label><input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Ej: Entrega rápida" /></div>
            </div>

            {showSupplierForm && (
              <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, padding: 12, marginBottom: 16 }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <input placeholder="Nombre del proveedor *" value={newSupplierName} onChange={(e) => setNewSupplierName(e.target.value)} style={{ flex: 2, background: '#17171d', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 9, color: '#fff', padding: 9 }} />
                  <input placeholder="Teléfono" value={newSupplierPhone} onChange={(e) => setNewSupplierPhone(e.target.value)} style={{ flex: 1, background: '#17171d', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 9, color: '#fff', padding: 9 }} />
                  <button type="button" className="cmp-new-btn" onClick={handleCreateSupplier}>Crear</button>
                </div>
              </div>
            )}

            <div className="cmp-items-head">
              <span>Ingrediente</span><span>Cantidad</span><span>Unidad</span><span>Costo unitario</span><span style={{ textAlign: 'right' }}>Subtotal</span><span></span>
            </div>
            {items.map((it, i) => {
              const sub = (parseFloat(it.quantity) || 0) * (parseFloat(it.unitCost) || 0)
              return (
                <div className="cmp-item-row" key={i}>
                  <SearchSelect options={ingredients.map((x) => ({ value: x.id, label: `${x.name} (${x.unitSymbol})` }))} value={it.ingredientId} onChange={(v) => changeItem(i, 'ingredientId', v)} placeholder="Buscar ingrediente..." emptyText="Sin ingredientes" />
                  <NumberStepper step={0.01} min={0} value={it.quantity} onChange={(v) => changeItem(i, 'quantity', v)} />
                  <StyledSelect value={it.unitId} onChange={(e) => changeItem(i, 'unitId', e.target.value)}>{units.map((u) => <option key={u.id} value={u.id}>{u.symbol}</option>)}</StyledSelect>
                  <NumberStepper prefix="$" step={0.01} min={0} value={it.unitCost} onChange={(v) => changeItem(i, 'unitCost', v)} />
                  <span className="cmp-subtotal" style={{ textAlign: 'right' }}>{formatUsd(sub)}</span>
                  <button type="button" className="cmp-del" onClick={() => removeItem(i)}><Trash2 size={16} /></button>
                </div>
              )
            })}
            {items.length === 0 && <p style={{ color: '#71717a', fontSize: 13 }}>Agrega ítems a la compra.</p>}
            <div style={{ display: 'flex', gap: 8, marginTop: 4, flexWrap: 'wrap' }}>
              <button type="button" className="cmp-add-item" onClick={addItem}><Plus size={14} /> Agregar ítem</button>
              <button type="button" className="cmp-ghost-btn" style={{ padding: '8px 14px' }} onClick={() => setShowIngredientForm(!showIngredientForm)}><Plus size={14} /> Nuevo Ingrediente</button>
            </div>

            {showIngredientForm && (
              <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, padding: 12, marginTop: 10 }}>
                <div style={{ fontSize: 12, color: '#a1a1aa', marginBottom: 8 }}>Crear un ingrediente nuevo (elige su <strong>unidad base</strong>: cómo lo mides en inventario).</div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  <input placeholder="Nombre del ingrediente *" value={newIngredientName} onChange={(e) => setNewIngredientName(e.target.value)} style={{ flex: 2, minWidth: 180, borderRadius: 9, padding: 9 }} />
                  <StyledSelect value={newIngredientUnitId || units[0]?.id || ''} onChange={(e) => setNewIngredientUnitId(e.target.value)} style={{ flex: 1, minWidth: 170 }}>
                    {units.map((u) => <option key={u.id} value={u.id}>{u.name} ({u.symbol})</option>)}
                  </StyledSelect>
                  <button type="button" className="cmp-new-btn" onClick={handleCreateIngredient}>Crear ingrediente</button>
                </div>
              </div>
            )}

            <label className="cmp-field" style={{ display: 'flex', alignItems: 'center', gap: 9, marginTop: 14, fontSize: 13, color: '#d4d4d8', cursor: 'pointer' }}>
              <input type="checkbox" checked={markPaid} onChange={(e) => setMarkPaid(e.target.checked)} style={{ width: 18, height: 18, accentColor: '#e11d2a' }} /> Marcar como pagada
            </label>
            {markPaid && <div className="cmp-payment-grid">
              <div className="cmp-field"><label>Cuenta de salida *</label><StyledSelect value={accountId} onChange={(e) => changePaymentAccount(e.target.value)}><option value="">Selecciona una cuenta</option>{accounts.map((a) => <option key={a.id} value={a.id}>{a.name} · {a.currency}</option>)}</StyledSelect></div>
              <div className="cmp-field"><label>Método de pago *</label><StyledSelect value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}>{PAYMENT_METHODS.map(method => <option key={method.value} value={method.value}>{method.label}</option>)}</StyledSelect></div>
              <div className="cmp-field"><label>Referencia</label><input value={paymentReference} onChange={(e) => setPaymentReference(e.target.value)} placeholder="N° de operación (opcional)" /></div>
            </div>}

            <div className="cmp-form-foot">
              <span style={{ color: '#a1a1aa', fontSize: 13 }}>Total de ítems: <strong style={{ color: '#fff' }}>{items.length}</strong></span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
                <div className="cmp-total"><div className="lbl">Total a pagar</div><div className="val">{selectedAccount?.currency === 'VES' ? formatVes(totalForm * effectiveBcvRate) : formatUsd(totalForm)}</div>{selectedAccount?.currency === 'VES' && <div className="cmp-payment-ref">Ref. {formatUsd(totalForm)} · BCV {formatVes(effectiveBcvRate)}</div>}</div>
                <div className="cmp-actions">
                  <button type="button" className="cmp-cancel" onClick={() => { closePurchaseForm(); resetForm() }}>Cancelar</button>
                  <button type="submit" className="cmp-new-btn" disabled={saving || !supplierId || items.length === 0}>{saving ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />} Guardar Compra</button>
                </div>
              </div>
            </div>
          </form>
        </div></div>, document.body
      )}

      {/* Historial */}
      <div className="cmp-card management-workspace-panel">
        <h3 className="cmp-card-title">Historial de Compras</h3>
        <div className="cmp-hist-tools">
          <div className="cmp-search"><Search size={15} className="ic" /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar compra..." />{search && <button type="button" className="search-clear-btn search-clear-btn--floating" onClick={() => setSearch('')} aria-label="Borrar búsqueda"><X size={13} /></button>}</div>
          <StyledSelect className="cmp-tool" value={paidFilter} onChange={(e) => setPaidFilter(e.target.value as PaidFilter)}>
            <option value="todos">Todas</option><option value="pagados">Pagadas</option><option value="pendientes">Por pagar</option>
          </StyledSelect>
          <button className="cmp-tool" onClick={exportCsv}><Download size={15} /> Exportar</button>
        </div>

        <div className="cmp-table-wrap">
          <table className="cmp-table">
            <thead><tr><th>Fecha</th><th>Proveedor</th><th>N° Factura</th><th># Ítems</th><th>Monto pagado</th><th>Método / Cuenta</th><th>Estado</th><th>Acción</th></tr></thead>
            <tbody>
              {pageItems.map((p) => (
                <tr key={p.id}>
                  <td>{new Date(p.purchaseDate).toLocaleDateString('es-VE')}</td>
                  <td><strong>{p.supplierName || '—'}</strong></td>
                  <td style={{ color: '#a1a1aa' }}>{p.invoiceNumber || '—'}</td>
                  <td>{p.items.length}</td>
                  <td>
                    {p.isPaid ? <div className="cmp-paid-amount"><strong>{p.paymentCurrency === 'VES' && p.exchangeRate ? formatVes(p.totalAmount * p.exchangeRate) : formatUsd(p.totalAmount)}</strong>{p.paymentCurrency === 'VES' && p.exchangeRate && <small>Ref. {formatUsd(p.totalAmount)} · BCV {formatVes(p.exchangeRate)}</small>}</div> : <span>—</span>}
                  </td>
                  <td><div className="cmp-payment-info"><strong>{p.isPaid ? paymentMethodLabel(p.paymentMethod) : 'Pendiente'}</strong><small>{p.accountName ?? (p.isPaid ? 'Cuenta sin registrar' : 'Sin pago')}</small>{p.paymentReference && <small>Ref. {p.paymentReference}</small>}</div></td>
                  <td><span className={`cmp-badge ${p.isPaid ? 'ok' : 'warn'}`} title="Clic para cambiar" onClick={() => togglePaid(p)}>{p.isPaid ? <><CheckCircle2 size={12} /> Pagado</> : <><AlertTriangle size={12} /> Por pagar</>}</span></td>
                  <td><button className="cmp-icon-btn" onClick={() => setDetail(p)} title="Ver detalle"><Eye size={16} /></button></td>
                </tr>
              ))}
              {pageItems.length === 0 && (
                <tr><td colSpan={8}>
                  <EmptyState
                    compact
                    title="No hay compras registradas"
                    description="Registra tu primera compra para llevar el control de insumos."
                    actionLabel="Nueva compra"
                    onAction={openPurchaseForm}
                  />
                </td></tr>
              )}
            </tbody>
          </table>
        </div>

        {filtered.length > 0 && (
          <div className="cmp-pagination">
            <span className="cnt">Mostrando {pageItems.length} de {filtered.length} compras</span>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((n) => <button key={n} className={n === safePage ? 'active' : ''} onClick={() => setPage(n)}>{n}</button>)}
          </div>
        )}
      </div>

      {/* Detalle */}
      {detail && createPortal(
        <div className={`cmp-modal-overlay ${closingDetail ? 'closing' : ''}`} onClick={() => closeDetail()}>
          <div className="cmp-modal" onClick={(e) => e.stopPropagation()}>
            <div className="cmp-modal-header">
              <h3>Compra · {detail.supplierName}</h3>
              <button className="cmp-icon-btn" onClick={() => closeDetail()}><X size={18} /></button>
            </div>
            <div className="cmp-detail-row"><span className="k">Fecha</span><span>{new Date(detail.purchaseDate).toLocaleDateString('es-VE')}</span></div>
            <div className="cmp-detail-row"><span className="k">Factura</span><span>{detail.invoiceNumber || '—'}</span></div>
            <div className="cmp-detail-row"><span className="k">Método / cuenta</span><span>{detail.isPaid ? `${paymentMethodLabel(detail.paymentMethod)} · ${detail.accountName ?? 'Sin registrar'}` : 'Pendiente de pago'}</span></div>
            {detail.paymentReference && <div className="cmp-detail-row"><span className="k">Referencia</span><span>{detail.paymentReference}</span></div>}
            {detail.notes && <div className="cmp-detail-row"><span className="k">Notas</span><span>{detail.notes}</span></div>}
            <div style={{ margin: '12px 0 4px', fontSize: 12, color: '#71717a', textTransform: 'uppercase' }}>Ítems</div>
            {detail.items.map((it) => (
              <div className="cmp-detail-row" key={it.id}>
                <span>{it.ingredientName} · {it.quantity} {it.unitSymbol} × {formatUsd(it.unitCost)}</span>
                <span className="cmp-subtotal">{formatUsd(it.total)}</span>
              </div>
            ))}
            <div className="cmp-modal-total-row">
              <span className="k">Total</span>
              <span className="cmp-total"><span className="val">{detail.paymentCurrency === 'VES' && detail.exchangeRate ? formatVes(detail.totalAmount * detail.exchangeRate) : formatUsd(detail.totalAmount)}</span>{detail.paymentCurrency === 'VES' && detail.exchangeRate && <small className="cmp-payment-ref">Ref. {formatUsd(detail.totalAmount)} · BCV {formatVes(detail.exchangeRate)}</small>}</span>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}
