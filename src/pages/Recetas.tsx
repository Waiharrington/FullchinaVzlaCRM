import { useState, useMemo } from 'react'
import {
  Search,
  Plus,
  Edit2,
  Copy,
  MoreVertical,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  ChefHat,
  DollarSign,
  Eye,
  Filter,
  X,
  ChevronLeft,
  ChevronRight,
  Trash2,
  Clock,
  BarChart3,
  Utensils,
  BookOpen
} from 'lucide-react'
import './Recetas.css'

interface RecipeIngredient {
  name: string
  qty: string | number
  unit: string
  cost: number
}

interface InventoryDeduction {
  name: string
  qty: string
  color: 'green' | 'yellow' | 'red'
}

interface RecipeDetail {
  id: string
  name: string
  category: string
  portions: string
  code: string
  description: string
  totalCost: number
  costPerPortion: number
  salePrice: number
  marginPct: number
  profit: number
  status: 'Activa' | 'Inactiva'
  img: string
  ingredients: RecipeIngredient[]
  steps: string[]
  inventoryDeductions: InventoryDeduction[]
}

const MOCK_RECIPES: RecipeDetail[] = [
  {
    id: 'rec-1',
    name: 'Arroz chaufa especial',
    category: 'Arroces',
    portions: '4 porciones',
    code: 'R-ARZ-001',
    description: 'Arroz salteado al estilo Full China con pollo, huevo, vegetales y salsa de soya.',
    totalCost: 8.40,
    costPerPortion: 2.10,
    salePrice: 7.50,
    marginPct: 72,
    profit: 5.40,
    status: 'Activa',
    img: 'https://images.unsplash.com/photo-1603133872878-684f208fb84b?auto=format&fit=crop&w=400&q=80',
    ingredients: [
      { name: 'Arroz cocido', qty: 800, unit: 'g', cost: 1.60 },
      { name: 'Pechuga de pollo', qty: 200, unit: 'g', cost: 1.80 },
      { name: 'Cebollín', qty: 50, unit: 'g', cost: 0.30 },
      { name: 'Salsa de soya', qty: 30, unit: 'ml', cost: 0.18 },
      { name: 'Huevo', qty: 2, unit: 'pzs', cost: 0.40 },
      { name: 'Vegetales mixtos', qty: 150, unit: 'g', cost: 0.80 },
      { name: 'Aceite vegetal', qty: 20, unit: 'ml', cost: 0.22 },
      { name: 'Ajo picado', qty: 10, unit: 'g', cost: 0.10 },
      { name: 'Sal y pimienta', qty: 'Al gusto', unit: '', cost: 0.00 },
    ],
    steps: [
      'Cocinar el arroz y dejar enfriar.',
      'Saltear el pollo en aceite hasta que esté dorado.',
      'Agregar huevo batido y revolver hasta cuajar.',
      'Incorporar vegetales y cebollín, saltear 2 minutos.',
      'Agregar arroz, salsa de soya, sal y pimienta. Mezclar bien y servir.',
    ],
    inventoryDeductions: [
      { name: 'Arroz cocido', qty: '-800 g', color: 'green' },
      { name: 'Pechuga de pollo', qty: '-200 g', color: 'green' },
      { name: 'Cebollín', qty: '-50 g', color: 'green' },
      { name: 'Salsa de soya', qty: '-30 ml', color: 'green' },
      { name: 'Huevo', qty: '-2 pzs', color: 'yellow' },
      { name: 'Vegetales mixtos', qty: '-150 g', color: 'green' },
      { name: 'Aceite vegetal', qty: '-20 ml', color: 'green' },
      { name: 'Ajo picado', qty: '-10 g', color: 'red' },
    ],
  },
  {
    id: 'rec-2',
    name: 'Chow mein mixto',
    category: 'Noodles',
    portions: '4 porciones',
    code: 'R-NDL-002',
    description: 'Fideos salteados al wok con carne de res, pollo, camarones y vegetales frescos.',
    totalCost: 8.60,
    costPerPortion: 2.15,
    salePrice: 7.50,
    marginPct: 64,
    profit: 4.80,
    status: 'Activa',
    img: 'https://images.unsplash.com/photo-1569718212165-3a8278d5f624?auto=format&fit=crop&w=400&q=80',
    ingredients: [
      { name: 'Fideos de trigo', qty: 500, unit: 'g', cost: 2.10 },
      { name: 'Carne y pollo', qty: 250, unit: 'g', cost: 3.20 },
      { name: 'Camarones', qty: 100, unit: 'g', cost: 2.00 },
      { name: 'Salsa ostión', qty: 40, unit: 'ml', cost: 1.30 },
    ],
    steps: [
      'Hervir los fideos 3 minutos y escurrir.',
      'Saltear las proteínas al wok a fuego alto.',
      'Mezclar fideos y vegetales con la salsa de ostión.',
    ],
    inventoryDeductions: [
      { name: 'Fideos de trigo', qty: '-500 g', color: 'green' },
      { name: 'Carne y pollo', qty: '-250 g', color: 'green' },
      { name: 'Camarones', qty: '-100 g', color: 'yellow' },
    ],
  },
]

