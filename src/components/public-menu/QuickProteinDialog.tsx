import type { MenuVariant } from '../../lib/menuGrouping'
import { type Dispatch, type SetStateAction } from 'react'
import { createPortal } from 'react-dom'
import { Drumstick, X, Check, Minus } from 'lucide-react'
import { productTitle, money } from '../../lib/publicMenuFormat'
import { formatSpanishText } from '../../lib/textFormat'
import { type MenuProductGroup } from '../../lib/menuGrouping'
import { type ProductModifierGroup } from '../../lib/dataService'

interface QuickProteinDialogProps {
  applyQuickProteinDraft: () => void
  quickSelectedVariant: MenuVariant
  quickVariantGroup: MenuProductGroup | null
  quickVariantProteinDraft: Record<string, number>
  quickVariantProteinGroup: ProductModifierGroup
  setQuickProteinDialogOpen: Dispatch<SetStateAction<boolean>>
  toggleQuickProteinDraft: (optionId: string) => void
}

export function QuickProteinDialog({ applyQuickProteinDraft, quickSelectedVariant, quickVariantGroup, quickVariantProteinDraft, quickVariantProteinGroup, setQuickProteinDialogOpen, toggleQuickProteinDraft }: QuickProteinDialogProps) {
  return (
createPortal(
            <div className="public-protein-removal-backdrop" onClick={() => setQuickProteinDialogOpen(false)}>
              <section className="public-protein-removal-dialog" role="dialog" aria-modal="true" aria-labelledby="public-protein-removal-title" onClick={event => event.stopPropagation()}>
                <header className="public-protein-removal-header">
                  <span className="public-protein-removal-icon"><Drumstick size={20} aria-hidden="true" /></span>
                  <div>
                    <small>PERSONALIZA TU PLATO</small>
                    <h2 id="public-protein-removal-title">¿Qué proteína quieres quitar?</h2>
                    <p>{productTitle(quickVariantGroup?.name ?? quickSelectedVariant.product.name)} · {money(quickSelectedVariant.product.price)}</p>
                  </div>
                  <button type="button" className="public-protein-removal-close" onClick={() => setQuickProteinDialogOpen(false)} aria-label="Cerrar"><X size={18} /></button>
                </header>
                <div className="public-protein-removal-body">
                  <p>Desmarca las que no quieras. No se sustituyen y el precio no cambia.</p>
                  <div className="public-protein-removal-list">
                    {quickVariantProteinGroup.options.map(option => {
                      const staysInDish = (quickVariantProteinDraft[option.id] ?? 0) > 0
                      return (
                        <button
                          type="button"
                          className={`public-protein-removal-option${staysInDish ? ' is-kept' : ' is-removed'}`}
                          key={option.id}
                          aria-pressed={staysInDish}
                          onClick={() => toggleQuickProteinDraft(option.id)}
                        >
                          <span className="public-protein-removal-check" aria-hidden="true">{staysInDish ? <Check size={16} /> : <Minus size={16} />}</span>
                          <strong>{formatSpanishText(option.name)}</strong>
                          <small>{staysInDish ? 'Se queda' : 'Se quitará'}</small>
                        </button>
                      )
                    })}
                  </div>
                </div>
                <footer className="public-protein-removal-footer">
                  <button type="button" className="public-protein-removal-cancel" onClick={() => setQuickProteinDialogOpen(false)}>Cancelar</button>
                  <button type="button" className="public-protein-removal-apply" onClick={applyQuickProteinDraft}>Aplicar cambios</button>
                </footer>
              </section>
            </div>,
            document.body,
          )
  )
}
