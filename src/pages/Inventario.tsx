import { useState, useMemo } from 'react'
import { useDemoData } from '../context/demo-data-context'
import { useAuth } from '../context/auth-context'
import type { Ingredient } from '../lib/demoData'
import './Inventario.css'

type Tab = 'ingredients' | 'products' | 'movements'

export function Inventario() {
  const { ingredients, products, stockMovements, adjustStock, addIngredient, updateIngredient, deleteIngredient } = useDemoData()
  const { user } = useAuth()
  const [tab, setTab] = useState<Tab>('ingredients')
  const [searchTerm, setSearchTerm] = useState('')
  const [showAddForm, setShowAddForm] = useState(false)
  const [editingItem, setEditingItem] = useState<Ingredient | null>(null)
  const [adjustModal, setAdjustModal] = useState<Ingredient | null>(null)
  const [adjustAmount, setAdjustAmount] = useState('')
  const [adjustReason, setAdjustReason] = useState('')

  const showCosts = user?.role === 'owner' || user?.role === 'manager'

  const [newItem, setNewItem] = useState({
    name: '', stock: 0, unit: 'und', minStock: 5, costPerUnit: 0
  })

  const filteredIngredients = useMemo(() =>
    ingredients.filter(i => i.name.toLowerCase().includes(searchTerm.toLowerCase())),
    [ingredients, searchTerm]
  )

  const filteredProducts = useMemo(() =>
    products.filter(p => p.name.toLowerCase().includes(searchTerm.toLowerCase())),
    [products, searchTerm]
  )

  const recentMovements = useMemo(() =>
    stockMovements.slice(0, 20),
    [stockMovements]
  )

  const lowStockCount = ingredients.filter(i => i.stock <= i.minStock).length

  const handleAddItem = () => {
    if (!newItem.name.trim()) return
    addIngredient(newItem)
    setNewItem({ name: '', stock: 0, unit: 'und', minStock: 5, costPerUnit: 0 })
    setShowAddForm(false)
  }

  const handleUpdateItem = () => {
    if (!editingItem) return
    updateIngredient(editingItem.id, editingItem)
    setEditingItem(null)
  }

  const handleDeleteItem = (id: string) => {
    if (confirm('¿Eliminar este ingrediente?')) {
      deleteIngredient(id)
    }
  }

  const handleAdjust = () => {
    if (!adjustModal || !adjustAmount || !adjustReason) return
    adjustStock(adjustModal.id, parseInt(adjustAmount), adjustReason)
    setAdjustModal(null)
    setAdjustAmount('')
    setAdjustReason('')
  }

  return (
    <div className="page animate-fade-in">
      <header className="page-header">
        <div>
          <h1 className="page-title text-gradient">Inventario</h1>
          <p className="page-subtitle">
            Ingredientes, productos y movimientos
            {lowStockCount > 0 && <span className="low-stock-badge">⚠️ {lowStockCount} bajo stock</span>}
          </p>
        </div>
      </header>

      <div className="tabs">
        <button className={`tab ${tab === 'ingredients' ? 'active' : ''}`} onClick={() => setTab('ingredients')}>
          🧄 Ingredientes ({ingredients.length})
        </button>
        <button className={`tab ${tab === 'products' ? 'active' : ''}`} onClick={() => setTab('products')}>
          🍔 Productos ({products.length})
        </button>
        <button className={`tab ${tab === 'movements' ? 'active' : ''}`} onClick={() => setTab('movements')}>
          📦 Movimientos ({stockMovements.length})
        </button>
      </div>

      {tab === 'ingredients' && (
        <div className="card">
          <div className="inventory-toolbar">
            <input
              type="text"
              placeholder="Buscar ingrediente..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="search-input"
            />
            {showCosts && (
              <button className="btn-accent btn-sm" onClick={() => setShowAddForm(true)}>
                + Nuevo
              </button>
            )}
          </div>

          {showAddForm && (
            <div className="add-form animate-slide-up">
              <h3 className="form-title">Nuevo ingrediente</h3>
              <div className="form-grid">
                <input
                  type="text"
                  placeholder="Nombre"
                  value={newItem.name}
                  onChange={(e) => setNewItem({ ...newItem, name: e.target.value })}
                />
                <input
                  type="number"
                  placeholder="Stock inicial"
                  value={newItem.stock || ''}
                  onChange={(e) => setNewItem({ ...newItem, stock: parseInt(e.target.value) || 0 })}
                />
                <select value={newItem.unit} onChange={(e) => setNewItem({ ...newItem, unit: e.target.value })}>
                  <option value="und">Unidad</option>
                  <option value="lb">Libra</option>
                  <option value="litro">Litro</option>
                  <option value="botella">Botella</option>
                  <option value="kg">Kilogramo</option>
                </select>
                <input
                  type="number"
                  placeholder="Stock mínimo"
                  value={newItem.minStock || ''}
                  onChange={(e) => setNewItem({ ...newItem, minStock: parseInt(e.target.value) || 0 })}
                />
                <input
                  type="number"
                  step="0.01"
                  placeholder="Costo unitario"
                  value={newItem.costPerUnit || ''}
                  onChange={(e) => setNewItem({ ...newItem, costPerUnit: parseFloat(e.target.value) || 0 })}
                />
              </div>
              <div className="form-actions">
                <button className="btn-ghost" onClick={() => setShowAddForm(false)}>Cancelar</button>
                <button className="btn-accent" onClick={handleAddItem}>Guardar</button>
              </div>
            </div>
          )}

          <div className="table-container">
            <table className="inventory-table">
              <thead>
                <tr>
                  <th>Ingrediente</th>
                  <th>Stock</th>
                  <th>Unidad</th>
                  <th>Mínimo</th>
                  {showCosts && <th>Costo/u</th>}
                  {showCosts && <th>Valor</th>}
                  <th>Estado</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filteredIngredients.map(ingredient => {
                  const isLow = ingredient.stock <= ingredient.minStock
                  return (
                    <tr key={ingredient.id} className={isLow ? 'low-stock' : ''}>
                      <td className="name-cell">{ingredient.name}</td>
                      <td className="stock-cell">{ingredient.stock}</td>
                      <td>{ingredient.unit}</td>
                      <td>{ingredient.minStock}</td>
                      {showCosts && <td className="cost-cell">${ingredient.costPerUnit.toFixed(2)}</td>}
                      {showCosts && <td className="cost-cell">${(ingredient.stock * ingredient.costPerUnit).toFixed(2)}</td>}
                      <td>
                        {isLow ? (
                          <span className="badge badge-danger">Bajo</span>
                        ) : (
                          <span className="badge badge-ok">OK</span>
                        )}
                      </td>
                      <td className="actions-cell">
                        <button
                          className="action-btn adjust"
                          onClick={() => setAdjustModal(ingredient)}
                          title="Ajustar stock"
                        >
                          ±
                        </button>
                        {showCosts && (
                          <>
                            <button
                              className="action-btn edit"
                              onClick={() => setEditingItem(ingredient)}
                              title="Editar"
                            >
                              ✏️
                            </button>
                            <button
                              className="action-btn delete"
                              onClick={() => handleDeleteItem(ingredient.id)}
                              title="Eliminar"
                            >
                              🗑️
                            </button>
                          </>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'products' && (
        <div className="card">
          <div className="inventory-toolbar">
            <input
              type="text"
              placeholder="Buscar producto..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="search-input"
            />
          </div>
          <div className="table-container">
            <table className="inventory-table">
              <thead>
                <tr>
                  <th>Producto</th>
                  <th>Categoría</th>
                  <th>Precio</th>
                  {showCosts && <th>Costo</th>}
                  {showCosts && <th>Margen</th>}
                  {showCosts && <th>Ganancia</th>}
                </tr>
              </thead>
              <tbody>
                {filteredProducts.map(product => {
                  const margin = ((product.price - product.cost) / product.price * 100)
                  return (
                    <tr key={product.id}>
                      <td className="name-cell">
                        <span className="product-emoji-cell">{product.emoji}</span>
                        {product.name}
                      </td>
                      <td>
                        <span className={`badge badge-${product.category}`}>
                          {product.category === 'food' ? 'Comida' :
                           product.category === 'drink' ? 'Bebida' : 'Postre'}
                        </span>
                      </td>
                      <td className="price-cell">${product.price.toFixed(2)}</td>
                      {showCosts && <td className="cost-cell">${product.cost.toFixed(2)}</td>}
                      {showCosts && <td className="margin-cell">{margin.toFixed(0)}%</td>}
                      {showCosts && <td className="profit-cell">${(product.price - product.cost).toFixed(2)}</td>}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'movements' && (
        <div className="card">
          <h2 className="card-title">Historial de movimientos</h2>
          {recentMovements.length === 0 ? (
            <p className="empty-message">No hay movimientos registrados</p>
          ) : (
            <div className="table-container">
              <table className="inventory-table">
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Ingrediente</th>
                    <th>Tipo</th>
                    <th>Cantidad</th>
                    <th>Motivo</th>
                  </tr>
                </thead>
                <tbody>
                  {recentMovements.map(movement => {
                    const ingredient = ingredients.find(i => i.id === movement.ingredientId)
                    return (
                      <tr key={movement.id}>
                        <td className="date-cell">
                          {new Date(movement.createdAt).toLocaleString('es', {
                            day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
                          })}
                        </td>
                        <td className="name-cell">{ingredient?.name || '-'}</td>
                        <td>
                          <span className={`movement-type type-${movement.type}`}>
                            {movement.type === 'entry' ? '📥 Entrada' :
                             movement.type === 'exit' ? '📤 Salida' : '🔄 Ajuste'}
                          </span>
                        </td>
                        <td className={`amount-cell ${movement.type === 'entry' ? 'positive' : 'negative'}`}>
                          {movement.type === 'entry' ? '+' : '-'}{movement.amount}
                        </td>
                        <td className="reason-cell">{movement.reason}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {adjustModal && (
        <div className="modal-overlay" onClick={() => setAdjustModal(null)}>
          <div className="modal animate-slide-up" onClick={(e) => e.stopPropagation()}>
            <h3 className="modal-title">Ajustar stock</h3>
            <p className="modal-subtitle">{adjustModal.name} · Actual: {adjustModal.stock} {adjustModal.unit}</p>
            <div className="adjust-quick-btns">
              {[-5, -3, -1, 1, 3, 5, 10].map(val => (
                <button
                  key={val}
                  className={`adjust-quick-btn ${val > 0 ? 'positive' : 'negative'}`}
                  onClick={() => setAdjustAmount(String(val))}
                >
                  {val > 0 ? '+' : ''}{val}
                </button>
              ))}
            </div>
            <input
              type="number"
              placeholder="Cantidad (+ entrada, - salida)"
              value={adjustAmount}
              onChange={(e) => setAdjustAmount(e.target.value)}
            />
            <input
              type="text"
              placeholder="Motivo (ej: Compra proveedor)"
              value={adjustReason}
              onChange={(e) => setAdjustReason(e.target.value)}
            />
            <div className="modal-actions">
              <button className="btn-ghost" onClick={() => setAdjustModal(null)}>Cancelar</button>
              <button
                className="btn-accent"
                onClick={handleAdjust}
                disabled={!adjustAmount || !adjustReason}
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}

      {editingItem && (
        <div className="modal-overlay" onClick={() => setEditingItem(null)}>
          <div className="modal animate-slide-up" onClick={(e) => e.stopPropagation()}>
            <h3 className="modal-title">Editar ingrediente</h3>
            <div className="form-grid">
              <input
                type="text"
                placeholder="Nombre"
                value={editingItem.name}
                onChange={(e) => setEditingItem({ ...editingItem, name: e.target.value })}
              />
              <input
                type="number"
                placeholder="Stock"
                value={editingItem.stock}
                onChange={(e) => setEditingItem({ ...editingItem, stock: parseInt(e.target.value) || 0 })}
              />
              <select
                value={editingItem.unit}
                onChange={(e) => setEditingItem({ ...editingItem, unit: e.target.value })}
              >
                <option value="und">Unidad</option>
                <option value="lb">Libra</option>
                <option value="litro">Litro</option>
                <option value="botella">Botella</option>
                <option value="kg">Kilogramo</option>
              </select>
              <input
                type="number"
                placeholder="Stock mínimo"
                value={editingItem.minStock}
                onChange={(e) => setEditingItem({ ...editingItem, minStock: parseInt(e.target.value) || 0 })}
              />
              <input
                type="number"
                step="0.01"
                placeholder="Costo unitario"
                value={editingItem.costPerUnit}
                onChange={(e) => setEditingItem({ ...editingItem, costPerUnit: parseFloat(e.target.value) || 0 })}
              />
            </div>
            <div className="modal-actions">
              <button className="btn-ghost" onClick={() => setEditingItem(null)}>Cancelar</button>
              <button className="btn-accent" onClick={handleUpdateItem}>Guardar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
