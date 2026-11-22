import { useState, useEffect, useRef, type RefObject, type Dispatch, type SetStateAction } from 'react'
import { Product, ProductModifierGroup } from '../../lib/dataService'
import { formatProductTitle, formatSpanishText } from '../../lib/textFormat'
import { WebOrderCartItem, getPublicProductModifiers } from '../../lib/publicOrders'
import { optimizedProductImage, cartLineKey, filterProteinExtraGroups, isProteinCatalogExtra, money } from '../../lib/publicMenuFormat'
import { getPublicCartLimitViolation, isIncludedProteinGroup, getDefaultModifierSelection, PublicModifierSelection, calculateModifierTotal, hasInvalidModifierSelection, getModifierSelectionError, PUBLIC_ORDER_MAX_UNITS_PER_PRESENTATION, PUBLIC_ORDER_MAX_DISTINCT_LINES } from '../../lib/publicOrderRules'
import { MenuProductGroup } from '../../lib/menuGrouping'
import { PUBLIC_MODIFIER_CACHE, DESKTOP_MEDIA_QUERY } from '../../lib/publicMenuConfig'
import { type CheckoutStep } from '../../lib/publicMenuTypes'

interface UseProductDetailArgs {
  blockClosedStoreAdd: () => boolean
  cart: WebOrderCartItem[]
  cartRef: RefObject<WebOrderCartItem[]>
  closingDetail: boolean
  closingQuickVariant: boolean
  commitCart: (update: WebOrderCartItem[] | ((current: WebOrderCartItem[]) => WebOrderCartItem[])) => void
  detailModifierGroups: ProductModifierGroup[]
  detailNotes: string
  detailNotesRef: RefObject<HTMLTextAreaElement | null>
  detailQuantity: number
  editingCartLineKey: string | null
  extrasProducts: Product[]
  groups: MenuProductGroup[]
  loadingModifiers: boolean
  modifierLoadError: boolean
  modifierRequestRef: RefObject<number>
  products: Product[]
  quickVariantGroup: MenuProductGroup | null
  quickVariantId: string | null
  quickVariantProteinDraft: Record<string, number>
  quickVariantProteinGroup: ProductModifierGroup | null
  quickVariantQuantity: number
  requiredModifierRef: RefObject<HTMLDivElement | null>
  returnToConfirmAfterEdit: boolean
  selectedCatalogExtras: Record<string, number>
  selectedExtras: Record<string, number>
  selectedGroup: MenuProductGroup | null
  selectedVariantId: string | null
  setAddFeedback: Dispatch<SetStateAction<{ name: string; imageUrl?: string | undefined; productId: string; status: "checking" | "added"; } | null>>
  setAddFeedbackClosing: Dispatch<SetStateAction<boolean>>
  setAddingSelectedProduct: Dispatch<SetStateAction<boolean>>
  setCardQtys: Dispatch<SetStateAction<Record<string, number>>>
  setCartOpen: Dispatch<SetStateAction<boolean>>
  setCartPulse: Dispatch<SetStateAction<boolean>>
  setClosingCart: Dispatch<SetStateAction<boolean>>
  setClosingDetail: Dispatch<SetStateAction<boolean>>
  setClosingQuickVariant: Dispatch<SetStateAction<boolean>>
  setConfirmingQuickVariant: Dispatch<SetStateAction<boolean>>
  setDetailModifierGroups: Dispatch<SetStateAction<ProductModifierGroup[]>>
  setDetailNotes: Dispatch<SetStateAction<string>>
  setDetailOrigin: Dispatch<SetStateAction<{ x: number; y: number; } | null>>
  setDetailQuantity: Dispatch<SetStateAction<number>>
  setEditingCartLineKey: Dispatch<SetStateAction<string | null>>
  setError: Dispatch<SetStateAction<string>>
  setLoadingModifiers: Dispatch<SetStateAction<boolean>>
  setModifierLoadError: Dispatch<SetStateAction<boolean>>
  setModifierValidationError: Dispatch<SetStateAction<string>>
  setPendingQuickAdds: Dispatch<SetStateAction<Set<string>>>
  setQuickProteinDialogOpen: Dispatch<SetStateAction<boolean>>
  setQuickVariantGroup: Dispatch<SetStateAction<MenuProductGroup | null>>
  setQuickVariantHasModifiers: Dispatch<SetStateAction<boolean>>
  setQuickVariantId: Dispatch<SetStateAction<string | null>>
  setQuickVariantOptionsLabel: Dispatch<SetStateAction<string>>
  setQuickVariantProteinDraft: Dispatch<SetStateAction<Record<string, number>>>
  setQuickVariantProteinGroup: Dispatch<SetStateAction<ProductModifierGroup | null>>
  setQuickVariantQuantity: Dispatch<SetStateAction<number>>
  setReturnToConfirmAfterEdit: Dispatch<SetStateAction<boolean>>
  setSelectedCatalogExtras: Dispatch<SetStateAction<Record<string, number>>>
  setSelectedExtras: Dispatch<SetStateAction<Record<string, number>>>
  setSelectedGroup: Dispatch<SetStateAction<MenuProductGroup | null>>
  setSelectedVariantId: Dispatch<SetStateAction<string | null>>
  setShowModifierGuidance: Dispatch<SetStateAction<boolean>>
  setStep: Dispatch<SetStateAction<CheckoutStep>>
  step: CheckoutStep
}

