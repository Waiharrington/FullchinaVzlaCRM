import { type SyntheticEvent, type MouseEvent, type KeyboardEvent } from 'react'
import { menuLabelMeta, productTitle, groupDescription, money } from '../../lib/publicMenuFormat'
import { Heart, LoaderCircle, Plus, SlidersHorizontal } from 'lucide-react'
import { type MenuProductGroup } from '../../lib/menuGrouping'
import { useServe } from '../../pedir-v2/hooks'
import { Photo } from '../../pedir-v2/Photo'
import { Fit } from '../../pedir-v2/ui'

interface ProductCardProps {
  group: MenuProductGroup
  inCart?: number
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

export function ProductCard({ group, inCart = 0, priority = false, favoriteIds, openProductFromCard, openProductFromCardKeyboard, pendingQuickAdds, priceBs, requestQuickAdd, stopProductCardInteraction, toggleFavorite }: ProductCardProps) {
    const cardRef = useServe<HTMLElement>()
    const hasOptions = group.variants.length > 1
    const isQuickAddPending = pendingQuickAdds.has(group.key)
    return (
      <article ref={cardRef} className={`public-prod-card${inCart > 0 ? ' is-in-cart' : ''}`} key={group.key}>
        {group.variants.length > 0 && group.variants.every(v => v.product.menuLabel === 'free_drink') && (
          <img src="/optimized/pedir-v2/free-drink.webp" alt="Refresco gratis" className="public-free-drink-sticker" />
        )}
        <div className="public-prod-img-wrap" onClick={event => openProductFromCard(group, event)} tabIndex={0} onKeyDown={event => openProductFromCardKeyboard(group, event)}>
          {(() => {
            const label = menuLabelMeta[group.variants.find(v => v.product.menuLabel)?.product.menuLabel as keyof typeof menuLabelMeta]
            if (!label || label.className === 'free-drink') return null
            const LabelIcon = label.icon
            return <span className={`public-menu-label ${label.className}`}><LabelIcon size={12} strokeWidth={2.4} aria-hidden="true" /> {label.text}</span>
          })()}
          <Photo imageUrl={group.variants[0]?.product.imageUrl} alt={group.name} eager={Boolean(priority)} />
          <button type="button" className={`public-favorite-btn ${favoriteIds.includes(group.key) ? 'active' : ''}`} onPointerDown={stopProductCardInteraction} onClick={event => { event.stopPropagation(); toggleFavorite(group.key) }} aria-label={favoriteIds.includes(group.key) ? `Quitar ${group.name} de favoritos` : `Guardar ${group.name} en favoritos`}><Heart size={16} fill={favoriteIds.includes(group.key) ? 'currentColor' : 'none'} /></button>
        {inCart > 0 && <span className="pd-in-cart" key={inCart}>{inCart} en tu wok</span>}
        </div>
        <div className="public-prod-info" onClick={event => openProductFromCard(group, event)} tabIndex={0} onKeyDown={event => openProductFromCardKeyboard(group, event)}>
          <h3 className="public-prod-title"><Fit>{productTitle(group.name)}</Fit></h3>
          <p className="public-prod-desc">{groupDescription(group)}</p>
          <div className="public-prod-footer-row">
            <div className="public-prod-price-wrap">
              <span className="public-prod-price">{group.isGrouped && group.minPrice !== group.maxPrice && <small>Desde </small>}{money(group.minPrice)}</span>
              {priceBs(group.minPrice) && <span className="public-prod-price-bs">{priceBs(group.minPrice)}</span>}
            </div>
          </div>
          <button type="button" className={`public-prod-add${hasOptions ? ' has-options' : ''}${isQuickAddPending ? ' is-loading' : ''}`} disabled={isQuickAddPending} aria-busy={isQuickAddPending} aria-label={isQuickAddPending ? `Revisando opciones de ${group.name}` : hasOptions ? `Ver opciones de ${group.name}` : `Agregar ${group.name} al carrito`} onPointerDown={stopProductCardInteraction} onClick={(e) => { e.stopPropagation(); requestQuickAdd(group) }}>
            {isQuickAddPending ? <LoaderCircle className="public-add-spinner" size={18} aria-hidden="true" /> : hasOptions
              ? <SlidersHorizontal size={17} strokeWidth={2.4} aria-hidden="true" />
              : <Plus size={20} strokeWidth={2.8} aria-hidden="true" />}
            <span className="public-prod-add-label">{isQuickAddPending ? 'Un momento' : hasOptions ? 'Elegir' : 'Agregar'}</span>
          </button>
        </div>
      </article>
    )
  }
