import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Check, ChevronDown } from 'lucide-react'
import './PaymentMethodSelect.css'

export type SelectablePaymentMethod = 'cash' | 'mobile' | 'card' | 'transfer' | 'binance' | 'zelle'

interface PaymentMethodOption {
  method: SelectablePaymentMethod
  label: string
  icon: ReactNode
}

interface PaymentMethodSelectProps {
  value: SelectablePaymentMethod
  options: readonly PaymentMethodOption[]
  disabledMethod?: SelectablePaymentMethod
  onChange: (method: SelectablePaymentMethod) => void
  ariaLabel: string
}

export function PaymentMethodSelect({
  value,
  options,
  disabledMethod,
  onChange,
  ariaLabel,
}: PaymentMethodSelectProps) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const selected = options.find(option => option.method === value) ?? options[0]

  useEffect(() => {
    if (!open) return

    const closeOutside = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }

    document.addEventListener('pointerdown', closeOutside)
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('pointerdown', closeOutside)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [open])

  return (
    <div className={`payment-method-select ${open ? 'is-open' : ''}`} ref={rootRef}>
      <button
        type="button"
        className="payment-method-select-trigger"
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen(current => !current)}
      >
        <span className="payment-method-select-value">
          <span aria-hidden="true">{selected?.icon}</span>
          {selected?.label}
        </span>
        <ChevronDown size={17} aria-hidden="true" />
      </button>

      {open && (
        <div className="payment-method-select-menu" role="listbox" aria-label={ariaLabel}>
          {options.map(option => {
            const isSelected = option.method === value
            const isDisabled = option.method === disabledMethod
            return (
              <button
                type="button"
                role="option"
                aria-selected={isSelected}
                disabled={isDisabled}
                className={`payment-method-select-option ${isSelected ? 'is-selected' : ''}`}
                key={option.method}
                onClick={() => {
                  onChange(option.method)
                  setOpen(false)
                }}
              >
                <span className="payment-method-select-value">
                  <span aria-hidden="true">{option.icon}</span>
                  {option.label}
                </span>
                {isSelected && <Check size={16} aria-hidden="true" />}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
