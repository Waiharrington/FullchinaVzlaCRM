import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { CashSessionSnapshot, FinancialAccount, FullOrder } from '../lib/dataService'
import { Comandas } from './Comandas'
import { clearBoardSnapshots } from './comandas/boardData'

// Pantallas completas: bajo la carga de toda la suite pueden pasar de los 5 s por defecto.
vi.setConfig({ testTimeout: 20000 })

const mocks = vi.hoisted(() => ({
  getOrdersWithItems: vi.fn(),
  getOrderById: vi.fn(),
  getActiveCashSession: vi.fn(),
  recordOrderPayments: vi.fn(),
  updateOrderStatus: vi.fn(),
  getAllSellableProducts: vi.fn(),
  getCustomers: vi.fn(),
  getPersonalAccountOptions: vi.fn(),
  getFinancialAccounts: vi.fn(),
  getPendingWebOrders: vi.fn(),
}))

vi.mock('../lib/dataService', async () => {
  const actual = await vi.importActual<typeof import('../lib/dataService')>('../lib/dataService')
  const { getPendingWebOrders: _ignored, ...rest } = mocks
  void _ignored
  return { ...actual, ...rest }
})
vi.mock('../lib/publicOrders', async () => {
  const actual = await vi.importActual<typeof import('../lib/publicOrders')>('../lib/publicOrders')
  return { ...actual, getPendingWebOrders: mocks.getPendingWebOrders }
})
vi.mock('../context/rates-context', () => ({
  useRates: () => ({ bcvRate: 800, updatedAt: null, stale: false, error: false, loading: false, refresh: async () => undefined }),
}))
vi.mock('../lib/liveDataRefresh', () => ({ useLiveDataRefresh: () => undefined }))
vi.mock('./Caja', () => ({ Caja: () => null }))

const openSession = { id: 's1', status: 'open' } as unknown as CashSessionSnapshot
const cashUsd = {
  id: 'acc-usd', name: 'Caja Demo', accountType: 'cash', currency: 'USD', isActive: true,
  acceptsCustomerPayments: true, openingBalance: 0, currentBalance: 0,
} as FinancialAccount

const today = new Date().toISOString()
const order: FullOrder = {
  id: 'order-1', orderNumber: 101, status: 'pending', fulfillmentStatus: 'new', notes: null,
  orderType: 'takeaway', tableNumber: null, customerName: 'María Demo', customerPhone: null, customerAddress: null,
  customerIdentification: null, bcvRate: 800, createdBy: 'u1', createdAt: today, updatedAt: today,
  items: [{ id: 'i1', sellableProductId: 'p1', productName: 'Arroz Demo', emoji: '', category: 'plato', quantity: 1, unitPrice: 20 }],
  payments: [], totalAmount: 20,
}

function renderComandas() {
  return render(<MemoryRouter><Comandas /></MemoryRouter>)
}

describe('Comandas · cobro de punta a punta (datos demo)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    clearBoardSnapshots()
    mocks.getOrdersWithItems.mockResolvedValue([order])
    mocks.getOrderById.mockResolvedValue(order)
    mocks.getActiveCashSession.mockResolvedValue(openSession)
    mocks.getAllSellableProducts.mockResolvedValue([])
    mocks.getCustomers.mockResolvedValue([])
    mocks.getPersonalAccountOptions.mockResolvedValue([])
    mocks.getFinancialAccounts.mockResolvedValue([cashUsd])
    mocks.getPendingWebOrders.mockResolvedValue([])
    mocks.recordOrderPayments.mockResolvedValue(undefined)
  })

  it('abre la comanda, cobra en efectivo y registra el pago', async () => {
    renderComandas()
    fireEvent.click((await screen.findAllByText('María Demo'))[0])

    fireEvent.click(await screen.findByRole('button', { name: /^Cobrar/ }))
    fireEvent.click(await screen.findByRole('button', { name: /Confirmar pago/ }))

    await waitFor(() => expect(mocks.recordOrderPayments).toHaveBeenCalledTimes(1))
    const call = mocks.recordOrderPayments.mock.calls[0][0]
    expect(call.orderId).toBe('order-1')
    expect(call.payments).toHaveLength(1)
    expect(call.payments[0]).toMatchObject({ method: 'cash', amount: 20, receivedAmount: 20, receivedCurrency: 'USD', accountId: 'acc-usd' })
  })

  it('no permite confirmar el cobro si la caja está cerrada', async () => {
    mocks.getActiveCashSession.mockResolvedValue(null)
    renderComandas()
    fireEvent.click((await screen.findAllByText('María Demo'))[0])
    fireEvent.click(await screen.findByRole('button', { name: /^Cobrar/ }))

    expect(await screen.findByText(/abrir la caja antes de cobrar/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Confirmar pago/ })).toBeDisabled()
    expect(mocks.recordOrderPayments).not.toHaveBeenCalled()
  })
})

describe('Comandas · carga del tablero', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    clearBoardSnapshots()
    mocks.getAllSellableProducts.mockResolvedValue([])
    mocks.getFinancialAccounts.mockResolvedValue([])
    mocks.getPendingWebOrders.mockResolvedValue([])
  })

  it('muestra que está cargando, nunca un tablero vacío falso', async () => {
    let deliver: (orders: FullOrder[]) => void = () => undefined
    mocks.getOrdersWithItems.mockReturnValue(new Promise<FullOrder[]>(resolve => { deliver = resolve }))
    renderComandas()

    expect(screen.getByRole('status', { name: 'Cargando comandas: Nuevas' })).toBeInTheDocument()
    expect(screen.queryByText('Sin comandas')).not.toBeInTheDocument()
    deliver([order])
    expect(await screen.findByText('María Demo')).toBeInTheDocument()
  })

  it('al volver a entrar pinta al instante lo último recibido', async () => {
    mocks.getOrdersWithItems.mockResolvedValue([order])
    const first = renderComandas()
    await screen.findByText('María Demo')
    first.unmount()

    mocks.getOrdersWithItems.mockReturnValue(new Promise(() => undefined))
    renderComandas()
    expect(screen.getByText('María Demo')).toBeInTheDocument()
  })

  it('si falla la lectura lo dice y permite reintentar', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    mocks.getOrdersWithItems.mockRejectedValueOnce(new Error('sin red')).mockResolvedValue([order])
    renderComandas()

    fireEvent.click(await screen.findByRole('button', { name: 'Reintentar' }))
    expect(await screen.findByText('María Demo')).toBeInTheDocument()
    vi.restoreAllMocks()
  })
})
