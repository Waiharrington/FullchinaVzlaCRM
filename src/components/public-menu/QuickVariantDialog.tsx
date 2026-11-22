import type { MenuVariant } from '../../lib/menuGrouping'
import { type Dispatch, type SetStateAction } from 'react'
import { createPortal } from 'react-dom'
import { Utensils, X, Check, Minus, Plus, Drumstick, ChevronRight, LoaderCircle, ShoppingCart } from 'lucide-react'
import { productTitle, optimizedProductImage, productImage, money } from '../../lib/publicMenuFormat'
import { publicVariantCopy } from '../../lib/publicMenuLabels'
import { formatSpanishText } from '../../lib/textFormat'
import { type MenuProductGroup } from '../../lib/menuGrouping'
import { type ProductModifierGroup } from '../../lib/dataService'

interface QuickVariantDialogProps {
  closeQuickVariant: () => void
  closingQuickVariant: boolean
  confirmingQuickVariant: boolean
  confirmQuickVariant: () => Promise<void>
  openQuickProteinDialog: () => void
  personalizeQuickVariant: () => void
  priceBs: (usd: number) => string | null
  quickSelectedVariant: MenuVariant | undefined
  quickVariantGroup: MenuProductGroup
  quickVariantHasModifiers: boolean
  quickVariantId: string | null
  quickVariantOptionsLabel: string
  quickVariantProteinGroup: ProductModifierGroup | null
  quickVariantQuantity: number
  setQuickVariantId: Dispatch<SetStateAction<string | null>>
  setQuickVariantQuantity: Dispatch<SetStateAction<number>>
}

export function QuickVariantDialog({ closeQuickVariant, closingQuickVariant, confirmingQuickVariant, confirmQuickVariant, openQuickProteinDialog, personalizeQuickVariant, priceBs, quickSelectedVariant, quickVariantGroup, quickVariantHasModifiers, quickVariantId, quickVariantOptionsLabel, quickVariantProteinGroup, quickVariantQuantity, setQuickVariantId, setQuickVariantQuantity }: QuickVariantDialogProps) {
  return (
createPortal(
            <div className={`public-variant-backdrop ${closingQuickVariant ? 'closing' : ''}`} onClick={closeQuickVariant}>
              <section className="public-variant-picker" role="dialog" aria-modal="true" aria-labelledby="public-variant-title" onClick={event => event.stopPropagation()}>
                <header className="public-variant-header">
                  <span className="public-variant-header-icon"><Utensils size={20} /></span>
                  <div>
                    <small>ESCOGE ANTES DE AGREGAR</small>
                    <h2 id="public-variant-title">¿Cuál presentación quieres?</h2>
                    <p>{productTitle(quickVariantGroup.name)}</p>
                  </div>
                  <button type="button" className="public-variant-close" onClick={closeQuickVariant} aria-label="Cerrar selector"><X size={18} /></button>
                </header>
    
                <div className={`public-variant-options ${quickVariantGroup.variants.length > 4 ? 'is-many' : ''}`}>
                  {quickVariantGroup.variants.map(({ product, label }) => {
                    const selected = product.id === quickVariantId
                    const variantCopy = publicVariantCopy(quickVariantGroup.name, label)
                    const inheritedImage = optimizedProductImage(product.imageUrl)
                      || optimizedProductImage(quickVariantGroup.variants[0]?.product.imageUrl)
                      || productImage(quickVariantGroup.category)
                    return (
                      <button
                        type="button"
                        className={`public-variant-option ${selected ? 'selected' : ''}`}
                        key={product.id}
                        onClick={() => setQuickVariantId(product.id)}
                        aria-pressed={selected}
                      >
                        <span className="public-variant-option-media">
                          <img src={inheritedImage} alt="" />
                          {selected && <span className="public-variant-option-badge">Elegido</span>}
                          {product.menuLabel === 'free_drink' && <img src="/icons/free-drink-badge.png" alt="Incluye refresco gratis" className="public-variant-free-drink-badge" />}
                          <span className="public-variant-option-check"><Check size={16} /></span>
                        </span>
                        <span className="public-variant-option-copy">
                          <small>Presentación</small>
                          <strong>{variantCopy.name}</strong>
                          {variantCopy.count && <span className="public-variant-option-count">×{variantCopy.count}</span>}
                          <span className="public-variant-option-description">
                            {formatSpanishText(product.description || 'Preparación Full China')}
                          </span>
                          <span className="public-variant-option-price">{money(product.price)}{priceBs(product.price) && <em>{priceBs(product.price)}</em>}</span>
                        </span>
                      </button>
                    )
                  })}
                </div>
    
                <footer className={`public-variant-footer ${quickSelectedVariant ? 'has-selection' : 'needs-selection'}`}>
                  {quickSelectedVariant ? <>
                    <div className="public-variant-quantity" aria-label="Cantidad">
                      <button type="button" onClick={() => setQuickVariantQuantity(value => Math.max(1, value - 1))} aria-label="Disminuir cantidad"><Minus size={15} /></button>
                      <span><small>Cantidad</small><strong>{quickVariantQuantity}</strong></span>
                      <button type="button" onClick={() => setQuickVariantQuantity(value => value + 1)} aria-label="Aumentar cantidad"><Plus size={15} /></button>
                    </div>
                    <div className="public-variant-actions">
                      {quickVariantHasModifiers && <button type="button" className="public-variant-customize" onClick={quickVariantProteinGroup ? openQuickProteinDialog : personalizeQuickVariant}>{quickVariantOptionsLabel === 'Quitar alguna proteína' ? <Drumstick size={15} aria-hidden="true" /> : <ChevronRight size={15} aria-hidden="true" />}<span>{quickVariantOptionsLabel}</span>{quickVariantProteinGroup && <small>Opcional</small>}</button>}
                      <button type="button" className="public-variant-add" onClick={confirmQuickVariant} disabled={confirmingQuickVariant} aria-busy={confirmingQuickVariant}>
                        {confirmingQuickVariant ? <LoaderCircle className="public-add-spinner" size={16} /> : <ShoppingCart size={16} />}
                        <span>{confirmingQuickVariant ? 'Revisando opciones…' : `Agregar · ${money(quickSelectedVariant.product.price * quickVariantQuantity)}`}</span>
                      </button>
                    </div>
                  </> : <p className="public-variant-selection-hint" role="status"><span className="public-variant-tap-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none"><path d="M9 12V5.75a1.75 1.75 0 0 1 3.5 0V12l.45-1.1a1.75 1.75 0 0 1 3.3.65v1.02l.45-.43a1.7 1.7 0 0 1 2.87 1.17l-.4 3.72A5 5 0 0 1 14.2 21h-1.45a5.1 5.1 0 0 1-3.95-1.87L5.6 15.2a1.6 1.6 0 0 1 2.26-2.27L9 14.1" /><path d="m6.1 5.1-1-1M18 6l1-1M4.5 9H3" /></svg></span><span>Toca una presentación para continuar</span></p>}
                </footer>
              </section>
            </div>,
            document.body
          )
  )
}
