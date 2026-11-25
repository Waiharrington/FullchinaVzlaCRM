import type { Customer } from '../../lib/dataService'
import { birthDateFrom } from './newClient'

export interface EditClientForm {
  address: string
  birthDay: string
  birthMonth: string
  identification: string
  name: string
  phone: string
}

// Rellena el formulario con los datos actuales; el cumpleaños llega como YYYY-MM-DD.
export function customerToEditForm(customer: Customer): EditClientForm {
  const birthday = (customer.birthday || '').slice(0, 10)
  const [, month, day] = birthday ? birthday.split('-') : []
  return {
    name: customer.name,
    phone: customer.phone ?? '',
    identification: customer.identification ?? '',
    address: customer.address ?? '',
    birthMonth: birthday ? String(Number(month)) : '',
    birthDay: birthday ? String(Number(day)) : '',
  }
}

export function toUpdateCustomerInput(form: EditClientForm) {
  return {
    name: form.name.trim(),
    phone: form.phone.trim(),
    identification: form.identification.trim(),
    address: form.address.trim() || undefined,
    birthDate: birthDateFrom(form),
  }
}
