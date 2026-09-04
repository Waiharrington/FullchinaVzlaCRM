import { useEffect, useState, useCallback, useMemo } from 'react'
import { createPortal } from 'react-dom'
import {
  getProductionBatches, getProductionStats,
  createProductionBatch, getIngredients, getWarehouseIngredients,
  getPortionRecipes, getUnits, getAllEmployees,
  type ProductionBatch, type ProductionStats, type Ingredient,
  type WarehouseIngredient, type PortionRecipe, type Employee,
} from '../lib/dataService'
import { useAuth } from '../context/auth-context'
import { SearchSelect } from '../components/SearchSelect'
import { PageSkeleton } from '../components/PageSkeleton'
import { StyledSelect } from '../components/StyledSelect'
import Toast from '../components/Toast'
import { EmptyState } from '../components/EmptyState'
import { formatUsd } from '../lib/money'
import { normalizeForSearch } from '../lib/textFormat'
import {
  Flame, Plus, CheckCircle2, AlertTriangle, Loader2, Package, DollarSign,
  Search, Building2, Truck, Scale, Sparkles, User, X, Info,
} from 'lucide-react'
import './ProduccionReal.css'

type ProteinType = 'pollo' | 'cerdo' | 'camaron' | 'jamon' | 'otro'
type PeriodFilter = 'today' | '7d' | '30d' | 'all'

