import { useEffect, useMemo, useRef, useState, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { getAllSellableProducts, createProduct, updateProduct, deleteProduct, setProductExtraCategories, getMenuCategories, createMenuCategory, updateMenuCategory, deleteMenuCategory, type SellableProduct, type MenuCategoryRow } from '../lib/dataService'
import { formatUsd } from '../lib/money'
import {
  UtensilsCrossed, Plus, Search, Pencil, Loader2, CheckCircle2,
  LayoutGrid, List, ImagePlus, X, Package, Eye, EyeOff, Tag, Trash2, CheckSquare, Square,
  ChevronUp, ChevronDown, Check,
} from 'lucide-react'
import './Menu.css'
import { PageSkeleton } from '../components/PageSkeleton'
import Toast from '../components/Toast'
import NumberStepper from '../components/NumberStepper'
import { confirmDialog } from '../components/ConfirmDialog'
import { EmptyState } from '../components/EmptyState'
import { StyledSelect } from '../components/StyledSelect'
import { formatProductTitle, formatSpanishText, normalizeForSearch } from '../lib/textFormat'
import { categoryLabel, classifyMenuCategory, menuItemRank, menuCategoryRank, isKnownCategory, hydrateMenuCategories, slugifyCategory, defaultMenuCategories } from '../lib/menuCategories'

const catLabel = categoryLabel
const EDIT_MODAL_EXIT_MS = 300

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

interface Form { name: string; description: string; categories: string[]; emoji: string; price: string; cost: string; imageUrl: string | null; isActive: boolean; menuLabel: SellableProduct['menuLabel'] }
const emptyForm: Form = { name: '', description: '', categories: ['otros'], emoji: '', price: '', cost: '', imageUrl: null, isActive: true, menuLabel: null }

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
  const [editingClosing, setEditingClosing] = useState(false)
  const editCloseTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [form, setForm] = useState<Form>(emptyForm)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (editing) document.body.classList.add('modal-open')
    else document.body.classList.remove('modal-open')
    return () => document.body.classList.remove('modal-open')
  }, [editing])

  useEffect(() => () => {
    if (editCloseTimer.current) clearTimeout(editCloseTimer.current)
  }, [])

  const [selectMode, setSelectMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [bulkDeleting, setBulkDeleting] = useState(false)

  const [menuCats, setMenuCats] = useState<MenuCategoryRow[]>([])
  const [catManagerOpen, setCatManagerOpen] = useState(false)

  const load = useCallback(async (silent = false) => {
    try {
      if (!silent) setLoading(true)
      const [catalog, fetchedCats] = await Promise.all([
        getAllSellableProducts(),
        getMenuCategories().catch(() => [] as MenuCategoryRow[]),
      ])
      const cats: MenuCategoryRow[] = fetchedCats.length
        ? fetchedCats
        : defaultMenuCategories().map((d) => ({ id: d.key, key: d.key, label: d.label, sortOrder: d.sortOrder, isActive: true }))
      hydrateMenuCategories(cats)
      setMenuCats(cats)
      const resolveCategory = (product: SellableProduct) =>
        product.category !== 'otros' && isKnownCategory(product.category)
          ? product.category
          : classifyMenuCategory(product.name, product.category)
      const resolveAll = (product: SellableProduct) => {
        const primary = resolveCategory(product)
        const extras = product.categories.filter((c) => c !== product.category)
        return { ...product, category: primary, categories: Array.from(new Set([primary, ...extras])) }
      }
      setProducts(catalog.filter(product => !product.isDelivery).map(resolveAll)
        .sort((a, b) => {
          const categoryDelta = menuCategoryRank(a.category) - menuCategoryRank(b.category)
          return categoryDelta || menuItemRank(a.name, a.category) - menuItemRank(b.name, b.category)
        }))
    }
    catch (e) { setError(e instanceof Error ? e.message : 'Error cargando el menú') }
    finally { if (!silent) setLoading(false) }
  }, [])
  useEffect(() => { void load() }, [load])

  const flash = (m: string) => { setNotice(m); setTimeout(() => setNotice(''), 3000) }

  // Categorías disponibles para asignar a un plato (todas las de la BD).
  const allCategoryKeys = useMemo(() => menuCats.map((c) => c.key), [menuCats])
  const categories = useMemo(() => allCategoryKeys.filter(category => products.some(product => product.categories.includes(category))), [allCategoryKeys, products])
  const summary = useMemo(() => ({
    total: products.length,
    active: products.filter((p) => p.isActive).length,
    inactive: products.filter((p) => !p.isActive).length,
    cats: categories.length,
  }), [products, categories])

  const filtered = useMemo(() => {
    const q = normalizeForSearch(search)
    return products.filter((p) => {
      if (q && !normalizeForSearch(p.name).includes(q)) return false
      if (catFilter !== 'all' && !p.categories.includes(catFilter)) return false
      if (statusFilter === 'active' && !p.isActive) return false
      if (statusFilter === 'inactive' && p.isActive) return false
      return true
    })
  }, [products, search, catFilter, statusFilter])

  const prepareEditorOpen = () => {
    if (editCloseTimer.current) clearTimeout(editCloseTimer.current)
    editCloseTimer.current = null
    setEditingClosing(false)
  }
  const closeEditor = () => {
    if (!editing || editingClosing) return
    setEditingClosing(true)
    editCloseTimer.current = setTimeout(() => {
      setEditing(null)
      setEditingClosing(false)
      editCloseTimer.current = null
    }, EDIT_MODAL_EXIT_MS)
  }
  const openNew = () => { prepareEditorOpen(); setForm(emptyForm); setEditing('new') }
  const openEdit = (p: SellableProduct) => {
    prepareEditorOpen()
    setForm({ name: p.name, description: p.description ?? '', categories: p.categories.length ? p.categories : [p.category], emoji: p.emoji || '', price: String(p.salePrice), cost: p.cost != null ? String(p.cost) : '', imageUrl: p.imageUrl, isActive: p.isActive, menuLabel: p.menuLabel })
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
    const ok = await confirmDialog({ title: 'Eliminar plato', message: `¿Eliminar "${p.name}" del menú de forma permanente?\n\nSi el plato tiene ventas registradas no se podrá eliminar; en ese caso usa "Ocultar".`, confirmText: 'Eliminar', danger: true })
    if (!ok) return
    setError('')
    try { await deleteProduct(p.id); flash(`"${p.name}" eliminado`); await load() }
    catch (e) { setError(e instanceof Error ? e.message : 'No se pudo eliminar el plato') }
  }

  const exitSelectMode = () => { setSelectMode(false); setSelectedIds(new Set()) }
  const toggleSelect = (id: string) => setSelectedIds((prev) => {
    const next = new Set(prev)
    if (next.has(id)) next.delete(id); else next.add(id)
    return next
  })
  const allFilteredSelected = filtered.length > 0 && filtered.every((p) => selectedIds.has(p.id))
  const toggleSelectAll = () => setSelectedIds((prev) => {
    if (allFilteredSelected) { const next = new Set(prev); filtered.forEach((p) => next.delete(p.id)); return next }
    const next = new Set(prev); filtered.forEach((p) => next.add(p.id)); return next
  })

  const handleBulkDelete = async () => {
    const targets = products.filter((p) => selectedIds.has(p.id))
    if (targets.length === 0) return
    const confirmed = await confirmDialog({ title: 'Eliminar platos', message: `¿Eliminar ${targets.length} plato${targets.length === 1 ? '' : 's'} de forma permanente?\n\nLos platos con ventas registradas no se podrán eliminar; se omitirán.`, confirmText: 'Eliminar', danger: true })
    if (!confirmed) return
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
    const inUse = products.filter((p) => p.categories.includes(cat.key)).length
    if (inUse > 0) { setError(`No se puede eliminar "${cat.label}": tiene ${inUse} plato${inUse === 1 ? '' : 's'}. Muévelos a otra categoría primero.`); return }
    const ok = await confirmDialog({ title: 'Eliminar categoría', message: `¿Eliminar la categoría "${cat.label}"?`, confirmText: 'Eliminar', danger: true })
    if (!ok) return
    setError('')
    try { await deleteMenuCategory(cat.id); flash(`Categoría "${cat.label}" eliminada`); await reloadCategories() }
    catch (e) { setError(e instanceof Error ? e.message : 'No se pudo eliminar la categoría') }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name.trim() || !(parseFloat(form.price) >= 0)) { setError('Nombre y precio son obligatorios'); return }
    const chosen = form.categories.length ? form.categories : ['otros']
    const primary = [...chosen].sort((a, b) => menuCategoryRank(a) - menuCategoryRank(b))[0]
    setSaving(true); setError('')
    try {
      const payload = {
        name: formatProductTitle(form.name), description: formatSpanishText(form.description.trim()) || null,
        price: parseFloat(form.price) || 0, cost: form.cost.trim() ? parseFloat(form.cost) : null,
        category: isKnownCategory(primary) ? primary : classifyMenuCategory(form.name, primary), emoji: form.emoji || '', imageUrl: form.imageUrl, isActive: form.isActive, menuLabel: form.menuLabel,
      }
      let productId: string
      if (editing === 'new') { productId = await createProduct(payload); flash(`Plato "${payload.name}" creado`) }
      else if (editing) { productId = editing.id; await updateProduct(editing.id, payload); flash(`"${payload.name}" actualizado`) }
      else { productId = '' }
      if (productId) await setProductExtraCategories(productId, chosen, payload.category)

      // Optimistic update: add/update product in local state immediately
      if (productId) {
        const updated: SellableProduct = editing === 'new'
          ? { id: productId, isDelivery: false, name: payload.name, description: payload.description ?? '', category: payload.category, categories: chosen, emoji: payload.emoji, salePrice: payload.price, cost: payload.cost, imageUrl: payload.imageUrl, isActive: payload.isActive, menuLabel: payload.menuLabel }
          : { ...(editing as SellableProduct), id: productId, name: payload.name, description: payload.description ?? '', category: payload.category, categories: chosen, emoji: payload.emoji, salePrice: payload.price, cost: payload.cost, imageUrl: payload.imageUrl, isActive: payload.isActive, menuLabel: payload.menuLabel }
        setProducts(prev => editing === 'new' ? [...prev, updated] : prev.map(p => p.id === productId ? updated : p))
      }

      closeEditor()
      // Silent background refresh to stay in sync (no loading spinner)
      void load(true)
    } catch (e) { setError(e instanceof Error ? e.message : 'Error al guardar el plato') }
    finally { setSaving(false) }
  }

  if (loading) return <PageSkeleton cards={4} rows={6} hasTable={false} />

  const thumb = (p: SellableProduct, cls: string) => p.imageUrl ? <img className={cls} src={p.imageUrl} alt={p.name} loading="lazy" /> : <span className={cls}><UtensilsCrossed size={16} /></span>

  return (
    <div className="page mnu-page animate-fade-in">
      <header className="page-header">
        <div>
          <h1 className="page-title"><UtensilsCrossed size={22} className="page-title-icon" /> Menú</h1>
          <p className="page-subtitle">Gestiona y organiza todos tus platos.</p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button className="mnu-select-btn" onClick={() => setCatManagerOpen(true)}><Tag size={15} /> Categorías</button>
          <button className="mnu-btn" onClick={openNew}><Plus size={16} /> Nuevo plato</button>
        </div>
      </header>

      {error && <Toast type="error" message={error} onClose={() => setError('')} />}
      {notice && <Toast type="success" message={notice} onClose={() => setNotice('')} />}

      <div className="mnu-summary">
        <div className="mnu-sum mnu-sum-primary"><span className="mnu-sum-ic"><Package size={20} /></span><div><div className="mnu-sum-lbl">Total platos</div><div className="mnu-sum-val">{summary.total}</div></div></div>
        <div className="mnu-sum mnu-sum-success"><span className="mnu-sum-ic"><Eye size={20} /></span><div><div className="mnu-sum-lbl">Activos (en venta)</div><div className="mnu-sum-val">{summary.active}</div></div></div>
        <div className="mnu-sum mnu-sum-muted"><span className="mnu-sum-ic"><EyeOff size={20} /></span><div><div className="mnu-sum-lbl">Inactivos</div><div className="mnu-sum-val">{summary.inactive}</div></div></div>
        <div className="mnu-sum mnu-sum-gold"><span className="mnu-sum-ic"><Tag size={20} /></span><div><div className="mnu-sum-lbl">Categorías</div><div className="mnu-sum-val">{summary.cats}</div></div></div>
      </div>

      <div className="mnu-tools">
        <div className="mnu-search">
          <Search size={15} className="ic" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar plato..." />
          {search && <button type="button" className="search-clear-btn search-clear-btn--floating" onClick={() => setSearch('')} aria-label="Borrar búsqueda"><X size={13} /></button>}
        </div>
        <StyledSelect value={catFilter} onChange={(e) => setCatFilter(e.target.value)}><option value="all">Categoría: Todas</option>{categories.map((c) => <option key={c} value={c}>{catLabel(c)}</option>)}</StyledSelect>
        <StyledSelect value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as 'all' | 'active' | 'inactive')}><option value="all">Estado: Todos</option><option value="active">Activos</option><option value="inactive">Inactivos</option></StyledSelect>
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
        <EmptyState
          title="No hay platos que coincidan"
          description="Prueba con otro nombre, cambia los filtros o crea un plato nuevo."
          actionLabel="Nuevo plato"
          onAction={openNew}
        />
      ) : view === 'grid' ? (
        <div className="mnu-grid">
          {filtered.map((p, i) => {
            const selected = selectedIds.has(p.id)
            return (
            <div key={p.id} className={`mnu-card${p.isActive ? '' : ' off'}${selectMode ? ' selectable' : ''}${selected ? ' selected' : ''}`} style={{ animationDelay: `${i * 40}ms` }} onClick={selectMode ? () => toggleSelect(p.id) : () => openEdit(p)}>
              {selectMode && <span className="mnu-check" aria-hidden>{selected ? <CheckSquare size={20} /> : <Square size={20} />}</span>}
              {thumb(p, 'mnu-thumb')}
              <div className="mnu-card-body">
                <span className="mnu-card-name">{formatProductTitle(p.name)}</span>
                <span className="mnu-card-cat">{p.categories.map(catLabel).join(' · ')}</span>
                <div className="mnu-card-row">
                  <span className="mnu-price">{formatUsd(p.salePrice)}</span>
                  <span className={`mnu-badge ${p.isActive ? 'on' : 'off'}`}>{p.isActive ? 'Activo' : 'Inactivo'}</span>
                </div>
              </div>
              {!selectMode && (
              <div className="mnu-card-actions">
                <button className="mnu-act" onClick={(e) => { e.stopPropagation(); openEdit(p) }}><Pencil size={14} /> Editar</button>
                <button className="mnu-act" onClick={(e) => { e.stopPropagation(); toggleActive(p) }}>{p.isActive ? <><EyeOff size={14} /> Ocultar</> : <><Eye size={14} /> Activar</>}</button>
                <button className="mnu-act mnu-act-danger" onClick={(e) => { e.stopPropagation(); handleDelete(p) }} title="Eliminar plato" aria-label={`Eliminar ${p.name}`}><Trash2 size={14} /></button>
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
                <tr key={p.id} className={selectMode ? 'selectable' : 'mnu-row-clickable'} onClick={selectMode ? () => toggleSelect(p.id) : () => openEdit(p)}>
                  {selectMode && <td><span className="mnu-check-cell">{selectedIds.has(p.id) ? <CheckSquare size={18} /> : <Square size={18} />}</span></td>}
                  <td><div className="mnu-row-name">{thumb(p, 'mnu-row-thumb')}<div><strong>{formatProductTitle(p.name)}</strong>{p.description && <><br /><small style={{ color: '#71717a', display: 'block', maxWidth: 280, lineHeight: 1.35 }}>{p.description}</small></>}</div></div></td>
                  <td style={{ textTransform: 'capitalize', color: '#a1a1aa' }}>{p.categories.map(catLabel).join(' · ')}</td>
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

      {editing && createPortal(
        <div className={`mnu-modal-overlay ${editingClosing ? 'closing' : ''}`} onClick={closeEditor}>
          <form className="mnu-modal mnu-product-modal" onClick={(e) => e.stopPropagation()} onSubmit={handleSubmit}>
            <div className="mnu-modal-header">
              <h3><UtensilsCrossed size={20} style={{ color: '#e11d2a' }} />{editing === 'new' ? 'Nuevo plato' : 'Editar plato'}</h3>
            </div>

            <div className="mnu-modal-body mnu-product-body">
              <aside className="mnu-product-aside">
                <div className="mnu-field mnu-photo-field">
                  <label>Foto del plato</label>
                  {form.imageUrl ? (
                    <div className="mnu-photo-card mnu-photo-card-filled">
                      <label className="mnu-photo-preview" title="Cambiar foto">
                        <img src={form.imageUrl} alt="Vista previa del plato" />
                        <span>Cambiar foto</span>
                        <input type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => pickImage(e.target.files?.[0])} />
                      </label>
                      <div className="mnu-photo-info">
                        <small>JPG, PNG o WebP</small>
                        <label className="mnu-photo-change"><ImagePlus size={15} /> Cambiar foto<input type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => pickImage(e.target.files?.[0])} /></label>
                      </div>
                      <button type="button" className="mnu-photo-delete" title="Quitar foto" aria-label="Quitar foto" onClick={() => setForm((f) => ({ ...f, imageUrl: null }))}><Trash2 size={16} /></button>
                    </div>
                  ) : (
                    <label className="mnu-photo-card mnu-photo-empty">
                      <span className="mnu-photo-empty-icon"><ImagePlus size={22} /></span>
                      <span className="mnu-photo-empty-copy"><strong>Selecciona una foto</strong><small>JPG, PNG o WebP</small></span>
                      <span className="mnu-photo-select">Subir foto</span>
                      <input type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => pickImage(e.target.files?.[0])} />
                    </label>
                  )}
                </div>

                <div className="mnu-product-status">
                  <div><strong>Disponible en el menú</strong><small>{form.isActive ? 'Los clientes pueden verlo y pedirlo.' : 'El plato permanecerá oculto.'}</small></div>
                  <button type="button" className={`mnu-switch ${form.isActive ? 'on' : ''}`} aria-label={form.isActive ? 'Desactivar plato' : 'Activar plato'} onClick={() => setForm((f) => ({ ...f, isActive: !f.isActive }))} />
                </div>
              </aside>

              <section className="mnu-product-main">
                <div className="mnu-product-section mnu-info-section">
                  <div className="mnu-product-section-title">Información del plato</div>
                  <div className="mnu-field"><label>Nombre del plato *</label><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ej. Arroz Frito Especial" required /></div>
                  <div className="mnu-field"><label>Descripción</label><textarea rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Describe los ingredientes o qué incluye" /></div>
                </div>

                <div className="mnu-product-section mnu-price-section">
                  <div className="mnu-product-section-title">Precio</div>
                  <div className="mnu-row2">
                    <div className="mnu-field"><label>Precio de venta *</label><NumberStepper prefix="$" step={0.01} min={0} value={form.price} onChange={(v) => setForm({ ...form, price: v })} placeholder="0.00" required /></div>
                    <div className="mnu-field"><label>Costo estimado</label><NumberStepper prefix="$" step={0.01} min={0} value={form.cost} onChange={(v) => setForm({ ...form, cost: v })} placeholder="Opcional" /></div>
                  </div>
                </div>

                <div className="mnu-product-section mnu-category-section">
                  <div className="mnu-product-section-title">Categorías <small>Elige una o varias</small></div>
                  <div className="mnu-cat-chips">
                    {menuCats.map((c) => {
                      const on = form.categories.includes(c.key)
                      return (
                        <button type="button" key={c.key} className={`mnu-cat-chip ${on ? 'on' : ''}`}
                          onClick={() => setForm((f) => ({ ...f, categories: on ? f.categories.filter((k) => k !== c.key) : [...f.categories, c.key] }))}>
                          {on && <Check size={13} />}{c.label}
                        </button>
                      )
                    })}
                  </div>
                </div>
                <div className="mnu-product-section"><div className="mnu-product-section-title">Etiqueta del plato <small>Visible para los clientes</small></div><StyledSelect className="mnu-label-select modal-select-dark" aria-label="Etiqueta del plato" value={form.menuLabel ?? ''} onChange={e => setForm({ ...form, menuLabel: (e.target.value || null) as SellableProduct['menuLabel'] })}><option value="">Sin etiqueta</option><option value="top_sales">🔥 Más vendido</option><option value="new">✨ Nuevo</option><option value="recommended">⭐ Recomendado</option><option value="free_drink">🥤 Refresco gratis</option></StyledSelect></div>
              </section>
            </div>

            <div className="mnu-modal-actions">
              <button type="button" className="mnu-cancel" onClick={closeEditor}>Cancelar</button>
              <button type="submit" className="mnu-btn" disabled={saving}>{saving ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />} {editing === 'new' ? 'Crear plato' : 'Guardar cambios'}</button>
            </div>
          </form>
        </div>,
        document.body,
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
  const [closing, setClosing] = useState(false)

  const requestClose = () => {
    if (closing) return
    setClosing(true)
    window.setTimeout(() => {
      onClose()
    }, 200)
  }

  const countFor = (key: string) => products.filter((p) => p.category === key).length

  const submitNew = async () => {
    if (!newLabel.trim() || busy) return
    setBusy(true); await onAdd(newLabel); setNewLabel(''); setBusy(false)
  }
  const submitRename = async (cat: MenuCategoryRow) => {
    if (busy) return
    setBusy(true); await onRename(cat, editLabel); setEditingId(null); setBusy(false)
  }

  return createPortal(
    <div className={`mnu-modal-overlay ${closing ? 'closing' : ''}`} onClick={requestClose}>
      <div className="mnu-modal mnu-cat-modal" onClick={(e) => e.stopPropagation()}>
        <div className="mnu-modal-header">
          <h3><Tag size={18} style={{ color: '#e11d2a' }} />Categorías del menú</h3>
        </div>

        <div className="mnu-modal-body">
          <p className="page-subtitle" style={{ margin: '4px 0 12px', whiteSpace: 'nowrap' }}>Crea, renombra y reordena tus categorías.</p>

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
        </div>

        <div className="mnu-modal-actions">
          <button type="button" className="mnu-btn" onClick={requestClose}>Listo</button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
