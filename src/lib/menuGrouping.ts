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

interface ParsedFamily {
  family: string
  variant: string
}

const NAMED_FAMILIES = [
  /^(Tr[ií]o)\s+(Cl[aá]sico|Con\s+Camar[oó]n)$/i,
  /^(Tallar[ií]n)\s+(Veggie|Mixto|Especial)$/i,
]

function normalizeKey(value: string) {
  return value.normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase()
}

function parseFamily(name: string): ParsedFamily | null {
  const separated = name.split(/\s+[—–]\s+/, 2)
  if (separated.length === 2 && separated[0].trim() && separated[1].trim()) {
    return { family: separated[0].trim(), variant: separated[1].trim() }
  }

  for (const pattern of NAMED_FAMILIES) {
    const match = name.match(pattern)
    if (match) return { family: match[1].trim(), variant: match[2].trim() }
  }

  return null
}

export function groupMenuProducts(products: Product[]): MenuProductGroup[] {
  const parsed = products.map(product => ({ product, family: parseFamily(product.name) }))
  const knownFamilies = new Map<string, string>()

  parsed.forEach(({ product, family }) => {
    if (family) knownFamilies.set(`${product.category}:${normalizeKey(family.family)}`, family.family)
  })

  const buckets = new Map<string, { name: string; category: string; variants: MenuVariant[] }>()

  parsed.forEach(({ product, family }) => {
    const standaloneFamily = knownFamilies.get(`${product.category}:${normalizeKey(product.name)}`)
    const resolved = family ?? (standaloneFamily ? { family: standaloneFamily, variant: 'Clásico' } : null)
    const key = resolved ? `family:${product.category}:${normalizeKey(resolved.family)}` : `product:${product.id}`
    const current = buckets.get(key) ?? {
      name: resolved?.family ?? product.name,
      category: product.category,
      variants: [],
    }
    current.variants.push({ product, label: resolved?.variant ?? product.name })
    buckets.set(key, current)
  })

  return Array.from(buckets.entries()).map(([key, bucket]) => {
    const prices = bucket.variants.map(variant => variant.product.price)
    const isGrouped = bucket.variants.length > 1

    if (!isGrouped) {
      const only = bucket.variants[0]
      return {
        key: `product:${only.product.id}`,
        name: only.product.name,
        category: only.product.category,
        variants: [{ ...only, label: only.product.name }],
        isGrouped: false,
        minPrice: only.product.price,
        maxPrice: only.product.price,
      }
    }

    return {
      key,
      name: bucket.name,
      category: bucket.category,
      variants: bucket.variants.sort((a, b) => a.product.price - b.product.price),
      isGrouped: true,
      minPrice: Math.min(...prices),
      maxPrice: Math.max(...prices),
    }
  })
}
