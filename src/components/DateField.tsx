import { useEffect, useState, type InputHTMLAttributes } from 'react'

// Convierte una fecha ISO (yyyy-mm-dd) al formato que el usuario escribe (dd/mm/aaaa).
function isoToDisplay(iso: string): string {
  const [y, m, d] = (iso || '').split('-')
  if (!y || !m || !d) return ''
  return `${d}/${m}/${y}`
}

// Inserta los "/" automáticamente mientras se escribe, sin dejar teclear letras.
function formatTyping(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 8)
  const parts = [digits.slice(0, 2), digits.slice(2, 4), digits.slice(4, 8)].filter(Boolean)
  return parts.join('/')
}

// dd/mm/aaaa -> yyyy-mm-dd, solo cuando la fecha está completa y es válida.
function displayToIso(display: string): string {
  const match = display.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
  if (!match) return ''
  const [, d, m, y] = match
  const day = Number(d), month = Number(m), year = Number(y)
  const check = new Date(year, month - 1, day)
  if (check.getFullYear() !== year || check.getMonth() !== month - 1 || check.getDate() !== day) return ''
  return `${y}-${m}-${d}`
}

interface DateFieldProps {
  value: string
  onChange: (iso: string) => void
  required?: boolean
  className?: string
  placeholder?: string
  id?: string
  name?: InputHTMLAttributes<HTMLInputElement>['name']
}

/** Campo de fecha escrito a mano (dd/mm/aaaa), sin calendario nativo. */
export function DateField({ value, onChange, required, className, placeholder = 'dd/mm/aaaa', id, name }: DateFieldProps) {
  const [text, setText] = useState(() => isoToDisplay(value))

  // Si el valor viene de afuera (p. ej. se limpia el formulario), refleja el cambio.
  useEffect(() => {
    setText((current) => (displayToIso(current) === value ? current : isoToDisplay(value)))
  }, [value])

  const handleChange = (raw: string) => {
    const formatted = formatTyping(raw)
    setText(formatted)
    if (formatted === '') { onChange(''); return }
    const iso = displayToIso(formatted)
    if (iso) onChange(iso)
  }

  return (
    <input
      type="text"
      inputMode="numeric"
      autoComplete="off"
      id={id}
      name={name}
      className={className}
      value={text}
      onChange={(e) => handleChange(e.target.value)}
      placeholder={placeholder}
      maxLength={10}
      required={required}
    />
  )
}
