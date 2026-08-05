import { Bell, Search, Menu, ChevronDown } from 'lucide-react'
import { useAuth } from '../context/auth-context'
import './TopBar.css'

export function TopBar({ onMenuClick }: { onMenuClick?: () => void }) {
  const { user } = useAuth()

  return (
    <header className="topbar">
      <div className="topbar-left">
        <button className="menu-btn mobile-only" onClick={onMenuClick}>
          <Menu size={24} />
        </button>
        <div className="search-bar">
          <input type="text" placeholder="Buscar en el sistema..." />
          <Search size={18} className="search-icon" />
        </div>
      </div>

      <div className="topbar-right">
        <button className="icon-btn notification-btn">
          <div className="bell-wrapper">
            <Bell size={20} />
            <span className="badge">5</span>
          </div>
        </button>
        
        <div className="user-profile">
          <img 
            src="/login-carousel/slide7.jpg" 
            alt="Admin Avatar" 
            className="user-avatar-img" 
          />
          <div className="user-info">
            <span className="user-name">Administrador</span>
            <span className="user-role">
              {user?.role === 'owner' ? 'Owner' : user?.role === 'manager' ? 'Manager' : 'Admin'}
            </span>
          </div>
          <ChevronDown size={14} className="profile-chevron-icon" />
        </div>
      </div>
    </header>
  )
}
