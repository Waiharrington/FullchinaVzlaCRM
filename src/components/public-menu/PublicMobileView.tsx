import type { MenuVariant } from '../../lib/menuGrouping'
import { PublicCatalogLoadingSkeleton } from './PublicCatalogLoadingSkeleton'
import { CustomerLoyaltyProfile, PublicMenuContactView, preloadCustomerLoyaltyProfile, preloadPublicMenuContactView } from './lazyViews'
import { CATEGORY_ICONS } from '../../lib/publicMenuConfig'
import { Suspense, useRef, type CSSProperties, type MouseEvent, type WheelEvent, type Dispatch, type SetStateAction, type RefObject, type ReactNode } from 'react'
import { Clock, Search, X, ChevronRight, Heart, Utensils } from 'lucide-react'
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
import { usePauseOffscreen } from '../../pedir-v2/hooks'
import { Chopsticks, Fit } from '../../pedir-v2/ui'
import { DeckRail } from '../../pedir-v2/Deck'
import { Turntable } from '../../pedir-v2/Turntable'
import { NavBowl, NavPerson, NavPlace } from '../../pedir-v2/NavIcons'

interface PublicMobileViewProps {
  scrollCategory: string | null
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

export function PublicMobileView({ scrollCategory, activeCategory, bcvRate, cartOpen, categories, categorySections, closeSearch, contactViewProps, currentTab, error, favoriteIds, formattedCloseTime, handleRecommendedWheel, hasLeftMobileMenu, hasVisitedProfile, heroSearchRef, isDesktopViewport, isLoyaltyRecommended, isStoreOpen, loading, moveRecommended, openCustomerProfile, openGroup, pageSettings, pauseRecommendedAutoplay, priceBs, products, recommendedGroup, recommendedIndex, recommendedSlideCount, recommendedSlides, recommendedSwipeStart, recommendedVariant, recommendedWasSwiped, renderProductCard, repeatPreviousOrder, resumeRecommendedAutoplay, retryPublicCatalog, search, setActiveCategory, setCurrentTab, setError, setHasLeftMobileMenu, setRequestedRecommendedIndex, setSearch, setShowFavorites, setShowSearch, showFavorites, showSearch, storeScheduleLabel, toggleFavorite, visibleGroups }: PublicMobileViewProps) {
  const railRef = useRef<HTMLElement>(null)
  const tableRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const searching = Boolean(search.trim())
  const showDeck = !searching && activeCategory === 'promociones' && visibleGroups.length > 1
  const stageRef = useRef<HTMLDivElement>(null)
  usePauseOffscreen(stageRef)
  // Solo visual: qué categoría sostienen los palillos mientras se recorre el menú.
  const heldCategory = activeCategory === 'Todos' ? scrollCategory : activeCategory
  const catClass = (category: string) => `public-cat-btn ${!searching && activeCategory === category ? 'active' : ''} ${!searching && (heldCategory === category || (!heldCategory && category === 'Todos')) ? 'is-held' : ''}`
  const chooseCategory = (category: string) => {
    closeSearch()
    setActiveCategory(category)
    const top = (stageRef.current?.offsetTop ?? 0) + (stageRef.current?.offsetHeight ?? 0)
    if (window.scrollY > top) window.scrollTo({ top, behavior: 'auto' })
  }
  return (
<div className="public-mobile-view mobile-only">

            {/* MENU VIEW */}
            <div className={`public-mobile-tab-content${hasLeftMobileMenu ? ' is-retained' : ''}${searching ? ' is-searching' : ''}`} key="menu" hidden={currentTab === 'contacto' || currentTab === 'perfil'}>
            {/* 2. Hero Status */}
            <div className="pd-stage" ref={stageRef}>
            <div className="public-hero-header">
              <div className="public-hero-title-row">
                <h1><Fit>{pageSettings.mobileHeading}</Fit></h1>
              </div>
              <div className="pd-status-row">
              <span className={`public-status ${isStoreOpen ? 'is-open' : 'is-closed'}`}>
                <i /> <strong>{LOCAL_ORDER_TEST_MODE ? 'Modo de prueba' : isStoreOpen ? 'Abierto' : 'Cerrado'}</strong><span className="public-status-hours"><Clock size={13} aria-hidden="true" />{LOCAL_ORDER_TEST_MODE ? 'No envía pedidos' : isStoreOpen ? `Hasta las ${formattedCloseTime}` : storeScheduleLabel}</span>
              </span>
                {bcvRate && (
                  <span className="public-rate-badge" title="Tasa oficial del Banco Central de Venezuela">
                    <span className="public-rate-badge-label">BCV</span>
                    <span className="public-rate-badge-value">Bs. {bcvRate.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </span>
                )}
              </div>
              <div className={`public-hero-search-pill ${showSearch ? 'is-active' : ''}`} onClick={() => { if (!showSearch) { heroSearchRef.current?.focus(); setShowSearch(true) } }}>
                <Search size={16} />
                <span className="public-hero-search-placeholder" aria-hidden={showSearch}>{pageSettings.searchPlaceholder}</span>
                <input
                  ref={heroSearchRef}
                  aria-label="Buscar en el menú"
                  tabIndex={showSearch ? 0 : -1}
                  placeholder={showSearch ? pageSettings.searchPlaceholder : ''}
                  value={search}
                  onChange={e => { setShowFavorites(false); setSearch(e.target.value) }}
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
              onPointerMove={event => {
                // Solo visual: la mesa acompaña al dedo mientras se arrastra.
                const start = recommendedSwipeStart.current
                if (start == null) return
                tableRef.current?.classList.add('is-dragging')
                tableRef.current?.style.setProperty('--drag', `${Math.max(-26, Math.min(26, (event.clientX - start) / 9))}deg`)
              }}
              onWheel={handleRecommendedWheel}
              onPointerUp={(event) => {
                tableRef.current?.classList.remove('is-dragging')
                tableRef.current?.style.removeProperty('--drag')
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
                tableRef.current?.classList.remove('is-dragging')
                tableRef.current?.style.removeProperty('--drag')
                recommendedSwipeStart.current = null
                resumeRecommendedAutoplay()
              }}
              onMouseEnter={pauseRecommendedAutoplay}
              onMouseLeave={resumeRecommendedAutoplay}
            >
              <Turntable slides={recommendedSlides} index={recommendedIndex} tableRef={tableRef} />
              {isLoyaltyRecommended ? <CustomerLoyaltyPromo presentation="recommended" onJoin={openCustomerProfile} /> : <div className="public-recommended-copy" key={`copy-${recommendedGroup?.key ?? 'empty'}`}>
                <h2><Fit>{productTitle(recommendedGroup?.name ?? 'Explora nuestro menú')}</Fit></h2>
                <p>{recommendedVariant?.product.description || recommendedGroup?.variants[0]?.product.description || 'Elige tu favorito y arma tu pedido.'}</p>
                <div className="pd-hero-buy">
                  {recommendedGroup && <span className="pd-hero-price"><strong>{money(recommendedVariant?.product.price ?? recommendedGroup.minPrice)}</strong>{priceBs(recommendedVariant?.product.price ?? recommendedGroup.minPrice) && <small>{priceBs(recommendedVariant?.product.price ?? recommendedGroup.minPrice)}</small>}</span>}
                  <button
                    className="public-recommended-btn"
                    onClick={(event) => { event.stopPropagation(); if (recommendedGroup) openGroup(recommendedGroup, undefined, recommendedVariant?.product.id) }}
                    aria-label={`Ver producto: ${productTitle(recommendedGroup?.name ?? 'producto')}`}
                  >Lo quiero <ChevronRight size={16} strokeWidth={2.6} aria-hidden="true" /></button>
                </div>
              </div>}
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

            </div>

            {/* 4. Category Nav */}
            <div className="pd-rail-wrap">
            <nav className="public-categories-scroll" ref={railRef} aria-label="Categorías del menú">
              <Chopsticks railRef={railRef} active={heldCategory ?? 'Todos'} />
              {categories.filter(c => c !== 'Todos').map(category => (
                 <button
                   key={category}
                   className={catClass(category)}
                   onClick={() => chooseCategory(category)}
                 >
                   <img className="public-cat-icon-image" src={CATEGORY_ICONS[category] || CATEGORY_ICONS.Todos} alt="" loading="lazy" decoding="async" />
                   <span>{categoryLabel(category)}</span>
                 </button>
              ))}
              <button 
                 className={catClass('Todos')}
                 onClick={() => chooseCategory('Todos')}>
                 <img className="public-cat-icon-image" src={CATEGORY_ICONS.Todos} alt="" decoding="async" />
                 <span>Menú</span>
              </button>
            </nav>
            </div>

            {/* 5. Products Section */}
              <section className="public-content">
              <div className="public-list-header">
                <h2 className={activeCategory === 'Todos' && !searching ? 'public-main-list-title' : undefined}>{searching ? 'Resultados' : activeCategory === 'Todos' ? 'Menú' : categoryLabel(activeCategory)}</h2>
                {searching && visibleGroups.length > 0 && <span className="pd-search-count" role="status">{visibleGroups.length} {visibleGroups.length === 1 ? 'plato' : 'platos'} en todo el menú</span>}
                <div className="public-list-actions">
                  <button className={`public-favorites-inline ${showFavorites ? 'active' : ''}`} onClick={() => setShowFavorites(value => !value)} aria-label="Filtrar favoritos"><Heart size={16} fill={showFavorites ? 'currentColor' : 'none'} /><span>Favoritos</span>{favoriteIds.length > 0 && <b>{favoriteIds.length}</b>}</button>
                </div>
              </div>

              {error && products.length > 0 && !cartOpen && <Toast type="error" message={error} onClose={() => setError('')} />}
              {error && products.length === 0 ? <div className="public-state error" role="alert"><p>{error}</p><button type="button" className="public-catalog-retry" onClick={retryPublicCatalog}>Reintentar</button></div> : (
                <>
                {showDeck && <DeckRail listRef={listRef} groups={visibleGroups} />}
                <div ref={listRef} data-category={searching ? 'Todos' : activeCategory} className={`public-product-list ${activeCategory === 'Todos' && !searching ? 'public-product-list-grouped' : ''}${showDeck ? ' is-deck' : ''}`}>
                  {loading && products.length === 0 ? <PublicCatalogLoadingSkeleton /> : visibleGroups.length === 0 ? (
                    <div className="public-empty-menu">
                      <span><Utensils size={42} /></span>
                      <h3>{showFavorites ? 'Todavía no tienes favoritos' : 'No encontramos ese plato'}</h3>
                      <p>{showFavorites ? 'Toca el corazón de un plato para guardarlo en este dispositivo.' : 'Prueba con otro nombre o vuelve a ver todo el menú.'}</p>
                      <button type="button" onClick={() => { setSearch(''); setActiveCategory('Todos'); setShowFavorites(false) }}>Ver todo el menú</button>
                    </div>
                  ) : activeCategory === 'Todos' && !searching ? categorySections.map((section, sectionIndex) => (
                    <section className="public-category-section" key={section.category} data-category={section.category}>
                      <div className="public-category-section-header"><h3>{categoryLabel(section.category)}</h3><button type="button" className="pd-see-all" onClick={() => chooseCategory(section.category)}>Ver las {section.groups.length} <ChevronRight size={15} aria-hidden="true" /></button></div>
                      <div className="public-category-grid">{section.groups.map((group, groupIndex) => renderProductCard(group, sectionIndex === 0 && groupIndex < (isDesktopViewport ? 4 : 2)))}</div>
                    </section>
                  )) : visibleGroups.map((group, groupIndex) => renderProductCard(group, groupIndex < (isDesktopViewport ? 4 : 2)))}
                </div>
                </>
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
            <nav className="public-mobile-tab-bar" aria-label="Secciones" style={{ '--i': currentTab === 'contacto' ? 1 : currentTab === 'perfil' ? 2 : 0 } as CSSProperties}>
              <span className="pd-embers" key={currentTab === 'inicio' ? 'menu' : currentTab} aria-hidden="true">{[-16, -5, 7, 18].map((x, i) => <i key={x} style={{ '--x': `${x}px`, '--t': `${i * 0.09}s` } as CSSProperties} />)}</span>
              <button className={`public-mobile-tab ${currentTab === 'inicio' || currentTab === 'menu' ? 'active' : ''}`} onClick={() => setCurrentTab('menu')}>
                <NavBowl />
                <span>Menú</span>
              </button>
              <button className={`public-mobile-tab ${currentTab === 'contacto' ? 'active' : ''}`} onPointerDown={preloadPublicMenuContactView} onFocus={preloadPublicMenuContactView} onClick={() => { setHasLeftMobileMenu(true); setCurrentTab('contacto') }}>
                <NavPlace />
                <span>Contacto</span>
              </button>
              <button className={`public-mobile-tab ${currentTab === 'perfil' ? 'active' : ''}`} onPointerDown={preloadCustomerLoyaltyProfile} onFocus={preloadCustomerLoyaltyProfile} onClick={openCustomerProfile}>
                <NavPerson />
                <span>Mi perfil</span>
              </button>
            </nav>
          </div>
  )
}
