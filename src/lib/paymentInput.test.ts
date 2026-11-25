import { describe, expect, it } from 'vitest'
import { paymentInputToUsd, paymentReferenceLabel, requiresPaymentReference, usdToPaymentInput, usesBolivares } from './paymentInput'

describe('paymentInput', () => {
  it('detecta métodos en bolívares; el efectivo depende de la moneda', () => {
    expect(usesBolivares('mobile')).toBe(true)
    expect(usesBolivares('card')).toBe(true)
    expect(usesBolivares('transfer')).toBe(true)
    expect(usesBolivares('binance')).toBe(false)
    expect(usesBolivares('cash')).toBe(false)
    expect(usesBolivares('cash', 'VES')).toBe(true)
  })

  it('solo el efectivo no exige referencia', () => {
    expect(requiresPaymentReference('cash')).toBe(false)
    expect(requiresPaymentReference('mobile')).toBe(true)
    expect(paymentReferenceLabel('card')).toContain('voucher')
    expect(paymentReferenceLabel('binance')).toContain('Binance')
    expect(paymentReferenceLabel('transfer')).toBe('Número de referencia *')
  })

  it('convierte a USD con la tasa y protege contra tasas inválidas', () => {
    expect(paymentInputToUsd('8000', 'mobile', 800)).toBe(10)
    expect(paymentInputToUsd('8000', 'mobile', null)).toBe(0)
    expect(paymentInputToUsd('10', 'binance', 800)).toBe(10)
    expect(paymentInputToUsd('abc', 'cash', 800)).toBe(0)
    expect(paymentInputToUsd('8000', 'cash', 800, 'VES')).toBe(10)
  })

  it('formatea USD al campo del método', () => {
    expect(usdToPaymentInput(10, 'mobile', 800)).toBe('8000.00')
    expect(usdToPaymentInput(10, 'cash', 800)).toBe('10.00')
    expect(usdToPaymentInput(10, 'cash', 800, 'VES')).toBe('8000.00')
    expect(usdToPaymentInput(10, 'mobile', null)).toBe('0.00')
  })
})
