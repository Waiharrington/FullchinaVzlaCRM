import { useState, type FormEvent } from 'react'
import { createPortal } from 'react-dom'
import { Info, MapPin, Phone } from 'lucide-react'
import { StyledSelect } from '../../components/StyledSelect'
import { alertDialog } from '../../components/ConfirmDialog'
import { createCustomer, type Customer } from '../../lib/dataService'
import type { CustomerRow } from './model'
import { EMPTY_NEW_CLIENT_FORM, MONTH_NAMES, toCreateCustomerInput, toCustomerRow, type NewClientForm } from './newClient'

interface NewClientModalProps {
  onClose: () => void
  onCreated: (saved: Customer, row: CustomerRow) => void
}

// Alta de cliente. El padre solo decide cuándo mostrarlo y recibe el cliente creado.
export function NewClientModal({ onClose, onCreated }: NewClientModalProps) {
  const [form, setForm] = useState<NewClientForm>(EMPTY_NEW_CLIENT_FORM)
  const [closing, setClosing] = useState(false)
  const setField = (field: keyof NewClientForm, value: string) => setForm(current => ({ ...current, [field]: value }))

  const close = (then?: () => void) => {
    if (closing) return
    setClosing(true)
    window.setTimeout(() => { onClose(); then?.() }, 200)
  }
  const requestClose = () => close()

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!form.name.trim()) return
    let saved: Customer
    try {
      saved = await createCustomer(toCreateCustomerInput(form))
    } catch (err) {
      console.error('Error guardando cliente:', err)
      void alertDialog({ message: 'No se pudo guardar el cliente. Revisa los datos e intenta de nuevo.', danger: true })
      return
    }
    const row = toCustomerRow(saved, form)
    close(() => onCreated(saved, row))
  }

  return createPortal(
    <div className={`modal-overlay-dark ${closing ? 'closing' : ''}`} onClick={requestClose}>
      <div className="client-modal-box animate-pop clientes-modal-glow" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header-line clientes-modal-header-glow">
          <div>
            <h3 className="modal-title">Nuevo cliente</h3>
            <p className="modal-sub-desc">Registra un nuevo cliente en el sistema</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="crm-form mt-3">
          <div className="field">
            <label className="field-label-white">Nombre</label>
            <input
              type="text"
              placeholder="Ingresa el nombre del cliente"
              value={form.name}
              onChange={(e) => setField('name', e.target.value)}
              className="modal-input-dark"
              required
            />
          </div>

          <div className="field mt-3">
            <label className="field-label-white">Apellido</label>
            <input
              type="text"
              placeholder="Ingresa el apellido del cliente"
              value={form.lastName}
              onChange={(e) => setField('lastName', e.target.value)}
              className="modal-input-dark"
            />
          </div>

          <div className="field mt-3">
            <label className="field-label-white">Teléfono</label>
            <div className="input-with-icon-wrap">
              <Phone size={16} className="input-left-icon" />
              <input
                type="text"
                placeholder="Ej. 55 1234 5678"
                value={form.phone}
                onChange={(e) => setField('phone', e.target.value)}
                className="modal-input-dark with-left-icon"
              />
            </div>
          </div>

          <div className="field mt-3">
            <label className="field-label-white">Dirección</label>
            <div className="input-with-icon-wrap">
              <MapPin size={16} className="input-left-icon" />
              <input
                type="text"
                placeholder="Ej. Av. Bolívar, casa 12"
                value={form.address}
                onChange={(e) => setField('address', e.target.value)}
                className="modal-input-dark with-left-icon"
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
                  value={form.birthMonth}
                  onChange={(e) => setField('birthMonth', e.target.value)}
                >
                  <option value="">Selecciona el mes</option>
                  {MONTH_NAMES.map((m, i) => (
                    <option key={m} value={String(i + 1)}>{m}</option>
                  ))}
                </StyledSelect>
              </div>
              <div className="select-col">
                <span className="select-sub-label">Día</span>
                <StyledSelect
                  className="modal-select-dark"
                  value={form.birthDay}
                  onChange={(e) => setField('birthDay', e.target.value)}
                >
                  <option value="">Selecciona el día</option>
                  {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </StyledSelect>
              </div>
            </div>
            <span className="birthday-hint mt-1">
              <Info size={14} /> Solo para promociones y recordatorios
            </span>
          </div>

          <div className="modal-actions-row-right mt-4">
            <button type="button" className="btn-modal-cancel" onClick={requestClose}>
              Cancelar
            </button>
            <button type="submit" className="btn-modal-submit-red">
              Guardar cliente
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  )
}
