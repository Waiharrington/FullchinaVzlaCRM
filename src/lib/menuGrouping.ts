import type { Product } from './dataService'

export interface MenuVariant {
  product: Product
  label: string
}

export interface MenuProductGroup {
  key: string
  name: string
  category: string
  variants: MenuVariant[]
  isGrouped: boolean
  minPrice: number
  maxPrice: number
}

export function groupMenuProducts(products: Product[]): MenuProductGroup[] {
  // Cada producto del menú impreso es una tarjeta independiente. Las
  // presentaciones no se esconden dentro de un selector de variantes: así el
  // cliente ve exactamente el mismo inventario que administra el negocio.
  return products.map(product => ({
    key: `product:${product.id}`,
    name: product.name,
    category: product.category,
    variants: [{ product, label: product.name }],
    isGrouped: false,
    minPrice: product.price,
    maxPrice: product.price,
  }))

}
