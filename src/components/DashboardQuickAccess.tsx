import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import './DashboardQuickAccess.css'

const QuickComandas = lazy(() => import('../pages/Comandas').then(module => ({ default: module.Comandas })))
const QuickCaja = lazy(() => import('../pages/Caja').then(module => ({ default: module.Caja })))
const QuickMenu = lazy(() => import('../pages/Menu').then(module => ({ default: module.Menu })))
const QuickMesas = lazy(() => import('../pages/Mesas').then(module => ({ default: module.Mesas })))
const QuickInventario = lazy(() => import('../pages/Inventario').then(module => ({ default: module.Inventario })))
const QuickClientes = lazy(() => import('../pages/Clientes').then(module => ({ default: module.Clientes })))

export type DashboardShortcut = 'comandas' | 'ventas' | 'menu' | 'mesas' | 'inventario' | 'clientes'

const SHORTCUT_TITLES: Record<DashboardShortcut, string> = {
  comandas: 'Comandas',
  ventas: 'Ventas',
  menu: 'Menú',
  mesas: 'Mesas',
  inventario: 'Inventario',
  clientes: 'Clientes',
}

const SHORTCUT_LOADING_COPY: Record<DashboardShortcut, string> = {
  comandas: 'Tus pedidos y sus estados están por aparecer.',
  ventas: 'Tu resumen de caja estará listo enseguida.',
  menu: 'Platos y precios, listos para revisar.',
  mesas: 'Estamos organizando tus mesas.',
  inventario: 'Existencias y alertas en un instante.',
  clientes: 'Tus clientes estarán aquí enseguida.',
}

interface DashboardQuickAccessProps {
  shortcut: DashboardShortcut
  onClose: () => void
}

export function DashboardQuickAccess({ shortcut, onClose }: DashboardQuickAccessProps) {
  const [closing, setClosing] = useState(false)
  const closeTimer = useRef<number | null>(null)
  const requestClose = useCallback(() => {
    if (closing) return
    setClosing(true)
    closeTimer.current = window.setTimeout(onClose, 190)
  }, [closing, onClose])

  useEffect(() => {
    const previousOverflow = document.body.style.overflow
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') requestClose()
    }

    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [onClose, requestClose])

  useEffect(() => () => {
    if (closeTimer.current !== null) window.clearTimeout(closeTimer.current)
  }, [])

  const moduleView = (() => {
    switch (shortcut) {
      case 'comandas': return <QuickComandas />
      case 'ventas': return <QuickCaja embedded onClose={onClose} />
      case 'menu': return <QuickMenu />
      case 'mesas': return <QuickMesas />
      case 'inventario': return <QuickInventario />
      case 'clientes': return <QuickClientes />
    }
  })()

  return createPortal(
    <div className={`db-quick-access-overlay${closing ? ' closing' : ''}`} onClick={event => { if (event.target === event.currentTarget) requestClose() }}>
      <section className={`db-quick-access-dialog${closing ? ' closing' : ''}`} role="dialog" aria-modal="true" aria-labelledby="db-quick-access-title" tabIndex={-1}>
        <header className="db-quick-access-header">
          <div>
            <span>Acceso directo</span>
            <h2 id="db-quick-access-title">{SHORTCUT_TITLES[shortcut]}</h2>
          </div>
          <button type="button" className="db-quick-access-close" autoFocus onClick={requestClose} aria-label={`Cerrar ${SHORTCUT_TITLES[shortcut]}`}>
            <X size={19} />
          </button>
        </header>
        <div className={`db-quick-access-body db-quick-access-body--${shortcut}`}>
          <Suspense fallback={<div className="db-quick-access-loading" role="status" aria-label={`Preparando ${SHORTCUT_TITLES[shortcut]}`}>
            <div className="db-quick-access-loading-art" aria-hidden="true">
              <span className="db-quick-access-loading-orbit" />
              <span className="db-quick-access-loading-orbit db-quick-access-loading-orbit--inner" />
              <span className="db-quick-access-loading-logo"><img src="/optimized/root/splash-logo.webp" alt="" /></span>
              <i className="db-quick-access-loading-spark db-quick-access-loading-spark--one" />
              <i className="db-quick-access-loading-spark db-quick-access-loading-spark--two" />
              <i className="db-quick-access-loading-spark db-quick-access-loading-spark--three" />
            </div>
            <span className="db-quick-access-loading-kicker">Full China · Acceso directo</span>
            <strong>Alistando {SHORTCUT_TITLES[shortcut]}</strong>
            <p>{SHORTCUT_LOADING_COPY[shortcut]}</p>
            <span className="db-quick-access-loading-track" aria-hidden="true"><i /></span>
          </div>}>
            {moduleView}
          </Suspense>
        </div>
      </section>
    </div>,
    document.body,
  )
}
