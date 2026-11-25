import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Product } from '../../lib/dataService'

const mocks = vi.hoisted(() => ({
  checkout: vi.fn(),
  getCredits: vi.fn(),
  getCustomerOrders: vi.fn(),
  alertDialog: vi.fn(),
}))

vi.mock('../../lib/dataService', () => ({
  checkout: mocks.checkout,
  getCredits: mocks.getCredits,
  getCustomerOrders: mocks.getCustomerOrders,
}))
vi.mock('../../components/ConfirmDialog', () => ({ alertDialog: mocks.alertDialog }))

import { QuickOrderModal } from './QuickOrderModal'

const products = [{ id: 'p1', name: 'Trio', price: 6, emoji: '🍜' }] as Product[]
const renderModal = (overrides = {}) => {
  const props = { bcvRate: 900, client: { id: 'c1', name: 'Ana' }, isDemoMode: false, onClose: vi.fn(), onCreated: vi.fn(), products, userId: 'u1', ...overrides }
  render(<QuickOrderModal {...props} />)
  return props
}

describe('QuickOrderModal', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.checkout.mockResolvedValue(undefined)
    mocks.getCustomerOrders.mockResolvedValue([{ id: 'o1' }])
    mocks.getCredits.mockResolvedValue([{ id: 'cr1' }])
  })

  it('no permite crear un pedido con el carrito vacío', () => {
    renderModal()
    expect((screen.getByRole('button', { name: 'Crear pedido' }) as HTMLButtonElement).disabled).toBe(true)
  })

  it('crea el pedido con el producto elegido y avisa al padre', async () => {
    const props = renderModal()
    fireEvent.click(screen.getByText('Trío'))
    fireEvent.click(screen.getByRole('button', { name: 'Crear pedido' }))
    await waitFor(() => expect(props.onCreated).toHaveBeenCalledWith([{ id: 'o1' }], [{ id: 'cr1' }]))
    expect(mocks.checkout).toHaveBeenCalledWith(expect.objectContaining({
      method: 'cash', orderType: 'takeaway', customerName: 'Ana', userId: 'u1', bcvRate: 900,
      items: [expect.objectContaining({ productId: 'p1', quantity: 1 })],
    }))
  })

  it('muestra el error si el cobro falla y no avisa al padre', async () => {
    mocks.checkout.mockRejectedValue(new Error('Sin stock'))
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const props = renderModal()
    fireEvent.click(screen.getByText('Trío'))
    fireEvent.click(screen.getByRole('button', { name: 'Crear pedido' }))
    expect(await screen.findByText('Sin stock')).toBeTruthy()
    expect(props.onCreated).not.toHaveBeenCalled()
    spy.mockRestore()
  })

  it('en modo demo no crea pedidos reales', () => {
    renderModal({ isDemoMode: true })
    fireEvent.click(screen.getByText('Trío'))
    expect((screen.getByRole('button', { name: 'Crear pedido' }) as HTMLButtonElement).disabled).toBe(true)
  })
})
