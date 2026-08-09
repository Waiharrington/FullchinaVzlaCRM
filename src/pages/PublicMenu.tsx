import { useEffect, useMemo, useState } from 'react'
import { Check, ChevronRight, MapPin, Minus, Plus, Search, ShoppingBag, Trash2, X } from 'lucide-react'
import { groupMenuProducts, type MenuProductGroup } from '../lib/menuGrouping'
import { createWebOrder, getPublicCatalog, type WebOrderCartItem } from '../lib/publicOrders'
import { getExchangeRates } from '../lib/rates'
import type { Product } from '../lib/dataService'
import './PublicMenu.css'

const CATEGORY_LABELS: Record<string, string> = {
  arroz: 'Arroces', bebida: 'Bebidas', extra: 'Extras', plato: 'Platos', wok: 'Wok',
  pollo_camaron: 'Pollo y camarón', racion: 'Raciones', sin_categoria: 'Otros',
}

const CATEGORY_IMAGES = [
  '/login-carousel/slide1.webp', '/login-carousel/slide2.webp', '/login-carousel/slide3.png',
  '/login-carousel/slide4.png', '/login-carousel/slide5.png', '/login-carousel/slide6.png',
]

function productImage(category: string) {
  const sum = [...category].reduce((acc, char) => acc + char.charCodeAt(0), 0)
  return CATEGORY_IMAGES[sum % CATEGORY_IMAGES.length]
}

function money(value: number) {
  return new Intl.NumberFormat('es-VE', { style: 'currency', currency: 'USD' }).format(value)
}

