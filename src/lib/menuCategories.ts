/** Categorías editoriales compartidas por el menú público y el admin. */
export const MENU_CATEGORY_ORDER = [
  'promociones', 'bebidas', 'arroz', 'tallarines', 'pastas', 'chopsuey',
  'individuales', 'ejecutivos', 'raciones', 'extras', 'otros',
] as const

export type MenuCategory = typeof MENU_CATEGORY_ORDER[number]

export const MENU_CATEGORY_LABELS: Record<MenuCategory, string> = {
  arroz: 'Arroz',
  chopsuey: 'Chopsuey',
  tallarines: 'Tallarines',
  pastas: 'Pastas',
  promociones: 'Promociones',
  bebidas: 'Bebidas',
  individuales: 'Individuales',
  raciones: 'Raciones',
  otros: 'Otros',
  ejecutivos: 'Menú Ejecutivo',
  extras: 'Extras',
}

/**
 * Registro din\u00e1mico de categor\u00edas hidratado desde la base de datos. Cuando est\u00e1
 * disponible, manda sobre las constantes de arriba (que quedan como respaldo si
 * la BD a\u00fan no carg\u00f3 o falla). As\u00ed se pueden crear/renombrar/reordenar categor\u00edas
 * sin tocar c\u00f3digo, y los cambios se ven en todas las pantallas.
 */
export interface MenuCategoryDef { key: string; label: string; sortOrder: number }

let registry: MenuCategoryDef[] | null = null

export function hydrateMenuCategories(list: MenuCategoryDef[]) {
  const sorted = [...list].sort((a, b) => a.sortOrder - b.sortOrder)
  const dbMap = new Map(sorted.map(c => [c.key, c]))
  registry = MENU_CATEGORY_ORDER.map((key, i) => {
    const fromDb = dbMap.get(key)
    return fromDb || { key, label: MENU_CATEGORY_LABELS[key], sortOrder: (i + 1) * 10 }
  })
}

/** Claves de categor\u00eda en el orden vigente (BD si est\u00e1 hidratada, si no el fijo). */
export function menuCategoryKeys(): string[] {
  if (registry && registry.length) return registry.map((c) => c.key)
  return [...MENU_CATEGORY_ORDER]
}

/** \u00bfEs una categor\u00eda conocida (de la BD o de las fijas)? */
export function isKnownCategory(key: string): boolean {
  return menuCategoryKeys().includes(key)
}

/** Posici\u00f3n de una categor\u00eda para ordenar; las desconocidas van al final. */
export function menuCategoryRank(key: string): number {
  const normalized = normalize(key)
  const index = menuCategoryKeys().findIndex(k => normalize(k) === normalized)
  return index === -1 ? 999 : index
}

function normalize(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('es-VE').trim()
}

/** Convierte un nombre visible en una clave estable (slug) para una categor\u00eda nueva. */
export function slugifyCategory(label: string): string {
  return normalize(label).replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'categoria'
}

/** Categor\u00edas por defecto (respaldo si la tabla de BD a\u00fan no existe o falla). */
export function defaultMenuCategories(): MenuCategoryDef[] {
  return MENU_CATEGORY_ORDER.map((key, index) => ({
    key, label: MENU_CATEGORY_LABELS[key], sortOrder: (index + 1) * 10,
  }))
}

/**
 * Clasifica sin borrar ni renombrar productos. La lista es deliberadamente
 * conservadora: lo que no podamos identificar con seguridad queda en Otros.
 */
