import { calculateCashChange, parseMoneyInput } from '../../lib/money'
import type { FinancialAccount, PaymentMethod, PersonalAccountOption } from '../../lib/dataService'
import { requiresPaymentReference, type ActivePaymentMethod, type ComandaOrder, type SplitPaymentMethod } from './model'

export interface OrderPaymentFormState {
  paymentOrder: ComandaOrder
  selectedPaymentTab: Exclude<ActivePaymentMethod | 'split', 'credit'>
  amountReceived: string
  cashCurrency: 'USD' | 'VES'
  paymentRate: number | null | undefined
  refNumber: string
  extraRefs: string[]
  splitPrimaryAmountUsd: number
  splitPrimaryMethod: SplitPaymentMethod
  splitSecondaryMethod: SplitPaymentMethod
  splitPrimaryReference: string
  splitSecondaryReference: string
  splitPrimaryCashReceived: string
  splitSecondaryCashReceived: string
  splitPrimaryCashCurrency: 'USD' | 'VES'
  splitSecondaryCashCurrency: 'USD' | 'VES'
  changeAccount: FinancialAccount | undefined
  changeAccountId: string
  cashChange: ReturnType<typeof calculateCashChange>
  personalAccounts: PersonalAccountOption[]
  paymentPersonalAccountId: string
  paymentNote: string
  paymentAccountId: string
  splitPrimaryAccountId: string
  splitSecondaryAccountId: string
}

/**
 * Valida el formulario de cobro de una comanda y arma los pagos para
 * `recordOrderPayments`. Lanza Error con el mensaje que ve el cajero.
 * (El pago a crédito se resuelve antes, en el componente.)
 */
