import { lazy, Suspense, useEffect } from 'react'
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

interface DashboardQuickAccessProps {
  shortcut: DashboardShortcut
  onClose: () => void
}

export function DashboardQuickAccess({ shortcut, onClose }: DashboardQuickAccessProps) {
  useEffect(() => {
    const previousOverflow = document.body.style.overflow
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }

    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [onClose])

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
    <div className="db-quick-access-overlay" onClick={event => { if (event.target === event.currentTarget) onClose() }}>
      <section className="db-quick-access-dialog" role="dialog" aria-modal="true" aria-labelledby="db-quick-access-title" tabIndex={-1}>
        <header className="db-quick-access-header">
          <div>
            <span>Acceso directo</span>
            <h2 id="db-quick-access-title">{SHORTCUT_TITLES[shortcut]}</h2>
          </div>
          <button type="button" className="db-quick-access-close" autoFocus onClick={onClose} aria-label={`Cerrar ${SHORTCUT_TITLES[shortcut]}`}>
            <X size={19} />
          </button>
        </header>
        <div className={`db-quick-access-body db-quick-access-body--${shortcut}`}>
          <Suspense fallback={<div className="db-quick-access-loading" role="status">Cargando {SHORTCUT_TITLES[shortcut].toLowerCase()}…</div>}>
            {moduleView}
          </Suspense>
        </div>
      </section>
    </div>,
    document.body,
  )
}
