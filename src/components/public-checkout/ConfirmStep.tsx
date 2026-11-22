import type { CheckoutStep } from '../../lib/publicMenuTypes'
import { type Dispatch, type SetStateAction } from 'react'
import { cartLineKey, optimizedProductImage, productImage, cartProductName, money, payLabel } from '../../lib/publicMenuFormat'
import { Pencil, MapPin, UserRound, Wallet, MessageSquareText, LoaderCircle, Check, ShieldCheck } from 'lucide-react'
import { describePickupTime } from '../../lib/publicOrderRules'
import Toast from '../../components/Toast'
import { type WebOrderCartItem } from '../../lib/publicOrders'

interface ConfirmStepProps {
  address: string
  addressReference: string
  cart: WebOrderCartItem[]
  closeCart: () => void
  deliveryFeeText: string
  deliveryNotes: string
  editCartItem: (item: WebOrderCartItem) => void
  error: string
  getCartIncludedCopy: (item: WebOrderCartItem) => string | null
  name: string
  notes: string
  orderCode: string
  orderTotal: number
  orderType: "takeaway" | "delivery"
  payMode: "single" | "mixed"
  payPrimary: "cash" | "mobile" | "transfer" | "card" | "binance"
  paySecondary: "cash" | "mobile" | "transfer" | "card" | "binance"
  phone: string
  pickupTime: string
  priceBs: (usd: number) => string | null
  setError: Dispatch<SetStateAction<string>>
  setStep: Dispatch<SetStateAction<CheckoutStep>>
  submitOrder: () => Promise<void>
  submitting: boolean
  total: number
}

export function ConfirmStep({ address, addressReference, cart, closeCart, deliveryFeeText, deliveryNotes, editCartItem, error, getCartIncludedCopy, name, notes, orderCode, orderTotal, orderType, payMode, payPrimary, paySecondary, phone, pickupTime, priceBs, setError, setStep, submitOrder, submitting, total }: ConfirmStepProps) {
  return (
<div className="public-confirm-page"><div className="public-receipt"><div className="public-receipt-head"><img src="/optimized/root/logo.webp" alt="Full China" /><div><span>Solicitud</span><strong>{orderCode || 'Se asigna al confirmar'}</strong><small>Ahora · pedido web</small></div></div>
              <div className="public-confirm-items">{cart.map(item => <div className="public-confirm-item" key={cartLineKey(item)}><img src={optimizedProductImage(item.imageUrl) || productImage()} alt="" /><div><div className="public-confirm-item-name-row"><strong>{cartProductName(item.productName)}</strong><button type="button" aria-label={`Editar ${item.productName}`} onClick={() => { closeCart(); window.setTimeout(() => editCartItem(item), 380) }}><Pencil aria-hidden="true" /><span>Editar</span></button></div>{getCartIncludedCopy(item) && <small className="public-cart-item-notes">{getCartIncludedCopy(item)}</small>}<span>{item.quantity} {item.quantity === 1 ? 'porción' : 'porciones'}</span>{item.notes && <small>{item.notes}</small>}</div><b>{money(item.price * item.quantity)}{priceBs(item.price * item.quantity) && <small className="public-cart-item-bs">{priceBs(item.price * item.quantity)}</small>}</b></div>)}</div>
              <div className="public-total public-review-total"><span>Subtotal productos</span><strong>{money(total)}{priceBs(total) && <small className="public-total-bs">{priceBs(total)}</small>}</strong><div className="public-delivery-total-label">{orderType === 'delivery' ? 'Delivery' : 'Retiro'}</div><div className={`public-delivery-total-value ${orderType === 'takeaway' ? 'is-pickup' : ''}`}>{orderType === 'delivery' ? deliveryFeeText : 'En el local'}</div><b>Total del pedido <em>{money(orderTotal)}{priceBs(orderTotal) && <small className="public-total-bs">{priceBs(orderTotal)}</small>}</em></b></div>
               <div className="public-confirm-info"><button type="button" onClick={() => setStep(orderType === 'delivery' ? 'address' : 'pickup')}><MapPin /><div><strong>{orderType === 'delivery' ? 'Dirección de entrega' : 'Entrega'}</strong><span>{orderType === 'delivery' ? address : 'Retirar en Full China'}</span><small>{orderType === 'delivery' ? addressReference || 'Sin referencia adicional' : `Hora de retiro: ${describePickupTime(pickupTime)}`}</small></div><b>Editar</b></button><button type="button" onClick={() => setStep('details')}><UserRound /><div><strong>Datos de contacto</strong><span>{name}</span><small>{phone}</small></div><b>Editar</b></button><button type="button" onClick={() => setStep('details')}><Wallet /><div><strong>Método de pago</strong><span>{payMode === 'mixed' ? `${payLabel(payPrimary)} + ${payLabel(paySecondary)}` : payLabel(payPrimary)}</span><small>{payMode === 'mixed' ? 'Pago mixto: coordinamos cuánto va por cada método' : 'Se coordina al cobrar'}</small></div><b>Editar</b></button>{notes.trim() && <button type="button" onClick={() => setStep('details')}><MessageSquareText /><div><strong>Indicaciones para la cocina</strong><span className="public-confirm-info-notes">{notes.trim()}</span><small>Se enviarán con tu pedido</small></div><b>Editar</b></button>}{orderType === 'delivery' && deliveryNotes.trim() && <button type="button" onClick={() => setStep('address')}><MessageSquareText /><div><strong>Instrucciones para el repartidor</strong><span className="public-confirm-info-notes">{deliveryNotes.trim()}</span><small>Se enviarán con tu pedido</small></div><b>Editar</b></button>}</div>{error && <Toast type="error" message={error} onClose={() => setError('')} />}</div>
              <button className={`public-primary whatsapp public-whatsapp-cta ${submitting ? 'is-sending' : ''}`} disabled={submitting} aria-busy={submitting} onClick={submitOrder}><span className="public-confirm-check" aria-hidden="true">{submitting ? <LoaderCircle className="public-confirm-spinner" /> : <Check />}</span><span className="public-whatsapp-copy"><strong>{submitting ? 'Enviando pedido…' : 'Confirmar pedido'}</strong></span></button><p className="public-order-security"><ShieldCheck aria-hidden="true" /><span>Tu pedido será confirmado directamente por Full China</span></p>
            </div>
  )
}