export function ProduccionReal() {
  const { user } = useAuth()
  const [stats, setStats] = useState<ProductionStats | null>(null)
  const [batches, setBatches] = useState<ProductionBatch[]>([])
  const [warehouseIngredients, setWarehouseIngredients] = useState<WarehouseIngredient[]>([])
  const [operationalIngredients, setOperationalIngredients] = useState<Ingredient[]>([])
  const [portionRecipes, setPortionRecipes] = useState<PortionRecipe[]>([])
  const [units, setUnits] = useState<Array<{ id: string; name: string; symbol: string }>>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  // Filters & search
  const [searchTerm, setSearchTerm] = useState('')
  const [periodFilter, setPeriodFilter] = useState<PeriodFilter>('all')
  const [selectedBatch, setSelectedBatch] = useState<ProductionBatch | null>(null)
  const [closingBatchDetail, setClosingBatchDetail] = useState(false)

  // Guided New Batch Modal State
  const [showModal, setShowModal] = useState(false)
  const [closingBatchForm, setClosingBatchForm] = useState(false)
  const [proteinType, setProteinType] = useState<ProteinType>('pollo')
  const [selectedPortionRecipeId, setSelectedPortionRecipeId] = useState('')
  const [batchName, setBatchName] = useState('Porcionamiento de Pollo para Arroz')
  const [originLocation, setOriginLocation] = useState<'warehouse' | 'operational'>('warehouse')
  const [rawIngredientId, setRawIngredientId] = useState('')
  const [rawQuantityUsed, setRawQuantityUsed] = useState('10')
  const [rawUnitId, setRawUnitId] = useState('')
  const [portionGrams, setPortionGrams] = useState('125') // grams per portion
  const [wasteQuantity, setWasteQuantity] = useState('1.5')
  const [quantityProduced, setQuantityProduced] = useState('68')
  const [operatorId, setOperatorId] = useState('')
  const [batchNotes, setBatchNotes] = useState('')
  const [saving, setSaving] = useState(false)

  const closeBatchForm = () => {
    if (!showModal || closingBatchForm || saving) return
    setClosingBatchForm(true)
    window.setTimeout(() => {
      setShowModal(false)
      setClosingBatchForm(false)
    }, 200)
  }

  const closeBatchDetail = () => {
    if (!selectedBatch || closingBatchDetail) return
    setClosingBatchDetail(true)
    window.setTimeout(() => {
      setSelectedBatch(null)
      setClosingBatchDetail(false)
    }, 200)
  }

  const loadData = useCallback(async () => {
    try {
      setLoading(true)
      setError('')
      const [s, b, whIng, opIng, portions, un, emps] = await Promise.all([
        getProductionStats(),
        getProductionBatches(),
        getWarehouseIngredients().catch(() => []),
        getIngredients().catch(() => []),
        getPortionRecipes().catch(() => []),
        getUnits(),
        getAllEmployees().catch(() => []),
      ])
      setStats(s)
      setBatches(b)
      setWarehouseIngredients(whIng)
      setOperationalIngredients(opIng)
      setPortionRecipes(portions)
      setUnits(un)
      setEmployees(emps)

      // Set initial defaults if available
      if (whIng.length > 0) {
        const defaultRaw = whIng.find(i => normalizeForSearch(i.name).includes('pollo')) || whIng[0]
        setRawIngredientId(prev => prev || defaultRaw.id)
        setRawUnitId(prev => prev || defaultRaw.unitId)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error cargando datos de producción')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void loadData() }, [loadData])

  // Map of raw ingredients by ID
  const rawIngredientsList = useMemo(() => {
    return originLocation === 'warehouse' ? warehouseIngredients : operationalIngredients
  }, [originLocation, warehouseIngredients, operationalIngredients])

  // Current raw ingredient object & available stock
  const selectedRawIngredient = useMemo(() => {
    return rawIngredientsList.find(i => i.id === rawIngredientId)
  }, [rawIngredientsList, rawIngredientId])

  const availableStock = selectedRawIngredient?.currentStock ?? 0

  // Quick Preset switcher
  const handleSelectProtein = (type: ProteinType) => {
    setProteinType(type)
    setSelectedPortionRecipeId('')

    let searchKeyword = 'pollo'
    let defaultBatch = 'Porcionamiento de Pollo para Arroz'
    let defaultGrams = '125'

    if (type === 'cerdo') {
      searchKeyword = 'cerdo'
      defaultBatch = 'Porcionamiento de Cerdo / Chuleta'
      defaultGrams = '125'
    } else if (type === 'camaron') {
      searchKeyword = 'camaron'
      defaultBatch = 'Limpieza y Porcionamiento de Camarón'
      defaultGrams = '100'
    } else if (type === 'jamon') {
      searchKeyword = 'jamon'
      defaultBatch = 'Picado de Jamón en Cubos'
      defaultGrams = '100'
    } else if (type === 'otro') {
      defaultBatch = 'Lote de Producción'
      defaultGrams = '100'
    }

    setBatchName(defaultBatch)
    setPortionGrams(defaultGrams)

    // Auto-match ingredient in list
    if (type !== 'otro') {
      const match = rawIngredientsList.find(i =>
        normalizeForSearch(i.name).includes(searchKeyword)
      )
      if (match) {
        setRawIngredientId(match.id)
        setRawUnitId(match.unitId)
      }
    }

    // Auto-match portion recipe if one exists
    const portionMatch = portionRecipes.find(p =>
      normalizeForSearch(p.name).includes(searchKeyword)
    )
    if (portionMatch) {
      setSelectedPortionRecipeId(portionMatch.id)
      const grams = portionMatch.unitSymbol.toLowerCase() === 'kg'
        ? String(portionMatch.quantity * 1000)
        : String(portionMatch.quantity)
      setPortionGrams(grams)
    }
  }

  // Handle portion recipe select change
  const handlePortionRecipeChange = (recipeId: string) => {
    setSelectedPortionRecipeId(recipeId)
    const rec = portionRecipes.find(r => r.id === recipeId)
    if (rec) {
      setBatchName(`Porcionamiento: ${rec.name}`)
      const grams = rec.unitSymbol.toLowerCase() === 'kg'
        ? String(rec.quantity * 1000)
        : String(rec.quantity)
      setPortionGrams(grams)
      if (rec.ingredientId) {
        const found = rawIngredientsList.find(i => i.id === rec.ingredientId)
        if (found) {
          setRawIngredientId(found.id)
          setRawUnitId(found.unitId)
        }
      }
    }
  }

  // Real-time calculations
  const rawQty = parseFloat(rawQuantityUsed) || 0
  const wasteQty = parseFloat(wasteQuantity) || 0
  const netQty = Math.max(0, rawQty - wasteQty)
  const portionG = parseFloat(portionGrams) || 125
  const portionKg = portionG > 1 ? portionG / 1000 : portionG

  // Theoretical vs suggested real portions
  const theoreticalPortions = portionKg > 0 && rawQty > 0 ? Math.floor(rawQty / portionKg) : 0
  const suggestedPortions = portionKg > 0 && netQty > 0 ? Math.floor(netQty / portionKg) : 0

  const yieldPct = rawQty > 0 ? Math.min(100, Math.max(0, ((rawQty - wasteQty) / rawQty) * 100)) : 100
  const wastePct = rawQty > 0 ? Math.min(100, Math.max(0, (wasteQty / rawQty) * 100)) : 0

  // Auto-sync produced quantity when raw quantity or waste changes if user hasn't explicitly entered a wildly custom count
  const handleWasteChange = (val: string) => {
    setWasteQuantity(val)
    const w = parseFloat(val) || 0
    const net = Math.max(0, rawQty - w)
    if (portionKg > 0) {
      setQuantityProduced(String(Math.floor(net / portionKg)))
    }
  }

  const handleRawQtyChange = (val: string) => {
    setRawQuantityUsed(val)
    const r = parseFloat(val) || 0
    const net = Math.max(0, r - wasteQty)
    if (portionKg > 0) {
      setQuantityProduced(String(Math.floor(net / portionKg)))
    }
  }

  const handleOpenNewBatch = () => {
    setError('')
    setShowModal(true)
    handleSelectProtein('pollo')
    setRawQuantityUsed('10')
    setWasteQuantity('1.5')
    setQuantityProduced('68')
    setBatchNotes('')
  }

  const handleSubmitBatch = async (e: React.FormEvent) => {
    e.preventDefault()
    const prodQty = parseFloat(quantityProduced) || 0
    const rawVal = parseFloat(rawQuantityUsed) || 0

    if (!batchName.trim() || prodQty <= 0 || rawVal <= 0 || !rawIngredientId) {
      setError('Por favor completa los kilos utilizados y las porciones producidas.')
      return
    }

    try {
      setSaving(true)
      setError('')

      const unitPortion = units.find(u =>
        normalizeForSearch(u.name).includes('porci') ||
        normalizeForSearch(u.symbol).includes('porc') ||
        normalizeForSearch(u.symbol).includes('und')
      ) || units[0]

      const unitProducedId = unitPortion ? unitPortion.id : (rawUnitId || units[0]?.id || '')

      const operatorObj = employees.find(e => e.id === operatorId)
      const opName = operatorObj ? operatorObj.fullName : (user?.email ? user.email.split('@')[0] : 'Operador')

      const fullNotes = [
        batchNotes.trim(),
        `Origen: ${originLocation === 'warehouse' ? 'Almacén' : 'Food Truck'}`,
        `Operador: ${opName}`,
        portionGrams ? `Ración base: ${portionGrams}g` : null,
      ].filter(Boolean).join(' | ')

      await createProductionBatch({
        name: batchName.trim(),
        quantityProduced: prodQty,
        unitId: unitProducedId,
        wasteQuantity: parseFloat(wasteQuantity) || 0,
        notes: fullNotes,
        items: [{
          ingredientId: rawIngredientId,
          quantityUsed: rawVal,
          unitId: rawUnitId || units[0]?.id || '',
        }],
        createdBy: user?.id ?? '',
      })

      setNotice(`✅ Lote "${batchName}" registrado con éxito (${prodQty} porciones).`)
      setClosingBatchForm(true)
      window.setTimeout(() => {
        setShowModal(false)
        setClosingBatchForm(false)
      }, 200)
      await loadData()
      setTimeout(() => setNotice(''), 4000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al registrar el lote de producción')
    } finally {
      setSaving(false)
    }
  }

  // Filtered Batches List
  const displayedBatches = useMemo(() => {
    let list = [...batches]

    // Period filter
    const now = new Date()
    if (periodFilter === 'today') {
      const todayKey = now.toISOString().slice(0, 10)
      list = list.filter(b => b.productionDate.slice(0, 10) === todayKey)
    } else if (periodFilter === '7d') {
      const past = new Date(now.getTime() - 7 * 86400000).toISOString().slice(0, 10)
      list = list.filter(b => b.productionDate >= past)
    } else if (periodFilter === '30d') {
      const past = new Date(now.getTime() - 30 * 86400000).toISOString().slice(0, 10)
      list = list.filter(b => b.productionDate >= past)
    }

    // Search query
    if (searchTerm.trim()) {
      const q = normalizeForSearch(searchTerm)
      list = list.filter(b =>
        normalizeForSearch(b.name).includes(q) ||
        normalizeForSearch(b.operator).includes(q) ||
        b.items.some(item => normalizeForSearch(item.ingredientName).includes(q))
      )
    }

    return list
  }, [batches, periodFilter, searchTerm])

  if (loading) {
    return <PageSkeleton cards={4} rows={6} />
  }

  return (
    <div className="page animate-fade-in prod-page management-workspace management-workspace--production">
      <header className="prod-header management-workspace-header">
        <div className="prod-header-title-wrap">
          <div>
            <h1 className="page-title"><Flame size={22} className="page-title-icon" /> Producción y Porcionamiento</h1>
            <p>Transformación de proteínas crudas, porcionamiento, merma y rendimiento de cocina</p>
          </div>
        </div>
        <button
          type="button"
          className="prod-new-batch-btn"
          onClick={handleOpenNewBatch}
        >
          <Plus size={17} /> Registrar Nuevo Lote
        </button>
      </header>

      {error && <Toast type="error" message={error} onClose={() => setError('')} />}
      {notice && <Toast type="success" message={notice} onClose={() => setNotice('')} />}

      {/* KPI Stats Cards */}
      <div className="prod-stats-grid management-workspace-metrics">
        <div className="prod-stat-card red">
          <div className="prod-stat-icon"><Package size={18} /></div>
          <div className="prod-stat-info">
            <span className="prod-stat-val">{stats?.batchesToday ?? 0}</span>
            <span className="prod-stat-lbl">Lotes producidos hoy</span>
          </div>
        </div>

        <div className="prod-stat-card green">
          <div className="prod-stat-icon"><CheckCircle2 size={18} /></div>
          <div className="prod-stat-info">
            <span className="prod-stat-val">{(stats?.avgYield ?? 0).toFixed(1)}%</span>
            <span className="prod-stat-lbl">Rendimiento promedio</span>
          </div>
        </div>

        <div className="prod-stat-card orange">
          <div className="prod-stat-icon"><AlertTriangle size={18} /></div>
          <div className="prod-stat-info">
            <span className="prod-stat-val">{(stats?.totalWaste ?? 0).toFixed(2)} kg</span>
            <span className="prod-stat-lbl">Merma acumulada hoy</span>
          </div>
        </div>

        <div className="prod-stat-card blue">
          <div className="prod-stat-icon"><DollarSign size={18} /></div>
          <div className="prod-stat-info">
            <span className="prod-stat-val">{formatUsd(stats?.avgCostPerPortion ?? 0)}</span>
            <span className="prod-stat-lbl">Costo prom. por porción</span>
          </div>
        </div>
      </div>

      {/* Main Panel with Batches List */}
      <div className="prod-panel management-workspace-panel">
        <div className="prod-toolbar">
          <div className="prod-search-wrap">
            <Search size={16} />
            <input
              type="text"
              placeholder="Buscar por lote, proteína u operador..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <div className="prod-date-filter">
            <button
              type="button"
              className={periodFilter === 'all' ? 'active' : ''}
              onClick={() => setPeriodFilter('all')}
            >
              Todos
            </button>
            <button
              type="button"
              className={periodFilter === 'today' ? 'active' : ''}
              onClick={() => setPeriodFilter('today')}
            >
              Hoy
            </button>
            <button
              type="button"
              className={periodFilter === '7d' ? 'active' : ''}
              onClick={() => setPeriodFilter('7d')}
            >
              7 días
            </button>
            <button
              type="button"
              className={periodFilter === '30d' ? 'active' : ''}
              onClick={() => setPeriodFilter('30d')}
            >
              Este mes
            </button>
          </div>
        </div>

        {displayedBatches.length === 0 ? (
          <EmptyState
            title="No se encontraron lotes de producción"
            description="Registra la transformación de pollo, cerdo, camarón o jamón para descontar stock y generar porciones listas para los platos."
            actionLabel="Registrar Nuevo Lote"
            onAction={handleOpenNewBatch}
          />
        ) : (
          <div className="prod-table-wrap">
            <table className="prod-table">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Lote / Preparación</th>
                  <th>Materia Prima Usada</th>
                  <th>Porciones Obtenidas</th>
                  <th>Merma</th>
                  <th>Rendimiento</th>
                  <th>Costo Estimado</th>
                  <th>Acción</th>
                </tr>
              </thead>
              <tbody>
                {displayedBatches.map((b) => {
                  const yieldVal = Math.max(0, 100 - b.wastePercentage)
                  const isWarehouse = b.notes?.toLowerCase().includes('almacén') || b.notes?.toLowerCase().includes('almacen')
                  return (
                    <tr key={b.id}>
                      <td style={{ whiteSpace: 'nowrap' }}>
                        {b.productionDate}
                      </td>
                      <td>
                        <div className="prod-batch-name-cell">
                          <strong>{b.name}</strong>
                          <span>{b.operator || 'Operador'}</span>
                        </div>
                      </td>
                      <td>
                        {b.items.length > 0 ? (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                            <span>{b.items[0].quantityUsed} {b.items[0].unitSymbol} de {b.items[0].ingredientName}</span>
                            <span className={`prod-badge ${isWarehouse ? 'origin-warehouse' : 'origin-truck'}`}>
                              {isWarehouse ? <Building2 size={11} /> : <Truck size={11} />}
                              {isWarehouse ? 'Almacén' : 'Food Truck'}
                            </span>
                          </div>
                        ) : (
                          <span>--</span>
                        )}
                      </td>
                      <td>
                        <strong style={{ color: '#fff', fontSize: '0.9rem' }}>
                          {b.quantityProduced}
                        </strong>
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.74rem', marginLeft: '4px' }}>
                          {b.unitProduced || 'porciones'}
                        </span>
                      </td>
                      <td>
                        <span style={{ color: b.wasteQuantity > 0 ? '#fde047' : 'var(--text-muted)' }}>
                          {b.wasteQuantity.toFixed(2)} kg ({b.wastePercentage.toFixed(1)}%)
                        </span>
                      </td>
                      <td>
                        <span className={`prod-badge ${yieldVal >= 80 ? 'yield-high' : yieldVal >= 65 ? 'yield-med' : 'yield-low'}`}>
                          {yieldVal.toFixed(1)}%
                        </span>
                      </td>
                      <td>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                          <strong style={{ color: '#facc15' }}>{formatUsd(b.totalCost)}</strong>
                          {b.quantityProduced > 0 && (
                            <small style={{ color: 'var(--text-muted)', fontSize: '0.7rem' }}>
                              {formatUsd(b.costPerPortion)}/porc
                            </small>
                          )}
                        </div>
                      </td>
                      <td>
                        <button
                          type="button"
                          className="prod-view-detail-btn"
                          onClick={() => setSelectedBatch(b)}
                        >
                          Detalle
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ============================================================
          Modal Guiado de Registro de Lote
          ============================================================ */}
      {showModal && createPortal(
        <div className={`prod-modal-overlay ${closingBatchForm ? 'closing' : ''}`} onClick={closeBatchForm}>
          <form className="prod-modal" onClick={(e) => e.stopPropagation()} onSubmit={handleSubmitBatch}>
            <div className="prod-modal-header">
              <div className="prod-modal-header-icon">
                <Flame size={22} />
              </div>
              <div className="prod-modal-header-text">
                <h3>Nuevo Lote de Producción</h3>
                <p>Calcula porciones teóricas, merma y registra el porcionamiento real de proteínas.</p>
              </div>
            </div>

            {/* Paso 1: Atajos de Proteína */}
            <div className="prod-protein-chips-wrap">
              <span className="prod-section-label">1. ¿Qué proteína vas a procesar?</span>
              <div className="prod-protein-chips">
                <button
                  type="button"
                  className={`prod-protein-chip ${proteinType === 'pollo' ? 'active' : ''}`}
                  onClick={() => handleSelectProtein('pollo')}
                >
                  <span className="prod-protein-chip-emoji">🍗</span>
                  <span>Pollo</span>
                </button>
                <button
                  type="button"
                  className={`prod-protein-chip ${proteinType === 'cerdo' ? 'active' : ''}`}
                  onClick={() => handleSelectProtein('cerdo')}
                >
                  <span className="prod-protein-chip-emoji">🥩</span>
                  <span>Cerdo</span>
                </button>
                <button
                  type="button"
                  className={`prod-protein-chip ${proteinType === 'camaron' ? 'active' : ''}`}
                  onClick={() => handleSelectProtein('camaron')}
                >
                  <span className="prod-protein-chip-emoji">🍤</span>
                  <span>Camarón</span>
                </button>
                <button
                  type="button"
                  className={`prod-protein-chip ${proteinType === 'jamon' ? 'active' : ''}`}
                  onClick={() => handleSelectProtein('jamon')}
                >
                  <span className="prod-protein-chip-emoji">🍖</span>
                  <span>Jamón</span>
                </button>
                <button
                  type="button"
                  className={`prod-protein-chip ${proteinType === 'otro' ? 'active' : ''}`}
                  onClick={() => handleSelectProtein('otro')}
                >
                  <span className="prod-protein-chip-emoji">✨</span>
                  <span>Otro</span>
                </button>
              </div>
            </div>

            {/* Receta de Porción vinculada (opcional) */}
            {portionRecipes.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <span className="prod-section-label" style={{ fontSize: '0.72rem' }}>O vincular a Receta de Porción existente:</span>
                <StyledSelect
                  value={selectedPortionRecipeId}
                  onChange={(e) => handlePortionRecipeChange(e.target.value)}
                >
                  <option value="">-- Sin vincular (usar configuración manual) --</option>
                  {portionRecipes.map(pr => (
                    <option key={pr.id} value={pr.id}>
                      {pr.name} ({pr.quantity} {pr.unitSymbol})
                    </option>
                  ))}
                </StyledSelect>
              </div>
            )}

            {/* Nombre del Lote */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <span className="prod-section-label">Nombre del Lote / Preparación</span>
              <input
                type="text"
                value={batchName}
                onChange={(e) => setBatchName(e.target.value)}
                placeholder="Ej. Porcionamiento de Pollo para Arroz"
                style={{
                  padding: '10px 12px',
                  background: '#121214',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '10px',
                  color: '#fff',
                  font: 'inherit',
                  fontSize: '0.86rem',
                }}
                required
              />
            </div>

            {/* Paso 2: Origen y Materia Prima */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <span className="prod-section-label">2. Origen de la materia prima</span>
              <div className="prod-location-group">
                <button
                  type="button"
                  className={`prod-location-btn warehouse ${originLocation === 'warehouse' ? 'active' : ''}`}
                  onClick={() => setOriginLocation('warehouse')}
                >
                  <Building2 size={16} /> Almacén General
                </button>
                <button
                  type="button"
                  className={`prod-location-btn truck ${originLocation === 'operational' ? 'active' : ''}`}
                  onClick={() => setOriginLocation('operational')}
                >
                  <Truck size={16} /> Food Truck (Cocina)
                </button>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: '10px', marginTop: '6px' }}>
                <div>
                  <label style={{ color: 'var(--text-muted)', fontSize: '0.72rem', fontWeight: 700, display: 'block', marginBottom: '4px' }}>
                    Insumo crudo
                  </label>
                  <SearchSelect
                    options={rawIngredientsList.map(i => ({
                      value: i.id,
                      label: `${i.name} (${i.currentStock} ${i.unitSymbol})`,
                    }))}
                    value={rawIngredientId}
                    onChange={(id) => {
                      setRawIngredientId(id)
                      const found = rawIngredientsList.find(x => x.id === id)
                      if (found) setRawUnitId(found.unitId)
                    }}
                    placeholder="Buscar insumo crudo..."
                    emptyText="Sin insumos disponibles"
                  />
                </div>

                <div>
                  <label style={{ color: 'var(--text-muted)', fontSize: '0.72rem', fontWeight: 700, display: 'block', marginBottom: '4px' }}>
                    Kilos / Cantidad bruta usada
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={rawQuantityUsed}
                    onChange={(e) => handleRawQtyChange(e.target.value)}
                    placeholder="10.00"
                    style={{
                      width: '100%',
                      boxSizing: 'border-box',
                      padding: '10px 12px',
                      background: '#121214',
                      border: '1px solid rgba(255,255,255,0.1)',
                      borderRadius: '10px',
                      color: '#facc15',
                      font: 'inherit',
                      fontWeight: 750,
                      fontSize: '0.9rem',
                    }}
                    required
                  />
                </div>
              </div>

              <div className={`prod-stock-available-badge ${availableStock < rawQty ? 'low' : ''}`}>
                <Info size={13} />
                <span>
                  Disponible en {originLocation === 'warehouse' ? 'Almacén' : 'Food Truck'}: <strong>{availableStock.toFixed(2)} {selectedRawIngredient?.unitSymbol || 'kg'}</strong>
                </span>
                {availableStock < rawQty && (
                  <span style={{ color: '#f87171', marginLeft: '6px' }}>(¡Atención: Stock insuficiente!)</span>
                )}
              </div>
            </div>

            {/* Paso 3: Calculadora de Porcionamiento y Merma */}
            <div className="prod-calc-card">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span className="prod-section-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Scale size={15} /> 3. Porcionamiento, Merma y Rendimiento
                </span>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.72rem' }}>
                  Teórico: <strong>{theoreticalPortions} porciones</strong>
                </span>
              </div>

              <div className="prod-calc-grid">
                <div className="prod-calc-item">
                  <label>Gramos por porción</label>
                  <input
                    type="number"
                    step="1"
                    min="1"
                    value={portionGrams}
                    onChange={(e) => {
                      setPortionGrams(e.target.value)
                      const g = parseFloat(e.target.value) || 125
                      const kg = g > 1 ? g / 1000 : g
                      if (kg > 0) {
                        setQuantityProduced(String(Math.floor(netQty / kg)))
                      }
                    }}
                    placeholder="125"
                  />
                </div>

                <div className="prod-calc-item">
                  <label>Merma (kg desperdicio)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={wasteQuantity}
                    onChange={(e) => handleWasteChange(e.target.value)}
                    placeholder="1.50"
                  />
                </div>

                <div className="prod-calc-item">
                  <label style={{ color: '#4ade80' }}>Porciones reales producidas *</label>
                  <input
                    type="number"
                    step="1"
                    min="1"
                    value={quantityProduced}
                    onChange={(e) => setQuantityProduced(e.target.value)}
                    placeholder={String(suggestedPortions)}
                    style={{ borderColor: 'rgba(74, 222, 128, 0.4)', color: '#4ade80' }}
                    required
                  />
                </div>
              </div>

              {/* Indicador de Rendimiento Visual */}
              <div className="prod-yield-visual-wrap">
                <div className="prod-yield-bar-wrap">
                  <div className="prod-yield-bar-fill" style={{ width: `${yieldPct}%` }} />
                </div>
                <div className="prod-yield-bar-labels">
                  <span className="yield-text">Rendimiento: {yieldPct.toFixed(1)}% ({netQty.toFixed(2)} kg netos)</span>
                  <span className="waste-text">Merma: {wastePct.toFixed(1)}% ({wasteQty.toFixed(2)} kg)</span>
                </div>
              </div>
            </div>

            {/* Paso 4: Operador y Notas */}
            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '10px' }}>
              <div>
                <label style={{ color: 'var(--text-muted)', fontSize: '0.72rem', fontWeight: 700, display: 'block', marginBottom: '4px' }}>
                  <User size={12} style={{ verticalAlign: 'middle', marginRight: '4px' }} />
                  Cocinero / Responsable
                </label>
                <StyledSelect
                  value={operatorId}
                  onChange={(e) => setOperatorId(e.target.value)}
                >
                  <option value="">{user?.email ? user.email.split('@')[0] : 'Usuario actual'}</option>
                  {employees.map(emp => (
                    <option key={emp.id} value={emp.id}>{emp.fullName}</option>
                  ))}
                </StyledSelect>
              </div>

              <div>
                <label style={{ color: 'var(--text-muted)', fontSize: '0.72rem', fontWeight: 700, display: 'block', marginBottom: '4px' }}>
                  Nota u observación
                </label>
                <input
                  type="text"
                  value={batchNotes}
                  onChange={(e) => setBatchNotes(e.target.value)}
                  placeholder="Ej. Pechuga limpia para turno tarde"
                  style={{
                    width: '100%',
                    boxSizing: 'border-box',
                    padding: '9px 12px',
                    background: '#121214',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '10px',
                    color: '#fff',
                    font: 'inherit',
                    fontSize: '0.82rem',
                  }}
                />
              </div>
            </div>

            {/* Modal Actions */}
            <div className="prod-modal-actions">
              <button
                type="button"
                className="prod-modal-cancel"
                disabled={saving}
                onClick={closeBatchForm}
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="prod-modal-submit"
                disabled={saving || !rawIngredientId || (parseFloat(quantityProduced) || 0) <= 0}
              >
                {saving ? (
                  <><Loader2 size={16} className="animate-spin" /> Guardando lote...</>
                ) : (
                  <><Sparkles size={16} /> Confirmar ({quantityProduced || '0'} porciones)</>
                )}
              </button>
            </div>
          </form>
        </div>,
        document.body
      )}

      {/* ============================================================
          Modal de Detalle e Inspección de Lote
          ============================================================ */}
      {selectedBatch && createPortal(
        <div className={`prod-modal-overlay ${closingBatchDetail ? 'closing' : ''}`} onClick={closeBatchDetail}>
          <div className="prod-modal" onClick={(e) => e.stopPropagation()}>
            <div className="prod-modal-header">
              <div className="prod-modal-header-icon">
                <Flame size={22} />
              </div>
              <div className="prod-modal-header-text" style={{ flex: 1 }}>
                <h3>{selectedBatch.name}</h3>
                <p>Registrado el {selectedBatch.productionDate} por {selectedBatch.operator}</p>
              </div>
              <button
                type="button"
                className="prod-modal-cancel"
                style={{ padding: '6px 10px', minHeight: 'unset' }}
                onClick={closeBatchDetail}
              >
                <X size={16} />
              </button>
            </div>

            <div className="prod-detail-grid">
              <div className="prod-detail-item">
                <small>Porciones Producidas</small>
                <strong style={{ color: '#4ade80' }}>
                  {selectedBatch.quantityProduced} {selectedBatch.unitProduced || 'porciones'}
                </strong>
              </div>

              <div className="prod-detail-item">
                <small>Rendimiento del Lote</small>
                <strong style={{ color: selectedBatch.wastePercentage <= 20 ? '#4ade80' : '#ff4d5f' }}>
                  {(100 - selectedBatch.wastePercentage).toFixed(1)}%
                </strong>
              </div>

              <div className="prod-detail-item">
                <small>Merma Registrada</small>
                <strong style={{ color: '#f87171' }}>
                  {selectedBatch.wasteQuantity.toFixed(2)} kg ({selectedBatch.wastePercentage.toFixed(1)}%)
                </strong>
              </div>

              <div className="prod-detail-item">
                <small>Costo Total del Lote</small>
                <strong style={{ color: '#facc15' }}>
                  {formatUsd(selectedBatch.totalCost)}
                  {selectedBatch.quantityProduced > 0 && (
                    <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginLeft: '6px' }}>
                      ({formatUsd(selectedBatch.costPerPortion)}/porc)
                    </span>
                  )}
                </strong>
              </div>
            </div>

            {/* Insumos consumidos */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <span className="prod-section-label">Insumos Descontados</span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {selectedBatch.items.map(it => (
                  <div
                    key={it.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '8px 12px',
                      background: 'rgba(255,255,255,0.03)',
                      border: '1px solid rgba(255,255,255,0.06)',
                      borderRadius: '8px',
                      fontSize: '0.82rem',
                    }}
                  >
                    <span><strong>{it.ingredientName}</strong></span>
                    <span style={{ color: '#facc15', fontWeight: 700 }}>
                      {it.quantityUsed} {it.unitSymbol}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {selectedBatch.notes && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <span className="prod-section-label">Notas</span>
                <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-secondary)', background: 'rgba(0,0,0,0.3)', padding: '8px 12px', borderRadius: '8px' }}>
                  {selectedBatch.notes}
                </p>
              </div>
            )}

            <button
              type="button"
              className="prod-modal-cancel"
              style={{ marginTop: '10px' }}
              onClick={closeBatchDetail}
            >
              Cerrar Detalle
            </button>
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}
