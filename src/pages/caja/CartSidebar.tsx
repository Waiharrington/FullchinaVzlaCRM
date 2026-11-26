import type { CustomerOption } from './model'
import { type ReactNode } from 'react'
import { MoneyWithBcv } from '../../components/MoneyWithBcv'
import { defaultPaymentForOrderType, type OrderType } from '../../lib/orderDefaults'
import { type Product, type CartItem } from '../../lib/dataService'
import { X, Check, ShoppingCart, Flame, WalletCards, PencilLine, Plus, Minus, Trash2, Search, Bike } from 'lucide-react'
import { formatProductTitle } from '../../lib/textFormat'
import { TABLE_COUNT, ORDER_TYPE_LABELS, ActivePaymentMethod, PAYMENT_DETAILS, PAYMENT_METHODS, FOOD_IMAGES, getProductImage } from '../caja/model'
import type { Dispatch, SetStateAction } from 'react'

export interface CartSidebarProps {
  mobileCartOpen: boolean
  embedded: boolean
  isPhoneViewport: boolean
  mobileCartClosing: boolean
  orderType: OrderType
  Date: DateConstructor
  closeMobileCart: () => void
  cart: CartItem[]
  products: Product[]
  updateQty: (lineId: string, delta: number) => void
  removeFromCart: (lineId: string) => void
  orderNotes: string
  setOrderNotes: Dispatch<SetStateAction<string>>
  selectedCustomer: CustomerOption | null
  setSelectedCustomer: Dispatch<SetStateAction<CustomerOption | null>>
  setCustomerName: Dispatch<SetStateAction<string>>
  setShowCustomerDropdown: Dispatch<SetStateAction<boolean>>
  customerName: string
  loadCustomers: () => void
  setCustomerCreateError: Dispatch<SetStateAction<string>>
  setShowNewClientModal: Dispatch<SetStateAction<boolean>>
  showCustomerDropdown: boolean
  filteredCustomers: CustomerOption[]
  Object: ObjectConstructor
  Array: ArrayConstructor
  setOrderType: Dispatch<SetStateAction<OrderType>>
  setSelectedPaymentTab: Dispatch<SetStateAction<ActivePaymentMethod | "split">>
  setTableNumber: Dispatch<SetStateAction<number | null>>
  occupiedTables: Set<number>
  tableNumber: number | null
  deliveryFee: string
  setDeliveryFee: Dispatch<SetStateAction<string>>
  deliveryFeeUsd: number
  bcvRate: number | null
  subtotal: number
  selectedPaymentTab: ActivePaymentMethod | "split"
  paying: boolean
  handleOpenPaymentModal: (preferredMethod?: ActivePaymentMethod | "split") => Promise<void>
  total: number
  payError: string
  handleSendToKitchen: () => Promise<void>
}

