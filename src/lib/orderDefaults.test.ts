import { describe, expect, it } from 'vitest'
import { defaultPaymentForOrderType } from './orderDefaults'

describe('defaultPaymentForOrderType', () => {
  it('sugiere punto para mesa', () => {
    expect(defaultPaymentForOrderType('dine-in')).toBe('card')
  })

  it('sugiere pago móvil para pedidos remotos', () => {
    expect(defaultPaymentForOrderType('takeaway')).toBe('mobile')
    expect(defaultPaymentForOrderType('delivery')).toBe('mobile')
  })
})
