import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { Proveedores } from './Proveedores'

const mockSuppliers = [
  {
    id: 'supp-1',
    name: 'Arabit',
    contact: 'Carlos Arabit',
    phone: '0414-1234567',
    email: 'arabit@gmail.com',
    notes: 'Entregas los martes',
    isActive: true,
  },
  {
    id: 'supp-2',
    name: 'Euromercado',
    contact: 'Iva',
    phone: '0424-9876543',
    email: 'euromercado@gmail.com',
    notes: '',
    isActive: true,
  },
]

const mockPurchases = [
  {
    id: 'pur-1',
    supplierId: 'supp-1',
    supplierName: 'Arabit',
    purchaseDate: '2026-08-24',
    invoiceNumber: 'FAC-001',
    notes: 'Compra de vegetales',
    createdBy: 'user-1',
    createdAt: '2026-08-24T10:00:00Z',
    items: [
      {
        id: 'pi-1',
        purchaseId: 'pur-1',
        ingredientId: 'ing-1',
        ingredientName: 'Cebollín',
        quantity: 5,
        unitId: 'unit-1',
        unitSymbol: 'kg',
        unitCost: 2.5,
        total: 12.5,
      },
    ],
    totalAmount: 12.5,
    isPaid: true,
    accountId: 'acc-1',
    accountName: 'Efectivo USD',
    paymentCurrency: 'USD' as const,
    paymentMethod: 'cash',
    paymentReference: null,
    exchangeRate: null,
  },
]

const mocks = vi.hoisted(() => ({
  getSuppliers: vi.fn(),
  getPurchases: vi.fn(),
  createSupplier: vi.fn(),
  updateSupplier: vi.fn(),
}))

vi.mock('../lib/dataService', () => ({
  getSuppliers: mocks.getSuppliers,
  getPurchases: mocks.getPurchases,
  createSupplier: mocks.createSupplier,
  updateSupplier: mocks.updateSupplier,
}))

vi.mock('../components/MoneyWithBcv', () => ({
  MoneyWithBcv: ({ usd, className = '' }: { usd: number; className?: string }) => (
    <span className={className}>${usd.toFixed(2)}</span>
  ),
}))

vi.mock('../context/rates-context', () => ({
  useRates: () => ({
    bcvRate: 40,
    rates: { USD: 40 },
    loading: false,
    error: null,
  }),
}))

describe('Página de Proveedores (Formato Tabla)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getSuppliers.mockResolvedValue(mockSuppliers)
    mocks.getPurchases.mockResolvedValue(mockPurchases)
  })

  it('renderiza las métricas KPI y la tabla de proveedores', async () => {
    render(<Proveedores />)

    expect(await screen.findByText('Proveedores activos')).toBeInTheDocument()
    expect(screen.getByText('Compras registradas')).toBeInTheDocument()
    expect(screen.getByText('Arabit')).toBeInTheDocument()
    expect(screen.getByText('Euromercado')).toBeInTheDocument()
    expect(screen.getByText('Carlos Arabit')).toBeInTheDocument()
    expect(screen.getByText('0414-1234567')).toBeInTheDocument()
  })

  it('permite filtrar proveedores por el buscador', async () => {
    render(<Proveedores />)
    await screen.findByText('Arabit')

    const searchInput = screen.getByPlaceholderText(/Buscar por nombre, contacto o teléfono/i)
    fireEvent.change(searchInput, { target: { value: 'Euro' } })

    expect(screen.getByText('Euromercado')).toBeInTheDocument()
    expect(screen.queryByText('Arabit')).not.toBeInTheDocument()
  })

  it('abre el modal de nuevo proveedor y permite enviar el formulario', async () => {
    mocks.createSupplier.mockResolvedValue('supp-new')
    render(<Proveedores />)
    await screen.findByText('Arabit')

    fireEvent.click(screen.getByRole('button', { name: /Nuevo proveedor/i }))
    expect(await screen.findByRole('dialog', { name: /Nuevo proveedor/i })).toBeInTheDocument()

    fireEvent.change(screen.getByPlaceholderText(/Nombre del proveedor/i), { target: { value: 'Distribuidora Oriental' } })
    fireEvent.change(screen.getByPlaceholderText(/Nombre de contacto/i), { target: { value: 'Pedro Gómez' } })
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }))

    await waitFor(() => {
      expect(mocks.createSupplier).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Distribuidora Oriental',
          contact: 'Pedro Gómez',
        }),
      )
    })
  })

  it('abre el modal de edición de proveedor con datos pre-cargados', async () => {
    mocks.updateSupplier.mockResolvedValue(undefined)
    render(<Proveedores />)
    await screen.findByText('Arabit')

    const editButtons = screen.getAllByTitle('Editar proveedor')
    fireEvent.click(editButtons[0])

    expect(await screen.findByRole('dialog', { name: /Editar proveedor/i })).toBeInTheDocument()
    const nameInput = screen.getByDisplayValue('Arabit')
    fireEvent.change(nameInput, { target: { value: 'Arabit C.A.' } })

    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }))

    await waitFor(() => {
      expect(mocks.updateSupplier).toHaveBeenCalledWith(
        'supp-1',
        expect.objectContaining({
          name: 'Arabit C.A.',
        }),
      )
    })
  })

  it('abre el historial de compras al hacer clic en ver historial', async () => {
    render(<Proveedores />)
    await screen.findByText('Arabit')

    const historyButtons = screen.getAllByTitle('Ver historial de compras')
    fireEvent.click(historyButtons[0])

    expect(await screen.findByRole('dialog', { name: /Arabit/i })).toBeInTheDocument()
    expect(screen.getByText('Historial de compras')).toBeInTheDocument()
  })
})
