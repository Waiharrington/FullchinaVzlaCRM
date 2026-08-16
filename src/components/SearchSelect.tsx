import { useEffect, useMemo, useRef, useState } from 'react'
import './SearchSelect.css'

export interface SearchSelectOption {
  value: string
  label: string
}

interface Props {
  options: SearchSelectOption[]
  value: string
  onChange: (value: string) => void
  placeholder?: string
  emptyText?: string
  disabled?: boolean
}

/**
 * Combobox con búsqueda: el usuario escribe y las opciones se filtran en vivo.
 * Reemplaza a un <select> largo cuando hay muchas opciones (ej. ingredientes).
 */
export function SearchSelect({
  options,
  value,
  onChange,
  placeholder = 'Buscar...',
  emptyText = 'Sin resultados',
  disabled = false,
}: Props) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [highlight, setHighlight] = useState(0)
  const rootRef = useRef<HTMLDivElement>(null)

  const selectedLabel = useMemo(
    () => options.find((o) => o.value === value)?.label ?? '',
    [options, value],
  )

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return options
    return options.filter((o) => o.label.toLowerCase().includes(q))
  }, [options, query])

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  const openList = () => {
    if (disabled) return
    setOpen(true)
    setQuery('')
    setHighlight(0)
  }

  const choose = (opt: SearchSelectOption) => {
    onChange(opt.value)
    setOpen(false)
    setQuery('')
  }

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open) {
      if (e.key === 'ArrowDown' || e.key === 'Enter') { e.preventDefault(); openList() }
      return
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHighlight((h) => Math.min(h + 1, filtered.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlight((h) => Math.max(h - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (filtered[highlight]) choose(filtered[highlight])
    } else if (e.key === 'Escape') {
      setOpen(false)
    }
  }

  return (
    <div className="search-select" ref={rootRef}>
      <input
        className="search-select-input"
        type="text"
        value={open ? query : selectedLabel}
        placeholder={selectedLabel || placeholder}
        onFocus={openList}
        onChange={(e) => { setOpen(true); setQuery(e.target.value); setHighlight(0) }}
        onKeyDown={onKeyDown}
        disabled={disabled}
        role="combobox"
        aria-expanded={open}
        autoComplete="off"
      />
      {open && (
        <ul className="search-select-list" role="listbox">
          {filtered.length === 0 && <li className="search-select-empty">{emptyText}</li>}
          {filtered.map((opt, i) => (
            <li
              key={opt.value}
              role="option"
              aria-selected={opt.value === value}
              className={
                'search-select-option'
                + (i === highlight ? ' is-highlight' : '')
                + (opt.value === value ? ' is-selected' : '')
              }
              onMouseDown={(e) => { e.preventDefault(); choose(opt) }}
              onMouseEnter={() => setHighlight(i)}
            >
              {opt.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
