import { useCallback, useEffect, useRef, useState, type FocusEvent, type SyntheticEvent } from 'react'

const NON_TEXT_INPUTS = new Set(['button', 'checkbox', 'color', 'file', 'hidden', 'radio', 'range', 'reset', 'submit'])
// Margen sobre el campo para que su etiqueta siga a la vista.
const FIELD_TOP_GAP = 44
// El botón tocado debe recibir el clic antes de que el panel vuelva a moverse.
const RESTORE_DELAY_MS = 250
// Lo que tarda el teclado en terminar de abrirse.
const KEYBOARD_DELAY_MS = 320

function isTextField(target: EventTarget | null): target is HTMLElement {
  if (target instanceof HTMLTextAreaElement) return !target.readOnly
  return target instanceof HTMLInputElement && !target.readOnly && !NON_TEXT_INPUTS.has(target.type)
}

function revealField(field: HTMLElement) {
  let container = field.parentElement
  while (container && !/(auto|scroll)/.test(getComputedStyle(container).overflowY)) container = container.parentElement
  if (!container) return
  // La franja fija de pasos tapa la parte alta del área desplazable.
  const pinned = container.querySelector<HTMLElement>(':scope > .public-review-header')?.offsetHeight ?? 0
  const top = field.getBoundingClientRect().top - container.getBoundingClientRect().top - pinned - FIELD_TOP_GAP
  container.scrollBy?.({ top, behavior: 'smooth' })
}

/**
 * En pantallas táctiles, mientras se escribe en el panel del pedido, este se
 * ajusta al espacio que deja libre el teclado (ver `.is-typing` en
 * checkout.css) y el campo activo se desplaza a la parte visible.
 */
export function useTypingMode() {
  const [typing, setTyping] = useState(false)
  const panelRef = useRef<HTMLElement | null>(null)
  const restoreTimer = useRef<number | undefined>(undefined)

  const onFocus = useCallback((event: SyntheticEvent<HTMLElement>) => {
    if (!isTextField(event.target) || !window.matchMedia?.('(pointer: coarse)').matches) return
    window.clearTimeout(restoreTimer.current)
    panelRef.current = event.currentTarget
    setTyping(true)
  }, [])

  const onBlur = useCallback((event: FocusEvent<HTMLElement>) => {
    if (!isTextField(event.target)) return
    window.clearTimeout(restoreTimer.current)
    restoreTimer.current = window.setTimeout(() => setTyping(false), RESTORE_DELAY_MS)
  }, [])

  useEffect(() => () => window.clearTimeout(restoreTimer.current), [])

  useEffect(() => {
    const panel = panelRef.current
    if (!typing || !panel) return
    const viewport = window.visualViewport
    let timer: number | undefined
    const fullHeight = viewport?.height ?? 0
    let keyboardSeen = false
    const fit = () => {
      if (viewport) {
        // El teclado puede cerrarse sin que el campo pierda el foco.
        if (viewport.height < fullHeight - 120) keyboardSeen = true
        else if (keyboardSeen && viewport.height > fullHeight - 60) { setTyping(false); return }
      }
      // iOS no encoge la página al abrir el teclado: se mide el área visible.
      if (viewport) {
        panel.style.setProperty('--pd-visible-height', `${viewport.height}px`)
        panel.style.setProperty('--pd-visible-top', `${viewport.offsetTop}px`)
      }
      window.clearTimeout(timer)
      timer = window.setTimeout(() => {
        const field = document.activeElement
        if (isTextField(field) && panel.contains(field)) revealField(field)
      }, KEYBOARD_DELAY_MS)
    }
    fit()
    viewport?.addEventListener('resize', fit)
    viewport?.addEventListener('scroll', fit)
    panel.addEventListener('focusin', fit)
    return () => {
      window.clearTimeout(timer)
      viewport?.removeEventListener('resize', fit)
      viewport?.removeEventListener('scroll', fit)
      panel.removeEventListener('focusin', fit)
      panel.style.removeProperty('--pd-visible-height')
      panel.style.removeProperty('--pd-visible-top')
    }
  }, [typing])

  // Si el campo desaparece con su paso no llega el evento de salida.
  const reset = useCallback(() => setTyping(false), [])

  // `onClick` cubre volver a tocar un campo que conservó el foco.
  return { typing, reset, typingHandlers: { onFocus, onBlur, onClickCapture: onFocus } }
}
