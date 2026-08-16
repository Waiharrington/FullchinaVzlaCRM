import { useEffect, useState, useCallback } from 'react'
import {
  getSuppliers, createSupplier, getPurchases, createPurchase,
  getIngredients, getUnits,
  type Supplier, type Purchase, type Ingredient,
} from '../lib/dataService'
import { SearchSelect } from '../components/SearchSelect'
import { useAuth } from '../context/auth-context'
import { MoneyWithBcv } from '../components/MoneyWithBcv'
import {
  ShoppingBag, Plus, Trash2, CheckCircle2, AlertTriangle, Loader2, ChevronUp,
} from 'lucide-react'
import './Gastos.css'

interface PurchaseItemForm {
  ingredientId: string
  quantity: string
  unitId: string
  unitCost: string
}

export function ComprasReal() {
  const { user } = useAuth()
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [purchases, setPurchases] = useState<Purchase[]>([])
  const [ingredients, setIngredients] = useState<Ingredient[]>([])
  const [units, setUnits] = useState<Array<{ id: string; name: string; symbol: string }>>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  // New purchase form
  const [showForm, setShowForm] = useState(false)
  const [supplierId, setSupplierId] = useState('')
  const [purchaseDate, setPurchaseDate] = useState(new Date().toISOString().split('T')[0])
  const [invoiceNumber, setInvoiceNumber] = useState('')
  const [notes, setNotes] = useState('')
  const [items, setItems] = useState<PurchaseItemForm[]>([])
  const [saving, setSaving] = useState(false)

  // Quick supplier creation
  const [showSupplierForm, setShowSupplierForm] = useState(false)
  const [newSupplierName, setNewSupplierName] = useState('')
  const [newSupplierPhone, setNewSupplierPhone] = useState('')

  const load = useCallback(async () => {
    try {
      setLoading(true)
      setError('')
      const [sup, purch, ingr, un] = await Promise.all([
        getSuppliers(),
        getPurchases().catch(() => []),
        getIngredients(),
        getUnits(),
      ])
      setSuppliers(sup)
      setPurchases(purch)
      setIngredients(ingr)
      setUnits(un)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error cargando datos')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  const handleAddItem = () => {
    setItems([...items, {
      ingredientId: ingredients[0]?.id ?? '',
      quantity: '1',
      unitId: ingredients[0]?.unitId ?? units[0]?.id ?? '',
      unitCost: '0',
    }])
  }

  const handleRemoveItem = (idx: number) => {
    setItems(items.filter((_, i) => i !== idx))
  }

  const handleItemChange = (idx: number, field: keyof PurchaseItemForm, value: string) => {
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

  const totalItems = items.reduce((sum, item) => {
    const qty = parseFloat(item.quantity) || 0
    const cost = parseFloat(item.unitCost) || 0
    return sum + qty * cost
  }, 0)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!supplierId || items.length === 0) return
    try {
      setSaving(true)
      setError('')
      await createPurchase({
        supplierId,
        purchaseDate,
        invoiceNumber: invoiceNumber.trim() || undefined,
        notes: notes.trim() || undefined,
        userId: user?.id ?? '',
        items: items.map(item => ({
          ingredientId: item.ingredientId,
          quantity: parseFloat(item.quantity) || 0,
          unitId: item.unitId,
          unitCost: parseFloat(item.unitCost) || 0,
        })),
      })
      setNotice('Compra registrada correctamente')
      setShowForm(false)
      setSupplierId('')
      setPurchaseDate(new Date().toISOString().split('T')[0])
      setInvoiceNumber('')
      setNotes('')
      setItems([])
      await load()
      setTimeout(() => setNotice(''), 4000)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error guardando compra')
    } finally {
      setSaving(false)
    }
  }

  const handleCreateSupplier = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newSupplierName.trim()) return
    try {
      const id = await createSupplier({
        name: newSupplierName.trim(),
        phone: newSupplierPhone.trim() || undefined,
      })
      setSuppliers(prev => [...prev, { id, name: newSupplierName.trim(), contact: null, phone: newSupplierPhone.trim() || null, email: null, notes: null, isActive: true }])
      setSupplierId(id)
      setShowSupplierForm(false)
      setNewSupplierName('')
      setNewSupplierPhone('')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error creando proveedor')
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
          <h1 className="page-title text-gradient">Compras e Insumos</h1>
          <p className="page-subtitle">Registrar nuevas compras, gestionar proveedores e historial</p>
        </div>
        <button
          className="btn-transfer-submit"
          style={{ margin: 0 }}
          onClick={() => { setShowForm(!showForm); setError(''); setItems([]); setSupplierId(''); setInvoiceNumber(''); setNotes('') }}
        >
          {showForm ? <><ChevronUp size={16} /> Cerrar</> : <><Plus size={16} /> Nueva Compra</>}
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

      {/* New purchase form */}
      {showForm && (
        <div className="almacen-card mb-6">
          <h3 style={{ color: '#fff', fontSize: '15px', fontWeight: 700, marginBottom: '16px' }}>
            <ShoppingBag size={18} style={{ verticalAlign: 'middle', marginRight: '8px' }} />
            Registrar Nueva Compra
          </h3>
          <form onSubmit={handleSubmit}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px', marginBottom: '16px' }}>
              <div className="form-group" style={{ margin: 0 }}>
                <label style={{ color: '#a1a1aa', fontSize: '12px', marginBottom: '4px', display: 'block' }}>Proveedor *</label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <select
                    value={supplierId}
                    onChange={e => setSupplierId(e.target.value)}
                    required
                    style={{ flex: 1 }}
                  >
                    <option value="">Seleccionar...</option>
                    {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                  <button
                    type="button"
                    className="btn-transfer-submit"
                    style={{ margin: 0, padding: '6px 10px', fontSize: '12px', whiteSpace: 'nowrap' }}
                    onClick={() => setShowSupplierForm(!showSupplierForm)}
                  >
                    <Plus size={14} /> Proveedor
                  </button>
                </div>
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label style={{ color: '#a1a1aa', fontSize: '12px', marginBottom: '4px', display: 'block' }}>Fecha</label>
                <input type="date" value={purchaseDate} onChange={e => setPurchaseDate(e.target.value)} />
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label style={{ color: '#a1a1aa', fontSize: '12px', marginBottom: '4px', display: 'block' }}>Factura #</label>
                <input type="text" value={invoiceNumber} onChange={e => setInvoiceNumber(e.target.value)} placeholder="Opcional" />
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label style={{ color: '#a1a1aa', fontSize: '12px', marginBottom: '4px', display: 'block' }}>Notas</label>
                <input type="text" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Opcional" />
              </div>
            </div>

            {/* Quick supplier creation */}
            {showSupplierForm && (
              <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', padding: '12px', marginBottom: '16px' }}>
                <h4 style={{ color: '#fff', fontSize: '13px', marginBottom: '8px' }}>Crear proveedor rápido</h4>
                <form onSubmit={handleCreateSupplier} style={{ display: 'flex', gap: '8px', alignItems: 'end' }}>
                  <input type="text" placeholder="Nombre *" value={newSupplierName} onChange={e => setNewSupplierName(e.target.value)} required style={{ flex: 2 }} />
                  <input type="text" placeholder="Teléfono" value={newSupplierPhone} onChange={e => setNewSupplierPhone(e.target.value)} style={{ flex: 1 }} />
                  <button type="submit" className="btn-transfer-submit" style={{ margin: 0, padding: '8px 12px', fontSize: '12px' }}>Crear</button>
                </form>
              </div>
            )}

            {/* Items */}
            <div style={{ marginBottom: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <h4 style={{ color: '#fff', fontSize: '13px' }}>Ítems ({items.length})</h4>
                <button type="button" className="btn-transfer-submit" style={{ margin: 0, padding: '6px 12px', fontSize: '12px' }} onClick={handleAddItem}>
                  <Plus size={14} /> Agregar ítem
                </button>
              </div>
              {items.map((item, idx) => (
                <div key={idx} style={{ display: 'grid', gridTemplateColumns: '2fr 80px 100px 100px 36px', gap: '8px', alignItems: 'end', marginBottom: '8px' }}>
                  <SearchSelect
                    options={ingredients.map(i => ({ value: i.id, label: `${i.name} (${i.unitSymbol})` }))}
                    value={item.ingredientId}
                    onChange={val => handleItemChange(idx, 'ingredientId', val)}
                    placeholder="Buscar ingrediente..."
                    emptyText="Sin ingredientes"
                  />
                  <input type="number" step="any" min="0" placeholder="Cant." value={item.quantity} onChange={e => handleItemChange(idx, 'quantity', e.target.value)} />
                  <select value={item.unitId} onChange={e => handleItemChange(idx, 'unitId', e.target.value)}>
                    {units.map(u => <option key={u.id} value={u.id}>{u.symbol}</option>)}
                  </select>
                  <input type="number" step="any" min="0" placeholder="$ / unidad" value={item.unitCost} onChange={e => handleItemChange(idx, 'unitCost', e.target.value)} />
                  <button type="button" onClick={() => handleRemoveItem(idx)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '4px' }}>
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
              {items.length === 0 && (
                <p style={{ color: '#71717a', fontSize: '13px' }}>No hay ítems. Haz clic en "Agregar ítem" para comenzar.</p>
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '12px' }}>
              <span style={{ color: '#a1a1aa', fontSize: '14px' }}>Total: <strong style={{ color: '#fff' }}>${totalItems.toFixed(2)}</strong></span>
              <button type="submit" className="btn-transfer-submit" style={{ margin: 0 }} disabled={saving || !supplierId || items.length === 0}>
                {saving ? <><Loader2 size={16} className="animate-spin" /> Guardando...</> : <>Registrar Compra</>}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Purchase history */}
      <div className="card table-card mt-6">
        <div className="card-header">
          <h2 className="card-title">Historial de Compras</h2>
        </div>
        <div className="table-responsive-wrapper">
          <table className="almacen-table">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Proveedor</th>
                <th>Factura</th>
                <th>Ítems</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              {purchases.map(p => (
                <tr key={p.id}>
                  <td>{new Date(p.purchaseDate).toLocaleDateString('es-VE')}</td>
                  <td>{p.supplierName || '—'}</td>
                  <td>{p.invoiceNumber || '—'}</td>
                  <td>{p.items.length}</td>
                  <td><MoneyWithBcv usd={p.totalAmount} compact /></td>
                </tr>
              ))}
              {purchases.length === 0 && (
                <tr><td colSpan={5} style={{ textAlign: 'center', color: '#71717a' }}>No hay compras registradas.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
