import { useState, useMemo } from 'react'
import { useDemoData } from '../context/demo-data-context'
import jsPDF from 'jspdf'
import type { Credit } from '../context/demo-data-context'
import './Mas.css'

type Tab = 'credits' | 'close'

export function Mas() {
  const { credits, orders, todayStats, creditPayments, addCredit, addCreditPayment } = useDemoData()
  const [tab, setTab] = useState<Tab>('credits')
  const [showNewCredit, setShowNewCredit] = useState(false)
  const [newClient, setNewClient] = useState('')
  const [newPhone, setNewPhone] = useState('')
  const [newAmount, setNewAmount] = useState('')
  const [paymentModal, setPaymentModal] = useState<Credit | null>(null)
  const [paymentAmount, setPaymentAmount] = useState('')
  const [selectedCredit, setSelectedCredit] = useState<Credit | null>(null)

  const handleCreateCredit = () => {
    if (newClient && newAmount) {
      addCredit(newClient, parseFloat(newAmount), newPhone || undefined)
      setNewClient('')
      setNewPhone('')
      setNewAmount('')
      setShowNewCredit(false)
    }
  }

  const handlePayment = () => {
    if (paymentModal && paymentAmount) {
      addCreditPayment(paymentModal.id, parseFloat(paymentAmount))
      setPaymentModal(null)
      setPaymentAmount('')
    }
  }

  const today = new Date().toISOString().split('T')[0]
  const todayOrders = useMemo(() =>
    orders.filter(o => o.createdAt.startsWith(today) && o.status === 'paid'),
    [orders, today]
  )

  const cashSales = todayOrders.filter(o => o.paymentMethod === 'cash').reduce((s, o) => s + o.total, 0)
  const cardSales = todayOrders.filter(o => o.paymentMethod === 'card').reduce((s, o) => s + o.total, 0)
  const transferSales = todayOrders.filter(o => o.paymentMethod === 'transfer').reduce((s, o) => s + o.total, 0)

  const hourlyBreakdown = useMemo(() => {
    const hours: Record<number, { count: number; total: number }> = {}
    for (let h = 8; h <= 20; h++) hours[h] = { count: 0, total: 0 }
    for (const order of todayOrders) {
      const hour = new Date(order.createdAt).getHours()
      if (hours[hour]) {
        hours[hour].count++
        hours[hour].total += order.total
      }
    }
    return Object.entries(hours)
      .map(([h, data]) => ({ hour: parseInt(h), ...data }))
      .filter(h => h.count > 0)
  }, [todayOrders])

  const topProductsToday = useMemo(() => {
    const map = new Map<string, { name: string; count: number; total: number }>()
    for (const order of todayOrders) {
      for (const item of order.items) {
        const existing = map.get(item.productId)
        if (existing) {
          existing.count += item.quantity
          existing.total += item.price * item.quantity
        } else {
          map.set(item.productId, {
            name: item.productName,
            count: item.quantity,
            total: item.price * item.quantity,
          })
        }
      }
    }
    return Array.from(map.values()).sort((a, b) => b.total - a.total).slice(0, 5)
  }, [todayOrders])

  const selectedCreditPayments = useMemo(() => {
    if (!selectedCredit) return []
    return creditPayments.filter(p => p.creditId === selectedCredit.id)
  }, [selectedCredit, creditPayments])

  const exportDailyClose = () => {
    const doc = new jsPDF()
    const pageWidth = doc.internal.pageSize.getWidth()
    let y = 15

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(18)
    doc.text('Clienta Foodtruck', pageWidth / 2, y, { align: 'center' })
    y += 8

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10)
    doc.text(`Cierre de Caja - ${new Date().toLocaleDateString('es')}`, pageWidth / 2, y, { align: 'center' })
    y += 12

    doc.setDrawColor(200, 200, 200)
    doc.line(15, y, pageWidth - 15, y)
    y += 8

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(12)
    doc.text('Resumen del Dia', 15, y)
    y += 8

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10)
    const summaryLines = [
      `Total ventas: $${todayStats.totalSales.toFixed(2)}`,
      `Ordenes cobradas: ${todayStats.ordersCount}`,
      `Ticket promedio: $${todayStats.avgTicket.toFixed(2)}`,
      '',
      'Metodo de pago:',
      `  Efectivo: $${cashSales.toFixed(2)}`,
      `  Tarjeta: $${cardSales.toFixed(2)}`,
      `  Transferencia: $${transferSales.toFixed(2)}`,
    ]
    for (const line of summaryLines) {
      doc.text(line, 15, y)
      y += 6
    }

    y += 4
    doc.line(15, y, pageWidth - 15, y)
    y += 8

    doc.setFont('helvetica', 'bold')
    doc.text('Productos mas vendidos:', 15, y)
    y += 8
    doc.setFont('helvetica', 'normal')
    for (const p of topProductsToday) {
      doc.text(`  ${p.name}: ${p.count} und - $${p.total.toFixed(2)}`, 15, y)
      y += 6
    }

    y += 8
    doc.line(15, y, pageWidth - 15, y)
    y += 8
    doc.setFontSize(8)
    doc.text('Documento generado automaticamente', pageWidth / 2, y, { align: 'center' })

    doc.save(`cierre-caja-${today}.pdf`)
  }

  const activeCredits = credits.filter(c => c.status === 'active')
  const settledCredits = credits.filter(c => c.status === 'settled')
  const totalPending = activeCredits.reduce((s, c) => s + c.remaining, 0)

  return (
    <div className="page animate-fade-in">
      <header className="page-header">
        <h1 className="page-title text-gradient">Más Módulos y Administración</h1>
        <p className="page-subtitle">Créditos, cierre de caja, finanzas, recetas y auditoría</p>
      </header>

      <div className="module-shortcuts-grid mb-6">
        <a href="/produccion" className="card shortcut-card">
          <span className="shortcut-icon">🥩</span>
          <div className="shortcut-info">
            <span className="shortcut-title">Producción y Porcionado</span>
            <span className="shortcut-desc">Transformación de carnes y bonos por lumpias</span>
          </div>
        </a>
        <a href="/recetas" className="card shortcut-card">
          <span className="shortcut-icon">📖</span>
          <div className="shortcut-info">
            <span className="shortcut-title">Recetas y Costeo</span>
            <span className="shortcut-desc">Cálculo de costo de plato y margen %</span>
          </div>
        </a>
        <a href="/compras" className="card shortcut-card">
          <span className="shortcut-icon">🛍️</span>
          <div className="shortcut-info">
            <span className="shortcut-title">Compras de Insumos</span>
            <span className="shortcut-desc">Facturación y proveedores</span>
          </div>
        </a>
        <a href="/finanzas" className="card shortcut-card">
          <span className="shortcut-icon">📈</span>
          <div className="shortcut-info">
            <span className="shortcut-title">Finanzas y P&L</span>
            <span className="shortcut-desc">Ventas, costos, gastos y utilidad neta</span>
          </div>
        </a>
        <a href="/nomina" className="card shortcut-card">
          <span className="shortcut-icon">💸</span>
          <div className="shortcut-info">
            <span className="shortcut-title">Nómina y Bonos</span>
            <span className="shortcut-desc">Sueldos base, adelantos y comisiones</span>
          </div>
        </a>
        <a href="/auditoria" className="card shortcut-card">
          <span className="shortcut-icon">🛡️</span>
          <div className="shortcut-info">
            <span className="shortcut-title">Auditoría y Registro</span>
            <span className="shortcut-desc">Bitácora de anulaciones y precios</span>
          </div>
        </a>
      </div>

      <div className="tabs">
        <button className={`tab ${tab === 'credits' ? 'active' : ''}`} onClick={() => setTab('credits')}>
          💳 Creditos ({activeCredits.length} activos)
        </button>
        <button className={`tab ${tab === 'close' ? 'active' : ''}`} onClick={() => setTab('close')}>
          📊 Cierre de Caja
        </button>
      </div>

      {tab === 'credits' && (
        <div className="card">
          <div className="card-header-row">
            <div>
              <h2 className="card-title">Cuentas corrientes</h2>
              <p className="card-subtitle">${totalPending.toFixed(2)} pendiente de {credits.length} clientes</p>
            </div>
            <button className="btn-accent btn-sm" onClick={() => setShowNewCredit(true)}>
              + Nuevo credito
            </button>
          </div>

          {showNewCredit && (
            <div className="new-credit-form animate-slide-up">
              <div className="form-row">
                <input
                  type="text"
                  placeholder="Nombre del cliente"
                  value={newClient}
                  onChange={(e) => setNewClient(e.target.value)}
                />
                <input
                  type="tel"
                  placeholder="Telefono (opcional)"
                  value={newPhone}
                  onChange={(e) => setNewPhone(e.target.value)}
                />
              </div>
              <div className="form-row">
                <input
                  type="number"
                  step="0.01"
                  placeholder="Monto del credito"
                  value={newAmount}
                  onChange={(e) => setNewAmount(e.target.value)}
                />
                <div className="form-actions-inline">
                  <button className="btn-ghost" onClick={() => setShowNewCredit(false)}>Cancelar</button>
                  <button className="btn-accent" onClick={handleCreateCredit}>Crear</button>
                </div>
              </div>
            </div>
          )}

          <div className="credits-list">
            {activeCredits.length === 0 && settledCredits.length === 0 ? (
              <p className="empty-message">No hay creditos registrados</p>
            ) : (
              <>
                {activeCredits.length > 0 && (
                  <div className="credits-section">
                    <span className="credits-section-title">Activos</span>
                    {activeCredits.map(credit => {
                      const percentPaid = credit.amount > 0 ? Math.min(100, (credit.paid / credit.amount) * 100) : 100
                      const daysSince = Math.floor((Date.now() - new Date(credit.date).getTime()) / 86400000)
                      const isOverdue = daysSince > 7 && credit.remaining > 0

                      return (
                        <div key={credit.id} className={`credit-item ${isOverdue ? 'overdue' : ''}`}>
                          <div className="credit-header">
                            <div className="credit-avatar">{credit.client.charAt(0).toUpperCase()}</div>
                            <div className="credit-info">
                              <span className="credit-client">{credit.client}</span>
                              <span className="credit-date">
                                {credit.date} · {daysSince}d
                                {isOverdue && <span className="overdue-badge">Vencido</span>}
                              </span>
                            </div>
                          </div>

                          <div className="credit-amounts-row">
                            <div className="credit-amount-col">
                              <span className="credit-amount-label">Total</span>
                              <span className="credit-amount-value">${credit.amount.toFixed(2)}</span>
                            </div>
                            <div className="credit-amount-col">
                              <span className="credit-amount-label">Pagado</span>
                              <span className="credit-amount-value text-success">${credit.paid.toFixed(2)}</span>
                            </div>
                            <div className="credit-amount-col">
                              <span className="credit-amount-label">Pendiente</span>
                              <span className="credit-amount-value text-danger">${credit.remaining.toFixed(2)}</span>
                            </div>
                          </div>

                          <div className="progress-container">
                            <div className="progress-bar" style={{ width: `${percentPaid}%` }} />
                          </div>

                          <div className="credit-actions">
                            <button className="btn-accent btn-sm" onClick={() => setPaymentModal(credit)}>
                              Abonar
                            </button>
                            <button className="btn-ghost btn-sm" onClick={() => setSelectedCredit(selectedCredit?.id === credit.id ? null : credit)}>
                              Historial
                            </button>
                          </div>

                          {selectedCredit?.id === credit.id && (
                            <div className="credit-history animate-slide-up">
                              {selectedCreditPayments.length === 0 ? (
                                <p className="empty-message">Sin abonos registrados</p>
                              ) : (
                                selectedCreditPayments.map(payment => (
                                  <div key={payment.id} className="payment-history-item">
                                    <span className="payment-date">
                                      {new Date(payment.createdAt).toLocaleDateString('es', { day: '2-digit', month: 'short' })}
                                    </span>
                                    <span className="payment-amount">+${payment.amount.toFixed(2)}</span>
                                  </div>
                                ))
                              )}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}

                {settledCredits.length > 0 && (
                  <div className="credits-section">
                    <span className="credits-section-title">Saldados</span>
                    {settledCredits.map(credit => (
                      <div key={credit.id} className="credit-item settled">
                        <div className="credit-header">
                          <div className="credit-avatar settled-avatar">{credit.client.charAt(0).toUpperCase()}</div>
                          <div className="credit-info">
                            <span className="credit-client">{credit.client}</span>
                            <span className="credit-date">{credit.date} · Saldado</span>
                          </div>
                          <span className="settled-badge">Saldado</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {tab === 'close' && (
        <div className="card close-card">
          <div className="card-header-row">
            <h2 className="card-title">Cierre del dia</h2>
            <button className="btn-ghost btn-sm" onClick={exportDailyClose}>
              📄 Exportar PDF
            </button>
          </div>

          <div className="close-summary">
            <div className="close-row total">
              <span className="close-label">Total ventas</span>
              <span className="close-value">${todayStats.totalSales.toFixed(2)}</span>
            </div>
            <div className="close-row">
              <span className="close-label">Ordenes cobradas</span>
              <span className="close-value">{todayStats.ordersCount}</span>
            </div>
            <div className="close-row">
              <span className="close-label">Ticket promedio</span>
              <span className="close-value">${todayStats.avgTicket.toFixed(2)}</span>
            </div>

            <div className="close-divider" />
            <span className="close-section-title">Por metodo de pago</span>

            <div className="payment-breakdown">
              <div className="payment-breakdown-item cash">
                <span className="payment-breakdown-icon">💵</span>
                <div className="payment-breakdown-info">
                  <span className="payment-breakdown-label">Efectivo</span>
                  <span className="payment-breakdown-value">${cashSales.toFixed(2)}</span>
                </div>
                <div className="payment-breakdown-bar">
                  <div className="bar-fill cash-fill" style={{ width: `${todayStats.totalSales > 0 ? (cashSales / todayStats.totalSales * 100) : 0}%` }} />
                </div>
              </div>
              <div className="payment-breakdown-item card">
                <span className="payment-breakdown-icon">💳</span>
                <div className="payment-breakdown-info">
                  <span className="payment-breakdown-label">Tarjeta</span>
                  <span className="payment-breakdown-value">${cardSales.toFixed(2)}</span>
                </div>
                <div className="payment-breakdown-bar">
                  <div className="bar-fill card-fill" style={{ width: `${todayStats.totalSales > 0 ? (cardSales / todayStats.totalSales * 100) : 0}%` }} />
                </div>
              </div>
              <div className="payment-breakdown-item transfer">
                <span className="payment-breakdown-icon">📱</span>
                <div className="payment-breakdown-info">
                  <span className="payment-breakdown-label">Transferencia</span>
                  <span className="payment-breakdown-value">${transferSales.toFixed(2)}</span>
                </div>
                <div className="payment-breakdown-bar">
                  <div className="bar-fill transfer-fill" style={{ width: `${todayStats.totalSales > 0 ? (transferSales / todayStats.totalSales * 100) : 0}%` }} />
                </div>
              </div>
            </div>

            {hourlyBreakdown.length > 0 && (
              <>
                <div className="close-divider" />
                <span className="close-section-title">Ventas por hora</span>
                <div className="hourly-list">
                  {hourlyBreakdown.map(h => (
                    <div key={h.hour} className="hourly-item">
                      <span className="hourly-time">{h.hour}:00</span>
                      <div className="hourly-bar-container">
                        <div
                          className="hourly-bar"
                          style={{ width: `${Math.max(4, (h.total / Math.max(...hourlyBreakdown.map(x => x.total))) * 100)}%` }}
                        />
                      </div>
                      <span className="hourly-count">{h.count} ord</span>
                      <span className="hourly-total">${h.total.toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              </>
            )}

            {topProductsToday.length > 0 && (
              <>
                <div className="close-divider" />
                <span className="close-section-title">Top productos hoy</span>
                <div className="top-products-list">
                  {topProductsToday.map((p, i) => (
                    <div key={p.name} className="top-product-item">
                      <span className="top-product-rank">#{i + 1}</span>
                      <span className="top-product-name">{p.name}</span>
                      <span className="top-product-stat">{p.count} und</span>
                      <span className="top-product-revenue">${p.total.toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {paymentModal && (
        <div className="modal-overlay" onClick={() => setPaymentModal(null)}>
          <div className="modal animate-slide-up" onClick={(e) => e.stopPropagation()}>
            <h3 className="modal-title">Abonar a credito</h3>
            <p className="modal-subtitle">{paymentModal.client}</p>
            <p className="modal-remaining">Pendiente: <span className="text-danger">${paymentModal.remaining.toFixed(2)}</span></p>
            <input
              type="number"
              step="0.01"
              max={paymentModal.remaining}
              placeholder={`Monto (max $${paymentModal.remaining.toFixed(2)})`}
              value={paymentAmount}
              onChange={(e) => setPaymentAmount(e.target.value)}
            />
            <div className="modal-actions">
              <button className="btn-ghost" onClick={() => setPaymentModal(null)}>Cancelar</button>
              <button
                className="btn-accent"
                onClick={handlePayment}
                disabled={!paymentAmount || parseFloat(paymentAmount) <= 0}
              >
                Confirmar abono
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
