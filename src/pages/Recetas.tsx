import { useState } from 'react'
import { useDemoData } from '../context/demo-data-context'
import './Recetas.css'

interface RecipeItem {
  ingredientId: string
  ingredientName: string
  quantity: number
  unit: string
  costPerUnit: number
}

interface Recipe {
  id: string
  productName: string
  category: string
  items: RecipeItem[]
  suggestedPrice: number
  targetMarginPct: number
}

export function Recetas() {
  const { ingredients, products } = useDemoData()

  const [recipes, setRecipes] = useState<Recipe[]>([
    {
      id: 'REC-001',
      productName: 'Full Kilo Especial',
      category: 'Combos Especiales',
      suggestedPrice: 15.0,
      targetMarginPct: 60,
      items: [
        { ingredientId: 'i1', ingredientName: 'Porción de Pollo', quantity: 2, unit: 'porciones', costPerUnit: 0.85 },
        { ingredientId: 'i2', ingredientName: 'Porción de Camarón', quantity: 2, unit: 'porciones', costPerUnit: 1.2 },
        { ingredientId: 'i3', ingredientName: 'Arroz Frito Especial', quantity: 1, unit: 'porción', costPerUnit: 0.9 },
        { ingredientId: 'i4', ingredientName: 'Empaque Full China', quantity: 1, unit: 'und', costPerUnit: 0.4 },
      ],
    },
  ])

  const [showModal, setShowModal] = useState(false)
  const [selectedProductId, setSelectedProductId] = useState('')
  const [targetMargin, setTargetMargin] = useState('60')
  const [recipeItems, setRecipeItems] = useState<RecipeItem[]>([])

  const [selectedIngId, setSelectedIngId] = useState('')
  const [ingQty, setIngQty] = useState('')

  const handleAddIngredientToRecipe = () => {
    const ing = ingredients.find(i => i.id === selectedIngId)
    if (!ing) return

    setRecipeItems([
      ...recipeItems,
      {
        ingredientId: ing.id,
        ingredientName: ing.name,
        quantity: parseFloat(ingQty) || 1,
        unit: ing.unit,
        costPerUnit: ing.costPerUnit || 1.0,
      },
    ])
    setSelectedIngId('')
    setIngQty('')
  }

  const calculateTotalCost = (items: RecipeItem[]) => {
    return items.reduce((sum, item) => sum + item.costPerUnit * item.quantity, 0)
  }

  const handleSaveRecipe = (e: React.FormEvent) => {
    e.preventDefault()
    const product = products.find(p => p.id === selectedProductId)
    const cost = calculateTotalCost(recipeItems)
    const marginPct = parseFloat(targetMargin) || 60
    const suggestedPrice = cost / (1 - marginPct / 100)

    const newRecipe: Recipe = {
      id: `REC-${100 + recipes.length + 1}`,
      productName: product?.name || 'Nuevo Plato Receta',
      category: product?.category || 'General',
      items: recipeItems,
      suggestedPrice,
      targetMarginPct: marginPct,
    }

    setRecipes([newRecipe, ...recipes])
    setShowModal(false)
    setSelectedProductId('')
    setRecipeItems([])
  }

  return (
    <div className="page animate-fade-in">
      <header className="page-header">
        <div>
          <h1 className="page-title text-gradient">Recetas y Costeo de Platos</h1>
          <p className="page-subtitle">Constructor de recetas, costo real por plato y margen de rentabilidad</p>
        </div>
        <button className="btn-accent" onClick={() => setShowModal(true)}>
          ➕ Crear Nueva Receta
        </button>
      </header>

      <div className="recipes-grid">
        {recipes.map(recipe => {
          const totalCost = calculateTotalCost(recipe.items)
          const marginVal = recipe.suggestedPrice - totalCost

          return (
            <div key={recipe.id} className="card recipe-card">
              <div className="recipe-card-header">
                <div>
                  <span className="recipe-cat">{recipe.category}</span>
                  <h2 className="recipe-title">{recipe.productName}</h2>
                </div>
                <span className="badge badge-owner">{recipe.targetMarginPct}% Margen Objetivo</span>
              </div>

              <div className="recipe-ingredients-list">
                <h3>Ingredientes / Insumos:</h3>
                <ul>
                  {recipe.items.map((item, i) => (
                    <li key={i}>
                      <span>
                        {item.quantity} {item.unit} x {item.ingredientName}
                      </span>
                      <span>${(item.costPerUnit * item.quantity).toFixed(2)}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="recipe-cost-summary">
                <div className="cost-row">
                  <span>Costo Total Insumos:</span>
                  <strong className="text-danger">${totalCost.toFixed(2)}</strong>
                </div>
                <div className="cost-row">
                  <span>Precio de Venta Sugerido:</span>
                  <strong className="text-gradient">${recipe.suggestedPrice.toFixed(2)}</strong>
                </div>
                <div className="cost-row">
                  <span>Ganancia Monetaria:</span>
                  <strong className="text-success">${marginVal.toFixed(2)}</strong>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content animate-pop" onClick={e => e.stopPropagation()}>
            <header className="modal-header">
              <h2>Constructor de Receta</h2>
              <button className="modal-close" onClick={() => setShowModal(false)}>
                ✕
              </button>
            </header>
            <form onSubmit={handleSaveRecipe} className="modal-body form-grid">
              <div className="field">
                <label className="field-label">Producto del Menú</label>
                <select
                  className="field-input"
                  value={selectedProductId}
                  onChange={e => setSelectedProductId(e.target.value)}
                  required
                >
                  <option value="">Seleccionar plato...</option>
                  {products.map(prod => (
                    <option key={prod.id} value={prod.id}>
                      {prod.emoji} {prod.name} (${prod.price.toFixed(2)})
                    </option>
                  ))}
                </select>
              </div>

              <div className="field">
                <label className="field-label">Margen de Ganancia Objetivo (%)</label>
                <input
                  type="number"
                  className="field-input"
                  value={targetMargin}
                  onChange={e => setTargetMargin(e.target.value)}
                  required
                />
              </div>

              <div className="recipe-builder-section">
                <h3>Agregar Insumo a la Receta</h3>
                <div className="builder-row">
                  <select
                    className="field-input"
                    value={selectedIngId}
                    onChange={e => setSelectedIngId(e.target.value)}
                  >
                    <option value="">Seleccionar ingrediente...</option>
                    {ingredients.map(ing => (
                      <option key={ing.id} value={ing.id}>
                        {ing.name} (${ing.costPerUnit.toFixed(2)} / {ing.unit})
                      </option>
                    ))}
                  </select>

                  <input
                    type="number"
                    step="0.1"
                    className="field-input input-short"
                    placeholder="Cant."
                    value={ingQty}
                    onChange={e => setIngQty(e.target.value)}
                  />

                  <button type="button" className="btn-accent" onClick={handleAddIngredientToRecipe}>
                    ➕ Agregar
                  </button>
                </div>

                <div className="added-items-preview mt-4">
                  {recipeItems.length > 0 && (
                    <ul>
                      {recipeItems.map((item, idx) => (
                        <li key={idx}>
                          {item.quantity} {item.unit} de {item.ingredientName} (${(item.costPerUnit * item.quantity).toFixed(2)})
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>

              <div className="modal-footer">
                <button type="submit" className="btn-accent" disabled={recipeItems.length === 0}>
                  Guardar Receta
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
