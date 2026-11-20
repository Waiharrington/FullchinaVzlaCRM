import { describe, expect, it } from 'vitest'
import type { Product } from './dataService'
import { groupMenuProducts, type MenuProductGroup } from './menuGrouping'
import type { WebOrderCartItem } from './publicOrders'
import { getCartCarouselGroups, getCartRecommendations } from './cartRecommendations'

function product(id: string, name: string, category: string, description: string | null = null): Product {
  return {
    id,
    name,
    category,
    categories: [category],
    description,
    price: 5,
    cost: null,
    emoji: '🍽️',
    active: true,
    imageUrl: null,
  }
}

function cartLine(item: Product): WebOrderCartItem {
  return { productId: item.id, productName: item.name, price: item.price, quantity: 1 }
}

function groups(...items: Product[]): MenuProductGroup[] {
  return groupMenuProducts(items)
}

describe('getCartRecommendations', () => {
  it('completa un combo con productos que no aparecen en su descripción', () => {
    const combo = product(
      'combo',
      'Promo Trío',
      'promociones',
      '2 platos tríos + 4 piezas pollo agridulce + 2 lumpias vegetales + bebida gratis.',
    )
    const candidates = groups(
      combo,
      product('drink', 'Refresco 1 Litro', 'bebidas'),
      product('chicken', 'Pollo Agridulce', 'raciones'),
      product('lumpia', 'Lumpias', 'raciones'),
      product('chop', 'Chop Suey Veggie', 'chopsuey'),
      product('nuggets', 'Nuggets', 'raciones'),
      product('combo-other', 'Promo Familiar', 'promociones'),
      product('rice', 'Arroz Camarón y Pollo', 'arroz'),
    )

    expect(getCartRecommendations([cartLine(combo)], candidates).map(group => group.name))
      .toEqual(['Nuggets', 'Chop Suey Veggie'])
  })

  it('si el carrito tiene arroz, ofrece bebida y ración antes que otro arroz o combo', () => {
    const rice = product('rice', 'Arroz Camarón y Pollo', 'arroz')
    const candidates = groups(
      rice,
      product('rice-other', 'Arroz Cantonés', 'arroz'),
      product('drink', 'Refresco 1 Litro', 'bebidas'),
      product('side', 'Pollo Agridulce', 'raciones'),
      product('combo', 'Promo Familiar', 'promociones'),
    )

    expect(getCartRecommendations([cartLine(rice)], candidates).map(group => group.name))
      .toEqual(['Refresco 1 Litro', 'Pollo Agridulce'])
  })

  it('si el carrito tiene Arroz Cantonés de Medio Kilo no ofrece promociones ni otros platos principales', () => {
    const rice = product('rice-half', 'Arroz Cantonés Medio Kilo', 'otros')
    const candidates = groups(
      rice,
      product('promo', 'Promo Full Kilo y Refresco', 'promociones'),
      product('drink', 'Agua', 'bebidas'),
      product('tea', 'Lipton Tea', 'bebidas'),
      product('side', 'Pollo Agridulce', 'raciones'),
      product('chop', 'Chop Suey Especial', 'chopsuey'),
      product('other-rice', 'Arroz Especial Full Kilo', 'arroz'),
    )

    expect(getCartRecommendations([cartLine(rice)], candidates).map(group => group.name))
      .toEqual(['Agua', 'Lipton Tea', 'Pollo Agridulce'])
  })

  it('si el carrito solo tiene bebidas o raciones, sugiere platos principales y combos', () => {
    const drink = product('drink', 'Refresco 1 Litro', 'bebidas')
    const candidates = groups(
      drink,
      product('rice', 'Arroz Camarón y Pollo', 'arroz'),
      product('combo', 'Promo Familiar', 'promociones'),
      product('side', 'Pollo Agridulce', 'raciones'),
    )

    expect(getCartRecommendations([cartLine(drink)], candidates).map(group => group.name))
      .toEqual(['Promo Familiar', 'Arroz Camarón y Pollo'])
  })

  it('no propone productos del mismo grupo ya escogido ni devuelve relleno irrelevante', () => {
    const trio = product('trio', 'Trío', 'individuales')
    const candidates = groups(
      trio,
      product('trio-other', 'Trío — Especial', 'individuales'),
      product('rice', 'Arroz Cantonés', 'arroz'),
      product('side', 'Lumpias', 'raciones'),
    )

    expect(getCartRecommendations([cartLine(trio)], candidates).map(group => group.name))
      .toEqual(['Lumpias'])
    expect(getCartRecommendations([], candidates)).toEqual([])
  })
})

describe('getCartCarouselGroups', () => {
  it('pone primero los complementos y luego el resto del menú, sin repetir lo que ya está en el carrito', () => {
    const rice = product('rice', 'Arroz Camarón y Pollo', 'arroz')
    const catalog = groups(
      rice,
      product('rice-other', 'Arroz Cantonés', 'arroz'),
      product('drink', 'Refresco 1 Litro', 'bebidas'),
      product('side', 'Pollo Agridulce', 'raciones'),
      product('combo', 'Promo Familiar', 'promociones'),
    )
    const names = getCartCarouselGroups([cartLine(rice)], catalog).map(group => group.name)
    const featured = getCartRecommendations([cartLine(rice)], catalog, catalog.length).map(group => group.name)

    expect(names.slice(0, featured.length)).toEqual(featured)
    expect(names).not.toContain('Arroz Camarón y Pollo')
    expect(new Set(names).size).toBe(names.length)
    expect(names).toHaveLength(catalog.length - 1)
  })

  it('no muestra nada con el carrito vacío', () => {
    expect(getCartCarouselGroups([], groups(product('drink', 'Refresco 1 Litro', 'bebidas')))).toEqual([])
  })
})
