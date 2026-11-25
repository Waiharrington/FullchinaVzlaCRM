import type { ReactElement } from 'react'
import { MoneyWithBcv } from '../../components/MoneyWithBcv'
import { type PaymentMethod } from '../../lib/dataService'
import { normalizeForSearch } from '../../lib/textFormat'
import { type ComandaStatus } from '../../lib/comandaWorkflow'
import { formatUsd } from '../../lib/money'
import { printThermalReceipt } from '../../lib/thermalReceipt'
import { Calendar, CheckCircle, CheckCircle2, User, ShoppingBag, Bike, Utensils, Plus, Trash2, MapPin, CreditCard, Printer, Phone, FileText, X, AlertTriangle, Globe, Timer, UserPlus, UserCheck } from 'lucide-react'
import { SplitPaymentMethod, ComandaOrder, thermalReceiptForComanda, formatElapsed, getInitials, extractMapsUrl } from '../comandas/model'
import type { Dispatch, SetStateAction, RefObject } from 'react'

export interface OrderDetailModalProps {
  closingSelectedOrder: boolean
  closeSelectedOrder: (then?: () => void) => void
  order: ComandaOrder
  orderTypeIcon: ReactElement
  isWebPending: boolean
  setDeletePin: Dispatch<SetStateAction<string>>
  setDeleteError: Dispatch<SetStateAction<string>>
  setShowDeleteModal: Dispatch<SetStateAction<boolean>>
  statusSteps: { key: ComandaStatus; label: string; time?: string; }[]
  currentStepIndex: number
  openAssociateCustomerModal: () => Promise<void>
  isDemoMode: boolean
  associatingCustomer: boolean
  deliveryFeeInput: string
  setDeliveryFeeInput: Dispatch<SetStateAction<string>>
  savingDelivery: boolean
  handleSaveDeliveryFee: () => Promise<void>
  orderItemsSectionRef: RefObject<HTMLDivElement | null>
  setShowAddItems: Dispatch<SetStateAction<boolean>>
  productImageByName: Map<string, string>
  removingItemId: string | null
  handleRemoveItem: (itemId: string) => Promise<void>
  removeError: string
  visibleNotes: string
  hasAdjustments: boolean
  subtotal: number
  paidMethodLabels: Record<PaymentMethod, string>
  preferredPayment: { methods: SplitPaymentMethod[]; label: string; } | null
  confirmingWebId: string | null
  handleConfirmWebOrder: (order: ComandaOrder) => Promise<void>
  advanceButton: false | ReactElement
  chargeButton: false | ReactElement
}

