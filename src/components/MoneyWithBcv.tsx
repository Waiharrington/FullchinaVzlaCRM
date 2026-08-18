import { useRates } from '../context/rates-context'
import { formatUsd, formatVes, usdToVes } from '../lib/money'
import './MoneyWithBcv.css'

interface MoneyWithBcvProps {
  usd: number
  rate?: number | null
  className?: string
  usdClassName?: string
  align?: 'start' | 'center' | 'end'
  compact?: boolean
  primaryCurrency?: 'USD' | 'VES'
}

export function MoneyWithBcv({ usd, rate, className = '', usdClassName = '', align = 'end', compact = false, primaryCurrency = 'USD' }: MoneyWithBcvProps) {
  const currentRates = useRates()
  const resolvedRate = rate && rate > 0 ? rate : currentRates.bcvRate
  const ves = usdToVes(usd, resolvedRate)

  if (primaryCurrency === 'VES') {
    return (
      <span className={`money-with-bcv align-${align} ${compact ? 'compact' : ''} ${className}`.trim()}>
        <span className={`money-usd ${usdClassName}`.trim()}>{ves === null ? 'Bs. —' : formatVes(ves)}</span>
        <small className={`money-ves ${ves === null ? 'unavailable' : ''}`}>
          {ves === null ? 'Referencia USD no disponible' : `Ref. ${formatUsd(usd)}`}
        </small>
      </span>
    )
  }

  return (
    <span className={`money-with-bcv align-${align} ${compact ? 'compact' : ''} ${className}`.trim()}>
      <span className={`money-usd ${usdClassName}`.trim()}>{formatUsd(usd)}</span>
      <small className={`money-ves ${ves === null ? 'unavailable' : ''}`}>
        {ves === null ? 'Bs. no disponible' : formatVes(ves)}
      </small>
    </span>
  )
}
