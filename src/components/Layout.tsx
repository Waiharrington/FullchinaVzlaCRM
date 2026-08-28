import { useState, useEffect } from 'react'
import { Outlet } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { BottomNav } from './BottomNav'
import { GlobalSearch } from './GlobalSearch'
import './Layout.css'

export function Layout() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)

  // En tablet el menú abre expandido y se minimiza solo a los pocos segundos:
  // así se ve el texto de las secciones una vez, y luego se libera espacio.
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 680px) and (max-width: 1200px)')
    if (!mq.matches) return
    const timer = setTimeout(() => setSidebarCollapsed(true), 2000)
    return () => clearTimeout(timer)
  }, [])

  return (
    <div className="app-layout">
      <div className={`sidebar-container ${mobileMenuOpen ? 'mobile-open' : ''} ${sidebarCollapsed ? 'collapsed' : ''}`}>
        <Sidebar collapsed={sidebarCollapsed} onToggle={() => setSidebarCollapsed(!sidebarCollapsed)} />
        {mobileMenuOpen && (
          <div 
            className="sidebar-overlay" 
            onClick={() => setMobileMenuOpen(false)}
          />
        )}
      </div>

      <div className={`main-content-wrapper ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
        <header className="app-topbar">
          <GlobalSearch />
        </header>
        <main className="app-main">
          <Outlet />
        </main>
      </div>
      <BottomNav />
    </div>
  )
}
