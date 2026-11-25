import { useEffect, useState } from 'react'

const matches = (query: string) => typeof window.matchMedia === 'function' && window.matchMedia(query).matches

/** Sigue una media query y vuelve a renderizar cuando cambia. */
export function useMediaQuery(query: string) {
  const [value, setValue] = useState(() => matches(query))
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return
    const media = window.matchMedia(query)
    const update = () => setValue(media.matches)
    update()
    media.addEventListener?.('change', update)
    return () => media.removeEventListener?.('change', update)
  }, [query])
  return value
}
