import { createPortal } from 'react-dom'
import { MoneyWithBcv } from '../../components/MoneyWithBcv'
import { PaymentMethodSelect } from '../../components/PaymentMethodSelect'
import { CashChangeSummary } from '../../components/CashChangeSummary'
import { StyledSelect } from '../../components/StyledSelect'
import { formatUsd, formatVes } from '../../lib/money'
import { X, Printer, CheckCircle, QrCode, ShieldCheck, Pencil, Plus, User } from 'lucide-react'
import type { FinancialAccount } from '../../lib/dataService'
import { PAYMENT_METHODS, SPLIT_PAYMENT_METHODS, usesBolivares, requiresPaymentReference, paymentReferenceLabel, paymentInputToUsd, usdToPaymentInput, type ActivePaymentMethod, type SplitPaymentMethod } from './model'
import type { usePaymentForm } from './usePaymentForm'

interface PaymentModalProps {
  form: ReturnType<typeof usePaymentForm>
  bcvRate: number | null
  customerName: string
  closingPayment: boolean
  paying: boolean
  payError: string
  setPayError: (value: string) => void
  accountsForMethod: (method: SplitPaymentMethod, cashCurrencyOverride?: 'USD' | 'VES') => FinancialAccount[]
  ensureAccountForMethod: (method: SplitPaymentMethod, cashCurrencyOverride?: 'USD' | 'VES') => string
  subtotal: number
  total: number
  splitPrimaryAmountUsd: number
  splitSecondaryAmountUsd: number
  syncSplitFromPrimary: (input: string) => void
  syncSplitFromSecondary: (input: string) => void
  closePaymentModal: (then?: () => void) => void
  handleSelectPaymentTab: (method: ActivePaymentMethod | 'split') => void
  handleConfirmPayment: () => void | Promise<void>
  handlePrintReceipt: () => void
}

