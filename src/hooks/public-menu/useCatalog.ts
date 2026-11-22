import type { CatalogCache } from '../../lib/publicMenuStorage'
import { useState, useCallback, useEffect, useMemo, type RefObject, type Dispatch, type SetStateAction } from 'react'
import { PUBLIC_MODIFIER_CACHE, PREVIEW_LOADING } from '../../lib/publicMenuConfig'
import { getPublicCatalogWithRetry, prepareCatalog, warmPublicMenuImages } from '../../lib/publicMenuRuntime'
import { getPublicOrderPageSettings, type PublicOrderPageSettings } from '../../lib/publicOrderPageSettings'
import { getPublicMenuCategories, getPublicProductModifiers, getPublicDeliverySettings } from '../../lib/publicOrders'
import { hydrateMenuCategories, MENU_CATEGORY_ORDER, menuCategoryRank, categoryLabel } from '../../lib/menuCategories'
import { saveCatalogCache } from '../../lib/publicMenuStorage'
import { groupMenuProducts, type MenuProductGroup } from '../../lib/menuGrouping'
import { filterProteinExtraGroups } from '../../lib/publicMenuFormat'
import { useLiveDataRefresh } from '../../lib/liveDataRefresh'
import { getExchangeRates } from '../../lib/rates'
import { normalizeForSearch } from '../../lib/textFormat'
import { type Product, type ProductModifierGroup } from '../../lib/dataService'
import { type DeliverySettings } from '../../lib/delivery'

interface UseCatalogArgs {
  activeCategory: string
  initialCatalog: CatalogCache | null
  loading: boolean
  modifierRequestRef: RefObject<number>
  orderType: "takeaway" | "delivery"
  products: Product[]
  search: string
  selectedGroup: MenuProductGroup | null
  selectedVariantId: string | null
  setBcvRate: Dispatch<SetStateAction<number | null>>
  setDeliverySettings: Dispatch<SetStateAction<DeliverySettings | null>>
  setDeliverySettingsStatus: Dispatch<SetStateAction<"error" | "idle" | "loading" | "ready">>
  setDetailModifierGroups: Dispatch<SetStateAction<ProductModifierGroup[]>>
  setError: Dispatch<SetStateAction<string>>
  setExtrasProducts: Dispatch<SetStateAction<Product[]>>
  setLoading: Dispatch<SetStateAction<boolean>>
  setPageSettings: Dispatch<SetStateAction<PublicOrderPageSettings>>
  setPageSettingsLoaded: Dispatch<SetStateAction<boolean>>
  setProducts: Dispatch<SetStateAction<Product[]>>
  setSelectedExtras: Dispatch<SetStateAction<Record<string, number>>>
  setSelectedGroup: Dispatch<SetStateAction<MenuProductGroup | null>>
}

