import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Inventario } from './Inventario'

const mocks = vi.hoisted(() => ({
  getIngredients: vi.fn(),
  getStockMovements: vi.fn(),
  getUnits: vi.fn(),
  adjustStock: vi.fn(),
  updateIngredient: vi.fn(),
  updateIngredientCost: vi.fn(),
}))

vi.mock('../context/auth-context', () => ({
  useAuth: () => ({ user: { id: 'owner-1', role: 'owner', email: 'owner@example.com' } }),
}))

vi.mock('../lib/dataService', () => ({
  ...mocks,
}))

const ingredient = {
  id: 'ingredient-1',
  name: 'Aceite',
  unitId: 'unit-1',
  unitName: 'Litro',
  unitSymbol: 'L',
  isActive: true,
  currentStock: 8,
  pricePerUnit: 4.25,
  stockValue: 34,
  inventoryClass: 'raw_material' as const,
}

function renderInventory() {
  return render(<MemoryRouter><Inventario /></MemoryRouter>)
}

describe('Acciones de Inventario', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getIngredients.mockResolvedValue([ingredient])
    mocks.getStockMovements.mockImplementation((ingredientId?: string) => Promise.resolve(ingredientId ? [{
      id: 'movement-1', ingredientId, ingredientName: 'Aceite', quantity: 2, unitId: 'unit-1',
      unitSymbol: 'L', movementType: 'adjustment', referenceType: 'manual', referenceId: null,
      notes: 'Conteo físico', createdBy: 'owner-1', createdAt: '2026-09-01T12:00:00Z',
    }] : []))
    mocks.getUnits.mockResolvedValue([{ id: 'unit-1', name: 'Litro', symbol: 'L' }])
    mocks.adjustStock.mockResolvedValue(undefined)
    mocks.updateIngredient.mockResolvedValue(undefined)
    mocks.updateIngredientCost.mockResolvedValue(undefined)
  })

  it('muestra únicamente los movimientos del artículo seleccionado', async () => {
    renderInventory()
    const button = await screen.findByRole('button', { name: 'Ver movimientos de Aceite' })
    fireEvent.click(button)
    expect(await screen.findByText('Conteo físico')).toBeInTheDocument()
    expect(mocks.getStockMovements).toHaveBeenCalledWith('ingredient-1')
  })

  it('edita el nombre, clasificación y costo sin sobrescribir el stock', async () => {
    renderInventory()
    fireEvent.click(await screen.findByRole('button', { name: 'Editar Aceite' }))
    fireEvent.change(await screen.findByLabelText('Nombre'), { target: { value: 'Aceite vegetal' } })
    fireEvent.change(screen.getByLabelText('Costo por unidad (USD)'), { target: { value: '5.5' } })
    fireEvent.change(screen.getByLabelText('Clasificación'), { target: { value: 'beverage' } })
    fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }))

    await waitFor(() => expect(mocks.updateIngredient).toHaveBeenCalledWith('ingredient-1', {
      name: 'Aceite vegetal', inventory_class: 'beverage',
    }))
    expect(mocks.updateIngredientCost).toHaveBeenCalledWith('ingredient-1', 5.5, 'owner-1')
  })

  it('registra entradas y salidas como movimientos manuales con motivo', async () => {
    renderInventory()
    fireEvent.click(await screen.findByRole('button', { name: 'Descontar inventario de Aceite' }))
    fireEvent.change(screen.getByLabelText('Cantidad (L)'), { target: { value: '1.25' } })
    fireEvent.change(screen.getByLabelText('Motivo del ajuste'), { target: { value: 'Merma verificada' } })
    fireEvent.click(screen.getByRole('button', { name: 'Registrar salida' }))

    await waitFor(() => expect(mocks.adjustStock).toHaveBeenCalledWith({
      ingredientId: 'ingredient-1', quantity: -1.25, unitId: 'unit-1', movementType: 'adjustment',
      referenceType: 'manual', notes: 'Merma verificada',
    }))
  })
})
