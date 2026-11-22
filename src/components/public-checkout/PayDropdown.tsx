import { useEffect, useRef, useState } from 'react'
import { Check, ChevronRight } from 'lucide-react'
import { PAY_OPTIONS, payLabel, type PayMethod } from '../../lib/publicMenuFormat'

/* Desplegable de pago personalizado (reemplaza el <select> nativo).
   No cambia la lógica: recibe el valor actual y notifica el cambio. */
export function PayDropdown({ value, onChange, disabledCode }: { value: PayMethod; onChange: (v: PayMethod) => void; disabledCode?: PayMethod }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('mousedown', onDoc); document.removeEventListener('keydown', onKey) }
  }, [open])
  return (
    <div className={`public-paydd ${open ? 'open' : ''}`} ref={ref}>
      <button type="button" className="public-paydd-trigger" onClick={() => setOpen(o => !o)} aria-haspopup="listbox" aria-expanded={open}>
        <span>{payLabel(value)}</span>
        <ChevronRight className="public-paydd-caret" size={18} aria-hidden="true" />
      </button>
      {open && (
        <ul className="public-paydd-menu" role="listbox">
          {PAY_OPTIONS.map(o => (
            <li
              key={o.code}
              role="option"
              aria-selected={o.code === value}
              aria-disabled={o.code === disabledCode}
              className={`public-paydd-option ${o.code === value ? 'selected' : ''}${o.code === disabledCode ? ' disabled' : ''}`}
              onClick={() => { if (o.code === disabledCode) return; onChange(o.code); setOpen(false) }}
            >
              <span>{o.label}</span>
              {o.code === value && <Check size={16} aria-hidden="true" />}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
