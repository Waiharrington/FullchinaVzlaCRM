import { createPortal } from 'react-dom'
import { useEffect, useRef, useState, useCallback } from 'react'
import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react'
import './Toast.css'

type ToastType = 'success' | 'error' | 'info'

interface ToastProps {
  type: ToastType
  message: string
  title?: string
  onClose?: () => void
  duration?: number
  actionLabel?: string
  onAction?: () => void
}

function getToastRoot() {
  let root = document.getElementById('toast-root')
  if (!root) {
    root = document.createElement('div')
    root.id = 'toast-root'
    document.body.appendChild(root)
  }
  return root
}

export default function Toast({ type, message, title, onClose, duration = 3000, actionLabel, onAction }: ToastProps) {
  const [closing, setClosing] = useState(false)
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => { setClosing(false) }, [message])
  useEffect(() => () => { if (closeTimer.current) clearTimeout(closeTimer.current) }, [])

  const handleClose = useCallback(() => {
    setClosing(true)
    closeTimer.current = setTimeout(() => onClose?.(), 200)
  }, [onClose])

  useEffect(() => {
    if (duration > 0 && message) {
      const timer = setTimeout(handleClose, duration)
      return () => clearTimeout(timer)
    }
  }, [message, duration, handleClose])

  if (!message) return null

  return createPortal(
    <div className={`toast-item toast-${type}${closing ? ' toast-leaving' : ''}`} role={type === 'error' ? 'alert' : 'status'}>
      <div className="toast-head">
        {type === 'error' ? <AlertCircle className="toast-icon" aria-hidden="true" /> : type === 'success' ? <CheckCircle2 className="toast-icon" aria-hidden="true" /> : <Info className="toast-icon" aria-hidden="true" />}
        <span className="toast-brand-line" aria-hidden="true" />
        <button type="button" className="toast-close" onClick={handleClose} aria-label="Cerrar">
          <X size={14} />
        </button>
      </div>
      <span className="toast-message">
        {title && <strong className="toast-title">{title}</strong>}
        {message}
        {actionLabel && onAction && (
          <button type="button" className="toast-action" onClick={onAction}>{actionLabel}</button>
        )}
      </span>
    </div>,
    getToastRoot()
  )
}
