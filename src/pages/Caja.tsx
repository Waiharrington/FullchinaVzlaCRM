import { useState, useMemo } from 'react'
import { useDemoData } from '../context/demo-data-context'
import { downloadReceipt } from '../lib/receipt'
import type { Product, OrderItem, Order } from '../lib/demoData'
import './Caja.css'

type View = 'products' | 'cart' | 'payment' | 'confirmation'

export function Caja() {
  const { products, orders, createOrder, completeOrder } = useDemoData()
  const [view, setView] = useState<View>('products')
  const [cart, setCart] = useState<OrderItem[]>([])
  const [currentOrder, setCurrentOrder] = useState<Order | null>(null)
  const [showHistory, setShowHistory] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [activeCategory, setActiveCategory] = useState<string>('all')

  const filteredProducts = useMemo(() => {
    return products.filter(p => {
      const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase())
      const matchesCategory = activeCategory === 'all' || p.category === activeCategory
      return matchesSearch && matchesCategory && p.active
    })
  }, [products, searchTerm, activeCategory])

  const todayOrders = useMemo(() => {
    const today = new Date().toISOString().split('T')[0]
    return orders
      .filter(o => o.createdAt.startsWith(today) && o.status === 'paid')
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  }, [orders])

  const todayTotal = todayOrders.reduce((sum, o) => sum + o.total, 0)

  const addToCart = (product: Product) => {
    setCart(prev => {
      const existing = prev.find(item => item.productId === product.id)
      if (existing) {
        return prev.map(item =>
          item.productId === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        )
      }
      return [...prev, {
        productId: product.id,
        productName: product.name,
        price: product.price,
        quantity: 1
      }]
    })
  }

  const removeFromCart = (productId: string) => {
    setCart(prev => prev.filter(item => item.productId !== productId))
  }

  const updateQuantity = (productId: string, delta: number) => {
    setCart(prev => prev.map(item => {
      if (item.productId !== productId) return item
      const newQty = item.quantity + delta
      return newQty > 0 ? { ...item, quantity: newQty } : item
    }).filter(item => item.quantity > 0))
  }

  const cartTotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0)
  const cartItemCount = cart.reduce((sum, item) => sum + item.quantity, 0)

  const handleCheckout = () => {
    if (cart.length === 0) return
    const order = createOrder(cart)
    setCurrentOrder(order)
    setView('payment')
  }

  const handlePayment = (method: 'cash' | 'card' | 'transfer') => {
    if (currentOrder) {
      completeOrder(currentOrder.id, method)
      const completedOrder = { ...currentOrder, status: 'paid' as const, paymentMethod: method }
      setCurrentOrder(completedOrder)
      setView('confirmation')
    }
  }

  const handlePrintReceipt = () => {
    if (currentOrder) {
      downloadReceipt({
        orderId: currentOrder.id,
        items: currentOrder.items,
        total: currentOrder.total,
        paymentMethod: currentOrder.paymentMethod || 'cash',
        createdAt: currentOrder.createdAt,
      })
    }
  }

  const handleNewSale = () => {
    setCart([])
    setCurrentOrder(null)
    setView('products')
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
          <p className="confirmation-id">Orden: {currentOrder?.id}</p>
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
          <p className="payment-total">${currentOrder?.total.toFixed(2)}</p>

          <div className="payment-items-summary">
            {currentOrder?.items.map(item => (
              <div key={item.productId} className="payment-summary-item">
                <span>{item.quantity}x {item.productName}</span>
                <span>${(item.price * item.quantity).toFixed(2)}</span>
              </div>
            ))}
          </div>

          <div className="payment-methods">
            <button className="payment-btn" onClick={() => handlePayment('cash')}>
              <span className="payment-icon">💵</span>
              <span className="payment-label">Efectivo</span>
            </button>
            <button className="payment-btn" onClick={() => handlePayment('card')}>
              <span className="payment-icon">💳</span>
              <span className="payment-label">Tarjeta</span>
            </button>
            <button className="payment-btn" onClick={() => handlePayment('transfer')}>
              <span className="payment-icon">📱</span>
              <span className="payment-label">Transferencia</span>
            </button>
          </div>

          <button className="btn-ghost btn-block" onClick={() => setView('cart')}>
            Volver al carrito
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
          <p className="page-subtitle">Punto de venta · Hoy: ${todayTotal.toFixed(2)}</p>
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
              todayOrders.map(order => (
                <div key={order.id} className="history-item">
                  <div className="history-info">
                    <span className="history-id">{order.id}</span>
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
              {[
                { key: 'all', label: 'Todos' },
                { key: 'food', label: '🍔 Comida' },
                { key: 'drink', label: '🥤 Bebidas' },
                { key: 'dessert', label: '🍰 Postres' },
              ].map(cat => (
                <button
                  key={cat.key}
                  className={`category-btn ${activeCategory === cat.key ? 'active' : ''}`}
                  onClick={() => setActiveCategory(cat.key)}
                >
                  {cat.label}
                </button>
              ))}
            </div>
          </div>

          <div className="products-grid">
            {filteredProducts.map(product => (
              <button
                key={product.id}
                className="product-card"
                onClick={() => addToCart(product)}
              >
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
              {cart.length > 0 && (
                <span className="cart-count">{cartItemCount} items</span>
              )}
            </div>
            {cart.length === 0 ? (
              <p className="empty-cart">Selecciona productos</p>
            ) : (
              <>
                <div className="cart-items">
                  {cart.map(item => (
                    <div key={item.productId} className="cart-item">
                      <div className="cart-item-info">
                        <span className="cart-item-name">{item.productName}</span>
                        <span className="cart-item-price">${(item.price * item.quantity).toFixed(2)}</span>
                      </div>
                      <div className="cart-item-controls">
                        <button
                          className="qty-btn"
                          onClick={() => updateQuantity(item.productId, -1)}
                        >
                          -
                        </button>
                        <span className="qty-value">{item.quantity}</span>
                        <button
                          className="qty-btn"
                          onClick={() => updateQuantity(item.productId, 1)}
                        >
                          +
                        </button>
                        <button
                          className="remove-btn"
                          onClick={() => removeFromCart(item.productId)}
                        >
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
