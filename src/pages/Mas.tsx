import { useState, useMemo, useEffect, useCallback } from 'react'
import { useAuth } from '../context/auth-context'
import jsPDF from 'jspdf'
import {
  getCredits,
  addCreditPayment,
  createCredit,
  getTodayStats,
  getOrdersWithItems,
  createDailyClose,
  getDailyCloses,
  type Credit as CreditType,
  type DailyCloseSummary,
  type TodayStats,
  type FullOrder,
} from '../lib/dataService'
import './Mas.css'
import { dateKeyInTimeZone } from '../lib/money'
import { formatProductTitle } from '../lib/textFormat'
import { DeliverySettings } from '../components/DeliverySettings'
import { CreditCard, BarChart3, Bike, Loader2, Users, Award, MessageSquare, Tag, Lock, FileText } from 'lucide-react'

type Tab = 'credits' | 'close' | 'delivery'

// Cache a nivel de módulo: al volver a Más se muestran los datos de la
// última visita al instante, sin el parpadeo de "Cargando...", mientras se
// refrescan en segundo plano.
let masCache: {
  credits: CreditType[]
  closes: DailyCloseSummary[]
  todayStats: TodayStats | null
  todayOrders: FullOrder[]
} | null = null

export function Mas() {
  const { user } = useAuth()
  const [credits, setCredits] = useState<CreditType[]>(masCache?.credits ?? [])
  const [closes, setCloses] = useState<DailyCloseSummary[]>(masCache?.closes ?? [])
  const [todayStats, setTodayStats] = useState<TodayStats | null>(masCache?.todayStats ?? null)
  const [todayOrders, setTodayOrders] = useState<FullOrder[]>(masCache?.todayOrders ?? [])
  const [, setLoading] = useState(!masCache)
  const [tab, setTab] = useState<Tab>('credits')
  const [showNewCredit, setShowNewCredit] = useState(false)
  const [newClient, setNewClient] = useState('')
  const [newAmount, setNewAmount] = useState('')
  const [paymentModal, setPaymentModal] = useState<CreditType | null>(null)
  const [paymentAmount, setPaymentAmount] = useState('')
  const [selectedCredit, setSelectedCredit] = useState<CreditType | null>(null)
  const [closing, setClosing] = useState(false)

  const fetchAll = useCallback(async () => {
    try {
      const [creditsData, stats, ordersData, closesData] = await Promise.all([
        getCredits(),
        getTodayStats(),
        getOrdersWithItems(),
        getDailyCloses(),
      ])
      const paidOrders = ordersData.filter(o => o.status === 'paid')
      setCredits(creditsData)
      setTodayStats(stats)
      setTodayOrders(paidOrders)
      setCloses(closesData)
      masCache = { credits: creditsData, closes: closesData, todayStats: stats, todayOrders: paidOrders }
    } catch (e) {
      console.error('Error cargando datos:', e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchAll()
  }, [fetchAll])

  const handleCreateCredit = async () => {
    if (!newClient || !newAmount || !user) return
    try {
      const orders = await getOrdersWithItems()
      const orderId = orders[0]?.id
      if (!orderId) {
        alert('No hay órdenes disponibles')
        return
      }
      await createCredit({
        orderId,
        customerName: newClient,
        totalAmount: parseFloat(newAmount),
        userId: user.id,
      })
      setNewClient('')
      setNewAmount('')
      setShowNewCredit(false)
      fetchAll()
    } catch (e) {
      console.error('Error:', e)
    }
  }

  const handlePayment = async () => {
    if (!paymentModal || !paymentAmount || !user) return
    try {
      await addCreditPayment({
        creditId: paymentModal.id,
        amount: parseFloat(paymentAmount),
        userId: user.id,
      })
      setPaymentModal(null)
      setPaymentAmount('')
      fetchAll()
    } catch (e) {
      console.error('Error:', e)
    }
  }

  const handleDailyClose = async () => {
    if (!user) return
    setClosing(true)
    try {
        const today = dateKeyInTimeZone()
      await createDailyClose(today)
      fetchAll()
    } catch (e) {
      console.error('Error:', e)
      alert('Error al crear cierre: ' + (e instanceof Error ? e.message : 'Error desconocido'))
    } finally {
      setClosing(false)
    }
  }

  const today = dateKeyInTimeZone()

  const paidOrdersToday = useMemo(() =>
    todayOrders.filter(o => o.createdAt.startsWith(today)),
    [todayOrders, today]
  )

  const topProductsToday = useMemo(() => {
    const map = new Map<string, { name: string; count: number; total: number }>()
    for (const order of paidOrdersToday) {
      for (const item of order.items) {
        const existing = map.get(item.sellableProductId)
        if (existing) {
          existing.count += item.quantity
          existing.total += item.unitPrice * item.quantity
        } else {
          map.set(item.sellableProductId, {
            name: item.productName,
            count: item.quantity,
            total: item.unitPrice * item.quantity,
          })
        }
      }
    }
    return Array.from(map.values()).sort((a, b) => b.total - a.total).slice(0, 5)
  }, [paidOrdersToday])

  const exportDailyClose = () => {
    const doc = new jsPDF()
    const pageWidth = doc.internal.pageSize.getWidth()
    let y = 15

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(18)
    doc.text('Full China Vzla', pageWidth / 2, y, { align: 'center' })
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
      `Total ventas: $${(todayStats?.totalSales ?? 0).toFixed(2)}`,
      `Ordenes cobradas: ${todayStats?.ordersCount ?? 0}`,
      `Ticket promedio: $${(todayStats?.avgTicket ?? 0).toFixed(2)}`,
    ]
    for (const line of summaryLines) {
      doc.text(line, 15, y)
      y += 6
    }

    y += 4
    doc.line(15, y, pageWidth - 15, y)
    y += 8

    doc.setFont('helvetica', 'bold')
    doc.text('Productos más vendidos:', 15, y)
    y += 8
    doc.setFont('helvetica', 'normal')
    for (const p of topProductsToday) {
      doc.text(`  ${formatProductTitle(p.name)}: ${p.count} und - $${p.total.toFixed(2)}`, 15, y)
      y += 6
    }

    y += 8
    doc.line(15, y, pageWidth - 15, y)
    y += 8
    doc.setFontSize(8)
    doc.text('Documento generado automáticamente', pageWidth / 2, y, { align: 'center' })

    doc.save(`cierre-caja-${today}.pdf`)
  }

  const activeCredits = credits.filter(c => c.status === 'pending' || c.status === 'partial')
  const settledCredits = credits.filter(c => c.status === 'paid')
  const totalPending = activeCredits.reduce((s, c) => s + c.balancePending, 0)

  return (
    <div className="page animate-fade-in">
      <header className="page-header">
        <h1 className="page-title text-gradient">Más Módulos y Administración</h1>
        <p className="page-subtitle">Créditos, cierre de caja, finanzas, recetas y auditoría</p>
      </header>

      <div className="module-shortcuts-grid mb-6">
        <a href="/equipo" className="card shortcut-card"><span className="shortcut-icon"><Users size={28} /></span><div className="shortcut-info"><span className="shortcut-title">Equipo y Usuarios</span><span className="shortcut-desc">Roles y accesos del personal</span></div></a>
        <a href="/fidelizacion" className="card shortcut-card"><span className="shortcut-icon"><Award size={28} /></span><div className="shortcut-info"><span className="shortcut-title">Fidelización</span><span className="shortcut-desc">Clientes frecuentes y beneficios</span></div></a>
        <a href="/marketing" className="card shortcut-card"><span className="shortcut-icon"><MessageSquare size={28} /></span><div className="shortcut-info"><span className="shortcut-title">WhatsApp Bot</span><span className="shortcut-desc">Mensajes y automatizaciones</span></div></a>
        <a href="/promociones" className="card shortcut-card"><span className="shortcut-icon"><Tag size={28} /></span><div className="shortcut-info"><span className="shortcut-title">Promociones</span><span className="shortcut-desc">Ofertas y campañas activas</span></div></a>
      </div>

      <div className="tabs">
        <button className={`tab ${tab === 'credits' ? 'active' : ''}`} onClick={() => setTab('credits')}>
          <CreditCard size={14} /> Créditos ({activeCredits.length} activos)
        </button>
        <button className={`tab ${tab === 'close' ? 'active' : ''}`} onClick={() => setTab('close')}>
          <BarChart3 size={14} /> Cierre de Caja
        </button>
        <button className={`tab ${tab === 'delivery' ? 'active' : ''}`} onClick={() => setTab('delivery')}>
          <Bike size={14} /> Delivery
        </button>
      </div>

      {tab === 'delivery' && <DeliverySettings />}

      {tab === 'credits' && (
        <div className="card">
          <div className="card-header-row">
            <div>
              <h2 className="card-title">Cuentas corrientes</h2>
              <p className="card-subtitle">${totalPending.toFixed(2)} pendiente de {credits.length} clientes</p>
            </div>
            <button className="btn-accent btn-sm" onClick={() => setShowNewCredit(true)}>
              + Nuevo crédito
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
              </div>
              <div className="form-row">
                <input
                  type="number"
                  step="0.01"
                  placeholder="Monto del crédito"
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
              <p className="empty-message">No hay créditos registrados</p>
            ) : (
              <>
                {activeCredits.length > 0 && (
                  <div className="credits-section">
                    <span className="credits-section-title">Activos</span>
                    {activeCredits.map(credit => {
                      const percentPaid = credit.totalAmount > 0 ? Math.min(100, (credit.totalPaid / credit.totalAmount) * 100) : 100
                      const daysSince = Math.floor((Date.now() - new Date(credit.createdAt).getTime()) / 86400000)
                      const isOverdue = daysSince > 7 && credit.balancePending > 0

                      return (
                        <div key={credit.id} className={`credit-item ${isOverdue ? 'overdue' : ''}`}>
                          <div className="credit-header">
                            <div className="credit-avatar">{credit.customerName.charAt(0).toUpperCase()}</div>
                            <div className="credit-info">
                              <span className="credit-client">{credit.customerName}</span>
                              <span className="credit-date">
                                {new Date(credit.createdAt).toLocaleDateString('es')} · {daysSince}d
                                {isOverdue && <span className="overdue-badge">Vencido</span>}
                              </span>
                            </div>
                          </div>

                          <div className="credit-amounts-row">
                            <div className="credit-amount-col">
                              <span className="credit-amount-label">Total</span>
                              <span className="credit-amount-value">${credit.totalAmount.toFixed(2)}</span>
                            </div>
                            <div className="credit-amount-col">
                              <span className="credit-amount-label">Pagado</span>
                              <span className="credit-amount-value text-success">${credit.totalPaid.toFixed(2)}</span>
                            </div>
                            <div className="credit-amount-col">
                              <span className="credit-amount-label">Pendiente</span>
                              <span className="credit-amount-value text-danger">${credit.balancePending.toFixed(2)}</span>
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
                          <div className="credit-avatar settled-avatar">{credit.customerName.charAt(0).toUpperCase()}</div>
                          <div className="credit-info">
                            <span className="credit-client">{credit.customerName}</span>
                            <span className="credit-date">{new Date(credit.createdAt).toLocaleDateString('es')} · Saldado</span>
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
            <div style={{ display: 'flex', gap: '8px' }}>
              <button className="btn-accent btn-sm" onClick={handleDailyClose} disabled={closing}>
                {closing ? <><Loader2 size={14} className="spin" /> Cerrando...</> : <><Lock size={14} /> Cerrar caja</>}
              </button>
              <button className="btn-ghost btn-sm" onClick={exportDailyClose}>
                <FileText size={14} /> Exportar PDF
              </button>
            </div>
          </div>

          <div className="close-summary">
            <div className="close-row total">
              <span className="close-label">Total ventas</span>
              <span className="close-value">${(todayStats?.totalSales ?? 0).toFixed(2)}</span>
            </div>
            <div className="close-row">
              <span className="close-label">Ordenes cobradas</span>
              <span className="close-value">{todayStats?.ordersCount ?? 0}</span>
            </div>
            <div className="close-row">
              <span className="close-label">Ticket promedio</span>
              <span className="close-value">${(todayStats?.avgTicket ?? 0).toFixed(2)}</span>
            </div>

            {topProductsToday.length > 0 && (
              <>
                <div className="close-divider" />
                <span className="close-section-title">Top productos hoy</span>
                <div className="top-products-list">
                  {topProductsToday.map((p, i) => (
                    <div key={p.name} className="top-product-item">
                      <span className="top-product-rank">#{i + 1}</span>
                      <span className="top-product-name">{formatProductTitle(p.name)}</span>
                      <span className="top-product-stat">{p.count} und</span>
                      <span className="top-product-revenue">${p.total.toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              </>
            )}

            {closes.length > 0 && (
              <>
                <div className="close-divider" />
                <span className="close-section-title">Últimos cierres</span>
                <div className="top-products-list">
                  {closes.slice(0, 5).map((c) => (
                    <div key={c.id} className="top-product-item">
                      <span className="top-product-rank">{c.closeDate}</span>
                      <span className="top-product-name">Ventas: ${c.totalSales.toFixed(2)}</span>
                      <span className="top-product-revenue">Balance: ${c.balance.toFixed(2)}</span>
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
            <h3 className="modal-title">Abonar a crédito</h3>
            <p className="modal-subtitle">{paymentModal.customerName}</p>
            <p className="modal-remaining">Pendiente: <span className="text-danger">${paymentModal.balancePending.toFixed(2)}</span></p>
            <input
              type="number"
              step="0.01"
              max={paymentModal.balancePending}
              placeholder={`Monto (max $${paymentModal.balancePending.toFixed(2)})`}
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
