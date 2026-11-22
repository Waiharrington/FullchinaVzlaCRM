import { type SyntheticEvent, type MouseEvent, type KeyboardEvent } from 'react'
import { productTitle, money, optimizedProductImage, productImage } from '../../lib/publicMenuFormat'
import { LoaderCircle, Plus } from 'lucide-react'
import { type MenuProductGroup } from '../../lib/menuGrouping'

interface DesktopPromoCardProps {
  group: MenuProductGroup
  handleCardAdd: (group: MenuProductGroup) => void
  openProductFromCard: (group: MenuProductGroup, event: MouseEvent<HTMLElement>) => void
  openProductFromCardKeyboard: (group: MenuProductGroup, event: KeyboardEvent<HTMLElement>) => void
  pendingQuickAdds: Set<string>
  stopProductCardInteraction: (event: SyntheticEvent<Element, Event>) => void
}

export function DesktopPromoCard({ group, handleCardAdd, openProductFromCard, openProductFromCardKeyboard, pendingQuickAdds, stopProductCardInteraction }: DesktopPromoCardProps) {
    const isQuickAddPending = pendingQuickAdds.has(group.key)
    return (
      <article className="public-home-promo-card" key={group.key} onClick={event => openProductFromCard(group, event)} tabIndex={0} onKeyDown={event => openProductFromCardKeyboard(group, event)}>
        <div className="public-home-promo-top">
          <h3 className="public-home-promo-title">{productTitle(group.name)}</h3>
          <div className="public-home-promo-price-row">
            <span className="public-home-promo-price">{money(group.minPrice)}</span>
          </div>

        </div>

        <div className="public-home-promo-img-wrap">
          <img 
            src={optimizedProductImage(group.variants[0]?.product.imageUrl) || productImage(group.category)} 
            alt={group.name} 
            className={(group.name.toLowerCase().includes('agua') || group.name.toLowerCase().includes('2l') || group.name.toLowerCase().includes('2 l') || group.name.toLowerCase().includes('lipton')) ? 'public-img--beverage-recommended-align' : (group.category === 'bebidas' ? 'public-img--top-align' : '')}
            loading="lazy" 
            decoding="async" 
          />
        </div>

        <div className="public-home-promo-footer" onClick={(e) => e.stopPropagation()}>
          <button 
            type="button" 
            className="public-home-promo-add-btn"
            disabled={isQuickAddPending}
            aria-busy={isQuickAddPending}
            onPointerDown={stopProductCardInteraction}
            onClick={(event) => { event.stopPropagation(); handleCardAdd(group) }}
          >
            {isQuickAddPending ? <LoaderCircle className="public-add-spinner" size={15} /> : <Plus size={15} />}
            <span>{isQuickAddPending ? 'Revisando…' : 'Pedir promo'}</span>
          </button>
        </div>
      </article>
    )
  }
