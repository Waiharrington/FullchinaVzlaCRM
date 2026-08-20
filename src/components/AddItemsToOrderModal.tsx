import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { X, Search } from 'lucide-react'
import { MoneyWithBcv } from './MoneyWithBcv'
import {
  addItemsToOrder,
  getProducts,
  getProductsWithModifiers,
  getProductModifiers,
  type Product,
  type CartItem,
  type ProductModifierGroup,
  type SelectedModifier,
} from '../lib/dataService'
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
  const [withMods, setWithMods] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [search, setSearch] = useState('')
  const [pending, setPending] = useState<CartItem[]>([])
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')

  // Selector de modificadores (sub-vista dentro del mismo modal)
  const [modProduct, setModProduct] = useState<Product | null>(null)
  const [modGroups, setModGroups] = useState<ProductModifierGroup[]>([])
  const [modSel, setModSel] = useState<Record<string, Record<string, number>>>({})
  const [modLoading, setModLoading] = useState(false)
  const [modError, setModError] = useState('')

  useEffect(() => {
    let alive = true
    Promise.all([getProducts(), getProductsWithModifiers()])
      .then(([prods, mods]) => {
        if (!alive) return
        setProducts(prods)
        setWithMods(mods)
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
  }, [])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return products
    return products.filter((p) => p.name.toLowerCase().includes(q) || p.category.toLowerCase().includes(q))
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
      if (current > 0 && !group.allowRepeat) {
        delete groupSel[optionId]
      } else {
        if (group.maxSelections != null && totalSelected >= group.maxSelections) return prev
        groupSel[optionId] = group.allowRepeat ? current + 1 : 1
      }
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

  const handleSave = async () => {
    if (pending.length === 0) return
    setSaving(true)
    setSaveError('')
    try {
      await addItemsToOrder(orderId, pending)
      onAdded(pending)
      onClose()
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'No se pudieron agregar los productos')
    } finally {
      setSaving(false)
    }
  }

  return createPortal(
    <div className="aito-overlay" onClick={onClose}>
      <section className="aito-modal" role="dialog" aria-modal="true" aria-label="Agregar productos al pedido" onClick={(e) => e.stopPropagation()}>
        <header className="aito-header">
          <div>
            <span className="aito-eyebrow">Agregar productos</span>
            <h2>Pedido {orderNumber}</h2>
          </div>
          <button type="button" className="aito-close" onClick={onClose} aria-label="Cerrar">
            <X size={18} />
          </button>
        </header>

        {modProduct ? (
          <>
            <div className="aito-body">
              <button type="button" className="aito-back" onClick={closeMod}>← Volver a productos</button>
              <h3 className="aito-mod-title">{modProduct.name}</h3>
              {modLoading && <p className="aito-muted" role="status">Cargando opciones…</p>}
              {!modLoading && modGroups.length === 0 && <p className="aito-muted">Este producto no tiene opciones configuradas.</p>}
              {!modLoading &&
                modGroups.map((group) => {
                  const sel = modSel[group.modifierId] ?? {}
                  const rule =
                    group.maxSelections === 1
                      ? group.minSelections >= 1
                        ? 'Elige 1'
                        : 'Elige 1 (opcional)'
                      : `Elige ${group.minSelections}${group.maxSelections != null ? `–${group.maxSelections}` : '+'}`
                  return (
                    <div key={group.modifierId} className="aito-mod-group">
                      <div className="aito-mod-grouphead">
                        <strong>{group.name}</strong>
                        <small>{rule}</small>
                      </div>
                      {group.options.map((opt) => {
                        const qty = sel[opt.id] ?? 0
                        const selected = qty > 0
                        return (
                          <button
                            key={opt.id}
                            type="button"
                            className={`aito-opt ${selected ? 'is-selected' : ''}`}
                            onClick={() => toggleMod(group, opt.id)}
                          >
                            <span className="aito-opt-check">{selected ? '✅' : '⚪'}</span>
                            <span className="aito-opt-name">{opt.name}{qty > 1 ? ` ×${qty}` : ''}</span>
                            {opt.price > 0 ? (
                              <MoneyWithBcv usd={opt.price} className="aito-opt-price" compact />
                            ) : (
                              <span className="aito-opt-incl">Incluido</span>
                            )}
                            <span className="aito-opt-add">{selected ? 'Quitar' : 'Elegir'}</span>
                          </button>
                        )
                      })}
                    </div>
                  )
                })}
              {modError && <p className="aito-error">{modError}</p>}
            </div>
            {!modLoading && modGroups.length > 0 && (
              <footer className="aito-footer">
                <div className="aito-total">
                  <span className="aito-total-label">Precio</span>
                  <MoneyWithBcv usd={modProduct.price + modExtra} align="start" className="aito-total-money" />
                </div>
                <button type="button" className="aito-cta" onClick={confirmMod}>Añadir al pedido</button>
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
              {loading && <p className="aito-muted" role="status">Cargando productos…</p>}
              {loadError && <p className="aito-error">{loadError}</p>}
              {!loading &&
                !loadError &&
                filtered.map((p) => (
                  <button key={p.id} type="button" className="aito-product" onClick={() => pickProduct(p)}>
                    <span className="aito-product-emoji">
                      {p.imageUrl ? <img src={p.imageUrl} alt="" /> : p.emoji || '🍽️'}
                    </span>
                    <span className="aito-product-info">
                      <span className="aito-product-name">{p.name}</span>
                      <span className="aito-product-cat">{p.category}</span>
                    </span>
                    <MoneyWithBcv usd={p.price} className="aito-product-price" align="end" compact />
                    <span className="aito-product-add">{withMods.has(p.id) ? 'Opciones' : 'Agregar'}</span>
                  </button>
                ))}
              {!loading && !loadError && filtered.length === 0 && <p className="aito-muted">Sin resultados.</p>}
            </div>

            {pending.length > 0 && (
              <div className="aito-pending">
                <div className="aito-pending-title">Por agregar ({pending.length})</div>
                {pending.map((i) => (
                  <div key={i.lineId} className="aito-pending-row">
                    <div className="aito-pending-info">
                      <span className="aito-pending-name">{i.productName}</span>
                      {i.selectedModifiers && i.selectedModifiers.length > 0 && (
                        <span className="aito-pending-mods">{i.selectedModifiers.map((m) => m.optionName).join(', ')}</span>
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
