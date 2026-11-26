import { createPortal } from 'react-dom'
import { MoneyWithBcv } from '../../components/MoneyWithBcv'
import { PaymentMethodSelect } from '../../components/PaymentMethodSelect'
import { StyledSelect } from '../../components/StyledSelect'
import { CashChangeSummary } from '../../components/CashChangeSummary'
import { formatUsd, formatVes, parseMoneyInput } from '../../lib/money'
import { printThermalReceipt } from '../../lib/thermalReceipt'
import { CheckCircle, User, Plus, Printer, X, QrCode, ShieldCheck } from 'lucide-react'
import { PAYMENT_METHODS, SPLIT_PAYMENT_METHODS, usesBolivares, requiresPaymentReference, paymentReferenceLabel, paymentInputToUsd, usdToPaymentInput, thermalReceiptForComanda, type ActivePaymentMethod, type ComandaOrder } from './model'
import type { usePaymentForm } from './usePaymentForm'

interface PaymentModalProps {
  form: ReturnType<typeof usePaymentForm>
  closingPayment: boolean
  paymentOrder: ComandaOrder
  paymentRate: number | null
  paymentDue: number
  splitPrimaryAmountUsd: number
  splitSecondaryAmountUsd: number
  syncSplitFromPrimary: (input: string) => void
  syncSplitFromSecondary: (input: string) => void
  handleSelectPaymentTab: (method: ActivePaymentMethod | 'split') => void
  handleConfirmOrderPayment: () => void | Promise<void>
  closePaymentModal: () => void
}

