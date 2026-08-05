import { useState, useMemo, useEffect, useCallback } from 'react'
import { useAuth } from '../context/auth-context'
import {
  getIngredients,
  getStockMovements,
  type Ingredient,
  type StockMovement,
} from '../lib/dataService'
import {
  Package,
  Search,
  SlidersHorizontal,
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
} from 'lucide-react'
import './Inventario.css'

const ITEMS_PER_PAGE = 8

export function Inventario() {
  const { user } = useAuth()
  const [ingredients, setIngredients] = useState<Ingredient[]>([])
  const [stockMovements, setStockMovements] = useState<StockMovement[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [currentPage, setCurrentPage] = useState(1)

  const showCosts = user?.role === 'owner' || user?.role === 'manager'

  const fetchAll = useCallback(async () => {
    try {
      const [ingData, movData] = await Promise.all([
        getIngredients(),
        getStockMovements(),
      ])
      setIngredients(ingData)
      setStockMovements(movData)
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
    return ingredients.filter(ing =>
      ing.name.toLowerCase().includes(searchTerm.toLowerCase())
    )
  }, [ingredients, searchTerm])

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

  if (loading) {
    return (
      <div className="inv-page">
        <div className="inv-loading">
          <RefreshCw size={24} className="spin" />
          <p>Cargando inventario...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="inv-page">
      {/* Header */}
      <header className="inv-header">
        <div className="inv-header-icon">
          <Package size={24} />
        </div>
        <div className="inv-header-text">
          <h1>Inventario</h1>
          <p>Gestiona tu inventario en tiempo real y controla tus existencias.</p>
        </div>
      </header>

      {/* KPI Cards */}
      <div className="inv-kpi-row">
        <div className="inv-kpi-card">
          <div className="inv-kpi-icon red">
            <ShoppingBag size={22} />
          </div>
          <div className="inv-kpi-info">
            <span className="inv-kpi-label">Valor total del inventario</span>
            <span className="inv-kpi-value">${totalInventoryValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            <span className="inv-kpi-sub green">+8.2% vs. ayer</span>
          </div>
        </div>
        <div className="inv-kpi-card">
          <div className="inv-kpi-icon amber">
            <AlertTriangle size={22} />
          </div>
          <div className="inv-kpi-info">
            <span className="inv-kpi-label">Productos con stock bajo</span>
            <span className="inv-kpi-value">{lowStockCount}</span>
            <span className="inv-kpi-sub amber">Requieren atención</span>
          </div>
        </div>
        <div className="inv-kpi-card">
          <div className="inv-kpi-icon green">
            <TrendingUp size={22} />
          </div>
          <div className="inv-kpi-info">
            <span className="inv-kpi-label">Porciones disponibles</span>
            <span className="inv-kpi-value">{Math.round(totalPortions)}</span>
            <span className="inv-kpi-sub">Porciones listas</span>
          </div>
        </div>
        <div className="inv-kpi-card">
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
      <div className="inv-filters-row">
        <div className="inv-filter-pills">
          <button className="inv-filter-pill active">Todos</button>
          <button className="inv-filter-pill">Materia prima</button>
          <button className="inv-filter-pill">Porciones</button>
          <button className="inv-filter-pill">Empaques</button>
          <button className="inv-filter-pill">Bebidas</button>
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
          </div>
          <button className="inv-filter-btn">
            <SlidersHorizontal size={16} />
            Filtros
          </button>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="inv-content-grid">
        {/* Table */}
        <div className="inv-table-card">
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
                      <div className="inv-empty-state">
                        <p>No se encontraron productos</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  paginatedIngredients.map(ing => {
                    const status = getStockStatus(ing)
                    return (
                      <tr key={ing.id}>
                        <td>
                          <div className="inv-product-cell">
                            <div className="inv-product-img">📦</div>
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
                            <button className="inv-action-btn" title="Ver detalle">
                              <Eye size={14} />
                            </button>
                            {showCosts && (
                              <button className="inv-action-btn" title="Editar">
                                <Pencil size={14} />
                              </button>
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
          <div className="inv-sidebar-card">
            <div className="inv-sidebar-header">
              <h3 className="inv-sidebar-title">Movimientos recientes</h3>
              <button className="inv-sidebar-link">Ver todos</button>
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
          <div className="inv-sidebar-card">
            <div className="inv-sidebar-header">
              <h3 className="inv-sidebar-title">Alertas de inventario</h3>
              <button className="inv-sidebar-link">Ver todas</button>
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
                      📦
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
            <button className="inv-generate-order-btn">
              <ShoppingCart size={18} />
              Generar orden de compra
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
