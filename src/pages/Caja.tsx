import { useState, useMemo, useEffect, useCallback } from 'react'
import { useAuth } from '../context/auth-context'
import { downloadReceipt } from '../lib/receipt'
import { getExchangeRates } from '../lib/rates'
import {
  getProducts,
  getTodayOrders,
  checkout,
  type Product,
  type CartItem,
  type OrderResult,
  type TodayOrder,
  type PaymentMethod,
} from '../lib/dataService'
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

const PAYMENT_METHODS: Array<{ method: PaymentMethod; label: string; icon: string }> = [
  { method: 'cash', label: 'Efectivo', icon: '💵' },
  { method: 'card', label: 'Pago móvil', icon: '📱' },
  { method: 'other', label: 'Punto', icon: '💳' },
  { method: 'transfer', label: 'Transferencia', icon: '🏦' },
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

export function Caja() {
  const { user } = useAuth()

  const [products, setProducts] = useState<Product[]>([])
  const [todayOrders, setTodayOrders] = useState<TodayOrder[]>([])
  const [bcvRate, setBcvRate] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)

  const [cart, setCart] = useState<CartItem[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [activeCategory, setActiveCategory] = useState<string>('arroz')
  const [viewMode, setViewMode] = useState<ViewMode>('grid')
  const [sortBy, setSortBy] = useState<'popular' | 'price' | 'name'>('popular')

  const [orderType, setOrderType] = useState<OrderType>('dine-in')
  const [customerName, setCustomerName] = useState('')
  const [orderNotes, setOrderNotes] = useState('')
  const [discount, setDiscount] = useState(0)
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
        getExchangeRates().then((rates) => {
          if (!cancelled) setBcvRate(rates.bcv > 0 ? rates.bcv : null)
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

  const handleSendToKitchen = async () => {
    if (cart.length === 0 || !user) return
    setPaying(true)
    setPayError('')
    try {
      const order = await checkout({
        items: cart,
        method: 'cash',
        bcvRate,
        userId: user.id,
        notes: orderNotes || null,
        orderType,
        customerName: customerName || 'Cliente',
      })
      setCurrentOrder(order)
      setCart([])
      setCustomerName('')
      setOrderNotes('')
      setDiscount(0)
      setShowConfirmation(true)
      refreshTodayOrders()
    } catch (e) {
      setPayError(e instanceof Error ? e.message : 'Error al enviar')
    } finally {
      setPaying(false)
    }
  }

  const handlePayment = async (method: PaymentMethod) => {
    if (cart.length === 0 || !user) return
    setPaying(true)
    setPayError('')
    try {
      const order = await checkout({
        items: cart,
        method,
        bcvRate,
        userId: user.id,
        notes: orderNotes || null,
        orderType,
        customerName: customerName || 'Cliente',
      })
      setCurrentOrder(order)
      setCart([])
      setCustomerName('')
      setOrderNotes('')
      setDiscount(0)
      setShowConfirmation(true)
      refreshTodayOrders()
    } catch (e) {
      setPayError(e instanceof Error ? e.message : 'Error al cobrar')
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

  if (loading) {
    return (
      <div className="page animate-fade-in">
        <header className="page-header">
          <h1 className="page-title text-gradient">Ventas</h1>
          <p className="page-subtitle">Cargando catálogo...</p>
        </header>
      </div>
    )
  }

  if (showConfirmation && currentOrder) {
    return (
      <div className="page animate-fade-in">
        <div className="caja-layout">
          <div className="products-section">
            <div className="caja-banner">
              <div className="caja-banner-content">
                <span className="caja-banner-icon">🛒</span>
                <div>
                  <h2 className="caja-banner-title">Venta completada</h2>
                  <p className="caja-banner-sub">Pedido enviado exitosamente</p>
                </div>
              </div>
            </div>
            <div className="confirmation-panel">
              <div className="confirmation-icon">✅</div>
              <h2 className="confirmation-title">¡Pago recibido!</h2>
              <p className="confirmation-amount">${currentOrder.total.toFixed(2)}</p>
              {bcvRate && (
                <p className="confirmation-id">Bs {(currentOrder.total * bcvRate).toLocaleString('es-VE', { minimumFractionDigits: 2 })}</p>
              )}
              <p className="confirmation-id">Orden: FC-{String(currentOrder.orderNumber).padStart(6, '0')}</p>
              <div className="confirmation-actions">
                <button className="btn-ghost" onClick={handlePrintReceipt}>🖨️ Imprimir recibo</button>
                <button className="btn-accent btn-block" onClick={() => { setShowConfirmation(false); setCurrentOrder(null) }}>Nueva venta</button>
              </div>
            </div>
          </div>
          <div className="cart-sidebar">
            <div className="cart-sidebar-header">
              <h3 className="section-title">Resumen</h3>
            </div>
            <div className="cart-items-list">
              {currentOrder.items.map((item, idx) => (
                <div key={idx} className="cart-item-row">
                  <span className="cart-item-name">{item.productName}</span>
                  <span className="cart-item-qty">{item.quantity}x</span>
                  <span className="cart-item-price">${(item.price * item.quantity).toFixed(2)}</span>
                </div>
              ))}
            </div>
            <div className="cart-totals">
              <div className="cart-total-row">
                <span>Total</span>
                <span className="total-amount">${currentOrder.total.toFixed(2)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="page animate-fade-in">
      {/* Global Top Navbar matching target mockup */}
      <header className="global-topbar">
        <div className="topbar-search">
          <span className="topbar-search-icon">🔍</span>
          <input
            type="text"
            placeholder="Buscar productos, clientes, comandas..."
            className="topbar-search-input"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <kbd className="topbar-kbd">⌘K</kbd>
        </div>

        <div className="topbar-actions">
          <button className="btn-topbar-primary" onClick={() => setCart([])}>
            <span>+</span> Nueva comanda
          </button>
          <button className="btn-topbar-secondary">
            <span>🏷️</span> Mesa rápida
          </button>
          <div className="topbar-date">
            <span>📅</span> {new Date().toLocaleDateString('es', { day: '2-digit', month: 'short', year: 'numeric' })}
          </div>
          <button className="topbar-icon-btn" title="Notificaciones">
            🔔
            <span className="topbar-badge">5</span>
          </button>
          <div className="topbar-user">
            <div className="user-avatar-circle">
              {user?.email ? user.email.charAt(0).toUpperCase() : 'A'}
            </div>
            <div className="user-text">
              <span className="user-name">{user?.email ? user.email.split('@')[0] : 'Admin'}</span>
              <span className="user-role">Administrador</span>
            </div>
          </div>
        </div>
      </header>

      <div className="caja-layout">
        {/* LEFT: Products */}
        <div className="products-section">
          {/* Hero Wok Flame Banner matching target mockup */}
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

          {/* Products Grid matching mockup pixel-for-pixel */}
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

        {/* RIGHT: Cart Sidebar matching target mockup */}
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
            <div className="cart-field-col">
              <label className="cart-label">Cliente</label>
              <div className="customer-input-wrap">
                <span className="input-search-icon">🔍</span>
                <input
                  type="text"
                  placeholder="Buscar cliente (opcional)"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  className="customer-input"
                />
                <button className="customer-add-btn">+</button>
              </div>
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

          {/* Action buttons matching mockup */}
          <div className="cart-action-buttons mt-3">
            <button
              className="btn-pay-red"
              disabled={cart.length === 0 || paying}
              onClick={() => handlePayment('cash')}
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
    </div>
  )
}
