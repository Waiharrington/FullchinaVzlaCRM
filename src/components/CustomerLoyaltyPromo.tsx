import { useState } from 'react'
import { ArrowRight } from 'lucide-react'
import { Fit } from '../pedir-v2/ui'

type CustomerLoyaltyPromoProps = {
  presentation?: 'promotion' | 'recommended'
  onJoin?: () => void
  interactiveCard?: boolean
}

export function CustomerLoyaltyPromo({ presentation = 'promotion', onJoin, interactiveCard = false }: CustomerLoyaltyPromoProps) {
  const [cardAnimating, setCardAnimating] = useState(false)

  const promotionCardArtwork = <article className="customer-profile-welcome-card customer-loyalty-promotion-card" aria-hidden="true">
    <div className="customer-profile-welcome-card-top"><img src="/optimized/root/logo.webp" alt="" /><span>MEMBER<br />CARD</span></div>
    <div className="customer-profile-welcome-card-copy"><small>FULL CHINA · FIDELIDAD</small><strong>TU TARJETA<br /><em>DE VISITAS</em></strong></div>
    <div className="customer-profile-welcome-stamps">{Array.from({ length: 10 }, (_, index) => <span key={index}><img src="/icons/wok-mark.png" alt="" /></span>)}</div>
  </article>

  return <main className={`customer-loyalty-promotion${presentation === 'recommended' ? ' customer-loyalty-promotion--recommended' : ''}`} aria-labelledby="customer-loyalty-promotion-title">
    <div className="customer-loyalty-promotion-glow" aria-hidden="true" />
    <div className="customer-loyalty-promotion-copy">
      <span className="customer-loyalty-promotion-kicker"><i /> PROGRAMA DE FIDELIDAD</span>
      <h2 id="customer-loyalty-promotion-title"><Fit>Cada visita <em>te premia</em></Fit></h2>
      <p>Por cada visita sumas un sello. Completa los 10 y disfruta tu recompensa Full China.</p>
      <div className="customer-loyalty-promotion-progress" aria-label="Tarjeta de diez sellos">
        {Array.from({ length: 10 }, (_, index) => <span key={index} className={index < 6 ? 'is-earned' : ''}><img src="/icons/wok-mark.png" alt="" /></span>)}
        <small>10 visitas · 1 premio</small>
      </div>
      <button type="button" className="customer-loyalty-promotion-cta" onClick={onJoin}>Únete al programa <ArrowRight size={17} /></button>
    </div>
    <div className="customer-loyalty-promotion-card-wrap" aria-hidden={!interactiveCard}>
      {interactiveCard ? <button
        type="button"
        className={`customer-loyalty-promotion-card-trigger${cardAnimating ? ' is-spinning' : ''}`}
        aria-label="Girar tarjeta de fidelidad en 3D"
        title="Haz clic para girar la tarjeta"
        disabled={cardAnimating}
        onAnimationEnd={() => setCardAnimating(false)}
        onClick={() => {
          if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) setCardAnimating(true)
        }}
      >{promotionCardArtwork}</button> : promotionCardArtwork}
    </div>
  </main>
}
