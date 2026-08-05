import { useState, useMemo } from 'react'
import {
  ChevronDown,
  CookingPot,
  TrendingUp,
  Trash2,
  DollarSign,
  Clock,
  Info,
  MoreVertical,
  ArrowRight
} from 'lucide-react'
import './Produccion.css'

export interface IngredientItem {
  id: string
  name: string
  quantity: string
  cost: number
}

export interface BatchItem {
  id: string
  batchCode: string
  productName: string
  date: string
  responsible: string
  yieldPct: number
  status: 'Completado' | 'Parcial'
}

export interface EmployeeProduction {
  id: string
  initials: string
  color: string
  name: string
  pieces: number
  pct: number
  bonus: number
}

const MOCK_INGREDIENTS: IngredientItem[] = [
  { id: '1', name: 'Pechuga de pollo', quantity: '10.00 kg', cost: 110.0 },
  { id: '2', name: 'Sal', quantity: '0.10 kg', cost: 1.0 },
  { id: '3', name: 'Aceite vegetal', quantity: '0.10 L', cost: 4.0 },
]

const MOCK_BATCHES: BatchItem[] = [
  { id: '1', batchCode: 'L-0008', productName: 'Porcionado de pollo', date: '24 may 2025, 12:45 p.m.', responsible: 'María Chávez', yieldPct: 88.0, status: 'Completado' },
  { id: '2', batchCode: 'L-0007', productName: 'Lumpias (carne)', date: '24 may 2025, 11:20 a.m.', responsible: 'Juan Pérez', yieldPct: 92.5, status: 'Completado' },
  { id: '3', batchCode: 'L-0006', productName: 'Camarones empanizados', date: '24 may 2025, 9:35 a.m.', responsible: 'Ana López', yieldPct: 85.3, status: 'Completado' },
  { id: '4', batchCode: 'L-0005', productName: 'Porcionado de pollo', date: '23 may 2025, 5:10 p.m.', responsible: 'Roberto Vargas', yieldPct: 83.1, status: 'Parcial' },
  { id: '5', batchCode: 'L-0004', productName: 'Lumpias (pollo)', date: '23 may 2025, 3:15 p.m.', responsible: 'María Chávez', yieldPct: 89.2, status: 'Completado' },
]

const MOCK_EMPLOYEES: EmployeeProduction[] = [
  { id: 'e1', initials: 'MC', color: '#dc2626', name: 'María Chávez', pieces: 120, pct: 38, bonus: 18.0 },
  { id: 'e2', initials: 'JP', color: '#f97316', name: 'Juan Pérez', pieces: 90, pct: 28, bonus: 13.5 },
  { id: 'e3', initials: 'AL', color: '#8b5cf6', name: 'Ana López', pieces: 70, pct: 22, bonus: 10.5 },
  { id: 'e4', initials: 'RV', color: '#eab308', name: 'Roberto Vargas', pieces: 40, pct: 12, bonus: 6.0 },
]