export function PaymentModal({ form, bcvRate, customerName, closingPayment, paying, payError, setPayError, accountsForMethod, ensureAccountForMethod, subtotal, total, splitPrimaryAmountUsd, splitSecondaryAmountUsd, syncSplitFromPrimary, syncSplitFromSecondary, closePaymentModal, handleSelectPaymentTab, handleConfirmPayment, handlePrintReceipt }: PaymentModalProps) {
  const { selectedPaymentTab, refNumber, setRefNumber, extraRefs, setExtraRefs, amountReceived, setAmountReceived, amountReceivedSecondary, setAmountReceivedSecondary, splitPrimaryCashReceived, setSplitPrimaryCashReceived, splitSecondaryCashReceived, setSplitSecondaryCashReceived, splitPrimaryMethod, setSplitPrimaryMethod, splitSecondaryMethod, setSplitSecondaryMethod, splitPrimaryCashCurrency, setSplitPrimaryCashCurrency, splitSecondaryCashCurrency, setSplitSecondaryCashCurrency, splitPrimaryReference, setSplitPrimaryReference, splitSecondaryReference, setSplitSecondaryReference, splitPrimaryExtraRefs, setSplitPrimaryExtraRefs, splitSecondaryExtraRefs, setSplitSecondaryExtraRefs, paymentNote, setPaymentNote, financialAccounts, personalAccounts, paymentAccountId, setPaymentAccountId, paymentPersonalAccountId, setPaymentPersonalAccountId, splitPrimaryAccountId, setSplitPrimaryAccountId, splitSecondaryAccountId, setSplitSecondaryAccountId, cashCurrency, setCashCurrency, changeAccountId, setChangeAccountId } = form
        return createPortal(
      <div className={`modal-overlay-dark ${closingPayment ? 'closing' : ''}`} onClick={() => closePaymentModal()}>
        <div className="payment-modal-box animate-pop caja-payment-modal-glow" onClick={(e) => e.stopPropagation()}>
          {/* Modal Header */}
          <div className="payment-modal-header caja-payment-header-glow">
            <h2 className="payment-modal-title">
              Cobrar pedido <span className="payment-order-tag">Nueva venta</span>
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

          {/* Modal Body: Left Details + Right Summary */}
          <div className="payment-modal-body">
            {/* Left Column: Details */}
            <div className="payment-body-left">
              <h3 className="payment-sub-heading">
                Detalles del pago ({PAYMENT_METHODS.find(p => p.method === selectedPaymentTab)?.label})
              </h3>

              {selectedPaymentTab === 'personal_account' ? (
                <div className="payment-field-group mt-2">
                  <label className="payment-field-label">Cuenta personal *</label>
                  <StyledSelect value={paymentPersonalAccountId} onChange={(event) => setPaymentPersonalAccountId(event.target.value)}>
                    <option value="">Selecciona una cuenta personal</option>
                    {personalAccounts.filter(account => account.isActive).map(account => <option key={account.id} value={account.id}>{account.name}</option>)}
                  </StyledSelect>
                  <span className="payment-hint-sub">Consumo interno; queda registrado para control y descuenta inventario, pero no entra en caja.</span>
                </div>
              ) : selectedPaymentTab !== 'split' && selectedPaymentTab !== 'other' && (
                <div className="payment-field-group mt-2">
                  <label className="payment-field-label">Cuenta donde ingresa el dinero *</label>
                  <StyledSelect value={paymentAccountId} onChange={(e) => setPaymentAccountId(e.target.value)}>
                    <option value="">{selectedPaymentTab === 'card' ? 'Punto de venta' : 'Selecciona una cuenta'}</option>
                    {accountsForMethod(selectedPaymentTab).map((a) => <option key={a.id} value={a.id}>{a.name} · {a.currency}</option>)}
                  </StyledSelect>
                  {selectedPaymentTab === 'mobile' && <span className="payment-hint-sub">Por defecto: Banco Exterior. Puedes cambiar a Banesco.</span>}
                  {selectedPaymentTab === 'card' && <span className="payment-hint-sub">El dinero queda en Punto de venta. Registra la transferencia a Banesco cuando se deposite.</span>}
                </div>
              )}

              {selectedPaymentTab !== 'split' && selectedPaymentTab !== 'other' && selectedPaymentTab !== 'personal_account' && requiresPaymentReference(selectedPaymentTab) && (
                <div className="payment-field-group mt-2">
                  <label className="payment-field-label">{paymentReferenceLabel(selectedPaymentTab)}</label>
                  <div className="payment-ref-row">
                    <div className="payment-input-wrap" style={{ flex: 1 }}>
                      <input
                        type="text"
                        className="payment-field-input"
                        value={refNumber}
                        onChange={(e) => setRefNumber(e.target.value)}
                        placeholder="Ej. 458921"
                      />
                      <QrCode size={16} className="qr-icon-right" />
                    </div>
                    <button type="button" className="cmd-add-ref-btn" title="Agregar otra referencia" onClick={() => setExtraRefs(prev => [...prev, ''])}>
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
                    <div className="split-method-heading">
                      <span className="split-method-number">1</span>
                      <span>Primer método</span>
                    </div>
                    <PaymentMethodSelect
                      ariaLabel="Primer método de pago"
                      value={splitPrimaryMethod}
                      options={SPLIT_PAYMENT_METHODS}
                      disabledMethod={splitSecondaryMethod}
                      onChange={(nextMethod) => {
                        const currentUsd = paymentInputToUsd(amountReceived, splitPrimaryMethod, bcvRate, splitPrimaryCashCurrency)
                        setSplitPrimaryMethod(nextMethod)
                        if (nextMethod === 'cash') setSplitPrimaryCashReceived(usdToPaymentInput(currentUsd, 'cash', bcvRate, splitPrimaryCashCurrency))
                        setAmountReceived(usdToPaymentInput(currentUsd, nextMethod, bcvRate, splitPrimaryCashCurrency))
                        const secUsd = Math.max(0, Math.round((total - currentUsd) * 100) / 100)
                        setAmountReceivedSecondary(usdToPaymentInput(secUsd, splitSecondaryMethod, bcvRate, splitSecondaryCashCurrency))
                        setSplitPrimaryReference('')
                        setSplitPrimaryExtraRefs([])
                        setPayError('')
                        setSplitPrimaryAccountId(ensureAccountForMethod(nextMethod, splitPrimaryCashCurrency))
                      }}
                    />
                    {splitPrimaryMethod === 'cash' && (
                      <div className="cash-currency-toggle" role="group" aria-label="Moneda del efectivo del primer método">
                        {(['USD', 'VES'] as const).map((currency) => (
                          <button key={currency} type="button" className={`cash-currency-btn ${splitPrimaryCashCurrency === currency ? 'active' : ''}`} onClick={() => {
                            const currentUsd = paymentInputToUsd(amountReceived, 'cash', bcvRate, splitPrimaryCashCurrency)
                            const receivedUsd = paymentInputToUsd(splitPrimaryCashReceived, 'cash', bcvRate, splitPrimaryCashCurrency)
                            setSplitPrimaryCashCurrency(currency)
                            setAmountReceived(usdToPaymentInput(currentUsd, 'cash', bcvRate, currency))
                            setSplitPrimaryCashReceived(usdToPaymentInput(receivedUsd, 'cash', bcvRate, currency))
                            const otherUsd = Math.max(0, Math.round((total - currentUsd) * 100) / 100)
                            setAmountReceivedSecondary(usdToPaymentInput(otherUsd, splitSecondaryMethod, bcvRate, splitSecondaryCashCurrency))
                            setSplitPrimaryAccountId(ensureAccountForMethod('cash', currency))
                          }}>{currency === 'VES' ? 'Bs' : 'USD'}</button>
                        ))}
                      </div>
                    )}
                    <label className="payment-field-label">Cuenta de ingreso *</label>
                    <StyledSelect value={splitPrimaryAccountId} onChange={(e) => setSplitPrimaryAccountId(e.target.value)}>
                      <option value="">Selecciona una cuenta</option>
                      {accountsForMethod(splitPrimaryMethod, splitPrimaryCashCurrency).map((a) => <option key={a.id} value={a.id}>{a.name} · {a.currency}</option>)}
                    </StyledSelect>
                    <label className="payment-field-label">Monto del primer método</label>
                    <div className="payment-input-wrap">
                      <input
                        type="text"
                        inputMode="decimal"
                        className="payment-field-input"
                        value={amountReceived}
                        onChange={(e) => syncSplitFromPrimary(e.target.value)}
                      />
                      <span className="currency-tag-right">{usesBolivares(splitPrimaryMethod, splitPrimaryCashCurrency) ? 'Bs' : 'USD'}</span>
                    </div>
                    <span className="payment-hint-sub">
                      {usesBolivares(splitPrimaryMethod, splitPrimaryCashCurrency)
                        ? `Ref. ${formatUsd(splitPrimaryAmountUsd)}`
                        : bcvRate ? `Ref. ${formatVes(splitPrimaryAmountUsd * bcvRate)}` : 'Referencia BCV no disponible'}
                    </span>
                    {splitPrimaryMethod === 'cash' && <>
                      <label className="payment-field-label">Efectivo físico recibido</label>
                      <input className="payment-field-input" inputMode="decimal" value={splitPrimaryCashReceived} onChange={e => setSplitPrimaryCashReceived(e.target.value)} />
                      <CashChangeSummary amountReceived={splitPrimaryCashReceived} totalUsd={splitPrimaryAmountUsd} currency={splitPrimaryCashCurrency} bcvRate={bcvRate} accounts={financialAccounts} changeAccountId={changeAccountId} onChangeAccountId={setChangeAccountId} showChangeAccount />
                    </>}
                    {requiresPaymentReference(splitPrimaryMethod) && (
                      <>
                        <label className="payment-field-label">{paymentReferenceLabel(splitPrimaryMethod)}</label>
                        <div className="payment-ref-row">
                          <input
                            type="text"
                            className="payment-field-input"
                            style={{ flex: 1 }}
                            value={splitPrimaryReference}
                            onChange={(e) => setSplitPrimaryReference(e.target.value)}
                            placeholder="Ej. 458921"
                          />
                          <button type="button" className="cmd-add-ref-btn" title="Agregar otra referencia" onClick={() => setSplitPrimaryExtraRefs(prev => [...prev, ''])}>
                            <Plus size={18} />
                          </button>
                        </div>
                        {splitPrimaryExtraRefs.map((ref, idx) => (
                          <div className="payment-ref-row mt-1" key={idx}>
                            <input
                              type="text"
                              className="payment-field-input"
                              style={{ flex: 1 }}
                              value={ref}
                              onChange={(e) => { const v = e.target.value; setSplitPrimaryExtraRefs(prev => prev.map((r, i) => i === idx ? v : r)) }}
                              placeholder={`Referencia ${idx + 2}`}
                            />
                            <button type="button" className="cmd-remove-ref-btn" title="Quitar" onClick={() => setSplitPrimaryExtraRefs(prev => prev.filter((_, i) => i !== idx))}>
                              <X size={16} />
                            </button>
                          </div>
                        ))}
                      </>
                    )}
                  </section>

                  <section className="split-method-card">
                    <div className="split-method-heading">
                      <span className="split-method-number">2</span>
                      <span>Segundo método</span>
                    </div>
                    <PaymentMethodSelect
                      ariaLabel="Segundo método de pago"
                      value={splitSecondaryMethod}
                      options={SPLIT_PAYMENT_METHODS}
                      disabledMethod={splitPrimaryMethod}
                      onChange={(nextMethod) => {
                        const currentUsd = paymentInputToUsd(amountReceivedSecondary, splitSecondaryMethod, bcvRate, splitSecondaryCashCurrency)
                        setSplitSecondaryMethod(nextMethod)
                        if (nextMethod === 'cash') setSplitSecondaryCashReceived(usdToPaymentInput(currentUsd, 'cash', bcvRate, splitSecondaryCashCurrency))
                        setAmountReceivedSecondary(usdToPaymentInput(currentUsd, nextMethod, bcvRate, splitSecondaryCashCurrency))
                        setSplitSecondaryReference('')
                        setSplitSecondaryExtraRefs([])
                        setPayError('')
                        setSplitSecondaryAccountId(ensureAccountForMethod(nextMethod, splitSecondaryCashCurrency))
                      }}
                    />
                    {splitSecondaryMethod === 'cash' && (
                      <div className="cash-currency-toggle" role="group" aria-label="Moneda del efectivo del segundo método">
                        {(['USD', 'VES'] as const).map((currency) => (
                          <button key={currency} type="button" className={`cash-currency-btn ${splitSecondaryCashCurrency === currency ? 'active' : ''}`} onClick={() => {
                            const currentUsd = paymentInputToUsd(amountReceivedSecondary, 'cash', bcvRate, splitSecondaryCashCurrency)
                            const receivedUsd = paymentInputToUsd(splitSecondaryCashReceived, 'cash', bcvRate, splitSecondaryCashCurrency)
                            setSplitSecondaryCashCurrency(currency)
                            setAmountReceivedSecondary(usdToPaymentInput(currentUsd, 'cash', bcvRate, currency))
                            setSplitSecondaryCashReceived(usdToPaymentInput(receivedUsd, 'cash', bcvRate, currency))
                            const otherUsd = Math.max(0, Math.round((total - currentUsd) * 100) / 100)
                            setAmountReceived(usdToPaymentInput(otherUsd, splitPrimaryMethod, bcvRate, splitPrimaryCashCurrency))
                            setSplitSecondaryAccountId(ensureAccountForMethod('cash', currency))
                          }}>{currency === 'VES' ? 'Bs' : 'USD'}</button>
                        ))}
                      </div>
                    )}
                    <label className="payment-field-label">Cuenta de ingreso *</label>
                    <StyledSelect value={splitSecondaryAccountId} onChange={(e) => setSplitSecondaryAccountId(e.target.value)}>
                      <option value="">Selecciona una cuenta</option>
                      {accountsForMethod(splitSecondaryMethod, splitSecondaryCashCurrency).map((a) => <option key={a.id} value={a.id}>{a.name} · {a.currency}</option>)}
                    </StyledSelect>
                    <label className="payment-field-label">Monto del segundo método</label>
                    <div className="payment-input-wrap">
                      <input
                        type="text"
                        inputMode="decimal"
                        className="payment-field-input"
                        value={amountReceivedSecondary}
                        onChange={(e) => syncSplitFromSecondary(e.target.value)}
                      />
                      <span className="currency-tag-right">{usesBolivares(splitSecondaryMethod, splitSecondaryCashCurrency) ? 'Bs' : 'USD'}</span>
                    </div>
                    <span className="payment-hint-sub">
                      {usesBolivares(splitSecondaryMethod, splitSecondaryCashCurrency)
                        ? `Ref. ${formatUsd(splitSecondaryAmountUsd)}`
                        : bcvRate ? `Ref. ${formatVes(splitSecondaryAmountUsd * bcvRate)}` : 'Referencia BCV no disponible'}
                    </span>
                    {splitSecondaryMethod === 'cash' && <>
                      <label className="payment-field-label">Efectivo físico recibido</label>
                      <input className="payment-field-input" inputMode="decimal" value={splitSecondaryCashReceived} onChange={e => setSplitSecondaryCashReceived(e.target.value)} />
                      <CashChangeSummary amountReceived={splitSecondaryCashReceived} totalUsd={splitSecondaryAmountUsd} currency={splitSecondaryCashCurrency} bcvRate={bcvRate} accounts={financialAccounts} changeAccountId={changeAccountId} onChangeAccountId={setChangeAccountId} showChangeAccount />
                    </>}
                    {requiresPaymentReference(splitSecondaryMethod) && (
                      <>
                        <label className="payment-field-label">{paymentReferenceLabel(splitSecondaryMethod)}</label>
                        <div className="payment-ref-row">
                          <input
                            type="text"
                            className="payment-field-input"
                            style={{ flex: 1 }}
                            value={splitSecondaryReference}
                            onChange={(e) => setSplitSecondaryReference(e.target.value)}
                            placeholder="Ej. 458921"
                          />
                          <button type="button" className="cmd-add-ref-btn" title="Agregar otra referencia" onClick={() => setSplitSecondaryExtraRefs(prev => [...prev, ''])}>
                            <Plus size={18} />
                          </button>
                        </div>
                        {splitSecondaryExtraRefs.map((ref, idx) => (
                          <div className="payment-ref-row mt-1" key={idx}>
                            <input
                              type="text"
                              className="payment-field-input"
                              style={{ flex: 1 }}
                              value={ref}
                              onChange={(e) => { const v = e.target.value; setSplitSecondaryExtraRefs(prev => prev.map((r, i) => i === idx ? v : r)) }}
                              placeholder={`Referencia ${idx + 2}`}
                            />
                            <button type="button" className="cmd-remove-ref-btn" title="Quitar" onClick={() => setSplitSecondaryExtraRefs(prev => prev.filter((_, i) => i !== idx))}>
                              <X size={16} />
                            </button>
                          </div>
                        ))}
                      </>
                    )}
                  </section>
                </div>
              )}

              {selectedPaymentTab !== 'split' && <div className="payment-field-group mt-3">
                <label className="payment-field-label">
                  {selectedPaymentTab === 'cash' ? 'MONTO RECIBIDO' : 'MONTO A COBRAR'} <span className="text-red">*</span>
                </label>
                {selectedPaymentTab === 'cash' && (
                  <div className="cash-currency-toggle">
                    <button
                      type="button"
                      className={`cash-currency-btn ${cashCurrency === 'USD' ? 'active' : ''}`}
                      onClick={() => { setCashCurrency('USD'); setAmountReceived(total.toFixed(2)); setPaymentAccountId(ensureAccountForMethod('cash', 'USD')) }}
                    >USD</button>
                    <button
                      type="button"
                      className={`cash-currency-btn ${cashCurrency === 'VES' ? 'active' : ''}`}
                      onClick={() => { setCashCurrency('VES'); setAmountReceived(bcvRate ? (total * bcvRate).toFixed(2) : ''); setPaymentAccountId(ensureAccountForMethod('cash', 'VES')) }}
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
                  <span className="currency-tag-right">
                    {selectedPaymentTab === 'cash' ? (cashCurrency === 'USD' ? 'USD' : 'Bs') : (selectedPaymentTab !== 'other' && selectedPaymentTab !== 'personal_account' && usesBolivares(selectedPaymentTab) ? 'Bs' : 'USD')}
                  </span>
                </div>
                <span className="payment-hint-sub">
                  {selectedPaymentTab === 'cash'
                    ? (cashCurrency === 'USD'
                      ? bcvRate ? `Ref. ${formatVes(total * bcvRate)}` : 'Referencia BCV no disponible'
                      : `Ref. ${formatUsd(total)}`)
                    : selectedPaymentTab !== 'other' && selectedPaymentTab !== 'personal_account' && usesBolivares(selectedPaymentTab)
                      ? `Ref. ${formatUsd(total)}`
                      : bcvRate ? `Ref. ${formatVes(total * bcvRate)}` : 'Referencia BCV no disponible'}
                </span>
                 {selectedPaymentTab === 'cash' && (
                   <CashChangeSummary amountReceived={amountReceived} totalUsd={total} currency={cashCurrency} bcvRate={bcvRate} accounts={financialAccounts} changeAccountId={changeAccountId} onChangeAccountId={setChangeAccountId} showChangeAccount />
                 )}
              </div>}

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

              {selectedPaymentTab === 'split' && (
                <div className="payment-breakdown-card mt-3">
                  <span className="breakdown-card-title">Desglose de pago</span>
                  <div className="breakdown-rows-list">
                    <div className="breakdown-row-item">
                      <span className="row-item-left">
                        1. {SPLIT_PAYMENT_METHODS.find(method => method.method === splitPrimaryMethod)?.icon}{' '}
                        {SPLIT_PAYMENT_METHODS.find(method => method.method === splitPrimaryMethod)?.label}
                      </span>
                      <MoneyWithBcv
                        usd={splitPrimaryAmountUsd}
                        rate={bcvRate}
                        primaryCurrency={usesBolivares(splitPrimaryMethod, splitPrimaryCashCurrency) ? 'VES' : 'USD'}
                        className="row-item-val"
                        compact
                      />
                    </div>
                    <div className="breakdown-row-item">
                      <span className="row-item-left">
                        2. {SPLIT_PAYMENT_METHODS.find(method => method.method === splitSecondaryMethod)?.icon}{' '}
                        {SPLIT_PAYMENT_METHODS.find(method => method.method === splitSecondaryMethod)?.label}
                      </span>
                      <MoneyWithBcv
                        usd={Math.max(total - splitPrimaryAmountUsd, 0)}
                        rate={bcvRate}
                        primaryCurrency={usesBolivares(splitSecondaryMethod, splitSecondaryCashCurrency) ? 'VES' : 'USD'}
                        className="row-item-val"
                        compact
                      />
                    </div>
                  </div>
                </div>
              )}

              {payError && <p className="pay-error" role="alert">{payError}</p>}
            </div>

            {/* Right Column: Order Summary */}
            <div className="payment-body-right">
              <div className="order-summary-box caja-order-summary-accent">
                <h3 className="summary-box-title">Resumen del pedido</h3>

                <div className="summary-box-lines mt-3">
                  <div className="summary-box-line">
                    <span>Subtotal</span>
                    <MoneyWithBcv usd={subtotal} usdClassName="font-bold" compact />
                  </div>
                  <div className="summary-box-line">
                    <span>Descuento</span>
                    <MoneyWithBcv usd={0} usdClassName="font-bold" compact />
                  </div>

                  <div className="summary-box-total-line caja-summary-total-highlight mt-3">
                    <span className="summary-total-label">Total</span>
                    <MoneyWithBcv usd={total} className="summary-total-val" />
                  </div>
                </div>

                {/* Customer field */}
                <div className="summary-box-customer mt-4">
                  <span className="customer-box-label">Cliente</span>
                  <div className="customer-box-card">
                    <span className="customer-box-name"><User size={14} /> {customerName || 'Cliente general'}</span>
                    <span className="customer-edit-btn" title="El cliente se define al crear la venta"><Pencil size={14} /></span>
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
            <button className="btn-modal-action-ghost" onClick={() => closePaymentModal()}>
              <X size={18} /> Cancelar
            </button>
          </div>
        </div>
      </div>,
      document.body
    )
}
