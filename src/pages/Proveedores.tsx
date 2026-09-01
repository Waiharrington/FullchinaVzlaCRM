import { useCallback, useEffect, useMemo, useState } from 'react'
import { Building2, CalendarDays, Eye, Loader2, Mail, Phone, Plus, Search, ShoppingBag, UserRound, X } from 'lucide-react'
import Toast from '../components/Toast'
import { createSupplier, getPurchases, getSuppliers, type Purchase, type Supplier } from '../lib/dataService'
import { formatUsd } from '../lib/money'
import { normalizeForSearch } from '../lib/textFormat'
import './Proveedores.css'
import { PageSkeleton } from '../components/PageSkeleton'
import { EmptyState } from '../components/EmptyState'

type SupplierDraft = { name: string; contact: string; phone: string; email: string; notes: string }
const EMPTY_DRAFT: SupplierDraft = { name: '', contact: '', phone: '', email: '', notes: '' }

export function Proveedores() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [purchases, setPurchases] = useState<Purchase[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [search, setSearch] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [draft, setDraft] = useState<SupplierDraft>(EMPTY_DRAFT)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [closingSelected, setClosingSelected] = useState(false)

  const closeSelected = (then?: () => void) => {
    if (closingSelected) return
    setClosingSelected(true)
    window.setTimeout(() => {
      setSelectedId(null)
      setClosingSelected(false)
      then?.()
    }, 200)
  }

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [supplierRows, purchaseRows] = await Promise.all([getSuppliers(), getPurchases()])
      setSuppliers(supplierRows)
      setPurchases(purchaseRows)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'No se pudieron cargar los proveedores')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  const activity = useMemo(() => new Map(suppliers.map((supplier) => {
    const history = purchases.filter((purchase) => purchase.supplierId === supplier.id)
    return [supplier.id, {
      history,
      total: history.reduce((sum, purchase) => sum + purchase.totalAmount, 0),
      last: history[0] ?? null,
    }]
  })), [purchases, suppliers])

  const filtered = useMemo(() => {
    const query = normalizeForSearch(search)
    if (!query) return suppliers
    return suppliers.filter((supplier) => [supplier.name, supplier.contact, supplier.phone, supplier.email]
      .some((value) => value && normalizeForSearch(value).includes(query)))
  }, [search, suppliers])

  const selected = selectedId ? suppliers.find((supplier) => supplier.id === selectedId) ?? null : null
  const selectedActivity = selected ? activity.get(selected.id) : null
  const totalPurchased = purchases.reduce((sum, purchase) => sum + purchase.totalAmount, 0)

  const updateDraft = (field: keyof SupplierDraft, value: string) => setDraft((current) => ({ ...current, [field]: value }))

  const saveSupplier = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!draft.name.trim()) return
    setSaving(true)
    setError('')
    try {
      await createSupplier({
        name: draft.name.trim(),
        contact: draft.contact.trim() || undefined,
        phone: draft.phone.trim() || undefined,
        email: draft.email.trim() || undefined,
        notes: draft.notes.trim() || undefined,
      })
      setDraft(EMPTY_DRAFT)
      setShowForm(false)
      setNotice('Proveedor guardado correctamente')
      window.setTimeout(() => setNotice(''), 3500)
      await load()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'No se pudo guardar el proveedor')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="page prv-loading"><PageSkeleton cards={2} rows={4} /></div>

  return (
    <div className="page prv-page animate-fade-in">
      <header className="page-header prv-header">
        <div>
          <h1 className="page-title"><Building2 size={22} className="page-title-icon" /> Proveedores</h1>
          <p className="page-subtitle">Directorio, contactos e historial de compras con cada proveedor.</p>
        </div>
        <button className="prv-primary" onClick={() => setShowForm((visible) => !visible)}><Plus size={17} /> Nuevo proveedor</button>
      </header>

      {error && <Toast type="error" message={error} onClose={() => setError('')} />}
      {notice && <Toast type="success" message={notice} onClose={() => setNotice('')} />}

      <section className="prv-kpis" aria-label="Resumen de proveedores">
        <article><span><Building2 size={20} /></span><div><small>Proveedores activos</small><strong>{suppliers.length}</strong></div></article>
        <article><span><ShoppingBag size={20} /></span><div><small>Compras registradas</small><strong>{purchases.length}</strong></div></article>
        <article><span><CalendarDays size={20} /></span><div><small>Total comprado</small><strong>{formatUsd(totalPurchased)}</strong></div></article>
      </section>

      {showForm && (
        <section className="prv-card">
          <div className="prv-card-title"><h2>Agregar proveedor</h2></div>
          <form className="prv-form" onSubmit={saveSupplier}>
            <label>Nombre *<input autoFocus value={draft.name} onChange={(event) => updateDraft('name', event.target.value)} required /></label>
            <label>Persona de contacto<input value={draft.contact} onChange={(event) => updateDraft('contact', event.target.value)} /></label>
            <label>Teléfono<input value={draft.phone} onChange={(event) => updateDraft('phone', event.target.value)} /></label>
            <label>Correo<input type="email" value={draft.email} onChange={(event) => updateDraft('email', event.target.value)} /></label>
            <label className="wide">Notas<textarea rows={3} value={draft.notes} onChange={(event) => updateDraft('notes', event.target.value)} /></label>
            <div className="prv-form-actions wide"><button type="button" className="prv-secondary" onClick={() => setShowForm(false)}>Cancelar</button><button className="prv-primary" disabled={saving}>{saving ? <Loader2 className="animate-spin" size={16} /> : <Plus size={16} />} Guardar proveedor</button></div>
          </form>
        </section>
      )}

      <section className="prv-card">
        <div className="prv-toolbar">
          <div><h2>Directorio</h2><p>{filtered.length} de {suppliers.length} proveedores</p></div>
          <label className="prv-search"><Search size={16} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar por nombre, contacto o teléfono" />{search && <button type="button" className="search-clear-btn" onClick={() => setSearch('')} aria-label="Borrar búsqueda"><X size={13} /></button>}</label>
        </div>

        <div className="prv-grid">
          {filtered.map((supplier) => {
            const stats = activity.get(supplier.id)
            return (
              <article className="prv-supplier" key={supplier.id}>
                <div className="prv-avatar">{supplier.name.slice(0, 2).toUpperCase()}</div>
                <div className="prv-info">
                  <h3>{supplier.name}</h3>
                  <p>{supplier.contact ? <><UserRound size={14} /> {supplier.contact}</> : 'Sin persona de contacto'}</p>
                  <div className="prv-contact">
                    {supplier.phone && <span><Phone size={13} /> {supplier.phone}</span>}
                    {supplier.email && <span><Mail size={13} /> {supplier.email}</span>}
                  </div>
                </div>
                <div className="prv-stats"><span><b>{stats?.history.length ?? 0}</b> compras</span><span><b>{formatUsd(stats?.total ?? 0)}</b> acumulado</span><span>Última: <b>{stats?.last ? new Date(`${stats.last.purchaseDate}T12:00:00`).toLocaleDateString('es-VE') : '—'}</b></span></div>
                <button className="prv-history" onClick={() => setSelectedId(supplier.id)}><Eye size={15} /> Ver historial</button>
              </article>
            )
          })}
          {filtered.length === 0 && (
            <EmptyState
              title="No hay proveedores que coincidan"
              description="Prueba con otro nombre o agrega un proveedor nuevo."
            />
          )}
        </div>
      </section>

      {selected && (
        <div className={`prv-overlay ${closingSelected ? 'closing' : ''}`} role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) closeSelected() }}>
          <section className="prv-modal" role="dialog" aria-modal="true" aria-labelledby="supplier-history-title">
            <div className="prv-card-title"><div><h2 id="supplier-history-title">{selected.name}</h2><p>Historial completo de compras</p></div><button aria-label="Cerrar historial" onClick={() => closeSelected()}><X size={19} /></button></div>
            <div className="prv-modal-summary"><span>{selectedActivity?.history.length ?? 0} compras</span><strong>{formatUsd(selectedActivity?.total ?? 0)}</strong></div>
            <div className="prv-purchases">
              {selectedActivity?.history.map((purchase) => (
                <article key={purchase.id}>
                  <div><b>{new Date(`${purchase.purchaseDate}T12:00:00`).toLocaleDateString('es-VE')}</b><small>{purchase.invoiceNumber ? `Factura ${purchase.invoiceNumber}` : 'Sin número de factura'}</small></div>
                  <div className="prv-items">{purchase.items.map((item) => `${item.quantity} ${item.unitSymbol} ${item.ingredientName}`).join(' · ') || 'Sin artículos'}</div>
                  <strong>{formatUsd(purchase.totalAmount)}</strong>
                </article>
              ))}
              {!selectedActivity?.history.length && <div className="prv-empty">Todavía no hay compras registradas con este proveedor.</div>}
            </div>
          </section>
        </div>
      )}
    </div>
  )
}
