import { describe, expect, it } from 'vitest'
import { appendRequiredOrderMetadata, calculateModifierTotal, countModifierSelections, getModifierSelectionError, hasInvalidModifierSelection } from './publicOrderRules'
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
