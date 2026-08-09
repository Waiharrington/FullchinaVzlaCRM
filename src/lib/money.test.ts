import { describe, expect, it } from 'vitest'
import { usdToVes } from './money'

describe('usdToVes', () => {
  it('convierte USD usando la tasa BCV completa', () => {
    expect(usdToVes(8, 756.7083)).toBeCloseTo(6053.6664, 4)
  })

  it('no inventa una referencia cuando la tasa no está disponible', () => {
    expect(usdToVes(8, null)).toBeNull()
    expect(usdToVes(8, 0)).toBeNull()
  })
})
