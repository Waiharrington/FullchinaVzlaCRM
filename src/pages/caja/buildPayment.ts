import { calculateCashChange, parseMoneyInput } from '../../lib/money'
import type { FinancialAccount, OrderPaymentComponent, PaymentMethod, PersonalAccountOption } from '../../lib/dataService'
import { requiresPaymentReference } from './model'

type Currency = 'USD' | 'VES'
type SplitMethod = Exclude<PaymentMethod, 'zelle' | 'other' | 'personal_account'>

export interface SplitLeg {
  method: SplitMethod
  accountId: string
  reference: string
  extraRefs: string[]
  cashReceived: string
  cashCurrency: Currency
}

export interface BuildPaymentInput {
  tab: SplitMethod | 'split' | 'other' | 'personal_account'
  total: number
  bcvRate: number | null
  amountReceived: string
  cashCurrency: Currency
  refNumber: string
  extraRefs: string[]
  paymentAccountId: string
  paymentPersonalAccountId: string
  personalAccounts: PersonalAccountOption[]
  changeAccountId: string
  financialAccounts: FinancialAccount[]
  paymentNote: string
  splitPrimaryAmountUsd: number
  splitPrimary: SplitLeg
  splitSecondary: SplitLeg
}

export interface BuiltPayment {
  finalMethod: PaymentMethod
  payments: OrderPaymentComponent[]
  combinedRefs: string
  /** Monto recibido en USD (null no aplica) para el campo receivedAmount del pedido. */
  enteredAmountUsd: number
}

const joinRefs = (refs: string[]) => refs.map(r => r.trim()).filter(Boolean).join(', ')

function buildSplitLeg(leg: SplitLeg, amount: number, input: BuildPaymentInput): OrderPaymentComponent {
  const isCash = leg.method === 'cash'
  const received = parseMoneyInput(leg.cashReceived)
  const changeAccountCurrency = input.financialAccounts.find(a => a.id === input.changeAccountId)?.currency
  const change = isCash
    ? calculateCashChange(received, amount, leg.cashCurrency, input.bcvRate, changeAccountCurrency ?? leg.cashCurrency)
    : undefined
  const changeInTender = isCash ? calculateCashChange(received, amount, leg.cashCurrency, input.bcvRate) : undefined
  return {
    method: leg.method,
    amount,
    referenceNumber: joinRefs([leg.reference, ...leg.extraRefs]) || undefined,
    accountId: leg.accountId || null,
    receivedAmount: isCash ? received : undefined,
    receivedCurrency: isCash ? leg.cashCurrency : undefined,
    receivedExchangeRate: isCash && leg.cashCurrency === 'VES' ? input.bcvRate : undefined,
    changeAmount: isCash ? change?.amount : undefined,
    changeCurrency: isCash ? changeAccountCurrency ?? leg.cashCurrency : undefined,
    changeAccountId: isCash && (changeInTender?.amountUsd ?? 0) > 0 ? input.changeAccountId : undefined,
    changeExchangeRate: isCash && changeAccountCurrency === 'VES' ? input.bcvRate : undefined,
    notes: input.paymentNote || undefined,
  }
}

/**
 * Valida el formulario de cobro y construye los componentes de pago que recibe
 * `checkout`. Lanza Error con el mensaje que se muestra al cajero.
 */
