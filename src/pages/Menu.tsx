import { useEffect, useMemo, useState, useCallback } from 'react'
import { getAllSellableProducts, createProduct, updateProduct, type SellableProduct } from '../lib/dataService'
import { formatUsd } from '../lib/money'
import {
  UtensilsCrossed, Plus, Search, Pencil, Loader2, CheckCircle2, AlertTriangle,
  LayoutGrid, List, ImagePlus, X, Package, Eye, EyeOff, Tag,
} from 'lucide-react'
import './Menu.css'

const CATEGORIES = ['arroz', 'plato', 'wok', 'pollo_camaron', 'racion', 'bebida', 'extra', 'especial_semanal', 'combo', 'entrada', 'postre']
const catLabel = (c: string) => c.replace(/_/g, ' ')

function fileToScaledDataUrl(file: File, max = 500): Promise<string> {
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
        resolve(canvas.toDataURL('image/jpeg', 0.75))
      }
      img.src = reader.result as string
    }
    reader.readAsDataURL(file)
  })
}

interface Form { name: string; description: string; category: string; emoji: string; price: string; cost: string; imageUrl: string | null; isActive: boolean }
const emptyForm: Form = { name: '', description: '', category: 'plato', emoji: '🍽️', price: '', cost: '', imageUrl: null, isActive: true }

