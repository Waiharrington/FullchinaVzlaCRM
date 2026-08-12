import { useEffect, useState, useCallback } from 'react'
import {
  getRecipeComponents, getSellableProducts, createRecipeComponent, deleteRecipeComponent,
  getIngredients, getUnits,
  type RecipeComponent, type SellableProduct, type Ingredient,
} from '../lib/dataService'
import { MoneyWithBcv } from '../components/MoneyWithBcv'
import { Plus, Trash2, CheckCircle2, AlertTriangle, Loader2 } from 'lucide-react'

export function RecetasReal() {
  const [products, setProducts] = useState<SellableProduct[]>([])
  const [selected, setSelected] = useState<SellableProduct | null>(null)
  const [components, setComponents] = useState<RecipeComponent[]>([])
  const [ingredients, setIngredients] = useState<Ingredient[]>([])
  const [units, setUnits] = useState<Array<{ id: string; name: string; symbol: string }>>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  // Add component form
  const [showAdd, setShowAdd] = useState(false)
  const [addIngredientId, setAddIngredientId] = useState('')
  const [addQuantity, setAddQuantity] = useState('1')
  const [addUnitId, setAddUnitId] = useState('')

  const loadProducts = useCallback(async () => {
    try {
      setLoading(true)
      const [prods, ingr, un] = await Promise.all([
        getSellableProducts(),
        getIngredients(),
        getUnits(),
      ])
      setProducts(prods)
      setIngredients(ingr)
      setUnits(un)
      if (prods.length > 0) setSelected(prods[0])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error cargando recetas')
    } finally {
      setLoading(false)
    }
  }, [])

  const loadComponents = useCallback(async () => {
    if (!selected) return
    try {
      setComponents(await getRecipeComponents(selected.id))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error cargando componentes')
    }
  }, [selected])

  useEffect(() => { void loadProducts() }, [loadProducts])
  useEffect(() => { void loadComponents() }, [loadComponents])

  useEffect(() => {
    if (ingredients.length > 0 && !addIngredientId) {
      setAddIngredientId(ingredients[0].id)
      setAddUnitId(ingredients[0].unitId)
    }
  }, [ingredients, addIngredientId])

  const handleAddIngredientIdChange = (id: string) => {
    setAddIngredientId(id)
    const ingr = ingredients.find(x => x.id === id)
    if (ingr) setAddUnitId(ingr.unitId)
  }

  const handleAddComponent = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selected || !addIngredientId || !addQuantity || !addUnitId) return
    try {
      setError('')
      await createRecipeComponent({
        sellableProductId: selected.id,
        ingredientId: addIngredientId,
        quantity: parseFloat(addQuantity) || 1,
        unitId: addUnitId,
      })
      setNotice('Componente agregado')
      setShowAdd(false)
      setAddQuantity('1')
      await loadComponents()
      setTimeout(() => setNotice(''), 3000)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error agregando componente')
    }
  }

  const handleDeleteComponent = async (componentId: string) => {
    if (!confirm('¿Eliminar este componente de la receta?')) return
    try {
      setError('')
      await deleteRecipeComponent(componentId)
      setNotice('Componente eliminado')
      await loadComponents()
      setTimeout(() => setNotice(''), 3000)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error eliminando componente')
    }
  }

  if (loading) {
    return (
      <div className="page animate-fade-in">
        <div style={{ display: 'flex', justifyContent: 'center', padding: '64px 0' }}>
          <Loader2 size={32} className="animate-spin" style={{ color: '#ef4444' }} />
        </div>
      </div>
    )
  }

  return (
    <div className="page animate-fade-in">
      <header className="page-header">
        <div>
          <h1 className="page-title text-gradient">Recetas</h1>
          <p className="page-subtitle">Componentes e ingredientes por producto vendible</p>
        </div>
      </header>

      {error && (
        <div className="whatsapp-notice-banner" style={{ background: 'rgba(239,68,68,0.15)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)' }}>
          <AlertTriangle size={18} /> {error}
        </div>
      )}
      {notice && (
        <div className="whatsapp-notice-banner" style={{ background: 'rgba(16,185,129,0.15)', color: '#10b981', border: '1px solid rgba(16,185,129,0.3)' }}>
          <CheckCircle2 size={18} /> {notice}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(260px, 1fr) minmax(340px, 2fr)', gap: '18px' }}>
        {/* Product list */}
        <div className="card">
          <h2 className="card-title">Productos ({products.length})</h2>
          <div style={{ maxHeight: 620, overflow: 'auto' }}>
            {products.map(product => (
              <button
                type="button"
                key={product.id}
                onClick={() => { setSelected(product); setShowAdd(false) }}
                style={{
                  display: 'flex', width: '100%', justifyContent: 'space-between',
                  padding: '10px', background: selected?.id === product.id ? '#3b1111' : 'transparent',
                  color: '#fff', border: 0, borderBottom: '1px solid #292929', cursor: 'pointer',
                }}
              >
                <span>{product.emoji} {product.name}</span>
                <span>${product.salePrice.toFixed(2)}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Components */}
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <div>
              <h2 className="card-title" style={{ marginBottom: '4px' }}>{selected?.name ?? 'Selecciona un producto'}</h2>
              {selected && <MoneyWithBcv usd={selected.salePrice} compact />}
            </div>
            {selected && (
              <button
                className="btn-transfer-submit"
                style={{ margin: 0, padding: '8px 12px', fontSize: '12px' }}
                onClick={() => setShowAdd(!showAdd)}
              >
                {showAdd ? 'Cancelar' : <><Plus size={14} /> Agregar ingrediente</>}
              </button>
            )}
          </div>

          {/* Add form */}
          {showAdd && selected && (
            <form onSubmit={handleAddComponent} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', padding: '12px', marginBottom: '12px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 100px 100px', gap: '8px', alignItems: 'end' }}>
                <select value={addIngredientId} onChange={e => handleAddIngredientIdChange(e.target.value)}>
                  <option value="">Ingrediente...</option>
                  {ingredients.map(i => <option key={i.id} value={i.id}>{i.name} ({i.unitSymbol})</option>)}
                </select>
                <input type="number" step="any" min="0.01" placeholder="Cantidad" value={addQuantity} onChange={e => setAddQuantity(e.target.value)} required />
                <select value={addUnitId} onChange={e => setAddUnitId(e.target.value)}>
                  {units.map(u => <option key={u.id} value={u.id}>{u.symbol}</option>)}
                </select>
              </div>
              <div style={{ textAlign: 'right', marginTop: '8px' }}>
                <button type="submit" className="btn-transfer-submit" style={{ margin: 0, padding: '6px 12px', fontSize: '12px' }}>Guardar</button>
              </div>
            </form>
          )}

          {/* Components table */}
          <div className="table-responsive-wrapper">
            <table className="almacen-table">
              <thead>
                <tr>
                  <th>Ingrediente</th>
                  <th>Cantidad</th>
                  <th>Unidad</th>
                  <th>Costo/u</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {components.map(comp => (
                  <tr key={comp.id}>
                    <td>{comp.ingredientName ?? 'Preparación'}</td>
                    <td>{comp.quantity}</td>
                    <td>{comp.unitSymbol}</td>
                    <td>{comp.costPerUnit == null ? 'Sin costo' : `$${comp.costPerUnit.toFixed(2)}`}</td>
                    <td>
                      {comp.ingredientId && (
                        <button
                          onClick={() => handleDeleteComponent(comp.id)}
                          style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '2px' }}
                          title="Eliminar componente"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
                {selected && components.length === 0 && (
                  <tr><td colSpan={5} style={{ textAlign: 'center', color: '#71717a' }}>Este producto no tiene componentes. Agrega uno con el botón de arriba.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
