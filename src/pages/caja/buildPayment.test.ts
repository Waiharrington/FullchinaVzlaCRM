import { describe, expect, it } from 'vitest'
import type { FinancialAccount, PersonalAccountOption } from '../../lib/dataService'
import { buildPayment, type BuildPaymentInput, type SplitLeg } from './buildPayment'

const account = (id: string, currency: 'USD' | 'VES'): FinancialAccount => ({ id, currency } as FinancialAccount)

const leg = (over: Partial<SplitLeg> = {}): SplitLeg => ({
  method: 'cash',
  accountId: 'acc-usd',
  reference: '',
  extraRefs: [],
  cashReceived: '',
  cashCurrency: 'USD',
  ...over,
})

const base = (over: Partial<BuildPaymentInput> = {}): BuildPaymentInput => ({
  tab: 'cash',
  total: 22,
  bcvRate: 800,
  amountReceived: '25',
  cashCurrency: 'USD',
  refNumber: '',
  extraRefs: [],
  paymentAccountId: 'acc-usd',
  paymentPersonalAccountId: '',
  personalAccounts: [],
  changeAccountId: 'acc-usd',
  financialAccounts: [account('acc-usd', 'USD'), account('acc-ves', 'VES')],
  paymentNote: '',
  splitPrimaryAmountUsd: 0,
  splitPrimary: leg(),
  splitSecondary: leg({ method: 'mobile', accountId: 'acc-ves' }),
  ...over,
})

describe('buildPayment · pago simple', () => {
  it('efectivo en USD calcula el vuelto', () => {
    const r = buildPayment(base())
    expect(r.finalMethod).toBe('cash')
    expect(r.payments).toHaveLength(1)
    expect(r.payments[0]).toMatchObject({
      method: 'cash', amount: 22, receivedAmount: 25, receivedCurrency: 'USD',
      changeAmount: 3, changeCurrency: 'USD', changeAccountId: 'acc-usd',
    })
    expect(r.enteredAmountUsd).toBe(25)
  })

  it('efectivo en bolívares convierte con la tasa BCV', () => {
    const r = buildPayment(base({ amountReceived: '20000', cashCurrency: 'VES' }))
    expect(r.enteredAmountUsd).toBe(25)
    expect(r.payments[0]).toMatchObject({ receivedAmount: 20000, receivedCurrency: 'VES', receivedExchangeRate: 800, changeAmount: 3 })
  })

  it('vuelto entregado desde una cuenta en bolívares queda en VES', () => {
    const r = buildPayment(base({ changeAccountId: 'acc-ves' }))
    expect(r.payments[0]).toMatchObject({ changeAmount: 2400, changeCurrency: 'VES', changeExchangeRate: 800 })
  })

  it('rechaza efectivo que no cubre el total', () => {
    expect(() => buildPayment(base({ amountReceived: '21.99' }))).toThrow('El efectivo recibido no cubre el total')
  })

  it('acepta el efectivo exacto sin vuelto ni cuenta de vuelto', () => {
    const r = buildPayment(base({ amountReceived: '22', changeAccountId: '' }))
    expect(r.payments[0].changeAccountId).toBeUndefined()
  })

  it('exige cuenta de vuelto cuando hay vuelto', () => {
    expect(() => buildPayment(base({ changeAccountId: '' }))).toThrow('cuenta de origen de donde saldrá el vuelto')
  })

  it('rechaza monto inválido', () => {
    expect(() => buildPayment(base({ amountReceived: '' }))).toThrow('Ingresa un monto válido')
    expect(() => buildPayment(base({ amountReceived: '0' }))).toThrow('Ingresa un monto válido')
  })

  it('exige referencia en métodos distintos de efectivo', () => {
    expect(() => buildPayment(base({ tab: 'mobile', amountReceived: '22' }))).toThrow('La referencia es obligatoria')
    const r = buildPayment(base({ tab: 'mobile', amountReceived: '22', refNumber: ' 123 ', extraRefs: ['456', ' '] }))
    expect(r.payments[0].referenceNumber).toBe('123, 456')
    expect(r.payments[0].receivedAmount).toBeUndefined()
  })

  it('exige la cuenta donde ingresó el dinero', () => {
    expect(() => buildPayment(base({ paymentAccountId: '' }))).toThrow('Selecciona la cuenta donde ingresó el dinero')
  })

  it('cuenta personal exige una cuenta activa y no usa cuenta financiera', () => {
    const personal = [{ id: 'p1', isActive: true }, { id: 'p2', isActive: false }] as PersonalAccountOption[]
    expect(() => buildPayment(base({ tab: 'personal_account', personalAccounts: personal, paymentPersonalAccountId: 'p2' })))
      .toThrow('Selecciona una cuenta personal activa')
    const r = buildPayment(base({ tab: 'personal_account', personalAccounts: personal, paymentPersonalAccountId: 'p1', paymentAccountId: '' }))
    expect(r.payments[0]).toMatchObject({ method: 'personal_account', accountId: null, personalAccountId: 'p1' })
  })
})

