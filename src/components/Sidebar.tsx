import React, { useState, useRef, useCallback, useEffect } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { useAuth } from '../context/auth-context'
import { LogOut, ChevronLeft, ChevronDown, Flame, Boxes, Landmark, SlidersHorizontal } from 'lucide-react'
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

const GROUP_ICONS: Record<string, typeof Flame> = {
  Operación: Flame,
  'Gestión': Boxes,
  Finanzas: Landmark,
  Configuración: SlidersHorizontal
}

export function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const location = useLocation()
  const { user, signOut } = useAuth()
  const [tooltip, setTooltip] = useState<TooltipState | null>(null)
  const tooltipTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const navItems = allNavItems.filter(item =>
    canAccessModule(item.path, user?.role, user?.allowedModules)
  )
  const activeGroup = navItems.find(item => isActiveItem(item.path, location.pathname))?.group
  const [openGroup, setOpenGroup] = useState(activeGroup ?? 'Operación')

  useEffect(() => {
    if (activeGroup) setOpenGroup(activeGroup)
  }, [activeGroup])

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

  const toggleGroup = (group: string) => {
    setOpenGroup(current => current === group ? '' : group)
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
          const GroupIcon = GROUP_ICONS[group] ?? Boxes
          const isOpen = openGroup === group
          const hasActiveItem = items.some(item => isActiveItem(item.path, location.pathname))

          if (collapsed) {
            return (
              <button
                key={group}
                type="button"
                className={`sidebar-group-compact ${hasActiveItem ? 'active' : ''}`}
                aria-label={`Abrir ${group}`}
                onClick={() => {
                  setOpenGroup(group)
                  handleToggle()
                }}
                onMouseEnter={(event) => showTooltip(group, event)}
                onMouseLeave={hideTooltip}
              >
                <GroupIcon size={19} strokeWidth={1.8} />
              </button>
            )
          }

          return (
            <section key={group} className={`sidebar-group ${isOpen ? 'open' : ''} ${hasActiveItem ? 'has-active' : ''}`}>
              <button
                type="button"
                className="sidebar-group-header"
                aria-expanded={isOpen}
                aria-controls={`sidebar-group-${group.replace(/\s+/g, '-').toLowerCase()}`}
                onClick={() => toggleGroup(group)}
              >
                <span className="sidebar-group-icon"><GroupIcon size={18} strokeWidth={1.8} /></span>
                <span className="sidebar-group-copy">
                  <strong>{group}</strong>
                  <small>{items.length} módulo{items.length === 1 ? '' : 's'}</small>
                </span>
                <ChevronDown size={16} className="sidebar-group-chevron" />
              </button>

              {isOpen ? (
                <div
                  className="sidebar-group-items"
                  id={`sidebar-group-${group.replace(/\s+/g, '-').toLowerCase()}`}
                >
                  {items.map(item => {
                    const Icon = item.icon
                    const isActive = isActiveItem(item.path, location.pathname)
                    return (
                      <NavLink key={item.path} to={item.path} className={`sidebar-link ${isActive ? 'active' : ''}`}>
                        <Icon size={17} strokeWidth={1.8} className="sidebar-icon" />
                        <span className="sidebar-label">{item.label}</span>
                      </NavLink>
                    )
                  })}
                </div>
              ) : null}
            </section>
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
