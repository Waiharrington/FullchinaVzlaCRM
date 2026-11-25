import { PublicCatalogLoadingSkeleton } from './PublicCatalogLoadingSkeleton'
import { CustomerLoyaltyProfile, PublicMenuContactView } from './lazyViews'
import { CATEGORY_ICONS, DESKTOP_CATEGORY_LABELS } from '../../lib/publicMenuConfig'
import { Suspense, useRef, type MouseEvent, type Dispatch, type SetStateAction, type RefObject, type ReactNode } from 'react'
import { LoyaltyCard } from '../../pedir-v2/LoyaltyCard'
import { usePauseOffscreen } from '../../pedir-v2/hooks'
import { Chopsticks, Fit, Odo, Thumb, Wok } from '../../pedir-v2/ui'
import { Flame, Search, X, ChevronRight, Bike, Zap, ShieldCheck, MapPin, Clock, ShoppingBag, Heart, Store, MessageSquareText } from 'lucide-react'
import { productTitle, money, cartLineKey, cartProductName } from '../../lib/publicMenuFormat'
import { categoryLabel } from '../../lib/menuCategories'
import { PublicHomeProductSkeletons, PublicHomePromoSkeletons, PublicContactSkeleton, PublicProfileSkeleton } from '../../components/PublicPageSkeletons'
import { type WebOrderCartItem, type CustomerRepeatOrder } from '../../lib/publicOrders'
import { type MenuProductGroup } from '../../lib/menuGrouping'
import { type PublicOrderPageSettings, type PublicOrderReel } from '../../lib/publicOrderPageSettings'
import { type DesktopTab, type CheckoutStep } from '../../lib/publicMenuTypes'
import { type PublicModifierSelection } from '../../lib/publicOrderRules'
import { type Product } from '../../lib/dataService'

interface PublicDesktopLayoutProps {
  isWideLayout: boolean
  scrollCategory: string | null
  activeCategory: string
  canScrollPopular: boolean
  cart: WebOrderCartItem[]
  cartPulse: boolean
  categories: string[]
  categorySections: { category: string; groups: MenuProductGroup[]; }[]
  contactViewProps: { pageSettings: PublicOrderPageSettings; formattedOpenTime: string; formattedCloseTime: string; publicWhatsappPhone: string; publicInstagramUrl: string; publicFacebookUrl: string; mapPreviewUrl: string; currentInstagramReels: PublicOrderReel[]; instagramReels: { reel: PublicOrderReel; position: number; }[]; instagramActiveIndex: number; instagramAudioEnabled: boolean; instagramPlaybackStarted: boolean; instagramDesktopPlaybackConfirmed: boolean; instagramPaused: boolean; toggleInstagramAudio: (event: MouseEvent<HTMLButtonElement>) => void; toggleInstagramPlayback: (event: MouseEvent<HTMLElement>) => void; startInstagramReelWithSound: (event: MouseEvent<HTMLButtonElement>) => void; handleInstagramProfileClick: (event: MouseEvent<HTMLAnchorElement>) => void; setInstagramPaused: Dispatch<SetStateAction<boolean>>; setInstagramActiveIndex: Dispatch<SetStateAction<number>>; setInstagramDesktopPlaybackConfirmed: Dispatch<SetStateAction<boolean>>; openCustomerProfile: () => void; }
  currentTab: DesktopTab
  deliveryFeeText: string
  desktopHeroSlide: number
  error: string
  favoriteIds: string[]
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
  popularGroups: MenuProductGroup[]
  popularScrollRef: RefObject<HTMLDivElement | null>
  priceBs: (usd: number) => string | null
  products: Product[]
  promoGroups: MenuProductGroup[]
  renderDesktopProductCard: (group: MenuProductGroup) => ReactNode
  renderDesktopPromoCard: (group: MenuProductGroup) => ReactNode
  renderProductCard: (group: MenuProductGroup, priority?: boolean) => ReactNode
  repeatPreviousOrder: (previousOrder: CustomerRepeatOrder) => Promise<void>
  retryPublicCatalog: () => void
  scrollPopular: (direction: 1 | -1) => void
  search: string
  setActiveCategory: Dispatch<SetStateAction<string>>
  setDesktopHeroPaused: Dispatch<SetStateAction<boolean>>
  setDesktopHeroSlide: Dispatch<SetStateAction<number>>
  setOrderType: Dispatch<SetStateAction<"delivery" | "takeaway">>
  setSearch: Dispatch<SetStateAction<string>>
  setShowFavorites: Dispatch<SetStateAction<boolean>>
  showDesktopMenu: (category?: string, preserveSearch?: boolean) => void
  showFavorites: boolean
  sidebarCardRef: RefObject<HTMLDivElement | null>
  sidebarHasOverflow: boolean
  submitting: boolean
  toggleFavorite: (groupKey: string) => void
  total: number
  visibleGroups: MenuProductGroup[]
}