export function Menu() {
  const [products, setProducts] = useState<SellableProduct[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [search, setSearch] = useState('')
  const [catFilter, setCatFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all')
  const [view, setView] = useState<'grid' | 'list'>('grid')

  const [editing, setEditing] = useState<SellableProduct | null | 'new'>(null)
  const [form, setForm] = useState<Form>(emptyForm)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    try { setLoading(true); setProducts(await getAllSellableProducts()) }
    catch (e) { setError(e instanceof Error ? e.message : 'Error cargando el menú') }
    finally { setLoading(false) }
  }, [])
  useEffect(() => { void load() }, [load])

  const flash = (m: string) => { setNotice(m); setTimeout(() => setNotice(''), 3000) }

  const categories = useMemo(() => Array.from(new Set(products.map((p) => p.category).filter(Boolean))).sort(), [products])
  const summary = useMemo(() => ({
    total: products.length,
    active: products.filter((p) => p.isActive).length,
    inactive: products.filter((p) => !p.isActive).length,
    cats: categories.length,
  }), [products, categories])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return products.filter((p) => {
      if (q && !p.name.toLowerCase().includes(q)) return false
      if (catFilter !== 'all' && p.category !== catFilter) return false
      if (statusFilter === 'active' && !p.isActive) return false
      if (statusFilter === 'inactive' && p.isActive) return false
      return true
    })
  }, [products, search, catFilter, statusFilter])

  const openNew = () => { setForm(emptyForm); setEditing('new') }
  const openEdit = (p: SellableProduct) => {
    setForm({ name: p.name, description: p.description ?? '', category: p.category, emoji: p.emoji || '🍽️', price: String(p.salePrice), cost: p.cost != null ? String(p.cost) : '', imageUrl: p.imageUrl, isActive: p.isActive })
    setEditing(p)
  }

  const pickImage = async (file: File | undefined) => {
    if (!file) return
    try { setForm((f) => ({ ...f, imageUrl: '' })); const url = await fileToScaledDataUrl(file); setForm((f) => ({ ...f, imageUrl: url })) }
    catch (e) { setError(e instanceof Error ? e.message : 'No se pudo procesar la imagen') }
  }

  const toggleActive = async (p: SellableProduct) => {
    try { await updateProduct(p.id, { isActive: !p.isActive }); await load() }
    catch (e) { setError(e instanceof Error ? e.message : 'Error al cambiar estado') }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name.trim() || !(parseFloat(form.price) >= 0)) { setError('Nombre y precio son obligatorios'); return }
    setSaving(true); setError('')
    try {
      const payload = {
        name: form.name.trim(), description: form.description.trim() || null,
        price: parseFloat(form.price) || 0, cost: form.cost.trim() ? parseFloat(form.cost) : null,
        category: form.category.trim() || 'plato', emoji: form.emoji || '🍽️', imageUrl: form.imageUrl, isActive: form.isActive,
      }
      if (editing === 'new') { await createProduct(payload); flash(`Plato "${payload.name}" creado`) }
      else if (editing) { await updateProduct(editing.id, payload); flash(`"${payload.name}" actualizado`) }
      setEditing(null); await load()
    } catch (e) { setError(e instanceof Error ? e.message : 'Error al guardar el plato') }
    finally { setSaving(false) }
  }

  if (loading) return <div className="page"><div style={{ display: 'flex', justifyContent: 'center', padding: '64px 0' }}><Loader2 size={32} className="animate-spin" style={{ color: '#e11d2a' }} /></div></div>

  const thumb = (p: SellableProduct, cls: string) => p.imageUrl ? <img className={cls} src={p.imageUrl} alt={p.name} loading="lazy" /> : <span className={cls}>{p.emoji || '🍽️'}</span>

  return (
    <div className="page mnu-page animate-fade-in">
      <header className="page-header">
        <div>
          <h1 className="page-title text-gradient"><UtensilsCrossed size={22} style={{ verticalAlign: '-3px', marginRight: 8 }} />Menú</h1>
          <p className="page-subtitle">Gestiona tus platos: nombre, precio, categoría, foto y disponibilidad.</p>
        </div>
        <button className="mnu-btn" onClick={openNew}><Plus size={16} /> Nuevo plato</button>
      </header>

      {error && <div className="whatsapp-notice-banner" style={{ background: 'rgba(239,68,68,0.15)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)' }}><AlertTriangle size={18} /> {error}</div>}
      {notice && <div className="whatsapp-notice-banner" style={{ background: 'rgba(16,185,129,0.15)', color: '#10b981', border: '1px solid rgba(16,185,129,0.3)' }}><CheckCircle2 size={18} /> {notice}</div>}

      <div className="mnu-summary">
        <div className="mnu-sum"><span className="mnu-sum-ic" style={{ background: 'rgba(225,29,42,0.15)', color: '#e11d2a' }}><Package size={20} /></span><div><div className="mnu-sum-lbl">Total platos</div><div className="mnu-sum-val">{summary.total}</div></div></div>
        <div className="mnu-sum"><span className="mnu-sum-ic" style={{ background: 'rgba(34,197,94,0.15)', color: '#22c55e' }}><Eye size={20} /></span><div><div className="mnu-sum-lbl">Activos (en venta)</div><div className="mnu-sum-val">{summary.active}</div></div></div>
        <div className="mnu-sum"><span className="mnu-sum-ic" style={{ background: 'rgba(113,113,122,0.2)', color: '#a1a1aa' }}><EyeOff size={20} /></span><div><div className="mnu-sum-lbl">Inactivos</div><div className="mnu-sum-val">{summary.inactive}</div></div></div>
        <div className="mnu-sum"><span className="mnu-sum-ic" style={{ background: 'rgba(124,58,237,0.15)', color: '#a78bfa' }}><Tag size={20} /></span><div><div className="mnu-sum-lbl">Categorías</div><div className="mnu-sum-val">{summary.cats}</div></div></div>
      </div>

      <div className="mnu-tools">
        <div className="mnu-search"><Search size={15} className="ic" /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar plato..." /></div>
        <select value={catFilter} onChange={(e) => setCatFilter(e.target.value)}><option value="all">Categoría: Todas</option>{categories.map((c) => <option key={c} value={c}>{catLabel(c)}</option>)}</select>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as 'all' | 'active' | 'inactive')}><option value="all">Estado: Todos</option><option value="active">Activos</option><option value="inactive">Inactivos</option></select>
        <div className="mnu-view">
          <button className={view === 'grid' ? 'active' : ''} onClick={() => setView('grid')} aria-label="Cuadrícula"><LayoutGrid size={16} /></button>
          <button className={view === 'list' ? 'active' : ''} onClick={() => setView('list')} aria-label="Lista"><List size={16} /></button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="mnu-table-wrap" style={{ textAlign: 'center', color: '#71717a', padding: 30 }}>No hay platos que coincidan.</div>
      ) : view === 'grid' ? (
        <div className="mnu-grid">
          {filtered.map((p) => (
            <div key={p.id} className={`mnu-card${p.isActive ? '' : ' off'}`}>
              {thumb(p, 'mnu-thumb')}
              <div className="mnu-card-body">
                <span className="mnu-card-name">{p.name}</span>
                <span className="mnu-card-cat">{catLabel(p.category)}</span>
                <div className="mnu-card-row">
                  <span className="mnu-price">{formatUsd(p.salePrice)}</span>
                  <span className={`mnu-badge ${p.isActive ? 'on' : 'off'}`}>{p.isActive ? 'Activo' : 'Inactivo'}</span>
                </div>
              </div>
              <div className="mnu-card-actions">
                <button className="mnu-act" onClick={() => openEdit(p)}><Pencil size={14} /> Editar</button>
                <button className="mnu-act" onClick={() => toggleActive(p)}>{p.isActive ? <><EyeOff size={14} /> Ocultar</> : <><Eye size={14} /> Activar</>}</button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="mnu-table-wrap">
          <table className="mnu-table">
            <thead><tr><th>Plato</th><th>Categoría</th><th>Precio</th><th>Estado</th><th>Acciones</th></tr></thead>
            <tbody>
              {filtered.map((p) => (
                <tr key={p.id}>
                  <td><div className="mnu-row-name">{thumb(p, 'mnu-row-thumb')}<div><strong>{p.name}</strong>{p.description && <><br /><small style={{ color: '#71717a' }}>{p.description.slice(0, 40)}</small></>}</div></div></td>
                  <td style={{ textTransform: 'capitalize', color: '#a1a1aa' }}>{catLabel(p.category)}</td>
                  <td className="mnu-price" style={{ fontSize: 15 }}>{formatUsd(p.salePrice)}</td>
                  <td><button className={`mnu-switch ${p.isActive ? 'on' : ''}`} onClick={() => toggleActive(p)} title={p.isActive ? 'Activo' : 'Inactivo'} /></td>
                  <td><button className="mnu-icon-btn" onClick={() => openEdit(p)} title="Editar"><Pencil size={16} /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editing && (
        <div className="mnu-modal-overlay" onClick={() => setEditing(null)}>
          <form className="mnu-modal" onClick={(e) => e.stopPropagation()} onSubmit={handleSubmit}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3>{editing === 'new' ? 'Nuevo plato' : 'Editar plato'}</h3>
              <button type="button" className="mnu-cancel" style={{ padding: 6 }} onClick={() => setEditing(null)}><X size={16} /></button>
            </div>

            <div className="mnu-field">
              <label>Foto del plato</label>
              <div className="mnu-img-pick">
                <span className="mnu-img-prev">{form.imageUrl ? <img src={form.imageUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 12 }} /> : (form.emoji || '🍽️')}</span>
                <label className="mnu-upload"><ImagePlus size={14} /> Subir foto<input type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => pickImage(e.target.files?.[0])} /></label>
                {form.imageUrl && <button type="button" className="mnu-cancel" style={{ padding: '8px 12px' }} onClick={() => setForm((f) => ({ ...f, imageUrl: null }))}>Quitar</button>}
              </div>
            </div>

            <div className="mnu-row2">
              <div className="mnu-field" style={{ maxWidth: 90 }}><label>Emoji</label><input value={form.emoji} onChange={(e) => setForm({ ...form, emoji: e.target.value })} style={{ textAlign: 'center', fontSize: 20 }} /></div>
              <div className="mnu-field"><label>Nombre *</label><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ej. Arroz Frito Especial" required /></div>
            </div>

            <div className="mnu-field"><label>Descripción</label><textarea rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Descripción para el cliente" /></div>

            <div className="mnu-row2">
              <div className="mnu-field"><label>Categoría</label>
                <input list="mnu-cats" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="plato" />
                <datalist id="mnu-cats">{Array.from(new Set([...CATEGORIES, ...categories])).map((c) => <option key={c} value={c} />)}</datalist>
              </div>
              <div className="mnu-field"><label>Precio de venta ($) *</label><input type="number" step="0.01" min="0" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} placeholder="0.00" required /></div>
            </div>

            <div className="mnu-row2">
              <div className="mnu-field"><label>Costo estimado ($)</label><input type="number" step="0.01" min="0" value={form.cost} onChange={(e) => setForm({ ...form, cost: e.target.value })} placeholder="Opcional" /></div>
              <div className="mnu-field"><label>Estado</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, paddingTop: 6 }}>
                  <button type="button" className={`mnu-switch ${form.isActive ? 'on' : ''}`} onClick={() => setForm((f) => ({ ...f, isActive: !f.isActive }))} />
                  <span style={{ fontSize: 13, color: '#d4d4d8' }}>{form.isActive ? 'Activo (en venta)' : 'Inactivo'}</span>
                </div>
              </div>
            </div>

            <div className="mnu-modal-actions">
              <button type="button" className="mnu-cancel" onClick={() => setEditing(null)}>Cancelar</button>
              <button type="submit" className="mnu-btn" disabled={saving}>{saving ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />} {editing === 'new' ? 'Crear plato' : 'Guardar cambios'}</button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
