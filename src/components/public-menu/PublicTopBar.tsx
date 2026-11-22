import { preloadCustomerLoyaltyProfile, preloadPublicMenuContactView } from './lazyViews'
import { type Dispatch, type SetStateAction } from 'react'
import { LOCAL_ORDER_TEST_MODE } from '../../lib/publicMenuConfig'
import { Clock } from 'lucide-react'
import { type DesktopTab } from '../../lib/publicMenuTypes'

interface PublicTopBarProps {
  bcvRate: number | null
  currentTab: DesktopTab
  formattedCloseTime: string
  isStoreOpen: boolean
  openCustomerProfile: () => void
  setCurrentTab: Dispatch<SetStateAction<DesktopTab>>
  showDesktopMenu: (category?: string, preserveSearch?: boolean) => void
  storeScheduleLabel: string
}

export function PublicTopBar({ bcvRate, currentTab, formattedCloseTime, isStoreOpen, openCustomerProfile, setCurrentTab, showDesktopMenu, storeScheduleLabel }: PublicTopBarProps) {
  return (
<header className="public-top-bar" id="inicio">
              <>
                {/* Mobile: empty left spacer */}
                <div className="mobile-only" style={{ width: 24 }} />
    
                {/* Logo — centered on mobile, left on desktop */}
                <div className="public-top-bar-center">
                  <img src="/optimized/root/logo.webp" alt="Full China" className="public-top-bar-logo" decoding="async" />
                </div>
    
                {/* Desktop Center Navigation Tabs */}
                <nav className="public-desktop-nav-links desktop-only" aria-label="Navegación principal">
                  <button 
                    type="button" 
                    className={`public-nav-tab-btn ${currentTab === 'inicio' ? 'active' : ''}`} 
                    onClick={() => { setCurrentTab('inicio'); window.scrollTo({ top: 0, behavior: 'smooth' }) }}>
                    Inicio
                  </button>
                  <button 
                    type="button" 
                    className={`public-nav-tab-btn ${currentTab === 'menu' ? 'active' : ''}`} 
                    onClick={() => showDesktopMenu()}>
                    Menú
                  </button>
                  <button 
                    type="button" 
                    className={`public-nav-tab-btn ${currentTab === 'contacto' ? 'active' : ''}`} 
                    onPointerDown={preloadPublicMenuContactView}
                    onMouseEnter={preloadPublicMenuContactView}
                    onFocus={preloadPublicMenuContactView}
                    onClick={() => { setCurrentTab('contacto'); window.scrollTo({ top: 0, behavior: 'smooth' }) }}>
                    Contacto
                  </button>
                  <button type="button" className={`public-nav-tab-btn ${currentTab === 'perfil' ? 'active' : ''}`} onPointerDown={preloadCustomerLoyaltyProfile} onMouseEnter={preloadCustomerLoyaltyProfile} onFocus={preloadCustomerLoyaltyProfile} onClick={openCustomerProfile}>
                    Mi perfil
                  </button>
                </nav>
    
                {/* Desktop Right Status Badges */}
                <div className="public-top-bar-right desktop-only">
                  <div className="public-nav-status-badges">
                    <div className={`public-nav-status-pill${isStoreOpen ? ' is-open' : ' is-closed'}`}>
                      <span className="public-nav-status-dot" />
                      <strong>{LOCAL_ORDER_TEST_MODE ? 'Modo de prueba' : isStoreOpen ? 'Abierto' : 'Cerrado'}</strong>
                      <span className="public-nav-status-hours"><Clock size={12} aria-hidden="true" />{LOCAL_ORDER_TEST_MODE ? 'No envía pedidos' : isStoreOpen ? `Hasta las ${formattedCloseTime}` : storeScheduleLabel}</span>
                    </div>
                    {bcvRate && (
                      <div className="public-nav-bcv-pill" title="Tasa oficial del Banco Central de Venezuela">
                        <span className="public-nav-bcv-label">Dólar BCV</span>
                        <span className="public-nav-bcv-val">Bs. {bcvRate.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                      </div>
                    )}
                  </div>
                </div>
    
              </>
          </header>
  )
}
