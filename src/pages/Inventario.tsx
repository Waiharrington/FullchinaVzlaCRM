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
  type Ingredient,
  type StockMovement,
} from '../lib/dataService'
import { normalizeForSearch } from '../lib/textFormat'
import {
  Package,
  Search,
  Eye,
  Pencil,
  TrendingUp,
  AlertTriangle,
  ShoppingBag,
  Bell,
  ArrowDown,
  ArrowUp,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  ShoppingCart,
  X,
  Plus,
  Minus,
  Save,
  Loader2,
} from 'lucide-react'
import { EmptyState } from '../components/EmptyState'
import { PageSkeleton } from '../components/PageSkeleton'
import './Inventario.css'

const ITEMS_PER_PAGE = 8
type InventoryModal = 'view' | 'edit' | 'adjust' | null

// Cache a nivel de módulo: al volver a Inventario se muestran los datos de
// la última visita al instante, sin el parpadeo de "Cargando...", mientras
// se refrescan en segundo plano.
let inventarioCache: { ingredients: Ingredient[]; stockMovements: StockMovement[] } | null = null

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
      const matchesCategory = categoryFilter === 'all' ||
        (categoryFilter === 'raw' && ing.inventoryClass === 'raw_material') ||
        (categoryFilter === 'packaging' && ing.inventoryClass === 'packaging') ||
        (categoryFilter === 'beverages' && ing.inventoryClass === 'beverage')
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

  const totalPortions = useMemo(() => {
    return ingredients.reduce((sum, ing) => sum + ing.currentStock, 0)
  }, [ingredients])

  const criticalCount = useMemo(() => {
    return ingredients.filter(i => i.currentStock <= 5).length
  }, [ingredients])

  const recentMovements = useMemo(() => {
    return stockMovements.slice(0, 5)
  }, [stockMovements])

  const alerts = useMemo(() => {
    return ingredients
      .filter(i => i.currentStock <= 10)
      .sort((a, b) => a.currentStock - b.currentStock)
      .slice(0, 4)
  }, [ingredients])

  const getStockStatus = (ing: Ingredient): 'ok' | 'low' | 'critical' => {
    if (ing.currentStock <= 5) return 'critical'
    if (ing.currentStock <= 10) return 'low'
    return 'ok'
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
            <span className="inv-kpi-label">Valor total del inventario</span>
            <span className="inv-kpi-value">${totalInventoryValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            <span className="inv-kpi-sub green">+8.2% vs. ayer</span>
          </div>
        </div>
        <div className="inv-kpi-card amber">
          <div className="inv-kpi-icon amber">
            <AlertTriangle size={22} />
          </div>
          <div className="inv-kpi-info">
            <span className="inv-kpi-label">Productos con stock bajo</span>
            <span className="inv-kpi-value">{lowStockCount}</span>
            <span className="inv-kpi-sub amber">Requieren atención</span>
          </div>
        </div>
        <div className="inv-kpi-card green">
          <div className="inv-kpi-icon green">
            <TrendingUp size={22} />
          </div>
          <div className="inv-kpi-info">
            <span className="inv-kpi-label">Porciones disponibles</span>
            <span className="inv-kpi-value">{Math.round(totalPortions)}</span>
            <span className="inv-kpi-sub">Porciones listas</span>
          </div>
        </div>
        <div className="inv-kpi-card orange">
          <div className="inv-kpi-icon orange">
            <Bell size={22} />
          </div>
          <div className="inv-kpi-info">
            <span className="inv-kpi-label">Alertas activas</span>
            <span className="inv-kpi-value">{criticalCount}</span>
            <span className="inv-kpi-link">Ver detalles {'>'}</span>
          </div>
        </div>
      </div>

      {/* Filters Row */}
      <div className="inv-filters-row management-workspace-toolbar">
        <div className="inv-filter-pills">
          {[['all', 'Todos'], ['raw', 'Materia prima'], ['packaging', 'Empaques'], ['beverages', 'Bebidas']].map(([key, label]) => (
            <button key={key} className={`inv-filter-pill ${categoryFilter === key ? 'active' : ''}`} onClick={() => { setCategoryFilter(key); setCurrentPage(1) }}>{label}</button>
          ))}
        </div>
        <div className="inv-search-and-filters">
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
                              <Eye size={14} />
                            </button>
                            {showCosts && (
                              <>
                                <button className="inv-action-btn" title="Editar artículo" aria-label={`Editar ${ing.name}`} onClick={() => openEdit(ing)}><Pencil size={14} /></button>
                                <button className="inv-action-btn positive" title="Agregar inventario" aria-label={`Agregar inventario a ${ing.name}`} onClick={() => openAdjustment(ing, 1)}><Plus size={14} /></button>
                                <button className="inv-action-btn negative" title="Descontar inventario" aria-label={`Descontar inventario de ${ing.name}`} onClick={() => openAdjustment(ing, -1)}><Minus size={14} /></button>
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

        {/* Right Sidebar */}
        <div className="inv-sidebar">
          {/* Movements Card */}
          <div className="inv-sidebar-card management-workspace-panel">
            <div className="inv-sidebar-header">
              <h3 className="inv-sidebar-title">Movimientos recientes</h3>
              <button className="inv-sidebar-link" onClick={() => setSearchTerm('')}>Ver todos</button>
            </div>
            {recentMovements.length === 0 ? (
              <div className="inv-empty-state">
                <p>No hay movimientos</p>
              </div>
            ) : (
              recentMovements.map(mov => (
                <div key={mov.id} className="inv-movement-item">
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
              ))
            )}
          </div>

          {/* Alerts Card */}
          <div className="inv-sidebar-card management-workspace-panel">
            <div className="inv-sidebar-header">
              <h3 className="inv-sidebar-title">Alertas de inventario</h3>
              <button className="inv-sidebar-link" onClick={() => setCategoryFilter('all')}>Ver todas</button>
            </div>
            {alerts.length === 0 ? (
              <div className="inv-empty-state">
                <p>Sin alertas activas</p>
              </div>
            ) : (
              alerts.map(ing => {
                const status = getStockStatus(ing)
                return (
                  <div key={ing.id} className="inv-alert-item">
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
          <div className="inv-sidebar-card inv-detail-modal" onClick={event => event.stopPropagation()}>
            <button className="inv-modal-close" onClick={closeModal} aria-label="Cerrar"><X size={16} strokeWidth={2.4} /></button>
            {modalMode === 'view' && <>
              <div className="inv-modal-heading"><span><Eye size={18} /></span><div><small>Historial del artículo</small><h3>{selectedIngredient.name}</h3></div></div>
              <div className="inv-current-stock"><small>Stock actual</small><strong>{selectedIngredient.currentStock} {selectedIngredient.unitSymbol}</strong></div>
              {modalError && <p className="inv-form-error" role="alert">{modalError}</p>}
              {modalLoading ? <div className="inv-modal-loading"><Loader2 className="spin" /> Cargando movimientos…</div> : ingredientMovements.length === 0 ? <div className="inv-empty-state"><p>Este artículo todavía no tiene movimientos.</p></div> : <div className="inv-history-list">{ingredientMovements.map(mov => <div className="inv-history-row" key={mov.id}><div className={`inv-movement-icon ${mov.quantity > 0 ? 'entry' : 'exit'}`}>{mov.quantity > 0 ? <Plus size={15} /> : <Minus size={15} />}</div><div><strong>{getMovementLabel(mov.movementType)}</strong><small>{mov.notes || mov.referenceType || 'Sin nota'}</small><time>{new Date(mov.createdAt).toLocaleString('es-VE')}</time></div><b className={mov.quantity > 0 ? 'positive' : 'negative'}>{mov.quantity > 0 ? '+' : ''}{mov.quantity} {mov.unitSymbol}</b></div>)}</div>}
            </>}
            {modalMode === 'edit' && <form onSubmit={saveEdit}>
              <div className="inv-modal-heading"><span><Pencil size={18} /></span><div><small>Editar artículo</small><h3>{selectedIngredient.name}</h3></div></div>
              <div className="inv-form-grid">
                <label className="wide"><span>Nombre</span><input value={editForm.name} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} /></label>
                <label><span>Costo por unidad (USD)</span><input type="number" min="0" step="0.01" value={editForm.price} onChange={e => setEditForm(f => ({ ...f, price: e.target.value }))} /></label>
                <label><span>Unidad base</span><select value={editForm.unitId} disabled aria-describedby="unit-help">{units.map(unit => <option value={unit.id} key={unit.id}>{unit.name} ({unit.symbol})</option>)}</select></label>
                <label className="wide"><span>Clasificación</span><select value={editForm.inventoryClass} onChange={e => setEditForm(f => ({ ...f, inventoryClass: e.target.value as Ingredient['inventoryClass'] }))}><option value="raw_material">Materia prima</option><option value="packaging">Empaque</option><option value="beverage">Bebida</option><option value="non_inventory">No inventariable</option></select></label>
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
    </div>
  )
}
