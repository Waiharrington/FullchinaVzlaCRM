import { useState, useMemo, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { useLocation } from 'react-router-dom'
import { useAuth } from '../context/auth-context'
import jsPDF from 'jspdf'
import {
  getCredits,
  addCreditPayment,
  getCustomerPaymentAccounts,
  deleteCredit,
  deleteDemoCredit,
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
  type FinancialAccount,
  type PaymentMethod,
} from '../lib/dataService'
import NumberStepper from '../components/NumberStepper'
import { StyledSelect } from '../components/StyledSelect'
import { useRates } from '../context/rates-context'
import './Mas.css'
import { dateKeyInTimeZone } from '../lib/money'
import { formatProductTitle } from '../lib/textFormat'
import { DeliverySettings } from '../components/DeliverySettings'
import { alertDialog, confirmDialog } from '../components/ConfirmDialog'
import { EmptyState } from '../components/EmptyState'
import { PageSkeleton } from '../components/PageSkeleton'
import { DateField } from '../components/DateField'
import { Loader2, Users, Award, MessageSquare, Tag, Lock, FileText, Trash2, CreditCard, Settings, ChevronLeft, ChevronRight, Printer, Search, History } from 'lucide-react'
import { useLiveDataRefresh } from '../lib/liveDataRefresh'

type Tab = 'credits' | 'close' | 'delivery'
const CREDITS_PER_PAGE = 5

function receivableAccountsForMethod(accounts: FinancialAccount[], method: PaymentMethod) {
  const accepted = accounts.filter(account => account.isActive && account.acceptsCustomerPayments)
  if (method === 'cash') return accepted.filter(account => account.accountType === 'cash')
  if (method === 'mobile') return accepted.filter(account => account.currency === 'VES' && account.accountType === 'bank' && ['Banco Exterior', 'Banesco'].includes(account.name))
  if (method === 'card') return accepted.filter(account => account.currency === 'VES' && account.name === 'Punto de venta')
  if (method === 'transfer') return accepted.filter(account => account.currency === 'VES' && account.accountType === 'bank')
  if (method === 'binance') return accepted.filter(account => account.currency === 'USD' && ['bank', 'digital'].includes(account.accountType))
  return accepted
}

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
  const { bcvRate } = useRates()
  const location = useLocation()
  const isCreditsModule = location.pathname === '/creditos'
  const printerStatus = window.FullChinaPrinter?.isAvailable()
    ? window.FullChinaPrinter.getStatus?.() ?? 'Configurada en esta tablet'
    : null
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
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash')
  const [paymentAccountId, setPaymentAccountId] = useState('')
  const [paymentReference, setPaymentReference] = useState('')
  const [paymentError, setPaymentError] = useState('')
  const [paymentSaving, setPaymentSaving] = useState(false)
  const [financialAccounts, setFinancialAccounts] = useState<FinancialAccount[]>([])
  const [activeCreditPage, setActiveCreditPage] = useState(1)
  const [settledCreditPage, setSettledCreditPage] = useState(1)
  const [selectedCredit, setSelectedCredit] = useState<CreditType | null>(null)
  const [creditPayments, setCreditPayments] = useState<CreditPayment[]>([])
  const [loadingHistory, setLoadingHistory] = useState(false)
  const [closing, setClosing] = useState(false)
  const [closingPayment, setClosingPayment] = useState(false)

  useEffect(() => {
    getCustomerPaymentAccounts().then(setFinancialAccounts).catch((error) => {
      console.error('Error cargando cuentas para abonos:', error)
      setFinancialAccounts([])
    })
  }, [])

  const availablePaymentAccounts = useMemo(
    () => receivableAccountsForMethod(financialAccounts, paymentMethod),
    [financialAccounts, paymentMethod],
  )
  const selectedPaymentAccount = availablePaymentAccounts.find(account => account.id === paymentAccountId) ?? null
  const paymentUsesBolivares = selectedPaymentAccount?.currency === 'VES'
  const enteredPaymentAmount = Number(paymentAmount)
  const paymentAmountUsd = paymentUsesBolivares
    ? (bcvRate && bcvRate > 0 ? enteredPaymentAmount / bcvRate : 0)
    : enteredPaymentAmount
  const paymentAmountMax = paymentUsesBolivares
    ? (paymentModal?.balancePending ?? 0) * (bcvRate ?? 0)
    : paymentModal?.balancePending ?? 0
  const paymentRequiresReference = ['mobile', 'card', 'transfer', 'binance'].includes(paymentMethod)

  useEffect(() => {
    if (paymentModal && !availablePaymentAccounts.some(account => account.id === paymentAccountId)) {
      const preferred = paymentMethod === 'cash'
        ? availablePaymentAccounts.find(account => account.accountType === 'cash' && account.currency === 'USD')
        : undefined
      setPaymentAccountId((preferred ?? availablePaymentAccounts[0])?.id ?? '')
      setPaymentAmount('')
    }
  }, [paymentModal, paymentAccountId, paymentMethod, availablePaymentAccounts])

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

  const fetchAll = useCallback(async (silent = false) => {
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
      if (!silent) setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchAll()
  }, [fetchAll])
  useLiveDataRefresh(isCreditsModule ? 'creditos' : 'mas', () => {
    void fetchAll(true)
    if (isCreditsModule) void getCustomers().then(setCustomers).catch(() => undefined)
  })

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
    if (!paymentModal || !user) return
    setPaymentError('')
    if (!paymentAccountId) {
      setPaymentError('Selecciona la cuenta donde ingresará el dinero.')
      return
    }
    if (!Number.isFinite(paymentAmountUsd) || paymentAmountUsd <= 0 || paymentAmountUsd > paymentModal.balancePending) {
      setPaymentError('Ingresa un monto válido que no supere el saldo pendiente.')
      return
    }
    if (paymentUsesBolivares && (!bcvRate || bcvRate <= 0)) {
      setPaymentError('No hay una tasa BCV válida para convertir el abono.')
      return
    }
    if (paymentRequiresReference && !paymentReference.trim()) {
      setPaymentError('Ingresa la referencia de este pago.')
      return
    }
    setPaymentSaving(true)
    try {
      await addCreditPayment({
        creditId: paymentModal.id,
        amount: Math.round(paymentAmountUsd * 100) / 100,
        method: paymentMethod,
        accountId: paymentAccountId,
        exchangeRate: paymentUsesBolivares ? bcvRate : null,
        referenceNumber: paymentReference.trim() || undefined,
        userId: user.id,
      })
      closePaymentModal()
      setPaymentAmount('')
      setPaymentReference('')
      setActiveCreditPage(1)
      setSettledCreditPage(1)
      fetchAll()
    } catch (e) {
      console.error('Error:', e)
      setPaymentError(e instanceof Error ? e.message : 'No se pudo registrar el abono.')
    } finally {
      setPaymentSaving(false)
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
      const ok = await confirmDialog({
        title: 'Borrar crédito demo',
        message: 'Este crédito tiene una comanda o abonos vinculados. Al continuar se eliminarán el crédito y su historial de abonos demo, pero la comanda original no se tocará. ¿Deseas continuar?',
        confirmText: 'Borrar demo',
        danger: true,
      })
      if (!ok) return
      try {
        await deleteDemoCredit(credit.id)
        if (selectedCredit?.id === credit.id) {
          setSelectedCredit(null)
          setCreditPayments([])
        }
        await fetchAll()
      } catch (e) {
        console.error('Error borrando crédito demo:', e)
        alert('No se pudo borrar el crédito demo')
      }
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
  const activeCreditPageCount = Math.max(1, Math.ceil(activeCredits.length / CREDITS_PER_PAGE))
  const safeActiveCreditPage = Math.min(activeCreditPage, activeCreditPageCount)
  const activeCreditStart = (safeActiveCreditPage - 1) * CREDITS_PER_PAGE
  const pagedActiveCredits = activeCredits.slice(activeCreditStart, activeCreditStart + CREDITS_PER_PAGE)
  const settledCreditPageCount = Math.max(1, Math.ceil(settledCredits.length / CREDITS_PER_PAGE))
  const safeSettledCreditPage = Math.min(settledCreditPage, settledCreditPageCount)
  const settledCreditStart = (safeSettledCreditPage - 1) * CREDITS_PER_PAGE
  const pagedSettledCredits = settledCredits.slice(settledCreditStart, settledCreditStart + CREDITS_PER_PAGE)
  const totalPending = activeCredits.reduce((s, c) => s + c.balancePending, 0)
  const renderCreditPagination = (label: string, total: number, start: number, page: number, pageCount: number, onPageChange: (page: number) => void) => total > CREDITS_PER_PAGE ? (
    <div className="credit-unpaid-pagination" aria-label={label}>
      <span>Mostrando {start + 1}–{Math.min(start + CREDITS_PER_PAGE, total)} de {total}</span>
      <div className="credit-unpaid-pagination-controls">
        <button type="button" onClick={() => onPageChange(page - 1)} disabled={page <= 1} aria-label="Página anterior">
          <ChevronLeft size={16} /> Anterior
        </button>
        <span>Página {page} de {pageCount}</span>
        <button type="button" onClick={() => onPageChange(page + 1)} disabled={page >= pageCount} aria-label="Página siguiente">
          Siguiente <ChevronRight size={16} />
        </button>
      </div>
    </div>
  ) : null

  if (loading && isCreditsModule) return <PageSkeleton cards={3} rows={5} hasTable />

  return (
    <div className={`page mas-page animate-fade-in management-workspace ${isCreditsModule ? 'management-workspace--credits' : 'management-workspace--settings'}`}>
      <header className="page-header management-workspace-header">
        <div>
          <h1 className="page-title">
            {isCreditsModule ? <CreditCard size={22} className="page-title-icon" /> : <Settings size={22} className="page-title-icon" />}
            {isCreditsModule ? 'Cuentas por cobrar' : 'Configuración'}
          </h1>
          <p className="page-subtitle">{isCreditsModule ? <><span className="mas-subtitle-desktop">Controla los créditos pendientes y los pagos de tus clientes.</span><span className="mas-subtitle-mobile">Créditos y pagos pendientes.</span></> : <><span className="mas-subtitle-desktop">Administración general, accesos y servicio de delivery.</span><span className="mas-subtitle-mobile">Administra accesos y ajustes.</span></>}</p>
        </div>
      </header>

      {!isCreditsModule && <div className="module-shortcuts-grid management-workspace-metrics mb-6">
        <a href="/equipo" className="card shortcut-card"><span className="shortcut-icon"><Users size={28} /></span><div className="shortcut-info"><span className="shortcut-title">Equipo y Usuarios</span><span className="shortcut-desc">Roles y accesos del personal</span></div></a>
        <a href="/fidelizacion" className="card shortcut-card"><span className="shortcut-icon"><Award size={28} /></span><div className="shortcut-info"><span className="shortcut-title">Fidelización</span><span className="shortcut-desc">Clientes frecuentes y beneficios</span></div></a>
        <a href="/marketing" className="card shortcut-card"><span className="shortcut-icon"><MessageSquare size={28} /></span><div className="shortcut-info"><span className="shortcut-title">WhatsApp Bot</span><span className="shortcut-desc">Mensajes y automatizaciones</span></div></a>
        <a href="/promociones" className="card shortcut-card"><span className="shortcut-icon"><Tag size={28} /></span><div className="shortcut-info"><span className="shortcut-title">Promociones</span><span className="shortcut-desc">Cupones para WhatsApp</span></div></a>
      </div>}

      {!isCreditsModule && printerStatus !== null && <section className="card settings-printer-card">
        <span className="settings-printer-icon"><Printer size={22} /></span>
        <div className="settings-printer-copy">
          <h2>Impresión de tickets</h2>
          <p>Imprime comandas y recibos desde esta tablet con la XP-80C por red.</p>
          <small>{printerStatus}</small>
        </div>
        <button type="button" className="btn-accent btn-sm" onClick={() => window.FullChinaPrinter?.openSettings()}>
          Configurar impresora
        </button>
      </section>}

      {!isCreditsModule && <DeliverySettings />}

      {tab === 'credits' && (
        <div className="card">
          <div className="card-header-row">
            <div>
              <h2 className="card-title">Cuentas por cobrar</h2>
              <p className="card-subtitle">${totalPending.toFixed(2)} pendiente en créditos autorizados y cuentas manuales</p>
            </div>
            <button className="btn-accent btn-sm" onClick={() => { setClosingNewCredit(false); setShowNewCredit(true) }}>
              + Nuevo crédito
            </button>
          </div>

          {showNewCredit && (
            <div className={`new-credit-form animate-slide-up ${closingNewCredit ? 'closing' : ''}`}>
              <div className="form-row credit-customer-field">
                <Search className="credit-customer-search-icon" size={18} aria-hidden="true" />
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
                  prefix="$"
                  hideControls
                  className="credit-amount-stepper"
                  value={newAmount}
                  onChange={(v) => setNewAmount(v)}
                />
                <label className="credit-indefinite-toggle">
                  <input type="checkbox" checked={newIndefinite} onChange={e => setNewIndefinite(e.target.checked)} />
                  <span className="credit-checkbox" aria-hidden="true" />
                  <span>Plazo indefinido</span>
                </label>
                {!newIndefinite && <DateField value={newDueDate} onChange={setNewDueDate} calendar className="credit-due-date" placeholder="Fecha de vencimiento" />}
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
                    <span className="credits-section-title">Activos · {activeCredits.length}</span>
                    {pagedActiveCredits.map(credit => {
                      const daysSince = Math.floor((Date.now() - new Date(credit.createdAt).getTime()) / 86400000)
                      const isOverdue = daysSince > 7 && credit.balancePending > 0

                      return (
                        <article key={credit.id} className={`credit-item credit-list-row ${isOverdue ? 'overdue' : ''}`}>
                          <div className="credit-list-person">
                            <div className="credit-avatar">{credit.customerName.charAt(0).toUpperCase()}</div>
                            <div className="credit-info">
                              <span className="credit-client">{credit.customerName}</span>
                              <span className="credit-date">
                                {new Date(credit.createdAt).toLocaleDateString('es')} · {daysSince}d
                                {isOverdue && <span className="overdue-badge">Vencido</span>}
                              </span>
                            </div>
                          </div>

                          <div className="credit-list-metrics">
                            <div>
                              <span className="credit-amount-label">Total</span>
                              <span className="credit-amount-value">${credit.totalAmount.toFixed(2)}</span>
                            </div>
                            <div>
                              <span className="credit-amount-label">Pagado</span>
                              <span className="credit-amount-value text-success">${credit.totalPaid.toFixed(2)}</span>
                            </div>
                            <div>
                              <span className="credit-amount-label">Pendiente</span>
                              <span className="credit-amount-value text-danger">${credit.balancePending.toFixed(2)}</span>
                            </div>
                          </div>

                          <div className="credit-list-actions">
                            <button type="button" className="btn-accent btn-sm" onClick={() => {
                              setPaymentError('')
                              setPaymentAmount('')
                              setPaymentReference('')
                              setPaymentMethod('cash')
                              setPaymentAccountId('')
                              setPaymentModal(credit)
                            }}>
                              <CreditCard size={14} /> Abonar
                            </button>
                            <button type="button" className="btn-ghost btn-sm" onClick={() => handleToggleHistory(credit)}>
                              Historial
                            </button>
                            <button type="button" className="btn-ghost btn-sm credit-delete-btn" title="Borrar crédito" aria-label="Borrar crédito" onClick={() => handleDeleteCredit(credit)}>
                              <Trash2 size={15} />
                            </button>
                          </div>
                          {selectedCredit?.id === credit.id && (
                            <div className="credit-history credit-row-history">
                              <div className="credit-history-heading">
                                <span className="credit-history-heading-icon"><History size={15} aria-hidden="true" /></span>
                                <strong>Historial de abonos</strong>
                              </div>
                              {loadingHistory ? (
                                <div className="credit-history-state credit-history-loading" role="status" aria-live="polite">
                                  <Loader2 size={17} aria-hidden="true" />
                                  <span>Cargando historial</span>
                                  <span className="credit-history-loading-dots" aria-hidden="true"><i /><i /><i /></span>
                                </div>
                              ) : creditPayments.length === 0 ? (
                                <div className="credit-history-state credit-history-empty">
                                  <span className="credit-history-empty-icon"><CreditCard size={16} aria-hidden="true" /></span>
                                  <span><strong>Sin abonos todavía</strong><small>Los pagos registrados aparecerán aquí.</small></span>
                                </div>
                              ) : creditPayments.map(payment => (
                                <div className="credit-history-row" key={payment.id}>
                                  <span>{new Date(payment.createdAt).toLocaleString('es')}</span>
                                  <span className="text-success">${payment.amount.toFixed(2)}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </article>
                      )
                    })}
                    {renderCreditPagination('Paginación de créditos activos', activeCredits.length, activeCreditStart, safeActiveCreditPage, activeCreditPageCount, setActiveCreditPage)}
                  </div>
                )}

                {settledCredits.length > 0 && (
                  <div className="credits-section">
                    <span className="credits-section-title">Saldados · {settledCredits.length}</span>
                    {pagedSettledCredits.map(credit => (
                      <article key={credit.id} className="credit-item credit-list-row settled">
                        <div className="credit-list-person">
                          <div className="credit-avatar settled-avatar">{credit.customerName.charAt(0).toUpperCase()}</div>
                          <div className="credit-info">
                            <span className="credit-client">{credit.customerName}</span>
                            <span className="credit-date">{new Date(credit.createdAt).toLocaleDateString('es')} · Saldado</span>
                          </div>
                        </div>
                        <div className="credit-list-metrics">
                          <div><span className="credit-amount-label">Total</span><span className="credit-amount-value">${credit.totalAmount.toFixed(2)}</span></div>
                          <div><span className="credit-amount-label">Pagado</span><span className="credit-amount-value text-success">${credit.totalPaid.toFixed(2)}</span></div>
                          <div><span className="credit-amount-label">Pendiente</span><span className="credit-amount-value text-success">$0.00</span></div>
                        </div>
                        <div className="credit-list-actions"><span className="settled-badge">Saldado</span></div>
                      </article>
                    ))}
                    {renderCreditPagination('Paginación de créditos saldados', settledCredits.length, settledCreditStart, safeSettledCreditPage, settledCreditPageCount, setSettledCreditPage)}
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
            <div className="mas-payment-field">
              <label>Método de pago</label>
              <StyledSelect
                className="mas-payment-select"
                value={paymentMethod}
                onChange={(event) => {
                  setPaymentMethod(event.target.value as PaymentMethod)
                  setPaymentAccountId('')
                  setPaymentAmount('')
                  setPaymentReference('')
                  setPaymentError('')
                }}
              >
                <option value="cash">Efectivo</option>
                <option value="mobile">Pago móvil</option>
                <option value="card">Punto de venta</option>
                <option value="transfer">Transferencia</option>
                <option value="binance">Binance Pay</option>
                <option value="other">Otro método</option>
              </StyledSelect>
            </div>
            <div className="mas-payment-field">
              <label>Cuenta donde ingresa el dinero</label>
              <StyledSelect
                className="mas-payment-select"
                value={paymentAccountId}
                onChange={(event) => {
                  setPaymentAccountId(event.target.value)
                  setPaymentAmount('')
                  setPaymentError('')
                }}
              >
                <option value="">Selecciona una cuenta</option>
                {availablePaymentAccounts.map(account => (
                  <option key={account.id} value={account.id}>{account.name} · {account.currency === 'VES' ? 'Bs' : '$'}</option>
                ))}
              </StyledSelect>
              {availablePaymentAccounts.length === 0 && <small className="mas-payment-hint">No hay cuentas activas para este método que acepten pagos de clientes.</small>}
            </div>
            <NumberStepper
              className="mas-payment-amount"
              step={0.01}
              max={paymentAmountMax || undefined}
              prefix={paymentUsesBolivares ? 'Bs' : '$'}
              placeholder={`Monto (máx. ${paymentUsesBolivares ? `Bs ${paymentAmountMax.toFixed(2)}` : `$${paymentModal.balancePending.toFixed(2)}`})`}
              value={paymentAmount}
              onChange={(v) => { setPaymentAmount(v); setPaymentError('') }}
            />
            {selectedPaymentAccount?.currency === 'VES' && <small className="mas-payment-hint">{bcvRate ? `Equivale a $${paymentAmountUsd.toFixed(2)} · tasa BCV: Bs ${bcvRate.toFixed(2)} por USD.` : 'Se necesita una tasa BCV válida para convertir este abono.'}</small>}
            {paymentRequiresReference && <div className="mas-payment-field">
              <label>Referencia del pago *</label>
              <input
                type="text"
                value={paymentReference}
                onChange={(event) => { setPaymentReference(event.target.value); setPaymentError('') }}
                className="mas-payment-input"
                maxLength={120}
                required
              />
            </div>}
            {paymentError && <p className="mas-payment-error" role="alert">{paymentError}</p>}
            <div className="modal-actions">
              <button className="btn-ghost" onClick={() => closePaymentModal()}>Cancelar</button>
              <button
                className="btn-accent"
                onClick={() => void handlePayment()}
                disabled={paymentSaving || !paymentAccountId || !paymentAmount || paymentAmountUsd <= 0 || paymentAmountUsd > paymentModal.balancePending || (paymentUsesBolivares && !bcvRate) || (paymentRequiresReference && !paymentReference.trim())}
              >
                {paymentSaving ? 'Registrando…' : 'Confirmar abono'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}
