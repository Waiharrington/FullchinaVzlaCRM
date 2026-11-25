import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Customer } from '../../lib/dataService'

const mocks = vi.hoisted(() => ({ updateCustomer: vi.fn() }))
vi.mock('../../lib/dataService', () => ({ updateCustomer: mocks.updateCustomer }))

import { EditClientModal } from './EditClientModal'

const customer = { id: 'c1', name: 'Ana Pérez', phone: '0412', identification: 'V1', address: null, birthday: '2000-03-07' } as unknown as Customer

describe('EditClientModal', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    vi.clearAllMocks()
    mocks.updateCustomer.mockImplementation(async (_id: string, input: { name: string }) => ({ ...customer, name: input.name }))
  })
  afterEach(() => vi.useRealTimers())

  it('muestra los datos actuales y guarda los cambios', async () => {
    const onSaved = vi.fn()
    const onClose = vi.fn()
    render(<EditClientModal customer={customer} onClose={onClose} onSaved={onSaved} />)
    const name = screen.getByDisplayValue('Ana Pérez')
    fireEvent.change(name, { target: { value: ' Ana María ' } })
    fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }))
    await waitFor(() => expect(mocks.updateCustomer).toHaveBeenCalledWith('c1', { name: 'Ana María', phone: '0412', identification: 'V1', address: undefined, birthDate: '2000-03-07' }))
    await waitFor(() => expect(onSaved).toHaveBeenCalledWith(expect.objectContaining({ name: 'Ana María' })))
    await act(async () => { vi.advanceTimersByTime(250) })
    expect(onClose).toHaveBeenCalled()
  })

  it('muestra el error y no cierra si falla el guardado', async () => {
    mocks.updateCustomer.mockRejectedValue(new Error('x'))
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const onSaved = vi.fn()
    render(<EditClientModal customer={customer} onClose={vi.fn()} onSaved={onSaved} />)
    fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }))
    expect(await screen.findByText(/No se pudo actualizar el cliente/)).toBeTruthy()
    expect(onSaved).not.toHaveBeenCalled()
    spy.mockRestore()
  })
})
