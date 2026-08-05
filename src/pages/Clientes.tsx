import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../context/auth-context'
import { getCredits, addCreditPayment, createCredit, getOrdersWithItems, type Credit as CreditType } from '../lib/dataService'
import './Clientes.css'

export function Clientes() {
  const { user } = useAuth()
  const [credits, setCredits] = useState<CreditType[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [showNewModal, setShowNewModal] = useState(false)
  const [newClientName, setNewClientName] = useState('')
  const [newCreditAmount, setNewCreditAmount] = useState('')

  const [paymentModal, setPaymentModal] = useState<CreditType | null>(null)
  const [paymentAmount, setPaymentAmount] = useState('')

  const fetchCredits = useCallback(async () => {
    try {
      const data = await getCredits()
      setCredits(data)
    } catch (e) {
      console.error('Error cargando créditos:', e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchCredits()
  }, [fetchCredits])

  const handleCreateCredit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newClientName.trim() || !newCreditAmount || parseFloat(newCreditAmount) <= 0 || !user) return

    try {
      const orders = await getOrdersWithItems()
      const orderId = orders[0]?.id
      if (!orderId) {
        alert('No hay órdenes disponibles para asociar el crédito')
        return
      }

      await createCredit({
        orderId,
        customerName: newClientName.trim(),
        totalAmount: parseFloat(newCreditAmount),
        userId: user.id,
      })
      setNewClientName('')
      setNewCreditAmount('')
      setShowNewModal(false)
      fetchCredits()
    } catch (e) {
      console.error('Error creando crédito:', e)
      alert('Error al crear crédito')
    }
  }

  const handlePayment = async (e: React.FormEvent) => {
    e.preventDefault()
    if (paymentModal && paymentAmount && parseFloat(paymentAmount) > 0 && user) {
      try {
        await addCreditPayment({
          creditId: paymentModal.id,
          amount: parseFloat(paymentAmount),
          userId: user.id,
        })
        setPaymentModal(null)
        setPaymentAmount('')
        fetchCredits()
      } catch (e) {
        console.error('Error registrando abono:', e)
        alert('Error al registrar abono')
      }
    }
  }

  const filteredCredits = credits.filter(c =>
    c.customerName.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const totalOutstanding = credits.reduce((acc, c) => acc + c.balancePending, 0)
  const totalPaid = credits.reduce((acc, c) => acc + c.totalPaid, 0)

  if (loading) {
    return (
      <div className="page animate-fade-in">
        <header className="page-header clients-header">
          <div>
            <h1 className="page-title text-gradient">Clientes & CRM</h1>
            <p className="page-subtitle">Cargando...</p>
          </div>
        </header>
      </div>
    )
  }

  return (
    <div className="page animate-fade-in">
      <header className="page-header clients-header">
        <div>
          <h1 className="page-title text-gradient">Clientes & CRM</h1>
          <p className="page-subtitle">Gestión de cuentas corrientes, créditos y fiados</p>
        </div>
        <button className="btn-accent" onClick={() => setShowNewModal(true)}>
          <span>+ Nuevo Cliente / Crédito</span>
        </button>
      </header>

      <div className="crm-stats-grid">
        <div className="crm-stat-card">
          <span className="crm-stat-icon">👥</span>
          <div>
            <span className="crm-stat-value">{credits.length}</span>
            <span className="crm-stat-label">Clientes registrados</span>
          </div>
        </div>

        <div className="crm-stat-card warning">
          <span className="crm-stat-icon">⚠️</span>
          <div>
            <span className="crm-stat-value">${totalOutstanding.toFixed(2)}</span>
            <span className="crm-stat-label">Saldo Pendiente Total</span>
          </div>
        </div>

        <div className="crm-stat-card success">
          <span className="crm-stat-icon">✅</span>
          <div>
            <span className="crm-stat-value">${totalPaid.toFixed(2)}</span>
            <span className="crm-stat-label">Total Recaudado</span>
          </div>
        </div>
      </div>

      <div className="crm-search-bar">
        <input
          type="text"
          placeholder="🔍 Buscar cliente por nombre..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="crm-search-input"
        />
      </div>

      <div className="clients-grid">
        {filteredCredits.length === 0 ? (
          <div className="card empty-crm">
            <p className="empty-message">No se encontraron clientes o créditos en el sistema.</p>
          </div>
        ) : (
          filteredCredits.map(credit => {
            const percentPaid = credit.totalAmount > 0 ? Math.min(100, (credit.totalPaid / credit.totalAmount) * 100) : 100
            const isSettled = credit.balancePending === 0

            return (
              <div key={credit.id} className={`client-card ${isSettled ? 'settled' : ''}`}>
                <div className="client-card-header">
                  <div className="client-avatar">
                    {credit.customerName.charAt(0).toUpperCase()}
                  </div>
                  <div className="client-details">
                    <h3 className="client-name">{credit.customerName}</h3>
                    <span className="client-date">Registrado: {new Date(credit.createdAt).toLocaleDateString('es')}</span>
                  </div>
                  <span className={`status-pill ${isSettled ? 'settled' : 'pending'}`}>
                    {isSettled ? 'Al día' : 'Pendiente'}
                  </span>
                </div>

                <div className="client-financials">
                  <div className="fin-col">
                    <span className="fin-label">Monto total</span>
                    <span className="fin-value">${credit.totalAmount.toFixed(2)}</span>
                  </div>
                  <div className="fin-col">
                    <span className="fin-label">Abonado</span>
                    <span className="fin-value text-success">${credit.totalPaid.toFixed(2)}</span>
                  </div>
                  <div className="fin-col">
                    <span className="fin-label">Saldo deudor</span>
                    <span className={`fin-value ${credit.balancePending > 0 ? 'text-danger' : ''}`}>
                      ${credit.balancePending.toFixed(2)}
                    </span>
                  </div>
                </div>

                <div className="progress-container">
                  <div className="progress-bar" style={{ width: `${percentPaid}%` }} />
                </div>

                <div className="client-card-actions">
                  {!isSettled ? (
                    <button className="btn-accent btn-sm btn-block" onClick={() => setPaymentModal(credit)}>
                      💵 Registrar Abono
                    </button>
                  ) : (
                    <button className="btn-ghost btn-sm btn-block" disabled>
                      ✓ Cuenta al día
                    </button>
                  )}
                </div>
              </div>
            )
          })
        )}
      </div>

      {showNewModal && (
        <div className="modal-overlay" onClick={() => setShowNewModal(false)}>
          <div className="modal animate-slide-up" onClick={(e) => e.stopPropagation()}>
            <h3 className="modal-title">Registrar Cliente / Nuevo Crédito</h3>
            <form onSubmit={handleCreateCredit} className="crm-form">
              <div className="field">
                <label className="field-label">Nombre Completo *</label>
                <input
                  type="text"
                  placeholder="Ej: Carlos Gómez"
                  value={newClientName}
                  onChange={(e) => setNewClientName(e.target.value)}
                  required
                />
              </div>

              <div className="field">
                <label className="field-label">Monto del Crédito / Fiado ($) *</label>
                <input
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={newCreditAmount}
                  onChange={(e) => setNewCreditAmount(e.target.value)}
                  required
                />
              </div>

              <div className="modal-actions">
                <button type="button" className="btn-ghost" onClick={() => setShowNewModal(false)}>
                  Cancelar
                </button>
                <button type="submit" className="btn-accent">
                  Guardar Cliente
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {paymentModal && (
        <div className="modal-overlay" onClick={() => setPaymentModal(null)}>
          <div className="modal animate-slide-up" onClick={(e) => e.stopPropagation()}>
            <h3 className="modal-title">Abonar a Crédito</h3>
            <p className="modal-subtitle">Cliente: <strong>{paymentModal.customerName}</strong></p>
            <p className="modal-remaining">Deuda restante: <span>${paymentModal.balancePending.toFixed(2)}</span></p>

            <form onSubmit={handlePayment} className="crm-form">
              <div className="field">
                <label className="field-label">Monto a abonar ($)</label>
                <input
                  type="number"
                  step="0.01"
                  max={paymentModal.balancePending}
                  placeholder={`Máximo $${paymentModal.balancePending.toFixed(2)}`}
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  required
                  autoFocus
                />
              </div>

              <div className="modal-actions">
                <button type="button" className="btn-ghost" onClick={() => setPaymentModal(null)}>
                  Cancelar
                </button>
                <button type="submit" className="btn-accent">
                  Confirmar Pago
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
