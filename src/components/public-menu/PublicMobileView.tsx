import type { MenuVariant } from '../../lib/menuGrouping'
import { PublicCatalogLoadingSkeleton } from './PublicCatalogLoadingSkeleton'
import { CustomerLoyaltyProfile, PublicMenuContactView, preloadCustomerLoyaltyProfile, preloadPublicMenuContactView } from './lazyViews'
import { CATEGORY_ICONS } from '../../lib/publicMenuConfig'
import { Suspense, type MouseEvent, type WheelEvent, type Dispatch, type SetStateAction, type RefObject, type ReactNode } from 'react'
import { Flame, Clock, Search, X, ChevronRight, Heart, Utensils, Store, UserRound } from 'lucide-react'
import { LOCAL_ORDER_TEST_MODE } from '../../lib/publicMenuConfig'
import { CustomerLoyaltyPromo } from '../../components/CustomerLoyaltyPromo'
import { productTitle, money } from '../../lib/publicMenuFormat'
import { categoryLabel } from '../../lib/menuCategories'
import Toast from '../../components/Toast'
import { PublicContactSkeleton, PublicProfileSkeleton } from '../../components/PublicPageSkeletons'
import { type MenuProductGroup } from '../../lib/menuGrouping'
import { type PublicOrderPageSettings, type PublicOrderReel } from '../../lib/publicOrderPageSettings'
import { type DesktopTab } from '../../lib/publicMenuTypes'
import { type PublicModifierSelection } from '../../lib/publicOrderRules'
import { type Product } from '../../lib/dataService'
import { type CustomerRepeatOrder } from '../../lib/publicOrders'

interface PublicMobileViewProps {
  activeCategory: string
  bcvRate: number | null
  cartOpen: boolean
  categories: string[]
  categorySections: { category: string; groups: MenuProductGroup[]; }[]
  closeSearch: () => void
  contactViewProps: { pageSettings: PublicOrderPageSettings; formattedOpenTime: string; formattedCloseTime: string; publicWhatsappPhone: string; publicInstagramUrl: string; publicFacebookUrl: string; mapPreviewUrl: string; currentInstagramReels: PublicOrderReel[]; instagramReels: { reel: PublicOrderReel; position: number; }[]; instagramActiveIndex: number; instagramAudioEnabled: boolean; instagramPlaybackStarted: boolean; instagramDesktopPlaybackConfirmed: boolean; instagramPaused: boolean; toggleInstagramAudio: (event: MouseEvent<HTMLButtonElement>) => void; toggleInstagramPlayback: (event: MouseEvent<HTMLElement>) => void; startInstagramReelWithSound: (event: MouseEvent<HTMLButtonElement>) => void; handleInstagramProfileClick: (event: MouseEvent<HTMLAnchorElement>) => void; setInstagramPaused: Dispatch<SetStateAction<boolean>>; setInstagramActiveIndex: Dispatch<SetStateAction<number>>; setInstagramDesktopPlaybackConfirmed: Dispatch<SetStateAction<boolean>>; openCustomerProfile: () => void; }
  currentTab: DesktopTab
  error: string
  favoriteIds: string[]
  formattedCloseTime: string
  handleRecommendedWheel: (event: WheelEvent<HTMLDivElement>) => void
  hasLeftMobileMenu: boolean
  hasVisitedProfile: boolean
  heroSearchRef: RefObject<HTMLInputElement | null>
  isDesktopViewport: boolean
  isLoyaltyRecommended: boolean
  isStoreOpen: boolean
  loading: boolean
  moveRecommended: (direction: 1 | -1) => void
  openCustomerProfile: () => void
  openGroup: (group: MenuProductGroup, originEvent?: { clientX: number; clientY: number; } | undefined, initialVariantId?: string | undefined, initialModifiers?: PublicModifierSelection | undefined) => void
  pageSettings: PublicOrderPageSettings
  pauseRecommendedAutoplay: () => void
  priceBs: (usd: number) => string | null
  products: Product[]
  recommendedGroup: MenuProductGroup | null
  recommendedImageSrc: string
  recommendedIndex: number
  recommendedSlideCount: number
  recommendedSlides: ({ kind: "product"; group: MenuProductGroup; } | { kind: "loyalty"; })[]
  recommendedSwipeStart: RefObject<number | null>
  recommendedVariant: MenuVariant | null
  recommendedWasSwiped: RefObject<boolean>
  renderProductCard: (group: MenuProductGroup, priority?: boolean) => ReactNode
  repeatPreviousOrder: (previousOrder: CustomerRepeatOrder) => Promise<void>
  resumeRecommendedAutoplay: () => void
  retryPublicCatalog: () => void
  search: string
  setActiveCategory: Dispatch<SetStateAction<string>>
  setCurrentTab: Dispatch<SetStateAction<DesktopTab>>
  setError: Dispatch<SetStateAction<string>>
  setHasLeftMobileMenu: Dispatch<SetStateAction<boolean>>
  setRecommendedImageSrc: Dispatch<SetStateAction<string>>
  setRequestedRecommendedIndex: Dispatch<SetStateAction<number | null>>
  setSearch: Dispatch<SetStateAction<string>>
  setShowFavorites: Dispatch<SetStateAction<boolean>>
  setShowSearch: Dispatch<SetStateAction<boolean>>
  showFavorites: boolean
  showSearch: boolean
  storeScheduleLabel: string
  toggleFavorite: (groupKey: string) => void
  visibleGroups: MenuProductGroup[]
}

