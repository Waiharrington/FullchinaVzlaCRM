import { describe, expect, it } from 'vitest'
import type { Credit } from '../../lib/dataService'
import { activeCredits, creditInitials, daysOutstanding, linkedCredits, receivablePaymentNote } from './receivables'

const credit = (id: string, balancePending: number, extra: Partial<Credit> = {}) => ({ id, balancePending, customerName: 'Ana Pérez', ...extra }) as Credit

describe('cuentas por cobrar', () => {
  it('solo cuenta los créditos con saldo pendiente', () => {
    expect(activeCredits([credit('a', 5), credit('b', 0), credit('c', 0.01)]).map(c => c.id)).toEqual(['a', 'c'])
  })

  it('detalla solo los créditos con saldo, comanda y cliente', () => {
    const list = [credit('a', 5, { orderId: 'o1', customerId: 'c1' }), credit('b', 5, { orderId: 'o2' }), credit('c', 0, { orderId: 'o3', customerId: 'c3' })]
    expect(linkedCredits(list).map(c => c.id)).toEqual(['a'])
  })

  it('calcula los días en deuda sin bajar de cero', () => {
    const now = new Date('2026-11-25T12:00:00Z').getTime()
    expect(daysOutstanding('2026-11-22T12:00:00Z', now)).toBe(3)
    expect(daysOutstanding('2026-11-25T11:00:00Z', now)).toBe(0)
    expect(daysOutstanding('2026-11-30T12:00:00Z', now)).toBe(0)
  })

  it('arma las iniciales con los dos primeros nombres', () => {
    expect(creditInitials('ana maría pérez')).toBe('AM')
    expect(creditInitials('  luis ')).toBe('L')
  })

  it('usa el número de comanda en la nota del pago si existe', () => {
    expect(receivablePaymentNote({ orderNumber: 85 })).toBe('Pago de comanda #85')
    expect(receivablePaymentNote(undefined)).toBe('Abono a cuenta por cobrar')
  })
})
