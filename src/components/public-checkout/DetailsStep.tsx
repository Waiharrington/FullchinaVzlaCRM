import { type RefObject, type Dispatch, type SetStateAction } from 'react'
import { UserRound, Phone, Wallet, MessageSquareText, ChevronRight } from 'lucide-react'
import { maxIdentificationDigits, isValidPublicIdentification, normalizeVenezuelanPhone } from '../../lib/publicOrderRules'
import { LiveTicket } from '../../pedir-v2/wow'
import { type WebOrderCartItem } from '../../lib/publicOrders'
import { PayDropdown } from '../../components/public-checkout/PayDropdown'

interface DetailsStepProps {
  cart: WebOrderCartItem[]
  continueToConfirmation: () => void
  customerDetailsAutofilled: boolean
  customerDetailsTouched: RefObject<boolean>
  fieldError: "" | "name" | "phone" | "identification"
  identification: string
  identificationRef: RefObject<HTMLInputElement | null>
  idPrefix: "V" | "E" | "J"
  name: string
  nameRef: RefObject<HTMLInputElement | null>
  notes: string
  payMode: "single" | "mixed"
  payPrimary: "cash" | "mobile" | "transfer" | "card" | "binance"
  paySecondary: "cash" | "mobile" | "transfer" | "card" | "binance"
  phone: string
  phoneRef: RefObject<HTMLInputElement | null>
  setFieldError: Dispatch<SetStateAction<"" | "name" | "phone" | "identification">>
  setIdentification: Dispatch<SetStateAction<string>>
  setIdPrefix: Dispatch<SetStateAction<"V" | "E" | "J">>
  setName: Dispatch<SetStateAction<string>>
  setNotes: Dispatch<SetStateAction<string>>
  setPayMode: Dispatch<SetStateAction<"single" | "mixed">>
  setPayPrimary: Dispatch<SetStateAction<"cash" | "mobile" | "transfer" | "card" | "binance">>
  setPaySecondary: Dispatch<SetStateAction<"cash" | "mobile" | "transfer" | "card" | "binance">>
  setPhone: Dispatch<SetStateAction<string>>
  submitting: boolean
}

