import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { BottomNav } from './BottomNav'
import './Layout.css'

export function Layout() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  return (
    <div className="app-layout">
      {/* Sidebar - hidden on mobile unless open */}
      <div className={`sidebar-container ${mobileMenuOpen ? 'mobile-open' : ''}`}>
        <Sidebar />
        {/* Overlay to close sidebar on mobile */}
        {mobileMenuOpen && (
          <div 
            className="sidebar-overlay" 
            onClick={() => setMobileMenuOpen(false)}
          />
        )}
      </div>

      <div className="main-content-wrapper">
        <main className="app-main">
          <Outlet />
        </main>
      </div>
      <BottomNav />
    </div>
  )
}

