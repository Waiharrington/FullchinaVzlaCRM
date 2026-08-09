import { describe, expect, it } from 'vitest'
import type { Product } from './dataService'
import { groupMenuProducts } from './menuGrouping'

function product(id: string, name: string, price: number, category = 'arroz'): Product {
  return { id, name, price, category, description: null, cost: null, emoji: '🍚', active: true }
}

describe('groupMenuProducts', () => {
  it('agrupa presentaciones pero conserva sus productos e IDs reales', () => {
    const groups = groupMenuProducts([
      product('a1', 'Arroz Frito Especial — Full Kilo', 18),
      product('a2', 'Arroz Frito Especial — Medio Kilo', 10),
      product('a3', "Arroz Frito Especial — Pa'Mí (350g)", 6),
    ])

    expect(groups).toHaveLength(1)
    expect(groups[0].name).toBe('Arroz Frito Especial')
    expect(groups[0].variants.map(item => item.product.id)).toEqual(['a3', 'a2', 'a1'])
    expect(groups[0].minPrice).toBe(6)
  })

  it('combina el Trío base como Clásico cuando existe otra variante', () => {
    const groups = groupMenuProducts([
      product('t1', 'Trío', 6, 'plato'),
      product('t2', 'Trío con Camarón', 8, 'plato'),
    ])

    expect(groups).toHaveLength(1)
    expect(groups[0].variants.map(item => item.label)).toEqual(['Clásico', 'con Camarón'])
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
