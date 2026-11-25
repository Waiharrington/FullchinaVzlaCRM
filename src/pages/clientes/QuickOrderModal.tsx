import { useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { Minus, Plus, Search, X } from 'lucide-react'
import { StyledSelect } from '../../components/StyledSelect'
import { alertDialog } from '../../components/ConfirmDialog'
import { checkout, getCredits, getCustomerOrders, type CartItem, type Credit, type CustomerOrderSummary, type PaymentMethod, type Product } from '../../lib/dataService'
import { formatProductTitle } from '../../lib/textFormat'
import { formatUsdText } from './model'
import { addProductToCart, adjustCartQuantity, cartTotal, filterQuickOrderProducts, removeCartLine } from './quickOrder'

interface QuickOrderModalProps {
  bcvRate: number | null
  client: { id: string; name: string }
  isDemoMode: boolean
  onClose: () => void
  onCreated: (orders: CustomerOrderSummary[], credits: Credit[]) => void
  products: Product[]
  userId: string | undefined
}

// Nuevo pedido embebido en la ficha del cliente (no navega a Caja). Guarda su
// propio carrito y estado de envío; el padre solo decide cuándo mostrarlo.
export function QuickOrderModal({ bcvRate, client, isDemoMode, onClose, onCreated, products, userId }: QuickOrderModalProps) {
  const [search, setSearch] = useState('')
  const [cart, setCart] = useState<CartItem[]>([])
  const [orderType, setOrderType] = useState<'dine-in' | 'takeaway' | 'delivery'>('takeaway')
  const [payment, setPayment] = useState<PaymentMethod>('cash')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [closing, setClosing] = useState(false)

  const visibleProducts = useMemo(() => filterQuickOrderProducts(products, search), [products, search])
  const total = cartTotal(cart)

  const requestClose = () => {
    if (closing) return
    setClosing(true)
    window.setTimeout(onClose, 200)
  }

  const handleSubmit = async () => {
    if (isDemoMode || cart.length === 0 || !userId) return
    setSaving(true)
    setError('')
    try {
      await checkout({ items: cart, method: payment, bcvRate, userId, orderType, customerName: client.name })
      requestClose()
      const [orders, freshCredits] = await Promise.all([getCustomerOrders(client.id, client.name), getCredits()])
      onCreated(orders, freshCredits)
      void alertDialog({ message: 'Pedido creado correctamente' })
    } catch (e) {
      console.error('Error creando pedido rápido:', e)
      setError(e instanceof Error ? e.message : 'Error al crear el pedido')
    } finally {
      setSaving(false)
    }
  }

  return createPortal(
    <div className={`modal-overlay-dark ${closing ? 'closing' : ''}`} onClick={requestClose}>
      <div className="client-modal-box quick-order-modal animate-pop clientes-modal-glow" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header-line clientes-modal-header-glow">
          <div>
            <h3 className="modal-title">Nuevo pedido</h3>
            <p className="modal-sub-desc">Para {client.name}</p>
          </div>
        </div>

        <div className="quick-order-search-row mt-3">
          <Search size={15} className="ic" />
          <input
            type="text"
            placeholder="Buscar producto…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="modal-input-dark with-left-icon"
          />
        </div>

        <div className="quick-order-product-list">
          {visibleProducts.map((p) => (
            <button type="button" key={p.id} className="quick-order-product-row" onClick={() => setCart(prev => addProductToCart(prev, p))}>
              {p.imageUrl
                ? <img src={p.imageUrl} alt="" className="quick-order-product-thumb" />
                : <span className="quick-order-product-thumb quick-order-product-emoji">{p.emoji || '🍽️'}</span>}
              <span className="quick-order-product-name">{formatProductTitle(p.name)}</span>
              <span className="quick-order-product-price">{formatUsdText(p.price)}</span>
              <Plus size={14} />
            </button>
          ))}
          {visibleProducts.length === 0 && <p className="modal-sub-desc">Sin productos para mostrar.</p>}
        </div>

        {cart.length > 0 && (
          <div className="quick-order-cart mt-3">
            {cart.map((item) => (
              <div className="quick-order-cart-row" key={item.lineId}>
                <span className="quick-order-cart-name">{formatProductTitle(item.productName)}</span>
                <div className="quick-order-qty-controls">
                  <button type="button" onClick={() => setCart(prev => adjustCartQuantity(prev, item.lineId as string, -1))}><Minus size={12} /></button>
                  <span>{item.quantity}</span>
                  <button type="button" onClick={() => setCart(prev => adjustCartQuantity(prev, item.lineId as string, 1))}><Plus size={12} /></button>
                </div>
                <span className="quick-order-cart-sub">{formatUsdText(item.price * item.quantity)}</span>
                <button type="button" className="quick-order-remove-btn" onClick={() => setCart(prev => removeCartLine(prev, item.lineId as string))}><X size={14} /></button>
              </div>
            ))}
          </div>
        )}

        <div className="quick-order-config-row mt-3">
          <div className="field">
            <label className="field-label-white">Tipo de pedido</label>
            <StyledSelect
              className="modal-select-dark"
              value={orderType}
              onChange={(e) => setOrderType(e.target.value as 'dine-in' | 'takeaway' | 'delivery')}
            >
              <option value="takeaway">Para llevar</option>
              <option value="dine-in">Mesa</option>
              <option value="delivery">Delivery</option>
            </StyledSelect>
          </div>
          <div className="field">
            <label className="field-label-white">Método de pago</label>
            <StyledSelect
              className="modal-select-dark"
              value={payment}
              onChange={(e) => setPayment(e.target.value as PaymentMethod)}
            >
              <option value="cash">Efectivo</option>
              <option value="mobile">Pago móvil</option>
              <option value="card">Punto</option>
              <option value="transfer">Transferencia</option>
              <option value="binance">Binance</option>
              <option value="other">Otro</option>
            </StyledSelect>
          </div>
        </div>

        {error && <p className="login-error mt-2">{error}</p>}
        {isDemoMode && <p className="modal-sub-desc quick-order-demo-note">Vista previa — en modo demo no se crean pedidos reales.</p>}

        <div className="quick-order-total-row mt-3">
          <span>Total</span>
          <span className="quick-order-total-val">{formatUsdText(total)}</span>
        </div>

        <div className="modal-actions-row-right mt-4">
          <button type="button" className="btn-modal-cancel" onClick={requestClose}>Cancelar</button>
          <button
            type="button"
            className="btn-modal-submit-red"
            disabled={cart.length === 0 || saving || isDemoMode}
            title={isDemoMode ? 'Deshabilitado en modo demo' : undefined}
            onClick={handleSubmit}
          >
            {saving ? 'Creando…' : 'Crear pedido'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
