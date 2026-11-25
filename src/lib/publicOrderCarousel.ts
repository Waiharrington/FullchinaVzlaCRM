import type { SellableProduct, Product } from './dataService'
import { groupMenuProducts, type MenuProductGroup } from './menuGrouping'
import { normalizeForSearch } from './textFormat'

const MAX_PUBLIC_CAROUSEL_GROUPS = 8

export function selectPublicCarouselGroups<T>(selectedGroups: T[], automaticGroups: T[], selectionConfigured: boolean): T[] {
  return selectedGroups.length > 0 || selectionConfigured ? selectedGroups : automaticGroups
}

export function preserveEmptyPublicCarousel<T>(sourceGroups: T[], allGroups: T[], selectionConfigured: boolean): T[] {
  if (sourceGroups.length > 0) return sourceGroups
  return selectionConfigured ? [] : allGroups
}

/**
 * Platos del carrusel de una sección: primero los que eligió el negocio y, si
 * son pocos, otros de la misma sección. Nunca repite un plato ni una foto.
 */
export function completePublicCarousel(selectedGroups: MenuProductGroup[], sectionGroups: MenuProductGroup[]): MenuProductGroup[] {
  const keys = new Set<string>()
  const images = new Set<string>()
  return [...selectedGroups, ...sectionGroups].filter(group => {
    const image = group.variants[0]?.product.imageUrl
    if (keys.has(group.key) || (image && images.has(image))) return false
    keys.add(group.key)
    if (image) images.add(image)
    return true
  }).slice(0, MAX_PUBLIC_CAROUSEL_GROUPS)
}

/** Resolves the products currently shown when no manual carousel is configured. */
export function getAutomaticPublicCarouselProductIds(products: SellableProduct[]): string[] {
  const eligible: Product[] = products
    .filter(product => product.isActive && product.publicVisible !== false && !product.isDelivery && product.salePrice >= 0.5)
    .map(product => ({
      id: product.id,
      name: product.name,
      description: product.description,
      price: product.salePrice,
      cost: product.cost,
      category: product.category,
      categories: product.categories,
      emoji: product.emoji,
      active: true,
      imageUrl: product.imageUrl,
      allowProteinExtras: product.allowProteinExtras,
      menuLabel: product.menuLabel,
      publicVisible: product.publicVisible,
      publicCarousel: false,
      publicCarouselOrder: 0,
    }))

  return groupMenuProducts(eligible)
    .map(group => ({
      ...group,
      variants: group.variants.filter(variant => variant.product.publicVisible !== false),
    }))
    .filter(group => group.variants.length > 0)
    .sort((a, b) => a.key.localeCompare(b.key))
    .slice(0, MAX_PUBLIC_CAROUSEL_GROUPS)
    .map(group => {
      const groupName = normalizeForSearch(group.name)
      const preferredVariant = group.variants.find(variant => {
        const variantName = normalizeForSearch(variant.product.name)
        if (groupName === 'costillas') return !variantName.includes('1 unidad') && !variantName.includes('1/2')
        if (groupName === 'lumpias') return variantName.includes('sencilla')
        return false
      })
      return (preferredVariant ?? group.variants[0]).product.id
    })
}
