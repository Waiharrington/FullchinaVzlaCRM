import { useState, useEffect } from 'react'
import { createExpense, getExpenses } from '../lib/dataService'
import { useAuth } from '../context/auth-context'
import { getExchangeRates } from '../lib/rates'
import { Receipt, DollarSign, Store, ShoppingBag, Plus, CheckCircle2, TrendingDown } from 'lucide-react'
import './Gastos.css'

export function Gastos() {
  type ExpenseView = { id: string; description: string; type: 'fixed' | 'variable'; category: string; vendor: string; amountUsd: number; amountBs: number; date: string; paymentMethod: string; reference?: string }
  const { user } = useAuth()
  const [expenses, setExpenses] = useState<ExpenseView[]>([])
  const [exchangeRate, setExchangeRate] = useState<number>(36.5)

  // Form State
  const [description, setDescription] = useState('')
  const [type, setType] = useState<'fixed' | 'variable'>('variable')
  const [category, setCategory] = useState('supermarket')
  const [vendor, setVendor] = useState('Aradito Supermercado')
  const [amountUsd, setAmountUsd] = useState(30)
  const [paymentMethod, setPaymentMethod] = useState('pago_movil')
  const [reference, setReference] = useState('')
  const [successNotice, setSuccessNotice] = useState('')

  useEffect(() => {
    getExchangeRates().then(rates => {
      if (rates.bcv > 0) {
        setExchangeRate(rates.bcv)
      }
    }).catch(() => {})
    getExpenses().then(data => setExpenses(data.map(item => {
      let meta: Record<string, string> = {}
      try { meta = item.notes ? JSON.parse(item.notes) as Record<string, string> : {} } catch { meta = {} }
      return { id: item.id, description: item.concept, type: item.category === 'fixed' ? 'fixed' : 'variable', category: meta.category || item.category, vendor: meta.vendor || 'Sin proveedor', amountUsd: item.amount, amountBs: 0, date: item.expenseDate, paymentMethod: meta.paymentMethod || 'other', reference: meta.reference || undefined }
    }))).catch(error => setSuccessNotice(error instanceof Error ? error.message : 'No se pudieron cargar los gastos'))
  }, [])

  const totalUsd = expenses.reduce((s, e) => s + e.amountUsd, 0)
  const totalFixedUsd = expenses.filter(e => e.type === 'fixed').reduce((s, e) => s + e.amountUsd, 0)
  const totalVariableUsd = expenses.filter(e => e.type === 'variable').reduce((s, e) => s + e.amountUsd, 0)
  const totalAraditoUsd = expenses.filter(e => e.vendor.includes('Aradito')).reduce((s, e) => s + e.amountUsd, 0)

  const handleAddExpense = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!description.trim() || amountUsd <= 0) return

    if (!user) return
    const saved = await createExpense({ concept: description, amount: amountUsd, category: type, expenseDate: new Date().toISOString().split('T')[0], userId: user.id, notes: JSON.stringify({ category, vendor, paymentMethod, reference: reference.trim() }) })
    const newExpense: ExpenseView = { id: saved.id, description, type, category, vendor, amountUsd, amountBs: amountUsd * exchangeRate, date: saved.expenseDate, paymentMethod, reference: reference.trim() || undefined }

    setExpenses(prev => [newExpense, ...prev])
    setSuccessNotice(`¡Gasto de $${amountUsd.toFixed(2)} registrado en ${vendor}!`)
    setDescription('')
    setReference('')
    setTimeout(() => setSuccessNotice(''), 4000)
  }

  return (
    <div className="gastos-page">
      {/* Metrics Banner */}
      <div className="almacen-metrics-grid">
        <div className="almacen-metric-card">
          <div className="metric-icon-box red">
            <TrendingDown size={24} />
          </div>
          <div className="metric-info-group">
            <span className="metric-label">Egresos Totales</span>
            <span className="metric-large-val">${totalUsd.toFixed(2)}</span>
            <span className="metric-sub-text">{(totalUsd * exchangeRate).toLocaleString()} Bs.</span>
          </div>
        </div>

        <div className="almacen-metric-card">
          <div className="metric-icon-box orange">
            <Receipt size={24} />
          </div>
          <div className="metric-info-group">
            <span className="metric-label">Gastos Fijos</span>
            <span className="metric-large-val">${totalFixedUsd.toFixed(2)}</span>
            <span className="metric-sub-text">Nómina, comisiones, delivery</span>
          </div>
        </div>

        <div className="almacen-metric-card">
          <div className="metric-icon-box purple">
            <DollarSign size={24} />
          </div>
          <div className="metric-info-group">
            <span className="metric-label">Gastos Variables</span>
            <span className="metric-large-val">${totalVariableUsd.toFixed(2)}</span>
            <span className="metric-sub-text">Pan, emergencias, compras</span>
          </div>
        </div>

        <div className="almacen-metric-card">
          <div className="metric-icon-box green">
            <Store size={24} />
          </div>
          <div className="metric-info-group">
            <span className="metric-label">Gastos en Aradito</span>
            <span className="metric-large-val">${totalAraditoUsd.toFixed(2)}</span>
            <span className="metric-sub-text">Desglose por supermercado</span>
          </div>
        </div>
      </div>

      <div className="gastos-grid">
        {/* Left Column: Expenses Table */}
        <div className="almacen-card">
          <div className="prod-card-header-bar">
            <div className="header-title-group">
              <div className="card-header-icon-red">
                <ShoppingBag size={18} />
              </div>
              <div>
                <h2 className="prod-card-title">Registro de Egresos y Gastos Operativos</h2>
                <span className="metric-sub-text">Desglose por tipo, categoría y establecimiento comercial</span>
              </div>
            </div>
          </div>

          <div className="table-responsive-wrapper">
            <table className="almacen-table">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Descripción</th>
                  <th>Tipo</th>
                  <th>Establecimiento / Proveedor</th>
                  <th>Monto USD</th>
                  <th>Monto Bs</th>
                  <th>Método / Ref.</th>
                </tr>
              </thead>
              <tbody>
                {expenses.map(ex => (
                  <tr key={ex.id}>
                    <td style={{ fontSize: '11px', color: '#71717a' }}>{ex.date}</td>
                    <td style={{ fontWeight: 700, color: '#fff' }}>{ex.description}</td>
                    <td>
                      <span className={ex.type === 'fixed' ? 'badge-expense-fixed' : 'badge-expense-variable'}>
                        {ex.type === 'fixed' ? 'Fijo' : 'Variable'}
                      </span>
                    </td>
                    <td style={{ fontWeight: 600 }}>{ex.vendor}</td>
                    <td style={{ fontWeight: 800, color: '#ef4444' }}>-${ex.amountUsd.toFixed(2)}</td>
                    <td style={{ color: '#a1a1aa' }}>-{(ex.amountUsd * exchangeRate).toLocaleString()} Bs</td>
                    <td style={{ fontSize: '11px', color: '#71717a', textTransform: 'capitalize' }}>
                      {ex.paymentMethod.replace('_', ' ')} {ex.reference ? `(${ex.reference})` : ''}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right Column: Register New Expense */}
        <div className="almacen-card">
          <div className="prod-card-header-bar">
            <div className="header-title-group">
              <div className="card-header-icon-red">
                <Plus size={18} />
              </div>
              <div>
                <h3 className="prod-card-title">Registrar Nuevo Gasto</h3>
                <span className="metric-sub-text">Cargar egreso desde el teléfono o laptop</span>
              </div>
            </div>
          </div>

          {successNotice && (
            <div style={{ background: 'rgba(16, 185, 129, 0.15)', border: '1px solid rgba(16, 185, 129, 0.3)', color: '#10b981', padding: '10px 14px', borderRadius: '8px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <CheckCircle2 size={16} />
              <span>{successNotice}</span>
            </div>
          )}

          <form onSubmit={handleAddExpense} className="transfer-form-box">
            <div className="select-field-group">
              <label className="field-label">Descripción del Gasto</label>
              <input 
                type="text"
                className="field-select"
                placeholder="Ej. Compras de verduras y pollo"
                value={description}
                onChange={e => setDescription(e.target.value)}
                required
              />
            </div>

            <div style={{ display: 'flex', gap: '12px' }}>
              <div className="select-field-group flex-1">
                <label className="field-label">Tipo de Gasto</label>
                <select className="field-select" value={type} onChange={e => setType(e.target.value as 'fixed' | 'variable')}>
                  <option value="fixed">Gasto Fijo</option>
                  <option value="variable">Gasto Variable</option>
                </select>
              </div>

              <div className="select-field-group flex-1">
                <label className="field-label">Categoría</label>
                <select className="field-select" value={category} onChange={e => setCategory(e.target.value)}>
                  <option value="supermarket">Supermercado</option>
                  <option value="payroll">Nómina</option>
                  <option value="delivery">Delivery</option>
                  <option value="maintenance">Mantenimiento Punto</option>
                  <option value="pos_commission">Comisión Bancaria</option>
                  <option value="cleaning">Limpieza</option>
                  <option value="other">Otro Gasto</option>
                </select>
              </div>
            </div>

            <div className="select-field-group">
              <label className="field-label">Establecimiento / Proveedor</label>
              <select className="field-select" value={vendor} onChange={e => setVendor(e.target.value)}>
                <option value="Aradito Supermercado">Aradito Supermercado</option>
                <option value="Euro-Mercado">Euro-Mercado</option>
                <option value="Macro Comercial">Macro Comercial</option>
                <option value="Credicard Service">Credicard Service</option>
                <option value="Banesco / BDV">Banesco / BDV</option>
                <option value="Equipo Delivery">Equipo Delivery</option>
                <option value="Otro Proveedor">Otro Proveedor</option>
              </select>
            </div>

            <div style={{ display: 'flex', gap: '12px' }}>
              <div className="select-field-group flex-1">
                <label className="field-label">Monto ($ USD)</label>
                <input 
                  type="number"
                  step="0.5"
                  className="field-select"
                  value={amountUsd}
                  onChange={e => setAmountUsd(Number(e.target.value))}
                />
              </div>

              <div className="select-field-group flex-1">
                <label className="field-label">Método de Pago</label>
                <select className="field-select" value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)}>
                  <option value="pago_movil">Pago Móvil</option>
                  <option value="efectivo_usd">Efectivo USD</option>
                  <option value="efectivo_bs">Efectivo Bs</option>
                  <option value="transferencia">Transferencia</option>
                </select>
              </div>
            </div>

            <div className="select-field-group">
              <label className="field-label">N° de Referencia (Opcional)</label>
              <input 
                type="text"
                className="field-select"
                placeholder="Ej. 984521"
                value={reference}
                onChange={e => setReference(e.target.value)}
              />
            </div>

            <button type="submit" className="btn-primary-red" style={{ marginTop: '8px' }}>
              <Plus size={16} />
              <span>Registrar Gasto</span>
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
