import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react'
import { Check, ChevronDown } from 'lucide-react'

type Option = { value: string; label: string; wide?: boolean }

/* Lista desplegable propia de la carta (reemplaza el <select> del navegador).
   Misma interfaz: recibe el valor y avisa el cambio. Funciona con teclado. */
export function PdSelect({ value, options, onChange, label }: { value: string; options: Option[]; onChange: (value: string) => void; label: string }) {
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const root = useRef<HTMLDivElement>(null)
  const list = useRef<HTMLUListElement>(null)
  const id = useId()
  const selectedIndex = Math.max(0, options.findIndex(option => option.value === value))

  useEffect(() => {
    if (!open) return
    const outside = (event: PointerEvent) => { if (!root.current?.contains(event.target as Node)) setOpen(false) }
    document.addEventListener('pointerdown', outside)
    return () => document.removeEventListener('pointerdown', outside)
  }, [open])

  useEffect(() => {
    if (open) list.current?.children[active]?.scrollIntoView({ block: 'nearest' })
  }, [open, active])

  const toggle = () => {
    setActive(selectedIndex)
    setOpen(current => !current)
  }
  const choose = (option: Option) => {
    onChange(option.value)
    setOpen(false)
  }
  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Escape' && open) {
      event.stopPropagation()
      setOpen(false)
      return
    }
    const step = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 }[event.key]
    if (step) {
      event.preventDefault()
      if (!open) return toggle()
      setActive(current => Math.max(0, Math.min(options.length - 1, current + step)))
    } else if ((event.key === 'Enter' || event.key === ' ') && open) {
      event.preventDefault()
      choose(options[active])
    } else if (event.key === 'Tab') setOpen(false)
  }

  return (
    <div ref={root} className={`pd-select ${open ? 'is-open' : ''}`} onKeyDown={onKeyDown}>
      <button type="button" className="pd-select-trigger" role="combobox" aria-label={label} aria-expanded={open} aria-controls={`${id}-list`} aria-activedescendant={open ? `${id}-${active}` : undefined} onClick={toggle}>
        <span>{options[selectedIndex]?.label}</span>
        <ChevronDown size={20} aria-hidden="true" />
      </button>
      <div className="pd-select-panel">
        <div>
          <ul ref={list} id={`${id}-list`} className="pd-select-list" role="listbox" aria-label={label}>
            {options.map((option, index) => (
              <li
                key={option.value}
                id={`${id}-${index}`}
                role="option"
                aria-selected={option.value === value}
                className={`pd-select-option ${option.wide ? 'is-wide' : ''} ${index === active ? 'is-active' : ''}`}
                onClick={() => choose(option)}
              >
                {option.label}{option.wide && option.value === value && <Check size={16} strokeWidth={3} aria-hidden="true" />}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  )
}
