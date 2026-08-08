import { useState } from 'react'
import { DEMO_WAREHOUSE_ITEMS, DEMO_WAREHOUSE_TRANSFERS } from '../lib/demoData'
import type { WarehouseItem, WarehouseTransfer } from '../lib/demoData'
import { Package, ArrowRightLeft, AlertTriangle, DollarSign, Plus, CheckCircle2 } from 'lucide-react'
import './Almacen.css'

export function Almacen() {
  const [items, setItems] = useState<WarehouseItem[]>(DEMO_WAREHOUSE_ITEMS)
  const [transfers, setTransfers] = useState<WarehouseTransfer[]>(DEMO_WAREHOUSE_TRANSFERS)
  
  // Transfer Form State
  const [selectedItemId, setSelectedItemId] = useState(items[0]?.id || '')
  const [transferQty, setTransferQty] = useState<number>(10)
  const [operator, setOperator] = useState('María Chávez')
  const [successMsg, setSuccessMsg] = useState('')

  const totalValuation = items.reduce((sum, item) => sum + item.quantity * item.costPerUnit, 0)
  const criticalItems = items.filter(item => item.quantity <= item.minStock).length

  const handleTransfer = (e: React.FormEvent) => {
    e.preventDefault()
    const targetItem = items.find(i => i.id === selectedItemId)
    if (!targetItem || transferQty <= 0) return

    if (transferQty > targetItem.quantity) {
      alert('La cantidad a transferir excede el stock disponible en Almacén.')
      return
    }

    // Deduct stock from warehouse
    setItems(prev => prev.map(i => i.id === selectedItemId ? { ...i, quantity: i.quantity - transferQty } : i))

    // Create transfer log
    const newTransfer: WarehouseTransfer = {
      id: `wt-${Date.now()}`,
      itemName: `${targetItem.name} (${transferQty} ${targetItem.unit})`,
      quantityTransferred: transferQty,
      unit: targetItem.unit,
      date: new Date().toISOString().split('T')[0],
      operator,
      destination: 'Food Truck Inventario Operativo',
      status: 'completed'
    }

    setTransfers(prev => [newTransfer, ...prev])
    setSuccessMsg(`¡Transferencia de ${transferQty} ${targetItem.unit} a Food Truck registrada con éxito!`)
    setTimeout(() => setSuccessMsg(''), 4000)
  }

  return (
    <div className="almacen-page">
      {/* 4 Metric Cards */}
      <div className="almacen-metrics-grid">
        <div className="almacen-metric-card">
          <div className="metric-icon-box red">
            <Package size={24} />
          </div>
          <div className="metric-info-group">
            <span className="metric-label">Insumos en Almacén</span>
            <span className="metric-large-val">{items.length} Tipos</span>
            <span className="metric-sub-text">Materia prima almacenada</span>
          </div>
        </div>

        <div className="almacen-metric-card">
          <div className="metric-icon-box green">
            <DollarSign size={24} />
          </div>
          <div className="metric-info-group">
            <span className="metric-label">Valorización Almacén</span>
            <span className="metric-large-val">${totalValuation.toFixed(2)}</span>
            <span className="metric-sub-text">Valor total a costo</span>
          </div>
        </div>

        <div className="almacen-metric-card">
          <div className="metric-icon-box purple">
            <ArrowRightLeft size={24} />
          </div>
          <div className="metric-info-group">
            <span className="metric-label">Transferencias Hoy</span>
            <span className="metric-large-val">{transfers.length} Envío(s)</span>
            <span className="metric-sub-text">Al Food Truck</span>
          </div>
        </div>

        <div className="almacen-metric-card">
          <div className="metric-icon-box orange">
            <AlertTriangle size={24} />
          </div>
          <div className="metric-info-group">
            <span className="metric-label">Stock Crítico</span>
            <span className="metric-large-val">{criticalItems} Insumo(s)</span>
            <span className="metric-sub-text">Por debajo de mínimo</span>
          </div>
        </div>
      </div>

      {/* Main 2 Column Section */}
      <div className="almacen-main-grid">
        {/* Left Column: Warehouse Inventory List */}
        <div className="almacen-card">
          <div className="prod-card-header-bar">
            <div className="header-title-group">
              <div className="card-header-icon-red">
                <Package size={18} />
              </div>
              <div>
                <h2 className="prod-card-title">Inventario Almacén Principal</h2>
                <span className="metric-sub-text">Insumos y materia prima antes de trasvasar al Food Truck</span>
              </div>
            </div>
          </div>

          <div className="table-responsive-wrapper">
            <table className="almacen-table">
              <thead>
                <tr>
                  <th>Insumo</th>
                  <th>Categoría</th>
                  <th>Stock Almacén</th>
                  <th>Costo/Unid</th>
                  <th>Valor Total</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                {items.map(item => {
                  const isLow = item.quantity <= item.minStock
                  return (
                    <tr key={item.id}>
                      <td style={{ fontWeight: 700, color: '#fff' }}>{item.name}</td>
                      <td>{item.category}</td>
                      <td style={{ fontWeight: 800 }}>{item.quantity} {item.unit}</td>
                      <td>${item.costPerUnit.toFixed(2)}</td>
                      <td>${(item.quantity * item.costPerUnit).toFixed(2)}</td>
                      <td>
                        <span className={`badge-stock ${isLow ? 'low' : 'normal'}`}>
                          {isLow ? 'Crítico' : 'Suficiente'}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right Column: Transfer to Food Truck Form & Logs */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div className="almacen-card">
            <div className="prod-card-header-bar">
              <div className="header-title-group">
                <div className="card-header-icon-red" style={{ background: '#7c3aed' }}>
                  <ArrowRightLeft size={18} />
                </div>
                <div>
                  <h3 className="prod-card-title">Transferir al Food Truck</h3>
                  <span className="metric-sub-text">Despachar porciones o insumos a la operación</span>
                </div>
              </div>
            </div>

            {successMsg && (
              <div style={{ background: 'rgba(16, 185, 129, 0.15)', border: '1px solid rgba(16, 185, 129, 0.3)', color: '#10b981', padding: '10px 14px', borderRadius: '8px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <CheckCircle2 size={16} />
                <span>{successMsg}</span>
              </div>
            )}

            <form onSubmit={handleTransfer} className="transfer-form-box">
              <div className="select-field-group">
                <label className="field-label">Seleccionar Insumo de Almacén</label>
                <select 
                  className="field-select"
                  value={selectedItemId}
                  onChange={e => setSelectedItemId(e.target.value)}
                >
                  {items.map(i => (
                    <option key={i.id} value={i.id}>
                      {i.name} (Stock: {i.quantity} {i.unit})
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'flex', gap: '12px' }}>
                <div className="select-field-group flex-1">
                  <label className="field-label">Cantidad a Transferir</label>
                  <input 
                    type="number"
                    min="1"
                    className="field-select"
                    value={transferQty}
                    onChange={e => setTransferQty(Number(e.target.value))}
                  />
                </div>

                <div className="select-field-group flex-1">
                  <label className="field-label">Operador Responsable</label>
                  <select 
                    className="field-select"
                    value={operator}
                    onChange={e => setOperator(e.target.value)}
                  >
                    <option value="María Chávez">María Chávez</option>
                    <option value="Juan Pérez">Juan Pérez</option>
                    <option value="Ana López">Ana López</option>
                  </select>
                </div>
              </div>

              <button type="submit" className="btn-primary-red" style={{ marginTop: '8px' }}>
                <Plus size={16} />
                <span>Transferir al Food Truck</span>
              </button>
            </form>
          </div>

          {/* Transfers History */}
          <div className="almacen-card">
            <h3 className="prod-card-title" style={{ fontSize: '14px' }}>Historial de Transferencias</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {transfers.map(tr => (
                <div key={tr.id} style={{ background: '#141416', padding: '10px 12px', borderRadius: '8px', border: '1px solid rgba(255, 255, 255, 0.05)', fontSize: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <span style={{ color: '#fff', fontWeight: 700, display: 'block' }}>{tr.itemName}</span>
                    <span style={{ color: '#71717a', fontSize: '11px' }}>Operador: {tr.operator} • {tr.date}</span>
                  </div>
                  <span style={{ color: '#10b981', fontWeight: 700, fontSize: '11px', background: 'rgba(16, 185, 129, 0.12)', padding: '2px 8px', borderRadius: '6px' }}>Enviado</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
