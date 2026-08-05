import { useState } from 'react'
import './Compras.css'

interface Purchase {
  id: string
  supplier: string
  invoiceNo: string
  total: number
  date: string
  status: 'paid' | 'pending'
  itemsCount: number
}

export function Compras() {
  const [purchases, setPurchases] = useState<Purchase[]>([
    {
      id: 'PUR-001',
      supplier: 'Distribuidora Carnes El Oriental',
      invoiceNo: 'FACT-9081',
      total: 350.0,
      date: new Date().toISOString().split('T')[0],
      status: 'paid',
      itemsCount: 4,
    },
    {
      id: 'PUR-002',
      supplier: 'Insumos y Empaques China Vzla',
      invoiceNo: 'FACT-1102',
      total: 120.5,
      date: new Date().toISOString().split('T')[0],
      status: 'pending',
      itemsCount: 2,
    },
  ])

  const [showModal, setShowModal] = useState(false)
  const [supplier, setSupplier] = useState('')
  const [invoiceNo, setInvoiceNo] = useState('')
  const [total, setTotal] = useState('')
  const [status, setStatus] = useState<'paid' | 'pending'>('paid')

  const handleCreatePurchase = (e: React.FormEvent) => {
    e.preventDefault()
    const newPur: Purchase = {
      id: `PUR-${100 + purchases.length + 1}`,
      supplier: supplier || 'Proveedor General',
      invoiceNo: invoiceNo || 'S/N',
      total: parseFloat(total) || 0,
      date: new Date().toISOString().split('T')[0],
      status,
      itemsCount: 3,
    }
    setPurchases([newPur, ...purchases])
    setShowModal(false)
    setSupplier('')
    setInvoiceNo('')
    setTotal('')
  }

  return (
    <div className="page animate-fade-in">
      <header className="page-header">
        <div>
          <h1 className="page-title text-gradient">Registro de Compras</h1>
          <p className="page-subtitle">Facturas de compras, proveedores e insumos recibidos</p>
        </div>
        <button className="btn-accent" onClick={() => setShowModal(true)}>
          ➕ Registrar Compra
        </button>
      </header>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon">🛍️</div>
          <div className="stat-info">
            <span className="stat-value">
              ${purchases.reduce((sum, p) => sum + p.total, 0).toFixed(2)}
            </span>
            <span className="stat-label">Compras totales del mes</span>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">⏳</div>
          <div className="stat-info">
            <span className="stat-value">
              ${purchases.filter(p => p.status === 'pending').reduce((sum, p) => sum + p.total, 0).toFixed(2)}
            </span>
            <span className="stat-label">Pendiente por pagar</span>
          </div>
        </div>
      </div>

      <div className="card table-card mt-6">
        <div className="card-header">
          <h2 className="card-title">Historial de Compras de Materia Prima</h2>
        </div>
        <table className="data-table">
          <thead>
            <tr>
              <th>ID Compra</th>
              <th>Proveedor</th>
              <th>Factura Nº</th>
              <th>Fecha</th>
              <th>Monto Total</th>
              <th>Estado de Pago</th>
            </tr>
          </thead>
          <tbody>
            {purchases.map(p => (
              <tr key={p.id}>
                <td>
                  <strong>{p.id}</strong>
                </td>
                <td>{p.supplier}</td>
                <td>{p.invoiceNo}</td>
                <td>{p.date}</td>
                <td>
                  <strong>${p.total.toFixed(2)}</strong>
                </td>
                <td>
                  <span className={`badge ${p.status === 'paid' ? 'badge-success' : 'badge-warning'}`}>
                    {p.status === 'paid' ? '✅ Pagada' : '⏳ Pendiente'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content animate-pop" onClick={e => e.stopPropagation()}>
            <header className="modal-header">
              <h2>Registrar Nueva Compra</h2>
              <button className="modal-close" onClick={() => setShowModal(false)}>
                ✕
              </button>
            </header>
            <form onSubmit={handleCreatePurchase} className="modal-body form-grid">
              <div className="field">
                <label className="field-label">Nombre del Proveedor</label>
                <input
                  type="text"
                  className="field-input"
                  placeholder="Ej. Distribuidora El Sol"
                  value={supplier}
                  onChange={e => setSupplier(e.target.value)}
                  required
                />
              </div>

              <div className="field">
                <label className="field-label">Número de Factura</label>
                <input
                  type="text"
                  className="field-input"
                  placeholder="Ej. FACT-1234"
                  value={invoiceNo}
                  onChange={e => setInvoiceNo(e.target.value)}
                  required
                />
              </div>

              <div className="field">
                <label className="field-label">Monto Total ($)</label>
                <input
                  type="number"
                  step="0.01"
                  className="field-input"
                  placeholder="0.00"
                  value={total}
                  onChange={e => setTotal(e.target.value)}
                  required
                />
              </div>

              <div className="field">
                <label className="field-label">Estado del Pago</label>
                <select
                  className="field-input"
                  value={status}
                  onChange={e => setStatus(e.target.value as 'paid' | 'pending')}
                >
                  <option value="paid">Pagada en efectivo / transferencia</option>
                  <option value="pending">Pendiente por pagar (Crédito Proveedor)</option>
                </select>
              </div>

              <div className="modal-footer">
                <button type="submit" className="btn-accent">
                  Guardar Compra
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
