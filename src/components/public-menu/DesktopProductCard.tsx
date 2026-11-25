import { type SyntheticEvent, type MouseEvent, type KeyboardEvent } from 'react'
import { productTitle, money } from '../../lib/publicMenuFormat'
import { Heart, Minus, Plus, LoaderCircle } from 'lucide-react'
import { type MenuProductGroup } from '../../lib/menuGrouping'
import { Dish, Fit } from '../../pedir-v2/ui'

interface DesktopProductCardProps {
  group: MenuProductGroup
  changeCardQty: (key: string, delta: number) => void
  favoriteIds: string[]
  getCardQty: (key: string) => number
  handleCardAdd: (group: MenuProductGroup) => void
  openProductFromCard: (group: MenuProductGroup, event: MouseEvent<HTMLElement>) => void
  openProductFromCardKeyboard: (group: MenuProductGroup, event: KeyboardEvent<HTMLElement>) => void
  pendingQuickAdds: Set<string>
  priceBs: (usd: number) => string | null
  stopProductCardInteraction: (event: SyntheticEvent<Element, Event>) => void
  toggleFavorite: (groupKey: string) => void
}

export function DesktopProductCard({ group, changeCardQty, favoriteIds, getCardQty, handleCardAdd, openProductFromCard, openProductFromCardKeyboard, pendingQuickAdds, priceBs, stopProductCardInteraction, toggleFavorite }: DesktopProductCardProps) {
    const qty = getCardQty(group.key)
    const isQuickAddPending = pendingQuickAdds.has(group.key)

    return (
      <article className="public-home-product-card" key={group.key} onClick={event => openProductFromCard(group, event)} tabIndex={0} onKeyDown={event => openProductFromCardKeyboard(group, event)}>
        <div className="public-home-prod-img-wrap">
          <i className="pd-box-back" aria-hidden="true" />
          <Dish imageUrl={group.variants[0]?.product.imageUrl} alt={group.name} />
          <button
            type="button"
            className={`public-home-fav-btn ${favoriteIds.includes(group.key) ? 'active' : ''}`}
            onPointerDown={stopProductCardInteraction}
            onClick={(e) => { e.stopPropagation(); toggleFavorite(group.key) }}
            aria-label="Favorito"
          >
            <Heart size={16} fill={favoriteIds.includes(group.key) ? 'currentColor' : 'none'} />
          </button>
        </div>

        <div className="public-home-prod-body">
          <h3 className="public-home-prod-title"><Fit>{productTitle(group.name)}</Fit></h3>

          <div className="public-home-prod-price-wrap">
            <span className="public-home-prod-price">
              {group.isGrouped && group.minPrice !== group.maxPrice && <small>Desde </small>}{money(group.minPrice)}
            </span>
            {priceBs(group.minPrice) && <span className="public-home-prod-price-bs">{priceBs(group.minPrice)}</span>}
          </div>

          <div className="public-home-prod-actions" onClick={(e) => e.stopPropagation()}>
            <div className="public-home-stepper">
              <button type="button" onPointerDown={stopProductCardInteraction} onClick={() => changeCardQty(group.key, -1)} aria-label="Disminuir">
                <Minus size={13} />
              </button>
              <span>{qty}</span>
              <button type="button" onPointerDown={stopProductCardInteraction} onClick={() => changeCardQty(group.key, 1)} aria-label="Aumentar">
                <Plus size={13} />
              </button>
            </div>
            <button
              type="button"
              className="public-home-add-btn"
              disabled={isQuickAddPending}
              aria-busy={isQuickAddPending}
              onPointerDown={stopProductCardInteraction}
              onClick={(event) => { event.stopPropagation(); handleCardAdd(group) }}
            >
              {isQuickAddPending ? <><LoaderCircle className="public-add-spinner" size={14} /> Revisando…</> : 'Agregar'}
            </button>
          </div>
        </div>
      </article>
    )
  }
