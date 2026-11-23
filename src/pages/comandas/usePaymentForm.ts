import { useState } from 'react'
import type { FinancialAccount, PersonalAccountOption } from '../../lib/dataService'
import type { ActivePaymentMethod, SplitPaymentMethod } from './model'

/** Estado del formulario de cobro de una comanda (método, referencias, cuentas, pago combinado, crédito). */
export function usePaymentForm() {
  const [selectedPaymentTab, setSelectedPaymentTab] = useState<ActivePaymentMethod | 'split'>('cash')
  const [personalAccounts, setPersonalAccounts] = useState<PersonalAccountOption[]>([])
  const [paymentPersonalAccountId, setPaymentPersonalAccountId] = useState('')
  const [refNumber, setRefNumber] = useState('')
  const [extraRefs, setExtraRefs] = useState<string[]>([])
  const [amountReceived, setAmountReceived] = useState('')
  const [amountReceivedSecondary, setAmountReceivedSecondary] = useState('')
  const [splitPrimaryCashReceived, setSplitPrimaryCashReceived] = useState('')
  const [splitSecondaryCashReceived, setSplitSecondaryCashReceived] = useState('')
  const [splitPrimaryCashCurrency, setSplitPrimaryCashCurrency] = useState<'USD' | 'VES'>('USD')
  const [splitSecondaryCashCurrency, setSplitSecondaryCashCurrency] = useState<'USD' | 'VES'>('USD')
  const [splitPrimaryMethod, setSplitPrimaryMethod] = useState<SplitPaymentMethod>('cash')
  const [splitSecondaryMethod, setSplitSecondaryMethod] = useState<SplitPaymentMethod>('mobile')
  const [splitPrimaryReference, setSplitPrimaryReference] = useState('')
  const [splitSecondaryReference, setSplitSecondaryReference] = useState('')
  const [paymentNote, setPaymentNote] = useState('')
  const [paymentError, setPaymentError] = useState('')
  const [creditAuthorizationPin, setCreditAuthorizationPin] = useState('')
  const [paying, setPaying] = useState(false)
  const [cashCurrency, setCashCurrency] = useState<'USD' | 'VES'>('USD')
  const [financialAccounts, setFinancialAccounts] = useState<FinancialAccount[]>([])
  const [changeAccountId, setChangeAccountId] = useState('')

  return {
    selectedPaymentTab,
    setSelectedPaymentTab,
    personalAccounts,
    setPersonalAccounts,
    paymentPersonalAccountId,
    setPaymentPersonalAccountId,
    refNumber,
    setRefNumber,
    extraRefs,
    setExtraRefs,
    amountReceived,
    setAmountReceived,
    amountReceivedSecondary,
    setAmountReceivedSecondary,
    splitPrimaryCashReceived,
    setSplitPrimaryCashReceived,
    splitSecondaryCashReceived,
    setSplitSecondaryCashReceived,
    splitPrimaryCashCurrency,
    setSplitPrimaryCashCurrency,
    splitSecondaryCashCurrency,
    setSplitSecondaryCashCurrency,
    splitPrimaryMethod,
    setSplitPrimaryMethod,
    splitSecondaryMethod,
    setSplitSecondaryMethod,
    splitPrimaryReference,
    setSplitPrimaryReference,
    splitSecondaryReference,
    setSplitSecondaryReference,
    paymentNote,
    setPaymentNote,
    paymentError,
    setPaymentError,
    creditAuthorizationPin,
    setCreditAuthorizationPin,
    paying,
    setPaying,
    cashCurrency,
    setCashCurrency,
    financialAccounts,
    setFinancialAccounts,
    changeAccountId,
    setChangeAccountId,
  }
}
