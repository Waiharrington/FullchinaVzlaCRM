import {
  Children,
  isValidElement,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type ReactNode,
  type SelectHTMLAttributes,
} from 'react'
import { createPortal } from 'react-dom'
import { Check, ChevronDown, Search } from 'lucide-react'
import { normalizeForSearch } from '../lib/textFormat'
import './StyledSelect.css'

interface SelectOption {
  value: string
  label: string
  disabled: boolean
}

export interface StyledSelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  children: ReactNode
}

function nodeText(node: ReactNode): string {
  return Children.toArray(node).map(item => typeof item === 'string' || typeof item === 'number' ? String(item) : '').join('')
}

export function StyledSelect({
  children,
  className = '',
  style,
  value,
  defaultValue,
  disabled,
  onChange,
  id,
  title,
  required,
  name,
  'aria-label': ariaLabelProp,
  'aria-describedby': ariaDescribedBy,
  ...nativeProps
}: StyledSelectProps) {
  const generatedId = useId()
  const buttonId = id || `fc-select-${generatedId.replace(/:/g, '')}`
  const listboxId = `${buttonId}-listbox`
  const rootRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const nativeRef = useRef<HTMLSelectElement>(null)
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [activeIndex, setActiveIndex] = useState(0)
  const [internalValue, setInternalValue] = useState(() => String(defaultValue ?? ''))
  const [menuStyle, setMenuStyle] = useState<CSSProperties>({})

  const options = useMemo<SelectOption[]>(() => Children.toArray(children).flatMap(child => {
    if (!isValidElement<{ value?: string | number; disabled?: boolean; children?: ReactNode }>(child) || child.type !== 'option') return []
    return [{
      value: String(child.props.value ?? nodeText(child.props.children)),
      label: nodeText(child.props.children),
      disabled: Boolean(child.props.disabled),
    }]
  }), [children])

  const selectedValue = value !== undefined ? String(value) : internalValue
  const selectedOption = options.find(option => option.value === selectedValue) || options[0]
  const searchable = options.length >= 8
  const filteredOptions = useMemo(() => {
    const term = normalizeForSearch(query)
    return term ? options.filter(option => normalizeForSearch(option.label).includes(term)) : options
  }, [options, query])

  const positionMenu = useCallback(() => {
    const rect = buttonRef.current?.getBoundingClientRect()
    if (!rect) return
    const spaceBelow = window.innerHeight - rect.bottom
    const openAbove = spaceBelow < 260 && rect.top > spaceBelow
    setMenuStyle({
      left: Math.max(8, Math.min(rect.left, window.innerWidth - Math.max(rect.width, 220) - 8)),
      width: Math.max(rect.width, 220),
      maxHeight: Math.max(160, Math.min(340, openAbove ? rect.top - 16 : spaceBelow - 16)),
      ...(openAbove ? { bottom: window.innerHeight - rect.top + 6 } : { top: rect.bottom + 6 }),
    })
  }, [])

  useLayoutEffect(() => {
    if (!open) return
    positionMenu()
    window.addEventListener('resize', positionMenu)
    window.addEventListener('scroll', positionMenu, true)
    return () => {
      window.removeEventListener('resize', positionMenu)
      window.removeEventListener('scroll', positionMenu, true)
    }
  }, [open, positionMenu])

  useEffect(() => {
    if (!open) return
    const closeOnOutsidePress = (event: PointerEvent) => {
      const target = event.target as Node
      if (!rootRef.current?.contains(target) && !menuRef.current?.contains(target)) setOpen(false)
    }
    document.addEventListener('pointerdown', closeOnOutsidePress)
    return () => document.removeEventListener('pointerdown', closeOnOutsidePress)
  }, [open])

  useEffect(() => {
    if (!open) return
    const selectedIndex = filteredOptions.findIndex(option => option.value === selectedValue)
    setActiveIndex(Math.max(0, selectedIndex))
  }, [filteredOptions, open, selectedValue])

  const choose = (option: SelectOption) => {
    if (option.disabled) return
    setInternalValue(option.value)
    const nativeSelect = nativeRef.current
    if (nativeSelect) {
      const valueSetter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')?.set
      valueSetter?.call(nativeSelect, option.value)
      nativeSelect.dispatchEvent(new Event('change', { bubbles: true }))
    }
    setOpen(false)
    setQuery('')
    buttonRef.current?.focus()
  }

  const moveActive = (direction: 1 | -1) => {
    if (!filteredOptions.length) return
    let next = activeIndex
    do next = (next + direction + filteredOptions.length) % filteredOptions.length
    while (filteredOptions[next]?.disabled && next !== activeIndex)
    setActiveIndex(next)
  }

  const handleKeyboard = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key === 'Escape') {
      setOpen(false)
      setQuery('')
      buttonRef.current?.focus()
      return
    }
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      if (!open) setOpen(true)
      else moveActive(event.key === 'ArrowDown' ? 1 : -1)
      return
    }
    if (open && event.key === 'Enter') {
      event.preventDefault()
      const option = filteredOptions[activeIndex]
      if (option) choose(option)
    }
  }

  const ariaLabel = ariaLabelProp || title || selectedOption?.label || 'Seleccionar opción'

  return (
    <div ref={rootRef} className={`fc-select ${open ? 'is-open' : ''} ${disabled ? 'is-disabled' : ''} ${className}`.trim()} style={style}>
      <select
        {...nativeProps}
        ref={nativeRef}
        className="fc-select-native"
        value={value}
        defaultValue={value === undefined ? defaultValue : undefined}
        disabled={disabled}
        required={required}
        name={name}
        onChange={onChange}
        tabIndex={-1}
        aria-hidden="true"
      >
        {children}
      </select>
      <button
        ref={buttonRef}
        id={buttonId}
        type="button"
        className="fc-select-trigger"
        disabled={disabled}
        aria-label={String(ariaLabel)}
        aria-describedby={ariaDescribedBy}
        aria-required={required || undefined}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listboxId : undefined}
        aria-activedescendant={open && filteredOptions[activeIndex] ? `${listboxId}-${activeIndex}` : undefined}
        onClick={() => { setOpen(current => !current); setQuery('') }}
        onKeyDown={handleKeyboard}
      >
        <span className={!selectedValue ? 'is-placeholder' : ''}>{selectedOption?.label || 'Seleccionar…'}</span>
        <ChevronDown size={16} aria-hidden="true" />
      </button>

      {open ? createPortal(
        <div ref={menuRef} className="fc-select-menu" style={menuStyle}>
          {searchable ? (
            <label className="fc-select-search">
              <Search size={15} aria-hidden="true" />
              <input
                autoFocus
                value={query}
                onChange={event => setQuery(event.target.value)}
                onKeyDown={handleKeyboard}
                placeholder="Buscar opción…"
                aria-label="Buscar opción"
              />
            </label>
          ) : null}
          <div id={listboxId} className="fc-select-options" role="listbox" aria-label={String(ariaLabel)}>
            {filteredOptions.length ? filteredOptions.map((option, index) => (
              <button
                id={`${listboxId}-${index}`}
                key={`${option.value}-${index}`}
                type="button"
                role="option"
                aria-selected={option.value === selectedValue}
                disabled={option.disabled}
                className={`fc-select-option ${index === activeIndex ? 'is-active' : ''} ${option.value === selectedValue ? 'is-selected' : ''}`}
                onMouseEnter={() => setActiveIndex(index)}
                onClick={() => choose(option)}
              >
                <span>{option.label}</span>
                {option.value === selectedValue ? <Check size={16} aria-hidden="true" /> : null}
              </button>
            )) : <div className="fc-select-empty">Sin resultados</div>}
          </div>
        </div>,
        document.body,
      ) : null}
    </div>
  )
}
