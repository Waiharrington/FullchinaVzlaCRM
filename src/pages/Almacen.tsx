import { useEffect, useState, useMemo, type FormEvent } from 'react'
import { createPortal } from 'react-dom'
import { useAuth } from '../context/auth-context'
import { AlertTriangle, ArrowRightLeft, DollarSign, Package, Plus, Warehouse, Eye, Pencil, Minus, X, Save, Loader2, Search } from 'lucide-react'
import { adjustStock, getIngredients, getWarehouseIngredients, getStockMovements, getUnits, transferStock, updateIngredient, updateIngredientCost, type Ingredient, type StockMovement } from '../lib/dataService'
import { StyledSelect } from '../components/StyledSelect'
import Toast from '../components/Toast'
import NumberStepper from '../components/NumberStepper'
import { EmptyState } from '../components/EmptyState'
import { PageSkeleton } from '../components/PageSkeleton'
import { normalizeForSearch } from '../lib/textFormat'
import './Almacen.css'

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
type QuickAction = 'receive' | 'transfer' | 'critical' | null

export function Almacen() {
  const { user } = useAuth()
  const [items, setItems] = useState<WarehouseItem[]>([])
  const [operationalItems, setOperationalItems] = useState<WarehouseItem[]>([])
  const [selectedOperationalItemId, setSelectedOperationalItemId] = useState('')
  const [warehouseQty, setWarehouseQty] = useState('1')
  const [selectedItemId, setSelectedItemId] = useState('')
  const [transferQty, setTransferQty] = useState('10')
  const [filterMode, setFilterMode] = useState<'stock' | 'all'>('stock')
  const [searchTerm, setSearchTerm] = useState('')
  const [successMsg, setSuccessMsg] = useState('')
  const [errorMsg, setErrorMsg] = useState('')
  const [selectedItem, setSelectedItem] = useState<WarehouseItem | null>(null)
  const [modalMode, setModalMode] = useState<WarehouseModal>(null)
  const [itemMovements, setItemMovements] = useState<StockMovement[]>([])
  const [units, setUnits] = useState<Array<{ id: string; name: string; symbol: string }>>([])
  const [editForm, setEditForm] = useState({ name: '', inventoryClass: 'raw_material' as Ingredient['inventoryClass'], price: '' })
  const [adjustment, setAdjustment] = useState({ direction: 1 as 1 | -1, quantity: '', notes: '' })
  const [modalLoading, setModalLoading] = useState(false)
  const [quickAction, setQuickAction] = useState<QuickAction>(null)
  const [loading, setLoading] = useState(true)
  const [currentPage, setCurrentPage] = useState(1)

  const closeModal = () => { if (!modalLoading) { setSelectedItem(null); setModalMode(null) } }
  const openView = async (item: WarehouseItem) => { setSelectedItem(item); setModalMode('view'); setModalLoading(true); try { setItemMovements(await getStockMovements(item.id)) } catch { setErrorMsg('No se pudieron cargar los movimientos.') } finally { setModalLoading(false) } }
  const openEdit = async (item: WarehouseItem) => { setSelectedItem(item); setModalMode('edit'); setEditForm({ name: item.name, inventoryClass: item.inventoryClass, price: String(item.costPerUnit) }); if (!units.length) setUnits(await getUnits()) }
  const openAdjustment = (item: WarehouseItem, direction: 1 | -1) => { setSelectedItem(item); setModalMode('adjust'); setAdjustment({ direction, quantity: '', notes: '' }) }
  const refreshItems = async () => { const ingredients = await getWarehouseIngredients(); setItems(ingredients.map(item => ({ id: item.id, unitId: item.unitId, name: item.name, category: 'Insumo', quantity: item.currentStock, costPerUnit: item.pricePerUnit ?? 0, minStock: 0, unit: item.unitSymbol, inventoryClass: item.inventoryClass }))) }
  const saveEdit = async (event: FormEvent) => { event.preventDefault(); if (!selectedItem || !user) return; const name = editForm.name.trim(); const price = Number(editForm.price); if (!name || !Number.isFinite(price) || price < 0) { setErrorMsg('Indica nombre y costo válidos.'); return } setModalLoading(true); try { await updateIngredient(selectedItem.id, { name, inventory_class: editForm.inventoryClass }); await updateIngredientCost(selectedItem.id, price, user.id); await refreshItems(); setSuccessMsg(`${name} actualizado correctamente.`); setSelectedItem(null); setModalMode(null) } catch (error) { setErrorMsg(error instanceof Error ? error.message : 'No se pudo actualizar el insumo.') } finally { setModalLoading(false) } }
  const saveAdjustment = async (event: FormEvent) => { event.preventDefault(); if (!selectedItem) return; const quantity = Number(adjustment.quantity); if (!Number.isFinite(quantity) || quantity <= 0 || !adjustment.notes.trim()) { setErrorMsg('Indica una cantidad válida y el motivo del ajuste.'); return } setModalLoading(true); try { await adjustStock({ ingredientId: selectedItem.id, quantity: quantity * adjustment.direction, unitId: selectedItem.unitId, movementType: 'adjustment', referenceType: 'manual', notes: adjustment.notes.trim() }); await refreshItems(); setSuccessMsg(`${adjustment.direction > 0 ? 'Entrada' : 'Salida'} registrada para ${selectedItem.name}.`); setSelectedItem(null); setModalMode(null) } catch (error) { setErrorMsg(error instanceof Error ? error.message : 'No se pudo registrar el ajuste.') } finally { setModalLoading(false) } }

  const totalValuation = items.reduce((sum, item) => sum + item.quantity * item.costPerUnit, 0)
  const criticalItems = items.filter(item => item.quantity <= item.minStock).length
  const itemsWithStock = useMemo(() => items.filter(item => item.quantity > 0), [items])

  const operationalStockMap = useMemo(() => {
    const map = new Map<string, number>()
    for (const op of operationalItems) {
      map.set(op.id, op.quantity)
    }
    return map
  }, [operationalItems])

  const displayedItems = useMemo(() => {
    const base = filterMode === 'stock' ? itemsWithStock : items
    if (!searchTerm.trim()) return base
    const q = normalizeForSearch(searchTerm)
    return base.filter(item => normalizeForSearch(item.name).includes(q) || normalizeForSearch(item.category).includes(q))
  }, [items, itemsWithStock, filterMode, searchTerm])
  const totalPages = Math.max(1, Math.ceil(displayedItems.length / 20))
  const paginatedItems = displayedItems.slice((currentPage - 1) * 20, currentPage * 20)
  useEffect(() => { setCurrentPage(1) }, [filterMode, searchTerm])

  useEffect(() => {
    Promise.all([getWarehouseIngredients(), getIngredients()]).then(([ingredients, operational]) => {
      const mapItem = (item: Ingredient): WarehouseItem => ({ id: item.id, unitId: item.unitId, name: item.name, category: 'Insumo', quantity: item.currentStock, costPerUnit: item.pricePerUnit ?? 0, minStock: 0, unit: item.unitSymbol, inventoryClass: item.inventoryClass })
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
      const operationalMapped = operational.map(mapItem)
      setOperationalItems(operationalMapped)
      setSelectedOperationalItemId(current => current || operationalMapped[0]?.id || '')
      setSelectedItemId(current => current || ingredients[0]?.id || '')
    }).catch(error => setErrorMsg(error instanceof Error ? error.message : 'No se pudo cargar el almacén'))
      .finally(() => setLoading(false))
  }, [])

  const handleReceiveToWarehouse = async (event: FormEvent) => {
    event.preventDefault()
    const source = operationalItems.find(item => item.id === selectedOperationalItemId)
    const qty = Number(warehouseQty)
    if (!source || !Number.isFinite(qty) || qty <= 0 || qty > source.quantity) {
      setErrorMsg('La cantidad debe ser válida y no superar el inventario operativo.')
      return
    }
    try {
      await transferStock({ ingredientId: source.id, quantity: qty, unitId: source.unitId, from: 'operational', to: 'warehouse', notes: `Transferencia de ${source.name} a almacén` })
      setSuccessMsg(`${qty} ${source.unit} de ${source.name} enviados al almacén.`)
      await refreshItems()
      setOperationalItems(previous => previous.map(item => item.id === source.id ? { ...item, quantity: item.quantity - qty } : item))
      setQuickAction(null)
    } catch (error) {
      setErrorMsg(error instanceof Error ? error.message : 'No se pudo transferir el insumo al almacén.')
    }
  }

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
      await transferStock({
        ingredientId: targetItem.id,
        quantity: qty,
        unitId: targetItem.unitId,
        from: 'warehouse',
        to: 'operational',
        notes: `Transferencia de ${targetItem.name} a operación`,
      })

      setItems(previous => previous.map(item => item.id === selectedItemId
        ? { ...item, quantity: item.quantity - qty }
        : item
      ))

      setErrorMsg('')
      setSuccessMsg(`Transferencia de ${qty} ${targetItem.unit} registrada correctamente.`)
      setQuickAction(null)
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
            <p>Controla la materia prima resguardada antes de despacharla al Food Truck.</p>
          </div>
        </div>
        <div className="almacen-header-note">
          <span className="almacen-live-dot" />
          Depósito central
        </div>
      </header>

      {successMsg && <Toast type="success" message={successMsg} onClose={() => setSuccessMsg('')} />}
      {errorMsg && <Toast type="error" message={errorMsg} onClose={() => setErrorMsg('')} />}

      <section className="almacen-metrics-grid management-workspace-metrics" aria-label="Resumen del almacén">
        <div className="almacen-metric-card accent-red">
          <div className="metric-icon-box"><Package size={18} /></div>
          <div className="metric-info-group">
            <span className="metric-label">Insumos con stock</span>
            <strong className="metric-large-val">{itemsWithStock.length}</strong>
            <span className="metric-sub-text">de {items.length} materias primas</span>
          </div>
        </div>

        <div className="almacen-metric-card accent-green">
          <div className="metric-icon-box"><DollarSign size={18} /></div>
          <div className="metric-info-group">
            <span className="metric-label">Valorización</span>
            <strong className="metric-large-val">${totalValuation.toFixed(2)}</strong>
            <span className="metric-sub-text">Total a costo en almacén</span>
          </div>
        </div>

        <button type="button" className="almacen-metric-card accent-purple" onClick={() => setQuickAction('transfer')}>
          <div className="metric-icon-box"><ArrowRightLeft size={18} /></div>
          <div className="metric-info-group">
            <span className="metric-label">Enviar a inventario</span>
            <strong className="metric-large-val">{itemsWithStock.length}</strong>
            <span className="metric-sub-text">Despachar a cocina</span>
          </div>
        </button>

        <button type="button" className="almacen-metric-card accent-blue" onClick={() => setQuickAction('receive')}>
          <div className="metric-icon-box"><Plus size={18} /></div>
          <div className="metric-info-group">
            <span className="metric-label">Traer desde inventario</span>
            <strong className="metric-large-val">{operationalItems.filter(i => i.quantity > 0).length}</strong>
            <span className="metric-sub-text">Disponibles en cocina</span>
          </div>
        </button>

        <button type="button" className="almacen-metric-card accent-orange" onClick={() => setQuickAction('critical')}>
          <div className="metric-icon-box"><AlertTriangle size={18} /></div>
          <div className="metric-info-group">
            <span className="metric-label">Stock crítico</span>
            <strong className="metric-large-val">{criticalItems}</strong>
            <span className="metric-sub-text">Por debajo de mínimo</span>
          </div>
        </button>
      </section>

      <div className="almacen-main-grid">
        <section className="almacen-card inventory-card management-workspace-panel">
          <div className="almacen-card-header">
            <div className="header-title-group">
              <div className="card-header-icon"><Package size={18} /></div>
              <div>
                <h2 className="almacen-card-title">Productos en almacén</h2>
                <p className="almacen-card-description">Materia prima lista para transferir al Food Truck o registrar en producción.</p>
              </div>
            </div>
            <button
              type="button"
              className="almacen-add-stock-btn"
              onClick={() => setQuickAction('receive')}
              title="Traer productos del Food Truck al almacén"
            >
              <Plus size={15} /> Traer al almacén
            </button>
          </div>

          <div className="almacen-table-controls">
            <div className="almacen-filter-pills" role="tablist" aria-label="Filtrar insumos">
              <button
                type="button"
                role="tab"
                aria-selected={filterMode === 'stock'}
                className={`almacen-filter-pill ${filterMode === 'stock' ? 'active' : ''}`}
                onClick={() => setFilterMode('stock')}
              >
                Con existencias ({itemsWithStock.length})
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={filterMode === 'all'}
                className={`almacen-filter-pill ${filterMode === 'all' ? 'active' : ''}`}
                onClick={() => setFilterMode('all')}
              >
                Todos los insumos ({items.length})
              </button>
            </div>
            <div className="almacen-search-wrap">
              <Search size={14} className="almacen-search-icon" />
              <input
                type="text"
                className="almacen-search-input"
                placeholder="Buscar insumo..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
            </div>
          </div>

          <div className="table-responsive-wrapper">
            <table className="almacen-table">
              <thead>
                <tr>
                  <th>Insumo</th>
                  <th>Categoría</th>
                  <th>Stock en Almacén</th>
                  <th>Stock en Food Truck</th>
                  <th>Costo / unidad</th>
                  <th>Valor Almacén</th>
                  <th>Estado</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {displayedItems.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="almacen-empty-cell">
                      <EmptyState
                        compact
                        title={
                          searchTerm
                            ? 'No se encontraron insumos'
                            : filterMode === 'stock'
                            ? 'No hay insumos con existencias en almacén'
                            : 'No hay insumos registrados'
                        }
                        description={
                          searchTerm
                            ? `No hay resultados para "${searchTerm}".`
                            : filterMode === 'stock'
                            ? 'Puedes traer insumos desde el Food Truck con el botón "Traer al almacén" o cambiar a la pestaña "Todos los insumos".'
                            : 'Agrega tu primer insumo para empezar a llevar el inventario.'
                        }
                        actionLabel={
                          searchTerm
                            ? 'Limpiar búsqueda'
                            : filterMode === 'stock'
                            ? 'Traer desde inventario'
                            : undefined
                        }
                        onAction={
                          searchTerm
                            ? () => setSearchTerm('')
                            : filterMode === 'stock'
                            ? () => setQuickAction('receive')
                            : undefined
                        }
                      />
                    </td>
                  </tr>
                ) : paginatedItems.map(item => {
                  const isLow = item.quantity <= item.minStock
                  const operationalQty = operationalStockMap.get(item.id) ?? 0
                  return (
                    <tr key={item.id}>
                      <td className="almacen-item-name">{item.name}</td>
                      <td><span className="almacen-category">{item.category}</span></td>
                      <td className="almacen-stock-value">{item.quantity} <small>{item.unit}</small></td>
                      <td className="almacen-stock-operational">{operationalQty} <small>{item.unit}</small></td>
                      <td>${item.costPerUnit.toFixed(2)}</td>
                      <td className="almacen-total-value">${(item.quantity * item.costPerUnit).toFixed(2)}</td>
                      <td>
                        <span className={`badge-stock ${isLow ? 'low' : 'normal'}`}>
                          <span className="status-dot" />
                          {isLow ? 'Crítico' : 'Suficiente'}
                        </span>
                      </td>
                      <td>
                        <div className="almacen-actions">
                          {item.quantity > 0 && (
                            <button
                              type="button"
                              className="almacen-action-btn positive"
                              title="Transferir al Food Truck"
                              aria-label={`Transferir ${item.name} al Food Truck`}
                              onClick={() => {
                                setSelectedItemId(item.id)
                                setTransferQty(String(Math.min(10, item.quantity)))
                                setQuickAction('transfer')
                              }}
                            >
                              <ArrowRightLeft size={14} />
                            </button>
                          )}
                          <button type="button" className="almacen-action-btn" title="Ver movimientos" aria-label={`Ver movimientos de ${item.name}`} onClick={() => openView(item)}><Eye size={14} /></button>
                          <button type="button" className="almacen-action-btn" title="Editar insumo" aria-label={`Editar ${item.name}`} onClick={() => openEdit(item)}><Pencil size={14} /></button>
                          <button type="button" className="almacen-action-btn positive" title="Agregar inventario" aria-label={`Agregar inventario a ${item.name}`} onClick={() => openAdjustment(item, 1)}><Plus size={14} /></button>
                          <button type="button" className="almacen-action-btn negative" title="Descontar inventario" aria-label={`Descontar inventario de ${item.name}`} onClick={() => openAdjustment(item, -1)}><Minus size={14} /></button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          {displayedItems.length > 20 && <div className="almacen-pagination"><span>Mostrando {((currentPage - 1) * 20) + 1}–{Math.min(currentPage * 20, displayedItems.length)} de {displayedItems.length}</span><div><button type="button" disabled={currentPage === 1} onClick={() => setCurrentPage(page => page - 1)}>Anterior</button><b>Página {currentPage} de {totalPages}</b><button type="button" disabled={currentPage === totalPages} onClick={() => setCurrentPage(page => page + 1)}>Siguiente</button></div></div>}
        </section>
      </div>

      {selectedItem && modalMode && createPortal(<div className="almacen-modal-overlay" onClick={closeModal}><div className="almacen-action-modal" onClick={event => event.stopPropagation()}><button type="button" className="almacen-modal-close" onClick={closeModal} aria-label="Cerrar"><X size={16} /></button>
        {modalMode === 'view' && <><div className="almacen-modal-heading"><span><Eye size={18} /></span><div><small>Historial del insumo</small><h3>{selectedItem.name}</h3></div></div><div className="almacen-modal-stock"><small>Stock actual</small><strong>{selectedItem.quantity} {selectedItem.unit}</strong></div>{modalLoading ? <p className="almacen-modal-empty">Cargando movimientos…</p> : itemMovements.length === 0 ? <p className="almacen-modal-empty">Este insumo todavía no tiene movimientos.</p> : <div className="almacen-history-list">{itemMovements.map(movement => <div className="almacen-history-row" key={movement.id}><div><strong>{movement.movementType === 'purchase' ? 'Entrada' : movement.movementType === 'consumption' ? 'Salida' : 'Ajuste'}</strong><small>{movement.notes || movement.referenceType || 'Sin motivo'}</small></div><b className={movement.quantity > 0 ? 'positive' : 'negative'}>{movement.quantity > 0 ? '+' : ''}{movement.quantity} {movement.unitSymbol}</b></div>)}</div>}</>}
        {modalMode === 'edit' && <form onSubmit={saveEdit}><div className="almacen-modal-heading"><span><Pencil size={18} /></span><div><small>Editar insumo</small><h3>{selectedItem.name}</h3></div></div><div className="almacen-modal-fields"><label>Nombre<input value={editForm.name} onChange={event => setEditForm(form => ({ ...form, name: event.target.value }))} /></label><label>Costo por unidad (USD)<input type="number" min="0" step="0.01" value={editForm.price} onChange={event => setEditForm(form => ({ ...form, price: event.target.value }))} /></label><label>Clasificación<select value={editForm.inventoryClass} onChange={event => setEditForm(form => ({ ...form, inventoryClass: event.target.value as Ingredient['inventoryClass'] }))}><option value="raw_material">Materia prima</option><option value="packaging">Empaque</option><option value="beverage">Bebida</option><option value="non_inventory">No inventariable</option></select></label></div><button className="btn-primary-red" disabled={modalLoading}>{modalLoading ? <Loader2 className="spin" size={17} /> : <Save size={17} />} Guardar cambios</button></form>}
        {modalMode === 'adjust' && <form onSubmit={saveAdjustment}><div className="almacen-modal-heading"><span className={adjustment.direction > 0 ? 'positive' : 'negative'}>{adjustment.direction > 0 ? <Plus size={18} /> : <Minus size={18} />}</span><div><small>{adjustment.direction > 0 ? 'Agregar al inventario' : 'Descontar del inventario'}</small><h3>{selectedItem.name}</h3></div></div><div className="almacen-modal-stock"><small>Stock actual</small><strong>{selectedItem.quantity} {selectedItem.unit}</strong></div><div className="almacen-modal-fields"><label>Cantidad ({selectedItem.unit})<input autoFocus type="number" min="0.001" step="0.001" value={adjustment.quantity} onChange={event => setAdjustment(value => ({ ...value, quantity: event.target.value }))} placeholder="0.000" /></label><label>Motivo del ajuste<textarea value={adjustment.notes} onChange={event => setAdjustment(value => ({ ...value, notes: event.target.value }))} placeholder="Ej. conteo físico, merma, recepción manual…" /></label></div><button className={`btn-primary-red ${adjustment.direction < 0 ? 'danger' : ''}`} disabled={modalLoading}>{modalLoading ? <Loader2 className="spin" size={17} /> : adjustment.direction > 0 ? <Plus size={17} /> : <Minus size={17} />} {adjustment.direction > 0 ? 'Registrar entrada' : 'Registrar salida'}</button></form>}
      </div></div>, document.body)}

      {quickAction && createPortal(<div className="almacen-modal-overlay" onClick={() => setQuickAction(null)}><div className="almacen-action-modal" onClick={event => event.stopPropagation()}><button type="button" className="almacen-modal-close" onClick={() => setQuickAction(null)} aria-label="Cerrar"><X size={16} /></button>
        {quickAction === 'receive' && <form onSubmit={handleReceiveToWarehouse}><div className="almacen-modal-heading"><span><Package size={18} /></span><div><small>Transferencia interna</small><h3>Traer desde inventario</h3></div></div><p className="almacen-card-description">Mueve existencias del inventario operativo al almacén. No genera una compra.</p><div className="almacen-modal-fields"><label>Producto de inventario<StyledSelect value={selectedOperationalItemId} onChange={event => setSelectedOperationalItemId(event.target.value)}>{operationalItems.map(item => <option key={item.id} value={item.id}>{item.name} · {item.quantity} {item.unit} disponibles</option>)}</StyledSelect></label><label>Cantidad<NumberStepper min={0.001} step={0.001} value={warehouseQty} onChange={setWarehouseQty} /></label></div><button type="submit" className="btn-primary-red" disabled={!selectedOperationalItemId}><ArrowRightLeft size={17} /> Traer al almacén</button></form>}
        {quickAction === 'transfer' && <form onSubmit={handleTransfer}><div className="almacen-modal-heading"><span className="positive"><ArrowRightLeft size={18} /></span><div><small>Transferencia interna</small><h3>Enviar a inventario</h3></div></div><p className="almacen-card-description">Despacha existencias del almacén al inventario operativo del Food Truck.</p><div className="almacen-modal-fields"><label>Producto de almacén<StyledSelect value={selectedItemId} onChange={event => setSelectedItemId(event.target.value)}>{items.map(item => <option key={item.id} value={item.id}>{item.name} · {item.quantity} {item.unit} disponibles</option>)}</StyledSelect></label><label>Cantidad<NumberStepper min={0.001} step={0.001} value={transferQty} onChange={setTransferQty} /></label></div><button type="submit" className="btn-primary-red" disabled={!selectedItemId}><ArrowRightLeft size={17} /> Enviar a inventario</button></form>}
        {quickAction === 'critical' && <><div className="almacen-modal-heading"><span className="negative"><AlertTriangle size={18} /></span><div><small>Revisión de existencias</small><h3>Stock crítico</h3></div></div><p className="almacen-card-description">Insumos en almacén con existencia igual o menor al mínimo configurado.</p>{items.filter(item => item.quantity <= item.minStock).length === 0 ? <p className="almacen-modal-empty">No hay insumos en estado crítico.</p> : <div className="almacen-history-list">{items.filter(item => item.quantity <= item.minStock).map(item => <div className="almacen-history-row" key={item.id}><div><strong>{item.name}</strong><small>Existencia actual</small></div><b className="negative">{item.quantity} {item.unit}</b></div>)}</div>}</>}
      </div></div>, document.body)}
    </div>
  )
}
