import { useEffect, useMemo, useState, useCallback } from 'react'
import { createPortal } from 'react-dom'
import {
  getRecipeComponents, getSellableProducts, createRecipeComponent, deleteRecipeComponent, updateRecipeComponent,
  getIngredients, getUnits, getRecipeSummaries, getPortionRecipes, createPortionRecipe, registerStaffMealConsumption,
  type RecipeComponent, type SellableProduct, type Ingredient, type RecipeSummary, type PortionRecipe,
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
  UtensilsCrossed, Utensils, X, Sun, Moon, Sparkles,
} from 'lucide-react'
import './RecetasReal.css'
import Toast from '../components/Toast'
import { confirmDialog } from '../components/ConfirmDialog'
import { EmptyState } from '../components/EmptyState'
import { formatProductTitle, formatSpanishText, normalizeForSearch } from '../lib/textFormat'

const PAGE_SIZE = 8
type Tab = 'todas' | 'completas' | 'faltan'
type RecipeView = 'platos' | 'porciones' | 'personal'

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
  const [recipeView, setRecipeView] = useState<RecipeView>('platos')
  const [portions, setPortions] = useState<PortionRecipe[]>([])
  const [showPortionForm, setShowPortionForm] = useState(false)
  const [closingPortionForm, setClosingPortionForm] = useState(false)
  const [portionName, setPortionName] = useState('')
  const [portionIngredientId, setPortionIngredientId] = useState('')
  const [portionQuantity, setPortionQuantity] = useState('')
  const [portionUnitId, setPortionUnitId] = useState('')

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
  const [addPortionId, setAddPortionId] = useState('')
  const [addComponentType, setAddComponentType] = useState<'ingredient' | 'portion'>('ingredient')
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

  // ==========================================
  // Alimentación del personal: Recetas y Consumo
  // ==========================================
  interface StaffMealIngredient {
    id: string
    ingredientId: string
    ingredientName: string
    quantity: number
    unitId: string
    unitSymbol: string
  }

  const [staffMeals, setStaffMeals] = useState<{
    lunch: StaffMealIngredient[]
    dinner: StaffMealIngredient[]
  }>(() => {
    try {
      const saved = localStorage.getItem('fullchina_staff_meals_v2')
      if (saved) return JSON.parse(saved)
    } catch { /* ignore */ }
    return { lunch: [], dinner: [] }
  })

  useEffect(() => {
    try {
      localStorage.setItem('fullchina_staff_meals_v2', JSON.stringify(staffMeals))
    } catch { /* ignore */ }
  }, [staffMeals])

  // Modal para agregar ingrediente a la ración de personal
  const [showStaffIngModal, setShowStaffIngModal] = useState(false)
  const [closingStaffIng, setClosingStaffIng] = useState(false)
  const [staffIngTargetMeal, setStaffIngTargetMeal] = useState<'lunch' | 'dinner'>('lunch')
  const [staffIngIngredientId, setStaffIngIngredientId] = useState('')
  const [staffIngQuantity, setStaffIngQuantity] = useState('0.4')
  const [staffIngUnitId, setStaffIngUnitId] = useState('')

  // Modal para registrar consumo diario
  const [showConsumeModal, setShowConsumeModal] = useState(false)
  const [closingConsume, setClosingConsume] = useState(false)
  const [consumeMealType, setConsumeMealType] = useState<'lunch' | 'dinner'>('lunch')
  const [consumeServings, setConsumeServings] = useState(4)
  const [consumeNotes, setConsumeNotes] = useState('')
  const [consumeItems, setConsumeItems] = useState<Array<{
    ingredientId: string
    ingredientName: string
    unitId: string
    unitSymbol: string
    baseQuantity: number
    overrideQuantity: number
    active: boolean
  }>>([])
  const [consumeLoading, setConsumeLoading] = useState(false)

  const closeTimedModal = (
    visible: boolean,
    closing: boolean,
    setClosing: (value: boolean) => void,
    setVisible: (value: boolean) => void,
  ) => {
    if (!visible || closing) return
    setClosing(true)
    window.setTimeout(() => {
      setVisible(false)
      setClosing(false)
    }, 200)
  }

  const loadProducts = useCallback(async () => {
    try {
      setLoading(true)
      const [prods, ingr, un, sums, portionRows] = await Promise.all([
        getSellableProducts(),
        getIngredients(),
        getUnits(),
        getRecipeSummaries().catch(() => new Map<string, RecipeSummary>()),
        getPortionRecipes().catch(() => []),
      ])
      const recipeProds = prods.filter((p) => p.category !== 'bebidas')
      setProducts(recipeProds)
      setIngredients(ingr)
      setUnits(un)
      if (ingr.length > 0) {
        setPortionIngredientId((cur) => cur || ingr[0].id)
        setPortionUnitId((cur) => cur || ingr[0].unitId)
        setStaffIngIngredientId((cur) => cur || ingr[0].id)
        setStaffIngUnitId((cur) => cur || ingr[0].unitId)
      }
      setSummaries(sums)
      setPortions(portionRows)
      if (recipeProds.length > 0) setSelected((cur) => cur ?? recipeProds[0])

      // Auto-inicializar raciones de personal con sugerencias si están vacías
      setStaffMeals((cur) => {
        if (cur.lunch.length > 0 && cur.dinner.length > 0) return cur
        const arroz = ingr.find((i) => i.name.toLowerCase().includes('arroz'))
        const pollo = ingr.find((i) => i.name.toLowerCase().includes('pollo') || i.name.toLowerCase().includes('pechuga'))
        const pasta = ingr.find((i) => i.name.toLowerCase().includes('pasta') || i.name.toLowerCase().includes('espagueti'))
        const veg = ingr.find((i) => i.name.toLowerCase().includes('vegetal') || i.name.toLowerCase().includes('cebolla'))

        const newLunch = [...cur.lunch]
        if (newLunch.length === 0) {
          if (arroz) newLunch.push({ id: 'def-arroz', ingredientId: arroz.id, ingredientName: arroz.name, quantity: 0.4, unitId: arroz.unitId, unitSymbol: arroz.unitSymbol })
          if (pollo) newLunch.push({ id: 'def-pollo', ingredientId: pollo.id, ingredientName: pollo.name, quantity: 0.2, unitId: pollo.unitId, unitSymbol: pollo.unitSymbol })
          if (veg) newLunch.push({ id: 'def-veg', ingredientId: veg.id, ingredientName: veg.name, quantity: 0.1, unitId: veg.unitId, unitSymbol: veg.unitSymbol })
        }

        const newDinner = [...cur.dinner]
        if (newDinner.length === 0) {
          if (pasta) newDinner.push({ id: 'def-pasta', ingredientId: pasta.id, ingredientName: pasta.name, quantity: 0.15, unitId: pasta.unitId, unitSymbol: pasta.unitSymbol })
          else if (arroz) newDinner.push({ id: 'def-arroz-c', ingredientId: arroz.id, ingredientName: arroz.name, quantity: 0.35, unitId: arroz.unitId, unitSymbol: arroz.unitSymbol })
          if (pollo) newDinner.push({ id: 'def-pollo-c', ingredientId: pollo.id, ingredientName: pollo.name, quantity: 0.25, unitId: pollo.unitId, unitSymbol: pollo.unitSymbol })
        }
        return { lunch: newLunch, dinner: newDinner }
      })
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

  const handleOpenAddStaffIng = (mealType: 'lunch' | 'dinner') => {
    setStaffIngTargetMeal(mealType)
    if (ingredients.length > 0) {
      setStaffIngIngredientId(ingredients[0].id)
      setStaffIngUnitId(ingredients[0].unitId)
    }
    setStaffIngQuantity('0.25')
    setShowStaffIngModal(true)
  }

  const handleSaveStaffIng = (e: React.FormEvent) => {
    e.preventDefault()
    const qty = Number.parseFloat(staffIngQuantity)
    if (!staffIngIngredientId || !Number.isFinite(qty) || qty <= 0) {
      setError('Ingresa una cantidad válida para la porción')
      return
    }
    const ing = ingredients.find((i) => i.id === staffIngIngredientId)
    if (!ing) return
    const unit = units.find((u) => u.id === staffIngUnitId) || { symbol: ing.unitSymbol }

    const newItem: StaffMealIngredient = {
      id: `item-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      ingredientId: ing.id,
      ingredientName: ing.name,
      quantity: qty,
      unitId: staffIngUnitId || ing.unitId,
      unitSymbol: unit.symbol,
    }

    setStaffMeals((prev) => ({
      ...prev,
      [staffIngTargetMeal]: [...prev[staffIngTargetMeal].filter((x) => x.ingredientId !== ing.id), newItem],
    }))

    setShowStaffIngModal(false)
    setNotice(`Ingrediente ${ing.name} agregado a la ración de ${staffIngTargetMeal === 'lunch' ? 'Almuerzo' : 'Cena'}`)
    setTimeout(() => setNotice(''), 3000)
  }

  const handleRemoveStaffIng = (mealType: 'lunch' | 'dinner', id: string) => {
    setStaffMeals((prev) => ({
      ...prev,
      [mealType]: prev[mealType].filter((x) => x.id !== id),
    }))
    setNotice('Ingrediente retirado de la ración')
    setTimeout(() => setNotice(''), 3000)
  }

  const handleOpenConsumeModal = (mealType: 'lunch' | 'dinner' = 'lunch') => {
    setConsumeMealType(mealType)
    setConsumeServings(4)
    setConsumeNotes('')
    const targetItems = staffMeals[mealType] || []
    setConsumeItems(targetItems.map((item) => ({
      ingredientId: item.ingredientId,
      ingredientName: item.ingredientName,
      unitId: item.unitId,
      unitSymbol: item.unitSymbol,
      baseQuantity: item.quantity,
      overrideQuantity: Number((item.quantity * 4).toFixed(3)),
      active: true,
    })))
    setShowConsumeModal(true)
  }

  const handleServingsChange = (valStr: string) => {
    const parsed = parseInt(valStr, 10)
    const s = Math.max(1, Number.isNaN(parsed) ? 1 : parsed)
    setConsumeServings(s)
    setConsumeItems((prev) => prev.map((item) => ({
      ...item,
      overrideQuantity: Number((item.baseQuantity * s).toFixed(3)),
    })))
  }

  const handleSubmitConsume = async (e: React.FormEvent) => {
    e.preventDefault()
    const activeItems = consumeItems.filter((i) => i.active && i.overrideQuantity > 0)
    if (activeItems.length === 0) {
      setError('Debes incluir al menos un ingrediente para registrar el consumo')
      return
    }
    try {
      setConsumeLoading(true)
      setError('')
      const itemsPayload = activeItems.map((i) => ({
        ingredientId: i.ingredientId,
        unitId: i.unitId,
        quantity: i.overrideQuantity / consumeServings,
      }))

      await registerStaffMealConsumption({
        mealType: consumeMealType,
        servings: consumeServings,
        items: itemsPayload,
        notes: consumeNotes || undefined,
      })

      setShowConsumeModal(false)
      setNotice(`✅ Consumo de ${consumeMealType === 'lunch' ? 'Almuerzo' : 'Cena'} (${consumeServings} personas) registrado y descontado del inventario.`)
      setTimeout(() => setNotice(''), 4000)
      void loadProducts()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error registrando consumo')
    } finally {
      setConsumeLoading(false)
    }
  }

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

  const openPortionForm = () => { setPortionName(''); setPortionQuantity(''); setShowPortionForm(true) }
  const handleCreatePortion = async (event: React.FormEvent) => {
    event.preventDefault()
    const quantity = Number.parseFloat(portionQuantity)
    if (!portionName.trim() || !portionIngredientId || !portionUnitId || !Number.isFinite(quantity) || quantity <= 0) return
    try {
      await createPortionRecipe({ name: portionName, ingredientId: portionIngredientId, quantity, unitId: portionUnitId })
      setShowPortionForm(false)
      setPortions(await getPortionRecipes())
      setNotice('Receta de porción creada')
      window.setTimeout(() => setNotice(''), 3000)
    } catch (e) { setError(e instanceof Error ? e.message : 'Error creando receta de porción') }
  }

  const refreshSummaryFor = useCallback(async () => {
    setSummaries(await getRecipeSummaries().catch(() => new Map<string, RecipeSummary>()))
  }, [])

  const handleAddComponent = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selected || (!addIngredientId && !addPortionId) || !addQuantity || !addUnitId) return
    try {
      setError('')
      await createRecipeComponent({
        sellableProductId: selected.id,
        ingredientId: addComponentType === 'ingredient' ? addIngredientId : undefined,
        preparationBatchId: undefined,
        portionRecipeId: addComponentType === 'portion' ? addPortionId : undefined,
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
    <div className="page rec-page animate-fade-in management-workspace management-workspace--recipes">
      <header className="page-header management-workspace-header">
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

      <nav className="rec-module-tabs" aria-label="Tipos de receta">
        <button className={recipeView === 'platos' ? 'active' : ''} onClick={() => setRecipeView('platos')}><UtensilsCrossed size={16} /><span>Recetas de platos</span><small>{products.length}</small></button>
        <button className={recipeView === 'porciones' ? 'active' : ''} onClick={() => setRecipeView('porciones')}><Soup size={16} /><span>Recetas de porciones</span><small>{portions.length}</small></button>
        <button className={recipeView === 'personal' ? 'active' : ''} onClick={() => setRecipeView('personal')}><BookOpen size={16} /><span>Alimentación del personal</span></button>
      </nav>

      {error && <Toast type="error" message={error} onClose={() => setError('')} />}
      {notice && <Toast type="success" message={notice} onClose={() => setNotice('')} />}

      {recipeView === 'platos' ? <div className="rec-layout management-workspace-content">
        {/* ============ Lista ============ */}
        <div className="rec-panel management-workspace-panel">
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
        <div className="rec-panel management-workspace-panel">
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
                      <StyledSelect value={addComponentType} onChange={(e) => { setAddComponentType(e.target.value as 'ingredient' | 'portion'); setAddIngredientId(''); setAddPortionId('') }}>
                        <option value="ingredient">Ingrediente</option><option value="portion">Porción</option>
                      </StyledSelect>
                      {addComponentType === 'ingredient' ? <SearchSelect
                        options={ingredients.map((i) => ({ value: i.id, label: `${i.name} (${i.unitSymbol})` }))}
                        value={addIngredientId}
                        onChange={handleAddIngredientIdChange}
                        placeholder="Buscar ingrediente..."
                        emptyText="Sin ingredientes"
                      /> : <SearchSelect options={portions.map(p => ({ value: p.id, label: `${p.name} (${p.quantity} ${p.unitSymbol})` }))} value={addPortionId} onChange={id => { setAddPortionId(id); setAddUnitId(portions.find(p => p.id === id)?.unitId ?? '') }} placeholder="Escribe para buscar porción..." emptyText="Sin porciones" />}
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
      </div> : recipeView === 'porciones' ? (
        <section className="rec-module-view management-workspace-content"><div className="rec-module-view-head"><div><h2>Recetas de porciones</h2><p>Define cuánto representa una porción de cada ingrediente para reutilizarla en los platos.</p></div><button className="rec-add-btn" onClick={openPortionForm}><Plus size={16} /> Nueva receta de porción</button></div>{portions.length === 0 ? <div className="rec-empty-module"><EmptyState title="No hay recetas de porciones registradas" description="Crea una porción base como pollo de 125 g para usarla en tus platos." actionLabel="Crear receta de porción" onAction={openPortionForm} /></div> : <div className="rec-portion-list"><div className="rec-portion-header"><span>Porción</span><span>Ingrediente</span><span>Cantidad</span><span>Origen</span></div>{portions.map(portion => <article className="rec-portion-row" key={portion.id}><strong>{portion.name}</strong><span>{portion.ingredientName || 'Ingrediente no encontrado'}</span><b>{portion.quantity} {portion.unitSymbol}</b><span className="rec-origin">Inventario</span></article>)}</div>}</section>
      ) : (
        <section className="rec-module-view management-workspace-content rec-staff-view">
          <div className="rec-module-view-head">
            <div>
              <h2>Alimentación del personal</h2>
              <p>Control de porciones y registro diario de comida de empleados. Descuenta inventario como consumo interno sin afectar ventas ni ticket promedio.</p>
            </div>
            <button className="rec-add-btn rec-staff-main-btn" onClick={() => handleOpenConsumeModal('lunch')}>
              <Utensils size={16} /> Registrar consumo de hoy
            </button>
          </div>

          <div className="rec-staff-banner">
            <Sparkles size={18} className="rec-staff-banner-icon" />
            <div className="rec-staff-banner-text">
              <strong>Control de raciones y autoconsumo</strong>
              <span>Configura los ingredientes base por ración (almuerzo y cena). Al registrar el consumo diario, se calcula el total para el número de personas y se descuenta del inventario físico sin alterar la facturación de caja ni métricas de venta.</span>
            </div>
          </div>

          <div className="rec-staff-grid">
            <article className="rec-staff-card">
              <div className="rec-staff-card-head">
                <div className="rec-staff-card-title-wrap">
                  <span className="rec-staff-icon lunch"><Sun size={20} /></span>
                  <div>
                    <h3>Almuerzo del personal</h3>
                    <small>Ración base por persona</small>
                  </div>
                </div>
                <span className="rec-staff-badge">{staffMeals.lunch.length} ingredientes</span>
              </div>

              <div className="rec-staff-ingredients-box">
                {staffMeals.lunch.length === 0 ? (
                  <p className="rec-staff-empty-msg">No hay ingredientes configurados para el almuerzo.</p>
                ) : (
                  <div className="rec-staff-ing-list">
                    {staffMeals.lunch.map((item) => (
                      <div className="rec-staff-ing-row" key={item.id}>
                        <div className="rec-staff-ing-info">
                          <strong>{item.ingredientName}</strong>
                          <span>{item.quantity} {item.unitSymbol} por persona</span>
                        </div>
                        <button
                          type="button"
                          className="rec-staff-remove-btn"
                          onClick={() => handleRemoveStaffIng('lunch', item.id)}
                          title="Quitar de la ración"
                          aria-label={`Quitar ${item.ingredientName}`}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="rec-staff-card-actions">
                <button
                  type="button"
                  className="rec-staff-add-ing-btn"
                  onClick={() => handleOpenAddStaffIng('lunch')}
                >
                  <Plus size={15} /> Agregar ingrediente
                </button>
                <button
                  type="button"
                  className="rec-staff-consume-cta-btn"
                  onClick={() => handleOpenConsumeModal('lunch')}
                >
                  <Utensils size={15} /> Registrar Almuerzo
                </button>
              </div>
            </article>

            <article className="rec-staff-card">
              <div className="rec-staff-card-head">
                <div className="rec-staff-card-title-wrap">
                  <span className="rec-staff-icon dinner"><Moon size={20} /></span>
                  <div>
                    <h3>Cena del personal</h3>
                    <small>Ración base por persona</small>
                  </div>
                </div>
                <span className="rec-staff-badge">{staffMeals.dinner.length} ingredientes</span>
              </div>

              <div className="rec-staff-ingredients-box">
                {staffMeals.dinner.length === 0 ? (
                  <p className="rec-staff-empty-msg">No hay ingredientes configurados para la cena.</p>
                ) : (
                  <div className="rec-staff-ing-list">
                    {staffMeals.dinner.map((item) => (
                      <div className="rec-staff-ing-row" key={item.id}>
                        <div className="rec-staff-ing-info">
                          <strong>{item.ingredientName}</strong>
                          <span>{item.quantity} {item.unitSymbol} por persona</span>
                        </div>
                        <button
                          type="button"
                          className="rec-staff-remove-btn"
                          onClick={() => handleRemoveStaffIng('dinner', item.id)}
                          title="Quitar de la ración"
                          aria-label={`Quitar ${item.ingredientName}`}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="rec-staff-card-actions">
                <button
                  type="button"
                  className="rec-staff-add-ing-btn"
                  onClick={() => handleOpenAddStaffIng('dinner')}
                >
                  <Plus size={15} /> Agregar ingrediente
                </button>
                <button
                  type="button"
                  className="rec-staff-consume-cta-btn"
                  onClick={() => handleOpenConsumeModal('dinner')}
                >
                  <Utensils size={15} /> Registrar Cena
                </button>
              </div>
            </article>
          </div>
        </section>
      )}

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

      {showPortionForm && createPortal(
        <div className={`rec-modal-overlay ${closingPortionForm ? 'closing' : ''}`} onClick={() => closeTimedModal(showPortionForm, closingPortionForm, setClosingPortionForm, setShowPortionForm)}>
          <form className="rec-modal" onClick={(e) => e.stopPropagation()} onSubmit={handleCreatePortion}>
            <div className="rec-modal-header">
              <div className="rec-modal-header-icon"><Soup size={18} /></div>
              <h3>Nueva receta de porción</h3>
            </div>
            <p className="rec-detail-sub">Define la cantidad exacta que representa una porción.</p>
            <label className="rec-form-label">
              Nombre de la porción
              <input value={portionName} onChange={(e) => setPortionName(e.target.value)} placeholder="Ej. Porción de pollo" required />
            </label>
            <div className="rec-form-label">
              Ingrediente
              <SearchSelect
                options={ingredients.map((i) => ({ value: i.id, label: `${i.name} (${i.unitSymbol})` }))}
                value={portionIngredientId}
                onChange={(id) => {
                  setPortionIngredientId(id)
                  const i = ingredients.find((x) => x.id === id)
                  if (i) setPortionUnitId(i.unitId)
                }}
                placeholder="Escribe para buscar ingrediente..."
                emptyText="Sin ingredientes"
              />
            </div>
            <div className="rec-portion-fields">
              <label className="rec-form-label">
                Cantidad por porción
                <input type="number" min="0.001" step="0.001" value={portionQuantity} onChange={(e) => setPortionQuantity(e.target.value)} placeholder="125" required />
              </label>
              <label className="rec-form-label">
                Unidad
                <StyledSelect value={portionUnitId} onChange={(e) => setPortionUnitId(e.target.value)}>
                  {units.map((u) => <option key={u.id} value={u.id}>{u.name} ({u.symbol})</option>)}
                </StyledSelect>
              </label>
            </div>
            <div className="rec-modal-actions">
              <button type="button" className="rec-modal-cancel" onClick={() => closeTimedModal(showPortionForm, closingPortionForm, setClosingPortionForm, setShowPortionForm)}>Cancelar</button>
              <button type="submit" className="rec-add-btn"><Check size={16} /> Guardar porción</button>
            </div>
          </form>
        </div>,
        document.body
      )}

      {showStaffIngModal && createPortal(
        <div className={`rec-modal-overlay ${closingStaffIng ? 'closing' : ''}`} onClick={() => closeTimedModal(showStaffIngModal, closingStaffIng, setClosingStaffIng, setShowStaffIngModal)}>
          <form className="rec-modal" onClick={(e) => e.stopPropagation()} onSubmit={handleSaveStaffIng}>
            <div className="rec-modal-header">
              <div className="rec-modal-header-icon">
                {staffIngTargetMeal === 'lunch' ? <Sun size={18} /> : <Moon size={18} />}
              </div>
              <h3>Agregar a ración de {staffIngTargetMeal === 'lunch' ? 'Almuerzo' : 'Cena'}</h3>
            </div>
            <p className="rec-detail-sub">
              Define la cantidad estándar que consume una persona de este insumo.
            </p>

            <div className="rec-form-label">
              <span>Ingrediente del inventario</span>
              <SearchSelect
                options={ingredients.map((i) => ({ value: i.id, label: `${i.name} (${i.unitSymbol})` }))}
                value={staffIngIngredientId}
                onChange={(id) => {
                  setStaffIngIngredientId(id)
                  const found = ingredients.find((x) => x.id === id)
                  if (found) setStaffIngUnitId(found.unitId)
                }}
                placeholder="Buscar ingrediente..."
                emptyText="Sin ingredientes"
              />
            </div>

            <div className="rec-portion-fields">
              <label className="rec-form-label">
                <span>Cantidad por ración</span>
                <input
                  type="number"
                  min="0.001"
                  step="0.001"
                  value={staffIngQuantity}
                  onChange={(e) => setStaffIngQuantity(e.target.value)}
                  placeholder="0.4"
                  required
                />
              </label>
              <label className="rec-form-label">
                <span>Unidad</span>
                <StyledSelect value={staffIngUnitId} onChange={(e) => setStaffIngUnitId(e.target.value)}>
                  {units.map((u) => (
                    <option key={u.id} value={u.id}>{u.name} ({u.symbol})</option>
                  ))}
                </StyledSelect>
              </label>
            </div>

            <div className="rec-modal-actions">
              <button type="button" className="rec-modal-cancel" onClick={() => closeTimedModal(showStaffIngModal, closingStaffIng, setClosingStaffIng, setShowStaffIngModal)}>
                Cancelar
              </button>
              <button type="submit" className="rec-add-btn">
                <Check size={16} /> Guardar en ración
              </button>
            </div>
          </form>
        </div>,
        document.body
      )}

      {showConsumeModal && createPortal(
        <div className={`rec-modal-overlay ${closingConsume ? 'closing' : ''}`} onClick={() => !consumeLoading && closeTimedModal(showConsumeModal, closingConsume, setClosingConsume, setShowConsumeModal)}>
          <form className="rec-modal rec-staff-consume-modal" onClick={(e) => e.stopPropagation()} onSubmit={handleSubmitConsume}>
            <div className="rec-modal-header">
              <div className="rec-modal-header-icon"><Utensils size={18} /></div>
              <h3>Registrar consumo de personal</h3>
            </div>

            <div className="rec-staff-modal-type-tabs">
              <button
                type="button"
                className={consumeMealType === 'lunch' ? 'active' : ''}
                onClick={() => {
                  setConsumeMealType('lunch')
                  const targetItems = staffMeals.lunch || []
                  setConsumeItems(targetItems.map((item) => ({
                    ingredientId: item.ingredientId,
                    ingredientName: item.ingredientName,
                    unitId: item.unitId,
                    unitSymbol: item.unitSymbol,
                    baseQuantity: item.quantity,
                    overrideQuantity: Number((item.quantity * consumeServings).toFixed(3)),
                    active: true,
                  })))
                }}
              >
                <Sun size={15} /> Almuerzo
              </button>
              <button
                type="button"
                className={consumeMealType === 'dinner' ? 'active' : ''}
                onClick={() => {
                  setConsumeMealType('dinner')
                  const targetItems = staffMeals.dinner || []
                  setConsumeItems(targetItems.map((item) => ({
                    ingredientId: item.ingredientId,
                    ingredientName: item.ingredientName,
                    unitId: item.unitId,
                    unitSymbol: item.unitSymbol,
                    baseQuantity: item.quantity,
                    overrideQuantity: Number((item.quantity * consumeServings).toFixed(3)),
                    active: true,
                  })))
                }}
              >
                <Moon size={15} /> Cena
              </button>
            </div>

            <div className="rec-staff-servings-row">
              <label className="rec-form-label" style={{ marginTop: 0 }}>
                <span>Número de personas / raciones servidas</span>
                <NumberStepper
                  value={String(consumeServings)}
                  min={1}
                  max={50}
                  step={1}
                  onChange={handleServingsChange}
                />
              </label>
            </div>

            <div className="rec-staff-modal-breakdown">
              <div className="rec-staff-breakdown-head">
                <span>Insumos a descontar del inventario</span>
                <small>Calculado para {consumeServings} personas</small>
              </div>

              {consumeItems.length === 0 ? (
                <p className="rec-staff-empty-msg">No hay ingredientes configurados en la ración de {consumeMealType === 'lunch' ? 'almuerzo' : 'cena'}.</p>
              ) : (
                <div className="rec-staff-consume-items-list">
                  {consumeItems.map((item, idx) => (
                    <div className="rec-staff-consume-item-row" key={item.ingredientId}>
                      <div className="rec-staff-consume-item-name">
                        <strong>{item.ingredientName}</strong>
                        <small>{item.baseQuantity} {item.unitSymbol} × {consumeServings} pers.</small>
                      </div>
                      <div className="rec-staff-consume-item-calc">
                        <input
                          type="number"
                          min="0.001"
                          step="0.001"
                          value={item.overrideQuantity}
                          onChange={(e) => {
                            const val = Number.parseFloat(e.target.value) || 0
                            setConsumeItems((prev) => prev.map((it, i) => (i === idx ? { ...it, overrideQuantity: val } : it)))
                          }}
                        />
                        <span>{item.unitSymbol}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <label className="rec-form-label" style={{ marginTop: 12 }}>
              <span>Nota (opcional)</span>
              <input
                type="text"
                placeholder="Ej. Almuerzo turno completo domingo"
                value={consumeNotes}
                onChange={(e) => setConsumeNotes(e.target.value)}
              />
            </label>

            <p className="rec-detail-sub" style={{ fontSize: '0.74rem', marginTop: 10, color: '#a1a1aa' }}>
              ℹ️ Se creará un movimiento de consumo interno ('staff_meal'). No afecta ventas, caja ni ticket promedio.
            </p>

            <div className="rec-modal-actions">
              <button
                type="button"
                className="rec-modal-cancel"
                disabled={consumeLoading}
                onClick={() => closeTimedModal(showConsumeModal, closingConsume, setClosingConsume, setShowConsumeModal)}
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="rec-add-btn"
                disabled={consumeLoading || consumeItems.length === 0}
              >
                <Check size={16} /> {consumeLoading ? 'Descontando...' : `Confirmar (${consumeServings} pers.)`}
              </button>
            </div>
          </form>
        </div>,
        document.body
      )}
    </div>
  )
}
