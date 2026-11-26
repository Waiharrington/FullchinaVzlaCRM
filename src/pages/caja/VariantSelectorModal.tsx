import { MoneyWithBcv } from '../../components/MoneyWithBcv'
import { LoadingSkeleton } from '../../components/LoadingSkeleton'
import { isQuantityModifierGroup, type Product, type ProductModifierGroup } from '../../lib/dataService'
import { X, CheckCircle2, Circle } from 'lucide-react'
import { formatProductTitle } from '../../lib/textFormat'

export interface VariantSelectorModalProps {
  closingModifier: boolean
  closeModifierPicker: (then?: () => void) => void
  modifierProduct: Product
  modifierLoading: boolean
  modifierGroups: ProductModifierGroup[]
  modifierSelections: Record<string, Record<string, number>>
  toggleModifierOption: (group: ProductModifierGroup, optionId: string) => void
  changeQuantityModifier: (group: ProductModifierGroup, optionId: string, delta: number) => void
  modifierError: string
  modifierExtraPrice: number
  confirmModifierSelection: () => void
}

export function VariantSelectorModal({ closingModifier, closeModifierPicker, modifierProduct, modifierLoading, modifierGroups, modifierSelections, toggleModifierOption, changeQuantityModifier, modifierError, modifierExtraPrice, confirmModifierSelection }: VariantSelectorModalProps) {
  return (
    <div className={`modal-overlay-dark variant-selector-overlay ${closingModifier ? 'closing' : ''}`} onClick={() => closeModifierPicker()}>
            <section className="variant-selector-modal animate-pop" role="dialog" aria-modal="true" aria-labelledby="modifier-selector-title" onClick={(event) => event.stopPropagation()}>
              <div className="variant-selector-header">
                <div>
                  <span className="variant-selector-eyebrow">Personaliza el producto</span>
                  <h2 id="modifier-selector-title">{formatProductTitle(modifierProduct.name)}</h2>
                </div>
                <button type="button" className="payment-modal-close" onClick={() => closeModifierPicker()} aria-label="Cerrar selector">
                  <X size={18} />
                </button>
              </div>
              <div className="variant-selector-list">
                {modifierLoading && <LoadingSkeleton label="Cargando opciones del producto" count={3} />}
                {!modifierLoading && modifierGroups.length === 0 && (
                  <p className="page" role="status">Este producto no tiene opciones configuradas.</p>
                )}
                {modifierGroups.map((group) => {
                  const sel = modifierSelections[group.modifierId] ?? {}
                  const rule = group.maxSelections === 1
                    ? (group.minSelections >= 1 ? 'Elige 1' : 'Elige 1 (opcional)')
                    : group.maxSelections == null
                      ? (group.minSelections > 0 ? `Elige al menos ${group.minSelections}` : 'Elige las que quieras')
                      : group.minSelections > 0 ? `Elige de ${group.minSelections} a ${group.maxSelections}` : `Elige hasta ${group.maxSelections}`
                  return (
                    <div key={group.modifierId} className="variant-option-group">
                      <div className="variant-option-grouphead">
                        <strong>{formatProductTitle(group.name)}</strong>
                        <small>{rule}</small>
                      </div>
                      {group.options.map((opt) => {
                        const qty = sel[opt.id] ?? 0
                        const selected = qty > 0
                        return (
                          <div
                            key={opt.id}
                            role="button"
                            tabIndex={0}
                            className={`variant-option-card ${selected ? 'is-selected' : ''}`}
                            onClick={() => toggleModifierOption(group, opt.id)}
                            onKeyDown={(event) => {
                              // Los botones de cantidad internos manejan sus propias teclas.
                              if (event.target !== event.currentTarget) return
                              if (event.key === 'Enter' || event.key === ' ') {
                                event.preventDefault()
                                toggleModifierOption(group, opt.id)
                              }
                            }}
                          >
                            <span className="variant-option-emoji">{selected ? <CheckCircle2 size={16} /> : <Circle size={16} />}</span>
                            <span className="variant-option-copy">
                              <strong>{formatProductTitle(opt.name)}{qty > 1 ? ` ×${qty}` : ''}</strong>
                              {opt.price > 0
                                ? <MoneyWithBcv usd={opt.price} className="variant-option-price" compact align="start" />
                                : <span className="variant-option-price is-included">Incluido</span>}
                            </span>
                            {isQuantityModifierGroup(group) ? <span className="quantity-modifier-controls"><button type="button" onClick={(event) => { event.stopPropagation(); changeQuantityModifier(group, opt.id, -1) }} disabled={!selected} aria-label={`Quitar ${opt.name}`}>−</button><strong>{qty}</strong><button type="button" onClick={(event) => { event.stopPropagation(); changeQuantityModifier(group, opt.id, 1) }} aria-label={`Agregar ${opt.name}`}>+</button></span> : <span className="variant-option-add">{selected ? 'Quitar' : 'Elegir'}</span>}
                          </div>
                        )
                      })}
                    </div>
                  )
                })}
                {modifierError && <p style={{ color: '#dc2626', margin: '4px 0' }}>{modifierError}</p>}
              </div>
              {!modifierLoading && modifierGroups.length > 0 && (
                <div className="variant-selector-footer">
                  <div className="variant-selector-total">
                    <span className="variant-selector-total-label">Total</span>
                    <MoneyWithBcv
                      usd={modifierProduct.price + modifierExtraPrice}
                      align="start"
                      className="variant-selector-total-money"
                    />
                  </div>
                  <button type="button" className="btn-primary variant-selector-cta" onClick={confirmModifierSelection}>
                    Agregar al pedido
                  </button>
                </div>
              )}
            </section>
          </div>
  )
}
