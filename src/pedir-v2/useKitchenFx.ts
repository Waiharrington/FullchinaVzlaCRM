import { useEffect, useRef, type RefObject } from 'react'
import { cutoutFor } from './cutouts'

/* Efecto insignia: el plato vuela hasta el wok (el carrito) y el wok salta.
   Solo escucha lo que ya pasó (addFeedback); no decide nada del pedido. */

type Feedback = { imageUrl?: string; status: 'checking' | 'added' } | null

const ADD_BUTTONS = '.public-prod-add, .public-home-add-btn, .public-home-promo-add-btn, .public-variant-add, .ppdm-add-btn, .public-sidebar-reco-card button, .public-recommendation-row button, .public-cart-all-extras-grid article > button'
const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches

function visible(selector: string) {
  return Array.from(document.querySelectorAll<HTMLElement>(selector)).find(el => el.getClientRects().length > 0) ?? null
}

function sparks(x: number, y: number) {
  const layer = document.createElement('div')
  layer.className = 'pd-sparks'
  layer.style.transform = `translate(${x}px, ${y}px)`
  for (let i = 0; i < 10; i += 1) {
    const dot = document.createElement('i')
    const angle = (Math.PI * 2 * i) / 10 - Math.PI / 2
    const reach = 34 + (i % 3) * 14
    layer.append(dot)
    dot.animate([
      { transform: 'translate(0,0) scale(1)', opacity: 1 },
      { transform: `translate(${Math.cos(angle) * reach}px, ${Math.sin(angle) * reach - 18}px) scale(.2)`, opacity: 0 },
    ], { duration: 520, easing: 'cubic-bezier(.15,.8,.3,1)', fill: 'forwards' })
  }
  document.body.append(layer)
  window.setTimeout(() => layer.remove(), 560)
}

function fly(src: string, from: { x: number; y: number; size: number }) {
  const target = visible('.public-cart-fab .pd-wok-svg, .public-sidebar-head .pd-wok-svg')
  if (!target) return
  const rect = target.getBoundingClientRect()
  const toX = rect.left + rect.width / 2
  const toY = rect.top + rect.height * 0.42
  const size = Math.min(170, Math.max(84, from.size * 0.8))
  const dx = toX - from.x
  const dy = toY - from.y
  const lift = Math.min(170, 70 + Math.abs(dx) * 0.18)

  const outer = document.createElement('div')
  const cutout = cutoutFor(src)
  outer.className = cutout ? 'pd-fly is-cut' : 'pd-fly'
  outer.style.width = `${size}px`
  outer.style.height = `${size}px`
  outer.style.left = `${from.x - size / 2}px`
  outer.style.top = `${from.y - size / 2}px`
  const inner = document.createElement('div')
  const img = document.createElement('img')
  img.src = cutout || src
  img.alt = ''
  inner.append(img)
  outer.append(inner)
  document.body.append(outer)

  const duration = 680
  outer.animate([{ transform: 'translateX(0)' }, { transform: `translateX(${dx}px)` }], { duration, easing: 'cubic-bezier(.35,.1,.6,1)', fill: 'forwards' })
  inner.animate([
    { transform: 'translateY(0) rotate(0deg) scale(1)', offset: 0, easing: 'cubic-bezier(.2,.7,.5,1)' },
    { transform: `translateY(${Math.min(0, dy) - lift}px) rotate(200deg) scale(.82)`, offset: 0.42, easing: 'cubic-bezier(.5,0,.9,.5)' },
    { transform: `translateY(${dy}px) rotate(430deg) scale(.26)`, offset: 1 },
  ], { duration, fill: 'forwards' }).onfinish = () => {
    outer.remove()
    target.classList.remove('is-tossing')
    void target.getBoundingClientRect()
    target.classList.add('is-tossing')
    window.setTimeout(() => target.classList.remove('is-tossing'), 700)
    sparks(toX, toY)
    navigator.vibrate?.(14)
  }
}

export function useKitchenFx(feedback: Feedback, pageRef: RefObject<HTMLElement | null>) {
  const origin = useRef<{ x: number; y: number; size: number; src: string } | null>(null)
  const lastRun = useRef<Feedback>(null)

  useEffect(() => {
    const remember = (event: MouseEvent) => {
      const button = (event.target as HTMLElement | null)?.closest?.<HTMLElement>(ADD_BUTTONS)
      if (!button) return
      const card = button.closest<HTMLElement>('article, .public-sidebar-reco-card, .public-variant-picker, .public-product-detail-modal')
      const image = card?.querySelector<HTMLImageElement>('.selected img') ?? card?.querySelector<HTMLImageElement>('img:not([class*="free-drink"])')
      const rect = (image ?? button).getBoundingClientRect()
      origin.current = {
        x: rect.left + rect.width / 2,
        y: Math.max(60, rect.top + rect.height / 2),
        size: Math.min(rect.width, rect.height),
        src: image?.currentSrc || image?.src || '',
      }
    }
    document.addEventListener('click', remember, true)
    return () => document.removeEventListener('click', remember, true)
  }, [])

  useEffect(() => {
    if (feedback?.status !== 'added' || lastRun.current === feedback) return
    lastRun.current = feedback
    const from = origin.current
    const src = feedback.imageUrl || from?.src
    if (!from || !src || reduced()) return
    // Deja que el wok aparezca (primer producto) antes de apuntarle.
    const timer = window.setTimeout(() => fly(src, from), 60)
    return () => window.clearTimeout(timer)
  }, [feedback])

  // Inclinación sutil de las tarjetas con el puntero (solo con mouse).
  useEffect(() => {
    const page = pageRef.current
    if (!page || !window.matchMedia('(hover: hover) and (pointer: fine)').matches || reduced()) return
    let frame = 0
    let current: HTMLElement | null = null
    const reset = (el: HTMLElement | null) => {
      el?.style.removeProperty('--rx')
      el?.style.removeProperty('--ry')
    }
    const move = (event: PointerEvent) => {
      const card = (event.target as HTMLElement).closest<HTMLElement>('.public-prod-card, .public-home-product-card, .public-home-promo-card')
      if (card !== current) {
        reset(current)
        current = card
      }
      if (!card) return
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        const rect = card.getBoundingClientRect()
        card.style.setProperty('--ry', `${((event.clientX - rect.left) / rect.width - 0.5) * 7}deg`)
        card.style.setProperty('--rx', `${-((event.clientY - rect.top) / rect.height - 0.5) * 6}deg`)
      })
    }
    const leave = () => {
      cancelAnimationFrame(frame)
      reset(current)
      current = null
    }
    page.addEventListener('pointermove', move, { passive: true })
    page.addEventListener('pointerleave', leave)
    return () => {
      page.removeEventListener('pointermove', move)
      page.removeEventListener('pointerleave', leave)
      cancelAnimationFrame(frame)
    }
  }, [pageRef])
}