export function buildOrderPayments(state: OrderPaymentFormState) {
  const { paymentOrder, selectedPaymentTab, amountReceived, cashCurrency, paymentRate, refNumber, extraRefs, splitPrimaryAmountUsd, splitPrimaryMethod, splitSecondaryMethod, splitPrimaryReference, splitSecondaryReference, splitPrimaryCashReceived, splitSecondaryCashReceived, splitPrimaryCashCurrency, splitSecondaryCashCurrency, changeAccount, changeAccountId, cashChange, personalAccounts, paymentPersonalAccountId, paymentNote, paymentAccountId, splitPrimaryAccountId, splitSecondaryAccountId } = state
        const total = Number(paymentOrder.balanceDue ?? paymentOrder.totalAmount ?? 0)
        const enteredAmountRaw = parseMoneyInput(amountReceived)
        let enteredAmount = enteredAmountRaw
        if (total <= 0) throw new Error('La comanda no tiene un total cobrable')
        if (!Number.isFinite(enteredAmount) || enteredAmount <= 0) {
          throw new Error('Ingresa un monto válido')
        }
        if (selectedPaymentTab === 'cash' && cashCurrency === 'VES') {
          enteredAmount = paymentRate && paymentRate > 0 ? enteredAmount / paymentRate : 0
        }

        const requiresReference = selectedPaymentTab !== 'split' && selectedPaymentTab !== 'personal_account' && requiresPaymentReference(selectedPaymentTab)
        if (requiresReference && !refNumber.trim()) {
          throw new Error('La referencia es obligatoria para este método')
        }

        if (selectedPaymentTab !== 'split' && selectedPaymentTab !== 'personal_account' && !paymentAccountId) {
          throw new Error('Selecciona la cuenta donde ingresa el dinero')
        }

        let payments: Array<{
          method: PaymentMethod
          amount: number
          personalAccountId?: string
          referenceNumber?: string
          receivedAmount?: number
          receivedCurrency?: 'USD' | 'VES'
          receivedExchangeRate?: number
          changeAmount?: number
          changeCurrency?: 'USD' | 'VES'
          changeAccountId?: string
          changeExchangeRate?: number
          accountId?: string
          notes?: string
        }>

        if (selectedPaymentTab === 'split') {
          const primaryAmount = Math.round(splitPrimaryAmountUsd * 100) / 100
          const secondaryAmount = Math.round((total - primaryAmount) * 100) / 100
          if (!splitPrimaryAccountId || !splitSecondaryAccountId) {
            throw new Error('Selecciona la cuenta donde ingresa cada pago')
          }
          if (primaryAmount <= 0 || secondaryAmount <= 0) {
            throw new Error('El pago combinado necesita dos montos mayores a cero')
          }
          if (splitPrimaryMethod === splitSecondaryMethod) {
            throw new Error('Selecciona dos métodos de pago diferentes')
          }
          if (requiresPaymentReference(splitPrimaryMethod) && !splitPrimaryReference.trim()) {
            throw new Error('Ingresa la referencia del primer método')
          }
          if (requiresPaymentReference(splitSecondaryMethod) && !splitSecondaryReference.trim()) {
            throw new Error('Ingresa la referencia del segundo método')
          }
          payments = [
            {
              method: splitPrimaryMethod,
              amount: primaryAmount,
              referenceNumber: splitPrimaryReference.trim() || undefined,
              receivedAmount: splitPrimaryMethod === 'cash' ? parseMoneyInput(splitPrimaryCashReceived) : undefined,
              receivedCurrency: splitPrimaryMethod === 'cash' ? splitPrimaryCashCurrency : undefined,
              receivedExchangeRate: splitPrimaryMethod === 'cash' && splitPrimaryCashCurrency === 'VES' ? paymentRate ?? undefined : undefined,
              accountId: splitPrimaryAccountId,
              changeAmount: splitPrimaryMethod === 'cash' ? calculateCashChange(parseMoneyInput(splitPrimaryCashReceived), primaryAmount, splitPrimaryCashCurrency, paymentRate, changeAccount?.currency ?? splitPrimaryCashCurrency)?.amount : undefined,
              changeCurrency: splitPrimaryMethod === 'cash' ? changeAccount?.currency ?? splitPrimaryCashCurrency : undefined,
              changeAccountId: splitPrimaryMethod === 'cash' && (calculateCashChange(parseMoneyInput(splitPrimaryCashReceived), primaryAmount, splitPrimaryCashCurrency, paymentRate)?.amountUsd ?? 0) > 0 ? changeAccountId : undefined,
              changeExchangeRate: splitPrimaryMethod === 'cash' && changeAccount?.currency === 'VES' ? paymentRate ?? undefined : undefined,
              notes: paymentNote || undefined,
            },
            {
              method: splitSecondaryMethod,
              amount: secondaryAmount,
              referenceNumber: splitSecondaryReference.trim() || undefined,
              receivedAmount: splitSecondaryMethod === 'cash' ? parseMoneyInput(splitSecondaryCashReceived) : undefined,
              receivedCurrency: splitSecondaryMethod === 'cash' ? splitSecondaryCashCurrency : undefined,
              receivedExchangeRate: splitSecondaryMethod === 'cash' && splitSecondaryCashCurrency === 'VES' ? paymentRate ?? undefined : undefined,
              accountId: splitSecondaryAccountId,
              changeAmount: splitSecondaryMethod === 'cash' ? calculateCashChange(parseMoneyInput(splitSecondaryCashReceived), secondaryAmount, splitSecondaryCashCurrency, paymentRate, changeAccount?.currency ?? splitSecondaryCashCurrency)?.amount : undefined,
              changeCurrency: splitSecondaryMethod === 'cash' ? changeAccount?.currency ?? splitSecondaryCashCurrency : undefined,
              changeAccountId: splitSecondaryMethod === 'cash' && (calculateCashChange(parseMoneyInput(splitSecondaryCashReceived), secondaryAmount, splitSecondaryCashCurrency, paymentRate)?.amountUsd ?? 0) > 0 ? changeAccountId : undefined,
              changeExchangeRate: splitSecondaryMethod === 'cash' && changeAccount?.currency === 'VES' ? paymentRate ?? undefined : undefined,
              notes: paymentNote || undefined,
            },
          ]
        } else {
          // Keep the frontend guard at the same 2-decimal precision as the
          // payment RPC; converting an exact VES amount to USD can leave a
          // fractional-cent difference from the BCV division.
          const enteredCents = Math.round((enteredAmount + Number.EPSILON) * 100)
          const totalCents = Math.round((total + Number.EPSILON) * 100)
          if (selectedPaymentTab === 'cash' && enteredCents < totalCents) {
            throw new Error('El efectivo recibido no cubre el total')
          }
          const allRefs = [refNumber, ...extraRefs].map(r => r.trim()).filter(Boolean).join(', ')
          payments = [{
            method: selectedPaymentTab,
            amount: total,
            personalAccountId: selectedPaymentTab === 'personal_account' ? paymentPersonalAccountId : undefined,
            referenceNumber: allRefs || undefined,
            receivedAmount: selectedPaymentTab === 'cash' ? enteredAmountRaw : undefined,
            receivedCurrency: selectedPaymentTab === 'cash' ? cashCurrency : undefined,
            receivedExchangeRate: selectedPaymentTab === 'cash' && cashCurrency === 'VES' ? paymentRate ?? undefined : undefined,
            changeAmount: selectedPaymentTab === 'cash' ? cashChange?.amount : undefined,
            changeCurrency: selectedPaymentTab === 'cash' ? cashChange?.currency : undefined,
            changeAccountId: selectedPaymentTab === 'cash' && (cashChange?.amount ?? 0) > 0 ? changeAccountId : undefined,
            changeExchangeRate: selectedPaymentTab === 'cash' && changeAccount?.currency === 'VES' ? paymentRate ?? undefined : undefined,
            accountId: selectedPaymentTab === 'personal_account' ? undefined : paymentAccountId,
            notes: paymentNote || undefined,
          }]
        }

        if (payments.some(payment => (payment.changeAmount ?? 0) > 0) && !changeAccountId) {
          throw new Error('Selecciona la cuenta de origen de donde saldrá el vuelto')
        }

        if (selectedPaymentTab === 'personal_account' && !personalAccounts.some(account => account.id === paymentPersonalAccountId && account.isActive)) {
          throw new Error('Selecciona una cuenta personal activa')
        }


  return { payments }
}