const SIDEBAR_VISIBLE_ITEMS = 3

export function PublicDesktopLayout({ isWideLayout, scrollCategory, activeCategory, canScrollPopular, cart, cartPulse, categories, categorySections, contactViewProps, currentTab, deliveryFeeText, desktopHeroSlide, error, favoriteIds, homeSearchSuggestions, homeSearchTerm, isDesktopViewport, itemCount, loading, openCartFromSidebar, openCustomerProfile, openGroup, orderTotal, orderType, pageSettings, popularGroups, popularScrollRef, priceBs, products, promoGroups, renderDesktopProductCard, renderDesktopPromoCard, renderProductCard, repeatPreviousOrder, retryPublicCatalog, scrollPopular, search, setActiveCategory, setDesktopHeroPaused, setDesktopHeroSlide, setOrderType, setSearch, setShowFavorites, showDesktopMenu, showFavorites, sidebarCardRef, sidebarHasOverflow, submitting, toggleFavorite, total, visibleGroups }: PublicDesktopLayoutProps) {
  const railRef = useRef<HTMLElement>(null)
  const layoutRef = useRef<HTMLDivElement>(null)
  usePauseOffscreen(layoutRef)
  // Solo visual: qué categoría sostienen los palillos mientras se recorre el menú.
  const heldCategory = activeCategory === 'Todos' ? scrollCategory : activeCategory
  const catClass = (category: string) => `public-cat-btn ${activeCategory === category ? 'active' : ''} ${heldCategory === category || (!heldCategory && category === 'Todos') ? 'is-held' : ''}`
  return (
<div ref={layoutRef} className={`public-desktop-layout desktop-only ${currentTab === 'contacto' || currentTab === 'perfil' ? 'is-contact-view' : ''}`}>
            {/* LEFT COLUMN: Tab-based views */}
            <div className="public-desktop-main">

              {/* TAB 1: INICIO (La Vitrina de Alto Impacto) */}
              {currentTab === 'inicio' && (
                <>
                  {/* 1. Cinematic Hero Banner with 3D Depth */}
                  <section className={`public-cinematic-hero public-home-hero-carousel ${desktopHeroSlide === 1 ? 'is-loyalty-slide' : ''} ${homeSearchTerm.length >= 2 ? 'has-search-results' : ''}`} aria-roledescription="carrusel" aria-label="Promociones de Full China" onPointerEnter={() => setDesktopHeroPaused(true)} onPointerLeave={() => setDesktopHeroPaused(false)} onFocusCapture={() => setDesktopHeroPaused(true)} onBlurCapture={event => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDesktopHeroPaused(false) }}>
                    <div className={`public-home-hero-slide public-home-hero-food ${desktopHeroSlide === 0 ? 'is-active' : ''}`} aria-hidden={desktopHeroSlide !== 0}>
                    <div className="public-hero-left">
                      <span className="public-hero-tag">
                        <Flame size={14} />
                        {pageSettings.desktopEyebrow}
                      </span>
                      <h1 className="public-hero-main-title">
                        <Fit>{pageSettings.desktopTitlePrefix} <span className="public-hero-gold">{pageSettings.desktopTitleAccent}</span></Fit>
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
                                      <Thumb imageUrl={group.variants[0]?.product.imageUrl} alt={productTitle(group.name)} />
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
                          <h2><Fit>Cada visita <em>te premia</em></Fit></h2>
                          <p><span>Un sello por visita. Completa 10 visitas.</span><span>Gana tu premio Full China.</span></p>
                          <div className="public-home-loyalty-progress" aria-label="Tarjeta de ejemplo de diez sellos">
                            {Array.from({ length: 10 }, (_, index) => <span key={index} className={index < 6 ? 'is-earned' : ''}><img src="/icons/wok-mark.png" alt="" /></span>)}
                            <small>10 visitas · 1 premio</small>
                          </div>
                          <button type="button" className="public-home-loyalty-cta" onClick={openCustomerProfile}>Únete al programa <ChevronRight size={17} /></button>
                        </div>
                        <div className="public-home-loyalty-card-wrap">
                          <LoyaltyCard interactive />
                        </div>
                      </div>
                    </div>
                    <div className="public-home-hero-dots" role="group" aria-label="Elegir portada">
                      <button type="button" className={desktopHeroSlide === 0 ? 'is-active' : ''} aria-label="Ver portada de Full China" aria-current={desktopHeroSlide === 0 ? 'true' : undefined} onClick={() => setDesktopHeroSlide(0)} />
                      <button type="button" className={desktopHeroSlide === 1 ? 'is-active' : ''} aria-label="Ver programa de fidelidad" aria-current={desktopHeroSlide === 1 ? 'true' : undefined} onClick={() => setDesktopHeroSlide(1)} />
                    </div>
                  </section>

                  <div className="pd-marquee" aria-hidden="true"><div>{[0, 1].map(copy => <span key={copy}>{categories.filter(c => c !== 'Todos').map(category => <b key={category}>{categoryLabel(category)}<Wok lit={false} /></b>)}</span>)}</div></div>

                  {/* 3. NUESTRAS CATEGORÍAS */}
                  <section className="public-home-section">
                    <div className="public-home-section-header">
                      <div className="public-home-section-title-wrap">
                        <h2 className="public-home-section-title">NUESTRAS CATEGORÍAS</h2>
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
                          <h3>Retiro en local</h3>
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
                        <h1 id="public-menu-discovery-title"><Fit>{search.trim() ? `Resultados para “${search.trim()}”` : '¿Qué se te antoja hoy?'}</Fit></h1>
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
                  <div className="pd-rail-wrap">
                  <nav className="public-categories-scroll" id="menu-section" ref={railRef} aria-label="Categorías del menú">
                     <Chopsticks railRef={railRef} active={heldCategory ?? 'Todos'} />
                    {categories.filter(c => c !== 'Todos').map(category => (
                       <button
                          key={category}
                          className={catClass(category)}
                          onClick={() => { setSearch(''); setActiveCategory(category); setShowFavorites(false) }}
                       >
                         <div className="public-cat-dish-circle">
                           <img src={CATEGORY_ICONS[category] || CATEGORY_ICONS.Todos} alt="" width={44} height={44} loading="lazy" decoding="async" />
                         </div>
                         <span>{DESKTOP_CATEGORY_LABELS[category] || categoryLabel(category)}</span>
                       </button>
                    ))}
                     <button
                       className={catClass('Todos')}
                       onClick={() => { setSearch(''); setActiveCategory('Todos'); setShowFavorites(false) }}>
                       <div className="public-cat-dish-circle">
                         <img src={CATEGORY_ICONS.Todos} alt="" width={44} height={44} decoding="async" />
                       </div>
                       <span>Todos</span>
                    </button>
                  </nav>
                  </div>

                  {/* Products Catalog Section */}
                  <section className="public-content">
                    {activeCategory !== 'Todos' && !search.trim() && (
                      <div className="public-selected-category-heading">
                        <div><span /><h2>{categoryLabel(activeCategory)}</h2></div>
                        <b>{visibleGroups.length} {visibleGroups.length === 1 ? 'plato' : 'platos'}</b>
                      </div>
                    )}

                    {error && products.length === 0 ? <div className="public-state error" role="alert"><p>{error}</p><button type="button" className="public-catalog-retry" onClick={retryPublicCatalog}>Reintentar</button></div> : (
                      <div data-category={activeCategory} className={`public-product-list ${activeCategory === 'Todos' && !search.trim() ? 'public-product-list-grouped' : ''}`}>
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
                        ) : activeCategory === 'Todos' && !search.trim() ? categorySections.map((section, sectionIndex) => (
                          <section className="public-category-section" key={section.category} data-category={section.category}>
                            <div className="public-category-section-header">
                              <div className="public-category-title-group">
                                <span className="public-cat-section-bar" />
                                <h3>{categoryLabel(section.category)}</h3>
                              </div>
                              <button type="button" className="pd-see-all" onClick={() => showDesktopMenu(section.category)}>Ver {section.groups.length === 1 ? 'el plato' : `las ${section.groups.length}`} <ChevronRight size={15} aria-hidden="true" /></button>
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
              {currentTab === 'perfil' && isWideLayout && <Suspense fallback={<PublicProfileSkeleton />}><CustomerLoyaltyProfile onRepeatOrder={repeatPreviousOrder} favoriteIds={favoriteIds} onToggleFavorite={toggleFavorite} /></Suspense>}

            </div>

            {/* Desktop Sticky Sidebar (Live Cart & Checkout) */}
            <aside className="public-desktop-sidebar">
              <div ref={sidebarCardRef} className={`public-sidebar-card ${cartPulse ? 'is-pulsing' : ''} ${sidebarHasOverflow ? 'has-overflow' : ''}`}>
                {/* Sidebar Header */}
                <div className="public-sidebar-head">
                  <div className="public-sidebar-title">
                    <Wok lit={cart.length > 0} />
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
                      Parece que aún no has agregado nada a tu pedido.
                    </p>
                    <p className="public-empty-cart-sub">
                      ¡Explora nuestro menú y encuentra tu próximo favorito!
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
                    {/* Resumen: una línea por plato. Para editar se abre el pedido completo. */}
                    <ul className="pd-mini-list">
                      {cart.slice(0, SIDEBAR_VISIBLE_ITEMS).map(item => (
                        <li key={cartLineKey(item)}>
                          <Thumb imageUrl={item.imageUrl} />
                          <b>{item.quantity}×</b>
                          <span>{cartProductName(item.productName)}</span>
                          <strong>{money(item.price * item.quantity)}</strong>
                        </li>
                      ))}
                    </ul>
                    <button type="button" className="pd-mini-all" onClick={() => openCartFromSidebar('cart')}>
                      {cart.length > SIDEBAR_VISIBLE_ITEMS ? `Ver todo el pedido (+${cart.length - SIDEBAR_VISIBLE_ITEMS} más)` : 'Ver o editar pedido'} <ChevronRight size={15} />
                    </button>

                    <div className="public-sidebar-secondary">
                    {/* Sidebar Financials */}
                    <div className="public-sidebar-summary">
                      <div className="public-sidebar-row">
                        <span>Subtotal</span>
                        <strong><Odo value={money(total)} /></strong>
                      </div>
                      <div className="public-sidebar-row">
                        <span>Delivery</span>
                        <small>{deliveryFeeText}</small>
                      </div>
                      <div className="public-sidebar-row total">
                        <span>Total</span>
                        <div className="public-sidebar-total-val">
                          <em><Odo value={money(orderTotal)} /></em>
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