export function DetailsStep({ cart, continueToConfirmation, customerDetailsAutofilled, customerDetailsTouched, fieldError, identification, identificationRef, idPrefix, name, nameRef, notes, payMode, payPrimary, paySecondary, phone, phoneRef, setFieldError, setIdentification, setIdPrefix, setName, setNotes, setPayMode, setPayPrimary, setPaySecondary, setPhone, submitting }: DetailsStepProps) {
  return (
<div className="public-checkout">
                <LiveTicket cart={cart} name={name} identification={identification} phone={phone} payMode={payMode} payPrimary={payPrimary} paySecondary={paySecondary} />
                <div className="public-data-intro">
                  <strong>¿A nombre de quién?</strong>
                  <span>Solo para coordinar tu pedido.</span>
                </div>
                {customerDetailsAutofilled && <p className="public-checkout-profile-note" role="status"><img src="/icons/wok-mark.png" alt="" /><span><strong>¡Tu comanda ya viene llena!</strong>Usamos los datos de tu perfil. Dale un vistazo y sigue.</span></p>}
                <div className="public-data-form-card" onChangeCapture={() => { customerDetailsTouched.current = true }}>
                  <label className={`public-data-field${fieldError === 'name' ? ' invalid' : ''}`}><span className="public-data-icon"><UserRound /></span><span className="public-data-field-copy"><span>Tu nombre <em className="public-data-req">*</em></span><div className="public-data-input"><input ref={nameRef} autoComplete="name" value={name} onChange={event => { setName(event.target.value); if (fieldError === 'name') setFieldError('') }} placeholder="Nombre y apellido" /></div>{fieldError === 'name' && <em className="public-field-error" role="alert">Escribe tu nombre.</em>}</span></label>
                  <label className={`public-data-field${fieldError === 'identification' ? ' invalid' : ''}`}><span className="public-data-icon"><UserRound /></span><span className="public-data-field-copy"><span>Tu cédula <em className="public-data-req">*</em></span><div className="public-data-input"><div className="public-id-prefix-toggle">{(['V', 'E', 'J'] as const).map(p => <button key={p} type="button" className={idPrefix === p ? 'active' : ''} onClick={() => { setIdPrefix(p); setIdentification(`${p}-${identification.replace(/^[VEJ]-?/i, '').slice(0, maxIdentificationDigits(p))}`); if (fieldError === 'identification') setFieldError('') }}>{p}</button>)}</div><input ref={identificationRef} inputMode="numeric" autoComplete="off" value={identification.replace(/^[VEJ]-?/i, '')} maxLength={maxIdentificationDigits(idPrefix)} onChange={event => { const digits = event.target.value.replace(/\D/g, '').slice(0, maxIdentificationDigits(idPrefix)); setIdentification(`${idPrefix}-${digits}`); if (fieldError === 'identification') setFieldError('') }} onBlur={() => { const digits = identification.replace(/^[VEJ]-?/i, ''); if (digits && !isValidPublicIdentification(`${idPrefix}-${digits}`)) setFieldError('identification') }} placeholder="12345678" /></div>{fieldError === 'identification' ? <em className="public-field-error" role="alert">{idPrefix === 'J' ? 'El RIF debe tener 9 dígitos (incluye el verificador).' : 'La cédula debe tener entre 6 y 8 dígitos.'}</em> : <small>La usaremos para conservar tu historial de pedidos</small>}</span></label>
                  <label className={`public-data-field${fieldError === 'phone' ? ' invalid' : ''}`}><span className="public-data-icon"><Phone /></span><span className="public-data-field-copy"><span>Tu WhatsApp <em className="public-data-req">*</em></span><div className="public-data-input"><input ref={phoneRef} type="tel" inputMode="tel" autoComplete="tel" value={phone} maxLength={18} onChange={event => { setPhone(event.target.value); if (fieldError === 'phone') setFieldError('') }} onBlur={() => { if (phone.trim() && !normalizeVenezuelanPhone(phone)) setFieldError('phone') }} placeholder="0412 000 0000" /></div>{fieldError === 'phone' ? <em className="public-field-error" role="alert">Ingresa un móvil venezolano que empiece por 04, ej. 0412 000 0000 (también aceptamos +58 412 000 0000).</em> : <small>Te escribiremos aquí para confirmar</small>}</span></label>
                </div>
                <div className="public-pay-card">
                  <div className="public-pay-head"><Wallet size={17} /><span>¿Cómo vas a pagar?</span></div>
                  <div className="public-pay-modes">
                    <button type="button" className={`public-pay-mode ${payMode === 'single' ? 'active' : ''}`} onClick={() => setPayMode('single')}>Un método</button>
                    <button type="button" className={`public-pay-mode ${payMode === 'mixed' ? 'active' : ''}`} onClick={() => setPayMode('mixed')}>Mixto (2 métodos)</button>
                  </div>
                  <div className="public-pay-selects">
                    <div className="public-pay-select">
                      <span>{payMode === 'mixed' ? 'Primer método' : 'Método de pago'}</span>
                      <PayDropdown value={payPrimary} onChange={setPayPrimary} disabledCode={payMode === 'mixed' ? paySecondary : undefined} />
                    </div>
                    {payMode === 'mixed' && (
                      <div className="public-pay-select">
                        <span>Segundo método</span>
                        <PayDropdown value={paySecondary} onChange={setPaySecondary} disabledCode={payPrimary} />
                      </div>
                    )}
                  </div>
                  {payMode === 'mixed' && <p className="public-pay-hint">Al cobrar coordinamos cuánto va por cada método.</p>}
                </div>
                <label className="public-data-notes"><span className="public-data-notes-title"><MessageSquareText /><span><strong>¿Algo para la cocina?</strong><small>Opcional</small></span></span><textarea value={notes} maxLength={250} onChange={event => setNotes(event.target.value)} placeholder="Ej. Sin cebollín, poca salsa…" /></label>
                <button className="public-primary whatsapp" disabled={submitting} onClick={continueToConfirmation}>Revisar pedido <ChevronRight /></button>
              </div>
  )
}
