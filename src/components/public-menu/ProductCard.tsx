import { type SyntheticEvent, type MouseEvent, type KeyboardEvent } from 'react'
import { menuLabelMeta, optimizedProductImage, productImage, productTitle, groupDescription, money } from '../../lib/publicMenuFormat'
import { Heart, LoaderCircle, ChevronRight, ShoppingCart } from 'lucide-react'
import { type MenuProductGroup } from '../../lib/menuGrouping'

interface ProductCardProps {
  group: MenuProductGroup
  priority?: unknown
  favoriteIds: string[]
  openProductFromCard: (group: MenuProductGroup, event: MouseEvent<HTMLElement>) => void
  openProductFromCardKeyboard: (group: MenuProductGroup, event: KeyboardEvent<HTMLElement>) => void
  pendingQuickAdds: Set<string>
  priceBs: (usd: number) => string | null
  requestQuickAdd: (group: MenuProductGroup, quantity?: number) => Promise<void>
  stopProductCardInteraction: (event: SyntheticEvent<Element, Event>) => void
  toggleFavorite: (groupKey: string) => void
}

export function ProductCard({ group, priority = false, favoriteIds, openProductFromCard, openProductFromCardKeyboard, pendingQuickAdds, priceBs, requestQuickAdd, stopProductCardInteraction, toggleFavorite }: ProductCardProps) {
    const isBeverage = group.variants.some(({ product }) => product.categories.includes('bebidas'))
    const isTallBottle = /^(agua|refresco\s+2\s+litros)$/i.test(group.name.trim())
    const isLiptonBottle = /^lipton\b/i.test(group.name.trim())
    const hasOptions = group.variants.length > 1
    const isQuickAddPending = pendingQuickAdds.has(group.key)
    return (
      <article className="public-prod-card" key={group.key}>
        {group.variants.length > 0 && group.variants.every(v => v.product.menuLabel === 'free_drink') && (
          <img src="/icons/free-drink-badge.png" alt="Refresco gratis" className="public-free-drink-sticker" />
        )}
        <div className="public-prod-img-wrap" onClick={event => openProductFromCard(group, event)} tabIndex={0} onKeyDown={event => openProductFromCardKeyboard(group, event)}>
          {(() => {
            const label = menuLabelMeta[group.variants.find(v => v.product.menuLabel)?.product.menuLabel as keyof typeof menuLabelMeta]
            if (!label || label.className === 'free-drink') return null
            const LabelIcon = label.icon
            return <span className={`public-menu-label ${label.className}`}><LabelIcon size={12} strokeWidth={2.4} aria-hidden="true" /> {label.text}</span>
          })()}
          <img src={optimizedProductImage(group.variants[0]?.product.imageUrl) || productImage(group.category)} className={`public-prod-img ${isBeverage ? 'public-prod-img--beverage' : ''} ${isTallBottle ? 'public-prod-img--tall-bottle' : ''} ${isLiptonBottle ? 'public-prod-img--lipton' : ''}`} alt={group.name} loading={priority ? 'eager' : 'lazy'} fetchPriority={priority ? 'high' : 'auto'} decoding="async" />
          <button type="button" className={`public-favorite-btn ${favoriteIds.includes(group.key) ? 'active' : ''}`} onPointerDown={stopProductCardInteraction} onClick={event => { event.stopPropagation(); toggleFavorite(group.key) }} aria-label={favoriteIds.includes(group.key) ? `Quitar ${group.name} de favoritos` : `Guardar ${group.name} en favoritos`}><Heart size={16} fill={favoriteIds.includes(group.key) ? 'currentColor' : 'none'} /></button>
        </div>
        <button type="button" className={`public-prod-add${isQuickAddPending ? ' is-loading' : ''}`} disabled={isQuickAddPending} aria-busy={isQuickAddPending} aria-label={isQuickAddPending ? `Revisando opciones de ${group.name}` : hasOptions ? `Ver opciones de ${group.name}` : `Agregar ${group.name} al carrito`} onPointerDown={stopProductCardInteraction} onClick={(e) => { e.stopPropagation(); requestQuickAdd(group) }}>
          {isQuickAddPending ? <LoaderCircle className="public-add-spinner" size={18} aria-hidden="true" /> : hasOptions
            ? <ChevronRight size={18} strokeWidth={2.4} aria-hidden="true" />
            : <ShoppingCart size={18} strokeWidth={2.4} aria-hidden="true" />}
          <span className="public-prod-add-label-full">{isQuickAddPending ? 'Revisando…' : hasOptions ? 'Ver opciones' : 'Agregar al carrito'}</span>
          <span className="public-prod-add-label-short">{isQuickAddPending ? 'Revisando…' : hasOptions ? 'Opciones' : 'Agregar'}</span>
        </button>
        <div className="public-prod-info" onClick={event => openProductFromCard(group, event)} tabIndex={0} onKeyDown={event => openProductFromCardKeyboard(group, event)}>
          <h3 className="public-prod-title">{productTitle(group.name)}</h3>
          <p className="public-prod-desc">{groupDescription(group)}</p>
          <div className="public-prod-footer-row">
            <div className="public-prod-price-wrap">
              <span className="public-prod-price">{group.isGrouped && group.minPrice !== group.maxPrice ? 'Desde ' : ''}{money(group.minPrice)}</span>
              {priceBs(group.minPrice) && <span className="public-prod-price-bs">{priceBs(group.minPrice)}</span>}
            </div>
          </div>
        </div>
      </article>
    )
  }
