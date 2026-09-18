import { useEffect, useMemo, useState, useCallback } from 'react'
import { createPortal } from 'react-dom'
import {
  getSuppliers, createSupplier, getPurchases, createPurchase, setPurchasePaid, deletePurchase, voidPurchase, deleteVoidedPurchase,
  getIngredients, getUnits, createIngredient, getFinancialAccounts,
  type Supplier, type Purchase, type Ingredient, type FinancialAccount,
} from '../lib/dataService'
import { SearchSelect } from '../components/SearchSelect'
import { PageSkeleton } from '../components/PageSkeleton'
import { DateField } from '../components/DateField'
import { StyledSelect } from '../components/StyledSelect'
import NumberStepper from '../components/NumberStepper'
import { useAuth } from '../context/auth-context'
import { useRates } from '../context/rates-context'
import { formatUsd, formatVes, formatUsdPrecise, dateKeyInTimeZone } from '../lib/money'
import { normalizeForSearch } from '../lib/textFormat'
import {
  ShoppingBag, Plus, Trash2, CheckCircle2, AlertTriangle, Loader2, ShoppingCart, Ban,
  ClipboardList, Package, CalendarClock, Search, Download, Eye, X, Pencil,
} from 'lucide-react'
import Toast from '../components/Toast'
import { EmptyState } from '../components/EmptyState'
import { confirmDialog } from '../components/ConfirmDialog'
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
  const [closingForm, setClosingForm] = useState(false)
  const [supplierId, setSupplierId] = useState('')
  const [purchaseDate, setPurchaseDate] = useState(dateKeyInTimeZone())
  const [invoiceNumber, setInvoiceNumber] = useState('')
  const [notes, setNotes] = useState('')
  const [markPaid, setMarkPaid] = useState(true)
  const [accounts, setAccounts] = useState<FinancialAccount[]>([])
  const [items, setItems] = useState<ItemForm[]>([])
  const [purchaseSources, setPurchaseSources] = useState<Array<{ accountId: string; amount: string; reference: string }>>([])
  const [editingPurchaseId, setEditingPurchaseId] = useState<string | null>(null)
  const [editingOriginal, setEditingOriginal] = useState<Purchase | null>(null)
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
  const [deletingPurchaseId, setDeletingPurchaseId] = useState<string | null>(null)
  const [voidingPurchaseId, setVoidingPurchaseId] = useState<string | null>(null)
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
    if (saving || closingForm) return
    setClosingForm(true)
    window.setTimeout(() => {
      setShowForm(false)
      setClosingForm(false)
      setEditingPurchaseId(null)
      setEditingOriginal(null)
    }, 200)
  }, [closingForm, saving])

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
    const activePurchases = purchases.filter((p) => !p.isVoided)
    const thisMonth = activePurchases.filter((p) => inMonth(p.purchaseDate))
    const prevMonth = activePurchases.filter((p) => inMonth(p.purchaseDate, 1))
    const totalThis = thisMonth.reduce((s, p) => s + p.totalAmount, 0)
    const totalPrev = prevMonth.reduce((s, p) => s + p.totalAmount, 0)
    const pct = totalPrev > 0 ? ((totalThis - totalPrev) / totalPrev) * 100 : null
    const itemsThis = thisMonth.reduce((s, p) => s + p.items.length, 0)
    return { totalThis, count: thisMonth.length, itemsThis, pct, last: activePurchases[0] ?? null }
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

  const methodForAccount = (account: FinancialAccount | undefined): string => {
    if (!account) return 'pago_movil'
    if (account.accountType === 'pos') return 'punto'
    if (account.name.toLowerCase().includes('binance')) return 'binance'
    if (account.accountType === 'cash') return account.currency === 'VES' ? 'efectivo_bs' : 'efectivo_usd'
    return account.currency === 'VES' ? 'pago_movil' : 'transferencia'
  }
  const purchaseSourceUsd = (row: { accountId: string; amount: string }) => {
    const acc = accounts.find((a) => a.id === row.accountId)
    const amt = parseFloat(row.amount) || 0
    if (!acc || amt <= 0) return 0
    return acc.currency === 'VES' ? (effectiveBcvRate > 0 ? amt / effectiveBcvRate : 0) : amt
  }
  const purchaseAssignedUsd = purchaseSources.reduce((s, r) => s + purchaseSourceUsd(r), 0)
  const purchaseRemainingUsd = Math.round((totalForm - purchaseAssignedUsd) * 100) / 100
  const purchaseBalanced = Math.abs(purchaseRemainingUsd) <= 0.02
  const purchaseSourcesValid = purchaseSources.length > 0 && purchaseSources.every((r) => {
    const acc = accounts.find((a) => a.id === r.accountId)
    return !!acc && (parseFloat(r.amount) || 0) > 0
  })
  const updatePurchaseSource = (i: number, patch: Partial<{ accountId: string; amount: string; reference: string }>) =>
    setPurchaseSources((prev) => prev.map((row, idx) => idx === i ? { ...row, ...patch } : row))
  const fillPurchaseRemaining = (i: number) => {
    const acc = accounts.find((a) => a.id === purchaseSources[i]?.accountId)
    if (!acc) return
    const otherUsd = purchaseSources.reduce((s, row, idx) => idx === i ? s : s + purchaseSourceUsd(row), 0)
    const needUsd = Math.max(0, Math.round((totalForm - otherUsd) * 100) / 100)
    const native = acc.currency === 'VES' ? needUsd * effectiveBcvRate : needUsd
    updatePurchaseSource(i, { amount: String(Math.round(native * 100) / 100) })
  }

  const addItem = () => setItems([...items, { ingredientId: ingredients[0]?.id ?? '', quantity: '1', unitId: ingredients[0]?.unitId ?? units[0]?.id ?? '', unitCost: '0' }])
  const removeItem = (i: number) => setItems(items.filter((_, x) => x !== i))
  const changeItem = (i: number, f: keyof ItemForm, v: string) => setItems(items.map((it, x) => {
    if (x !== i) return it
    const up = { ...it, [f]: v }
    if (f === 'ingredientId') { const ing = ingredients.find((y) => y.id === v); if (ing) up.unitId = ing.unitId }
    return up
  }))

  const resetForm = () => { setSupplierId(''); setInvoiceNumber(''); setNotes(''); setItems([]); setMarkPaid(true); setPurchaseSources([]); setPurchaseDate(dateKeyInTimeZone()); setEditingPurchaseId(null); setEditingOriginal(null) }

  const openPurchaseForm = () => {
    resetForm()
    setClosingForm(false)
    setItems([{ ingredientId: ingredients[0]?.id ?? '', quantity: '1', unitId: ingredients[0]?.unitId ?? units[0]?.id ?? '', unitCost: '0' }])
    setPurchaseSources([{ accountId: '', amount: '', reference: '' }])
    setShowForm(true)
  }

  const openEditPurchase = (p: Purchase) => {
    setEditingPurchaseId(p.id)
    setEditingOriginal(p)
    setSupplierId(p.supplierId)
    setPurchaseDate(p.purchaseDate)
    setInvoiceNumber(p.invoiceNumber ?? '')
    setNotes(p.notes ?? '')
    setMarkPaid(p.isPaid)
    setItems(p.items.map((it) => ({ ingredientId: it.ingredientId, quantity: String(it.quantity), unitId: it.unitId, unitCost: String(it.unitCost) })))
    setPurchaseSources(p.payments.length > 0
      ? p.payments.map((pp) => ({ accountId: pp.accountId, amount: String(pp.amount), reference: pp.reference ?? '' }))
      : [{ accountId: p.accountId ?? '', amount: '', reference: p.paymentReference ?? '' }])
    setClosingForm(false)
    setShowForm(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!supplierId || items.length === 0) return
    if (markPaid) {
      if (!purchaseSourcesValid) { setError('Completa las cuentas de pago (cuenta y monto).'); return }
      if (purchaseSources.some((r) => accounts.find((a) => a.id === r.accountId)?.currency === 'VES') && effectiveBcvRate <= 0) { setError('No hay una tasa BCV válida para registrar pagos en bolívares'); return }
      if (!purchaseBalanced) { setError(`El pago no cuadra: asignado ${formatUsdPrecise(purchaseAssignedUsd)} de ${formatUsdPrecise(totalForm)}`); return }
    }
    setSaving(true); setError('')
    const payments = markPaid ? purchaseSources.map((r) => {
      const acc = accounts.find((a) => a.id === r.accountId)!
      return { accountId: r.accountId, amount: parseFloat(r.amount) || 0, currency: acc.currency, exchangeRate: acc.currency === 'VES' ? effectiveBcvRate : null, method: methodForAccount(acc), reference: r.reference.trim() || null }
    }) : undefined
    const payload = {
      supplierId, purchaseDate, invoiceNumber: invoiceNumber.trim() || undefined,
      notes: notes.trim() || undefined, userId: user?.id ?? '', isPaid: markPaid,
      exchangeRate: markPaid ? effectiveBcvRate : null, payments,
      items: items.map((it) => ({ ingredientId: it.ingredientId, quantity: parseFloat(it.quantity) || 0, unitId: it.unitId, unitCost: parseFloat(it.unitCost) || 0 })),
    }
    try {
      if (editingPurchaseId && editingOriginal) {
        // Editar = reemplazar: revierte la compra anterior (devuelve stock y saldo)
        // y crea la corregida. Si la vieja no se puede revertir (insumo ya usado),
        // deletePurchase lanza y no se toca nada.
        const original = editingOriginal
        await deletePurchase(editingPurchaseId)
        try {
          await createPurchase(payload)
        } catch (createErr) {
          // Rollback: recrea la compra original para no perder datos.
          await createPurchase({
            supplierId: original.supplierId, purchaseDate: original.purchaseDate,
            invoiceNumber: original.invoiceNumber ?? undefined, notes: original.notes ?? undefined,
            userId: user?.id ?? '', isPaid: original.isPaid, exchangeRate: original.exchangeRate,
            payments: original.payments.length > 0 ? original.payments.map((pp) => ({ accountId: pp.accountId, amount: pp.amount, currency: pp.currency, exchangeRate: pp.exchangeRate, method: pp.method, reference: pp.reference })) : undefined,
            accountId: original.accountId, paymentCurrency: original.paymentCurrency, paymentMethod: original.paymentMethod, paymentReference: original.paymentReference,
            items: original.items.map((it) => ({ ingredientId: it.ingredientId, quantity: it.quantity, unitId: it.unitId, unitCost: it.unitCost })),
          }).catch(() => {})
          throw createErr
        }
        flash('Compra actualizada · inventario ajustado')
      } else {
        await createPurchase(payload)
        flash('Compra registrada · inventario actualizado')
      }
      setClosingForm(true)
      window.setTimeout(() => { setShowForm(false); setClosingForm(false); resetForm() }, 200)
      await load()
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

  const handleDeletePurchase = async (purchase: Purchase) => {
    const ok = await confirmDialog({
      title: 'Eliminar compra',
      message: `¿Eliminar la compra de ${purchase.supplierName} por ${formatUsd(purchase.totalAmount)}?\n\nSe revertirá el stock de almacén. Si algún insumo ya fue usado o transferido, la operación será rechazada.`,
      confirmText: 'Eliminar compra',
      danger: true,
    })
    if (!ok) return
    setDeletingPurchaseId(purchase.id); setError('')
    try {
      await deletePurchase(purchase.id)
      if (detail?.id === purchase.id) setDetail(null)
      flash('Compra eliminada y stock revertido')
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo eliminar la compra')
    } finally { setDeletingPurchaseId(null) }
  }

  const handleVoidPurchase = async (purchase: Purchase) => {
    const ok = await confirmDialog({
      title: 'Anular compra',
      message: `¿Anular la compra de ${purchase.supplierName} por ${formatUsd(purchase.totalAmount)}?\n\nEl registro y el inventario histórico se conservarán, pero dejará de contar en los totales financieros.`,
      confirmText: 'Anular compra',
      danger: true,
    })
    if (!ok) return
    setVoidingPurchaseId(purchase.id); setError('')
    try {
      await voidPurchase(purchase.id)
      flash('Compra anulada; el registro histórico se conserva')
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo anular la compra')
    } finally { setVoidingPurchaseId(null) }
  }

  const handleDeleteVoidedPurchase = async (purchase: Purchase) => {
    const ok = await confirmDialog({
      title: 'Borrar compra demo',
      message: `¿Borrar permanentemente la compra anulada de ${purchase.supplierName}?\n\nEsta acción elimina el registro y sus movimientos de inventario. Úsala solo si esta compra era de prueba.`,
      confirmText: 'Borrar permanentemente',
      danger: true,
    })
    if (!ok) return
    setDeletingPurchaseId(purchase.id); setError('')
    try {
      await deleteVoidedPurchase(purchase.id)
      if (detail?.id === purchase.id) setDetail(null)
      flash('Compra demo borrada permanentemente')
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo borrar la compra anulada')
    } finally { setDeletingPurchaseId(null) }
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
        <div className={`cmp-modal-overlay cmp-purchase-overlay ${closingForm ? 'closing' : ''}`} onMouseDown={(event) => { if (event.target === event.currentTarget) closePurchaseForm() }}>
        <div className="cmp-card cmp-purchase-modal" role="dialog" aria-modal="true" aria-labelledby="new-purchase-title">
          <div className="cmp-purchase-header"><h3 id="new-purchase-title" className="cmp-card-title"><ShoppingBag size={18} style={{ color: '#e11d2a' }} /> {editingPurchaseId ? 'Editar Compra' : 'Nueva Compra'}</h3><button type="button" className="cmp-icon-btn" aria-label="Cerrar" onClick={closePurchaseForm}><X size={20} /></button></div>
          <form onSubmit={handleSubmit}>
            <div className="cmp-form-grid">
              <div className="cmp-field"><label>Proveedor *</label>
                <div className="cmp-prov-row">
                  <SearchSelect options={suppliers.map((s) => ({ value: s.id, label: s.name }))} value={supplierId} onChange={setSupplierId} placeholder="Buscar proveedor..." emptyText="Sin proveedores" />
                  <button type="button" className="cmp-ghost-btn" onClick={() => setShowSupplierForm(!showSupplierForm)}><Plus size={14} /> Nuevo Proveedor</button>
                </div>
              </div>
              <div className="cmp-field"><label>Fecha *</label><DateField value={purchaseDate} onChange={setPurchaseDate} required /></div>
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
                  <span className="cmp-subtotal" style={{ textAlign: 'right' }}>{formatUsdPrecise(sub)}</span>
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
            {markPaid && <div className="cmp-src-block">
              {purchaseSources.map((row, i) => {
                const acc = accounts.find((a) => a.id === row.accountId)
                const isVes = acc?.currency === 'VES'
                const amt = parseFloat(row.amount) || 0
                const insufficient = acc ? amt > (acc.currentBalance ?? 0) : false
                return <div className="cmp-src-row" key={i}>
                  <div className="cmp-src-grid">
                    <div className="cmp-field"><label>Cuenta {purchaseSources.length > 1 ? `#${i + 1}` : ''} *</label><StyledSelect value={row.accountId} onChange={(e) => updatePurchaseSource(i, { accountId: e.target.value })}><option value="">Selecciona una cuenta</option>{accounts.map((a) => <option key={a.id} value={a.id}>{a.name} · {a.currency}</option>)}</StyledSelect></div>
                    <div className="cmp-field"><label>Monto {acc ? (isVes ? '(Bs)' : '(USD)') : ''}</label><input type="number" inputMode="decimal" min="0" step="any" value={row.amount} onChange={(e) => updatePurchaseSource(i, { amount: e.target.value })} placeholder="0,00" /></div>
                    <div className="cmp-field"><label>Referencia</label><input value={row.reference} onChange={(e) => updatePurchaseSource(i, { reference: e.target.value })} placeholder="N° operación" /></div>
                  </div>
                  <div className="cmp-src-meta">
                    {acc && <span className={insufficient ? 'cmp-src-warn' : ''}>Disponible: {isVes ? formatVes(acc.currentBalance) : formatUsdPrecise(acc.currentBalance)}</span>}
                    <span className="cmp-src-actions"><button type="button" className="cmp-src-link" onClick={() => fillPurchaseRemaining(i)}>Poner resto</button>{purchaseSources.length > 1 && <button type="button" className="cmp-src-remove" onClick={() => setPurchaseSources((prev) => prev.filter((_, idx) => idx !== i))}>Quitar</button>}</span>
                  </div>
                </div>
              })}
              <button type="button" className="cmp-src-add" onClick={() => setPurchaseSources((prev) => [...prev, { accountId: '', amount: '', reference: '' }])}><Plus size={14} /> Agregar cuenta</button>
              <div className={`cmp-src-summary ${purchaseBalanced ? 'ok' : ''}`}><span>Asignado <strong>{formatUsdPrecise(purchaseAssignedUsd)}</strong> de {formatUsdPrecise(totalForm)}</span><span>{purchaseBalanced ? '✓ Cuadra' : purchaseRemainingUsd > 0 ? `Faltan ${formatUsdPrecise(purchaseRemainingUsd)}` : `Sobran ${formatUsdPrecise(-purchaseRemainingUsd)}`}</span></div>
            </div>}

            <div className="cmp-form-foot">
              <span style={{ color: '#a1a1aa', fontSize: 13 }}>Total de ítems: <strong style={{ color: '#fff' }}>{items.length}</strong></span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
                <div className="cmp-total"><div className="lbl">Total a pagar</div><div className="val">{formatUsdPrecise(totalForm)}</div>{effectiveBcvRate > 0 && <div className="cmp-payment-ref">Ref. {formatVes(totalForm * effectiveBcvRate)} · BCV {formatVes(effectiveBcvRate)}</div>}</div>
                <div className="cmp-actions">
                  <button type="button" className="cmp-cancel" onClick={() => { closePurchaseForm(); resetForm() }}>Cancelar</button>
                  <button type="submit" className="cmp-new-btn" disabled={saving || !supplierId || items.length === 0 || (markPaid && (!purchaseSourcesValid || !purchaseBalanced))}>{saving ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />} {editingPurchaseId ? 'Guardar cambios' : 'Guardar Compra'}</button>
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
                    {p.isPaid ? <div className="cmp-paid-amount"><strong>{p.paymentCurrency === 'VES' && p.exchangeRate ? formatVes(p.totalAmount * p.exchangeRate) : formatUsdPrecise(p.totalAmount)}</strong>{p.paymentCurrency === 'VES' && p.exchangeRate && <small>Ref. {formatUsdPrecise(p.totalAmount)} · BCV {formatVes(p.exchangeRate)}</small>}</div> : <span>—</span>}
                  </td>
                  <td><div className="cmp-payment-info">{p.payments.length > 1 ? <><strong>Varias cuentas</strong><small>{p.payments.map((pp) => pp.accountName).join(' · ')}</small></> : <><strong>{p.isPaid ? paymentMethodLabel(p.paymentMethod) : 'Pendiente'}</strong><small>{p.accountName ?? (p.isPaid ? 'Cuenta sin registrar' : 'Sin pago')}</small>{p.paymentReference && <small>Ref. {p.paymentReference}</small>}</>}</div></td>
                  <td><span className={`cmp-badge ${p.isVoided ? 'voided fixed' : p.isPaid ? 'ok' : 'warn'}`} title={p.isVoided ? 'Compra anulada' : 'Clic para cambiar'} onClick={() => { if (!p.isVoided) void togglePaid(p) }}>{p.isVoided ? <><Ban size={12} /> Anulada</> : p.isPaid ? <><CheckCircle2 size={12} /> Pagado</> : <><AlertTriangle size={12} /> Por pagar</>}</span></td>
                  <td><div className="cmp-row-actions"><button className="cmp-icon-btn" onClick={() => setDetail(p)} title="Ver detalle" aria-label={`Ver compra de ${p.supplierName}`}><Eye size={16} /></button>{!p.isVoided && <button className="cmp-icon-btn" onClick={() => openEditPurchase(p)} title="Editar compra" aria-label={`Editar compra de ${p.supplierName}`}><Pencil size={16} /></button>}{p.isVoided ? <button className="cmp-icon-btn cmp-icon-danger" onClick={() => void handleDeleteVoidedPurchase(p)} title="Borrar compra demo permanentemente" aria-label={`Borrar compra demo de ${p.supplierName}`} disabled={deletingPurchaseId === p.id}>{deletingPurchaseId === p.id ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}</button> : <><button className="cmp-icon-btn cmp-icon-danger" onClick={() => void handleVoidPurchase(p)} title="Anular compra" aria-label={`Anular compra de ${p.supplierName}`} disabled={voidingPurchaseId === p.id}>{voidingPurchaseId === p.id ? <Loader2 size={16} className="animate-spin" /> : <Ban size={16} />}</button><button className="cmp-icon-btn cmp-icon-danger" onClick={() => void handleDeletePurchase(p)} title="Eliminar si no tiene movimientos" aria-label={`Eliminar compra de ${p.supplierName}`} disabled={deletingPurchaseId === p.id}>{deletingPurchaseId === p.id ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}</button></>}</div></td>
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
            {detail.payments.length > 1 ? (
              <div className="cmp-detail-row"><span className="k">Pagos</span><span>{detail.payments.map((pp, idx) => <div key={idx}>{pp.accountName}: {pp.currency === 'VES' ? formatVes(pp.amount) : formatUsdPrecise(pp.amount)}{pp.reference ? ` · Ref. ${pp.reference}` : ''}</div>)}</span></div>
            ) : (
              <>
                <div className="cmp-detail-row"><span className="k">Método / cuenta</span><span>{detail.isPaid ? `${paymentMethodLabel(detail.paymentMethod)} · ${detail.accountName ?? 'Sin registrar'}` : 'Pendiente de pago'}</span></div>
                {detail.paymentReference && <div className="cmp-detail-row"><span className="k">Referencia</span><span>{detail.paymentReference}</span></div>}
              </>
            )}
            {detail.notes && <div className="cmp-detail-row"><span className="k">Notas</span><span>{detail.notes}</span></div>}
            <div style={{ margin: '12px 0 4px', fontSize: 12, color: '#71717a', textTransform: 'uppercase' }}>Ítems</div>
            {detail.items.map((it) => (
              <div className="cmp-detail-row" key={it.id}>
                <span>{it.ingredientName} · {it.quantity} {it.unitSymbol} × {formatUsdPrecise(it.unitCost)}</span>
                <span className="cmp-subtotal">{formatUsdPrecise(it.total)}</span>
              </div>
            ))}
            <div className="cmp-modal-total-row">
              <span className="k">Total</span>
              <span className="cmp-total"><span className="val">{detail.paymentCurrency === 'VES' && detail.exchangeRate ? formatVes(detail.totalAmount * detail.exchangeRate) : formatUsdPrecise(detail.totalAmount)}</span>{detail.paymentCurrency === 'VES' && detail.exchangeRate && <small className="cmp-payment-ref">Ref. {formatUsdPrecise(detail.totalAmount)} · BCV {formatVes(detail.exchangeRate)}</small>}</span>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}
