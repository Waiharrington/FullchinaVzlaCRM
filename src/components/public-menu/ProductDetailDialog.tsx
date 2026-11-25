import { type RefObject, type Dispatch, type SetStateAction } from 'react'
import { createPortal } from 'react-dom'
import { productTitle, money, filterProteinExtraGroups } from '../../lib/publicMenuFormat'
import { X, CircleAlert, ArrowDown, CupSoda, Check, Plus, Minus, LoaderCircle } from 'lucide-react'
import { isIncludedProteinGroup, getDefaultModifierSelection, countModifierSelections, PUBLIC_ORDER_MAX_UNITS_PER_PRESENTATION } from '../../lib/publicOrderRules'
import { publicVariantCopy } from '../../lib/publicMenuLabels'
import { PUBLIC_MODIFIER_CACHE } from '../../lib/publicMenuConfig'
import { ProductModifierGroup, type Product } from '../../lib/dataService'
import { getPublicProductModifiers } from '../../lib/publicOrders'
import { LoadingSkeleton } from '../../components/LoadingSkeleton'
import { formatSpanishText, formatProductTitle } from '../../lib/textFormat'
import { type MenuProductGroup } from '../../lib/menuGrouping'
import { PhotoHero } from '../../pedir-v2/Photo'
import { Fit, Odo, Thumb } from '../../pedir-v2/ui'

interface ProductDetailDialogProps {
  addingSelectedProduct: boolean
  addSelectedProduct: () => void
  catalogExtraProducts: Product[]
  closeProductDetail: () => void
  closingDetail: boolean
  complementaryProducts: Product[]
  detailExtrasTotal: number
  detailModifierGroups: ProductModifierGroup[]
  detailNotes: string
  detailNotesRef: RefObject<HTMLTextAreaElement | null>
  detailOrigin: { x: number; y: number; } | null
  detailQuantity: number
  editingCartLineKey: string | null
  invalidModifierSelection: boolean
  loadingModifiers: boolean
  modifierLoadError: boolean
  modifierRequestRef: RefObject<number>
  modifierSelectionError: ProductModifierGroup | null
  modifierValidationError: string
  priceBs: (usd: number) => string | null
  requiredModifierRef: RefObject<HTMLDivElement | null>
  selectedCatalogExtras: Record<string, number>
  selectedCatalogExtrasTotal: number
  selectedExtras: Record<string, number>
  selectedGroup: MenuProductGroup
  selectedProduct: Product
  selectedVariantId: string | null
  setDetailModifierGroups: Dispatch<SetStateAction<ProductModifierGroup[]>>
  setDetailNotes: Dispatch<SetStateAction<string>>
  setDetailQuantity: Dispatch<SetStateAction<number>>
  setLoadingModifiers: Dispatch<SetStateAction<boolean>>
  setModifierLoadError: Dispatch<SetStateAction<boolean>>
  setModifierValidationError: Dispatch<SetStateAction<string>>
  setSelectedCatalogExtras: Dispatch<SetStateAction<Record<string, number>>>
  setSelectedExtras: Dispatch<SetStateAction<Record<string, number>>>
  setSelectedVariantId: Dispatch<SetStateAction<string | null>>
  showModifierGuidance: boolean
  toggleProteinExclusion: (optionId: string) => void
}