export function classifyMenuCategory(name: string, rawCategory = ''): MenuCategory {
  const n = normalize(name).replace(/[()/.-]/g, ' ')
  const raw = normalize(rawCategory)

  if (/refresco|lipton|agua( mineral)?/.test(n)) return 'bebidas'

  if (/especial de la casa|bolo[nñ]esa|full tentaci[oó]n|pasta con camarones? al ajillo/.test(n)) return 'ejecutivos'

  if (/^extra\b|extra[s]?\s+(camar[oó]n|pollo|jam[oó]n|cerdo|carne|vegetales)/.test(n)) return 'extras'

  if (/promo|imperdible|pa\s*'?\s*todos|de panas/.test(n)) return 'promociones'

  if (/full kilo|medio kilo|arroz con camarones? y pollo|el clasico|clasico/.test(n)) return 'arroz'

  if (/chop\s*suey/.test(n) && /veggie|mixto|especial|full/.test(n)) return 'chopsuey'

  if (/pa\s*'?\s*dos tallarines|tallarin(?:es)?\s*(?:\/\s*vermicelli\s*)?(?:camar[oó]n|especial|mixto|veggie)/.test(n)) return 'tallarines'

  if (/vermicell?i\s+(especial|mixto|veggie|full)/.test(n)) return 'pastas'

  if (/pa\s*'?\s*mi|pa\s*'?\s*ti|plato\s*[123]\b|el trio|^trio\b|^duo\b|lomito con vegetales/.test(n)) return 'individuales'

  if (/teque|lumpia|picadera|nuggets|pollo agridulce|costilla agridulce|camarones salteados|camarones crispy|sopa de fideos|wanton/.test(n)) return 'raciones'

  // Categorías históricas del catálogo: las usamos como respaldo para no
  // perder productos que todavía no tienen un nombre editorial definitivo.
  if (raw === 'combo' || raw === 'promocion' || raw === 'promociones') return 'promociones'
  if (raw === 'arroz') return 'arroz'
  if (raw === 'noodles' || raw === 'pasta' || raw === 'pastas') {
    return /vermicell?i/.test(n) ? 'pastas' : 'tallarines'
  }
  if (raw === 'wok' || raw === 'chopsuey') {
    return /chop\s*suey/.test(n) ? 'chopsuey' : 'raciones'
  }
  if (raw === 'extra') {
    if (/refresco|agua|lipton/.test(n)) return 'bebidas'
    // Los registros históricos marcados genéricamente como "extra" no se
    // convierten automáticamente en Extras: si no tienen el prefijo claro,
    // permanecen visibles en Otros para revisión editorial.
    return /^extras?\b/.test(n) ? 'extras' : 'otros'
  }
  if (raw === 'ejecutivo' || raw === 'ejecutivos') return 'ejecutivos'

  // Conservamos una pista de la categoría original solo para nombres que no
  // tienen una forma editorial reconocible; nunca forzamos un plato a una
  // categoría equivocada por su valor histórico.
  if (raw === 'bebida' || raw === 'bebidas') return 'bebidas'

  // Si la categoría cruda ya es una categoría válida del menú (asignada en la
  // BD), la respetamos en vez de mandar el plato a "Otros".
  if (raw && raw !== 'otros' && (MENU_CATEGORY_ORDER as readonly string[]).includes(raw)) {
    return raw as MenuCategory
  }
  return 'otros'
}

export function categoryLabel(category: string) {
  if (registry) {
    const found = registry.find((c) => c.key === category)
    if (found) return found.label
  }
  return MENU_CATEGORY_LABELS[category as MenuCategory] || category.replace(/_/g, ' ')
}

function itemKey(value: string) {
  return normalize(value).replace(/[’']/g, '').replace(/[^a-z0-9]+/g, ' ').trim()
}

/** Orden de lectura del menú impreso. Lo no reconocido queda al final. */
export function menuItemRank(name: string, category: string) {
  const n = itemKey(name)
  const lists: Record<string, RegExp[]> = {
    promociones: [/cantones especial/, /promo trio/, /pa todos/, /de panas/, /xl familiar/, /imperdible/, /pa dos tallarines/],
    arroz: [/full kilo especial/, /mk especial/, /arroz con camarones? y pollo/, /el clasico/, /full kilo cantones/, /mk cantones/],
    tallarines: [/tallarines? especial/, /tallarin mixto/, /tallarin veggie/, /tallarines? o vermicelli camaron/, /pa dos tallarines/],
    pastas: [/vermicelli especial/, /vermicelli mixto/, /vermicelli veggie/, /vermicelli full/],
    chopsuey: [/chop suey veggie/, /chop suey mixto/, /chop suey full/, /chop suey especial/],
    individuales: [/pa ti/, /plato 1/, /plato 2/, /duo/, /plato 3/, /el trio/, /pa mi/],
    ejecutivos: [/especial de la casa/, /bolonesa artesanal/, /full tentacion/, /pasta con camarones? al ajillo/],
    raciones: [/teque/, /^lumpias?\b/, /picadera/, /papas fritas/, /nuggets/, /pollo agridulce/, /costilla/, /camarones salteados/, /camarones crispy/, /sopa de fideos/, /wanton/],
  }
  const patterns = lists[category] || []
  const index = patterns.findIndex(pattern => pattern.test(n))
  return index === -1 ? 999 : index
}
