import { useEffect, useMemo, useState } from 'react'
import { Check, ChevronRight, Clock, Home, LayoutGrid, MapPin, Minus, Navigation, Package, Plus, Search, ShoppingBag, Tag, Trash2, User, X } from 'lucide-react'
import { groupMenuProducts, type MenuProductGroup } from '../lib/menuGrouping'
import { createWebOrder, getPublicCatalog, getPublicPromotions, type Promotion, type WebOrderCartItem } from '../lib/publicOrders'
import { getExchangeRates } from '../lib/rates'
import type { Product } from '../lib/dataService'
import './PublicMenu.css'

const CATEGORY_LABELS: Record<string, string> = {
  arroz: 'Arroces', bebida: 'Bebidas', extra: 'Extras', plato: 'Platos', wok: 'Wok',
  pollo_camaron: 'Pollo y camarón', racion: 'Raciones', combo: 'Combos', sin_categoria: 'Otros',
}

const CATEGORY_ICONS: Record<string, string> = {
  arroz: '🍚', bebida: '🥤', extra: '🥟', plato: '🍜', wok: '🔥',
  pollo_camaron: '🍗', racion: '🥘', combo: '🍱', sin_categoria: '🍽️',
}

function money(value: number) {
  return new Intl.NumberFormat('es-VE', { style: 'currency', currency: 'USD' }).format(value)
}

type View = 'menu' | 'pedido' | 'ofertas'

