import { useState, useEffect, useCallback, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import { supabase } from '../lib/supabase'
import NumberStepper from '../components/NumberStepper'
import { Plus, Trash2, Eye, EyeOff, Check, Tag, Lock, ChevronUp, ChevronDown, Gift, Bike, Package, PartyPopper, UtensilsCrossed, Flame, Star, Clock, DollarSign, CupSoda, Disc, Soup, CookingPot, Beef, Gem, Trophy } from 'lucide-react'
import './Promociones.css'
import { confirmDialog, alertDialog } from '../components/ConfirmDialog'
import { PageSkeleton } from '../components/PageSkeleton'

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

// El ícono ya se muestra aparte (selector + marca), así que se limpia
// cualquier emoji que haya quedado escrito dentro del texto del tag.
function stripEmoji(value: string): string {
  return value
    .replace(/\p{Extended_Pictographic}/gu, '')
    .replace(/\u{FE0F}/gu, '')
    .replace(/\u{200D}/gu, '')
    .replace(/\s{2,}/g, ' ')
    .trim()
}

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
  const [closingForm, setClosingForm] = useState(false)

  const closeForm = (then?: () => void) => {
    if (!showForm || closingForm) return
    setClosingForm(true)
    window.setTimeout(() => {
      setShowForm(false)
      setClosingForm(false)
      then?.()
    }, 200)
  }

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
      closeForm(() => { setEditing(null); setForm(EMPTY_FORM) })
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

  if (loading) return <PageSkeleton cards={2} rows={3} hasTable={false} />

  return (
    <div className="page promo-page animate-fade-in management-workspace management-workspace--promotions">
      <header className="page-header management-workspace-header">
        <div>
          <h1 className="page-title"><Tag size={22} className="page-title-icon" /> Promociones</h1>
          <p className="page-subtitle">Cupones listos para tus automatizaciones de WhatsApp</p>
        </div>

        <div className="promo-header-actions">
          <div className="promo-stats">
            <div className="promo-stat">
              <Eye size={16} className="promo-stat-ico green" />
              <b>{visibles}</b><span>Activas</span>
            </div>
            <div className="promo-stat-divider" />
            <div className="promo-stat">
              <Tag size={16} className="promo-stat-ico red" />
              <b>{promos.length}</b><span>Total</span>
            </div>
          </div>
          <button className="promo-new-btn" onClick={openNew}>
            <Plus size={18} /> Nueva promoción
          </button>
        </div>
      </header>

      {promos.length === 0 ? (
        <p className="promo-empty">No hay promociones creadas. Crea la primera con “Nueva promoción”.</p>
      ) : (
        <div className="promos-list">
          {promos.map((p, idx) => (
            <div
              key={p.id}
              className={`promo-item ${!p.isActive ? 'inactive' : ''}`}
              style={{ '--pc': p.color } as CSSProperties}
              onClick={() => openEdit(p)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => { if (e.key === 'Enter') openEdit(p) }}
            >
              <div className="promo-item-drag">
                <button className="promo-move" onClick={(e) => { e.stopPropagation(); moveUp(p, idx) }} disabled={idx === 0} title="Subir"><ChevronUp size={14} /></button>
                <button className="promo-move" onClick={(e) => { e.stopPropagation(); moveDown(p, idx) }} disabled={idx >= promos.length - 1} title="Bajar"><ChevronDown size={14} /></button>
              </div>

              <div className="promo-item-actions">
                <button className="promo-btn-toggle" onClick={(e) => { e.stopPropagation(); toggleActive(p) }} title={p.isActive ? 'Desactivar' : 'Activar'}>
                  {p.isActive ? <Eye size={15} /> : <EyeOff size={15} />}
                </button>
                <button className="promo-btn-delete" onClick={(e) => { e.stopPropagation(); handleDelete(p.id) }} title="Eliminar"><Trash2 size={15} /></button>
              </div>

              <div className="promo-icon-preview">{(() => { const Ico = ICON_MAP[p.icon]; return Ico ? <Ico size={26} /> : p.icon; })()}</div>
              <span className="promo-tag">{stripEmoji(p.tag)}</span>
              <strong className="promo-item-title">{p.title}</strong>
              <span className="promo-subtitle">{p.subtitle}</span>

              {p.price && (
                <div className="promo-price-row">
                  <span className="promo-price-main">${p.price}</span>
                  {p.oldPrice && <span className="promo-price-old">${p.oldPrice}</span>}
                </div>
              )}

              {p.note && <span className="promo-note-badge">{p.note}</span>}
              {!p.isActive && <span className="promo-hidden-flag">Inactiva</span>}
            </div>
          ))}
        </div>
      )}

      <p className="promo-footer-note"><Lock size={13} /> Las promociones activas quedan listas para usarse en tus automatizaciones de WhatsApp</p>

      {showForm && createPortal(
        <div className={`promo-modal-overlay ${closingForm ? 'closing' : ''}`} onClick={() => closeForm()}>
          <div className="promo-form-modal animate-slide-up" onClick={e => e.stopPropagation()}>
            <div className="promo-form-header">
              <h3>{editing ? 'Editar promoción' : 'Nueva promoción'}</h3>
            </div>

            <div className="promo-form-content">
              <div className="promo-form-fields">
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
                      <span>Activa (disponible para usar en WhatsApp)</span>
                    </label>
                  </div>
                </div>
              </div>

              <div className="promo-preview-pane">
                <span className="promo-preview-label">Vista previa del cupón</span>
                <div className="promo-coupon-preview">
                  <div className="promo-coupon-bg-art" aria-hidden />
                  <div className="promo-coupon-shine" aria-hidden />

                  <div className="promo-coupon-head">
                    <div className="promo-coupon-head-text">
                      <span className="promo-coupon-tag">
                        {(() => { const Ico = ICON_MAP[form.icon]; return Ico ? <Ico size={11} /> : form.icon })()}
                        {stripEmoji(form.tag) || 'PROMO'}
                      </span>
                      <h4 className="promo-coupon-title">{form.title.trim() || 'Título de la promo'}</h4>
                    </div>
                    <div className="promo-coupon-mark"><img src="/icons/wok-mark.png" alt="" /></div>
                  </div>

                  <p className="promo-coupon-subtitle">{form.subtitle.trim() || 'Describe la oferta aquí'}</p>

                  <div className="promo-coupon-perf" aria-hidden />

                  <div className="promo-coupon-foot">
                    {form.price.trim() && (
                      <div className="promo-coupon-price-row">
                        <span className="promo-coupon-price">${form.price}</span>
                        {form.oldPrice.trim() && <span className="promo-coupon-old">${form.oldPrice}</span>}
                      </div>
                    )}
                    {form.note.trim() && <span className="promo-coupon-note">{form.note}</span>}
                  </div>

                  {!form.isActive && <span className="promo-coupon-hidden-flag">Inactiva</span>}
                </div>
                <span className="promo-preview-hint">Diseño de marca — el ícono es lo único que cambia</span>
              </div>
            </div>

            <div className="promo-form-footer">
              <button className="promo-btn-cancel" onClick={() => closeForm()}>Cancelar</button>
              <button className="promo-btn-save" onClick={handleSave} disabled={saving || !form.tag.trim() || !form.title.trim()}>
                <Check size={16} /> {saving ? 'Guardando…' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}
