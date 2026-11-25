import { useEffect, useMemo, SyntheticEvent, MouseEvent as ReactMouseEvent, KeyboardEvent as ReactKeyboardEvent, type RefObject, type Dispatch, type SetStateAction } from 'react'
import { normalizeForSearch } from '../../lib/textFormat'
import { groupMenuProducts, MenuProductGroup } from '../../lib/menuGrouping'
import { searchMenuGroups } from '../../lib/menuSearch'
import { FEATURED_DISH_QUERIES } from '../../lib/publicMenuRuntime'
import { type DesktopTab } from '../../lib/publicMenuTypes'
import { type PublicModifierSelection } from '../../lib/publicOrderRules'
import { type Product } from '../../lib/dataService'

interface UseMenuBrowseArgs {
  activeCategory: string
  cardQtys: Record<string, number>
  categories: string[]
  currentTab: DesktopTab
  desktopHeroPaused: boolean
  favoriteIds: string[]
  groups: MenuProductGroup[]
  openGroup: (group: MenuProductGroup, originEvent?: { clientX: number; clientY: number; } | undefined, initialVariantId?: string | undefined, initialModifiers?: PublicModifierSelection | undefined) => void
  popularScrollRef: RefObject<HTMLDivElement | null>
  products: Product[]
  requestQuickAdd: (group: MenuProductGroup, quantity?: number) => Promise<void>
  search: string
  setCanScrollPopular: Dispatch<SetStateAction<boolean>>
  setCardQtys: Dispatch<SetStateAction<Record<string, number>>>
  setDesktopHeroSlide: Dispatch<SetStateAction<number>>
  setScrollCategory: Dispatch<SetStateAction<string | null>>
  showFavorites: boolean
}

