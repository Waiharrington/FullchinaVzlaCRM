import { useCallback, useEffect, useRef, useState } from 'react'
import { AlertTriangle, HelpCircle, Info } from 'lucide-react'
import type { DialogOptions } from './ConfirmDialog'
import './ConfirmDialog.css'

interface ViewProps extends DialogOptions {
  showCancel: boolean
  onResult: (result: boolean) => void
  onInput?: (value: string) => void
}

export function ConfirmDialogView({ title, message, confirmText, cancelText = 'Cancelar', danger, showCancel, input, onInput, onResult }: ViewProps) {
  const confirmRef = useRef<HTMLButtonElement>(null)
  const closeTimer = useRef<number | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const [closing, setClosing] = useState(false)
  const [value, setValue] = useState('')
  const incomplete = Boolean(input && value.length < (input.minLength ?? 1))
  const requestResult = useCallback((result: boolean) => {
    if (closing) return
    setClosing(true)
    closeTimer.current = window.setTimeout(() => onResult(result), 170)
  }, [closing, onResult])

  useEffect(() => {
    ;(inputRef.current ?? confirmRef.current)?.focus()
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') requestResult(false)
      // Enter sobre "Cancelar" lo activa el propio botón.
      if (e.key === 'Enter' && !incomplete && !(e.target instanceof HTMLButtonElement)) requestResult(true)
    }
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
    }
  }, [requestResult, incomplete])

  useEffect(() => () => {
    if (closeTimer.current !== null) window.clearTimeout(closeTimer.current)
  }, [])

  const Icon = danger ? AlertTriangle : showCancel ? HelpCircle : Info

  return (
    <div className={`confirm-overlay${closing ? ' closing' : ''}`} onClick={() => requestResult(false)}>
      <div className={`confirm-card${closing ? ' closing' : ''}`} role="alertdialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <div className="confirm-brand" aria-hidden="true"><img src="/icons/wok-mark.png" alt="" /><span className={`confirm-icon${danger ? ' danger' : ''}`}><Icon size={15} /></span></div>
        {title && <h3 className="confirm-title">{title}</h3>}
        <p className="confirm-message">{message}</p>
        {input && <label className="confirm-field"><span>{input.label}</span><input ref={inputRef} type={input.type ?? 'text'} value={value} autoComplete={input.type === 'password' ? 'new-password' : 'off'} onChange={event => { setValue(event.target.value); onInput?.(event.target.value) }} /></label>}
        <div className="confirm-actions">
          {showCancel && <button type="button" className="confirm-btn-cancel" onClick={() => requestResult(false)}>{cancelText}</button>}
          <button type="button" ref={confirmRef} disabled={incomplete} className={`confirm-btn-ok${danger ? ' danger' : ''}`} onClick={() => requestResult(true)}>
            {confirmText ?? (showCancel ? 'Aceptar' : 'Entendido')}
          </button>
        </div>
      </div>
    </div>
  )
}
