import { useEffect, useMemo, useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { StyledSelect } from './StyledSelect'
import type { Credit, FinancialAccount, PaymentMethod } from '../lib/dataService'
import './ReceivablePaymentEditor.css'

export type ReceivablePaymentComponent = {
  amount: number
  method: Exclude<PaymentMethod, 'personal_account' | 'zelle'>
  accountId: string
  exchangeRate: number | null
  referenceNumber?: string
  receivedAmount?: number
  receivedCurrency?: 'USD' | 'VES'
  receivedExchangeRate?: number | null
  changeAmount?: number
  changeCurrency?: 'USD' | 'VES'
  changeAccountId?: string
  changeExchangeRate?: number | null
}

type Draft = {
  key: string
  method: Exclude<PaymentMethod, 'personal_account' | 'zelle'>
  accountId: string
  amountUsd: string
  reference: string
  receivedCurrency: 'USD' | 'VES'
  receivedAmount: string
  changeCurrency: 'USD' | 'VES'
  changeAccountId: string
}

type Props = {
  credit: Pick<Credit, 'balancePending'>
  accounts: FinancialAccount[]
  exchangeRate: number | null
  saving: boolean
  error: string
  onSubmit: (payments: ReceivablePaymentComponent[], notes: string) => void
  variant?: 'clientes' | 'mas'
  initialNotes?: string
}

const METHODS: Array<{ value: Draft['method']; label: string }> = [
  { value: 'cash', label: 'Efectivo' },
  { value: 'mobile', label: 'Pago móvil' },
  { value: 'card', label: 'Punto de venta' },
  { value: 'transfer', label: 'Transferencia' },
  { value: 'binance', label: 'Binance Pay' },
  { value: 'other', label: 'Otro método' },
]

function accountsForMethod(accounts: FinancialAccount[], method: Draft['method'], currency: 'USD' | 'VES') {
  const accepted = accounts.filter(account => account.isActive && account.acceptsCustomerPayments)
  if (method === 'cash') return accepted.filter(account => account.accountType === 'cash' && account.currency === currency)
  if (method === 'mobile') return accepted.filter(account => account.currency === 'VES' && account.accountType === 'bank' && ['Banco Exterior', 'Banesco'].includes(account.name))
  if (method === 'card') return accepted.filter(account => account.currency === 'VES' && account.name === 'Punto de venta')
  if (method === 'transfer') return accepted.filter(account => account.currency === 'VES' && account.accountType === 'bank')
  if (method === 'binance') return accepted.filter(account => account.currency === 'USD' && ['bank', 'digital'].includes(account.accountType))
  return accepted
}

function numberValue(value: string) {
  const parsed = Number(value.replace(',', '.'))
  return Number.isFinite(parsed) ? parsed : 0
}

function money(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100
}

function newDraft(accounts: FinancialAccount[], balance: number, rate: number | null, method: Draft['method'] = 'cash'): Draft {
  const currency: 'USD' | 'VES' = method === 'mobile' || method === 'card' || method === 'transfer' ? 'VES' : 'USD'
  const account = accountsForMethod(accounts, method, currency)[0]
  const appliedUsd = method === 'cash' ? balance : 0
  const tender = currency === 'VES' && rate ? money(appliedUsd * rate) : appliedUsd
  return {
    key: `${Date.now()}-${Math.random()}`,
    method,
    accountId: account?.id ?? '',
    amountUsd: appliedUsd ? appliedUsd.toFixed(2) : '',
    reference: '',
    receivedCurrency: currency,
    receivedAmount: tender ? tender.toFixed(2) : '',
    changeCurrency: currency,
    changeAccountId: account?.id ?? '',
  }
}

export function ReceivablePaymentEditor({ credit, accounts, exchangeRate, saving, error, onSubmit, variant = 'clientes', initialNotes = '' }: Props) {
  const [drafts, setDrafts] = useState<Draft[]>(() => [newDraft(accounts, credit.balancePending, exchangeRate)])
  const [notes, setNotes] = useState(initialNotes)
  const bcv = exchangeRate && exchangeRate > 0 ? exchangeRate : null
  const totalUsd = useMemo(() => drafts.reduce((sum, draft) => sum + money(numberValue(draft.amountUsd)), 0), [drafts])
  const update = (key: string, patch: Partial<Draft>) => setDrafts(previous => previous.map(draft => draft.key === key ? { ...draft, ...patch } : draft))

  useEffect(() => {
    setDrafts(previous => previous.map(draft => {
      const eligible = accountsForMethod(accounts, draft.method, draft.receivedCurrency)
      const accountId = eligible.some(account => account.id === draft.accountId) ? draft.accountId : eligible[0]?.id ?? ''
      const changeAccounts = accounts.filter(account => account.isActive && account.currency === draft.changeCurrency && ['cash', 'bank', 'digital', 'other'].includes(account.accountType))
      const changeAccountId = changeAccounts.some(account => account.id === draft.changeAccountId) ? draft.changeAccountId : changeAccounts[0]?.id ?? ''
      return accountId === draft.accountId && changeAccountId === draft.changeAccountId ? draft : { ...draft, accountId, changeAccountId }
    }))
  }, [accounts])

  const lineData = drafts.map(draft => {
    const appliedUsd = money(numberValue(draft.amountUsd))
    const received = money(numberValue(draft.receivedAmount))
    const receivedUsd = draft.receivedCurrency === 'VES' ? (bcv ? received / bcv : 0) : received
    const changeUsd = draft.method === 'cash' ? money(receivedUsd - appliedUsd) : 0
    const changeAmount = draft.changeCurrency === 'VES' && bcv ? money(changeUsd * bcv) : changeUsd
    const receiveAccounts = accountsForMethod(accounts, draft.method, draft.receivedCurrency)
    const selectedAccount = receiveAccounts.find(account => account.id === draft.accountId)
    const changeAccounts = accounts.filter(account => account.isActive && account.currency === draft.changeCurrency && ['cash', 'bank', 'digital', 'other'].includes(account.accountType))
    const requiresReference = ['mobile', 'card', 'transfer', 'binance'].includes(draft.method)
    const paymentAmountInAccountCurrency = selectedAccount?.currency === 'VES' && bcv ? money(appliedUsd * bcv) : appliedUsd
    return { draft, appliedUsd, received, receivedUsd, changeUsd, changeAmount, receiveAccounts, selectedAccount, changeAccounts, requiresReference, paymentAmountInAccountCurrency }
  })

  const submit = (event: React.FormEvent) => {
    event.preventDefault()
    if (lineData.some(line => !line.draft.accountId || line.appliedUsd <= 0 || (line.requiresReference && !line.draft.reference.trim()))) return
    if (totalUsd <= 0 || totalUsd > credit.balancePending) return
    if (lineData.some(line => line.selectedAccount?.currency === 'VES' && !bcv)) return
    if (lineData.some(line => line.draft.method === 'cash' && (line.received <= 0 || (line.draft.receivedCurrency === 'VES' && !bcv) || line.changeUsd < 0 || (line.changeUsd > 0 && (!line.draft.changeAccountId || (line.draft.changeCurrency === 'VES' && !bcv)))))) return
    const payments: ReceivablePaymentComponent[] = lineData.map(({ draft, appliedUsd, changeUsd, changeAmount }) => ({
      amount: appliedUsd,
      method: draft.method,
      accountId: draft.accountId,
      exchangeRate: accounts.find(account => account.id === draft.accountId)?.currency === 'VES' ? bcv : null,
      referenceNumber: draft.reference.trim() || undefined,
      ...(draft.method === 'cash' ? {
        receivedAmount: money(numberValue(draft.receivedAmount)),
        receivedCurrency: draft.receivedCurrency,
        receivedExchangeRate: draft.receivedCurrency === 'VES' ? bcv : null,
        ...(changeUsd > 0 ? {
          changeAmount,
          changeCurrency: draft.changeCurrency,
          changeAccountId: draft.changeAccountId,
          changeExchangeRate: draft.changeCurrency === 'VES' ? bcv : null,
        } : {}),
      } : {}),
    }))
    onSubmit(payments, notes.trim())
  }

  const addMethod = () => setDrafts(previous => [...previous, newDraft(accounts, 0, bcv, 'mobile')])
  const removeMethod = (key: string) => setDrafts(previous => previous.length > 1 ? previous.filter(draft => draft.key !== key) : previous)

  return <form className={`receivable-editor receivable-editor--${variant}`} onSubmit={submit}>
    <p className="receivable-editor-note">Indica cuánto se aplica al saldo por cada método. Si es efectivo, registra lo recibido y el origen del vuelto cuando corresponda.</p>
    {lineData.map(({ draft, appliedUsd, receivedUsd, changeUsd, changeAmount, receiveAccounts, selectedAccount, changeAccounts, requiresReference, paymentAmountInAccountCurrency }, index) => (
      <section className="receivable-editor-line" key={draft.key} aria-label={`Método de pago ${index + 1}`}>
        <div className="receivable-editor-line-head">
          <strong>Parte {index + 1}</strong>
          {drafts.length > 1 && <button type="button" aria-label={`Quitar parte ${index + 1}`} onClick={() => removeMethod(draft.key)}><Trash2 size={14} /></button>}
        </div>
        <label>Método de pago
          <StyledSelect value={draft.method} onChange={event => {
            const method = event.target.value as Draft['method']
            const currency: 'USD' | 'VES' = method === 'mobile' || method === 'card' || method === 'transfer' ? 'VES' : 'USD'
            const account = accountsForMethod(accounts, method, currency)[0]
            const receivedAmount = method === 'cash' ? (currency === 'VES' && bcv ? money(appliedUsd * bcv) : appliedUsd).toFixed(2) : draft.receivedAmount
            update(draft.key, { method, accountId: account?.id ?? '', reference: '', receivedCurrency: currency, receivedAmount, changeCurrency: currency, changeAccountId: account?.id ?? '' })
          }}>
            {METHODS.map(method => <option key={method.value} value={method.value}>{method.label}</option>)}
          </StyledSelect>
        </label>
        <label>Cuenta donde ingresa el pago
          <StyledSelect value={draft.accountId} onChange={event => {
            const account = receiveAccounts.find(item => item.id === event.target.value)
            update(draft.key, { accountId: event.target.value, ...(draft.method === 'cash' && account ? {
              receivedCurrency: account.currency,
              receivedAmount: (account.currency === 'VES' && bcv ? money(appliedUsd * bcv) : appliedUsd).toFixed(2),
              changeCurrency: account.currency,
              changeAccountId: accounts.find(item => item.id === event.target.value && item.currency === account.currency)?.id ?? '',
            } : {}) })
          }}>
            <option value="">Selecciona una cuenta</option>
            {receiveAccounts.map(account => <option key={account.id} value={account.id}>{account.name} · {account.currency === 'VES' ? 'Bs' : '$'}</option>)}
          </StyledSelect>
        </label>
        <label>Monto que abona al saldo (USD)
          <input type="number" inputMode="decimal" min="0" step="0.01" max={credit.balancePending} value={draft.amountUsd} onChange={event => {
            const next = event.target.value
            const nextUsd = money(numberValue(next))
            const oldUsd = appliedUsd
            const oldReceived = numberValue(draft.receivedAmount)
            const shouldSyncReceived = draft.method === 'cash' && Math.abs((draft.receivedCurrency === 'VES' && bcv ? oldReceived / bcv : oldReceived) - oldUsd) < 0.01
            update(draft.key, { amountUsd: next, ...(shouldSyncReceived ? { receivedAmount: (draft.receivedCurrency === 'VES' && bcv ? money(nextUsd * bcv) : nextUsd).toFixed(2) } : {}) })
          }} />
          {selectedAccount?.currency === 'VES' && <small>Equivale a Bs. {paymentAmountInAccountCurrency.toFixed(2)}{bcv ? ` · BCV ${bcv.toFixed(2)}` : ' · falta tasa BCV'}</small>}
        </label>
        {draft.method === 'cash' && <div className="receivable-editor-cash">
          <label>Moneda recibida
            <StyledSelect value={draft.receivedCurrency} onChange={event => {
              const currency = event.target.value as 'USD' | 'VES'
              const account = accountsForMethod(accounts, 'cash', currency)[0]
              update(draft.key, {
                receivedCurrency: currency,
                accountId: account?.id ?? '',
                receivedAmount: (currency === 'VES' && bcv ? money(appliedUsd * bcv) : appliedUsd).toFixed(2),
                changeCurrency: currency,
                changeAccountId: account?.id ?? '',
              })
            }}><option value="USD">Dólares (USD)</option><option value="VES">Bolívares (VES)</option></StyledSelect>
          </label>
          <label>Monto recibido ({draft.receivedCurrency === 'VES' ? 'Bs' : '$'})
            <input type="number" inputMode="decimal" min="0" step="0.01" value={draft.receivedAmount} onChange={event => update(draft.key, { receivedAmount: event.target.value })} />
          </label>
          {draft.receivedCurrency === 'VES' && <small>{bcv ? `Recibido ≈ $${receivedUsd.toFixed(2)} · BCV Bs. ${bcv.toFixed(2)}` : 'Se necesita una tasa BCV válida para calcular este abono.'}</small>}
          {appliedUsd > 0 && receivedUsd < appliedUsd && <small className="receivable-editor-error">El efectivo recibido no cubre esta parte del abono.</small>}
          {changeUsd > 0 && <div className="receivable-editor-change">
            <strong>Vuelto a entregar: {draft.changeCurrency === 'VES' ? `Bs. ${changeAmount.toFixed(2)}` : `$${changeAmount.toFixed(2)}`}</strong>
            <label>Moneda del vuelto
              <StyledSelect value={draft.changeCurrency} onChange={event => {
                const currency = event.target.value as 'USD' | 'VES'
                update(draft.key, { changeCurrency: currency, changeAccountId: accounts.find(account => account.isActive && account.currency === currency && ['cash','bank','digital','other'].includes(account.accountType))?.id ?? '' })
              }}><option value="USD">Dólares (USD)</option><option value="VES">Bolívares (VES)</option></StyledSelect>
            </label>
            <label>¿De qué cuenta sale el vuelto?
              <StyledSelect value={draft.changeAccountId} onChange={event => update(draft.key, { changeAccountId: event.target.value })}>
                <option value="">Selecciona la cuenta de origen</option>
                {changeAccounts.map(account => <option key={account.id} value={account.id}>{account.name} · {account.currency === 'VES' ? 'Bs' : '$'}</option>)}
              </StyledSelect>
            </label>
          </div>}
        </div>}
        {requiresReference && <label>Referencia del pago
          <input type="text" maxLength={120} value={draft.reference} onChange={event => update(draft.key, { reference: event.target.value })} />
        </label>}
      </section>
    ))}
    <button type="button" className="receivable-editor-add" onClick={addMethod}><Plus size={15} /> Agregar otro método</button>
    <div className="receivable-editor-total"><span>Total aplicado al crédito</span><strong>${totalUsd.toFixed(2)} / ${credit.balancePending.toFixed(2)}</strong></div>
    {totalUsd > credit.balancePending && <p className="receivable-editor-error">El abono total supera el saldo pendiente.</p>}
    {totalUsd <= credit.balancePending && totalUsd > 0 && <small>Saldo después del abono: ${(credit.balancePending - totalUsd).toFixed(2)}</small>}
    <label>Nota (opcional)<input type="text" maxLength={160} value={notes} onChange={event => setNotes(event.target.value)} /></label>
    {error && <p className="receivable-editor-error" role="alert">{error}</p>}
    <button type="submit" className="receivable-editor-submit" disabled={saving || !totalUsd || totalUsd > credit.balancePending || lineData.some(line => !line.draft.accountId || line.appliedUsd <= 0 || (line.requiresReference && !line.draft.reference.trim()) || (line.draft.method === 'cash' && (line.receivedUsd < line.appliedUsd || (line.changeUsd > 0 && (!line.draft.changeAccountId || (line.draft.changeCurrency === 'VES' && !bcv))) || (line.draft.receivedCurrency === 'VES' && !bcv))) || (line.selectedAccount?.currency === 'VES' && !bcv))}>{saving ? 'Registrando…' : 'Confirmar abono'}</button>
  </form>
}
