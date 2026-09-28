import { describe, expect, it } from 'vitest'
import { publicVariantCopy, publicVariantLabel } from './publicMenuLabels'

describe('publicVariantLabel', () => {
  it('presenta claramente las seis opciones de lumpias sin acortar sus descripciones', () => {
    expect(publicVariantCopy('Lumpias', 'Extra')).toEqual({ name: 'Lumpia sencilla', count: 1 })
    expect(publicVariantCopy('Lumpias', 'Sencilla')).toEqual({ name: 'Lumpias sencillas', count: 2 })
    expect(publicVariantCopy('Lumpias', 'Especial Camarón')).toEqual({ name: 'Lumpias con camarón', count: 2 })
    expect(publicVariantCopy('Lumpias', 'Especial Carne')).toEqual({ name: 'Lumpias con carne', count: 2 })
    expect(publicVariantCopy('Lumpias', 'Especial Cerdo')).toEqual({ name: 'Lumpias con cerdo', count: 2 })
    expect(publicVariantCopy('Lumpias', 'Especial Pollo')).toEqual({ name: 'Lumpias con pollo', count: 2 })
    expect(publicVariantLabel('Lumpias', 'Especial Pollo')).toBe('Lumpias con pollo · ×2')
  })

  it('conserva los títulos de otros productos', () => {
    expect(publicVariantCopy('Arroz Cantonés', 'Medio Kilo')).toEqual({ name: 'Medio Kilo' })
  })
})
