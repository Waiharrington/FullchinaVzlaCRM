import { useCallback, useEffect, useMemo, useState } from 'react'
import { ArrowDownLeft, ArrowUpRight, Banknote, CheckCircle2, Clock3, LockKeyhole, RefreshCw, WalletCards } from 'lucide-react'
import { useAuth } from '../context/auth-context'
import {
  addCashMovement,
  closeCashSession,
  getActiveCashSession,
  getCashSessionHistory,
  openCashSession,
  type CashMovement,
  type CashSessionSnapshot,
} from '../lib/dataService'
import './CajaOperativa.css'

const PAYMENT_LABELS: Record<string, string> = {
  cash: 'Efectivo', mobile: 'Pago móvil', card: 'Punto', transfer: 'Transferencia', binance: 'Binance', zelle: 'Zelle', other: 'Combinado',
}

// Métodos que el cliente paga en bolívares: se muestran con el monto en Bs.
const BS_METHODS = new Set(['mobile', 'card', 'transfer'])

function money(value: number, currency: 'USD' | 'VES' = 'USD') {
  return new Intl.NumberFormat('es-VE', {
    style: 'currency', currency, minimumFractionDigits: 2, maximumFractionDigits: 2,
  }).format(value)
}

export function CajaOperativa() {
  const { user } = useAuth()
  const [session, setSession] = useState<CashSessionSnapshot | null>(null)
  const [history, setHistory] = useState<CashSessionSnapshot[]>([])
  const [loading, setLoading] = useState(true)
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
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo cargar la caja')
    } finally {
      setLoading(false)
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

  // La caja física del food truck solo maneja efectivo (USD/Bs) y el punto de
  // venta; pago móvil, transferencia, etc. no pasan por ahí, así que se
  // excluyen del desglose y del total cobrado de esta pantalla.
  const cajaMethods = session
    ? Object.entries(session.paymentBreakdown).filter(([method]) => method === 'cash' || method === 'card')
    : []
  const cajaTotal = cajaMethods.reduce((sum, [, amount]) => sum + amount, 0)

  const prepareClose = () => {
    if (!session) return
    setCountedUsd(session.expectedCashUsd.toFixed(2))
    setCountedVes(session.expectedCashVes.toFixed(2))
    setShowClose(true)
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
      setShowClose(false); setClosingNotes('')
      await refresh()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo cerrar la caja')
    } finally { setSaving(false) }
  }

  return (
    <div className="page cash-ops-page animate-fade-in">
      <header className="cash-ops-header">
        <div>
          <span className="cash-ops-eyebrow">Control operativo</span>
          <h1>Apertura y cierre de caja</h1>
          <p>Fondos iniciales, movimientos, arqueo y diferencias del turno.</p>
        </div>
        <button className="cash-refresh" onClick={() => void refresh()} disabled={loading} aria-label="Actualizar caja">
          <RefreshCw size={18} className={loading ? 'is-spinning' : ''} /> Actualizar
        </button>
      </header>

      {error && <div className="cash-message error" role="alert">{error}</div>}
      {notice && <div className="cash-message success"><CheckCircle2 size={18} /> {notice}</div>}

      {!loading && !session && (
        <section className="cash-open-panel">
          <div className="cash-open-intro">
            <div className="cash-open-icon"><LockKeyhole size={30} /></div>
            <span>La caja está cerrada</span>
            <h2>Abre el turno antes de cobrar</h2>
            <p>Registra el efectivo físico con el que comienza la Caja principal.</p>
          </div>
          <form className="cash-form" onSubmit={handleOpen}>
            <label>Fondo inicial en USD<input type="number" min="0" step="0.01" value={openingUsd} onChange={event => setOpeningUsd(event.target.value)} required /></label>
            <label>Fondo inicial en bolívares<input type="number" min="0" step="0.01" value={openingVes} onChange={event => setOpeningVes(event.target.value)} required /></label>
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

          <section className="cash-metric-grid">
            <article><span>Fondo inicial USD</span><strong>{money(session.openingCashUsd)}</strong></article>
            <article><span>Ventas en efectivo</span><strong>{money(session.cashSalesUsd)}</strong></article>
            <article><span>Entradas / salidas</span><strong>{money(session.movementInUsd - session.movementOutUsd)}</strong></article>
            <article className="featured"><span>Efectivo esperado USD</span><strong>{money(session.expectedCashUsd)}</strong></article>
            <article><span>Efectivo esperado Bs.</span><strong>{money(session.expectedCashVes, 'VES')}</strong></article>
          </section>

          <section className="cash-content-grid">
            <article className="cash-card">
              <div className="cash-card-heading"><div><span>Actividad del turno</span><h2>Movimientos manuales</h2></div><button className="cash-secondary" onClick={() => setShowMovement(value => !value)}>+ Movimiento</button></div>
              {showMovement && (
                <form className="cash-inline-form" onSubmit={handleMovement}>
                  <label>Dirección<select value={direction} onChange={event => setDirection(event.target.value as 'in' | 'out')}><option value="in">Entrada</option><option value="out">Salida</option></select></label>
                  <label>Tipo<select value={movementType} onChange={event => setMovementType(event.target.value as CashMovement['movementType'])}><option value="cash_in">Ingreso de efectivo</option><option value="cash_out">Salida de efectivo</option><option value="withdrawal">Retiro</option><option value="expense">Gasto</option><option value="adjustment">Ajuste</option></select></label>
                  <label>Moneda<select value={currency} onChange={event => setCurrency(event.target.value as 'USD' | 'VES')}><option value="USD">USD</option><option value="VES">Bolívares</option></select></label>
                  <label>Monto<input type="number" min="0.01" step="0.01" value={movementAmount} onChange={event => setMovementAmount(event.target.value)} required /></label>
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
              <div className="cash-card-heading"><div><span>Cobros registrados</span><h2>Desglose por método</h2></div><WalletCards size={24} /></div>
              <div className="cash-payment-list">
                {cajaMethods.length === 0 && <p className="cash-empty">Aún no hay pagos en este turno.</p>}
                {cajaMethods.map(([method, amount]) => {
                  const bsExact = session.paymentBreakdownVes?.[method]
                  const showBs = BS_METHODS.has(method) && bsExact != null && bsExact > 0
                  return (
                    <div key={method}>
                      <span>{PAYMENT_LABELS[method] ?? method}</span>
                      {showBs ? (
                        <div className="cash-amt-dual">
                          <strong>{money(bsExact, 'VES')}</strong>
                          <small>{money(amount)}</small>
                        </div>
                      ) : (
                        <strong>{money(amount)}</strong>
                      )}
                    </div>
                  )
                })}
                <div className="cash-payment-total"><span>Total cobrado</span><strong>{money(cajaTotal)}</strong></div>
              </div>
              <button className="cash-close-button" onClick={prepareClose}><LockKeyhole size={18} /> Iniciar arqueo y cierre</button>
            </article>
          </section>
        </>
      )}

      {showClose && session && (
        <div className="cash-modal-backdrop" onClick={() => setShowClose(false)}>
          <form className="cash-close-modal" onSubmit={handleClose} onClick={event => event.stopPropagation()}>
            <span className="cash-ops-eyebrow">Arqueo del turno #{session.sessionNumber}</span>
            <h2>Cuenta el efectivo físico</h2>
            <p>Compara lo contado con el monto esperado antes de confirmar.</p>
            <div className="cash-close-grid">
              <label>Contado USD<input type="number" min="0" step="0.01" value={countedUsd} onChange={event => setCountedUsd(event.target.value)} required /><small>Esperado: {money(session.expectedCashUsd)}</small></label>
              <label>Contado Bs.<input type="number" min="0" step="0.01" value={countedVes} onChange={event => setCountedVes(event.target.value)} required /><small>Esperado: {money(session.expectedCashVes, 'VES')}</small></label>
            </div>
            <div className="cash-difference-grid"><div className={closeDifference.usd === 0 ? 'ok' : closeDifference.usd < 0 ? 'negative' : 'positive'}><span>Diferencia USD</span><strong>{money(closeDifference.usd)}</strong></div><div className={closeDifference.ves === 0 ? 'ok' : closeDifference.ves < 0 ? 'negative' : 'positive'}><span>Diferencia Bs.</span><strong>{money(closeDifference.ves, 'VES')}</strong></div></div>
            <label>Nota del cierre<textarea rows={3} value={closingNotes} onChange={event => setClosingNotes(event.target.value.slice(0, 180))} placeholder="Explica cualquier diferencia" /></label>
            <div className="cash-modal-actions"><button type="button" className="cash-secondary" onClick={() => setShowClose(false)}>Cancelar</button><button className="cash-primary" disabled={saving}>{saving ? 'Cerrando…' : 'Confirmar cierre'}</button></div>
          </form>
        </div>
      )}

      <section className="cash-history">
        <div><span className="cash-ops-eyebrow">Historial operativo</span><h2>Turnos cerrados recientemente</h2></div>
        <div className="cash-history-list">
          {history.length === 0 && <p className="cash-empty">No hay turnos cerrados todavía.</p>}
          {history.map(item => <article key={item.id}><div><strong>Turno #{item.sessionNumber}</strong><span>{item.closedAt ? new Date(item.closedAt).toLocaleString('es-VE') : ''}</span></div><div><span>Esperado</span><b>{money(item.expectedCashUsd)}</b></div><div><span>Contado</span><b>{money(item.countedCashUsd ?? 0)}</b></div><div><span>Diferencia</span><b className={(item.differenceUsd ?? 0) < 0 ? 'negative' : (item.differenceUsd ?? 0) > 0 ? 'positive' : 'ok'}>{money(item.differenceUsd ?? 0)}</b></div></article>)}
        </div>
      </section>
    </div>
  )
}
