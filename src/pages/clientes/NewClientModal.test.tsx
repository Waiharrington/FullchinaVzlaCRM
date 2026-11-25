import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ createCustomer: vi.fn(), alertDialog: vi.fn() }))
vi.mock('../../lib/dataService', () => ({ createCustomer: mocks.createCustomer }))
vi.mock('../../components/ConfirmDialog', () => ({ alertDialog: mocks.alertDialog }))

import { NewClientModal } from './NewClientModal'

describe('NewClientModal', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    vi.clearAllMocks()
    mocks.createCustomer.mockResolvedValue({ id: 'c1', phone: '04121234567', identification: 'V12345678' })
  })
  afterEach(() => vi.useRealTimers())

  it('crea el cliente con nombre completo y avisa al padre al cerrar', async () => {
    const onClose = vi.fn()
    const onCreated = vi.fn()
    render(<NewClientModal onClose={onClose} onCreated={onCreated} />)
    fireEvent.change(screen.getByPlaceholderText('Ingresa el nombre del cliente'), { target: { value: 'Ana' } })
    fireEvent.change(screen.getByPlaceholderText('Ingresa el apellido del cliente'), { target: { value: 'Pérez' } })
    fireEvent.click(screen.getByRole('button', { name: 'Guardar cliente' }))
    await waitFor(() => expect(mocks.createCustomer).toHaveBeenCalledWith({ name: 'Ana Pérez', phone: '', address: undefined, birthDate: undefined }))
    await act(async () => { vi.advanceTimersByTime(250) })
    expect(onClose).toHaveBeenCalled()
    expect(onCreated).toHaveBeenCalledWith(expect.objectContaining({ id: 'c1' }), expect.objectContaining({ id: 'c1', name: 'Ana Pérez', initials: 'AP' }))
  })

  it('si falla el guardado avisa y no cierra', async () => {
    mocks.createCustomer.mockRejectedValue(new Error('x'))
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const onCreated = vi.fn()
    render(<NewClientModal onClose={vi.fn()} onCreated={onCreated} />)
    fireEvent.change(screen.getByPlaceholderText('Ingresa el nombre del cliente'), { target: { value: 'Ana' } })
    fireEvent.click(screen.getByRole('button', { name: 'Guardar cliente' }))
    await waitFor(() => expect(mocks.alertDialog).toHaveBeenCalledWith(expect.objectContaining({ danger: true })))
    expect(onCreated).not.toHaveBeenCalled()
    spy.mockRestore()
  })

  it('cancelar cierra sin crear nada', async () => {
    const onClose = vi.fn()
    render(<NewClientModal onClose={onClose} onCreated={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
    await act(async () => { vi.advanceTimersByTime(250) })
    expect(onClose).toHaveBeenCalled()
    expect(mocks.createCustomer).not.toHaveBeenCalled()
  })
})
