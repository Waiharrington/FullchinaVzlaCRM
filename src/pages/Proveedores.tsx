import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  Building2,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  Edit2,
  Eye,
  FileText,
  Loader2,
  Mail,
  Phone,
  Plus,
  Search,
  ShoppingBag,
  UserRound,
  Wallet,
  X,
} from 'lucide-react'
import Toast from '../components/Toast'
import { MoneyWithBcv } from '../components/MoneyWithBcv'
import { StyledSelect } from '../components/StyledSelect'
import { PageSkeleton } from '../components/PageSkeleton'
import { EmptyState } from '../components/EmptyState'
import {
  createSupplier,
  updateSupplier,
  getPurchases,
  getSuppliers,
  type Purchase,
  type Supplier,
} from '../lib/dataService'
import { formatUsd } from '../lib/money'
import { normalizeForSearch } from '../lib/textFormat'
import './Proveedores.css'

type SupplierDraft = { name: string; contact: string; phone: string; email: string; notes: string }
const EMPTY_DRAFT: SupplierDraft = { name: '', contact: '', phone: '', email: '', notes: '' }

type SortOption = 'purchases' | 'total' | 'name' | 'recent'
type FilterOption = 'all' | 'with-phone' | 'with-purchases'

function WhatsAppIcon({ size = 13 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" />
      <path d="M12.001 2C6.478 2 2 6.478 2 12c0 1.79.47 3.548 1.362 5.096L2 22l4.99-1.331A9.956 9.956 0 0 0 12.001 22C17.523 22 22 17.523 22 12S17.523 2 12.001 2zm0 18.15a8.126 8.126 0 0 1-4.15-1.132l-.297-.176-3.11.83.83-3.033-.194-.312A8.104 8.104 0 0 1 3.85 12c0-4.49 3.66-8.15 8.15-8.15S20.15 7.51 20.15 12 16.49 20.15 12 20.15z" />
    </svg>
  )
}

const AVATAR_COLORS = [
  'linear-gradient(135deg, #e11d2a, #7f1d1d)',
  'linear-gradient(135deg, #ea580c, #9a3412)',
  'linear-gradient(135deg, #ca8a04, #854d0e)',
  'linear-gradient(135deg, #b91c1c, #450a0a)',
  'linear-gradient(135deg, #d97706, #78350f)',
]

function getAvatarBg(name: string): string {
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0
  return AVATAR_COLORS[hash % AVATAR_COLORS.length]
}

function formatRelativeDays(value?: string | null): string {
  if (!value) return ''
  const d = new Date(value.length <= 10 ? `${value}T12:00:00` : value)
  if (Number.isNaN(d.getTime())) return ''
  const days = Math.max(0, Math.floor((Date.now() - d.getTime()) / 86400000))
  if (days < 1) return 'Hoy'
  if (days === 1) return 'Ayer'
  return `Hace ${days} d`
}

