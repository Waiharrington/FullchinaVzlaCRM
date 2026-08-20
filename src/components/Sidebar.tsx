import React, { useState, useRef, useCallback } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { useAuth } from '../context/auth-context'
import { LogOut, ChevronLeft } from 'lucide-react'
import { allNavItems, canAccessModule } from './navItems'
import './Sidebar.css'

interface SidebarProps {
  collapsed: boolean
  onToggle: () => void
}

interface TooltipState {
  text: string
  top: number
  left: number
}

export function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const location = useLocation()
  const { user, signOut } = useAuth()
  const [tooltip, setTooltip] = useState<TooltipState | null>(null)
  const tooltipTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const navItems = allNavItems.filter(item =>
    canAccessModule(item.path, user?.role, user?.allowedModules)
  )

  const showTooltip = useCallback((text: string, e: React.MouseEvent) => {
    if (tooltipTimer.current) clearTimeout(tooltipTimer.current)
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    setTooltip({
      text,
      top: rect.top + rect.height / 2,
      left: rect.right + 10
    })
  }, [])

  const hideTooltip = useCallback(() => {
    tooltipTimer.current = setTimeout(() => setTooltip(null), 100)
  }, [])

  return (
    <aside className={`sidebar ${collapsed ? 'collapsed' : ''}`}>
      <div className="sidebar-brand">
        <img src="/logo.png" alt="Full China" className="sidebar-logo-img" />
        <button
          className="sidebar-toggle"
          onClick={onToggle}
          onMouseEnter={(e) => showTooltip(collapsed ? 'Expandir menú' : 'Contraer menú', e)}
          onMouseLeave={hideTooltip}
        >
          <ChevronLeft size={16} className={`sidebar-toggle-icon ${collapsed ? 'rotated' : ''}`} />
        </button>
      </div>

      <nav className="sidebar-nav">
        {navItems.map((item, index) => {
          const Icon = item.icon
          const isActive = isActiveItem(item.path, location.pathname)
          const showGroup = index === 0 || item.group !== navItems[index - 1].group

          return (
            <React.Fragment key={item.path}>
              {showGroup && !collapsed && (
                <div className="sidebar-group-title">{item.group.toUpperCase()}</div>
              )}
              <NavLink
                to={item.path}
                className={`sidebar-link ${isActive ? 'active' : ''}`}
                onMouseEnter={(e) => collapsed && showTooltip(item.label, e)}
                onMouseLeave={hideTooltip}
              >
                <Icon size={18} strokeWidth={1.8} className="sidebar-icon" />
                <span className="sidebar-label">{item.label}</span>
              </NavLink>
            </React.Fragment>
          )
        })}

      </nav>

      <div className="sidebar-bottom-actions">
        <button 
          className="sidebar-link sidebar-logout-btn-item" 
          onClick={signOut}
          onMouseEnter={(e) => collapsed && showTooltip('Cerrar sesión', e)}
          onMouseLeave={hideTooltip}
        >
          <LogOut size={18} strokeWidth={1.8} className="sidebar-icon" />
          <span className="sidebar-label">Cerrar sesión</span>
        </button>
      </div>



      {!collapsed && (
        <div className="sidebar-user-profile">
          <img 
            src="/login-carousel/slide7.jpg" 
            alt="Avatar" 
            className="sidebar-user-avatar" 
          />
          <div className="sidebar-user-info">
            <span className="sidebar-user-name">{user?.email || 'Admin'}</span>
            <span className="sidebar-user-sub">Full China</span>
          </div>
        </div>
      )}

      {tooltip && (
        <div 
          className="sidebar-tooltip-portal"
          style={{ 
            position: 'fixed',
            top: tooltip.top,
            left: tooltip.left,
            transform: 'translateY(-50%)',
            zIndex: 9999
          }}
        >
          <div className="sidebar-tooltip">{tooltip.text}</div>
        </div>
      )}
    </aside>
  )
}

function isActiveItem(path: string, pathname: string): boolean {
  if (path === '/') return pathname === '/'
  return pathname === path || pathname.startsWith(path + '/')
}
