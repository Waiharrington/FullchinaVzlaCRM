import { describe, expect, it } from 'vitest'
import { type Product } from './dataService'
import { groupMenuProducts } from './menuGrouping'
import { searchMenuGroups } from './menuSearch'

const product = (id: string, name: string, category: string, description = '') =>
  ({ id, name, category, categories: [category], description, price: 5 }) as unknown as Product

const groups = groupMenuProducts([
  product('1', 'Nuggets', 'raciones', '6 piezas con papas'),
  product('2', 'Promo Trío', 'promociones', 'Arroz frito, pollo agridulce y lumpias'),
  product('3', 'Cantonés', 'arroz', 'Con camarón y pollo'),
  product('4', 'Arroz Chino', 'arroz', 'Jamón y cerdo'),
  product('5', 'Lumpias — con Pollo', 'raciones'),
  product('6', 'Lumpias — con Camarón', 'raciones'),
  product('7', 'Tallarín Mixto', 'tallarines'),
  product('8', 'Pepsi', 'bebidas'),
])
const search = (term: string) => searchMenuGroups(groups, term).map(group => group.name)

describe('searchMenuGroups', () => {
  it('busca en todas las categorías y pone primero los nombres que coinciden', () => {
    expect(search('arroz')).toEqual(['Arroz Chino', 'Cantonés', 'Promo Trío'])
  })

  it('ignora mayúsculas, acentos, plurales y conectores', () => {
    expect(search('LUMPIA')).toContain('Lumpias')
    expect(search('camarones')).toEqual(['Lumpias', 'Cantonés'])
    expect(search('arroz con pollo')).toEqual(['Cantonés', 'Promo Trío'])
    expect(search('tallarines')).toEqual(['Tallarín Mixto'])
  })

  it('acepta las palabras en cualquier orden y mientras se escriben', () => {
    expect(search('pollo lumpia')).toContain('Lumpias')
    expect(search('arr')).toContain('Arroz Chino')
  })

  it('conserva todas las presentaciones del plato encontrado', () => {
    expect(searchMenuGroups(groups, 'lumpia camarón')[0].variants).toHaveLength(2)
  })

  it('perdona errores al escribir solo cuando no hay coincidencias', () => {
    expect(search('aroz')).toEqual(['Arroz Chino', 'Cantonés'])
    expect(search('tayarines')).toEqual(['Tallarín Mixto'])
    expect(search('pizza')).toEqual([])
  })

  it('sin texto devuelve el menú completo', () => {
    expect(searchMenuGroups(groups, '  ')).toHaveLength(groups.length)
  })
})
