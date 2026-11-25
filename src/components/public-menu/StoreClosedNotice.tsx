import { useState, type Dispatch, type RefObject, type SetStateAction } from 'react'
import { createPortal } from 'react-dom'
import { Clock, ChevronRight } from 'lucide-react'
import { type PublicOrderPageSettings } from '../../lib/publicOrderPageSettings'
import { Fit, Wok } from '../../pedir-v2/ui'

interface StoreClosedNoticeProps {
  formattedCloseTime: string
  formattedOpenTime: string
  pageSettings: PublicOrderPageSettings
  setShowStoreClosedNotice: Dispatch<SetStateAction<boolean>>
  storeClosedNoticeButtonRef: RefObject<HTMLButtonElement | null>
}

export function StoreClosedNotice({ formattedCloseTime, formattedOpenTime, pageSettings, setShowStoreClosedNotice, storeClosedNoticeButtonRef }: StoreClosedNoticeProps) {
  const [lifting, setLifting] = useState(false)
  // Solo visual: la santamaría termina de subir antes de cerrar el aviso.
  const lift = () => {
    if (lifting) return
    setLifting(true)
    window.setTimeout(() => setShowStoreClosedNotice(false), window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 420)
  }
  return createPortal(
    <div className={`public-store-closed-backdrop${lifting ? ' is-lifting' : ''}`} onClick={lift}>
      <div className="pd-shutter" aria-hidden="true"><span className="pd-shutter-bar" /></div>
      <section className="public-store-closed-dialog" role="alertdialog" aria-modal="true" aria-labelledby="public-store-closed-title" aria-describedby="public-store-closed-copy" onClick={event => event.stopPropagation()}>
        <div className="pd-neon" aria-hidden="true"><i /><i /><span><b>C</b>ERRA<b>D</b>O</span></div>
        <div className="pd-sleepy" aria-hidden="true"><span>z</span><span>z</span><span>z</span><Wok lit={false} /></div>
        <div className="public-store-closed-content">
          <h2 id="public-store-closed-title"><Fit>El wok descansa por ahora</Fit></h2>
          <p id="public-store-closed-copy">Puedes recorrer el menú y elegir tus favoritos. Te esperamos cuando abramos para preparar tu pedido.</p>
          <div className="public-store-closed-hours">
            <span><Clock size={15} /> Horario del local</span>
            <strong>{formattedOpenTime} <i>a</i> {formattedCloseTime}</strong>
            <small>{pageSettings.contactDays}</small>
          </div>
          <button ref={storeClosedNoticeButtonRef} type="button" className="public-store-closed-confirm" onClick={lift}>Seguir viendo el menú <ChevronRight size={19} /></button>
        </div>
      </section>
    </div>,
    document.body,
  )
}
