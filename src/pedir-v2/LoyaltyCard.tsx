import { useState } from 'react'

/** La misma tarjeta de fidelidad de "Mi perfil", a cualquier tamaño. Con `interactive` se inclina y gira al tocarla. */
export function LoyaltyCard({ interactive = false }: { interactive?: boolean }) {
  const [spinning, setSpinning] = useState(false)
  const face = <>
    <span className="pd-lcard-top"><img src="/optimized/root/logo.webp" alt="" decoding="async" /><span>MEMBER<br />CARD</span></span>
    <span className="pd-lcard-copy"><small>FULL CHINA · FIDELIDAD</small><strong>TU TARJETA<br /><em>DE VISITAS</em></strong></span>
    <i className="pd-lcard-sheen" />
  </>
  if (!interactive) return <span className="pd-lcard-box" aria-hidden="true"><span className="pd-lcard">{face}</span></span>
  return (
    <span className="pd-lcard-box">
      <button
        type="button"
        className={`pd-lcard${spinning ? ' is-spinning' : ''}`}
        aria-label="Girar tarjeta de fidelidad"
        onPointerMove={event => {
          const el = event.currentTarget
          const rect = el.getBoundingClientRect()
          el.style.setProperty('--ry', `${((event.clientX - rect.left) / rect.width - 0.5) * 16}deg`)
          el.style.setProperty('--rx', `${((event.clientY - rect.top) / rect.height - 0.5) * -14}deg`)
        }}
        onPointerLeave={event => {
          event.currentTarget.style.setProperty('--ry', '0deg')
          event.currentTarget.style.setProperty('--rx', '0deg')
        }}
        onClick={() => { if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) setSpinning(true) }}
        onAnimationEnd={event => { if (event.target === event.currentTarget) setSpinning(false) }}
      >{face}</button>
    </span>
  )
}
