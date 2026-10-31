import { formatUsd, formatVes, parseMoneyInput } from '../lib/money'
import './CashChangeSummary.css'

interface CashChangeSummaryProps {
  amountReceived: string
  totalUsd: number
  currency: 'USD' | 'VES'
  bcvRate: number | null | undefined
}

export function CashChangeSummary({ amountReceived, totalUsd, currency, bcvRate }: CashChangeSummaryProps) {
  const received = parseMoneyInput(amountReceived)
  const total = currency === 'VES' ? totalUsd * (bcvRate ?? 0) : totalUsd
  const difference = Math.round((received - total) * 100) / 100
  const format = currency === 'VES' ? formatVes : formatUsd
  const canCalculate = currency === 'USD' || Boolean(bcvRate && bcvRate > 0)
  const state = !canCalculate || received <= 0 ? 'pending' : difference > 0 ? 'change' : difference < 0 ? 'short' : 'exact'

  return (
    <div className={`cash-change-summary ${state}`} aria-live="polite">
      <div className="cash-change-row">
        <span>Total a cobrar</span>
        <strong>{canCalculate ? format(total) : 'Tasa no disponible'}</strong>
      </div>
      <div className="cash-change-row">
        <span>Efectivo recibido</span>
        <strong>{format(received)}</strong>
      </div>
      <div className="cash-change-result">
        <span>{state === 'short' ? 'Falta por recibir' : 'Vuelto a entregar'}</span>
        <strong>{state === 'change' || state === 'short' ? format(Math.abs(difference)) : state === 'exact' ? 'Pago exacto' : '—'}</strong>
      </div>
    </div>
  )
}
