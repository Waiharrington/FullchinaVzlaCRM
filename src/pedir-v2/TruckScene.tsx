import { useRef, useState } from 'react'
import { usePauseOffscreen } from './hooks'

/* Posición real de los bombillos en la foto del local (en % de la foto). */
const BULBS = [[72.9, 4.9], [67.7, 13.3], [79.9, 12.9], [62.5, 14.5], [73.9, 19.3], [56.1, 22.1], [91.2, 16.6], [82.6, 25]]

/** El local real de noche; el food truck llega rodando y saltea en vivo. Si lo tocas, pita. */
export function TruckScene() {
  const ref = useRef<HTMLDivElement>(null)
  const [honk, setHonk] = useState(0)
  usePauseOffscreen(ref)
  return (
    <div
      ref={ref}
      className="pd-street"
      onPointerMove={event => {
        const el = ref.current
        if (!el) return
        const rect = el.getBoundingClientRect()
        el.style.setProperty('--px', `${((event.clientX - rect.left) / rect.width) * 2 - 1}`)
        el.style.setProperty('--py', `${((event.clientY - rect.top) / rect.height) * 2 - 1}`)
      }}
    >
      <span className="pd-street-photo" aria-hidden="true">
        <span>
          <img src="/optimized/fondos/contacto-banner-mobile-chatgpt.webp" alt="" />
          {BULBS.map(([x, y], i) => <i key={x} style={{ left: `${x}%`, top: `${y}%`, animationDelay: `${i * -0.7}s` }} />)}
          <b />
        </span>
      </span>
      <span className="pd-street-fade" aria-hidden="true" />
      <button type="button" className={`pd-truck ${honk ? 'is-honking' : ''}`} key={honk} aria-label="Tocar el food truck" onClick={() => setHonk(count => count + 1)}>
        {honk > 0 && <span className="pd-honk" aria-hidden="true">¡A comer!</span>}
        <span className="pd-dust" aria-hidden="true"><i /><i /><i /></span>
        <svg viewBox="0 0 540 300" aria-hidden="true">
          <defs><linearGradient id="pd-beam"><stop stopColor="#FFE39A" stopOpacity=".75" /><stop offset="1" stopColor="#FFE39A" stopOpacity="0" /></linearGradient></defs>
          <path className="pd-truck-beam" d="M508 197 720 158v112L508 214z" fill="url(#pd-beam)" />
          <ellipse cx="270" cy="274" rx="256" ry="15" fill="#000" opacity=".75" />
          <g className="pd-truck-body">
            <path d="M60 60h16v-18q0-6 6-6h30q6 0 6 6v18z" fill="#7A0A10" />
            <g className="pd-truck-smoke"><circle cx="97" cy="26" r="9" /><circle cx="108" cy="14" r="12" /><circle cx="90" cy="4" r="8" /></g>
            <rect x="18" y="56" width="372" height="186" rx="18" fill="#D9141E" />
            <path d="M390 112h62q18 0 27 17l24 47q5 10 5 21v37q0 8-8 8h-110z" fill="#D9141E" />
            <rect x="18" y="206" width="490" height="36" rx="8" fill="#17100E" />
            <rect x="18" y="200" width="490" height="8" fill="#FFC21A" />
            <path d="M412 130h36q10 0 15 9l17 35q3 7-5 7h-63q-6 0-6-6v-39q0-6 6-6z" fill="#FFE9B8" />
            <path d="M420 138l22 36" stroke="#fff" strokeWidth="6" opacity=".6" strokeLinecap="round" />
            <circle cx="500" cy="205" r="11" fill="#FFE39A" stroke="#17100E" strokeWidth="4" />
            <rect x="46" y="104" width="216" height="84" rx="8" fill="#FFD58A" />
            <rect x="46" y="104" width="216" height="84" rx="8" fill="none" stroke="#17100E" strokeWidth="6" />
            <g>
              <path d="M96 104v12M154 104v12M212 104v12" stroke="#17100E" strokeWidth="3" />
              <path d="M86 128q10-16 20 0zM144 128q10-16 20 0zM202 128q10-16 20 0z" fill="#17100E" />
            </g>
            <g className="pd-cook">
              <path d="M118 188v-22q0-16 16-16h10q16 0 16 16v22z" fill="#fff" />
              <circle cx="139" cy="138" r="13" fill="#F3C39A" />
              <path d="M125 133q-5-16 6-17 3-8 12-4 9-2 10 6 6 4 1 15z" fill="#fff" />
            </g>
            <g className="pd-pan">
              <path className="pd-pan-fire" d="M206 170c2-12 10-16 10-28 8 8 13 14 13 21 3-2 4-5 4-9 7 7 8 16 2 24h-34c-5-8-2-16 5-21 0 5 0 9 0 13z" fill="#FF7A1A" />
              <g className="pd-pan-food"><circle cx="212" cy="172" r="4" fill="#7CC24A" /><circle cx="222" cy="170" r="4.500" fill="#FFC21A" /><circle cx="231" cy="173" r="4" fill="#E0141F" /></g>
              <path d="M196 174h50q-2 14-25 14t-25-14z" fill="#17100E" />
              <path d="M196 176l-34-8" stroke="#17100E" strokeWidth="6" strokeLinecap="round" />
            </g>
            <rect x="36" y="186" width="236" height="11" rx="4" fill="#fff" />
            <g className="pd-truck-awning">
              {Array.from({ length: 8 }, (_, i) => <path key={i} d={`M${34 + i * 30} 78h30v24a15 15 0 0 1-30 0z`} fill={i % 2 ? '#fff' : '#A50D16'} />)}
              <rect x="32" y="72" width="244" height="10" rx="5" fill="#17100E" />
            </g>
            <image href="/optimized/root/logo.webp" x="284" y="112" width="96" height="62" preserveAspectRatio="xMidYMid meet" />
          </g>
          {[112, 420].map(x => (
            <g key={x} className="pd-truck-wheel" style={{ transformOrigin: `${x}px 244px` }}>
              <circle cx={x} cy="244" r="33" fill="#17100E" stroke="#4A3831" strokeWidth="4" />
              <circle cx={x} cy="244" r="15" fill="#FFC21A" />
              <path d={`M${x} 229v30M${x - 15} 244h30`} stroke="#17100E" strokeWidth="4" />
            </g>
          ))}
        </svg>
      </button>
    </div>
  )
}
