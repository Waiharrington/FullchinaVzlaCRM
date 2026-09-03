import { useEffect, useState, type FormEvent } from 'react'
import { createPortal } from 'react-dom'
import { useAuth } from '../context/auth-context'
import { AlertTriangle, ArrowRightLeft, DollarSign, Package, Plus, Warehouse, Eye, Pencil, Minus, X, Save, Loader2 } from 'lucide-react'
import { adjustStock, getIngredients, getStockMovements, getUnits, updateIngredient, updateIngredientCost, type Ingredient, type StockMovement } from '../lib/dataService'
import { StyledSelect } from '../components/StyledSelect'
import Toast from '../components/Toast'
import NumberStepper from '../components/NumberStepper'
import { EmptyState } from '../components/EmptyState'
import { PageSkeleton } from '../components/PageSkeleton'
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
  inventoryClass: Ingredient['inventoryClass']
}
type WarehouseModal = 'view' | 'edit' | 'adjust' | null

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
  const { user } = useAuth()
  const [items, setItems] = useState<WarehouseItem[]>([])
  const [transfers, setTransfers] = useState<WarehouseTransfer[]>([])
  const [selectedItemId, setSelectedItemId] = useState('')
  const [transferQty, setTransferQty] = useState('10')
  const [operator, setOperator] = useState('Usuario del sistema')
  const [successMsg, setSuccessMsg] = useState('')
  const [errorMsg, setErrorMsg] = useState('')
  const [selectedItem, setSelectedItem] = useState<WarehouseItem | null>(null)
  const [modalMode, setModalMode] = useState<WarehouseModal>(null)
  const [itemMovements, setItemMovements] = useState<StockMovement[]>([])
  const [units, setUnits] = useState<Array<{ id: string; name: string; symbol: string }>>([])
  const [editForm, setEditForm] = useState({ name: '', inventoryClass: 'raw_material' as Ingredient['inventoryClass'], price: '' })
  const [adjustment, setAdjustment] = useState({ direction: 1 as 1 | -1, quantity: '', notes: '' })
  const [modalLoading, setModalLoading] = useState(false)
  const [loading, setLoading] = useState(true)

  const closeModal = () => { if (!modalLoading) { setSelectedItem(null); setModalMode(null) } }
  const openView = async (item: WarehouseItem) => { setSelectedItem(item); setModalMode('view'); setModalLoading(true); try { setItemMovements(await getStockMovements(item.id)) } catch { setErrorMsg('No se pudieron cargar los movimientos.') } finally { setModalLoading(false) } }
  const openEdit = async (item: WarehouseItem) => { setSelectedItem(item); setModalMode('edit'); setEditForm({ name: item.name, inventoryClass: item.inventoryClass, price: String(item.costPerUnit) }); if (!units.length) setUnits(await getUnits()) }
  const openAdjustment = (item: WarehouseItem, direction: 1 | -1) => { setSelectedItem(item); setModalMode('adjust'); setAdjustment({ direction, quantity: '', notes: '' }) }
  const refreshItems = async () => { const ingredients = await getIngredients(); setItems(ingredients.map(item => ({ id: item.id, unitId: item.unitId, name: item.name, category: 'Insumo', quantity: item.currentStock, costPerUnit: item.pricePerUnit ?? 0, minStock: 0, unit: item.unitSymbol, inventoryClass: item.inventoryClass }))) }
  const saveEdit = async (event: FormEvent) => { event.preventDefault(); if (!selectedItem || !user) return; const name = editForm.name.trim(); const price = Number(editForm.price); if (!name || !Number.isFinite(price) || price < 0) { setErrorMsg('Indica nombre y costo válidos.'); return } setModalLoading(true); try { await updateIngredient(selectedItem.id, { name, inventory_class: editForm.inventoryClass }); await updateIngredientCost(selectedItem.id, price, user.id); await refreshItems(); setSuccessMsg(`${name} actualizado correctamente.`); setSelectedItem(null); setModalMode(null) } catch (error) { setErrorMsg(error instanceof Error ? error.message : 'No se pudo actualizar el insumo.') } finally { setModalLoading(false) } }
  const saveAdjustment = async (event: FormEvent) => { event.preventDefault(); if (!selectedItem) return; const quantity = Number(adjustment.quantity); if (!Number.isFinite(quantity) || quantity <= 0 || !adjustment.notes.trim()) { setErrorMsg('Indica una cantidad válida y el motivo del ajuste.'); return } setModalLoading(true); try { await adjustStock({ ingredientId: selectedItem.id, quantity: quantity * adjustment.direction, unitId: selectedItem.unitId, movementType: 'adjustment', referenceType: 'manual', notes: adjustment.notes.trim() }); await refreshItems(); setSuccessMsg(`${adjustment.direction > 0 ? 'Entrada' : 'Salida'} registrada para ${selectedItem.name}.`); setSelectedItem(null); setModalMode(null) } catch (error) { setErrorMsg(error instanceof Error ? error.message : 'No se pudo registrar el ajuste.') } finally { setModalLoading(false) } }

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
        unit: item.unitSymbol,
        inventoryClass: item.inventoryClass
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
      .finally(() => setLoading(false))
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

  if (loading) return <PageSkeleton cards={3} rows={5} hasTable />

  return (
    <div className="almacen-page management-workspace management-workspace--warehouse">
      <header className="almacen-page-header management-workspace-header">
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

      <section className="almacen-metrics-grid management-workspace-metrics" aria-label="Resumen del almacén">
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
        <section className="almacen-card inventory-card management-workspace-panel">
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
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {items.length === 0 ? (
                  <tr><td colSpan={7}>
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
                      <td><div className="almacen-actions"><button type="button" className="almacen-action-btn" title="Ver movimientos" aria-label={`Ver movimientos de ${item.name}`} onClick={() => openView(item)}><Eye size={14} /></button><button type="button" className="almacen-action-btn" title="Editar insumo" aria-label={`Editar ${item.name}`} onClick={() => openEdit(item)}><Pencil size={14} /></button><button type="button" className="almacen-action-btn positive" title="Agregar inventario" aria-label={`Agregar inventario a ${item.name}`} onClick={() => openAdjustment(item, 1)}><Plus size={14} /></button><button type="button" className="almacen-action-btn negative" title="Descontar inventario" aria-label={`Descontar inventario de ${item.name}`} onClick={() => openAdjustment(item, -1)}><Minus size={14} /></button></div></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </section>

        <aside className="almacen-side-column">
          <section className="almacen-card management-workspace-panel">
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

          <section className="almacen-card management-workspace-panel">
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
      {selectedItem && modalMode && createPortal(<div className="almacen-modal-overlay" onClick={closeModal}><div className="almacen-action-modal" onClick={event => event.stopPropagation()}><button type="button" className="almacen-modal-close" onClick={closeModal} aria-label="Cerrar"><X size={16} /></button>
        {modalMode === 'view' && <><div className="almacen-modal-heading"><span><Eye size={18} /></span><div><small>Historial del insumo</small><h3>{selectedItem.name}</h3></div></div><div className="almacen-modal-stock"><small>Stock actual</small><strong>{selectedItem.quantity} {selectedItem.unit}</strong></div>{modalLoading ? <p className="almacen-modal-empty">Cargando movimientos…</p> : itemMovements.length === 0 ? <p className="almacen-modal-empty">Este insumo todavía no tiene movimientos.</p> : <div className="almacen-history-list">{itemMovements.map(movement => <div className="almacen-history-row" key={movement.id}><div><strong>{movement.movementType === 'purchase' ? 'Entrada' : movement.movementType === 'consumption' ? 'Salida' : 'Ajuste'}</strong><small>{movement.notes || movement.referenceType || 'Sin motivo'}</small></div><b className={movement.quantity > 0 ? 'positive' : 'negative'}>{movement.quantity > 0 ? '+' : ''}{movement.quantity} {movement.unitSymbol}</b></div>)}</div>}</>}
        {modalMode === 'edit' && <form onSubmit={saveEdit}><div className="almacen-modal-heading"><span><Pencil size={18} /></span><div><small>Editar insumo</small><h3>{selectedItem.name}</h3></div></div><div className="almacen-modal-fields"><label>Nombre<input value={editForm.name} onChange={event => setEditForm(form => ({ ...form, name: event.target.value }))} /></label><label>Costo por unidad (USD)<input type="number" min="0" step="0.01" value={editForm.price} onChange={event => setEditForm(form => ({ ...form, price: event.target.value }))} /></label><label>Clasificación<select value={editForm.inventoryClass} onChange={event => setEditForm(form => ({ ...form, inventoryClass: event.target.value as Ingredient['inventoryClass'] }))}><option value="raw_material">Materia prima</option><option value="packaging">Empaque</option><option value="beverage">Bebida</option><option value="non_inventory">No inventariable</option></select></label></div><button className="btn-primary-red" disabled={modalLoading}>{modalLoading ? <Loader2 className="spin" size={17} /> : <Save size={17} />} Guardar cambios</button></form>}
        {modalMode === 'adjust' && <form onSubmit={saveAdjustment}><div className="almacen-modal-heading"><span className={adjustment.direction > 0 ? 'positive' : 'negative'}>{adjustment.direction > 0 ? <Plus size={18} /> : <Minus size={18} />}</span><div><small>{adjustment.direction > 0 ? 'Agregar al inventario' : 'Descontar del inventario'}</small><h3>{selectedItem.name}</h3></div></div><div className="almacen-modal-stock"><small>Stock actual</small><strong>{selectedItem.quantity} {selectedItem.unit}</strong></div><div className="almacen-modal-fields"><label>Cantidad ({selectedItem.unit})<input autoFocus type="number" min="0.001" step="0.001" value={adjustment.quantity} onChange={event => setAdjustment(value => ({ ...value, quantity: event.target.value }))} placeholder="0.000" /></label><label>Motivo del ajuste<textarea value={adjustment.notes} onChange={event => setAdjustment(value => ({ ...value, notes: event.target.value }))} placeholder="Ej. conteo físico, merma, recepción manual…" /></label></div><button className={`btn-primary-red ${adjustment.direction < 0 ? 'danger' : ''}`} disabled={modalLoading}>{modalLoading ? <Loader2 className="spin" size={17} /> : adjustment.direction > 0 ? <Plus size={17} /> : <Minus size={17} />} {adjustment.direction > 0 ? 'Registrar entrada' : 'Registrar salida'}</button></form>}
      </div></div>, document.body)}
    </div>
  )
}
