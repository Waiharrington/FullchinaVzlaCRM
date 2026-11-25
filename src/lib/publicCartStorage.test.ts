import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Product } from './dataService'
import { CART_KEY, CATALOG_CACHE_KEY } from './publicMenuConfig'
import { restoreCartImages, savePublicCart, saveToStorage } from './publicCartStorage'
import type { WebOrderCartItem } from './publicOrders'

const PHOTO = `data:image/webp;base64,${'A'.repeat(1000)}`
const item = (productId: string, imageUrl?: string): WebOrderCartItem =>
  ({ productId, productName: 'Plato', price: 5, quantity: 2, imageUrl, notes: 'sin cebollín', modifiers: [{ optionId: 'a', quantity: 1 }] })
const product = (id: string, imageUrl: string | null) => ({ id, imageUrl }) as unknown as Product

describe('publicCartStorage', () => {
  beforeEach(() => localStorage.clear())
  afterEach(() => vi.restoreAllMocks())

  it('guarda el pedido completo menos las fotos incrustadas', () => {
    expect(savePublicCart([item('1', PHOTO), item('2', '/optimized/productos/x.webp')])).toBe(true)
    const saved = JSON.parse(localStorage.getItem(CART_KEY) || '[]') as WebOrderCartItem[]
    expect(saved[0]).toEqual({ ...item('1'), imageUrl: undefined })
    expect(saved[1].imageUrl).toBe('/optimized/productos/x.webp')
  })

  it('sin espacio, libera la copia del menú y conserva el pedido', () => {
    localStorage.setItem(CATALOG_CACHE_KEY, 'menu')
    const original = Storage.prototype.setItem
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (this: Storage, key: string, value: string) {
      if (this.getItem(CATALOG_CACHE_KEY)) throw new DOMException('lleno', 'QuotaExceededError')
      original.call(this, key, value)
    })
    expect(savePublicCart([item('1')])).toBe(true)
    expect(localStorage.getItem(CATALOG_CACHE_KEY)).toBeNull()
    expect(localStorage.getItem(CART_KEY)).toContain('"productId":"1"')
  })

  it('nunca lanza aunque el almacenamiento esté bloqueado', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new DOMException('bloqueado', 'QuotaExceededError') })
    expect(saveToStorage('x', 'y')).toBe(false)
  })

  it('recupera las fotos desde el menú sin tocar lo demás', () => {
    const cart = [item('1'), item('2', '/otra.webp'), item('3')]
    const restored = restoreCartImages(cart, [product('1', PHOTO), product('2', PHOTO), product('3', null)])
    expect(restored.map(line => line.imageUrl)).toEqual([PHOTO, '/otra.webp', undefined])
    expect({ ...restored[0], imageUrl: undefined }).toEqual(cart[0])
  })

  it('devuelve el mismo carrito cuando no hay nada que recuperar', () => {
    const cart = [item('3')]
    expect(restoreCartImages(cart, [product('3', null)])).toBe(cart)
  })
})
