import { formatSpanishText, normalizeForSearch } from './textFormat'

export interface PublicVariantCopy {
  name: string
  count?: number
}

const LUMPIA_VARIANT_COPY: Record<string, PublicVariantCopy> = {
  extra: { name: 'Lumpia sencilla', count: 1 },
  sencilla: { name: 'Lumpias sencillas', count: 2 },
  'especial camaron': { name: 'Lumpias con camarón', count: 2 },
  'especial carne': { name: 'Lumpias con carne', count: 2 },
  'especial cerdo': { name: 'Lumpias con cerdo', count: 2 },
  'especial pollo': { name: 'Lumpias con pollo', count: 2 },
}

/** Copy clearer for lumpia presentations without changing catalog data. */
export function publicVariantCopy(groupName: string, variantLabel: string): PublicVariantCopy {
  const group = normalizeForSearch(groupName)
  const variant = normalizeForSearch(variantLabel)
  if (group === 'lumpia' || group === 'lumpias') {
    return LUMPIA_VARIANT_COPY[variant] ?? { name: formatSpanishText(variantLabel) }
  }
  return { name: formatSpanishText(variantLabel) }
}

/** Compact cart copy; quantity stays distinct from the presentation name. */
export function publicVariantLabel(groupName: string, variantLabel: string): string {
  const copy = publicVariantCopy(groupName, variantLabel)
  return copy.count ? `${copy.name} · ×${copy.count}` : copy.name
}
