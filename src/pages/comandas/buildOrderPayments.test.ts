import { describe, expect, it } from 'vitest'
import { calculateCashChange } from '../../lib/money'
import type { FinancialAccount, PersonalAccountOption } from '../../lib/dataService'
import { buildOrderPayments, type OrderPaymentFormState } from './buildOrderPayments'
import type { ComandaOrder } from './model'

const acc = (id: string, currency: 'USD' | 'VES'): FinancialAccount =>
  ({ id, currency, isActive: true, accountType: 'cash' } as FinancialAccount)

const order = (totalAmount = 22) => ({ id: 'o1', totalAmount, balanceDue: totalAmount } as unknown as ComandaOrder)

const base = (over: Partial<OrderPaymentFormState> = {}): OrderPaymentFormState => {
  const financialAccounts = [acc('usd', 'USD'), acc('ves', 'VES')]
  const state: OrderPaymentFormState = {
    paymentOrder: order(),
    selectedPaymentTab: 'cash',
    amountReceived: '25',
    cashCurrency: 'USD',
    paymentRate: 800,
    refNumber: '',
    extraRefs: [],
    splitPrimaryAmountUsd: 0,
    splitPrimaryMethod: 'cash',
    splitSecondaryMethod: 'mobile',
    splitPrimaryReference: '',
    splitSecondaryReference: '',
    splitPrimaryCashReceived: '',
    splitSecondaryCashReceived: '',
    splitPrimaryCashCurrency: 'USD',
    splitSecondaryCashCurrency: 'USD',
    paymentAccountId: 'usd',
    splitPrimaryAccountId: 'usd',
    splitSecondaryAccountId: 'ves',
    changeAccount: financialAccounts[0],
    changeAccountId: 'usd',
    cashChange: calculateCashChange(25, 22, 'USD', 800, 'USD'),
    personalAccounts: [],
    paymentPersonalAccountId: '',
    paymentNote: '',
    ...over,
  }
  return state
}

describe('buildOrderPayments', () => {
  it('efectivo USD con vuelto', () => {
    const { payments } = buildOrderPayments(base())
    expect(payments).toHaveLength(1)
    expect(payments[0]).toMatchObject({
      method: 'cash', amount: 22, receivedAmount: 25, receivedCurrency: 'USD',
      changeAmount: 3, changeAccountId: 'usd', accountId: 'usd',
    })
  })

  it('efectivo en bolívares usa la tasa de la comanda', () => {
    const { payments } = buildOrderPayments(base({
      amountReceived: '20000', cashCurrency: 'VES',
      cashChange: calculateCashChange(20000, 22, 'VES', 800, 'USD'), paymentAccountId: 'ves',
    }))
    expect(payments[0]).toMatchObject({ receivedAmount: 20000, receivedCurrency: 'VES', receivedExchangeRate: 800, accountId: 'ves' })
  })

  it('rechaza efectivo insuficiente, monto inválido y comanda sin total', () => {
    expect(() => buildOrderPayments(base({ amountReceived: '21' }))).toThrow('El efectivo recibido no cubre el total')
    expect(() => buildOrderPayments(base({ amountReceived: '' }))).toThrow('Ingresa un monto válido')
    expect(() => buildOrderPayments(base({ paymentOrder: order(0) }))).toThrow('no tiene un total cobrable')
  })

  it('exige referencia fuera de efectivo', () => {
    expect(() => buildOrderPayments(base({ selectedPaymentTab: 'mobile', amountReceived: '22' })))
      .toThrow('La referencia es obligatoria')
    const { payments } = buildOrderPayments(base({ selectedPaymentTab: 'mobile', amountReceived: '22', refNumber: 'A1', extraRefs: ['B2'] }))
    expect(payments[0].referenceNumber).toBe('A1, B2')
  })

  it('exige cuenta de vuelto si hay vuelto', () => {
    expect(() => buildOrderPayments(base({ changeAccountId: '' }))).toThrow('cuenta de origen de donde saldrá el vuelto')
  })

  it('cuenta personal exige una cuenta activa', () => {
    const personal = [{ id: 'p1', isActive: false }] as unknown as PersonalAccountOption[]
    expect(() => buildOrderPayments(base({
      selectedPaymentTab: 'personal_account', amountReceived: '22', personalAccounts: personal, paymentPersonalAccountId: 'p1',
    }))).toThrow('Selecciona una cuenta personal activa')
  })

  it('pago combinado reparte el total y valida métodos y referencias', () => {
    const split = (over: Partial<OrderPaymentFormState> = {}) => base({
      selectedPaymentTab: 'split', splitPrimaryAmountUsd: 10, splitPrimaryCashReceived: '10',
      splitSecondaryReference: 'R9', changeAccountId: '', ...over,
    })
    const { payments } = buildOrderPayments(split())
    expect(payments.map(p => p.amount)).toEqual([10, 12])
    expect(payments[1]).toMatchObject({ method: 'mobile', referenceNumber: 'R9' })
    expect(() => buildOrderPayments(split({ splitPrimaryAmountUsd: 22 }))).toThrow('dos montos mayores a cero')
    expect(() => buildOrderPayments(split({ splitSecondaryMethod: 'cash' }))).toThrow('dos métodos de pago diferentes')
    expect(() => buildOrderPayments(split({ splitSecondaryReference: '' }))).toThrow('referencia del segundo método')
  })

  it('exige la cuenta destino en cualquier método', () => {
    expect(() => buildOrderPayments(base({ paymentAccountId: '' }))).toThrow(/cuenta donde ingresa/i)
    expect(() => buildOrderPayments(base({ selectedPaymentTab: 'mobile', refNumber: '123', paymentAccountId: '' }))).toThrow(/cuenta donde ingresa/i)
  })

  it('envía la cuenta elegida en pagos no efectivo', () => {
    const { payments } = buildOrderPayments(base({ selectedPaymentTab: 'mobile', amountReceived: '17600', refNumber: '123', paymentAccountId: 'ves' }))
    expect(payments[0]).toMatchObject({ method: 'mobile', accountId: 'ves' })
  })

  it('el pago combinado exige las dos cuentas', () => {
    expect(() => buildOrderPayments(base({ selectedPaymentTab: 'split', splitPrimaryAmountUsd: 10, splitSecondaryAccountId: '' }))).toThrow(/cuenta/i)
  })
})
