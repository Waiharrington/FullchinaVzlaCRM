import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { BottomNav } from './BottomNav'
import { GlobalSearch } from './GlobalSearch'
import { SearchProvider } from '../context/search-context'
import './Layout.css'

export function Layout() {
  const location = useLocation()
  const mainRef = useRef<HTMLElement>(null)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => (
    typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? window.matchMedia('(min-width: 768px) and (max-width: 1199px)').matches
      : false
  ))

  useEffect(() => {
    if (!('scrollRestoration' in window.history)) return
    const previousScrollRestoration = window.history.scrollRestoration
    window.history.scrollRestoration = 'manual'
    return () => {
      window.history.scrollRestoration = previousScrollRestoration
    }
  }, [])

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return
    const tabletQuery = window.matchMedia('(min-width: 768px) and (max-width: 1199px)')
    const syncSidebarWithViewport = (event: MediaQueryListEvent) => {
      if (event.matches) setSidebarCollapsed(true)
      else if (window.innerWidth >= 1200) setSidebarCollapsed(false)
    }
    tabletQuery.addEventListener('change', syncSidebarWithViewport)
    return () => tabletQuery.removeEventListener('change', syncSidebarWithViewport)
  }, [])

  useLayoutEffect(() => {
    const resetPageScroll = () => {
      if (mainRef.current) {
        mainRef.current.scrollTop = 0
        mainRef.current.scrollLeft = 0
      }
      document.documentElement.scrollTop = 0
      document.documentElement.scrollLeft = 0
      document.body.scrollTop = 0
      document.body.scrollLeft = 0
      window.scrollTo(0, 0)
    }

    resetPageScroll()
    // En móvil, el navegador puede restaurar el scroll después del cambio
    // de ruta. Reafirma el inicio al terminar los frames de navegación.
    const frame = window.requestAnimationFrame(resetPageScroll)
    const secondFrame = window.requestAnimationFrame(() => {
      window.requestAnimationFrame(resetPageScroll)
    })
    return () => {
      window.cancelAnimationFrame(frame)
      window.cancelAnimationFrame(secondFrame)
    }
  }, [location.pathname])

  useEffect(() => {
    const main = mainRef.current
    if (!main) return

    const resetAfterTabChange = (event: MouseEvent) => {
      if (!window.matchMedia('(max-width: 767px)').matches) return
      if (!(event.target instanceof Element)) return
      const tab = event.target.closest('[role="tab"]')
      if (!tab || !main.contains(tab)) return

      window.requestAnimationFrame(() => {
        if (!main.isConnected) return
        main.scrollTop = 0
        main.scrollLeft = 0
        window.scrollTo(0, 0)
      })
    }

    main.addEventListener('click', resetAfterTabChange, true)
    return () => main.removeEventListener('click', resetAfterTabChange, true)
  }, [])

  useEffect(() => {
    const isModal = (element: Element) => {
      if (element.matches('[role="dialog"][aria-modal="true"], [role="alertdialog"][aria-modal="true"]')) return true
      return /(?:modal|dialog|drawer)-(?:overlay|backdrop)|(?:overlay|backdrop)-(?:modal|dialog)/.test(element.className?.toString() ?? '')
    }

    const observer = new MutationObserver((mutations) => {
      const opened = new Set<Element>()
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (!(node instanceof Element)) continue
          if (isModal(node)) opened.add(node)
          node.querySelectorAll('[role="dialog"][aria-modal="true"], [role="alertdialog"][aria-modal="true"]').forEach(dialog => opened.add(dialog))
        }
      }
      for (const modal of opened) {
        requestAnimationFrame(() => {
          if (!modal.isConnected) return
          for (const element of [modal, ...modal.querySelectorAll('*')]) {
            if (element.scrollTop) element.scrollTop = 0
            if (element.scrollLeft) element.scrollLeft = 0
          }
        })
      }
    })
    observer.observe(document.body, { childList: true, subtree: true })
    return () => observer.disconnect()
  }, [])

  return (
    <SearchProvider>
      <div className="app-layout">
        <div className={`sidebar-container ${mobileMenuOpen ? 'mobile-open' : ''} ${sidebarCollapsed ? 'collapsed' : ''}`}>
          <Sidebar collapsed={sidebarCollapsed} onToggle={() => setSidebarCollapsed(current => !current)} />
          {mobileMenuOpen && (
            <div 
              className="sidebar-overlay" 
              onClick={() => setMobileMenuOpen(false)}
            />
          )}
        </div>

        <div className={`main-content-wrapper ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
          <main className="app-main" ref={mainRef}>
            <Outlet />
          </main>
        </div>
        <BottomNav />
      </div>
      <GlobalSearch />
    </SearchProvider>
  )
}
