import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { DollarSign, X } from 'lucide-react'
import { MoneyWithBcv } from '../../components/MoneyWithBcv'
import { LoadingSkeleton } from '../../components/LoadingSkeleton'
import { ReceivablePaymentEditor, type ReceivablePaymentComponent } from '../../components/ReceivablePaymentEditor'
import { addCreditPayment, getCustomerOrders, getCustomerPaymentAccounts, type Credit, type CustomerOrderSummary, type FinancialAccount } from '../../lib/dataService'
import { formatDate } from './model'
import { activeCredits, creditInitials, daysOutstanding, linkedCredits, receivablePaymentNote } from './receivables'

interface ReceivablesModalsProps {
  bcvRate: number | null
  credits: Credit[]
  onClose: () => void
  onRefreshCredits: () => Promise<void>
  pendingOrderCount: number
  totalOutstanding: number
}

type View = { kind: 'list' } | { kind: 'payment'; credit: Credit }

// Cuentas por cobrar y registro de abonos. Es un solo flujo: la lista abre el
// formulario de pago y, al guardar, vuelve a la lista con los saldos nuevos.
export function ReceivablesModals({ bcvRate, credits, onClose, onRefreshCredits, pendingOrderCount, totalOutstanding }: ReceivablesModalsProps) {
  const [view, setView] = useState<View>({ kind: 'list' })
  const [closing, setClosing] = useState(false)
  const [paymentSaving, setPaymentSaving] = useState(false)
  const [paymentError, setPaymentError] = useState('')
  const [financialAccounts, setFinancialAccounts] = useState<FinancialAccount[]>([])
  const [receivableOrders, setReceivableOrders] = useState<Record<string, CustomerOrderSummary>>({})
  const [receivablesLoading, setReceivablesLoading] = useState(false)
  const pending = useMemo(() => activeCredits(credits), [credits])

  useEffect(() => {
    getCustomerPaymentAccounts().then(setFinancialAccounts).catch((error) => {
      console.error('Error cargando cuentas para cobros:', error)
      setFinancialAccounts([])
    })
  }, [])

  useEffect(() => {
    let cancelled = false
    setReceivablesLoading(true)
    Promise.all(linkedCredits(credits).map(async (credit) => {
      const orders = await getCustomerOrders(credit.customerId as string, credit.customerName)
      return [credit.id, orders.find((order) => order.id === credit.orderId)] as const
    }))
      .then((entries) => {
        if (!cancelled) setReceivableOrders(Object.fromEntries(entries.filter((entry): entry is [string, CustomerOrderSummary] => Boolean(entry[1]))))
      })
      .catch((error) => console.error('Error cargando comandas por cobrar:', error))
      .finally(() => { if (!cancelled) setReceivablesLoading(false) })
    return () => { cancelled = true }
  }, [credits])

  // Anima la salida de la vista actual y luego muestra la siguiente (o cierra).
  const transition = (next: View | null) => {
    if (closing) return
    setClosing(true)
    window.setTimeout(() => {
      setClosing(false)
      if (next) setView(next)
      else onClose()
    }, 200)
  }

  const openPayment = (credit: Credit) => {
    setPaymentError('')
    transition({ kind: 'payment', credit })
  }

  const handlePayment = async (credit: Credit, payments: ReceivablePaymentComponent[], notes: string) => {
    setPaymentSaving(true)
    setPaymentError('')
    try {
      await addCreditPayment({ creditId: credit.id, payments, notes: notes || undefined })
      await onRefreshCredits()
      transition({ kind: 'list' })
    } catch (e) {
      console.error('Error registrando abono:', e)
      const detail = e instanceof Error ? e.message : 'Intenta de nuevo.'
      setPaymentError(`No se pudo registrar el pago: ${detail}`)
    } finally {
      setPaymentSaving(false)
    }
  }

  if (view.kind === 'payment') {
    const paymentCredit = view.credit
    return createPortal(
    <div className={`modal-overlay-dark ${closing ? 'closing' : ''}`} onClick={() => transition(null)}>
      <div className="client-modal-box animate-pop clientes-modal-glow" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header-line clientes-modal-header-glow">
          <h3 className="modal-title">Abonar a Crédito</h3>
        </div>
        <div className="clientes-modal-customer-row mt-2">
          <div className="clientes-modal-avatar">
            {creditInitials(paymentCredit.customerName)}
          </div>
          <span className="clientes-modal-customer-name">{paymentCredit.customerName}</span>
        </div>
        {receivableOrders[paymentCredit.id] && <p className="modal-sub-desc">Pago de comanda #{receivableOrders[paymentCredit.id].orderNumber}</p>}
        <div className="clientes-debt-highlight mt-2">
          <span className="clientes-debt-label">Deuda restante</span>
          <MoneyWithBcv usd={paymentCredit.balancePending} className="clientes-debt-amount" usdClassName="font-bold" compact />
        </div>

        <ReceivablePaymentEditor key={paymentCredit.id} variant="clientes" credit={paymentCredit} accounts={financialAccounts} exchangeRate={bcvRate} saving={paymentSaving} error={paymentError} initialNotes={receivablePaymentNote(receivableOrders[paymentCredit.id])} onSubmit={(payments, notes) => void handlePayment(paymentCredit, payments, notes)} />
        <div className="modal-actions-row-right mt-4"><button type="button" className="btn-modal-cancel" onClick={() => transition(null)}>Cancelar</button></div>
      </div>
    </div>,
      document.body
    )
  }

  return createPortal(
    <div className={`modal-overlay-dark receivables-modal-overlay ${closing ? 'closing' : ''}`} onClick={() => transition(null)}>
      <div className="client-modal-box receivables-modal-box animate-pop clientes-modal-glow" role="dialog" aria-modal="true" aria-labelledby="receivables-modal-title" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header-line clientes-modal-header-glow">
          <div className="side-header-title">
            <DollarSign size={18} className="text-red" />
            <h3 id="receivables-modal-title" className="modal-title">Cuentas por cobrar</h3>
          </div>
          <button className="modal-close-btn" onClick={() => transition(null)}><X size={18} /></button>
        </div>

        <div className="cobrar-total-area clientes-cobrar-total-highlight mt-3">
          <MoneyWithBcv usd={totalOutstanding} className="cobrar-total-val" align="center" />
          <span className="cobrar-total-sub">Total pendiente</span>
        </div>

        <div className="receivables-summary-row">
          <span className="clientes-summary-chip">{pending.length} cuentas activas</span>
          <span className="clientes-summary-chip">{pendingOrderCount} comandas a crédito</span>
        </div>
        <div className="receivables-list">
          {receivablesLoading && <LoadingSkeleton label="Cargando detalle de créditos" count={3} />}
          {pending.map((credit) => {
            const order = receivableOrders[credit.id]
            const days = daysOutstanding(credit.createdAt)
            return <div className="receivable-row" key={credit.id}>
              <div>
                <strong>{credit.customerName}</strong>
                <span>{order ? `Comanda #${order.orderNumber} · ${order.itemsText || 'Sin detalle'}` : 'Crédito manual'}</span>
                <small>Desde hace {days} día{days === 1 ? '' : 's'} · {formatDate(credit.createdAt)}</small>
              </div>
              <div className="receivable-row-actions">
                <MoneyWithBcv usd={credit.balancePending} className="legend-val font-bold" compact />
                <button type="button" className="receivable-payment-button" onClick={() => openPayment(credit)}>
                  Registrar pago
                </button>
              </div>
            </div>
          })}
          {!receivablesLoading && pending.length === 0 && <p className="modal-sub-desc">No hay cuentas por cobrar activas.</p>}
        </div>
      </div>
    </div>,
    document.body
  )
}
