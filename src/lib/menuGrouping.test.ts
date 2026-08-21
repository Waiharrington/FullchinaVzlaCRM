import { describe, expect, it } from 'vitest'
import type { Product } from './dataService'
import { groupMenuProducts } from './menuGrouping'

function product(id: string, name: string, price: number, category = 'arroz'): Product {
  return { id, name, price, category, description: null, cost: null, emoji: '🍚', active: true, imageUrl: null }
}

describe('groupMenuProducts', () => {
  it('agrupa las presentaciones (medio / 1 kilo) de un mismo plato en una tarjeta', () => {
    const groups = groupMenuProducts([
      product('a1', 'Arroz Frito Especial — Full Kilo', 18),
      product('a2', 'Arroz Frito Especial — Medio Kilo', 10),
      product('a3', "Arroz Frito Especial — Pa'Mí (350g)", 6),
    ])

    expect(groups).toHaveLength(1)
    expect(groups[0].isGrouped).toBe(true)
    expect(groups[0].name).toBe('Arroz Frito Especial')
    // Ordenadas por precio ascendente.
    expect(groups[0].variants.map(group => group.product.id)).toEqual(['a3', 'a2', 'a1'])
    expect(groups[0].minPrice).toBe(6)
    expect(groups[0].maxPrice).toBe(18)
  })

  it('deja como tarjeta simple un plato con una sola presentación', () => {
    const groups = groupMenuProducts([
      product('s1', 'Sopa de Fideos', 4, 'raciones'),
    ])

    expect(groups).toHaveLength(1)
    expect(groups[0].isGrouped).toBe(false)
    expect(groups[0].name).toBe('Sopa de Fideos')
  })

  it('mantiene separados los platos independientes distintos', () => {
    const groups = groupMenuProducts([
      product('p1', 'Pa Ti', 5.5, 'plato'),
      product('p2', 'Plato 1', 7, 'plato'),
      product('p3', 'Plato 2', 8, 'plato'),
    ])

    expect(groups).toHaveLength(3)
    expect(groups.every(group => !group.isGrouped)).toBe(true)
  })
})
