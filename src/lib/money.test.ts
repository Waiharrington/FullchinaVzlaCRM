import { describe, expect, it } from 'vitest'
import { calculateCashChange, dateKeyInTimeZone, dayRangeInTimeZone, parseMoneyInput, usdToVes } from './money'

describe('cash change', () => {
  it('calcula vuelto en USD y permite entregarlo desde cuenta en bolívares', () => {
    expect(calculateCashChange(25, 22, 'USD', 800, 'VES')).toEqual({ amount: 2400, currency: 'VES', amountUsd: 3 })
  })

  it('convierte efectivo recibido en bolívares y redondea a centavos', () => {
    expect(calculateCashChange(20000, 22, 'VES', 800, 'USD')).toEqual({ amount: 3, currency: 'USD', amountUsd: 3 })
  })

  it('no calcula un vuelto en bolívares sin una tasa válida', () => {
    expect(calculateCashChange(25, 22, 'USD', null, 'VES')).toBeNull()
    expect(calculateCashChange(20000, 22, 'VES', 0, 'USD')).toBeNull()
  })

  it('redondea el efectivo recibido a la precisión de la base de datos', () => {
    expect(calculateCashChange(25.004, 22, 'USD', null)?.amount).toBe(3)
    expect(calculateCashChange(25.005, 22, 'USD', null)?.amount).toBe(3.01)
  })

  it('acepta coma decimal y miles en el monto recibido', () => {
    expect(parseMoneyInput('25,50')).toBe(25.5)
    expect(parseMoneyInput('1.250,50')).toBe(1250.5)
  })
})

describe('usdToVes', () => {
  it('convierte USD usando la tasa BCV completa', () => {
    expect(usdToVes(8, 756.7083)).toBeCloseTo(6053.6664, 4)
  })

  it('no inventa una referencia cuando la tasa no está disponible', () => {
    expect(usdToVes(8, null)).toBeNull()
    expect(usdToVes(8, 0)).toBeNull()
  })
})

describe('dateKeyInTimeZone', () => {
  it('mantiene la fecha operativa de Venezuela cuando UTC ya cambió de día', () => {
    expect(dateKeyInTimeZone(new Date('2026-08-13T01:00:00Z'))).toBe('2026-08-12')
  })

  it('genera límites con offset de Caracas para consultas de pedidos', () => {
    expect(dayRangeInTimeZone(new Date('2026-08-13T01:00:00Z'))).toEqual({
      start: '2026-08-12T00:00:00-04:00',
      end: '2026-08-13T00:00:00-04:00',
    })
  })
})
