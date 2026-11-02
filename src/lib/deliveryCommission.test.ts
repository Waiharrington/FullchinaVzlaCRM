import { describe, expect, it } from 'vitest'
import { deliveryCommissionCost } from './deliveryCommission'

describe('comisión histórica de delivery en Finanzas', () => {
  it('usa el importe asignado a cada comanda, incluso si fue 0 % o 100 %', () => {
    expect(deliveryCommissionCost(10, { status: 'paid', employeeAmount: 7 })).toBe(7)
    expect(deliveryCommissionCost(10, { status: 'pending', employeeAmount: 1 })).toBe(1)
    expect(deliveryCommissionCost(10, { status: 'pending', employeeAmount: 10 })).toBe(10)
    expect(deliveryCommissionCost(10, { status: 'pending', employeeAmount: 0 })).toBe(0)
  })
  it('excluye cancelaciones y conserva el cálculo anterior cuando falta la asignación', () => {
    expect(deliveryCommissionCost(10, { status: 'cancelled', employeeAmount: 7 })).toBe(0)
    expect(deliveryCommissionCost(10)).toBe(7)
  })
})
