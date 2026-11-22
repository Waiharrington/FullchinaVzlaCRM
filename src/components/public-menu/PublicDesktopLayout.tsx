import { PublicCatalogLoadingSkeleton } from './PublicCatalogLoadingSkeleton'
import { CustomerLoyaltyProfile, PublicMenuContactView } from './lazyViews'
import { CATEGORY_ICONS, DESKTOP_CATEGORY_LABELS } from '../../lib/publicMenuConfig'
import { Suspense, type MouseEvent, type Dispatch, type SetStateAction, type RefObject, type ReactNode } from 'react'
import { HeroWokEmbers } from '../../components/HeroWokEmbers'
import { Flame, Search, X, ChevronRight, Bike, Zap, ShieldCheck, MapPin, Clock, ShoppingBag, Heart, Star, Trash2, Minus, Plus, Pencil, LoaderCircle, Store, MessageSquareText } from 'lucide-react'
import { optimizedProductImage, productImage, productTitle, money, cartLineKey, cartProductName } from '../../lib/publicMenuFormat'
import { categoryLabel } from '../../lib/menuCategories'
import { PublicHomeProductSkeletons, PublicHomePromoSkeletons, PublicContactSkeleton, PublicProfileSkeleton } from '../../components/PublicPageSkeletons'
import { type WebOrderCartItem, type CustomerRepeatOrder } from '../../lib/publicOrders'
import { type MenuProductGroup } from '../../lib/menuGrouping'
import { type PublicOrderPageSettings, type PublicOrderReel } from '../../lib/publicOrderPageSettings'
import { type DesktopTab, type CheckoutStep } from '../../lib/publicMenuTypes'
import { type PublicModifierSelection } from '../../lib/publicOrderRules'
import { type Product } from '../../lib/dataService'

interface PublicDesktopLayoutProps {
  activeCategory: string
  address: string
  canScrollPopular: boolean
  cart: WebOrderCartItem[]
  cartPulse: boolean
  categories: string[]
  categorySections: { category: string; groups: MenuProductGroup[]; }[]
  contactViewProps: { pageSettings: PublicOrderPageSettings; formattedOpenTime: string; formattedCloseTime: string; publicWhatsappPhone: string; publicInstagramUrl: string; publicFacebookUrl: string; mapPreviewUrl: string; currentInstagramReels: PublicOrderReel[]; instagramReels: { reel: PublicOrderReel; position: number; }[]; instagramActiveIndex: number; instagramAudioEnabled: boolean; instagramPlaybackStarted: boolean; instagramDesktopPlaybackConfirmed: boolean; instagramPaused: boolean; toggleInstagramAudio: (event: MouseEvent<HTMLButtonElement>) => void; toggleInstagramPlayback: (event: MouseEvent<HTMLElement>) => void; startInstagramReelWithSound: (event: MouseEvent<HTMLButtonElement>) => void; handleInstagramProfileClick: (event: MouseEvent<HTMLAnchorElement>) => void; setInstagramPaused: Dispatch<SetStateAction<boolean>>; setInstagramActiveIndex: Dispatch<SetStateAction<number>>; setInstagramDesktopPlaybackConfirmed: Dispatch<SetStateAction<boolean>>; openCustomerProfile: () => void; }
  currentTab: DesktopTab
  deletingKeys: string[]
  deliveryFeeText: string
  desktopHeroSlide: number
  editCartItem: (item: WebOrderCartItem) => void
  error: string
  favoriteIds: string[]
  getCartIncludedCopy: (item: WebOrderCartItem) => string | null
  handleRemoveSidebarItem: (itemKey: string, qty: number) => void
  homeSearchSuggestions: MenuProductGroup[]
  homeSearchTerm: string
  isDesktopViewport: boolean
  itemCount: number
  loading: boolean
  openCartFromSidebar: (nextStep: CheckoutStep) => void
  openCustomerProfile: () => void
  openGroup: (group: MenuProductGroup, originEvent?: { clientX: number; clientY: number; } | undefined, initialVariantId?: string | undefined, initialModifiers?: PublicModifierSelection | undefined) => void
  orderTotal: number
  orderType: "delivery" | "takeaway"
  pageSettings: PublicOrderPageSettings
  pendingQuickAdds: Set<string>
  popularGroups: MenuProductGroup[]
  popularScrollRef: RefObject<HTMLDivElement | null>
  priceBs: (usd: number) => string | null
  products: Product[]
  promoGroups: MenuProductGroup[]
  recommendations: MenuProductGroup[]
  renderDesktopProductCard: (group: MenuProductGroup) => ReactNode
  renderDesktopPromoCard: (group: MenuProductGroup) => ReactNode
  renderProductCard: (group: MenuProductGroup, priority?: boolean) => ReactNode
  repeatPreviousOrder: (previousOrder: CustomerRepeatOrder) => Promise<void>
  requestQuickAdd: (group: MenuProductGroup, quantity?: number) => Promise<void>
  retryPublicCatalog: () => void
  scrollPopular: (direction: 1 | -1) => void
  search: string
  setActiveCategory: Dispatch<SetStateAction<string>>
  setCartOpen: Dispatch<SetStateAction<boolean>>
  setDesktopHeroPaused: Dispatch<SetStateAction<boolean>>
  setDesktopHeroSlide: Dispatch<SetStateAction<number>>
  setOrderType: Dispatch<SetStateAction<"delivery" | "takeaway">>
  setReturnToConfirmAfterEdit: Dispatch<SetStateAction<boolean>>
  setSearch: Dispatch<SetStateAction<string>>
  setShowAllExtras: Dispatch<SetStateAction<boolean>>
  setShowFavorites: Dispatch<SetStateAction<boolean>>
  setSidebarRecoIndex: Dispatch<SetStateAction<number>>
  setStep: Dispatch<SetStateAction<CheckoutStep>>
  showDesktopMenu: (category?: string, preserveSearch?: boolean) => void
  showFavorites: boolean
  sidebarCardRef: RefObject<HTMLDivElement | null>
  sidebarHasOverflow: boolean
  sidebarRecoIndex: number
  sidebarRecoTimer: RefObject<ReturnType<typeof setTimeout> | null>
  submitting: boolean
  toggleFavorite: (groupKey: string) => void
  total: number
  updateQuantity: (itemKey: string, delta: number, legacyNotes?: string | undefined) => void
  visibleGroups: MenuProductGroup[]
}