export function useCatalog({ activeCategory, initialCatalog, loading, modifierRequestRef, orderType, products, search, selectedGroup, selectedVariantId, setBcvRate, setDeliverySettings, setDeliverySettingsStatus, setDetailModifierGroups, setError, setExtrasProducts, setLoading, setPageSettings, setPageSettingsLoaded, setProducts, setSelectedExtras, setSelectedGroup }: UseCatalogArgs) {
  const [catalogRetryVersion, setCatalogRetryVersion] = useState(0)
  const retryPublicCatalog = () => {
    setLoading(true)
    setCatalogRetryVersion(version => version + 1)
  }
  const refreshPublicMenuData = useCallback(async () => {
    // These modifier groups are cached separately from Supabase's response
    // cache. A feed event bypasses that first cache, so clear this one before
    // rebuilding the active catalogue and its selected product details.
    PUBLIC_MODIFIER_CACHE.clear()
    const detailsRequestId = modifierRequestRef.current
    const [catalogResult, settingsResult, categoriesResult] = await Promise.allSettled([
      getPublicCatalogWithRetry(true),
      getPublicOrderPageSettings(),
      getPublicMenuCategories(),
    ])

    if (settingsResult.status === 'fulfilled') {
      setPageSettings(settingsResult.value)
      setPageSettingsLoaded(true)
    }
    if (catalogResult.status === 'fulfilled') {
      const resolved = prepareCatalog(catalogResult.value)
      const categories = categoriesResult.status === 'fulfilled' && categoriesResult.value.length
        ? categoriesResult.value
        : initialCatalog?.categories ?? []
      if (categories.length) hydrateMenuCategories(categories)
      saveCatalogCache(resolved, categories)
      setExtrasProducts(resolved.filter(product => product.categories.includes('extras')))
      setProducts(resolved.filter(product => !product.categories.includes('extras')))
      setError('')

      if (selectedGroup) {
        const updatedGroup = groupMenuProducts(resolved).find(group => group.key === selectedGroup.key)
        if (updatedGroup) setSelectedGroup(updatedGroup)
      }
      if (selectedGroup && selectedVariantId && resolved.some(product => product.id === selectedVariantId)) {
        try {
          const remoteGroups = await getPublicProductModifiers(selectedVariantId)
          PUBLIC_MODIFIER_CACHE.set(selectedVariantId, remoteGroups)
          if (modifierRequestRef.current === detailsRequestId) {
            const product = resolved.find(item => item.id === selectedVariantId)
            const prepared = filterProteinExtraGroups(remoteGroups, product?.allowProteinExtras !== false)
              .filter(group => group.options.length > 0 || group.minSelections > 0)
            setDetailModifierGroups(prepared)
            const validOptionIds = new Set(prepared.flatMap(group => group.options.map(option => option.id)))
            setSelectedExtras(previous => Object.fromEntries(Object.entries(previous).filter(([optionId]) => validOptionIds.has(optionId))))
          }
        } catch {
          // El menú y el pedido siguen disponibles aunque fallen los modificadores.
        }
      }
    }

    if (orderType === 'delivery') {
      try { setDeliverySettings(await getPublicDeliverySettings()); setDeliverySettingsStatus('ready') }
      catch { setDeliverySettingsStatus('error') }
    }
  }, [initialCatalog?.categories, orderType, selectedGroup, selectedVariantId, modifierRequestRef, setDeliverySettings, setDeliverySettingsStatus, setDetailModifierGroups, setError, setExtrasProducts, setPageSettings, setPageSettingsLoaded, setProducts, setSelectedExtras, setSelectedGroup])
  useLiveDataRefresh('pagina-pedir', refreshPublicMenuData)

  useEffect(() => {
    let active = true
    let secondaryTimer: number | null = null

    // Solo el catálogo es crítico para pintar el menú. Las categorías, la tasa
    // y delivery llegan después para que una respuesta lenta no mantenga al
    // cliente mirando la pantalla de carga.
    const catalogPromise = getPublicCatalogWithRetry()
      .then(catalog => {
        if (PREVIEW_LOADING) {
          window.__removeFCSplash?.()
          return null
        }
        const resolved = prepareCatalog(catalog)
        if (!active) return resolved
        saveCatalogCache(resolved, initialCatalog?.categories ?? [])
        window.setTimeout(() => warmPublicMenuImages(resolved), 250)
        setExtrasProducts(resolved.filter(product => product.categories.includes('extras')))
        setProducts(resolved.filter(p => !p.categories.includes('extras')))
        setError('')
        setLoading(false)
        window.__removeFCSplash?.()
        return resolved
      })
      .catch(() => {
        if (active) {
          if (!initialCatalog) setError('No pudimos cargar el menú. Intenta nuevamente.')
          setLoading(false)
          window.__removeFCSplash?.()
        }
        return null
      })

    void catalogPromise.then(resolved => {
      if (!resolved || !active) return

      void getPublicMenuCategories()
        .then(cats => {
          if (!active || !cats.length) return
          hydrateMenuCategories(cats)
          saveCatalogCache(resolved, cats)
          // hydrateMenuCategories actualiza un mapa compartido; clonar la
          // lista fuerza el render que refresca etiquetas y búsquedas.
          setProducts(current => [...current])
        })
        .catch(() => { /* el catálogo ya puede funcionar con categorías locales */ })

      // La tasa y la configuración de delivery son secundarias. Se difieren
      // un poco más para dejar libre la conexión durante el primer render.
      secondaryTimer = window.setTimeout(() => {
        if (!active) return
        getExchangeRates().then(rates => setBcvRate(rates.bcv || null)).catch(() => setBcvRate(null))
      }, 500)
    })

    return () => {
      active = false
      if (secondaryTimer !== null) window.clearTimeout(secondaryTimer)
    }
  }, [catalogRetryVersion, initialCatalog, setBcvRate, setError, setExtrasProducts, setLoading, setProducts])

  useEffect(() => {
    if (!loading) {
      window.__removeFCSplash?.()
    }
  }, [loading])

  useEffect(() => {
    if (initialCatalog) {
      const menuImageTimer = window.setTimeout(() => warmPublicMenuImages(initialCatalog.products), 250)
      return () => {
        window.clearTimeout(menuImageTimer)
      }
    }
    return undefined
  }, [initialCatalog])

  const categories = useMemo(() => {
    const extracted = Array.from(new Set(products.flatMap(p => p.categories)));
    const allCats = Array.from(new Set([...MENU_CATEGORY_ORDER, ...extracted]));
    allCats.sort((a, b) => menuCategoryRank(a) - menuCategoryRank(b));
    return ['Todos', ...allCats.filter(c => c !== 'otros' && c !== 'extras')];
  }, [products]);
  const groups = useMemo(() => groupMenuProducts(products.filter(product => {
    const categoryMatch = activeCategory === 'Todos' || product.categories.includes(activeCategory)
    const term = normalizeForSearch(search)
    const searchableText = [
      product.name,
      product.description || '',
      product.category,
      ...product.categories.flatMap(category => [category, categoryLabel(category)]),
    ].join(' ')
    return categoryMatch && (!term || normalizeForSearch(searchableText).includes(term))
  })), [products, activeCategory, search])
  return { groups, categories, retryPublicCatalog }
}
