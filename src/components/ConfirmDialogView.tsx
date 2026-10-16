import { useCallback, useEffect, useRef, useState } from 'react'
import { AlertTriangle, HelpCircle, Info } from 'lucide-react'
import type { DialogOptions } from './ConfirmDialog'
import './ConfirmDialog.css'

interface ViewProps extends DialogOptions {
  showCancel: boolean
  onResult: (result: boolean) => void
}

export function ConfirmDialogView({ title, message, confirmText, cancelText = 'Cancelar', danger, showCancel, onResult }: ViewProps) {
  const confirmRef = useRef<HTMLButtonElement>(null)
  const closeTimer = useRef<number | null>(null)
  const [closing, setClosing] = useState(false)
  const requestResult = useCallback((result: boolean) => {
    if (closing) return
    setClosing(true)
    closeTimer.current = window.setTimeout(() => onResult(result), 170)
  }, [closing, onResult])

  useEffect(() => {
    confirmRef.current?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') requestResult(false)
      if (e.key === 'Enter') requestResult(true)
    }
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
    }
  }, [requestResult])

  useEffect(() => () => {
    if (closeTimer.current !== null) window.clearTimeout(closeTimer.current)
  }, [])

  const Icon = danger ? AlertTriangle : showCancel ? HelpCircle : Info

  return (
    <div className={`confirm-overlay${closing ? ' closing' : ''}`} onClick={() => requestResult(false)}>
      <div className={`confirm-card${closing ? ' closing' : ''}`} role="alertdialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <div className={`confirm-icon${danger ? ' danger' : ''}`}><Icon size={22} /></div>
        {title && <h3 className="confirm-title">{title}</h3>}
        <p className="confirm-message">{message}</p>
        <div className="confirm-actions">
          {showCancel && <button type="button" className="confirm-btn-cancel" onClick={() => requestResult(false)}>{cancelText}</button>}
          <button type="button" ref={confirmRef} className={`confirm-btn-ok${danger ? ' danger' : ''}`} onClick={() => requestResult(true)}>
            {confirmText ?? (showCancel ? 'Aceptar' : 'Entendido')}
          </button>
        </div>
      </div>
    </div>
  )
}
