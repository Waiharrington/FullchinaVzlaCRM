import { useEffect, useMemo, useState, useCallback } from 'react'
import { useAuth } from '../context/auth-context'
import {
  createWeeklyDish, getWeeklyDishes, setWeeklyDishActive, syncWeeklyDishToCatalog,
  updateWeeklyDish, recordWeeklyActivation, removeWeeklyActivation, getWeekActivations,
  getWeeklyActivationSummary, type WeeklyDish,
} from '../lib/dataService'
import { formatUsd } from '../lib/money'
import { PageSkeleton } from '../components/PageSkeleton'
import NumberStepper from '../components/NumberStepper'
import {
  Utensils, Plus, Flame, Library, Link2, CalendarDays, Search, Check, AlertTriangle,
  HelpCircle, Pencil, X, Loader2, ShoppingCart, ChevronLeft, ChevronRight, ImagePlus,
  UtensilsCrossed,
} from 'lucide-react'
import Toast from '../components/Toast'
import { EmptyState } from '../components/EmptyState'
import './MenuSemanal.css'
import { formatProductTitle, formatSpanishText, normalizeForSearch } from '../lib/textFormat'

const MONTHS = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']
const mondayOf = (d: Date) => { const x = new Date(d.getFullYear(), d.getMonth(), d.getDate()); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return x }
const addDays = (d: Date, n: number) => { const x = new Date(d); x.setDate(x.getDate() + n); return x }
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
function weekLabel(startIso: string): string {
  const [y, m, dd] = startIso.split('-').map(Number)
  const mon = new Date(y, m - 1, dd), sun = addDays(mon, 6)
  if (mon.getMonth() === sun.getMonth()) return `${mon.getDate()} – ${sun.getDate()} ${MONTHS[sun.getMonth()]} ${sun.getFullYear()}`
  return `${mon.getDate()} ${MONTHS[mon.getMonth()].slice(0, 3)} – ${sun.getDate()} ${MONTHS[sun.getMonth()].slice(0, 3)} ${sun.getFullYear()}`
}
function shortWeek(startIso: string): string {
  const [y, m, dd] = startIso.split('-').map(Number), mon = new Date(y, m - 1, dd)
  return `Semana del ${mon.getDate()} ${MONTHS[mon.getMonth()].slice(0, 3)} ${mon.getFullYear()}`
}
function fileToScaledDataUrl(file: File, max = 420): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('No se pudo leer la imagen'))
    reader.onload = () => {
      const img = new Image()
      img.onerror = () => reject(new Error('Imagen inválida'))
      img.onload = () => {
        const scale = Math.min(1, max / Math.max(img.width, img.height))
        const w = Math.round(img.width * scale), h = Math.round(img.height * scale)
        const canvas = document.createElement('canvas'); canvas.width = w; canvas.height = h
        const ctx = canvas.getContext('2d'); if (!ctx) return reject(new Error('Sin canvas'))
        ctx.drawImage(img, 0, 0, w, h)
        resolve(canvas.toDataURL('image/jpeg', 0.72))
      }
      img.src = reader.result as string
    }
    reader.readAsDataURL(file)
  })
}

const PAGE_SIZE = 10
type CatTab = 'todos' | 'activos' | 'inactivos'
interface DishForm { emoji: string; name: string; description: string; price: string; cost: string; imageUrl: string | null }
const emptyForm: DishForm = { emoji: '', name: '', description: '', price: '7.5', cost: '2.5', imageUrl: null }

