import { useCallback, useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { Building2, CalendarDays, CheckCircle2, ChevronDown, ChevronLeft, ChevronRight, CreditCard, Eye, FileText, Loader2, Mail, Phone, Plus, Search, ShoppingBag, UserRound, Wallet, X } from 'lucide-react'
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
  const [closingForm, setClosingForm] = useState(false)
  const [draft, setDraft] = useState<SupplierDraft>(EMPTY_DRAFT)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [closingSelected, setClosingSelected] = useState(false)
  const [historyMonthCursor, setHistoryMonthCursor] = useState(() => {
    const n = new Date()
    return new Date(n.getFullYear(), n.getMonth(), 1)
  })
  const [historyWeekStartKey, setHistoryWeekStartKey] = useState<string | null>(null)
  const [expandedPurchaseId, setExpandedPurchaseId] = useState<string | null>(null)

  useEffect(() => {
    if (!selectedId) return
    setExpandedPurchaseId(null)
    const n = new Date()
    setHistoryMonthCursor(new Date(n.getFullYear(), n.getMonth(), 1))
    setHistoryWeekStartKey(null)
  }, [selectedId])

  const closeSelected = (then?: () => void) => {
    if (closingSelected) return
    setClosingSelected(true)
    window.setTimeout(() => {
      setSelectedId(null)
      setClosingSelected(false)
      then?.()
    }, 200)
  }

  const closeForm = () => {
    if (closingForm) return
    setClosingForm(true)
    window.setTimeout(() => {
      setShowForm(false)
      setClosingForm(false)
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

  const mondayOf = (d: Date) => {
    const day = d.getDay()
    const diff = day === 0 ? -6 : 1 - day
    return new Date(d.getFullYear(), d.getMonth(), d.getDate() + diff)
  }

  const historyWeeksInMonth = useMemo(() => {
    const monthStart = historyMonthCursor
    const monthEnd = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0)
    const today = new Date()
    const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate())
    const weeks: Array<{ key: string; start: Date; end: Date; label: string }> = []
    let cursor = mondayOf(monthStart)
    while (cursor <= monthEnd) {
      const weekEnd = new Date(cursor)
      weekEnd.setDate(weekEnd.getDate() + 6)
      if (cursor <= todayStart) {
        const cappedEnd = weekEnd > todayStart ? todayStart : weekEnd
        const startLabel = cursor.toLocaleDateString('es-VE', { day: 'numeric', month: 'short' }).replace('.', '')
        const endLabel = cappedEnd.toLocaleDateString('es-VE', { day: 'numeric', month: 'short' }).replace('.', '')
        weeks.push({ key: cursor.toISOString().slice(0, 10), start: cursor, end: cappedEnd, label: `${startLabel} – ${endLabel}` })
      }
      cursor = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate() + 7)
    }
    return weeks.reverse()
  }, [historyMonthCursor])

  useEffect(() => {
    if (!selectedId) return
    if (historyWeeksInMonth.length === 0) { setHistoryWeekStartKey(null); return }
    if (!historyWeeksInMonth.some((w) => w.key === historyWeekStartKey)) {
      setHistoryWeekStartKey(historyWeeksInMonth[0].key)
    }
  }, [historyWeeksInMonth, selectedId, historyWeekStartKey])

  const canGoNextHistoryMonth = useMemo(() => {
    const now = new Date()
    return historyMonthCursor.getFullYear() < now.getFullYear() ||
      (historyMonthCursor.getFullYear() === now.getFullYear() && historyMonthCursor.getMonth() < now.getMonth())
  }, [historyMonthCursor])

  const historyGroups = useMemo(() => {
    const history = selectedActivity?.history ?? []
    const selectedWeek = historyWeeksInMonth.find((w) => w.key === historyWeekStartKey)
    if (!selectedWeek) return []
    const startTime = selectedWeek.start.getTime()
    const endTime = selectedWeek.end.getTime()
    const now = new Date()
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())

    const filteredPurchases = history.filter((purchase) => {
      const d = new Date(`${purchase.purchaseDate}T12:00:00`)
      const dayStart = new Date(d.getFullYear(), d.getMonth(), d.getDate())
      return dayStart.getTime() >= startTime && dayStart.getTime() <= endTime
    })

    const map = new Map<string, Purchase[]>()
    for (const purchase of filteredPurchases) {
      const key = purchase.purchaseDate
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(purchase)
    }

    return [...map.entries()].map(([key, items]) => {
      const d = new Date(`${key}T12:00:00`)
      const dayStart = new Date(d.getFullYear(), d.getMonth(), d.getDate())
      const diffDays = Math.round((startOfToday.getTime() - dayStart.getTime()) / 86400000)
      let label: string
      if (diffDays === 0) label = 'Hoy'
      else if (diffDays === 1) label = 'Ayer'
      else {
        const raw = d.toLocaleDateString('es-VE', { weekday: 'long', day: 'numeric', month: 'long' })
        label = raw.charAt(0).toUpperCase() + raw.slice(1)
      }
      return { key, label, items, total: items.reduce((sum, p) => sum + p.totalAmount, 0) }
    })
  }, [selectedActivity, historyWeeksInMonth, historyWeekStartKey])

  const selectedPurchase = useMemo(
    () => historyGroups.flatMap((g) => g.items).find((p) => p.id === expandedPurchaseId) ?? null,
    [historyGroups, expandedPurchaseId],
  )

  const renderPurchaseDetail = (purchase: Purchase) => (
    <>
      <div className="prv-purchase-detail-items">
        {purchase.items.map((item) => (
          <div className="prv-purchase-detail-item" key={item.id}>
            <span>{item.quantity} {item.unitSymbol} {item.ingredientName}</span>
            <span>{formatUsd(item.total)}</span>
          </div>
        ))}
      </div>
      <div className="prv-purchase-detail-rows">
        <div className="prv-purchase-detail-row">
          <span><CheckCircle2 size={13} /> Estado</span>
          <span className={purchase.isPaid ? 'paid' : 'unpaid'}>{purchase.isPaid ? 'Pagada' : 'Pendiente'}</span>
        </div>
        {purchase.accountName && (
          <div className="prv-purchase-detail-row">
            <span><Wallet size={13} /> Cuenta</span>
            <span>{purchase.accountName}</span>
          </div>
        )}
        {purchase.paymentMethod && (
          <div className="prv-purchase-detail-row">
            <span><CreditCard size={13} /> Método de pago</span>
            <span>{purchase.paymentMethod}{purchase.paymentReference ? ` · ${purchase.paymentReference}` : ''}</span>
          </div>
        )}
        {purchase.notes && (
          <div className="prv-purchase-detail-row">
            <span><FileText size={13} /> Notas</span>
            <span>{purchase.notes}</span>
          </div>
        )}
      </div>
    </>
  )

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
      closeForm()
      setNotice('Proveedor guardado correctamente')
      window.setTimeout(() => setNotice(''), 3500)
      await load()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'No se pudo guardar el proveedor')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <PageSkeleton cards={3} rows={4} hasTable={false} />

  return (
    <div className="page prv-page animate-fade-in management-workspace management-workspace--suppliers" key="prv-full">
      <header className="page-header prv-header management-workspace-header">
        <div>
          <h1 className="page-title"><Building2 size={22} className="page-title-icon" /> Proveedores</h1>
          <p className="page-subtitle">Directorio, contactos e historial de compras con cada proveedor.</p>
        </div>
        <button className="prv-primary" onClick={() => setShowForm(true)}><Plus size={17} /> Nuevo proveedor</button>
      </header>

      {error && <Toast type="error" message={error} onClose={() => setError('')} />}
      {notice && <Toast type="success" message={notice} onClose={() => setNotice('')} />}

      <section className="prv-kpis management-workspace-metrics" aria-label="Resumen de proveedores">
        <article className="prv-kpi-card red"><span><Building2 size={20} /></span><div><small>Proveedores activos</small><strong>{suppliers.length}</strong></div></article>
        <article className="prv-kpi-card purple"><span><ShoppingBag size={20} /></span><div><small>Compras registradas</small><strong>{purchases.length}</strong></div></article>
        <article className="prv-kpi-card green"><span><CalendarDays size={20} /></span><div><small>Total comprado</small><strong>{formatUsd(totalPurchased)}</strong></div></article>
      </section>

      {showForm && createPortal(
        <div className={`prv-overlay ${closingForm ? 'closing' : ''}`} role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) closeForm() }}>
          <section className="prv-modal prv-modal-supplier" role="dialog" aria-modal="true" aria-labelledby="new-supplier-title">
            <form onSubmit={saveSupplier}>
              <div className="prv-modal-topbar">
                <button type="button" className="prv-modal-cancel" onClick={() => closeForm()}>Cancelar</button>
                <h2 id="new-supplier-title">Nuevo proveedor</h2>
                <button type="submit" className="prv-modal-save" disabled={saving}>{saving ? <Loader2 className="animate-spin" size={15} /> : 'Guardar'}</button>
              </div>

              <div className="prv-modal-avatar">
                <span className="prv-modal-avatar-circle"><Building2 size={26} /></span>
              </div>

              <div className="prv-form-group">
                <label className="prv-form-row">
                  <span className="prv-form-row-icon"><Building2 size={15} /></span>
                  <span className="prv-form-row-content">
                    <span className="prv-form-row-label">Nombre *</span>
                    <input autoFocus placeholder="Nombre del proveedor" value={draft.name} onChange={(event) => updateDraft('name', event.target.value)} required />
                  </span>
                </label>
                <label className="prv-form-row">
                  <span className="prv-form-row-icon"><UserRound size={15} /></span>
                  <span className="prv-form-row-content">
                    <span className="prv-form-row-label">Persona de contacto</span>
                    <input placeholder="Opcional" value={draft.contact} onChange={(event) => updateDraft('contact', event.target.value)} />
                  </span>
                </label>
                <label className="prv-form-row">
                  <span className="prv-form-row-icon"><Phone size={15} /></span>
                  <span className="prv-form-row-content">
                    <span className="prv-form-row-label">Teléfono</span>
                    <input placeholder="Opcional" value={draft.phone} onChange={(event) => updateDraft('phone', event.target.value)} />
                  </span>
                </label>
                <label className="prv-form-row">
                  <span className="prv-form-row-icon"><Mail size={15} /></span>
                  <span className="prv-form-row-content">
                    <span className="prv-form-row-label">Correo</span>
                    <input type="email" placeholder="Opcional" value={draft.email} onChange={(event) => updateDraft('email', event.target.value)} />
                  </span>
                </label>
              </div>

              <label className="prv-form-notes">
                <span className="prv-form-row-label">Notas</span>
                <textarea rows={3} placeholder="Condiciones de pago, horarios de entrega…" value={draft.notes} onChange={(event) => updateDraft('notes', event.target.value)} />
              </label>
            </form>
          </section>
        </div>,
        document.body
      )}

      <section className="prv-card management-workspace-panel">
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

      {selected && createPortal(
        <div className={`prv-overlay ${closingSelected ? 'closing' : ''}`} role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) closeSelected() }}>
          <section className="prv-modal prv-modal-history" role="dialog" aria-modal="true" aria-labelledby="supplier-history-title" onClick={(e) => e.stopPropagation()}>
            <div className="prv-history-topbar">
              <div className="prv-history-who">
                <span className="prv-history-avatar">{selected.name.slice(0, 2).toUpperCase()}</span>
                <div>
                  <h2 id="supplier-history-title">{selected.name}</h2>
                  <p>Historial de compras</p>
                </div>
              </div>
              <button className="prv-modal-close-btn" aria-label="Cerrar historial" onClick={() => closeSelected()}><X size={18} /></button>
            </div>

            <div className="prv-history-split">
              <div className="prv-history-list-pane">
                <div className="prv-modal-summary prv-history-summary">
                  <span>{historyGroups.reduce((sum, g) => sum + g.items.length, 0)} compras esta semana</span>
                  <strong>{formatUsd(historyGroups.reduce((sum, g) => sum + g.total, 0))}</strong>
                </div>

                <div className="prv-history-nav">
                  <div className="prv-history-month-nav">
                    <button type="button" className="prv-history-month-btn" aria-label="Mes anterior" onClick={() => setHistoryMonthCursor((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))}>
                      <ChevronLeft size={16} />
                    </button>
                    <span className="prv-history-month-label">
                      {(() => {
                        const raw = historyMonthCursor.toLocaleDateString('es-VE', { month: 'long', year: 'numeric' })
                        return raw.charAt(0).toUpperCase() + raw.slice(1)
                      })()}
                    </span>
                    <button type="button" className="prv-history-month-btn" aria-label="Mes siguiente" disabled={!canGoNextHistoryMonth} onClick={() => setHistoryMonthCursor((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))}>
                      <ChevronRight size={16} />
                    </button>
                  </div>
                </div>

                <div className="prv-history-weeks" role="tablist" aria-label="Semana">
                  {historyWeeksInMonth.map((w) => (
                    <button
                      key={w.key}
                      type="button"
                      role="tab"
                      aria-selected={historyWeekStartKey === w.key}
                      className={`prv-history-week-btn ${historyWeekStartKey === w.key ? 'active' : ''}`}
                      onClick={() => setHistoryWeekStartKey(w.key)}
                    >
                      {w.label}
                    </button>
                  ))}
                </div>

                <div className="prv-purchases">
                  {historyGroups.map((group) => (
                    <section className="prv-history-group" key={group.key}>
                      <h3 className="prv-history-group-label">{group.label}</h3>
                      {group.items.map((purchase) => {
                        const isExpanded = expandedPurchaseId === purchase.id
                        return (
                          <article key={purchase.id} className={`prv-purchase-card ${isExpanded ? 'expanded' : ''}`}>
                            <button
                              type="button"
                              className="prv-purchase-summary"
                              aria-expanded={isExpanded}
                              onClick={() => setExpandedPurchaseId((current) => (current === purchase.id ? null : purchase.id))}
                            >
                              <span className="prv-purchase-icon"><ShoppingBag size={16} /></span>
                              <div className="prv-purchase-main">
                                <div className="prv-purchase-row">
                                  <b>{purchase.invoiceNumber ? `Factura ${purchase.invoiceNumber}` : 'Sin número de factura'}</b>
                                  <strong>{formatUsd(purchase.totalAmount)}</strong>
                                </div>
                                <div className="prv-items">{purchase.items.map((item) => `${item.quantity} ${item.unitSymbol} ${item.ingredientName}`).join(' · ') || 'Sin artículos'}</div>
                              </div>
                              <ChevronDown size={15} className="prv-purchase-chevron" />
                            </button>

                            {isExpanded && (
                              <div className="prv-purchase-details prv-purchase-details-inline">
                                {renderPurchaseDetail(purchase)}
                              </div>
                            )}
                          </article>
                        )
                      })}
                    </section>
                  ))}
                  {!selectedActivity?.history.length && <div className="prv-empty">Todavía no hay compras registradas con este proveedor.</div>}
                  {Boolean(selectedActivity?.history.length) && historyGroups.length === 0 && <div className="prv-empty">Sin compras en esta semana. Prueba con otra semana o mes.</div>}
                </div>
              </div>

              <aside className="prv-history-detail-pane">
                {selectedPurchase ? (
                  <>
                    <div className="prv-history-detail-head">
                      <span className="prv-purchase-icon"><ShoppingBag size={18} /></span>
                      <div>
                        <h3>{selectedPurchase.invoiceNumber ? `Factura ${selectedPurchase.invoiceNumber}` : 'Sin número de factura'}</h3>
                        <p>{new Date(`${selectedPurchase.purchaseDate}T12:00:00`).toLocaleDateString('es-VE', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
                      </div>
                      <strong>{formatUsd(selectedPurchase.totalAmount)}</strong>
                    </div>
                    <div className="prv-purchase-details">
                      {renderPurchaseDetail(selectedPurchase)}
                    </div>
                  </>
                ) : (
                  <div className="prv-history-detail-empty">
                    <ShoppingBag size={28} />
                    <p>Selecciona una compra para ver el detalle</p>
                  </div>
                )}
              </aside>
            </div>
          </section>
        </div>,
        document.body
      )}
    </div>
  )
}
