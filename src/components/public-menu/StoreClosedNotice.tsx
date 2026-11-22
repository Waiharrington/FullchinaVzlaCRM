import { type Dispatch, type RefObject, type SetStateAction } from 'react'
import { createPortal } from 'react-dom'
import { Clock, ChevronRight } from 'lucide-react'
import { type PublicOrderPageSettings } from '../../lib/publicOrderPageSettings'

interface StoreClosedNoticeProps {
  formattedCloseTime: string
  formattedOpenTime: string
  pageSettings: PublicOrderPageSettings
  setShowStoreClosedNotice: Dispatch<SetStateAction<boolean>>
  storeClosedNoticeButtonRef: RefObject<HTMLButtonElement | null>
}

export function StoreClosedNotice({ formattedCloseTime, formattedOpenTime, pageSettings, setShowStoreClosedNotice, storeClosedNoticeButtonRef }: StoreClosedNoticeProps) {
  return (
createPortal(
            <div className="public-store-closed-backdrop" onClick={() => setShowStoreClosedNotice(false)}>
              <section className="public-store-closed-dialog" role="alertdialog" aria-modal="true" aria-labelledby="public-store-closed-title" aria-describedby="public-store-closed-copy" onClick={event => event.stopPropagation()}>
                <div className="public-store-closed-scene" aria-hidden="true">
                  <span className="public-store-closed-scene-glow" />
                  <span className="public-store-closed-spark public-store-closed-spark-one">✦</span>
                  <span className="public-store-closed-spark public-store-closed-spark-two">✦</span>
                  <div className="public-store-closed-truck">
                    <div className="public-store-closed-truck-roof" />
                    <div className="public-store-closed-truck-body">
                      <div className="public-store-closed-truck-window" />
                      <div className="public-store-closed-truck-service-window"><i /><i /><i /></div>
                      <div className="public-store-closed-truck-logo"><img src="/optimized/root/logo.webp" alt="" /></div>
                      <span className="public-store-closed-truck-bumper" />
                    </div>
                    <span className="public-store-closed-wheel public-store-closed-wheel-back" />
                    <span className="public-store-closed-wheel public-store-closed-wheel-front" />
                    <span className="public-store-closed-sign">CERRADO</span>
                  </div>
                  <span className="public-store-closed-scene-road" />
                </div>
                <div className="public-store-closed-content">
                  <h2 id="public-store-closed-title">El wok descansa por ahora</h2>
                  <p id="public-store-closed-copy">Puedes recorrer el menú y elegir tus favoritos. Te esperamos cuando abramos para preparar tu pedido.</p>
                  <div className="public-store-closed-hours">
                    <span><Clock size={15} /> HORARIO DEL LOCAL</span>
                    <strong>{formattedOpenTime} <i>—</i> {formattedCloseTime}</strong>
                    <small>{pageSettings.contactDays}</small>
                  </div>
                  <button ref={storeClosedNoticeButtonRef} type="button" className="public-store-closed-confirm" onClick={() => setShowStoreClosedNotice(false)}>Seguir viendo el menú <ChevronRight size={17} /></button>
                </div>
              </section>
            </div>,
            document.body
          )
  )
}