export function useMenuBrowse({ activeCategory, cardQtys, categories, currentTab, desktopHeroPaused, favoriteIds, groups, openGroup, popularScrollRef, products, requestQuickAdd, search, setCanScrollPopular, setCardQtys, setDesktopHeroSlide, setScrollCategory, showFavorites }: UseMenuBrowseArgs) {
  const homeSearchTerm = normalizeForSearch(search.trim())
  useEffect(() => {
    if (homeSearchTerm.length >= 2) {
      setDesktopHeroSlide(0)
      return
    }
    if (currentTab !== 'inicio' || desktopHeroPaused || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const timer = window.setInterval(() => setDesktopHeroSlide(slide => (slide + 1) % 2), 3000)
    return () => window.clearInterval(timer)
  }, [currentTab, desktopHeroPaused, homeSearchTerm, setDesktopHeroSlide])
  const homeSearchSuggestions = useMemo(() => {
    if (homeSearchTerm.length < 2) return []
    return searchMenuGroups(groupMenuProducts(products), homeSearchTerm).slice(0, 5)
  }, [products, homeSearchTerm])
  const visibleGroups = useMemo(() => showFavorites && !homeSearchTerm ? groups.filter(group => favoriteIds.includes(group.key)) : groups, [groups, showFavorites, favoriteIds, homeSearchTerm])
  const popularGroups = useMemo(() => {
    const all = groupMenuProducts(products)
    const stopWords = new Set(['el', 'la', 'los', 'las', 'un', 'una', 'de'])
    const curated = FEATURED_DISH_QUERIES
      .map(query => all.find(group => {
        const haystack = normalizeForSearch(`${group.name} ${group.category} ${group.variants.map(v => `${v.label} ${v.product.name}`).join(' ')}`)
        const words = normalizeForSearch(query).split(/\s+/).filter(w => w && !stopWords.has(w))
        return words.length > 0 && words.every(w => haystack.includes(w))
      }))
      .filter((group): group is MenuProductGroup => Boolean(group))
    return curated.length > 0 ? curated : all.slice(0, 4)
  }, [products])
  useEffect(() => {
    const el = popularScrollRef.current
    if (!el) return
    const check = () => setCanScrollPopular(el.scrollWidth > el.clientWidth + 1)
    check()
    const observer = new ResizeObserver(check)
    observer.observe(el)
    return () => observer.disconnect()
  }, [popularGroups, popularScrollRef, setCanScrollPopular])
  const promoGroups = useMemo(() => {
    const promoItems = products.filter(p => 
      p.category.toLowerCase().includes('promo') || 
      p.category.toLowerCase().includes('combo') ||
      p.name.toLowerCase().includes('combo') ||
      p.name.toLowerCase().includes('promo') ||
      p.category.toLowerCase().includes('ejecutivo') ||
      p.category.toLowerCase().includes('individual')
    )
    return (promoItems.length > 0 ? groupMenuProducts(promoItems) : groupMenuProducts(products)).slice(0, 4)
  }, [products])
  const getCardQty = (key: string) => cardQtys[key] || 1
  const changeCardQty = (key: string, delta: number) => setCardQtys(prev => ({ ...prev, [key]: Math.max(1, (prev[key] || 1) + delta) }))
  
  const handleCardAdd = (group: MenuProductGroup) => {
    const qty = getCardQty(group.key)
    requestQuickAdd(group, qty)
  }
  const stopProductCardInteraction = (event: SyntheticEvent) => {
    // Algunos navegadores entregan el click del control después del pointer
    // al contenedor. Cancelar ambos niveles evita que la tarjeta abra detalle.
    event.preventDefault()
    event.stopPropagation()
    event.nativeEvent.stopImmediatePropagation()
  }
  const openProductFromCard = (group: MenuProductGroup, event: ReactMouseEvent<HTMLElement>) => {
    if (event.defaultPrevented || (event.target as HTMLElement).closest('button, a, input, select, textarea')) return
    openGroup(group, event)
  }
  const openProductFromCardKeyboard = (group: MenuProductGroup, event: ReactKeyboardEvent<HTMLElement>) => {
    if (event.target !== event.currentTarget || (event.key !== 'Enter' && event.key !== ' ')) return
    event.preventDefault()
    openGroup(group)
  }
  const categorySections = useMemo(() => categories
    .filter(category => category !== 'Todos')
    .map(category => ({ category, groups: visibleGroups.filter(group => group.variants.some(v => v.product.categories.includes(category))) }))
    .filter(section => section.groups.length > 0), [categories, visibleGroups])

  // Fondo dinámico por categoría: mientras se navega "Todos" en scroll, un
  // IntersectionObserver detecta qué sección de categoría está a la vista y
  // tiñe el fondo con su color de acento — un efecto de "profundidad" hecho
  // a propósito, no un adorno genérico. Se desactiva con "reducir movimiento".
  useEffect(() => {
    if (activeCategory !== 'Todos' || categorySections.length === 0) {
      setScrollCategory(null)
      return
    }
    const sections = Array.from(document.querySelectorAll<HTMLElement>('.public-category-section[data-category]'))
      .filter(el => el.offsetParent !== null)
    if (sections.length === 0) return

    const observer = new IntersectionObserver(
      entries => {
        const visible = entries.filter(e => e.isIntersecting)
        if (visible.length === 0) return
        const topMost = visible.reduce((a, b) => (a.boundingClientRect.top <= b.boundingClientRect.top ? a : b))
        const category = topMost.target.getAttribute('data-category')
        if (category) setScrollCategory(category)
      },
      { rootMargin: '-35% 0px -55% 0px', threshold: 0 }
    )
    sections.forEach(el => observer.observe(el))
    return () => observer.disconnect()
  }, [activeCategory, categorySections, setScrollCategory])
  return { openProductFromCard, openProductFromCardKeyboard, stopProductCardInteraction, changeCardQty, getCardQty, handleCardAdd, categorySections, visibleGroups, homeSearchSuggestions, homeSearchTerm, popularGroups, promoGroups }
}
