import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { BottomNav } from './BottomNav'
import './Layout.css'

export function Layout() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)

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
        <main className="app-main">
          <Outlet />
        </main>
      </div>
      <BottomNav />
    </div>
  )
}
