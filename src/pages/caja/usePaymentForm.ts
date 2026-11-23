import { useState } from 'react'
import type { FinancialAccount, PersonalAccountOption } from '../../lib/dataService'
import { defaultPaymentForOrderType } from '../../lib/orderDefaults'
import { type ActivePaymentMethod, type SplitPaymentMethod } from './model'

/** Estado del formulario de cobro de Caja (método, referencias, cuentas, pago combinado). */
export function usePaymentForm() {
  const [selectedPaymentTab, setSelectedPaymentTab] = useState<ActivePaymentMethod | 'split'>(defaultPaymentForOrderType('dine-in'))
  const [refNumber, setRefNumber] = useState('')
  const [extraRefs, setExtraRefs] = useState<string[]>([])
  const [amountReceived, setAmountReceived] = useState('0.00')
  const [amountReceivedSecondary, setAmountReceivedSecondary] = useState('0.00')
  const [splitPrimaryCashReceived, setSplitPrimaryCashReceived] = useState('0.00')
  const [splitSecondaryCashReceived, setSplitSecondaryCashReceived] = useState('0.00')
  const [splitPrimaryMethod, setSplitPrimaryMethod] = useState<SplitPaymentMethod>('cash')
  const [splitSecondaryMethod, setSplitSecondaryMethod] = useState<SplitPaymentMethod>('mobile')
  const [splitPrimaryCashCurrency, setSplitPrimaryCashCurrency] = useState<'USD' | 'VES'>('USD')
  const [splitSecondaryCashCurrency, setSplitSecondaryCashCurrency] = useState<'USD' | 'VES'>('USD')
  const [splitPrimaryReference, setSplitPrimaryReference] = useState('')
  const [splitSecondaryReference, setSplitSecondaryReference] = useState('')
  const [splitPrimaryExtraRefs, setSplitPrimaryExtraRefs] = useState<string[]>([])
  const [splitSecondaryExtraRefs, setSplitSecondaryExtraRefs] = useState<string[]>([])
  const [paymentNote, setPaymentNote] = useState('')
  const [financialAccounts, setFinancialAccounts] = useState<FinancialAccount[]>([])
  const [personalAccounts, setPersonalAccounts] = useState<PersonalAccountOption[]>([])
  const [paymentAccountId, setPaymentAccountId] = useState('')
  const [paymentPersonalAccountId, setPaymentPersonalAccountId] = useState('')
  const [splitPrimaryAccountId, setSplitPrimaryAccountId] = useState('')
  const [splitSecondaryAccountId, setSplitSecondaryAccountId] = useState('')
  const [cashCurrency, setCashCurrency] = useState<'USD' | 'VES'>('USD')
  const [changeAccountId, setChangeAccountId] = useState('')

  return {
    selectedPaymentTab,
    setSelectedPaymentTab,
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
    splitPrimaryMethod,
    setSplitPrimaryMethod,
    splitSecondaryMethod,
    setSplitSecondaryMethod,
    splitPrimaryCashCurrency,
    setSplitPrimaryCashCurrency,
    splitSecondaryCashCurrency,
    setSplitSecondaryCashCurrency,
    splitPrimaryReference,
    setSplitPrimaryReference,
    splitSecondaryReference,
    setSplitSecondaryReference,
    splitPrimaryExtraRefs,
    setSplitPrimaryExtraRefs,
    splitSecondaryExtraRefs,
    setSplitSecondaryExtraRefs,
    paymentNote,
    setPaymentNote,
    financialAccounts,
    setFinancialAccounts,
    personalAccounts,
    setPersonalAccounts,
    paymentAccountId,
    setPaymentAccountId,
    paymentPersonalAccountId,
    setPaymentPersonalAccountId,
    splitPrimaryAccountId,
    setSplitPrimaryAccountId,
    splitSecondaryAccountId,
    setSplitSecondaryAccountId,
    cashCurrency,
    setCashCurrency,
    changeAccountId,
    setChangeAccountId,
  }
}
