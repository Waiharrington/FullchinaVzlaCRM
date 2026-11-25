import { useState, type FormEvent } from 'react'
import { createPortal } from 'react-dom'
import { MapPin, Phone } from 'lucide-react'
import { StyledSelect } from '../../components/StyledSelect'
import { updateCustomer, type Customer } from '../../lib/dataService'
import { customerToEditForm, toUpdateCustomerInput, type EditClientForm } from './editClient'
import { MONTH_NAMES } from './newClient'

interface EditClientModalProps {
  customer: Customer
  onClose: () => void
  onSaved: (updated: Customer) => void
}

// Edición de los datos de un cliente. El padre decide cuándo mostrarlo y
// recibe el cliente actualizado.
export function EditClientModal({ customer, onClose, onSaved }: EditClientModalProps) {
  const [form, setForm] = useState<EditClientForm>(() => customerToEditForm(customer))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [closing, setClosing] = useState(false)
  const setField = (field: keyof EditClientForm, value: string) => setForm(current => ({ ...current, [field]: value }))

  const requestClose = () => {
    if (closing) return
    setClosing(true)
    window.setTimeout(onClose, 200)
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!form.name.trim()) return
    setSaving(true)
    setError('')
    try {
      const updated = await updateCustomer(customer.id, toUpdateCustomerInput(form))
      onSaved(updated)
      requestClose()
    } catch (err) {
      console.error('Error actualizando cliente:', err)
      setError('No se pudo actualizar el cliente. Revisa los datos e intenta de nuevo.')
    } finally {
      setSaving(false)
    }
  }

  return createPortal(
    <div className={`modal-overlay-dark ${closing ? 'closing' : ''}`} onClick={requestClose}>
      <div className="client-modal-box animate-pop clientes-modal-glow" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header-line clientes-modal-header-glow">
          <div>
            <h3 className="modal-title">Editar cliente</h3>
            <p className="modal-sub-desc">Actualiza los datos del cliente</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="crm-form mt-3">
          <div className="field">
            <label className="field-label-white">Nombre completo</label>
            <input type="text" value={form.name} onChange={(e) => setField('name', e.target.value)} className="modal-input-dark" required />
          </div>

          <div className="field mt-3">
            <label className="field-label-white">Cédula / Identificación</label>
            <input type="text" placeholder="Ej. V-12345678" value={form.identification} onChange={(e) => setField('identification', e.target.value)} className="modal-input-dark" />
          </div>

          <div className="field mt-3">
            <label className="field-label-white">Teléfono</label>
            <div className="input-with-icon-wrap">
              <Phone size={16} className="input-left-icon" />
              <input type="text" placeholder="Ej. 0412 1234567" value={form.phone} onChange={(e) => setField('phone', e.target.value)} className="modal-input-dark with-left-icon" />
            </div>
          </div>

          <div className="field mt-3">
            <label className="field-label-white">Dirección</label>
            <div className="input-with-icon-wrap">
              <MapPin size={16} className="input-left-icon" />
              <input type="text" placeholder="Ej. Av. Bolívar, casa 12" value={form.address} onChange={(e) => setField('address', e.target.value)} className="modal-input-dark with-left-icon" />
            </div>
          </div>

          <div className="field mt-3">
            <label className="field-label-white">Cumpleaños</label>
            <div className="birthday-selects-row">
              <div className="select-col">
                <span className="select-sub-label">Mes</span>
                <StyledSelect className="modal-select-dark" value={form.birthMonth} onChange={(e) => setField('birthMonth', e.target.value)}>
                  <option value="">Selecciona el mes</option>
                  {MONTH_NAMES.map((m, i) => (
                    <option key={m} value={String(i + 1)}>{m}</option>
                  ))}
                </StyledSelect>
              </div>
              <div className="select-col">
                <span className="select-sub-label">Día</span>
                <StyledSelect className="modal-select-dark" value={form.birthDay} onChange={(e) => setField('birthDay', e.target.value)}>
                  <option value="">Selecciona el día</option>
                  {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </StyledSelect>
              </div>
            </div>
          </div>

          {error && <p className="login-error mt-2">{error}</p>}

          <div className="modal-actions-row-right mt-4">
            <button type="button" className="btn-modal-cancel" onClick={requestClose}>Cancelar</button>
            <button type="submit" className="btn-modal-submit-red" disabled={saving}>{saving ? 'Guardando…' : 'Guardar cambios'}</button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  )
}
