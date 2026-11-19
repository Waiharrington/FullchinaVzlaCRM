import './LoadingSkeleton.css'

type LoadingSkeletonProps = {
  label: string
  variant?: 'rows' | 'inline' | 'cards'
  count?: number
  withAvatar?: boolean
  className?: string
  decorative?: boolean
}

/** Placeholder accesible para datos que todavía están llegando. */
export function LoadingSkeleton({
  label,
  variant = 'rows',
  count = 3,
  withAvatar = false,
  className = '',
  decorative = false,
}: LoadingSkeletonProps) {
  const rootClassName = `ui-loading-skeleton ui-loading-skeleton--${variant}${className ? ` ${className}` : ''}`
  const accessibilityProps = decorative
    ? { 'aria-hidden': true as const }
    : { role: 'status' as const, 'aria-label': label }

  if (variant === 'inline') {
    return <span className={rootClassName} {...accessibilityProps}><i /></span>
  }

  if (variant === 'cards') {
    return (
      <div className={rootClassName} {...accessibilityProps}>
        {Array.from({ length: count }, (_, index) => <article className="ui-loading-skeleton-card" key={index} aria-hidden="true"><i /><span /><span /><b /></article>)}
      </div>
    )
  }

  return (
    <div className={rootClassName} {...accessibilityProps}>
      {Array.from({ length: count }, (_, index) => (
        <div className="ui-loading-skeleton-row" key={index} aria-hidden="true">
          {withAvatar && <i className="ui-loading-skeleton-avatar" />}
          <span className="ui-loading-skeleton-copy"><i /><i /></span>
        </div>
      ))}
    </div>
  )
}
