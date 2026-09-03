import './PageSkeleton.css'

interface PageSkeletonProps {
  rows?: number
  cards?: number
  hasTable?: boolean
}

export function PageSkeleton({ rows = 4, cards = 4, hasTable = true }: PageSkeletonProps) {
  return (
    <div className="page skeleton-page">
      <div className="sk-header">
        <div className="sk-title" />
        <div className="sk-subtitle" />
      </div>

      {cards > 0 && (
        <div className="sk-cards">
          {Array.from({ length: cards }).map((_, i) => (
            <div key={i} className="sk-card">
              <div className="sk-card-icon" />
              <div className="sk-card-text">
                <div className="sk-card-label" />
                <div className="sk-card-value" />
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="sk-tools">
        <div className="sk-search" />
        <div className="sk-filter" />
        <div className="sk-filter" />
      </div>

      {hasTable ? (
        <div className="sk-table">
          {Array.from({ length: rows }).map((_, i) => (
            <div key={i} className="sk-table-row">
              <div className="sk-table-cell sk-table-thumb" />
              <div className="sk-table-cell sk-table-name" />
              <div className="sk-table-cell sk-table-cat" />
              <div className="sk-table-cell sk-table-price" />
              <div className="sk-table-cell sk-table-actions" />
            </div>
          ))}
        </div>
      ) : (
        <div className="sk-grid">
          {Array.from({ length: rows }).map((_, i) => (
            <div key={i} className="sk-grid-card">
              <div className="sk-grid-img" />
              <div className="sk-grid-body">
                <div className="sk-grid-title" />
                <div className="sk-grid-sub" />
                <div className="sk-grid-row" />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
