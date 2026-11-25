import { useRef, type CSSProperties, type RefObject } from 'react'
import type { MenuProductGroup } from '../lib/menuGrouping'
import { LoyaltyCard } from './LoyaltyCard'
import { Dish } from './ui'

type Slide = { kind: 'product'; group: MenuProductGroup } | { kind: 'loyalty' }

/* Mesa giratoria de restaurante chino. Solo dibuja: el índice, el autoplay y
   el gesto siguen siendo los del carrusel existente. La mesa gira como una
   sola pieza, así el navegador anima un único elemento. */
export function Turntable({ slides, index, tableRef }: { slides: Slide[]; index: number; tableRef: RefObject<HTMLDivElement | null> }) {
  const count = Math.max(1, slides.length)
  // Al menos 10 puestos: con menos, los platos vecinos bajan hasta chocar con el texto.
  const seats = count * Math.ceil(10 / count)
  const step = 360 / seats
  // Distancia entre platos vecinos ≈ 58% del ancho disponible.
  const radius = 58 / (2 * Math.sin(Math.PI / seats))

  // Gira siempre por el camino corto, sin devolverse al pasar del último al primero.
  const seat = useRef(index)
  const lastIndex = useRef(index)
  // Otra sección, otra mesa: no arrastra las vueltas que dio la anterior.
  const lastCount = useRef(count)
  if (lastCount.current !== count) {
    lastCount.current = count
    lastIndex.current = index
    seat.current = index
  }
  if (lastIndex.current !== index) {
    let delta = (index - lastIndex.current) % count
    if (delta > count / 2) delta -= count
    if (delta < -count / 2) delta += count
    seat.current += delta
    lastIndex.current = index
  }
  const front = ((seat.current % seats) + seats) % seats

  return (
    <div className="pd-table-window" aria-hidden="true">
      <div ref={tableRef} className="pd-table" style={{ '--turn': `${-seat.current * step}deg`, '--radius': `${radius}` } as CSSProperties}>
        <span className="pd-table-top" />
        {Array.from({ length: seats }, (_, i) => {
          const ahead = (i - front + seats) % seats
          const offset = ahead > seats / 2 ? ahead - seats : ahead
          const away = Math.abs(offset)
          const slide = slides[i % count]
          return (
            <div key={i} className={`pd-seat ${away === 0 ? 'is-front' : ''}`} style={{ '--at': `${i * step}deg` } as CSSProperties}>
              {/* Solo se montan los platos cercanos, y cada uno una sola vez: con pocos platos no se ve repetido a ambos lados. */}
              {slide && away <= 2 && offset > -count / 2 && offset <= count / 2 && (slide.kind === 'product'
                ? <Dish imageUrl={slide.group.variants[0]?.product.imageUrl} alt="" eager={away === 0} />
                : <div className="pd-seat-card"><LoyaltyCard /></div>)}
            </div>
          )
        })}
      </div>
    </div>
  )
}
