import React, { useState, useRef, useCallback } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { useAuth } from '../context/auth-context'
import { LogOut, ChevronLeft, ChevronDown, ChevronRight } from 'lucide-react'
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
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({
    'Gestión FullChina': true,
    Finanzas: true,
    Configuración: true
  })
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

  const groupedItems = navItems.reduce<Array<{ group: string; items: typeof navItems }>>((groups, item) => {
    const current = groups[groups.length - 1]
    if (current?.group === item.group) current.items.push(item)
    else groups.push({ group: item.group, items: [item] })
    return groups
  }, [])

  const groupParents: Record<string, string> = {
    Finanzas: '/finanzas',
    Configuración: '/mas'
  }

  const toggleGroup = (group: string) => {
    setCollapsedGroups(prev => {
      const shouldOpen = Boolean(prev[group])
      return Object.keys(prev).reduce<Record<string, boolean>>((next, key) => {
        next[key] = key === group ? !shouldOpen : true
        return next
      }, { ...prev })
    })
  }

  const handleToggle = useCallback(() => {
    if (tooltipTimer.current) clearTimeout(tooltipTimer.current)
    setTooltip(null)
    onToggle()
  }, [onToggle])

  return (
    <aside className={`sidebar ${collapsed ? 'collapsed' : ''}`}>
      <div className="sidebar-brand">
        <img src="/optimized/root/logo.webp" alt="Full China" className="sidebar-logo-img" />
        <button
          className="sidebar-toggle"
          type="button"
          aria-label={collapsed ? 'Expandir menú' : 'Contraer menú'}
          onClick={handleToggle}
          onMouseEnter={(e) => showTooltip(collapsed ? 'Expandir menú' : 'Contraer menú', e)}
          onMouseLeave={hideTooltip}
        >
          <ChevronLeft size={16} className={`sidebar-toggle-icon ${collapsed ? 'rotated' : ''}`} />
        </button>
      </div>

      <nav className="sidebar-nav">
        {groupedItems.map(({ group, items }) => {
          const parentPath = groupParents[group]
          const parent = parentPath ? items.find(item => item.path === parentPath) : undefined
          const children = parent ? items.filter(item => item.path !== parent.path) : items
          const isOpen = !collapsedGroups[group]

          return (
            <React.Fragment key={group}>
              {!collapsed && (
                <div
                  className="sidebar-group-header"
                  role="button"
                  tabIndex={0}
                  onClick={() => toggleGroup(group)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault()
                      toggleGroup(group)
                    }
                  }}
                >
                  {parent ? (
                    <NavLink
                      to={parent.path}
                      className={`sidebar-group-parent ${isActiveItem(parent.path, location.pathname) ? 'active' : ''}`}
                      onClick={(event) => event.stopPropagation()}
                    >
                      <span>{group}</span>
                    </NavLink>
                  ) : <span className="sidebar-group-parent"><span>{group}</span></span>}
                  <button
                    type="button"
                    className="sidebar-group-toggle"
                    aria-label={`${isOpen ? 'Ocultar' : 'Mostrar'} ${group}`}
                    aria-expanded={isOpen}
                    onClick={(event) => {
                      event.preventDefault()
                      event.stopPropagation()
                      toggleGroup(group)
                    }}
                  >
                    {isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                  </button>
                </div>
              )}
              {(!parent || isOpen || collapsed) && (collapsed && parent ? [parent, ...children] : children).map(item => {
                const Icon = item.icon
                const isActive = isActiveItem(item.path, location.pathname)
                return (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    className={`sidebar-link ${isActive ? 'active' : ''}`}
                    onMouseEnter={(e) => collapsed && showTooltip(item.label, e)}
                    onMouseLeave={hideTooltip}
                  >
                    <Icon size={18} strokeWidth={1.8} className="sidebar-icon" />
                    <span className="sidebar-label">{item.label}</span>
                  </NavLink>
                )
              })}
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



      <div className="sidebar-user-profile" aria-hidden={collapsed}>
          <img 
            src="/optimized/login-carousel/slide7.webp" 
            alt="Avatar" 
            className="sidebar-user-avatar" 
          />
          <div className="sidebar-user-info">
            <span className="sidebar-user-name">{user?.email || 'Admin'}</span>
            <span className="sidebar-user-sub">Full China</span>
          </div>
      </div>

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