export function useProductDetail({ blockClosedStoreAdd, cart, cartRef, closingDetail, closingQuickVariant, commitCart, detailModifierGroups, detailNotes, detailNotesRef, detailQuantity, editingCartLineKey, extrasProducts, groups, loadingModifiers, modifierLoadError, modifierRequestRef, products, quickVariantGroup, quickVariantId, quickVariantProteinDraft, quickVariantProteinGroup, quickVariantQuantity, requiredModifierRef, returnToConfirmAfterEdit, selectedCatalogExtras, selectedExtras, selectedGroup, selectedVariantId, setAddFeedback, setAddFeedbackClosing, setAddingSelectedProduct, setCardQtys, setCartOpen, setCartPulse, setClosingCart, setClosingDetail, setClosingQuickVariant, setConfirmingQuickVariant, setDetailModifierGroups, setDetailNotes, setDetailOrigin, setDetailQuantity, setEditingCartLineKey, setError, setLoadingModifiers, setModifierLoadError, setModifierValidationError, setPendingQuickAdds, setQuickProteinDialogOpen, setQuickVariantGroup, setQuickVariantHasModifiers, setQuickVariantId, setQuickVariantOptionsLabel, setQuickVariantProteinDraft, setQuickVariantProteinGroup, setQuickVariantQuantity, setReturnToConfirmAfterEdit, setSelectedCatalogExtras, setSelectedExtras, setSelectedGroup, setSelectedVariantId, setShowModifierGuidance, setStep, step }: UseProductDetailArgs) {
  const [quickVariantProteinSelection, setQuickVariantProteinSelection] = useState<Record<string, number>>({})
  useEffect(() => {
    const textarea = detailNotesRef.current
    if (!textarea) return
    textarea.style.height = 'auto'
    textarea.style.height = `${Math.max(textarea.scrollHeight, 58)}px`
  }, [detailNotes, selectedGroup, detailNotesRef])
  const addFeedbackTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const addFeedbackExitTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pendingQuickAddsRef = useRef(new Set<string>())
  const addingSelectedProductRef = useRef(false)
  const quickVariantConfirmRef = useRef(false)
  const cartPulseTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const showAddedFeedback = (product: Product, imageUrl?: string) => {
    setAddFeedback({ productId: product.id, name: formatProductTitle(product.name), imageUrl, status: 'added' })
    setAddFeedbackClosing(false)
    if (addFeedbackTimer.current) window.clearTimeout(addFeedbackTimer.current)
    if (addFeedbackExitTimer.current) window.clearTimeout(addFeedbackExitTimer.current)
    addFeedbackTimer.current = setTimeout(() => {
      setAddFeedbackClosing(true)
      addFeedbackExitTimer.current = setTimeout(() => setAddFeedback(null), 320)
    }, 2800)
  }

  const addProduct = (product: Product, quantity = 1, notes = '', extrasPrice = 0, modifiers: WebOrderCartItem['modifiers'] = [], closeDetailAfterAdd = true) => {
    if (blockClosedStoreAdd()) return false
    const imageUrl = optimizedProductImage(product.imageUrl) || undefined
    const linePrice = product.price + extrasPrice
    const prospectiveLine = { productId: product.id, notes, modifiers }
    const prospectiveKey = cartLineKey(prospectiveLine)
    const currentCart = cartRef.current
    const existingLine = currentCart.find(item => cartLineKey(item) === prospectiveKey)
    const candidateCart = existingLine
      ? currentCart.map(item => cartLineKey(item) === prospectiveKey ? { ...item, quantity: item.quantity + quantity } : item)
      : [...currentCart, { productId: product.id, productName: formatProductTitle(product.name), price: linePrice, quantity, imageUrl, notes: notes || undefined, modifiers }]
    const cartLimitViolation = getPublicCartLimitViolation(candidateCart)
    if (cartLimitViolation) {
      setError(cartLimitViolation === 'presentation-quantity'
        ? 'Puedes pedir hasta 30 unidades de una misma presentación. Reduce la cantidad para continuar; tu pedido se conserva.'
        : 'Tu pedido ya tiene 40 productos distintos. Quita un producto para hacer espacio; lo que ya agregaste se conserva.')
      return false
    }
    showAddedFeedback(product, imageUrl)
    setCartPulse(true)
    if (cartPulseTimer.current) window.clearTimeout(cartPulseTimer.current)
    cartPulseTimer.current = setTimeout(() => setCartPulse(false), 520)
    commitCart(current => {
      const key = prospectiveKey
      const existing = current.find(item => cartLineKey(item) === key)
      return existing
        ? current.map(item => cartLineKey(item) === key ? { ...item, quantity: item.quantity + quantity } : item)
        : [...current, { productId: product.id, productName: formatProductTitle(product.name), price: linePrice, quantity, imageUrl, notes: notes || undefined, modifiers }]
    })
    if (closeDetailAfterAdd) closeProductDetail()
    return true
  }

  const closeQuickVariant = () => {
    if (!quickVariantGroup || closingQuickVariant) return
    setClosingQuickVariant(true)
    window.setTimeout(() => {
      setQuickVariantGroup(null)
      setQuickVariantId(null)
      setQuickVariantQuantity(1)
      setQuickVariantProteinGroup(null)
      setQuickVariantProteinSelection({})
      setQuickVariantProteinDraft({})
      setQuickProteinDialogOpen(false)
      setClosingQuickVariant(false)
    }, 200)
  }

  const openQuickProteinDialog = () => {
    if (!quickVariantProteinGroup) return
    setQuickVariantProteinDraft(quickVariantProteinSelection)
    setQuickProteinDialogOpen(true)
  }

  const toggleQuickProteinDraft = (optionId: string) => {
    setQuickVariantProteinDraft(current => ({ ...current, [optionId]: current[optionId] ? 0 : 1 }))
  }

  const applyQuickProteinDraft = () => {
    setQuickVariantProteinSelection(quickVariantProteinDraft)
    setQuickProteinDialogOpen(false)
  }

  const requestQuickAdd = async (group: MenuProductGroup, quantity = 1) => {
    if (blockClosedStoreAdd()) return
    if (group.variants.length <= 1) {
      const product = group.variants[0]?.product
      if (product) {
        if (pendingQuickAddsRef.current.has(group.key)) return
        pendingQuickAddsRef.current.add(group.key)
        setPendingQuickAdds(current => new Set(current).add(group.key))
        if (addFeedbackTimer.current) window.clearTimeout(addFeedbackTimer.current)
        if (addFeedbackExitTimer.current) window.clearTimeout(addFeedbackExitTimer.current)
        setAddFeedbackClosing(false)
        setAddFeedback({ productId: product.id, name: formatProductTitle(product.name), imageUrl: optimizedProductImage(product.imageUrl) || undefined, status: 'checking' })
        try {
          let modifierGroups = PUBLIC_MODIFIER_CACHE.get(product.id)
          if (!modifierGroups) {
            try {
              modifierGroups = await getPublicProductModifiers(product.id)
              PUBLIC_MODIFIER_CACHE.set(product.id, modifierGroups)
            } catch {
              setAddFeedback(current => current?.productId === product.id && current.status === 'checking' ? null : current)
              openGroup(group, undefined, product.id)
              return
            }
          }
          if (modifierGroups.some(modifier => modifier.minSelections > 0 || isIncludedProteinGroup(modifier))) {
            setAddFeedback(current => current?.productId === product.id && current.status === 'checking' ? null : current)
            openGroup(group, undefined, product.id)
            return
          }
          if (addProduct(product, quantity)) setCardQtys(prev => ({ ...prev, [group.key]: 1 }))
          else setAddFeedback(current => current?.productId === product.id && current.status === 'checking' ? null : current)
        } finally {
          pendingQuickAddsRef.current.delete(group.key)
          setPendingQuickAdds(current => {
            const next = new Set(current)
            next.delete(group.key)
            return next
          })
        }
      }
      return
    }

    setQuickVariantGroup(group)
    setQuickVariantId(null)
    setQuickVariantQuantity(Math.max(1, quantity))
    setClosingQuickVariant(false)
  }

  const confirmQuickVariant = async () => {
    if (blockClosedStoreAdd()) return
    const variant = quickVariantGroup?.variants.find(({ product }) => product.id === quickVariantId)
    if (!variant || !quickVariantGroup || quickVariantConfirmRef.current) return
    quickVariantConfirmRef.current = true
    setConfirmingQuickVariant(true)
    try {
      let modifierGroups = PUBLIC_MODIFIER_CACHE.get(variant.product.id)
      if (!modifierGroups) {
        modifierGroups = await getPublicProductModifiers(variant.product.id)
        PUBLIC_MODIFIER_CACHE.set(variant.product.id, modifierGroups)
      }
      if (modifierGroups.some(group => group.minSelections > 0 && !isIncludedProteinGroup(group))) {
        personalizeQuickVariant()
        return
      }
      const includedProteinGroup = modifierGroups.find(isIncludedProteinGroup)
      const selectedProteinGroup = includedProteinGroup && quickVariantProteinGroup?.modifierId === includedProteinGroup.modifierId
        ? quickVariantProteinGroup
        : includedProteinGroup
      const proteinSelection = selectedProteinGroup && quickVariantProteinGroup?.modifierId === selectedProteinGroup.modifierId
        ? quickVariantProteinSelection
        : selectedProteinGroup ? getDefaultModifierSelection([selectedProteinGroup]) : {}
      const proteinModifiers: WebOrderCartItem['modifiers'] = selectedProteinGroup
        ? selectedProteinGroup.options.flatMap(option => proteinSelection[option.id] > 0
          ? [{ optionId: option.id, quantity: proteinSelection[option.id] }]
          : [])
        : []
      const removedProteins = selectedProteinGroup?.options
        .filter(option => !(proteinSelection[option.id] ?? 0))
        .map(option => formatSpanishText(option.name)) ?? []
      const proteinNotes = removedProteins.length ? `Sin: ${removedProteins.join(', ')}` : ''
      if (addProduct(variant.product, quickVariantQuantity, proteinNotes, 0, proteinModifiers)) {
        setCardQtys(prev => ({ ...prev, [quickVariantGroup.key]: 1 }))
        closeQuickVariant()
      }
    } catch {
        setError('No pudimos verificar las opciones obligatorias. Inténtalo de nuevo.')
    } finally {
      quickVariantConfirmRef.current = false
      setConfirmingQuickVariant(false)
    }
  }

  const personalizeQuickVariant = () => {
    const group = quickVariantGroup
    const variant = group?.variants.find(({ product }) => product.id === quickVariantId)
    if (!group || !variant || closingQuickVariant) return
    const quantity = quickVariantQuantity
    setClosingQuickVariant(true)
    window.setTimeout(() => {
      setQuickVariantGroup(null)
      setQuickVariantId(null)
      setQuickVariantQuantity(1)
      setClosingQuickVariant(false)
      openGroup(group, undefined, variant.product.id, quickVariantProteinGroup ? quickVariantProteinSelection : undefined)
      setDetailQuantity(quantity)
    }, 200)
  }

  const closeProductDetail = () => {
    if (!selectedGroup || closingDetail) return
    modifierRequestRef.current += 1
    setClosingDetail(true)
    window.setTimeout(() => {
      setSelectedGroup(null)
      setClosingDetail(false)
      setSelectedVariantId(null)
      setEditingCartLineKey(null)
      setDetailQuantity(1)
      setDetailNotes('')
      setDetailModifierGroups([])
      setSelectedExtras({})
      setSelectedCatalogExtras({})
      setModifierLoadError(false)
      setModifierValidationError('')
    }, 220)
  }

  const openGroup = (group: MenuProductGroup, originEvent?: { clientX: number; clientY: number }, initialVariantId?: string, initialModifiers?: PublicModifierSelection) => {
    const requestId = modifierRequestRef.current + 1
    modifierRequestRef.current = requestId
    const initialVariant = group.variants.find(({ product }) => product.id === initialVariantId) ?? group.variants[0]
    setDetailOrigin(originEvent ? { x: originEvent.clientX, y: originEvent.clientY } : null)
    setClosingDetail(false)
    setSelectedGroup(group)
    setSelectedVariantId(initialVariant?.product.id ?? null)
    setDetailQuantity(1)
    setDetailNotes('')
    setSelectedExtras(initialModifiers ?? {})
    setSelectedCatalogExtras({})
    setModifierLoadError(false)
    setModifierValidationError('')
    setShowModifierGuidance(true)
    const productId = initialVariant?.product.id
    const prepareModifierGroups = (remoteGroups: ProductModifierGroup[]) => {
      const resolved = filterProteinExtraGroups(remoteGroups, initialVariant?.product.allowProteinExtras !== false)
        .filter(item => item.options.length > 0 || item.minSelections > 0)
        .map(item => ({ ...item, options: [...item.options] }))
      // Los extras del catálogo son productos independientes, no modificadores.
      // No deben sumarse al producto como si fueran opciones sin una línea propia.
      return resolved
    }
    const applyModifierGroups = (remoteGroups: ProductModifierGroup[]) => {
      const prepared = prepareModifierGroups(remoteGroups)
      setDetailModifierGroups(prepared)
      const validOptionIds = new Set(prepared.flatMap(item => item.options.map(option => option.id)))
      const initialSelection = initialModifiers
        ? Object.fromEntries(Object.entries(initialModifiers).filter(([optionId]) => validOptionIds.has(optionId)))
        : getDefaultModifierSelection(prepared)
      setSelectedExtras(initialSelection)
    }

    if (!productId) {
      applyModifierGroups([])
      setLoadingModifiers(false)
      return
    }

    const cachedGroups = PUBLIC_MODIFIER_CACHE.get(productId)
    if (cachedGroups) {
      applyModifierGroups(cachedGroups)
      setLoadingModifiers(false)
      return
    }

    // Los extras del catálogo ya están disponibles: se muestran de inmediato
    // mientras cualquier modificador específico del producto carga en segundo plano.
    setDetailModifierGroups(prepareModifierGroups([]))
    setLoadingModifiers(true)
    getPublicProductModifiers(productId)
      .then(remoteGroups => {
        PUBLIC_MODIFIER_CACHE.set(productId, remoteGroups)
        if (modifierRequestRef.current !== requestId) return
        applyModifierGroups(remoteGroups)
      })
      .catch(() => {
        if (modifierRequestRef.current === requestId) {
          setDetailModifierGroups([])
          setModifierLoadError(true)
        }
      })
      .finally(() => {
        if (modifierRequestRef.current === requestId) setLoadingModifiers(false)
      })
  }

  const selectedProduct = selectedGroup?.variants.find(({ product }) => product.id === selectedVariantId)?.product
    ?? selectedGroup?.variants[0]?.product
  const quickSelectedVariant = quickVariantGroup?.variants.find(({ product }) => product.id === quickVariantId)
  useEffect(() => {
    let cancelled = false
    setQuickVariantHasModifiers(false)
    setQuickVariantOptionsLabel('Ver opciones')
    setQuickVariantProteinGroup(null)
    setQuickVariantProteinSelection({})
    setQuickVariantProteinDraft({})
    setQuickProteinDialogOpen(false)
    if (!quickSelectedVariant) return () => { cancelled = true }
    const productId = quickSelectedVariant.product.id
    const applyModifierSummary = (groups: ProductModifierGroup[]) => {
      const availableGroups = filterProteinExtraGroups(groups, quickSelectedVariant.product.allowProteinExtras !== false)
      const includedProteinGroup = availableGroups.find(group => group.options.length > 0 && isIncludedProteinGroup(group)) ?? null
      const hasOptions = availableGroups.some(group => group.options.length > 0)
      const defaultProteinSelection = includedProteinGroup ? getDefaultModifierSelection([includedProteinGroup]) : {}
      setQuickVariantProteinGroup(includedProteinGroup)
      setQuickVariantProteinSelection(defaultProteinSelection)
      setQuickVariantProteinDraft(defaultProteinSelection)
      setQuickVariantHasModifiers(hasOptions)
      setQuickVariantOptionsLabel(includedProteinGroup ? 'Quitar alguna proteína' : 'Ver opciones')
    }
    const cached = PUBLIC_MODIFIER_CACHE.get(productId)
    if (cached) {
      applyModifierSummary(cached)
      return () => { cancelled = true }
    }
    getPublicProductModifiers(productId).then(groups => {
      PUBLIC_MODIFIER_CACHE.set(productId, groups)
      if (!cancelled) applyModifierSummary(groups)
    }).catch(() => {
      if (!cancelled) {
        setQuickVariantHasModifiers(false)
        setQuickVariantOptionsLabel('Ver opciones')
        setQuickVariantProteinGroup(null)
        setQuickVariantProteinSelection({})
        setQuickVariantProteinDraft({})
      }
    })
    return () => { cancelled = true }
  }, [quickSelectedVariant, setQuickProteinDialogOpen, setQuickVariantHasModifiers, setQuickVariantOptionsLabel, setQuickVariantProteinDraft, setQuickVariantProteinGroup])
  const detailExtrasTotal = calculateModifierTotal(detailModifierGroups, selectedExtras)
  const catalogExtraProducts = selectedProduct?.categories.includes('bebidas')
    ? []
    : extrasProducts.filter(product => !product.categories.includes('bebidas')
      && (selectedProduct?.allowProteinExtras !== false || !isProteinCatalogExtra(product)))
  const complementaryProducts = selectedProduct
    ? products.filter(product => product.id !== selectedProduct.id && (
      selectedProduct.categories.includes('bebidas')
        ? !product.categories.includes('bebidas')
        : product.categories.includes('bebidas')
    )).slice(0, 6)
    : []
  const catalogAddOnProducts = [...catalogExtraProducts, ...complementaryProducts]
  const selectedCatalogExtrasTotal = catalogAddOnProducts.reduce((sum, product) => sum + product.price * (selectedCatalogExtras[product.id] ?? 0), 0)
  const invalidModifierSelection = hasInvalidModifierSelection(detailModifierGroups, selectedExtras)
  const modifierSelectionError = getModifierSelectionError(detailModifierGroups, selectedExtras)
  const toggleProteinExclusion = (optionId: string) => {
    setSelectedExtras(current => {
      const next = { ...current }
      if (next[optionId]) delete next[optionId]
      else next[optionId] = 1
      return next
    })
  }

  const addSelectedProduct = () => {
    if (addingSelectedProductRef.current) return
    if (!editingCartLineKey && blockClosedStoreAdd()) return
    if (selectedProduct) {
      if (loadingModifiers) return
      if (modifierLoadError) {
        setModifierValidationError('No pudimos cargar las opciones. Cierra y vuelve a abrir el producto para intentarlo de nuevo.')
        return
      }
      if (modifierSelectionError) {
        setModifierValidationError(modifierSelectionError.options.length
          ? `Falta una opción obligatoria en “${formatSpanishText(modifierSelectionError.name)}”. Elígela arriba para agregar este plato.`
          : `“${formatSpanishText(modifierSelectionError.name)}” no tiene opciones disponibles. Elige otro producto o contacta al local.`)
        requiredModifierRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
        requiredModifierRef.current?.querySelector<HTMLButtonElement>('.ppdm-chip:not(:disabled)')?.focus({ preventScroll: true })
        return
      }
      if (invalidModifierSelection) {
        setModifierValidationError('Algunas opciones guardadas ya no están disponibles. Límpialas o vuelve al carrito y agrega este producto nuevamente.')
        return
      }
      const isAddingNewProduct = !editingCartLineKey
      if (isAddingNewProduct) {
        addingSelectedProductRef.current = true
        setAddingSelectedProduct(true)
      }
      const chosen = detailModifierGroups.flatMap(group => group.options.filter(option => (selectedExtras[option.id] ?? 0) > 0).map(option => ({ option, quantity: selectedExtras[option.id] })))
      const extrasPrice = chosen.reduce((sum, item) => sum + item.option.price * item.quantity, 0)
      const extras = detailModifierGroups.filter(group => !isIncludedProteinGroup(group))
        .flatMap(group => group.options.filter(option => (selectedExtras[option.id] ?? 0) > 0)
          .map(option => `${formatSpanishText(option.name)}${(selectedExtras[option.id] ?? 0) > 1 ? ` ×${selectedExtras[option.id]}` : ''}${option.price > 0 ? ` (+${money(option.price * (selectedExtras[option.id] ?? 0))})` : ''}`))
      const removedProteins = detailModifierGroups.filter(isIncludedProteinGroup)
        .flatMap(group => group.options.filter(option => !(selectedExtras[option.id] ?? 0)).map(option => formatSpanishText(option.name)))
      const lineNotes = [removedProteins.length ? `Sin: ${removedProteins.join(', ')}` : '', extras.length ? `Extras: ${extras.join(', ')}` : '', detailNotes.trim()].filter(Boolean).join(' · ')
      const modifiers = chosen.map(({ option, quantity }) => ({ optionId: option.id, quantity: quantity ?? 1 }))
      if (!editingCartLineKey) {
        const mainKey = cartLineKey({ productId: selectedProduct.id, notes: lineNotes, modifiers })
        const currentCart = cartRef.current
        const mainExisting = currentCart.find(item => cartLineKey(item) === mainKey)
        const picked = catalogAddOnProducts.filter(product => (selectedCatalogExtras[product.id] ?? 0) > 0)
        const extraRows = picked.map(product => {
          const notes = `Acompañamiento de ${formatProductTitle(selectedProduct.name)}`
          const key = cartLineKey({ productId: product.id, notes, modifiers: [] })
          const samePresentationQuantity = currentCart
            .filter(item => item.productId === product.id)
            .reduce((sum, item) => sum + item.quantity, 0)
          return { key, quantity: detailQuantity * (selectedCatalogExtras[product.id] ?? 0), samePresentationQuantity, existing: currentCart.find(item => cartLineKey(item) === key) }
        })
        const mainPresentationQuantity = currentCart
          .filter(item => item.productId === selectedProduct.id)
          .reduce((sum, item) => sum + item.quantity, 0)
        if (mainPresentationQuantity + detailQuantity > PUBLIC_ORDER_MAX_UNITS_PER_PRESENTATION || extraRows.some(row => row.samePresentationQuantity + row.quantity > PUBLIC_ORDER_MAX_UNITS_PER_PRESENTATION)) {
          setModifierValidationError('Puedes pedir hasta 30 unidades por presentación. Reduce la cantidad o los extras para guardar; tu carrito no cambiará.')
          addingSelectedProductRef.current = false
          setAddingSelectedProduct(false)
          return
        }
        const newRows = Number(!mainExisting) + extraRows.filter(row => !row.existing).length
        if (currentCart.length + newRows > PUBLIC_ORDER_MAX_DISTINCT_LINES) {
          setModifierValidationError('Tu pedido ya tiene 40 productos distintos. Quita uno desde el carrito para hacer espacio; no perderás lo agregado.')
          addingSelectedProductRef.current = false
          setAddingSelectedProduct(false)
          return
        }
      }
      if (editingCartLineKey) {
        const imageUrl = optimizedProductImage(selectedProduct.imageUrl) || undefined
        const editedLine = { productId: selectedProduct.id, productName: formatProductTitle(selectedProduct.name), price: selectedProduct.price + extrasPrice, quantity: detailQuantity, imageUrl, notes: lineNotes || undefined, modifiers }
        const pickedCatalogExtras = catalogAddOnProducts.filter(product => (selectedCatalogExtras[product.id] ?? 0) > 0)
        const currentCart = cartRef.current
        const originalLine = currentCart.find(item => cartLineKey(item) === editingCartLineKey)
        if (!originalLine) {
          setModifierValidationError('No encontramos ese producto en tu carrito. No se guardó ningún cambio.')
          return
        }
        const previousAccompanimentPrefix = `Acompañamiento de ${formatProductTitle(originalLine.productName)}`
        const accompanimentPrefix = `Acompañamiento de ${formatProductTitle(selectedProduct.name)}`
        const nextCart = [
          ...currentCart.filter(item => cartLineKey(item) !== editingCartLineKey && item.notes !== previousAccompanimentPrefix),
          editedLine,
        ]
        for (const product of pickedCatalogExtras) {
          const notes = accompanimentPrefix
          const quantity = detailQuantity * (selectedCatalogExtras[product.id] ?? 0)
          const key = cartLineKey({ productId: product.id, notes, modifiers: [] })
          const existingIndex = nextCart.findIndex(item => cartLineKey(item) === key)
          if (existingIndex >= 0) {
            nextCart[existingIndex] = { ...nextCart[existingIndex], quantity: nextCart[existingIndex].quantity + quantity }
          } else {
            nextCart.push({ productId: product.id, productName: formatProductTitle(product.name), price: product.price, quantity, imageUrl: optimizedProductImage(product.imageUrl) || undefined, notes, modifiers: [] })
          }
        }
        const cartLimitViolation = getPublicCartLimitViolation(nextCart)
        if (cartLimitViolation) {
          setModifierValidationError(cartLimitViolation === 'presentation-quantity'
            ? 'Puedes pedir hasta 30 unidades por presentación. Reduce la cantidad o los extras para guardar; tu carrito no cambiará.'
            : 'Tu pedido permite hasta 40 productos distintos. Quita uno desde el carrito antes de guardar; tus productos actuales se conservarán.')
          return
        }
        commitCart(nextCart)
        setEditingCartLineKey(null)
        closeProductDetail()
        const returnToReviewAfterEdit = returnToConfirmAfterEdit
        setReturnToConfirmAfterEdit(false)
        // Deja que termine la salida del editor antes de volver a montar el
        // contenido del carrito/recibo. Si se cambia el paso durante esos 220ms,
        // ambas vistas y sus animaciones se pisan en escritorio.
        window.setTimeout(() => {
          setClosingCart(false)
          setStep(returnToReviewAfterEdit ? 'confirm' : 'cart')
          const isDesktop = typeof window.matchMedia === 'function' && window.matchMedia(DESKTOP_MEDIA_QUERY).matches
          // En escritorio el carrito normal ya vive en la página; abrir encima
          // otro drawer duplica visualmente filas y recomendaciones al regresar.
          setCartOpen(!isDesktop || returnToReviewAfterEdit)
        }, 240)
      } else {
        const added = addProduct(selectedProduct, detailQuantity, lineNotes, extrasPrice, modifiers, false)
        if (!added) {
          addingSelectedProductRef.current = false
          setAddingSelectedProduct(false)
          return
        }
        const pickedCatalogExtras = catalogAddOnProducts.filter(product => (selectedCatalogExtras[product.id] ?? 0) > 0)
        if (pickedCatalogExtras.length) {
          commitCart(current => {
            let next = [...current]
            for (const product of pickedCatalogExtras) {
              const notes = `Acompañamiento de ${formatProductTitle(selectedProduct.name)}`
              const quantity = detailQuantity * (selectedCatalogExtras[product.id] ?? 0)
              const key = cartLineKey({ productId: product.id, notes, modifiers: [] })
              const existing = next.find(item => cartLineKey(item) === key)
              if (existing) next = next.map(item => cartLineKey(item) === key ? { ...item, quantity: item.quantity + quantity } : item)
              else next.push({ productId: product.id, productName: formatProductTitle(product.name), price: product.price, quantity, imageUrl: optimizedProductImage(product.imageUrl) || undefined, notes, modifiers: [] })
            }
            return next
          })
        }
        // Agregar cierra el detalle: el aviso "Agregado al carrito" queda a la
        // vista y el carrito (tarjeta lateral o botón flotante) muestra lo nuevo.
        closeProductDetail()
        window.setTimeout(() => {
          addingSelectedProductRef.current = false
          setAddingSelectedProduct(false)
        }, 450)
      }
    }
  }

  const editCartItem = (item: WebOrderCartItem) => {
    const group = groups.find(candidate => candidate.variants.some(variant => variant.product.id === item.productId))
    if (!group) return
    const isDesktop = typeof window.matchMedia === 'function' && window.matchMedia(DESKTOP_MEDIA_QUERY).matches
    setEditingCartLineKey(cartLineKey(item))
    setReturnToConfirmAfterEdit(step === 'confirm')
    setCartOpen(!isDesktop)
    setStep('cart')
    const savedModifiers = item.modifiers
      ? Object.fromEntries(item.modifiers.map(modifier => [modifier.optionId, modifier.quantity]))
      : undefined
    openGroup(group, undefined, item.productId, savedModifiers)
    setDetailQuantity(item.quantity)
    const accompanimentNote = `Acompañamiento de ${formatProductTitle(item.productName)}`
    const savedCatalogExtras = Object.fromEntries(
      extrasProducts.concat(products)
        .filter(product => product.categories.includes('extras') || product.categories.includes('bebidas'))
        .flatMap(product => {
          const companion = cart.find(candidate => candidate.productId === product.id && candidate.notes === accompanimentNote)
          return companion ? [[product.id, Math.max(1, Math.floor(companion.quantity / item.quantity))] as const] : []
        }),
    )
    setSelectedCatalogExtras(savedCatalogExtras)
    const savedNotes = item.notes || ''
    const userNotes = savedNotes.replace(/^Sin: [^·]+(?: · |$)/, '').replace(/^Extras: .*?(?: · |$)/, '')
    setDetailNotes(userNotes)
  }
  return { requestQuickAdd, openGroup, editCartItem, closeQuickVariant, confirmQuickVariant, openQuickProteinDialog, personalizeQuickVariant, quickSelectedVariant, applyQuickProteinDraft, toggleQuickProteinDraft, selectedProduct, addSelectedProduct, catalogExtraProducts, closeProductDetail, complementaryProducts, detailExtrasTotal, invalidModifierSelection, modifierSelectionError, selectedCatalogExtrasTotal, toggleProteinExclusion }
}
