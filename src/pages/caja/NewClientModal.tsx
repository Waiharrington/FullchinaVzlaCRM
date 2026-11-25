import { createPortal } from 'react-dom'
import { StyledSelect } from '../../components/StyledSelect'
import { Phone, IdCard, MapPin, Info } from 'lucide-react'
import { BIRTH_MONTHS, getDaysInBirthMonth } from './model'

interface NewClientModalProps {
  closing: boolean
  creating: boolean
  error: string
  newClientName: string
  setNewClientName: (v: string) => void
  newClientLastName: string
  setNewClientLastName: (v: string) => void
  newClientIdentification: string
  setNewClientIdentification: (v: string) => void
  newClientPhone: string
  setNewClientPhone: (v: string) => void
  newClientAddress: string
  setNewClientAddress: (v: string) => void
  birthMonth: string
  setBirthMonth: (v: string) => void
  birthDay: string
  setBirthDay: (v: string) => void
  onSubmit: (e: React.FormEvent) => void
  onClose: () => void
}

export function NewClientModal({
  closing, creating, error,
  newClientName, setNewClientName, newClientLastName, setNewClientLastName,
  newClientIdentification, setNewClientIdentification, newClientPhone, setNewClientPhone,
  newClientAddress, setNewClientAddress, birthMonth, setBirthMonth, birthDay, setBirthDay,
  onSubmit, onClose,
}: NewClientModalProps) {
        return createPortal(
      <div className={`modal-overlay-dark ${closing ? 'closing' : ''}`} onClick={() => !creating && onClose()}>
        <div className="client-modal-box animate-pop caja-modal-glow" role="dialog" aria-modal="true" aria-labelledby="new-client-title" onClick={(e) => e.stopPropagation()}>
          <div className="modal-header-line caja-modal-header-glow">
            <div>
              <span className="client-modal-eyebrow">Directorio de clientes</span>
              <h3 className="modal-title" id="new-client-title">Nuevo cliente</h3>
              <p className="modal-sub-desc">Registra un nuevo cliente en el sistema</p>
            </div>
          </div>

          <form onSubmit={onSubmit} className="crm-form mt-3">
            <div className="field">
              <label className="field-label-white">Nombre *</label>
              <input
                type="text"
                placeholder="Ingresa el nombre del cliente"
                value={newClientName}
                onChange={(e) => setNewClientName(e.target.value)}
                className="modal-input-dark"
                required
              />
            </div>

            <div className="field mt-3">
              <label className="field-label-white">Apellido</label>
              <input
                type="text"
                placeholder="Ingresa el apellido del cliente"
                value={newClientLastName}
                onChange={(e) => setNewClientLastName(e.target.value)}
                className="modal-input-dark"
              />
            </div>

            <div className="field mt-3">
              <label className="field-label-white">Cédula / RIF <span className="field-optional">Opcional</span></label>
              <div className="input-with-icon-wrap">
                <IdCard size={16} className="input-left-icon" />
                <input
                  type="text"
                  inputMode="text"
                  autoComplete="off"
                  placeholder="Ej. V-12345678"
                  value={newClientIdentification}
                  onChange={(e) => setNewClientIdentification(e.target.value)}
                  className="modal-input-dark with-left-icon"
                  maxLength={24}
                />
              </div>
            </div>

            <div className="field mt-3">
              <label className="field-label-white">Teléfono</label>
              <div className="input-with-icon-wrap">
                <Phone size={16} className="input-left-icon" />
                <input
                  type="tel"
                  placeholder="04129206984"
                  value={newClientPhone}
                  onChange={(e) => setNewClientPhone(e.target.value)}
                  className="modal-input-dark with-left-icon"
                />
              </div>
            </div>

            <div className="field mt-3">
              <label className="field-label-white">Dirección <span className="field-optional">Opcional</span></label>
              <div className="input-with-icon-wrap input-with-icon-textarea">
                <MapPin size={16} className="input-left-icon" />
                <textarea
                  placeholder="Dirección y punto de referencia"
                  value={newClientAddress}
                  onChange={(e) => setNewClientAddress(e.target.value)}
                  className="modal-input-dark modal-textarea-dark with-left-icon"
                  maxLength={300}
                  rows={3}
                />
              </div>
            </div>

            <div className="field mt-3">
              <label className="field-label-white">Cumpleaños</label>
              <div className="birthday-selects-row">
                <div className="select-col">
                  <span className="select-sub-label">Mes</span>
                  <StyledSelect
                    className="modal-select-dark"
                    value={birthMonth}
                    onChange={(e) => {
                      const nextMonth = e.target.value
                      setBirthMonth(nextMonth)
                      if (birthDay && Number(birthDay) > getDaysInBirthMonth(nextMonth)) setBirthDay('')
                    }}
                  >
                    <option value="">Mes</option>
                    {BIRTH_MONTHS.map((month, index) => (
                      <option key={month} value={String(index + 1).padStart(2, '0')}>{month}</option>
                    ))}
                  </StyledSelect>
                </div>
                <div className="select-col">
                  <span className="select-sub-label">Día</span>
                  <StyledSelect
                    className="modal-select-dark"
                    value={birthDay}
                    onChange={(e) => setBirthDay(e.target.value)}
                  >
                    <option value="">Día</option>
                    {Array.from({ length: getDaysInBirthMonth(birthMonth) }, (_, i) => i + 1).map((d) => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </StyledSelect>
                </div>
              </div>
              <span className="birthday-hint mt-1">
                <Info size={14} /> Solo para promociones y recordatorios
              </span>
            </div>

            {error && <div className="client-modal-error" role="alert">{error}</div>}

            <div className="modal-actions-row-right mt-4">
              <button type="button" className="btn-modal-cancel" disabled={creating} onClick={() => onClose()}>
                Cancelar
              </button>
              <button type="submit" className="btn-modal-submit-red" disabled={creating}>
                {creating ? 'Guardando…' : 'Guardar cliente'}
              </button>
            </div>
          </form>
        </div>
      </div>,
      document.body
    )
}
