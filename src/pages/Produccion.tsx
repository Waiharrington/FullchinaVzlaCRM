import { useState, useEffect, useCallback, useMemo } from 'react'
import { useAuth } from '../context/auth-context'
import {
  getSellableProducts,
  getRecipeComponents,
  getProductionBatches,
  getProductionStats,
  getProductionBonuses,
  createProductionBatch,
  type SellableProduct,
  type RecipeComponent,
  type ProductionBatch,
  type ProductionStats,
  type ProductionBonus,
} from '../lib/dataService'
import {
  UtensilsCrossed,
  TrendingUp,
  Trash2,
  DollarSign,
  Clock,
  Info,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  MoreVertical,
  RefreshCw,
} from 'lucide-react'
import './Produccion.css'

const BONUS_PER_PIECE = 0.15
const AVATAR_COLORS = ['green', 'blue', 'amber', 'purple']

export function Produccion() {
  const { user } = useAuth()

  const [batches, setBatches] = useState<ProductionBatch[]>([])
  const [stats, setStats] = useState<ProductionStats | null>(null)
  const [bonuses, setBonuses] = useState<ProductionBonus[]>([])
  const [recipes, setRecipes] = useState<SellableProduct[]>([])
  const [recipeComponents, setRecipeComponents] = useState<RecipeComponent[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [selectedRecipeId, setSelectedRecipeId] = useState('')
  const [inputQty, setInputQty] = useState('10')
  const [outputQty, setOutputQty] = useState('40')
  const [wasteQty, setWasteQty] = useState('0.5')
  const [operatorName, setOperatorName] = useState('')

  const [showHistoryModal, setShowHistoryModal] = useState(false)
  const [historyPage, setHistoryPage] = useState(1)
  const [selectedBatchDetail, setSelectedBatchDetail] = useState<ProductionBatch | null>(null)

  const fetchData = useCallback(async () => {
    try {
      const [batchData, statsData, bonusData, recipeData] = await Promise.all([
        getProductionBatches(),
        getProductionStats(),
        getProductionBonuses(),
        getSellableProducts(),
      ])
      setBatches(batchData)
      setStats(statsData)
      setBonuses(bonusData)
      setRecipes(recipeData)
    } catch (e) {
      console.error('Error loading production data:', e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  useEffect(() => {
    if (!selectedRecipeId) {
      setRecipeComponents([])
      return
    }
    getRecipeComponents(selectedRecipeId).then(setRecipeComponents).catch(() => setRecipeComponents([]))
  }, [selectedRecipeId])

  const selectedRecipe = useMemo(
    () => recipes.find(r => r.id === selectedRecipeId),
    [recipes, selectedRecipeId],
  )

  const ingredientCost = useMemo(
    () => recipeComponents.reduce((sum, c) => sum + (c.costPerUnit ?? 0) * c.quantity, 0),
    [recipeComponents],
  )

  const inputQtyNum = parseFloat(inputQty) || 0
  const outputQtyNum = parseInt(outputQty) || 0
  const wasteQtyNum = parseFloat(wasteQty) || 0
  const totalCost = ingredientCost + wasteQtyNum * (ingredientCost / (inputQtyNum || 1))
  const costPerPortion = outputQtyNum > 0 ? totalCost / outputQtyNum : 0
  const wastePct = inputQtyNum > 0 ? (wasteQtyNum / inputQtyNum) * 100 : 0

  const conversionYield = inputQtyNum > 0 ? ((outputQtyNum * 0.25) / inputQtyNum) * 100 : 0

  const recentBatches = useMemo(() => batches.slice(0, 5), [batches])

  const handleSaveBatch = async () => {
    if (!selectedRecipeId || outputQtyNum <= 0) return
    setSaving(true)
    try {
      const userId = user?.id || ''
      await createProductionBatch({
        name: selectedRecipe?.name || 'Lote de Producción',
        quantityProduced: outputQtyNum,
        unitId: recipeComponents[0]?.unitId || '',
        wasteQuantity: wasteQtyNum,
        notes: operatorName ? `Operador: ${operatorName}` : undefined,
        items: recipeComponents.map(c => ({
          ingredientId: c.ingredientId || '',
          quantityUsed: c.quantity,
          unitId: c.unitId,
        })),
        createdBy: userId,
      })
      setSelectedRecipeId('')
      setInputQty('10')
      setOutputQty('40')
      setWasteQty('0.5')
      setOperatorName('')
      fetchData()
    } catch (e) {
      console.error('Error saving batch:', e)
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="prod-page">
        <div className="prod-loading">
          <RefreshCw size={24} className="prod-spin" />
          <p>Cargando producción...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="prod-page">
      {/* Header */}
      <header className="prod-header">
        <div className="prod-header-icon">
          <UtensilsCrossed size={24} />
        </div>
        <div className="prod-header-text">
          <h1>Producción</h1>
          <p>Transformación de materia prima, merma y bonos de producción</p>
        </div>
      </header>

      {/* KPI Cards */}
      <div className="prod-kpi-row">
        <div className="prod-kpi-card">
          <div className="prod-kpi-icon red">
            <UtensilsCrossed size={22} />
          </div>
          <div className="prod-kpi-info">
            <span className="prod-kpi-label">Producciones de hoy</span>
            <span className="prod-kpi-value">{stats?.batchesToday ?? 0}</span>
            <span className="prod-kpi-sub">
              lotes completados
            </span>
            <span className="prod-kpi-sub green">
              ↑ {stats ? Math.max(0, stats.batchesToday - stats.batchesYesterday) : 0} vs ayer
            </span>
          </div>
        </div>
        <div className="prod-kpi-card">
          <div className="prod-kpi-icon amber">
            <TrendingUp size={22} />
          </div>
          <div className="prod-kpi-info">
            <span className="prod-kpi-label">Rendimiento promedio</span>
            <span className="prod-kpi-value">{stats?.avgYield ?? 0}%</span>
            <span className="prod-kpi-sub">de conversión</span>
            <span className="prod-kpi-sub green">
              ↑ {Math.abs(stats?.yieldChange ?? 0)}% vs ayer
            </span>
          </div>
        </div>
        <div className="prod-kpi-card">
          <div className="prod-kpi-icon green">
            <Trash2 size={22} />
          </div>
          <div className="prod-kpi-info">
            <span className="prod-kpi-label">Merma</span>
            <span className="prod-kpi-value">{stats?.totalWaste ?? 0} kg</span>
            <span className="prod-kpi-sub">
              valorado en ${(stats?.totalWaste ?? 0) * 15}
            </span>
            <span className="prod-kpi-sub amber">
              ↓ {Math.abs(stats?.wasteChange ?? 0)} kg vs ayer
            </span>
          </div>
        </div>
        <div className="prod-kpi-card">
          <div className="prod-kpi-icon purple">
            <DollarSign size={22} />
          </div>
          <div className="prod-kpi-info">
            <span className="prod-kpi-label">Costo por porción</span>
            <span className="prod-kpi-value">${stats?.avgCostPerPortion ?? 0}</span>
            <span className="prod-kpi-sub">promedio del día</span>
            <span className="prod-kpi-sub red">
              ↑ ${Math.abs(stats?.costChange ?? 0)} vs ayer
            </span>
          </div>
        </div>
      </div>

      {/* Content Grid */}
      <div className="prod-content-grid">
        {/* Main Column */}
        <div className="prod-main-col">
          {/* Nueva Producción Card */}
          <div className="prod-card">
            <div className="prod-card-header">
              <h2 className="prod-card-title">
                <span className="prod-card-title-icon">
                  <UtensilsCrossed size={14} />
                </span>
                Nueva producción
              </h2>
              <div className="prod-card-actions">
                <button
                  className="prod-btn prod-btn-outline"
                  onClick={() => setShowHistoryModal(true)}
                >
                  <Clock size={14} />
                  Historial de producciones
                </button>
              </div>
            </div>

            {/* Recipe + Unit Row */}
            <div className="prod-form-row">
              <div className="prod-form-group">
                <label className="prod-form-label">Receta / Producción</label>
                <select
                  className="prod-form-select"
                  value={selectedRecipeId}
                  onChange={e => setSelectedRecipeId(e.target.value)}
                >
                  <option value="">Seleccionar receta...</option>
                  {recipes.map(r => (
                    <option key={r.id} value={r.id}>
                      {r.emoji} {r.name}
                    </option>
                  ))}
                </select>
                {selectedRecipe && (
                  <span className="prod-form-desc">{selectedRecipe.description}</span>
                )}
              </div>
              <div className="prod-form-group">
                <label className="prod-form-label">Unidad de salida</label>
                <select className="prod-form-select" defaultValue="porcion">
                  <option value="porcion">Porción</option>
                  <option value="pieza">Pieza</option>
                  <option value="kg">Kg</option>
                </select>
              </div>
            </div>

            {/* Ingredients Table */}
            {recipeComponents.length > 0 && (
              <>
                <table className="prod-ingredients-table">
                  <thead>
                    <tr>
                      <th>Ingrediente</th>
                      <th>Entrada</th>
                      <th>Costo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recipeComponents.map(c => (
                      <tr key={c.id}>
                        <td>{c.ingredientName}</td>
                        <td>{c.quantity} {c.unitSymbol}</td>
                        <td>${((c.costPerUnit ?? 0) * c.quantity).toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="prod-ingredients-total">
                  <span className="prod-ingredients-total-label">Costo total ingredientes</span>
                  <span className="prod-ingredients-total-value">${ingredientCost.toFixed(2)}</span>
                </div>
              </>
            )}

            {/* Quantities Row */}
            <div className="prod-quantities-row">
              <div className="prod-quantity-box">
                <div className="prod-quantity-label">Cantidad de entrada</div>
                <div className="prod-quantity-input">
                  <button
                    className="prod-quantity-btn"
                    onClick={() => setInputQty(String(Math.max(0, (parseFloat(inputQty) || 0) - 1)))}
                  >
                    −
                  </button>
                  <span className="prod-quantity-value">{inputQty}</span>
                  <button
                    className="prod-quantity-btn"
                    onClick={() => setInputQty(String((parseFloat(inputQty) || 0) + 1))}
                  >
                    +
                  </button>
                </div>
                <div className="prod-quantity-unit">{selectedRecipe?.name || 'Materia prima'}</div>
              </div>

              <div className="prod-quantity-operator">=</div>

              <div className="prod-quantity-box">
                <div className="prod-quantity-label">Cantidad producida</div>
                <div className="prod-quantity-input">
                  <button
                    className="prod-quantity-btn"
                    onClick={() => setOutputQty(String(Math.max(0, (parseInt(outputQty) || 0) - 1)))}
                  >
                    −
                  </button>
                  <span className="prod-quantity-value">{outputQty}</span>
                  <button
                    className="prod-quantity-btn"
                    onClick={() => setOutputQty(String((parseInt(outputQty) || 0) + 1))}
                  >
                    +
                  </button>
                </div>
                <div className="prod-quantity-unit">porciones</div>
              </div>

              <div className="prod-quantity-operator">−</div>

              <div className="prod-quantity-box">
                <div className="prod-quantity-label">Merma estimada</div>
                <div className="prod-quantity-input">
                  <button
                    className="prod-quantity-btn"
                    onClick={() => setWasteQty(String(Math.max(0, (parseFloat(wasteQty) || 0) - 0.1)).slice(0, 4))}
                  >
                    −
                  </button>
                  <span className="prod-quantity-value">{wasteQty}</span>
                  <button
                    className="prod-quantity-btn"
                    onClick={() => setWasteQty(String((parseFloat(wasteQty) || 0) + 0.1).slice(0, 4))}
                  >
                    +
                  </button>
                </div>
                <div className="prod-quantity-unit">kg</div>
                <div className="prod-waste-pct">{wastePct.toFixed(2)}%</div>
              </div>
            </div>

            {/* Cost Summary */}
            <div className="prod-cost-row">
              <div className="prod-cost-box">
                <div className="prod-cost-label">Costo total</div>
                <div className="prod-cost-value">${totalCost.toFixed(2)}</div>
                <div className="prod-cost-sub">Incluye merma y extras</div>
              </div>
              <div className="prod-cost-box">
                <div className="prod-cost-label">Costo por porción</div>
                <div className="prod-cost-value">${costPerPortion.toFixed(2)}</div>
                <div className="prod-cost-sub">Costo unitario final</div>
              </div>
            </div>

            {/* Operator Name */}
            <div className="prod-form-group" style={{ marginBottom: '1rem' }}>
              <label className="prod-form-label">Responsable / Operador</label>
              <input
                type="text"
                className="prod-form-input"
                placeholder="Nombre del empleado"
                value={operatorName}
                onChange={e => setOperatorName(e.target.value)}
              />
            </div>

            {/* Save Button */}
            <button
              className="prod-save-btn"
              onClick={handleSaveBatch}
              disabled={saving || !selectedRecipeId || outputQtyNum <= 0}
            >
              {saving ? (
                <>
                  <RefreshCw size={16} className="prod-spin" />
                  Guardando...
                </>
              ) : (
                'Guardar lote de producción'
              )}
            </button>
          </div>

          {/* Lotes Recientes Card */}
          <div className="prod-card">
            <div className="prod-card-header">
              <h2 className="prod-card-title">Lotes recientes</h2>
            </div>
            <div className="prod-table-wrapper">
              <table className="prod-table">
                <thead>
                  <tr>
                    <th>Lote</th>
                    <th>Producto</th>
                    <th>Fecha</th>
                    <th>Responsable</th>
                    <th>Rendimiento</th>
                    <th>Estado</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {recentBatches.length === 0 ? (
                    <tr>
                      <td colSpan={7}>
                        <div className="prod-empty-state">
                          <p>No hay lotes registrados</p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    recentBatches.map(batch => (
                      <tr key={batch.id}>
                        <td>
                          <span className="prod-batch-id">
                            L-{String(batch.batchNumber).padStart(4, '0')}
                          </span>
                        </td>
                        <td>{batch.productName}</td>
                        <td>{formatDate(batch.createdAt)}</td>
                        <td>{batch.operator}</td>
                        <td>{(100 - batch.wastePercentage).toFixed(1)}%</td>
                        <td>
                          <span className={`prod-status-badge ${batch.status === 'Completado' ? 'completed' : 'partial'}`}>
                            {batch.status}
                          </span>
                        </td>
                        <td>
                          <div className="prod-action-menu">
                            <button
                              className="prod-action-btn"
                              onClick={() => setSelectedBatchDetail(batch)}
                              title="Ver detalle"
                            >
                              <MoreVertical size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            {batches.length > 5 && (
              <div className="prod-table-footer">
                <button
                  className="prod-view-all-link"
                  onClick={() => setShowHistoryModal(true)}
                >
                  Ver todos los lotes →
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Right Sidebar */}
        <div className="prod-sidebar">
          {/* Producción por empleado */}
          <div className="prod-card">
            <div className="prod-employee-header">
              <h2 className="prod-card-title">Producción por empleado</h2>
              <button className="prod-period-toggle">
                Hoy <ChevronDown size={12} />
              </button>
            </div>

            <div className="prod-employee-stats">
              <div className="prod-emp-stat">
                <div className="prod-emp-stat-label">Total piezas elaboradas</div>
                <div className="prod-emp-stat-value">
                  {bonuses.reduce((sum, b) => sum + b.piecesCount, 0)}
                </div>
                <div className="prod-emp-stat-sub">piezas</div>
              </div>
              <div className="prod-emp-stat">
                <div className="prod-emp-stat-label">Bonos por producción</div>
                <div className="prod-emp-stat-value">
                  ${bonuses.reduce((sum, b) => sum + b.bonusAmount, 0).toFixed(2)}
                </div>
                <div className="prod-emp-stat-sub">total del día</div>
              </div>
            </div>

            <div className="prod-employee-list">
              {bonuses.length === 0 ? (
                <div className="prod-empty-state">
                  <p>Sin bonos registrados hoy</p>
                </div>
              ) : (
                bonuses.map((bonus, idx) => (
                  <div key={bonus.employeeId} className="prod-employee-item">
                    <div className={`prod-emp-avatar ${AVATAR_COLORS[idx % AVATAR_COLORS.length]}`}>
                      {bonus.initials}
                    </div>
                    <div className="prod-emp-info">
                      <div className="prod-emp-name">{bonus.employeeName}</div>
                      <div className="prod-emp-bar">
                        <div
                          className={`prod-emp-bar-fill ${AVATAR_COLORS[idx % AVATAR_COLORS.length]}`}
                          style={{ width: `${bonus.percentage}%` }}
                        />
                      </div>
                      <div className="prod-emp-pct">{bonus.percentage}%</div>
                    </div>
                    <div className="prod-emp-meta">
                      <div className="prod-emp-pieces">{bonus.piecesCount} pzs</div>
                      <div className="prod-emp-bonus">${bonus.bonusAmount.toFixed(2)}</div>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="prod-bonus-info">
              <Info size={14} className="prod-bonus-info-icon" />
              <span className="prod-bonus-info-text">
                Bonificación: ${BONUS_PER_PIECE} por pieza elaborada.
              </span>
            </div>
          </div>

          {/* Ejemplo de conversión */}
          <div className="prod-card">
            <div className="prod-card-header">
              <h2 className="prod-card-title">Ejemplo de conversión</h2>
            </div>

            <div className="prod-conversion-visual">
              <div className="prod-conversion-box">
                <div className="prod-conversion-emoji">🍗</div>
                <div className="prod-conversion-qty">{inputQty || 10} kg</div>
                <div className="prod-conversion-unit">de pollo</div>
              </div>
              <div className="prod-conversion-arrow">→</div>
              <div className="prod-conversion-box">
                <div className="prod-conversion-emoji">🍽️</div>
                <div className="prod-conversion-qty">{outputQty || 40} porciones</div>
                <div className="prod-conversion-unit">&nbsp;</div>
              </div>
            </div>

            <div className="prod-conversion-costs">
              <div className="prod-conversion-cost">
                <div className="prod-conversion-cost-label">Costo total</div>
                <div className="prod-conversion-cost-value">${totalCost.toFixed(2)}</div>
              </div>
              <div className="prod-conversion-cost">
                <div className="prod-conversion-cost-label">Costo por porción</div>
                <div className="prod-conversion-cost-value green">${costPerPortion.toFixed(2)}</div>
              </div>
            </div>

            <div className="prod-conversion-yield">
              Rendimiento: {conversionYield.toFixed(0)}% (considerando merma del {wastePct.toFixed(0)}%)
            </div>
          </div>
        </div>
      </div>

      {/* History Modal */}
      {showHistoryModal && (
        <div className="prod-modal-overlay" onClick={() => setShowHistoryModal(false)}>
          <div className="prod-modal-content" onClick={e => e.stopPropagation()}>
            <div className="prod-modal-header">
              <h2 className="prod-modal-title">Historial de producciones</h2>
              <button className="prod-modal-close" onClick={() => setShowHistoryModal(false)}>✕</button>
            </div>
            <div className="prod-modal-body">
              <div className="prod-history-filters">
                <button className="prod-history-filter active">Todos</button>
                <button className="prod-history-filter">Completados</button>
                <button className="prod-history-filter">Parciales</button>
              </div>
              <div className="prod-table-wrapper">
                <table className="prod-table">
                  <thead>
                    <tr>
                      <th>Lote</th>
                      <th>Producto</th>
                      <th>Fecha</th>
                      <th>Responsable</th>
                      <th>Porciones</th>
                      <th>Merma</th>
                      <th>Costo/porción</th>
                      <th>Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {batches.map(batch => (
                      <tr key={batch.id}>
                        <td><span className="prod-batch-id">L-{String(batch.batchNumber).padStart(4, '0')}</span></td>
                        <td>{batch.productName}</td>
                        <td>{formatDate(batch.createdAt)}</td>
                        <td>{batch.operator}</td>
                        <td>{batch.quantityProduced} {batch.unitProduced}</td>
                        <td>{batch.wasteQuantity} kg</td>
                        <td>${batch.costPerPortion.toFixed(2)}</td>
                        <td>
                          <span className={`prod-status-badge ${batch.status === 'Completado' ? 'completed' : 'partial'}`}>
                            {batch.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {batches.length > 10 && (
                <div className="prod-pagination">
                  <button className="prod-page-btn" disabled={historyPage === 1} onClick={() => setHistoryPage(p => p - 1)}>
                    <ChevronLeft size={14} />
                  </button>
                  <button className="prod-page-btn active">{historyPage}</button>
                  <button className="prod-page-btn" disabled onClick={() => setHistoryPage(p => p + 1)}>
                    <ChevronRight size={14} />
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Batch Detail Modal */}
      {selectedBatchDetail && (
        <div className="prod-modal-overlay" onClick={() => setSelectedBatchDetail(null)}>
          <div className="prod-modal-content" style={{ maxWidth: 600 }} onClick={e => e.stopPropagation()}>
            <div className="prod-modal-header">
              <h2 className="prod-modal-title">
                Lote L-{String(selectedBatchDetail.batchNumber).padStart(4, '0')} — {selectedBatchDetail.productName}
              </h2>
              <button className="prod-modal-close" onClick={() => setSelectedBatchDetail(null)}>✕</button>
            </div>
            <div className="prod-modal-body">
              <div className="prod-detail-section">
                <div className="prod-detail-title">Información del lote</div>
                <div className="prod-detail-grid">
                  <div className="prod-detail-item">
                    <div className="prod-detail-item-label">Fecha</div>
                    <div className="prod-detail-item-value">{formatDate(selectedBatchDetail.createdAt)}</div>
                  </div>
                  <div className="prod-detail-item">
                    <div className="prod-detail-item-label">Responsable</div>
                    <div className="prod-detail-item-value">{selectedBatchDetail.operator}</div>
                  </div>
                  <div className="prod-detail-item">
                    <div className="prod-detail-item-label">Estado</div>
                    <div className="prod-detail-item-value">
                      <span className={`prod-status-badge ${selectedBatchDetail.status === 'Completado' ? 'completed' : 'partial'}`}>
                        {selectedBatchDetail.status}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="prod-detail-section">
                <div className="prod-detail-title">Producción</div>
                <div className="prod-detail-grid">
                  <div className="prod-detail-item">
                    <div className="prod-detail-item-label">Cantidad producida</div>
                    <div className="prod-detail-item-value">{selectedBatchDetail.quantityProduced} {selectedBatchDetail.unitProduced}</div>
                  </div>
                  <div className="prod-detail-item">
                    <div className="prod-detail-item-label">Merma</div>
                    <div className="prod-detail-item-value">{selectedBatchDetail.wasteQuantity} kg ({selectedBatchDetail.wastePercentage}%)</div>
                  </div>
                  <div className="prod-detail-item">
                    <div className="prod-detail-item-label">Rendimiento</div>
                    <div className="prod-detail-item-value">{(100 - selectedBatchDetail.wastePercentage).toFixed(1)}%</div>
                  </div>
                </div>
              </div>

              <div className="prod-detail-section">
                <div className="prod-detail-title">Costos</div>
                <div className="prod-detail-grid">
                  <div className="prod-detail-item">
                    <div className="prod-detail-item-label">Costo total</div>
                    <div className="prod-detail-item-value">${selectedBatchDetail.totalCost.toFixed(2)}</div>
                  </div>
                  <div className="prod-detail-item">
                    <div className="prod-detail-item-label">Costo por porción</div>
                    <div className="prod-detail-item-value">${selectedBatchDetail.costPerPortion.toFixed(2)}</div>
                  </div>
                </div>
              </div>

              {selectedBatchDetail.items.length > 0 && (
                <div className="prod-detail-section">
                  <div className="prod-detail-title">Ingredientes</div>
                  <table className="prod-ingredients-table">
                    <thead>
                      <tr>
                        <th>Ingrediente</th>
                        <th>Cantidad</th>
                        <th>Costo</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedBatchDetail.items.map(item => (
                        <tr key={item.id}>
                          <td>{item.ingredientName}</td>
                          <td>{item.quantityUsed} {item.unitSymbol}</td>
                          <td>${(item.costPerUnit * item.quantityUsed).toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
            <div className="prod-modal-footer">
              <button className="prod-btn prod-btn-outline" onClick={() => setSelectedBatchDetail(null)}>
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr)
  return date.toLocaleDateString('es-VE', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
}
