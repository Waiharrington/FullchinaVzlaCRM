import { describe, expect, it } from 'vitest'
import { dateKeyInTimeZone, dayRangeInTimeZone, usdToVes } from './money'

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
