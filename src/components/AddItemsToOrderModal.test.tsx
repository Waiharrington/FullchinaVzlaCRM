import { fireEvent, render, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Product, ProductModifierGroup } from '../lib/dataService'
import { AddItemsToOrderModal } from './AddItemsToOrderModal'

const product = (id: string, name: string, imageUrl: string | null, price = 1.5): Product => ({
  id, name, description: null, price, cost: null, category: 'extras', categories: ['extras'], emoji: '', active: true, imageUrl,
})

const mocks = vi.hoisted(() => ({
  getProducts: vi.fn(),
  getProductsWithModifiers: vi.fn(),
  getProductModifiers: vi.fn(),
  addItemsToOrder: vi.fn(),
}))

vi.mock('../lib/dataService', async () => {
  const actual = await vi.importActual<typeof import('../lib/dataService')>('../lib/dataService')
  return {
    ...actual,
    getProducts: mocks.getProducts,
    getProductsWithModifiers: mocks.getProductsWithModifiers,
    getProductModifiers: mocks.getProductModifiers,
    addItemsToOrder: mocks.addItemsToOrder,
  }
})

vi.mock('../lib/liveDataRefresh', () => ({ useLiveDataRefresh: () => undefined }))
vi.mock('../context/rates-context', () => ({ useRates: () => ({ bcvRate: 918.77 }) }))

const proteins: ProductModifierGroup = {
  modifierId: 'proteinas',
  name: 'Proteínas incluidas · Full Kilo',
  minSelections: 0,
  maxSelections: 4,
  allowRepeat: true,
  options: [
    { id: 'pollo', name: 'Pollo', price: 0 },
    { id: 'camaron', name: 'Camarón', price: 0 },
    { id: 'jamon', name: 'Jamón', price: 0 },
    { id: 'cerdo', name: 'Cerdo', price: 0 },
  ],
}

describe('AddItemsToOrderModal · opciones con foto', () => {
  beforeEach(() => {
    mocks.getProducts.mockResolvedValue([
      product('full-kilo', 'Arroz Frito Especial — Full Kilo', '/fotos/full-kilo.webp', 11.8),
      product('extra-camaron', 'Extra de Camarón', '/fotos/extra-camaron.webp'),
      product('extra-cerdo', 'Extra de Cerdo', '/fotos/extra-cerdo.webp'),
      product('extra-pollo', 'Extras de Pollo', '/fotos/extra-pollo.webp'),
    ])
    mocks.getProductsWithModifiers.mockResolvedValue(new Set(['full-kilo']))
    mocks.getProductModifiers.mockResolvedValue([proteins])
  })

  it('muestra la foto de cada proteína y permite repartir las cantidades', async () => {
    render(<AddItemsToOrderModal orderId="o1" orderNumber="#FC-000620" onClose={vi.fn()} onAdded={vi.fn()} />)

    fireEvent.click(await screen.findByRole('button', { name: /Full Kilo/ }))
    expect(await screen.findByText('4 de 4')).toBeInTheDocument()
    expect(screen.getByText('Elige hasta 4')).toBeInTheDocument()

    const photoFor = (name: string) => [...document.body.querySelectorAll('.aito-optcard')]
      .find(card => card.querySelector('.aito-optcard-name')?.textContent === name)
      ?.querySelector('img')?.getAttribute('src') ?? undefined
    expect(photoFor('Camarón')).toBe('/fotos/extra-camaron.webp')
    expect(photoFor('Cerdo')).toBe('/fotos/extra-cerdo.webp')
    expect(photoFor('Pollo')).toBe('/fotos/extra-pollo.webp')
    expect(photoFor('Jamón')).toBeUndefined()

    // Con las 4 incluidas elegidas no se puede sumar otra hasta quitar una.
    expect(screen.getByRole('button', { name: 'Agregar Pollo' })).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: 'Quitar Jamón' }))
    expect(screen.getByText('3 de 4')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Agregar Pollo' }))

    const polloCard = [...document.body.querySelectorAll('.aito-optcard')]
      .find(card => card.querySelector('.aito-optcard-name')?.textContent === 'Pollo') as HTMLElement
    expect(within(polloCard).getByText('×2')).toBeInTheDocument()
    expect(screen.getByText('Pollo ×2, Camarón, Cerdo')).toBeInTheDocument()
  })
})
