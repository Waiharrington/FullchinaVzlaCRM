export function PublicMenuSkeleton() {
  return (
    <div className="public-menu-page public-menu-skeleton" aria-label="Cargando menú">
      {/* Top Navbar */}
      <header className="public-top-bar" id="inicio">
        <div className="public-top-bar-left">
          <span className="public-skeleton-block public-skeleton-logo" />
        </div>
        <nav className="public-desktop-nav-links">
          <span className="public-skeleton-block public-skeleton-nav-pill active" />
          <span className="public-skeleton-block public-skeleton-nav-pill" />
          <span className="public-skeleton-block public-skeleton-nav-pill" />
        </nav>
        <div className="public-top-bar-right">
          <div className="public-nav-status-badges desktop-only">
            <span className="public-skeleton-block public-skeleton-status-pill" />
          </div>
        </div>
      </header>

      {/* Main Layout */}
      <div className="public-desktop-layout">
        <div className="public-desktop-main">
          {/* Hero Minimal */}
          <section className="public-cinematic-hero public-skeleton-hero">
            <div className="public-hero-left">
              <span className="public-skeleton-block public-skeleton-tag" />
              <span className="public-skeleton-block public-skeleton-hero-title-1" />
              <span className="public-skeleton-block public-skeleton-hero-title-2" />
              <span className="public-skeleton-block public-skeleton-hero-desc" />
              <div className="public-hero-search-row">
                <span className="public-skeleton-block public-skeleton-hero-search" />
              </div>
            </div>
          </section>

          {/* Section Header */}
          <div className="public-list-header" style={{ marginTop: 24, marginBottom: 16 }}>
            <div className="public-category-title-group">
              <span className="public-cat-section-bar" />
              <span className="public-skeleton-block public-skeleton-section-title" />
            </div>
          </div>

          {/* Products Grid */}
          <div className="public-category-grid">
            {Array.from({ length: 3 }).map((_, index) => (
              <article className="public-prod-card public-skeleton-card" key={index}>
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

        {/* Sidebar */}
        <aside className="public-desktop-sidebar">
          <div className="public-sidebar-card public-skeleton-sidebar-card">
            <div className="public-sidebar-head">
              <div className="public-sidebar-title" style={{ gap: 8 }}>
                <span className="public-skeleton-block" style={{ width: 20, height: 20, borderRadius: '50%' }} />
                <span className="public-skeleton-block" style={{ width: 85, height: 18 }} />
              </div>
            </div>
            <div className="public-sidebar-empty">
              <div className="public-empty-box-art" style={{ margin: '8px 0 16px' }}>
                <span className="public-skeleton-block public-skeleton-box-art" />
              </div>
              <span className="public-skeleton-block" style={{ width: 160, height: 20, marginBottom: 10 }} />
              <span className="public-skeleton-block" style={{ width: 220, height: 12, marginBottom: 6 }} />
              <span className="public-skeleton-block public-skeleton-explore-btn" />
            </div>
          </div>
        </aside>
      </div>
    </div>
  )
}
