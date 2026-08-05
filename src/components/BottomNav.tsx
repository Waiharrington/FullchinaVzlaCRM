import { useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { useAuth } from '../context/auth-context'
import { Menu, X, LogOut } from 'lucide-react'
import { allNavItems } from './Sidebar'
import './BottomNav.css'

export function BottomNav() {
  const location = useLocation()
  const { user, signOut } = useAuth()
  const [isMenuOpen, setIsMenuOpen] = useState(false)

  // Filtramos las rutas permitidas para el usuario actual
  const allowedItems = allNavItems.filter(item =>
    user?.role ? item.roles.includes(user.role) : true
  )

  // En la barra inferior (BottomNav) mostramos solo los primeros 4 elementos principales
  const bottomItems = allowedItems.slice(0, 4)
  // En el menú "Más" mostramos TODOS los elementos para tener una navegación completa
  const menuItems = allowedItems

  return (
    <>
      <nav className="bottom-nav">
        <div className="bottom-nav-inner">
          {bottomItems.map((item) => {
            const Icon = item.icon
            const isActive = isActiveItem(item.path, location.pathname)
            return (
              <NavLink
                key={item.path}
                to={item.path}
                onClick={() => setIsMenuOpen(false)}
                className={`bottom-nav-item ${isActive ? 'active' : ''}`}
              >
                <div className="bottom-nav-icon-wrap">
                  <Icon size={20} strokeWidth={isActive ? 2.2 : 1.6} />
                  {isActive && <div className="bottom-nav-active-dot" />}
                </div>
                <span className="bottom-nav-label">{item.label}</span>
              </NavLink>
            )
          })}

          {/* Botón de Menú (Más) */}
          <button 
            className={`bottom-nav-item ${isMenuOpen ? 'active' : ''}`}
            onClick={() => setIsMenuOpen(!isMenuOpen)}
          >
            <div className="bottom-nav-icon-wrap">
              {isMenuOpen ? <X size={20} strokeWidth={2.2} /> : <Menu size={20} strokeWidth={1.6} />}
              {isMenuOpen && <div className="bottom-nav-active-dot" />}
            </div>
            <span className="bottom-nav-label">Menú</span>
          </button>
        </div>
      </nav>

      {/* OVERLAY DEL MENÚ */}
      {isMenuOpen && (
        <div className="bottom-nav-overlay">
          <div className="bottom-nav-drawer">
            <div className="bottom-nav-drawer-header">
              <h2>Menú Principal</h2>
              <button className="bottom-nav-close" onClick={() => setIsMenuOpen(false)}>
                <X size={24} />
              </button>
            </div>
            
            <div className="bottom-nav-drawer-content">
              {menuItems.map((item, index) => {
                const Icon = item.icon
                const isActive = isActiveItem(item.path, location.pathname)
                const showGroup = index === 0 || item.group !== menuItems[index - 1].group

                return (
                  <div key={item.path}>
                    {showGroup && (
                      <div className="bottom-nav-group">{item.group.toUpperCase()}</div>
                    )}
                    <NavLink
                      to={item.path}
                      onClick={() => setIsMenuOpen(false)}
                      className={`bottom-nav-drawer-item ${isActive ? 'active' : ''}`}
                    >
                      <Icon size={20} className="bottom-nav-drawer-icon" />
                      <span>{item.label}</span>
                    </NavLink>
                  </div>
                )
              })}
            </div>

            <div className="bottom-nav-drawer-footer">
              <button className="bottom-nav-logout" onClick={() => { setIsMenuOpen(false); signOut(); }}>
                <LogOut size={20} />
                <span>Cerrar Sesión</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

function isActiveItem(path: string, pathname: string): boolean {
  if (path === '/') return pathname === '/'
  return pathname === path || pathname.startsWith(path + '/')
}
