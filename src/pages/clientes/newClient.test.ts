import { describe, expect, it } from 'vitest'
import type { Customer } from '../../lib/dataService'
import { EMPTY_NEW_CLIENT_FORM, birthDateFrom, fullName, toCreateCustomerInput, toCustomerRow } from './newClient'

const form = { ...EMPTY_NEW_CLIENT_FORM, name: ' Ana ', lastName: ' Pérez ', phone: ' 0412 1234567 ', address: '  ', birthMonth: '3', birthDay: '7' }

describe('nuevo cliente', () => {
  it('arma el nombre completo sin espacios sobrantes', () => {
    expect(fullName(form)).toBe('Ana Pérez')
    expect(fullName({ ...form, lastName: '' })).toBe('Ana')
  })

  it('guarda el cumpleaños con año 2000 y ceros a la izquierda', () => {
    expect(birthDateFrom(form)).toBe('2000-03-07')
    expect(birthDateFrom({ ...form, birthDay: '' })).toBeUndefined()
    expect(birthDateFrom({ ...form, birthMonth: '' })).toBeUndefined()
  })

  it('prepara los datos para crear el cliente', () => {
    expect(toCreateCustomerInput(form)).toEqual({ name: 'Ana Pérez', phone: '0412 1234567', address: undefined, birthDate: '2000-03-07' })
  })

  it('crea la fila de la lista con iniciales y valores en cero', () => {
    const row = toCustomerRow({ id: 'c1', phone: '04121234567', identification: 'V12345678' } as unknown as Customer, { ...form, name: 'ana', lastName: 'pérez' }, new Date('2026-11-25T12:00:00'))
    expect(row).toMatchObject({ id: 'c1', initials: 'AP', name: 'ana pérez', totalPurchased: 0, pendingBalance: 0, status: 'Activo' })
  })
})
