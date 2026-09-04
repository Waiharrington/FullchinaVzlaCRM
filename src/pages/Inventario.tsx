import { useState, useMemo, useEffect, useCallback, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useAuth } from '../context/auth-context'
import { useNavigate } from 'react-router-dom'
import {
  getIngredients,
  getStockMovements,
  getUnits,
  adjustStock,
  updateIngredient,
  updateIngredientCost,
  deleteIngredient,
  type Ingredient,
  type StockMovement,
} from '../lib/dataService'
import { normalizeForSearch } from '../lib/textFormat'
import { StyledSelect } from '../components/StyledSelect'
import {
  Package,
  Search,
  Eye,
  Pencil,
  TrendingUp,
  AlertTriangle,
  ShoppingBag,
  ArrowDown,
  ArrowUp,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ShoppingCart,
  X,
  Plus,
  Minus,
  Save,
  Loader2,
  Trash2,
  History,
} from 'lucide-react'
import { EmptyState } from '../components/EmptyState'
import { PageSkeleton } from '../components/PageSkeleton'
import { confirmDialog } from '../components/ConfirmDialog'
import './Inventario.css'

const ITEMS_PER_PAGE = 8
type InventoryModal = 'view' | 'edit' | 'adjust' | null

// Cache a nivel de módulo: al volver a Inventario se muestran los datos de
// la última visita al instante, sin el parpadeo de "Cargando...", mientras
// se refrescan en segundo plano.
let inventarioCache: { ingredients: Ingredient[]; stockMovements: StockMovement[] } | null = null

function getIngredientCategory(ing: Ingredient): 'raw' | 'packaging' | 'beverages' {
  if (ing.inventoryClass === 'beverage') return 'beverages'
  if (ing.inventoryClass === 'packaging') return 'packaging'
  const name = normalizeForSearch(ing.name)
  // Detección inteligente de Bebidas
  if (
    name.includes('agua') ||
    name.includes('refresco') ||
    name.includes('soda') ||
    name.includes('coca') ||
    name.includes('pepsi') ||
    name.includes('chinotto') ||
    name.includes('colita') ||
    name.includes('jugo') ||
    name.includes('malta') ||
    name.includes('cerveza') ||
    name.includes('polar') ||
    name.includes('red bull') ||
    name.includes('monster') ||
    name.includes('bebida') ||
    name.includes('te ') ||
    name.includes('té ') ||
    name.includes('gatorade') ||
    name.includes('sangria')
  ) {
    return 'beverages'
  }
  // Detección inteligente de Empaques y Descartables
  if (
    name.includes('empaque') ||
    name.includes('bolsa') ||
    name.includes('envase') ||
    name.includes('caja') ||
    name.includes('vaso') ||
    name.includes('cubierto') ||
    name.includes('cuchillo') ||
    name.includes('cuchara') ||
    name.includes('tenedor') ||
    name.includes('servilleta') ||
    name.includes('vianda') ||
    name.includes('tapa') ||
    name.includes('sticker') ||
    name.includes('papel') ||
    name.includes('aluminio') ||
    name.includes('porta') ||
    name.includes('pitillo') ||
    name.includes('delivery')
  ) {
    return 'packaging'
  }
  return 'raw'
}

