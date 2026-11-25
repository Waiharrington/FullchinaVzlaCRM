import { Banknote, Check, CreditCard, Landmark, Smartphone, Bitcoin } from 'lucide-react'
import { PAY_OPTIONS, type PayMethod } from '../../lib/publicMenuFormat'

const PAY_ICONS = { cash: Banknote, mobile: Smartphone, transfer: Landmark, card: CreditCard, binance: Bitcoin } as const

/* Métodos de pago a la vista, para elegir con un solo toque. Misma interfaz
   que antes: recibe el valor actual y notifica el cambio. */
export function PayDropdown({ value, onChange, disabledCode }: { value: PayMethod; onChange: (v: PayMethod) => void; disabledCode?: PayMethod }) {
  return (
    <div className="pd-pay-grid" role="radiogroup" aria-label="Método de pago">
      {PAY_OPTIONS.map(option => {
        const Icon = PAY_ICONS[option.code]
        const selected = option.code === value
        return (
          <button
            key={option.code}
            type="button"
            role="radio"
            aria-checked={selected}
            disabled={option.code === disabledCode}
            className={`pd-pay-tile ${selected ? 'is-selected' : ''}`}
            onClick={() => { if (option.code !== disabledCode) onChange(option.code) }}
          >
            <Icon size={20} aria-hidden="true" />
            <span>{option.label}</span>
            {selected && <i className="pd-pay-check"><Check size={13} strokeWidth={3} aria-hidden="true" /></i>}
          </button>
        )
      })}
    </div>
  )
}
