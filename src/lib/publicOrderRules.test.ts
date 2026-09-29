import { describe, expect, it } from 'vitest'
import { appendRequiredOrderMetadata, calculateModifierTotal, countModifierSelections, getDefaultModifierSelection, getModifierSelectionError, hasInvalidModifierSelection, isIncludedProteinGroup, replaceIncludedProteinPortion } from './publicOrderRules'
import type { ProductModifierGroup } from './dataService'

const groups: ProductModifierGroup[] = [
  { modifierId: 'size', name: 'Tamaño', minSelections: 1, maxSelections: 1, allowRepeat: false, options: [
    { id: 'medio', name: 'Medio', price: 0 }, { id: 'full', name: 'Full', price: 4 },
  ] },
  { modifierId: 'extra', name: 'Extras', minSelections: 0, maxSelections: null, allowRepeat: true, options: [
    { id: 'shrimp', name: 'Camarón', price: 2.5 }, { id: 'egg', name: 'Huevo', price: 1 },
  ] },
]

describe('reglas de opciones del pedido público', () => {
  it('preselecciona una porción de cada proteína de cualquier plato y mantiene el total configurado', () => {
    const proteins: ProductModifierGroup = {
      modifierId: 'proteins', name: 'Proteínas incluidas · Arroz Chaufa', minSelections: 4,
      maxSelections: 4, allowRepeat: true, options: [
        { id: 'chicken', name: 'Pollo', price: 0 },
        { id: 'shrimp', name: 'Camarón', price: 0 },
        { id: 'ham', name: 'Jamón', price: 0 },
        { id: 'pork', name: 'Cerdo', price: 0 },
      ],
    }
    const defaults = getDefaultModifierSelection([proteins])
    expect(isIncludedProteinGroup(proteins)).toBe(true)
    expect(defaults).toEqual({ chicken: 1, shrimp: 1, ham: 1, pork: 1 })
    expect(countModifierSelections(proteins, defaults)).toBe(4)
    expect(getModifierSelectionError([proteins], defaults)).toBeNull()
    expect(getModifierSelectionError([proteins], { chicken: 2, shrimp: 1, ham: 1 })).toBeNull()
    expect(getModifierSelectionError([proteins], { chicken: 1, shrimp: 1, ham: 1 })).toBe(proteins)
    expect(getModifierSelectionError([proteins], { chicken: 2, shrimp: 2, ham: 1 })).toBe(proteins)
  })

  it('adapta las proteínas predeterminadas cuando otro plato incluye dos porciones', () => {
    const proteins: ProductModifierGroup = {
      modifierId: 'rice-proteins', name: 'Proteínas incluidas · Arroz Mediano', minSelections: 2,
      maxSelections: 2, allowRepeat: true, options: [
        { id: 'rice-chicken', name: 'Pollo', price: 0 },
        { id: 'rice-shrimp', name: 'Camarón', price: 0 },
      ],
    }
    const defaults = getDefaultModifierSelection([proteins])
    expect(defaults).toEqual({ 'rice-chicken': 1, 'rice-shrimp': 1 })
    expect(countModifierSelections(proteins, defaults)).toBe(2)
    expect(getModifierSelectionError([proteins], defaults)).toBeNull()
  })

  it('reemplaza una proteína por otra sin cambiar el total de porciones', () => {
    const proteins: ProductModifierGroup = {
      modifierId: 'proteins', name: 'Proteínas incluidas', minSelections: 4,
      maxSelections: 4, allowRepeat: true, options: [
        { id: 'pollo', name: 'Pollo', price: 0 },
        { id: 'shrimp', name: 'Camarón', price: 0 },
        { id: 'ham', name: 'Jamón', price: 0 },
        { id: 'pork', name: 'Cerdo', price: 0 },
      ],
    }
    const selection = { pollo: 1, shrimp: 1, ham: 1, pork: 1 }
    const swapped = replaceIncludedProteinPortion(selection, 'pork', 'pollo')
    expect(swapped).toEqual({ pollo: 2, shrimp: 1, ham: 1 })
    expect(Object.values(swapped).reduce((total, quantity) => total + quantity, 0)).toBe(4)
    expect(getModifierSelectionError([proteins], swapped)).toBeNull()
  })

  it('no aplica valores predeterminados a grupos que no sean proteínas incluidas', () => {
    expect(getDefaultModifierSelection(groups)).toEqual({})
    expect(isIncludedProteinGroup(groups[1])).toBe(false)
  })

  it('exige opciones obligatorias y respeta máximos por grupo', () => {
    expect(getModifierSelectionError(groups, {} )?.name).toBe('Tamaño')
    expect(getModifierSelectionError(groups, { medio: 1, full: 1 })?.name).toBe('Tamaño')
    expect(getModifierSelectionError(groups, { medio: 1 })).toBeNull()
  })

  it('permite repetición cuando el grupo lo autoriza y rechaza opciones stale', () => {
    expect(countModifierSelections(groups[1], { shrimp: 3 })).toBe(3)
    expect(getModifierSelectionError(groups, { medio: 1, shrimp: 3 })).toBeNull()
    expect(hasInvalidModifierSelection(groups, { medio: 1, removed_option: 1 })).toBe(true)
  })

  it('calcula el importe exacto de las opciones multiplicando su cantidad', () => {
    expect(calculateModifierTotal(groups, { medio: 1, shrimp: 2, egg: 1 })).toBe(6)
  })

  it('mantiene bloqueado un grupo obligatorio mal configurado sin opciones activas', () => {
    const unavailable = [{ ...groups[0], options: [] }]
    expect(getModifierSelectionError(unavailable, {} )?.name).toBe('Tamaño')
  })

  it('preserva siempre la ubicación y el pago aunque las notas largas excedan el límite del servidor', () => {
    const map = '\nUbicación GPS: https://maps.google.com/?q=10.1,-66.9'
    const payment = '\nPago preferido: cash'
    const result = appendRequiredOrderMetadata('Comentario '.repeat(100), `${map}${payment}`)
    expect(result).toHaveLength(500)
    expect(result).toContain(map)
    expect(result.endsWith(payment)).toBe(true)
  })
})
