import { describe, expect, it } from 'vitest'
import type { Product } from '../../lib/dataService'
import { addProductToCart, adjustCartQuantity, cartTotal, filterQuickOrderProducts, removeCartLine } from './quickOrder'

const product = (id: string, name: string, price: number) => ({ id, name, price, emoji: '🍜' }) as Product

describe('carrito del pedido rápido', () => {
  it('agrega un producto nuevo con cantidad 1', () => {
    const cart = addProductToCart([], product('a', 'Trío', 5.99))
    expect(cart).toHaveLength(1)
    expect(cart[0]).toMatchObject({ productId: 'a', lineId: 'a', quantity: 1, price: 5.99 })
  })

  it('suma cantidad si el producto ya estaba', () => {
    const once = addProductToCart([], product('a', 'Trío', 5.99))
    const twice = addProductToCart(once, product('a', 'Trío', 5.99))
    expect(twice).toHaveLength(1)
    expect(twice[0].quantity).toBe(2)
  })

  it('ajusta la cantidad y quita la línea al llegar a cero', () => {
    const cart = addProductToCart(addProductToCart([], product('a', 'Trío', 5)), product('b', 'Dúo', 8.5))
    expect(adjustCartQuantity(cart, 'a', 2).find(i => i.lineId === 'a')?.quantity).toBe(3)
    expect(adjustCartQuantity(cart, 'a', -1).map(i => i.lineId)).toEqual(['b'])
  })

  it('quita una línea y calcula el total', () => {
    let cart = addProductToCart([], product('a', 'Trío', 5))
    cart = addProductToCart(cart, product('a', 'Trío', 5))
    cart = addProductToCart(cart, product('b', 'Dúo', 8.5))
    expect(cartTotal(cart)).toBe(18.5)
    expect(cartTotal(removeCartLine(cart, 'a'))).toBe(8.5)
    expect(cartTotal([])).toBe(0)
  })

  it('filtra productos sin importar acentos ni mayúsculas y limita a 40', () => {
    const list = [product('a', 'Trío', 5), product('b', 'Pollo Agridulce', 6)]
    expect(filterQuickOrderProducts(list, 'trio').map(p => p.id)).toEqual(['a'])
    expect(filterQuickOrderProducts(list, '').length).toBe(2)
    const many = Array.from({ length: 60 }, (_, i) => product(String(i), `Plato ${i}`, 1))
    expect(filterQuickOrderProducts(many, '')).toHaveLength(40)
  })
})
