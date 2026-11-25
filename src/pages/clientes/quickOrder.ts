import type { CartItem, Product } from '../../lib/dataService'
import { normalizeForSearch } from '../../lib/textFormat'

export const QUICK_ORDER_PRODUCT_LIMIT = 40

// Suma una unidad del producto; si ya está en el carrito, solo aumenta la cantidad.
export function addProductToCart(cart: CartItem[], product: Product): CartItem[] {
  const existing = cart.find(item => item.productId === product.id)
  if (existing) {
    return cart.map(item => item.productId === product.id ? { ...item, quantity: item.quantity + 1 } : item)
  }
  return [...cart, { productId: product.id, productName: product.name, price: product.price, quantity: 1, emoji: product.emoji, lineId: product.id }]
}

// Cambia la cantidad de una línea y elimina las que llegan a cero o menos.
export function adjustCartQuantity(cart: CartItem[], lineId: string, delta: number): CartItem[] {
  return cart
    .map(item => item.lineId === lineId ? { ...item, quantity: item.quantity + delta } : item)
    .filter(item => item.quantity > 0)
}

export function removeCartLine(cart: CartItem[], lineId: string): CartItem[] {
  return cart.filter(item => item.lineId !== lineId)
}

export function cartTotal(cart: CartItem[]): number {
  return cart.reduce((sum, item) => sum + item.price * item.quantity, 0)
}

export function filterQuickOrderProducts(products: Product[], search: string): Product[] {
  const query = normalizeForSearch(search)
  return products.filter(product => !query || normalizeForSearch(product.name).includes(query)).slice(0, QUICK_ORDER_PRODUCT_LIMIT)
}
