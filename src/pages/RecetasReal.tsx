import { useEffect, useMemo, useState, useCallback } from 'react'
import { createPortal } from 'react-dom'
import {
  getRecipeComponents, getSellableProducts, createRecipeComponent, deleteRecipeComponent, updateRecipeComponent,
  getIngredients, getUnits, getRecipeSummaries,
  type RecipeComponent, type SellableProduct, type Ingredient, type RecipeSummary,
} from '../lib/dataService'
import { SearchSelect } from '../components/SearchSelect'
import { PageSkeleton } from '../components/PageSkeleton'
import { StyledSelect } from '../components/StyledSelect'
import NumberStepper from '../components/NumberStepper'
import { useRates } from '../context/rates-context'
import { formatUsd, formatVes } from '../lib/money'
import {
  Plus, Trash2, Pencil, Check, CheckCircle2, AlertTriangle, Search, ChevronLeft, ChevronRight,
  List, LayoutGrid, Soup, Coins, Tag, Percent, ShoppingCart, BookOpen, Info,
  UtensilsCrossed, X,
} from 'lucide-react'
import './RecetasReal.css'
import Toast from '../components/Toast'
import { confirmDialog } from '../components/ConfirmDialog'
import { EmptyState } from '../components/EmptyState'
import { formatProductTitle, formatSpanishText, normalizeForSearch } from '../lib/textFormat'

const PAGE_SIZE = 8
type Tab = 'todas' | 'completas' | 'faltan'

