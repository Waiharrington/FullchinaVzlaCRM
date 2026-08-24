import { useEffect, useMemo, useState, useCallback } from 'react'
import { getAllSellableProducts, createProduct, updateProduct, deleteProduct, getMenuCategories, createMenuCategory, updateMenuCategory, deleteMenuCategory, type SellableProduct, type MenuCategoryRow } from '../lib/dataService'
import { formatUsd } from '../lib/money'
import {
  UtensilsCrossed, Plus, Search, Pencil, Loader2, CheckCircle2, AlertTriangle,
  LayoutGrid, List, ImagePlus, X, Package, Eye, EyeOff, Tag, Trash2, CheckSquare, Square,
  ChevronUp, ChevronDown, Check,
} from 'lucide-react'
import './Menu.css'
import { formatProductTitle, formatSpanishText } from '../lib/textFormat'
import { getEditorialDescription } from '../lib/menuEditorial'
import { categoryLabel, classifyMenuCategory, menuItemRank, menuCategoryRank, isKnownCategory, hydrateMenuCategories, slugifyCategory, defaultMenuCategories } from '../lib/menuCategories'

const catLabel = categoryLabel

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
const emptyForm: Form = { name: '', description: '', category: 'otros', emoji: '🍽️', price: '', cost: '', imageUrl: null, isActive: true }

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

  const [selectMode, setSelectMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [bulkDeleting, setBulkDeleting] = useState(false)

  const [menuCats, setMenuCats] = useState<MenuCategoryRow[]>([])
  const [catManagerOpen, setCatManagerOpen] = useState(false)

  const load = useCallback(async () => {
    try {
      setLoading(true)
      const [catalog, fetchedCats] = await Promise.all([
        getAllSellableProducts(),
        getMenuCategories().catch(() => [] as MenuCategoryRow[]),
      ])
      // Si la tabla aún no existe (migración sin aplicar), usamos las por defecto
      // para que el panel siga funcionando.
      const cats: MenuCategoryRow[] = fetchedCats.length
        ? fetchedCats
        : defaultMenuCategories().map((d) => ({ id: d.key, key: d.key, label: d.label, sortOrder: d.sortOrder, isActive: true }))
      hydrateMenuCategories(cats)
      setMenuCats(cats)
      // Respetamos la categoría guardada si ya es una categoría válida y
      // específica (una edición manual). Solo auto-clasificamos por nombre los
      // platos sin categoría útil ("otros") o con valores heredados/desconocidos.
      const resolveCategory = (product: SellableProduct) =>
        product.category !== 'otros' && isKnownCategory(product.category)
          ? product.category
          : classifyMenuCategory(product.name, product.category)
      setProducts(catalog.map(product => ({ ...product, category: resolveCategory(product) }))
        .sort((a, b) => {
          const categoryDelta = menuCategoryRank(a.category) - menuCategoryRank(b.category)
          return categoryDelta || menuItemRank(a.name, a.category) - menuItemRank(b.name, b.category)
        }))
    }
    catch (e) { setError(e instanceof Error ? e.message : 'Error cargando el menú') }
    finally { setLoading(false) }
  }, [])
  useEffect(() => { void load() }, [load])

  const flash = (m: string) => { setNotice(m); setTimeout(() => setNotice(''), 3000) }

  // Categorías disponibles para asignar a un plato (todas las de la BD).
  const allCategoryKeys = useMemo(() => menuCats.map((c) => c.key), [menuCats])
  const categories = useMemo(() => allCategoryKeys.filter(category => products.some(product => product.category === category)), [allCategoryKeys, products])
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

  const handleDelete = async (p: SellableProduct) => {
    if (!window.confirm(`¿Eliminar "${p.name}" del menú de forma permanente?\n\nSi el plato tiene ventas registradas no se podrá eliminar; en ese caso usa "Ocultar".`)) return
    setError('')
    try { await deleteProduct(p.id); flash(`"${p.name}" eliminado`); await load() }
    catch (e) { setError(e instanceof Error ? e.message : 'No se pudo eliminar el plato') }
  }

  const exitSelectMode = () => { setSelectMode(false); setSelectedIds(new Set()) }
  const toggleSelect = (id: string) => setSelectedIds((prev) => {
    const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next
  })
  const allFilteredSelected = filtered.length > 0 && filtered.every((p) => selectedIds.has(p.id))
  const toggleSelectAll = () => setSelectedIds((prev) => {
    if (allFilteredSelected) { const next = new Set(prev); filtered.forEach((p) => next.delete(p.id)); return next }
    const next = new Set(prev); filtered.forEach((p) => next.add(p.id)); return next
  })

  const handleBulkDelete = async () => {
    const targets = products.filter((p) => selectedIds.has(p.id))
    if (targets.length === 0) return
    if (!window.confirm(`¿Eliminar ${targets.length} plato${targets.length === 1 ? '' : 's'} de forma permanente?\n\nLos platos con ventas registradas no se podrán eliminar; se omitirán.`)) return
    setBulkDeleting(true); setError('')
    let ok = 0; const failed: string[] = []
    for (const p of targets) {
      try { await deleteProduct(p.id); ok++ }
      catch { failed.push(p.name) }
    }
    setBulkDeleting(false); exitSelectMode()
    if (ok > 0) flash(`${ok} plato${ok === 1 ? '' : 's'} eliminado${ok === 1 ? '' : 's'}`)
    if (failed.length > 0) setError(`No se pudieron eliminar (tienen ventas): ${failed.join(', ')}`)
    await load()
  }

  // --- Gestión de categorías --------------------------------------------------
  const reloadCategories = async () => {
    const cats = await getMenuCategories()
    hydrateMenuCategories(cats); setMenuCats(cats)
  }

  const handleAddCategory = async (label: string) => {
    const clean = formatSpanishText(label.trim())
    if (!clean) return
    let key = slugifyCategory(clean)
    const existingKeys = new Set(menuCats.map((c) => c.key))
    if (existingKeys.has(key)) { let n = 2; while (existingKeys.has(`${key}_${n}`)) n++; key = `${key}_${n}` }
    const sortOrder = (menuCats.reduce((max, c) => Math.max(max, c.sortOrder), 0)) + 10
    setError('')
    try { await createMenuCategory({ key, label: clean, sortOrder }); flash(`Categoría "${clean}" creada`); await reloadCategories() }
    catch (e) { setError(e instanceof Error ? e.message : 'No se pudo crear la categoría') }
  }

  const handleRenameCategory = async (cat: MenuCategoryRow, label: string) => {
    const clean = formatSpanishText(label.trim())
    if (!clean || clean === cat.label) return
    setError('')
    try { await updateMenuCategory(cat.id, { label: clean }); flash('Nombre actualizado'); await reloadCategories() }
    catch (e) { setError(e instanceof Error ? e.message : 'No se pudo renombrar la categoría') }
  }

  const handleMoveCategory = async (index: number, dir: -1 | 1) => {
    const target = index + dir
    if (target < 0 || target >= menuCats.length) return
    const a = menuCats[index], b = menuCats[target]
    setError('')
    try { await Promise.all([updateMenuCategory(a.id, { sortOrder: b.sortOrder }), updateMenuCategory(b.id, { sortOrder: a.sortOrder })]); await reloadCategories() }
    catch (e) { setError(e instanceof Error ? e.message : 'No se pudo reordenar') }
  }

  const handleDeleteCategory = async (cat: MenuCategoryRow) => {
    const inUse = products.filter((p) => p.category === cat.key).length
    if (inUse > 0) { setError(`No se puede eliminar "${cat.label}": tiene ${inUse} plato${inUse === 1 ? '' : 's'}. Muévelos a otra categoría primero.`); return }
    if (!window.confirm(`¿Eliminar la categoría "${cat.label}"?`)) return
    setError('')
    try { await deleteMenuCategory(cat.id); flash(`Categoría "${cat.label}" eliminada`); await reloadCategories() }
    catch (e) { setError(e instanceof Error ? e.message : 'No se pudo eliminar la categoría') }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name.trim() || !(parseFloat(form.price) >= 0)) { setError('Nombre y precio son obligatorios'); return }
    setSaving(true); setError('')
    try {
      const payload = {
        name: formatProductTitle(form.name), description: formatSpanishText(form.description.trim()) || null,
        price: parseFloat(form.price) || 0, cost: form.cost.trim() ? parseFloat(form.cost) : null,
        category: isKnownCategory(form.category) ? form.category : classifyMenuCategory(form.name, form.category), emoji: form.emoji || '🍽️', imageUrl: form.imageUrl, isActive: form.isActive,
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
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button className="mnu-select-btn" onClick={() => setCatManagerOpen(true)}><Tag size={15} /> Categorías</button>
          <button className="mnu-btn" onClick={openNew}><Plus size={16} /> Nuevo plato</button>
        </div>
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
        {selectMode
          ? <button className="mnu-select-btn active" onClick={exitSelectMode}><X size={15} /> Salir de selección</button>
          : <button className="mnu-select-btn" onClick={() => setSelectMode(true)}><CheckSquare size={15} /> Seleccionar</button>}
        <div className="mnu-view">
          <button className={view === 'grid' ? 'active' : ''} onClick={() => setView('grid')} aria-label="Cuadrícula"><LayoutGrid size={16} /></button>
          <button className={view === 'list' ? 'active' : ''} onClick={() => setView('list')} aria-label="Lista"><List size={16} /></button>
        </div>
      </div>

      {selectMode && (
        <div className="mnu-bulk-bar">
          <button className="mnu-bulk-check" onClick={toggleSelectAll}>{allFilteredSelected ? <CheckSquare size={16} /> : <Square size={16} />} {allFilteredSelected ? 'Quitar todos' : 'Seleccionar todos'}</button>
          <span className="mnu-bulk-count">{selectedIds.size} seleccionado{selectedIds.size === 1 ? '' : 's'}</span>
          <button className="mnu-bulk-delete" onClick={handleBulkDelete} disabled={selectedIds.size === 0 || bulkDeleting}>{bulkDeleting ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />} Eliminar seleccionados</button>
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="mnu-table-wrap" style={{ textAlign: 'center', color: '#71717a', padding: 30 }}>No hay platos que coincidan.</div>
      ) : view === 'grid' ? (
        <div className="mnu-grid">
          {filtered.map((p) => {
            const selected = selectedIds.has(p.id)
            return (
            <div key={p.id} className={`mnu-card${p.isActive ? '' : ' off'}${selectMode ? ' selectable' : ''}${selected ? ' selected' : ''}`} onClick={selectMode ? () => toggleSelect(p.id) : undefined}>
              {selectMode && <span className="mnu-check" aria-hidden>{selected ? <CheckSquare size={20} /> : <Square size={20} />}</span>}
              {thumb(p, 'mnu-thumb')}
              <div className="mnu-card-body">
                <span className="mnu-card-name">{formatProductTitle(p.name)}</span>
                <span className="mnu-card-cat">{catLabel(p.category)}</span>
                <div className="mnu-card-row">
                  <span className="mnu-price">{formatUsd(p.salePrice)}</span>
                  <span className={`mnu-badge ${p.isActive ? 'on' : 'off'}`}>{p.isActive ? 'Activo' : 'Inactivo'}</span>
                </div>
              </div>
              {!selectMode && (
              <div className="mnu-card-actions">
                <button className="mnu-act" onClick={() => openEdit(p)}><Pencil size={14} /> Editar</button>
                <button className="mnu-act" onClick={() => toggleActive(p)}>{p.isActive ? <><EyeOff size={14} /> Ocultar</> : <><Eye size={14} /> Activar</>}</button>
                <button className="mnu-act mnu-act-danger" onClick={() => handleDelete(p)} title="Eliminar plato" aria-label={`Eliminar ${p.name}`}><Trash2 size={14} /></button>
              </div>
              )}
            </div>
          )})}
        </div>
      ) : (
        <div className="mnu-table-wrap">
          <table className="mnu-table">
            <thead><tr>{selectMode && <th style={{ width: 40 }}><button className="mnu-icon-btn" onClick={toggleSelectAll} title="Seleccionar todos">{allFilteredSelected ? <CheckSquare size={16} /> : <Square size={16} />}</button></th>}<th>Plato</th><th>Categoría</th><th>Precio</th><th>Estado</th><th>Acciones</th></tr></thead>
            <tbody>
              {filtered.map((p) => (
                <tr key={p.id} className={selectMode ? 'selectable' : ''} onClick={selectMode ? () => toggleSelect(p.id) : undefined}>
                  {selectMode && <td><span className="mnu-check-cell">{selectedIds.has(p.id) ? <CheckSquare size={18} /> : <Square size={18} />}</span></td>}
                  <td><div className="mnu-row-name">{thumb(p, 'mnu-row-thumb')}<div><strong>{formatProductTitle(p.name)}</strong>{(p.description || getEditorialDescription(p.name)) && <><br /><small style={{ color: '#71717a', display: 'block', maxWidth: 280, lineHeight: 1.35 }}>{getEditorialDescription(p.name, p.description || '')}</small></>}</div></div></td>
                  <td style={{ textTransform: 'capitalize', color: '#a1a1aa' }}>{catLabel(p.category)}</td>
                  <td className="mnu-price" style={{ fontSize: 15 }}>{formatUsd(p.salePrice)}</td>
                  <td><button className={`mnu-switch ${p.isActive ? 'on' : ''}`} onClick={(e) => { e.stopPropagation(); toggleActive(p) }} title={p.isActive ? 'Activo' : 'Inactivo'} /></td>
                  <td><button className="mnu-icon-btn" onClick={(e) => { e.stopPropagation(); openEdit(p) }} title="Editar"><Pencil size={16} /></button>
                    <button className="mnu-icon-btn mnu-icon-danger" onClick={(e) => { e.stopPropagation(); handleDelete(p) }} title="Eliminar" aria-label={`Eliminar ${p.name}`}><Trash2 size={16} /></button></td>
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
                <select value={allCategoryKeys.includes(form.category) ? form.category : (allCategoryKeys.includes('otros') ? 'otros' : allCategoryKeys[0] ?? '')} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                  {menuCats.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
                </select>
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

      {catManagerOpen && (
        <CategoryManager
          cats={menuCats}
          products={products}
          onClose={() => setCatManagerOpen(false)}
          onAdd={handleAddCategory}
          onRename={handleRenameCategory}
          onMove={handleMoveCategory}
          onDelete={handleDeleteCategory}
        />
      )}
    </div>
  )
}

interface CategoryManagerProps {
  cats: MenuCategoryRow[]
  products: SellableProduct[]
  onClose: () => void
  onAdd: (label: string) => Promise<void>
  onRename: (cat: MenuCategoryRow, label: string) => Promise<void>
  onMove: (index: number, dir: -1 | 1) => Promise<void>
  onDelete: (cat: MenuCategoryRow) => Promise<void>
}

function CategoryManager({ cats, products, onClose, onAdd, onRename, onMove, onDelete }: CategoryManagerProps) {
  const [newLabel, setNewLabel] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editLabel, setEditLabel] = useState('')
  const [busy, setBusy] = useState(false)

  const countFor = (key: string) => products.filter((p) => p.category === key).length

  const submitNew = async () => {
    if (!newLabel.trim() || busy) return
    setBusy(true); await onAdd(newLabel); setNewLabel(''); setBusy(false)
  }
  const submitRename = async (cat: MenuCategoryRow) => {
    if (busy) return
    setBusy(true); await onRename(cat, editLabel); setEditingId(null); setBusy(false)
  }

  return (
    <div className="mnu-modal-overlay" onClick={onClose}>
      <div className="mnu-modal mnu-cat-modal" onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3><Tag size={18} style={{ verticalAlign: '-3px', marginRight: 6 }} />Categorías del menú</h3>
          <button type="button" className="mnu-cancel" style={{ padding: 6 }} onClick={onClose}><X size={16} /></button>
        </div>
        <p className="page-subtitle" style={{ margin: '4px 0 12px' }}>Crea, renombra y reordena las categorías. Los cambios se ven en el menú y en el sitio de clientes.</p>

        <div className="mnu-cat-add">
          <input value={newLabel} onChange={(e) => setNewLabel(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') void submitNew() }} placeholder="Nueva categoría (ej. Postres)" />
          <button className="mnu-btn" onClick={() => void submitNew()} disabled={!newLabel.trim() || busy}><Plus size={15} /> Agregar</button>
        </div>

        <div className="mnu-cat-list">
          {cats.map((cat, index) => (
            <div key={cat.id} className="mnu-cat-row">
              <div className="mnu-cat-order">
                <button className="mnu-icon-btn" onClick={() => void onMove(index, -1)} disabled={index === 0 || busy} title="Subir"><ChevronUp size={15} /></button>
                <button className="mnu-icon-btn" onClick={() => void onMove(index, 1)} disabled={index === cats.length - 1 || busy} title="Bajar"><ChevronDown size={15} /></button>
              </div>
              {editingId === cat.id ? (
                <input className="mnu-cat-edit" autoFocus value={editLabel} onChange={(e) => setEditLabel(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') void submitRename(cat); if (e.key === 'Escape') setEditingId(null) }} />
              ) : (
                <div className="mnu-cat-name"><strong>{cat.label}</strong><span>{countFor(cat.key)} plato{countFor(cat.key) === 1 ? '' : 's'}</span></div>
              )}
              <div className="mnu-cat-actions">
                {editingId === cat.id ? (
                  <>
                    <button className="mnu-icon-btn" onClick={() => void submitRename(cat)} title="Guardar"><Check size={16} /></button>
                    <button className="mnu-icon-btn" onClick={() => setEditingId(null)} title="Cancelar"><X size={16} /></button>
                  </>
                ) : (
                  <>
                    <button className="mnu-icon-btn" onClick={() => { setEditingId(cat.id); setEditLabel(cat.label) }} title="Renombrar"><Pencil size={16} /></button>
                    <button className="mnu-icon-btn mnu-icon-danger" onClick={() => void onDelete(cat)} title="Eliminar"><Trash2 size={16} /></button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>

        <div className="mnu-modal-actions">
          <button type="button" className="mnu-btn" onClick={onClose}>Listo</button>
        </div>
      </div>
    </div>
  )
}
