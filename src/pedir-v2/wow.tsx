import { useRef, useState, type CSSProperties, type PointerEvent } from 'react'
import { Check, ChevronsRight, LoaderCircle } from 'lucide-react'
import { formatPickupClock, isValidPublicIdentification, normalizeVenezuelanPhone } from '../lib/publicOrderRules'
import { cartLineKey, cartProductName, payLabel, type PayMethod } from '../lib/publicMenuFormat'
import { type WebOrderCartItem } from '../lib/publicOrders'
import { Thumb } from './ui'

/* Escenas de los pasos de compra. Solo dibujan lo que ya calculan los hooks. */

/** "Tu mesa": los platos del pedido sobre la mesa giratoria. */
export function TableScene({ cart }: { cart: WebOrderCartItem[] }) {
  const shown = cart.slice(0, 6)
  const units = cart.reduce((sum, item) => sum + item.quantity, 0)
  return (
    <div className={`pd-mesa ${shown.length === 1 ? 'is-solo' : ''}`} aria-hidden="true">
      {/* La clave cambia con cada unidad: la mesa vuelve a girar. */}
      <div className="pd-mesa-top" key={units}>
        {shown.map((item, index) => (
          <span key={cartLineKey(item)} className="pd-mesa-seat" style={{ '--a': `${(index * 360) / shown.length - 90}deg` } as CSSProperties}>
            <Thumb imageUrl={item.imageUrl} />
            {item.quantity > 1 && <b>×{item.quantity}</b>}
          </span>
        ))}
        {shown.length > 1 && <i className="pd-mesa-hub">{units}</i>}
      </div>
    </div>
  )
}

interface LiveTicketProps {
  cart: WebOrderCartItem[]
  name: string
  identification: string
  phone: string
  payMode: 'single' | 'mixed'
  payPrimary: PayMethod
  paySecondary: PayMethod
}

/** "Tu comanda en vivo": se escribe mientras el cliente llena sus datos. */
export function LiveTicket({ cart, name, identification, phone, payMode, payPrimary, paySecondary }: LiveTicketProps) {
  const digits = identification.replace(/^[VEJ]-?/i, '')
  const rows = [
    { label: 'Nombre', value: name.trim(), ok: name.trim().length > 1 },
    { label: 'Cédula', value: digits ? identification : '', ok: isValidPublicIdentification(identification) },
    { label: 'WhatsApp', value: phone.trim(), ok: Boolean(normalizeVenezuelanPhone(phone)) },
  ]
  const ready = rows.every(row => row.ok)
  const pay = payMode === 'mixed' ? `${payLabel(payPrimary)} + ${payLabel(paySecondary)}` : payLabel(payPrimary)
  return (
    <div className={`pd-live pd-paper ${ready ? 'is-ready' : ''}`} aria-hidden="true">
      <header>
        <strong>Tu comanda</strong>
        {cart[0] && <span>{cartProductName(cart[0].productName)}{cart.length > 1 ? ` y ${cart.length - 1} más` : ''}</span>}
      </header>
      <dl>
        {[...rows, { label: 'Pago', value: pay, ok: true }].map(row => (
          <div key={row.label} className={row.ok ? 'is-ok' : ''}>
            <dt>{row.label}</dt>
            <dd>{row.value}</dd>
            <i><Check size={12} strokeWidth={3.5} /></i>
          </div>
        ))}
      </dl>
      <b className="pd-live-stamp">¡Listo!</b>
    </div>
  )
}

/** Escaparate del retiro: rótulo con las letras del logo, bolsa y el recorrido del pedido. */
export function PickupStage() {
  return (
    <div className="pd-pickup-stage">
      <img src="/optimized/fondos/pickup-card.webp" alt="" />
      <p className="pd-letrero"><span>Tu pedido</span> <strong>te espera</strong></p>
      <ol aria-label="Cómo va tu retiro"><li>Se cocina</li><li>Queda listo</li><li>Lo buscas</li></ol>
    </div>
  )
}

const FIRST_TIMES = 6

/** Horas de retiro a la vista, para elegir con un toque. */
export function TimeChips({ value, slots, onChange }: { value: string; slots: string[]; onChange: (value: string) => void }) {
  // Si ya eligió una hora lejana, la lista abre completa para que se vea.
  const [expanded, setExpanded] = useState(() => slots.indexOf(value) >= FIRST_TIMES)
  const visible = expanded ? slots : slots.slice(0, FIRST_TIMES)
  const options = [{ value: 'asap', label: 'Lo antes posible' }, ...visible.map(slot => ({ value: slot, label: formatPickupClock(slot) }))]
  return (
    <>
      <div className="pd-times" role="radiogroup" aria-label="¿A qué hora lo retiras?">
        {options.map(option => (
          <button key={option.value} type="button" role="radio" aria-checked={option.value === value} className={option.value === value ? 'is-selected' : ''} onClick={() => onChange(option.value)}>{option.label}</button>
        ))}
      </div>
      {slots.length > FIRST_TIMES && <button type="button" className="pd-times-more" aria-expanded={expanded} onClick={() => setExpanded(current => !current)}>{expanded ? 'Ver menos horas' : 'Ver más horas'}</button>}
    </>
  )
}

/** Botón de envío: se puede deslizar la perilla o simplemente tocarlo. */
export function SendSlider({ submitting, onSend }: { submitting: boolean; onSend: () => void }) {
  const [offset, setOffset] = useState(0)
  const drag = useRef({ start: 0, room: 0, moved: false, active: false })

  const down = (event: PointerEvent<HTMLButtonElement>) => {
    const button = event.currentTarget
    drag.current = { start: event.clientX, room: Math.max(1, button.clientWidth - 56), moved: false, active: true }
    button.setPointerCapture?.(event.pointerId)
  }
  const move = (event: PointerEvent<HTMLButtonElement>) => {
    const state = drag.current
    if (!state.active) return
    const distance = Math.min(state.room, Math.max(0, event.clientX - state.start))
    if (distance > 8) state.moved = true
    setOffset(state.moved ? distance : 0)
  }
  const up = (event: PointerEvent<HTMLButtonElement>) => {
    const state = drag.current
    if (!state.active) return
    state.active = false
    setOffset(0)
    if (state.moved && event.clientX - state.start >= state.room * 0.65) onSend()
  }
  const cancel = () => { drag.current.active = false; setOffset(0) }

  return (
    <button
      type="button"
      className={`public-primary whatsapp public-whatsapp-cta pd-slider ${submitting ? 'is-sending' : ''}`}
      disabled={submitting}
      aria-busy={submitting}
      onPointerDown={down}
      onPointerMove={move}
      onPointerUp={up}
      onPointerCancel={cancel}
      // El clic que sigue a un arrastre ya se resolvió al soltar.
      onClick={() => { if (drag.current.moved) { drag.current.moved = false; return } onSend() }}
    >
      <span className="public-confirm-check" aria-hidden="true" style={{ transform: `translateX(${offset}px)` }}>{submitting ? <LoaderCircle className="public-confirm-spinner" /> : <ChevronsRight />}</span>
      <span className="public-whatsapp-copy"><strong>{submitting ? 'Enviando pedido…' : 'Enviar pedido'}</strong></span>
    </button>
  )
}