export function PublicMenu() {
  const [products, setProducts] = useState<Product[]>([])
  const [promotions, setPromotions] = useState<Promotion[]>([])
  const [cart, setCart] = useState<WebOrderCartItem[]>([])
  const [selectedGroup, setSelectedGroup] = useState<MenuProductGroup | null>(null)
  const [activeCategory, setActiveCategory] = useState('Todos')
  const [search, setSearch] = useState('')
  const [cartOpen, setCartOpen] = useState(false)
  const [welcomeOpen, setWelcomeOpen] = useState(() => localStorage.getItem('fullchina_menu_welcome') !== 'hidden')
  const [step, setStep] = useState<'cart' | 'details' | 'sent'>('cart')
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [orderType, setOrderType] = useState<'takeaway' | 'delivery'>('takeaway')
  const [address, setAddress] = useState('')
  const [addressSuggestions, setAddressSuggestions] = useState<Array<{ display_name: string; lat: string; lon: string }>>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [geoCoords, setGeoCoords] = useState<{ lat: number; lng: number } | null>(null)
  const [locating, setLocating] = useState(false)
  const [notes, setNotes] = useState('')
  const [bcvRate, setBcvRate] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [orderCode, setOrderCode] = useState('')
  const [currentView, setCurrentView] = useState<View>('menu')

  useEffect(() => {
    Promise.all([getPublicCatalog(), getExchangeRates(), getPublicPromotions()])
      .then(([catalog, rates, promos]) => { setProducts(catalog); setBcvRate(rates.bcv || null); setPromotions(promos) })
      .catch(() => setError('No pudimos cargar el menú. Intenta nuevamente.'))
      .finally(() => setLoading(false))
  }, [])

  const categories = useMemo(() => ['Todos', ...new Set(products.map(p => p.category))], [products])
  const groups = useMemo(() => groupMenuProducts(products.filter(p => {
    const cat = activeCategory === 'Todos' || p.category === activeCategory
    const q = search.trim().toLowerCase()
    return cat && (!q || `${p.name} ${p.description || ''}`.toLowerCase().includes(q))
  })), [products, activeCategory, search])
  const itemCount = cart.reduce((s, i) => s + i.quantity, 0)
  const total = cart.reduce((s, i) => s + i.price * i.quantity, 0)

  const addProduct = (product: Product) => {
    setCart(cur => {
      const ex = cur.find(i => i.productId === product.id)
      return ex ? cur.map(i => i.productId === product.id ? { ...i, quantity: i.quantity + 1 } : i)
        : [...cur, { productId: product.id, productName: product.name, price: product.price, quantity: 1 }]
    })
    setSelectedGroup(null)
  }

  const updateQuantity = (productId: string, delta: number) => setCart(cur => cur
    .map(i => i.productId === productId ? { ...i, quantity: i.quantity + delta } : i)
    .filter(i => i.quantity > 0))

  const openGroup = (group: MenuProductGroup) => group.isGrouped ? setSelectedGroup(group) : addProduct(group.variants[0].product)

  const useMyLocation = () => {
    if (!navigator.geolocation) return setError('Tu navegador no soporta geolocalización.')
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude: lat, longitude: lng } = pos.coords
        setGeoCoords({ lat, lng })
        try {
          const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&addressdetails=1`, { headers: { 'Accept-Language': 'es' } })
          const data = await res.json()
          if (data.display_name) { setAddress(data.display_name.length > 120 ? data.display_name.substring(0, 120) + '…' : data.display_name); setShowSuggestions(false) }
        } catch { /* keep coordinates */ }
        setLocating(false)
      },
      () => { setLocating(false); setError('No pudimos obtener tu ubicación. Activa el GPS e intenta de nuevo.') },
      { enableHighAccuracy: true, timeout: 10000 }
    )
  }

  const searchAddress = async (query: string) => {
    setAddress(query); setShowSuggestions(true); setGeoCoords(null)
    if (query.trim().length < 4) { setAddressSuggestions([]); return }
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&countrycodes=ve&limit=5`, { headers: { 'Accept-Language': 'es' } })
      setAddressSuggestions(await res.json())
    } catch { setAddressSuggestions([]) }
  }

  const selectSuggestion = (s: { display_name: string; lat: string; lon: string }) => {
    setAddress(s.display_name.length > 120 ? s.display_name.substring(0, 120) + '…' : s.display_name)
    setGeoCoords({ lat: parseFloat(s.lat), lng: parseFloat(s.lon) })
    setShowSuggestions(false); setAddressSuggestions([])
  }

  const submitOrder = async () => {
    setError('')
    if (name.trim().length < 2) return setError('Escribe tu nombre.')
    if (phone.replace(/\D/g, '').length < 7) return setError('Escribe un teléfono válido.')
    if (orderType === 'delivery' && address.trim().length < 8) return setError('Escribe la dirección de entrega.')
    if (!cart.length) return setError('Tu carrito está vacío.')
    setSubmitting(true)
    // Para delivery, persistimos la ubicación GPS dentro de las notas del pedido
    // (link de Google Maps) para que llegue a la comanda. La caja la extrae y
    // muestra un botón "Ver ubicación".
    const savedNotes = [
      notes.trim(),
      orderType === 'delivery' && geoCoords
        ? `📍 Ubicación GPS: https://maps.google.com/?q=${geoCoords.lat},${geoCoords.lng}`
        : '',
    ].filter(Boolean).join('\n')
    try {
      const result = await createWebOrder({
        customerName: name.trim(), customerPhone: phone.trim(), orderType,
        deliveryAddress: address.trim(), notes: savedNotes, items: cart, bcvRate,
        idempotencyKey: crypto.randomUUID(),
      })
      setOrderCode(result.code)
      const lines = cart.map(i => `• ${i.quantity}x ${i.productName} — ${money(i.price * i.quantity)}`)
      const msg = [
        `Hola Full China 👋 Quiero confirmar mi pedido ${result.code}`,
        '', ...lines, '', `Total: ${money(result.total)}`,
        bcvRate ? `Bs. ${(result.total * bcvRate).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '',
        `Modalidad: ${orderType === 'delivery' ? 'Delivery' : 'Retiro en el local'}`,
        orderType === 'delivery' ? `Dirección: ${address.trim()}` : '',
        orderType === 'delivery' && geoCoords ? `📍 Ubicación GPS: https://maps.google.com/?q=${geoCoords.lat},${geoCoords.lng}` : '',
        notes.trim() ? `Notas: ${notes.trim()}` : '',
        '', `Nombre: ${name.trim()}`, `Teléfono: ${phone.trim()}`,
      ].filter(Boolean).join('\n')
      const phone2 = String(import.meta.env.VITE_FULLCHINA_WHATSAPP || '').replace(/\D/g, '')
      window.open(`https://wa.me/${phone2}?text=${encodeURIComponent(msg)}`, '_blank', 'noopener,noreferrer')
      setStep('sent')
    } catch (e) { setError(e instanceof Error ? e.message : 'No pudimos registrar el pedido.') }
    finally { setSubmitting(false) }
  }

  const lastItem = cart.length > 0 ? cart[cart.length - 1] : null

  const setView = (v: View) => {
    setCurrentView(v)
    if (v === 'pedido') setCartOpen(true)
  }

  return (
    <main className="public-menu-page">
      {/* ── Hero ── */}
      {currentView === 'menu' && (
        <header className="pm-hero">
          <div className="pm-hero-top">
            <img className="pm-hero-logo" src="/logo.png" alt="Full China" />
            <div className="pm-hero-status"><span className="dot" /><span>Abierto ahora</span><small>10:30 AM – 10:30 PM</small></div>
            <div className="pm-hero-icons">
              <button className="pm-hero-icon" aria-label="Buscar" onClick={() => document.getElementById('menu-search')?.focus()}>
                <Search size={18} />
              </button>
              <button className="pm-hero-icon" aria-label="Perfil"><User size={18} /></button>
            </div>
            <button className="pm-hero-cart-btn" onClick={() => { setCartOpen(true); setStep('cart') }} disabled={!itemCount}>
              <ShoppingBag size={18} /> Mi pedido <span className="cart-badge">{money(total)}</span>
            </button>
          </div>
          <div className="pm-hero-content">
            <h1>El auténtico</h1>
            <h2>SABOR CHINO<br /><em>Sobre ruedas</em></h2>
            <div className="pm-hero-location"><MapPin size={14} /> Maracay, Aragua</div>
            <div className="pm-hero-toggle">
              <button className={orderType === 'takeaway' ? 'active' : ''} onClick={() => setOrderType('takeaway')}>
                <span className="toggle-icon">🥡</span>
                <div><strong>Retiro en el local</strong><small>Listo en 15-20 min</small></div>
              </button>
              <button className={orderType === 'delivery' ? 'active' : ''} onClick={() => setOrderType('delivery')}>
                <span className="toggle-icon">🛵</span>
                <div><strong>Delivery</strong><small>Te lo llevamos</small></div>
              </button>
            </div>
          </div>
        </header>
      )}

      {/* ── Mi Pedido View ── */}
      {currentView === 'pedido' && (
        <div className="pm-view-page">
          <div className="pm-view-header">
            <h2>Mi Pedido</h2>
            <span className="pm-view-subtitle">{itemCount > 0 ? `${itemCount} producto${itemCount === 1 ? '' : 's'} en carrito` : 'Tu carrito está vacío'}</span>
          </div>
          {itemCount === 0 ? (
            <div className="pm-empty-state">
              <span className="pm-empty-icon">🛒</span>
              <h3>Aún no has pedido nada</h3>
              <p>Explora nuestro menú y agrega tus platos favoritos</p>
              <button className="pm-btn-primary" onClick={() => setCurrentView('menu')}>Ver menú</button>
            </div>
          ) : (
            <div className="pm-pedido-content">
              <div className="pm-cart-items">
                {cart.map(item => (
                  <div className="pm-cart-item" key={item.productId}>
                    <div><strong>{item.productName}</strong><span>{money(item.price)}</span></div>
                    <div className="pm-qty">
                      <button onClick={() => updateQuantity(item.productId, -1)}>{item.quantity === 1 ? <Trash2 size={14} /> : <Minus size={14} />}</button>
                      <b>{item.quantity}</b>
                      <button onClick={() => updateQuantity(item.productId, 1)}><Plus size={14} /></button>
                    </div>
                    <strong>{money(item.price * item.quantity)}</strong>
                  </div>
                ))}
              </div>
              <div className="pm-total-bar">
                <span>Total estimado</span><strong>{money(total)}</strong>
                {bcvRate && <small>Bs. {(total * bcvRate).toLocaleString('es-VE', { minimumFractionDigits: 2 })}</small>}
              </div>
              <button className="pm-btn-primary" onClick={() => setCartOpen(true)}>Continuar con el pedido <ChevronRight size={18} /></button>
            </div>
          )}

          {orderCode && (
            <div className="pm-pedido-last">
              <div className="pm-pedido-card">
                <div className="pm-pedido-card-head">
                  <span className="pm-pedido-status-icon"><Clock size={18} /></span>
                  <div>
                    <strong>Pedido {orderCode}</strong>
                    <small>Enviado por WhatsApp</small>
                  </div>
                </div>
                <div className="pm-pedido-steps">
                  <div className="pm-pedido-step done"><span className="step-dot" /><span className="step-label">Recibido</span></div>
                  <div className="pm-pedido-step active"><span className="step-dot" /><span className="step-label">En preparación</span></div>
                  <div className="pm-pedido-step"><span className="step-dot" /><span className="step-label">Listo para entregar</span></div>
                </div>
                <p className="pm-pedido-note">Para seguimiento, escríbenos por WhatsApp con tu código.</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Ofertas View ── */}
      {currentView === 'ofertas' && (
        <div className="pm-view-page">
          <div className="pm-view-header">
            <h2>Ofertas 🔥</h2>
            <span className="pm-view-subtitle">Promociones disponibles para ti</span>
          </div>
          {promotions.length === 0 ? (
            <div className="pm-empty-state">
              <span className="pm-empty-icon">🏷️</span>
              <h3>No hay ofertas por ahora</h3>
              <p>Vuelve pronto, siempre hay algo nuevo</p>
            </div>
          ) : (
            <div className="pm-ofertas-list">
              {promotions.map(o => (
                <div className="pm-oferta-card" key={o.id} style={{ borderLeftColor: o.color }}>
                  <div className="pm-oferta-icon" style={{ background: o.color }}>{o.icon}</div>
                  <div className="pm-oferta-body">
                    <span className="pm-oferta-tag" style={{ color: o.color }}>{o.tag}</span>
                    <strong>{o.title}</strong>
                    <p>{o.subtitle}</p>
                    <div className="pm-oferta-price">
                      {o.price && <span className="pm-oferta-current">{o.oldPrice && <small className="pm-oferta-old">{o.oldPrice}</small>} ${o.price}</span>}
                      <small className="pm-oferta-note">{o.note}</small>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Menu Content ── */}
      {currentView === 'menu' && (
        <>
          {/* ── Search ── */}
          <div className="pm-search-wrap">
            <div className="pm-search">
              <Search size={20} color="#9ca3af" />
              <input id="menu-search" value={search} onChange={e => setSearch(e.target.value)} placeholder="¿Qué te provoca hoy?" />
              <button className="pm-search-filter" aria-label="Filtros"><Tag size={18} /></button>
            </div>
          </div>

          {/* ── Categories ── */}
          <nav className="pm-categories" aria-label="Categorías">
            {categories.map(cat => (
              <button key={cat} className={`pm-cat-btn ${activeCategory === cat ? 'active' : ''}`} onClick={() => setActiveCategory(cat)}>
                <span className="cat-icon">{cat === 'Todos' ? '📋' : (CATEGORY_ICONS[cat] || '🍽️')}</span>
                <span className="cat-label">{CATEGORY_LABELS[cat] || cat}</span>
              </button>
            ))}
          </nav>

          {/* ── Combo Promo ── */}
          <div className="pm-promo-banner">
            <div className="pm-promo-inner">
              <div className="pm-promo-text">
                <span className="pm-promo-tag">🔥 Combo Especial</span>
                <h3>DÚO<br /><em>FULL CHINA</em></h3>
                <p>Elige 2 platos y ahorra más</p>
                <span className="promo-price">Desde <small>USD</small> 12,90</span>
              </div>
              <div className="pm-promo-img">
                <img src="/login-carousel/slide1.webp" alt="Combo Full China" />
              </div>
            </div>
          </div>

          {/* ── Products ── */}
          <div className="pm-section-head">
            <h2>Recomendados para ti 🔥</h2>
            <button className="see-all">Ver todos →</button>
          </div>
          {loading ? <div className="pm-state">Cargando sabores…</div> : error && products.length === 0 ? <div className="pm-state error">{error}</div> : (
            <div className="pm-products">
              {groups.map((group, idx) => {
                const p = group.variants[0].product
                const img = p.imageUrl || '/login-carousel/slide1.webp'
                return (
                  <article className="pm-product-card" key={group.key} onClick={() => openGroup(group)}>
                    <div className="pm-product-img">
                      <img src={img} alt="" />
                      {idx === 0 && <span className="pm-product-badge most-sold">Más pedido</span>}
                      {idx === 2 && <span className="pm-product-badge popular">Popular</span>}
                      <button className="pm-product-fav" onClick={e => e.stopPropagation()} aria-label="Favorito">♡</button>
                    </div>
                    <div className="pm-product-body">
                      <h3>{group.name}</h3>
                      {p.description && <p>{p.description}</p>}
                      <div className="pm-product-foot">
                        <strong>{group.isGrouped && group.minPrice !== group.maxPrice ? 'Desde ' : ''}{money(group.minPrice)}</strong>
                        <button className="pm-product-add" onClick={e => { e.stopPropagation(); openGroup(group) }} aria-label={`Agregar ${group.name}`}><Plus size={18} /></button>
                      </div>
                    </div>
                  </article>
                )
              })}
            </div>
          )}

          {/* ── Delivery Gratis Banner ── */}
          <div className="pm-delivery-banner">
            <span className="del-icon">🛵</span>
            <div className="del-text">
              <strong>¡Delivery gratis a partir de $10!</strong>
              <small>Pide tu combo y no pagues envío</small>
            </div>
          </div>

          {/* ── Trust Badges ── */}
          <div className="pm-trust">
            <div className="pm-trust-item"><span className="trust-icon fire">🔥</span><div><strong>Hecho al wok</strong><small>Sabor auténtico</small></div></div>
            <div className="pm-trust-item"><span className="trust-icon leaf">🌿</span><div><strong>Ingredientes frescos</strong><small>Seleccionados cada día</small></div></div>
            <div className="pm-trust-item"><span className="trust-icon scooter">🛵</span><div><strong>Entrega rápida</strong><small>Seguimiento por WhatsApp</small></div></div>
            <div className="pm-trust-item"><span className="trust-icon wallet">💳</span><div><strong>Pago al recibir</strong><small>Efectivo o punto móvil</small></div></div>
          </div>
        </>
      )}

      {/* ── Sticky Cart Bar (only on menu view) ── */}
      {currentView === 'menu' && itemCount > 0 && (
        <div className="pm-sticky-cart" onClick={() => { setCartOpen(true); setStep('cart') }}>
          {lastItem && <img className="cart-thumb" src={products.find(p => p.id === lastItem.productId)?.imageUrl || '/login-carousel/slide1.webp'} alt="" />}
          <div className="cart-info"><strong>{lastItem?.productName}</strong><small>{itemCount} producto{itemCount === 1 ? '' : 's'} · Total estimado</small></div>
          <div className="cart-total"><strong>{money(total)}</strong><small>Bs. {(total * (bcvRate || 0)).toLocaleString('es-VE', { minimumFractionDigits: 2 })}</small></div>
          <button className="cart-go" aria-label="Ver carrito"><ChevronRight size={20} /></button>
        </div>
      )}

      {/* ── Bottom Nav ── */}
      <nav className="pm-bottom-nav">
        <button className={`pm-nav-item ${currentView === 'menu' ? 'active' : ''}`} onClick={() => setCurrentView('menu')}><span className="nav-icon"><Home size={22} /></span><span className="nav-label">Inicio</span></button>
        <button className="pm-nav-item" onClick={() => setCurrentView('menu')}><span className="nav-icon"><LayoutGrid size={22} /></span><span className="nav-label">Menú</span></button>
        <button className={`pm-nav-item mid ${currentView === 'pedido' ? 'active' : ''}`} onClick={() => setView('pedido')}>
          <span className="nav-icon"><Package size={24} /></span>
          {itemCount > 0 && <span className="nav-badge">{itemCount}</span>}
          <span className="nav-label">Mi pedido</span>
        </button>
        <button className={`pm-nav-item ${currentView === 'ofertas' ? 'active' : ''}`} onClick={() => setCurrentView('ofertas')}><span className="nav-icon"><Tag size={22} /></span><span className="nav-label">Ofertas</span></button>
        <button className="pm-nav-item"><span className="nav-icon"><User size={22} /></span><span className="nav-label">Perfil</span></button>
      </nav>

      {/* ── Welcome Modal ── */}
      {welcomeOpen && (
        <div className="pm-modal-backdrop">
          <section className="pm-welcome">
            <img src="/logo.png" alt="Full China" />
            <h2>¡Bienvenido al menú de Full China!</h2>
            <p>Arma tu pedido aquí. No tienes que pagar en esta página: al final te conectamos con Full China por WhatsApp para confirmarlo.</p>
            <button className="pm-btn-primary" onClick={() => setWelcomeOpen(false)}>Sí, quiero ver el menú</button>
            <button className="link-btn" onClick={() => { localStorage.setItem('fullchina_menu_welcome', 'hidden'); setWelcomeOpen(false) }}>No volver a mostrar</button>
          </section>
        </div>
      )}

      {/* ── Variant Modal ── */}
      {selectedGroup && (
        <div className="pm-modal-backdrop" onClick={() => setSelectedGroup(null)}>
          <section className="pm-variant-modal" onClick={e => e.stopPropagation()}>
            <button className="pm-drawer-close" onClick={() => setSelectedGroup(null)} style={{ position: 'absolute', right: 16, top: 16 }}><X size={16} /></button>
            <small>ELIGE TU PRESENTACIÓN</small>
            <h2>{selectedGroup.name}</h2>
            {selectedGroup.variants.map(({ product, label }) => (
              <button className="pm-variant" key={product.id} onClick={() => addProduct(product)}>
                <span>{product.emoji}<span><strong>{label}</strong><small>{product.description}</small></span></span>
                <b>{money(product.price)} <Plus size={16} /></b>
              </button>
            ))}
          </section>
        </div>
      )}

      {/* ── Cart Drawer ── */}
      {cartOpen && (
        <div className="pm-drawer-backdrop" onClick={() => setCartOpen(false)}>
          <aside className="pm-drawer" onClick={e => e.stopPropagation()}>
            <header>
              <div><small>{step === 'sent' ? 'PEDIDO REGISTRADO' : 'TU PEDIDO'}</small><h2>{step === 'details' ? '¿Cómo te lo entregamos?' : step === 'sent' ? orderCode : `${itemCount} producto${itemCount === 1 ? '' : 's'}`}</h2></div>
              <button className="pm-drawer-close" onClick={() => setCartOpen(false)}><X size={16} /></button>
            </header>

            {step === 'cart' && (
              <>
                <div className="pm-cart-items">
                  {cart.map(item => (
                    <div className="pm-cart-item" key={item.productId}>
                      <div><strong>{item.productName}</strong><span>{money(item.price)}</span></div>
                      <div className="pm-qty">
                        <button onClick={() => updateQuantity(item.productId, -1)}>{item.quantity === 1 ? <Trash2 size={14} /> : <Minus size={14} />}</button>
                        <b>{item.quantity}</b>
                        <button onClick={() => updateQuantity(item.productId, 1)}><Plus size={14} /></button>
                      </div>
                      <strong>{money(item.price * item.quantity)}</strong>
                    </div>
                  ))}
                </div>
                <div className="pm-total-bar">
                  <span>Total estimado</span><strong>{money(total)}</strong>
                  {bcvRate && <small>Bs. {(total * bcvRate).toLocaleString('es-VE', { minimumFractionDigits: 2 })}</small>}
                </div>
                <button className="pm-btn-primary" disabled={!cart.length} onClick={() => setStep('details')}>Continuar <ChevronRight size={18} /></button>
              </>
            )}

            {step === 'details' && (
              <div className="pm-checkout">
                <div className="pm-order-types">
                  <button className={orderType === 'takeaway' ? 'active' : ''} onClick={() => setOrderType('takeaway')}>🥡 Retirar</button>
                  <button className={orderType === 'delivery' ? 'active' : ''} onClick={() => setOrderType('delivery')}>🛵 Delivery</button>
                </div>
                <label>Nombre<input value={name} onChange={e => setName(e.target.value)} placeholder="Tu nombre" /></label>
                <label>Teléfono WhatsApp<input type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="0412 000 0000" /></label>
                {orderType === 'delivery' && (
                  <div className="pm-address-field">
                    <label>Dirección</label>
                    <div className="pm-address-wrap">
                      <textarea value={address} onChange={e => searchAddress(e.target.value)} onFocus={() => addressSuggestions.length > 0 && setShowSuggestions(true)} onBlur={() => setTimeout(() => setShowSuggestions(false), 200)} placeholder="Ej. Av 1 san jacinto, Maracay" />
                      <button type="button" className="pm-geo-btn" onClick={useMyLocation} disabled={locating} title="Usar mi ubicación"><Navigation size={18} className={locating ? 'is-spinning' : ''} /></button>
                    </div>
                    {geoCoords && <span className="pm-geo-coords">📍 {geoCoords.lat.toFixed(5)}, {geoCoords.lng.toFixed(5)}</span>}
                    {showSuggestions && addressSuggestions.length > 0 && (
                      <div className="pm-address-suggestions">
                        {addressSuggestions.map((s, i) => (
                          <button key={i} type="button" className="pm-suggestion-item" onMouseDown={() => selectSuggestion(s)}>
                            <MapPin size={14} />{s.display_name.length > 80 ? s.display_name.substring(0, 80) + '…' : s.display_name}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
                <label>Notas del pedido<textarea value={notes} maxLength={500} onChange={e => setNotes(e.target.value)} placeholder="Ej. Sin cebollín" /></label>
                {error && <p className="pm-form-error">{error}</p>}
                <button className="pm-btn-primary pm-btn-whatsapp" disabled={submitting} onClick={submitOrder}>{submitting ? 'Registrando…' : 'Registrar y abrir WhatsApp'} <ChevronRight size={18} /></button>
                <button className="pm-btn-back" onClick={() => setStep('cart')}>← Volver al carrito</button>
              </div>
            )}

            {step === 'sent' && (
              <div className="pm-success">
                <span><Check size={36} /></span>
                <h3>Tu pedido ya está en Full China</h3>
                <p>En WhatsApp solo debes enviar el mensaje que preparamos. El equipo verá el mismo código y confirmará tu orden.</p>
                <strong>{orderCode}</strong>
                <button className="pm-btn-primary" onClick={() => setCartOpen(false)}>Listo</button>
              </div>
            )}
          </aside>
        </div>
      )}
    </main>
  )
}
