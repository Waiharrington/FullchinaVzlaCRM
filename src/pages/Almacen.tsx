import { useEffect, useState, type FormEvent } from 'react'
import { AlertTriangle, ArrowRightLeft, DollarSign, Package, Plus, Warehouse } from 'lucide-react'
import { adjustStock, getIngredients, getStockMovements } from '../lib/dataService'
import { StyledSelect } from '../components/StyledSelect'
import Toast from '../components/Toast'
import NumberStepper from '../components/NumberStepper'
import { EmptyState } from '../components/EmptyState'
import './Almacen.css'
import { dateKeyInTimeZone } from '../lib/money'

type WarehouseItem = {
  id: string
  unitId: string
  name: string
  category: string
  quantity: number
  costPerUnit: number
  minStock: number
  unit: string
}

type WarehouseTransfer = {
  id: string
  itemName: string
  quantityTransferred: number
  unit: string
  date: string
  operator: string
  destination: string
  status: 'completed'
}

export function Almacen() {
  const [items, setItems] = useState<WarehouseItem[]>([])
  const [transfers, setTransfers] = useState<WarehouseTransfer[]>([])
  const [selectedItemId, setSelectedItemId] = useState('')
  const [transferQty, setTransferQty] = useState('10')
  const [operator, setOperator] = useState('Usuario del sistema')
  const [successMsg, setSuccessMsg] = useState('')
  const [errorMsg, setErrorMsg] = useState('')

  const totalValuation = items.reduce((sum, item) => sum + item.quantity * item.costPerUnit, 0)
  const criticalItems = items.filter(item => item.quantity <= item.minStock).length

  useEffect(() => {
    Promise.all([getIngredients(), getStockMovements()]).then(([ingredients, movements]) => {
      setItems(ingredients.map(item => ({
        id: item.id,
        unitId: item.unitId,
        name: item.name,
        category: 'Insumo',
        quantity: item.currentStock,
        costPerUnit: item.pricePerUnit ?? 0,
        minStock: 0,
        unit: item.unitSymbol
      })))
      setSelectedItemId(current => current || ingredients[0]?.id || '')
      setTransfers(movements
        .filter(item => item.notes?.startsWith('Transferencia a operación'))
        .map(item => ({
          id: item.id,
          itemName: item.ingredientName,
          quantityTransferred: Math.abs(item.quantity),
          unit: item.unitSymbol,
          date: item.createdAt.slice(0, 10),
          operator: 'Usuario del sistema',
          destination: 'Operación',
          status: 'completed'
        })))
    }).catch(error => setErrorMsg(error instanceof Error ? error.message : 'No se pudo cargar el almacén'))
  }, [])

  const handleTransfer = async (event: FormEvent) => {
    event.preventDefault()
    const targetItem = items.find(item => item.id === selectedItemId)
    const qty = Number(transferQty)
    if (!targetItem || !Number.isFinite(qty) || qty <= 0) {
      setSuccessMsg('')
      setErrorMsg('Indica una cantidad válida mayor a cero.')
      return
    }

    if (qty > targetItem.quantity) {
      setSuccessMsg('')
      setErrorMsg('La cantidad a transferir excede el stock disponible en almacén.')
      return
    }

    try {
      await adjustStock({
        ingredientId: targetItem.id,
        quantity: -qty,
        unitId: targetItem.unitId,
        movementType: 'adjustment',
        notes: 'Transferencia a operación'
      })

      setItems(previous => previous.map(item => item.id === selectedItemId
        ? { ...item, quantity: item.quantity - qty }
        : item
      ))

      setTransfers(previous => [{
        id: `wt-${Date.now()}`,
        itemName: targetItem.name,
        quantityTransferred: qty,
        unit: targetItem.unit,
        date: dateKeyInTimeZone(),
        operator,
        destination: 'Food Truck Inventario Operativo',
        status: 'completed'
      }, ...previous])

      setErrorMsg('')
      setSuccessMsg(`Transferencia de ${qty} ${targetItem.unit} registrada correctamente.`)
      setTimeout(() => setSuccessMsg(''), 4000)
    } catch (error) {
      setSuccessMsg('')
      setErrorMsg(error instanceof Error ? error.message : 'No se pudo registrar la transferencia')
    }
  }

  return (
    <div className="almacen-page">
      <header className="almacen-page-header">
        <div className="almacen-page-title-wrap">
          <div>
            <p className="almacen-eyebrow">OPERACIÓN · ABASTECIMIENTO</p>
            <h1 className="page-title"><Warehouse size={22} className="page-title-icon" /> Almacén principal</h1>
            <p>Controla la materia prima antes de enviarla al Food Truck.</p>
          </div>
        </div>
        <div className="almacen-header-note">
          <span className="almacen-live-dot" />
          Inventario actualizado
        </div>
      </header>

      <section className="almacen-metrics-grid" aria-label="Resumen del almacén">
        <div className="almacen-metric-card accent-red">
          <div className="metric-icon-box"><Package size={22} /></div>
          <div className="metric-info-group">
            <span className="metric-label">Insumos en almacén</span>
            <strong className="metric-large-val">{items.length}</strong>
            <span className="metric-sub-text">Tipos de materia prima</span>
          </div>
        </div>

        <div className="almacen-metric-card accent-green">
          <div className="metric-icon-box"><DollarSign size={22} /></div>
          <div className="metric-info-group">
            <span className="metric-label">Valorización</span>
            <strong className="metric-large-val">${totalValuation.toFixed(2)}</strong>
            <span className="metric-sub-text">Valor total a costo</span>
          </div>
        </div>

        <div className="almacen-metric-card accent-purple">
          <div className="metric-icon-box"><ArrowRightLeft size={22} /></div>
          <div className="metric-info-group">
            <span className="metric-label">Transferencias hoy</span>
            <strong className="metric-large-val">{transfers.length}</strong>
            <span className="metric-sub-text">Envíos al Food Truck</span>
          </div>
        </div>

        <div className="almacen-metric-card accent-orange">
          <div className="metric-icon-box"><AlertTriangle size={22} /></div>
          <div className="metric-info-group">
            <span className="metric-label">Stock crítico</span>
            <strong className="metric-large-val">{criticalItems}</strong>
            <span className="metric-sub-text">Por debajo de mínimo</span>
          </div>
        </div>
      </section>

      <div className="almacen-main-grid">
        <section className="almacen-card inventory-card">
          <div className="almacen-card-header">
            <div className="header-title-group">
              <div className="card-header-icon"><Package size={18} /></div>
              <div>
                <h2 className="almacen-card-title">Inventario disponible</h2>
                <p className="almacen-card-description">Insumos listos para transferir a la operación.</p>
              </div>
            </div>
            <span className="almacen-count-pill">{items.length} insumos</span>
          </div>

          <div className="table-responsive-wrapper">
            <table className="almacen-table">
              <thead>
                <tr>
                  <th>Insumo</th>
                  <th>Categoría</th>
                  <th>Stock</th>
                  <th>Costo / unidad</th>
                  <th>Valor total</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                {items.length === 0 ? (
                  <tr><td colSpan={6}>
                    <EmptyState
                      compact
                      title="No hay insumos registrados"
                      description="Agrega tu primer insumo para empezar a llevar el inventario."
                    />
                  </td></tr>
                ) : items.map(item => {
                  const isLow = item.quantity <= item.minStock
                  return (
                    <tr key={item.id}>
                      <td className="almacen-item-name">{item.name}</td>
                      <td><span className="almacen-category">{item.category}</span></td>
                      <td className="almacen-stock-value">{item.quantity} <small>{item.unit}</small></td>
                      <td>${item.costPerUnit.toFixed(2)}</td>
                      <td className="almacen-total-value">${(item.quantity * item.costPerUnit).toFixed(2)}</td>
                      <td>
                        <span className={`badge-stock ${isLow ? 'low' : 'normal'}`}>
                          <span className="status-dot" />
                          {isLow ? 'Crítico' : 'Suficiente'}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </section>

        <aside className="almacen-side-column">
          <section className="almacen-card">
            <div className="almacen-card-header">
              <div className="header-title-group">
                <div className="card-header-icon purple-icon"><ArrowRightLeft size={18} /></div>
                <div>
                  <h2 className="almacen-card-title">Nueva transferencia</h2>
                  <p className="almacen-card-description">Despacha insumos al inventario operativo.</p>
                </div>
              </div>
            </div>

            {successMsg && <Toast type="success" message={successMsg} onClose={() => setSuccessMsg('')} />}
            {errorMsg && <Toast type="error" message={errorMsg} onClose={() => setErrorMsg('')} />}

            <form onSubmit={handleTransfer} className="transfer-form-box">
              <div className="select-field-group">
                <label className="field-label" htmlFor="warehouse-item">Insumo de almacén</label>
                <StyledSelect id="warehouse-item" className="field-select" value={selectedItemId} onChange={event => setSelectedItemId(event.target.value)}>
                  {items.map(item => <option key={item.id} value={item.id}>{item.name} · {item.quantity} {item.unit} disponibles</option>)}
                </StyledSelect>
              </div>

              <div className="transfer-fields-grid">
                <div className="select-field-group">
                  <label className="field-label" htmlFor="transfer-quantity">Cantidad</label>
                  <NumberStepper id="transfer-quantity" min={1} step={1} className="field-select" value={transferQty} onChange={(v) => setTransferQty(v)} />
                </div>
                <div className="select-field-group">
                  <label className="field-label" htmlFor="transfer-operator">Operador responsable</label>
                  <StyledSelect id="transfer-operator" className="field-select" value={operator} onChange={event => setOperator(event.target.value)}>
                    <option value="Usuario del sistema">Usuario del sistema</option>
                  </StyledSelect>
                </div>
              </div>

              <button type="submit" className="btn-primary-red" disabled={!selectedItemId}>
                <Plus size={17} />
                Transferir al Food Truck
              </button>
            </form>
          </section>

          <section className="almacen-card">
            <div className="history-header">
              <div>
                <h2 className="almacen-card-title">Historial de transferencias</h2>
                <p className="almacen-card-description">Últimos movimientos hacia la operación.</p>
              </div>
              <ArrowRightLeft size={18} className="history-header-icon" />
            </div>
            <div className="transfer-history-list">
              {transfers.length === 0 ? (
                <div className="history-empty">Aún no hay transferencias registradas.</div>
              ) : transfers.map(transfer => (
                <div key={transfer.id} className="transfer-history-item">
                  <div>
                    <span className="history-item-name">{transfer.itemName}</span>
                    <span className="history-item-meta">{transfer.quantityTransferred} {transfer.unit} · {transfer.operator} · {transfer.date}</span>
                  </div>
                  <span className="history-status">Enviado</span>
                </div>
              ))}
            </div>
          </section>
        </aside>
      </div>
    </div>
  )
}