describe('buildPayment · pago combinado', () => {
  const split = (over: Partial<BuildPaymentInput> = {}) => base({
    tab: 'split',
    amountReceived: '22',
    splitPrimaryAmountUsd: 10,
    splitPrimary: leg({ cashReceived: '10' }),
    splitSecondary: leg({ method: 'mobile', accountId: 'acc-ves', reference: 'REF9' }),
    ...over,
  })

  it('divide el total en dos componentes que suman el total', () => {
    const r = buildPayment(split())
    expect(r.finalMethod).toBe('other')
    expect(r.payments.map(p => p.amount)).toEqual([10, 12])
    expect(r.payments[0]).toMatchObject({ method: 'cash', receivedAmount: 10, changeAmount: 0 })
    expect(r.payments[1]).toMatchObject({ method: 'mobile', referenceNumber: 'REF9' })
  })

  it('no pierde centavos con montos decimales', () => {
    const r = buildPayment(split({ total: 10.1, splitPrimaryAmountUsd: 3.37 }))
    expect(r.payments[0].amount + r.payments[1].amount).toBeCloseTo(10.1, 10)
  })

  it('rechaza montos en cero o iguales al total', () => {
    expect(() => buildPayment(split({ splitPrimaryAmountUsd: 0 }))).toThrow('dos montos mayores a cero')
    expect(() => buildPayment(split({ splitPrimaryAmountUsd: 22 }))).toThrow('dos montos mayores a cero')
  })

  it('rechaza el mismo método dos veces', () => {
    expect(() => buildPayment(split({ splitSecondary: leg({ method: 'cash', accountId: 'acc-usd' }) })))
      .toThrow('dos métodos de pago diferentes')
  })

  it('exige referencia por cada método que la requiere', () => {
    expect(() => buildPayment(split({ splitSecondary: leg({ method: 'mobile', accountId: 'acc-ves' }) })))
      .toThrow('referencia del segundo método')
    expect(() => buildPayment(split({
      splitPrimary: leg({ method: 'card', accountId: 'acc-ves' }),
      splitSecondary: leg({ method: 'cash' }),
    }))).toThrow('referencia del primer método')
  })

  it('exige cuenta en cada método', () => {
    expect(() => buildPayment(split({ splitPrimary: leg({ accountId: '' }) }))).toThrow('cuenta de cada método')
  })

  it('efectivo en bolívares dentro de un pago combinado guarda la tasa', () => {
    const r = buildPayment(split({ splitPrimary: leg({ cashReceived: '8000', cashCurrency: 'VES' }) }))
    expect(r.payments[0]).toMatchObject({ receivedAmount: 8000, receivedCurrency: 'VES', receivedExchangeRate: 800, changeAmount: 0 })
  })
})
