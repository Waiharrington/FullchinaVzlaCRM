import { useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode, type RefObject } from 'react'
import type { CheckoutStep } from '../lib/publicMenuTypes'
import { optimizedProductImage, productImage } from '../lib/publicMenuFormat'

/* Piezas visuales del rediseño de /pedir. Ninguna toca datos ni reglas del
   pedido: solo dibujan y animan lo que ya calculan los hooks existentes. */

const DIGITS = '0123456789'.split('')

/** Cifra que rueda como un contador mecánico cuando cambia. */
export function Odo({ value, className = '' }: { value: string; className?: string }) {
  return (
    <span className={`pd-odo ${className}`}>
      <span className="pd-sr">{value}</span>
      {Array.from(value).map((char, index) => {
        const slot = value.length - index
        if (!/\d/.test(char)) return <span key={`c${slot}`} className="pd-odo-char" aria-hidden="true">{char === ' ' ? ' ' : char}</span>
        return (
          <span key={`d${slot}`} className="pd-odo-digit" aria-hidden="true">
            <b>{char}</b>
            <span style={{ '--d': Number(char) } as CSSProperties}>{DIGITS.map(n => <i key={n}>{n}</i>)}</span>
          </span>
        )
      })}
    </span>
  )
}

/** Título de una sola línea: se estrecha y se encoge solo hasta caber. */
export function Fit({ children }: { children: ReactNode }) {
  const outer = useRef<HTMLSpanElement>(null)
  const inner = useRef<HTMLSpanElement>(null)
  useLayoutEffect(() => {
    const box = outer.current
    const text = inner.current
    if (!box || !text) return
    const fit = () => {
      const room = box.clientWidth
      if (!room) return
      text.style.transform = ''
      text.classList.remove('is-narrow')
      if (text.offsetWidth > room) text.classList.add('is-narrow')
      const scale = Math.min(1, room / text.offsetWidth)
      if (scale < 1) {
        text.style.transformOrigin = getComputedStyle(box).textAlign === 'center' ? '0 55%' : '0 80%'
        text.style.transform = `scale(${scale})`
      }
    }
    fit()
    const observer = new ResizeObserver(fit)
    observer.observe(box)
    // Las fuentes pueden llegar después del primer pintado.
    let alive = true
    void document.fonts?.ready.then(() => { if (alive) fit() })
    document.fonts?.addEventListener?.('loadingdone', fit)
    return () => {
      alive = false
      observer.disconnect()
      document.fonts?.removeEventListener?.('loadingdone', fit)
    }
  }, [children])
  return <span ref={outer} className="pd-fit"><span ref={inner}>{children}</span></span>
}

/** El wok del logo, vectorial y vivo: llama, tallarines y cuenco. */
export function Wok({ className = '', lit = true }: { className?: string; lit?: boolean }) {
  return (
    <svg className={`pd-wok-svg ${lit ? 'is-lit' : ''} ${className}`} viewBox="0 0 132 108" aria-hidden="true">
      <g className="pd-wok-flame">
        <path d="M64 3c3 13 19 19 20 37 5-3 7-8 6-13 9 9 12 25 4 37H33c-10-13-5-27 3-37 1 7 4 11 8 12-2-15 6-30 20-36Z" fill="#E0141F" />
        <path className="pd-wok-flame-in" d="M63 26c2 9 12 12 12 24 0 6-2 10-5 14H49c-5-8-3-16 2-21 1 4 3 6 5 6-1-9 2-18 7-23Z" fill="#FFC21A" />
      </g>
      <g className="pd-wok-food" fill="none" stroke="#FFF7EA" strokeWidth="4.5" strokeLinecap="round">
        <path d="M34 64c0-17 24-17 24 0M44 64c0-7 6-7 6 0" />
        <path d="M58 64c0-22 30-22 30 0M67 64c0-11 12-11 12 0" />
        <path d="M84 64c0-13 17-13 17 0" />
      </g>
      <path className="pd-wok-iron" d="M110 60 128 49" strokeWidth="9" strokeLinecap="round" />
      <path className="pd-wok-bowl" d="M18 60h96c-2 26-22 41-48 41S20 86 18 60Z" />
      <path d="M27 69c3 14 14 22 28 25" stroke="#fff" strokeOpacity=".26" strokeWidth="4" strokeLinecap="round" fill="none" />
    </svg>
  )
}

/** Foto servida en un plato redondo de porcelana (mesa giratoria). */
export function Dish({ imageUrl, alt, eager = false }: { imageUrl?: string | null; alt: string; eager?: boolean }) {
  return (
    <span className="pd-dish is-photo">
      <i className="pd-dish-disc" aria-hidden="true" />
      <span className="pd-dish-body"><img src={optimizedProductImage(imageUrl) || productImage()} alt={alt} loading={eager ? 'eager' : 'lazy'} fetchPriority={eager ? 'high' : 'auto'} decoding="async" draggable={false} /></span>
    </span>
  )
}

/** Miniatura del plato. */
export function Thumb({ imageUrl, className = '', alt = '' }: { imageUrl?: string | null; className?: string; alt?: string }) {
  return <img className={className} src={optimizedProductImage(imageUrl) || productImage()} alt={alt} loading="lazy" decoding="async" />
}

