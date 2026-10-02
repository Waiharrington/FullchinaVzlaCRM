import { createRoot } from 'react-dom/client'
import { ConfirmDialogView } from './ConfirmDialogView'

export interface DialogOptions {
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

export function confirmDialog(options: DialogOptions | string): Promise<boolean> {
  const opts: DialogOptions = typeof options === 'string' ? { message: options } : options
  return mount((onResult) => <ConfirmDialogView {...opts} showCancel onResult={onResult} />)
}

export function alertDialog(options: DialogOptions | string): Promise<void> {
  const opts: DialogOptions = typeof options === 'string' ? { message: options } : options
  return mount((onResult) => <ConfirmDialogView {...opts} showCancel={false} onResult={onResult} />).then(() => undefined)
}
