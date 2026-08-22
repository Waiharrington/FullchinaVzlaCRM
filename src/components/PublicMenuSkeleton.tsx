export function PublicMenuSkeleton() {
  return (
    <div className="public-menu-page public-menu-skeleton" aria-label="Cargando menú" style={{ transition: 'none' }}>
      {/* Exact Top Navbar Structure */}
      <header className="public-top-bar" id="inicio" style={{ transition: 'none' }}>
        <div className="public-top-bar-left">
          <span className="public-skeleton-block public-skeleton-logo" />
        </div>
        <nav className="public-desktop-nav-links">
          <span className="public-skeleton-block public-skeleton-nav-pill active" />
          <span className="public-skeleton-block public-skeleton-nav-pill" />
          <span className="public-skeleton-block public-skeleton-nav-pill" />
          <span className="public-skeleton-block public-skeleton-nav-pill" />
        </nav>
        <div className="public-top-bar-right">
          <div className="public-nav-status-badges desktop-only">
            <span className="public-skeleton-block public-skeleton-status-pill" />
            <span className="public-skeleton-block public-skeleton-bcv-pill" />
          </div>
        </div>
      </header>

      {/* Main 2-Column Desktop Grid Container */}
      <div className="public-desktop-layout" style={{ transition: 'none' }}>
        {/* Left Column */}
        <div className="public-desktop-main" style={{ transition: 'none' }}>
          {/* Hero Banner Skeleton */}
          <section className="public-cinematic-hero public-skeleton-hero" style={{ transition: 'none' }}>
            <div className="public-hero-left">
              <span className="public-skeleton-block public-skeleton-tag" />
              <span className="public-skeleton-block public-skeleton-hero-title-1" />
              <span className="public-skeleton-block public-skeleton-hero-title-2" />
              <span className="public-skeleton-block public-skeleton-hero-desc" />
              <div className="public-hero-search-row">
                <span className="public-skeleton-block public-skeleton-hero-search" />
                <span className="public-skeleton-block public-skeleton-hero-btn" />
              </div>
            </div>
            <div className="public-hero-right">
              <span className="public-skeleton-block public-skeleton-hero-dish" />
            </div>
          </section>

          {/* Section Header Skeleton */}
          <div className="public-list-header" style={{ marginTop: 24, marginBottom: 16, transition: 'none' }}>
            <div className="public-category-title-group">
              <span className="public-cat-section-bar" />
              <span className="public-skeleton-block public-skeleton-section-title" />
            </div>
          </div>

          {/* 3 Products Grid Skeleton */}
          <div className="public-category-grid" style={{ transition: 'none' }}>
            {Array.from({ length: 3 }).map((_, index) => (
              <article className="public-prod-card public-skeleton-card" key={index} style={{ transition: 'none' }}>
                <div className="public-prod-img-wrap">
                  <span className="public-skeleton-block public-skeleton-prod-img" />
                </div>
                <div className="public-prod-info">
                  <span className="public-skeleton-block public-skeleton-prod-title" />
                  <span className="public-skeleton-block public-skeleton-prod-desc" />
                  <div className="public-prod-footer-row" style={{ marginTop: 'auto', paddingTop: 10 }}>
                    <div className="public-prod-price-wrap">
                      <span className="public-skeleton-block public-skeleton-prod-price" />
                    </div>
                    <span className="public-skeleton-block public-skeleton-prod-add" />
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>

        {/* Right Sticky Sidebar Skeleton (Matches Empty Takeout Box) */}
        <aside className="public-desktop-sidebar" style={{ transition: 'none' }}>
          <div className="public-sidebar-card public-skeleton-sidebar-card" style={{ transition: 'none' }}>
            {/* Header */}
            <div className="public-sidebar-head">
              <div className="public-sidebar-title" style={{ gap: 8 }}>
                <span className="public-skeleton-block" style={{ width: 20, height: 20, borderRadius: '50%' }} />
                <span className="public-skeleton-block" style={{ width: 85, height: 18 }} />
              </div>
            </div>

            {/* Empty Takeout Box Body */}
            <div className="public-sidebar-empty">
              <div className="public-empty-box-art" style={{ margin: '8px 0 16px' }}>
                <span className="public-skeleton-block public-skeleton-box-art" />
              </div>
              <span className="public-skeleton-block" style={{ width: 160, height: 20, marginBottom: 10 }} />
              <span className="public-skeleton-block" style={{ width: 220, height: 12, marginBottom: 6 }} />
              <span className="public-skeleton-block" style={{ width: 190, height: 12, marginBottom: 18 }} />
              <span className="public-skeleton-block public-skeleton-explore-btn" />
            </div>
          </div>
        </aside>
      </div>
    </div>
  )
}
