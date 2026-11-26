import { useState, useMemo, useEffect, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { useLocation, useNavigate } from 'react-router-dom'
import { DndContext, DragOverlay, KeyboardSensor, MouseSensor, TouchSensor, useSensor, useSensors, type DragEndEvent, type DragStartEvent } from '@dnd-kit/core'
import { Caja } from './Caja'
import { getOrdersWithItems, getOrderById, getActiveCashSession, recordOrderPayments, updateOrderStatus, removeOrderItem, deleteOrder, deleteWebOrder, validateMyPin, setOrderDeliveryFee, getAllSellableProducts, getCustomers, createCustomer, getPersonalAccountOptions, getFinancialAccounts, updateOrderCustomer, authorizeOrderCredit, type PaymentMethod, type CartItem, type Customer } from '../lib/dataService'
import { AddItemsToOrderModal } from '../components/AddItemsToOrderModal'
import { LoadingSkeleton } from '../components/LoadingSkeleton'
import { PrintChoiceDialog } from '../components/PrintChoiceDialog'
import { confirmDialog, alertDialog } from '../components/ConfirmDialog'
import { confirmWebOrder } from '../lib/publicOrders'
import { invalidateCachedReads, publishDataChange, subscribeToDataChanges, supabase } from '../lib/supabase'
import { boardKey, fetchBoardOrders, readBoardSnapshot, saveBoardSnapshot } from './comandas/boardData'
import { useLiveDataRefresh } from '../lib/liveDataRefresh'
import { normalizeForSearch } from '../lib/textFormat'
import { canMoveComandaStatus, getInvalidComandaTransitionMessage, isComandaStatus, nextComandaStatus, type ComandaStatus } from '../lib/comandaWorkflow'
import { useRates } from '../context/rates-context'
import { calculateCashChange, formatUsd, dayRangeInTimeZone, parseMoneyInput } from '../lib/money'
import { printThermalReceipt, type ThermalReceiptData } from '../lib/thermalReceipt'
import { Search, ChevronLeft, CheckCircle, ShoppingBag, Bike, UtensilsCrossed, Plus, Trash2, X, ShieldCheck, DollarSign, Sparkles, UserPlus } from 'lucide-react'
import './Comandas.css'

/** Cada cuánto se vuelve a leer el tablero aunque no llegue ningún aviso. */
const BOARD_POLL_MS = 20_000

import { COLUMN_PREVIEW_LIMIT, ActivePaymentMethod, SplitPaymentMethod, paymentInputToUsd, usdToPaymentInput, ComandaItem, ComandaOrder, mapFullOrderToComanda, thermalReceiptForComanda, MOCK_COMANDAS, createDemoComandas, getInitials, cleanNotes, extractPreferredPayment, COLUMNS } from './comandas/model'
import { KitchenPulse } from './comandas/KitchenPulse'
import { ComandasFilters } from './comandas/ComandasFilters'
import { OrderDetailModal } from './comandas/OrderDetailModal'
import { HistoryModal } from './comandas/HistoryModal'
import { buildOrderPayments } from './comandas/buildOrderPayments'
import { usePaymentForm } from './comandas/usePaymentForm'
import { PaymentModal } from './comandas/PaymentModal'
import { ComandaCardContent, KanbanColumn } from './comandas/ComandaCards'


interface ComandasProps {
  embeddedOrderId?: string
  onEmbeddedClose?: () => void
}

export function Comandas({ embeddedOrderId, onEmbeddedClose }: ComandasProps = {}) {
  const { bcvRate } = useRates()
  const location = useLocation()
  const navigate = useNavigate()
  const handledOrderNavigationKey = useRef<string | null>(null)
  const isDemoMode = new URLSearchParams(window.location.search).get('demo') === '1'
  const [initialSnapshot] = useState(() => isDemoMode || embeddedOrderId ? undefined : readBoardSnapshot('today'))
  const [comandas, setComandas] = useState<ComandaOrder[]>(() => isDemoMode ? createDemoComandas() : initialSnapshot ?? MOCK_COMANDAS)
  // Día cuyos datos están en pantalla; mientras no coincida con el filtro se está cargando.
  const [loadedBoardKey, setLoadedBoardKey] = useState<string | null>(() => initialSnapshot ? boardKey('today') : null)
  const loadedBoardKeyRef = useRef(loadedBoardKey)
  loadedBoardKeyRef.current = loadedBoardKey
  const [boardError, setBoardError] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedOrder, setSelectedOrder] = useState<ComandaOrder | null>(null)
  const orderItemsSectionRef = useRef<HTMLDivElement | null>(null)
  const [showAssociateCustomerModal, setShowAssociateCustomerModal] = useState(false)
  const [showCreateAssociateCustomer, setShowCreateAssociateCustomer] = useState(false)
  const [associateCustomerSearch, setAssociateCustomerSearch] = useState('')
  const [associateCustomers, setAssociateCustomers] = useState<Customer[]>([])
  const [loadingAssociateCustomers, setLoadingAssociateCustomers] = useState(false)
  const [associateCustomerError, setAssociateCustomerError] = useState('')
  const [associatingCustomer, setAssociatingCustomer] = useState(false)
  const [creatingAssociateCustomer, setCreatingAssociateCustomer] = useState(false)
  const [newAssociateCustomerName, setNewAssociateCustomerName] = useState('')
  const [newAssociateCustomerPhone, setNewAssociateCustomerPhone] = useState('')
  const [newAssociateCustomerIdentification, setNewAssociateCustomerIdentification] = useState('')
  const [newAssociateCustomerAddress, setNewAssociateCustomerAddress] = useState('')
  const [closingSelectedOrder, setClosingSelectedOrder] = useState(false)
  const [printReceiptPrompt, setPrintReceiptPrompt] = useState<ThermalReceiptData | null>(null)

  // Modal de cobro directo desde Comandas
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [closingPayment, setClosingPayment] = useState(false)
  const [paymentOrder, setPaymentOrder] = useState<ComandaOrder | null>(null)
  const paymentForm = usePaymentForm()
  const {
    selectedPaymentTab,
    setSelectedPaymentTab,
    personalAccounts,
    setPersonalAccounts,
    paymentPersonalAccountId,
    setPaymentPersonalAccountId,
    refNumber,
    setRefNumber,
    extraRefs,
    setExtraRefs,
    amountReceived,
    setAmountReceived,
    amountReceivedSecondary,
    setAmountReceivedSecondary,
    splitPrimaryCashReceived,
    setSplitPrimaryCashReceived,
    splitSecondaryCashReceived,
    setSplitSecondaryCashReceived,
    splitPrimaryCashCurrency,
    setSplitPrimaryCashCurrency,
    splitSecondaryCashCurrency,
    setSplitSecondaryCashCurrency,
    splitPrimaryMethod,
    setSplitPrimaryMethod,
    splitSecondaryMethod,
    setSplitSecondaryMethod,
    splitPrimaryReference,
    setSplitPrimaryReference,
    splitSecondaryReference,
    setSplitSecondaryReference,
    paymentNote,
    setPaymentNote,
    setPaymentError,
    creditAuthorizationPin,
    setCreditAuthorizationPin,
    setPaying,
    cashCurrency,
    setCashCurrency,
    financialAccounts,
    setFinancialAccounts,
    changeAccountId,
    setChangeAccountId,
    paymentAccountId,
    splitPrimaryAccountId,
    splitSecondaryAccountId,
  } = paymentForm
  const [statusError, setStatusError] = useState('')
  const [updatingOrderIds, setUpdatingOrderIds] = useState<Set<string>>(() => new Set())
  const inFlightStatusRef = useRef(new Set<string>())
  const pendingStatusRef = useRef(new Map<string, ComandaStatus>())
  const [confirmingWebId, setConfirmingWebId] = useState<string | null>(null)
  const [reloadToken, setReloadToken] = useState(0)
  const [expandedCols, setExpandedCols] = useState<Record<string, boolean>>(
    isDemoMode ? { new: true, preparing: true, ready: true } : {}
  )
  const [showAddItems, setShowAddItems] = useState(false)
  const [removingItemId, setRemovingItemId] = useState<string | null>(null)
  const [removeError, setRemoveError] = useState('')
  const [deliveryFeeInput, setDeliveryFeeInput] = useState('')
  const [savingDelivery, setSavingDelivery] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [closingDelete, setClosingDelete] = useState(false)
  const [deletePin, setDeletePin] = useState('')
  const [deleteError, setDeleteError] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [productImageByName, setProductImageByName] = useState<Map<string, string>>(new Map())
  useEffect(() => {
    let cancelled = false
    // The order board is more important than optional product thumbnails.
    // Delay this catalog request so it cannot compete with the first order load.
    const timer = window.setTimeout(() => {
      getAllSellableProducts()
        .then(products => {
          if (cancelled) return
          const map = new Map<string, string>()
          for (const p of products) {
            if (p.imageUrl) map.set(normalizeForSearch(p.name), p.imageUrl)
          }
          setProductImageByName(map)
        })
        .catch(() => {})
    }, 1200)
    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [])

  const [showHistoryModal, setShowHistoryModal] = useState(false)
  const [closingHistory, setClosingHistory] = useState(false)
  const [historyOrders, setHistoryOrders] = useState<ComandaOrder[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const historyLoadRequestRef = useRef(0)
  const [historySearch, setHistorySearch] = useState('')
  const [historyFilter, setHistoryFilter] = useState<'all' | 'unpaid' | 'active' | 'delivery' | 'pickup'>('all')
  const historyWeeksRef = useRef<HTMLDivElement>(null)
  const [historySelectedDate, setHistorySelectedDate] = useState('')
  const [showNewOrderModal, setShowNewOrderModal] = useState(false)
  const [closingNewOrder, setClosingNewOrder] = useState(false)
  const closeNewOrderModal = useCallback(() => {
    if (!showNewOrderModal || closingNewOrder) return
    setClosingNewOrder(true)
    window.setTimeout(() => {
      setShowNewOrderModal(false)
      setClosingNewOrder(false)
    }, 200)
  }, [showNewOrderModal, closingNewOrder])

  useEffect(() => {
    if (!showNewOrderModal) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeNewOrderModal()
    }
    window.addEventListener('keydown', handleEscape)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', handleEscape)
    }
  }, [showNewOrderModal, closeNewOrderModal])

  useEffect(() => {
    if (!showAssociateCustomerModal) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !associatingCustomer) setShowAssociateCustomerModal(false)
    }
    window.addEventListener('keydown', handleEscape)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', handleEscape)
    }
  }, [showAssociateCustomerModal, associatingCustomer])

  const [historyMonthCursor, setHistoryMonthCursor] = useState(() => {
    const n = new Date()
    return new Date(n.getFullYear(), n.getMonth(), 1)
  })
  const [historyWeekStartKey, setHistoryWeekStartKey] = useState<string | null>(null)
  const [showHistoryYearMenu, setShowHistoryYearMenu] = useState(false)
  const historyYearMenuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!showHistoryModal) return
    const scrollY = window.scrollY
    const body = document.body
    const root = document.documentElement
    const previousBodyStyles = {
      position: body.style.position,
      top: body.style.top,
      left: body.style.left,
      right: body.style.right,
      width: body.style.width,
      overflow: body.style.overflow,
    }
    const previousRootOverflow = root.style.overflow

    body.style.position = 'fixed'
    body.style.top = `-${scrollY}px`
    body.style.left = '0'
    body.style.right = '0'
    body.style.width = '100%'
    body.style.overflow = 'hidden'
    root.style.overflow = 'hidden'

    return () => {
      body.style.position = previousBodyStyles.position
      body.style.top = previousBodyStyles.top
      body.style.left = previousBodyStyles.left
      body.style.right = previousBodyStyles.right
      body.style.width = previousBodyStyles.width
      body.style.overflow = previousBodyStyles.overflow
      root.style.overflow = previousRootOverflow
      window.scrollTo(0, scrollY)
    }
  }, [showHistoryModal])

  useEffect(() => {
    if (!showHistoryYearMenu) return
    const handleClickOutside = (e: MouseEvent) => {
      if (historyYearMenuRef.current && !historyYearMenuRef.current.contains(e.target as Node)) {
        setShowHistoryYearMenu(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showHistoryYearMenu])

  // Filtros de la barra superior (antes eran decorativos, sin lógica).
  const [dateFilter, setDateFilter] = useState<'today' | 'yesterday'>('today')
  const [statusFilter, setStatusFilter] = useState<'all' | ComandaOrder['status']>('all')
  const [orderTypeFilter, setOrderTypeFilter] = useState<'all' | 'Delivery' | 'Para llevar' | 'Mesa'>('all')
  const [openFilterMenu, setOpenFilterMenu] = useState<'date' | 'status' | 'type' | null>(null)
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false)
  const [boardExpanded, setBoardExpanded] = useState(false)
  const filtersBarRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    document.documentElement.classList.toggle('comandas-board-focus', boardExpanded)
    return () => document.documentElement.classList.remove('comandas-board-focus')
  }, [boardExpanded])

  useEffect(() => {
    if (!openFilterMenu) return
    const handleClickOutside = (e: MouseEvent) => {
      if (filtersBarRef.current && !filtersBarRef.current.contains(e.target as Node)) {
        setOpenFilterMenu(null)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [openFilterMenu])

  const hasActiveFilters = statusFilter !== 'all' || orderTypeFilter !== 'all' || dateFilter !== 'today' || searchQuery !== ''
  const clearFilters = () => {
    setStatusFilter('all')
    setOrderTypeFilter('all')
    setDateFilter('today')
    setSearchQuery('')
    setOpenFilterMenu(null)
  }

  const STATUS_FILTER_OPTIONS: Array<{ value: 'all' | ComandaOrder['status']; label: string }> = [
    { value: 'all', label: 'Estado' },
    { value: 'new', label: 'Nuevas' },
    { value: 'preparing', label: 'En preparación' },
    { value: 'ready', label: 'Listas' },
    { value: 'delivered', label: 'Entregadas' },
  ]
  const ORDER_TYPE_FILTER_OPTIONS: Array<{ value: 'all' | 'Delivery' | 'Para llevar' | 'Mesa'; label: string }> = [
    { value: 'all', label: 'Tipo' },
    { value: 'Delivery', label: 'Delivery' },
    { value: 'Para llevar', label: 'Para llevar' },
    { value: 'Mesa', label: 'Mesa' },
  ]

  const filteredAssociateCustomers = useMemo(() => {
    const query = normalizeForSearch(associateCustomerSearch)
    if (!query) return associateCustomers
    return associateCustomers.filter(customer => normalizeForSearch(
      `${customer.name} ${customer.phone} ${customer.identification}`
    ).includes(query))
  }, [associateCustomerSearch, associateCustomers])

  const openAssociateCustomerModal = async () => {
    if (!selectedOrder || selectedOrder.customerId || selectedOrder.source === 'web' || isDemoMode) return
    setAssociateCustomerSearch('')
    setAssociateCustomerError('')
    setShowCreateAssociateCustomer(false)
    setShowAssociateCustomerModal(true)
    setLoadingAssociateCustomers(true)
    try {
      const customers = await getCustomers(true)
      setAssociateCustomers(customers.filter(customer => customer.isActive))
    } catch (error) {
      setAssociateCustomerError(error instanceof Error ? error.message : 'No se pudieron cargar los clientes')
    } finally {
      setLoadingAssociateCustomers(false)
    }
  }

  const handleAssociateCustomer = async (customer: Customer) => {
    if (!selectedOrder || selectedOrder.customerId || associatingCustomer) return
    const orderId = selectedOrder.id
    setAssociatingCustomer(true)
    setAssociateCustomerError('')
    try {
      await updateOrderCustomer(orderId, customer)
      const applyCustomer = (order: ComandaOrder): ComandaOrder => order.id === orderId ? {
        ...order,
        customerId: customer.id,
        customerName: customer.name,
        customerPhone: customer.phone || undefined,
        customerIdentification: customer.identification || undefined,
      } : order
      setComandas(previous => previous.map(applyCustomer))
      setHistoryOrders(previous => previous.map(applyCustomer))
      setSelectedOrder(previous => previous ? applyCustomer(previous) : previous)
      setShowAssociateCustomerModal(false)
      setReloadToken(value => value + 1)
    } catch (error) {
      setAssociateCustomerError(error instanceof Error ? error.message : 'No se pudo asociar el cliente')
    } finally {
      setAssociatingCustomer(false)
    }
  }

  const handleCreateAndAssociateCustomer = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const name = newAssociateCustomerName.trim()
    if (!name || !selectedOrder || creatingAssociateCustomer) return

    setCreatingAssociateCustomer(true)
    setAssociateCustomerError('')
    try {
      const customer = await createCustomer({
        name,
        phone: newAssociateCustomerPhone.trim(),
        identification: newAssociateCustomerIdentification.trim(),
        address: newAssociateCustomerAddress.trim(),
      })
      setAssociateCustomers(previous => [customer, ...previous.filter(existing => existing.id !== customer.id)])
      setAssociateCustomerSearch(customer.name)
      setShowCreateAssociateCustomer(false)
      await handleAssociateCustomer(customer)
    } catch (error) {
      setAssociateCustomerError(error instanceof Error ? error.message : 'No se pudo crear el cliente')
    } finally {
      setCreatingAssociateCustomer(false)
    }
  }

  // Pre-cargar el costo de delivery actual (renglón "Delivery") al abrir la comanda.
  useEffect(() => {
    const d = selectedOrder?.items.find((i) => i.name === 'Delivery')
    setDeliveryFeeInput(d ? String(d.unitPrice ?? d.subtotal ?? '') : '')
  }, [selectedOrder])

  const handleSaveDeliveryFee = async () => {
    if (!selectedOrder) return
    const fee = Math.max(0, parseFloat(deliveryFeeInput.replace(',', '.')) || 0)
    setSavingDelivery(true)
    setRemoveError('')
    try {
      await setOrderDeliveryFee(selectedOrder.id, fee)
      setSelectedOrder((prev) => {
        if (!prev) return prev
        const withoutDelivery = prev.items.filter((i) => i.name !== 'Delivery')
        const items = fee > 0
          ? [...withoutDelivery, { id: 'delivery-fee', name: 'Delivery', quantity: 1, unitPrice: fee, subtotal: fee }]
          : withoutDelivery
        const totalAmount = items.reduce((s, i) => s + (i.subtotal ?? (i.unitPrice || 0) * i.quantity), 0)
        return { ...prev, items, totalAmount }
      })
      setReloadToken((value) => value + 1)
    } catch (e) {
      setRemoveError(e instanceof Error ? e.message : 'No se pudo guardar el costo de delivery')
    } finally {
      setSavingDelivery(false)
    }
  }

  const handleRemoveItem = async (itemId: string) => {
    const ok = await confirmDialog({ title: 'Quitar producto', message: '¿Quitar este producto de la comanda? Se revertirá su inventario.', confirmText: 'Quitar', danger: true })
    if (!ok) return
    setRemovingItemId(itemId)
    setRemoveError('')
    try {
      await removeOrderItem(itemId)
      setSelectedOrder((prev) => {
        if (!prev) return prev
        const removed = prev.items.find((i) => i.id === itemId)
        const removedTotal = removed ? removed.subtotal ?? (removed.unitPrice || 0) * removed.quantity : 0
        return {
          ...prev,
          items: prev.items.filter((i) => i.id !== itemId),
          totalAmount: Math.max(0, (prev.totalAmount || 0) - removedTotal),
        }
      })
      setReloadToken((value) => value + 1)
    } catch (e) {
      setRemoveError(e instanceof Error ? e.message : 'No se pudo quitar el producto')
    } finally {
      setRemovingItemId(null)
    }
  }

  const handleDeleteOrder = async () => {
    if (!selectedOrder) return
    const deletedOrder = selectedOrder
    setDeleting(true)
    setDeleteError('')
    try {
      const valid = await validateMyPin(deletePin)
      if (!valid) {
        setDeleteError('PIN incorrecto')
        setDeleting(false)
        return
      }
      if (deletedOrder.source === 'web' && deletedOrder.webRequestId) {
        await deleteWebOrder(deletedOrder.webRequestId)
      } else {
        await deleteOrder(deletedOrder.id)
      }
      const matchesDeletedOrder = (order: ComandaOrder) =>
        order.id !== deletedOrder.id &&
        (!deletedOrder.webRequestId || order.webRequestId !== deletedOrder.webRequestId)
      setComandas(previous => previous.filter(matchesDeletedOrder))
      setHistoryOrders(previous => previous.filter(matchesDeletedOrder))
      publishDataChange('orders')
      publishDataChange('web_order_requests')
      // On success, remove both layers in this render so the order and its
      // confirmation dialog do not linger through two separate exit timers.
      setShowDeleteModal(false)
      setClosingDelete(false)
      setDeletePin('')
      setDeleteError('')
      setSelectedOrder(null)
      setClosingSelectedOrder(false)
      onEmbeddedClose?.()
    } catch (e) {
      setDeleteError(e instanceof Error ? e.message : 'No se pudo eliminar la comanda')
    } finally {
      setDeleting(false)
    }
  }

  // Agrega ítems (ya insertados en BD) al detalle abierto de forma optimista y
  // recarga el tablero para reconciliar con los datos reales.
  const handleItemsAdded = (added: CartItem[]) => {
    setSelectedOrder((prev) => {
      if (!prev) return prev
      const newItems: ComandaItem[] = added.map((i, idx) => ({
        id: i.lineId || `added-${Date.now()}-${idx}`,
        name: i.productName,
        quantity: i.quantity,
        unitPrice: i.price,
        subtotal: i.price * i.quantity,
        observations:
          i.selectedModifiers && i.selectedModifiers.length > 0
            ? i.selectedModifiers.map((m) => m.optionName).join(', ')
            : undefined,
      }))
      const addedTotal = added.reduce((s, i) => s + i.price * i.quantity, 0)
      return { ...prev, items: [...prev.items, ...newItems], totalAmount: (prev.totalAmount || 0) + addedTotal }
    })
    setReloadToken((value) => value + 1)
  }
  const paymentRate = paymentOrder?.bcvRate && paymentOrder.bcvRate > 0 ? paymentOrder.bcvRate : bcvRate
  const paymentDue = paymentOrder?.balanceDue ?? paymentOrder?.totalAmount ?? 0
  const changeAccount = financialAccounts.find(account => account.id === changeAccountId)
  const cashChange = calculateCashChange(parseMoneyInput(amountReceived), paymentDue, cashCurrency, paymentRate, changeAccount?.currency ?? cashCurrency)
  useEffect(() => {
    getFinancialAccounts().then(setFinancialAccounts).catch(error => {
      console.error('No se pudieron cargar las cuentas de vuelto:', error)
      setFinancialAccounts([])
    })
  }, [setFinancialAccounts])
  const splitPrimaryAmountUsd = paymentInputToUsd(amountReceived, splitPrimaryMethod, paymentRate)
  const splitSecondaryAmountUsd = paymentInputToUsd(amountReceivedSecondary, splitSecondaryMethod, paymentRate)
  // Los dos métodos del pago combinado están enlazados: editar uno recalcula el
  // otro para que siempre sumen el total (bidireccional Bs<->USD).
  const syncSplitFromPrimary = (input: string) => {
    setAmountReceived(input)
    const primaryUsd = paymentInputToUsd(input, splitPrimaryMethod, paymentRate)
    const secUsd = Math.max(0, Math.round((paymentDue - primaryUsd) * 100) / 100)
    setAmountReceivedSecondary(usdToPaymentInput(secUsd, splitSecondaryMethod, paymentRate))
  }
  const syncSplitFromSecondary = (input: string) => {
    setAmountReceivedSecondary(input)
    const secUsd = paymentInputToUsd(input, splitSecondaryMethod, paymentRate)
    const priUsd = Math.max(0, Math.round((paymentDue - secUsd) * 100) / 100)
    setAmountReceived(usdToPaymentInput(priUsd, splitPrimaryMethod, paymentRate))
  }

  const handleOpenPaymentForOrder = useCallback(async (order: ComandaOrder) => {
    if (order.creditAuthorized) {
      void alertDialog({ message: 'Esta comanda ya tiene un crédito autorizado. Registra los abonos desde Cuentas por cobrar.' })
      return
    }
    // Abrir primero el modal para que el clic siempre tenga respuesta visual,
    // incluso si la validación de caja tarda o el backend devuelve un error.
    setPaymentOrder(order)
    setChangeAccountId('')
    // Pre-seleccionar el método que el cliente indicó en la web (si lo hay).
    const pref = extractPreferredPayment(order.notes)
    if (pref && pref.methods.length >= 2) {
      setSelectedPaymentTab('split')
      setSplitPrimaryMethod(pref.methods[0])
      setSplitSecondaryMethod(pref.methods[1])
    } else if (pref && pref.methods.length === 1) {
      setSelectedPaymentTab(pref.methods[0])
      setSplitPrimaryMethod('cash')
      setSplitSecondaryMethod('mobile')
    } else {
      setSelectedPaymentTab('cash')
      setSplitPrimaryMethod('cash')
      setSplitSecondaryMethod('mobile')
    }
    setRefNumber('')
    setExtraRefs([])
    setCreditAuthorizationPin('')
    const initialTab: SplitPaymentMethod = pref && pref.methods.length === 1 ? pref.methods[0] : 'cash'
    const initialRate = order.bcvRate && order.bcvRate > 0 ? order.bcvRate : bcvRate
    setAmountReceived(usdToPaymentInput(order.balanceDue ?? order.totalAmount ?? 0, initialTab, initialRate))
    setCashCurrency('USD')
    setSplitPrimaryReference('')
    setSplitSecondaryReference('')
    setPaymentNote('')
    getPersonalAccountOptions().then(accounts => {
      setPersonalAccounts(accounts)
      setPaymentPersonalAccountId(accounts.find(account => account.isActive)?.id ?? '')
    }).catch(() => setPersonalAccounts([]))
    setPaymentError('Verificando la caja activa…')
    setShowPaymentModal(true)

    try {
      const activeSession = await getActiveCashSession()
      if (!activeSession) {
        setPaymentError('Debes abrir la caja antes de cobrar esta comanda.')
        return
      }
    } catch (cause) {
      setPaymentError(cause instanceof Error ? cause.message : 'No se pudo verificar la caja activa')
      return
    }
    setPaymentError('')
  }, [bcvRate, setAmountReceived, setCashCurrency, setChangeAccountId, setCreditAuthorizationPin, setExtraRefs, setPaymentError, setPaymentNote, setPaymentPersonalAccountId, setPersonalAccounts, setRefNumber, setSelectedPaymentTab, setSplitPrimaryMethod, setSplitPrimaryReference, setSplitSecondaryMethod, setSplitSecondaryReference])

  useEffect(() => {
    if (embeddedOrderId) return
    const navigation = location.state as { openOrderId?: unknown; openOrderAction?: unknown } | null
    const orderId = typeof navigation?.openOrderId === 'string' ? navigation.openOrderId : null
    if (!orderId || handledOrderNavigationKey.current === location.key) return

    handledOrderNavigationKey.current = location.key
    let active = true
    const openRequestedOrder = async () => {
      try {
        const fullOrder = await getOrderById(orderId)
        if (!active) return
        if (!fullOrder) throw new Error('No se encontró la comanda seleccionada')

        const order = mapFullOrderToComanda(fullOrder)
        if (navigation?.openOrderAction === 'payment') {
          await handleOpenPaymentForOrder(order)
        } else {
          setSelectedOrder(order)
        }
      } catch (error) {
        if (active) void alertDialog({ message: error instanceof Error ? error.message : 'No se pudo abrir la comanda seleccionada' })
      } finally {
        if (active) navigate(location.pathname, { replace: true, state: null })
      }
    }

    void openRequestedOrder()
    return () => { active = false }
  }, [embeddedOrderId, handleOpenPaymentForOrder, location.key, location.pathname, location.state, navigate])

  const handleSelectPaymentTab = (method: ActivePaymentMethod | 'split') => {
    setSelectedPaymentTab(method)
    setPaymentError('')
    setRefNumber('')
    setExtraRefs([])
    setSplitPrimaryReference('')
    setSplitSecondaryReference('')
    if (method === 'split' && paymentDue) {
      const half = paymentDue / 2
      setAmountReceived(usdToPaymentInput(half, splitPrimaryMethod, paymentRate))
      setAmountReceivedSecondary(usdToPaymentInput(paymentDue - half, splitSecondaryMethod, paymentRate))
      setSplitPrimaryCashReceived(half.toFixed(2))
      setSplitSecondaryCashReceived((paymentDue - half).toFixed(2))
      setSplitPrimaryCashCurrency('USD')
      setSplitSecondaryCashCurrency('USD')
    } else {
      const inputMethod: SplitPaymentMethod = method === 'split' || method === 'personal_account' || method === 'credit' ? 'cash' : method
      setAmountReceived(usdToPaymentInput(paymentDue, inputMethod, paymentRate))
      setSplitPrimaryCashReceived(paymentDue.toFixed(2))
      setSplitSecondaryCashReceived((paymentDue / 2).toFixed(2))
      setSplitPrimaryCashCurrency('USD')
      setSplitSecondaryCashCurrency('USD')
    }
    if (method === 'credit') setCreditAuthorizationPin('')
    if (method === 'personal_account') setPaymentPersonalAccountId(personalAccounts.find(account => account.isActive)?.id ?? '')
  }

  const handleConfirmOrderPayment = async () => {
    if (!paymentOrder) return
    setPaying(true)
    setPaymentError('')
    try {
      if (selectedPaymentTab === 'credit') {
        if (!paymentOrder.customerId) throw new Error('Asocia un cliente a la comanda antes de autorizar el crédito')
        if (!/^\d{4}$/.test(creditAuthorizationPin)) throw new Error('Ingresa el PIN de autorización de 4 dígitos')
        await authorizeOrderCredit({ orderId: paymentOrder.id, pin: creditAuthorizationPin })
        setReloadToken(value => value + 1)
        closePaymentModal()
        return
      }

      const { payments } = buildOrderPayments({ paymentOrder, selectedPaymentTab, amountReceived, cashCurrency, paymentRate, refNumber, extraRefs, splitPrimaryAmountUsd, splitPrimaryMethod, splitSecondaryMethod, splitPrimaryReference, splitSecondaryReference, splitPrimaryCashReceived, splitSecondaryCashReceived, splitPrimaryCashCurrency, splitSecondaryCashCurrency, changeAccount, changeAccountId, cashChange, personalAccounts, paymentPersonalAccountId, paymentNote, paymentAccountId, splitPrimaryAccountId, splitSecondaryAccountId })

      await recordOrderPayments({
        orderId: paymentOrder.id,
        payments,
        notes: paymentNote || null,
      })

      const methodLabels: Record<string, string> = {
        cash: cashCurrency === 'USD' ? 'Pago: Efectivo $' : 'Pago: Efectivo Bs',
        mobile: 'Pago: Pago móvil',
        card: 'Pago: Punto',
        transfer: 'Pago: Transferencia',
        binance: 'Pago: Binance',
        personal_account: `Consumo: ${personalAccounts.find(account => account.id === paymentPersonalAccountId)?.name ?? 'Cuenta personal'}`,
        split: 'Pago combinado',
      }
      const methodLabel = methodLabels[selectedPaymentTab] || 'Pago: Efectivo'
      const payType: ComandaOrder['paymentType'] = selectedPaymentTab === 'cash'
        ? 'cash'
        : selectedPaymentTab === 'card' || selectedPaymentTab === 'split'
          ? 'card'
          : 'app'
      const paymentReference = selectedPaymentTab === 'split'
        ? [splitPrimaryReference.trim() && `Método 1: ${splitPrimaryReference.trim()}`, splitSecondaryReference.trim() && `Método 2: ${splitSecondaryReference.trim()}`].filter(Boolean).join(' · ')
        : refNumber.trim()
      const orderForReceipt: ComandaOrder = {
        ...paymentOrder,
        isPaid: true,
        paymentMethod: methodLabel,
        paymentType: payType,
        paymentReference: paymentReference || undefined,
        payments: payments.map(payment => ({
          method: payment.method,
          amount: payment.amount,
          referenceNumber: payment.referenceNumber ?? null,
           receivedAmount: payment.receivedAmount ?? null,
          receivedCurrency: payment.receivedCurrency ?? null,
          changeAmount: payment.changeAmount ?? null,
          changeCurrency: payment.changeCurrency ?? null,
        })),
      }

      setComandas(prev =>
        prev.map(c =>
          c.id === paymentOrder.id
            ? {
                ...c,
                isPaid: true,
                paymentMethod: methodLabel,
                paymentType: payType,
                paymentReference: paymentReference || undefined,
              }
            : c
        )
      )

      if (selectedOrder?.id === paymentOrder.id) {
        setSelectedOrder(prev => prev ? {
          ...prev,
          isPaid: true,
          paymentMethod: methodLabel,
          paymentType: payType,
          paymentReference: paymentReference || undefined,
        } : null)
      }

      setPrintReceiptPrompt(thermalReceiptForComanda(orderForReceipt))

      closePaymentModal()
    } catch (e) {
      console.error('Error al confirmar pago:', e)
      setPaymentError(e instanceof Error ? e.message : 'No se pudo registrar el pago')
    } finally {
      setPaying(false)
    }
  }

  // Fetch real orders from Supabase / dataService
  useEffect(() => {
    if (isDemoMode) {
      setComandas(createDemoComandas())
      return
    }
    if (embeddedOrderId) return

    let active = true
    let latestLoadRequest = 0
    const snapshot = readBoardSnapshot(dateFilter)
    if (snapshot && loadedBoardKeyRef.current !== boardKey(dateFilter)) {
      setComandas(snapshot)
      setLoadedBoardKey(boardKey(dateFilter))
    }
    setBoardError(false)
    const loadRealOrders = async () => {
      const loadRequest = ++latestLoadRequest
      try {
        const key = boardKey(dateFilter)
        const [realOrders, webOrders] = await fetchBoardOrders(dateFilter)

        if (active) {
          const mapped: ComandaOrder[] = realOrders.map((o) => {
            const date = new Date(o.createdAt)
            const elapsed = Math.floor((Date.now() - date.getTime()) / 60000)
            const status: ComandaOrder['status'] = o.fulfillmentStatus

            const hasPaid = o.status === 'paid'
            const paymentMethods = [...new Set(o.payments.map((payment) => payment.method))]
            const paymentLabels: Record<PaymentMethod, string> = {
              cash: 'Efectivo',
              mobile: 'Pago móvil',
              card: 'Punto',
              transfer: 'Transferencia',
              binance: 'Binance',
              zelle: 'Zelle',
              other: 'Otro',
              personal_account: 'Cuenta personal',
            }
            const persistedPaymentLabel = paymentMethods.length > 1
              ? 'Pago combinado'
              : paymentMethods.length === 1
                ? `Pago: ${paymentLabels[paymentMethods[0]]}`
                : 'Pago registrado'
            const persistedReference = o.payments
              .map((payment) => payment.referenceNumber)
              .find((reference): reference is string => Boolean(reference))

            return {
              id: o.id,
              orderNumber: `#FC-${String(o.orderNumber).padStart(6, '0')}`,
              time: date.toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit', hour12: true }),
              date: date.toLocaleDateString('es-VE', { day: '2-digit', month: '2-digit', year: 'numeric' }),
              createdAt: o.createdAt,
              isRetraso: elapsed > 15 && status !== 'delivered',
              customerId: o.customerId,
              customerName: o.customerName || 'Cliente general',
              customerPhone: o.customerPhone || undefined,
              customerIdentification: o.customerIdentification || undefined,
              address: o.orderType === 'delivery' ? (o.customerAddress || '') : '',
              reference: '',
              paymentReference: persistedReference,
              orderType: o.orderType === 'takeaway' ? 'Para llevar' : o.orderType === 'delivery' ? 'Delivery' : o.orderType === 'dine-in' ? (o.tableNumber ? `Mesa ${o.tableNumber}` : 'Mesa') : 'Para llevar',
              items: o.items.map((item) => ({
                id: item.id,
                name: item.productName,
                quantity: item.quantity,
                unitPrice: item.unitPrice || 0,
                subtotal: (item.quantity || 0) * (item.unitPrice || 0),
                observations: '',
                modifiers: item.modifiers ?? [],
              })),
              notes: o.notes || '',
              paymentMethod: hasPaid ? persistedPaymentLabel : '⚠️ Sin pagar',
              payments: o.payments.map(payment => ({ method: payment.method, amount: payment.amount, referenceNumber: payment.referenceNumber })),
              paymentType: hasPaid
                ? paymentMethods.includes('cash')
                  ? 'cash'
                  : paymentMethods.includes('mobile') || paymentMethods.includes('transfer')
                    ? 'app'
                    : 'card'
                : 'pending' as const,
              isPaid: hasPaid,
              creditAuthorized: o.creditAuthorized,
              totalAmount: o.totalAmount || 0,
              balanceDue: Math.max(0, (o.totalAmount || 0) - o.payments.reduce((sum, payment) => sum + payment.amount, 0)),
              serviceCharge: 0,
              discount: 0,
              bcvRate: o.bcvRate || undefined,
              elapsedMins: elapsed < 0 ? 1 : elapsed,
              status,
              deliveredTime: status === 'delivered' ? date.toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit', hour12: true }) : undefined,
              attendedBy: 'Usuario del sistema',
              source: 'pos',
            }
          })
          // La recarga puede haber comenzado mientras se confirmaba el cambio.
          // Conserva el estado local hasta que una lectura lo confirme.
          for (const order of mapped) {
            if (pendingStatusRef.current.get(order.id) === order.status) {
              pendingStatusRef.current.delete(order.id)
            }
          }
          const pendingWeb: ComandaOrder[] = webOrders.map((order) => {
            const date = new Date(order.createdAt)
            const elapsed = Math.max(0, Math.floor((Date.now() - date.getTime()) / 60000))
            return {
              id: `web:${order.id}`,
              webRequestId: order.id,
              source: 'web',
              orderNumber: order.code,
              time: date.toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit', hour12: true }),
              date: date.toLocaleDateString('es-VE'),
              createdAt: order.createdAt,
              isRetraso: elapsed > 10,
              customerName: order.customerName,
              customerPhone: order.customerPhone,
              customerIdentification: order.customerIdentification,
              address: order.deliveryAddress || '',
              orderType: order.orderType === 'delivery' ? 'Delivery' : 'Para llevar',
              items: order.items.map(item => ({
                id: item.id,
                name: item.productName,
                quantity: item.quantity,
                unitPrice: item.price,
                subtotal: item.price * item.quantity,
                observations: [
                  ...item.modifiers.map(modifier => `${modifier.groupName}: ${modifier.optionName}${modifier.quantity > 1 ? ` ×${modifier.quantity}` : ''}`),
                  ...(item.notes ? [item.notes] : []),
                ].join(' · ') || undefined,
              })),
              notes: order.notes || '',
              paymentMethod: 'Pendiente de confirmar',
              paymentType: 'pending',
              isPaid: false,
              totalAmount: order.subtotal,
              balanceDue: order.subtotal,
              serviceCharge: 0,
              discount: 0,
              bcvRate: order.bcvRate || undefined,
              elapsedMins: elapsed,
              status: 'new',
              attendedBy: 'Pedido desde la web',
            }
          })
          setLoadedBoardKey(key)
          setBoardError(false)
          setComandas(previous => {
            const previousById = new Map(previous.map(order => [order.id, order]))
            return [...pendingWeb, ...mapped].map(order => {
              const pendingStatus = pendingStatusRef.current.get(order.id)
              const optimisticOrder = previousById.get(order.id)
              return pendingStatus && optimisticOrder
                ? { ...order, status: pendingStatus, isRetraso: optimisticOrder.isRetraso, deliveredTime: optimisticOrder.deliveredTime }
                : order
            })
          })

          // Show the actual orders as soon as they arrive. Staff names are
          // supplementary, so resolve them after the board has been rendered.
          const creatorIds = [...new Set(realOrders.map(order => order.createdBy).filter(Boolean))]
          if (supabase && creatorIds.length > 0) {
            void supabase
              .from('profiles')
              .select('id,full_name')
              .in('id', creatorIds)
              .then(({ data: profiles, error: profilesError }) => {
                if (!active || loadRequest !== latestLoadRequest) return
                if (profilesError) {
                  console.warn('No se pudieron cargar los nombres de quienes atendieron:', profilesError)
                  return
                }
                const names = new Map((profiles ?? []).map(profile => [
                  String(profile.id), String(profile.full_name || 'Usuario del sistema'),
                ]))
                if (!names.size) return
                const namesByOrder = new Map(realOrders.map(order => [order.id, names.get(order.createdBy)]))
                setComandas(previous => previous.map(order => {
                  const name = namesByOrder.get(order.id)
                  return name ? { ...order, attendedBy: name } : order
                }))
              })
          }
        }
      } catch (e) {
        console.error('Error cargando comandas reales:', e)
        if (active) setBoardError(true)
      }
    }

    // Una sola lectura a la vez: los avisos que llegan mientras tanto piden otra
    // al terminar, sin descartar la que está en camino (así el tablero nunca se
    // queda vacío aunque haya cambios seguidos).
    let loading = false
    let queued = false
    const requestLoad = async () => {
      if (loading) { queued = true; return }
      loading = true
      do {
        queued = false
        await loadRealOrders()
      } while (active && queued)
      loading = false
    }
    // Respaldo por si el aviso en tiempo real no llega: los pedidos nuevos
    // aparecen igual, y al volver a la app o recuperar internet.
    const refreshFromServer = () => {
      if (document.visibilityState === 'hidden') return
      invalidateCachedReads(['orders', 'web_order_requests'])
      void requestLoad()
    }
    const pollTimer = setInterval(refreshFromServer, BOARD_POLL_MS)
    document.addEventListener('visibilitychange', refreshFromServer)
    window.addEventListener('online', refreshFromServer)

    void requestLoad()
    let refreshTimer: ReturnType<typeof setTimeout> | null = null
    const unsubscribe = subscribeToDataChanges((table) => {
      if (!['orders', 'order_items', 'order_item_modifiers', 'modifiers', 'modifier_options', 'sellable_products', 'payments', 'web_order_requests', 'web_order_items', 'order_event_logs', 'profiles', 'customers', '*'].includes(table)) return
      if (document.visibilityState === 'hidden') return
      if (table === 'customers' && showAssociateCustomerModal) {
        void getCustomers(true)
          .then(customers => {
            if (active) setAssociateCustomers(customers.filter(customer => customer.isActive))
          })
          .catch(error => {
            if (active && showAssociateCustomerModal) {
              setAssociateCustomerError(error instanceof Error ? error.message : 'No se pudo actualizar la lista de clientes')
            }
          })
      }
      if (refreshTimer) return
      refreshTimer = setTimeout(() => { refreshTimer = null; void requestLoad() }, 180)
    })
    return () => {
      active = false
      unsubscribe()
      clearInterval(pollTimer)
      document.removeEventListener('visibilitychange', refreshFromServer)
      window.removeEventListener('online', refreshFromServer)
      if (refreshTimer) clearTimeout(refreshTimer)
    }
  }, [reloadToken, dateFilter, isDemoMode, embeddedOrderId, showAssociateCustomerModal])

  useEffect(() => {
    if (loadedBoardKey) saveBoardSnapshot(loadedBoardKey, comandas)
  }, [comandas, loadedBoardKey])

  useEffect(() => {
    if (!embeddedOrderId || isDemoMode) return
    let active = true
    setSelectedOrder(null)
    setClosingSelectedOrder(false)
    const loadEmbeddedOrder = async () => {
      try {
        const fullOrder = await getOrderById(embeddedOrderId)
        if (!active) return
        if (!fullOrder) throw new Error('No se encontró la comanda de esta mesa')
        let attendedBy = 'Usuario del sistema'
        if (supabase && fullOrder.createdBy) {
          const { data } = await supabase.from('profiles').select('full_name').eq('id', fullOrder.createdBy).maybeSingle()
          attendedBy = String(data?.full_name || attendedBy)
        }
        if (!active) return
        const order = { ...mapFullOrderToComanda(fullOrder), attendedBy }
        setComandas(previous => [order, ...previous.filter(item => item.id !== order.id)])
        setSelectedOrder(order)
      } catch (error) {
        if (active) {
          console.error('No se pudo abrir la comanda desde el mapa de mesas:', error)
          void alertDialog({ message: error instanceof Error ? error.message : 'No se pudo abrir la comanda de esta mesa', danger: true })
          onEmbeddedClose?.()
        }
      }
    }
    void loadEmbeddedOrder()
    return () => { active = false }
  }, [embeddedOrderId, isDemoMode, onEmbeddedClose, reloadToken])

  const handleConfirmWebOrder = async (order: ComandaOrder) => {
    if (!order.webRequestId) return
    setConfirmingWebId(order.webRequestId)
    try {
      await confirmWebOrder(order.webRequestId)
      closeSelectedOrder()
      setReloadToken(value => value + 1)
    } catch (cause) {
      console.error('Error confirmando pedido web:', cause)
      void alertDialog({ message: cause instanceof Error ? cause.message : 'No se pudo confirmar el pedido web', danger: true })
    } finally {
      setConfirmingWebId(null)
    }
  }

  const closeSelectedOrder = (then?: () => void) => {
    if (!selectedOrder || closingSelectedOrder) return
    setClosingSelectedOrder(true)
    window.setTimeout(() => {
      setSelectedOrder(null)
      setClosingSelectedOrder(false)
      then?.()
      onEmbeddedClose?.()
    }, 200)
  }

  const closeDeleteModal = (then?: () => void) => {
    if (!showDeleteModal || closingDelete) return
    setClosingDelete(true)
    window.setTimeout(() => {
      setShowDeleteModal(false)
      setClosingDelete(false)
      setDeletePin('')
      setDeleteError('')
      then?.()
    }, 200)
  }

  const closePaymentModal = (then?: () => void) => {
    if (!showPaymentModal || closingPayment) return
    setClosingPayment(true)
    window.setTimeout(() => {
      setShowPaymentModal(false)
      setClosingPayment(false)
      setPaymentOrder(null)
      then?.()
    }, 200)
  }

  const closeHistoryModal = (then?: () => void) => {
    if (!showHistoryModal || closingHistory) return
    setClosingHistory(true)
    window.setTimeout(() => {
      setShowHistoryModal(false)
      setClosingHistory(false)
      setHistorySearch('')
      setHistoryMonthCursor(() => {
        const n = new Date()
        return new Date(n.getFullYear(), n.getMonth(), 1)
      })
      setHistoryWeekStartKey(null)
      setHistorySelectedDate('')
      then?.()
    }, 200)
  }

  const mondayOf = (d: Date) => {
    const day = d.getDay()
    const diff = day === 0 ? -6 : 1 - day
    return new Date(d.getFullYear(), d.getMonth(), d.getDate() + diff)
  }

  const historyWeeksInMonth = useMemo(() => {
    const monthStart = historyMonthCursor
    const monthEnd = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0)
    const today = new Date()
    const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate())
    const weeks: Array<{ key: string; start: Date; end: Date; label: string }> = []
    let cursor = mondayOf(monthStart)
    while (cursor <= monthEnd) {
      const weekEnd = new Date(cursor)
      weekEnd.setDate(weekEnd.getDate() + 6)
      if (cursor <= todayStart) {
        const cappedEnd = weekEnd > todayStart ? todayStart : weekEnd
        const startLabel = cursor.toLocaleDateString('es-VE', { day: 'numeric', month: 'short' }).replace('.', '')
        const endLabel = cappedEnd.toLocaleDateString('es-VE', { day: 'numeric', month: 'short' }).replace('.', '')
        weeks.push({
          key: cursor.toISOString().slice(0, 10),
          start: cursor,
          end: cappedEnd,
          label: `${startLabel} – ${endLabel}`,
        })
      }
      cursor = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate() + 7)
    }
    return weeks.reverse()
  }, [historyMonthCursor])

  const handleHistoryDateChange = (value: string) => {
    setHistorySelectedDate(value)
    if (!value) {
      setHistoryWeekStartKey(historyWeeksInMonth[0]?.key ?? null)
      return
    }
    const [year, month] = value.split('-').map(Number)
    setHistoryMonthCursor(new Date(year, month - 1, 1))
    setHistoryWeekStartKey(null)
  }

  const clearHistoryDate = () => {
    if (historySelectedDate) {
      const [year, month, day] = historySelectedDate.split('-').map(Number)
      const weekStart = mondayOf(new Date(year, month - 1, day))
      setHistoryWeekStartKey(weekStart.toISOString().slice(0, 10))
    }
    setHistorySelectedDate('')
  }

  useEffect(() => {
    if (!showHistoryModal) return
    if (historySelectedDate) return
    if (historyWeeksInMonth.length === 0) {
      setHistoryWeekStartKey(null)
      return
    }
    if (!historyWeeksInMonth.some(w => w.key === historyWeekStartKey)) {
      setHistoryWeekStartKey(historyWeeksInMonth[0].key)
    }
  }, [historyWeeksInMonth, showHistoryModal, historyWeekStartKey, historySelectedDate])

  const canGoNextMonth = useMemo(() => {
    const now = new Date()
    return historyMonthCursor.getFullYear() < now.getFullYear() ||
      (historyMonthCursor.getFullYear() === now.getFullYear() && historyMonthCursor.getMonth() < now.getMonth())
  }, [historyMonthCursor])

  const loadHistoryOrders = useCallback(async (monthCursor: Date, silent = false) => {
    const loadRequest = ++historyLoadRequestRef.current
    if (!silent) setHistoryLoading(true)
    try {
      const monthStart = new Date(monthCursor.getFullYear(), monthCursor.getMonth(), 1)
      const monthEnd = new Date(monthCursor.getFullYear(), monthCursor.getMonth() + 1, 0)
      const dateFrom = dayRangeInTimeZone(monthStart).start
      const dateTo = dayRangeInTimeZone(monthEnd).end

      const allOrders = await getOrdersWithItems(dateFrom, dateTo, true)
      if (loadRequest !== historyLoadRequestRef.current) return

      const creatorNames = new Map<string, string>()
      const creatorIds = [...new Set(allOrders.map(order => order.createdBy).filter(Boolean))]
      if (supabase && creatorIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id,full_name')
          .in('id', creatorIds)
        if (loadRequest !== historyLoadRequestRef.current) return
        for (const profile of profiles ?? []) {
          creatorNames.set(String(profile.id), String(profile.full_name || 'Usuario del sistema'))
        }
      }

      const mapped: ComandaOrder[] = allOrders.map((o) => {
        const date = new Date(o.createdAt)
        const status: ComandaOrder['status'] = o.fulfillmentStatus
        const hasPaid = o.status === 'paid'
        const paymentMethods = [...new Set(o.payments.map((p) => p.method))]
        const paymentLabels: Record<PaymentMethod, string> = {
          cash: 'Efectivo', mobile: 'Pago móvil', card: 'Punto', transfer: 'Transferencia',
          binance: 'Binance', zelle: 'Zelle', other: 'Otro',
          personal_account: 'Cuenta personal',
        }
        const paymentLabel = paymentMethods.length > 1
          ? 'Pago combinado'
          : paymentMethods.length === 1
            ? `Pago: ${paymentLabels[paymentMethods[0]]}`
            : 'Sin pago'

        return {
          id: o.id,
          orderNumber: `#FC-${String(o.orderNumber).padStart(6, '0')}`,
          time: date.toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit', hour12: true }),
          date: date.toLocaleDateString('es-VE', { day: '2-digit', month: '2-digit', year: 'numeric' }),
          customerId: o.customerId,
          customerName: o.customerName || 'Cliente general',
          customerPhone: o.customerPhone || undefined,
          customerIdentification: o.customerIdentification || undefined,
          orderType: o.orderType === 'takeaway' ? 'Para llevar' : o.orderType === 'delivery' ? 'Delivery' : o.orderType === 'dine-in' ? (o.tableNumber ? `Mesa ${o.tableNumber}` : 'Mesa') : 'Para llevar',
          items: o.items.map((item) => ({
            id: item.id, name: item.productName, quantity: item.quantity,
            unitPrice: item.unitPrice || 0, subtotal: (item.quantity || 0) * (item.unitPrice || 0),
          })),
          notes: o.notes || '',
          paymentMethod: hasPaid ? paymentLabel : 'Sin pago',
          payments: o.payments.map(payment => ({ method: payment.method, amount: payment.amount })),
          paymentType: hasPaid
            ? paymentMethods.includes('cash') ? 'cash'
              : paymentMethods.includes('mobile') || paymentMethods.includes('transfer') ? 'app'
                : 'card'
            : 'pending',
          isPaid: hasPaid,
          creditAuthorized: o.creditAuthorized,
          totalAmount: o.totalAmount || 0,
          balanceDue: Math.max(0, (o.totalAmount || 0) - o.payments.reduce((sum, payment) => sum + payment.amount, 0)),
          elapsedMins: Math.max(0, Math.floor((Date.now() - date.getTime()) / 60000)),
          status,
          deliveredTime: status === 'delivered' ? date.toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit', hour12: true }) : undefined,
          attendedBy: creatorNames.get(o.createdBy) || 'Admin',
          source: 'pos',
        }
      })

      if (loadRequest !== historyLoadRequestRef.current) return
      setHistoryOrders(mapped.sort((a, b) => {
        const dateA = a.date || ''
        const dateB = b.date || ''
        if (dateA !== dateB) return dateB.localeCompare(dateA)
        return b.time.localeCompare(a.time)
      }))
    } catch (e) {
      if (loadRequest === historyLoadRequestRef.current) console.error('Error cargando historial:', e)
    } finally {
      if (!silent && loadRequest === historyLoadRequestRef.current) setHistoryLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!showHistoryModal) return
    loadHistoryOrders(historyMonthCursor)
  }, [showHistoryModal, historyMonthCursor, loadHistoryOrders])

  useLiveDataRefresh('comandas', () => {
    if (showHistoryModal) return loadHistoryOrders(historyMonthCursor, true)
  })

  const filteredHistoryOrders = useMemo(() => {
    if (!historySearch) return historyOrders
    const q = normalizeForSearch(historySearch)
    return historyOrders.filter(c =>
      normalizeForSearch(c.orderNumber).includes(q) ||
      normalizeForSearch(c.customerName).includes(q) ||
      c.items.some(i => normalizeForSearch(i.name).includes(q))
    )
  }, [historyOrders, historySearch])

  const historyGroups = useMemo(() => {
    const parseDdMmYyyy = (str?: string): Date | null => {
      if (!str) return null
      const [d, m, y] = str.split('/').map(Number)
      if (!d || !m || !y) return null
      return new Date(y, m - 1, d)
    }

    const now = new Date()
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const selectedWeek = historyWeeksInMonth.find(w => w.key === historyWeekStartKey)

    const filtered = filteredHistoryOrders.filter(order => {
      const d = parseDdMmYyyy(order.date)
      if (!d) return true
      if (historySelectedDate) {
        const orderDateKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
        return orderDateKey === historySelectedDate
      }
      if (!selectedWeek) return false
      return d.getTime() >= selectedWeek.start.getTime() && d.getTime() <= selectedWeek.end.getTime()
    }).filter(order => {
      if (historyFilter === 'unpaid') return !order.isPaid && !order.creditAuthorized
      if (historyFilter === 'active') return order.status !== 'delivered'
      if (historyFilter === 'delivery') return order.orderType === 'Delivery'
      if (historyFilter === 'pickup') return order.orderType !== 'Delivery'
      return true
    })

    const map = new Map<string, ComandaOrder[]>()
    for (const order of filtered) {
      const key = order.date || ''
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(order)
    }

    return [...map.entries()].map(([key, orders]) => {
      const d = parseDdMmYyyy(key)
      let label = key || 'Sin fecha'
      if (d) {
        const diffDays = Math.round((startOfToday.getTime() - d.getTime()) / 86400000)
        if (diffDays === 0) label = 'Hoy'
        else if (diffDays === 1) label = 'Ayer'
        else {
          const raw = d.toLocaleDateString('es-VE', { weekday: 'long', day: 'numeric', month: 'long' })
          label = raw.charAt(0).toUpperCase() + raw.slice(1)
        }
      }
      const total = orders.reduce((sum, order) => sum + (order.totalAmount || 0), 0)
      return { key, label, orders, total }
    })
  }, [filteredHistoryOrders, historyWeeksInMonth, historyWeekStartKey, historySelectedDate, historyFilter])

  // La semana elegida siempre queda a la vista en la fila desplazable.
  useEffect(() => {
    if (!showHistoryModal) return
    const frame = window.requestAnimationFrame(() => {
      historyWeeksRef.current?.querySelector<HTMLElement>('.cmd-history-week-btn.active')
        ?.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' })
    })
    return () => window.cancelAnimationFrame(frame)
  }, [showHistoryModal, historyWeekStartKey, historyMonthCursor])

  // Simulation timer for elapsed mins
  useEffect(() => {
    const timer = setInterval(() => {
      setComandas(prev =>
        prev.map(c => (c.status !== 'delivered' ? { ...c, elapsedMins: c.elapsedMins + 1 } : c))
      )
    }, 60000)
    return () => clearInterval(timer)
  }, [])

  const filteredComandas = useMemo(() => {
    const q = normalizeForSearch(searchQuery)
    return comandas.filter(c => {
      const matchSearch =
        normalizeForSearch(c.orderNumber).includes(q) ||
        normalizeForSearch(c.customerName).includes(q) ||
        c.items.some(i => normalizeForSearch(i.name).includes(q))
      const matchStatus = statusFilter === 'all' || c.status === statusFilter
      const matchType = orderTypeFilter === 'all'
        || (orderTypeFilter === 'Mesa' ? c.orderType.startsWith('Mesa') : c.orderType === orderTypeFilter)
      return matchSearch && matchStatus && matchType
    })
  }, [comandas, searchQuery, statusFilter, orderTypeFilter])

  const getOrdersByStatus = (statusKey: ComandaStatus) => {
    return filteredComandas.filter(c => c.status === statusKey)
  }

  const handleSetStatus = async (orderId: string, nextStatus: ComandaStatus) => {
    const previousOrder = comandas.find(order => order.id === orderId)
    if (!previousOrder || previousOrder.source === 'web' || previousOrder.status === nextStatus) return false
    if (inFlightStatusRef.current.has(orderId)) return false
    if (!canMoveComandaStatus(previousOrder.status, nextStatus)) {
      setStatusError(getInvalidComandaTransitionMessage(previousOrder.status, nextStatus))
      return false
    }

    setStatusError('')
    inFlightStatusRef.current.add(orderId)
    pendingStatusRef.current.set(orderId, nextStatus)
    setUpdatingOrderIds(previous => new Set(previous).add(orderId))
    setComandas(prev =>
      prev.map(c =>
        c.id === orderId
          ? {
              ...c,
              status: nextStatus,
              isRetraso: false,
              deliveredTime: nextStatus === 'delivered' ? new Date().toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit', hour12: true }) : undefined,
            }
          : c
      )
    )

    if (isDemoMode) {
      inFlightStatusRef.current.delete(orderId)
      pendingStatusRef.current.delete(orderId)
      setUpdatingOrderIds(previous => {
        const next = new Set(previous)
        next.delete(orderId)
        return next
      })
      return true
    }

    let persisted = false
    try {
      await updateOrderStatus(orderId, nextStatus)
      persisted = true
      setReloadToken(value => value + 1)
      return true
    } catch (e) {
      console.error('Error actualizando estado en servidor:', e)
      pendingStatusRef.current.delete(orderId)
      setComandas(prev => prev.map(comanda => (
        comanda.id === orderId ? previousOrder : comanda
      )))
      setStatusError(e instanceof Error ? `No se pudo guardar el cambio de estado: ${e.message}` : 'No se pudo guardar el cambio de estado. Intenta nuevamente.')
      return false
    } finally {
      inFlightStatusRef.current.delete(orderId)
      if (!persisted) pendingStatusRef.current.delete(orderId)
      setUpdatingOrderIds(previous => {
        const next = new Set(previous)
        next.delete(orderId)
        return next
      })
    }
  }

  const handleAdvanceStatus = (orderId: string, currentStatus: ComandaStatus) => {
    const order = comandas.find(item => item.id === orderId)
    if (!order || order.status !== currentStatus || updatingOrderIds.has(orderId)) return
    const nextStatus = nextComandaStatus(order.status)
    if (nextStatus) void requestStatusChange(order, nextStatus)
  }

  const requestStatusChange = async (order: ComandaOrder, nextStatus: ComandaStatus) => {
    if (!canMoveComandaStatus(order.status, nextStatus)) {
      setStatusError(getInvalidComandaTransitionMessage(order.status, nextStatus))
      return
    }
    if (nextStatus === 'delivered' && !order.isPaid) {
      const confirmed = await confirmDialog({
        title: 'Entregar comanda sin cobrar',
        message: 'Esta comanda aún no está pagada. Entregarla no la registrará como cuenta por cobrar; solo aparecerá allí si autorizas el método Crédito. ¿Deseas continuar?',
        confirmText: 'Sí, entregar',
      })
      if (!confirmed) return
    }
    await handleSetStatus(order.id, nextStatus)
  }

  // El mouse arrastra de inmediato tras un pequeño umbral. En pantallas
  // táctiles se exige una pulsación breve para no secuestrar el scroll.
  const dndSensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 8 } }),
    useSensor(KeyboardSensor),
  )
  const [draggingOrderId, setDraggingOrderId] = useState<string | null>(null)

  const handleDragStart = (event: DragStartEvent) => {
    setDraggingOrderId(String(event.active.id))
  }

  const handleDragEnd = (event: DragEndEvent) => {
    setDraggingOrderId(null)
    const { active, over } = event
    if (!over) return
    const orderId = String(active.id)
    const targetStatus = String(over.id)
    if (!isComandaStatus(targetStatus)) return
    const order = comandas.find(c => c.id === orderId)
    if (!order || order.status === targetStatus) return
    void requestStatusChange(order, targetStatus)
  }

  const handleDragCancel = () => setDraggingOrderId(null)

  const draggingOrder = draggingOrderId ? comandas.find(c => c.id === draggingOrderId) ?? null : null
  const draggingOrderColor = draggingOrder ? COLUMNS.find(c => c.key === draggingOrder.status)?.color ?? '#ff4d3d' : '#ff4d3d'

  const boardPending = !isDemoMode && loadedBoardKey !== boardKey(dateFilter)
  const totalComandasCount = comandas.length
  const nuevasCount = comandas.filter(c => c.status === 'new').length
  const preparandoCount = comandas.filter(c => c.status === 'preparing').length
  const pendientesCount = nuevasCount + preparandoCount
  const listasCount = comandas.filter(c => c.status === 'ready').length
  const activeComandas = comandas.filter(c => c.status !== 'delivered')
  const avgMins = activeComandas.length > 0
    ? Math.round(activeComandas.reduce((sum, comanda) => sum + comanda.elapsedMins, 0) / activeComandas.length)
    : 0
  const kitchenPulse = boardPending
    ? boardError
      ? { tone: 'busy', label: 'Sin conexión', message: 'No se pudo cargar.' }
      : { tone: 'steady', label: 'Cargando', message: 'Un momento…' }
    : pendientesCount === 0
    ? { tone: 'calm', label: 'Todo bajo control', message: 'Cocina libre.' }
    : pendientesCount >= 8 || avgMins >= 20
      ? { tone: 'critical', label: 'Alta carga', message: 'Prioriza mayor espera.' }
      : pendientesCount >= 4 || avgMins >= 12
        ? { tone: 'busy', label: 'Buen ritmo', message: 'Vigila los tiempos.' }
        : { tone: 'steady', label: 'Flujo estable', message: 'Avanzando a buen ritmo.' }

  return (
    <div className={`comandas-page animate-fade-in ${boardExpanded ? 'is-board-expanded' : ''} ${embeddedOrderId ? 'comandas-page-embedded' : ''}`}>
      <KitchenPulse loading={boardPending} kitchenPulse={kitchenPulse} pendientesCount={boardPending ? 0 : pendientesCount} boardExpanded={boardExpanded} setBoardExpanded={setBoardExpanded} isDemoMode={isDemoMode} setShowHistoryModal={setShowHistoryModal} setShowNewOrderModal={setShowNewOrderModal} totalComandasCount={totalComandasCount} nuevasCount={nuevasCount} preparandoCount={preparandoCount} listasCount={listasCount} avgMins={avgMins} />

      {isDemoMode ? (
        <div className="comandas-demo-banner" role="status">
          <span className="comandas-demo-icon"><Sparkles size={16} /></span>
          <span><strong>Vista demo</strong> · 27 comandas ficticias para revisar el tablero con alta carga.</span>
          <small>No modifica información real</small>
        </div>
      ) : null}

      {showNewOrderModal && createPortal(
        <div className={`cmd-sales-overlay ${closingNewOrder ? 'closing' : ''}`} role="dialog" aria-modal="true" aria-label="Nueva comanda">
          <div className="cmd-sales-modal">
            <div className="cmd-sales-modal-head">
              <div><small>Comandas</small><strong>Nueva venta</strong></div>
              <button type="button" onClick={closeNewOrderModal} aria-label="Cerrar nueva comanda"><X size={20}/></button>
            </div>
            <div className="cmd-sales-modal-body">
              <Caja
                embedded
                onClose={closeNewOrderModal}
                onOrderCreated={() => setReloadToken(token => token + 1)}
              />
            </div>
          </div>
        </div>,
        document.body,
      )}

      {/* Filter Bar */}
      <ComandasFilters filtersBarRef={filtersBarRef} hasActiveFilters={hasActiveFilters} setMobileFiltersOpen={setMobileFiltersOpen} mobileFiltersOpen={mobileFiltersOpen} searchQuery={searchQuery} setSearchQuery={setSearchQuery} dateFilter={dateFilter} setOpenFilterMenu={setOpenFilterMenu} openFilterMenu={openFilterMenu} setDateFilter={setDateFilter} statusFilter={statusFilter} STATUS_FILTER_OPTIONS={STATUS_FILTER_OPTIONS} setStatusFilter={setStatusFilter} orderTypeFilter={orderTypeFilter} ORDER_TYPE_FILTER_OPTIONS={ORDER_TYPE_FILTER_OPTIONS} setOrderTypeFilter={setOrderTypeFilter} clearFilters={clearFilters} />

      {statusError && <div className="command-status-error" role="alert">{statusError}</div>}

      {boardError && (
        <div className="command-status-error command-load-error" role="alert">
          <span>{boardPending ? 'No se pudieron cargar las comandas. Revisa la conexión.' : 'No se pudo actualizar. Estás viendo la última información recibida.'}</span>
          <button type="button" onClick={() => { setBoardError(false); setReloadToken(value => value + 1) }}>Reintentar</button>
        </div>
      )}

      {/* 4 columnas Kanban: el flujo operativo avanza una etapa por movimiento. */}
      <DndContext
        sensors={dndSensors}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
        accessibility={{
          screenReaderInstructions: {
            draggable: 'Para mover una comanda, presiona espacio. Usa las flechas para elegir la siguiente columna y vuelve a presionar espacio para soltarla. Presiona Escape para cancelar.',
          },
        }}
      >
        <div className="kanban-board-grid">
          {COLUMNS.map(col => {
            const colOrders = boardPending ? [] : getOrdersByStatus(col.key)
            const isExpanded = expandedCols[col.key] ?? false
            const visibleOrders = isExpanded ? colOrders : colOrders.slice(0, COLUMN_PREVIEW_LIMIT)
            const hiddenCount = colOrders.length - visibleOrders.length

            return (
              <KanbanColumn
                key={col.key}
                col={col}
                loading={boardPending && !boardError}
                failed={boardPending && boardError}
                colOrders={colOrders}
                visibleOrders={visibleOrders}
                hiddenCount={hiddenCount}
                isExpanded={isExpanded}
                onToggleExpand={() => setExpandedCols(prev => ({ ...prev, [col.key]: !isExpanded }))}
                onOpen={order => { setShowAddItems(false); setSelectedOrder(order) }}
                onAdvance={handleAdvanceStatus}
                onConfirmWeb={handleConfirmWebOrder}
                onPrint={order => printThermalReceipt(thermalReceiptForComanda(order))}
                confirmingWebId={confirmingWebId}
                updatingOrderIds={updatingOrderIds}
              />
            )
          })}
        </div>

        {/* Copia flotante de la tarjeta mientras se arrastra — se renderiza
            fuera de cualquier columna con scroll, así nunca se corta. */}
        <DragOverlay>
          {draggingOrder && (
            <div className={`comanda-card-item card-${draggingOrder.status} ${draggingOrder.isRetraso ? 'has-retraso' : ''} is-dragging`}>
              <ComandaCardContent
                order={draggingOrder}
                color={draggingOrderColor}
                onAdvance={handleAdvanceStatus}
                onConfirmWeb={handleConfirmWebOrder}
                onPrint={order => printThermalReceipt(thermalReceiptForComanda(order))}
                confirmingWebId={confirmingWebId}
                isUpdating={updatingOrderIds.has(draggingOrder.id)}
              />
            </div>
          )}
        </DragOverlay>
      </DndContext>

      {/* Agregar productos a una comanda sin cobrar */}
      {showAddItems && selectedOrder && !selectedOrder.isPaid && (
        <AddItemsToOrderModal
          orderId={selectedOrder.id}
          orderNumber={selectedOrder.orderNumber}
          onClose={() => setShowAddItems(false)}
          onAdded={handleItemsAdded}
        />
      )}

      {/* Modal detail: cabecera con estado, contenido a la izquierda y un panel
          fijo con el total y la única acción principal que toca en ese momento. */}
      {selectedOrder && (() => {
        const order = selectedOrder
        const isWebPending = order.source === 'web'
        const statusSteps: Array<{ key: ComandaStatus; label: string; time?: string }> = [
          { key: 'new', label: 'Nueva', time: order.time },
          { key: 'preparing', label: 'En preparación' },
          { key: 'ready', label: 'Lista' },
          { key: 'delivered', label: 'Entregada', time: order.status === 'delivered' ? order.deliveredTime : undefined },
        ]
        const currentStepIndex = statusSteps.findIndex(step => step.key === order.status)
        const orderTypeIcon = order.orderType === 'Delivery'
          ? <Bike size={14} />
          : order.orderType.startsWith('Mesa') ? <UtensilsCrossed size={14} /> : <ShoppingBag size={14} />
        const visibleNotes = cleanNotes(order.notes)
        const preferredPayment = !order.isPaid ? extractPreferredPayment(order.notes) : null
        const subtotal = (order.totalAmount || 0) - (order.serviceCharge || 0) + (order.discount || 0)
        const hasAdjustments = (order.serviceCharge || 0) > 0 || (order.discount || 0) > 0
        const paidMethodLabels: Record<PaymentMethod, string> = {
          cash: 'Efectivo', mobile: 'Pago móvil', card: 'Tarjeta / Punto', transfer: 'Transferencia', binance: 'Binance', zelle: 'Zelle', other: 'Otro',
          personal_account: 'Cuenta personal',
        }
        const advanceLabel = order.status === 'new'
          ? 'Pasar a preparación'
          : order.status === 'preparing' ? 'Marcar como lista' : 'Marcar como entregada'
        const canAdvance = !isWebPending && order.status !== 'delivered'
        const canCharge = !isWebPending && !order.isPaid && !order.creditAuthorized
        const advanceButton = canAdvance && (
          <button
            type="button"
            className="cmdx-action-primary"
            onClick={() => {
              handleAdvanceStatus(order.id, order.status)
              closeSelectedOrder()
            }}
          >
            <CheckCircle size={18} /> {advanceLabel}
          </button>
        )
        const chargeButton = canCharge && (
          <button type="button" className={canAdvance ? 'cmdx-action-secondary' : 'cmdx-action-primary'} onClick={() => handleOpenPaymentForOrder(order)}>
            <DollarSign size={18} /> Cobrar {formatUsd(order.totalAmount || 0)}
          </button>
        )

        return createPortal(
          <OrderDetailModal closingSelectedOrder={closingSelectedOrder} closeSelectedOrder={closeSelectedOrder} order={order} orderTypeIcon={orderTypeIcon} isWebPending={isWebPending} setDeletePin={setDeletePin} setDeleteError={setDeleteError} setShowDeleteModal={setShowDeleteModal} statusSteps={statusSteps} currentStepIndex={currentStepIndex} openAssociateCustomerModal={openAssociateCustomerModal} isDemoMode={isDemoMode} associatingCustomer={associatingCustomer} deliveryFeeInput={deliveryFeeInput} setDeliveryFeeInput={setDeliveryFeeInput} savingDelivery={savingDelivery} handleSaveDeliveryFee={handleSaveDeliveryFee} orderItemsSectionRef={orderItemsSectionRef} setShowAddItems={setShowAddItems} productImageByName={productImageByName} removingItemId={removingItemId} handleRemoveItem={handleRemoveItem} removeError={removeError} visibleNotes={visibleNotes} hasAdjustments={hasAdjustments} subtotal={subtotal} paidMethodLabels={paidMethodLabels} preferredPayment={preferredPayment} confirmingWebId={confirmingWebId} handleConfirmWebOrder={handleConfirmWebOrder} advanceButton={advanceButton} chargeButton={chargeButton} />,
          document.body
        )
      })()}
      {selectedOrder && showAssociateCustomerModal && createPortal(
        <div className="cmd-modal-overlay cmd-associate-customer-overlay" onClick={() => { if (!associatingCustomer && !creatingAssociateCustomer) setShowAssociateCustomerModal(false) }}>
          <section className="cmd-modal-container cmd-associate-customer-modal" role="dialog" aria-modal="true" aria-labelledby="associate-customer-title" onClick={event => event.stopPropagation()}>
            <header className="cmd-modal-header">
              <div className="cmd-associate-customer-heading">
                {showCreateAssociateCustomer ? <Plus size={19} /> : <UserPlus size={19} />}
                <div>
                  <h2 id="associate-customer-title">{showCreateAssociateCustomer ? 'Crear cliente' : 'Asociar cliente'}</h2>
                  <small>Comanda {selectedOrder.orderNumber}</small>
                </div>
              </div>
              <button type="button" className="cmd-close-btn" aria-label="Cerrar asociar cliente" onClick={() => setShowAssociateCustomerModal(false)} disabled={associatingCustomer || creatingAssociateCustomer}><X size={18} /></button>
            </header>
            <div className="cmd-associate-customer-content">
              {!showCreateAssociateCustomer && <label className="cmd-associate-customer-search">
                <Search size={16} />
                <input type="search" autoFocus placeholder="Buscar por nombre, teléfono o cédula" value={associateCustomerSearch} onChange={event => setAssociateCustomerSearch(event.target.value)} />
              </label>}
              {associateCustomerError && <p className="cmd-associate-customer-error" role="alert">{associateCustomerError}</p>}
              {showCreateAssociateCustomer ? (
                <form className="cmd-associate-customer-form" onSubmit={event => void handleCreateAndAssociateCustomer(event)}>
                  <button type="button" className="cmd-associate-customer-back" onClick={() => { setShowCreateAssociateCustomer(false); setAssociateCustomerError('') }} disabled={creatingAssociateCustomer}>
                    <ChevronLeft size={15} /> Volver a elegir un cliente
                  </button>
                  <label><span>Nombre completo <b>*</b></span><input autoFocus required maxLength={120} autoComplete="name" value={newAssociateCustomerName} onChange={event => setNewAssociateCustomerName(event.target.value)} placeholder="Nombre y apellido" /></label>
                  <label><span>Teléfono <small>(opcional)</small></span><input type="tel" autoComplete="tel" maxLength={32} value={newAssociateCustomerPhone} onChange={event => setNewAssociateCustomerPhone(event.target.value)} placeholder="Ej. 0412 123 4567" /></label>
                  <label><span>Cédula <small>(opcional)</small></span><input maxLength={32} value={newAssociateCustomerIdentification} onChange={event => setNewAssociateCustomerIdentification(event.target.value)} placeholder="V-12345678" /></label>
                  <label><span>Dirección <small>(opcional)</small></span><input autoComplete="street-address" maxLength={240} value={newAssociateCustomerAddress} onChange={event => setNewAssociateCustomerAddress(event.target.value)} placeholder="Dirección del cliente" /></label>
                  <div className="cmd-associate-customer-form-actions">
                    <button type="button" className="cmd-btn-secondary" onClick={() => { setShowCreateAssociateCustomer(false); setAssociateCustomerError('') }} disabled={creatingAssociateCustomer}>Cancelar</button>
                    <button type="submit" className="cmd-btn-primary" disabled={creatingAssociateCustomer || associatingCustomer}><UserPlus size={15} /> {creatingAssociateCustomer ? 'Creando y asociando…' : 'Crear y asociar'}</button>
                  </div>
                </form>
              ) : (
                <>
                  <button type="button" className="cmd-associate-customer-create" onClick={() => { setShowCreateAssociateCustomer(true); setAssociateCustomerError('') }} disabled={associatingCustomer || creatingAssociateCustomer}>
                    <Plus size={16} /> Crear cliente nuevo
                  </button>
                  <div className="cmd-associate-customer-list">
                    {loadingAssociateCustomers ? <LoadingSkeleton className="cmd-associate-customer-loading" label="Cargando clientes" count={6} withAvatar />
                      : filteredAssociateCustomers.length === 0 ? <p className="cmd-associate-customer-empty">{associateCustomerSearch ? 'No hay coincidencias.' : 'No hay clientes activos para asociar.'}</p>
                        : filteredAssociateCustomers.map(customer => (
                          <button type="button" className="cmd-associate-customer-option" key={customer.id} onClick={() => void handleAssociateCustomer(customer)} disabled={associatingCustomer || creatingAssociateCustomer}>
                            <span className="cmd-associate-customer-avatar">{getInitials(customer.name)}</span>
                            <span className="cmd-associate-customer-option-info"><strong>{customer.name}</strong><small>{[customer.phone, customer.identification].filter(Boolean).join(' · ') || 'Sin teléfono ni cédula'}</small></span>
                            <UserPlus size={15} />
                          </button>
                        ))}
                  </div>
                </>
              )}
            </div>
          </section>
        </div>,
        document.body
      )}
      {/* Modal PIN para eliminar comanda */}
      {showDeleteModal && createPortal(
        <div className={`cmd-modal-overlay ${closingDelete ? 'closing' : ''}`} onClick={() => closeDeleteModal()}>
          <div className="cmd-pin-modal animate-pop" role="alertdialog" aria-modal="true" aria-labelledby="cmd-delete-dialog-title" onClick={e => e.stopPropagation()}>
            <div className="cmd-pin-header">
              <ShieldCheck size={24} className="cmd-pin-icon" />
              <h3 id="cmd-delete-dialog-title">Autorización requerida</h3>
            </div>
            <p className="cmd-pin-text">Ingresa tu PIN para eliminar la comanda <strong className="cmd-pin-order-no">{selectedOrder?.orderNumber}</strong></p>
            <p className="cmd-pin-text">Si ya estaba cobrada o entregada, se eliminarán sus pagos de caja y se revertirá el inventario. Esta acción no se puede deshacer.</p>
            <input
              key={deletePin}
              type="password"
              inputMode="text"
              pattern="[0-9*#]{4,}"
              className="cmd-pin-input"
              placeholder="PIN"
              minLength={4}
              autoComplete="new-password"
              value={deletePin}
              onChange={e => { setDeletePin(e.target.value.replace(/[^0-9*#]/g, '')); setDeleteError('') }}
              onKeyDown={e => { if (e.key === 'Enter') handleDeleteOrder() }}
              autoFocus
            />
            {deleteError && <p className="cmd-pin-error">{deleteError}</p>}
            <div className="cmd-pin-actions">
              <button className="cmd-btn-secondary" onClick={() => closeDeleteModal()}>Cancelar</button>
              <button className="cmd-btn-danger" onClick={handleDeleteOrder} disabled={deleting || deletePin.length < 4}>
                <Trash2 size={16} /> {deleting ? 'Eliminando…' : 'Eliminar comanda'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
      {/* Modal Cobrar Pedido Directo desde Comandas */}
      {showPaymentModal && paymentOrder && (
        <PaymentModal
          form={paymentForm}
          closingPayment={closingPayment}
          paymentOrder={paymentOrder}
          paymentRate={paymentRate}
          paymentDue={paymentDue}
          splitPrimaryAmountUsd={splitPrimaryAmountUsd}
          splitSecondaryAmountUsd={splitSecondaryAmountUsd}
          syncSplitFromPrimary={syncSplitFromPrimary}
          syncSplitFromSecondary={syncSplitFromSecondary}
          handleSelectPaymentTab={handleSelectPaymentTab}
          handleConfirmOrderPayment={handleConfirmOrderPayment}
          closePaymentModal={closePaymentModal}
        />
      )}
      {/* Modal Historial de Comandas */}
      {showHistoryModal && createPortal(
        <HistoryModal closingHistory={closingHistory} closeHistoryModal={closeHistoryModal} historyLoading={historyLoading} filteredHistoryOrders={filteredHistoryOrders} historySearch={historySearch} setHistorySearch={setHistorySearch} setHistorySelectedDate={setHistorySelectedDate} setHistoryMonthCursor={setHistoryMonthCursor} Date={Date} historyMonthCursor={historyMonthCursor} canGoNextMonth={canGoNextMonth} historySelectedDate={historySelectedDate} handleHistoryDateChange={handleHistoryDateChange} clearHistoryDate={clearHistoryDate} historyYearMenuRef={historyYearMenuRef} setShowHistoryYearMenu={setShowHistoryYearMenu} showHistoryYearMenu={showHistoryYearMenu} Array={Array} historyWeeksRef={historyWeeksRef} historyWeeksInMonth={historyWeeksInMonth} historyWeekStartKey={historyWeekStartKey} setHistoryWeekStartKey={setHistoryWeekStartKey} historyFilter={historyFilter} setHistoryFilter={setHistoryFilter} historyGroups={historyGroups} setSelectedOrder={setSelectedOrder} />,
        document.body
      )}
      {printReceiptPrompt && (
        <PrintChoiceDialog
          documentName="el recibo de venta"
          onPrint={() => { printThermalReceipt(printReceiptPrompt); setPrintReceiptPrompt(null) }}
          onSkip={() => setPrintReceiptPrompt(null)}
        />
      )}
    </div>
  )
}