export function PublicDesktopLayout({ activeCategory, address, canScrollPopular, cart, cartPulse, categories, categorySections, contactViewProps, currentTab, deletingKeys, deliveryFeeText, desktopHeroSlide, editCartItem, error, favoriteIds, getCartIncludedCopy, handleRemoveSidebarItem, homeSearchSuggestions, homeSearchTerm, isDesktopViewport, itemCount, loading, openCartFromSidebar, openCustomerProfile, openGroup, orderTotal, orderType, pageSettings, pendingQuickAdds, popularGroups, popularScrollRef, priceBs, products, promoGroups, recommendations, renderDesktopProductCard, renderDesktopPromoCard, renderProductCard, repeatPreviousOrder, requestQuickAdd, retryPublicCatalog, scrollPopular, search, setActiveCategory, setCartOpen, setDesktopHeroPaused, setDesktopHeroSlide, setOrderType, setReturnToConfirmAfterEdit, setSearch, setShowAllExtras, setShowFavorites, setSidebarRecoIndex, setStep, showDesktopMenu, showFavorites, sidebarCardRef, sidebarHasOverflow, sidebarRecoIndex, sidebarRecoTimer, submitting, toggleFavorite, total, updateQuantity, visibleGroups }: PublicDesktopLayoutProps) {
  return (
<div className={`public-desktop-layout desktop-only ${currentTab === 'contacto' || currentTab === 'perfil' ? 'is-contact-view' : ''}`}>
            {/* LEFT COLUMN: Tab-based views */}
            <div className="public-desktop-main">
              
              {/* TAB 1: INICIO (La Vitrina de Alto Impacto) */}
              {currentTab === 'inicio' && (
                <>
                  {/* 1. Cinematic Hero Banner with 3D Depth */}
                  <section className={`public-cinematic-hero public-home-hero-carousel ${desktopHeroSlide === 1 ? 'is-loyalty-slide' : ''} ${homeSearchTerm.length >= 2 ? 'has-search-results' : ''}`} aria-roledescription="carrusel" aria-label="Promociones de Full China" onPointerEnter={() => setDesktopHeroPaused(true)} onPointerLeave={() => setDesktopHeroPaused(false)} onFocusCapture={() => setDesktopHeroPaused(true)} onBlurCapture={event => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDesktopHeroPaused(false) }}>
                    {/* Organic Wok Fire Embers Canvas (Confined to Banner) */}
                    <HeroWokEmbers />
    
                    <div className={`public-home-hero-slide public-home-hero-food ${desktopHeroSlide === 0 ? 'is-active' : ''}`} aria-hidden={desktopHeroSlide !== 0}>
                    <div className="public-hero-left">
                      <span className="public-hero-tag">
                        <Flame size={14} className="fire-icon-pulse" />
                        {pageSettings.desktopEyebrow}
                      </span>
                      <h1 className="public-hero-main-title">
                        {pageSettings.desktopTitlePrefix}<br /><span className="public-hero-gold">{pageSettings.desktopTitleAccent}</span>
                      </h1>
                      <p className="public-hero-desc">
                        {pageSettings.desktopDescription}
                      </p>
    
                      <div className="public-hero-search-row">
                        <div className="public-hero-search-shell">
                          <div className="public-hero-search-box">
                            <Search size={18} />
                            <input
                              placeholder={pageSettings.searchPlaceholder}
                              value={search}
                              onChange={event => setSearch(event.target.value)}
                              onKeyDown={event => {
                                if (event.key !== 'Enter' || !search.trim()) return
                                showDesktopMenu('Todos', true)
                              }}
                              role="combobox"
                              aria-autocomplete="list"
                              aria-expanded={homeSearchTerm.length >= 2}
                              aria-controls="public-home-search-results"
                            />
                            {search && <button type="button" className="public-hero-search-clear" onClick={() => setSearch('')} aria-label="Limpiar búsqueda"><X size={14} /></button>}
                          </div>
                          {homeSearchTerm.length >= 2 && (
                            <div className="public-hero-search-results" id="public-home-search-results" role="listbox">
                              {homeSearchSuggestions.length > 0 ? (
                                <>
                                  {homeSearchSuggestions.map(group => (
                                    <button
                                      type="button"
                                      className="public-hero-search-result"
                                      key={group.key}
                                      role="option"
                                      aria-selected="false"
                                      onClick={event => {
                                        openGroup(group, event)
                                      }}
                                    >
                                      <img src={optimizedProductImage(group.variants[0]?.product.imageUrl) || productImage(group.category)} alt={productTitle(group.name)} />
                                      <span>
                                        <strong>{productTitle(group.name)}</strong>
                                        <small>{categoryLabel(group.category)}</small>
                                      </span>
                                      <b>{money(group.minPrice)}</b>
                                      <ChevronRight size={15} aria-hidden="true" />
                                    </button>
                                  ))}
                                  <button
                                    type="button"
                                    className="public-hero-search-all"
                                    onClick={() => showDesktopMenu('Todos', true)}
                                  >
                                    Ver todos los resultados <ChevronRight size={14} aria-hidden="true" />
                                  </button>
                                </>
                              ) : (
                                <div className="public-hero-search-empty">
                                  <strong>No encontramos productos</strong>
                                  <span>Prueba con otro nombre.</span>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                        <button 
                          type="button" 
                          className="public-hero-cta-btn" 
                          onClick={() => showDesktopMenu()}
                        >
                          Ver menú completo <ChevronRight size={16} />
                        </button>
                      </div>
                    </div>
    
                    <div className="public-hero-right">
                      <span className="public-hero-glow-aura" aria-hidden="true" />
                      <img 
                        src={pageSettings.desktopBannerImage}
                        alt="Portada de Full China"
                        className="public-hero-dish-img" 
                        loading={isDesktopViewport ? 'eager' : 'lazy'}
                        fetchPriority={isDesktopViewport ? 'high' : 'low'}
                        decoding="async" 
                      />
                      <div className="public-hero-gradient-overlay" />
                    </div>
                    </div>
                    <div className={`public-home-hero-slide public-home-hero-loyalty ${desktopHeroSlide === 1 ? 'is-active' : ''}`} aria-hidden={desktopHeroSlide !== 1}>
                      <div className="public-home-loyalty-banner">
                        <div className="public-home-loyalty-copy">
                          <span className="public-home-loyalty-kicker"><i /> PROGRAMA DE FIDELIDAD</span>
                          <h2>Cada visita te acerca a <em>un premio</em></h2>
                          <p><span>Un sello por visita. Completa 10 visitas.</span><span>Gana tu premio Full China.</span></p>
                          <div className="public-home-loyalty-progress" aria-label="Tarjeta de ejemplo de diez sellos">
                            {Array.from({ length: 10 }, (_, index) => <span key={index} className={index < 6 ? 'is-earned' : ''}><img src="/icons/wok-mark.png" alt="" /></span>)}
                            <small>10 visitas · 1 premio</small>
                          </div>
                          <button type="button" className="public-home-loyalty-cta" onClick={openCustomerProfile}>Únete al programa <ChevronRight size={17} /></button>
                        </div>
                        <div className="public-home-loyalty-card-wrap" aria-hidden="true">
                          <div className="public-home-loyalty-card">
                            <div className="public-home-loyalty-card-top"><img src="/optimized/root/logo.webp" alt="" /><span>MEMBER<br />CARD</span></div>
                            <div className="public-home-loyalty-card-copy"><small>FULL CHINA · FIDELIDAD</small><strong>TU TARJETA<br /><em>DE VISITAS</em></strong></div>
                            <div className="public-home-loyalty-card-stamps">{Array.from({ length: 10 }, (_, index) => <i key={index} className={index < 6 ? 'is-earned' : ''}><img src="/icons/wok-mark.png" alt="" /></i>)}</div>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="public-home-hero-dots" role="group" aria-label="Elegir portada">
                      <button type="button" className={desktopHeroSlide === 0 ? 'is-active' : ''} aria-label="Ver portada de Full China" aria-current={desktopHeroSlide === 0 ? 'true' : undefined} onClick={() => setDesktopHeroSlide(0)} />
                      <button type="button" className={desktopHeroSlide === 1 ? 'is-active' : ''} aria-label="Ver programa de fidelidad" aria-current={desktopHeroSlide === 1 ? 'true' : undefined} onClick={() => setDesktopHeroSlide(1)} />
                    </div>
                  </section>
    
                  {/* 3. NUESTRAS CATEGORÍAS */}
                  <section className="public-home-section">
                    <div className="public-home-section-header">
                      <div className="public-home-section-title-wrap">
                        <h2 className="public-home-section-title">NUESTRAS CATEGORÍAS</h2>
                        <span className="public-home-section-accent-line" />
                      </div>
                      <button 
                        type="button" 
                        className="public-home-see-all-btn"
                        onClick={() => showDesktopMenu()}
                      >
                        <span>Ver todas</span>
                        <ChevronRight size={14} />
                      </button>
                    </div>
    
                    <div className="public-home-categories-grid">
                      {categories.filter(c => c !== 'Todos').map(category => (
                        <button
                          key={category}
                          type="button"
                          className={`public-home-category-card ${activeCategory === category ? 'active' : ''} ${category === 'promociones' ? 'promo-card' : ''}`}
                          onClick={() => showDesktopMenu(category)}
                        >
                          <div className="public-home-cat-dish-circle">
                            <img src={CATEGORY_ICONS[category] || CATEGORY_ICONS.Todos} alt={categoryLabel(category)} loading="lazy" decoding="async" />
                          </div>
                          <span className="public-home-cat-name">{DESKTOP_CATEGORY_LABELS[category] || categoryLabel(category)}</span>
                        </button>
                      ))}
                    </div>
                  </section>
    
                  {/* 3. LO MÁS PEDIDO 🔥 */}
                  <section className="public-home-section">
                    <div className="public-home-section-header">
                      <div className="public-home-section-title-wrap">
                        <h2 className="public-home-section-title"><Flame size={18} aria-hidden="true" /> DATE UN BANQUETE EN FULL CHINA</h2>
                        <p className="public-home-section-sub">Los favoritos de nuestros clientes.</p>
                      </div>
                    </div>
    
                    <div className="public-home-carousel">
                      {canScrollPopular && (
                        <button type="button" className="public-home-carousel-arrow prev" aria-label="Ver plato anterior" onClick={() => scrollPopular(-1)}>
                          <ChevronRight size={18} style={{ transform: 'rotate(180deg)' }} />
                        </button>
                      )}
                      <div className="public-home-products-grid" ref={popularScrollRef}>
                        {popularGroups.length === 0 && loading ? <PublicHomeProductSkeletons /> : popularGroups.map(group => renderDesktopProductCard(group))}
                      </div>
                      {canScrollPopular && (
                        <button type="button" className="public-home-carousel-arrow next" aria-label="Ver siguiente plato" onClick={() => scrollPopular(1)}>
                          <ChevronRight size={18} />
                        </button>
                      )}
                    </div>
                  </section>
    
    
    
                  {/* 5. ¿CÓMO QUIERES RECIBIR TU PEDIDO? */}
                  <section className="public-home-section">
                    <div className="public-home-section-header">
                      <div className="public-home-section-title-wrap">
                        <h2 className="public-home-section-title">¿CÓMO QUIERES RECIBIR TU PEDIDO?</h2>
                      </div>
                    </div>
    
                    <div className="public-home-delivery-grid">
                      {/* Card 1: Delivery */}
                      <div className="public-home-delivery-card delivery-mode">
                        <div className="public-home-delivery-content">
                          <h3><Bike size={20} aria-hidden="true" /> Delivery</h3>
                          <p>Te lo llevamos hasta tu puerta.</p>
                          <div className="public-home-delivery-badges">
                            <span className="del-badge"><Zap size={13} /> Rápido</span>
                            <span className="del-badge"><ShieldCheck size={13} /> Seguro</span>
                            <span className="del-badge"><MapPin size={13} /> Cobertura</span>
                          </div>
                        </div>
                      </div>
    
                      {/* Card 2: Retiro en Full China */}
                      <div className="public-home-delivery-card pickup-mode">
                        <div className="public-home-delivery-content">
                          <h3>Retiro en Full China</h3>
                          <p>Retíralo directo en el food truck.</p>
                          <div className="public-home-delivery-badges">
                            <span className="del-badge"><Clock size={13} /> Inmediato</span>
                            <span className="del-badge"><ShoppingBag size={13} /> Listo</span>
                            <span className="del-badge"><Zap size={13} /> Veloz</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </section>
    
                  {/* 7. NUESTRAS PROMOCIONES */}
                  <section className="public-home-section">
                    <div className="public-home-section-header">
                      <div className="public-home-section-title-wrap">
                        <h2 className="public-home-section-title">NUESTRAS PROMOCIONES</h2>
                        <p className="public-home-section-sub">Aprovecha y disfruta más por menos.</p>
                      </div>
                      <button
                        type="button"
                        className="public-home-see-all-btn"
                        onClick={() => showDesktopMenu('promociones')}
                      >
                        <span>Ver todas</span>
                        <ChevronRight size={14} />
                      </button>
                    </div>
    
                    <div className="public-home-promos-grid">
                      {promoGroups.length === 0 && loading ? <PublicHomePromoSkeletons /> : promoGroups.map(group => renderDesktopPromoCard(group))}
                    </div>
                  </section>
                </>
              )}
    
              {/* TAB 2: MENU (Catálogo Completo) */}
              {currentTab === 'menu' && (
                <>
                  <section className="public-menu-discovery" aria-labelledby="public-menu-discovery-title">
                    <div className="public-menu-discovery-heading">
                      <span><Flame size={20} aria-hidden="true" /></span>
                      <div>
                        <h1 id="public-menu-discovery-title">{search.trim() ? `Resultados para “${search.trim()}”` : '¿Qué se te antoja hoy?'}</h1>
                        <p>{search.trim() ? `${visibleGroups.length} ${visibleGroups.length === 1 ? 'plato encontrado' : 'platos encontrados'} en nuestro menú.` : 'Encuentra tu plato favorito y pídelo preparado al momento.'}</p>
                      </div>
                    </div>
                    <button className={`public-favorites-inline ${showFavorites ? 'active' : ''}`} onClick={() => setShowFavorites(value => !value)} aria-label="Filtrar favoritos"><Heart size={16} fill={showFavorites ? 'currentColor' : 'none'} /><span>Favoritos</span>{favoriteIds.length > 0 && <b>{favoriteIds.length}</b>}</button>
                    <label className="public-menu-search">
                      <Search size={18} aria-hidden="true" />
                      <input
                        type="search"
                        aria-label="Buscar en todo el menú"
                        value={search}
                        placeholder="Buscar arroz, promociones, bebidas…"
                        onChange={event => {
                          setActiveCategory('Todos')
                          setShowFavorites(false)
                          setSearch(event.target.value)
                        }}
                        onKeyDown={event => {
                          if (event.key !== 'Escape') return
                          setSearch('')
                          setActiveCategory('Todos')
                          setShowFavorites(false)
                          event.currentTarget.blur()
                        }}
                      />
                      {search && (
                        <button type="button" onClick={() => { setSearch(''); setActiveCategory('Todos'); setShowFavorites(false) }} aria-label="Limpiar búsqueda">
                          <X size={14} />
                        </button>
                      )}
                    </label>
                  </section>
    
                  {/* Categories Nav (Floating Circular Dish Selector in Desktop) */}
                  {categories.length > 4 && <div className="public-category-hint" aria-hidden="true">Desliza para ver más <ChevronRight size={13} /></div>}
                  <nav className="public-categories-scroll" id="menu-section">
                     <button
                       className={`public-cat-btn ${activeCategory === 'Todos' ? 'active' : ''}`} 
                       onClick={() => { setSearch(''); setActiveCategory('Todos'); setShowFavorites(false) }}>
                       <div className="public-cat-dish-circle">
                         <img src={CATEGORY_ICONS.Todos} alt="" width={44} height={44} decoding="async" />
                       </div>
                       <span className="public-cat-label-vector"><Star size={13} fill="currentColor" aria-hidden="true" />Todos</span>
                    </button>
                    {categories.filter(c => c !== 'Todos').map(category => (
                       <button 
                          key={category}
                          className={`public-cat-btn ${activeCategory === category ? 'active' : ''}`}
                          onClick={() => { setSearch(''); setActiveCategory(category); setShowFavorites(false) }}
                       >
                         <div className="public-cat-dish-circle">
                           <img src={CATEGORY_ICONS[category] || CATEGORY_ICONS.Todos} alt="" width={44} height={44} loading="lazy" decoding="async" />
                         </div>
                         <span>{DESKTOP_CATEGORY_LABELS[category] || categoryLabel(category)}</span>
                       </button>
                    ))}
                  </nav>
    
                  {/* Products Catalog Section */}
                  <section className="public-content">
                    {activeCategory !== 'Todos' && (
                      <div className="public-selected-category-heading">
                        <div><span /><h2>{categoryLabel(activeCategory)}</h2></div>
                        <b>{visibleGroups.length} {visibleGroups.length === 1 ? 'plato' : 'platos'}</b>
                      </div>
                    )}
    
                    {error && products.length === 0 ? <div className="public-state error" role="alert"><p>{error}</p><button type="button" className="public-catalog-retry" onClick={retryPublicCatalog}>Reintentar</button></div> : (
                      <div className={`public-product-list ${activeCategory === 'Todos' ? 'public-product-list-grouped' : ''}`}>
                        {loading && products.length === 0 ? <PublicCatalogLoadingSkeleton /> : visibleGroups.length === 0 ? (
                          <div className="public-empty-menu">
                            <span className="public-empty-menu-wok" aria-hidden="true">
                              <svg viewBox="0 0 72 72" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M14 31H51C50.2 43.4 43.1 51 32.5 51C21.9 51 14.8 43.4 14 31Z" className="public-wok-bowl" />
                                <path d="M50 34L65 27" className="public-wok-handle" />
                                <path d="M24 23C20.5 18.7 27.5 16.2 24.5 11" className="public-wok-steam" />
                                <path d="M33 22C29.8 17.5 36.8 15.1 33.6 9" className="public-wok-steam public-wok-steam-delay" />
                                <path d="M42 23C38.9 19 45.4 16.8 42.8 12" className="public-wok-steam public-wok-steam-late" />
                                <path d="M25 55H41" className="public-wok-base" />
                              </svg>
                            </span>
                            <h3>{showFavorites ? 'Todavía no tienes favoritos' : 'No encontramos ese plato'}</h3>
                            <p>{showFavorites ? 'Toca el corazón de un plato para guardarlo en este dispositivo.' : 'Prueba con otro nombre o vuelve a ver todo el menú.'}</p>
                            <button type="button" onClick={() => { setSearch(''); setActiveCategory('Todos'); setShowFavorites(false) }}>Ver todo el menú</button>
                          </div>
                        ) : activeCategory === 'Todos' ? categorySections.map((section, sectionIndex) => (
                          <section className="public-category-section" key={section.category} data-category={section.category}>
                            <div className="public-category-section-header">
                              <div className="public-category-title-group">
                                <span className="public-cat-section-bar" />
                                <h3>{categoryLabel(section.category)}</h3>
                              </div>
                              <span className="public-category-count-badge">{section.groups.length} {section.groups.length === 1 ? 'plato' : 'platos'}</span>
                            </div>
                            <div className="public-category-grid">{section.groups.map((group, groupIndex) => renderProductCard(group, sectionIndex === 0 && groupIndex < (isDesktopViewport ? 4 : 2)))}</div>
                          </section>
                        )) : (
                          <div className="public-category-grid">
                            {visibleGroups.map((group, groupIndex) => renderProductCard(group, groupIndex < (isDesktopViewport ? 4 : 2)))}
                          </div>
                        )}
                      </div>
                    )}
                  </section>
                </>
              )}
    
              {/* TAB 3: CONTACTO */}
              {currentTab === 'contacto' && (
                <Suspense fallback={<PublicContactSkeleton />}>
                  <PublicMenuContactView variant="desktop" {...contactViewProps} />
                </Suspense>
              )}
              {currentTab === 'perfil' && <Suspense fallback={<PublicProfileSkeleton />}><CustomerLoyaltyProfile onRepeatOrder={repeatPreviousOrder} favoriteIds={favoriteIds} onToggleFavorite={toggleFavorite} /></Suspense>}
    
            </div>
    
            {/* Desktop Sticky Sidebar (Live Cart & Checkout) */}
            <aside className="public-desktop-sidebar">
              <div ref={sidebarCardRef} className={`public-sidebar-card ${cartPulse ? 'is-pulsing' : ''} ${sidebarHasOverflow ? 'has-overflow' : ''}`}>
                {/* Sidebar Header */}
                <div className="public-sidebar-head">
                  <div className="public-sidebar-title">
                    <ShoppingBag size={18} />
                    <span>Tu pedido</span>
                  </div>
                  {cart.length > 0 && (
                    <span key={itemCount} className="public-sidebar-count">
                      {itemCount} {itemCount === 1 ? 'ítem' : 'ítems'}
                    </span>
                  )}
                </div>
    
                {cart.length === 0 ? (
                  <div className="public-sidebar-empty">
                    <div className="public-empty-box-art">
                      <img 
                        src="/optimized/fondos/carrito-vacio.webp"
                        alt="Tu pedido está vacío" 
                        className="public-empty-cart-img"
                      />
                    </div>
                    <h3 className="public-empty-cart-title">Tu pedido está vacío</h3>
                    <p className="public-empty-cart-msg">
                      Parece que aún no has agregado<br />nada a tu pedido.
                    </p>
                    <p className="public-empty-cart-sub">
                      ¡Explora nuestro menú y encuentra<br />tu próximo favorito!
                    </p>
                    <button 
                      type="button" 
                      className="public-empty-explore-btn"
                      onClick={() => {
                        showDesktopMenu()
                      }}
                    >
                      <ShoppingBag size={18} />
                      <span>Explorar menú</span>
                    </button>
                  </div>
                ) : (
                  <>
                    {/* Sidebar Cart Items */}
                    <div className="public-sidebar-items">
                      {cart.map(item => {
                        const lineKey = cartLineKey(item)
                        const isDeleting = deletingKeys.includes(lineKey)
                        return (
                          <div className={`public-sidebar-item ${isDeleting ? 'is-deleting' : ''}`} key={lineKey}>
                            <img 
                              src={optimizedProductImage(item.imageUrl) || productImage()}
                              alt="" 
                              className="public-sidebar-item-img" 
                            />
                            <div className="public-sidebar-item-info">
                              <strong>{cartProductName(item.productName)}</strong>
                              {getCartIncludedCopy(item) && <small className="public-cart-item-notes">{getCartIncludedCopy(item)}</small>}
                              <span className="public-sidebar-item-price">{money(item.price * item.quantity)}</span>
                              <div className="public-sidebar-item-actions">
                                <div className="public-sidebar-stepper">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      if (item.quantity === 1) {
                                        handleRemoveSidebarItem(lineKey, 1)
                                      } else {
                                        updateQuantity(lineKey, -1)
                                      }
                                    }}
                                    aria-label="Disminuir"
                                  >
                                    {item.quantity === 1 ? <Trash2 size={12} /> : <Minus size={12} />}
                                  </button>
                                  <span key={item.quantity} className="public-stepper-num">{item.quantity}</span>
                                  <button type="button" onClick={() => updateQuantity(lineKey, 1)} aria-label="Aumentar">
                                    <Plus size={12} />
                                  </button>
                                </div>
                                <button type="button" className="public-sidebar-edit" onClick={() => editCartItem(item)} aria-label={`Editar ${cartProductName(item.productName)}`}>
                                  <Pencil size={12} /> <span>Editar</span>
                                </button>
                              </div>
                            </div>
                            <button 
                              type="button" 
                              className="public-sidebar-trash" 
                              onClick={() => handleRemoveSidebarItem(lineKey, item.quantity)}
                              aria-label="Eliminar producto"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        )
                      })}
                    </div>
    
                    <div className="public-sidebar-secondary">
                    {/* Sidebar Recommendations (carrusel: una tarjeta a la vez,
                        rota sola — el espacio es angosto para varias en fila) */}
                    {recommendations.length > 0 && (() => {
                      const activeReco = recommendations[sidebarRecoIndex] ?? recommendations[0]
                      return (
                        <section className="public-cart-recommendations public-sidebar-recommendations public-sidebar-reco-carousel">
                          <div className="public-cart-recommendations-head">
                            <h3><Flame size={18} color="#FF5A52" className="fire-icon-pulse" /> ¿Algo más?</h3>
                            <button type="button" onClick={() => { setReturnToConfirmAfterEdit(false); setStep('cart'); setCartOpen(true); setShowAllExtras(true) }}>Ver todos <ChevronRight size={13} /></button>
                          </div>
                          <div className="public-sidebar-reco-card" key={activeReco.key}>
                            <img src={optimizedProductImage(activeReco.variants[0]?.product.imageUrl) || productImage(activeReco.category)} alt={productTitle(activeReco.name)} />
                            <div>
                              <strong>{productTitle(activeReco.name)}</strong>
                              <b>{money(activeReco.minPrice)}{priceBs(activeReco.minPrice) && <small className="public-reco-bs">{priceBs(activeReco.minPrice)}</small>}</b>
                            </div>
                            <button type="button" disabled={pendingQuickAdds.has(activeReco.key)} aria-busy={pendingQuickAdds.has(activeReco.key)} onClick={() => requestQuickAdd(activeReco)}>{pendingQuickAdds.has(activeReco.key) ? <LoaderCircle className="public-add-spinner" size={15} /> : <Plus size={15} />}</button>
                          </div>
                          {recommendations.length > 1 && (
                            <div className="public-sidebar-reco-dots">
                              {recommendations.map((_, i) => (
                                <span
                                  key={i}
                                  className={i === sidebarRecoIndex ? 'active' : ''}
                                  onClick={() => {
                                    if (sidebarRecoTimer.current) clearInterval(sidebarRecoTimer.current)
                                    setSidebarRecoIndex(i)
                                  }}
                                />
                              ))}
                            </div>
                          )}
                        </section>
                      )
                    })()}
    
                    {/* Sidebar Financials */}
                    <div className="public-sidebar-summary">
                      <div className="public-sidebar-row">
                        <span>Subtotal</span>
                        <strong key={total}>{money(total)}</strong>
                      </div>
                      <div className="public-sidebar-row">
                        <span>Delivery</span>
                        <small>{deliveryFeeText}</small>
                      </div>
                      <div className="public-sidebar-row total">
                        <span>Total</span>
                        <div className="public-sidebar-total-val">
                          <em key={orderTotal}>{money(orderTotal)}</em>
                          {priceBs(orderTotal) && <small className="public-sidebar-total-bs">{priceBs(orderTotal)}</small>}
                        </div>
                      </div>
                    </div>
    
                    {/* Delivery / Retiro Switch (Modern Vector Segmented Control) */}
                    <div className="public-sidebar-type-toggle">
                      <button 
                        type="button" 
                        className={`public-sidebar-type-btn ${orderType === 'delivery' ? 'active' : ''}`}
                        onClick={() => setOrderType('delivery')}
                      >
                        <Bike size={16} />
                        <span>Delivery</span>
                      </button>
                      <button 
                        type="button" 
                        className={`public-sidebar-type-btn ${orderType === 'takeaway' ? 'active' : ''}`}
                        onClick={() => setOrderType('takeaway')}
                      >
                        <Store size={16} />
                        <span>Retiro en local</span>
                      </button>
                    </div>
    
                    {/* Address Input Box */}
                    {orderType === 'delivery' && (
                      <div className="public-sidebar-address-box" onClick={() => openCartFromSidebar('address')}>
                        <MapPin size={16} />
                        <input 
                          readOnly 
                          placeholder="Ingresa tu dirección de entrega" 
                          value={address || ''} 
                        />
                        <span className="public-sidebar-address-edit">Editar</span>
                      </div>
                    )}
                    </div>
    
                    {/* Big Checkout CTA Button */}
                    <button 
                      type="button" 
                      className="public-sidebar-checkout-btn"
                      disabled={!cart.length || submitting}
                      onClick={() => {
                        if (!cart.length) return;
                        // Desde el resumen siempre se inicia el flujo de entrega;
                        // todavía faltan tipo de entrega, dirección y datos.
                        openCartFromSidebar('delivery');
                      }}
                    >
                      <div className="public-sidebar-checkout-main">
                        <span>Continuar con el pedido</span>
                        <MessageSquareText size={18} />
                      </div>
                      <small>Configura la entrega y tus datos</small>
                    </button>
                  </>
                )}
              </div>
            </aside>
          </div>
  )
}