export function ProductDetailDialog({ addingSelectedProduct, addSelectedProduct, catalogExtraProducts, closeProductDetail, closingDetail, complementaryProducts, detailExtrasTotal, detailModifierGroups, detailNotes, detailNotesRef, detailOrigin, detailQuantity, editingCartLineKey, invalidModifierSelection, loadingModifiers, modifierLoadError, modifierRequestRef, modifierSelectionError, modifierValidationError, priceBs, requiredModifierRef, selectedCatalogExtras, selectedCatalogExtrasTotal, selectedExtras, selectedGroup, selectedProduct, selectedVariantId, setDetailModifierGroups, setDetailNotes, setDetailQuantity, setLoadingModifiers, setModifierLoadError, setModifierValidationError, setSelectedCatalogExtras, setSelectedExtras, setSelectedVariantId, showModifierGuidance, toggleProteinExclusion }: ProductDetailDialogProps) {
  return (
createPortal(
            <div className={`public-modal-backdrop ${closingDetail ? 'closing' : ''}`} onClick={closeProductDetail}>
              <section
                className="public-product-detail-modal"
                onClick={event => event.stopPropagation()}
                style={detailOrigin ? { transformOrigin: `${detailOrigin.x}px ${detailOrigin.y}px` } : undefined}
              >
                <div className="ppdm-image">
                  <PhotoHero key={selectedProduct.imageUrl} imageUrl={selectedProduct.imageUrl} alt={selectedProduct.name} />
                  {selectedProduct.menuLabel === 'free_drink' && (
                    <img src="/icons/free-drink-badge.png" alt="Refresco gratis" className="ppdm-free-drink-sticker" />
                  )}
                  <button className="ppdm-close" onClick={closeProductDetail} aria-label="Cerrar detalle"><X /></button>
                  <span className="pd-steam" aria-hidden="true"><i /><i /><i /></span>
                  <div className="ppdm-hero-copy">
                    <h1><Fit>{productTitle(selectedGroup.name)}</Fit></h1>
                    <div className="ppdm-price">{money(selectedProduct.price)}{priceBs(selectedProduct.price) && <span className="ppdm-price-bs">{priceBs(selectedProduct.price)}</span>}</div>
                  </div>
                </div>
                <div className="ppdm-content">
                  <p className="ppdm-desc">{selectedProduct.description || 'Preparado al momento con el sabor de Full China.'}</p>
                  {showModifierGuidance && !loadingModifiers && detailModifierGroups.some(group => group.minSelections > 0 && !isIncludedProteinGroup(group)) && (
                    <div className="ppdm-required-guidance" role="status">
                      <CircleAlert size={17} aria-hidden="true" />
                      <span>Este plato requiere que elijas una opción antes de agregarlo. Completa el grupo marcado como obligatorio.</span>
                      <ArrowDown className="ppdm-required-guidance-arrow" size={19} aria-hidden="true" />
                    </div>
                  )}
                  {selectedGroup.variants.length > 1 && (
                    <div className="ppdm-section">
                      <div className="ppdm-section-header"><h3>Presentación</h3><span>Obligatorio</span></div>
                      <div className="ppdm-options">
                        {selectedGroup.variants.map(({ product, label }) => {
                          const variantCopy = publicVariantCopy(selectedGroup.name, label)
                          return (
                          <button
                            type="button"
                            className="ppdm-option"
                            key={product.id}
                            onClick={() => {
                              if (product.id === selectedVariantId) return
                              setSelectedVariantId(product.id)
                              setSelectedExtras({})
                              setModifierValidationError('')
                              setModifierLoadError(false)
                              setDetailModifierGroups([])
                              setLoadingModifiers(true)
                              const requestId = modifierRequestRef.current + 1
                              modifierRequestRef.current = requestId
                              const cached = PUBLIC_MODIFIER_CACHE.get(product.id)
                              const applyGroups = (groups: ProductModifierGroup[]) => filterProteinExtraGroups(groups, product.allowProteinExtras !== false).filter(item => item.options.length > 0).map(item => ({ ...item, options: [...item.options] }))
                              if (cached) {
                                const preparedGroups = applyGroups(cached)
                                setDetailModifierGroups(preparedGroups)
                                setSelectedExtras(getDefaultModifierSelection(preparedGroups))
                                setLoadingModifiers(false)
                              } else {
                                getPublicProductModifiers(product.id).then(groups => {
                                  PUBLIC_MODIFIER_CACHE.set(product.id, groups)
                                  if (modifierRequestRef.current === requestId) {
                                    const preparedGroups = applyGroups(groups)
                                    setDetailModifierGroups(preparedGroups)
                                    setSelectedExtras(getDefaultModifierSelection(preparedGroups))
                                  }
                                }).catch(() => {
                                  if (modifierRequestRef.current === requestId) setModifierLoadError(true)
                                }).finally(() => {
                                  if (modifierRequestRef.current === requestId) setLoadingModifiers(false)
                                })
                              }
                            }}
                          >
                            <span className="ppdm-radio"><span className={`ppdm-radio-inner ${selectedProduct.id === product.id ? 'active' : ''}`} /></span>
                            <span className="ppdm-option-name">
                              <span>{variantCopy.name}</span>
                              {variantCopy.count && <small className="ppdm-option-count">×{variantCopy.count}</small>}
                              {product.menuLabel === 'free_drink' && <small className="ppdm-option-free-drink"><CupSoda size={12} aria-hidden="true" /> Refresco gratis</small>}
                            </span>
                            <span className="ppdm-option-price">{money(product.price)}</span>
                          </button>
                          )
                        })}
                      </div>
                    </div>
                  )}
                  {loadingModifiers && detailModifierGroups.length === 0 ? (
                    <div className="ppdm-section ppdm-extras-section">
                      <div className="ppdm-section-header"><h3>Extras <small><LoadingSkeleton label="Cargando extras" variant="inline" /></small></h3></div>
                      <div className="ppdm-chip-row">
                        {[0, 1, 2, 3, 4, 5].map(i => (
                          <div className="ppdm-chip ppdm-chip-skeleton public-skeleton-block" key={i} />
                        ))}
                      </div>
                    </div>
                  ) : detailModifierGroups.length > 0 && (
                    <div className="ppdm-section ppdm-extras-section">
                      {detailModifierGroups.map(group => {
                        const count = countModifierSelections(group, selectedExtras)
                        const proteinGroup = isIncludedProteinGroup(group)
                        const requiredGroup = !proteinGroup && group.minSelections > 0
                        const groupError = requiredGroup && modifierSelectionError?.modifierId === group.modifierId
                        return <div ref={requiredGroup ? requiredModifierRef : undefined} className={`ppdm-modifier-group ${proteinGroup ? 'ppdm-modifier-group--included-proteins' : ''}${requiredGroup ? ' ppdm-modifier-group--required' : ''}${groupError ? ' has-selection-error' : ''}${groupError && modifierValidationError ? ' has-selection-alert' : ''}`} key={group.modifierId}>
                          {proteinGroup ? <>
                            <div className="ppdm-section-header">
                              <h3>Proteínas del plato</h3>
                            </div>
                            <p className="ppdm-protein-hint">Si no quieres alguna proteína, indícalo aquí para que cocina la quite. No se sustituye por otra.</p>
                            <div className="ppdm-protein-options">{group.options.map(option => {
                              const quantity = selectedExtras[option.id] ?? 0
                              const optionName = formatSpanishText(option.name)
                              return <div className="ppdm-protein-option" key={option.id}>
                                <span className="ppdm-protein-option-name">{optionName}</span>
                                <span className={`ppdm-protein-option-quantity${quantity === 0 ? ' is-unselected' : ''}`}>
                                  {quantity === 0 ? 'Se quitará' : `${quantity} ${quantity === 1 ? 'porción' : 'porciones'}`}
                                  {option.price > 0 && quantity > 0 && <small>+{money(option.price)} por porción</small>}
                                </span>
                                <button type="button" className="ppdm-protein-change" onClick={() => toggleProteinExclusion(option.id)} aria-pressed={quantity === 0} aria-label={quantity === 0 ? `Volver a incluir ${optionName}` : `Pedir sin ${optionName}`}>
                                  {quantity === 0 ? 'Volver a incluir' : 'Quitar'}
                                </button>
                              </div>
                            })}</div>
                          </> : <>
                            <div className="ppdm-section-header"><h3>{formatSpanishText(group.name)} <small>{group.minSelections > 0 ? `· Elige ${group.minSelections === 1 ? '1 opción' : `al menos ${group.minSelections}`}` : '· Opcional'}{group.maxSelections !== null ? ` · Máx. ${group.maxSelections}` : ''}</small></h3><span>{group.minSelections > 0 ? 'Obligatorio · ' : ''}{count}{group.maxSelections !== null ? `/${group.maxSelections}` : ''}</span></div>
                            {groupError && <p className="ppdm-required-group-error" role="alert">Elige una opción de {formatSpanishText(group.name)} para continuar.</p>}
                            <div className="ppdm-chip-row">{group.options.map(option => {
                              const selectedCount = selectedExtras[option.id] ?? 0
                              const active = selectedCount > 0
                              const countReached = group.maxSelections !== null && count >= group.maxSelections
                              return <button type="button" className={`ppdm-chip ${active ? 'active' : ''}`} key={option.id} aria-pressed={active}
                                disabled={!active && (countReached || (group.allowRepeat && selectedCount >= PUBLIC_ORDER_MAX_UNITS_PER_PRESENTATION))}
                                onClick={() => {
                                  setModifierValidationError('')
                                  setSelectedExtras(current => {
                                    const next = { ...current }
                                    if (active && !group.allowRepeat) delete next[option.id]
                                    else if (active && group.allowRepeat) {
                                      if (selectedCount <= 1) delete next[option.id]
                                      else next[option.id] = selectedCount - 1
                                    } else if (!countReached) next[option.id] = 1
                                    return next
                                  })
                                }}>
                                <span className="ppdm-chip-name">{formatSpanishText(option.name)}</span>
                                {group.allowRepeat && active && <span className="ppdm-chip-count">×{selectedCount}</span>}
                                {option.price > 0 && <span className="ppdm-chip-price">+{money(option.price)}</span>}
                                <span className="ppdm-chip-check"><Check size={12} /></span>
                              </button>
                            })}</div>
                          </>}
                        </div>
                      })}
                    </div>
                  )}
                  {catalogExtraProducts.length > 0 && (
                    <div className="ppdm-section ppdm-catalog-extras">
                      <div className="ppdm-section-header"><h3>Agrega extras <small>· Opcional</small></h3><span>Se agregan al pedido</span></div>
                      <div className="ppdm-catalog-extra-list">
                        {catalogExtraProducts.map(product => {
                          const quantity = selectedCatalogExtras[product.id] ?? 0
                          const [extraTitleLead, extraTitleDetail] = product.name.split('—', 2)
                          return <div className="ppdm-catalog-extra" key={product.id}>
                            <Thumb className="ppdm-catalog-extra-image" imageUrl={product.imageUrl} alt={formatProductTitle(product.name)} />
                            <div><strong>{extraTitleDetail ? <><span>{formatProductTitle(extraTitleLead)}</span><span>— {formatProductTitle(extraTitleDetail)}</span></> : formatProductTitle(product.name)}</strong><span className="ppdm-catalog-extra-price"><strong>{money(product.price)}</strong><small>por unidad</small></span></div>
                            {quantity === 0
                              ? <button type="button" className="ppdm-catalog-extra-add" onClick={() => setSelectedCatalogExtras(current => ({ ...current, [product.id]: 1 }))}>Agregar <Plus size={14} /></button>
                              : <div className="ppdm-catalog-extra-qty"><button type="button" aria-label={`Quitar una unidad de ${product.name}`} onClick={() => setSelectedCatalogExtras(current => ({ ...current, [product.id]: quantity <= 1 ? 0 : quantity - 1 }))}><Minus size={14} /></button><b>{quantity}</b><button type="button" aria-label={`Agregar una unidad de ${product.name}`} disabled={quantity >= PUBLIC_ORDER_MAX_UNITS_PER_PRESENTATION} onClick={() => setSelectedCatalogExtras(current => ({ ...current, [product.id]: Math.min(PUBLIC_ORDER_MAX_UNITS_PER_PRESENTATION, quantity + 1) }))}><Plus size={14} /></button></div>}
                          </div>
                        })}
                      </div>
                      <p className="ppdm-catalog-extra-hint">Cada extra se añadirá como su propio producto y se cobrará a su precio vigente.</p>
                    </div>
                  )}
                  {!editingCartLineKey && complementaryProducts.length > 0 && (
                    <div className="ppdm-section ppdm-complementary-products">
                      <div className="ppdm-section-header"><h3>Completa tu pedido <small>· Opcional</small></h3><span>Se agregan por separado</span></div>
                      <div className="ppdm-complementary-carousel" aria-label="Productos para completar tu pedido">
                        {complementaryProducts.map(product => {
                          const quantity = selectedCatalogExtras[product.id] ?? 0
                          return <div className="ppdm-catalog-extra" key={product.id}>
                            <Thumb className="ppdm-complementary-image" imageUrl={product.imageUrl} alt={formatProductTitle(product.name)} />
                            <div className="ppdm-complementary-copy"><strong>{formatProductTitle(product.name)}</strong><span className="ppdm-catalog-extra-price"><strong>{money(product.price)}</strong></span></div>
                            {quantity === 0
                              ? <button type="button" className="ppdm-complementary-add" aria-label={`Agregar ${product.name} al pedido`} onClick={() => setSelectedCatalogExtras(current => ({ ...current, [product.id]: 1 }))}><Plus size={16} /> Agregar</button>
                              : <div className="ppdm-complementary-qty"><button type="button" aria-label={`Quitar una unidad de ${product.name}`} onClick={() => setSelectedCatalogExtras(current => ({ ...current, [product.id]: quantity <= 1 ? 0 : quantity - 1 }))}><Minus size={14} /></button><b>{quantity}</b><button type="button" aria-label={`Agregar una unidad de ${product.name}`} disabled={quantity >= PUBLIC_ORDER_MAX_UNITS_PER_PRESENTATION} onClick={() => setSelectedCatalogExtras(current => ({ ...current, [product.id]: Math.min(PUBLIC_ORDER_MAX_UNITS_PER_PRESENTATION, quantity + 1) }))}><Plus size={14} /></button></div>}
                          </div>
                        })}
                      </div>
                    </div>
                  )}
                  {modifierSelectionError?.options.length === 0 && <p className="ppdm-modifier-error" role="alert"><span className="ppdm-error-group-name">“{formatSpanishText(modifierSelectionError.name)}”</span> no tiene opciones disponibles. Elige otro producto o contacta al local.</p>}
                  {invalidModifierSelection && <p className="ppdm-modifier-error" role="alert">Algunas opciones guardadas ya no están disponibles. <button type="button" onClick={() => { setSelectedExtras({}); setModifierValidationError('') }}>Limpiar opciones anteriores</button></p>}
                  {modifierLoadError && <p className="ppdm-modifier-error" role="alert">No pudimos cargar las opciones de este producto. Inténtalo de nuevo.</p>}
                  <label className="ppdm-instructions-field">Indicaciones <small>(opcional)</small><textarea ref={detailNotesRef} value={detailNotes} maxLength={160} onChange={event => setDetailNotes(event.target.value)} placeholder="Ej. Sin cebollín, por favor…" aria-label="Indicaciones para este plato (máximo 160 caracteres)" />{detailNotes.length === 160 && <span className="ppdm-instructions-limit-notice" role="status" aria-live="polite">Llegaste al límite de 160 caracteres; ya no puedes escribir más.</span>}<span className={detailNotes.length === 160 ? 'is-at-limit' : ''}>{detailNotes.length}/160</span></label>
                </div>
                <footer className="ppdm-footer">
                  {modifierValidationError && <p className="ppdm-footer-feedback" id="ppdm-add-feedback" role="alert" aria-live="assertive"><CircleAlert size={17} aria-hidden="true" /><span>{modifierValidationError}</span></p>}
                  <div className="ppdm-qty">
                    <button type="button" onClick={() => setDetailQuantity(value => Math.max(1, value - 1))} aria-label="Disminuir cantidad"><Minus /></button>
                    <span key={detailQuantity}>{detailQuantity}</span>
                    <button type="button" onClick={() => setDetailQuantity(value => value + 1)} aria-label="Aumentar cantidad"><Plus /></button>
                  </div>
                  <button type="button" className="ppdm-add-btn" aria-describedby={modifierValidationError ? 'ppdm-add-feedback' : undefined} aria-busy={addingSelectedProduct} disabled={loadingModifiers || Boolean(modifierLoadError) || invalidModifierSelection || addingSelectedProduct} onClick={addSelectedProduct}>{addingSelectedProduct ? <><LoaderCircle className="public-add-spinner" size={17} /> Agregando…</> : <>{editingCartLineKey ? 'Guardar cambios' : 'Al wok'} <Odo className="ppdm-add-btn-total" value={money((selectedProduct.price + detailExtrasTotal + selectedCatalogExtrasTotal) * detailQuantity)} /></>}</button>
                </footer>
              </section>
            </div>,
            document.body
          )
  )
}
