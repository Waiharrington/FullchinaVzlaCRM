import { confirmDialog } from '../../components/ConfirmDialog'
import { useRef, useEffect, useState, useCallback, type RefObject, type Dispatch, type SetStateAction } from 'react'
import { revealCheckoutField } from '../../lib/publicCheckoutDom'
import { readCheckoutAttempt } from '../../lib/publicMenuStorage'
import { WebOrderCartItem, CustomerRepeatOrder, getPublicCatalog, getPublicProductModifiers, createWebOrder, describeWebOrderError } from '../../lib/publicOrders'
import { saveToStorage, withoutEmbeddedImages } from '../../lib/publicCartStorage'
import { LAST_ORDER_KEY, FLOW_STATE_KEY, WHATSAPP_SENT_KEY, isRecentSentState, CART_KEY, CHECKOUT_ATTEMPT_KEY, LOCAL_ORDER_TEST_MODE } from '../../lib/publicMenuConfig'
import { customerSupabase } from '../../lib/supabase'
import { getCustomerOrderProfile } from '../../lib/customerOrderProfile'
import { MapCoordinates, type DesktopTab, type CheckoutStep } from '../../lib/publicMenuTypes'
import { PublicCartLimitViolation, PUBLIC_ORDER_MAX_UNITS_PER_PRESENTATION, hasInvalidModifierSelection, getModifierSelectionError, calculateModifierTotal, PUBLIC_ORDER_MAX_DISTINCT_LINES, getPublicCartLimitViolation, isValidPublicIdentification, normalizeVenezuelanPhone, describePickupTime, appendRequiredOrderMetadata } from '../../lib/publicOrderRules'
import { filterProteinExtraGroups, optimizedProductImage, cartLineKey, PAY_OPTIONS, PayMethod } from '../../lib/publicMenuFormat'
import { formatProductTitle } from '../../lib/textFormat'
import { recordLocalOrderTestOrder } from '../../lib/localOrderTestMode'
import { type DeliveryEstimate, type DeliverySettings } from '../../lib/delivery'
import { type Product } from '../../lib/dataService'

interface UseCheckoutArgs {
  address: string
  addressActionRef: RefObject<number>
  addressMethod: "map" | "gps" | "search" | null
  addressRef: RefObject<HTMLInputElement | null>
  addressReference: string
  addressSelectedRef: RefObject<HTMLDivElement | null>
  bcvRate: number | null
  blockClosedStoreAdd: () => boolean
  cart: WebOrderCartItem[]
  cartOpen: boolean
  closeCart: () => void
  commitCart: (update: WebOrderCartItem[] | ((current: WebOrderCartItem[]) => WebOrderCartItem[])) => void
  customerDetailsTouched: RefObject<boolean>
  deliveryChosen: boolean
  deliveryCoverageUnavailable: boolean
  deliveryEstimate: DeliveryEstimate | null
  deliveryFee: number
  deliveryNotes: string
  deliveryQuoteStatus: "error" | "idle" | "loading" | "ready"
  deliverySettings: DeliverySettings | null
  deliverySettingsStatus: "error" | "idle" | "loading" | "ready"
  error: string
  geoCoords: { lat: number; lng: number; } | null
  identification: string
  identificationRef: RefObject<HTMLInputElement | null>
  name: string
  nameRef: RefObject<HTMLInputElement | null>
  notes: string
  orderType: "takeaway" | "delivery"
  payMode: "single" | "mixed"
  payPrimary: "cash" | "mobile" | "transfer" | "card" | "binance"
  paySecondary: "cash" | "mobile" | "transfer" | "card" | "binance"
  phone: string
  phoneRef: RefObject<HTMLInputElement | null>
  pickupTime: string
  publicWhatsappPhone: string
  referenceRef: RefObject<HTMLInputElement | null>
  returnToConfirmAfterEdit: boolean
  setAddress: Dispatch<SetStateAction<string>>
  setAddressFieldError: Dispatch<SetStateAction<"" | "address" | "geo" | "reference">>
  setAddressMethod: Dispatch<SetStateAction<"map" | "gps" | "search" | null>>
  setAddressReference: Dispatch<SetStateAction<string>>
  setAutofillingDetails: Dispatch<SetStateAction<boolean>>
  setCartOpen: Dispatch<SetStateAction<boolean>>
  setClosingCart: Dispatch<SetStateAction<boolean>>
  setCurrentTab: Dispatch<SetStateAction<DesktopTab>>
  setCustomerDetailsAutofilled: Dispatch<SetStateAction<boolean>>
  setDeliveryChosen: Dispatch<SetStateAction<boolean>>
  setDeliveryNotes: Dispatch<SetStateAction<string>>
  setError: Dispatch<SetStateAction<string>>
  setExtrasProducts: Dispatch<SetStateAction<Product[]>>
  setFieldError: Dispatch<SetStateAction<"" | "name" | "phone" | "identification">>
  setGeoCoords: Dispatch<SetStateAction<{ lat: number; lng: number; } | null>>
  setIdPrefix: Dispatch<SetStateAction<"V" | "E" | "J">>
  setIdentification: Dispatch<SetStateAction<string>>
  setLocalTestOrderLinkedToProfile: Dispatch<SetStateAction<boolean>>
  setLocating: Dispatch<SetStateAction<boolean>>
  setName: Dispatch<SetStateAction<string>>
  setNotes: Dispatch<SetStateAction<string>>
  setOrderCode: Dispatch<SetStateAction<string>>
  setOrderType: Dispatch<SetStateAction<"takeaway" | "delivery">>
  setPayMode: Dispatch<SetStateAction<"single" | "mixed">>
  setPayPrimary: Dispatch<SetStateAction<"cash" | "mobile" | "transfer" | "card" | "binance">>
  setPaySecondary: Dispatch<SetStateAction<"cash" | "mobile" | "transfer" | "card" | "binance">>
  setPhone: Dispatch<SetStateAction<string>>
  setPickupTime: Dispatch<SetStateAction<string>>
  setProducts: Dispatch<SetStateAction<Product[]>>
  setReturnToConfirmAfterEdit: Dispatch<SetStateAction<boolean>>
  setSentSummary: Dispatch<SetStateAction<{ items: WebOrderCartItem[]; total: number; orderType: "takeaway" | "delivery"; address: string; phone: string; } | null>>
  setServerDeliveryFeeOverride: Dispatch<SetStateAction<{ lat: number; lng: number; fee: number; } | null>>
  setStep: Dispatch<SetStateAction<CheckoutStep>>
  setSubmitting: Dispatch<SetStateAction<boolean>>
  step: CheckoutStep
  submitting: boolean
}

