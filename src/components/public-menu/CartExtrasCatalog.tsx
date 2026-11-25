import { type Dispatch, type SetStateAction } from 'react'
import { DESKTOP_MEDIA_QUERY } from '../../lib/publicMenuConfig'
import { Search, Plus } from 'lucide-react'
import { categoryLabel } from '../../lib/menuCategories'
import { productTitle, money } from '../../lib/publicMenuFormat'
import { type MenuProductGroup } from '../../lib/menuGrouping'
import { Thumb } from '../../pedir-v2/ui'
import { type PublicModifierSelection } from '../../lib/publicOrderRules'

interface CartExtrasCatalogProps {
  closeAllExtras: () => void
  closeCart: () => void
  closingAllExtras: boolean
  extrasSearch: string
  extrasSections: [string, MenuProductGroup[]][]
  openGroup: (group: MenuProductGroup, originEvent?: { clientX: number; clientY: number; } | undefined, initialVariantId?: string | undefined, initialModifiers?: PublicModifierSelection | undefined) => void
  priceBs: (usd: number) => string | null
  requestQuickAdd: (group: MenuProductGroup, quantity?: number) => Promise<void>
  setExtrasSearch: Dispatch<SetStateAction<string>>
}

export function CartExtrasCatalog({ closeAllExtras, closeCart, closingAllExtras, extrasSearch, extrasSections, openGroup, priceBs, requestQuickAdd, setExtrasSearch }: CartExtrasCatalogProps) {
  return (
<div className={`public-cart-all-extras ${closingAllExtras ? 'closing' : ''}`}><div className="public-cart-all-extras-head"><div><span>CATÁLOGO RÁPIDO</span><h3>Agrega algo más</h3></div><button type="button" onClick={() => { const isDesktop = window.matchMedia(DESKTOP_MEDIA_QUERY).matches; closeAllExtras(); if (isDesktop) closeCart() }} aria-label="Cerrar">×</button></div><label className="public-cart-extras-search"><Search size={16} /><input value={extrasSearch} onChange={event => setExtrasSearch(event.target.value)} placeholder="Buscar un plato, bebida o extra" /><button type="button" onClick={() => setExtrasSearch('')} aria-label="Limpiar búsqueda">×</button></label><div className="public-cart-extra-sections">{extrasSections.length === 0 ? <p className="public-cart-extras-empty">No encontramos ese producto. Prueba con otro nombre.</p> : extrasSections.map(([category, categoryGroups]) => <section key={category}><div className="public-cart-extra-section-head"><h4>{categoryLabel(category)}</h4><span>{categoryGroups.length}</span></div><div className="public-cart-all-extras-grid">{categoryGroups.map(group => <article key={group.key}><button type="button" className="public-cart-all-extras-open" aria-label={`Ver detalles de ${group.name}`} onClick={() => openGroup(group)}><Thumb imageUrl={group.variants[0]?.product.imageUrl} /><span><strong>{productTitle(group.name)}</strong><b>{money(group.minPrice)}{priceBs(group.minPrice) && <small className="public-reco-bs">{priceBs(group.minPrice)}</small>}</b></span></button><button type="button" aria-label={`Agregar ${group.name} al pedido`} onClick={() => requestQuickAdd(group)}><Plus size={15} /></button></article>)}</div></section>)}</div></div>
  )
}