/** Estallido de precio, como los de las promos impresas. */
export function Burst({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <span className={`pd-burst ${className}`}>
      <svg viewBox="0 0 100 100" aria-hidden="true"><path d="M50 2 57.6 14.7 69 5.6 72.7 19.9 86.4 16 84 30.5 97.4 33.2 89.8 45.8 99.4 56 86.4 62.9 90.9 76.9 76.2 77.3 74.6 92 61.2 85.9 53.7 98.5 44.4 87.1 32.1 95 28.8 80.7 14.3 82.4 16 67.8 2 63.1 10.9 51.4 2.6 39.5 16.3 34.2 13.6 19.8 28.1 21.8 31.7 7.6 43 16.9Z" /></svg>
      <b>{children}</b>
    </span>
  )
}

/** Los palillos viajan hasta la categoría activa y la "agarran". */
export function Chopsticks({ railRef, active }: { railRef: RefObject<HTMLElement | null>; active: string }) {
  const ref = useRef<HTMLSpanElement>(null)
  useLayoutEffect(() => {
    const rail = railRef.current
    const sticks = ref.current
    if (!rail || !sticks) return
    const place = () => {
      const button = rail.querySelector<HTMLElement>('.public-cat-btn.is-held')
      if (!button || !rail.clientWidth) return
      sticks.style.setProperty('--x', `${button.offsetLeft + button.offsetWidth / 2}px`)
      rail.scrollTo({ left: button.offsetLeft - rail.clientWidth / 2 + button.offsetWidth / 2, behavior: 'smooth' })
      sticks.classList.remove('is-pinching')
      void sticks.offsetWidth
      sticks.classList.add('is-pinching')
    }
    place()
    const observer = new ResizeObserver(place)
    observer.observe(rail)
    return () => observer.disconnect()
  }, [railRef, active])
  return <span ref={ref} className="pd-sticks" aria-hidden="true"><i /><i /></span>
}

const FUSE_STEPS: Array<{ key: string; label: string; steps: CheckoutStep[] }> = [
  { key: 'cart', label: 'Pedido', steps: ['cart'] },
  { key: 'delivery', label: 'Cómo', steps: ['delivery'] },
  { key: 'place', label: 'Dónde', steps: ['address', 'pickup'] },
  { key: 'details', label: 'Datos', steps: ['details'] },
  { key: 'confirm', label: 'Listo', steps: ['confirm'] },
]

/** Progreso del pedido: una mecha que se va quemando hasta el final. */
export function Fuse({ step }: { step: CheckoutStep }) {
  const index = Math.max(0, FUSE_STEPS.findIndex(item => item.steps.includes(step)))
  return (
    <div className="pd-fuse" style={{ '--p': index / (FUSE_STEPS.length - 1) } as CSSProperties} role="img" aria-label={`Paso ${index + 1} de ${FUSE_STEPS.length}: ${FUSE_STEPS[index].label}`}>
      <span className="pd-fuse-rope"><span className="pd-fuse-burn" /></span>
      <span className="pd-fuse-carrier"><span className="pd-fuse-spark"><i /><i /><i /><i /></span></span>
      <ol>{FUSE_STEPS.map((item, i) => <li key={item.key} className={i < index ? 'is-done' : i === index ? 'is-now' : ''}><i />{item.label}</li>)}</ol>
    </div>
  )
}

const CONFETTI = Array.from({ length: 26 }, (_, i) => ({
  '--a': `${(i * 360) / 26 + (i % 3) * 9}deg`,
  '--r': `${110 + (i % 5) * 34}px`,
  '--t': `${(i % 4) * 40}ms`,
  '--c': ['#E0141F', '#FFC21A', '#17100E', '#FF7A1A'][i % 4],
} as CSSProperties))

/** Una sola ráfaga de petardos; después no queda nada animándose. */
export function Firecrackers() {
  return <span className="pd-pops" aria-hidden="true">{CONFETTI.map((style, i) => <i key={i} style={style} />)}</span>
}

const FORTUNES = [
  'Hoy el hambre pierde y tú ganas.',
  'Quien comparte su lumpia multiplica sus amigos.',
  'Un buen wok nunca llega tarde: llega caliente.',
  'Se acerca una noticia. Huele a arroz frito.',
  'Tu próximo antojo ya tiene nombre y apellido.',
  'La paciencia sabe mejor con salsa agridulce.',
]

/** Galleta de la fortuna: se toca y se parte. */
export function FortuneCookie() {
  const [open, setOpen] = useState(false)
  const [text] = useState(() => FORTUNES[Math.floor(Math.random() * FORTUNES.length)])
  return (
    <button type="button" className={`pd-cookie ${open ? 'is-open' : ''}`} onClick={() => setOpen(true)} aria-live="polite">
      <span className="pd-cookie-art" aria-hidden="true">
        <svg viewBox="0 0 150 92">
          <g className="pd-cookie-l"><path d="M75 18C48 4 12 22 8 52c-2 17 10 30 24 28 10-1 16-9 25-12 7-2 12-2 18-2 4-16 4-32 0-48Z" fill="#E7A94D" /><path d="M66 24C46 18 22 32 18 54" stroke="#F8D08A" strokeWidth="6" strokeLinecap="round" fill="none" /></g>
          <g className="pd-cookie-r"><path d="M75 18c27-14 63 4 67 34 2 17-10 30-24 28-10-1-16-9-25-12-7-2-12-2-18-2-4-16-4-32 0-48Z" fill="#DD9A3B" /><path d="M86 24c17-5 35 5 42 20" stroke="#F3C276" strokeWidth="6" strokeLinecap="round" fill="none" /></g>
        </svg>
      </span>
      <span className="pd-cookie-slip">{open ? text : 'Toca tu galleta de la fortuna'}</span>
    </button>
  )
}
