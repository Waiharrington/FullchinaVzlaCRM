import { useEffect, useMemo, useState, useCallback } from 'react'
import { useAuth } from '../context/auth-context'
import {
  createWeeklyDish, getWeeklyDishes, setWeeklyDishActive, syncWeeklyDishToCatalog,
  updateWeeklyDish, type WeeklyDish,
} from '../lib/dataService'
import { formatUsd } from '../lib/money'
import {
  Utensils, Plus, Flame, Library, Link2, CalendarDays, Search, Check, AlertTriangle,
  HelpCircle, Pencil, X, Loader2, ShoppingCart, CheckCircle2,
} from 'lucide-react'
import './MenuSemanal.css'

const MONTHS = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']
function currentWeekLabel(): string {
  const now = new Date()
  const diffToMon = (now.getDay() + 6) % 7
  const mon = new Date(now); mon.setDate(now.getDate() - diffToMon)
  const sun = new Date(mon); sun.setDate(mon.getDate() + 6)
  if (mon.getMonth() === sun.getMonth()) return `${mon.getDate()} – ${sun.getDate()} ${MONTHS[sun.getMonth()]} ${sun.getFullYear()}`
  return `${mon.getDate()} ${MONTHS[mon.getMonth()].slice(0, 3)} – ${sun.getDate()} ${MONTHS[sun.getMonth()].slice(0, 3)} ${sun.getFullYear()}`
}

const PAGE_SIZE = 10
type CatTab = 'todos' | 'activos' | 'inactivos'