export function buildPayment(input: BuildPaymentInput): BuiltPayment {
  const { tab, total, bcvRate } = input

  const enteredAmountRaw = parseMoneyInput(input.amountReceived)
  if (!Number.isFinite(enteredAmountRaw) || enteredAmountRaw <= 0) {
    throw new Error('Ingresa un monto válido')
  }
  const enteredAmountUsd = (tab === 'cash' && input.cashCurrency === 'VES' && bcvRate && bcvRate > 0)
    ? enteredAmountRaw / bcvRate
    : enteredAmountRaw

  const requiresReference = tab !== 'split' && tab !== 'personal_account' && tab !== 'other'
    && requiresPaymentReference(tab)
  if (requiresReference && !input.refNumber.trim()) {
    throw new Error('La referencia es obligatoria para este método')
  }
  if (tab !== 'split' && tab !== 'other' && tab !== 'personal_account' && !input.paymentAccountId) {
    throw new Error('Selecciona la cuenta donde ingresó el dinero')
  }
  if (tab === 'personal_account'
    && !input.personalAccounts.some(account => account.id === input.paymentPersonalAccountId && account.isActive)) {
    throw new Error('Selecciona una cuenta personal activa')
  }
  const combinedRefs = joinRefs([input.refNumber, ...input.extraRefs])

  let payments: OrderPaymentComponent[]
  let finalMethod: PaymentMethod
  if (tab === 'split') {
    const { splitPrimary: primary, splitSecondary: secondary } = input
    const totalCents = Math.round(total * 100)
    const primaryCents = Math.round(input.splitPrimaryAmountUsd * 100)
    const primaryAmount = primaryCents / 100
    const secondaryAmount = (totalCents - primaryCents) / 100
    if (primaryAmount <= 0 || secondaryAmount <= 0) {
      throw new Error('El pago combinado necesita dos montos mayores a cero')
    }
    if (primary.method === secondary.method) {
      throw new Error('Selecciona dos métodos de pago diferentes')
    }
    if (requiresPaymentReference(primary.method) && !primary.reference.trim()) {
      throw new Error('Ingresa la referencia del primer método')
    }
    if (requiresPaymentReference(secondary.method) && !secondary.reference.trim()) {
      throw new Error('Ingresa la referencia del segundo método')
    }
    if (!primary.accountId || !secondary.accountId) {
      throw new Error('Selecciona la cuenta de cada método de pago')
    }
    finalMethod = 'other'
    payments = [buildSplitLeg(primary, primaryAmount, input), buildSplitLeg(secondary, secondaryAmount, input)]
  } else {
    // Comparar en centavos, como NUMERIC(12,2) del RPC de pagos. Con efectivo en
    // bolívares, dividir un monto VES redondeado entre la tasa puede dar un USD
    // una fracción de centavo por debajo del total exacto.
    const enteredCents = Math.round((enteredAmountUsd + Number.EPSILON) * 100)
    const totalCents = Math.round((total + Number.EPSILON) * 100)
    if (tab === 'cash' && enteredCents < totalCents) {
      throw new Error('El efectivo recibido no cubre el total')
    }
    const changeAccount = input.financialAccounts.find(account => account.id === input.changeAccountId)
    const change = calculateCashChange(enteredAmountRaw, total, input.cashCurrency, bcvRate, changeAccount?.currency ?? input.cashCurrency)
    const cashChangeUsd = change?.amountUsd ?? 0
    finalMethod = tab
    payments = [{
      method: tab,
      amount: total,
      referenceNumber: combinedRefs || undefined,
      accountId: tab === 'personal_account' ? null : input.paymentAccountId || null,
      personalAccountId: tab === 'personal_account' ? input.paymentPersonalAccountId : null,
      receivedAmount: tab === 'cash' ? enteredAmountRaw : undefined,
      receivedCurrency: tab === 'cash' ? input.cashCurrency : undefined,
      receivedExchangeRate: tab === 'cash' && input.cashCurrency === 'VES' ? bcvRate : undefined,
      changeAmount: tab === 'cash' ? change?.amount : undefined,
      changeCurrency: tab === 'cash' ? change?.currency : undefined,
      changeAccountId: tab === 'cash' && cashChangeUsd > 0 ? input.changeAccountId : undefined,
      changeExchangeRate: tab === 'cash' && changeAccount?.currency === 'VES' ? bcvRate : undefined,
      notes: input.paymentNote || undefined,
    }]
  }

  if (payments.some(payment => (payment.changeAmount ?? 0) > 0) && !input.changeAccountId) {
    throw new Error('Selecciona la cuenta de origen de donde saldrá el vuelto')
  }

  return { finalMethod, payments, combinedRefs, enteredAmountUsd }
}
