import { useCallback, useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { ArrowDownLeft, ArrowUpRight, Banknote, Clock3, LockKeyhole, RefreshCw, WalletCards } from 'lucide-react'
import { useAuth } from '../context/auth-context'
import { StyledSelect } from '../components/StyledSelect'
import Toast from '../components/Toast'
import NumberStepper from '../components/NumberStepper'
import { EmptyState } from '../components/EmptyState'
import { PageSkeleton } from '../components/PageSkeleton'
import {
  addCashMovement,
  closeCashSession,
  getActiveCashSession,
  getCashSessionHistory,
  getCashSessionTransactions,
  openCashSession,
  type CashMovement,
  type CashSessionSnapshot,
  type CashTransaction,
} from '../lib/dataService'
import './CajaOperativa.css'

const MOVEMENT_LABELS: Record<string, string> = {
  cash_in: 'Ingreso', cash_out: 'Salida', withdrawal: 'Retiro', expense: 'Gasto', adjustment: 'Ajuste',
}

const ORDER_TYPE_LABELS: Record<string, string> = {
  'dine-in': 'Mesa', takeaway: 'Para llevar', delivery: 'Delivery',
}

function money(value: number, currency: 'USD' | 'VES' = 'USD') {
  return new Intl.NumberFormat('es-VE', {
    style: 'currency', currency, minimumFractionDigits: 2, maximumFractionDigits: 2,
  }).format(value)
}

export function CajaOperativa() {
  const { user } = useAuth()
  const [session, setSession] = useState<CashSessionSnapshot | null>(null)
  const [history, setHistory] = useState<CashSessionSnapshot[]>([])
  const [transactions, setTransactions] = useState<CashTransaction[]>([])
  const [txFilter, setTxFilter] = useState<'all' | 'in' | 'out'>('all')
  const [loading, setLoading] = useState(true)
  const [initialLoading, setInitialLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const [openingUsd, setOpeningUsd] = useState('0.00')
  const [openingVes, setOpeningVes] = useState('0.00')
  const [openingNotes, setOpeningNotes] = useState('')

  const [showMovement, setShowMovement] = useState(false)
  const [direction, setDirection] = useState<'in' | 'out'>('out')
  const [movementType, setMovementType] = useState<CashMovement['movementType']>('withdrawal')
  const [currency, setCurrency] = useState<'USD' | 'VES'>('USD')
  const [movementAmount, setMovementAmount] = useState('')
  const [movementDescription, setMovementDescription] = useState('')

  const [showClose, setShowClose] = useState(false)
  const [closingClose, setClosingClose] = useState(false)
  const [countedUsd, setCountedUsd] = useState('')
  const [countedVes, setCountedVes] = useState('')
  const [closingNotes, setClosingNotes] = useState('')

  const refresh = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [active, recent] = await Promise.all([getActiveCashSession(), getCashSessionHistory(10)])
      setSession(active)
      setHistory(recent)
      if (active) {
        getCashSessionTransactions(active.id).then(setTransactions).catch(() => setTransactions([]))
      } else {
        setTransactions([])
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo cargar la caja')
    } finally {
      setLoading(false)
      setInitialLoading(false)
    }
  }, [])

  useEffect(() => { void refresh() }, [refresh])

  const closeDifference = useMemo(() => ({
    usd: (Number(countedUsd) || 0) - (session?.expectedCashUsd ?? 0),
    ves: (Number(countedVes) || 0) - (session?.expectedCashVes ?? 0),
  }), [countedUsd, countedVes, session])

  const handleOpen = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!user) return
    setSaving(true); setError(''); setNotice('')
    try {
      await openCashSession({
        openingCashUsd: Number(openingUsd), openingCashVes: Number(openingVes),
        notes: openingNotes || null, userId: user.id,
      })
      setNotice('Caja abierta correctamente.')
      await refresh()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo abrir la caja')
    } finally { setSaving(false) }
  }

  const handleMovement = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!session || !user) return
    setSaving(true); setError(''); setNotice('')
    try {
      await addCashMovement({
        sessionId: session.id, direction, movementType, currency,
        amount: Number(movementAmount), description: movementDescription, userId: user.id,
      })
      setMovementAmount(''); setMovementDescription(''); setShowMovement(false)
      setNotice('Movimiento registrado.')
      await refresh()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo registrar el movimiento')
    } finally { setSaving(false) }
  }

  const prepareClose = () => {
    if (!session) return
    setCountedUsd(session.expectedCashUsd.toFixed(2))
    setCountedVes(session.expectedCashVes.toFixed(2))
    setShowClose(true)
  }

  const closeCloseModal = (then?: () => void) => {
    if (!showClose || closingClose) return
    setClosingClose(true)
    window.setTimeout(() => {
      setShowClose(false)
      setClosingClose(false)
      then?.()
    }, 200)
  }

  const handleClose = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!session) return
    setSaving(true); setError(''); setNotice('')
    try {
      const closed = await closeCashSession({
        sessionId: session.id, countedCashUsd: Number(countedUsd), countedCashVes: Number(countedVes),
        notes: closingNotes || null,
      })
      setNotice(`Turno #${closed.sessionNumber} cerrado. Diferencia: ${money(closed.differenceUsd ?? 0)}.`)
      closeCloseModal(); setClosingNotes('')
      await refresh()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo cerrar la caja')
    } finally { setSaving(false) }
  }

  if (initialLoading) return <PageSkeleton cards={3} rows={4} hasTable={false} />

  return (
    <div className="page cash-ops-page animate-fade-in management-workspace management-workspace--cash-ops">
      <header className="cash-ops-header management-workspace-header">
        <div>
          <span className="cash-ops-eyebrow">Control operativo</span>
          <h1 className="page-title"><WalletCards size={22} className="page-title-icon" /> Apertura y cierre de caja</h1>
          <p>Fondos iniciales, movimientos, arqueo y diferencias del turno.</p>
        </div>
        <button className="cash-refresh" onClick={() => void refresh()} disabled={loading} aria-label="Actualizar caja">
          <RefreshCw size={18} className={loading ? 'is-spinning' : ''} /> Actualizar
        </button>
      </header>

      {error && <Toast type="error" message={error} onClose={() => setError('')} />}
      {notice && <Toast type="success" message={notice} onClose={() => setNotice('')} />}

      {!loading && !session && (
        <section className="cash-open-panel">
          <div className="cash-open-intro">
            <div className="cash-open-icon"><LockKeyhole size={30} /></div>
            <span>La caja está cerrada</span>
            <h2>Abre el turno antes de cobrar</h2>
            <p>Registra el efectivo físico con el que comienza la Caja principal.</p>
          </div>
          <form className="cash-form" onSubmit={handleOpen}>
            <label>Fondo inicial en USD<NumberStepper min={0} step={0.01} value={openingUsd} onChange={(v) => setOpeningUsd(v)} required /></label>
            <label>Fondo inicial en bolívares<NumberStepper min={0} step={0.01} value={openingVes} onChange={(v) => setOpeningVes(v)} required /></label>
            <label className="cash-field-wide">Nota de apertura<textarea value={openingNotes} onChange={event => setOpeningNotes(event.target.value.slice(0, 180))} placeholder="Opcional" rows={3} /></label>
            <button className="cash-primary cash-field-wide" disabled={saving}><Banknote size={18} /> {saving ? 'Abriendo…' : 'Abrir Caja principal'}</button>
          </form>
        </section>
      )}

      {session && (
        <>
          <section className="cash-session-banner">
            <div><span className="cash-live-dot" /> Turno activo</div>
            <strong>{session.registerName} · #{session.sessionNumber}</strong>
            <span><Clock3 size={15} /> Abierto {new Date(session.openedAt).toLocaleString('es-VE')}</span>
          </section>

          <section className="cash-currency-grid management-workspace-metrics">
            <article className="cash-currency-card usd">
              <div className="cash-currency-heading"><span>Efectivo en dólares</span><strong>{money(session.expectedCashUsd)}</strong></div>
              <div className="cash-currency-details"><div><span>Fondo inicial</span><b>{money(session.openingCashUsd)}</b></div><div><span>Ventas en efectivo</span><b>{money(session.cashSalesUsd)}</b></div><div><span>Entradas / salidas</span><b>{money(session.movementInUsd - session.movementOutUsd)}</b></div></div>
            </article>
            <article className="cash-currency-card ves">
              <div className="cash-currency-heading"><span>Efectivo en bolívares</span><strong>{money(session.expectedCashVes, 'VES')}</strong></div>
              <div className="cash-currency-details"><div><span>Fondo inicial</span><b>{money(session.openingCashVes, 'VES')}</b></div><div><span>Ventas en efectivo</span><b>{money(session.cashSalesVes, 'VES')}</b></div><div><span>Entradas / salidas</span><b>{money(session.movementInVes - session.movementOutVes, 'VES')}</b></div></div>
            </article>
          </section>

          <section className="cash-content-grid">
            <article className="cash-card">
              <div className="cash-card-heading"><div><span>Actividad del turno</span><h2>Movimientos manuales</h2></div><button className="cash-secondary" onClick={() => setShowMovement(value => !value)}>+ Movimiento</button></div>
              {showMovement && (
                <form className="cash-inline-form" onSubmit={handleMovement}>
                  <label>Dirección<StyledSelect value={direction} onChange={event => setDirection(event.target.value as 'in' | 'out')}><option value="in">Entrada</option><option value="out">Salida</option></StyledSelect></label>
                  <label>Tipo<StyledSelect value={movementType} onChange={event => setMovementType(event.target.value as CashMovement['movementType'])}><option value="cash_in">Ingreso de efectivo</option><option value="cash_out">Salida de efectivo</option><option value="withdrawal">Retiro</option><option value="expense">Gasto</option><option value="adjustment">Ajuste</option></StyledSelect></label>
                  <label>Moneda<StyledSelect value={currency} onChange={event => setCurrency(event.target.value as 'USD' | 'VES')}><option value="USD">USD</option><option value="VES">Bolívares</option></StyledSelect></label>
                  <label>Monto<NumberStepper min={0.01} step={0.01} value={movementAmount} onChange={(v) => setMovementAmount(v)} required /></label>
                  <label className="cash-field-wide">Descripción<input value={movementDescription} onChange={event => setMovementDescription(event.target.value.slice(0, 120))} minLength={3} required /></label>
                  <button className="cash-primary cash-field-wide" disabled={saving}>Registrar movimiento</button>
                </form>
              )}
              <div className="cash-movement-list">
                {session.movements.length === 0 && <p className="cash-empty">Todavía no hay movimientos manuales.</p>}
                {session.movements.map(movement => (
                  <div className="cash-movement-row" key={movement.id}>
                    <span className={`cash-direction ${movement.direction}`}>{movement.direction === 'in' ? <ArrowDownLeft size={17} /> : <ArrowUpRight size={17} />}</span>
                    <div><strong>{movement.description}</strong><span>{new Date(movement.createdAt).toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit' })}</span></div>
                    <b className={movement.direction}>{movement.direction === 'in' ? '+' : '-'}{money(movement.amount, movement.currency)}</b>
                  </div>
                ))}
              </div>
            </article>

            <article className="cash-card">
              <div className="cash-card-heading"><div><span>Cobros registrados</span><h2>Efectivo recibido</h2></div><Banknote size={24} /></div>
              <div className="cash-payment-list">
                <div><span>Dólares en efectivo</span><strong>{money(session.cashSalesUsd)}</strong></div>
                <div><span>Bolívares en efectivo</span><strong>{money(session.cashSalesVes, 'VES')}</strong></div>
                <p className="cash-payment-note">Pago móvil, punto, transferencias, Binance y Zelle se concilian en sus cuentas financieras.</p>
              </div>
              <button className="cash-close-button" onClick={prepareClose}><LockKeyhole size={18} /> Iniciar arqueo y cierre</button>
            </article>
          </section>

          <section className="cash-transactions">
            <div className="cash-card">
              <div className="cash-card-heading">
                <div>
                  <span>Línea de tiempo</span>
                  <h2>Movimientos de efectivo</h2>
                </div>
                <div className="cash-tx-filters">
                  <button className={`cash-tx-filter${txFilter === 'all' ? ' active' : ''}`} onClick={() => setTxFilter('all')}>Todo</button>
                  <button className={`cash-tx-filter${txFilter === 'in' ? ' active' : ''}`} onClick={() => setTxFilter('in')}>Entradas</button>
                  <button className={`cash-tx-filter${txFilter === 'out' ? ' active' : ''}`} onClick={() => setTxFilter('out')}>Salidas</button>
                </div>
              </div>
              <div className="cash-tx-list">
                {transactions.filter(t => txFilter === 'all' || t.direction === txFilter).length === 0 && (
                  <EmptyState
                    title={txFilter === 'all' ? 'No hay transacciones en este turno' : txFilter === 'in' ? 'No hay entradas registradas' : 'No hay salidas registradas'}
                  />
                )}
                {transactions.filter(t => txFilter === 'all' || t.direction === txFilter).map(tx => (
                  <div className="cash-tx-row" key={tx.id}>
                    <span className={`cash-direction ${tx.direction}`}>
                      {tx.direction === 'in' ? <ArrowDownLeft size={17} /> : <ArrowUpRight size={17} />}
                    </span>
                    <div className="cash-tx-info">
                      <strong>
                        {tx.kind === 'payment'
                          ? `#${tx.orderNumber} · ${tx.customerName ?? 'Cliente'}`
                          : MOVEMENT_LABELS[tx.method] ?? tx.method}
                      </strong>
                      <span className="cash-tx-meta">
                        {tx.kind === 'payment' && (
                          <>
                            <span className="cash-tx-badge">Efectivo {tx.currency}</span>
                            {tx.orderType && <span className="cash-tx-badge muted">{ORDER_TYPE_LABELS[tx.orderType] ?? tx.orderType}</span>}
                          </>
                        )}
                        <span>{new Date(tx.createdAt).toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit' })}</span>
                      </span>
                      {tx.itemsSummary && <span className="cash-tx-items">{tx.itemsSummary}</span>}
                    </div>
                    <b className={tx.direction}>{tx.direction === 'in' ? '+' : '-'}{money(tx.amount, tx.currency)}</b>
                  </div>
                ))}
              </div>
            </div>
          </section>
        </>
      )}

      {showClose && session && createPortal(
        <div className={`cash-modal-backdrop ${closingClose ? 'closing' : ''}`} onClick={() => closeCloseModal()}>
          <form className="cash-close-modal" onSubmit={handleClose} onClick={event => event.stopPropagation()}>
            <span className="cash-ops-eyebrow">Arqueo del turno #{session.sessionNumber}</span>
            <h2>Cuenta el efectivo físico</h2>
            <p>Compara lo contado con el monto esperado antes de confirmar.</p>
            <div className="cash-close-grid">
              <label>Contado USD<NumberStepper min={0} step={0.01} value={countedUsd} onChange={(v) => setCountedUsd(v)} required /><small>Esperado: {money(session.expectedCashUsd)}</small></label>
              <label>Contado Bs.<NumberStepper min={0} step={0.01} value={countedVes} onChange={(v) => setCountedVes(v)} required /><small>Esperado: {money(session.expectedCashVes, 'VES')}</small></label>
            </div>
            <div className="cash-difference-grid"><div className={closeDifference.usd === 0 ? 'ok' : closeDifference.usd < 0 ? 'negative' : 'positive'}><span>Diferencia USD</span><strong>{money(closeDifference.usd)}</strong></div><div className={closeDifference.ves === 0 ? 'ok' : closeDifference.ves < 0 ? 'negative' : 'positive'}><span>Diferencia Bs.</span><strong>{money(closeDifference.ves, 'VES')}</strong></div></div>
            <label>Nota del cierre<textarea rows={3} value={closingNotes} onChange={event => setClosingNotes(event.target.value.slice(0, 180))} placeholder="Explica cualquier diferencia" /></label>
            <div className="cash-modal-actions"><button type="button" className="cash-secondary" onClick={() => closeCloseModal()}>Cancelar</button><button className="cash-primary" disabled={saving}>{saving ? 'Cerrando…' : 'Confirmar cierre'}</button></div>
          </form>
        </div>,
        document.body
      )}

      <section className="cash-history">
        <div><span className="cash-ops-eyebrow">Historial operativo</span><h2>Turnos cerrados recientemente</h2></div>
        <div className="cash-history-list">
          {history.length === 0 && <p className="cash-empty">No hay turnos cerrados todavía.</p>}
          {history.map(item => <article key={item.id}><div><strong>Turno #{item.sessionNumber}</strong><span>{item.closedAt ? new Date(item.closedAt).toLocaleString('es-VE') : ''}</span></div><div><span>Esperado</span><b>{money(item.expectedCashUsd)} · {money(item.expectedCashVes, 'VES')}</b></div><div><span>Contado</span><b>{money(item.countedCashUsd ?? 0)} · {money(item.countedCashVes ?? 0, 'VES')}</b></div><div><span>Diferencia</span><b className={(item.differenceUsd ?? 0) < 0 || (item.differenceVes ?? 0) < 0 ? 'negative' : (item.differenceUsd ?? 0) > 0 || (item.differenceVes ?? 0) > 0 ? 'positive' : 'ok'}>{money(item.differenceUsd ?? 0)} · {money(item.differenceVes ?? 0, 'VES')}</b></div></article>)}
        </div>
      </section>
    </div>
  )
}