export function RecetasReal() {
  const { bcvRate } = useRates()
  const [products, setProducts] = useState<SellableProduct[]>([])
  const [summaries, setSummaries] = useState<Map<string, RecipeSummary>>(new Map())
  const [selected, setSelected] = useState<SellableProduct | null>(null)
  const [components, setComponents] = useState<RecipeComponent[]>([])
  const [ingredients, setIngredients] = useState<Ingredient[]>([])
  const [units, setUnits] = useState<Array<{ id: string; name: string; symbol: string }>>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  // Filtros / navegación
  const [search, setSearch] = useState('')
  const [tab, setTab] = useState<Tab>('todas')
  const [category, setCategory] = useState('all')
  const [sort, setSort] = useState<'az' | 'price'>('az')
  const [view, setView] = useState<'list' | 'grid'>('list')
  const [page, setPage] = useState(1)
  const [detailTab, setDetailTab] = useState<'ingredientes' | 'info'>('ingredientes')

  // Alta de componente
  const [showAdd, setShowAdd] = useState(false)
  const [addIngredientId, setAddIngredientId] = useState('')
  const [addQuantity, setAddQuantity] = useState('1')
  const [addUnitId, setAddUnitId] = useState('')
  const [editingComponentId, setEditingComponentId] = useState<string | null>(null)
  const [editingQuantity, setEditingQuantity] = useState('')
  const [editingUnitId, setEditingUnitId] = useState('')

  // Configurar una nueva receta (elegir producto)
  const [showNewRecipe, setShowNewRecipe] = useState(false)
  const [closingNewRecipe, setClosingNewRecipe] = useState(false)
  const closeNewRecipe = (then?: () => void) => {
    if (closingNewRecipe) return
    setClosingNewRecipe(true)
    window.setTimeout(() => {
      setShowNewRecipe(false)
      setClosingNewRecipe(false)
      then?.()
    }, 200)
  }
  const [newRecipeProductId, setNewRecipeProductId] = useState('')

  const loadProducts = useCallback(async () => {
    try {
      setLoading(true)
      const [prods, ingr, un, sums] = await Promise.all([
        getSellableProducts(),
        getIngredients(),
        getUnits(),
        getRecipeSummaries().catch(() => new Map<string, RecipeSummary>()),
      ])
      // Las bebidas son productos de reventa: se auto-gestionan como ítem de
      // inventario (costo/venta en Menú, stock en Inventario) y descuentan solo
      // al vender vía su ingrediente espejo. No requieren receta manual, así que
      // se ocultan de esta pantalla.
      const recipeProds = prods.filter((p) => p.category !== 'bebidas')
      setProducts(recipeProds)
      setIngredients(ingr)
      setUnits(un)
      setSummaries(sums)
      if (recipeProds.length > 0) setSelected((cur) => cur ?? recipeProds[0])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error cargando recetas')
    } finally {
      setLoading(false)
    }
  }, [])

  const loadComponents = useCallback(async () => {
    if (!selected) { setComponents([]); return }
    try {
      setComponents(await getRecipeComponents(selected.id))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error cargando componentes')
    }
  }, [selected])

  useEffect(() => { void loadProducts() }, [loadProducts])
  useEffect(() => { void loadComponents() }, [loadComponents])

  useEffect(() => {
    if (ingredients.length > 0 && !addIngredientId) {
      setAddIngredientId(ingredients[0].id)
      setAddUnitId(ingredients[0].unitId)
    }
  }, [ingredients, addIngredientId])

  const summaryOf = useCallback(
    (id: string): RecipeSummary => summaries.get(id) ?? { componentCount: 0, recipeCost: null, marginEstimated: null },
    [summaries],
  )

  const categories = useMemo(() => {
    const set = new Set(products.map((p) => p.category).filter(Boolean))
    return Array.from(set).sort()
  }, [products])

  const counts = useMemo(() => {
    let completas = 0
    for (const p of products) if (summaryOf(p.id).componentCount > 0) completas += 1
    return { todas: products.length, completas, faltan: products.length - completas }
  }, [products, summaryOf])

  const filtered = useMemo(() => {
    const q = normalizeForSearch(search)
    let list = products.filter((p) => {
      if (q && !normalizeForSearch(p.name).includes(q)) return false
      if (category !== 'all' && p.category !== category) return false
      const has = summaryOf(p.id).componentCount > 0
      if (tab === 'completas' && !has) return false
      if (tab === 'faltan' && has) return false
      return true
    })
    list = [...list].sort((a, b) =>
      sort === 'price' ? b.salePrice - a.salePrice : a.name.localeCompare(b.name),
    )
    return list
  }, [products, search, category, tab, sort, summaryOf])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const safePage = Math.min(page, totalPages)
  const pageItems = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)

  useEffect(() => { setPage(1) }, [search, category, tab, sort])

  const handleAddIngredientIdChange = (id: string) => {
    setAddIngredientId(id)
    const ingr = ingredients.find((x) => x.id === id)
    if (ingr) setAddUnitId(ingr.unitId)
  }

  const refreshSummaryFor = useCallback(async () => {
    setSummaries(await getRecipeSummaries().catch(() => new Map<string, RecipeSummary>()))
  }, [])

  const handleAddComponent = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selected || !addIngredientId || !addQuantity || !addUnitId) return
    try {
      setError('')
      await createRecipeComponent({
        sellableProductId: selected.id,
        ingredientId: addIngredientId,
        quantity: parseFloat(addQuantity) || 1,
        unitId: addUnitId,
      })
      setNotice('Ingrediente agregado')
      setShowAdd(false)
      setAddQuantity('1')
      await loadComponents()
      await refreshSummaryFor()
      setTimeout(() => setNotice(''), 3000)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error agregando ingrediente')
    }
  }

  const handleDeleteComponent = async (componentId: string) => {
    const ok = await confirmDialog({ title: 'Eliminar ingrediente', message: '¿Eliminar este ingrediente de la receta?', confirmText: 'Eliminar', danger: true })
    if (!ok) return
    try {
      setError('')
      await deleteRecipeComponent(componentId)
      setNotice('Ingrediente eliminado')
      await loadComponents()
      await refreshSummaryFor()
      setTimeout(() => setNotice(''), 3000)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error eliminando ingrediente')
    }
  }

  const startEditingComponent = (component: RecipeComponent) => {
    setError('')
    setEditingComponentId(component.id)
    setEditingQuantity(String(component.quantity))
    setEditingUnitId(component.unitId)
  }

  const cancelEditingComponent = () => {
    setEditingComponentId(null)
    setEditingQuantity('')
    setEditingUnitId('')
  }

  const handleUpdateComponent = async (component: RecipeComponent) => {
    const quantity = Number.parseFloat(editingQuantity)
    if (!Number.isFinite(quantity) || quantity <= 0 || !editingUnitId) {
      setError('Indica una cantidad válida mayor que cero')
      return
    }
    try {
      setError('')
      await updateRecipeComponent(component.id, { quantity, unitId: editingUnitId })
      setNotice('Ingrediente actualizado')
      cancelEditingComponent()
      await loadComponents()
      await refreshSummaryFor()
      setTimeout(() => setNotice(''), 3000)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error actualizando ingrediente')
    }
  }

  if (loading) {
    return <PageSkeleton cards={3} rows={5} />
  }

  const bs = (usd: number) => (bcvRate && bcvRate > 0 ? formatVes(usd * bcvRate) : 'Bs. —')
  const sel = selected
  const selSummary = sel ? summaryOf(sel.id) : null
  const selComplete = (selSummary?.componentCount ?? 0) > 0
  const cost = selSummary?.recipeCost ?? null
  const margin = sel && cost != null ? sel.salePrice - cost : null
  const costPct = sel && cost != null && sel.salePrice > 0 ? (cost / sel.salePrice) * 100 : null

  return (
    <div className="page rec-page animate-fade-in">
      <header className="page-header">
        <div>
          <h1 className="page-title"><BookOpen size={22} className="page-title-icon" /> Recetas</h1>
          <p className="page-subtitle">Gestiona todas las recetas y sus componentes por producto vendible.</p>
        </div>
        <button
          className="rec-add-btn"
          onClick={() => { setNewRecipeProductId(''); setShowNewRecipe(true) }}
        >
          <Plus size={16} /> Agregar receta
        </button>
      </header>

      {error && <Toast type="error" message={error} onClose={() => setError('')} />}
      {notice && <Toast type="success" message={notice} onClose={() => setNotice('')} />}

      <div className="rec-layout">
        {/* ============ Lista ============ */}
        <div className="rec-panel">
          <div className="rec-search">
            <Search size={16} className="rec-search-ic" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar receta..." />
            {search
              ? <button type="button" className="search-clear-btn search-clear-btn--floating" onClick={() => setSearch('')} aria-label="Borrar búsqueda"><X size={13} /></button>
              : <span className="rec-kbd">⌘K</span>}
          </div>

          <div className="rec-tabs">
            <button className={`rec-tab${tab === 'todas' ? ' active' : ''}`} onClick={() => setTab('todas')}>
              Todas <span className="rec-count">{counts.todas}</span>
            </button>
            <button className={`rec-tab${tab === 'completas' ? ' active' : ''}`} onClick={() => setTab('completas')}>
              Completas <span className="rec-count">{counts.completas}</span>
            </button>
            <button className={`rec-tab${tab === 'faltan' ? ' active' : ''}`} onClick={() => setTab('faltan')}>
              Faltan ingredientes <span className="rec-count">{counts.faltan}</span>
            </button>
          </div>

          <div className="rec-filters">
            <StyledSelect value={category} onChange={(e) => setCategory(e.target.value)}>
              <option value="all">Categoría: Todas</option>
              {categories.map((c) => <option key={c} value={c}>{c}</option>)}
            </StyledSelect>
            <StyledSelect value={sort} onChange={(e) => setSort(e.target.value as 'az' | 'price')}>
              <option value="az">Ordenar: A - Z</option>
              <option value="price">Ordenar: Precio</option>
            </StyledSelect>
            <div className="rec-view-toggle">
              <button className={view === 'list' ? 'active' : ''} onClick={() => setView('list')} aria-label="Lista"><List size={16} /></button>
              <button className={view === 'grid' ? 'active' : ''} onClick={() => setView('grid')} aria-label="Cuadrícula"><LayoutGrid size={16} /></button>
            </div>
          </div>

          <div className="rec-list">
            {pageItems.map((p) => {
              const s = summaryOf(p.id)
              const complete = s.componentCount > 0
              return (
                <button
                  key={p.id}
                  className={`rec-card${sel?.id === p.id ? ' active' : ''}`}
                  onClick={() => { setSelected(p); setShowAdd(false); setDetailTab('ingredientes') }}
                >
                  {p.imageUrl
                    ? <img className="rec-thumb" src={p.imageUrl} alt={p.name} loading="lazy" />
                    : <span className="rec-thumb"><UtensilsCrossed size={16} /></span>}
                  <span className="rec-card-body">
                    <span className="rec-card-name">{formatProductTitle(p.name)}</span>
                    <span className="rec-card-meta">
                      {complete
                        ? `${s.componentCount} ingrediente${s.componentCount === 1 ? '' : 's'}${s.recipeCost != null ? ` · Costo ${formatUsd(s.recipeCost)}` : ''}`
                        : 'Sin ingredientes configurados'}
                    </span>
                    <span className={`rec-badge ${complete ? 'ok' : 'warn'}`}>
                      {complete ? 'Receta completa' : 'Falta configurar'}
                    </span>
                  </span>
                  <span className="rec-card-price">{formatUsd(p.salePrice)}</span>
                  <ChevronRight size={18} className="rec-card-chev" />
                </button>
              )
            })}
            {pageItems.length === 0 && (
              <EmptyState
                title="No hay recetas que coincidan"
                description="Prueba con otro nombre o crea una receta nueva."
                actionLabel="Agregar receta"
                onAction={() => { setNewRecipeProductId(''); setShowNewRecipe(true) }}
              />
            )}
          </div>

          {totalPages > 1 && (
            <div className="rec-pagination">
              <button disabled={safePage === 1} onClick={() => setPage(safePage - 1)}><ChevronLeft size={15} /></button>
              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter((n) => n === 1 || n === totalPages || Math.abs(n - safePage) <= 1)
                .map((n, idx, arr) => (
                  <span key={n} style={{ display: 'inline-flex', gap: 6 }}>
                    {idx > 0 && n - arr[idx - 1] > 1 && <span style={{ color: '#52525b' }}>…</span>}
                    <button className={n === safePage ? 'active' : ''} onClick={() => setPage(n)}>{n}</button>
                  </span>
                ))}
              <button disabled={safePage === totalPages} onClick={() => setPage(safePage + 1)}><ChevronRight size={15} /></button>
              <span className="rec-total">{filtered.length} recetas en total</span>
            </div>
          )}
        </div>

        {/* ============ Detalle ============ */}
        <div className="rec-panel">
          {!sel ? (
            <p className="rec-empty-list">Selecciona una receta.</p>
          ) : (
            <>
              <div className="rec-detail-head">
                {sel.imageUrl
                  ? <img className="rec-detail-thumb" src={sel.imageUrl} alt={sel.name} />
                    : <span className="rec-detail-thumb"><UtensilsCrossed size={16} /></span>}
                <div className="rec-detail-title">
                  <h2>
                    {formatProductTitle(sel.name)}
                    <span className={`rec-pill ${selComplete ? 'ok' : 'warn'}`}>
                      {selComplete ? <><CheckCircle2 size={13} /> Completa</> : <><AlertTriangle size={13} /> Falta configurar</>}
                    </span>
                  </h2>
                  <div className="rec-detail-sub">
                    {selComplete ? `${selSummary?.componentCount} ingredientes configurados` : 'Sin ingredientes configurados'}
                  </div>
                  <div className="rec-detail-ref">Ref. {bs(sel.salePrice)}</div>
                </div>
                <div className="rec-price-box">
                  <div className="lbl">Precio de venta</div>
                  <div className="price">{formatUsd(sel.salePrice)}</div>
                  <div className="cost">Costo estimado<br />{cost != null ? formatUsd(cost) : 'Sin costo'}</div>
                </div>
              </div>

              <div className="rec-detail-tabs">
                <button className={`rec-detail-tab${detailTab === 'ingredientes' ? ' active' : ''}`} onClick={() => setDetailTab('ingredientes')}>
                  <BookOpen size={15} /> Ingredientes
                </button>
                <button className={`rec-detail-tab${detailTab === 'info' ? ' active' : ''}`} onClick={() => setDetailTab('info')}>
                  <Info size={15} /> Información adicional
                </button>
              </div>

              {detailTab === 'ingredientes' ? (
                <>
                  {showAdd && (
                    <form className="rec-add-form" onSubmit={handleAddComponent}>
                      <SearchSelect
                        options={ingredients.map((i) => ({ value: i.id, label: `${i.name} (${i.unitSymbol})` }))}
                        value={addIngredientId}
                        onChange={handleAddIngredientIdChange}
                        placeholder="Buscar ingrediente..."
                        emptyText="Sin ingredientes"
                      />
                      <NumberStepper step={0.01} min={0.01} placeholder="Cant." value={addQuantity} onChange={(v) => setAddQuantity(v)} required />
                      <StyledSelect value={addUnitId} onChange={(e) => setAddUnitId(e.target.value)}>
                        {units.map((u) => <option key={u.id} value={u.id}>{u.symbol}</option>)}
                      </StyledSelect>
                      <button type="submit" className="save">Guardar</button>
                    </form>
                  )}

                  {components.length === 0 && !showAdd ? (
                    <div className="rec-empty">
                      <div className="ic"><Soup size={44} /></div>
                      <h4>Esta receta no tiene ingredientes agregados</h4>
                      <p>Agrega los ingredientes y cantidades para calcular el costo real de esta receta.</p>
                      <button className="rec-add-btn" onClick={() => setShowAdd(true)}><Plus size={16} /> Agregar ingrediente</button>
                    </div>
                  ) : (
                    <>
                      {components.map((c) => (
                        <div key={c.id} className="rec-ing-row">
                          <span className="rec-ing-name">{c.ingredientName ?? 'Preparación'}</span>
                          {editingComponentId === c.id ? (
                            <div className="rec-ing-edit-fields">
                              <NumberStepper step={0.01} min={0.01} value={editingQuantity} onChange={setEditingQuantity} />
                              <StyledSelect value={editingUnitId} onChange={(e) => setEditingUnitId(e.target.value)}>
                                {units.map((u) => <option key={u.id} value={u.id}>{u.symbol}</option>)}
                              </StyledSelect>
                            </div>
                          ) : <span className="rec-ing-qty">{c.quantity} {c.unitSymbol}</span>}
                          <span className="rec-ing-cost">{c.costPerUnit == null ? 'Sin costo' : formatUsd(c.costPerUnit * c.quantity)}</span>
                          {c.ingredientId && (
                            editingComponentId === c.id ? (
                              <>
                                <button className="rec-ing-action rec-ing-save" onClick={() => void handleUpdateComponent(c)} title="Guardar"><Check size={15} /></button>
                                <button className="rec-ing-action rec-ing-cancel" onClick={cancelEditingComponent} title="Cancelar"><X size={15} /></button>
                              </>
                            ) : (
                              <>
                                <button className="rec-ing-action rec-ing-edit" onClick={() => startEditingComponent(c)} title="Editar"><Pencil size={15} /></button>
                                <button className="rec-ing-del" onClick={() => void handleDeleteComponent(c.id)} title="Eliminar"><Trash2 size={15} /></button>
                              </>
                            )
                          )}
                        </div>
                      ))}
                      {!showAdd && (
                        <button className="rec-add-btn" style={{ marginTop: 4 }} onClick={() => setShowAdd(true)}>
                          <Plus size={16} /> Agregar ingrediente
                        </button>
                      )}
                    </>
                  )}
                </>
              ) : (
                <div className="rec-detail-sub" style={{ padding: '8px 2px' }}>
                  <p><strong>Categoría:</strong> {sel.category || '—'}</p>
                  {sel.description && <p><strong>Descripción:</strong> {formatSpanishText(sel.description)}</p>}
                  <p><strong>Estado:</strong> {sel.isActive ? 'Activo' : 'Inactivo'}</p>
                </div>
              )}

              {/* Estadísticas */}
              <div className="rec-stats">
                <div className="rec-stat">
                  <div className="rec-stat-lbl"><Coins size={13} /> Costo total</div>
                  <div className="rec-stat-val">{cost != null ? formatUsd(cost) : '$0.00'}</div>
                  <div className="rec-stat-sub">{selComplete ? `${selSummary?.componentCount} ingredientes` : 'Sin ingredientes'}</div>
                </div>
                <div className="rec-stat">
                  <div className="rec-stat-lbl"><Tag size={13} /> Margen estimado</div>
                  <div className="rec-stat-val">{margin != null ? formatUsd(margin) : '--'}</div>
                  <div className="rec-stat-sub">{margin != null ? 'Venta − costo' : 'Sin cálculo'}</div>
                </div>
                <div className="rec-stat">
                  <div className="rec-stat-lbl"><Percent size={13} /> % Costo</div>
                  <div className="rec-stat-val">{costPct != null ? `${costPct.toFixed(0)}%` : '0%'}</div>
                  <div className="rec-stat-sub">{costPct != null ? 'Costo / venta' : 'Sin cálculo'}</div>
                </div>
                <div className="rec-stat">
                  <div className="rec-stat-lbl"><ShoppingCart size={13} /> Receta usada en</div>
                  <div className="rec-stat-val">{selComplete ? '1' : '0'}</div>
                  <div className="rec-stat-sub">Producto vendible</div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {showNewRecipe && createPortal(
        <div className={`rec-modal-overlay ${closingNewRecipe ? 'closing' : ''}`} onClick={() => closeNewRecipe()}>
          <div className="rec-modal" onClick={(e) => e.stopPropagation()}>
            <div className="rec-modal-header">
              <div className="rec-modal-header-icon"><UtensilsCrossed size={18} /></div>
              <h3>Configurar nueva receta</h3>
            </div>
            <p className="rec-detail-sub" style={{ marginBottom: 14 }}>
              Elige el producto vendible al que le vas a configurar la receta. Los que aún no tienen ingredientes aparecen primero.
            </p>
            <SearchSelect
              options={[...products]
                .sort((a, b) => {
                  const ha = summaryOf(a.id).componentCount > 0 ? 1 : 0
                  const hb = summaryOf(b.id).componentCount > 0 ? 1 : 0
                  return ha - hb || a.name.localeCompare(b.name)
                })
                .map((p) => ({
                  value: p.id,
                  label: `${formatProductTitle(p.name)}${summaryOf(p.id).componentCount > 0 ? ' ✓' : ' · sin receta'}`,
                }))}
              value={newRecipeProductId}
              onChange={setNewRecipeProductId}
              placeholder="Buscar producto..."
              emptyText="Sin productos"
            />
            <div className="rec-modal-actions">
              <button className="rec-modal-cancel" onClick={() => closeNewRecipe()}>Cancelar</button>
              <button
                className="rec-add-btn"
                disabled={!newRecipeProductId}
                onClick={() => {
                  const p = products.find((x) => x.id === newRecipeProductId)
                  if (!p) return
                  closeNewRecipe(() => {
                    setSelected(p)
                    setDetailTab('ingredientes')
                    setShowAdd(true)
                  })
                }}
              >
                <Plus size={16} /> Configurar receta
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}
