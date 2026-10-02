import { useEffect, useRef } from 'react'
import { AlertTriangle, HelpCircle, Info } from 'lucide-react'
import type { DialogOptions } from './ConfirmDialog'
import './ConfirmDialog.css'

interface ViewProps extends DialogOptions {
  showCancel: boolean
  onResult: (result: boolean) => void
}

export function ConfirmDialogView({ title, message, confirmText, cancelText = 'Cancelar', danger, showCancel, onResult }: ViewProps) {
  const confirmRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    confirmRef.current?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onResult(false)
      if (e.key === 'Enter') onResult(true)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onResult])

  const Icon = danger ? AlertTriangle : showCancel ? HelpCircle : Info

  return (
    <div className="confirm-overlay" onClick={() => onResult(false)}>
      <div className="confirm-card" role="alertdialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <div className={`confirm-icon${danger ? ' danger' : ''}`}><Icon size={22} /></div>
        {title && <h3 className="confirm-title">{title}</h3>}
        <p className="confirm-message">{message}</p>
        <div className="confirm-actions">
          {showCancel && <button type="button" className="confirm-btn-cancel" onClick={() => onResult(false)}>{cancelText}</button>}
          <button type="button" ref={confirmRef} className={`confirm-btn-ok${danger ? ' danger' : ''}`} onClick={() => onResult(true)}>
            {confirmText ?? (showCancel ? 'Aceptar' : 'Entendido')}
          </button>
        </div>
      </div>
    </div>
  )
}