export function Produccion() {
  const [selectedRecipe, setSelectedRecipe] = useState('Porcionado de pollo')
  const [outputUnit, setOutputUnit] = useState('Porción')
  const [inputQty, setInputQty] = useState('10.00')
  const [producedQty, setProducedQty] = useState('40')
  const [wasteQty, setWasteQty] = useState('0.50')

  const totalIngredientsCost = useMemo(() => {
    return MOCK_INGREDIENTS.reduce((acc, item) => acc + item.cost, 0)
  }, [])

  const totalCost = totalIngredientsCost + 5.0 // Includes waste & extras
  const costPerPortion = Number(producedQty) > 0 ? totalCost / Number(producedQty) : 0

  return (
    <div className="produccion-page animate-fade-in">
      {/* 4 Metric Cards Header */}
      <div className="prod-metrics-grid">
        {/* Card 1 */}
        <div className="prod-metric-card">
          <div className="metric-icon-box red">
            <CookingPot size={22} />
          </div>
          <div className="metric-info-group">
            <span className="metric-label">Producciones de hoy</span>
            <span className="metric-large-val">8</span>
            <span className="metric-sub-text">lotes completados</span>
            <span className="metric-trend green">↑ 2 vs ayer</span>
          </div>
        </div>

        {/* Card 2 */}
        <div className="prod-metric-card">
          <div className="metric-icon-box orange">
            <TrendingUp size={22} />
          </div>
          <div className="metric-info-group">
            <span className="metric-label">Rendimiento promedio</span>
            <span className="metric-large-val">86.4%</span>
            <span className="metric-sub-text">de conversión</span>
            <span className="metric-trend green">↑ 4.3% vs ayer</span>
          </div>
        </div>

        {/* Card 3 */}
        <div className="prod-metric-card">
          <div className="metric-icon-box purple">
            <Trash2 size={22} />
          </div>
          <div className="metric-info-group">
            <span className="metric-label">Merma</span>
            <span className="metric-large-val">1.25 kg</span>
            <span className="metric-sub-text">valorado en $18.75</span>
            <span className="metric-trend green">↓ 0.35 kg vs ayer</span>
          </div>
        </div>

        {/* Card 4 */}
        <div className="prod-metric-card">
          <div className="metric-icon-box green">
            <DollarSign size={22} />
          </div>
          <div className="metric-info-group">
            <span className="metric-label">Costo por porción</span>
            <span className="metric-large-val">$3.00</span>
            <span className="metric-sub-text">promedio del día</span>
            <span className="metric-trend red">↑ $0.10 vs ayer</span>
          </div>
        </div>
      </div>

      {/* Main 2-Column Section */}
      <div className="prod-main-grid">
        {/* LEFT COLUMN: Nueva producción + Lotes recientes */}
        <div className="prod-left-column">
          {/* Card: Nueva producción */}
          <div className="prod-section-card">
            <div className="prod-card-header-bar">
              <div className="header-title-group">
                <div className="card-header-icon-red">
                  <CookingPot size={16} />
                </div>
                <h2 className="prod-card-title">Nueva producción</h2>
              </div>
              <button className="history-btn-outline">
                <Clock size={14} /> Historial de producciones
              </button>
            </div>

            {/* Dropdown selects */}
            <div className="prod-form-selects-row mt-3">
              <div className="select-field-group flex-2">
                <label className="field-label">Receta / Producción</label>
                <select
                  className="field-select"
                  value={selectedRecipe}
                  onChange={(e) => setSelectedRecipe(e.target.value)}
                >
                  <option value="Porcionado de pollo">Porcionado de pollo</option>
                  <option value="Lumpias (carne)">Lumpias (carne)</option>
                  <option value="Lumpias (pollo)">Lumpias (pollo)</option>
                  <option value="Camarones empanizados">Camarones empanizados</option>
                </select>
                <span className="field-subtitle">Convierte pollo crudo en porciones listas para servir.</span>
              </div>

              <div className="select-field-group flex-1">
                <label className="field-label">Unidad de salida</label>
                <select
                  className="field-select"
                  value={outputUnit}
                  onChange={(e) => setOutputUnit(e.target.value)}
                >
                  <option value="Porción">Porción</option>
                  <option value="Pieza">Pieza</option>
                  <option value="Kg">Kg</option>
                </select>
              </div>
            </div>

            {/* Ingredients table + Quantities + Costs split container */}
            <div className="prod-recipe-details-grid mt-4">
              {/* Ingredients Box */}
              <div className="ingredients-box">
                <h4 className="box-section-title">Ingredientes usados</h4>
                <div className="ingredients-table-wrap">
                  <table className="ingredients-mini-table">
                    <thead>
                      <tr>
                        <th>Ingrediente</th>
                        <th>Entrada</th>
                        <th>Costo</th>
                      </tr>
                    </thead>
                    <tbody>
                      {MOCK_INGREDIENTS.map((item) => (
                        <tr key={item.id}>
                          <td>{item.name}</td>
                          <td>{item.quantity}</td>
                          <td>${item.cost.toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div className="ingredients-total-footer">
                    <span>Costo total ingredientes</span>
                    <span className="total-cost-val">${totalIngredientsCost.toFixed(2)}</span>
                  </div>
                </div>
              </div>

              {/* Formula & Costs Right Box */}
              <div className="formula-cost-box">
                {/* 3 Formula Boxes */}
                <div className="formula-boxes-row">
                  <div className="formula-mini-card">
                    <span className="formula-label">Cantidad de entrada</span>
                    <div className="formula-value-wrap">
                      <input
                        type="text"
                        className="formula-input"
                        value={inputQty}
                        onChange={(e) => setInputQty(e.target.value)}
                      />
                      <span className="formula-unit">kg</span>
                    </div>
                    <span className="formula-sub">Pollo crudo</span>
                  </div>

                  <span className="formula-operator">−</span>

                  <div className="formula-mini-card">
                    <span className="formula-label">Cantidad producida</span>
                    <div className="formula-value-wrap">
                      <input
                        type="text"
                        className="formula-input"
                        value={producedQty}
                        onChange={(e) => setProducedQty(e.target.value)}
                      />
                    </div>
                    <span className="formula-sub">porciones</span>
                  </div>

                  <span className="formula-operator">=</span>

                  <div className="formula-mini-card">
                    <span className="formula-label">Merma estimada</span>
                    <div className="formula-value-wrap">
                      <input
                        type="text"
                        className="formula-input"
                        value={wasteQty}
                        onChange={(e) => setWasteQty(e.target.value)}
                      />
                      <span className="formula-unit">kg</span>
                    </div>
                    <span className="formula-sub">5.00%</span>
                  </div>
                </div>

                {/* Cost Summary Row */}
                <div className="costs-boxes-row mt-3">
                  <div className="cost-summary-card">
                    <span className="cost-card-label">Costo total</span>
                    <span className="cost-card-amount">${totalCost.toFixed(2)}</span>
                    <span className="cost-card-sub">Incluye merma y extras</span>
                  </div>

                  <div className="cost-summary-card">
                    <span className="cost-card-label">Costo por porción</span>
                    <span className="cost-card-amount">${costPerPortion.toFixed(2)}</span>
                    <span className="cost-card-sub">Costo unitario final</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Card: Lotes recientes */}
          <div className="prod-section-card mt-4">
            <div className="prod-card-header-bar">
              <h2 className="prod-card-title">Lotes recientes</h2>
            </div>

            <div className="table-responsive-wrapper mt-3">
              <table className="lotes-table">
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
                  {MOCK_BATCHES.map((batch) => (
                    <tr key={batch.id}>
                      <td className="font-mono">{batch.batchCode}</td>
                      <td className="font-bold">{batch.productName}</td>
                      <td className="text-gray">{batch.date}</td>
                      <td>{batch.responsible}</td>
                      <td className="font-semibold">{batch.yieldPct.toFixed(1)}%</td>
                      <td>
                        <span className={`status-pill-badge ${batch.status.toLowerCase()}`}>
                          {batch.status}
                        </span>
                      </td>
                      <td>
                        <button className="icon-more-btn">
                          <MoreVertical size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="table-footer-bar">
              <button className="view-all-link">
                Ver todos los lotes <ArrowRight size={14} />
              </button>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: Producción por empleado + Ejemplo de conversión */}
        <div className="prod-right-column">
          {/* Card: Producción por empleado */}
          <div className="prod-section-card">
            <div className="prod-card-header-bar">
              <h2 className="prod-card-title">Producción por empleado</h2>
              <button className="dropdown-pill">
                Hoy <ChevronDown size={12} />
              </button>
            </div>

            {/* Employee Top Stats */}
            <div className="employee-top-stats mt-3">
              <div className="emp-stat-box">
                <span className="emp-stat-label">Total lumpias elaboradas</span>
                <div className="emp-stat-num-row">
                  <span className="emp-stat-num">320</span>
                  <span className="emp-stat-unit">piezas</span>
                </div>
              </div>

              <div className="emp-stat-box">
                <span className="emp-stat-label">Bonos por producción</span>
                <div className="emp-stat-num-row">
                  <span className="emp-stat-num">$48.00</span>
                  <span className="emp-stat-unit">total del día</span>
                </div>
              </div>
            </div>

            {/* Employee List */}
            <div className="employee-list-items mt-3">
              {MOCK_EMPLOYEES.map((emp) => (
                <div key={emp.id} className="employee-item-row">
                  <div
                    className="emp-avatar-circle"
                    style={{ backgroundColor: emp.color }}
                  >
                    {emp.initials}
                  </div>

                  <div className="emp-details-center">
                    <span className="emp-name">{emp.name}</span>
                    <div className="emp-progress-bar-bg">
                      <div
                        className="emp-progress-bar-fill"
                        style={{
                          width: `${emp.pct}%`,
                          backgroundColor: emp.color
                        }}
                      />
                    </div>
                  </div>

                  <div className="emp-pieces-col">
                    <span className="emp-pieces-val">{emp.pieces} pzs</span>
                    <span className="emp-pct-sub">{emp.pct}%</span>
                  </div>

                  <div className="emp-bonus-col font-bold">
                    ${emp.bonus.toFixed(2)}
                  </div>
                </div>
              ))}
            </div>

            {/* Info notice */}
            <div className="bono-info-notice mt-3">
              <Info size={14} className="text-blue" />
              <span>Bonificación: $0.15 por pieza elaborada.</span>
            </div>
          </div>

          {/* Card: Ejemplo de conversión */}
          <div className="prod-section-card mt-4">
            <div className="prod-card-header-bar">
              <h2 className="prod-card-title">Ejemplo de conversión</h2>
            </div>

            {/* Graphic Conversion Row */}
            <div className="conversion-visual-row mt-3">
              <div className="conversion-card-box">
                <span className="conversion-icon">🍗</span>
                <span className="conversion-qty font-bold">10 kg</span>
                <span className="conversion-unit text-gray">de pollo</span>
              </div>

              <span className="conversion-arrow">→</span>

              <div className="conversion-card-box">
                <span className="conversion-icon">🍛</span>
                <span className="conversion-qty font-bold">40</span>
                <span className="conversion-unit text-gray">porciones</span>
              </div>
            </div>

            {/* Conversion Cost Row */}
            <div className="conversion-costs-row mt-3">
              <div className="conversion-cost-item">
                <span className="cost-label">Costo total</span>
                <span className="cost-val text-red font-extrabold">$120.00</span>
              </div>

              <div className="conversion-cost-item">
                <span className="cost-label">Costo por porción</span>
                <span className="cost-val text-green font-extrabold">$3.00</span>
              </div>
            </div>

            <div className="conversion-footnote mt-3">
              <span>Rendimiento: 80% (considerando merma del 20%)</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
