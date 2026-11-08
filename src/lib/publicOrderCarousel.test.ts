import { describe, expect, it } from 'vitest'
import type { SellableProduct } from './dataService'
import { getAutomaticPublicCarouselProductIds, preserveEmptyPublicCarousel, selectPublicCarouselGroups } from './publicOrderCarousel'

describe('carousel configuration state', () => {
  it('shows current automatic products until an owner saves an explicit selection', () => {
    expect(selectPublicCarouselGroups([], ['auto'], false)).toEqual(['auto'])
    expect(selectPublicCarouselGroups(['picked'], ['auto'], false)).toEqual(['picked'])
  })

  it('keeps an intentionally empty selection empty instead of restoring automatic products', () => {
    expect(selectPublicCarouselGroups([], ['auto'], true)).toEqual([])
    expect(preserveEmptyPublicCarousel([], ['auto'], true)).toEqual([])
    expect(preserveEmptyPublicCarousel([], ['auto'], false)).toEqual(['auto'])
  })
})

function product(id: string, name: string, overrides: Partial<SellableProduct> = {}): SellableProduct {
  return {
    id,
    name,
    description: null,
    salePrice: 5,
    cost: null,
    category: 'platos',
    categories: ['platos'],
    emoji: '🥡',
    isActive: true,
    imageUrl: null,
    isDelivery: false,
    allowProteinExtras: true,
    menuLabel: null,
    publicVisible: true,
    publicCarousel: false,
    publicCarouselOrder: 0,
    ...overrides,
  }
}

describe('automatic public carousel selection', () => {
  it('matches the public fallback order, filters unavailable products and caps the eight visible groups', () => {
    const products = [
      ...Array.from({ length: 10 }, (_, index) => product(`p${index}`, `Plato ${String(index).padStart(2, '0')}`)),
      product('hidden', 'A escondido', { publicVisible: false }),
      product('inactive', 'A inactivo', { isActive: false }),
      product('delivery', 'A delivery', { isDelivery: true }),
      product('cheap', 'A barato', { salePrice: 0.49 }),
    ]

    expect(getAutomaticPublicCarouselProductIds(products)).toEqual(
      Array.from({ length: 8 }, (_, index) => `p${index}`),
    )
  })

  it('uses the same preferred variant for ribs and lumpias as the customer carousel', () => {
    const products = [
      product('costilla-unit', 'Costillas — 1 unidad'),
      product('costilla-racion', 'Costillas — Ración'),
      product('lumpia-racion', 'Lumpias — Ración'),
      product('lumpia-individual', 'Lumpias — Sencilla'),
    ]

    expect(getAutomaticPublicCarouselProductIds(products)).toEqual(['costilla-racion', 'lumpia-individual'])
  })
})
