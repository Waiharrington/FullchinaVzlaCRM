import { describe, expect, it } from 'vitest'
import type { Product } from './dataService'
import { groupMenuProducts } from './menuGrouping'

function product(id: string, name: string, price: number, category = 'arroz'): Product {
  return { id, name, price, category, description: null, cost: null, emoji: '🍚', active: true, imageUrl: null }
}

describe('groupMenuProducts', () => {
  it('muestra cada presentación como una tarjeta independiente', () => {
    const groups = groupMenuProducts([
      product('a1', 'Arroz Frito Especial — Full Kilo', 18),
      product('a2', 'Arroz Frito Especial — Medio Kilo', 10),
      product('a3', "Arroz Frito Especial — Pa'Mí (350g)", 6),
    ])

    expect(groups).toHaveLength(3)
    expect(groups.map(group => group.variants[0].product.id)).toEqual(['a1', 'a2', 'a3'])
    expect(groups.every(group => !group.isGrouped)).toBe(true)
  })

  it('mantiene separados los productos con nombres parecidos', () => {
    const groups = groupMenuProducts([
      product('t1', 'Trío', 6, 'plato'),
      product('t2', 'Trío con Camarón', 8, 'plato'),
    ])

    expect(groups).toHaveLength(2)
    expect(groups.map(group => group.variants[0].label)).toEqual(['Trío', 'Trío con Camarón'])
  })

  it('deja los platos independientes como tarjetas directas', () => {
    const groups = groupMenuProducts([
      product('p1', 'Pa Ti', 5.5, 'plato'),
      product('p2', 'Plato 1', 7, 'plato'),
      product('p3', 'Plato 2', 8, 'plato'),
    ])

    expect(groups).toHaveLength(3)
    expect(groups.every(group => !group.isGrouped)).toBe(true)
  })
})
