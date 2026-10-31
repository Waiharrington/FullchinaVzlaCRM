import { formatUsd, formatVes, parseMoneyInput } from '../lib/money'
import './CashChangeSummary.css'

interface CashChangeSummaryProps {
  amountReceived: string
  totalUsd: number
  currency: 'USD' | 'VES'
  bcvRate: number | null | undefined
  accounts?: Array<{ id: string; name: string; currency: 'USD' | 'VES'; accountType: string; isActive: boolean }>
  changeAccountId?: string
  onChangeAccountId?: (id: string) => void
  showChangeAccount?: boolean
}

export function CashChangeSummary({ amountReceived, totalUsd, currency, bcvRate, accounts = [], changeAccountId = '', onChangeAccountId, showChangeAccount = false }: CashChangeSummaryProps) {
  const received = Math.round((parseMoneyInput(amountReceived) + Number.EPSILON) * 100) / 100
  const total = currency === 'VES' ? totalUsd * (bcvRate ?? 0) : totalUsd
  const difference = Math.round((received - total) * 100) / 100
  const format = currency === 'VES' ? formatVes : formatUsd
  const selectedAccount = accounts.find(account => account.id === changeAccountId)
  const changeUsd = currency === 'VES' && bcvRate ? difference / bcvRate : difference
  const displayedChange = selectedAccount?.currency === 'VES' && bcvRate ? changeUsd * bcvRate : selectedAccount?.currency === 'USD' ? changeUsd : difference
  const canCalculate = currency === 'USD' || Boolean(bcvRate && bcvRate > 0)
  const canConvertChange = selectedAccount?.currency !== 'VES' || Boolean(bcvRate && bcvRate > 0)
  const state = !canCalculate || received <= 0 ? 'pending' : difference > 0 ? 'change' : difference < 0 ? 'short' : 'exact'
  const resultFormat = state === 'short' ? format : selectedAccount?.currency === 'VES' ? formatVes : selectedAccount?.currency === 'USD' ? formatUsd : format

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
        <strong>{state === 'change' && !canConvertChange ? 'Tasa no disponible' : state === 'change' || state === 'short' ? resultFormat(Math.abs(state === 'change' ? displayedChange : difference)) : state === 'exact' ? 'Pago exacto' : '—'}</strong>
      </div>
      {showChangeAccount && state === 'change' && (
        <label className="cash-change-account">
          <span>¿De qué cuenta sale el vuelto?</span>
          <select value={changeAccountId} onChange={event => onChangeAccountId?.(event.target.value)} required>
            <option value="">Selecciona la cuenta de origen</option>
            {accounts.filter(account => account.isActive && ['cash', 'bank', 'digital', 'other'].includes(account.accountType)).map(account => (
              <option key={account.id} value={account.id} disabled={account.currency === 'VES' && !bcvRate}>{account.name} · {account.currency === 'VES' ? 'Bs' : '$'}{account.currency === 'VES' && !bcvRate ? ' · tasa no disponible' : ''}</option>
            ))}
          </select>
        </label>
      )}
    </div>
  )
}
