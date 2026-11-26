import type { CheckoutStep } from '../../lib/publicMenuTypes'
import { type Dispatch, type SetStateAction } from 'react'
import { MapPin, Clock, Navigation, ChevronRight } from 'lucide-react'

import { type WebOrderCartItem } from '../../lib/publicOrders'
import { PickupStage, TimeChips } from '../../pedir-v2/wow'
import { STORE_MAP_EMBED_URL, type PublicOrderPageSettings } from '../../lib/publicOrderPageSettings'

interface PickupStepProps {
  cart: WebOrderCartItem[]
  formattedCloseTime: string
  formattedOpenTime: string
  mapPreviewUrl: string
  pageSettings: PublicOrderPageSettings
  pickupSlots: string[]
  pickupTime: string
  setPickupTime: Dispatch<SetStateAction<string>>
  setStep: Dispatch<SetStateAction<CheckoutStep>>
}

export function PickupStep({ cart, formattedCloseTime, formattedOpenTime, mapPreviewUrl, pageSettings, pickupSlots, pickupTime, setPickupTime, setStep }: PickupStepProps) {
  return (
<section className="public-pickup-step" aria-label="Ubicación y horario para retirar">
              <PickupStage />
              <div className="public-pickup-time">
                <span><Clock size={17} aria-hidden="true" /> ¿A qué hora lo retiras?</span>
                <TimeChips value={pickupTime} slots={pickupSlots} onChange={setPickupTime} />
                <small>{pickupSlots.length ? 'Puedes elegir una hora dentro del horario de hoy.' : 'Ya no quedan horas para elegir hoy; lo preparamos lo antes posible.'}</small>
              </div>
              <div className={'public-pickup-map public-contact-location-stage' + (mapPreviewUrl === STORE_MAP_EMBED_URL ? ' is-store-map' : '')}>
                <iframe title="Ubicación de Full China en Google Maps" src={mapPreviewUrl} loading="lazy" referrerPolicy="no-referrer-when-downgrade" allowFullScreen />
                <span className="public-contact-location-tint" aria-hidden="true" />
                <span className="public-contact-location-tag"><MapPin size={14} /> Punto Full China</span>
                {mapPreviewUrl === STORE_MAP_EMBED_URL && <span className="public-contact-brand-pin" aria-hidden="true"><img src="/optimized/root/logo.webp" alt="" /></span>}
              </div>
              <div className="public-pickup-details">
                <div className="public-pickup-info"><MapPin size={19} /><div><small>Dirección</small><strong>{pageSettings.contactAddress}</strong></div></div>
                <div className="public-pickup-info"><Clock size={19} /><div><small>Horario de atención</small><strong>{pageSettings.contactDays}</strong><span>{formattedOpenTime} – {formattedCloseTime}</span></div></div>
                <a className="public-pickup-directions" href={pageSettings.contactDirectionsUrl} target="_blank" rel="noopener noreferrer"><Navigation size={17} /> Cómo llegar <ChevronRight size={17} /></a>
              </div>
              <button type="button" className="public-primary public-pickup-continue" disabled={!cart.length} onClick={() => setStep('details')}>Continuar con mis datos <ChevronRight /></button>
            </section>
  )
}
