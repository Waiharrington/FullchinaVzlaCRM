import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { CashSessionSnapshot, FinancialAccount, OrderResult, Product } from '../lib/dataService'
import { Caja } from './Caja'

const mocks = vi.hoisted(() => ({
  getProducts: vi.fn(),
  getTodayOrders: vi.fn(),
  getTopSellingProducts: vi.fn(),
  getActiveCashSession: vi.fn(),
  checkout: vi.fn(),
  sendToKitchen: vi.fn(),
  getCustomers: vi.fn(),
  createCustomer: vi.fn(),
  getProductModifiers: vi.fn(),
  getAllProductModifiers: vi.fn(),
  getOccupiedTables: vi.fn(),
  getMenuCategories: vi.fn(),
  getFinancialAccounts: vi.fn(),
  getPersonalAccountOptions: vi.fn(),
}))

vi.mock('../lib/dataService', async () => {
  const actual = await vi.importActual<typeof import('../lib/dataService')>('../lib/dataService')
  return { ...actual, ...mocks }
})
vi.mock('../context/auth-context', () => ({
  useAuth: () => ({ user: { id: 'demo-cashier', email: 'caja@demo.test', fullName: 'Cajera Demo', role: 'cashier', allowedModules: null } }),
}))
vi.mock('../context/rates-context', () => ({
  useRates: () => ({ bcvRate: 800, updatedAt: null, stale: false, error: false, loading: false, refresh: async () => undefined }),
}))
vi.mock('../lib/liveDataRefresh', () => ({ useLiveDataRefresh: () => undefined }))
vi.mock('../lib/thermalReceipt', async () => {
  const actual = await vi.importActual<typeof import('../lib/thermalReceipt')>('../lib/thermalReceipt')
  return { ...actual, printThermalReceipt: vi.fn() }
})

const agua: Product = {
  id: 'p-agua', name: 'Agua', description: null, price: 1.5, cost: null,
  category: 'bebidas', categories: ['bebidas'], emoji: '', active: true, imageUrl: null,
}

const openSession = {
  id: 's1', sessionNumber: 1, registerId: 'r1', registerCode: 'caja-principal', registerName: 'Caja principal',
  status: 'open', openedAt: '2026-11-23T12:00:00.000Z', openedBy: 'demo-cashier', openingCashUsd: 0, openingCashVes: 0,
  cashSalesUsd: 0, cashSalesVes: 0, paymentTotal: 0, paymentBreakdown: {}, paymentBreakdownVes: {},
  movementInUsd: 0, movementOutUsd: 0, movementInVes: 0, movementOutVes: 0, expectedCashUsd: 0, expectedCashVes: 0,
  countedCashUsd: null, countedCashVes: null, differenceUsd: null, differenceVes: null, closedAt: null, movements: [],
} as unknown as CashSessionSnapshot

const cashUsd = {
  id: 'acc-usd', name: 'Caja Demo', accountType: 'cash', currency: 'USD', isActive: true,
  acceptsCustomerPayments: true, openingBalance: 0, currentBalance: 0,
} as FinancialAccount

const orderResult: OrderResult = {
  id: 'o1', orderNumber: 1, status: 'paid', total: 1.5, bcvRate: 800, createdAt: '2026-11-23T12:05:00.000Z',
  paymentMethod: 'cash', items: [],
}

function renderCaja() {
  return render(<MemoryRouter><Caja /></MemoryRouter>)
}

async function addAguaAndPickTable() {
  await screen.findByText('Agua')
  fireEvent.click(screen.getByTitle('Agregar al pedido'))
  fireEvent.click(await screen.findByRole('button', { name: '3' }))
}

describe('Caja · venta de punta a punta (datos demo)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    mocks.getProducts.mockResolvedValue([agua])
    mocks.getTodayOrders.mockResolvedValue([])
    mocks.getTopSellingProducts.mockResolvedValue(new Map())
    mocks.getActiveCashSession.mockResolvedValue(openSession)
    mocks.getCustomers.mockResolvedValue([])
    mocks.getProductModifiers.mockResolvedValue([])
    mocks.getAllProductModifiers.mockResolvedValue(new Map())
    mocks.getOccupiedTables.mockResolvedValue([])
    mocks.getMenuCategories.mockResolvedValue([])
    mocks.getFinancialAccounts.mockResolvedValue([cashUsd])
    mocks.getPersonalAccountOptions.mockResolvedValue([])
    mocks.checkout.mockResolvedValue(orderResult)
  })

  it('arma un pedido, cobra en efectivo y envía el pago correcto', async () => {
    renderCaja()
    await addAguaAndPickTable()

    fireEvent.click(await screen.findByRole('button', { name: /Cobrar pedido/ }))
    fireEvent.click(await screen.findByRole('button', { name: /Efectivo/ }))
    fireEvent.click(await screen.findByRole('button', { name: /Confirmar pago/ }))

    await waitFor(() => expect(mocks.checkout).toHaveBeenCalledTimes(1))
    const call = mocks.checkout.mock.calls[0][0]
    expect(call.method).toBe('cash')
    expect(call.items).toHaveLength(1)
    expect(call.items[0]).toMatchObject({ productId: 'p-agua', quantity: 1 })
    expect(call.tableNumber).toBe(3)
    expect(call.userId).toBe('demo-cashier')
    expect(call.payments).toHaveLength(1)
    expect(call.payments[0]).toMatchObject({ method: 'cash', amount: 1.5, accountId: 'acc-usd' })
  })

  it('no cobra si la caja está cerrada', async () => {
    mocks.getActiveCashSession.mockResolvedValue(null)
    renderCaja()
    await addAguaAndPickTable()

    fireEvent.click(await screen.findByRole('button', { name: /Cobrar pedido/ }))

    expect(await screen.findByText(/abrir la caja antes de registrar un cobro/i)).toBeInTheDocument()
    expect(mocks.checkout).not.toHaveBeenCalled()
  })

  it('muestra el error del cobro si el pago móvil no trae referencia y no llama a checkout', async () => {
    renderCaja()
    await addAguaAndPickTable()

    fireEvent.click(await screen.findByRole('button', { name: /Cobrar pedido/ }))
    fireEvent.click(await screen.findByRole('button', { name: /Pago móvil/ }))
    fireEvent.click(await screen.findByRole('button', { name: /Confirmar pago/ }))

    expect(await screen.findByRole('alert')).toHaveTextContent(/La referencia es obligatoria/)
    expect(mocks.checkout).not.toHaveBeenCalled()
  })
})
