import { CupSoda, Flame, Star, Zap } from 'lucide-react'
import type { MenuProductGroup } from './menuGrouping'
import type { ProductModifierGroup, Product } from './dataService'
import type { WebOrderCartItem } from './publicOrders'
import { isIncludedProteinGroup } from './publicOrderRules'
import { publicVariantLabel } from './publicMenuLabels'
import { formatProductTitle, formatSpanishText, normalizeForSearch } from './textFormat'

// Métodos de pago que el cliente puede indicar en la web. Los códigos coinciden
// con los del sistema de cobro para poder pre-seleccionarlos en la comanda.
export const PAY_OPTIONS = [
  { code: 'cash', label: 'Efectivo' },
  { code: 'mobile', label: 'Pago móvil' },
  { code: 'transfer', label: 'Transferencia' },
  { code: 'card', label: 'Punto' },
  { code: 'binance', label: 'Binance' },
] as const
export type PayMethod = (typeof PAY_OPTIONS)[number]['code']
export const payLabel = (code: string) => PAY_OPTIONS.find((o) => o.code === code)?.label ?? code

export function productImage(_category?: string) {
  void _category
  return '/optimized/menu-product-placeholder.webp'
}

export function optimizedProductImage(imageUrl: string | null | undefined) {
  if (!imageUrl) return null
  const match = imageUrl.match(/^\/productos\/([^/?#]+)\.(?:png|jpe?g|webp)([?#].*)?$/i)
  return match ? `/optimized/productos/${match[1]}.webp${match[2] || ''}` : imageUrl
}

export function isProteinCatalogExtra(product: Product) {
  const name = normalizeForSearch(product.name)
  return /\b(extra|adicional)\b/.test(name)
    && /\b(proteina|pollo|camaron|carne|cerdo|jamon|res|tofu)\b/.test(name)
}

export function filterProteinExtraGroups(groups: ProductModifierGroup[], enabled: boolean) {
  if (enabled) return groups
  return groups.filter(group => {
    if (isIncludedProteinGroup(group)) return true
    const name = normalizeForSearch(group.name)
    const proteinGroup = name.includes('proteina')
    const optionalExtra = name.includes('extra') || group.minSelections === 0
    return !(proteinGroup && optionalExtra)
  })
}

export function previewImageSource(source: string) {
  const match = source.match(/^\/optimized\/(productos|fondos|login-carousel)\/([^?#]+\.webp)([?#].*)?$/i)
  return match ? `/optimized/previews/${match[1]}/${match[2]}${match[3] || ''}` : null
}

export const USD_FORMATTER = new Intl.NumberFormat('es-VE', { style: 'currency', currency: 'USD' })
export const BS_FORMATTER = new Intl.NumberFormat('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export function money(value: number) {
  return USD_FORMATTER.format(value)
}

export function productTitle(name: string) {
  // Keep the em dash with the variant that follows it. This lets the line
  // break happen before the dash instead of leaving a dangling dash above.
  return formatProductTitle(name).replace(/\s+—\s+/g, ' —\u00a0')
}

export function groupDescription(group: MenuProductGroup) {
  if (group.isGrouped) return group.variants.map(item => formatSpanishText(item.label)).join(' • ')
  return group.variants[0].product.description || ''
}

export const menuLabelMeta = {
  top_sales: { text: 'Más vendido', icon: Flame, className: 'top-sales' },
  new: { text: 'Nuevo', icon: Zap, className: 'new' },
  recommended: { text: 'Recomendado', icon: Star, className: 'recommended' },
  free_drink: { text: 'Refresco gratis', icon: CupSoda, className: 'free-drink' },
} as const

export function cartProductName(name: string) {
  const parts = productTitle(name).split(/\s+—\s+/)
  if (parts.length > 1) {
    const variant = parts.slice(1).join(' — ')
    return `${parts[0]} — ${publicVariantLabel(parts[0], variant)}`
  }
  return productTitle(name)
}

export function cartLineKey(item: Pick<WebOrderCartItem, 'productId' | 'notes' | 'modifiers'>) {
  const mods = [...(item.modifiers ?? [])].sort((a, b) => a.optionId.localeCompare(b.optionId)).map(m => `${m.optionId}:${m.quantity}`).join(',')
  return `${item.productId}::${item.notes || ''}::${mods}`
}
