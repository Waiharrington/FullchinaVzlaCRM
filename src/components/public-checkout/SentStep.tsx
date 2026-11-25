import { LOCAL_ORDER_TEST_MODE } from '../../lib/publicMenuConfig'
import { Check, Bike, Store, MapPin } from 'lucide-react'
import { getLocalOrderTestConfirmationCopy } from '../../lib/localOrderTestMode'
import { describePickupTime } from '../../lib/publicOrderRules'
import { money, cartLineKey, cartProductName } from '../../lib/publicMenuFormat'
import { type WebOrderCartItem } from '../../lib/publicOrders'
import { Firecrackers, Fit, FortuneCookie, Wok } from '../../pedir-v2/ui'

interface SentStepProps {
  address: string
  cart: WebOrderCartItem[]
  localTestOrderLinkedToProfile: boolean
  orderCode: string
  orderTotal: number
  orderType: "takeaway" | "delivery"
  phone: string
  pickupTime: string
  returnToMenuAfterSent: () => void
  whatsappPhone: string
  sentSummary: { items: WebOrderCartItem[]; total: number; orderType: "takeaway" | "delivery"; address: string; phone: string; } | null
}

export function SentStep({ address, cart, localTestOrderLinkedToProfile, orderCode, orderTotal, orderType, phone, pickupTime, returnToMenuAfterSent, sentSummary, whatsappPhone }: SentStepProps) {
  return (
LOCAL_ORDER_TEST_MODE ? <div className="public-success"><Firecrackers /><span className="pd-sent-wok" aria-hidden="true"><Wok /></span><span className="pd-stamp" aria-hidden="true">Recibido</span><h3><Fit>{LOCAL_ORDER_TEST_MODE ? 'Prueba local completada' : '¡Solicitud registrada!'}</Fit></h3><strong>{orderCode || 'WEB-PENDIENTE'}</strong><p>{LOCAL_ORDER_TEST_MODE ? getLocalOrderTestConfirmationCopy(localTestOrderLinkedToProfile).body : <>El bot de Full China te enviará la comanda al número de WhatsApp que indicaste para que la revises y nos la confirmes.</>}</p><div className="public-status-timeline">{LOCAL_ORDER_TEST_MODE ? <><div className="complete"><i><Check size={18} /></i><div><strong>{getLocalOrderTestConfirmationCopy(localTestOrderLinkedToProfile).title}</strong><small>{getLocalOrderTestConfirmationCopy(localTestOrderLinkedToProfile).history}</small></div><time>{getLocalOrderTestConfirmationCopy(localTestOrderLinkedToProfile).time}</time></div><div className="pending"><i>2</i><div><strong>Envío omitido</strong><small>El modo de prueba no abre WhatsApp ni contacta al local.</small></div><time>·</time></div><div className="pending"><i>3</i><div><strong>Sin pedido real</strong><small>Esta confirmación no crea una comanda en el sistema.</small></div><time>·</time></div></> : <><div className="complete"><i><Check size={18} /></i><div><strong>Solicitud creada</strong><small>Tu pedido quedó registrado correctamente.</small></div><time>Ahora</time></div><div className="pending"><i>2</i><div><strong>Envío por el bot</strong><small>El bot enviará la comanda automáticamente al número indicado.</small></div><time>◷</time></div><div className="pending"><i>3</i><div><strong>Confirma tu pedido</strong><small>Respóndenos por WhatsApp para confirmar los detalles.</small></div><time>◷</time></div></>}</div><FortuneCookie /><div className="public-success-actions"><button type="button" className="public-primary" onClick={returnToMenuAfterSent}>Volver al menú</button></div></div> : <div className="public-track">
              <div className="public-track-hero">
                <Firecrackers />
                <span className="pd-sent-wok" aria-hidden="true"><Wok /></span>
                <span className="pd-stamp" aria-hidden="true">Recibido</span>
                <h3>¡Pedido recibido!</h3>
                <strong className="public-track-code">#{orderCode || 'WEB-PENDIENTE'}</strong>
                <p>Full China ya tiene tu pedido. <b>No tienes que enviar nada:</b> en un momento te llegará la comanda por WhatsApp{(sentSummary?.phone ?? phone) ? <> al <b className="public-track-phone">{sentSummary?.phone ?? phone}</b></> : null} para que la revises y nos la confirmes.</p>
              </div>
              <section className="public-track-next" aria-labelledby="public-track-next-title">
                <h4 id="public-track-next-title">¿Qué sigue?</h4>
                <ol>
                  <li className="is-done"><span><Check aria-hidden="true" /></span><div><strong>Pedido recibido</strong><small>Lo registramos en Full China.</small></div></li>
                  <li className="is-next"><span>2</span><div><strong>Te llega la comanda por WhatsApp</strong><small>La enviamos automáticamente al número que indicaste.</small></div></li>
                  <li><span>3</span><div><strong>Confírmala respondiendo</strong><small>Respóndenos por WhatsApp para confirmar los detalles y el pago.</small></div></li>
                  <li><span>4</span><div><strong>{(sentSummary?.orderType ?? orderType) === 'delivery' ? 'Te lo llevamos' : 'Lo retiras en Full China'}</strong><small>{(sentSummary?.orderType ?? orderType) === 'delivery' ? 'Te avisamos cuando salga el delivery.' : `Hora de retiro: ${describePickupTime(pickupTime)} · Te avisamos cuando esté listo.`}</small></div></li>
                </ol>
              </section>
              <section className="public-track-summary" aria-label="Resumen del pedido">
                <header>
                  <span>{(sentSummary?.orderType ?? orderType) === 'delivery' ? <Bike aria-hidden="true" /> : <Store aria-hidden="true" />}{(sentSummary?.orderType ?? orderType) === 'delivery' ? 'Delivery' : 'Retiro en Full China'}</span>
                  <b>{money(sentSummary?.total ?? orderTotal)}</b>
                </header>
                {(sentSummary?.orderType ?? orderType) === 'delivery' && (sentSummary?.address ?? address) && <p><MapPin aria-hidden="true" /><span>{sentSummary?.address ?? address}</span></p>}
                <ul>{(sentSummary?.items ?? cart).map(item => <li key={cartLineKey(item)}><b>{item.quantity}×</b><span>{cartProductName(item.productName)}</span></li>)}</ul>
              </section>
              <FortuneCookie />
              <div className="public-track-actions">
                <button type="button" className="public-track-new" onClick={returnToMenuAfterSent}>Hacer otro pedido</button>
                {whatsappPhone.length >= 7 && <a className="public-track-help" href={`https://wa.me/${whatsappPhone}?text=${encodeURIComponent(`Hola, hice el pedido ${orderCode || ''} en la página y aún no me llega la comanda por WhatsApp.`)}`} target="_blank" rel="noopener noreferrer">¿No te llegó la comanda? Escríbenos por WhatsApp</a>}
              </div>
            </div>
  )
}
