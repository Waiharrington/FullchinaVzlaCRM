import { Bell, Search, Menu, ChevronDown } from 'lucide-react'
import { useAuth } from '../context/auth-context'
import { useNavigate } from 'react-router-dom'
import { useState } from 'react'
import './TopBar.css'

export function TopBar({ onMenuClick }: { onMenuClick?: () => void }) {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [notificationsOpen, setNotificationsOpen] = useState(false)

  const runSearch = () => {
    const value = query.trim().toLowerCase()
    if (!value) return
    const route = value.includes('invent') ? '/inventario' : value.includes('compra') ? '/compras' : value.includes('caja') ? '/caja' : value.includes('comanda') || value.includes('pedido') ? '/comandas' : value.includes('gasto') ? '/gastos' : '/inicio'
    navigate(route)
    setQuery('')
  }

  return (
    <header className="topbar">
      <div className="topbar-left">
        <button className="menu-btn mobile-only" onClick={onMenuClick}>
          <Menu size={24} />
        </button>
        <div className="search-bar">
          <input value={query} onChange={event => setQuery(event.target.value)} onKeyDown={event => event.key === 'Enter' && runSearch()} placeholder="Buscar en el sistema..." aria-label="Buscar en el sistema" />
          <Search size={18} className="search-icon" />
        </div>
      </div>

      <div className="topbar-right">
        <button className="icon-btn notification-btn" onClick={() => setNotificationsOpen(open => !open)} aria-expanded={notificationsOpen} aria-label="Notificaciones">
          <div className="bell-wrapper">
            <Bell size={20} />
          </div>
        </button>
        {notificationsOpen && <div style={{ position: 'absolute', right: 24, top: 62, zIndex: 10, padding: '12px 16px', borderRadius: 12, background: '#fff', boxShadow: '0 10px 30px rgba(15,23,42,.15)', fontSize: 13 }}>No hay notificaciones nuevas.</div>}
        
        <div className="user-profile">
          <img 
            src="/optimized/login-carousel/slide7.webp" 
            alt="Admin Avatar" 
            className="user-avatar-img" 
          />
          <div className="user-info">
            <span className="user-name">Administrador</span>
            <span className="user-role">
              {user?.role === 'owner' ? 'Owner' : user?.role === 'manager' ? 'Manager' : 'Cajero'}
            </span>
          </div>
          <ChevronDown size={14} className="profile-chevron-icon" />
        </div>
      </div>
    </header>
  )
}
