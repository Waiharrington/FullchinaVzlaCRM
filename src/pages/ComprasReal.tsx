import { useEffect, useMemo, useState, useCallback } from 'react'
import {
  getSuppliers, createSupplier, getPurchases, createPurchase, setPurchasePaid,
  getIngredients, getUnits, createIngredient,
  type Supplier, type Purchase, type Ingredient,
} from '../lib/dataService'
import { SearchSelect } from '../components/SearchSelect'
import { PageSkeleton } from '../components/PageSkeleton'
import { useAuth } from '../context/auth-context'
import { formatUsd, dateKeyInTimeZone } from '../lib/money'
import {
  ShoppingBag, Plus, Trash2, CheckCircle2, AlertTriangle, Loader2, ShoppingCart,
  ClipboardList, Package, CalendarClock, Search, Download, Eye, X,
} from 'lucide-react'
import './ComprasReal.css'

interface ItemForm { ingredientId: string; quantity: string; unitId: string; unitCost: string }
const PAGE_SIZE = 8
type PaidFilter = 'todos' | 'pagados' | 'pendientes'

export function ComprasReal() {
  const { user } = useAuth()
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
  const [items, setItems] = useState<ItemForm[]>([])
  const [saving, setSaving] = useState(false)

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

  const load = useCallback(async () => {
    try {
      setLoading(true); setError('')
      const [sup, purch, ingr, un] = await Promise.all([
        getSuppliers(), getPurchases().catch(() => []), getIngredients(), getUnits(),
      ])
      setSuppliers(sup); setPurchases(purch); setIngredients(ingr); setUnits(un)
    } catch (e) { setError(e instanceof Error ? e.message : 'Error cargando datos') }
    finally { setLoading(false) }
  }, [])
  useEffect(() => { void load() }, [load])

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
    const q = search.trim().toLowerCase()
    return purchases.filter((p) => {
      if (q && !(p.supplierName.toLowerCase().includes(q) || (p.invoiceNumber ?? '').toLowerCase().includes(q))) return false
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

  const resetForm = () => { setSupplierId(''); setInvoiceNumber(''); setNotes(''); setItems([]); setMarkPaid(true); setPurchaseDate(dateKeyInTimeZone()) }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!supplierId || items.length === 0) return
    setSaving(true); setError('')
    try {
      await createPurchase({
        supplierId, purchaseDate, invoiceNumber: invoiceNumber.trim() || undefined,
        notes: notes.trim() || undefined, userId: user?.id ?? '', isPaid: markPaid,
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
      const ing: Ingredient = { id, name: newIngredientName.trim(), unitId, unitName: unit?.name ?? '', unitSymbol: unit?.symbol ?? '', isActive: true, currentStock: 0, pricePerUnit: null, stockValue: null }
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
    const rows = [['Fecha', 'Proveedor', 'Factura', 'Items', 'Total USD', 'Pagado']]
    filtered.forEach((p) => rows.push([p.purchaseDate, p.supplierName, p.invoiceNumber ?? '', String(p.items.length), p.totalAmount.toFixed(2), p.isPaid ? 'Si' : 'No']))
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n')
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }))
    const a = document.createElement('a'); a.href = url; a.download = `compras_${dateKeyInTimeZone()}.csv`; a.click(); URL.revokeObjectURL(url)
  }

  if (loading) return <PageSkeleton cards={3} rows={5} />

  return (
    <div className="page cmp-page animate-fade-in">
      <header className="page-header">
        <div>
          <h1 className="page-title text-gradient"><ShoppingCart size={22} style={{ verticalAlign: '-3px', marginRight: 8 }} />Compras e Insumos</h1>
          <p className="page-subtitle">Registra tus compras a proveedores. El inventario se actualiza automáticamente.</p>
        </div>
        <button className="cmp-new-btn" onClick={() => { if (showForm) { setShowForm(false) } else { resetForm(); setItems([{ ingredientId: ingredients[0]?.id ?? '', quantity: '1', unitId: ingredients[0]?.unitId ?? units[0]?.id ?? '', unitCost: '0' }]); setShowForm(true) } }}>
          <Plus size={16} /> Nueva Compra
        </button>
      </header>

      {error && <div className="whatsapp-notice-banner" style={{ background: 'rgba(239,68,68,0.15)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)' }}><AlertTriangle size={18} /> {error}</div>}
      {notice && <div className="whatsapp-notice-banner" style={{ background: 'rgba(16,185,129,0.15)', color: '#10b981', border: '1px solid rgba(16,185,129,0.3)' }}><CheckCircle2 size={18} /> {notice}</div>}

      {/* Resumen */}
      <div className="cmp-summary">
        <div className="cmp-sum">
          <span className="cmp-sum-ic" style={{ background: 'rgba(225,29,42,0.15)', color: '#e11d2a' }}><ShoppingBag size={20} /></span>
          <div><div className="cmp-sum-lbl">Total compras (este mes)</div><div className="cmp-sum-val">{formatUsd(summary.totalThis)}</div>
            {summary.pct != null && <div className={`cmp-sum-sub ${summary.pct >= 0 ? 'up' : 'down'}`}>{summary.pct >= 0 ? '▲' : '▼'} {Math.abs(summary.pct).toFixed(0)}% vs. mes anterior</div>}
          </div>
        </div>
        <div className="cmp-sum">
          <span className="cmp-sum-ic" style={{ background: 'rgba(124,58,237,0.15)', color: '#a78bfa' }}><ClipboardList size={20} /></span>
          <div><div className="cmp-sum-lbl">Compras realizadas</div><div className="cmp-sum-val">{summary.count}</div><div className="cmp-sum-sub">Este mes</div></div>
        </div>
        <div className="cmp-sum">
          <span className="cmp-sum-ic" style={{ background: 'rgba(16,185,129,0.15)', color: '#10b981' }}><Package size={20} /></span>
          <div><div className="cmp-sum-lbl">Total ítems comprados</div><div className="cmp-sum-val">{summary.itemsThis}</div><div className="cmp-sum-sub">Este mes</div></div>
        </div>
        <div className="cmp-sum">
          <span className="cmp-sum-ic" style={{ background: 'rgba(249,115,22,0.15)', color: '#f97316' }}><CalendarClock size={20} /></span>
          <div><div className="cmp-sum-lbl">Última compra</div>
            <div className="cmp-sum-val" style={{ fontSize: 16 }}>{summary.last ? new Date(summary.last.purchaseDate).toLocaleDateString('es-VE', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}</div>
            <div className="cmp-sum-sub">{summary.last ? `Proveedor: ${summary.last.supplierName}` : 'Sin compras'}</div>
          </div>
        </div>
      </div>

      {/* Nueva compra */}
      {showForm && (
        <div className="cmp-card">
          <h3 className="cmp-card-title"><ShoppingBag size={18} style={{ color: '#e11d2a' }} /> Nueva Compra</h3>
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
                  <input type="number" step="any" min="0" value={it.quantity} onChange={(e) => changeItem(i, 'quantity', e.target.value)} />
                  <select value={it.unitId} onChange={(e) => changeItem(i, 'unitId', e.target.value)}>{units.map((u) => <option key={u.id} value={u.id}>{u.symbol}</option>)}</select>
                  <div className="cmp-cost-wrap"><span>$</span><input type="number" step="any" min="0" value={it.unitCost} onChange={(e) => changeItem(i, 'unitCost', e.target.value)} /></div>
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
                  <select value={newIngredientUnitId || units[0]?.id || ''} onChange={(e) => setNewIngredientUnitId(e.target.value)} style={{ borderRadius: 9, padding: 9 }}>
                    {units.map((u) => <option key={u.id} value={u.id}>{u.name} ({u.symbol})</option>)}
                  </select>
                  <button type="button" className="cmp-new-btn" onClick={handleCreateIngredient}>Crear ingrediente</button>
                </div>
              </div>
            )}

            <label className="cmp-field" style={{ display: 'flex', alignItems: 'center', gap: 9, marginTop: 14, fontSize: 13, color: '#d4d4d8', cursor: 'pointer' }}>
              <input type="checkbox" checked={markPaid} onChange={(e) => setMarkPaid(e.target.checked)} style={{ width: 18, height: 18, accentColor: '#e11d2a' }} /> Marcar como pagada
            </label>

            <div className="cmp-form-foot">
              <span style={{ color: '#a1a1aa', fontSize: 13 }}>Total de ítems: <strong style={{ color: '#fff' }}>{items.length}</strong></span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
                <div className="cmp-total"><div className="lbl">Total a pagar</div><div className="val">{formatUsd(totalForm)}</div></div>
                <div className="cmp-actions">
                  <button type="button" className="cmp-cancel" onClick={() => { setShowForm(false); resetForm() }}>Cancelar</button>
                  <button type="submit" className="cmp-new-btn" disabled={saving || !supplierId || items.length === 0}>{saving ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />} Guardar Compra</button>
                </div>
              </div>
            </div>
          </form>
        </div>
      )}

      {/* Historial */}
      <div className="cmp-card">
        <h3 className="cmp-card-title">Historial de Compras</h3>
        <div className="cmp-hist-tools">
          <div className="cmp-search"><Search size={15} className="ic" /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar compra..." /></div>
          <select className="cmp-tool" value={paidFilter} onChange={(e) => setPaidFilter(e.target.value as PaidFilter)}>
            <option value="todos">Todas</option><option value="pagados">Pagadas</option><option value="pendientes">Por pagar</option>
          </select>
          <button className="cmp-tool" onClick={exportCsv}><Download size={15} /> Exportar</button>
        </div>

        <div className="cmp-table-wrap">
          <table className="cmp-table">
            <thead><tr><th>Fecha</th><th>Proveedor</th><th>N° Factura</th><th># Ítems</th><th>Total</th><th>Pagado</th><th>Estado</th><th>Acción</th></tr></thead>
            <tbody>
              {pageItems.map((p) => (
                <tr key={p.id}>
                  <td>{new Date(p.purchaseDate).toLocaleDateString('es-VE')}</td>
                  <td><strong>{p.supplierName || '—'}</strong></td>
                  <td style={{ color: '#a1a1aa' }}>{p.invoiceNumber || '—'}</td>
                  <td>{p.items.length}</td>
                  <td className="cmp-subtotal">{formatUsd(p.totalAmount)}</td>
                  <td>
                    <span className={`cmp-badge ${p.isPaid ? 'ok' : 'warn'}`} title="Clic para cambiar" onClick={() => togglePaid(p)}>
                      {p.isPaid ? <><CheckCircle2 size={12} /> Pagado</> : <><AlertTriangle size={12} /> Por pagar</>}
                    </span>
                  </td>
                  <td><span className="cmp-badge ok fixed"><Package size={12} /> Recibido</span></td>
                  <td><button className="cmp-icon-btn" onClick={() => setDetail(p)} title="Ver detalle"><Eye size={16} /></button></td>
                </tr>
              ))}
              {pageItems.length === 0 && <tr><td colSpan={8} style={{ textAlign: 'center', color: '#71717a', padding: 24 }}>No hay compras registradas.</td></tr>}
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
      {detail && (
        <div className="cmp-modal-overlay" onClick={() => setDetail(null)}>
          <div className="cmp-modal" onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3>Compra · {detail.supplierName}</h3>
              <button className="cmp-icon-btn" onClick={() => setDetail(null)}><X size={18} /></button>
            </div>
            <div className="cmp-detail-row"><span className="k">Fecha</span><span>{new Date(detail.purchaseDate).toLocaleDateString('es-VE')}</span></div>
            <div className="cmp-detail-row"><span className="k">Factura</span><span>{detail.invoiceNumber || '—'}</span></div>
            {detail.notes && <div className="cmp-detail-row"><span className="k">Notas</span><span>{detail.notes}</span></div>}
            <div style={{ margin: '12px 0 4px', fontSize: 12, color: '#71717a', textTransform: 'uppercase' }}>Ítems</div>
            {detail.items.map((it) => (
              <div className="cmp-detail-row" key={it.id}>
                <span>{it.ingredientName} · {it.quantity} {it.unitSymbol} × {formatUsd(it.unitCost)}</span>
                <span className="cmp-subtotal">{formatUsd(it.total)}</span>
              </div>
            ))}
            <div className="cmp-detail-row" style={{ borderBottom: 0, marginTop: 6 }}>
              <span className="k" style={{ fontWeight: 700, color: '#fff' }}>Total</span>
              <span className="cmp-total"><span className="val" style={{ fontSize: 20 }}>{formatUsd(detail.totalAmount)}</span></span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