export function MenuSemanal() {
  const { user } = useAuth()
  const [dishes, setDishes] = useState<WeeklyDish[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busyId, setBusyId] = useState<string | null>(null)

  const [search, setSearch] = useState('')
  const [catTab, setCatTab] = useState<CatTab>('todos')
  const [page, setPage] = useState(1)

  // Navegador de semanas
  const todayMonday = useMemo(() => mondayOf(new Date()), [])
  const [viewMonday, setViewMonday] = useState<Date>(todayMonday)
  const viewStart = iso(viewMonday)
  const isCurrentWeek = viewStart === iso(todayMonday)
  const [weekActiveIds, setWeekActiveIds] = useState<Set<string>>(new Set())

  // Calendario
  const [showCalendar, setShowCalendar] = useState(false)
  const [weekSummary, setWeekSummary] = useState<Array<{ weekStart: string; weekEnd: string; count: number }>>([])

  // Crear / editar
  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState<DishForm>(emptyForm)
  const [activateNow, setActivateNow] = useState(true)
  const [addToCaja, setAddToCaja] = useState(true)
  const [saving, setSaving] = useState(false)
  const [editing, setEditing] = useState<WeeklyDish | null>(null)
  const [editForm, setEditForm] = useState<DishForm>(emptyForm)

  const load = useCallback(async () => {
    try { setLoading(true); setDishes(await getWeeklyDishes()) }
    catch (e) { setError(e instanceof Error ? e.message : 'No se pudo cargar el menú semanal') }
    finally { setLoading(false) }
  }, [])
  useEffect(() => { void load() }, [load])

  // Al navegar a una semana pasada, cargar qué platos estuvieron activos.
  useEffect(() => {
    if (isCurrentWeek) return
    getWeekActivations(viewStart).then((ids) => setWeekActiveIds(new Set(ids))).catch(() => setWeekActiveIds(new Set()))
  }, [viewStart, isCurrentWeek])

  const flash = (msg: string) => { setNotice(msg); setTimeout(() => setNotice(''), 3500) }

  const active = dishes.filter((d) => d.status === 'active')
  const inCatalog = dishes.filter((d) => d.sellableProductId)
  const thisWeekDishes = isCurrentWeek ? active : dishes.filter((d) => weekActiveIds.has(d.id))

  const filtered = useMemo(() => {
    const q = normalizeForSearch(search)
    return dishes.filter((d) => {
      if (q && !normalizeForSearch(d.name).includes(q)) return false
      if (catTab === 'activos' && d.status !== 'active') return false
      if (catTab === 'inactivos' && d.status !== 'inactive') return false
      return true
    })
  }, [dishes, search, catTab])
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const safePage = Math.min(page, totalPages)
  const pageItems = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)
  useEffect(() => { setPage(1) }, [search, catTab])

  const runAction = async (id: string, fn: () => Promise<void>, ok: string) => {
    setBusyId(id); setError('')
    try { await fn(); await load(); flash(ok) }
    catch (e) { setError(e instanceof Error ? e.message : 'Error en la operación') }
    finally { setBusyId(null) }
  }

  const setActive = (d: WeeklyDish, next: boolean) => runAction(d.id, async () => {
    await setWeeklyDishActive(d.id, next)
    if (next) {
      await recordWeeklyActivation(d.id, iso(todayMonday), iso(addDays(todayMonday, 6)), user?.id ?? '')
      await updateWeeklyDish(d.id, { weekTag: weekLabel(iso(todayMonday)) })
    } else {
      await removeWeeklyActivation(d.id, iso(todayMonday))
    }
    if (d.sellableProductId) await syncWeeklyDishToCatalog(d.id)
  }, next ? `"${d.name}" activado para esta semana` : `"${d.name}" desactivado`)

  const addToCajaAction = (d: WeeklyDish) => runAction(d.id, async () => {
    await syncWeeklyDishToCatalog(d.id)
  }, `"${d.name}" ya está disponible en Caja`)

  const activateAndCaja = (d: WeeklyDish) => runAction(d.id, async () => {
    await setWeeklyDishActive(d.id, true)
    await recordWeeklyActivation(d.id, iso(todayMonday), iso(addDays(todayMonday, 6)), user?.id ?? '')
    await updateWeeklyDish(d.id, { weekTag: weekLabel(iso(todayMonday)) })
    await syncWeeklyDishToCatalog(d.id)
  }, `"${d.name}" activado y disponible en Caja`)

  const pickImage = async (file: File | undefined, setter: (url: string) => void) => {
    if (!file) return
    try { setter(await fileToScaledDataUrl(file)) }
    catch (e) { setError(e instanceof Error ? e.message : 'No se pudo procesar la imagen') }
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user || !form.name.trim()) return
    setSaving(true); setError('')
    try {
      const dish = await createWeeklyDish({
        name: formatProductTitle(form.name), description: formatSpanishText(form.description.trim()),
        price: parseFloat(form.price) || 0, cost: parseFloat(form.cost) || 0,
        emoji: form.emoji || '', weekTag: activateNow ? weekLabel(iso(todayMonday)) : '',
        imageUrl: form.imageUrl,
      }, user.id)
      if (activateNow) await recordWeeklyActivation(dish.id, iso(todayMonday), iso(addDays(todayMonday, 6)), user.id)
      else await setWeeklyDishActive(dish.id, false)
      if (addToCaja) await syncWeeklyDishToCatalog(dish.id)
      await load()
      flash(`Plato "${dish.name}" guardado${activateNow ? ' y activado' : ''}${addToCaja ? ' · disponible en Caja' : ''}`)
      setShowCreate(false); setForm(emptyForm); setActivateNow(true); setAddToCaja(true)
    } catch (e) { setError(e instanceof Error ? e.message : 'Error al crear el plato') }
    finally { setSaving(false) }
  }

  const openEdit = (d: WeeklyDish) => {
    setEditing(d)
    setEditForm({ emoji: d.emoji, name: d.name, description: d.description, price: String(d.price), cost: String(d.cost), imageUrl: d.imageUrl })
  }
  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editing) return
    setSaving(true); setError('')
    try {
      await updateWeeklyDish(editing.id, {
        emoji: editForm.emoji, name: formatProductTitle(editForm.name), description: formatSpanishText(editForm.description.trim()),
        price: parseFloat(editForm.price) || 0, cost: parseFloat(editForm.cost) || 0, imageUrl: editForm.imageUrl,
      })
      if (editing.sellableProductId) await syncWeeklyDishToCatalog(editing.id)
      await load()
      flash(`"${editForm.name}" actualizado${editing.sellableProductId ? ' (también en Caja)' : ''}`)
      setEditing(null)
    } catch (e) { setError(e instanceof Error ? e.message : 'Error al actualizar') }
    finally { setSaving(false) }
  }

  const openCalendar = async () => {
    setShowCalendar(true)
    try { setWeekSummary(await getWeeklyActivationSummary()) } catch { setWeekSummary([]) }
  }

  if (loading) return <PageSkeleton cards={4} rows={4} hasTable={false} />

  const margin = (d: WeeklyDish) => d.price - d.cost
  const thumb = (d: WeeklyDish, cls: string) => d.imageUrl
    ? <img className={cls} src={d.imageUrl} alt={d.name} loading="lazy" />
    : <span className={cls}><UtensilsCrossed size={16} /></span>

  return (
    <div className="page ws-page animate-fade-in">
      <header className="page-header">
        <div>
          <h1 className="page-title"><Utensils size={22} className="page-title-icon" /> Menú Semanal</h1>
          <p className="page-subtitle">Administra los especiales rotativos y decide cuáles están disponibles esta semana.</p>
        </div>
        <div className="ws-head-actions">
          <button className="ws-help" onClick={() => flash('Crea un plato especial, actívalo para la semana y agrégalo a Caja para venderlo. Los platos quedan guardados para reusarlos.')}>
            <HelpCircle size={15} /> ¿Cómo funciona?
          </button>
          <button className="ws-create-btn" onClick={() => { setForm(emptyForm); setActivateNow(true); setAddToCaja(true); setShowCreate(true) }}>
            <Plus size={16} /> Crear plato especial
          </button>
        </div>
      </header>

      {error && <Toast type="error" message={error} onClose={() => setError('')} />}
      {notice && <Toast type="success" message={notice} onClose={() => setNotice('')} />}

      <div className="ws-summary">
        <div className="ws-sum-card">
          <span className="ws-sum-ic" style={{ background: 'rgba(225,29,42,0.15)', color: '#e11d2a' }}><Flame size={20} /></span>
          <div><div className="ws-sum-val">{active.length}</div><div className="ws-sum-lbl">Activos esta semana</div><div className="ws-sum-sub">Disponibles para tus clientes</div></div>
        </div>
        <div className="ws-sum-card">
          <span className="ws-sum-ic" style={{ background: 'rgba(124,58,237,0.15)', color: '#a78bfa' }}><Library size={20} /></span>
          <div><div className="ws-sum-val">{dishes.length}</div><div className="ws-sum-lbl">Platos guardados</div><div className="ws-sum-sub">En tu catálogo rotativo</div></div>
        </div>
        <div className="ws-sum-card">
          <span className="ws-sum-ic" style={{ background: 'rgba(16,185,129,0.15)', color: '#10b981' }}><Link2 size={20} /></span>
          <div><div className="ws-sum-val">{inCatalog.length}</div><div className="ws-sum-lbl">En catálogo (Caja)</div><div className="ws-sum-sub">Disponibles para vender</div></div>
        </div>
        <div className="ws-sum-card">
          <span className="ws-sum-ic" style={{ background: 'rgba(255,255,255,0.06)', color: '#d4d4d8' }}><CalendarDays size={20} /></span>
          <div style={{ flex: 1 }}>
            <div className="ws-sum-lbl" style={{ marginTop: 0 }}>{isCurrentWeek ? 'Semana actual' : 'Semana'}</div>
            <div className="ws-sum-val" style={{ fontSize: 15 }}>{weekLabel(viewStart)}</div>
          </div>
          <div className="ws-week-nav">
            <button onClick={() => setViewMonday((m) => addDays(m, -7))} title="Semana anterior"><ChevronLeft size={16} /></button>
            <button onClick={() => setViewMonday((m) => addDays(m, 7))} disabled={isCurrentWeek} title="Semana siguiente"><ChevronRight size={16} /></button>
          </div>
        </div>
      </div>

      <div className="ws-section-head">
        <div className="ws-section-title">
          <Flame size={18} style={{ color: '#e11d2a' }} />
          <div><h2>{isCurrentWeek ? 'Esta semana' : `Semana: ${weekLabel(viewStart)}`}</h2><p>{isCurrentWeek ? 'Platos activos que tus clientes pueden pedir.' : 'Platos que estuvieron activos esa semana (solo lectura).'}</p></div>
        </div>
        <button className="ws-help" onClick={openCalendar}><CalendarDays size={15} /> Ver calendario</button>
      </div>

      {thisWeekDishes.length === 0 ? (
        <div className="ws-catalog" style={{ textAlign: 'center', color: '#a1a1aa', marginTop: 0 }}>
          {isCurrentWeek ? 'No hay platos activos esta semana. Actívalos desde el catálogo o crea uno nuevo.' : 'Ningún plato estuvo activo esa semana.'}
        </div>
      ) : (
        <div className="ws-grid">
          {thisWeekDishes.map((d) => (
            <div key={d.id} className="ws-card on">
              <div className="ws-card-top">
                {thumb(d, 'ws-card-thumb')}
                <div className="ws-card-title">
                  {d.weekTag && <div className="ws-card-week">{d.weekTag}</div>}
                  <h3>{formatProductTitle(d.name)}</h3>
                  <p className="ws-card-desc">{d.description || 'Sin descripción'}</p>
                </div>
                {isCurrentWeek && <button className="ws-switch on" title="Desactivar" disabled={busyId === d.id} onClick={() => setActive(d, false)} />}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                <div><div className="ws-price">{formatUsd(d.price)}</div>
                  <div className="ws-cost">Costo: {formatUsd(d.cost)} · Margen: <span className="marg">{formatUsd(margin(d))}</span></div>
                </div>
              </div>
              <div className="ws-card-foot">
                {d.sellableProductId
                  ? <span className="ws-badge ok"><Check size={13} /> En catálogo (Caja)</span>
                  : <span className="ws-badge warn"><AlertTriangle size={13} /> No en catálogo</span>}
                {isCurrentWeek && (
                  <div style={{ display: 'flex', gap: 8 }}>
                    {!d.sellableProductId && <button className="ws-btn-sm red" disabled={busyId === d.id} onClick={() => addToCajaAction(d)}><Link2 size={14} /> Agregar a Caja</button>}
                    <button className="ws-btn-sm" onClick={() => openEdit(d)}><Pencil size={14} /> Editar</button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="ws-catalog">
        <div className="ws-section-title" style={{ marginBottom: 12 }}>
          <Library size={18} style={{ color: '#a78bfa' }} />
          <div><h2>Catálogo de platos rotativos</h2><p>Todos tus platos especiales guardados. Actívalos cuando quieras.</p></div>
        </div>

        <div className="ws-cat-tools">
          <div className="ws-tabs">
            <button className={`ws-tab${catTab === 'todos' ? ' active' : ''}`} onClick={() => setCatTab('todos')}>Todos <span className="ws-c">{dishes.length}</span></button>
            <button className={`ws-tab${catTab === 'activos' ? ' active' : ''}`} onClick={() => setCatTab('activos')}>Activos <span className="ws-c">{active.length}</span></button>
            <button className={`ws-tab${catTab === 'inactivos' ? ' active' : ''}`} onClick={() => setCatTab('inactivos')}>Inactivos <span className="ws-c">{dishes.length - active.length}</span></button>
          </div>
          <div className="ws-search"><Search size={15} className="ic" /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar plato..." />{search && <button type="button" className="search-clear-btn search-clear-btn--floating" onClick={() => setSearch('')} aria-label="Borrar búsqueda"><X size={13} /></button>}</div>
        </div>

        <div className="ws-table-wrap">
          <table className="ws-table">
            <thead><tr><th>Plato</th><th>Descripción</th><th>Última vez</th><th>Precio</th><th>Costo</th><th>Estado</th><th>En catálogo</th><th>Acción</th></tr></thead>
            <tbody>
              {pageItems.map((d) => (
                <tr key={d.id}>
                  <td><div className="ws-row-name">{thumb(d, 'ws-row-emoji')}<strong>{formatProductTitle(d.name)}</strong></div></td>
                  <td style={{ color: '#a1a1aa', maxWidth: 280, lineHeight: 1.35 }}>{d.description || '—'}</td>
                  <td style={{ color: '#a1a1aa' }}>{d.lastUsedWeekStart ? shortWeek(d.lastUsedWeekStart) : (d.weekTag || '—')}</td>
                  <td className="ws-row-price">{formatUsd(d.price)}</td>
                  <td style={{ color: '#d4d4d8' }}>{formatUsd(d.cost)}</td>
                  <td><span className={`ws-dot ${d.status === 'active' ? 'on' : 'off'}`}>{d.status === 'active' ? 'Activo' : 'Inactivo'}</span></td>
                  <td>{d.sellableProductId ? <span className="ws-badge ok" style={{ padding: '2px 8px' }}><Check size={12} /> En catálogo</span> : <span className="ws-badge muted" style={{ padding: '2px 8px' }}>No en catálogo</span>}</td>
                  <td>
                    {d.status === 'active'
                      ? <button className="ws-btn-sm" disabled={busyId === d.id} onClick={() => setActive(d, false)}>Desactivar</button>
                      : d.sellableProductId
                        ? <button className="ws-btn-sm red" disabled={busyId === d.id} onClick={() => setActive(d, true)}>Activar esta semana</button>
                        : <button className="ws-btn-sm red" disabled={busyId === d.id} onClick={() => activateAndCaja(d)}><ShoppingCart size={13} /> Activar y agregar a Caja</button>}
                  </td>
                </tr>
              ))}
              {pageItems.length === 0 && (
                <tr><td colSpan={8}>
                  <EmptyState
                    compact
                    title="No hay platos que coincidan"
                    description="Prueba con otro nombre o cambia los filtros."
                  />
                </td></tr>
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="ws-pagination">
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((n) => <button key={n} className={n === safePage ? 'active' : ''} onClick={() => setPage(n)}>{n}</button>)}
            <span className="ws-count">Mostrando {pageItems.length} de {filtered.length} platos</span>
          </div>
        )}
      </div>

      {/* Modal crear */}
      {showCreate && (
        <div className="ws-modal-overlay" onClick={() => setShowCreate(false)}>
          <form className="ws-modal" onClick={(e) => e.stopPropagation()} onSubmit={handleCreate}>
            <h3>Nuevo plato especial</h3>
            <p className="sub">Se guarda en tu catálogo rotativo para reutilizarlo cuando quieras.</p>
            <ImagePicker value={form.imageUrl} emoji={form.emoji} onPick={(f) => pickImage(f, (u) => setForm({ ...form, imageUrl: u }))} onClear={() => setForm({ ...form, imageUrl: null })} />
            <div className="ws-row2">
              <div className="ws-field" style={{ maxWidth: 90 }}><label>Emoji</label><input value={form.emoji} onChange={(e) => setForm({ ...form, emoji: e.target.value })} style={{ textAlign: 'center', fontSize: 20 }} /></div>
              <div className="ws-field"><label>Nombre del plato</label><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ej. Tallarines Singapur" required /></div>
            </div>
            <div className="ws-field"><label>Descripción para clientes</label><textarea rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Ej. Pasta salteada con pollo y vegetales." /></div>
            <div className="ws-row2">
              <div className="ws-field"><label>Precio de venta ($)</label><NumberStepper step={0.5} min={0} value={form.price} onChange={(v) => setForm({ ...form, price: v })} /></div>
              <div className="ws-field"><label>Costo estimado ($)</label><NumberStepper step={0.5} min={0} value={form.cost} onChange={(v) => setForm({ ...form, cost: v })} /></div>
            </div>
            <label className="ws-check"><input type="checkbox" checked={activateNow} onChange={(e) => setActivateNow(e.target.checked)} /> Activar esta semana</label>
            <label className="ws-check"><input type="checkbox" checked={addToCaja} onChange={(e) => setAddToCaja(e.target.checked)} /> Agregar a Caja (disponible para vender)</label>
            <div className="ws-modal-actions">
              <button type="button" className="ws-cancel" onClick={() => setShowCreate(false)}>Cancelar</button>
              <button type="submit" className="ws-create-btn" disabled={saving || !form.name.trim()}>{saving ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />} Guardar plato</button>
            </div>
          </form>
        </div>
      )}

      {/* Modal editar */}
      {editing && (
        <div className="ws-modal-overlay" onClick={() => setEditing(null)}>
          <form className="ws-modal" onClick={(e) => e.stopPropagation()} onSubmit={handleEdit}>
            <div className="ws-modal-heading" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3>Editar plato</h3>
            </div>
            {editing.sellableProductId && <p className="sub">Ya está en Caja: los cambios se aplicarán también al catálogo de ventas.</p>}
            <ImagePicker value={editForm.imageUrl} emoji={editForm.emoji} onPick={(f) => pickImage(f, (u) => setEditForm({ ...editForm, imageUrl: u }))} onClear={() => setEditForm({ ...editForm, imageUrl: null })} />
            <div className="ws-row2">
              <div className="ws-field" style={{ maxWidth: 90 }}><label>Emoji</label><input value={editForm.emoji} onChange={(e) => setEditForm({ ...editForm, emoji: e.target.value })} style={{ textAlign: 'center', fontSize: 20 }} /></div>
              <div className="ws-field"><label>Nombre</label><input value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} required /></div>
            </div>
            <div className="ws-field"><label>Descripción</label><textarea rows={2} value={editForm.description} onChange={(e) => setEditForm({ ...editForm, description: e.target.value })} /></div>
            <div className="ws-row2">
              <div className="ws-field"><label>Precio de venta ($)</label><NumberStepper step={0.5} min={0} value={editForm.price} onChange={(v) => setEditForm({ ...editForm, price: v })} /></div>
              <div className="ws-field"><label>Costo estimado ($)</label><NumberStepper step={0.5} min={0} value={editForm.cost} onChange={(v) => setEditForm({ ...editForm, cost: v })} /></div>
            </div>
            <div className="ws-modal-actions">
              <button type="button" className="ws-cancel" onClick={() => setEditing(null)}>Cancelar</button>
              <button type="submit" className="ws-create-btn" disabled={saving || !editForm.name.trim()}>{saving ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />} Guardar cambios</button>
            </div>
          </form>
        </div>
      )}

      {/* Modal calendario */}
      {showCalendar && (
        <div className="ws-modal-overlay" onClick={() => setShowCalendar(false)}>
          <div className="ws-modal" onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3>Calendario de semanas</h3>
              <button type="button" className="ws-cancel" style={{ padding: 6 }} onClick={() => setShowCalendar(false)}><X size={16} /></button>
            </div>
            <p className="sub">Semanas con platos activos. Toca una para verla.</p>
            {weekSummary.length === 0 && <p style={{ color: '#71717a' }}>Aún no hay historial de semanas.</p>}
            {weekSummary.map((w) => (
              <button key={w.weekStart} className="ws-btn-sm" style={{ width: '100%', justifyContent: 'space-between', marginBottom: 8 }}
                onClick={() => { const [y, m, dd] = w.weekStart.split('-').map(Number); setViewMonday(new Date(y, m - 1, dd)); setShowCalendar(false) }}>
                <span>{weekLabel(w.weekStart)}</span>
                <span className="ws-badge muted">{w.count} plato{w.count === 1 ? '' : 's'}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function ImagePicker({ value, emoji, onPick, onClear }: { value: string | null; emoji: string; onPick: (f: File | undefined) => void; onClear: () => void }) {
  return (
    <div className="ws-field ws-image-field">
      <label>Foto del plato (opcional)</label>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <span className="ws-card-thumb" style={{ width: 64, height: 64 }}>
          {value ? <img src={value} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 12 }} /> : (emoji || <UtensilsCrossed size={16} />)}
        </span>
        <label className="ws-btn-sm" style={{ cursor: 'pointer' }}>
          <ImagePlus size={14} /> Subir foto
          <input type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => onPick(e.target.files?.[0])} />
        </label>
        {value && <button type="button" className="ws-btn-sm" onClick={onClear}>Quitar</button>}
      </div>
    </div>
  )
}