export function PaymentModal({ form, closingPayment, paymentOrder, paymentRate, paymentDue, splitPrimaryAmountUsd, splitSecondaryAmountUsd, syncSplitFromPrimary, syncSplitFromSecondary, handleSelectPaymentTab, handleConfirmOrderPayment, closePaymentModal }: PaymentModalProps) {
  const { accountsForMethod, paymentAccountId, setPaymentAccountId, splitPrimaryAccountId, setSplitPrimaryAccountId, splitSecondaryAccountId, setSplitSecondaryAccountId, selectedPaymentTab, personalAccounts, paymentPersonalAccountId, setPaymentPersonalAccountId, refNumber, setRefNumber, extraRefs, setExtraRefs, amountReceived, setAmountReceived, amountReceivedSecondary, setAmountReceivedSecondary, splitPrimaryCashReceived, setSplitPrimaryCashReceived, splitSecondaryCashReceived, setSplitSecondaryCashReceived, splitPrimaryCashCurrency, setSplitPrimaryCashCurrency, splitSecondaryCashCurrency, setSplitSecondaryCashCurrency, splitPrimaryMethod, setSplitPrimaryMethod, splitSecondaryMethod, setSplitSecondaryMethod, splitPrimaryReference, setSplitPrimaryReference, splitSecondaryReference, setSplitSecondaryReference, paymentNote, setPaymentNote, paymentError, setPaymentError, creditAuthorizationPin, setCreditAuthorizationPin, paying, cashCurrency, setCashCurrency, financialAccounts, changeAccountId, setChangeAccountId } = form
        return createPortal(
      <div className={`modal-overlay-dark ${closingPayment ? 'closing' : ''}`} onClick={() => closePaymentModal()}>
        <div className="payment-modal-box animate-pop" onClick={(e) => e.stopPropagation()}>
          {/* Modal Header */}
          <div className="payment-modal-header">
            <h2 className="payment-modal-title">
              Cobrar pedido <span className="payment-order-tag">{paymentOrder.orderNumber}</span>
            </h2>
          </div>

          {/* Payment Method Tabs */}
          <div className="payment-tabs-bar">
            {PAYMENT_METHODS.map((pm) => (
              <button
                key={pm.method}
                className={`payment-tab-btn ${selectedPaymentTab === pm.method ? 'active' : ''}`}
                onClick={() => handleSelectPaymentTab(pm.method)}
              >
                <span>{pm.icon}</span>
                <span>{pm.label}</span>
              </button>
            ))}
          </div>

          {/* Modal Body */}
          <div className="payment-modal-body">
            {/* Left Column: Details */}
            <div className="payment-body-left">
              <h3 className="payment-sub-heading">
                Detalles del pago ({PAYMENT_METHODS.find(p => p.method === selectedPaymentTab)?.label})
              </h3>

              {selectedPaymentTab === 'credit' && (
                <div className="payment-field-group mt-2">
                  <p className="payment-hint-sub">La comanda quedará registrada en cuentas por cobrar. Este registro no representa dinero recibido.</p>
                  <label className="payment-field-label">PIN de autorización *</label>
                  <input
                    type="password"
                    inputMode="numeric"
                    autoComplete="new-password"
                    maxLength={4}
                    className="payment-field-input"
                    value={creditAuthorizationPin}
                    onChange={event => setCreditAuthorizationPin(event.target.value.replace(/\D/g, '').slice(0, 4))}
                    placeholder="4 dígitos"
                  />
                  {!paymentOrder.customerId && <span className="payment-error-message">Asocia un cliente antes de autorizar el crédito.</span>}
                </div>
              )}

              {selectedPaymentTab === 'personal_account' ? (
                <div className="payment-field-group mt-2">
                  <label className="payment-field-label">Cuenta personal *</label>
                  <select className="payment-field-input" value={paymentPersonalAccountId} onChange={event => setPaymentPersonalAccountId(event.target.value)}>
                    <option value="">Selecciona una cuenta personal</option>
                    {personalAccounts.filter(account => account.isActive).map(account => <option key={account.id} value={account.id}>{account.name}</option>)}
                  </select>
                  <span className="payment-hint-sub">Consumo interno; descuenta inventario y queda fuera de caja y ventas.</span>
                </div>
              ) : selectedPaymentTab !== 'split' && selectedPaymentTab !== 'credit' && (
                <div className="payment-field-group mt-2">
                  <label className="payment-field-label">Cuenta donde ingresa el dinero *</label>
                  <StyledSelect value={paymentAccountId} onChange={(e) => setPaymentAccountId(e.target.value)}>
                    <option value="">Selecciona una cuenta</option>
                    {accountsForMethod(selectedPaymentTab).map((a) => <option key={a.id} value={a.id}>{a.name} · {a.currency}</option>)}
                  </StyledSelect>
                </div>
              )}
              {selectedPaymentTab !== 'personal_account' && selectedPaymentTab !== 'split' && selectedPaymentTab !== 'credit' && requiresPaymentReference(selectedPaymentTab) && (
              <div className="payment-field-group mt-2">
                <label className="payment-field-label">
                  {paymentReferenceLabel(selectedPaymentTab)}
                </label>
                <div className="payment-ref-row">
                  <div className="payment-input-wrap" style={{ flex: 1 }}>
                    <input
                      type="text"
                      className="payment-field-input"
                      value={refNumber}
                      onChange={(e) => setRefNumber(e.target.value)}
                      placeholder="Ej. 876543210"
                    />
                    <QrCode size={16} className="qr-icon-right" />
                  </div>
                  <button type="button" className="cmd-add-ref-btn" title="Agregar referencia" onClick={() => setExtraRefs(prev => [...prev, ''])}>
                    <Plus size={18} />
                  </button>
                </div>
                {extraRefs.map((ref, idx) => (
                  <div className="payment-ref-row mt-1" key={idx}>
                    <div className="payment-input-wrap" style={{ flex: 1 }}>
                      <input
                        type="text"
                        className="payment-field-input"
                        value={ref}
                        onChange={(e) => { const v = e.target.value; setExtraRefs(prev => prev.map((r, i) => i === idx ? v : r)) }}
                        placeholder={`Referencia ${idx + 2}`}
                      />
                    </div>
                    <button type="button" className="cmd-remove-ref-btn" title="Quitar" onClick={() => setExtraRefs(prev => prev.filter((_, i) => i !== idx))}>
                      <X size={16} />
                    </button>
                  </div>
                ))}
              </div>
              )}

              {selectedPaymentTab === 'split' && (
                <div className="split-payment-grid mt-2">
                  <section className="split-method-card">
                    <div className="split-method-heading"><span className="split-method-number">1</span><span>Primer método</span></div>
                    <PaymentMethodSelect ariaLabel="Primer método de pago" value={splitPrimaryMethod} options={SPLIT_PAYMENT_METHODS} disabledMethod={splitSecondaryMethod} onChange={(nextMethod) => {
                      const currentUsd = paymentInputToUsd(amountReceived, splitPrimaryMethod, paymentRate)
                      setSplitPrimaryMethod(nextMethod)
                      if (nextMethod === 'cash') setSplitPrimaryCashReceived(currentUsd.toFixed(2))
                      setAmountReceived(usdToPaymentInput(currentUsd, nextMethod, paymentRate))
                      const secUsd = Math.max(0, Math.round((paymentDue - currentUsd) * 100) / 100)
                      setAmountReceivedSecondary(usdToPaymentInput(secUsd, splitSecondaryMethod, paymentRate))
                      setSplitPrimaryReference('')
                      setPaymentError('')
                    }} />
                    <label className="payment-field-label">Cuenta de ingreso *</label>
                    <StyledSelect value={splitPrimaryAccountId} onChange={(e) => setSplitPrimaryAccountId(e.target.value)}>
                      <option value="">Selecciona una cuenta</option>
                      {accountsForMethod(splitPrimaryMethod, splitPrimaryCashCurrency).map((a) => <option key={a.id} value={a.id}>{a.name} · {a.currency}</option>)}
                    </StyledSelect>
                    <label className="payment-field-label">Monto del primer método</label>
                    <div className="payment-input-wrap">
                      <input type="text" inputMode="decimal" className="payment-field-input" value={amountReceived} onChange={(event) => syncSplitFromPrimary(event.target.value)} />
                      <span className="currency-tag-right">{usesBolivares(splitPrimaryMethod) ? 'Bs' : 'USD'}</span>
                    </div>
                    <span className="payment-hint-sub">
                      {usesBolivares(splitPrimaryMethod)
                        ? `Ref. ${formatUsd(splitPrimaryAmountUsd)}`
                        : paymentRate ? `Ref. ${formatVes(splitPrimaryAmountUsd * paymentRate)}` : 'Referencia BCV no disponible'}
                    </span>
                    {splitPrimaryMethod === 'cash' && <>
                      <div className="cash-currency-toggle">
                        {(['USD','VES'] as const).map(currency => <button key={currency} type="button" className={`cash-currency-btn ${splitPrimaryCashCurrency === currency ? 'active' : ''}`} onClick={() => {
                          const usd = splitPrimaryCashCurrency === 'VES' ? parseMoneyInput(splitPrimaryCashReceived) / (paymentRate || 1) : parseMoneyInput(splitPrimaryCashReceived)
                          setSplitPrimaryCashCurrency(currency)
                          setSplitPrimaryCashReceived((currency === 'VES' ? usd * (paymentRate || 0) : usd).toFixed(2))
                        }}>{currency === 'USD' ? 'USD' : 'Bs'}</button>)}
                      </div>
                      <label className="payment-field-label">Efectivo físico recibido</label>
                      <input className="payment-field-input" inputMode="decimal" value={splitPrimaryCashReceived} onChange={e => setSplitPrimaryCashReceived(e.target.value)} />
                      <CashChangeSummary amountReceived={splitPrimaryCashReceived} totalUsd={splitPrimaryAmountUsd} currency={splitPrimaryCashCurrency} bcvRate={paymentRate} accounts={financialAccounts} changeAccountId={changeAccountId} onChangeAccountId={setChangeAccountId} showChangeAccount />
                    </>}
                    {requiresPaymentReference(splitPrimaryMethod) && (
                      <>
                        <label className="payment-field-label">{paymentReferenceLabel(splitPrimaryMethod)}</label>
                        <input type="text" className="payment-field-input" value={splitPrimaryReference} onChange={(event) => setSplitPrimaryReference(event.target.value)} placeholder="Ej. 876543210" />
                      </>
                    )}
                  </section>

                  <section className="split-method-card">
                    <div className="split-method-heading"><span className="split-method-number">2</span><span>Segundo método</span></div>
                    <PaymentMethodSelect ariaLabel="Segundo método de pago" value={splitSecondaryMethod} options={SPLIT_PAYMENT_METHODS} disabledMethod={splitPrimaryMethod} onChange={(nextMethod) => {
                      const currentUsd = paymentInputToUsd(amountReceivedSecondary, splitSecondaryMethod, paymentRate)
                      setSplitSecondaryMethod(nextMethod)
                      if (nextMethod === 'cash') setSplitSecondaryCashReceived(currentUsd.toFixed(2))
                      setAmountReceivedSecondary(usdToPaymentInput(currentUsd, nextMethod, paymentRate))
                      setSplitSecondaryReference('')
                      setPaymentError('')
                    }} />
                    <label className="payment-field-label">Cuenta de ingreso *</label>
                    <StyledSelect value={splitSecondaryAccountId} onChange={(e) => setSplitSecondaryAccountId(e.target.value)}>
                      <option value="">Selecciona una cuenta</option>
                      {accountsForMethod(splitSecondaryMethod, splitSecondaryCashCurrency).map((a) => <option key={a.id} value={a.id}>{a.name} · {a.currency}</option>)}
                    </StyledSelect>
                    <label className="payment-field-label">Monto del segundo método</label>
                    <div className="payment-input-wrap">
                      <input type="text" inputMode="decimal" className="payment-field-input" value={amountReceivedSecondary} onChange={(event) => syncSplitFromSecondary(event.target.value)} />
                      <span className="currency-tag-right">{usesBolivares(splitSecondaryMethod) ? 'Bs' : 'USD'}</span>
                    </div>
                    <span className="payment-hint-sub">
                      {usesBolivares(splitSecondaryMethod)
                        ? `Ref. ${formatUsd(splitSecondaryAmountUsd)}`
                        : paymentRate ? `Ref. ${formatVes(splitSecondaryAmountUsd * paymentRate)}` : 'Referencia BCV no disponible'}
                    </span>
                    {splitSecondaryMethod === 'cash' && <>
                      <div className="cash-currency-toggle">
                        {(['USD','VES'] as const).map(currency => <button key={currency} type="button" className={`cash-currency-btn ${splitSecondaryCashCurrency === currency ? 'active' : ''}`} onClick={() => {
                          const usd = splitSecondaryCashCurrency === 'VES' ? parseMoneyInput(splitSecondaryCashReceived) / (paymentRate || 1) : parseMoneyInput(splitSecondaryCashReceived)
                          setSplitSecondaryCashCurrency(currency)
                          setSplitSecondaryCashReceived((currency === 'VES' ? usd * (paymentRate || 0) : usd).toFixed(2))
                        }}>{currency === 'USD' ? 'USD' : 'Bs'}</button>)}
                      </div>
                      <label className="payment-field-label">Efectivo físico recibido</label>
                      <input className="payment-field-input" inputMode="decimal" value={splitSecondaryCashReceived} onChange={e => setSplitSecondaryCashReceived(e.target.value)} />
                      <CashChangeSummary amountReceived={splitSecondaryCashReceived} totalUsd={splitSecondaryAmountUsd} currency={splitSecondaryCashCurrency} bcvRate={paymentRate} accounts={financialAccounts} changeAccountId={changeAccountId} onChangeAccountId={setChangeAccountId} showChangeAccount />
                    </>}
                    {requiresPaymentReference(splitSecondaryMethod) && (
                      <>
                        <label className="payment-field-label">{paymentReferenceLabel(splitSecondaryMethod)}</label>
                        <input type="text" className="payment-field-input" value={splitSecondaryReference} onChange={(event) => setSplitSecondaryReference(event.target.value)} placeholder="Ej. 876543210" />
                      </>
                    )}
                  </section>
                </div>
              )}

              {selectedPaymentTab !== 'split' && selectedPaymentTab !== 'credit' && <div className="payment-field-group mt-3">
                <label className="payment-field-label">
                  {selectedPaymentTab === 'cash' ? 'MONTO RECIBIDO' : 'MONTO A COBRAR'}
                  <span className="text-red"> *</span>
                </label>
                {selectedPaymentTab === 'cash' && (
                  <div className="cash-currency-toggle">
                    <button
                      type="button"
                      className={`cash-currency-btn ${cashCurrency === 'USD' ? 'active' : ''}`}
                      onClick={() => { setCashCurrency('USD'); setAmountReceived(paymentDue ? paymentDue.toFixed(2) : '') }}
                    >USD</button>
                    <button
                      type="button"
                      className={`cash-currency-btn ${cashCurrency === 'VES' ? 'active' : ''}`}
                      onClick={() => { setCashCurrency('VES'); setAmountReceived(paymentRate && paymentDue ? (paymentDue * paymentRate).toFixed(2) : '') }}
                    >Bs</button>
                  </div>
                )}
                <div className="payment-input-wrap">
                  <input
                    type="text"
                    inputMode="decimal"
                    className="payment-field-input"
                    value={amountReceived}
                    onChange={(e) => setAmountReceived(e.target.value)}
                  />
                  <span className="currency-tag-right">{selectedPaymentTab === 'cash' ? (cashCurrency === 'USD' ? 'USD' : 'Bs') : (selectedPaymentTab !== 'personal_account' && usesBolivares(selectedPaymentTab) ? 'Bs' : 'USD')}</span>
                </div>
                <span className="payment-hint-sub">
                  {selectedPaymentTab === 'cash'
                    ? (cashCurrency === 'USD'
                      ? (paymentRate ? `Ref. ${formatVes(paymentDue * paymentRate)}` : 'Referencia BCV no disponible')
                      : `Ref. ${formatUsd(paymentDue)}`)
                    : selectedPaymentTab !== 'personal_account' && usesBolivares(selectedPaymentTab)
                      ? `Ref. ${formatUsd(paymentDue)}`
                      : (paymentRate ? `Ref. ${formatVes(paymentDue * paymentRate)}` : 'Referencia BCV no disponible')}
                </span>
                 {selectedPaymentTab === 'cash' && (
                   <CashChangeSummary amountReceived={amountReceived} totalUsd={paymentDue} currency={cashCurrency} bcvRate={paymentRate} accounts={financialAccounts} changeAccountId={changeAccountId} onChangeAccountId={setChangeAccountId} showChangeAccount />
                 )}
              </div>}

              {paymentError && <div className="payment-error-message" role="alert">{paymentError}</div>}

              {selectedPaymentTab !== 'credit' && <div className="payment-field-group mt-3">
                <label className="payment-field-label">NOTA (OPCIONAL)</label>
                <div className="payment-textarea-wrap">
                  <textarea
                    className="payment-field-textarea"
                    placeholder="Ej. Pagó una parte en Bs"
                    value={paymentNote}
                    onChange={(e) => setPaymentNote(e.target.value.slice(0, 120))}
                    rows={2}
                  />
                  <span className="payment-counter-bottom">{paymentNote.length}/120</span>
                </div>
              </div>}

              {/* Desglose de Pago */}
              {selectedPaymentTab !== 'credit' && <div className="payment-breakdown-card mt-3">
                <span className="breakdown-card-title">Desglose de pago</span>
                <div className="breakdown-rows-list">
                  {selectedPaymentTab === 'split' ? (
                    <>
                      <div className="breakdown-row-item">
                        <span className="row-item-left">
                          1. {SPLIT_PAYMENT_METHODS.find(method => method.method === splitPrimaryMethod)?.icon}{' '}
                          {SPLIT_PAYMENT_METHODS.find(method => method.method === splitPrimaryMethod)?.label}
                        </span>
                        <MoneyWithBcv usd={splitPrimaryAmountUsd} rate={paymentRate} primaryCurrency={usesBolivares(splitPrimaryMethod) ? 'VES' : 'USD'} className="row-item-val" compact />
                      </div>
                      <div className="breakdown-row-item">
                        <span className="row-item-left">
                          2. {SPLIT_PAYMENT_METHODS.find(method => method.method === splitSecondaryMethod)?.icon}{' '}
                          {SPLIT_PAYMENT_METHODS.find(method => method.method === splitSecondaryMethod)?.label}
                        </span>
                        <MoneyWithBcv usd={Math.max(0, paymentDue - splitPrimaryAmountUsd)} rate={paymentRate} primaryCurrency={usesBolivares(splitSecondaryMethod) ? 'VES' : 'USD'} className="row-item-val" compact />
                      </div>
                    </>
                  ) : (
                    <div className="breakdown-row-item">
                      <span className="row-item-left">{PAYMENT_METHODS.find(p => p.method === selectedPaymentTab)?.icon} {PAYMENT_METHODS.find(p => p.method === selectedPaymentTab)?.label}</span>
                      <MoneyWithBcv usd={paymentDue} rate={paymentOrder.bcvRate} className="row-item-val" compact />
                    </div>
                  )}
                </div>
              </div>}
            </div>

            {/* Right Column: Order Summary */}
            <div className="payment-body-right">
              <div className="order-summary-box">
                <h3 className="summary-box-title">Resumen del pedido</h3>

                <div className="summary-box-lines mt-3">
                  <div className="summary-box-line">
                    <span>Subtotal</span>
                    <MoneyWithBcv usd={paymentOrder.totalAmount || 0} rate={paymentOrder.bcvRate} usdClassName="font-bold" compact />
                  </div>

                  <div className="summary-box-total-line mt-3">
                    <span className="summary-total-label">Total</span>
                    <MoneyWithBcv usd={paymentDue} rate={paymentOrder.bcvRate} className="summary-total-val" />
                  </div>
                </div>

                {/* Customer field */}
                <div className="summary-box-customer mt-4">
                  <span className="customer-box-label">Cliente</span>
                  <div className="customer-box-card">
                    <span className="customer-box-name"><User size={14} /> {paymentOrder.customerName || 'Cliente general'}</span>
                  </div>
                </div>

                {/* Info Notice */}
                <div className="payment-security-notice mt-4">
                  <ShieldCheck size={16} className="text-green flex-shrink-0" />
                  <span>{selectedPaymentTab === 'credit' ? 'Se creará una cuenta por cobrar vinculada a esta comanda.' : 'El cobro se actualizará automáticamente en la comanda.'}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Modal Footer Actions */}
          <div className="payment-modal-footer">
            <button className="btn-confirm-payment-red" onClick={handleConfirmOrderPayment} disabled={paying || paymentError.includes('abrir la caja')}>
              <CheckCircle size={18} /> {selectedPaymentTab === 'credit' ? 'Autorizar crédito' : 'Confirmar pago'}
            </button>
            <button className="btn-modal-action-dark" onClick={() => paymentOrder && printThermalReceipt(thermalReceiptForComanda(paymentOrder))}>
              <Printer size={18} /> Imprimir precuenta
            </button>
            <button className="btn-modal-action-ghost" onClick={() => closePaymentModal()}>
              <X size={18} /> Cancelar
            </button>
          </div>
        </div>
      </div>,
      document.body
    )
}