export function PublicMobileView({ activeCategory, bcvRate, cartOpen, categories, categorySections, closeSearch, contactViewProps, currentTab, error, favoriteIds, formattedCloseTime, handleRecommendedWheel, hasLeftMobileMenu, hasVisitedProfile, heroSearchRef, isDesktopViewport, isLoyaltyRecommended, isStoreOpen, loading, moveRecommended, openCustomerProfile, openGroup, pageSettings, pauseRecommendedAutoplay, priceBs, products, recommendedGroup, recommendedImageSrc, recommendedIndex, recommendedSlideCount, recommendedSlides, recommendedSwipeStart, recommendedVariant, recommendedWasSwiped, renderProductCard, repeatPreviousOrder, resumeRecommendedAutoplay, retryPublicCatalog, search, setActiveCategory, setCurrentTab, setError, setHasLeftMobileMenu, setRecommendedImageSrc, setRequestedRecommendedIndex, setSearch, setShowFavorites, setShowSearch, showFavorites, showSearch, storeScheduleLabel, toggleFavorite, visibleGroups }: PublicMobileViewProps) {
  return (
<div className="public-mobile-view mobile-only">
    
            {/* MENU VIEW */}
            <div className={`public-mobile-tab-content${hasLeftMobileMenu ? ' is-retained' : ''}`} key="menu" hidden={currentTab === 'contacto' || currentTab === 'perfil'}>
            {/* 2. Hero Status */}
            <div className="public-hero-header">
              <div className="public-hero-title-row">
                <h1>{pageSettings.mobileHeading} <Flame size={22} className="fire-icon-pulse" /></h1>
                {bcvRate && (
                  <span className="public-rate-badge" title="Tasa oficial del Banco Central de Venezuela">
                    <span className="public-rate-badge-label">Dólar BCV</span>
                    <span className="public-rate-badge-value">Bs. {bcvRate.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </span>
                )}
              </div>
              <span className={`public-status ${isStoreOpen ? 'is-open' : 'is-closed'}`}>
                <i /> <strong>{LOCAL_ORDER_TEST_MODE ? 'Modo de prueba' : isStoreOpen ? 'Abierto' : 'Cerrado'}</strong><span className="public-status-hours"><Clock size={13} aria-hidden="true" />{LOCAL_ORDER_TEST_MODE ? 'No envía pedidos' : isStoreOpen ? `Hasta las ${formattedCloseTime}` : storeScheduleLabel}</span>
              </span>
              <div className={`public-hero-search-pill ${showSearch ? 'is-active' : ''}`} onClick={() => { if (!showSearch) { heroSearchRef.current?.focus(); setShowSearch(true) } }}>
                <Search size={16} />
                <span className="public-hero-search-placeholder" aria-hidden={showSearch}>{pageSettings.searchPlaceholder}</span>
                <input
                  ref={heroSearchRef}
                  aria-label="Buscar en el menú"
                  tabIndex={showSearch ? 0 : -1}
                  placeholder={showSearch ? pageSettings.searchPlaceholder : ''}
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                />
                {showSearch && search && <button type="button" className="public-search-pill-clear" onClick={() => setSearch('')} aria-label="Limpiar búsqueda"><X size={14}/></button>}
                {showSearch && <button type="button" className="public-search-pill-cancel" onClick={closeSearch}>Cancelar</button>}
              </div>
            </div>
    
            {/* 3. Recommended Card */}
            <div
              className={`public-recommended-card${isLoyaltyRecommended ? ' is-loyalty-slide' : ''}`}
              onClick={(event) => {
                if (recommendedWasSwiped.current) {
                  recommendedWasSwiped.current = false
                  return
                }
                if ((event.target as HTMLElement).closest('button, .public-recommended-dots-overlay')) return
                if (!isLoyaltyRecommended && recommendedGroup) openGroup(recommendedGroup, undefined, recommendedVariant?.product.id)
              }}
              onPointerDown={(event) => {
                // Los botones (CTA e indicadores) conservan su interacción normal;
                // solo el gesto iniciado sobre la tarjeta cambia de recomendación.
                if ((event.target as HTMLElement).closest('button') || !event.isPrimary || event.button !== 0) return
                recommendedSwipeStart.current = event.clientX
                recommendedWasSwiped.current = false
                event.currentTarget.setPointerCapture(event.pointerId)
                pauseRecommendedAutoplay()
              }}
              onWheel={handleRecommendedWheel}
              onPointerUp={(event) => {
                const start = recommendedSwipeStart.current
                recommendedSwipeStart.current = null
                if (start == null || recommendedSlideCount <= 1) {
                  resumeRecommendedAutoplay()
                  return
                }
                const distance = event.clientX - start
                if (Math.abs(distance) >= 42) {
                  recommendedWasSwiped.current = true
                  moveRecommended(distance < 0 ? 1 : -1)
                } else {
                  resumeRecommendedAutoplay()
                }
              }}
              onPointerCancel={() => {
                recommendedSwipeStart.current = null
                resumeRecommendedAutoplay()
              }}
              onMouseEnter={pauseRecommendedAutoplay}
              onMouseLeave={resumeRecommendedAutoplay}
            >
              {isLoyaltyRecommended ? <CustomerLoyaltyPromo presentation="recommended" onJoin={openCustomerProfile} /> : <>
                <div className="public-recommended-copy" key={`copy-${recommendedGroup?.key ?? 'empty'}`}>
                  <small>RECOMENDADO <Flame size={12} /></small>
                  <h2>{productTitle(recommendedGroup?.name ?? 'Explora nuestro menú')}</h2>
                  <p>{recommendedVariant?.product.description || recommendedGroup?.variants[0]?.product.description || 'Elige tu favorito y arma tu pedido.'}</p>
                  {recommendedGroup && <span className="public-recommended-price">{money(recommendedVariant?.product.price ?? recommendedGroup.minPrice)}</span>}
                  {recommendedGroup && priceBs(recommendedVariant?.product.price ?? recommendedGroup.minPrice) && <span className="public-prod-price-bs">{priceBs(recommendedVariant?.product.price ?? recommendedGroup.minPrice)}</span>}
                  <button
                    className="public-recommended-btn"
                    onClick={(event) => { event.stopPropagation(); if (recommendedGroup) openGroup(recommendedGroup, undefined, recommendedVariant?.product.id) }}
                    aria-label={`Ver producto: ${productTitle(recommendedGroup?.name ?? 'producto')}`}
                  >Ver producto <ChevronRight size={14} strokeWidth={2.5} aria-hidden="true" /></button>
                </div>
                <img src={recommendedImageSrc} onError={event => {
                if (event.currentTarget.getAttribute('src') !== '/optimized/fondos/hero-banner-food.webp') {
                  setRecommendedImageSrc('/optimized/fondos/hero-banner-food.webp')
                }
                }} alt={productTitle(recommendedGroup?.name ?? 'Menú Full China')} className={`public-recommended-img${['Agua', 'Refresco 2 Litros'].includes(recommendedGroup?.name ?? '') ? ' public-recommended-img--bottle' : ''}`} fetchPriority="high" decoding="async" />
              </>}
              <div className="public-recommended-dots-overlay">
                {Array.from({ length: recommendedSlideCount }, (_, i) => (
                  <button key={i} type="button" className={i === recommendedIndex ? 'active' : ''} aria-label={recommendedSlides[i]?.kind === 'loyalty' ? 'Ver programa de fidelidad' : `Ver recomendación ${recommendedSlides.slice(0, i + 1).filter(slide => slide.kind === 'product').length}`} aria-current={i === recommendedIndex ? 'true' : undefined} onClick={(event) => {
                    event.stopPropagation()
                    if (i === recommendedIndex) {
                      setRequestedRecommendedIndex(null)
                      return
                    }
                    setRequestedRecommendedIndex(i)
                    pauseRecommendedAutoplay()
                    resumeRecommendedAutoplay()
                  }} />
                ))}
              </div>
            </div>
    
            {/* 4. Category Nav */}
            {categories.length > 4 && <div className="public-category-hint" aria-hidden="true">Desliza para ver más <ChevronRight size={13} /></div>}
            <nav className="public-categories-scroll">
              <button 
                 className={`public-cat-btn ${activeCategory === 'Todos' ? 'active' : ''}`} 
                 onClick={() => setActiveCategory('Todos')}>
                 <img className="public-cat-icon-image" src={CATEGORY_ICONS.Todos} alt="" decoding="async" />
                 <span>Menú</span>
              </button>
              {categories.filter(c => c !== 'Todos').map(category => (
                 <button 
                   key={category} 
                   className={`public-cat-btn ${activeCategory === category ? 'active' : ''}`}
                   onClick={() => setActiveCategory(category)}
                 >
                   <img className="public-cat-icon-image" src={CATEGORY_ICONS[category] || CATEGORY_ICONS.Todos} alt="" loading="lazy" decoding="async" />
                   <span>{categoryLabel(category)}</span>
                 </button>
              ))}
            </nav>
    
            {/* 5. Products Section */}
              <section className="public-content">
              <div className="public-list-header">
                <h2 className={activeCategory === 'Todos' ? 'public-main-list-title' : undefined}>{activeCategory === 'Todos' ? 'Menú' : categoryLabel(activeCategory)}</h2>
                <div className="public-list-actions">
                  <button className={`public-favorites-inline ${showFavorites ? 'active' : ''}`} onClick={() => setShowFavorites(value => !value)} aria-label="Filtrar favoritos"><Heart size={16} fill={showFavorites ? 'currentColor' : 'none'} /><span>Favoritos</span>{favoriteIds.length > 0 && <b>{favoriteIds.length}</b>}</button>
                </div>
              </div>
    
              {error && products.length > 0 && !cartOpen && <Toast type="error" message={error} onClose={() => setError('')} />}
              {error && products.length === 0 ? <div className="public-state error" role="alert"><p>{error}</p><button type="button" className="public-catalog-retry" onClick={retryPublicCatalog}>Reintentar</button></div> : (
                <div className={`public-product-list ${activeCategory === 'Todos' ? 'public-product-list-grouped' : ''}`}>
                  {loading && products.length === 0 ? <PublicCatalogLoadingSkeleton /> : visibleGroups.length === 0 ? (
                    <div className="public-empty-menu">
                      <span><Utensils size={42} /></span>
                      <h3>{showFavorites ? 'Todavía no tienes favoritos' : 'No encontramos ese plato'}</h3>
                      <p>{showFavorites ? 'Toca el corazón de un plato para guardarlo en este dispositivo.' : 'Prueba con otro nombre o vuelve a ver todo el menú.'}</p>
                      <button type="button" onClick={() => { setSearch(''); setActiveCategory('Todos'); setShowFavorites(false) }}>Ver todo el menú</button>
                    </div>
                  ) : activeCategory === 'Todos' ? categorySections.map((section, sectionIndex) => (
                    <section className="public-category-section" key={section.category} data-category={section.category}>
                      <div className="public-category-section-header"><h3>{categoryLabel(section.category)}</h3><span>{section.groups.length} {section.groups.length === 1 ? 'plato' : 'platos'}</span></div>
                      <div className="public-category-grid">{section.groups.map((group, groupIndex) => renderProductCard(group, sectionIndex === 0 && groupIndex < (isDesktopViewport ? 4 : 2)))}</div>
                    </section>
                  )) : visibleGroups.map((group, groupIndex) => renderProductCard(group, groupIndex < (isDesktopViewport ? 4 : 2)))}
                </div>
              )}
            </section>
              </div>
    
            {/* CONTACT VIEW */}
            {currentTab === 'contacto' && (
              <Suspense fallback={<PublicContactSkeleton />}>
                <PublicMenuContactView variant="mobile" {...contactViewProps} />
              </Suspense>
            )}
            {hasVisitedProfile && <div className="public-mobile-tab-content public-mobile-profile-tab-content" key="perfil" hidden={currentTab !== 'perfil'}><Suspense fallback={<PublicProfileSkeleton />}><CustomerLoyaltyProfile onRepeatOrder={repeatPreviousOrder} favoriteIds={favoriteIds} onToggleFavorite={toggleFavorite} /></Suspense></div>}
    
            {/* Bottom Tab Bar */}
            <nav className="public-mobile-tab-bar">
              <button className={`public-mobile-tab ${currentTab === 'inicio' || currentTab === 'menu' ? 'active' : ''}`} onClick={() => setCurrentTab('menu')}>
                <Utensils size={18} />
                <span>Menú</span>
              </button>
              <button className={`public-mobile-tab ${currentTab === 'contacto' ? 'active' : ''}`} onPointerDown={preloadPublicMenuContactView} onFocus={preloadPublicMenuContactView} onClick={() => { setHasLeftMobileMenu(true); setCurrentTab('contacto') }}>
                <Store size={18} />
                <span>Contacto</span>
              </button>
              <button className={`public-mobile-tab ${currentTab === 'perfil' ? 'active' : ''}`} onPointerDown={preloadCustomerLoyaltyProfile} onFocus={preloadCustomerLoyaltyProfile} onClick={openCustomerProfile}>
                <UserRound size={18} />
                <span>Mi perfil</span>
              </button>
            </nav>
          </div>
  )
}
