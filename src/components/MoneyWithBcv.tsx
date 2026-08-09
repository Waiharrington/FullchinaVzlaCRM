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
}

export function MoneyWithBcv({ usd, rate, className = '', usdClassName = '', align = 'end', compact = false }: MoneyWithBcvProps) {
  const currentRates = useRates()
  const resolvedRate = rate && rate > 0 ? rate : currentRates.bcvRate
  const ves = usdToVes(usd, resolvedRate)

  return (
    <span className={`money-with-bcv align-${align} ${compact ? 'compact' : ''} ${className}`.trim()}>
      <span className={`money-usd ${usdClassName}`.trim()}>{formatUsd(usd)}</span>
      <small className={`money-ves ${ves === null ? 'unavailable' : ''}`}>
        {ves === null ? 'Ref. BCV no disponible' : `Ref. ${formatVes(ves)}`}
      </small>
    </span>
  )
}
