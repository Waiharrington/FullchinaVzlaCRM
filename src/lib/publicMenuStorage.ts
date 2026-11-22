import type { Product } from './dataService'
import { CATALOG_CACHE_KEY, CATALOG_CACHE_MAX_AGE_MS, CHECKOUT_ATTEMPT_KEY, DESKTOP_TAB_KEY } from './publicMenuConfig'
import type { DesktopTab, PublicMenuCategory } from './publicMenuTypes'

export const readDesktopTab = (): DesktopTab => {
  if (typeof window === 'undefined') return 'inicio'
  try {
    const savedTab = localStorage.getItem(DESKTOP_TAB_KEY)
    return savedTab === 'menu' || savedTab === 'contacto' || savedTab === 'perfil' ? savedTab : 'inicio'
  } catch {
    return 'inicio'
  }
}

export type CatalogCache = { products: Product[]; categories: PublicMenuCategory[]; savedAt: number }

export function readCatalogCache(): CatalogCache | null {
  try {
    const cached = JSON.parse(localStorage.getItem(CATALOG_CACHE_KEY) || 'null') as CatalogCache | null
    if (!cached || !Array.isArray(cached.products) || cached.products.length === 0 || !Number.isFinite(cached.savedAt)) return null
    if (Date.now() - cached.savedAt > CATALOG_CACHE_MAX_AGE_MS) return null
    return cached
  } catch {
    return null
  }
}

export function saveCatalogCache(products: Product[], categories: PublicMenuCategory[]) {
  try {
    localStorage.setItem(CATALOG_CACHE_KEY, JSON.stringify({ products, categories, savedAt: Date.now() } satisfies CatalogCache))
  } catch {
    // El catálogo sigue funcionando aunque el navegador no permita almacenamiento.
  }
}

export function readCheckoutAttempt(): { signature: string; key: string } | null {
  try {
    const saved = JSON.parse(sessionStorage.getItem(CHECKOUT_ATTEMPT_KEY) || 'null') as { signature?: string; key?: string } | null
    return saved?.signature && saved.key ? { signature: saved.signature, key: saved.key } : null
  } catch { return null }
}
