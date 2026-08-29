import './EmptyState.css'

function WokIcon() {
  return (
    <svg viewBox="0 0 72 72" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M14 31H51C50.2 43.4 43.1 51 32.5 51C21.9 51 14.8 43.4 14 31Z" className="es-wok-bowl" />
      <path d="M50 34L65 27" className="es-wok-handle" />
      <path d="M24 23C20.5 18.7 27.5 16.2 24.5 11" className="es-wok-steam" />
      <path d="M33 22C29.8 17.5 36.8 15.1 33.6 9" className="es-wok-steam es-wok-steam-delay" />
      <path d="M42 23C38.9 19 45.4 16.8 42.8 12" className="es-wok-steam es-wok-steam-late" />
      <path d="M25 55H41" className="es-wok-base" />
    </svg>
  )
}

interface EmptyStateProps {
  title: string
  description?: string
  actionLabel?: string
  onAction?: () => void
  compact?: boolean
}

export function EmptyState({ title, description, actionLabel, onAction, compact }: EmptyStateProps) {
  return (
    <div className={`empty-state${compact ? ' empty-state-compact' : ''}`}>
      <span className="empty-state-icon"><WokIcon /></span>
      <h3>{title}</h3>
      {description && <p>{description}</p>}
      {actionLabel && onAction && <button type="button" onClick={onAction}>{actionLabel}</button>}
    </div>
  )
}