export function CartSidebar({ mobileCartOpen, embedded, isPhoneViewport, mobileCartClosing, orderType, Date, closeMobileCart, cart, products, updateQty, removeFromCart, orderNotes, setOrderNotes, selectedCustomer, setSelectedCustomer, setCustomerName, setShowCustomerDropdown, customerName, loadCustomers, setCustomerCreateError, setShowNewClientModal, showCustomerDropdown, filteredCustomers, Object, Array, setOrderType, setSelectedPaymentTab, setTableNumber, occupiedTables, tableNumber, deliveryFee, setDeliveryFee, deliveryFeeUsd, bcvRate, subtotal, selectedPaymentTab, paying, handleOpenPaymentModal, total, payError, handleSendToKitchen }: CartSidebarProps) {
  return (
    <div className={`cart-sidebar${mobileCartOpen && (!embedded || isPhoneViewport) ? ' mobile-cart-open' : ''}${mobileCartOpen && isPhoneViewport ? ' cart-sidebar--modal' : ''}${mobileCartClosing ? ' cart-sidebar--closing' : ''}`} onClick={(event) => event.stopPropagation()}>

          <div className="cart-sidebar-header">

            <div className="cart-order-title-group">

              <span className="cart-eyebrow">Comanda activa</span>

              <h3 className="cart-order-title">

                Pedido <span className="cart-order-number">#FC-Nuevo</span>

              </h3>

              <div className="cart-header-badges">

                <span className="cart-badge-type">{ORDER_TYPE_LABELS[orderType].label}</span>

                <span className="cart-time">{new Date().toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit', hour12: true })}</span>

              </div>

            </div>

            <button type="button" className="mobile-cart-close" onClick={closeMobileCart} aria-label="Cerrar pedido">

              <X size={20} />

            </button>

          </div>



          <div className="cart-sidebar-body">

            {/* Cart Items */}

            {cart.length === 0 ? (

              <div className="empty-cart-sidebar">

                <span className="empty-cart-icon"><ShoppingCart size={28} /></span>

                <strong>Tu pedido está vacío</strong>

                <p>Selecciona productos del menú para comenzar.</p>

              </div>

            ) : (

              <div className="cart-items-list">

                {cart.map((item) => {

                  const prod = products.find(p => p.id === item.productId)

                  const imgUrl = prod ? getProductImage(prod) : FOOD_IMAGES.default



                  const lineKey = item.lineId ?? item.productId

                  const mods = item.selectedModifiers && item.selectedModifiers.length > 0

                    ? item.selectedModifiers.map((m) => `${m.optionName}${m.quantity > 1 ? ` ×${m.quantity}` : ''}`).join(', ')

                    : null

                  return (

                    <div key={lineKey} className="cart-item-row">

                      <img src={imgUrl} alt={item.productName} className="cart-item-thumb" loading="lazy" decoding="async" />

                      <div className="cart-item-details">

                        <span className="cart-item-name">{formatProductTitle(item.productName)}</span>

                        {mods && <span className="cart-item-sub">{mods}</span>}

                      </div>

                      <div className="cart-item-controls">

                        <button className="qty-btn-sm" aria-label={`Restar ${item.productName}`} onClick={() => updateQty(lineKey, -1)}><Minus size={18} /></button>

                        <span className="qty-display">{item.quantity}</span>

                        <button className="qty-btn-sm" aria-label={`Agregar ${item.productName}`} onClick={() => updateQty(lineKey, 1)}><Plus size={18} /></button>

                      </div>

                      <MoneyWithBcv usd={item.price * item.quantity} className="cart-item-price" compact />

                      <button className="cart-item-remove" aria-label={`Eliminar ${item.productName}`} onClick={() => removeFromCart(lineKey)}><Trash2 size={18} /></button>

                    </div>

                  )

                })}

              </div>

            )}



            {/* Notes */}

            <div className="cart-field mt-2">

              <div className="notes-wrap">

                <span className="notes-icon"><PencilLine size={15} /></span>

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

            <div className="cart-section-group mt-2">

              <div className="cart-field-col customer-input-col">

                <label className="cart-label">Cliente</label>

                {selectedCustomer ? (

                  <div className="customer-selected-chip">

                    <div className="customer-chip-avatar">{selectedCustomer.initials}</div>

                    <div className="customer-chip-info">

                      <span className="customer-chip-badge"><Check size={12} /> Cliente seleccionado</span>

                      <span className="customer-chip-name">{selectedCustomer.name}</span>

                      {selectedCustomer.phone && <span className="customer-chip-phone">{selectedCustomer.phone}</span>}

                    </div>

                    <button

                      type="button"

                      className="customer-chip-clear"

                      title="Quitar cliente"

                      aria-label="Quitar cliente"

                      onClick={() => {

                        setSelectedCustomer(null)

                        setCustomerName('')

                        setShowCustomerDropdown(false)

                      }}

                    >

                      <X size={15} />

                    </button>

                  </div>

                ) : (

                <div className="customer-input-wrap">

                  <span className="input-search-icon"><Search size={15} /></span>

                  <input

                    type="text"

                    placeholder="Buscar cliente (opcional)"

                    value={customerName}

                    onChange={(e) => {

                      setCustomerName(e.target.value)

                      setSelectedCustomer(null)

                      setShowCustomerDropdown(true)

                    }}

                    onFocus={() => {

                      loadCustomers()

                      setShowCustomerDropdown(true)

                    }}

                    onBlur={() => {

                      setShowCustomerDropdown(false)

                    }}

                    className="customer-input"

                  />

                  <button

                    type="button"

                    className="customer-add-btn"

                    onClick={() => {

                      setCustomerCreateError('')

                      setShowNewClientModal(true)

                    }}

                    title="Nuevo cliente"

                  >

                    <Plus size={18} />

                  </button>

                </div>

                )}



                {/* Autocomplete Dropdown List */}

                {!selectedCustomer && showCustomerDropdown && filteredCustomers.length > 0 && (

                  <div className="customer-dropdown-menu">

                    {filteredCustomers.map((cust) => (

                      <div

                        key={cust.id}

                        className="customer-dropdown-item"

                        onPointerDown={(e) => {

                          e.preventDefault(); // prevent blur

                          setCustomerName(cust.name)

                          setSelectedCustomer(cust)

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

                  {(Object.entries(ORDER_TYPE_LABELS) as Array<[OrderType, { label: string; icon: ReactNode }]>).map(([key, val]) => (

                    <button

                        key={key}

                        className={`order-type-card ${orderType === key ? 'active' : ''}`}

                        onClick={() => {

                          setOrderType(key)

                          setSelectedPaymentTab(defaultPaymentForOrderType(key))

                          if (key !== 'dine-in') setTableNumber(null)

                        }}

                      >

                        <span className="order-type-icon">{val.icon}</span>

                        <span className="order-type-text">{val.label}</span>

                      </button>

                  ))}

                </div>

              </div>



              {orderType === 'dine-in' && (

                <div className="cart-field-col mt-2">

                  <label className="cart-label">Número de mesa</label>

                  <div className="table-picker-grid">

                    {Array.from({ length: TABLE_COUNT }, (_, i) => i + 1).map((n) => {

                      const isOccupied = occupiedTables.has(n)

                      const isSelected = tableNumber === n

                      return (

                        <button

                          key={n}

                          type="button"

                          disabled={isOccupied && !isSelected}

                          className={`table-picker-btn ${isSelected ? 'selected' : ''} ${isOccupied && !isSelected ? 'occupied' : ''}`}

                          onClick={() => setTableNumber(n)}

                          title={isOccupied ? `Mesa ${n} · con pedido abierto` : `Mesa ${n}`}

                        >

                          {n}

                        </button>

                      )

                    })}

                  </div>

                  {occupiedTables.size > 0 && (

                    <small className="delivery-fee-hint">Resaltadas: pedido sin cobrar.</small>

                  )}

                </div>

              )}



              {orderType === 'delivery' && (

                <div className="cart-field-col mt-2">

                  <label className="cart-label">Costo del delivery (USD)</label>

                  <div className="delivery-fee-input">

                    <Bike size={16} className="delivery-fee-icon" />

                    <span className="delivery-fee-currency">$</span>

                    <input

                      type="text"

                      inputMode="decimal"

                      value={deliveryFee}

                      onChange={e => setDeliveryFee(e.target.value.replace(/[^0-9.,]/g, ''))}

                      placeholder="0,00"

                    />

                    {deliveryFeeUsd > 0 && bcvRate && (

                      <span className="delivery-fee-bs">Bs. {(deliveryFeeUsd * bcvRate).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>

                    )}

                  </div>

                  <small className="delivery-fee-hint">Monto cotizado por WhatsApp según la ubicación del cliente.</small>

                </div>

              )}

            </div>

          </div>



          <div className="cart-sidebar-footer">

            {/* Totals Breakdown */}

            <div className="cart-totals-card">

              <div className="cart-total-row">

                <span className="total-label">Subtotal</span>

                <MoneyWithBcv usd={subtotal} className="total-val" compact />

              </div>

              <div className="cart-total-row">

                <span className="total-label">Descuento</span>

                <MoneyWithBcv usd={0} className="total-val" compact />

              </div>

              {orderType === 'delivery' && deliveryFeeUsd > 0 && (

                <div className="cart-total-row">

                  <span className="total-label">Delivery</span>

                  <MoneyWithBcv usd={deliveryFeeUsd} className="total-val" compact />

                </div>

              )}

              <div className="cart-divide-row">

                {(() => {

                  const currentPay = PAYMENT_DETAILS[selectedPaymentTab] || PAYMENT_DETAILS.card

                  return (

                    <button

                      type="button"

                      className="divide-payment-link"

                      disabled={cart.length === 0 || paying}

                      onClick={() => handleOpenPaymentModal(selectedPaymentTab)}

                    >

                      <span className="divide-payment-icon">{currentPay.icon}</span>

                      <span className="divide-payment-copy">

                        <strong>{currentPay.label}</strong>

                        <small>{currentPay.desc}</small>

                      </span>

                      <span className="divide-payment-arrow">›</span>

                    </button>

                  )

                })()}

              </div>

              <div className="cart-total-row total-final-row">

                <span className="final-label">Total</span>

                <MoneyWithBcv usd={total} className="final-amount" />

              </div>

            </div>



            {payError && <p className="pay-error">{payError}</p>}



            {/* Action buttons */}

            <div className="cart-action-buttons mt-2">

              <button

                className="btn-pay-red"

                aria-label="Cobrar pedido"

                disabled={cart.length === 0 || paying}

                onClick={() => handleOpenPaymentModal(selectedPaymentTab)}

              >

                <WalletCards size={18} />

                <span className="cart-action-label-full">Cobrar pedido</span>

                <span className="cart-action-label-short" aria-hidden="true">Cobrar</span>

              </button>

              <button

                className="btn-kitchen-red"

                aria-label="Enviar a cocina"

                disabled={cart.length === 0 || paying}

                onClick={handleSendToKitchen}

              >

                <Flame size={18} />

                <span className="cart-action-label-full">Enviar a cocina</span>

                <span className="cart-action-label-short" aria-hidden="true">Cocina</span>

              </button>

            </div>



            {/* Accepted Payment Methods at bottom */}

            <div className="payment-accepted-section mt-2">

              <span className="accepted-title">Formas de pago aceptadas</span>

              <div className="payment-badges-row">

                {PAYMENT_METHODS.filter(pm => pm.method !== 'split').map((pm) => (

                  <span key={pm.method} className="payment-badge-pill">

                    {pm.icon} {pm.label}

                  </span>

                ))}

              </div>

            </div>

          </div>

        </div>
  )
}
