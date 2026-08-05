import { useState } from 'react'
import { useDemoData } from '../context/demo-data-context'
import './Produccion.css'

interface Batch {
  id: string
  productName: string
  inputAmount: string
  outputPortions: number
  expectedYield: number
  waste: number
  costPerPortion: number
  operator: string
  bonus: number
  date: string
}

export function Produccion() {
  const { ingredients } = useDemoData()
  const [batches, setBatches] = useState<Batch[]>([
    {
      id: 'LOT-101',
      productName: 'Pollo Porcionado',
      inputAmount: '10 kg Pechuga Entera',
      outputPortions: 42,
      expectedYield: 40,
      waste: 0.8,
      costPerPortion: 0.85,
      operator: 'Carlos Ruiz',
      bonus: 5.0,
      date: new Date().toISOString().split('T')[0],
    },
    {
      id: 'LOT-102',
      productName: 'Lumpias de Vegetales y Cerdo',
      inputAmount: '5 kg Cerdo + 4 kg Vegetales',
      outputPortions: 120,
      expectedYield: 110,
      waste: 0.3,
      costPerPortion: 0.35,
      operator: 'María López',
      bonus: 12.0,
      date: new Date().toISOString().split('T')[0],
    },
  ])

  const [showModal, setShowModal] = useState(false)
  const [selectedIngredientId, setSelectedIngredientId] = useState('')
  const [inputQty, setInputQty] = useState('')
  const [outputPortions, setOutputPortions] = useState('')
  const [wasteAmount, setWasteAmount] = useState('')
  const [operatorName, setOperatorName] = useState('')

  const handleCreateBatch = (e: React.FormEvent) => {
    e.preventDefault()
    const ing = ingredients.find(i => i.id === selectedIngredientId)
    const portions = parseInt(outputPortions) || 1
    const totalCost = (ing?.costPerUnit || 2.5) * (parseFloat(inputQty) || 1)
    const costPerPortion = totalCost / portions
    const bonus = portions * 0.1 // $0.10 por porción como bono de producción

    const newBatch: Batch = {
      id: `LOT-${100 + batches.length + 1}`,
      productName: ing ? `Porcionado de ${ing.name}` : 'Lote de Producción',
      inputAmount: `${inputQty} ${ing?.unit || 'kg'}`,
      outputPortions: portions,
      expectedYield: Math.floor(portions * 0.95),
      waste: parseFloat(wasteAmount) || 0,
      costPerPortion,
      operator: operatorName || 'Operador',
      bonus,
      date: new Date().toISOString().split('T')[0],
    }

    setBatches([newBatch, ...batches])
    setShowModal(false)
    setSelectedIngredientId('')
    setInputQty('')
    setOutputPortions('')
    setWasteAmount('')
    setOperatorName('')
  }

  return (
    <div className="page animate-fade-in">
      <header className="page-header">
        <div>
          <h1 className="page-title text-gradient">Producción y Porcionado</h1>
          <p className="page-subtitle">Transformación de materia prima, merma y bonos de producción</p>
        </div>
        <button className="btn-accent" onClick={() => setShowModal(true)}>
          ➕ Registrar Nueva Producción
        </button>
      </header>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon">🥩</div>
          <div className="stat-info">
            <span className="stat-value">
              {batches.reduce((sum, b) => sum + b.outputPortions, 0)} und
            </span>
            <span className="stat-label">Porciones producidas hoy</span>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">🎁</div>
          <div className="stat-info">
            <span className="stat-value">
              ${batches.reduce((sum, b) => sum + b.bonus, 0).toFixed(2)}
            </span>
            <span className="stat-label">Bonos acumulados</span>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">♻️</div>
          <div className="stat-info">
            <span className="stat-value">
              {batches.reduce((sum, b) => sum + b.waste, 0).toFixed(1)} kg
            </span>
            <span className="stat-label">Merma total</span>
          </div>
        </div>
      </div>

      <div className="card table-card mt-6">
        <div className="card-header">
          <h2 className="card-title">Historial de Lotes de Producción</h2>
        </div>
        <table className="data-table">
          <thead>
            <tr>
              <th>Código Lote</th>
              <th>Producto / Preparación</th>
              <th>Materia Prima Usada</th>
              <th>Porciones Resultantes</th>
              <th>Merma (Kg)</th>
              <th>Costo / Porción</th>
              <th>Operador</th>
              <th>Bono Generado</th>
            </tr>
          </thead>
          <tbody>
            {batches.map(batch => (
              <tr key={batch.id}>
                <td>
                  <strong>{batch.id}</strong>
                </td>
                <td>{batch.productName}</td>
                <td>{batch.inputAmount}</td>
                <td>
                  <span className="badge badge-success">{batch.outputPortions} porciones</span>
                </td>
                <td>{batch.waste} kg</td>
                <td>${batch.costPerPortion.toFixed(2)}</td>
                <td>{batch.operator}</td>
                <td>
                  <strong className="text-gradient">${batch.bonus.toFixed(2)}</strong>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content animate-pop" onClick={e => e.stopPropagation()}>
            <header className="modal-header">
              <h2>Registrar Lote de Producción</h2>
              <button className="modal-close" onClick={() => setShowModal(false)}>
                ✕
              </button>
            </header>
            <form onSubmit={handleCreateBatch} className="modal-body form-grid">
              <div className="field">
                <label className="field-label">Materia Prima a Transformar</label>
                <select
                  className="field-input"
                  value={selectedIngredientId}
                  onChange={e => setSelectedIngredientId(e.target.value)}
                  required
                >
                  <option value="">Seleccionar ingrediente...</option>
                  {ingredients.map(ing => (
                    <option key={ing.id} value={ing.id}>
                      {ing.name} ({ing.stock} {ing.unit} disponibles)
                    </option>
                  ))}
                </select>
              </div>

              <div className="field">
                <label className="field-label">Cantidad Usada</label>
                <input
                  type="number"
                  step="0.1"
                  className="field-input"
                  placeholder="Ej. 10"
                  value={inputQty}
                  onChange={e => setInputQty(e.target.value)}
                  required
                />
              </div>

              <div className="field">
                <label className="field-label">Porciones Producidas</label>
                <input
                  type="number"
                  className="field-input"
                  placeholder="Ej. 40"
                  value={outputPortions}
                  onChange={e => setOutputPortions(e.target.value)}
                  required
                />
              </div>

              <div className="field">
                <label className="field-label">Merma Desperdiciada (kg/g)</label>
                <input
                  type="number"
                  step="0.1"
                  className="field-input"
                  placeholder="Ej. 0.5"
                  value={wasteAmount}
                  onChange={e => setWasteAmount(e.target.value)}
                />
              </div>

              <div className="field">
                <label className="field-label">Empleado / Operador</label>
                <input
                  type="text"
                  className="field-input"
                  placeholder="Nombre del trabajador"
                  value={operatorName}
                  onChange={e => setOperatorName(e.target.value)}
                  required
                />
              </div>

              <div className="modal-footer">
                <button type="submit" className="btn-accent">
                  Guardar Lote
                </button>
                <button type="button" className="btn-outline" onClick={() => setShowModal(false)}>
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
