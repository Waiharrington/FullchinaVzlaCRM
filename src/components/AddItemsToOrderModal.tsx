import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { X, Search, Check, CheckCircle2, ChevronLeft, Circle, Minus, Plus, UtensilsCrossed } from 'lucide-react'
import { MoneyWithBcv } from './MoneyWithBcv'
import { LoadingSkeleton } from './LoadingSkeleton'
import {
  addItemsToOrder,
  getProducts,
  getProductsWithModifiers,
  getProductModifiers,
  type Product,
  type CartItem,
  type ProductModifierGroup,
  type SelectedModifier,
  isQuantityModifierGroup,
} from '../lib/dataService'
import { normalizeForSearch } from '../lib/textFormat'
import { useLiveDataRefresh } from '../lib/liveDataRefresh'
import { EmptyState } from './EmptyState'
import './AddItemsToOrderModal.css'

const genLineId = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`

interface AddItemsToOrderModalProps {
  orderId: string
  orderNumber: string
  onClose: () => void
  /** Llamado tras insertar en la BD, con los ítems agregados (para refrescar la UI). */
  onAdded: (items: CartItem[]) => void
}

export function AddItemsToOrderModal({ orderId, orderNumber, onClose, onAdded }: AddItemsToOrderModalProps) {
  const [products, setProducts] = useState<Product[]>([])
  const [catalogRevision, setCatalogRevision] = useState(0)
  const [withMods, setWithMods] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [search, setSearch] = useState('')
  const [pending, setPending] = useState<CartItem[]>([])
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [closing, setClosing] = useState(false)
  const hasLoadedCatalog = useRef(false)

  useLiveDataRefresh('selector-productos', () => setCatalogRevision(revision => revision + 1))

  // Selector de modificadores (sub-vista dentro del mismo modal)
  const [modProduct, setModProduct] = useState<Product | null>(null)
  const [modGroups, setModGroups] = useState<ProductModifierGroup[]>([])
  const [modSel, setModSel] = useState<Record<string, Record<string, number>>>({})
  const [modLoading, setModLoading] = useState(false)
  const [modError, setModError] = useState('')

  useEffect(() => {
    let alive = true
    if (!hasLoadedCatalog.current) setLoading(true)
    Promise.all([getProducts(), getProductsWithModifiers()])
      .then(([prods, mods]) => {
        if (!alive) return
        setProducts(prods)
        setWithMods(mods)
        hasLoadedCatalog.current = true
      })
      .catch((e) => {
        if (alive) setLoadError(e instanceof Error ? e.message : 'No se pudieron cargar los productos')
      })
      .finally(() => {
        if (alive) setLoading(false)
      })
    return () => {
      alive = false
    }
  }, [catalogRevision])

  const filtered = useMemo(() => {
    const q = normalizeForSearch(search)
    if (!q) return products
    return products.filter((p) => normalizeForSearch(p.name).includes(q) || normalizeForSearch(p.category).includes(q))
  }, [products, search])

  const pendingTotal = pending.reduce((s, i) => s + i.price * i.quantity, 0)

  const pickProduct = (product: Product) => {
    if (withMods.has(product.id)) {
      void openMod(product)
      return
    }
    setPending((prev) => {
      const existing = prev.find(
        (i) => i.productId === product.id && (!i.selectedModifiers || i.selectedModifiers.length === 0),
      )
      if (existing) return prev.map((i) => (i === existing ? { ...i, quantity: i.quantity + 1 } : i))
      return [
        ...prev,
        { lineId: genLineId(), productId: product.id, productName: product.name, price: product.price, quantity: 1, emoji: product.emoji },
      ]
    })
  }

  const openMod = async (product: Product) => {
    setModProduct(product)
    setModGroups([])
    setModSel({})
    setModError('')
    setModLoading(true)
    try {
      const groups = await getProductModifiers(product.id)
      setModGroups(groups)
      const init: Record<string, Record<string, number>> = {}
      for (const g of groups) {
        init[g.modifierId] = {}
        if (g.minSelections >= 1 && g.maxSelections === 1 && g.options.length > 0) {
          init[g.modifierId][g.options[0].id] = 1
        } else if (isQuantityModifierGroup(g)) {
          g.options.slice(0, g.maxSelections ?? g.options.length).forEach((option) => { init[g.modifierId][option.id] = 1 })
        }
      }
      setModSel(init)
    } catch (e) {
      setModError(e instanceof Error ? e.message : 'No se pudieron cargar los modificadores')
    } finally {
      setModLoading(false)
    }
  }

  const closeMod = () => {
    setModProduct(null)
    setModGroups([])
    setModSel({})
    setModError('')
  }

  const toggleMod = (group: ProductModifierGroup, optionId: string) => {
    setModError('')
    setModSel((prev) => {
      const groupSel = { ...(prev[group.modifierId] ?? {}) }
      if (group.maxSelections === 1) {
        return { ...prev, [group.modifierId]: { [optionId]: 1 } }
      }
      const current = groupSel[optionId] ?? 0
      const totalSelected = Object.values(groupSel).reduce((s, n) => s + n, 0)
      if (isQuantityModifierGroup(group)) {
        if (current > 0) delete groupSel[optionId]
        else if (group.maxSelections == null || totalSelected < group.maxSelections) groupSel[optionId] = 1
      } else if (current > 0 && !group.allowRepeat) {
        delete groupSel[optionId]
      } else {
        if (group.maxSelections != null && totalSelected >= group.maxSelections) return prev
        groupSel[optionId] = group.allowRepeat ? current + 1 : 1
      }
      return { ...prev, [group.modifierId]: groupSel }
    })
  }

  const changeQuantityModifier = (group: ProductModifierGroup, optionId: string, delta: number) => {
    if (!isQuantityModifierGroup(group)) return
    setModSel((prev) => {
      const current = prev[group.modifierId]?.[optionId] ?? 0
      const total = Object.values(prev[group.modifierId] ?? {}).reduce((sum, qty) => sum + qty, 0)
      if (delta > 0 && total >= (group.maxSelections ?? Number.MAX_SAFE_INTEGER)) return prev
      const next = Math.max(0, current + delta)
      const groupSel = { ...(prev[group.modifierId] ?? {}) }
      if (next === 0) delete groupSel[optionId]
      else groupSel[optionId] = next
      return { ...prev, [group.modifierId]: groupSel }
    })
  }

  const modExtra = useMemo(() => {
    let extra = 0
    for (const g of modGroups) {
      const sel = modSel[g.modifierId] ?? {}
      for (const [optId, qty] of Object.entries(sel)) {
        const opt = g.options.find((o) => o.id === optId)
        if (opt) extra += opt.price * qty
      }
    }
    return extra
  }, [modGroups, modSel])

  // Fotos de las opciones (Pollo, Camarón…): salen de los productos de extras
  // del menú ("Extra de Camarón", "Extra de Cerdo"…), que ya vienen en el catálogo.
  const extraPhotoByOption = useMemo(() => {
    const map = new Map<string, string>()
    for (const product of products) {
      if (!product.imageUrl) continue
      const match = normalizeForSearch(product.name).match(/extras? de (.+)$/)
      if (match && !map.has(match[1].trim())) map.set(match[1].trim(), product.imageUrl)
    }
    return map
  }, [products])

  const optionPhoto = (optionName: string) => {
    const key = normalizeForSearch(optionName)
    const exact = extraPhotoByOption.get(key)
    if (exact) return exact
    for (const [name, url] of extraPhotoByOption) {
      if (name.includes(key) || key.includes(name)) return url
    }
    return undefined
  }

  const modSummary = useMemo(() => modGroups
    .flatMap((group) => Object.entries(modSel[group.modifierId] ?? {})
      .filter(([, qty]) => qty > 0)
      .map(([optionId, qty]) => {
        const option = group.options.find((candidate) => candidate.id === optionId)
        return option ? `${option.name}${qty > 1 ? ` ×${qty}` : ''}` : ''
      }))
    .filter(Boolean)
    .join(', '), [modGroups, modSel])

  const confirmMod = () => {
    if (!modProduct) return
    for (const g of modGroups) {
      const sel = modSel[g.modifierId] ?? {}
      const count = Object.values(sel).reduce((s, n) => s + n, 0)
      if (count < g.minSelections) {
        setModError(`Elige al menos ${g.minSelections} en "${g.name}"`)
        return
      }
      if (g.maxSelections != null && count > g.maxSelections) {
        setModError(`Máximo ${g.maxSelections} en "${g.name}"`)
        return
      }
    }
    const selected: SelectedModifier[] = []
    for (const g of modGroups) {
      const sel = modSel[g.modifierId] ?? {}
      for (const [optId, qty] of Object.entries(sel)) {
        if (qty <= 0) continue
        const opt = g.options.find((o) => o.id === optId)
        if (opt) selected.push({ optionId: optId, optionName: opt.name, modifierName: g.name, price: opt.price, quantity: qty })
      }
    }
    setPending((prev) => [
      ...prev,
      {
        lineId: genLineId(),
        productId: modProduct.id,
        productName: modProduct.name,
        price: modProduct.price + modExtra,
        quantity: 1,
        emoji: modProduct.emoji,
        selectedModifiers: selected,
      },
    ])
    closeMod()
  }

  const changeQty = (lineId: string, delta: number) => {
    setPending((prev) =>
      prev.map((i) => (i.lineId === lineId ? { ...i, quantity: i.quantity + delta } : i)).filter((i) => i.quantity > 0),
    )
  }

  const removePending = (lineId: string) => setPending((prev) => prev.filter((i) => i.lineId !== lineId))

  const requestClose = () => {
    if (closing) return
    setClosing(true)
    window.setTimeout(() => {
      onClose()
    }, 200)
  }

  const handleSave = async () => {
    if (pending.length === 0) return
    setSaving(true)
    setSaveError('')
    try {
      await addItemsToOrder(orderId, pending)
      onAdded(pending)
      requestClose()
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'No se pudieron agregar los productos')
    } finally {
      setSaving(false)
    }
  }

  return createPortal(
    <div className={`aito-overlay ${closing ? 'closing' : ''}`} onClick={requestClose}>
      <section className="aito-modal" role="dialog" aria-modal="true" aria-label="Agregar productos al pedido" onClick={(e) => e.stopPropagation()}>
        <header className="aito-header">
          <div>
            <span className="aito-eyebrow">Agregar productos</span>
            <h2>Pedido {orderNumber}</h2>
          </div>
          <button type="button" className="aito-close" onClick={requestClose} aria-label="Cerrar">
            <X size={18} />
          </button>
        </header>

        {modProduct ? (
          <>
            <div className="aito-body aito-mod-body">
              <button type="button" className="aito-back" onClick={closeMod}><ChevronLeft size={15} /> Volver a productos</button>
              <div className="aito-mod-hero">
                <span className="aito-mod-hero-photo">
                  {modProduct.imageUrl ? <img src={modProduct.imageUrl} alt="" /> : <UtensilsCrossed size={22} />}
                </span>
                <div>
                  <h3 className="aito-mod-title">{modProduct.name}</h3>
                  <span className="aito-mod-base">Precio base <MoneyWithBcv usd={modProduct.price} compact align="start" /></span>
                </div>
              </div>
              {modLoading && (
                <div className="aito-mod-skeleton" role="status" aria-label="Cargando opciones del producto">
                  <span className="aito-optcard-skeleton is-head" aria-hidden="true"><i /><i /></span>
                  <div className="aito-optgrid" aria-hidden="true">
                    {Array.from({ length: 4 }, (_, index) => (
                      <span key={index} className="aito-optcard aito-optcard-skeleton"><i /><span><i /><i /></span><i /></span>
                    ))}
                  </div>
                </div>
              )}
              {!modLoading && modGroups.length === 0 && <p className="aito-muted">Este producto no tiene opciones configuradas.</p>}
              {!modLoading &&
                modGroups.map((group) => {
                  const sel = modSel[group.modifierId] ?? {}
                  const chosen = Object.values(sel).reduce((sum, qty) => sum + qty, 0)
                  const isQuantity = isQuantityModifierGroup(group)
                  const max = group.maxSelections
                  const rule =
                    max === 1
                      ? group.minSelections >= 1 ? 'Elige 1' : 'Elige 1 (opcional)'
                      : max != null
                        ? group.minSelections > 0 ? `Elige de ${group.minSelections} a ${max}` : `Elige hasta ${max}`
                        : group.minSelections > 0 ? `Elige al menos ${group.minSelections}` : 'Elige las que quieras'
                  const groupFull = max != null && chosen >= max
                  return (
                    <section key={group.modifierId} className="aito-mod-group">
                      <div className="aito-mod-grouphead">
                        <div>
                          <strong>{group.name}</strong>
                          <small>{rule}</small>
                        </div>
                        <span className={`aito-mod-counter ${chosen < group.minSelections ? 'is-missing' : groupFull ? 'is-full' : ''}`}>
                          {max != null ? `${chosen} de ${max}` : `${chosen} elegidas`}
                        </span>
                      </div>
                      <div className="aito-optgrid">
                        {group.options.map((opt) => {
                          const qty = sel[opt.id] ?? 0
                          const selected = qty > 0
                          const photo = optionPhoto(opt.name)
                          const blocked = !selected && groupFull && max !== 1
                          const content = (
                            <>
                              <span className="aito-optcard-photo">
                                {photo ? <img src={photo} alt="" loading="lazy" /> : <UtensilsCrossed size={20} />}
                                {selected && <span className="aito-optcard-badge" aria-hidden="true">{qty > 1 ? `×${qty}` : <Check size={13} strokeWidth={3.2} />}</span>}
                              </span>
                              <span className="aito-optcard-copy">
                                <span className="aito-optcard-name">{opt.name}</span>
                                {opt.price > 0
                                  ? <span className="aito-optcard-price">+ <MoneyWithBcv usd={opt.price} compact align="start" /></span>
                                  : <span className="aito-optcard-incl">Incluido</span>}
                              </span>
                            </>
                          )
                          return isQuantity ? (
                            <div key={opt.id} className={`aito-optcard ${selected ? 'is-selected' : ''}`}>
                              {content}
                              <span className="aito-optcard-stepper">
                                <button type="button" onClick={() => changeQuantityModifier(group, opt.id, -1)} disabled={!selected} aria-label={`Quitar ${opt.name}`}><Minus size={15} /></button>
                                <strong aria-live="polite">{qty}</strong>
                                <button type="button" onClick={() => changeQuantityModifier(group, opt.id, 1)} disabled={groupFull} aria-label={`Agregar ${opt.name}`}><Plus size={15} /></button>
                              </span>
                            </div>
                          ) : (
                            <button
                              key={opt.id}
                              type="button"
                              className={`aito-optcard is-toggle ${selected ? 'is-selected' : ''} ${blocked ? 'is-blocked' : ''}`}
                              aria-pressed={selected}
                              onClick={() => toggleMod(group, opt.id)}
                            >
                              {content}
                              <span className="aito-optcard-check" aria-hidden="true">{selected ? <CheckCircle2 size={20} /> : <Circle size={20} />}</span>
                            </button>
                          )
                        })}
                      </div>
                    </section>
                  )
                })}
              {modError && <p className="aito-error">{modError}</p>}
            </div>
            {!modLoading && modGroups.length > 0 && (
              <footer className="aito-footer aito-mod-footer">
                <div className="aito-total">
                  <span className="aito-total-label">Precio</span>
                  <MoneyWithBcv usd={modProduct.price + modExtra} align="start" className="aito-total-money" />
                  {modSummary && <span className="aito-mod-summary">{modSummary}</span>}
                </div>
                <button type="button" className="aito-cta" onClick={confirmMod}><Plus size={17} /> Añadir al pedido</button>
              </footer>
            )}
          </>
        ) : (
          <>
            <div className="aito-search">
              <Search size={15} />
              <input
                type="text"
                placeholder="Buscar producto…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="aito-body">
              {loading && <LoadingSkeleton label="Cargando productos" variant="cards" count={4} className="aito-loading-cards" />}
              {loadError && <p className="aito-error">{loadError}</p>}
              {!loading && !loadError && (
                <div className="aito-grid">
                  {filtered.map((p) => (
                    <button key={p.id} type="button" className="aito-card" onClick={() => pickProduct(p)}>
                      <span className="aito-card-photo">
                        {p.imageUrl ? <img src={p.imageUrl} alt="" /> : <span className="aito-card-emoji"><UtensilsCrossed size={16} /></span>}
                        {withMods.has(p.id) && <span className="aito-card-badge">Opciones</span>}
                      </span>
                      <span className="aito-card-body">
                        <span className="aito-card-name">{p.name}</span>
                        <span className="aito-card-foot">
                          <MoneyWithBcv usd={p.price} className="aito-card-price" align="start" compact />
                          <span className="aito-card-add">{withMods.has(p.id) ? 'Elegir' : 'Agregar'}</span>
                        </span>
                      </span>
                    </button>
                  ))}
                </div>
              )}
              {!loading && !loadError && filtered.length === 0 && (
                <EmptyState compact title="Sin resultados" description="Prueba con otro nombre o categoría." />
              )}
            </div>

            {pending.length > 0 && (
              <div className="aito-pending">
                <div className="aito-pending-title">Por agregar ({pending.length})</div>
                {pending.map((i) => (
                  <div key={i.lineId} className="aito-pending-row">
                    <div className="aito-pending-info">
                      <span className="aito-pending-name">{i.productName}</span>
                      {i.selectedModifiers && i.selectedModifiers.length > 0 && (
                        <span className="aito-pending-mods">{i.selectedModifiers.map((m) => `${m.optionName}${m.quantity > 1 ? ` ×${m.quantity}` : ''}`).join(', ')}</span>
                      )}
                    </div>
                    <div className="aito-qty">
                      <button type="button" onClick={() => changeQty(i.lineId!, -1)} aria-label="Quitar uno">−</button>
                      <span>{i.quantity}</span>
                      <button type="button" onClick={() => changeQty(i.lineId!, 1)} aria-label="Agregar uno">+</button>
                    </div>
                    <MoneyWithBcv usd={i.price * i.quantity} className="aito-pending-price" align="end" compact />
                    <button type="button" className="aito-pending-del" onClick={() => removePending(i.lineId!)} aria-label="Eliminar del listado">
                      <X size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <footer className="aito-footer">
              <div className="aito-total">
                <span className="aito-total-label">Total a agregar</span>
                <MoneyWithBcv usd={pendingTotal} align="start" className="aito-total-money" />
              </div>
              <button type="button" className="aito-cta" disabled={pending.length === 0 || saving} onClick={handleSave}>
                {saving ? 'Agregando…' : pending.length > 0 ? `Agregar ${pending.length} al pedido` : 'Agregar al pedido'}
              </button>
            </footer>
            {saveError && <p className="aito-error aito-error-foot">{saveError}</p>}
          </>
        )}
      </section>
    </div>,
    document.body,
  )
}
