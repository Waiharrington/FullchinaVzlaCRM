import { useEffect, useRef } from 'react'
import { createRoot } from 'react-dom/client'
import { AlertTriangle, HelpCircle, Info } from 'lucide-react'
import './ConfirmDialog.css'

interface DialogOptions {
  title?: string
  message: string
  confirmText?: string
  cancelText?: string
  danger?: boolean
}

function mount(node: (onResult: (result: boolean) => void) => React.ReactElement): Promise<boolean> {
  return new Promise((resolve) => {
    const container = document.createElement('div')
    document.body.appendChild(container)
    const root = createRoot(container)
    document.body.classList.add('modal-open')
    const finish = (result: boolean) => {
      root.unmount()
      container.remove()
      document.body.classList.remove('modal-open')
      resolve(result)
    }
    root.render(node(finish))
  })
}

interface ViewProps extends DialogOptions {
  showCancel: boolean
  onResult: (result: boolean) => void
}

function DialogView({ title, message, confirmText, cancelText = 'Cancelar', danger, showCancel, onResult }: ViewProps) {
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

export function confirmDialog(options: DialogOptions | string): Promise<boolean> {
  const opts: DialogOptions = typeof options === 'string' ? { message: options } : options
  return mount((onResult) => <DialogView {...opts} showCancel onResult={onResult} />)
}

export function alertDialog(options: DialogOptions | string): Promise<void> {
  const opts: DialogOptions = typeof options === 'string' ? { message: options } : options
  return mount((onResult) => <DialogView {...opts} showCancel={false} onResult={onResult} />).then(() => undefined)
}