export function useCheckout({ address, addressActionRef, addressMethod, addressRef, addressReference, addressSelectedRef, bcvRate, blockClosedStoreAdd, cart, cartOpen, closeCart, commitCart, customerDetailsTouched, deliveryChosen, deliveryCoverageUnavailable, deliveryEstimate, deliveryFee, deliveryNotes, deliveryQuoteStatus, deliverySettings, deliverySettingsStatus, error, geoCoords, identification, identificationRef, name, nameRef, notes, orderType, payMode, payPrimary, paySecondary, phone, phoneRef, pickupTime, publicWhatsappPhone, referenceRef, returnToConfirmAfterEdit, setAddress, setAddressFieldError, setAddressMethod, setAddressReference, setAutofillingDetails, setCartOpen, setClosingCart, setCurrentTab, setCustomerDetailsAutofilled, setDeliveryChosen, setDeliveryNotes, setError, setExtrasProducts, setFieldError, setGeoCoords, setIdPrefix, setIdentification, setLocalTestOrderLinkedToProfile, setLocating, setName, setNotes, setOrderCode, setOrderType, setPayMode, setPayPrimary, setPaySecondary, setPhone, setPickupTime, setProducts, setReturnToConfirmAfterEdit, setSentSummary, setServerDeliveryFeeOverride, setStep, setSubmitting, step, submitting }: UseCheckoutArgs) {
  const previousStepRef = useRef(step)
  // Al aparecer un error de validación, subir la tarjeta al tope para que se vea
  // Las imágenes de checkout se cargan cuando el cliente llega a ese paso;
  // precargarlas aquí competía con el catálogo en conexiones móviles lentas.
  useEffect(() => {
    if (!error) return
    document.querySelector('.public-cart-drawer')?.scrollTo({ top: 0, behavior: 'smooth' })
  }, [error])
  // Al pulsar Continuar/Revisar/Confirmar con un dato faltante, llevar al
  // cliente a ese campo cada vez que lo intenta. Los avisos que aparecen al
  // salir de un campo (onBlur) no mueven la vista ni roban el cursor.
  const [revealRequest, setRevealRequest] = useState<{ field: 'name' | 'phone' | 'identification' | 'address' | 'geo' | 'reference'; id: number } | null>(null)
  const showFieldError = (field: 'name' | 'phone' | 'identification') => {
    setFieldError(field)
    setRevealRequest(current => ({ field, id: (current?.id ?? 0) + 1 }))
  }
  const showAddressFieldError = (field: 'address' | 'geo' | 'reference') => {
    setAddressFieldError(field)
    setRevealRequest(current => ({ field, id: (current?.id ?? 0) + 1 }))
  }
  useEffect(() => {
    if (!revealRequest) return
    const { field } = revealRequest
    const frame = window.requestAnimationFrame(() => {
      const target = field === 'name' ? nameRef.current
        : field === 'phone' ? phoneRef.current
          : field === 'identification' ? identificationRef.current
            : field === 'reference' ? referenceRef.current
              : field === 'address' ? addressRef.current
                : addressSelectedRef.current
      revealCheckoutField(target, field !== 'geo')
    })
    return () => window.cancelAnimationFrame(frame)
  }, [revealRequest, addressRef, addressSelectedRef, identificationRef, nameRef, phoneRef, referenceRef])
  const restoringFlow = useRef(true)
  const submitLockRef = useRef(false)
  const checkoutAttemptRef = useRef<{ signature: string; key: string } | null>(readCheckoutAttempt())
  const [, setLastOrder] = useState<WebOrderCartItem[]>(() => {
    try { return JSON.parse(localStorage.getItem(LAST_ORDER_KEY) || '[]') as WebOrderCartItem[] } catch { return [] }
  })
  const autofillCustomerOrderDetails = useCallback(async () => {
    if (customerDetailsTouched.current) return
    let showedSkeleton = false
    try {
      if (customerSupabase) {
        const { data: sessionData } = await customerSupabase.auth.getSession()
        if (sessionData.session && !customerDetailsTouched.current) {
          showedSkeleton = true
          setAutofillingDetails(true)
        }
      }
      const customer = await getCustomerOrderProfile()
      if (!customer || customerDetailsTouched.current) return
      if (customer.fullName || customer.phone || customer.identification) setCustomerDetailsAutofilled(true)
      setName(current => current || customer.fullName)
      setPhone(current => current || customer.phone)
      const prefix = customer.identification.trim().match(/^([VEJ])\s*-/i)?.[1]?.toUpperCase()
      if (prefix === 'V' || prefix === 'E' || prefix === 'J') setIdPrefix(prefix)
      setIdentification(current => current || customer.identification)
    } catch {
      // El pedido sigue disponible si el RPC de perfil aún no está actualizado o la red falla.
    } finally {
      if (showedSkeleton) setAutofillingDetails(false)
    }
  }, [customerDetailsTouched, setAutofillingDetails, setCustomerDetailsAutofilled, setIdPrefix, setIdentification, setName, setPhone])

  useEffect(() => {
    void autofillCustomerOrderDetails()
    if (!customerSupabase) return
    const { data } = customerSupabase.auth.onAuthStateChange((event, session) => {
      if (session && (event === 'SIGNED_IN' || event === 'INITIAL_SESSION' || event === 'TOKEN_REFRESHED')) {
        window.setTimeout(() => { void autofillCustomerOrderDetails() }, 0)
      }
    })
    return () => data.subscription.unsubscribe()
  }, [autofillCustomerOrderDetails])

  useEffect(() => {
    if (step === 'details') void autofillCustomerOrderDetails()
  }, [autofillCustomerOrderDetails, step])

  // Cuando Editar se pulsa desde el resumen, el flujo vuelve al carrito para
  // modificar el producto. Al continuar (o cerrar ese carrito) debe regresar
  // al resumen que originó la edición, no reiniciar checkout desde entrega.
  useEffect(() => {
    const previousStep = previousStepRef.current
    if (cart.length === 0 && step === 'confirm') {
      setReturnToConfirmAfterEdit(false)
      setStep('cart')
    } else if (cart.length > 0 && step === 'cart' && previousStep === 'confirm') {
      setReturnToConfirmAfterEdit(true)
    } else if (cart.length > 0 && returnToConfirmAfterEdit && step === 'delivery') {
      setReturnToConfirmAfterEdit(false)
      setStep('confirm')
    }
    previousStepRef.current = step
  }, [cart, cartOpen, returnToConfirmAfterEdit, step, setReturnToConfirmAfterEdit, setStep])

  useEffect(() => {
    if (!restoringFlow.current) return
    try {
      const saved = JSON.parse(localStorage.getItem(FLOW_STATE_KEY) || 'null') as Partial<{ cartOpen: boolean; step: string; name: string; phone: string; identification: string; orderType: 'takeaway' | 'delivery'; deliveryChosen: boolean; address: string; addressReference: string; notes: string; deliveryNotes: string; geoCoords: MapCoordinates; addressMethod: 'gps' | 'map' | 'search' }> | null
      const sent = JSON.parse(localStorage.getItem(WHATSAPP_SENT_KEY) || 'null') as { code?: string; sentAt?: number } | null
      if (saved && cart.length > 0) {
        if (saved.name || saved.phone || saved.identification) customerDetailsTouched.current = true
        setName(saved.name || '')
        setPhone(saved.phone || '')
        setIdentification(saved.identification || '')
        const savedPrefix = saved.identification?.match(/^[VEJ]/i)?.[0]?.toUpperCase()
        if (savedPrefix === 'V' || savedPrefix === 'E' || savedPrefix === 'J') setIdPrefix(savedPrefix)
        setOrderType(saved.orderType === 'delivery' ? 'delivery' : 'takeaway')
        setDeliveryChosen(Boolean(saved.deliveryChosen))
        setAddress(saved.address || '')
        setAddressReference(saved.addressReference || '')
        setNotes(saved.notes || '')
        setDeliveryNotes(saved.deliveryNotes || '')
        setGeoCoords(saved.geoCoords || null)
        setAddressMethod(saved.addressMethod || null)
        if (sent && isRecentSentState(sent)) {
          setOrderCode(sent.code || '')
          setCartOpen(true)
          setStep('sent')
        } else {
          // Persistimos los datos para no perder el pedido en progreso, pero no
          // reabrimos el drawer después de una recarga. El usuario debe decidir
          // cuándo volver a entrar al checkout.
          setCartOpen(false)
          setStep('cart')
        }
      }
    } catch { /* ignore malformed local flow state */ }
    restoringFlow.current = false
  }, [cart.length, customerDetailsTouched, setAddress, setAddressMethod, setAddressReference, setCartOpen, setDeliveryChosen, setDeliveryNotes, setGeoCoords, setIdPrefix, setIdentification, setName, setNotes, setOrderCode, setOrderType, setPhone, setStep])
  useEffect(() => {
    // Volver desde WhatsApp puede recuperar esta página desde el bfcache sin
    // montar de nuevo React. Sincronizamos el estado también en pageshow para
    // que el resultado sea el mismo con recarga o con el botón Atrás.
    const restoreSentState = () => {
      try {
        const sent = JSON.parse(localStorage.getItem(WHATSAPP_SENT_KEY) || 'null') as { code?: string; sentAt?: number } | null
        if (!isRecentSentState(sent) || !sent || cart.length === 0) return
        setOrderCode(sent.code || '')
        setCartOpen(true)
        setStep('sent')
      } catch { /* ignore malformed sent state */ }
    }
    window.addEventListener('pageshow', restoreSentState)
    return () => window.removeEventListener('pageshow', restoreSentState)
  }, [cart.length, setCartOpen, setOrderCode, setStep])
  useEffect(() => {
    if (restoringFlow.current) return
    // Tras un pedido exitoso no se guardan datos personales del cliente.
    const personal = step === 'sent' ? { name: '', phone: '', identification: '' } : { name, phone, identification }
    saveToStorage(FLOW_STATE_KEY, JSON.stringify({ cartOpen, step, ...personal, orderType, deliveryChosen, address, addressReference, notes, deliveryNotes, geoCoords, addressMethod }))
  }, [cartOpen, step, name, phone, identification, orderType, deliveryChosen, address, addressReference, notes, deliveryNotes, geoCoords, addressMethod])
  const startNewOrder = () => {
    setPickupTime('asap')
    addressActionRef.current += 1
    setLocating(false)
    commitCart([])
    setName('')
    setPhone('')
    setIdentification('')
    setIdPrefix('V')
    setOrderType('takeaway')
    setDeliveryChosen(false)
    setAddress('')
    setAddressReference('')
    setGeoCoords(null)
    setAddressMethod(null)
    setNotes('')
    setDeliveryNotes('')
    setSentSummary(null)
    setError('')
    setOrderCode('')
    setLocalTestOrderLinkedToProfile(false)
    checkoutAttemptRef.current = null
    try {
      localStorage.removeItem(CART_KEY)
      localStorage.removeItem(FLOW_STATE_KEY)
      localStorage.removeItem(WHATSAPP_SENT_KEY)
      sessionStorage.removeItem(CHECKOUT_ATTEMPT_KEY)
    } catch { /* storage unavailable */ }
    closeCart()
  }

  const repeatPreviousOrder = async (previousOrder: CustomerRepeatOrder) => {
    if (cart.length > 0 && !await confirmDialog({
      title: '¿Cambiamos tu pedido?',
      message: 'Ya tienes platos en tu pedido. Si repites este, reemplazamos lo que llevas por el pedido anterior.',
      confirmText: 'Sí, repetir',
      cancelText: 'Dejar el actual',
    })) return

    const catalog = await getPublicCatalog()
    const activeProducts = new Map(catalog.filter(product => product.active).map(product => [product.id, product]))
    const nextCart: WebOrderCartItem[] = []
    const unavailable: string[] = []
    let cartLimitViolation: PublicCartLimitViolation | null = null

    for (const historicalItem of previousOrder.items) {
      const product = activeProducts.get(historicalItem.productId)
      if (!historicalItem.available || !product || !Number.isInteger(historicalItem.quantity) || historicalItem.quantity < 1) {
        unavailable.push(historicalItem.productName || 'Un producto del pedido')
        continue
      }
      if (historicalItem.quantity > PUBLIC_ORDER_MAX_UNITS_PER_PRESENTATION) {
        cartLimitViolation = 'presentation-quantity'
        continue
      }

      const groups = filterProteinExtraGroups(await getPublicProductModifiers(product.id), product.allowProteinExtras !== false)
      const validOptionIds = new Set(groups.flatMap(group => group.options.map(option => option.id)))
      const modifiers = historicalItem.modifiers.filter(modifier => validOptionIds.has(modifier.optionId)).map(modifier => ({ optionId: modifier.optionId, quantity: modifier.quantity }))
      const selection = Object.fromEntries(modifiers.map(modifier => [modifier.optionId, modifier.quantity]))
      if (hasInvalidModifierSelection(groups, selection) || getModifierSelectionError(groups, selection)) {
        unavailable.push(historicalItem.productName || product.name)
        continue
      }

      const restoredItem: WebOrderCartItem = {
        productId: product.id,
        productName: formatProductTitle(product.name),
        price: product.price + calculateModifierTotal(groups, selection),
        quantity: historicalItem.quantity,
        imageUrl: optimizedProductImage(product.imageUrl) || undefined,
        notes: historicalItem.notes || undefined,
        modifiers,
      }
      const existingLine = nextCart.find(item => cartLineKey(item) === cartLineKey(restoredItem))
      if (existingLine) {
        existingLine.quantity += restoredItem.quantity
      } else if (nextCart.length < PUBLIC_ORDER_MAX_DISTINCT_LINES + 1) nextCart.push(restoredItem)
      const violation = getPublicCartLimitViolation(nextCart)
      if (violation) cartLimitViolation = violation
    }

    if (cartLimitViolation) {
      throw new Error(cartLimitViolation === 'presentation-quantity'
        ? 'Ese pedido supera el límite de 30 unidades de una misma presentación. No cambiamos tu pedido actual; ajusta la cantidad antes de volver a intentarlo.'
        : 'Ese pedido supera el límite de 40 productos distintos. No cambiamos tu pedido actual; repítelo en pedidos separados desde el menú.')
    }

    if (!nextCart.length) throw new Error('Los productos de ese pedido ya no están disponibles con las mismas opciones. Puedes volver a agregarlos desde el menú.')

    commitCart(nextCart)
    setProducts(catalog.filter(product => !product.categories.includes('extras')))
    setExtrasProducts(catalog.filter(product => product.categories.includes('extras')))
    customerDetailsTouched.current = true
    setName(previousOrder.customerName)
    setPhone(previousOrder.customerPhone)
    setIdentification(previousOrder.customerIdentification)
    setIdPrefix(previousOrder.customerIdentification.trim().charAt(0).toUpperCase() === 'E' ? 'E' : previousOrder.customerIdentification.trim().charAt(0).toUpperCase() === 'J' ? 'J' : 'V')
    setOrderType(previousOrder.orderType)
    setDeliveryChosen(false)
    setAddress(previousOrder.deliveryAddress || '')
    const savedNoteParts = previousOrder.customerNotes.split(/\s*·\s*/).map(part => part.trim())
    const savedReference = previousOrder.customerNotes.match(/(?:^|\n|·\s*)Referencia:\s*([^\n·]*)/i)?.[1]
    setAddressReference(savedReference?.trim() || '')
    const cleanNotePart = (part: string) => part.replace(/\n(?:Referencia|Ubicación GPS|Pago preferido|Hora de retiro):[^\n]*/gi, '').trim()
    const noteLabel = (label: string) => savedNoteParts.map(cleanNotePart).find(part => part.toLowerCase().startsWith(`${label}:`))?.slice(label.length + 1).trim() || ''
    setDeliveryNotes(noteLabel('Repartidor'))
    setNotes(savedNoteParts
      .map(cleanNotePart)
      .filter(part => part && !/^(Referencia:|Personalizaciones:|Ubicación GPS:|Pago preferido:|Repartidor:)/i.test(part))
      .map(part => part.replace(/^Cocina:\s*/i, ''))
      .join(' · ')
      .trim())
    const savedPayment = previousOrder.customerNotes.match(/(?:^|\n)Pago preferido:\s*([a-z_]+(?:\+[a-z_]+)?)/i)?.[1]
    const savedPaymentCodes = savedPayment?.split('+') ?? []
    if (savedPaymentCodes.length > 0 && savedPaymentCodes.length <= 2 && savedPaymentCodes.every(code => PAY_OPTIONS.some(option => option.code === code))) {
      setPayMode(savedPaymentCodes.length === 2 ? 'mixed' : 'single')
      setPayPrimary(savedPaymentCodes[0] as PayMethod)
      if (savedPaymentCodes.length === 2) setPaySecondary(savedPaymentCodes[1] as PayMethod)
    }
    const hasSavedCoordinates = Number.isFinite(previousOrder.deliveryLat) && Number.isFinite(previousOrder.deliveryLng)
    setGeoCoords(hasSavedCoordinates ? { lat: previousOrder.deliveryLat as number, lng: previousOrder.deliveryLng as number } : null)
    setAddressMethod(hasSavedCoordinates ? 'map' : null)
    setServerDeliveryFeeOverride(null)
    setReturnToConfirmAfterEdit(false)
    setError(unavailable.length
      ? `Cargamos los productos disponibles. No incluimos: ${[...new Set(unavailable)].join(', ')} porque ya no están disponibles con las opciones originales.`
      : '')
    setCurrentTab('menu')
    previousStepRef.current = 'cart'
    setStep('cart')
    setClosingCart(false)
    setCartOpen(true)
    checkoutAttemptRef.current = null
    try { sessionStorage.removeItem(CHECKOUT_ATTEMPT_KEY) } catch { /* el pedido anterior se conserva sin sessionStorage */ }
  }

  const continueFromAddress = () => {
    if (address.trim().length < 8) return showAddressFieldError('address')
    if (!geoCoords) return showAddressFieldError('geo')
    if (orderType === 'delivery' && !addressReference.trim()) return showAddressFieldError('reference')
    if (orderType === 'delivery' && (deliverySettingsStatus !== 'ready' || deliveryQuoteStatus !== 'ready' || deliveryCoverageUnavailable)) return
    setAddressFieldError('')
    setStep('details')
  }

  const continueToConfirmation = () => {
    setError('')
    setFieldError('')
    if (name.trim().length < 2) return showFieldError('name')
    if (!isValidPublicIdentification(identification)) return showFieldError('identification')
    const normalizedPhone = normalizeVenezuelanPhone(phone)
    if (!normalizedPhone) return showFieldError('phone')
    if (normalizedPhone !== phone) setPhone(normalizedPhone)
    if (orderType === 'delivery' && (address.trim().length < 8 || !geoCoords || !addressReference.trim())) {
      setStep('address')
      if (address.trim().length < 8) return showAddressFieldError('address')
      if (!geoCoords) return showAddressFieldError('geo')
      return showAddressFieldError('reference')
    }
    if (orderType === 'delivery' && (deliveryQuoteStatus !== 'ready' || !deliverySettings?.enabled || !deliveryEstimate || deliveryEstimate.fee == null)) {
      setStep('address')
      setError('No podemos confirmar el costo de entrega para esa ubicación. Revisa el punto en el mapa o elige retiro en el local.')
      return
    }
    if (!cart.length) return setError('Tu pedido está vacío.')
    setStep('confirm')
  }

  const returnToMenuAfterSent = () => {
    startNewOrder()
    setCurrentTab('menu')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const submitOrder = async () => {
    if (submitLockRef.current || submitting) return
    if (blockClosedStoreAdd()) return
    setError('')
    setFieldError('')
    if (name.trim().length < 2) { setStep('details'); return showFieldError('name') }
    if (!isValidPublicIdentification(identification)) { setStep('details'); return showFieldError('identification') }
    const normalizedPhone = normalizeVenezuelanPhone(phone)
    if (!normalizedPhone) { setStep('details'); return showFieldError('phone') }
    if (payMode === 'mixed' && payPrimary === paySecondary) { setStep('details'); setError('Elige dos métodos de pago distintos para el pago mixto.'); return }
    if (orderType === 'delivery' && deliverySettings?.enabled === false) { setStep('delivery'); setError('El delivery no está disponible por ahora. Elige retiro en el local.'); return }
    if (orderType === 'delivery') {
      if (address.trim().length < 8) { setStep('address'); return showAddressFieldError('address') }
      if (!geoCoords) { setStep('address'); return showAddressFieldError('geo') }
      if (!addressReference.trim()) { setStep('address'); return showAddressFieldError('reference') }
    }
    if (!cart.length) return setError('Tu pedido está vacío.')
    if (!LOCAL_ORDER_TEST_MODE && publicWhatsappPhone.length < 7) {
      setError('No podemos registrar el pedido porque el WhatsApp de Full China no está configurado. Inténtalo más tarde o contáctanos por otro medio.')
      return
    }
    if (orderType === 'delivery' && (deliveryQuoteStatus !== 'ready' || !deliverySettings?.enabled || !deliveryEstimate || deliveryEstimate.fee == null)) {
      setStep('address')
      setError('No podemos confirmar el costo de entrega para esa ubicación. Revisa el punto en el mapa o elige retiro en el local.')
      return
    }

    if (LOCAL_ORDER_TEST_MODE) {
      const testOrderCode = `PRUEBA-${crypto.randomUUID().slice(0, 6).toUpperCase()}`
      const linkedToProfile = recordLocalOrderTestOrder({
        orderNumber: testOrderCode,
        orderType,
        customerName: name.trim(),
        customerPhone: normalizedPhone,
        customerIdentification: identification.trim().toUpperCase(),
        deliveryAddress: address.trim() || null,
        customerNotes: [notes.trim(), orderType === 'delivery' ? deliveryNotes.trim() : ''].filter(Boolean).join(' · '),
        items: cart,
      })
      setLocalTestOrderLinkedToProfile(linkedToProfile)
      setOrderCode(testOrderCode)
      setSubmitting(false)
      submitLockRef.current = false
      setStep('sent')
      return
    }

    const lineNotes = cart.filter(item => item.notes).map(item => `${item.productName}: ${item.notes}`).join(' | ')
    // El link de Google Maps con las coordenadas va en su propia línea para que
    // Comandas lo muestre como "Ver ubicación" (y lo limpie del texto de notas).
    const mapsLine = orderType === 'delivery' && geoCoords
      ? `\nUbicación GPS: https://maps.google.com/?q=${geoCoords.lat},${geoCoords.lng}`
      : ''
    // Método de pago que el cliente indica. Va en su propia línea con códigos
    // para que Comandas lo pre-seleccione al cobrar (y lo limpie del texto).
    const paymentCodes = payMode === 'mixed' ? `${payPrimary}+${paySecondary}` : payPrimary
    const payLine = `\nPago preferido: ${paymentCodes}`
    // La referencia es obligatoria en delivery: va como metadato para que el
    // recorte a 500 caracteres nunca la pierda.
    const referenceLine = orderType === 'delivery' && addressReference.trim() ? `\nReferencia: ${addressReference.trim()}` : ''
    const primaryNotes = [
      notes.trim() ? `Cocina: ${notes.trim()}` : '',
      orderType === 'delivery' && deliveryNotes.trim() ? `Repartidor: ${deliveryNotes.trim()}` : '',
      lineNotes ? `Personalizaciones: ${lineNotes}` : '',
    ].filter(Boolean).join(' · ')
    const pickupLine = orderType === 'takeaway' ? `\nHora de retiro: ${describePickupTime(pickupTime)}` : ''
    const orderNotes = appendRequiredOrderMetadata(primaryNotes, `${referenceLine}${mapsLine}${payLine}${pickupLine}`)
    const checkoutSignature = JSON.stringify({
      cart: cart.map(item => ({ productId: item.productId, quantity: item.quantity, price: item.price, notes: item.notes || '', modifiers: item.modifiers ?? [] })),
      name: name.trim(), phone: normalizedPhone, identification: identification.trim().toUpperCase(), bcvRate, orderType, address: address.trim(), orderNotes,
      deliveryFee, deliveryLat: geoCoords?.lat ?? null, deliveryLng: geoCoords?.lng ?? null,
    })
    const savedAttempt = checkoutAttemptRef.current?.signature === checkoutSignature ? checkoutAttemptRef.current : null
    const idempotencyKey = savedAttempt?.key || crypto.randomUUID()
    checkoutAttemptRef.current = { signature: checkoutSignature, key: idempotencyKey }
    try { sessionStorage.setItem(CHECKOUT_ATTEMPT_KEY, JSON.stringify(checkoutAttemptRef.current)) } catch { /* storage unavailable */ }
    submitLockRef.current = true
    setSubmitting(true)
    // La petición dura pocos segundos: el cliente se queda en la revisión con el
    // botón en "Enviando pedido…" y pasa directo a "¡Pedido recibido!".
    try {
      const result = await createWebOrder({
        customerName: name.trim(), customerPhone: normalizedPhone, customerIdentification: identification.trim().toUpperCase(), orderType,
        deliveryAddress: address.trim(), notes: orderNotes, items: cart, bcvRate,
        idempotencyKey, deliveryFee, deliveryLat: geoCoords?.lat, deliveryLng: geoCoords?.lng,
      })
      if (result.legacyReview) {
        setOrderCode(result.code)
        setError('Encontramos una solicitud anterior con ese código y no la reenviamos para evitar duplicar el pedido. Comunícate con Full China para revisarla.')
        setStep('confirm')
        return
      }
      if (result.priceChanged) {
        const repricedCart = cart.map((item, index) => {
          const current = result.items?.find(line => line.lineNumber === index + 1 && line.productId === item.productId)
          return current ? { ...item, price: current.unitPrice } : item
        })
        commitCart(repricedCart)
        if (orderType === 'delivery' && result.deliveryFee != null && geoCoords) {
          setServerDeliveryFeeOverride({ lat: geoCoords.lat, lng: geoCoords.lng, fee: result.deliveryFee })
        }
        checkoutAttemptRef.current = null
        try { sessionStorage.removeItem(CHECKOUT_ATTEMPT_KEY) } catch { /* storage unavailable */ }
        setError('Actualizamos los precios vigentes del menú. Revisa el nuevo total y vuelve a confirmar para registrar el pedido.')
        setStep('confirm')
        return
      }
      const pricedCart = cart.map((item, index) => {
        const current = result.items?.find(line => line.lineNumber === index + 1 && line.productId === item.productId)
        return current ? { ...item, price: current.unitPrice } : item
      })
      try { localStorage.setItem(LAST_ORDER_KEY, JSON.stringify(withoutEmbeddedImages(pricedCart))) } catch { /* el pedido ya está registrado; no depende del almacenamiento local */ }
      checkoutAttemptRef.current = null
      try { sessionStorage.removeItem(CHECKOUT_ATTEMPT_KEY) } catch { /* storage unavailable */ }
      setLastOrder(pricedCart)
      // El resumen de "sent" se conserva aparte; el carrito se vacía para que no se pueda reenviar.
      setSentSummary({ items: pricedCart, total: pricedCart.reduce((sum, item) => sum + item.price * item.quantity, 0) + deliveryFee, orderType, address: address.trim(), phone: normalizedPhone })
      commitCart([])
      try { localStorage.removeItem(CART_KEY) } catch { /* el pedido ya está registrado */ }
      setOrderCode(result.code)
      try { localStorage.setItem(WHATSAPP_SENT_KEY, JSON.stringify({ code: result.code, sentAt: Date.now() })) } catch { /* el pedido ya está registrado; no depende del almacenamiento local */ }
      setStep('sent')
    } catch (cause) {
      setError(describeWebOrderError(cause))
      setStep('confirm')
    } finally {
      submitLockRef.current = false
      setSubmitting(false)
    }
  }
  return { repeatPreviousOrder, continueFromAddress, continueToConfirmation, submitOrder, returnToMenuAfterSent }
}
