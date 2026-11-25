import { useEffect, useRef, type RefObject } from 'react'

let nearObserver: IntersectionObserver | null = null
function getNearObserver() {
  if (typeof IntersectionObserver === 'undefined') return null
  nearObserver ??= new IntersectionObserver(entries => {
    entries.forEach(entry => entry.target.classList.toggle('is-near', entry.isIntersecting))
  }, { rootMargin: '-26% -18% -32% -18%', threshold: 0.2 })
  return nearObserver
}

/** El plato "despierta" (crece, gira y se enciende) al pasar por el centro de la pantalla. */
export function useServe<T extends HTMLElement>() {
  const ref = useRef<T>(null)
  useEffect(() => {
    const el = ref.current
    const observer = getNearObserver()
    if (!el || !observer) return
    observer.observe(el)
    return () => observer.unobserve(el)
  }, [])
  return ref
}

/** Pausa las animaciones infinitas de una zona cuando no está en pantalla. */
export function usePauseOffscreen(ref: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const el = ref.current
    if (!el || typeof IntersectionObserver === 'undefined') return
    const observer = new IntersectionObserver(([entry]) => { el.classList.toggle('is-offscreen', !entry.isIntersecting) })
    observer.observe(el)
    return () => observer.disconnect()
  }, [ref])
}
