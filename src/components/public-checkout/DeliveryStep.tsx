import type { CheckoutStep } from '../../lib/publicMenuTypes'
import { type RefObject, type Dispatch, type SetStateAction } from 'react'
import { MapPin, ChevronRight } from 'lucide-react'
import { type WebOrderCartItem } from '../../lib/publicOrders'

interface DeliveryStepProps {
  addressActionRef: RefObject<number>
  cart: WebOrderCartItem[]
  deliveryDisabled: boolean
  orderType: "takeaway" | "delivery"
  requestCurrentLocation: () => void
  setDeliveryChosen: Dispatch<SetStateAction<boolean>>
  setLocating: Dispatch<SetStateAction<boolean>>
  setOrderType: Dispatch<SetStateAction<"takeaway" | "delivery">>
  setStep: Dispatch<SetStateAction<CheckoutStep>>
}

export function DeliveryStep({ addressActionRef, cart, deliveryDisabled, orderType, requestCurrentLocation, setDeliveryChosen, setLocating, setOrderType, setStep }: DeliveryStepProps) {
  return (
<div className="public-delivery-step" role="radiogroup" aria-label="Forma de entrega">
              <label className={`public-delivery-choice ${orderType === 'takeaway' ? 'selected' : ''}`}>
                <input className="public-delivery-choice-input" type="radio" name="public-order-type" value="takeaway" checked={orderType === 'takeaway'} onChange={() => { addressActionRef.current += 1; setLocating(false); setOrderType('takeaway'); setDeliveryChosen(true) }} />
                <img src="/optimized/fondos/pickup-card.webp" alt="" aria-hidden="true" />
                <span className="public-delivery-choice-copy"><strong>Retirar en Full China</strong><span>Lo prepararemos para que vengas a buscarlo.</span></span>
                <span className="public-choice-radio" aria-hidden="true" />
              </label>
              <label className={`public-delivery-choice ${orderType === 'delivery' ? 'selected' : ''}${deliveryDisabled ? ' is-disabled' : ''}`} aria-disabled={deliveryDisabled}>
                <input className="public-delivery-choice-input" type="radio" name="public-order-type" value="delivery" disabled={deliveryDisabled} checked={orderType === 'delivery'} onChange={() => { setOrderType('delivery'); setDeliveryChosen(true); requestCurrentLocation() }} />
                <img src="/optimized/fondos/delivery-card.webp" alt="" aria-hidden="true" />
                <span className="public-delivery-choice-copy"><strong>Delivery</strong><span>{deliveryDisabled ? 'Delivery no disponible por ahora. Puedes retirar tu pedido en el local.' : 'Te lo llevamos hasta donde estés.'}</span></span>
                <span className="public-choice-radio" aria-hidden="true" />
              </label>
              <p className="public-delivery-hint"><MapPin aria-hidden="true" /><span>Podrás indicar la dirección en el siguiente paso.</span></p>
              <button type="button" className="public-primary public-delivery-continue" disabled={!cart.length} onClick={() => { setDeliveryChosen(true); setStep(orderType === 'delivery' ? 'address' : 'pickup') }}>Continuar <ChevronRight /></button>
            </div>
  )
}
