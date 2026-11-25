import { describe, expect, it } from 'vitest'
import type { Customer } from '../../lib/dataService'
import { customerToEditForm, toUpdateCustomerInput } from './editClient'

const customer = { id: 'c1', name: 'Ana Pérez', phone: null, identification: 'V1', address: null, birthday: '2000-03-07T00:00:00Z' } as unknown as Customer

describe('editar cliente', () => {
  it('rellena el formulario y separa mes y día sin ceros', () => {
    expect(customerToEditForm(customer)).toEqual({ name: 'Ana Pérez', phone: '', identification: 'V1', address: '', birthMonth: '3', birthDay: '7' })
  })

  it('deja el cumpleaños vacío si el cliente no tiene', () => {
    expect(customerToEditForm({ ...customer, birthday: null } as unknown as Customer)).toMatchObject({ birthMonth: '', birthDay: '' })
  })

  it('arma los datos a guardar recortando espacios y repone el año 2000', () => {
    const form = { ...customerToEditForm(customer), name: '  Ana  ', address: '   ' }
    expect(toUpdateCustomerInput(form)).toEqual({ name: 'Ana', phone: '', identification: 'V1', address: undefined, birthDate: '2000-03-07' })
  })
})
