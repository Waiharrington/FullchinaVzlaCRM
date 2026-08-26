import { describe, expect, it } from 'vitest'
import { classifyMenuCategory, MENU_CATEGORY_ORDER } from './menuCategories'

describe('categorías editoriales del menú', () => {
  it('mantiene el orden acordado', () => {
    expect(MENU_CATEGORY_ORDER).toEqual([
      'promociones', 'bebidas', 'arroz', 'tallarines', 'pastas', 'chopsuey',
      'individuales', 'ejecutivos', 'raciones', 'extras', 'otros',
    ])
  })

  it('clasifica productos conocidos sin depender de tildes', () => {
    expect(classifyMenuCategory('Full Kilo Especial (1 kg)', 'arroz')).toBe('arroz')
    expect(classifyMenuCategory('Chop Suey Mixto', 'wok')).toBe('chopsuey')
    expect(classifyMenuCategory('Tallarín Veggie', 'noodles')).toBe('tallarines')
    expect(classifyMenuCategory('Vermiceli Especial', 'plato')).toBe('pastas')
    expect(classifyMenuCategory('Promo Trío', 'combo')).toBe('promociones')
    expect(classifyMenuCategory('Agua de 600 ml', 'extra')).toBe('bebidas')
    expect(classifyMenuCategory("Pa' Mí", 'plato')).toBe('individuales')
    expect(classifyMenuCategory('Camarones Crispy', 'wok')).toBe('raciones')
  })

  it('envía lo no identificado a Otros sin eliminarlo', () => {
    expect(classifyMenuCategory('Papas Fritas Especiales', 'extra')).toBe('otros')
    expect(classifyMenuCategory('Boloñesa Artesanal (Ejecutivo)', 'plato')).toBe('ejecutivos')
    expect(classifyMenuCategory('Arroz con Chuleta', 'plato')).toBe('otros')
  })
})
