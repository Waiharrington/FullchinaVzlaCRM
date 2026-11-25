import type { Customer } from '../../lib/dataService'
import { classifyIdentification, type CustomerRow } from './model'

export interface NewClientForm {
  address: string
  birthDay: string
  birthMonth: string
  lastName: string
  name: string
  phone: string
}

export const EMPTY_NEW_CLIENT_FORM: NewClientForm = { name: '', lastName: '', phone: '', address: '', birthMonth: '', birthDay: '' }

export const MONTH_NAMES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']

export function fullName(form: NewClientForm): string {
  return `${form.name.trim()} ${form.lastName.trim()}`.trim()
}

// El cumpleaños se guarda con año fijo 2000: solo importan mes y día.
export function birthDateFrom(form: { birthDay: string; birthMonth: string }): string | undefined {
  return form.birthMonth && form.birthDay ? `2000-${form.birthMonth.padStart(2, '0')}-${form.birthDay.padStart(2, '0')}` : undefined
}

export function toCreateCustomerInput(form: NewClientForm) {
  return { name: fullName(form), phone: form.phone.trim(), address: form.address.trim() || undefined, birthDate: birthDateFrom(form) }
}

export function toCustomerRow(saved: Customer, form: NewClientForm, today = new Date()): CustomerRow {
  return {
    id: saved.id,
    initials: (form.name[0] + (form.lastName[0] || '')).toUpperCase(),
    avatarBg: '#dc2626',
    name: fullName(form),
    phone: saved.phone,
    identification: saved.identification,
    identificationStatus: classifyIdentification(saved.identification),
    lastPurchase: today.toLocaleDateString('es-VE', { day: '2-digit', month: '2-digit', year: 'numeric' }),
    totalPurchased: 0.00,
    pendingBalance: 0.00,
    status: 'Activo',
  }
}