function formatDate(value?: string | null): string {
  if (!value) return '—'
  const d = new Date(value.length <= 10 ? `${value}T12:00:00` : value)
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('es-VE', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

export function Proveedores() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [purchases, setPurchases] = useState<Purchase[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [search, setSearch] = useState('')
  const [sortBy, setSortBy] = useState<SortOption>('purchases')
  const [filterContact, setFilterContact] = useState<FilterOption>('all')

  // Create Modal state
  const [showForm, setShowForm] = useState(false)
  const [closingForm, setClosingForm] = useState(false)
  const [draft, setDraft] = useState<SupplierDraft>(EMPTY_DRAFT)

  // Edit Modal state
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null)
  const [showEditModal, setShowEditModal] = useState(false)
  const [closingEditModal, setClosingEditModal] = useState(false)
  const [editDraft, setEditDraft] = useState<SupplierDraft>(EMPTY_DRAFT)

  // History Modal state
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [closingSelected, setClosingSelected] = useState(false)
  const [historyMonthCursor, setHistoryMonthCursor] = useState(() => {
    const n = new Date()
    return new Date(n.getFullYear(), n.getMonth(), 1)
  })
  const [historyWeekStartKey, setHistoryWeekStartKey] = useState<string | null>(null)
  const [expandedPurchaseId, setExpandedPurchaseId] = useState<string | null>(null)
  const [historyPage, setHistoryPage] = useState(1)
  const HISTORY_PAGE_SIZE = 10

  const timeoutsRef = useRef<number[]>([])

  const safeTimeout = useCallback((fn: () => void, ms: number) => {
    const id = window.setTimeout(() => {
      timeoutsRef.current = timeoutsRef.current.filter((t) => t !== id)
      fn()
    }, ms)
    timeoutsRef.current.push(id)
    return id
  }, [])

  useEffect(() => {
    return () => {
      timeoutsRef.current.forEach((id) => clearTimeout(id))
      timeoutsRef.current = []
    }
  }, [])

  useEffect(() => {
    if (!selectedId) return
    setExpandedPurchaseId(null)
    const n = new Date()
    setHistoryMonthCursor(new Date(n.getFullYear(), n.getMonth(), 1))
    setHistoryWeekStartKey(null)
    setHistoryPage(1)
  }, [selectedId])

  const closeSelected = (then?: () => void) => {
    if (closingSelected) return
    setClosingSelected(true)
    safeTimeout(() => {
      setSelectedId(null)
      setClosingSelected(false)
      then?.()
    }, 200)
  }

  const closeForm = () => {
    if (closingForm) return
    setClosingForm(true)
    safeTimeout(() => {
      setShowForm(false)
      setClosingForm(false)
    }, 200)
  }

  const openEditModal = (supplier: Supplier) => {
    setEditingSupplier(supplier)
    setEditDraft({
      name: supplier.name,
      contact: supplier.contact ?? '',
      phone: supplier.phone ?? '',
      email: supplier.email ?? '',
      notes: supplier.notes ?? '',
    })
    setShowEditModal(true)
  }

  const closeEditModal = () => {
    if (closingEditModal) return
    setClosingEditModal(true)
    safeTimeout(() => {
      setShowEditModal(false)
      setEditingSupplier(null)
      setClosingEditModal(false)
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
    let list = suppliers

    if (query) {
      list = list.filter((supplier) => [supplier.name, supplier.contact, supplier.phone, supplier.email]
        .some((value) => value && normalizeForSearch(value).includes(query)))
    }

    if (filterContact === 'with-phone') {
      list = list.filter((s) => Boolean(s.phone && s.phone.trim().length > 0))
    } else if (filterContact === 'with-purchases') {
      list = list.filter((s) => {
        const stats = activity.get(s.id)
        return (stats?.history.length ?? 0) > 0
      })
    }

    return [...list].sort((a, b) => {
      const statsA = activity.get(a.id)
      const statsB = activity.get(b.id)

      if (sortBy === 'purchases') {
        const countA = statsA?.history.length ?? 0
        const countB = statsB?.history.length ?? 0
        return countB - countA || a.name.localeCompare(b.name, 'es')
      }
      if (sortBy === 'total') {
        const totalA = statsA?.total ?? 0
        const totalB = statsB?.total ?? 0
        return totalB - totalA || a.name.localeCompare(b.name, 'es')
      }
      if (sortBy === 'recent') {
        const dateA = statsA?.last ? new Date(`${statsA.last.purchaseDate}T12:00:00`).getTime() : 0
        const dateB = statsB?.last ? new Date(`${statsB.last.purchaseDate}T12:00:00`).getTime() : 0
        return dateB - dateA || a.name.localeCompare(b.name, 'es')
      }
      return a.name.localeCompare(b.name, 'es')
    })
  }, [search, suppliers, filterContact, sortBy, activity])

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

  const historyRows = useMemo(() => historyGroups.flatMap((group) => group.items.map((purchase) => ({ group, purchase }))), [historyGroups])
  const historyTotalPages = Math.max(1, Math.ceil(historyRows.length / HISTORY_PAGE_SIZE))
  const safeHistoryPage = Math.min(historyPage, historyTotalPages)
  const visibleHistoryRows = historyRows.slice((safeHistoryPage - 1) * HISTORY_PAGE_SIZE, safeHistoryPage * HISTORY_PAGE_SIZE)
  const visibleHistoryGroups = useMemo(() => {
    const grouped = new Map<string, { group: typeof historyGroups[number]; items: Purchase[] }>()
    visibleHistoryRows.forEach(({ group, purchase }) => {
      if (!grouped.has(group.key)) grouped.set(group.key, { group, items: [] })
      grouped.get(group.key)!.items.push(purchase)
    })
    return [...grouped.values()]
  }, [visibleHistoryRows])

  useEffect(() => { setHistoryPage(1) }, [historyWeekStartKey, historyMonthCursor, selectedId])

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
  const updateEditDraft = (field: keyof SupplierDraft, value: string) => setEditDraft((current) => ({ ...current, [field]: value }))

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
      safeTimeout(() => setNotice(''), 3500)
      await load()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'No se pudo guardar el proveedor')
    } finally {
      setSaving(false)
    }
  }

  const handleUpdateSupplier = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!editingSupplier || !editDraft.name.trim()) return
    setSaving(true)
    setError('')
    try {
      await updateSupplier(editingSupplier.id, {
        name: editDraft.name.trim(),
        contact: editDraft.contact.trim() || undefined,
        phone: editDraft.phone.trim() || undefined,
        email: editDraft.email.trim() || undefined,
        notes: editDraft.notes.trim() || undefined,
      })
      closeEditModal()
      setNotice('Proveedor actualizado correctamente')
      safeTimeout(() => setNotice(''), 3500)
      await load()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'No se pudo actualizar el proveedor')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <PageSkeleton cards={3} rows={8} hasTable />

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

      {/* KPI Cards */}
      <section className="prv-kpis management-workspace-metrics" aria-label="Resumen de proveedores">
        <article className="prv-kpi-card red">
          <span><Building2 size={20} /></span>
          <div>
            <small>Proveedores activos</small>
            <strong>{suppliers.length}</strong>
          </div>
        </article>
        <article className="prv-kpi-card purple">
          <span><ShoppingBag size={20} /></span>
          <div>
            <small>Compras registradas</small>
            <strong>{purchases.length}</strong>
          </div>
        </article>
        <article className="prv-kpi-card green">
          <span><CalendarDays size={20} /></span>
          <div>
            <small>Total comprado</small>
            <MoneyWithBcv usd={totalPurchased} compact align="start" className="prv-kpi-money" usdClassName="prv-kpi-strong" />
          </div>
        </article>
      </section>

      {/* Directory Table Card */}
      <section className="prv-table-card management-workspace-panel">
        <div className="prv-toolbar">
          <div className="prv-toolbar-left">
            <h2>Directorio</h2>
            <p>{filtered.length} de {suppliers.length} proveedores</p>
          </div>

          <div className="prv-toolbar-right">
            <div className="prv-search">
              <Search size={16} />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Buscar por nombre, contacto o teléfono..."
              />
              {search && (
                <button type="button" className="search-clear-btn" onClick={() => setSearch('')} aria-label="Borrar búsqueda">
                  <X size={13} />
                </button>
              )}
            </div>

            <div className="prv-filter-dropdown-wrap">
              <span className="dropdown-label">Ordenar</span>
              <StyledSelect
                className="prv-filter-select"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortOption)}
              >
                <option value="purchases">Más compras</option>
                <option value="total">Mayor total ($)</option>
                <option value="name">Nombre (A - Z)</option>
                <option value="recent">Última compra</option>
              </StyledSelect>
            </div>

            <div className="prv-filter-dropdown-wrap">
              <span className="dropdown-label">Filtro</span>
              <StyledSelect
                className="prv-filter-select"
                value={filterContact}
                onChange={(e) => setFilterContact(e.target.value as FilterOption)}
              >
                <option value="all">Todos</option>
                <option value="with-phone">Con teléfono</option>
                <option value="with-purchases">Con compras</option>
              </StyledSelect>
            </div>
          </div>
        </div>

        <div className="table-responsive-wrapper">
          <table className="prv-custom-table">
            <thead>
              <tr>
                <th>Proveedor</th>
                <th>Persona de contacto</th>
                <th>Teléfono / Correo</th>
                <th className="amount-th" style={{ textAlign: 'center' }}>Compras</th>
                <th className="amount-th">Total Acumulado</th>
                <th>Última Compra</th>
                <th style={{ textAlign: 'center' }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7}>
                    <EmptyState
                      compact
                      title="No se encontraron proveedores"
                      description="Prueba con otro término de búsqueda o agrega un proveedor nuevo."
                    />
                  </td>
                </tr>
              ) : (
                filtered.map((supplier) => {
                  const stats = activity.get(supplier.id)
                  const purchaseCount = stats?.history.length ?? 0
                  const totalAmount = stats?.total ?? 0
                  const lastPurchaseDate = stats?.last?.purchaseDate ?? null
                  const cleanPhone = supplier.phone ? supplier.phone.replace(/\D/g, '') : ''

                  return (
                    <tr
                      key={supplier.id}
                      className="clickable-row prv-table-row"
                      onClick={() => setSelectedId(supplier.id)}
                    >
                      {/* Proveedor / Avatar */}
                      <td>
                        <div className="prv-supplier-cell">
                          <span
                            className="prv-cell-avatar"
                            style={{ background: getAvatarBg(supplier.name) }}
                          >
                            {supplier.name.slice(0, 2).toUpperCase()}
                          </span>
                          <span className="prv-supplier-name">{supplier.name}</span>
                        </div>
                      </td>

                      {/* Contacto */}
                      <td>
                        {supplier.contact ? (
                          <div className="prv-contact-person">
                            <UserRound size={13} className="prv-icon-muted" />
                            <span>{supplier.contact}</span>
                          </div>
                        ) : (
                          <span className="prv-empty-text">Sin contacto</span>
                        )}
                      </td>

                      {/* Teléfono / Correo */}
                      <td>
                        <div className="prv-contact-cell">
                          {supplier.phone ? (
                            <div className="prv-phone-row">
                              <span className="prv-phone-text">
                                <Phone size={12} className="prv-icon-muted" /> {supplier.phone}
                              </span>
                              <button
                                type="button"
                                className="prv-wsap-pill"
                                aria-label={`Enviar WhatsApp a ${supplier.name}`}
                                title={`Enviar WhatsApp a ${supplier.name}`}
                                onClick={(e) => {
                                  e.stopPropagation()
                                  if (cleanPhone) {
                                    const waNumber = cleanPhone.startsWith('58') ? cleanPhone : `58${cleanPhone.replace(/^0/, '')}`
                                    window.open(`https://wa.me/${waNumber}`, '_blank', 'noopener,noreferrer')
                                  }
                                }}
                              >
                                <WhatsAppIcon size={14} />
                              </button>
                            </div>
                          ) : null}

                          {supplier.email ? (
                            <div className="prv-email-text">
                              <Mail size={12} className="prv-icon-muted" />
                              <span>{supplier.email}</span>
                            </div>
                          ) : null}

                          {!supplier.phone && !supplier.email && (
                            <span className="prv-empty-text">Sin datos</span>
                          )}
                        </div>
                      </td>

                      {/* Compras */}
                      <td style={{ textAlign: 'center' }}>
                        <span className={`prv-purchases-badge ${purchaseCount > 0 ? 'active' : 'zero'}`}>
                          {purchaseCount} {purchaseCount === 1 ? 'compra' : 'compras'}
                        </span>
                      </td>

                      {/* Total Acumulado */}
                      <td className="amount-td">
                        <MoneyWithBcv
                          usd={totalAmount}
                          className={totalAmount === 0 ? 'text-muted-amount' : 'text-green'}
                          usdClassName="font-bold"
                          compact
                        />
                      </td>

                      {/* Última Compra */}
                      <td>
                        {lastPurchaseDate ? (
                          <div className="prv-date-cell">
                            <span className="prv-date-main">{formatDate(lastPurchaseDate)}</span>
                            <span className="prv-date-sub">{formatRelativeDays(lastPurchaseDate)}</span>
                          </div>
                        ) : (
                          <span className="prv-empty-text">Sin compras</span>
                        )}
                      </td>

                      {/* Acciones */}
                      <td>
                        <div className="prv-actions-flex" onClick={(e) => e.stopPropagation()}>
                          <button
                            type="button"
                            className="prv-icon-action-btn"
                            title="Ver historial de compras"
                            onClick={() => setSelectedId(supplier.id)}
                          >
                            <Eye size={15} />
                          </button>
                          <button
                            type="button"
                            className="prv-icon-action-btn"
                            title="Editar proveedor"
                            onClick={() => openEditModal(supplier)}
                          >
                            <Edit2 size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Modal Nuevo Proveedor */}
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
                    <input placeholder="Nombre de contacto (opcional)" value={draft.contact} onChange={(event) => updateDraft('contact', event.target.value)} />
                  </span>
                </label>
                <label className="prv-form-row">
                  <span className="prv-form-row-icon"><Phone size={15} /></span>
                  <span className="prv-form-row-content">
                    <span className="prv-form-row-label">Teléfono</span>
                    <input placeholder="Ej. 0414-1234567" value={draft.phone} onChange={(event) => updateDraft('phone', event.target.value)} />
                  </span>
                </label>
                <label className="prv-form-row">
                  <span className="prv-form-row-icon"><Mail size={15} /></span>
                  <span className="prv-form-row-content">
                    <span className="prv-form-row-label">Correo</span>
                    <input type="email" placeholder="correo@ejemplo.com" value={draft.email} onChange={(event) => updateDraft('email', event.target.value)} />
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

      {/* Modal Editar Proveedor */}
      {showEditModal && editingSupplier && createPortal(
        <div className={`prv-overlay ${closingEditModal ? 'closing' : ''}`} role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) closeEditModal() }}>
          <section className="prv-modal prv-modal-supplier" role="dialog" aria-modal="true" aria-labelledby="edit-supplier-title">
            <form onSubmit={handleUpdateSupplier}>
              <div className="prv-modal-topbar">
                <button type="button" className="prv-modal-cancel" onClick={() => closeEditModal()}>Cancelar</button>
                <h2 id="edit-supplier-title">Editar proveedor</h2>
                <button type="submit" className="prv-modal-save" disabled={saving}>{saving ? <Loader2 className="animate-spin" size={15} /> : 'Guardar'}</button>
              </div>

              <div className="prv-modal-avatar">
                <span className="prv-modal-avatar-circle" style={{ background: getAvatarBg(editDraft.name || editingSupplier.name) }}>
                  {(editDraft.name || editingSupplier.name).slice(0, 2).toUpperCase()}
                </span>
              </div>

              <div className="prv-form-group">
                <label className="prv-form-row">
                  <span className="prv-form-row-icon"><Building2 size={15} /></span>
                  <span className="prv-form-row-content">
                    <span className="prv-form-row-label">Nombre *</span>
                    <input autoFocus placeholder="Nombre del proveedor" value={editDraft.name} onChange={(event) => updateEditDraft('name', event.target.value)} required />
                  </span>
                </label>
                <label className="prv-form-row">
                  <span className="prv-form-row-icon"><UserRound size={15} /></span>
                  <span className="prv-form-row-content">
                    <span className="prv-form-row-label">Persona de contacto</span>
                    <input placeholder="Nombre de contacto (opcional)" value={editDraft.contact} onChange={(event) => updateEditDraft('contact', event.target.value)} />
                  </span>
                </label>
                <label className="prv-form-row">
                  <span className="prv-form-row-icon"><Phone size={15} /></span>
                  <span className="prv-form-row-content">
                    <span className="prv-form-row-label">Teléfono</span>
                    <input placeholder="Ej. 0414-1234567" value={editDraft.phone} onChange={(event) => updateEditDraft('phone', event.target.value)} />
                  </span>
                </label>
                <label className="prv-form-row">
                  <span className="prv-form-row-icon"><Mail size={15} /></span>
                  <span className="prv-form-row-content">
                    <span className="prv-form-row-label">Correo</span>
                    <input type="email" placeholder="correo@ejemplo.com" value={editDraft.email} onChange={(event) => updateEditDraft('email', event.target.value)} />
                  </span>
                </label>
              </div>

              <label className="prv-form-notes">
                <span className="prv-form-row-label">Notas</span>
                <textarea rows={3} placeholder="Condiciones de pago, horarios de entrega…" value={editDraft.notes} onChange={(event) => updateEditDraft('notes', event.target.value)} />
              </label>
            </form>
          </section>
        </div>,
        document.body
      )}

      {/* Modal Historial de Compras */}
      {selected && createPortal(
        <div className={`prv-overlay ${closingSelected ? 'closing' : ''}`} role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) closeSelected() }}>
          <section className="prv-modal prv-modal-history" role="dialog" aria-modal="true" aria-labelledby="supplier-history-title" onClick={(e) => e.stopPropagation()}>
            <div className="prv-history-topbar">
              <div className="prv-history-who">
                <span className="prv-history-avatar" style={{ background: getAvatarBg(selected.name) }}>
                  {selected.name.slice(0, 2).toUpperCase()}
                </span>
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
                  {visibleHistoryGroups.map(({ group, items }) => (
                    <section className="prv-history-group" key={group.key}>
                      <h3 className="prv-history-group-label">{group.label}</h3>
                      {items.map((purchase) => {
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
                  {historyRows.length > HISTORY_PAGE_SIZE && <div className="prv-history-pagination"><button type="button" disabled={safeHistoryPage === 1} onClick={() => setHistoryPage((p) => Math.max(1, p - 1))}><ChevronLeft size={15} /> Anterior</button><span>Página {safeHistoryPage} de {historyTotalPages}</span><button type="button" disabled={safeHistoryPage === historyTotalPages} onClick={() => setHistoryPage((p) => Math.min(historyTotalPages, p + 1))}>Siguiente <ChevronRight size={15} /></button></div>}
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
