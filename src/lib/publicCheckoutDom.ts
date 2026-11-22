// Lleva al cliente al campo que falta y lo resalta un momento. En pantallas
// táctiles no pone el cursor: hacerlo abre el teclado, que tapa el aviso y
// mueve la vista. El cliente toca el campo cuando quiera escribir.
export function revealCheckoutField(field: HTMLElement | null, focus: boolean) {
  if (!field) return
  field.scrollIntoView({ behavior: 'smooth', block: 'center' })
  const box = field.closest<HTMLElement>('label')
    ?? field.closest<HTMLElement>('.public-address-selected, [class*="-field"]')
    ?? field
  box.classList.remove('public-field-attention')
  void box.offsetWidth
  box.classList.add('public-field-attention')
  window.setTimeout(() => box.classList.remove('public-field-attention'), 1400)
  const canFocusWithoutKeyboard = typeof window.matchMedia === 'function'
    && window.matchMedia('(hover: hover) and (pointer: fine)').matches
  if (focus && canFocusWithoutKeyboard) field.focus({ preventScroll: true })
}
