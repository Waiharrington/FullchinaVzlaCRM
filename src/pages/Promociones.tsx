import { useState, useEffect, useCallback, type CSSProperties } from 'react'
import { supabase } from '../lib/supabase'
import NumberStepper from '../components/NumberStepper'
import { Plus, Pencil, Trash2, Eye, EyeOff, Check, Tag, Lock, ChevronUp, ChevronDown, Gift, Bike, Package, PartyPopper, UtensilsCrossed, Flame, Star, Clock, DollarSign, CupSoda, Disc, Soup, CookingPot, Beef, Gem, Trophy } from 'lucide-react'
import './Promociones.css'
import { confirmDialog, alertDialog } from '../components/ConfirmDialog'

interface Promotion {
  id: string
  tag: string
  title: string
  subtitle: string
  price: string | null
  oldPrice: string | null
  note: string
  icon: string
  color: string
  isActive: boolean
  sortOrder: number
  createdAt: string
}

const EMPTY_FORM = {
  tag: '', title: '', subtitle: '', price: '', oldPrice: '',
  note: '', icon: '🎁', color: '#1b1715', isActive: true, sortOrder: 0,
}

const ICON_OPTIONS = [
  { key: '🛵', icon: Bike, label: 'Delivery' },
  { key: '🍱', icon: Package, label: 'Bento' },
  { key: '🎉', icon: PartyPopper, label: 'Fiesta' },
  { key: '🍚', icon: UtensilsCrossed, label: 'Arroz' },
  { key: '🔥', icon: Flame, label: 'Popular' },
  { key: '⭐', icon: Star, label: 'Estrella' },
  { key: '⏰', icon: Clock, label: 'Reloj' },
  { key: '💰', icon: DollarSign, label: 'Dinero' },
  { key: '🥤', icon: CupSoda, label: 'Bebida' },
  { key: '🥟', icon: Disc, label: 'Dumpling' },
  { key: '🍜', icon: Soup, label: 'Sopa' },
  { key: '🥘', icon: CookingPot, label: 'Olla' },
  { key: '🍗', icon: Beef, label: 'Carne' },
  { key: '🎁', icon: Gift, label: 'Regalo' },
  { key: '💎', icon: Gem, label: 'Diamante' },
  { key: '🏆', icon: Trophy, label: 'Trofeo' },
]

const ICON_MAP = Object.fromEntries(ICON_OPTIONS.map(o => [o.key, o.icon]))

function db() {
  if (!supabase) throw new Error('Supabase no está configurado')
  return supabase
}

