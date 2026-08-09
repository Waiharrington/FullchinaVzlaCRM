import { useEffect, useState } from 'react'
import { useAuth } from '../context/auth-context'
import { MoneyWithBcv } from '../components/MoneyWithBcv'
import { createWeeklyDish, getWeeklyDishes, setWeeklyDishActive, type WeeklyDish } from '../lib/dataService'
import { Utensils, Plus, CheckCircle2, ToggleLeft, ToggleRight, Sparkles } from 'lucide-react'
import './MenuSemanal.css'

export function MenuSemanal() {
  const { user } = useAuth()
  const [dishes, setDishes] = useState<WeeklyDish[]>([])
  
  // New Dish Form State
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [price, setPrice] = useState(7.50)
  const [cost, setCost] = useState(2.50)
  const [emoji, setEmoji] = useState('🍜')
  const [weekTag, setWeekTag] = useState('Semana 2 - Agosto')
  const [createdNotice, setCreatedNotice] = useState('')

  useEffect(() => {
    getWeeklyDishes().then(setDishes).catch(error => setCreatedNotice(error instanceof Error ? error.message : 'No se pudo cargar el menú semanal'))
  }, [])

  const toggleStatus = async (id: string) => {
    const current = dishes.find(d => d.id === id)
    if (!current) return
    const nextStatus: WeeklyDish['status'] = current.status === 'active' ? 'inactive' : 'active'
    await setWeeklyDishActive(id, nextStatus === 'active')
    setDishes(prev => prev.map(d => d.id === id ? { ...d, status: nextStatus } : d))
  }

  const handleCreateDish = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return

    if (!user) return
    const newDish = await createWeeklyDish({ name, description, price, cost, emoji, weekTag }, user.id)

    setDishes(prev => [newDish, ...prev])
    setCreatedNotice(`¡Plato de la semana "${name}" creado e incorporado al menú activo!`)
    setName('')
    setDescription('')
    setTimeout(() => setCreatedNotice(''), 4000)
  }

  return (
    <div className="weekly-page">
      {/* Banner */}
      <div className="almacen-card" style={{ background: 'linear-gradient(135deg, #18181b 0%, #202024 100%)' }}>
        <div className="prod-card-header-bar">
          <div className="header-title-group">
            <div className="card-header-icon-red" style={{ background: '#dc2626' }}>
              <Utensils size={18} />
            </div>
            <div>
              <h2 className="prod-card-title">Platos de la Semana / Menú Rotativo</h2>
              <span className="metric-sub-text">
                4 platos adicionales semanales para incentivar el retorno de clientes. Se activan o desactivan sin eliminarse de la base de datos.
              </span>
            </div>
          </div>
          <span className="whatsapp-badge-green" style={{ background: 'rgba(220, 38, 38, 0.15)', color: '#ef4444', borderColor: 'rgba(220, 38, 38, 0.3)' }}>
            {dishes.filter(dish => dish.status === 'active').length} Platos Activos
          </span>
        </div>
      </div>

      {/* Grid of Dishes */}
      <div className="weekly-grid">
        {dishes.map(dish => (
          <div key={dish.id} className={`dish-card-rotative ${dish.status === 'active' ? 'active' : ''}`}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div className="dish-emoji-container">
                {dish.emoji}
              </div>
              <button 
                onClick={() => toggleStatus(dish.id)}
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: dish.status === 'active' ? '#10b981' : '#71717a' }}
                title="Cambiar estado Activo / Inactivo"
              >
                {dish.status === 'active' ? <ToggleRight size={28} /> : <ToggleLeft size={28} />}
              </button>
            </div>

            <div>
              <span style={{ fontSize: '10px', fontWeight: 800, color: '#dc2626', textTransform: 'uppercase' }}>{dish.weekTag}</span>
              <h3 style={{ color: '#fff', fontSize: '16px', fontWeight: 800, margin: '2px 0 4px 0' }}>{dish.name}</h3>
              <p style={{ color: '#a1a1aa', fontSize: '12px', margin: 0, lineHeight: 1.4 }}>{dish.description}</p>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '8px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
              <div>
                <span style={{ fontSize: '10px', color: '#71717a', display: 'block' }}>Precio Venta</span>
                <MoneyWithBcv usd={dish.price} align="start" compact usdClassName="weekly-menu-price" />
              </div>
              {user?.role !== 'cashier' && (
                <div>
                  <span style={{ fontSize: '10px', color: '#71717a', display: 'block' }}>Costo / Margen</span>
                  <MoneyWithBcv usd={dish.price - dish.cost} align="start" compact usdClassName="weekly-menu-margin" />
                </div>
              )}
              <span className={`badge-stock ${dish.status === 'active' ? 'normal' : 'low'}`} style={{ textTransform: 'capitalize' }}>
                {dish.status}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Form: Add New Rotative Dish */}
      <div className="almacen-card">
        <div className="prod-card-header-bar">
          <div className="header-title-group">
            <div className="card-header-icon-red" style={{ background: '#7c3aed' }}>
              <Sparkles size={18} />
            </div>
            <div>
              <h3 className="prod-card-title">Crear Nuevo Plato de la Semana</h3>
              <span className="metric-sub-text">Los platos creados quedan guardados en el catálogo rotativo para usarse de nuevo cuando quieras</span>
            </div>
          </div>
        </div>

        {createdNotice && (
          <div style={{ background: 'rgba(16, 185, 129, 0.15)', border: '1px solid rgba(16, 185, 129, 0.3)', color: '#10b981', padding: '10px 14px', borderRadius: '8px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <CheckCircle2 size={16} />
            <span>{createdNotice}</span>
          </div>
        )}

        <form onSubmit={handleCreateDish} className="transfer-form-box">
          <div style={{ display: 'flex', gap: '12px' }}>
            <div className="select-field-group" style={{ width: '80px' }}>
              <label className="field-label">Emoji</label>
              <input 
                type="text"
                className="field-select"
                style={{ textAlign: 'center', fontSize: '20px' }}
                value={emoji}
                onChange={e => setEmoji(e.target.value)}
              />
            </div>
            <div className="select-field-group flex-2">
              <label className="field-label">Nombre del Plato Especial</label>
              <input 
                type="text"
                className="field-select"
                placeholder="Ej. Tallarines Singapur con Curri"
                value={name}
                onChange={e => setName(e.target.value)}
                required
              />
            </div>
            <div className="select-field-group flex-1">
              <label className="field-label">Etiqueta de Semana</label>
              <input 
                type="text"
                className="field-select"
                value={weekTag}
                onChange={e => setWeekTag(e.target.value)}
              />
            </div>
          </div>

          <div className="select-field-group">
            <label className="field-label">Descripción Atractiva para el Cliente</label>
            <input 
              type="text"
              className="field-select"
              placeholder="Ej. Papas crujientes bañadas en salsa picante szechuan con finas hierbas."
              value={description}
              onChange={e => setDescription(e.target.value)}
            />
          </div>

          <div style={{ display: 'flex', gap: '12px' }}>
            <div className="select-field-group flex-1">
              <label className="field-label">Precio de Venta ($ USD)</label>
              <input 
                type="number"
                step="0.5"
                className="field-select"
                value={price}
                onChange={e => setPrice(Number(e.target.value))}
              />
            </div>
            <div className="select-field-group flex-1">
              <label className="field-label">Costo Estimado de Producción ($ USD)</label>
              <input 
                type="number"
                step="0.5"
                className="field-select"
                value={cost}
                onChange={e => setCost(Number(e.target.value))}
              />
            </div>
          </div>

          <button type="submit" className="btn-primary-red" style={{ marginTop: '8px' }}>
            <Plus size={16} />
            <span>Guardar Plato de la Semana</span>
          </button>
        </form>
      </div>
    </div>
  )
}
