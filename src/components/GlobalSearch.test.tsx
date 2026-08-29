import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { SearchProvider } from '../context/search-context'
import { GlobalSearch } from './GlobalSearch'

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  user: { id: 'owner-1', email: 'owner@fullchina.test', role: 'owner' as 'owner' | 'manager' | 'cashier', allowedModules: null as string[] | null },
  getProducts: vi.fn(),
  getCustomers: vi.fn(),
  getOrdersWithItems: vi.fn(),
  getSuppliers: vi.fn(),
}))

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return { ...actual, useNavigate: () => mocks.navigate }
})

vi.mock('../context/auth-context', () => ({
  useAuth: () => ({ user: mocks.user }),
}))

vi.mock('../lib/dataService', () => ({
  getProducts: mocks.getProducts,
  getCustomers: mocks.getCustomers,
  getOrdersWithItems: mocks.getOrdersWithItems,
  getSuppliers: mocks.getSuppliers,
}))

function renderSearches() {
  return render(
    <SearchProvider>
      <GlobalSearch inline />
      <GlobalSearch />
    </SearchProvider>,
  )
}

describe('GlobalSearch', () => {
  beforeAll(() => {
    Element.prototype.scrollIntoView = vi.fn()
  })

  beforeEach(() => {
    vi.clearAllMocks()
    mocks.user = { id: 'owner-1', email: 'owner@fullchina.test', role: 'owner', allowedModules: null }
    mocks.getProducts.mockResolvedValue([])
    mocks.getCustomers.mockResolvedValue([])
    mocks.getOrdersWithItems.mockResolvedValue([])
    mocks.getSuppliers.mockResolvedValue([])
  })

  it('muestra Menú y Menú semanal sin abrir el buscador modal', async () => {
    renderSearches()
    const inlineSearch = screen.getByRole('combobox', { name: 'Buscar en el sistema' })

    fireEvent.change(inlineSearch, { target: { value: 'menu' } })

    expect(await screen.findByText('Menú semanal')).toBeInTheDocument()
    expect(screen.getByText('Menú')).toBeInTheDocument()
    expect(screen.queryByPlaceholderText(/buscar módulos, productos/i)).not.toBeInTheDocument()

    fireEvent.mouseDown(document.body)
    await waitFor(() => expect(screen.queryByText('Menú semanal')).not.toBeInTheDocument())
    expect(screen.queryByPlaceholderText(/buscar módulos, productos/i)).not.toBeInTheDocument()
  })

  it('encuentra clientes por teléfono y abre el módulo correspondiente', async () => {
    mocks.getCustomers.mockResolvedValue([{
      id: 'customer-1', name: 'Ana Pérez', identification: 'V-123', phone: '04141234567', email: 'ana@example.com',
      totalVisits: 2, rewardsUnlocked: 0, lastVisit: '', favoriteProduct: 'Arroz especial', birthday: '', createdAt: '', isActive: true,
    }])
    renderSearches()

    fireEvent.change(screen.getByRole('combobox', { name: 'Buscar en el sistema' }), { target: { value: '04141234567' } })
    fireEvent.click(await screen.findByRole('button', { name: /ana pérez/i }))

    expect(mocks.navigate).toHaveBeenCalledWith('/clientes')
  })

  it('encuentra órdenes por número y abre su módulo', async () => {
    mocks.getOrdersWithItems.mockResolvedValue([{
      id: 'order-63', orderNumber: 63, status: 'paid', fulfillmentStatus: 'delivered', notes: null, orderType: 'delivery',
      tableNumber: null, customerName: 'Carlos Ruiz', bcvRate: 791.67, createdBy: 'owner-1', createdAt: '', updatedAt: '',
      items: [], payments: [], totalAmount: 25.9,
    }])
    renderSearches()

    fireEvent.change(screen.getByRole('combobox', { name: 'Buscar en el sistema' }), { target: { value: '#63' } })
    fireEvent.click(await screen.findByRole('button', { name: /orden #63/i }))

    expect(mocks.navigate).toHaveBeenCalledWith('/comandas')
  })

  it('mantiene Ctrl+K como atajo exclusivo del buscador modal', async () => {
    renderSearches()

    fireEvent.keyDown(window, { key: 'k', ctrlKey: true })

    expect(await screen.findByPlaceholderText(/buscar módulos, productos/i)).toBeInTheDocument()
    expect(screen.getAllByRole('combobox')).toHaveLength(1)
  })

  it('no consulta ni muestra información de módulos sin permiso', async () => {
    mocks.user = { id: 'manager-1', email: 'manager@fullchina.test', role: 'manager', allowedModules: ['/'] }
    renderSearches()

    fireEvent.change(screen.getByRole('combobox', { name: 'Buscar en el sistema' }), { target: { value: 'cliente' } })

    await screen.findByText('No encontramos nada para "cliente"')
    expect(mocks.getCustomers).not.toHaveBeenCalled()
    expect(screen.queryByText('Clientes')).not.toBeInTheDocument()
  })
})
