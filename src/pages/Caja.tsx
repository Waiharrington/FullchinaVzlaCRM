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

type View = 'products' | 'cart' | 'payment' | 'confirmation'

const CATEGORY_LABELS: Record<string, string> = {
  arroz: '🍚 Arroces',
  plato: '🍖 Platos',
  wok: '🍜 Chop Suey / Tallarín',
  pollo_camaron: '🍗 Pollo y Camarón',
  racion: '🥟 Raciones',
  bebida: '🥤 Bebidas',
  extra: '➕ Extras',
}
const CATEGORY_ORDER = ['arroz', 'plato', 'wok', 'pollo_camaron', 'racion', 'bebida', 'extra']

const fmtBs = (n: number) => n.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export function Caja() {
  const { user } = useAuth()
  const [view, setView] = useState<View>('products')
  const [cart, setCart] = useState<CartItem[]>([])
  const [currentOrder, setCurrentOrder] = useState<OrderResult | null>(null)
  const [showHistory, setShowHistory] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [activeCategory, setActiveCategory] = useState<string>('all')

  const [products, setProducts] = useState<Product[]>([])
  const [todayOrders, setTodayOrders] = useState<TodayOrder[]>([])
  const [bcvRate, setBcvRate] = useState<number | null>(null)
  const [rateStale, setRateStale] = useState(false)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [paying, setPaying] = useState(false)
  const [payError, setPayError] = useState('')

  const refreshTodayOrders = useCallback(async () => {
    try {
      setTodayOrders(await getTodayOrders())
    } catch (e) {
      console.error('Error cargando ventas de hoy:', e)
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true)
      setLoadError('')
      try {
        const [prods, orders, rates] = await Promise.all([
          getProducts(),
          getTodayOrders(),
          getExchangeRates(),
        ])
        if (cancelled) return
        setProducts(prods)
        setTodayOrders(orders)
        setBcvRate(rates.bcv > 0 ? rates.bcv : null)
        setRateStale(!!rates.error || rates.bcv <= 0)
      } catch (e) {
        if (!cancelled) setLoadError(e instanceof Error ? e.message : 'Error cargando datos')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const categories = useMemo(() => {
    const present = new Set(products.map((p) => p.category))
    return CATEGORY_ORDER.filter((c) => present.has(c))
  }, [products])

  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase())
      const matchesCategory = activeCategory === 'all' || p.category === activeCategory
      return matchesSearch && matchesCategory && p.active
    })
  }, [products, searchTerm, activeCategory])

  const todayTotal = todayOrders.reduce((sum, o) => sum + o.total, 0)

  const addToCart = (product: Product) => {
    setCart((prev) => {
      const existing = prev.find((item) => item.productId === product.id)
      if (existing) {
        return prev.map((item) =>
          item.productId === product.id ? { ...item, quantity: item.quantity + 1 } : item,
        )
      }
      return [...prev, { productId: product.id, productName: product.name, price: product.price, quantity: 1 }]
    })
  }

  const removeFromCart = (productId: string) => {
    setCart((prev) => prev.filter((item) => item.productId !== productId))
  }

  const updateQuantity = (productId: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((item) => {
          if (item.productId !== productId) return item
          const newQty = item.quantity + delta
          return newQty > 0 ? { ...item, quantity: newQty } : item
        })
        .filter((item) => item.quantity > 0),
    )
  }

  const cartTotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0)
  const cartItemCount = cart.reduce((sum, item) => sum + item.quantity, 0)

  const handleCheckout = () => {
    if (cart.length === 0) return
    setPayError('')
    setView('payment')
  }

  const handlePayment = async (method: PaymentMethod) => {
    if (cart.length === 0 || !user) return
    setPaying(true)
    setPayError('')
    try {
      const order = await checkout({ items: cart, method, bcvRate, userId: user.id })
      setCurrentOrder(order)
      setCart([])
      setView('confirmation')
      refreshTodayOrders()
    } catch (e) {
      setPayError(e instanceof Error ? e.message : 'No se pudo registrar el pago')
    } finally {
      setPaying(false)
    }
  }

  const handlePrintReceipt = () => {
    if (currentOrder) {
      downloadReceipt({
        orderId: `FC-${String(currentOrder.orderNumber).padStart(4, '0')}`,
        items: currentOrder.items,
        total: currentOrder.total,
        paymentMethod: currentOrder.paymentMethod,
        createdAt: currentOrder.createdAt,
      })
    }
  }

  const handleNewSale = () => {
    setCart([])
    setCurrentOrder(null)
    setView('products')
  }

  if (loading) {
    return (
      <div className="page animate-fade-in">
        <header className="page-header">
          <h1 className="page-title text-gradient">Caja</h1>
          <p className="page-subtitle">Cargando productos…</p>
        </header>
      </div>
    )
  }

  if (loadError) {
    return (
      <div className="page animate-fade-in">
        <header className="page-header">
          <h1 className="page-title text-gradient">Caja</h1>
          <p className="page-subtitle">No se pudo cargar</p>
        </header>
        <div className="card">
          <p className="login-error">{loadError}</p>
        </div>
      </div>
    )
  }

  if (view === 'confirmation') {
    return (
      <div className="page animate-fade-in">
        <header className="page-header">
          <h1 className="page-title text-gradient">Caja</h1>
          <p className="page-subtitle">Venta completada</p>
        </header>

        <div className="confirmation-card">
          <div className="confirmation-icon">✅</div>
          <h2 className="confirmation-title">¡Pago recibido!</h2>
          <p className="confirmation-amount">${currentOrder?.total.toFixed(2)}</p>
          {bcvRate && currentOrder && (
            <p className="confirmation-id">Bs {fmtBs(currentOrder.total * bcvRate)} · tasa {fmtBs(bcvRate)}</p>
          )}
          <p className="confirmation-id">Orden: FC-{String(currentOrder?.orderNumber).padStart(4, '0')}</p>
          <div className="confirmation-actions">
            <button className="btn-ghost" onClick={handlePrintReceipt}>
              🖨️ Imprimir recibo
            </button>
            <button className="btn-accent btn-block" onClick={handleNewSale}>
              Nueva venta
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (view === 'payment') {
    return (
      <div className="page animate-fade-in">
        <header className="page-header">
          <h1 className="page-title text-gradient">Caja</h1>
          <p className="page-subtitle">Método de pago</p>
        </header>

        <div className="payment-card">
          <p className="payment-total-label">Total a cobrar</p>
          <p className="payment-total">${cartTotal.toFixed(2)}</p>
          {bcvRate ? (
            <p className="payment-total-label">Bs {fmtBs(cartTotal * bcvRate)} · tasa BCV {fmtBs(bcvRate)}</p>
          ) : (
            <p className="payment-total-label">⚠️ Sin tasa BCV (cobro solo en $)</p>
          )}

          <div className="payment-items-summary">
            {cart.map((item) => (
              <div key={item.productId} className="payment-summary-item">
                <span>{item.quantity}x {item.productName}</span>
                <span>${(item.price * item.quantity).toFixed(2)}</span>
              </div>
            ))}
          </div>

          {payError && <p className="login-error">{payError}</p>}

          <div className="payment-methods">
            <button className="payment-btn" disabled={paying} onClick={() => handlePayment('cash')}>
              <span className="payment-icon">💵</span>
              <span className="payment-label">Efectivo</span>
            </button>
            <button className="payment-btn" disabled={paying} onClick={() => handlePayment('card')}>
              <span className="payment-icon">💳</span>
              <span className="payment-label">Tarjeta</span>
            </button>
            <button className="payment-btn" disabled={paying} onClick={() => handlePayment('transfer')}>
              <span className="payment-icon">📱</span>
              <span className="payment-label">Transferencia</span>
            </button>
          </div>

          <button className="btn-ghost btn-block" disabled={paying} onClick={() => setView('products')}>
            {paying ? 'Procesando…' : 'Volver'}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="page animate-fade-in">
      <header className="page-header">
        <div>
          <h1 className="page-title text-gradient">Caja</h1>
          <p className="page-subtitle">
            Punto de venta · Hoy: ${todayTotal.toFixed(2)}
            {bcvRate ? ` · BCV ${fmtBs(bcvRate)}` : rateStale ? ' · ⚠️ sin tasa' : ''}
          </p>
        </div>
        <button className="btn-ghost btn-sm" onClick={() => setShowHistory(!showHistory)}>
          {showHistory ? 'Cerrar' : `📋 Historial (${todayOrders.length})`}
        </button>
      </header>

      {showHistory && (
        <div className="card history-panel animate-slide-up">
          <h2 className="card-title">Ventas de hoy</h2>
          <div className="history-list">
            {todayOrders.length === 0 ? (
              <p className="empty-message">No hay ventas hoy</p>
            ) : (
              todayOrders.map((order) => (
                <div key={order.id} className="history-item">
                  <div className="history-info">
                    <span className="history-id">FC-{String(order.orderNumber).padStart(4, '0')}</span>
                    <span className="history-time">
                      {new Date(order.createdAt).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    <span className={`history-method method-${order.paymentMethod}`}>
                      {order.paymentMethod === 'cash' ? '💵' : order.paymentMethod === 'card' ? '💳' : '📱'}
                    </span>
                  </div>
                  <span className="history-total">${order.total.toFixed(2)}</span>
                </div>
              ))
            )}
          </div>
          {todayOrders.length > 0 && (
            <div className="history-footer">
              <span>Total del día</span>
              <span className="history-total-sum">${todayTotal.toFixed(2)}</span>
            </div>
          )}
        </div>
      )}

      <div className="caja-layout">
        <div className="products-section">
          <div className="products-toolbar">
            <input
              type="text"
              placeholder="Buscar producto..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="search-input"
            />
            <div className="category-filters">
              <button
                className={`category-btn ${activeCategory === 'all' ? 'active' : ''}`}
                onClick={() => setActiveCategory('all')}
              >
                Todos
              </button>
              {categories.map((cat) => (
                <button
                  key={cat}
                  className={`category-btn ${activeCategory === cat ? 'active' : ''}`}
                  onClick={() => setActiveCategory(cat)}
                >
                  {CATEGORY_LABELS[cat] ?? cat}
                </button>
              ))}
            </div>
          </div>

          <div className="products-grid">
            {filteredProducts.map((product) => (
              <button key={product.id} className="product-card" onClick={() => addToCart(product)}>
                <span className="product-emoji">{product.emoji}</span>
                <span className="product-name">{product.name}</span>
                <span className="product-price">${product.price.toFixed(2)}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="cart-section">
          <div className="cart-card">
            <div className="cart-header">
              <h2 className="section-title">Carrito</h2>
              {cart.length > 0 && <span className="cart-count">{cartItemCount} items</span>}
            </div>
            {cart.length === 0 ? (
              <p className="empty-cart">Selecciona productos</p>
            ) : (
              <>
                <div className="cart-items">
                  {cart.map((item) => (
                    <div key={item.productId} className="cart-item">
                      <div className="cart-item-info">
                        <span className="cart-item-name">{item.productName}</span>
                        <span className="cart-item-price">${(item.price * item.quantity).toFixed(2)}</span>
                      </div>
                      <div className="cart-item-controls">
                        <button className="qty-btn" onClick={() => updateQuantity(item.productId, -1)}>
                          -
                        </button>
                        <span className="qty-value">{item.quantity}</span>
                        <button className="qty-btn" onClick={() => updateQuantity(item.productId, 1)}>
                          +
                        </button>
                        <button className="remove-btn" onClick={() => removeFromCart(item.productId)}>
                          ×
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="cart-footer">
                  <div className="cart-total">
                    <span>Total</span>
                    <span className="text-gradient">${cartTotal.toFixed(2)}</span>
                  </div>
                  {bcvRate && (
                    <div className="cart-total" style={{ fontSize: '0.85em', opacity: 0.8 }}>
                      <span>En bolívares</span>
                      <span>Bs {fmtBs(cartTotal * bcvRate)}</span>
                    </div>
                  )}
                  <button className="btn-accent btn-block" onClick={handleCheckout}>
                    Cobrar ${cartTotal.toFixed(2)}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