interface DishForm { emoji: string; name: string; description: string; price: string; cost: string }
const emptyForm: DishForm = { emoji: '🍜', name: '', description: '', price: '7.5', cost: '2.5' }

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

  // Crear / editar
  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState<DishForm>(emptyForm)
  const [activateNow, setActivateNow] = useState(true)
  const [addToCaja, setAddToCaja] = useState(true)
  const [saving, setSaving] = useState(false)
  const [editing, setEditing] = useState<WeeklyDish | null>(null)
  const [editForm, setEditForm] = useState<DishForm>(emptyForm)

  const weekLabel = useMemo(() => currentWeekLabel(), [])

  const load = useCallback(async () => {
    try {
      setLoading(true)
      setDishes(await getWeeklyDishes())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo cargar el menú semanal')
    } finally {
      setLoading(false)
    }
  }, [])
  useEffect(() => { void load() }, [load])

  const flash = (msg: string) => { setNotice(msg); setTimeout(() => setNotice(''), 3500) }

  const active = dishes.filter((d) => d.status === 'active')
  const inCatalog = dishes.filter((d) => d.sellableProductId)

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return dishes.filter((d) => {
      if (q && !d.name.toLowerCase().includes(q)) return false
      if (catTab === 'activos' && d.status !== 'active') return false
      if (catTab === 'inactivos' && d.status !== 'inactive') return false
      return true
    })
  }, [dishes, search, catTab])
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const safePage = Math.min(page, totalPages)
  const pageItems = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)
  useEffect(() => { setPage(1) }, [search, catTab])

  // --- Acciones ---
  const runAction = async (id: string, fn: () => Promise<void>, ok: string) => {
    setBusyId(id); setError('')
    try { await fn(); await load(); flash(ok) }
    catch (e) { setError(e instanceof Error ? e.message : 'Error en la operación') }
    finally { setBusyId(null) }
  }

  const setActive = (d: WeeklyDish, next: boolean) => runAction(d.id, async () => {
    await setWeeklyDishActive(d.id, next)
    if (next) await updateWeeklyDish(d.id, { weekTag: weekLabel })
    if (d.sellableProductId) await syncWeeklyDishToCatalog(d.id) // mantener Caja en sincronía
  }, next ? `"${d.name}" activado para esta semana` : `"${d.name}" desactivado`)

  const addToCajaAction = (d: WeeklyDish) => runAction(d.id, async () => {
    await syncWeeklyDishToCatalog(d.id)
  }, `"${d.name}" ya está disponible en Caja`)

  const activateAndCaja = (d: WeeklyDish) => runAction(d.id, async () => {
    await setWeeklyDishActive(d.id, true)
    await updateWeeklyDish(d.id, { weekTag: weekLabel })
    await syncWeeklyDishToCatalog(d.id)
  }, `"${d.name}" activado y disponible en Caja`)

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user || !form.name.trim()) return
    setSaving(true); setError('')
    try {
      const dish = await createWeeklyDish({
        name: form.name.trim(), description: form.description.trim(),
        price: parseFloat(form.price) || 0, cost: parseFloat(form.cost) || 0,
        emoji: form.emoji || '🍽️', weekTag: activateNow ? weekLabel : '',
      }, user.id)
      if (!activateNow) await setWeeklyDishActive(dish.id, false)
      if (addToCaja) await syncWeeklyDishToCatalog(dish.id)
      await load()
      flash(`Plato "${dish.name}" guardado${activateNow ? ' y activado' : ''}${addToCaja ? ' · disponible en Caja' : ''}`)
      setShowCreate(false); setForm(emptyForm); setActivateNow(true); setAddToCaja(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al crear el plato')
    } finally { setSaving(false) }
  }

  const openEdit = (d: WeeklyDish) => {
    setEditing(d)
    setEditForm({ emoji: d.emoji, name: d.name, description: d.description, price: String(d.price), cost: String(d.cost) })
  }
  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editing) return
    setSaving(true); setError('')
    try {
      await updateWeeklyDish(editing.id, {
        emoji: editForm.emoji, name: editForm.name.trim(), description: editForm.description.trim(),
        price: parseFloat(editForm.price) || 0, cost: parseFloat(editForm.cost) || 0,
      })
      if (editing.sellableProductId) await syncWeeklyDishToCatalog(editing.id) // propaga a Caja
      await load()
      flash(`"${editForm.name}" actualizado${editing.sellableProductId ? ' (también en Caja)' : ''}`)
      setEditing(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al actualizar')
    } finally { setSaving(false) }
  }

  if (loading) {
    return <div className="page"><div style={{ display: 'flex', justifyContent: 'center', padding: '64px 0' }}><Loader2 size={32} className="animate-spin" style={{ color: '#e11d2a' }} /></div></div>
  }

  const margin = (d: WeeklyDish) => d.price - d.cost

  return (
    <div className="page ws-page animate-fade-in">
      <header className="page-header">
        <div>
          <h1 className="page-title text-gradient"><Utensils size={22} style={{ verticalAlign: '-3px', marginRight: 8 }} />Menú Semanal</h1>
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

      {error && <div className="whatsapp-notice-banner" style={{ background: 'rgba(239,68,68,0.15)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)' }}><AlertTriangle size={18} /> {error}</div>}
      {notice && <div className="whatsapp-notice-banner" style={{ background: 'rgba(16,185,129,0.15)', color: '#10b981', border: '1px solid rgba(16,185,129,0.3)' }}><CheckCircle2 size={18} /> {notice}</div>}

      {/* Resumen */}
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
          <div><div className="ws-sum-lbl" style={{ marginTop: 0 }}>Semana actual</div><div className="ws-sum-val" style={{ fontSize: 16 }}>{weekLabel}</div></div>
        </div>
      </div>

      {/* Esta semana */}
      <div className="ws-section-head">
        <div className="ws-section-title">
          <Flame size={18} style={{ color: '#e11d2a' }} />
          <div><h2>Esta semana</h2><p>Platos activos que tus clientes pueden pedir.</p></div>
        </div>
      </div>

      {active.length === 0 ? (
        <div className="ws-catalog" style={{ textAlign: 'center', color: '#a1a1aa', marginTop: 0 }}>
          No hay platos activos esta semana. Activa uno desde el catálogo de abajo o crea uno nuevo.
        </div>
      ) : (
        <div className="ws-grid">
          {active.map((d) => (
            <div key={d.id} className="ws-card on">
              <div className="ws-card-top">
                <span className="ws-card-thumb">{d.emoji}</span>
                <div className="ws-card-title">
                  {d.weekTag && <div className="ws-card-week">{d.weekTag}</div>}
                  <h3>{d.name}</h3>
                  <p className="ws-card-desc">{d.description || 'Sin descripción'}</p>
                </div>
                <button className={`ws-switch on`} title="Desactivar" disabled={busyId === d.id} onClick={() => setActive(d, false)} />
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
                <div style={{ display: 'flex', gap: 8 }}>
                  {!d.sellableProductId && (
                    <button className="ws-btn-sm red" disabled={busyId === d.id} onClick={() => addToCajaAction(d)}>
                      <Link2 size={14} /> Agregar a Caja
                    </button>
                  )}
                  <button className="ws-btn-sm" onClick={() => openEdit(d)}><Pencil size={14} /> Editar</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Catálogo rotativo */}
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
          <div className="ws-search"><Search size={15} className="ic" /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar plato..." /></div>
        </div>

        <div className="ws-table-wrap">
          <table className="ws-table">
            <thead><tr>
              <th>Plato</th><th>Descripción</th><th>Última vez</th><th>Precio</th><th>Costo</th><th>Estado</th><th>En catálogo</th><th>Acción</th>
            </tr></thead>
            <tbody>
              {pageItems.map((d) => (
                <tr key={d.id}>
                  <td><div className="ws-row-name"><span className="ws-row-emoji">{d.emoji}</span><strong>{d.name}</strong></div></td>
                  <td style={{ color: '#a1a1aa', maxWidth: 220 }}>{d.description || '—'}</td>
                  <td style={{ color: '#a1a1aa' }}>{d.weekTag || '—'}</td>
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
              {pageItems.length === 0 && <tr><td colSpan={8} style={{ textAlign: 'center', color: '#71717a', padding: 24 }}>No hay platos que coincidan.</td></tr>}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="ws-pagination">
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((n) => (
              <button key={n} className={n === safePage ? 'active' : ''} onClick={() => setPage(n)}>{n}</button>
            ))}
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
            <div className="ws-row2">
              <div className="ws-field" style={{ maxWidth: 90 }}><label>Emoji</label><input value={form.emoji} onChange={(e) => setForm({ ...form, emoji: e.target.value })} style={{ textAlign: 'center', fontSize: 20 }} /></div>
              <div className="ws-field"><label>Nombre del plato</label><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ej. Tallarines Singapur" required /></div>
            </div>
            <div className="ws-field"><label>Descripción para clientes</label><textarea rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Ej. Pasta salteada con pollo y vegetales." /></div>
            <div className="ws-row2">
              <div className="ws-field"><label>Precio de venta ($)</label><input type="number" step="0.5" min="0" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} /></div>
              <div className="ws-field"><label>Costo estimado ($)</label><input type="number" step="0.5" min="0" value={form.cost} onChange={(e) => setForm({ ...form, cost: e.target.value })} /></div>
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
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3>Editar plato</h3>
              <button type="button" className="ws-cancel" style={{ padding: 6 }} onClick={() => setEditing(null)}><X size={16} /></button>
            </div>
            {editing.sellableProductId && <p className="sub">Este plato ya está en Caja: los cambios se aplicarán también al catálogo de ventas.</p>}
            <div className="ws-row2">
              <div className="ws-field" style={{ maxWidth: 90 }}><label>Emoji</label><input value={editForm.emoji} onChange={(e) => setEditForm({ ...editForm, emoji: e.target.value })} style={{ textAlign: 'center', fontSize: 20 }} /></div>
              <div className="ws-field"><label>Nombre</label><input value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} required /></div>
            </div>
            <div className="ws-field"><label>Descripción</label><textarea rows={2} value={editForm.description} onChange={(e) => setEditForm({ ...editForm, description: e.target.value })} /></div>
            <div className="ws-row2">
              <div className="ws-field"><label>Precio de venta ($)</label><input type="number" step="0.5" min="0" value={editForm.price} onChange={(e) => setEditForm({ ...editForm, price: e.target.value })} /></div>
              <div className="ws-field"><label>Costo estimado ($)</label><input type="number" step="0.5" min="0" value={editForm.cost} onChange={(e) => setEditForm({ ...editForm, cost: e.target.value })} /></div>
            </div>
            <div className="ws-modal-actions">
              <button type="button" className="ws-cancel" onClick={() => setEditing(null)}>Cancelar</button>
              <button type="submit" className="ws-create-btn" disabled={saving || !editForm.name.trim()}>{saving ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />} Guardar cambios</button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
