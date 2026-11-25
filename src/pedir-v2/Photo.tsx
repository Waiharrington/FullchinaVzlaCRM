import { useRef } from 'react'
import { optimizedProductImage, productImage } from '../lib/publicMenuFormat'

/** Foto completa del plato en su ventanilla: lámpara de calor y vapor al encenderse. */
export function Photo({ imageUrl, alt, eager = false }: { imageUrl?: string | null; alt: string; eager?: boolean }) {
  return (
    <span className="pd-photo">
      <img src={optimizedProductImage(imageUrl) || productImage()} alt={alt} loading={eager ? 'eager' : 'lazy'} fetchPriority={eager ? 'high' : 'auto'} decoding="async" draggable={false} />
      <i className="pd-photo-dim" aria-hidden="true" />
      <i className="pd-photo-lamp" aria-hidden="true" />
      <span className="pd-photo-steam" aria-hidden="true"><i /><i /><i /></span>
    </span>
  )
}

/** Foto gigante del detalle: sigue al dedo o al mouse, y un toque la acerca justo ahí. */
export function PhotoHero({ imageUrl, alt }: { imageUrl?: string | null; alt: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const start = useRef<{ x: number; y: number } | null>(null)

  const point = (clientX: number, clientY: number) => {
    const el = ref.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    el.style.setProperty('--ox', `${((clientX - rect.left) / rect.width) * 100}%`)
    el.style.setProperty('--oy', `${((clientY - rect.top) / rect.height) * 100}%`)
  }

  return (
    <div
      ref={ref}
      className="pd-hero-photo"
      onPointerDown={event => { start.current = { x: event.clientX, y: event.clientY } }}
      onPointerMove={event => {
        if (event.pointerType === 'mouse' || ref.current?.classList.contains('is-zoomed')) point(event.clientX, event.clientY)
      }}
      onPointerUp={event => {
        const from = start.current
        start.current = null
        if (!from || Math.hypot(event.clientX - from.x, event.clientY - from.y) > 8) return
        point(event.clientX, event.clientY)
        ref.current?.classList.toggle('is-zoomed')
      }}
    >
      <img className="pd-hero-photo-img" src={optimizedProductImage(imageUrl) || productImage()} alt={alt} decoding="async" draggable={false} />
      <span className="pd-hero-photo-light" aria-hidden="true" />
      <span className="pd-photo-steam" aria-hidden="true"><i /><i /><i /></span>
      <span className="pd-hero-photo-hint" aria-hidden="true">Toca para verlo de cerca</span>
    </div>
  )
}
