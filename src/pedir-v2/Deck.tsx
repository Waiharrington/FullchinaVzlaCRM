import { useEffect, useRef, useState, type RefObject } from 'react'
import type { MenuProductGroup } from '../lib/menuGrouping'
import { productTitle } from '../lib/publicMenuFormat'
import { Thumb } from './ui'

/* Miniaturas del mazo de promos: muestran todas de un vistazo, marcan la que
   está al frente y llevan directo a cualquiera. Solo desplazan la vista. */
export function DeckRail({ listRef, groups }: { listRef: RefObject<HTMLDivElement | null>; groups: MenuProductGroup[] }) {
  const [front, setFront] = useState(0)
  const railRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const list = listRef.current
    if (!list) return
    let frame = 0
    const measure = () => {
      frame = 0
      const middle = list.scrollLeft + list.clientWidth / 2
      let best = 0
      let distance = Infinity
      Array.from(list.children).forEach((child, index) => {
        const card = child as HTMLElement
        const gap = Math.abs(card.offsetLeft + card.offsetWidth / 2 - middle)
        if (gap < distance) {
          distance = gap
          best = index
        }
      })
      setFront(best)
    }
    const onScroll = () => { if (!frame) frame = requestAnimationFrame(measure) }
    measure()
    list.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      list.removeEventListener('scroll', onScroll)
      cancelAnimationFrame(frame)
    }
  }, [listRef, groups])

  useEffect(() => {
    const rail = railRef.current
    const thumb = rail?.children[front] as HTMLElement | undefined
    if (rail && thumb) rail.scrollTo({ left: thumb.offsetLeft - rail.clientWidth / 2 + thumb.offsetWidth / 2, behavior: 'smooth' })
  }, [front])

  const goTo = (index: number) => {
    const list = listRef.current
    const card = list?.children[index] as HTMLElement | undefined
    if (list && card) list.scrollTo({ left: card.offsetLeft - (list.clientWidth - card.offsetWidth) / 2, behavior: 'smooth' })
  }

  return (
    <div className="pd-deck-rail">
      <p className="pd-deck-count" aria-live="polite"><b key={front}>{front + 1}</b> de {groups.length}</p>
      <div ref={railRef} className="pd-deck-thumbs" role="group" aria-label="Ir a una promoción">
        {groups.map((group, index) => (
          <button key={group.key} type="button" className={index === front ? 'is-front' : ''} aria-label={`Ver ${productTitle(group.name)}`} aria-current={index === front ? 'true' : undefined} onClick={() => goTo(index)}>
            <Thumb imageUrl={group.variants[0]?.product.imageUrl} />
          </button>
        ))}
      </div>
    </div>
  )
}