export function OrderDetailModal({ closingSelectedOrder, closeSelectedOrder, order, orderTypeIcon, isWebPending, setDeletePin, setDeleteError, setShowDeleteModal, statusSteps, currentStepIndex, openAssociateCustomerModal, isDemoMode, associatingCustomer, deliveryFeeInput, setDeliveryFeeInput, savingDelivery, handleSaveDeliveryFee, orderItemsSectionRef, setShowAddItems, productImageByName, removingItemId, handleRemoveItem, removeError, visibleNotes, hasAdjustments, subtotal, paidMethodLabels, preferredPayment, confirmingWebId, handleConfirmWebOrder, advanceButton, chargeButton }: OrderDetailModalProps) {
  return (
    <div className={`cmd-modal-overlay ${closingSelectedOrder ? 'closing' : ''}`} onClick={() => closeSelectedOrder()}>
            <div className="cmd-modal-container cmdx-detail animate-pop" role="dialog" aria-modal="true" aria-labelledby="cmdx-detail-title" onClick={e => e.stopPropagation()}>
              <header className="cmdx-head">
                <div className="cmdx-head-row">
                  <div className="cmdx-title">
                    <span className="cmdx-kicker">Comanda</span>
                    <h2 id="cmdx-detail-title">{order.orderNumber}</h2>
                    <span className="cmdx-chip">{orderTypeIcon} {order.orderType}</span>
                    {isWebPending && <span className="cmdx-chip is-warning"><Globe size={14} /> Pedido web por confirmar</span>}
                  </div>
                  <div className="cmdx-head-actions">
                    <button type="button" className="cmdx-icon-btn cmdx-print-btn" onClick={() => printThermalReceipt(thermalReceiptForComanda(order))} title={order.isPaid ? 'Reimprimir recibo' : 'Imprimir precuenta'}>
                      <Printer size={17} /><span>{order.isPaid ? 'Reimprimir recibo' : 'Imprimir precuenta'}</span>
                    </button>
                    <button type="button" className="cmdx-icon-btn is-danger" onClick={() => { setDeletePin(''); setDeleteError(''); setShowDeleteModal(true) }} title="Eliminar comanda" aria-label="Eliminar comanda">
                      <Trash2 size={17} />
                    </button>
                    <button type="button" className="cmdx-icon-btn" onClick={() => closeSelectedOrder()} title="Cerrar detalle" aria-label="Cerrar detalle de comanda">
                      <X size={19} />
                    </button>
                  </div>
                </div>

                <ol className="cmdx-steps" aria-label="Estado del pedido">
                  {statusSteps.map((step, index) => (
                    <li
                      key={step.key}
                      className={`cmdx-step ${index < currentStepIndex ? 'is-done' : ''} ${index === currentStepIndex ? 'is-current' : ''}`}
                      aria-current={index === currentStepIndex ? 'step' : undefined}
                    >
                      <span className="cmdx-step-dot">{index < currentStepIndex ? <CheckCircle2 size={14} /> : index + 1}</span>
                      <span className="cmdx-step-label">{step.label}{step.time && <small>{step.time}</small>}</span>
                    </li>
                  ))}
                </ol>
              </header>

              <div className="cmdx-main">
                <section className="cmdx-customer" aria-label="Cliente">
                  <span className="cmdx-avatar">{getInitials(order.customerName)}</span>
                  <div className="cmdx-customer-copy">
                    <strong>{order.customerName}</strong>
                    <span className="cmdx-customer-line">
                      <span><Phone size={12} /> {order.customerPhone || 'Sin teléfono'}</span>
                      <span><User size={12} /> {order.customerIdentification || 'Sin cédula'}</span>
                    </span>
                    <span className="cmdx-customer-line is-muted">
                      <span><Calendar size={12} /> {order.date ? `${order.date} · ` : ''}{order.time}</span>
                      <span className="cmdx-elapsed"><Timer size={12} /> hace {formatElapsed(order.elapsedMins)}</span>
                      <span>{order.source === 'web' ? 'Pedido desde la web' : `Atendido por ${order.attendedBy || 'Admin'}`}</span>
                    </span>
                  </div>
                  {order.customerId ? (
                    <span className="cmdx-customer-link is-linked"><UserCheck size={14} /> Cliente registrado</span>
                  ) : order.source !== 'web' && (
                    <button
                      type="button"
                      className="cmdx-customer-link"
                      onClick={() => void openAssociateCustomerModal()}
                      disabled={isDemoMode || associatingCustomer}
                      title="Asociar un cliente registrado a esta comanda"
                    >
                      <UserPlus size={14} /> Asociar cliente
                    </button>
                  )}
                </section>

                {order.orderType === 'Delivery' && (
                  <section className="cmdx-card">
                    <h3 className="cmdx-card-title"><MapPin size={16} /> Dirección de entrega</h3>
                    <div className="cmdx-address">
                      <div className="cmdx-address-copy">
                        <p>{order.address || 'Sin dirección registrada'}</p>
                        {order.reference && <small>Referencia: {order.reference}</small>}
                        {order.paymentReference && <small>Referencia de pago: {order.paymentReference}</small>}
                      </div>
                      {extractMapsUrl(order.notes) && (
                        <a className="cmdx-map-link" href={extractMapsUrl(order.notes)!} target="_blank" rel="noopener noreferrer">
                          <MapPin size={16} /> Ver ubicación
                        </a>
                      )}
                    </div>
                    {!order.isPaid && order.source !== 'web' && (
                      <div className="cmdx-delivery-fee">
                        <label htmlFor="cmdx-delivery-fee-input"><Bike size={14} /> Costo del delivery</label>
                        <div className="cmdx-delivery-fee-row">
                          <span>$</span>
                          <input
                            id="cmdx-delivery-fee-input"
                            type="text"
                            inputMode="decimal"
                            value={deliveryFeeInput}
                            onChange={(e) => setDeliveryFeeInput(e.target.value.replace(/[^0-9.,]/g, ''))}
                            placeholder="0,00"
                          />
                          <button type="button" disabled={savingDelivery} onClick={handleSaveDeliveryFee}>
                            {savingDelivery ? 'Guardando…' : 'Guardar'}
                          </button>
                        </div>
                        <small>Monto cotizado por WhatsApp según la ubicación. Se suma al total.</small>
                      </div>
                    )}
                    {!order.isPaid && order.source === 'web' && (
                      <small className="cmdx-hint"><Bike size={13} /> Confirma el pedido para poder agregar el costo del delivery.</small>
                    )}
                  </section>
                )}

                <section className="cmdx-card" ref={orderItemsSectionRef}>
                  <div className="cmdx-card-head">
                    <h3 className="cmdx-card-title"><ShoppingBag size={16} /> Productos <span className="cmdx-count">{order.items.reduce((sum, item) => sum + item.quantity, 0)}</span></h3>
                    {!order.isPaid && (
                      <button type="button" className="cmdx-add-btn" onClick={() => setShowAddItems(true)}>
                        <Plus size={15} /> Agregar
                      </button>
                    )}
                  </div>
                  <ul className="cmdx-items">
                    {order.items.map(item => {
                      const photo = item.name === 'Delivery' ? null : productImageByName.get(normalizeForSearch(item.name))
                      return (
                        <li key={item.id} className="cmdx-item">
                          <span className={`cmdx-item-thumb ${item.name === 'Delivery' ? 'is-delivery' : ''}`}>
                            {item.name === 'Delivery' ? <Bike size={18} /> : photo ? <img src={photo} alt="" /> : <Utensils size={18} />}
                          </span>
                          <span className="cmdx-item-qty">{item.quantity}×</span>
                          <span className="cmdx-item-copy">
                            <strong>{item.name}</strong>
                            {item.observations && <small className="cmdx-item-extras">{item.observations}</small>}
                            {item.quantity > 1 && <small className="cmdx-item-unit">{formatUsd(item.unitPrice || 0)} c/u</small>}
                          </span>
                          <MoneyWithBcv usd={item.subtotal || 0} rate={order.bcvRate} className="cmdx-item-price" compact />
                          {!order.isPaid && (
                            <button
                              type="button"
                              className="cmdx-item-remove"
                              title="Quitar producto"
                              aria-label={`Quitar ${item.name}`}
                              disabled={removingItemId === item.id}
                              onClick={() => handleRemoveItem(item.id)}
                            >
                              <Trash2 size={15} />
                            </button>
                          )}
                        </li>
                      )
                    })}
                  </ul>
                  {removeError && <p className="cmd-item-remove-error">{removeError}</p>}
                </section>

                {visibleNotes && (
                  <section className="cmdx-card cmdx-notes">
                    <h3 className="cmdx-card-title"><FileText size={16} /> Notas del pedido</h3>
                    {visibleNotes.split('\n').map((line, i) => <p key={i}>{line}</p>)}
                  </section>
                )}
              </div>

              <aside className="cmdx-summary" aria-label="Pago">
                {hasAdjustments && (
                  <dl className="cmdx-summary-rows">
                    <div><dt>Subtotal</dt><dd>{formatUsd(subtotal)}</dd></div>
                    {(order.serviceCharge || 0) > 0 && <div><dt>Servicio (10%)</dt><dd>{formatUsd(order.serviceCharge || 0)}</dd></div>}
                    {(order.discount || 0) > 0 && <div className="is-discount"><dt>Descuento</dt><dd>−{formatUsd(order.discount || 0)}</dd></div>}
                  </dl>
                )}
                <div className="cmdx-total">
                  <span>Total</span>
                  <MoneyWithBcv usd={order.totalAmount || 0} rate={order.bcvRate} className="cmdx-total-money" />
                </div>

                {order.isPaid ? (
                  <div className="cmdx-pay-state is-paid">
                    <strong><CheckCircle2 size={16} /> Pagado</strong>
                    {order.payments?.length
                      ? order.payments.map((payment, index) => (
                        <span key={`${payment.method}-${index}`}>{paidMethodLabels[payment.method] ?? payment.method} · {formatUsd(payment.amount)}</span>
                      ))
                      : <span>{order.paymentMethod}</span>}
                  </div>
                ) : order.creditAuthorized ? (
                  <div className="cmdx-pay-state is-credit">
                    <strong><CreditCard size={16} /> Crédito autorizado</strong>
                    <span>Queda en cuentas por cobrar.</span>
                  </div>
                ) : (
                  <div className="cmdx-pay-state is-pending">
                    <strong><AlertTriangle size={16} /> Pendiente de cobro · {formatUsd(order.totalAmount || 0)}</strong>
                    {preferredPayment && <span>El cliente pagará con <b>{preferredPayment.label}</b></span>}
                  </div>
                )}
              </aside>

              <footer className="cmdx-actions">
                {isWebPending ? (
                  <>
                    <button
                      type="button"
                      className="cmdx-action-primary"
                      disabled={confirmingWebId === order.webRequestId}
                      onClick={() => handleConfirmWebOrder(order)}
                    >
                      <CheckCircle size={18} /> {confirmingWebId === order.webRequestId ? 'Confirmando…' : 'Confirmar pedido'}
                    </button>
                    <small className="cmdx-actions-hint">Al confirmarlo podrás prepararlo, editarlo y cobrarlo.</small>
                  </>
                ) : advanceButton || chargeButton ? (
                  <>
                    {advanceButton}
                    {chargeButton}
                  </>
                ) : (
                  <p className="cmdx-actions-done"><CheckCircle2 size={16} /> Pedido entregado y pagado</p>
                )}
              </footer>
            </div>
          </div>
  )
}
