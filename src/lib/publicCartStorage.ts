import type { Product } from './dataService'
import { CART_KEY, CATALOG_CACHE_KEY } from './publicMenuConfig'
import { optimizedProductImage } from './publicMenuFormat'
import type { WebOrderCartItem } from './publicOrders'

/**
 * Guarda sin tumbar la página si el navegador no tiene espacio. La copia del
 * menú es lo único grande y se descarga sola otra vez, así que se sacrifica
 * antes de perder el pedido del cliente.
 */
export function saveToStorage(key: string, value: string): boolean {
  try {
    localStorage.setItem(key, value)
    return true
  } catch { /* sin espacio o almacenamiento bloqueado */ }
  try {
    localStorage.removeItem(CATALOG_CACHE_KEY)
    localStorage.setItem(key, value)
    return true
  } catch {
    return false
  }
}

/** Las fotos incrustadas pesan unos 60 KB por plato: no se guardan con el pedido. */
export function withoutEmbeddedImages(cart: WebOrderCartItem[]): WebOrderCartItem[] {
  return cart.map(item => item.imageUrl?.startsWith('data:') ? { ...item, imageUrl: undefined } : item)
}

export function savePublicCart(cart: WebOrderCartItem[]): boolean {
  return saveToStorage(CART_KEY, JSON.stringify(withoutEmbeddedImages(cart)))
}

/** Devuelve la foto del menú a los platos guardados sin ella; si nada cambia, devuelve el mismo carrito. */
export function restoreCartImages(cart: WebOrderCartItem[], products: Product[]): WebOrderCartItem[] {
  if (cart.every(item => item.imageUrl)) return cart
  const images = new Map(products.map(product => [product.id, optimizedProductImage(product.imageUrl)]))
  let changed = false
  const restored = cart.map(item => {
    const imageUrl = item.imageUrl ? null : images.get(item.productId)
    if (!imageUrl) return item
    changed = true
    return { ...item, imageUrl }
  })
  return changed ? restored : cart
}
