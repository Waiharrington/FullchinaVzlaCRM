export function PublicCatalogLoadingSkeleton() {
  return (
    <div className="public-catalog-skeleton" role="status" aria-label="Cargando platos del menú">
      <div className="public-catalog-skeleton-head" aria-hidden="true">
        <span className="fc-skeleton" />
        <span className="fc-skeleton" />
      </div>
      {Array.from({ length: 6 }, (_, index) => (
        <article className="public-catalog-skeleton-card" key={index} aria-hidden="true">
          <span className="public-catalog-skeleton-image" />
          <span className="public-catalog-skeleton-button fc-skeleton" />
          <span className="public-catalog-skeleton-line public-catalog-skeleton-line-title" />
          <span className="public-catalog-skeleton-line public-catalog-skeleton-line-price" />
        </article>
      ))}
    </div>
  )
}
