import type { CheckoutStep } from '../../lib/publicMenuTypes'
import { type Dispatch, type SetStateAction } from 'react'
import { ShoppingBag, MessageSquareText, Trash2, Minus, Plus, Flame, ChevronRight, Clock } from 'lucide-react'
import { cartLineKey, optimizedProductImage, productImage, cartProductName, money, productTitle } from '../../lib/publicMenuFormat'
import { type WebOrderCartItem } from '../../lib/publicOrders'
import { type MenuProductGroup } from '../../lib/menuGrouping'
import { type DesktopTab } from '../../lib/publicMenuTypes'

interface CartStepProps {
  cart: WebOrderCartItem[]
  cartCarouselGroups: MenuProductGroup[]
  closeCart: () => void
  deliveryChosen: boolean
  editCartItem: (item: WebOrderCartItem) => void
  getCartIncludedCopy: (item: WebOrderCartItem) => string | null
  orderType: "takeaway" | "delivery"
  priceBs: (usd: number) => string | null
  requestQuickAdd: (group: MenuProductGroup, quantity?: number) => Promise<void>
  requireCart: () => boolean
  setCurrentTab: Dispatch<SetStateAction<DesktopTab>>
  setShowAllExtras: Dispatch<SetStateAction<boolean>>
  setStep: Dispatch<SetStateAction<CheckoutStep>>
  total: number
  updateQuantity: (itemKey: string, delta: number, legacyNotes?: string | undefined) => void
}

export function CartStep({ cart, cartCarouselGroups, closeCart, deliveryChosen, editCartItem, getCartIncludedCopy, orderType, priceBs, requestQuickAdd, requireCart, setCurrentTab, setShowAllExtras, setStep, total, updateQuantity }: CartStepProps) {
  return (
<div className="public-review-page"><div className="public-cart-items">{cart.length === 0 ? <div className="public-sidebar-empty"><div className="public-empty-box-art"><img src="/optimized/fondos/carrito-vacio.webp" alt="Tu pedido está vacío" className="public-empty-cart-img" /></div><h3 className="public-empty-cart-title">Tu pedido está vacío</h3><p className="public-empty-cart-msg">Parece que aún no has agregado nada a tu pedido.</p><p className="public-empty-cart-sub">¡Explora nuestro menú y encuentra tu próximo favorito!</p><button type="button" className="public-empty-explore-btn" onClick={() => { setCurrentTab('menu'); window.scrollTo({ top: 0, behavior: 'smooth' }); }}><ShoppingBag size={18} /><span>Explorar menú</span></button></div> : cart.map(item => <div className="public-cart-item" key={cartLineKey(item)}><img className="public-cart-item-image" src={optimizedProductImage(item.imageUrl) || productImage()} alt="" /><div className="public-cart-item-main"><strong>{cartProductName(item.productName)}</strong>{getCartIncludedCopy(item) && <small className="public-cart-item-notes">{getCartIncludedCopy(item)}</small>}<span>{item.quantity} {item.quantity === 1 ? 'porción' : 'porciones'}</span>{item.notes && <small className="public-cart-item-notes public-cart-item-notes-extra"><MessageSquareText aria-hidden="true" /><span>{item.notes}</span></small>}<div className="public-cart-item-controls"><div className="public-review-qty"><button onClick={() => updateQuantity(cartLineKey(item), -1)}>{item.quantity === 1 ? <Trash2 /> : <Minus />}</button><b>{item.quantity}</b><button onClick={() => updateQuantity(cartLineKey(item), 1)}><Plus /></button></div><button className="public-review-edit" onClick={() => { closeCart(); setTimeout(() => { editCartItem(item) }, 380) }}>Editar</button></div></div><strong className="public-cart-item-total">{money(item.price * item.quantity)}{priceBs(item.price * item.quantity) && <small className="public-cart-item-bs">{priceBs(item.price * item.quantity)}</small>}</strong></div>)}</div>{cart.length > 0 && cartCarouselGroups.length > 0 && <section className="public-cart-recommendations"><div className="public-cart-recommendations-head"><h3><Flame size={18} color="#FF5A52" className="fire-icon-pulse" /> ¿Algo más?</h3><button type="button" onClick={() => setShowAllExtras(true)}>Ver todos <ChevronRight size={13} /></button></div><div className="public-recommendation-row">{cartCarouselGroups.map(group => <article key={group.key}><img loading="lazy" decoding="async" src={optimizedProductImage(group.variants[0]?.product.imageUrl) || productImage(group.category)} alt="" /><div><strong>{productTitle(group.name)}</strong><b>{money(group.minPrice)}{priceBs(group.minPrice) && <small className="public-reco-bs">{priceBs(group.minPrice)}</small>}</b></div><button type="button" onClick={() => requestQuickAdd(group)}><Plus size={15} /></button></article>)}</div></section>}{cart.length > 0 && <div className="public-total public-review-total"><span>Subtotal productos</span><strong>{money(total)}{priceBs(total) && <small className="public-total-bs">{priceBs(total)}</small>}</strong><small>Productos seleccionados</small><b>Total productos <em>{money(total)}{priceBs(total) && <small className="public-total-bs">{priceBs(total)}</small>}</em></b></div>}{cart.length > 0 && (orderType === 'delivery' || !deliveryChosen) && <p className="public-cart-eta"><Clock aria-hidden="true" /><span>Entrega estimada <strong>35–50 min</strong></span></p>}{cart.length > 0 && <button className="public-primary" onClick={() => requireCart() && setStep('delivery')}>Continuar <ChevronRight /></button>}</div>
  )
}