export function PublicMenu() {
  const [products, setProducts] = useState<Product[]>([])
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
  const [notes, setNotes] = useState('')
  const [bcvRate, setBcvRate] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [orderCode, setOrderCode] = useState('')

  useEffect(() => {
    Promise.all([getPublicCatalog(), getExchangeRates()])
      .then(([catalog, rates]) => { setProducts(catalog); setBcvRate(rates.bcv || null) })
      .catch(() => setError('No pudimos cargar el menú. Intenta nuevamente.'))
      .finally(() => setLoading(false))
  }, [])

  const categories = useMemo(() => ['Todos', ...new Set(products.map(product => product.category))], [products])
  const groups = useMemo(() => groupMenuProducts(products.filter(product => {
    const categoryMatch = activeCategory === 'Todos' || product.category === activeCategory
    const term = search.trim().toLowerCase()
    return categoryMatch && (!term || `${product.name} ${product.description || ''}`.toLowerCase().includes(term))
  })), [products, activeCategory, search])
  const itemCount = cart.reduce((sum, item) => sum + item.quantity, 0)
  const total = cart.reduce((sum, item) => sum + item.price * item.quantity, 0)

  const addProduct = (product: Product) => {
    setCart(current => {
      const existing = current.find(item => item.productId === product.id)
      return existing
        ? current.map(item => item.productId === product.id ? { ...item, quantity: item.quantity + 1 } : item)
        : [...current, { productId: product.id, productName: product.name, price: product.price, quantity: 1 }]
    })
    setSelectedGroup(null)
  }

  const updateQuantity = (productId: string, delta: number) => setCart(current => current
    .map(item => item.productId === productId ? { ...item, quantity: item.quantity + delta } : item)
    .filter(item => item.quantity > 0))

  const openGroup = (group: MenuProductGroup) => group.isGrouped ? setSelectedGroup(group) : addProduct(group.variants[0].product)

  const submitOrder = async () => {
    setError('')
    if (name.trim().length < 2) return setError('Escribe tu nombre.')
    if (phone.replace(/\D/g, '').length < 7) return setError('Escribe un teléfono válido.')
    if (orderType === 'delivery' && address.trim().length < 8) return setError('Escribe la dirección de entrega.')
    if (!cart.length) return setError('Tu carrito está vacío.')

    setSubmitting(true)
    try {
      const result = await createWebOrder({
        customerName: name.trim(), customerPhone: phone.trim(), orderType,
        deliveryAddress: address.trim(), notes: notes.trim(), items: cart, bcvRate,
        idempotencyKey: crypto.randomUUID(),
      })
      setOrderCode(result.code)
      const lines = cart.map(item => `• ${item.quantity}x ${item.productName} — ${money(item.price * item.quantity)}`)
      const message = [
        `Hola Full China 👋 Quiero confirmar mi pedido ${result.code}`,
        '', ...lines, '', `Total: ${money(result.total)}`,
        bcvRate ? `Ref. Bs.: ${(result.total * bcvRate).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '',
        `Modalidad: ${orderType === 'delivery' ? 'Delivery' : 'Retiro en el local'}`,
        orderType === 'delivery' ? `Dirección: ${address.trim()}` : '',
        notes.trim() ? `Notas: ${notes.trim()}` : '',
        '', `Nombre: ${name.trim()}`, `Teléfono: ${phone.trim()}`,
      ].filter(Boolean).join('\n')
      const configuredPhone = String(import.meta.env.VITE_FULLCHINA_WHATSAPP || '').replace(/\D/g, '')
      window.open(`https://wa.me/${configuredPhone}?text=${encodeURIComponent(message)}`, '_blank', 'noopener,noreferrer')
      setStep('sent')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No pudimos registrar el pedido.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="public-menu-page">
      <header className="public-hero">
        <div className="public-hero-actions"><button aria-label="Buscar" onClick={() => document.getElementById('menu-search')?.focus()}><Search /></button></div>
        <div className="public-store-card">
          <img className="public-logo" src="/logo.png" alt="Full China" />
          <div><span className="public-open"><i /> Abierto</span><h1>Full China</h1><p>El auténtico sabor chino sobre ruedas.</p><span><MapPin size={15} /> Maracay, Aragua</span></div>
        </div>
      </header>

      <nav className="public-categories" aria-label="Categorías del menú">
        {categories.map(category => <button key={category} className={activeCategory === category ? 'active' : ''} onClick={() => setActiveCategory(category)}>{CATEGORY_LABELS[category] || category}</button>)}
      </nav>

      <section className="public-content">
        <div className="public-search"><Search size={20} /><input id="menu-search" value={search} onChange={event => setSearch(event.target.value)} placeholder="¿Qué te provoca hoy?" /></div>
        <div className="public-section-heading"><div><small>HECHO AL MOMENTO</small><h2>{activeCategory === 'Todos' ? 'Nuestro menú' : CATEGORY_LABELS[activeCategory] || activeCategory}</h2></div><span>{groups.length} opciones</span></div>
        {loading ? <div className="public-state">Cargando sabores…</div> : error && products.length === 0 ? <div className="public-state error">{error}</div> : (
          <div className="public-products">
            {groups.map(group => <article className="public-product" key={group.key} onClick={() => openGroup(group)}>
              <img src={productImage(group.category)} alt="" />
              <div className="public-product-copy"><div><h3>{group.name}</h3>{group.isGrouped && <p>{group.variants.map(item => item.label).join(' · ')}</p>}</div><div className="public-product-footer"><strong>{group.isGrouped && group.minPrice !== group.maxPrice ? 'Desde ' : ''}{money(group.minPrice)}</strong><button aria-label={`Agregar ${group.name}`}><Plus /></button></div></div>
            </article>)}
          </div>
        )}
      </section>

      <button className="public-cart-fab" onClick={() => { setCartOpen(true); setStep('cart') }} disabled={!itemCount}><ShoppingBag /><span>Ver carrito ({itemCount})</span><strong>{money(total)}</strong></button>

      {welcomeOpen && <div className="public-modal-backdrop"><section className="public-welcome"><img src="/logo.png" alt="Full China" /><h2>¡Bienvenido al menú de Full China!</h2><p>Arma tu pedido aquí. No tienes que pagar en esta página: al final te conectamos con Full China por WhatsApp para confirmarlo.</p><button onClick={() => setWelcomeOpen(false)}>Sí, quiero ver el menú</button><button className="link" onClick={() => { localStorage.setItem('fullchina_menu_welcome', 'hidden'); setWelcomeOpen(false) }}>No volver a mostrar</button></section></div>}

      {selectedGroup && <div className="public-modal-backdrop" onClick={() => setSelectedGroup(null)}><section className="public-variant-modal" onClick={event => event.stopPropagation()}><button className="public-close" onClick={() => setSelectedGroup(null)}><X /></button><small>ELIGE TU PRESENTACIÓN</small><h2>{selectedGroup.name}</h2>{selectedGroup.variants.map(({ product, label }) => <button className="public-variant" key={product.id} onClick={() => addProduct(product)}><span>{product.emoji}<span><strong>{label}</strong><small>{product.description}</small></span></span><b>{money(product.price)} <Plus size={18} /></b></button>)}</section></div>}

      {cartOpen && <div className="public-drawer-backdrop" onClick={() => setCartOpen(false)}><aside className="public-cart-drawer" onClick={event => event.stopPropagation()}>
        <header><div><small>{step === 'sent' ? 'PEDIDO REGISTRADO' : 'TU PEDIDO'}</small><h2>{step === 'details' ? '¿Cómo te lo entregamos?' : step === 'sent' ? orderCode : `${itemCount} producto${itemCount === 1 ? '' : 's'}`}</h2></div><button onClick={() => setCartOpen(false)}><X /></button></header>
        {step === 'cart' && <><div className="public-cart-items">{cart.map(item => <div className="public-cart-item" key={item.productId}><div><strong>{item.productName}</strong><span>{money(item.price)}</span></div><div className="public-qty"><button onClick={() => updateQuantity(item.productId, -1)}>{item.quantity === 1 ? <Trash2 /> : <Minus />}</button><b>{item.quantity}</b><button onClick={() => updateQuantity(item.productId, 1)}><Plus /></button></div><strong>{money(item.price * item.quantity)}</strong></div>)}</div><div className="public-total"><span>Total estimado</span><strong>{money(total)}</strong>{bcvRate && <small>Ref. Bs. {(total * bcvRate).toLocaleString('es-VE', { minimumFractionDigits: 2 })}</small>}</div><button className="public-primary" disabled={!cart.length} onClick={() => setStep('details')}>Continuar <ChevronRight /></button></>}
        {step === 'details' && <div className="public-checkout"><div className="public-order-types"><button className={orderType === 'takeaway' ? 'active' : ''} onClick={() => setOrderType('takeaway')}>🥡 Retirar</button><button className={orderType === 'delivery' ? 'active' : ''} onClick={() => setOrderType('delivery')}>🛵 Delivery</button></div><label>Nombre<input value={name} onChange={event => setName(event.target.value)} placeholder="Tu nombre" /></label><label>Teléfono WhatsApp<input type="tel" value={phone} onChange={event => setPhone(event.target.value)} placeholder="0412 000 0000" /></label>{orderType === 'delivery' && <label>Dirección<textarea value={address} onChange={event => setAddress(event.target.value)} placeholder="Dirección y punto de referencia" /></label>}<label>Notas del pedido<textarea value={notes} maxLength={500} onChange={event => setNotes(event.target.value)} placeholder="Ej. Sin cebollín" /></label>{error && <p className="public-form-error">{error}</p>}<button className="public-primary whatsapp" disabled={submitting} onClick={submitOrder}>{submitting ? 'Registrando…' : 'Registrar y abrir WhatsApp'} <ChevronRight /></button><button className="public-back" onClick={() => setStep('cart')}>Volver al carrito</button></div>}
        {step === 'sent' && <div className="public-success"><span><Check /></span><h3>Tu pedido ya está en Full China</h3><p>En WhatsApp solo debes enviar el mensaje que preparamos. El equipo verá el mismo código y confirmará tu orden.</p><strong>{orderCode}</strong><button className="public-primary" onClick={() => setCartOpen(false)}>Listo</button></div>}
      </aside></div>}
    </main>
  )
}
