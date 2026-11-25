import { Component, type ErrorInfo, type ReactNode } from 'react'

interface Props { children: ReactNode }
interface State { failed: boolean }

const CHUNK_ERROR = /Loading chunk|Failed to fetch dynamically imported module|Importing a module script failed/i

// Evita la pantalla en blanco: si un componente falla al renderizar, la persona
// ve un aviso con botón para recargar en lugar de una página vacía.
export class AppErrorBoundary extends Component<Props, State> {
  state: State = { failed: false }

  static getDerivedStateFromError(): State {
    return { failed: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Error de pantalla:', error, info.componentStack)
    // Un chunk vencido tras un deploy se arregla solo recargando una vez.
    if (CHUNK_ERROR.test(String(error?.message))) {
      const KEY = 'fc-last-boundary-reload'
      const last = Number(sessionStorage.getItem(KEY) || '0')
      if (Date.now() - last > 10000) {
        sessionStorage.setItem(KEY, String(Date.now()))
        window.location.reload()
      }
    }
  }

  render() {
    if (!this.state.failed) return this.props.children
    return (
      <div role="alert" style={{ minHeight: '100dvh', display: 'grid', placeItems: 'center', padding: 24, background: '#0a0b0e', color: '#fff', font: '500 15px/1.4 Inter, system-ui, sans-serif', textAlign: 'center' }}>
        <div style={{ maxWidth: 360 }}>
          <h1 style={{ fontSize: 20, margin: '0 0 8px' }}>Algo salió mal</h1>
          <p style={{ margin: '0 0 18px', opacity: .8 }}>No pudimos mostrar esta pantalla. Recárgala para continuar; tu información guardada no se pierde.</p>
          <button type="button" onClick={() => window.location.reload()} style={{ border: 0, borderRadius: 10, padding: '12px 20px', background: '#e31b2b', color: '#fff', font: '700 14px Inter, system-ui, sans-serif', cursor: 'pointer' }}>Recargar</button>
        </div>
      </div>
    )
  }
}