export function Recetas() {
  const [recipes, setRecipes] = useState<RecipeDetail[]>(MOCK_RECIPES)
  const [selectedRecipe, setSelectedRecipe] = useState<RecipeDetail>(MOCK_RECIPES[0])

  // Filter States
  const [activeTab, setActiveTab] = useState('Todos')
  const [searchQuery, setSearchQuery] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')

  // Modal State (Matching Target Screenshot)
  const [showNewModal, setShowNewModal] = useState(false)
  const [newRecipeName, setNewRecipeName] = useState('Arroz Chino Especial')
  const [newCategory, setNewCategory] = useState('Arroces')
  const [newInternalCode, setNewInternalCode] = useState('REC-00024')
  const [newStatus, setNewStatus] = useState<'Activa' | 'Inactiva'>('Activa')
  const [newSalePrice, setNewSalePrice] = useState('12.900')
  const [newYieldCount, setNewYieldCount] = useState('6')
  const [newPrepTime, setNewPrepTime] = useState('25')

  // Modal Ingredients Table State
  const [newModalIngredients, setNewModalIngredients] = useState<RecipeIngredient[]>([
    { name: 'Arroz cocido', qty: '1.000', unit: 'kg', cost: 1.80 },
    { name: 'Pollo', qty: '350', unit: 'g', cost: 2.45 },
    { name: 'Cebollín', qty: '50', unit: 'g', cost: 0.30 },
    { name: 'Salsa de soya', qty: '30', unit: 'ml', cost: 0.15 },
  ])

  // Modal Prep Steps State
  const [newPrepStepsText, setNewPrepStepsText] = useState(
`1. Calentar el wok a fuego alto y agregar un poco de aceite.
2. Saltear el pollo hasta que esté cocido y dorado.
3. Agregar el arroz cocido y mezclar bien.
4. Incorporar la salsa de soya y el cebollín picado.
5. Mezclar todo por 2 minutos más y servir caliente.`
  )

  const handleAddModalIngredient = () => {
    setNewModalIngredients(prev => [
      ...prev,
      { name: 'Nuevo insumo', qty: '100', unit: 'g', cost: 0.50 }
    ])
  }

  const updateModalIngredient = (index: number, field: keyof RecipeIngredient, value: string) => {
    setNewModalIngredients(prev => {
      const updated = [...prev]
      if (field === 'cost') {
        const parsed = parseFloat(value) || 0
        updated[index] = { ...updated[index], cost: parsed }
      } else {
        updated[index] = { ...updated[index], [field]: value }
      }
      return updated
    })
  }

  const removeModalIngredient = (index: number) => {
    setNewModalIngredients(prev => prev.filter((_, i) => i !== index))
  }

  // Calculated Profitability Metrics
  const modalTotalCost = useMemo(() => {
    return newModalIngredients.reduce((sum, item) => sum + (typeof item.cost === 'number' ? item.cost : 0), 0)
  }, [newModalIngredients])

  const parsedSalePrice = useMemo(() => {
    const clean = newSalePrice.replace('.', '').replace(',', '.')
    return parseFloat(clean) || 12.90
  }, [newSalePrice])

  const modalYield = useMemo(() => {
    return parseInt(newYieldCount) || 1
  }, [newYieldCount])

  const costPerPortion = modalTotalCost / (modalYield || 1)
  const marginPct = parsedSalePrice > 0 ? ((parsedSalePrice - costPerPortion) / parsedSalePrice) * 100 : 0
  const profitPerRecipe = parsedSalePrice - modalTotalCost

  // Filtered recipes list
  const filteredRecipes = useMemo(() => {
    return recipes.filter((r) => {
      const matchTab = activeTab === 'Todos' || r.category.toLowerCase() === activeTab.toLowerCase()
      const matchSearch = r.name.toLowerCase().includes(searchQuery.toLowerCase()) || r.code.toLowerCase().includes(searchQuery.toLowerCase())
      const matchCategory = categoryFilter === 'all' || r.category.toLowerCase() === categoryFilter.toLowerCase()
      const matchStatus = statusFilter === 'all' || r.status.toLowerCase() === statusFilter.toLowerCase()
      return matchTab && matchSearch && matchCategory && matchStatus
    })
  }, [recipes, activeTab, searchQuery, categoryFilter, statusFilter])

  const handleCreateRecipe = (e: React.FormEvent) => {
    e.preventDefault()
    if (!newRecipeName.trim()) return

    const newObj: RecipeDetail = {
      id: `rec-${Date.now()}`,
      name: newRecipeName.trim(),
      category: newCategory,
      portions: `${newYieldCount} porciones`,
      code: newInternalCode || `REC-000${recipes.length + 1}`,
      description: 'Receta recién agregada al menú con costeo automático.',
      totalCost: modalTotalCost,
      costPerPortion: costPerPortion,
      salePrice: parsedSalePrice,
      marginPct: Math.round(marginPct),
      profit: profitPerRecipe,
      status: newStatus,
      img: 'https://images.unsplash.com/photo-1603133872878-684f208fb84b?auto=format&fit=crop&w=400&q=80',
      ingredients: newModalIngredients,
      steps: newPrepStepsText.split('\n').filter(s => s.trim().length > 0),
      inventoryDeductions: newModalIngredients.map(ing => ({
        name: ing.name,
        qty: `-${ing.qty} ${ing.unit}`,
        color: 'green' as const
      })),
    }

    setRecipes([newObj, ...recipes])
    setSelectedRecipe(newObj)
    setShowNewModal(false)
  }

  return (
    <div className="page animate-fade-in">

      {/* Page Header */}
      <div className="recetas-page-header">
        <div>
          <h1 className="recetas-title">Recetas</h1>
          <p className="recetas-subtitle">Gestiona recetas, costos, porciones y rentabilidad</p>
        </div>
        <button className="btn-nueva-receta-red" onClick={() => setShowNewModal(true)}>
          <Plus size={18} /> Nueva receta
        </button>
      </div>

      {/* 4 Summary KPI Cards */}
      <div className="recetas-kpi-grid">
        <div className="recetas-kpi-card">
          <div className="kpi-icon-circle red"><ChefHat size={22} /></div>
          <div className="kpi-info-content">
            <span className="kpi-info-label">Recetas activas</span>
            <span className="kpi-info-val">48</span>
            <span className="kpi-info-sub green"><TrendingUp size={12} /> 4 vs ayer</span>
          </div>
        </div>

        <div className="recetas-kpi-card">
          <div className="kpi-icon-circle orange"><DollarSign size={22} /></div>
          <div className="kpi-info-content">
            <span className="kpi-info-label">Costo promedio</span>
            <span className="kpi-info-val">$2.35</span>
            <span className="kpi-info-sub green"><TrendingDown size={12} /> 2.4% vs ayer</span>
          </div>
        </div>

        <div className="recetas-kpi-card">
          <div className="kpi-icon-circle gold"><TrendingUp size={22} /></div>
          <div className="kpi-info-content">
            <span className="kpi-info-label">Margen promedio</span>
            <span className="kpi-info-val">68.7%</span>
            <span className="kpi-info-sub green"><TrendingUp size={12} /> 3.1% vs ayer</span>
          </div>
        </div>

        <div className="recetas-kpi-card">
          <div className="kpi-icon-circle alert-red"><AlertTriangle size={22} /></div>
          <div className="kpi-info-content">
            <span className="kpi-info-label">Alertas de margen</span>
            <span className="kpi-info-val">6 recetas</span>
            <span className="kpi-info-sub orange">Margen &lt; 50%</span>
          </div>
        </div>
      </div>

      {/* Main 2-Columns Split Layout */}
      <div className="recetas-main-split">
        {/* LEFT COLUMN: Recipe List */}
        <div className="recetas-left-panel">
          <div className="recetas-tabs-bar">
            {['Todos', 'Arroces', 'Noodles', 'Proteínas', 'Entradas', 'Bebidas'].map((tab) => (
              <button
                key={tab}
                className={`tab-btn-pill ${activeTab === tab ? 'active' : ''}`}
                onClick={() => setActiveTab(tab)}
              >
                {tab}
              </button>
            ))}
          </div>

          <div className="recetas-toolbar">
            <div className="search-input-box">
              <Search size={15} className="search-box-icon" />
              <input
                type="text"
                placeholder="Buscar receta..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="search-box-field"
              />
            </div>

            <select
              className="toolbar-select"
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
            >
              <option value="all">Todas las categorías</option>
              <option value="arroces">Arroces</option>
              <option value="noodles">Noodles</option>
              <option value="entradas">Entradas</option>
              <option value="proteínas">Proteínas</option>
              <option value="salsas">Salsas</option>
            </select>

            <select
              className="toolbar-select"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="all">Estado: Activas</option>
              <option value="activa">Activa</option>
              <option value="inactiva">Inactiva</option>
            </select>

            <button className="btn-filter-icon" title="Más filtros">
              <Filter size={15} /> Más filtros
            </button>
          </div>

          <div className="table-responsive-wrapper">
            <table className="recetas-list-table">
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>Categoría</th>
                  <th>Rendimiento</th>
                  <th>Costo</th>
                  <th>Precio</th>
                  <th>Margen</th>
                  <th>Estado</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filteredRecipes.map((rec) => (
                  <tr
                    key={rec.id}
                    className={`recipe-table-row ${selectedRecipe.id === rec.id ? 'active-selected' : ''}`}
                    onClick={() => setSelectedRecipe(rec)}
                  >
                    <td>
                      <div className="recipe-thumb-cell">
                        <img src={rec.img} alt={rec.name} className="recipe-thumb-img" />
                        <span className="recipe-name-text">{rec.name}</span>
                      </div>
                    </td>
                    <td className="cat-cell">{rec.category}</td>
                    <td className="sub-cell">{rec.portions}</td>
                    <td className="font-bold">${rec.totalCost.toFixed(2)}</td>
                    <td className="font-bold">${rec.salePrice.toFixed(2)}</td>
                    <td>
                      <span className={`margin-pct-pill ${rec.marginPct < 50 ? 'red' : 'green'}`}>
                        {rec.marginPct}%
                      </span>
                    </td>
                    <td>
                      <span className="status-active-badge">Activa</span>
                    </td>
                    <td>
                      <button className="action-row-btn" onClick={(e) => e.stopPropagation()}>
                        <MoreVertical size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="recetas-table-pagination">
            <span className="pagination-text">Mostrando 1 a 6 de 48 recetas</span>
            <div className="pagination-pills">
              <button className="pag-btn prev"><ChevronLeft size={16} /></button>
              <button className="pag-btn active">1</button>
              <button className="pag-btn">2</button>
              <button className="pag-btn">3</button>
              <span className="pag-dots">...</span>
              <button className="pag-btn">8</button>
              <button className="pag-btn next"><ChevronRight size={16} /></button>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: Detail View */}
        <div className="recetas-right-panel">
          <div className="detail-card-header">
            <div className="detail-title-wrap">
              <h2 className="detail-recipe-title">{selectedRecipe.name}</h2>
              <span className="badge-activa-green">Activa</span>
            </div>

            <div className="detail-header-actions">
              <button className="btn-detail-dark"><Edit2 size={14} /> Editar receta</button>
              <button className="btn-detail-dark"><Copy size={14} /> Duplicar</button>
              <button className="btn-detail-dark icon-only"><MoreVertical size={14} /></button>
            </div>
          </div>

          <div className="detail-hero-section">
            <div className="detail-image-box">
              <img src={selectedRecipe.img} alt={selectedRecipe.name} className="detail-hero-img" />
              <div className="detail-meta-list">
                <div>
                  <span className="meta-label">Categoría</span>
                  <span className="meta-val font-bold">{selectedRecipe.category}</span>
                </div>
                <div>
                  <span className="meta-label">Rendimiento</span>
                  <span className="meta-val font-bold">{selectedRecipe.portions}</span>
                </div>
                <div>
                  <span className="meta-label">Código interno</span>
                  <span className="meta-val sub-gray">{selectedRecipe.code}</span>
                </div>
                <div>
                  <span className="meta-label">Descripción</span>
                  <p className="meta-desc-text">{selectedRecipe.description}</p>
                </div>
              </div>
            </div>

            <div className="financials-2x2-grid">
              <div className="fin-card">
                <span className="fin-label">Costo total</span>
                <span className="fin-val font-bold">${selectedRecipe.totalCost.toFixed(2)}</span>
              </div>

              <div className="fin-card">
                <span className="fin-label">Costo por porción</span>
                <span className="fin-val font-bold">${selectedRecipe.costPerPortion.toFixed(2)}</span>
              </div>

              <div className="fin-card">
                <span className="fin-label">Precio de venta</span>
                <span className="fin-val font-bold">${selectedRecipe.salePrice.toFixed(2)}</span>
              </div>

              <div className="fin-card">
                <span className="fin-label">Margen</span>
                <span className="fin-val font-bold green-text">{selectedRecipe.marginPct}%</span>
                <span className="fin-sub-green">Ganancia ${selectedRecipe.profit.toFixed(2)}</span>
              </div>
            </div>
          </div>

          <div className="detail-inner-grid">
            <div className="detail-sub-box">
              <h3 className="sub-box-title">Ingredientes</h3>
              <table className="ingredients-detail-table">
                <thead>
                  <tr>
                    <th>Ingrediente</th>
                    <th>Cantidad</th>
                    <th>Unidad</th>
                    <th style={{ textAlign: 'right' }}>Costo</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedRecipe.ingredients.map((ing, idx) => (
                    <tr key={idx}>
                      <td className="font-bold">{ing.name}</td>
                      <td>{ing.qty}</td>
                      <td className="unit-gray">{ing.unit}</td>
                      <td className="cost-align-right">${(typeof ing.cost === 'number' ? ing.cost : 0).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="total-cost-footer-row">
                <span>Costo total receta</span>
                <span className="font-bold text-white">${selectedRecipe.totalCost.toFixed(2)}</span>
              </div>
            </div>

            <div className="detail-sub-box-stack">
              <div className="detail-sub-box">
                <h3 className="sub-box-title">Preparación</h3>
                <ol className="prep-steps-list">
                  {selectedRecipe.steps.map((step, idx) => (
                    <li key={idx} className="prep-step-item">
                      <span className="step-num-badge">{idx + 1}</span>
                      <span className="step-text">{step}</span>
                    </li>
                  ))}
                </ol>
              </div>

              <div className="detail-sub-box mt-3">
                <h3 className="sub-box-title">Impacto en inventario (por venta)</h3>
                <div className="inventory-impact-grid mt-2">
                  {selectedRecipe.inventoryDeductions.map((item, idx) => (
                    <div key={idx} className="impact-item-pill">
                      <span className={`impact-dot ${item.color}`} />
                      <span className="impact-name">{item.name}</span>
                      <span className="impact-qty">{item.qty}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="detail-card-footer mt-4">
            <button className="btn-detail-dark">Cancelar</button>
            <button className="btn-detail-dark"><Eye size={15} /> Vista previa de costos</button>
            <button className="btn-detail-red">Guardar cambios</button>
          </div>
        </div>
      </div>

      {/* Modal Nueva Receta (Matching Target Screenshot) */}
      {showNewModal && (
        <div className="modal-overlay-dark" onClick={() => setShowNewModal(false)}>
          <div className="recipe-modal-box-large animate-pop" onClick={(e) => e.stopPropagation()}>
            <div className="recipe-modal-header">
              <div className="header-icon-box">
                <Plus size={22} className="text-white" />
              </div>
              <div>
                <h2 className="modal-title">Nueva receta</h2>
                <p className="modal-sub-desc">Registra una nueva receta, sus ingredientes y rentabilidad</p>
              </div>
              <button className="modal-close-btn" onClick={() => setShowNewModal(false)}><X size={18} /></button>
            </div>

            <form onSubmit={handleCreateRecipe} className="recipe-modal-form mt-4">
              {/* Row 1: Basic Details (4 Cols Grid) */}
              <div className="form-grid-4cols">
                <div className="field">
                  <label className="field-label-white">Nombre de la receta <span className="text-red">*</span></label>
                  <input
                    type="text"
                    value={newRecipeName}
                    onChange={(e) => setNewRecipeName(e.target.value)}
                    className="modal-input-dark"
                    required
                  />
                </div>

                <div className="field">
                  <label className="field-label-white">Categoría <span className="text-red">*</span></label>
                  <select
                    className="modal-select-dark"
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value)}
                  >
                    <option value="Arroces">Arroces</option>
                    <option value="Noodles">Noodles</option>
                    <option value="Entradas">Entradas</option>
                    <option value="Proteínas">Proteínas</option>
                    <option value="Bebidas">Bebidas</option>
                    <option value="Salsas">Salsas</option>
                  </select>
                </div>

                <div className="field">
                  <label className="field-label-white">Código interno <span className="text-red">*</span></label>
                  <input
                    type="text"
                    value={newInternalCode}
                    onChange={(e) => setNewInternalCode(e.target.value)}
                    className="modal-input-dark"
                    required
                  />
                </div>

                <div className="field">
                  <label className="field-label-white">Estado <span className="text-red">*</span></label>
                  <select
                    className="modal-select-dark"
                    value={newStatus}
                    onChange={(e) => setNewStatus(e.target.value as 'Activa' | 'Inactiva')}
                  >
                    <option value="Activa">🟢 Activa</option>
                    <option value="Inactiva">🔴 Inactiva</option>
                  </select>
                </div>
              </div>

              {/* Row 2: Pricing & Timing Details (3 Cols Grid) */}
              <div className="form-grid-3cols mt-3">
                <div className="field">
                  <label className="field-label-white">Precio de venta <span className="text-red">*</span></label>
                  <div className="input-affix-wrap">
                    <span className="input-prefix">$</span>
                    <input
                      type="text"
                      value={newSalePrice}
                      onChange={(e) => setNewSalePrice(e.target.value)}
                      className="modal-input-dark with-prefix"
                      required
                    />
                  </div>
                </div>

                <div className="field">
                  <label className="field-label-white">Rendimiento <span className="text-red">*</span></label>
                  <div className="input-affix-wrap">
                    <input
                      type="text"
                      value={newYieldCount}
                      onChange={(e) => setNewYieldCount(e.target.value)}
                      className="modal-input-dark with-suffix"
                      required
                    />
                    <span className="input-suffix">porciones</span>
                  </div>
                </div>

                <div className="field">
                  <label className="field-label-white">Tiempo de preparación <span className="text-red">*</span></label>
                  <div className="input-affix-wrap">
                    <Clock size={16} className="input-prefix-icon" />
                    <input
                      type="text"
                      value={newPrepTime}
                      onChange={(e) => setNewPrepTime(e.target.value)}
                      className="modal-input-dark with-prefix-icon with-suffix"
                      required
                    />
                    <span className="input-suffix">minutos</span>
                  </div>
                </div>
              </div>

              {/* Main Content Split Area */}
              <div className="modal-main-split mt-4">
                {/* LEFT COLUMN: Ingredientes + Preparación */}
                <div className="modal-left-col">
                  <div className="section-title-row">
                    <div className="section-title-wrap">
                      <Utensils size={16} className="text-gray" />
                      <h3 className="section-title-text">Ingredientes</h3>
                    </div>
                    <button type="button" className="btn-add-ingredient-red" onClick={handleAddModalIngredient}>
                      <Plus size={14} /> Agregar ingrediente
                    </button>
                  </div>

                  <div className="ingredients-table-box mt-2">
                    <table className="modal-ingredients-table">
                      <thead>
                        <tr>
                          <th>Ingrediente</th>
                          <th>Cantidad</th>
                          <th>Unidad</th>
                          <th>Costo</th>
                          <th></th>
                        </tr>
                      </thead>
                      <tbody>
                        {newModalIngredients.map((ing, idx) => (
                          <tr key={idx}>
                            <td>
                              <input
                                type="text"
                                value={ing.name}
                                onChange={(e) => updateModalIngredient(idx, 'name', e.target.value)}
                                className="table-input-cell"
                              />
                            </td>
                            <td>
                              <input
                                type="text"
                                value={ing.qty}
                                onChange={(e) => updateModalIngredient(idx, 'qty', e.target.value)}
                                className="table-input-cell text-center"
                              />
                            </td>
                            <td>
                              <input
                                type="text"
                                value={ing.unit}
                                onChange={(e) => updateModalIngredient(idx, 'unit', e.target.value)}
                                className="table-input-cell text-center"
                              />
                            </td>
                            <td>
                              <div className="table-cost-cell">
                                <span>$</span>
                                <input
                                  type="text"
                                  value={typeof ing.cost === 'number' ? ing.cost.toFixed(3) : ing.cost}
                                  onChange={(e) => updateModalIngredient(idx, 'cost', e.target.value)}
                                  className="table-input-cell text-right"
                                />
                              </div>
                            </td>
                            <td>
                              <button
                                type="button"
                                className="btn-delete-row"
                                onClick={() => removeModalIngredient(idx)}
                              >
                                <Trash2 size={15} />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="section-title-row mt-4">
                    <div className="section-title-wrap">
                      <BookOpen size={16} className="text-gray" />
                      <h3 className="section-title-text">Preparación</h3>
                    </div>
                  </div>

                  <div className="prep-textarea-box mt-2">
                    <textarea
                      rows={5}
                      value={newPrepStepsText}
                      onChange={(e) => setNewPrepStepsText(e.target.value)}
                      className="prep-textarea-dark"
                    />
                    <span className="prep-hint-text">
                      ℹ️ Puedes incluir pasos, tiempos y tips para la preparación de la receta.
                    </span>
                  </div>
                </div>

                {/* RIGHT COLUMN: Resumen de Rentabilidad */}
                <div className="modal-right-col">
                  <div className="rentabilidad-card">
                    <div className="rentabilidad-header">
                      <BarChart3 size={18} className="text-gold" />
                      <h3 className="rentabilidad-title">Resumen de rentabilidad</h3>
                    </div>

                    <div className="rentabilidad-metrics">
                      <div className="rent-metric-row">
                        <span className="rent-metric-label">Costo estimado</span>
                        <div className="rent-metric-val-wrap">
                          <span className="rent-val font-bold">$ {modalTotalCost.toFixed(3)}</span>
                          <span className="rent-sub-label">por receta</span>
                        </div>
                      </div>

                      <div className="rent-metric-row">
                        <span className="rent-metric-label">Precio de venta</span>
                        <div className="rent-metric-val-wrap">
                          <span className="rent-val font-bold text-gold">$ {newSalePrice}</span>
                          <span className="rent-sub-label">por porción</span>
                        </div>
                      </div>

                      <div className="rent-metric-row">
                        <span className="rent-metric-label">Margen</span>
                        <div className="rent-metric-val-wrap">
                          <span className="rent-val font-bold text-gold">{marginPct.toFixed(1)}%</span>
                          <span className="rent-sub-label">por porción</span>
                        </div>
                      </div>
                    </div>

                    <div className="ganancia-highlight-box mt-4">
                      <span className="ganancia-label">Ganancia por receta</span>
                      <span className="ganancia-amount">$ {profitPerRecipe.toFixed(3)}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="recipe-modal-footer mt-4">
                <span className="modal-footer-notice">
                  ℹ️ El costo se calcula automáticamente según inventario.
                </span>

                <div className="modal-footer-btns">
                  <button type="button" className="btn-modal-cancel-dark" onClick={() => setShowNewModal(false)}>
                    Cancelar
                  </button>
                  <button type="submit" className="btn-modal-submit-red-glow">
                    Guardar receta
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
