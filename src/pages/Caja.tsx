import { useState, useMemo, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/auth-context'
import { downloadReceipt } from '../lib/receipt'
import { getExchangeRates } from '../lib/rates'
import {
  getProducts,
  getTodayOrders,
  checkout,
  sendToKitchen,
  type Product,
  type CartItem,
  type OrderResult,
  type TodayOrder,
  type PaymentMethod,
} from '../lib/dataService'
import {
  X,
  Printer,
  CheckCircle,
  QrCode,
  ShieldCheck,
  Share2,
  ListOrdered,
  ChefHat,
  BellRing,
  Phone
} from 'lucide-react'
import './Caja.css'

type ViewMode = 'grid' | 'list'
type OrderType = 'dine-in' | 'takeaway' | 'delivery'

const CATEGORY_LABELS: Record<string, string> = {
  arroz: 'Arroces',
  noodles: 'Noodles',
  lumpia: 'Lumpias',
  combo: 'Combos',
  proteina: 'Proteínas',
  bebida: 'Bebidas',
  extra: 'Extras',
  plato: 'Platos',
  wok: 'Wok',
  pollo_camaron: 'Pollo y Camarón',
  racion: 'Raciones',
}
const CATEGORY_ORDER = ['arroz', 'noodles', 'lumpia', 'combo', 'proteina', 'bebida', 'extra', 'plato', 'wok', 'pollo_camaron', 'racion']

const ORDER_TYPE_LABELS: Record<OrderType, { label: string; icon: string }> = {
  'dine-in': { label: 'Mostrador', icon: '🪑' },
  takeaway: { label: 'Para llevar', icon: '🛍️' },
  delivery: { label: 'Delivery', icon: '🛵' },
}

const PAYMENT_METHODS: Array<{ method: PaymentMethod | 'split'; label: string; icon: string }> = [
  { method: 'cash', label: 'Efectivo', icon: '💵' },
  { method: 'card', label: 'Pago móvil', icon: '📱' },
  { method: 'other', label: 'Punto', icon: '💳' },
  { method: 'transfer', label: 'Transferencia', icon: '🏦' },
  { method: 'split', label: 'Pago combinado', icon: '🔀' },
]

const SERVICE_FEE_RATE = 0.05

const FOOD_IMAGES: Record<string, string> = {
  arroz: 'https://images.unsplash.com/photo-1603133872878-684f208fb84b?auto=format&fit=crop&w=600&q=80',
  noodles: 'https://images.unsplash.com/photo-1569718212165-3a8278d5f624?auto=format&fit=crop&w=600&q=80',
  lumpia: 'https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=600&q=80',
  combo: 'https://images.unsplash.com/photo-1541544741938-0af808871cc0?auto=format&fit=crop&w=600&q=80',
  proteina: 'https://images.unsplash.com/photo-1525755662778-989d0524087e?auto=format&fit=crop&w=600&q=80',
  bebida: 'https://images.unsplash.com/photo-1622483767028-3f66f32aef97?auto=format&fit=crop&w=600&q=80',
  extra: 'https://images.unsplash.com/photo-1565557623262-b51c2513a641?auto=format&fit=crop&w=600&q=80',
  default: 'https://images.unsplash.com/photo-1541544741938-0af808871cc0?auto=format&fit=crop&w=600&q=80'
}

function getProductImage(product: Product): string {
  const nameLower = product.name.toLowerCase()
  if (nameLower.includes('chaufa') || nameLower.includes('arroz')) return FOOD_IMAGES.arroz
  if (nameLower.includes('chow mein') || nameLower.includes('noodle')) return FOOD_IMAGES.noodles
  if (nameLower.includes('lumpia')) return FOOD_IMAGES.lumpia
  if (nameLower.includes('agridulce') || nameLower.includes('pollo')) return FOOD_IMAGES.proteina
  if (nameLower.includes('camaron') || nameLower.includes('camarón')) return FOOD_IMAGES.extra
  if (nameLower.includes('refresco') || nameLower.includes('agua') || nameLower.includes('bebida')) return FOOD_IMAGES.bebida
  return FOOD_IMAGES[product.category] || FOOD_IMAGES.default
}

// Cache a nivel de módulo: al volver a Ventas se muestra el catálogo de la
// última visita al instante, sin el parpadeo de "Cargando...", mientras se
// refresca en segundo plano.
let cajaCache: {
  products: Product[]
  todayOrders: TodayOrder[]
  bcvRate: number | null
} | null = null

interface CustomerOption {
  id: string
  name: string
  initials: string
  phone: string
}

const MOCK_CUSTOMERS_LIST: CustomerOption[] = [
  { id: 'c0', name: 'Wai Harrington', initials: 'WH', phone: '0412-8001234' },
  { id: 'c1', name: 'Juan Pérez', initials: 'JP', phone: '0412-9206984' },
  { id: 'c2', name: 'María González', initials: 'MG', phone: '0414-1234567' },
  { id: 'c3', name: 'Pedro Ramírez', initials: 'PR', phone: '0424-7654321' },
  { id: 'c4', name: 'Sofía Lima', initials: 'SL', phone: '0416-5558899' },
  { id: 'c5', name: 'Camila Rojas', initials: 'CR', phone: '0412-3334455' },
  { id: 'c6', name: 'Diego Herrera', initials: 'DH', phone: '0424-9990011' },
  { id: 'c7', name: 'Valeria Torres', initials: 'VT', phone: '0414-8882233' },
  { id: 'c8', name: 'Ricardo Méndez', initials: 'RM', phone: '0416-7771122' },
]

export function Caja() {
  const { user } = useAuth()
  const navigate = useNavigate()

  const [products, setProducts] = useState<Product[]>(cajaCache?.products ?? [])
  const [todayOrders, setTodayOrders] = useState<TodayOrder[]>(cajaCache?.todayOrders ?? [])
  const [bcvRate, setBcvRate] = useState<number | null>(cajaCache?.bcvRate ?? null)
  const [, setLoading] = useState(!cajaCache)

  const [cart, setCart] = useState<CartItem[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [activeCategory, setActiveCategory] = useState<string>('arroz')
  const [viewMode, setViewMode] = useState<ViewMode>('grid')
  const [sortBy, setSortBy] = useState<'popular' | 'price' | 'name'>('popular')

  const [orderType, setOrderType] = useState<OrderType>('dine-in')
  const [customerName, setCustomerName] = useState('')
  const [orderNotes, setOrderNotes] = useState('')
  const [discount, setDiscount] = useState(0)

  // Customer Search & Auto-complete state
  const [customerList, setCustomerList] = useState<CustomerOption[]>(MOCK_CUSTOMERS_LIST)
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false)

  // New Client Modal state
  const [showNewClientModal, setShowNewClientModal] = useState(false)
  const [newClientName, setNewClientName] = useState('')
  const [newClientLastName, setNewClientLastName] = useState('')
  const [newClientPhone, setNewClientPhone] = useState('')
  const [birthMonth, setBirthMonth] = useState('')
  const [birthDay, setBirthDay] = useState('')

  const filteredCustomers = useMemo(() => {
    if (!customerName.trim()) return customerList
    return customerList.filter(c =>
      c.name.toLowerCase().includes(customerName.toLowerCase()) ||
      c.phone.includes(customerName)
    )
  }, [customerList, customerName])

  const handleCreateNewClientFromCaja = (e: React.FormEvent) => {
    e.preventDefault()
    if (!newClientName.trim()) return

    const fullName = `${newClientName.trim()} ${newClientLastName.trim()}`.trim()
    const initials = (newClientName[0] + (newClientLastName[0] || '')).toUpperCase()
    const phone = newClientPhone.trim() || '0412-9206984'

    const newCust: CustomerOption = {
      id: `c_${Date.now()}`,
      name: fullName,
      initials,
      phone,
    }

    setCustomerList(prev => [newCust, ...prev])
    setCustomerName(fullName)
    setShowCustomerDropdown(false)
    setShowNewClientModal(false)
    setNewClientName('')
    setNewClientLastName('')
    setNewClientPhone('')
    setBirthMonth('')
    setBirthDay('')
  }

  // Payment Modal State (Matching Image 1)
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [selectedPaymentTab, setSelectedPaymentTab] = useState<PaymentMethod | 'split'>('card')
  const [refNumber, setRefNumber] = useState('876543210')
  const [amountReceived, setAmountReceived] = useState('300.00')
  const [paymentNote, setPaymentNote] = useState('')

  const [paying, setPaying] = useState(false)
  const [payError, setPayError] = useState('')
  const [currentOrder, setCurrentOrder] = useState<OrderResult | null>(null)
  const [showConfirmation, setShowConfirmation] = useState(false)

  const refreshTodayOrders = useCallback(async () => {
    try {
      setTodayOrders(await getTodayOrders())
    } catch (e) {
      console.error('Error:', e)
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true)
      try {
        const [prods, orders] = await Promise.all([
          getProducts().catch((e) => { console.error('getProducts error:', e); return [] as Product[] }),
          getTodayOrders().catch((e) => { console.error('getTodayOrders error:', e); return [] as TodayOrder[] }),
        ])
        if (cancelled) return
        setProducts(prods)
        setTodayOrders(orders)
        cajaCache = { products: prods, todayOrders: orders, bcvRate: cajaCache?.bcvRate ?? null }
        getExchangeRates().then((rates) => {
          if (cancelled) return
          const bcv = rates.bcv > 0 ? rates.bcv : null
          setBcvRate(bcv)
          if (cajaCache) cajaCache.bcvRate = bcv
        }).catch(() => {})
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [])

  const categories = useMemo(() => {
    const present = new Set(products.map((p) => p.category))
    return CATEGORY_ORDER.filter((c) => present.has(c))
  }, [products])

  const filteredProducts = useMemo(() => {
    let result = products.filter((p) => {
      const matchSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase())
      const matchCat = activeCategory === 'all' || p.category === activeCategory
      return matchSearch && matchCat && p.active
    })
    if (sortBy === 'price') result = [...result].sort((a, b) => a.price - b.price)
    else if (sortBy === 'name') result = [...result].sort((a, b) => a.name.localeCompare(b.name))
    return result
  }, [products, searchTerm, activeCategory, sortBy])

  const addToCart = (product: Product) => {
    setCart((prev) => {
      const existing = prev.find((i) => i.productId === product.id)
      if (existing) return prev.map((i) => i.productId === product.id ? { ...i, quantity: i.quantity + 1 } : i)
      return [...prev, { productId: product.id, productName: product.name, price: product.price, quantity: 1, emoji: product.emoji }]
    })
  }

  const updateQty = (productId: string, delta: number) => {
    setCart((prev) => prev.map((i) => i.productId === productId ? { ...i, quantity: i.quantity + delta } : i).filter((i) => i.quantity > 0))
  }

  const removeFromCart = (productId: string) => {
    setCart((prev) => prev.filter((i) => i.productId !== productId))
  }

  const subtotal = cart.reduce((s, i) => s + i.price * i.quantity, 0)
  const serviceFee = subtotal * SERVICE_FEE_RATE
  const total = subtotal + serviceFee - discount

  // Action 1: Enviar a Cocina -> Saves order WITHOUT payment and navigates to /comandas
  const handleSendToKitchen = async () => {
    if (cart.length === 0) return
    setPaying(true)
    setPayError('')
    try {
      const order = await sendToKitchen({
        items: cart,
        bcvRate,
        userId: user?.id || 'demo-user',
        notes: orderNotes || null,
        orderType,
        customerName: customerName || 'Cliente general',
      })
      setCurrentOrder(order)
      setCart([])
      setCustomerName('')
      setOrderNotes('')
      setDiscount(0)
      refreshTodayOrders()
      // Navigate directly to Comandas page
      navigate('/comandas')
    } catch (e) {
      setPayError(e instanceof Error ? e.message : 'Error al enviar a cocina')
    } finally {
      setPaying(false)
    }
  }

  // Open Payment Modal (Image 1)
  const handleOpenPaymentModal = () => {
    if (cart.length === 0) return
    setShowPaymentModal(true)
  }

  // Confirm Payment in Modal -> Triggers Confirmation Screen (Image 2)
  const handleConfirmPayment = async () => {
    setPaying(true)
    setPayError('')
    try {
      const finalMethod: PaymentMethod = selectedPaymentTab === 'split' ? 'card' : selectedPaymentTab
      const order = await checkout({
        items: cart,
        method: finalMethod,
        bcvRate,
        userId: user?.id || 'demo-user',
        notes: orderNotes || null,
        orderType,
        customerName: customerName || 'Cliente general',
      })
      setCurrentOrder(order)
      setShowPaymentModal(false)
      setShowConfirmation(true)
      refreshTodayOrders()
    } catch (e) {
      setPayError(e instanceof Error ? e.message : 'Error al confirmar pago')
    } finally {
      setPaying(false)
    }
  }

  const handlePrintReceipt = () => {
    if (currentOrder) {
      downloadReceipt({
        orderId: `FC-${String(currentOrder.orderNumber).padStart(6, '0')}`,
        items: currentOrder.items,
        total: currentOrder.total,
        paymentMethod: currentOrder.paymentMethod,
        createdAt: currentOrder.createdAt,
      })
    }
  }

  // Image 2 Target: Confirmation Screen "¡Pedido cobrado con éxito!"
  if (showConfirmation && currentOrder) {
    const orderNo = `#FC-${String(currentOrder.orderNumber).padStart(6, '0')}`
    const formattedDate = new Date(currentOrder.createdAt).toLocaleDateString('es-VE', { day: '2-digit', month: '2-digit', year: 'numeric' })
    const formattedTime = new Date(currentOrder.createdAt).toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit' })

    return (
      <div className="page animate-fade-in">
        <div className="caja-success-layout">
          {/* LEFT COLUMN: Success Hero Card + Timeline */}
          <div className="success-left-col">
            {/* Confetti Hero Card */}
            <div className="success-hero-card">
              <div className="confetti-dots-bg" />
              <div className="big-check-circle">
                <CheckCircle size={44} className="check-icon-glow" />
              </div>
              <h1 className="success-hero-title">¡Pedido cobrado con éxito!</h1>
              <p className="success-hero-sub">Gracias por tu venta. El pedido ha sido enviado a cocina.</p>

              {/* 3 Metrics Row */}
              <div className="success-metrics-row">
                <div className="metric-box">
                  <span className="metric-box-label">Número de pedido</span>
                  <span className="metric-box-val text-red">{orderNo}</span>
                </div>
                <div className="metric-box">
                  <span className="metric-box-label">Total</span>
                  <span className="metric-box-val">${currentOrder.total.toFixed(2)}</span>
                </div>
                <div className="metric-box">
                  <span className="metric-box-label">Método de pago</span>
                  <span className="metric-box-val font-bold">Pago combinado</span>
                </div>
              </div>

              {/* Status Badges */}
              <div className="success-status-badges-row">
                <span className="badge-status green">🟢 Pagado</span>
                <span className="badge-status gold">👨‍🍳 Enviado a cocina</span>
              </div>
            </div>

            {/* Action Buttons Bar */}
            <div className="success-actions-bar mt-4">
              <button
                className="btn-success-primary"
                onClick={() => { setShowConfirmation(false); setCart([]); setCurrentOrder(null) }}
              >
                <span>+</span> Nueva venta
              </button>
              <button className="btn-success-secondary" onClick={() => navigate('/comandas')}>
                <ListOrdered size={16} /> Ver comanda
              </button>
              <button className="btn-success-secondary" onClick={handlePrintReceipt}>
                <Printer size={16} /> Imprimir recibo
              </button>
              <button className="btn-success-secondary">
                <Share2 size={16} /> Compartir comprobante
              </button>
            </div>

            {/* Timeline Card */}
            <div className="activity-timeline-card mt-4">
              <h3 className="timeline-card-title">Actividad del pedido</h3>

              <div className="timeline-steps-wrap">
                <div className="timeline-line-bg" />

                <div className="timeline-step active">
                  <div className="step-icon-circle">
                    <CheckCircle size={16} />
                  </div>
                  <div className="step-info">
                    <span className="step-title">Pago confirmado</span>
                    <span className="step-time">{formattedTime}</span>
                    <span className="step-desc">El pago ha sido procesado correctamente.</span>
                  </div>
                </div>

                <div className="timeline-step active">
                  <div className="step-icon-circle">
                    <ChefHat size={16} />
                  </div>
                  <div className="step-info">
                    <span className="step-title">Comanda enviada</span>
                    <span className="step-time">{formattedTime}</span>
                    <span className="step-desc">La comanda ha sido enviada a cocina.</span>
                  </div>
                </div>

                <div className="timeline-step active">
                  <div className="step-icon-circle">
                    <BellRing size={16} />
                  </div>
                  <div className="step-info">
                    <span className="step-title">Cocina notificada</span>
                    <span className="step-time">{formattedTime}</span>
                    <span className="step-desc">El equipo de cocina ha sido notificado del pedido.</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* RIGHT COLUMN: Ticket Receipt Card */}
          <div className="success-right-col">
            <div className="ticket-receipt-card">
              <div className="ticket-header-logo">
                <span className="ticket-logo-icon">🔥</span>
                <span className="ticket-logo-text">FULL CHINA</span>
                <span className="ticket-sub-title">Comprobante de venta</span>
              </div>

              <div className="ticket-dashed-line" />

              <div className="ticket-meta-row">
                <span>Pedido: <strong className="text-red">{orderNo}</strong></span>
                <span>{formattedDate} {formattedTime}</span>
              </div>
              <div className="ticket-meta-row">
                <span>Mesa: Mostrador</span>
                <span>Atendido por: Admin</span>
              </div>

              <div className="ticket-dashed-line" />

              <div className="ticket-items-list">
                {currentOrder.items.map((item, idx) => {
                  const prod = products.find(p => p.id === item.productId)
                  const imgUrl = prod ? getProductImage(prod) : FOOD_IMAGES.default

                  return (
                    <div key={idx} className="ticket-item-row">
                      <img src={imgUrl} alt={item.productName} className="ticket-item-thumb" />
                      <div className="ticket-item-info">
                        <span className="ticket-item-name">{item.productName}</span>
                        <span className="ticket-item-sub">Sin cebollín</span>
                      </div>
                      <span className="ticket-item-price">${(item.price * item.quantity).toFixed(2)}</span>
                    </div>
                  )
                })}
              </div>

              <div className="ticket-dashed-line" />

              <div className="ticket-totals-list">
                <div className="ticket-total-line">
                  <span>Subtotal</span>
                  <span>${subtotal.toFixed(2)}</span>
                </div>
                <div className="ticket-total-line">
                  <span>Cargo por servicio (5%) ℹ️</span>
                  <span>${serviceFee.toFixed(2)}</span>
                </div>
                <div className="ticket-total-line">
                  <span>Descuento</span>
                  <span>$0.00</span>
                </div>
              </div>

              <div className="ticket-total-final-row">
                <span className="ticket-final-label">Total</span>
                <span className="ticket-final-val">${currentOrder.total.toFixed(2)}</span>
              </div>

              <div className="ticket-payment-method">
                <span>Método de pago:</span>
                <span className="font-bold">💳 Pago combinado</span>
              </div>

              <div className="ticket-footer-text">
                ¡Gracias por su preferencia!
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="page animate-fade-in">
      <div className="caja-layout">
        {/* LEFT: Products */}
        <div className="products-section">
          {/* Hero Wok Flame Banner */}
          <div className="caja-hero-banner">
            <div className="hero-banner-left">
              <div className="hero-cart-icon">🛒</div>
              <div>
                <h1 className="hero-title">Nueva venta</h1>
                <p className="hero-subtitle">Crea pedidos, cobra y envía a cocina.</p>
              </div>
            </div>
            <div className="hero-banner-right">
              <div className="hero-overlay-text">
                <span className="hero-tagline">Sabor que prende,</span>
                <span className="hero-tagline-bold">experiencia que deja huella.</span>
              </div>
            </div>
          </div>

          {/* Category Tabs */}
          <div className="category-tabs">
            <button
              className={`category-tab ${activeCategory === 'all' ? 'active' : ''}`}
              onClick={() => setActiveCategory('all')}
            >
              Todos
            </button>
            {categories.map((cat) => (
              <button
                key={cat}
                className={`category-tab ${activeCategory === cat ? 'active' : ''}`}
                onClick={() => setActiveCategory(cat)}
              >
                {CATEGORY_LABELS[cat] ?? cat}
              </button>
            ))}
          </div>

          {/* Toolbar */}
          <div className="products-toolbar">
            <div className="search-box">
              <span className="search-icon">🔍</span>
              <input
                type="text"
                placeholder="Buscar en el menú..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="search-input-caja"
              />
            </div>
            <button className="filter-btn">⚙️ Filtros</button>
            <select
              className="sort-select"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
            >
              <option value="popular">Más vendidos</option>
              <option value="price">Precio</option>
              <option value="name">Nombre</option>
            </select>
            <div className="view-toggle">
              <button className={`view-btn ${viewMode === 'grid' ? 'active' : ''}`} onClick={() => setViewMode('grid')}>▦</button>
              <button className={`view-btn ${viewMode === 'list' ? 'active' : ''}`} onClick={() => setViewMode('list')}>☰</button>
            </div>
          </div>

          {/* Products Grid */}
          <div className={`products-container ${viewMode}`}>
            {filteredProducts.length === 0 ? (
              <p className="empty-message">No hay productos en esta categoría</p>
            ) : (
              filteredProducts.map((product, index) => {
                const imgUrl = getProductImage(product)
                const isPopular = index === 0 || product.name.toLowerCase().includes('chaufa') || product.name.toLowerCase().includes('especial')
                const isLowStock = product.name.toLowerCase().includes('camaron') || product.name.toLowerCase().includes('camarón')

                return (
                  <div key={product.id} className={`product-card ${viewMode}`} onClick={() => addToCart(product)}>
                    <div className="product-image-area" style={{ backgroundImage: `url(${imgUrl})` }}>
                      {isPopular && <span className="product-badge badge-popular">🔥 Más vendido</span>}
                      {isLowStock && <span className="product-badge badge-low-stock">⚠️ Pocas piezas</span>}
                      <button
                        className="product-quick-add-btn"
                        onClick={(e) => { e.stopPropagation(); addToCart(product) }}
                        title="Agregar al pedido"
                      >
                        +
                      </button>
                    </div>
                    <div className="product-card-body">
                      <h3 className="product-card-title">{product.name}</h3>
                      <div className="product-card-meta">
                        <span className="product-card-price">${product.price.toFixed(2)}</span>
                        <span className={`product-stock-status ${isLowStock ? 'low-stock' : 'in-stock'}`}>
                          <span className="stock-dot" /> {isLowStock ? 'Pocas piezas' : 'En stock'}
                        </span>
                      </div>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>

        {/* RIGHT: Cart Sidebar */}
        <div className="cart-sidebar">
          <div className="cart-sidebar-header">
            <div className="cart-order-title-group">
              <h3 className="cart-order-title">
                Pedido <span className="cart-order-number">#FC-{String(todayOrders.length + 125).padStart(6, '0')}</span>
              </h3>
              <div className="cart-header-badges">
                <span className="cart-badge-type">Mostrador</span>
                <span className="cart-time">12:45 PM</span>
              </div>
            </div>
            <button className="cart-edit-btn">✏️ Editar</button>
          </div>

          {/* Cart Items */}
          {cart.length === 0 ? (
            <div className="empty-cart-sidebar">
              <span className="empty-cart-icon">🛒</span>
              <p>Selecciona productos del menú</p>
            </div>
          ) : (
            <div className="cart-items-list">
              {cart.map((item) => {
                const prod = products.find(p => p.id === item.productId)
                const imgUrl = prod ? getProductImage(prod) : FOOD_IMAGES.default

                return (
                  <div key={item.productId} className="cart-item-row">
                    <img src={imgUrl} alt={item.productName} className="cart-item-thumb" />
                    <div className="cart-item-details">
                      <span className="cart-item-name">{item.productName}</span>
                      <span className="cart-item-sub">Sin cebollín</span>
                    </div>
                    <div className="cart-item-controls">
                      <button className="qty-btn-sm" onClick={() => updateQty(item.productId, -1)}>−</button>
                      <span className="qty-display">{item.quantity}</span>
                      <button className="qty-btn-sm" onClick={() => updateQty(item.productId, 1)}>+</button>
                    </div>
                    <span className="cart-item-price">${(item.price * item.quantity).toFixed(2)}</span>
                    <button className="cart-item-remove" onClick={() => removeFromCart(item.productId)}>✕</button>
                  </div>
                )
              })}
            </div>
          )}

          {/* Notes */}
          <div className="cart-field mt-3">
            <div className="notes-wrap">
              <span className="notes-icon">📝</span>
              <input
                type="text"
                className="cart-notes"
                placeholder="Notas del pedido (opcional)..."
                value={orderNotes}
                onChange={(e) => setOrderNotes(e.target.value.slice(0, 120))}
              />
              <span className="notes-counter">{orderNotes.length}/120</span>
            </div>
          </div>

          {/* Customer + Order Type */}
          <div className="cart-section-group mt-3">
            <div className="cart-field-col customer-input-col">
              <label className="cart-label">Cliente</label>
              <div className="customer-input-wrap">
                <span className="input-search-icon">🔍</span>
                <input
                  type="text"
                  placeholder="Buscar cliente (opcional)"
                  value={customerName}
                  onChange={(e) => {
                    setCustomerName(e.target.value)
                    setShowCustomerDropdown(true)
                  }}
                  onFocus={() => setShowCustomerDropdown(true)}
                  className="customer-input"
                />
                <button
                  type="button"
                  className="customer-add-btn"
                  onClick={() => setShowNewClientModal(true)}
                  title="Nuevo cliente"
                >
                  +
                </button>
              </div>

              {/* Autocomplete Dropdown List */}
              {showCustomerDropdown && filteredCustomers.length > 0 && (
                <div className="customer-dropdown-menu">
                  {filteredCustomers.map((cust) => (
                    <div
                      key={cust.id}
                      className="customer-dropdown-item"
                      onClick={() => {
                        setCustomerName(cust.name)
                        setShowCustomerDropdown(false)
                      }}
                    >
                      <div className="customer-item-avatar">{cust.initials}</div>
                      <div className="customer-item-info">
                        <span className="customer-item-name">{cust.name}</span>
                        <span className="customer-item-phone">{cust.phone}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="cart-field-col mt-2">
              <label className="cart-label">Tipo de pedido</label>
              <div className="order-type-buttons">
                {(Object.entries(ORDER_TYPE_LABELS) as Array<[OrderType, { label: string; icon: string }]>).map(([key, val]) => (
                  <button
                    key={key}
                    className={`order-type-card ${orderType === key ? 'active' : ''}`}
                    onClick={() => setOrderType(key)}
                  >
                    <span className="order-type-icon">{val.icon}</span>
                    <span className="order-type-text">{val.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Totals Breakdown */}
          <div className="cart-totals-card mt-3">
            <div className="cart-total-row">
              <span className="total-label">Subtotal</span>
              <span className="total-val">${subtotal.toFixed(2)}</span>
            </div>
            <div className="cart-total-row">
              <span className="total-label">Cargo por servicio (5%) ℹ️</span>
              <span className="total-val">${serviceFee.toFixed(2)}</span>
            </div>
            <div className="cart-total-row">
              <span className="total-label">Descuento</span>
              <button className="discount-link" onClick={() => setDiscount(prompt('Descuento ($):') ? Number(prompt('Descuento ($):')) || 0 : 0)}>
                Aplicar descuento
              </button>
              <span className="total-val">{discount > 0 ? `-$${discount.toFixed(2)}` : '$0.00'}</span>
            </div>
            <div className="cart-divide-row">
              <button className="divide-payment-link">🔀 Dividir pago</button>
            </div>
            <div className="cart-total-row total-final-row">
              <span className="final-label">Total</span>
              <span className="final-amount">${total.toFixed(2)}</span>
            </div>
          </div>

          {payError && <p className="pay-error">{payError}</p>}

          {/* Action buttons */}
          <div className="cart-action-buttons mt-3">
            <button
              className="btn-pay-red"
              disabled={cart.length === 0 || paying}
              onClick={handleOpenPaymentModal}
            >
              <span>💲</span> Cobrar pedido
            </button>
            <button
              className="btn-kitchen-red"
              disabled={cart.length === 0 || paying}
              onClick={handleSendToKitchen}
            >
              <span>🔥</span> Enviar a cocina
            </button>
          </div>

          {/* Accepted Payment Methods at bottom */}
          <div className="payment-accepted-section mt-3">
            <span className="accepted-title">Formas de pago aceptadas</span>
            <div className="payment-badges-row">
              {PAYMENT_METHODS.map((pm) => (
                <span key={pm.method} className="payment-badge-pill">
                  {pm.icon} {pm.label}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Image 1 Target: Payment Modal "Cobrar pedido" */}
      {showPaymentModal && (
        <div className="modal-overlay-dark" onClick={() => setShowPaymentModal(false)}>
          <div className="payment-modal-box animate-pop" onClick={(e) => e.stopPropagation()}>
            {/* Modal Header */}
            <div className="payment-modal-header">
              <h2 className="payment-modal-title">
                Cobrar pedido <span className="payment-order-tag">#FC-000125</span>
              </h2>
              <button className="payment-modal-close" onClick={() => setShowPaymentModal(false)}>
                <X size={18} />
              </button>
            </div>

            {/* Payment Method Tabs */}
            <div className="payment-tabs-bar">
              {PAYMENT_METHODS.map((pm) => (
                <button
                  key={pm.method}
                  className={`payment-tab-btn ${selectedPaymentTab === pm.method ? 'active' : ''}`}
                  onClick={() => setSelectedPaymentTab(pm.method)}
                >
                  <span>{pm.icon}</span>
                  <span>{pm.label}</span>
                </button>
              ))}
            </div>

            {/* Modal Body: Left Details + Right Summary */}
            <div className="payment-modal-body">
              {/* Left Column: Details */}
              <div className="payment-body-left">
                <h3 className="payment-sub-heading">
                  Detalles del pago ({PAYMENT_METHODS.find(p => p.method === selectedPaymentTab)?.label})
                </h3>

                <div className="payment-field-group mt-2">
                  <label className="payment-field-label">NÚMERO DE REFERENCIA <span className="text-red">*</span></label>
                  <div className="payment-input-wrap">
                    <input
                      type="text"
                      className="payment-field-input"
                      value={refNumber}
                      onChange={(e) => setRefNumber(e.target.value)}
                    />
                    <QrCode size={16} className="qr-icon-right" />
                  </div>
                </div>

                <div className="payment-field-group mt-3">
                  <label className="payment-field-label">MONTO RECIBIDO <span className="text-red">*</span></label>
                  <div className="payment-input-wrap">
                    <input
                      type="text"
                      className="payment-field-input"
                      value={amountReceived}
                      onChange={(e) => setAmountReceived(e.target.value)}
                    />
                    <span className="currency-tag-right">USD</span>
                  </div>
                  <span className="payment-hint-sub">Monto a recibir por este método.</span>
                </div>

                <div className="payment-field-group mt-3">
                  <label className="payment-field-label">NOTA (OPCIONAL)</label>
                  <div className="payment-textarea-wrap">
                    <textarea
                      className="payment-field-textarea"
                      placeholder="Ej. Pago por Yape"
                      value={paymentNote}
                      onChange={(e) => setPaymentNote(e.target.value.slice(0, 120))}
                      rows={2}
                    />
                    <span className="payment-counter-bottom">{paymentNote.length}/120</span>
                  </div>
                </div>

                {/* Desglose de Pago */}
                <div className="payment-breakdown-card mt-3">
                  <span className="breakdown-card-title">Desglose de pago</span>
                  <div className="breakdown-rows-list">
                    <div className="breakdown-row-item">
                      <span className="row-item-left">📱 Pago móvil</span>
                      <span className="row-item-val">$300.00</span>
                      <span className="row-item-dots">⋮</span>
                    </div>
                    <div className="breakdown-row-item">
                      <span className="row-item-left">💵 Efectivo</span>
                      <span className="row-item-val">$209.25</span>
                      <span className="row-item-dots">⋮</span>
                    </div>
                  </div>

                  <button className="btn-add-method-link mt-2">
                    + Agregar otro método de pago
                  </button>
                </div>
              </div>

              {/* Right Column: Order Summary */}
              <div className="payment-body-right">
                <div className="order-summary-box">
                  <h3 className="summary-box-title">Resumen del pedido</h3>

                  <div className="summary-box-lines mt-3">
                    <div className="summary-box-line">
                      <span>Subtotal</span>
                      <span className="font-bold">${subtotal.toFixed(2)}</span>
                    </div>
                    <div className="summary-box-line">
                      <span>Cargo por servicio (5%) ℹ️</span>
                      <span className="font-bold">${serviceFee.toFixed(2)}</span>
                    </div>
                    <div className="summary-box-line">
                      <span>Descuento</span>
                      <span className="font-bold">$0.00</span>
                    </div>

                    <div className="summary-box-total-line mt-3">
                      <span className="summary-total-label">Total</span>
                      <span className="summary-total-val">${total.toFixed(2)}</span>
                    </div>
                  </div>

                  {/* Customer field */}
                  <div className="summary-box-customer mt-4">
                    <span className="customer-box-label">Cliente</span>
                    <div className="customer-box-card">
                      <span className="customer-box-name">👤 {customerName || 'Cliente general'}</span>
                      <button className="customer-edit-btn">✏️</button>
                    </div>
                  </div>

                  {/* Info Notice */}
                  <div className="payment-security-notice mt-4">
                    <ShieldCheck size={16} className="text-green flex-shrink-0" />
                    <span>Los pagos combinados se registrarán en la factura correctamente.</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Footer Actions */}
            <div className="payment-modal-footer">
              <button className="btn-confirm-payment-red" onClick={handleConfirmPayment} disabled={paying}>
                <CheckCircle size={18} /> Confirmar pago
              </button>
              <button className="btn-modal-action-dark" onClick={handlePrintReceipt}>
                <Printer size={18} /> Imprimir recibo
              </button>
              <button className="btn-modal-action-ghost" onClick={() => setShowPaymentModal(false)}>
                <X size={18} /> Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Nuevo Cliente desde Caja */}
      {showNewClientModal && (
        <div className="modal-overlay-dark" onClick={() => setShowNewClientModal(false)}>
          <div className="client-modal-box animate-pop" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header-line">
              <div>
                <h3 className="modal-title">Nuevo cliente</h3>
                <p className="modal-sub-desc">Registra un nuevo cliente en el sistema</p>
              </div>
              <button className="modal-close-btn" onClick={() => setShowNewClientModal(false)}><X size={18} /></button>
            </div>

            <form onSubmit={handleCreateNewClientFromCaja} className="crm-form mt-3">
              <div className="field">
                <label className="field-label-white">Nombre *</label>
                <input
                  type="text"
                  placeholder="Ingresa el nombre del cliente"
                  value={newClientName}
                  onChange={(e) => setNewClientName(e.target.value)}
                  className="modal-input-dark"
                  required
                />
              </div>

              <div className="field mt-3">
                <label className="field-label-white">Apellido</label>
                <input
                  type="text"
                  placeholder="Ingresa el apellido del cliente"
                  value={newClientLastName}
                  onChange={(e) => setNewClientLastName(e.target.value)}
                  className="modal-input-dark"
                />
              </div>

              <div className="field mt-3">
                <label className="field-label-white">Teléfono</label>
                <div className="input-with-icon-wrap">
                  <Phone size={16} className="input-left-icon" />
                  <input
                    type="tel"
                    placeholder="04129206984"
                    value={newClientPhone}
                    onChange={(e) => setNewClientPhone(e.target.value)}
                    className="modal-input-dark with-left-icon"
                  />
                </div>
              </div>

              <div className="field mt-3">
                <label className="field-label-white">Cumpleaños</label>
                <div className="birthday-selects-row">
                  <div className="select-col">
                    <span className="select-sub-label">Mes</span>
                    <select
                      className="modal-select-dark"
                      value={birthMonth}
                      onChange={(e) => setBirthMonth(e.target.value)}
                    >
                      <option value="">Mes</option>
                      {['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'].map((m) => (
                        <option key={m} value={m}>{m}</option>
                      ))}
                    </select>
                  </div>
                  <div className="select-col">
                    <span className="select-sub-label">Día</span>
                    <select
                      className="modal-select-dark"
                      value={birthDay}
                      onChange={(e) => setBirthDay(e.target.value)}
                    >
                      <option value="">Día</option>
                      {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
                        <option key={d} value={d}>{d}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <span className="birthday-hint mt-1">
                  ℹ️ Solo para promociones y recordatorios
                </span>
              </div>

              <div className="modal-actions-row-right mt-4">
                <button type="button" className="btn-modal-cancel" onClick={() => setShowNewClientModal(false)}>
                  Cancelar
                </button>
                <button type="submit" className="btn-modal-submit-red">
                  Guardar cliente
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
