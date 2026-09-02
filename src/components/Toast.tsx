import { createPortal } from 'react-dom'
import { useEffect, useRef, useState, useCallback } from 'react'
import { CheckCircle2, AlertTriangle, Info, X } from 'lucide-react'
import './Toast.css'

type ToastType = 'success' | 'error' | 'info'

interface ToastProps {
  type: ToastType
  message: string
  onClose?: () => void
  duration?: number
  actionLabel?: string
  onAction?: () => void
}

const ICONS: Record<ToastType, typeof CheckCircle2> = {
  success: CheckCircle2,
  error: AlertTriangle,
  info: Info,
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

export default function Toast({ type, message, onClose, duration = 3000, actionLabel, onAction }: ToastProps) {
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

  const Icon = ICONS[type]

  return createPortal(
    <div className={`toast-item toast-${type}${closing ? ' toast-leaving' : ''}`} role={type === 'error' ? 'alert' : 'status'}>
      <span className="toast-icon"><Icon size={17} /></span>
      <span className="toast-message">
        {message}
        {actionLabel && onAction && (
          <button type="button" className="toast-action" onClick={onAction}>{actionLabel}</button>
        )}
      </span>
      <button type="button" className="toast-close" onClick={handleClose} aria-label="Cerrar">
        <X size={13} />
      </button>
      <span className="toast-progress" style={{ animationDuration: `${duration}ms` }} />
    </div>,
    getToastRoot()
  )
}
