import { useState, useMemo, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { useLocation } from 'react-router-dom'
import { useAuth } from '../context/auth-context'
import jsPDF from 'jspdf'
import {
  getCredits,
  addCreditPayment,
  deleteCredit,
  getCreditPayments,
  createCredit,
  getCustomers,
  getTodayStats,
  getOrdersWithItems,
  createDailyClose,
  getDailyCloses,
  type Credit as CreditType,
  type DailyCloseSummary,
  type TodayStats,
  type FullOrder,
  type Customer,
  type CreditPayment,
} from '../lib/dataService'
import NumberStepper from '../components/NumberStepper'
import './Mas.css'
import { dateKeyInTimeZone } from '../lib/money'
import { formatProductTitle } from '../lib/textFormat'
import { DeliverySettings } from '../components/DeliverySettings'
import { alertDialog, confirmDialog } from '../components/ConfirmDialog'
import { EmptyState } from '../components/EmptyState'
import { PageSkeleton } from '../components/PageSkeleton'
import { DateField } from '../components/DateField'
import { Loader2, Users, Award, MessageSquare, Tag, Lock, FileText, Trash2, CreditCard, Settings } from 'lucide-react'

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
  const location = useLocation()
  const isCreditsModule = location.pathname === '/creditos'
  const [credits, setCredits] = useState<CreditType[]>(masCache?.credits ?? [])
  const [closes, setCloses] = useState<DailyCloseSummary[]>(masCache?.closes ?? [])
  const [todayStats, setTodayStats] = useState<TodayStats | null>(masCache?.todayStats ?? null)
  const [todayOrders, setTodayOrders] = useState<FullOrder[]>(masCache?.todayOrders ?? [])
  const [loading, setLoading] = useState(!masCache)
  const [tab] = useState<Tab>(() => location.pathname === '/creditos' ? 'credits' : 'delivery')
  const [showNewCredit, setShowNewCredit] = useState(false)
  const [closingNewCredit, setClosingNewCredit] = useState(false)
  const [newClient, setNewClient] = useState('')
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null)
  const [showCustomerOptions, setShowCustomerOptions] = useState(false)
  const [customers, setCustomers] = useState<Customer[]>([])
  const [newAmount, setNewAmount] = useState('')
  const [newDueDate, setNewDueDate] = useState('')
  const [newIndefinite, setNewIndefinite] = useState(true)
  const [paymentModal, setPaymentModal] = useState<CreditType | null>(null)
  const [paymentAmount, setPaymentAmount] = useState('')
  const [selectedCredit, setSelectedCredit] = useState<CreditType | null>(null)
  const [creditPayments, setCreditPayments] = useState<CreditPayment[]>([])
  const [loadingHistory, setLoadingHistory] = useState(false)
  const [closing, setClosing] = useState(false)
  const [closingPayment, setClosingPayment] = useState(false)

  const closeNewCredit = () => {
    if (!showNewCredit || closingNewCredit) return
    setClosingNewCredit(true)
    window.setTimeout(() => { setShowNewCredit(false); setClosingNewCredit(false) }, 180)
  }

  const closePaymentModal = (then?: () => void) => {
    if (!paymentModal || closingPayment) return
    setClosingPayment(true)
    window.setTimeout(() => {
      setPaymentModal(null)
      setClosingPayment(false)
      then?.()
    }, 200)
  }

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

  useEffect(() => { if (isCreditsModule) getCustomers().then(setCustomers).catch(() => undefined) }, [isCreditsModule])

  const handleCreateCredit = async () => {
    if (!newClient || !newAmount || !user) return
    try {
      const customer = customers.find(item => item.id === selectedCustomerId)
      if (!customer) {
        void alertDialog({ message: 'Selecciona un cliente registrado' })
        return
      }
      await createCredit({
        orderId: null,
        customerId: customer.id,
        customerName: newClient,
        totalAmount: parseFloat(newAmount),
        dueDate: newIndefinite ? null : newDueDate,
        isIndefinite: newIndefinite,
        userId: user.id,
      })
      setNewClient('')
      setSelectedCustomerId(null)
      setNewAmount('')
      setNewDueDate('')
      closeNewCredit()
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
      closePaymentModal()
      setPaymentAmount('')
      fetchAll()
    } catch (e) {
      console.error('Error:', e)
    }
  }

  const handleToggleHistory = async (credit: CreditType) => {
    if (selectedCredit?.id === credit.id) {
      setSelectedCredit(null)
      setCreditPayments([])
      return
    }
    setSelectedCredit(credit)
    setLoadingHistory(true)
    try {
      setCreditPayments(await getCreditPayments(credit.id))
    } catch (e) {
      console.error('Error cargando historial:', e)
      alert('No se pudo cargar el historial de abonos')
    } finally {
      setLoadingHistory(false)
    }
  }

  const handleDeleteCredit = async (credit: CreditType) => {
    if (credit.orderId || credit.totalPaid > 0) {
      void alertDialog('Este crédito no se puede borrar porque está vinculado a una comanda o ya tiene abonos. Puedes conservarlo como historial.')
      return
    }
    const ok = await confirmDialog({ title: 'Eliminar crédito', message: `¿Borrar el crédito de ${credit.customerName} por $${credit.totalAmount.toFixed(2)}?`, confirmText: 'Eliminar', danger: true })
    if (!ok) return
    try {
      await deleteCredit(credit.id)
      if (selectedCredit?.id === credit.id) {
        setSelectedCredit(null)
        setCreditPayments([])
      }
      await fetchAll()
    } catch (e) {
      console.error('Error borrando crédito:', e)
      alert('No se pudo borrar el crédito')
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
      void alertDialog({ message: 'Error al crear cierre: ' + (e instanceof Error ? e.message : 'Error desconocido'), danger: true })
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

  if (loading && isCreditsModule) return <PageSkeleton cards={3} rows={5} hasTable />

  return (
    <div className={`page mas-page animate-fade-in management-workspace ${isCreditsModule ? 'management-workspace--credits' : 'management-workspace--settings'}`}>
      <header className="page-header management-workspace-header">
        <div>
          <h1 className="page-title">
            {isCreditsModule ? <CreditCard size={22} className="page-title-icon" /> : <Settings size={22} className="page-title-icon" />}
            {isCreditsModule ? 'Cuentas por cobrar' : 'Configuración'}
          </h1>
          <p className="page-subtitle">{isCreditsModule ? 'Controla los créditos pendientes y los pagos de tus clientes.' : 'Administración general, accesos y servicio de delivery.'}</p>
        </div>
      </header>

      {!isCreditsModule && <div className="module-shortcuts-grid management-workspace-metrics mb-6">
        <a href="/equipo" className="card shortcut-card"><span className="shortcut-icon"><Users size={28} /></span><div className="shortcut-info"><span className="shortcut-title">Equipo y Usuarios</span><span className="shortcut-desc">Roles y accesos del personal</span></div></a>
        <a href="/fidelizacion" className="card shortcut-card"><span className="shortcut-icon"><Award size={28} /></span><div className="shortcut-info"><span className="shortcut-title">Fidelización</span><span className="shortcut-desc">Clientes frecuentes y beneficios</span></div></a>
        <a href="/marketing" className="card shortcut-card"><span className="shortcut-icon"><MessageSquare size={28} /></span><div className="shortcut-info"><span className="shortcut-title">WhatsApp Bot</span><span className="shortcut-desc">Mensajes y automatizaciones</span></div></a>
        <a href="/promociones" className="card shortcut-card"><span className="shortcut-icon"><Tag size={28} /></span><div className="shortcut-info"><span className="shortcut-title">Promociones</span><span className="shortcut-desc">Cupones para WhatsApp</span></div></a>
      </div>}

      {!isCreditsModule && <DeliverySettings />}

      {tab === 'credits' && (
        <div className="card">
          <div className="card-header-row">
            <div>
              <h2 className="card-title">Cuentas corrientes</h2>
              <p className="card-subtitle">${totalPending.toFixed(2)} pendiente de {credits.length} clientes</p>
            </div>
            <button className="btn-accent btn-sm" onClick={() => { setClosingNewCredit(false); setShowNewCredit(true) }}>
              + Nuevo crédito
            </button>
          </div>

          {showNewCredit && (
            <div className={`new-credit-form animate-slide-up ${closingNewCredit ? 'closing' : ''}`}>
              <div className="form-row credit-customer-field">
                <input
                  type="text"
                  placeholder="Buscar cliente registrado"
                  value={newClient}
                  onFocus={() => setShowCustomerOptions(true)}
                  onChange={(e) => { setNewClient(e.target.value); setSelectedCustomerId(null); setShowCustomerOptions(true) }}
                />
                {showCustomerOptions && newClient.trim() && <div className="credit-customer-options">
                  {customers.filter(customer => `${customer.name} ${customer.phone}`.toLocaleLowerCase('es-VE').includes(newClient.toLocaleLowerCase('es-VE'))).slice(0, 8).map(customer => (
                    <button type="button" key={customer.id} onMouseDown={(event) => event.preventDefault()} onClick={() => { setNewClient(customer.name); setSelectedCustomerId(customer.id); setShowCustomerOptions(false) }}>
                      <strong>{customer.name}</strong><small>{customer.phone || 'Sin teléfono'}</small>
                    </button>
                  ))}
                </div>}
              </div>
              <div className="form-row">
                <NumberStepper
                  step={0.01}
                  placeholder="Monto del crédito"
                  value={newAmount}
                  onChange={(v) => setNewAmount(v)}
                />
                <label><input type="checkbox" checked={newIndefinite} onChange={e => setNewIndefinite(e.target.checked)} /> Plazo indefinido</label>
                {!newIndefinite && <DateField value={newDueDate} onChange={setNewDueDate} />}
                <div className="form-actions-inline">
                  <button className="btn-ghost" onClick={closeNewCredit}>Cancelar</button>
                  <button className="btn-accent" onClick={handleCreateCredit}>Crear</button>
                </div>
              </div>
            </div>
          )}

          <div className="credits-list">
            {activeCredits.length === 0 && settledCredits.length === 0 ? (
              <EmptyState
                title="No hay créditos registrados"
                description="Los créditos de tus clientes aparecerán aquí."
              />
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
                            <button className="btn-ghost btn-sm" onClick={() => handleToggleHistory(credit)}>
                              Historial
                            </button>
                            <button className="btn-ghost btn-sm credit-delete-btn" title="Borrar crédito" onClick={() => handleDeleteCredit(credit)}>
                              <Trash2 size={15} />
                            </button>
                          </div>
                          {selectedCredit?.id === credit.id && (
                            <div className="credit-history">
                              <strong>Historial de abonos</strong>
                              {loadingHistory ? <span>Cargando...</span> : creditPayments.length === 0 ? <span>Sin abonos registrados</span> : creditPayments.map(payment => (
                                <div className="credit-history-row" key={payment.id}>
                                  <span>{new Date(payment.createdAt).toLocaleString('es')}</span>
                                  <span className="text-success">${payment.amount.toFixed(2)}</span>
                                </div>
                              ))}
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

      {paymentModal && createPortal(
        <div className={`modal-overlay mas-credit-overlay ${closingPayment ? 'closing' : ''}`} onClick={() => closePaymentModal()}>
          <div className="modal animate-slide-up mas-modal-glow" onClick={(e) => e.stopPropagation()}>
            <div className="mas-modal-header-glow">
              <h3 className="modal-title">Abonar a crédito</h3>
              <p className="modal-subtitle">{paymentModal.customerName}</p>
            </div>
            <div className="mas-debt-highlight">
              <span className="modal-remaining">Pendiente</span>
              <span className="text-danger mas-debt-amount">${paymentModal.balancePending.toFixed(2)}</span>
            </div>
            <NumberStepper
              step={0.01}
              max={paymentModal.balancePending}
              placeholder={`Monto (max $${paymentModal.balancePending.toFixed(2)})`}
              value={paymentAmount}
              onChange={(v) => setPaymentAmount(v)}
            />
            <div className="modal-actions">
              <button className="btn-ghost" onClick={() => closePaymentModal()}>Cancelar</button>
              <button
                className="btn-accent"
                onClick={handlePayment}
                disabled={!paymentAmount || parseFloat(paymentAmount) <= 0}
              >
                Confirmar abono
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}