export function Inventario() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [ingredients, setIngredients] = useState<Ingredient[]>(inventarioCache?.ingredients ?? [])
  const [stockMovements, setStockMovements] = useState<StockMovement[]>(inventarioCache?.stockMovements ?? [])
  const [loading, setLoading] = useState(!inventarioCache)
  const [searchTerm, setSearchTerm] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [selectedIngredient, setSelectedIngredient] = useState<Ingredient | null>(null)
  const [modalMode, setModalMode] = useState<InventoryModal>(null)
  const [showPortionsModal, setShowPortionsModal] = useState(false)
  const [showAllMovementsModal, setShowAllMovementsModal] = useState(false)
  const [closingAllMovements, setClosingAllMovements] = useState(false)
  const [movementTypeFilter, setMovementTypeFilter] = useState<'all' | 'purchase' | 'consumption' | 'adjustment'>('all')
  const [movementSearchTerm, setMovementSearchTerm] = useState('')
  const [movementCurrentPage, setMovementCurrentPage] = useState(1)
  const [showAllAlertsModal, setShowAllAlertsModal] = useState(false)
  const [closingAllAlerts, setClosingAllAlerts] = useState(false)
  const [alertSeverityFilter, setAlertSeverityFilter] = useState<'all' | 'critical' | 'low'>('all')
  const [alertSearchTerm, setAlertSearchTerm] = useState('')
  const [ingredientMovements, setIngredientMovements] = useState<StockMovement[]>([])
  const [units, setUnits] = useState<Array<{ id: string; name: string; symbol: string }>>([])
  const [editForm, setEditForm] = useState({ name: '', unitId: '', inventoryClass: 'raw_material' as Ingredient['inventoryClass'], price: '' })
  const [adjustment, setAdjustment] = useState({ direction: 1 as 1 | -1, quantity: '', notes: '' })
  const [modalLoading, setModalLoading] = useState(false)
  const [modalError, setModalError] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
  const [closingIngredient, setClosingIngredient] = useState(false)
  const closeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    return () => {
      if (closeTimeoutRef.current) clearTimeout(closeTimeoutRef.current)
    }
  }, [])

  const [historyMonthCursor, setHistoryMonthCursor] = useState(() => {
    const n = new Date()
    return new Date(n.getFullYear(), n.getMonth(), 1)
  })
  const [historyWeekStartKey, setHistoryWeekStartKey] = useState<string | null>(null)
  const [openDayKey, setOpenDayKey] = useState<string | null>(null)
  const closeIngredientModal = (then?: () => void) => {
    if (closingIngredient) return
    setClosingIngredient(true)
    if (closeTimeoutRef.current) clearTimeout(closeTimeoutRef.current)
    closeTimeoutRef.current = setTimeout(() => {
      setSelectedIngredient(null)
      setModalMode(null)
      setModalError('')
      setClosingIngredient(false)
      then?.()
    }, 200)
  }

  const showCosts = user?.role === 'owner' || user?.role === 'manager'

  const closeModal = () => {
    if (modalLoading) return
    closeIngredientModal()
  }

  const finishModal = () => {
    closeIngredientModal()
  }

  const openView = async (ingredient: Ingredient) => {
    setSelectedIngredient(ingredient)
    setModalMode('view')
    setModalError('')
    setModalLoading(true)
    const n = new Date()
    setHistoryMonthCursor(new Date(n.getFullYear(), n.getMonth(), 1))
    setHistoryWeekStartKey(null)
    try {
      setIngredientMovements(await getStockMovements(ingredient.id))
    } catch (error) {
      console.error(error)
      setModalError('No se pudieron cargar los movimientos de este artículo.')
    } finally {
      setModalLoading(false)
    }
  }

  const openEdit = async (ingredient: Ingredient) => {
    setSelectedIngredient(ingredient)
    setModalMode('edit')
    setModalError('')
    setEditForm({
      name: ingredient.name,
      unitId: ingredient.unitId,
      inventoryClass: ingredient.inventoryClass,
      price: ingredient.pricePerUnit === null ? '' : String(ingredient.pricePerUnit),
    })
    if (units.length === 0) {
      try { setUnits(await getUnits()) } catch (error) { console.error(error); setModalError('No se pudieron cargar las unidades.') }
    }
  }

  const openAdjustment = (ingredient: Ingredient, direction: 1 | -1) => {
    setSelectedIngredient(ingredient)
    setModalMode('adjust')
    setModalError('')
    setAdjustment({ direction, quantity: '', notes: '' })
  }

  const saveEdit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!selectedIngredient || !user) return
    const name = editForm.name.trim()
    const price = Number(editForm.price)
    if (!name) return setModalError('El nombre es obligatorio.')
    if (!editForm.unitId) return setModalError('Selecciona una unidad.')
    if (editForm.price === '' || !Number.isFinite(price) || price < 0) return setModalError('Indica un costo válido, igual o mayor que cero.')
    setModalLoading(true)
    setModalError('')
    try {
      await updateIngredient(selectedIngredient.id, { name, inventory_class: editForm.inventoryClass })
      await updateIngredientCost(selectedIngredient.id, price, user.id)
      await fetchAll()
      setSuccessMessage(`${name} fue actualizado correctamente.`)
      finishModal()
    } catch (error) {
      console.error(error)
      setModalError('No se pudo actualizar el artículo. Revisa que el nombre no esté repetido.')
    } finally {
      setModalLoading(false)
    }
  }

  const saveAdjustment = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!selectedIngredient) return
    const quantity = Number(adjustment.quantity)
    if (!Number.isFinite(quantity) || quantity <= 0) return setModalError('Indica una cantidad mayor que cero.')
    if (!adjustment.notes.trim()) return setModalError('Escribe el motivo del ajuste para dejar trazabilidad.')
    setModalLoading(true)
    setModalError('')
    try {
      await adjustStock({
        ingredientId: selectedIngredient.id,
        quantity: quantity * adjustment.direction,
        unitId: selectedIngredient.unitId,
        movementType: 'adjustment',
        referenceType: 'manual',
        notes: adjustment.notes.trim(),
      })
      await fetchAll()
      setSuccessMessage(`${adjustment.direction > 0 ? 'Entrada' : 'Salida'} manual registrada para ${selectedIngredient.name}.`)
      finishModal()
    } catch (error) {
      console.error(error)
      setModalError('No se pudo registrar el movimiento manual.')
    } finally {
      setModalLoading(false)
    }
  }

  const handleDelete = async (ing: Ingredient) => {
    const ok = await confirmDialog({
      title: `¿Eliminar "${ing.name}"?`,
      message: 'El producto se desactivará del inventario. Esta acción no se puede deshacer.',
      confirmText: 'Sí, eliminar',
      cancelText: 'Cancelar',
      danger: true,
    })
    if (!ok) return
    try {
      await deleteIngredient(ing.id)
      await fetchAll()
      setSuccessMessage(`"${ing.name}" fue eliminado del inventario.`)
      setTimeout(() => setSuccessMessage(''), 3000)
    } catch (e) {
      console.error(e)
      setModalError('No se pudo eliminar el artículo.')
    }
  }

  const fetchAll = useCallback(async () => {
    try {
      const [ingData, movData] = await Promise.all([
        getIngredients(),
        getStockMovements(),
      ])
      setIngredients(ingData)
      setStockMovements(movData)
      inventarioCache = { ingredients: ingData, stockMovements: movData }
    } catch (e) {
      console.error('Error:', e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchAll()
  }, [fetchAll])

  const filteredIngredients = useMemo(() => {
    return ingredients.filter(ing => {
      const cat = getIngredientCategory(ing)
      const matchesCategory = categoryFilter === 'all' || categoryFilter === cat
      return matchesCategory && normalizeForSearch(ing.name).includes(normalizeForSearch(searchTerm))
    })
  }, [ingredients, searchTerm, categoryFilter])

  const totalPages = Math.ceil(filteredIngredients.length / ITEMS_PER_PAGE)
  const paginatedIngredients = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE
    return filteredIngredients.slice(start, start + ITEMS_PER_PAGE)
  }, [filteredIngredients, currentPage])

  const totalInventoryValue = useMemo(() => {
    return ingredients.reduce((sum, ing) => sum + (ing.stockValue ?? 0), 0)
  }, [ingredients])

  const lowStockCount = useMemo(() => {
    return ingredients.filter(i => i.currentStock <= 10).length
  }, [ingredients])

  const portionItems = useMemo(() => {
    return ingredients.filter(i =>
      i.unitSymbol.toLowerCase() === 'por' ||
      i.unitSymbol.toLowerCase() === 'porcion' ||
      normalizeForSearch(i.name).includes('porcion') ||
      normalizeForSearch(i.name).includes('lote')
    )
  }, [ingredients])

  const totalPortionsCount = useMemo(() => {
    return portionItems.reduce((sum, ing) => sum + Math.max(0, ing.currentStock), 0)
  }, [portionItems])

  const recentMovements = useMemo(() => {
    return stockMovements.slice(0, 5)
  }, [stockMovements])

  const allAlerts = useMemo(() => {
    return ingredients
      .filter(i => i.currentStock <= 10)
      .sort((a, b) => a.currentStock - b.currentStock)
  }, [ingredients])

  const alerts = useMemo(() => {
    return allAlerts.slice(0, 4)
  }, [allAlerts])

  const filteredAllMovements = useMemo(() => {
    return stockMovements.filter(m => {
      if (movementTypeFilter !== 'all' && m.movementType !== movementTypeFilter) return false
      if (movementSearchTerm.trim()) {
        const q = normalizeForSearch(movementSearchTerm)
        return (
          normalizeForSearch(m.ingredientName).includes(q) ||
          normalizeForSearch(m.notes || '').includes(q) ||
          normalizeForSearch(m.referenceType || '').includes(q)
        )
      }
      return true
    })
  }, [stockMovements, movementTypeFilter, movementSearchTerm])

  const MOVEMENTS_PER_PAGE = 20
  const totalMovementPages = Math.ceil(filteredAllMovements.length / MOVEMENTS_PER_PAGE)
  const paginatedAllMovements = useMemo(() => {
    const start = (movementCurrentPage - 1) * MOVEMENTS_PER_PAGE
    return filteredAllMovements.slice(start, start + MOVEMENTS_PER_PAGE)
  }, [filteredAllMovements, movementCurrentPage])

  const getStockStatus = (ing: Ingredient): 'ok' | 'low' | 'critical' => {
    if (ing.currentStock <= 5) return 'critical'
    if (ing.currentStock <= 10) return 'low'
    return 'ok'
  }

  const filteredAllAlerts = useMemo(() => {
    return allAlerts.filter(ing => {
      const status = getStockStatus(ing)
      if (alertSeverityFilter === 'critical' && status !== 'critical') return false
      if (alertSeverityFilter === 'low' && status !== 'low') return false
      if (alertSearchTerm.trim()) {
        const q = normalizeForSearch(alertSearchTerm)
        return normalizeForSearch(ing.name).includes(q)
      }
      return true
    })
  }, [allAlerts, alertSeverityFilter, alertSearchTerm])

  const closeAllMovementsModal = (then?: () => void) => {
    if (closingAllMovements) return
    setClosingAllMovements(true)
    setTimeout(() => {
      setShowAllMovementsModal(false)
      setClosingAllMovements(false)
      then?.()
    }, 200)
  }

  const closeAllAlertsModal = (then?: () => void) => {
    if (closingAllAlerts) return
    setClosingAllAlerts(true)
    setTimeout(() => {
      setShowAllAlertsModal(false)
      setClosingAllAlerts(false)
      then?.()
    }, 200)
  }

  const getStockStatusLabel = (status: 'ok' | 'low' | 'critical') => {
    switch (status) {
      case 'ok': return 'En stock'
      case 'low': return 'Bajo'
      case 'critical': return 'Crítico'
    }
  }

  const getMovementIcon = (type: string) => {
    switch (type) {
      case 'purchase': return <ArrowDown size={16} />
      case 'consumption': return <ArrowUp size={16} />
      default: return <RefreshCw size={16} />
    }
  }

  const getMovementLabel = (type: string) => {
    switch (type) {
      case 'purchase': return 'Entrada'
      case 'consumption': return 'Salida'
      case 'adjustment': return 'Ajuste'
      default: return type
    }
  }

  const mondayOfHistory = (d: Date) => {
    const day = d.getDay()
    const diff = day === 0 ? -6 : 1 - day
    return new Date(d.getFullYear(), d.getMonth(), d.getDate() + diff)
  }

  const historyWeeksInMonth = useMemo(() => {
    const monthStart = historyMonthCursor
    const monthEnd = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0)
    const today = new Date()
    const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate())
    const weeks: Array<{ key: string; start: Date; end: Date; label: string }> = []
    let cursor = mondayOfHistory(monthStart)
    while (cursor <= monthEnd) {
      const weekEnd = new Date(cursor)
      weekEnd.setDate(weekEnd.getDate() + 6)
      if (cursor <= todayStart) {
        const cappedEnd = weekEnd > todayStart ? todayStart : weekEnd
        const startLabel = cursor.toLocaleDateString('es-VE', { day: 'numeric', month: 'short' }).replace('.', '')
        const endLabel = cappedEnd.toLocaleDateString('es-VE', { day: 'numeric', month: 'short' }).replace('.', '')
        weeks.push({ key: cursor.toISOString().slice(0, 10), start: cursor, end: cappedEnd, label: `${startLabel} – ${endLabel}` })
      }
      cursor = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate() + 7)
    }
    return weeks.reverse()
  }, [historyMonthCursor])

  useEffect(() => {
    if (modalMode !== 'view') return
    if (historyWeeksInMonth.length === 0) { setHistoryWeekStartKey(null); return }
    if (!historyWeeksInMonth.some((w) => w.key === historyWeekStartKey)) {
      setHistoryWeekStartKey(historyWeeksInMonth[0].key)
    }
  }, [historyWeeksInMonth, modalMode, historyWeekStartKey])

  const canGoNextHistoryMonth = useMemo(() => {
    const now = new Date()
    return historyMonthCursor.getFullYear() < now.getFullYear() ||
      (historyMonthCursor.getFullYear() === now.getFullYear() && historyMonthCursor.getMonth() < now.getMonth())
  }, [historyMonthCursor])

  const movementGroups = useMemo(() => {
    const now = new Date()
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const selectedWeek = historyWeeksInMonth.find((w) => w.key === historyWeekStartKey)
    if (!selectedWeek) return []
    const startTime = selectedWeek.start.getTime()
    const endTime = selectedWeek.end.getTime()

    const filtered = ingredientMovements.filter((mov) => {
      const d = new Date(mov.createdAt)
      const dayStart = new Date(d.getFullYear(), d.getMonth(), d.getDate())
      return dayStart.getTime() >= startTime && dayStart.getTime() <= endTime
    })

    const map = new Map<string, StockMovement[]>()
    for (const mov of filtered) {
      const d = new Date(mov.createdAt)
      const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(mov)
    }
    return [...map.entries()].map(([key, items]) => {
      const d = new Date(items[0].createdAt)
      const dayStart = new Date(d.getFullYear(), d.getMonth(), d.getDate())
      const diffDays = Math.round((startOfToday.getTime() - dayStart.getTime()) / 86400000)
      let label: string
      if (diffDays === 0) label = 'Hoy'
      else if (diffDays === 1) label = 'Ayer'
      else {
        const raw = d.toLocaleDateString('es-VE', { weekday: 'long', day: 'numeric', month: 'long' })
        label = raw.charAt(0).toUpperCase() + raw.slice(1)
      }
      return { key, label, items }
    })
  }, [ingredientMovements, historyWeeksInMonth, historyWeekStartKey])

  useEffect(() => {
    if (modalMode !== 'view') return
    setOpenDayKey(null)
  }, [historyWeekStartKey, modalMode])

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffHours < 1) return 'Ahora'
    if (diffHours < 24) return `${diffHours}h atrás`
    if (diffDays === 1) return 'Ayer'
    return `${diffDays}d atrás`
  }

  if (loading) return <PageSkeleton cards={4} rows={6} hasTable />

  return (
    <div className="inv-page management-workspace management-workspace--inventory">
      {/* Header */}
      <header className="inv-header management-workspace-header">
        <div className="inv-header-text">
          <h1 className="page-title"><Package size={22} className="page-title-icon" /> Inventario</h1>
          <p>Gestiona tu inventario en tiempo real y controla tus existencias.</p>
        </div>
      </header>

      {/* KPI Cards */}
      <div className="inv-kpi-row management-workspace-metrics">
        <div className="inv-kpi-card red">
          <div className="inv-kpi-icon red">
            <ShoppingBag size={22} />
          </div>
          <div className="inv-kpi-info">
            <span className="inv-kpi-label">Valor de inventario</span>
            <span className="inv-kpi-value">${totalInventoryValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            <span className="inv-kpi-sub green">+8.2% vs. ayer</span>
          </div>
        </div>
        <div
          className="inv-kpi-card amber"
          role="button"
          tabIndex={0}
          onClick={() => setShowAllAlertsModal(true)}
          style={{ cursor: 'pointer' }}
          title="Ver productos con stock bajo"
        >
          <div className="inv-kpi-icon amber">
            <AlertTriangle size={22} />
          </div>
          <div className="inv-kpi-info">
            <span className="inv-kpi-label">Stock bajo</span>
            <span className="inv-kpi-value">{lowStockCount}</span>
            <span className="inv-kpi-sub" style={{ color: 'var(--accent-amber, #f59e0b)', fontWeight: 600 }}>Requieren atención &gt;</span>
          </div>
        </div>
        <div
          className="inv-kpi-card green"
          role="button"
          tabIndex={0}
          onClick={() => setShowPortionsModal(true)}
          style={{ cursor: 'pointer' }}
          title="Ver desglose de porciones"
        >
          <div className="inv-kpi-icon green">
            <TrendingUp size={22} />
          </div>
          <div className="inv-kpi-info">
            <span className="inv-kpi-label">Porciones disponibles</span>
            <span className="inv-kpi-value">{Math.round(totalPortionsCount)}</span>
            <span className="inv-kpi-sub" style={{ color: 'var(--accent-green, #22c55e)', fontWeight: 600 }}>Ver desglose &gt;</span>
          </div>
        </div>
        <div className="inv-kpi-card blue">
          <div className="inv-kpi-icon blue">
            <Package size={22} />
          </div>
          <div className="inv-kpi-info">
            <span className="inv-kpi-label">Total de productos</span>
            <span className="inv-kpi-value">{ingredients.length}</span>
            <span className="inv-kpi-sub">Artículos registrados</span>
          </div>
        </div>
      </div>

      {/* Filters Row */}
      <div className="inv-filters-row management-workspace-toolbar">
        <div className="inv-search-box">
          <Search size={16} className="search-icon" />
          <input
            type="text"
            placeholder="Buscar producto..."
            value={searchTerm}
            onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1) }}
          />
          {searchTerm && (
            <button type="button" className="search-clear-btn search-clear-btn--floating" onClick={() => { setSearchTerm(''); setCurrentPage(1) }} aria-label="Borrar búsqueda">
              <X size={13} />
            </button>
          )}
        </div>
        <div className="inv-filter-pills">
          {[['all', 'Todos'], ['raw', 'Materia prima'], ['packaging', 'Empaques'], ['beverages', 'Bebidas']].map(([key, label]) => (
            <button key={key} className={`inv-filter-pill ${categoryFilter === key ? 'active' : ''}`} onClick={() => { setCategoryFilter(key); setCurrentPage(1) }}>{label}</button>
          ))}
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="inv-content-grid">
        {/* Table */}
        <div className="inv-table-card management-workspace-panel">
          <div className="inv-table-wrapper">
            <table className="inv-table">
              <thead>
                <tr>
                  <th>Producto</th>
                  <th>Stock actual</th>
                  <th>Unidad</th>
                  {showCosts && <th>Costo promedio</th>}
                  <th>Estado</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {paginatedIngredients.length === 0 ? (
                  <tr>
                    <td colSpan={showCosts ? 6 : 5}>
                      <EmptyState
                        compact
                        title="No se encontraron productos"
                        description="Prueba con otro nombre o cambia los filtros."
                      />
                    </td>
                  </tr>
                ) : (
                  paginatedIngredients.map(ing => {
                    const status = getStockStatus(ing)
                    return (
                      <tr key={ing.id}>
                        <td>
                          <div className="inv-product-cell">
                            <div className="inv-product-img"><Package size={16} /></div>
                            {ing.name}
                          </div>
                        </td>
                        <td>
                          <span className="inv-stock-value">{ing.currentStock}</span>
                        </td>
                        <td style={{ color: 'var(--text-secondary)' }}>{ing.unitSymbol}</td>
                        {showCosts && (
                          <td style={{ color: 'var(--text-secondary)', fontVariantNumeric: 'tabular-nums' }}>
                            {ing.pricePerUnit !== null ? `$${ing.pricePerUnit.toFixed(2)}` : '-'}
                          </td>
                        )}
                        <td>
                          <span className={`inv-status-badge ${status}`}>
                            <span className="status-dot" />
                            {getStockStatusLabel(status)}
                          </span>
                        </td>
                        <td>
                          <div className="inv-actions">
                            <button className="inv-action-btn" title="Ver movimientos" aria-label={`Ver movimientos de ${ing.name}`} onClick={() => openView(ing)}>
                              <Eye size={13} />
                            </button>
                            {showCosts && (
                              <>
                                <button className="inv-action-btn" title="Editar artículo" aria-label={`Editar ${ing.name}`} onClick={() => openEdit(ing)}><Pencil size={13} /></button>
                                <button className="inv-action-btn positive" title="Agregar inventario" aria-label={`Agregar inventario a ${ing.name}`} onClick={() => openAdjustment(ing, 1)}><Plus size={13} /></button>
                                <button className="inv-action-btn negative" title="Descontar inventario" aria-label={`Descontar inventario de ${ing.name}`} onClick={() => openAdjustment(ing, -1)}><Minus size={13} /></button>
                                <button className="inv-action-btn danger" title="Eliminar artículo" aria-label={`Eliminar ${ing.name}`} onClick={() => handleDelete(ing)}><Trash2 size={13} /></button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {filteredIngredients.length > 0 && (
            <div className="inv-pagination">
              <span className="inv-pagination-info">
                Mostrando {((currentPage - 1) * ITEMS_PER_PAGE) + 1} a {Math.min(currentPage * ITEMS_PER_PAGE, filteredIngredients.length)} de {filteredIngredients.length} productos
              </span>
              <div className="inv-pagination-btns">
                <button
                  className="inv-page-btn"
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage(p => p - 1)}
                >
                  <ChevronLeft size={16} />
                </button>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                  <button
                    key={page}
                    className={`inv-page-btn ${currentPage === page ? 'active' : ''}`}
                    onClick={() => setCurrentPage(page)}
                  >
                    {page}
                  </button>
                ))}
                <button
                  className="inv-page-btn"
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage(p => p + 1)}
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Bottom Side-by-Side Panels (Movimientos & Alertas) */}
        <div className="inv-bottom-panels">
          {/* Movements Card */}
          <div className="inv-sidebar-card management-workspace-panel">
            <div className="inv-sidebar-header">
              <h3 className="inv-sidebar-title">Movimientos recientes</h3>
              <button type="button" className="inv-sidebar-link" onClick={() => setShowAllMovementsModal(true)}>Ver todos</button>
            </div>
            {recentMovements.length === 0 ? (
              <div className="inv-empty-state">
                <p>No hay movimientos</p>
              </div>
            ) : (
              recentMovements.map(mov => {
                const matchingIng = ingredients.find(i => i.id === mov.ingredientId || normalizeForSearch(i.name) === normalizeForSearch(mov.ingredientName))
                return (
                  <div
                    key={mov.id}
                    className="inv-movement-item"
                    onClick={() => { if (matchingIng) openView(matchingIng) }}
                    title={matchingIng ? `Ver historial de ${matchingIng.name}` : undefined}
                  >
                    <div className={`inv-movement-icon ${mov.movementType === 'purchase' ? 'entry' : mov.movementType === 'consumption' ? 'exit' : 'adjustment'}`}>
                      {getMovementIcon(mov.movementType)}
                    </div>
                    <div className="inv-movement-info">
                      <div className="inv-movement-name">
                        {getMovementLabel(mov.movementType)} de {mov.ingredientName}
                      </div>
                      <div className="inv-movement-detail">{mov.notes || mov.referenceType || '-'}</div>
                    </div>
                    <div className="inv-movement-meta">
                      <div className="inv-movement-time">{formatTime(mov.createdAt)}</div>
                      <div className={`inv-movement-amount ${mov.quantity > 0 ? 'positive' : 'negative'}`}>
                        {mov.quantity > 0 ? '+' : ''}{mov.quantity} {mov.unitSymbol}
                      </div>
                    </div>
                  </div>
                )
              })
            )}
          </div>

          {/* Alerts Card */}
          <div className="inv-sidebar-card management-workspace-panel">
            <div className="inv-sidebar-header">
              <h3 className="inv-sidebar-title">Alertas de inventario</h3>
              <button type="button" className="inv-sidebar-link" onClick={() => setShowAllAlertsModal(true)}>Ver todas</button>
            </div>
            {alerts.length === 0 ? (
              <div className="inv-empty-state">
                <p>Sin alertas activas</p>
              </div>
            ) : (
              alerts.map(ing => {
                const status = getStockStatus(ing)
                return (
                  <div
                    key={ing.id}
                    className="inv-alert-item"
                    onClick={() => openView(ing)}
                    title={`Ver detalles de ${ing.name}`}
                  >
                    <div className={`inv-alert-icon ${status}`}>
                      <Package size={16} />
                    </div>
                    <div className="inv-alert-info">
                      <div className="inv-alert-name">{ing.name}</div>
                      <div className="inv-alert-detail">
                        {status === 'critical' ? 'Stock crítico' : 'Stock bajo'} ({ing.currentStock} {ing.unitSymbol} disponibles)
                      </div>
                    </div>
                    <span className={`inv-alert-badge ${status}`}>
                      {status === 'critical' ? 'Crítico' : 'Bajo'}
                    </span>
                  </div>
                )
              })
            )}
            <button className="inv-generate-order-btn" onClick={() => navigate('/compras')}>
              <ShoppingCart size={18} />
              Generar orden de compra
            </button>
          </div>
        </div>
      </div>
      {successMessage && <div className="inv-success" role="status">{successMessage}<button onClick={() => setSuccessMessage('')} aria-label="Cerrar mensaje">×</button></div>}
      {selectedIngredient && modalMode && createPortal(
        <div className={`inv-modal-overlay ${closingIngredient ? 'closing' : ''}`} onClick={closeModal}>
          <div className={`inv-sidebar-card inv-detail-modal ${modalMode === 'view' ? 'inv-detail-modal-history' : ''}`} onClick={event => event.stopPropagation()}>
            <button className="inv-modal-close" onClick={closeModal} aria-label="Cerrar"><X size={16} strokeWidth={2.4} /></button>
            {modalMode === 'view' && (
              <div className="inv-history-view">
                <div className="inv-history-hero">
                  <span className="inv-history-hero-icon"><Package size={24} /></span>
                  <h3>{selectedIngredient.name}</h3>
                  <span className={`inv-status-badge ${getStockStatus(selectedIngredient)}`}>
                    <span className="status-dot" />{getStockStatusLabel(getStockStatus(selectedIngredient))}
                  </span>
                  <div className="inv-history-hero-stock">
                    <small>Stock actual</small>
                    <strong>{selectedIngredient.currentStock} {selectedIngredient.unitSymbol}</strong>
                  </div>
                  <div className="inv-history-hero-count">
                    <History size={13} /> {ingredientMovements.length} movimiento{ingredientMovements.length === 1 ? '' : 's'} registrado{ingredientMovements.length === 1 ? '' : 's'}
                  </div>
                </div>

                <div className="inv-history-timeline">
                  {modalError && <p className="inv-form-error" role="alert">{modalError}</p>}

                  <div className="inv-history-nav-sticky">
                    <div className="inv-history-nav">
                      <div className="inv-history-month-nav">
                        <button type="button" className="inv-history-month-btn" aria-label="Mes anterior" onClick={() => setHistoryMonthCursor(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))}>
                          <ChevronLeft size={16} />
                        </button>
                        <span className="inv-history-month-label">
                          {(() => {
                            const raw = historyMonthCursor.toLocaleDateString('es-VE', { month: 'long', year: 'numeric' })
                            return raw.charAt(0).toUpperCase() + raw.slice(1)
                          })()}
                        </span>
                        <button type="button" className="inv-history-month-btn" aria-label="Mes siguiente" disabled={!canGoNextHistoryMonth} onClick={() => setHistoryMonthCursor(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))}>
                          <ChevronRight size={16} />
                        </button>
                      </div>
                    </div>
                    <div className="inv-history-weeks" role="tablist" aria-label="Semana">
                      {historyWeeksInMonth.map(w => (
                        <button
                          key={w.key}
                          type="button"
                          role="tab"
                          aria-selected={historyWeekStartKey === w.key}
                          className={`inv-history-week-btn ${historyWeekStartKey === w.key ? 'active' : ''}`}
                          onClick={() => setHistoryWeekStartKey(w.key)}
                        >
                          {w.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {modalLoading ? (
                    <div className="inv-modal-loading"><Loader2 className="spin" /> Cargando movimientos…</div>
                  ) : ingredientMovements.length === 0 ? (
                    <div className="inv-empty-state"><span className="inv-empty-state-icon"><History size={22} /></span><p>Este artículo todavía no tiene movimientos.</p></div>
                  ) : movementGroups.length === 0 ? (
                    <div className="inv-empty-state"><span className="inv-empty-state-icon"><History size={22} /></span><p>Sin movimientos en esta semana</p><small>Prueba con otra semana o mes</small></div>
                  ) : (
                    movementGroups.map(group => {
                      const isOpen = openDayKey === group.key
                      return (
                        <section className={`inv-timeline-group ${isOpen ? 'open' : ''}`} key={group.key}>
                          <button
                            type="button"
                            className="inv-timeline-date"
                            aria-expanded={isOpen}
                            onClick={() => setOpenDayKey(current => (current === group.key ? null : group.key))}
                          >
                            <span>{group.label}</span>
                            <span className="inv-timeline-date-right">
                              <small>{group.items.length} movimiento{group.items.length === 1 ? '' : 's'}</small>
                              <ChevronDown size={15} className="inv-timeline-date-chevron" />
                            </span>
                          </button>
                          {isOpen && (
                            <div className="inv-timeline-group-body">
                              {group.items.map(mov => (
                                <div className="inv-timeline-row" key={mov.id}>
                                  <span className={`inv-movement-icon ${mov.movementType === 'purchase' ? 'entry' : mov.movementType === 'consumption' ? 'exit' : 'adjustment'}`}>
                                    {getMovementIcon(mov.movementType)}
                                  </span>
                                  <div className="inv-timeline-content">
                                    <div className="inv-timeline-top">
                                      <strong>{getMovementLabel(mov.movementType)}</strong>
                                      <b className={mov.quantity > 0 ? 'positive' : 'negative'}>{mov.quantity > 0 ? '+' : ''}{mov.quantity} {mov.unitSymbol}</b>
                                    </div>
                                    <div className="inv-timeline-bottom">
                                      <small>{mov.notes || mov.referenceType || 'Sin nota'}</small>
                                      <time>{new Date(mov.createdAt).toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit' })}</time>
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </section>
                      )
                    })
                  )}
                </div>
              </div>
            )}
            {modalMode === 'edit' && <form onSubmit={saveEdit}>
              <div className="inv-modal-heading"><span><Pencil size={18} /></span><div><small>Editar artículo</small><h3>{selectedIngredient.name}</h3></div></div>
              <div className="inv-form-grid">
                <label className="wide"><span>Nombre</span><input value={editForm.name} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} /></label>
                <label><span>Costo por unidad (USD)</span><input type="number" min="0" step="0.01" value={editForm.price} onChange={e => setEditForm(f => ({ ...f, price: e.target.value }))} /></label>
                <label><span>Unidad base</span><StyledSelect value={editForm.unitId} disabled aria-describedby="unit-help">{units.map(unit => <option value={unit.id} key={unit.id}>{unit.name} ({unit.symbol})</option>)}</StyledSelect></label>
                <label className="wide"><span>Clasificación</span><StyledSelect value={editForm.inventoryClass} onChange={e => setEditForm(f => ({ ...f, inventoryClass: e.target.value as Ingredient['inventoryClass'] }))}><option value="raw_material">Materia prima</option><option value="packaging">Empaque</option><option value="beverage">Bebida</option><option value="non_inventory">No inventariable</option></StyledSelect></label>
              </div>
              <p className="inv-form-hint" id="unit-help">La unidad base no se cambia porque alteraría el significado del historial. La existencia se ajusta con los botones + y −.</p>
              {modalError && <p className="inv-form-error" role="alert">{modalError}</p>}
              <button className="inv-generate-order-btn" disabled={modalLoading}>{modalLoading ? <Loader2 className="spin" size={17} /> : <Save size={17} />} Guardar cambios</button>
            </form>}
            {modalMode === 'adjust' && <form onSubmit={saveAdjustment}>
              <div className="inv-modal-heading"><span className={adjustment.direction > 0 ? 'positive' : 'negative'}>{adjustment.direction > 0 ? <Plus size={18} /> : <Minus size={18} />}</span><div><small>{adjustment.direction > 0 ? 'Agregar al inventario' : 'Descontar del inventario'}</small><h3>{selectedIngredient.name}</h3></div></div>
              <div className="inv-current-stock"><small>Stock actual</small><strong>{selectedIngredient.currentStock} {selectedIngredient.unitSymbol}</strong></div>
              <div className="inv-form-grid"><label className="wide"><span>Cantidad ({selectedIngredient.unitSymbol})</span><input autoFocus type="number" min="0.001" step="0.001" value={adjustment.quantity} onChange={e => setAdjustment(a => ({ ...a, quantity: e.target.value }))} placeholder="0.000" /></label><label className="wide"><span>Motivo del ajuste</span><textarea value={adjustment.notes} onChange={e => setAdjustment(a => ({ ...a, notes: e.target.value }))} placeholder="Ej. conteo físico, merma, recepción manual…" /></label></div>
              {modalError && <p className="inv-form-error" role="alert">{modalError}</p>}
              <button className={`inv-generate-order-btn ${adjustment.direction < 0 ? 'danger' : ''}`} disabled={modalLoading}>{modalLoading ? <Loader2 className="spin" size={17} /> : adjustment.direction > 0 ? <Plus size={17} /> : <Minus size={17} />} {adjustment.direction > 0 ? 'Registrar entrada' : 'Registrar salida'}</button>
            </form>}
          </div>
        </div>,
        document.body
      )}
      {showPortionsModal && createPortal(
        <div className="inv-modal-overlay" onClick={() => setShowPortionsModal(false)}>
          <div className="inv-sidebar-card inv-detail-modal" onClick={event => event.stopPropagation()}>
            <button className="inv-modal-close" onClick={() => setShowPortionsModal(false)} aria-label="Cerrar"><X size={16} strokeWidth={2.4} /></button>
            <div className="inv-modal-heading">
              <span className="positive"><TrendingUp size={18} /></span>
              <div>
                <small>Producción y Cocina</small>
                <h3>Porciones Disponibles</h3>
              </div>
            </div>
            <p className="inv-form-hint">
              Raciones listas preparadas en el Food Truck disponibles para el despacho de pedidos.
            </p>

            {portionItems.length === 0 ? (
              <div className="inv-empty-state">
                <p>No hay porciones registradas en este momento.</p>
                <button className="inv-generate-order-btn" onClick={() => { setShowPortionsModal(false); navigate('/produccion') }}>
                  Ir a Producción
                </button>
              </div>
            ) : (
              <div className="inv-history-list" style={{ marginTop: '0.75rem' }}>
                {portionItems.map(p => (
                  <div className="inv-history-row" key={p.id}>
                    <div className="inv-movement-icon entry">
                      <Package size={15} />
                    </div>
                    <div>
                      <strong>{p.name}</strong>
                      <small>{showCosts && p.pricePerUnit !== null ? `Costo: $${p.pricePerUnit.toFixed(2)} c/u` : 'Ración lista'}</small>
                    </div>
                    <b className={p.currentStock > 0 ? 'positive' : 'negative'}>
                      {p.currentStock} {['por', 'porcion', 'porción', 'porciones'].includes(p.unitSymbol.toLowerCase()) ? (p.currentStock === 1 ? 'porción' : 'porciones') : p.unitSymbol}
                    </b>
                  </div>
                ))}
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '1rem 0.5rem 0', borderTop: '1px solid var(--border-color)', marginTop: '0.5rem' }}>
                  <span style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>Total porciones:</span>
                  <strong style={{ color: 'var(--accent-green, #22c55e)', fontSize: '1.1rem' }}>
                    {Math.round(totalPortionsCount)} {Math.round(totalPortionsCount) === 1 ? 'porción' : 'porciones'}
                  </strong>
                </div>
                <button className="inv-generate-order-btn" style={{ marginTop: '1rem' }} onClick={() => { setShowPortionsModal(false); navigate('/produccion') }}>
                  + Nueva producción de raciones
                </button>
              </div>
            )}
          </div>
        </div>,
        document.body
      )}

      {/* Modal: All Movements */}
      {showAllMovementsModal && createPortal(
        <div className={`inv-modal-overlay ${closingAllMovements ? 'closing' : ''}`} onClick={() => closeAllMovementsModal()}>
          <div className="inv-sidebar-card inv-wide-modal" onClick={e => e.stopPropagation()}>
            <button className="inv-modal-close" onClick={() => closeAllMovementsModal()} aria-label="Cerrar"><X size={16} strokeWidth={2.4} /></button>
            <div className="inv-modal-heading">
              <span><RefreshCw size={18} /></span>
              <div>
                <small>Auditoría de almacén</small>
                <h3>Historial de movimientos ({stockMovements.length})</h3>
              </div>
            </div>

            <div className="inv-modal-toolbar">
              <div className="inv-modal-search">
                <Search size={14} className="search-icon" />
                <input
                  type="text"
                  placeholder="Buscar por insumo o motivo..."
                  value={movementSearchTerm}
                  onChange={e => { setMovementSearchTerm(e.target.value); setMovementCurrentPage(1) }}
                />
              </div>
              <div className="inv-modal-filter-pills">
                {[
                  ['all', 'Todos'],
                  ['purchase', 'Entradas'],
                  ['consumption', 'Salidas'],
                  ['adjustment', 'Ajustes'],
                ].map(([key, label]) => (
                  <button
                    key={key}
                    className={`inv-modal-filter-pill ${movementTypeFilter === key ? 'active' : ''}`}
                    onClick={() => { setMovementTypeFilter(key as typeof movementTypeFilter); setMovementCurrentPage(1) }}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div className="inv-modal-list">
              {filteredAllMovements.length === 0 ? (
                <div className="inv-empty-state"><p>No se encontraron movimientos con los filtros aplicados</p></div>
              ) : (
                paginatedAllMovements.map(mov => {
                  const matchingIng = ingredients.find(i => i.id === mov.ingredientId || normalizeForSearch(i.name) === normalizeForSearch(mov.ingredientName))
                  return (
                    <div
                      key={mov.id}
                      className="inv-movement-item"
                      onClick={() => {
                        if (matchingIng) {
                          closeAllMovementsModal(() => openView(matchingIng))
                        }
                      }}
                      title={matchingIng ? `Ver historial de ${matchingIng.name}` : undefined}
                    >
                      <div className={`inv-movement-icon ${mov.movementType === 'purchase' ? 'entry' : mov.movementType === 'consumption' ? 'exit' : 'adjustment'}`}>
                        {getMovementIcon(mov.movementType)}
                      </div>
                      <div className="inv-movement-info">
                        <div className="inv-movement-name">
                          {getMovementLabel(mov.movementType)} de <strong>{mov.ingredientName}</strong>
                        </div>
                        <div className="inv-movement-detail">{mov.notes || mov.referenceType || 'Sin notas'}</div>
                      </div>
                      <div className="inv-movement-meta">
                        <div className="inv-movement-time">{new Date(mov.createdAt).toLocaleString('es-VE', { dateStyle: 'short', timeStyle: 'short' })}</div>
                        <div className={`inv-movement-amount ${mov.quantity > 0 ? 'positive' : 'negative'}`}>
                          {mov.quantity > 0 ? '+' : ''}{mov.quantity} {mov.unitSymbol}
                        </div>
                      </div>
                    </div>
                  )
                })
              )}
            </div>

            {filteredAllMovements.length > MOVEMENTS_PER_PAGE && (
              <div className="inv-modal-pagination">
                <span className="inv-modal-pagination-info">
                  Mostrando {((movementCurrentPage - 1) * MOVEMENTS_PER_PAGE) + 1} a {Math.min(movementCurrentPage * MOVEMENTS_PER_PAGE, filteredAllMovements.length)} de {filteredAllMovements.length} movimientos
                </span>
                <div className="inv-pagination-btns">
                  <button
                    type="button"
                    className="inv-page-btn"
                    disabled={movementCurrentPage === 1}
                    onClick={() => setMovementCurrentPage(p => p - 1)}
                    aria-label="Página anterior"
                  >
                    <ChevronLeft size={16} />
                  </button>
                  {Array.from({ length: totalMovementPages }, (_, i) => i + 1).map(page => (
                    <button
                      key={page}
                      type="button"
                      className={`inv-page-btn ${movementCurrentPage === page ? 'active' : ''}`}
                      onClick={() => setMovementCurrentPage(page)}
                    >
                      {page}
                    </button>
                  ))}
                  <button
                    type="button"
                    className="inv-page-btn"
                    disabled={movementCurrentPage === totalMovementPages}
                    onClick={() => setMovementCurrentPage(p => p + 1)}
                    aria-label="Página siguiente"
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>,
        document.body
      )}

      {/* Modal: All Alerts */}
      {showAllAlertsModal && createPortal(
        <div className={`inv-modal-overlay ${closingAllAlerts ? 'closing' : ''}`} onClick={() => closeAllAlertsModal()}>
          <div className="inv-sidebar-card inv-wide-modal" onClick={e => e.stopPropagation()}>
            <button className="inv-modal-close" onClick={() => closeAllAlertsModal()} aria-label="Cerrar"><X size={16} strokeWidth={2.4} /></button>
            <div className="inv-modal-heading">
              <span className="negative"><AlertTriangle size={18} /></span>
              <div>
                <small>Existencias por debajo del mínimo</small>
                <h3>Alertas de inventario ({allAlerts.length})</h3>
              </div>
            </div>

            <div className="inv-modal-toolbar">
              <div className="inv-modal-search">
                <Search size={14} className="search-icon" />
                <input
                  type="text"
                  placeholder="Buscar insumo con alerta..."
                  value={alertSearchTerm}
                  onChange={e => setAlertSearchTerm(e.target.value)}
                />
              </div>
              <div className="inv-modal-filter-pills">
                {[
                  ['all', `Todas (${allAlerts.length})`],
                  ['critical', `Críticos (${allAlerts.filter(i => getStockStatus(i) === 'critical').length})`],
                  ['low', `Bajos (${allAlerts.filter(i => getStockStatus(i) === 'low').length})`],
                ].map(([key, label]) => (
                  <button
                    key={key}
                    className={`inv-modal-filter-pill ${alertSeverityFilter === key ? 'active' : ''}`}
                    onClick={() => setAlertSeverityFilter(key as typeof alertSeverityFilter)}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div className="inv-modal-list">
              {filteredAllAlerts.length === 0 ? (
                <div className="inv-empty-state"><p>No hay alertas con los filtros seleccionados</p></div>
              ) : (
                filteredAllAlerts.map(ing => {
                  const status = getStockStatus(ing)
                  return (
                    <div key={ing.id} className="inv-alert-modal-item">
                      <div className="inv-alert-info" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div className={`inv-alert-icon ${status}`}>
                          <Package size={16} />
                        </div>
                        <div>
                          <div className="inv-alert-name" style={{ fontSize: '0.9375rem', fontWeight: 600 }}>{ing.name}</div>
                          <div className="inv-alert-detail" style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                            Disponible: <strong style={{ color: status === 'critical' ? '#ff4d3d' : '#f59e0b' }}>{ing.currentStock} {ing.unitSymbol}</strong>
                          </div>
                        </div>
                      </div>
                      <div className="inv-alert-modal-actions">
                        <span className={`inv-alert-badge ${status}`} style={{ marginRight: '6px' }}>
                          {status === 'critical' ? 'Crítico' : 'Bajo'}
                        </span>
                        <button
                          type="button"
                          className="inv-alert-action-btn"
                          onClick={() => closeAllAlertsModal(() => openView(ing))}
                          title="Ver historial"
                        >
                          <Eye size={13} /> Historial
                        </button>
                        <button
                          type="button"
                          className="inv-alert-action-btn primary"
                          onClick={() => closeAllAlertsModal(() => openAdjustment(ing, 1))}
                          title="Registrar entrada"
                        >
                          <Plus size={13} /> Entrada
                        </button>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}
