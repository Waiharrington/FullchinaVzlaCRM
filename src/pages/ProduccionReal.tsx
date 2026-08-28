import { useEffect, useState, useCallback } from 'react'
import {
  getProductionBatches, getProductionBonuses, getProductionStats,
  createProductionBatch, getIngredients, getUnits,
  type ProductionBatch, type ProductionBonus, type ProductionStats, type Ingredient,
} from '../lib/dataService'
import { useAuth } from '../context/auth-context'
import { SearchSelect } from '../components/SearchSelect'
import { PageSkeleton } from '../components/PageSkeleton'
import {
  Flame, Plus, Trash2, CheckCircle2, AlertTriangle, Loader2, ChevronUp, Package, DollarSign,
} from 'lucide-react'
import './Almacen.css'

interface BatchItemForm {
  ingredientId: string
  quantityUsed: string
  unitId: string
}

export function ProduccionReal() {
  const { user } = useAuth()
  const [stats, setStats] = useState<ProductionStats | null>(null)
  const [batches, setBatches] = useState<ProductionBatch[]>([])
  const [bonuses, setBonuses] = useState<ProductionBonus[]>([])
  const [ingredients, setIngredients] = useState<Ingredient[]>([])
  const [units, setUnits] = useState<Array<{ id: string; name: string; symbol: string }>>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  // New batch form
  const [showForm, setShowForm] = useState(false)
  const [batchName, setBatchName] = useState('')
  const [quantityProduced, setQuantityProduced] = useState('')
  const [unitId, setUnitId] = useState('')
  const [wasteQuantity, setWasteQuantity] = useState('0')
  const [batchNotes, setBatchNotes] = useState('')
  const [items, setItems] = useState<BatchItemForm[]>([])
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    try {
      setLoading(true)
      setError('')
      const [s, b, bn, ingr, un] = await Promise.all([
        getProductionStats(),
        getProductionBatches(),
        getProductionBonuses().catch(() => []),
        getIngredients(),
        getUnits(),
      ])
      setStats(s)
      setBatches(b)
      setBonuses(bn)
      setIngredients(ingr)
      setUnits(un)
      if (un.length > 0 && !unitId) setUnitId(un[0].id)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error cargando producción')
    } finally {
      setLoading(false)
    }
  }, [unitId])

  useEffect(() => { void load() }, [load])

  const handleAddItem = () => {
    setItems([...items, {
      ingredientId: ingredients[0]?.id ?? '',
      quantityUsed: '1',
      unitId: ingredients[0]?.unitId ?? units[0]?.id ?? '',
    }])
  }

  const handleRemoveItem = (idx: number) => {
    setItems(items.filter((_, i) => i !== idx))
  }

  const handleItemChange = (idx: number, field: keyof BatchItemForm, value: string) => {
    setItems(items.map((item, i) => {
      if (i !== idx) return item
      const updated = { ...item, [field]: value }
      if (field === 'ingredientId') {
        const ingr = ingredients.find(x => x.id === value)
        if (ingr) updated.unitId = ingr.unitId
      }
      return updated
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!batchName.trim() || !quantityProduced || !unitId || items.length === 0) return
    try {
      setSaving(true)
      setError('')
      await createProductionBatch({
        name: batchName.trim(),
        quantityProduced: parseFloat(quantityProduced) || 0,
        unitId,
        wasteQuantity: parseFloat(wasteQuantity) || 0,
        notes: batchNotes.trim() || undefined,
        items: items.map(item => ({
          ingredientId: item.ingredientId,
          quantityUsed: parseFloat(item.quantityUsed) || 0,
          unitId: item.unitId,
        })),
        createdBy: user?.id ?? '',
      })
      setNotice('Lote de producción registrado')
      setShowForm(false)
      setBatchName('')
      setQuantityProduced('')
      setWasteQuantity('0')
      setBatchNotes('')
      setItems([])
      await load()
      setTimeout(() => setNotice(''), 4000)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error guardando lote')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <PageSkeleton cards={3} rows={4} />
  }

  return (
    <div className="page animate-fade-in">
      <header className="page-header">
        <div>
          <h1 className="page-title text-gradient">Producción</h1>
          <p className="page-subtitle">Lotes, rendimiento, merma y bonos de producción</p>
        </div>
        <button
          className="btn-transfer-submit"
          style={{ margin: 0 }}
          onClick={() => { setShowForm(!showForm); setError(''); setItems([]); setBatchName(''); setQuantityProduced(''); setWasteQuantity('0'); setBatchNotes('') }}
        >
          {showForm ? <><ChevronUp size={16} /> Cerrar</> : <><Plus size={16} /> Nuevo Lote</>}
        </button>
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

      {/* Stats */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon"><Package size={16} /></div>
          <div className="stat-info">
            <span className="stat-value">{stats?.batchesToday ?? 0}</span>
            <span className="stat-label">Lotes hoy</span>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon"><CheckCircle2 size={16} /></div>
          <div className="stat-info">
            <span className="stat-value">{(stats?.avgYield ?? 0).toFixed(1)}%</span>
            <span className="stat-label">Rendimiento promedio</span>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon"><AlertTriangle size={16} /></div>
          <div className="stat-info">
            <span className="stat-value">{(stats?.totalWaste ?? 0).toFixed(2)}</span>
            <span className="stat-label">Merma total</span>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon"><DollarSign size={16} /></div>
          <div className="stat-info">
            <span className="stat-value">${(stats?.avgCostPerPortion ?? 0).toFixed(2)}</span>
            <span className="stat-label">Costo promedio/porción</span>
          </div>
        </div>
      </div>

      {/* New batch form */}
      {showForm && (
        <div className="almacen-card mb-6" style={{ marginTop: '16px' }}>
          <h3 style={{ color: '#fff', fontSize: '15px', fontWeight: 700, marginBottom: '16px' }}>
            <Flame size={18} style={{ verticalAlign: 'middle', marginRight: '8px' }} />
            Registrar Nuevo Lote
          </h3>
          <form onSubmit={handleSubmit}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', marginBottom: '16px' }}>
              <div className="form-group" style={{ margin: 0 }}>
                <label style={{ color: '#a1a1aa', fontSize: '12px', marginBottom: '4px', display: 'block' }}>Nombre del lote *</label>
                <input type="text" value={batchName} onChange={e => setBatchName(e.target.value)} placeholder="Ej. Arroz frito especial" required />
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label style={{ color: '#a1a1aa', fontSize: '12px', marginBottom: '4px', display: 'block' }}>Cantidad producida *</label>
                <input type="number" step="any" min="0" value={quantityProduced} onChange={e => setQuantityProduced(e.target.value)} placeholder="0" required />
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label style={{ color: '#a1a1aa', fontSize: '12px', marginBottom: '4px', display: 'block' }}>Unidad</label>
                <select value={unitId} onChange={e => setUnitId(e.target.value)}>
                  {units.map(u => <option key={u.id} value={u.id}>{u.name} ({u.symbol})</option>)}
                </select>
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label style={{ color: '#a1a1aa', fontSize: '12px', marginBottom: '4px', display: 'block' }}>Merma</label>
                <input type="number" step="any" min="0" value={wasteQuantity} onChange={e => setWasteQuantity(e.target.value)} />
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label style={{ color: '#a1a1aa', fontSize: '12px', marginBottom: '4px', display: 'block' }}>Notas</label>
                <input type="text" value={batchNotes} onChange={e => setBatchNotes(e.target.value)} placeholder="Opcional" />
              </div>
            </div>

            {/* Ingredients */}
            <div style={{ marginBottom: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <h4 style={{ color: '#fff', fontSize: '13px' }}>Ingredientes consumidos ({items.length})</h4>
                <button type="button" className="btn-transfer-submit" style={{ margin: 0, padding: '6px 12px', fontSize: '12px' }} onClick={handleAddItem}>
                  <Plus size={14} /> Agregar
                </button>
              </div>
              {items.map((item, idx) => (
                <div key={idx} style={{ display: 'grid', gridTemplateColumns: '2fr 100px 100px 36px', gap: '8px', alignItems: 'end', marginBottom: '8px' }}>
                  <SearchSelect
                    options={ingredients.map(i => ({ value: i.id, label: `${i.name} (${i.unitSymbol})` }))}
                    value={item.ingredientId}
                    onChange={val => handleItemChange(idx, 'ingredientId', val)}
                    placeholder="Buscar ingrediente..."
                    emptyText="Sin ingredientes"
                  />
                  <input type="number" step="any" min="0" placeholder="Cantidad" value={item.quantityUsed} onChange={e => handleItemChange(idx, 'quantityUsed', e.target.value)} />
                  <select value={item.unitId} onChange={e => handleItemChange(idx, 'unitId', e.target.value)}>
                    {units.map(u => <option key={u.id} value={u.id}>{u.symbol}</option>)}
                  </select>
                  <button type="button" onClick={() => handleRemoveItem(idx)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '4px' }}>
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
              {items.length === 0 && <p style={{ color: '#71717a', fontSize: '13px' }}>Agrega ingredientes consumidos en este lote.</p>}
            </div>

            <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '12px', textAlign: 'right' }}>
              <button type="submit" className="btn-transfer-submit" style={{ margin: 0 }} disabled={saving || !batchName.trim() || !quantityProduced || items.length === 0}>
                {saving ? <><Loader2 size={16} className="animate-spin" /> Guardando...</> : 'Registrar Lote'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Batch history */}
      <div className="card table-card mt-6">
        <div className="card-header">
          <h2 className="card-title">Lotes registrados</h2>
        </div>
        <div className="table-responsive-wrapper">
          <table className="almacen-table">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Producto</th>
                <th>Producido</th>
                <th>Merma</th>
                <th>Costo</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {batches.map(batch => (
                <tr key={batch.id}>
                  <td>{batch.productionDate}</td>
                  <td>{batch.productName}</td>
                  <td>{batch.quantityProduced} {batch.unitProduced}</td>
                  <td>{batch.wasteQuantity}</td>
                  <td>${batch.totalCost.toFixed(2)}</td>
                  <td>{batch.status}</td>
                </tr>
              ))}
              {batches.length === 0 && (
                <tr><td colSpan={6} style={{ textAlign: 'center', color: '#71717a' }}>Todavía no hay lotes registrados.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Bonuses */}
      <div className="card table-card mt-6">
        <div className="card-header">
          <h2 className="card-title">Bonos registrados ({bonuses.length})</h2>
        </div>
        {bonuses.length === 0 && <p style={{ color: '#71717a', padding: '16px' }}>Todavía no hay bonos de producción.</p>}
      </div>
    </div>
  )
}
