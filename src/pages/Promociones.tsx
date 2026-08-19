import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { Plus, Pencil, Trash2, Eye, EyeOff, X, Check } from 'lucide-react'
import './Promociones.css'

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

const EMOJI_OPTIONS = ['🛵', '🍱', '🎉', '🍚', '🔥', '⭐', '⏰', '💰', '🥤', '🥟', '🍜', '🥘', '🍗', '🎁', '💎', '🏆']

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
      alert('Error al guardar: ' + (e instanceof Error ? e.message : 'Error desconocido'))
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
    if (!confirm('¿Eliminar esta promoción?')) return
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

  return (
    <div className="page animate-fade-in">
      <header className="page-header">
        <h1 className="page-title text-gradient">Promociones del Menú</h1>
        <p className="page-subtitle">Gestiona las ofertas que se ven en /pedir</p>
      </header>

      <div className="card">
        <div className="card-header-row">
          <div>
            <h2 className="card-title">Ofertas activas</h2>
            <p className="card-subtitle">{promos.filter(p => p.isActive).length} visibles · {promos.length} total</p>
          </div>
          <button className="btn-accent btn-sm" onClick={openNew}>
            <Plus size={16} /> Nueva promoción
          </button>
        </div>

        {loading ? (
          <p className="empty-message">Cargando promociones…</p>
        ) : promos.length === 0 ? (
          <p className="empty-message">No hay promociones creadas</p>
        ) : (
          <div className="promos-list">
            {promos.map((p, idx) => (
              <div key={p.id} className={`promo-item ${!p.isActive ? 'inactive' : ''}`}>
                <div className="promo-drag">
                  <button className="promo-move" onClick={() => moveUp(p, idx)} disabled={idx === 0} title="Subir">▲</button>
                  <button className="promo-move" onClick={() => moveDown(p, idx)} disabled={idx >= promos.length - 1} title="Bajar">▼</button>
                </div>
                <div className="promo-icon-preview" style={{ background: p.color }}>{p.icon}</div>
                <div className="promo-info">
                  <span className="promo-tag" style={{ color: p.color }}>{p.tag}</span>
                  <strong>{p.title}</strong>
                  <span className="promo-subtitle">{p.subtitle}</span>
                  <div className="promo-meta">
                    {p.price && <span className="promo-price-badge">${p.price}</span>}
                    {p.oldPrice && <span className="promo-old-price">${p.oldPrice}</span>}
                    <span className="promo-note-badge">{p.note}</span>
                  </div>
                </div>
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
      </div>

      {showForm && (
        <div className="modal-overlay" onClick={() => setShowForm(false)}>
          <div className="modal promo-form-modal animate-slide-up" onClick={e => e.stopPropagation()}>
            <div className="promo-form-header">
              <h3>{editing ? 'Editar promoción' : 'Nueva promoción'}</h3>
              <button className="modal-close" onClick={() => setShowForm(false)}><X size={18} /></button>
            </div>

            <div className="promo-form-body">
              <div className="promo-form-row">
                <label>Ícono</label>
                <div className="promo-emoji-grid">
                  {EMOJI_OPTIONS.map(em => (
                    <button key={em} type="button" className={`promo-emoji-btn ${form.icon === em ? 'selected' : ''}`}
                      onClick={() => setForm(f => ({ ...f, icon: em }))}>{em}</button>
                  ))}
                </div>
              </div>

              <div className="promo-form-row">
                <label>Tag</label>
                <input value={form.tag} onChange={e => setForm(f => ({ ...f, tag: e.target.value }))} placeholder="🔥 PROMO" />
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
                  <input type="number" value={form.sortOrder} onChange={e => setForm(f => ({ ...f, sortOrder: parseInt(e.target.value) || 0 }))} />
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