export function Promociones() {
  const [promos, setPromos] = useState<Promotion[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)

  const fetchPromos = useCallback(async () => {
    try {
      const { data, error } = await db()
        .from('promotions')
        .select('*')
        .order('sort_order', { ascending: true })
      if (error) throw error
      setPromos((data ?? []).map((r: Record<string, unknown>) => ({
        id: String(r.id),
        tag: String(r.tag),
        title: String(r.title),
        subtitle: String(r.subtitle),
        price: r.price ? String(r.price) : null,
        oldPrice: r.old_price ? String(r.old_price) : null,
        note: String(r.note),
        icon: String(r.icon),
        color: String(r.color),
        isActive: Boolean(r.is_active),
        sortOrder: Number(r.sort_order),
        createdAt: String(r.created_at),
      })))
    } catch (e) {
      console.error('Error cargando promociones:', e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchPromos() }, [fetchPromos])

  const openNew = () => { setEditing(null); setForm(EMPTY_FORM); setShowForm(true) }

  const openEdit = (p: Promotion) => {
    setEditing(p.id)
    setForm({
      tag: p.tag, title: p.title, subtitle: p.subtitle,
      price: p.price ?? '', oldPrice: p.oldPrice ?? '',
      note: p.note, icon: p.icon, color: p.color,
      isActive: p.isActive, sortOrder: p.sortOrder,
    })
    setShowForm(true)
  }

  const handleSave = async () => {
    if (!form.tag.trim() || !form.title.trim()) return
    setSaving(true)
    try {
      const row = {
        tag: form.tag.trim(),
        title: form.title.trim(),
        subtitle: form.subtitle.trim(),
        price: form.price.trim() || null,
        old_price: form.oldPrice.trim() || null,
        note: form.note.trim(),
        icon: form.icon,
        color: form.color,
        is_active: form.isActive,
        sort_order: form.sortOrder,
      }
      if (editing) {
        const { error } = await db().from('promotions').update(row).eq('id', editing)
        if (error) throw error
      } else {
        const { error } = await db().from('promotions').insert(row)
        if (error) throw error
      }
      setShowForm(false)
      setEditing(null)
      setForm(EMPTY_FORM)
      fetchPromos()
    } catch (e) {
      console.error('Error guardando:', e)
      void alertDialog({ message: 'Error al guardar: ' + (e instanceof Error ? e.message : 'Error desconocido'), danger: true })
    } finally {
      setSaving(false)
    }
  }

  const toggleActive = async (p: Promotion) => {
    try {
      const { error } = await db().from('promotions').update({ is_active: !p.isActive }).eq('id', p.id)
      if (error) throw error
      fetchPromos()
    } catch (e) {
      console.error('Error toggling:', e)
    }
  }

  const handleDelete = async (id: string) => {
    const ok = await confirmDialog({ title: 'Eliminar promoción', message: '¿Eliminar esta promoción?', confirmText: 'Eliminar', danger: true })
    if (!ok) return
    try {
      const { error } = await db().from('promotions').delete().eq('id', id)
      if (error) throw error
      fetchPromos()
    } catch (e) {
      console.error('Error eliminando:', e)
    }
  }

  const moveUp = async (p: Promotion, idx: number) => {
    if (idx === 0) return
    const prev = promos[idx - 1]
    try {
      await db().from('promotions').update({ sort_order: p.sortOrder }).eq('id', prev.id)
      await db().from('promotions').update({ sort_order: prev.sortOrder }).eq('id', p.id)
      fetchPromos()
    } catch (e) { console.error(e) }
  }

  const moveDown = async (p: Promotion, idx: number) => {
    if (idx >= promos.length - 1) return
    const next = promos[idx + 1]
    try {
      await db().from('promotions').update({ sort_order: p.sortOrder }).eq('id', next.id)
      await db().from('promotions').update({ sort_order: next.sortOrder }).eq('id', p.id)
      fetchPromos()
    } catch (e) { console.error(e) }
  }

  const visibles = promos.filter(p => p.isActive).length

  return (
    <div className="promo-page animate-fade-in">
      {/* Hero */}
      <header className="promo-hero">
        <div className="promo-hero-text">
          <h1 className="page-title promo-hero-title">Promociones <span>del Menú</span></h1>
          <p className="promo-hero-sub">Gestiona las ofertas que se ven en /pedir</p>
        </div>
        <div className="promo-hero-fire" aria-hidden><Flame size={28} /></div>
      </header>

      {/* Toolbar: stats + acción */}
      <div className="promo-toolbar">
        <div className="promo-stats">
          <div className="promo-stat">
            <Eye size={18} className="promo-stat-ico green" />
            <b>{visibles}</b><span>Visibles</span>
          </div>
          <div className="promo-stat-divider" />
          <div className="promo-stat">
            <Tag size={18} className="promo-stat-ico red" />
            <b>{promos.length}</b><span>Total</span>
          </div>
        </div>
        <button className="promo-new-btn" onClick={openNew}>
          <Plus size={18} /> Nueva promoción
        </button>
      </div>

      {loading ? (
        <p className="promo-empty">Cargando promociones…</p>
      ) : promos.length === 0 ? (
        <p className="promo-empty">No hay promociones creadas. Crea la primera con “Nueva promoción”.</p>
      ) : (
        <div className="promos-list">
          {promos.map((p, idx) => (
            <div
              key={p.id}
              className={`promo-item ${!p.isActive ? 'inactive' : ''}`}
              style={{ '--pc': p.color } as CSSProperties}
            >
              <div className="promo-glow" aria-hidden>{(() => { const Ico = ICON_MAP[p.icon]; return Ico ? <Ico size={32} /> : p.icon; })()}</div>

              <div className="promo-drag">
                <button className="promo-move" onClick={() => moveUp(p, idx)} disabled={idx === 0} title="Subir"><ChevronUp size={16} /></button>
                <button className="promo-move" onClick={() => moveDown(p, idx)} disabled={idx >= promos.length - 1} title="Bajar"><ChevronDown size={16} /></button>
              </div>

              <div className="promo-icon-preview">{(() => { const Ico = ICON_MAP[p.icon]; return Ico ? <Ico size={20} /> : p.icon; })()}</div>

              <div className="promo-info">
                <span className="promo-tag">{p.tag}</span>
                <strong>{p.title}</strong>
                <span className="promo-subtitle">{p.subtitle}</span>
                {p.note && <span className="promo-note-badge">{p.note}</span>}
              </div>

              {p.price && (
                <div className="promo-price-block">
                  <span className="promo-price-main">${p.price}</span>
                  {p.oldPrice && <span className="promo-price-old">${p.oldPrice}</span>}
                </div>
              )}

              <div className="promo-actions">
                <button className="promo-btn-toggle" onClick={() => toggleActive(p)} title={p.isActive ? 'Ocultar' : 'Mostrar'}>
                  {p.isActive ? <Eye size={16} /> : <EyeOff size={16} />}
                </button>
                <button className="promo-btn-edit" onClick={() => openEdit(p)} title="Editar"><Pencil size={16} /></button>
                <button className="promo-btn-delete" onClick={() => handleDelete(p.id)} title="Eliminar"><Trash2 size={16} /></button>
              </div>
            </div>
          ))}
        </div>
      )}

      <p className="promo-footer-note"><Lock size={13} /> Las promociones visibles aparecerán en tu menú público (/pedir)</p>

      {showForm && (
        <div className="modal-overlay" onClick={() => setShowForm(false)}>
          <div className="modal promo-form-modal animate-slide-up" onClick={e => e.stopPropagation()}>
            <div className="promo-form-header">
              <h3>{editing ? 'Editar promoción' : 'Nueva promoción'}</h3>
            </div>

            <div className="promo-form-body">
              <div className="promo-form-row">
                <label>Ícono</label>
                <div className="promo-emoji-grid">
                  {ICON_OPTIONS.map(opt => (
                    <button key={opt.key} type="button" className={`promo-emoji-btn ${form.icon === opt.key ? 'selected' : ''}`}
                      onClick={() => setForm(f => ({ ...f, icon: opt.key }))} title={opt.label}><opt.icon size={18} /></button>
                  ))}
                </div>
              </div>

              <div className="promo-form-row">
                <label>Tag</label>
                <input value={form.tag} onChange={e => setForm(f => ({ ...f, tag: e.target.value }))} placeholder="PROMO" />
              </div>

              <div className="promo-form-row">
                <label>Título</label>
                <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Delivery gratis" />
              </div>

              <div className="promo-form-row">
                <label>Subtítulo</label>
                <input value={form.subtitle} onChange={e => setForm(f => ({ ...f, subtitle: e.target.value }))} placeholder="En pedidos mayores a $10" />
              </div>

              <div className="promo-form-grid">
                <div className="promo-form-row">
                  <label>Precio (opcional)</label>
                  <input value={form.price} onChange={e => setForm(f => ({ ...f, price: e.target.value }))} placeholder="12,90" />
                </div>
                <div className="promo-form-row">
                  <label>Precio anterior (opcional)</label>
                  <input value={form.oldPrice} onChange={e => setForm(f => ({ ...f, oldPrice: e.target.value }))} placeholder="16,00" />
                </div>
              </div>

              <div className="promo-form-row">
                <label>Nota</label>
                <input value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))} placeholder="Válido solo delivery" />
              </div>

              <div className="promo-form-grid">
                <div className="promo-form-row">
                  <label>Color</label>
                  <div className="promo-color-row">
                    <input type="color" value={form.color} onChange={e => setForm(f => ({ ...f, color: e.target.value }))} className="promo-color-input" />
                    <span className="promo-color-hex">{form.color}</span>
                  </div>
                </div>
                <div className="promo-form-row">
                  <label>Orden</label>
                  <NumberStepper step={1} value={String(form.sortOrder)} onChange={v => setForm(f => ({ ...f, sortOrder: parseInt(v) || 0 }))} />
                </div>
              </div>

              <div className="promo-form-row">
                <label className="promo-toggle-label">
                  <input type="checkbox" checked={form.isActive} onChange={e => setForm(f => ({ ...f, isActive: e.target.checked }))} />
                  <span>Activa (visible en el menú)</span>
                </label>
              </div>
            </div>

            <div className="promo-form-footer">
              <button className="btn-ghost" onClick={() => setShowForm(false)}>Cancelar</button>
              <button className="btn-accent" onClick={handleSave} disabled={saving || !form.tag.trim() || !form.title.trim()}>
                <Check size={16} /> {saving ? 'Guardando…' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
