import { useEffect, useState } from 'react'
import { getRecipeComponents, getSellableProducts, type RecipeComponent, type SellableProduct } from '../lib/dataService'
import { MoneyWithBcv } from '../components/MoneyWithBcv'

export function RecetasReal() {
  const [products, setProducts] = useState<SellableProduct[]>([])
  const [selected, setSelected] = useState<SellableProduct | null>(null)
  const [components, setComponents] = useState<RecipeComponent[]>([])
  const [error, setError] = useState('')
  useEffect(() => { getSellableProducts().then(data => { setProducts(data); setSelected(data[0] ?? null) }).catch(e => setError(e instanceof Error ? e.message : 'Error al cargar recetas')) }, [])
  useEffect(() => { if (selected) getRecipeComponents(selected.id).then(setComponents).catch(e => setError(e instanceof Error ? e.message : 'Error al cargar componentes')) }, [selected])
  return <div className="page animate-fade-in"><header className="page-header"><div><h1 className="page-title text-gradient">Recetas reales</h1><p className="page-subtitle">Componentes importados desde Invu, sin recetas de ejemplo.</p></div></header>
    {error && <div className="card">{error}</div>}
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(260px, 1fr) minmax(340px, 2fr)', gap: 18 }}>
      <div className="card"><h2 className="card-title">Productos ({products.length})</h2><div style={{ maxHeight: 620, overflow: 'auto' }}>{products.map(product => <button type="button" key={product.id} onClick={() => setSelected(product)} style={{ display: 'flex', width: '100%', justifyContent: 'space-between', padding: 10, background: selected?.id === product.id ? '#3b1111' : 'transparent', color: '#fff', border: 0, borderBottom: '1px solid #292929', cursor: 'pointer' }}><span>{product.emoji} {product.name}</span><span>${product.salePrice.toFixed(2)}</span></button>)}</div></div>
      <div className="card"><h2 className="card-title">{selected?.name ?? 'Selecciona un producto'}</h2>{selected && <MoneyWithBcv usd={selected.salePrice} compact />}<div className="table-responsive-wrapper"><table className="almacen-table"><thead><tr><th>Ingrediente</th><th>Cantidad</th><th>Unidad</th><th>Costo unitario</th></tr></thead><tbody>{components.map(component => <tr key={component.id}><td>{component.ingredientName ?? 'Preparación'}</td><td>{component.quantity}</td><td>{component.unitSymbol}</td><td>{component.costPerUnit == null ? 'Sin costo' : `$${component.costPerUnit.toFixed(2)}`}</td></tr>)}{selected && components.length === 0 && <tr><td colSpan={4}>Este producto no tiene componentes importados.</td></tr>}</tbody></table></div></div>
    </div>
  </div>
}
