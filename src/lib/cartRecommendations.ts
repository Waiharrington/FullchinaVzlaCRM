import type { WebOrderCartItem } from './publicOrders'
import type { MenuProductGroup } from './menuGrouping'
import { classifyMenuCategory, type MenuCategory } from './menuCategories'
import { normalizeForSearch } from './textFormat'

const MAIN_CATEGORIES = new Set<MenuCategory>([
  'arroz', 'tallarines', 'pastas', 'chopsuey', 'individuales', 'ejecutivos',
])
const COMBO_COMPLEMENT_CATEGORIES: MenuCategory[] = ['bebidas', 'raciones', 'chopsuey', 'extras']
const MAIN_COMPLEMENT_CATEGORIES: MenuCategory[] = ['bebidas', 'raciones', 'extras']
const MAIN_RECOMMENDATION_CATEGORIES: MenuCategory[] = [
  'promociones', 'arroz', 'individuales', 'tallarines', 'pastas', 'ejecutivos', 'chopsuey',
]

function categoryOf(group: MenuProductGroup): MenuCategory {
  return classifyMenuCategory(group.name, group.category)
}

function phraseForms(value: string) {
  const normalized = normalizeForSearch(value)
  if (!normalized) return []
  const singular = normalized.replace(/\b([a-z]+)s\b/g, '$1')
  return Array.from(new Set([normalized, singular].filter(phrase => phrase.length >= 4)))
}

function descriptionIncludesGroup(description: string, group: MenuProductGroup) {
  const normalizedDescription = ` ${normalizeForSearch(description)} `
  const names = [
    group.name,
    ...group.variants.flatMap(variant => [variant.label, variant.product.name]),
  ]

  return names
    .flatMap(phraseForms)
    .some(name => normalizedDescription.includes(` ${name} `))
}

function comboIncludesBeverage(description: string) {
  const normalized = normalizeForSearch(description)
  const mentionsDrink = /\b(bebida|refresco|agua|lipton)\b/.test(normalized)
  const explicitlyExcludesDrink = /\b(sin|no incluye|no trae)\s+(?:bebida|refresco|agua|lipton)\b/.test(normalized)
  return mentionsDrink && !explicitlyExcludesDrink
}

/**
 * Build a small, deterministic set of cart complements from the active public
 * catalog. Product descriptions are used to avoid offering items already
 * listed as part of a combo or dish.
 */
export function getCartRecommendations(
  cart: WebOrderCartItem[],
  catalogGroups: MenuProductGroup[],
  limit = 3,
): MenuProductGroup[] {
  if (cart.length === 0 || limit <= 0) return []

  const cartProductIds = new Set(cart.map(item => item.productId))
  const cartGroups = catalogGroups.filter(group =>
    group.variants.some(variant => cartProductIds.has(variant.product.id)),
  )
  // Preserve the intent even if a previously selected item is no longer in
  // today's active catalog: the saved cart line still carries its name.
  const cartCategories = new Set([
    ...cartGroups.map(categoryOf),
    ...cart.map(item => classifyMenuCategory(item.productName)),
  ])
  const hasCombo = cartCategories.has('promociones')
  const hasMain = Array.from(cartCategories).some(category => MAIN_CATEGORIES.has(category))
  const includedDescriptions = cartGroups.flatMap(group =>
    group.variants
      .filter(variant => cartProductIds.has(variant.product.id))
      .map(variant => variant.product.description ?? ''),
  )
  const comboHasBeverage = hasCombo && includedDescriptions.some(comboIncludesBeverage)

  const preferredCategories = hasCombo
    ? COMBO_COMPLEMENT_CATEGORIES
    : hasMain
      ? MAIN_COMPLEMENT_CATEGORIES
      : MAIN_RECOMMENDATION_CATEGORIES

  const candidates = catalogGroups.filter(group => {
    if (group.variants.some(variant => cartProductIds.has(variant.product.id))) return false

    const category = categoryOf(group)
    if (!preferredCategories.includes(category)) return false
    if (hasCombo && category === 'promociones') return false
    if (hasMain && MAIN_CATEGORIES.has(category)) return false
    if (comboHasBeverage && category === 'bebidas') return false

    return !includedDescriptions.some(description =>
      description && descriptionIncludesGroup(description, group),
    )
  })

  const rank = new Map(preferredCategories.map((category, index) => [category, index]))
  return candidates
    .sort((a, b) => (rank.get(categoryOf(a)) ?? 999) - (rank.get(categoryOf(b)) ?? 999))
    .slice(0, limit)
}
