import { useCallback, useEffect, useState, useMemo, type FormEvent } from 'react'
import { createPortal } from 'react-dom'
import { useAuth } from '../context/auth-context'
import { AlertTriangle, ArrowDownToLine, ArrowRightLeft, ArrowUpFromLine, Package, Plus, Warehouse, Eye, Pencil, Minus, X, Save, Loader2, Search } from 'lucide-react'
import { adjustStock, getIngredients, getWarehouseIngredients, getStockMovements, getUnits, transferStock, updateIngredient, updateIngredientCost, type Ingredient, type StockMovement } from '../lib/dataService'
import { StyledSelect } from '../components/StyledSelect'
import Toast from '../components/Toast'
import NumberStepper from '../components/NumberStepper'
import { EmptyState } from '../components/EmptyState'
import { PageSkeleton } from '../components/PageSkeleton'
import { LoadingSkeleton } from '../components/LoadingSkeleton'
import { normalizeForSearch } from '../lib/textFormat'
import { formatUsdPrecise } from '../lib/money'
import './Almacen.css'
import { useLiveDataRefresh } from '../lib/liveDataRefresh'

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
  const [operationalItemsLoaded, setOperationalItemsLoaded] = useState(false)
  const [editForm, setEditForm] = useState({ name: '', inventoryClass: 'raw_material' as Ingredient['inventoryClass'], price: '' })
  const [adjustment, setAdjustment] = useState({ direction: 1 as 1 | -1, quantity: '', notes: '' })
  const [modalLoading, setModalLoading] = useState(false)
  const [quickAction, setQuickAction] = useState<QuickAction>(null)
  const [closingItemModal, setClosingItemModal] = useState(false)
  const [closingQuickAction, setClosingQuickAction] = useState(false)
  const [loading, setLoading] = useState(true)
  const [currentPage, setCurrentPage] = useState(1)

  const closeModal = () => {
    if (modalLoading || closingItemModal) return
    setClosingItemModal(true)
    window.setTimeout(() => {
      setSelectedItem(null)
      setModalMode(null)
      setClosingItemModal(false)
    }, 200)
  }
  const closeQuickAction = () => {
    if (!quickAction || closingQuickAction) return
    setClosingQuickAction(true)
    window.setTimeout(() => {
      setQuickAction(null)
      setClosingQuickAction(false)
    }, 200)
  }
  useEffect(() => {
    if (!quickAction) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = previousOverflow }
  }, [quickAction])
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
  const pageSize = 10
  const totalPages = Math.max(1, Math.ceil(displayedItems.length / pageSize))
  const paginatedItems = displayedItems.slice((currentPage - 1) * pageSize, currentPage * pageSize)
  useEffect(() => { setCurrentPage(1) }, [filterMode, searchTerm])

  const refreshAll = useCallback(async (silent = false) => {
    const warehouseLoad = getWarehouseIngredients().then(ingredients => {
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
    }).catch(error => {
      setErrorMsg(error instanceof Error ? error.message : 'No se pudo cargar el almacén')
    })

    const operationalLoad = getIngredients().then(operational => {
      const mapItem = (item: Ingredient): WarehouseItem => ({ id: item.id, unitId: item.unitId, name: item.name, category: 'Insumo', quantity: item.currentStock, costPerUnit: item.pricePerUnit ?? 0, minStock: 0, unit: item.unitSymbol, inventoryClass: item.inventoryClass })
      const operationalMapped = operational.map(mapItem)
      setOperationalItems(operationalMapped)
      setOperationalItemsLoaded(true)
      setSelectedOperationalItemId(current => current || operationalMapped[0]?.id || '')
    }).catch(error => {
      setErrorMsg(error instanceof Error ? error.message : 'No se pudo cargar el almacén')
    })

    // The warehouse table is the primary content. Reveal it as soon as its
    // query finishes instead of making it wait for the secondary stock view.
    if (!silent) await warehouseLoad.finally(() => setLoading(false))
    await Promise.all([warehouseLoad, operationalLoad])
  }, [])
  useEffect(() => { void refreshAll() }, [refreshAll])
  useLiveDataRefresh('almacen', () => refreshAll(true))

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
            <h1 className="page-title"><Warehouse size={22} className="page-title-icon" /> Almacén principal</h1>
            <p>
              Lo que está guardado antes de ir al Food Truck.
            </p>
          </div>
        </div>
      </header>

      {successMsg && <Toast type="success" message={successMsg} onClose={() => setSuccessMsg('')} />}
      {errorMsg && <Toast type="error" message={errorMsg} onClose={() => setErrorMsg('')} />}

      <section className="alm-moves" aria-label="Mover insumos">
        <button type="button" className="alm-move" onClick={() => setQuickAction('receive')}>
          <span><ArrowDownToLine size={22} aria-hidden="true" /></span>
          <strong>Traer al almacén</strong>
          <small>Desde el Food Truck</small>
        </button>
        <button type="button" className="alm-move primary" onClick={() => setQuickAction('transfer')}>
          <span><ArrowUpFromLine size={22} aria-hidden="true" /></span>
          <strong>Enviar al Food Truck</strong>
          <small>Desde el almacén</small>
        </button>
      </section>

      <section className="alm-summary" aria-label="Resumen del almacén">
        <div><strong>{itemsWithStock.length}<em> de {items.length}</em></strong><span>Insumos con stock</span></div>
        <div><strong>${totalValuation.toFixed(2)}</strong><span>Valor guardado</span></div>
        <button type="button" onClick={() => setQuickAction('critical')}><strong>{criticalItems}</strong><span>Agotados ›</span></button>
      </section>

      <section className="alm-products" aria-label="Productos en almacén">
        <div className="alm-toolbar">
          <div className="alm-segment" role="tablist" aria-label="Filtrar insumos">
            <button type="button" role="tab" aria-selected={filterMode === 'stock'} onClick={() => setFilterMode('stock')}>Con stock <small>{itemsWithStock.length}</small></button>
            <button type="button" role="tab" aria-selected={filterMode === 'all'} onClick={() => setFilterMode('all')}>Todos <small>{items.length}</small></button>
          </div>
          <label className="alm-search">
            <Search size={17} aria-hidden="true" />
            <input type="text" aria-label="Buscar insumo" placeholder="Buscar insumo..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
          </label>
        </div>

        {displayedItems.length === 0 ? (
          <EmptyState
            compact
            title={searchTerm ? 'No se encontraron insumos' : filterMode === 'stock' ? 'No hay insumos con existencias en almacén' : 'No hay insumos registrados'}
            description={searchTerm ? `No hay resultados para "${searchTerm}".` : filterMode === 'stock' ? 'Usa "Traer al almacén" o cambia a "Todos".' : 'Agrega tu primer insumo para empezar a llevar el inventario.'}
            actionLabel={searchTerm ? 'Limpiar búsqueda' : filterMode === 'stock' ? 'Traer al almacén' : undefined}
            onAction={searchTerm ? () => setSearchTerm('') : filterMode === 'stock' ? () => setQuickAction('receive') : undefined}
          />
        ) : (
          <ul className="alm-list">
            {paginatedItems.map(item => {
              const isLow = item.quantity <= item.minStock
              const operationalQty = operationalStockMap.get(item.id) ?? 0
              return (
                <li key={item.id} className="alm-card">
                  <header>
                    <h3>{item.name}</h3>
                    <span className={`alm-badge${isLow ? ' low' : ''}`}>{isLow ? 'Agotado' : 'Disponible'}</span>
                  </header>
                  <div className="alm-stocks">
                    <div className="main"><span>En almacén</span><strong>{item.quantity} <small>{item.unit}</small></strong></div>
                    <div><span>En Food Truck</span><strong>{operationalItemsLoaded ? <>{operationalQty} <small>{item.unit}</small></> : '…'}</strong></div>
                  </div>
                  <p className="alm-cost">Costo {formatUsdPrecise(item.costPerUnit)} por {item.unit} · Valor <b>${(item.quantity * item.costPerUnit).toFixed(2)}</b></p>
                  <div className="alm-actions">
                    {item.quantity > 0 && (
                      <button type="button" className="send" aria-label={`Transferir ${item.name} al Food Truck`} onClick={() => { setSelectedItemId(item.id); setTransferQty(String(Math.min(10, item.quantity))); setQuickAction('transfer') }}><ArrowUpFromLine size={16} /> Enviar al Food Truck</button>
                    )}
                    <button type="button" className="add" aria-label={`Agregar inventario a ${item.name}`} onClick={() => openAdjustment(item, 1)}><Plus size={16} /> Agregar</button>
                    <button type="button" className="sub" aria-label={`Descontar inventario de ${item.name}`} onClick={() => openAdjustment(item, -1)}><Minus size={16} /> Descontar</button>
                    <button type="button" aria-label={`Ver movimientos de ${item.name}`} onClick={() => openView(item)}><Eye size={15} /> Historial</button>
                    <button type="button" aria-label={`Editar ${item.name}`} onClick={() => openEdit(item)}><Pencil size={15} /> Editar</button>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
        {displayedItems.length > pageSize && <div className="almacen-pagination"><span>Mostrando {((currentPage - 1) * pageSize) + 1}–{Math.min(currentPage * pageSize, displayedItems.length)} de {displayedItems.length}</span><div><button type="button" disabled={currentPage === 1} onClick={() => setCurrentPage(page => page - 1)}>Anterior</button><b>Página {currentPage} de {totalPages}</b><button type="button" disabled={currentPage === totalPages} onClick={() => setCurrentPage(page => page + 1)}>Siguiente</button></div></div>}
      </section>

      {selectedItem && modalMode && createPortal(<div className={`almacen-modal-overlay ${closingItemModal ? 'closing' : ''}`} onClick={closeModal}><div className={`almacen-action-modal ${modalMode === 'view' ? 'almacen-history-modal' : ''}`} onClick={event => event.stopPropagation()}><button type="button" className="almacen-modal-close" onClick={closeModal} aria-label="Cerrar"><X size={16} /></button>
        {modalMode === 'view' && <><div className="almacen-modal-heading"><span><Eye size={18} /></span><div><small>Historial del insumo</small><h3>{selectedItem.name}</h3></div></div><div className="almacen-modal-stock"><small>Stock actual</small><strong>{selectedItem.quantity} {selectedItem.unit}</strong></div>{modalLoading ? <LoadingSkeleton label="Cargando movimientos del insumo" count={4} /> : itemMovements.length === 0 ? <p className="almacen-modal-empty">Este insumo todavía no tiene movimientos.</p> : <div className="almacen-history-list">{itemMovements.map(movement => <div className="almacen-history-row" key={movement.id}><div className="almacen-history-main"><div className="almacen-history-title"><span className={`almacen-history-kind ${movement.quantity > 0 ? 'positive' : 'negative'}`}>{movement.quantity > 0 ? <Plus size={13} /> : <Minus size={13} />}</span><strong>{movement.movementType === 'purchase' ? 'Entrada' : movement.movementType === 'consumption' ? 'Salida' : 'Ajuste'}</strong></div><small>{movement.notes || movement.referenceType || 'Sin motivo'}</small><time>{new Date(movement.createdAt).toLocaleString('es-VE', { dateStyle: 'short', timeStyle: 'short', hour12: true })}</time></div><b className={movement.quantity > 0 ? 'positive' : 'negative'}>{movement.quantity > 0 ? '+' : ''}{movement.quantity} {movement.unitSymbol}</b></div>)}</div>}</>}
        {modalMode === 'edit' && <form onSubmit={saveEdit}><div className="almacen-modal-heading"><span><Pencil size={18} /></span><div><small>Editar insumo</small><h3>{selectedItem.name}</h3></div></div><div className="almacen-modal-fields"><label>Nombre<input value={editForm.name} onChange={event => setEditForm(form => ({ ...form, name: event.target.value }))} /></label><label>Costo por unidad (USD)<input type="number" min="0" step="0.01" value={editForm.price} onChange={event => setEditForm(form => ({ ...form, price: event.target.value }))} /></label><label>Clasificación<select value={editForm.inventoryClass} onChange={event => setEditForm(form => ({ ...form, inventoryClass: event.target.value as Ingredient['inventoryClass'] }))}><option value="raw_material">Materia prima</option><option value="packaging">Empaque</option><option value="beverage">Bebida</option><option value="non_inventory">No inventariable</option></select></label></div><button className="btn-primary-red" disabled={modalLoading}>{modalLoading ? <Loader2 className="spin" size={17} /> : <Save size={17} />} Guardar cambios</button></form>}
        {modalMode === 'adjust' && <form onSubmit={saveAdjustment}><div className="almacen-modal-heading"><span className={adjustment.direction > 0 ? 'positive' : 'negative'}>{adjustment.direction > 0 ? <Plus size={18} /> : <Minus size={18} />}</span><div><small>{adjustment.direction > 0 ? 'Agregar al inventario' : 'Descontar del inventario'}</small><h3>{selectedItem.name}</h3></div></div><div className="almacen-modal-stock"><small>Stock actual</small><strong>{selectedItem.quantity} {selectedItem.unit}</strong></div><div className="almacen-modal-fields"><label>Cantidad ({selectedItem.unit})<input autoFocus type="number" min="0" step="any" value={adjustment.quantity} onChange={event => setAdjustment(value => ({ ...value, quantity: event.target.value }))} placeholder="Cantidad" /></label><label>Motivo del ajuste<textarea value={adjustment.notes} onChange={event => setAdjustment(value => ({ ...value, notes: event.target.value }))} placeholder="Ej. conteo físico, merma, recepción manual…" /></label></div><button className={`btn-primary-red ${adjustment.direction < 0 ? 'danger' : ''}`} disabled={modalLoading}>{modalLoading ? <Loader2 className="spin" size={17} /> : adjustment.direction > 0 ? <Plus size={17} /> : <Minus size={17} />} {adjustment.direction > 0 ? 'Registrar entrada' : 'Registrar salida'}</button></form>}
      </div></div>, document.body)}

      {quickAction && createPortal(<div className={`almacen-modal-overlay ${closingQuickAction ? 'closing' : ''}`} onClick={closeQuickAction}><div className="almacen-action-modal" onClick={event => event.stopPropagation()}><button type="button" className="almacen-modal-close" onClick={closeQuickAction} aria-label="Cerrar"><X size={16} /></button>
        {quickAction === 'receive' && <form onSubmit={handleReceiveToWarehouse}><div className="almacen-modal-heading"><span><Package size={18} /></span><div><small>Del Food Truck al almacén</small><h3>Traer al almacén</h3></div></div><p className="almacen-card-description">Elige el producto y cuánto vas a guardar. No cuenta como compra.</p>{!operationalItemsLoaded && <LoadingSkeleton label="Cargando existencias del inventario" variant="inline" />}<div className="almacen-modal-fields transfer-modal-fields"><label>Producto del Food Truck<StyledSelect value={selectedOperationalItemId} onChange={event => setSelectedOperationalItemId(event.target.value)}>{operationalItems.map(item => <option key={item.id} value={item.id}>{item.name} · {item.quantity} {item.unit} disponibles</option>)}</StyledSelect></label><label>Cantidad<NumberStepper hideControls min={0.001} step={0.001} value={warehouseQty} onChange={setWarehouseQty} /></label></div><button type="submit" className="btn-primary-red" disabled={!selectedOperationalItemId || !operationalItemsLoaded}><ArrowRightLeft size={17} /> Traer al almacén</button></form>}
        {quickAction === 'transfer' && <form onSubmit={handleTransfer}><div className="almacen-modal-heading"><span className="positive"><ArrowRightLeft size={18} /></span><div><small>Del almacén al Food Truck</small><h3>Enviar al Food Truck</h3></div></div><p className="almacen-card-description">Elige el producto y cuánto sale del almacén.</p><div className="almacen-modal-fields transfer-modal-fields"><label>Producto de almacén<StyledSelect value={selectedItemId} onChange={event => setSelectedItemId(event.target.value)}>{items.map(item => <option key={item.id} value={item.id}>{item.name} · {item.quantity} {item.unit} disponibles</option>)}</StyledSelect></label><label>Cantidad<NumberStepper hideControls min={0.001} step={0.001} value={transferQty} onChange={setTransferQty} /></label></div><button type="submit" className="btn-primary-red" disabled={!selectedItemId}><ArrowRightLeft size={17} /> Enviar al Food Truck</button></form>}
        {quickAction === 'critical' && <><div className="almacen-modal-heading"><span className="negative"><AlertTriangle size={18} /></span><div><small>Revisión de existencias</small><h3>Insumos agotados</h3></div></div><p className="almacen-card-description">No quedan unidades de estos insumos en el almacén.</p>{items.filter(item => item.quantity <= item.minStock).length === 0 ? <p className="almacen-modal-empty">No hay insumos agotados.</p> : <div className="almacen-critical-list"><div className="almacen-critical-header"><span>Insumo</span><span>Existencia actual</span></div><div className="almacen-history-list">{items.filter(item => item.quantity <= item.minStock).map(item => <div className="almacen-history-row" key={item.id}><div><strong>{item.name}</strong></div><b className="negative">{item.quantity} {item.unit}</b></div>)}</div></div>}</>}
      </div></div>, document.body)}
    </div>
  )
}
