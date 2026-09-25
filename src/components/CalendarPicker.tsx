import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react'
import './CalendarPicker.css'

type CalendarPickerProps = {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  trigger?: 'icon' | 'field' | 'text'
  className?: string
  showCalendarIcon?: boolean
  id?: string
  monthCursor?: Date
  label?: string
  disableFuture?: boolean
}

function toDateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

export function CalendarPicker({
  value,
  onChange,
  placeholder = 'Elegir fecha',
  trigger = 'icon',
  className = '',
  showCalendarIcon = true,
  id,
  monthCursor,
  label,
  disableFuture = false,
}: CalendarPickerProps) {
  const [open, setOpen] = useState(false)
  const [viewMonth, setViewMonth] = useState(() => new Date())
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const popoverRef = useRef<HTMLDivElement>(null)
  const today = new Date()
  const todayKey = toDateKey(today)
  const selected = value ? new Date(`${value}T12:00:00`) : null
  const selectedLabel = selected
    ? selected.toLocaleDateString('es-VE', { day: '2-digit', month: '2-digit', year: 'numeric' })
    : placeholder
  const monthTitle = viewMonth.toLocaleDateString('es-VE', { month: 'long', year: 'numeric' })

  const updatePosition = useCallback(() => {
    const rect = triggerRef.current?.getBoundingClientRect()
    if (!rect) return
    const width = 292
    const height = popoverRef.current?.offsetHeight || 344
    const left = Math.max(12, Math.min(rect.right - width, window.innerWidth - width - 12))
    const below = rect.bottom + 8
    setPosition({
      top: below + height <= window.innerHeight - 12 ? below : Math.max(12, rect.top - height - 8),
      left,
    })
  }, [])

  useEffect(() => {
    if (!open) return
    updatePosition()
    const closeOnOutsidePointer = (event: PointerEvent) => {
      if (triggerRef.current?.contains(event.target as Node) || popoverRef.current?.contains(event.target as Node)) return
      setOpen(false)
    }
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    window.addEventListener('resize', updatePosition)
    window.addEventListener('scroll', updatePosition, true)
    document.addEventListener('pointerdown', closeOnOutsidePointer)
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      window.removeEventListener('resize', updatePosition)
      window.removeEventListener('scroll', updatePosition, true)
      document.removeEventListener('pointerdown', closeOnOutsidePointer)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [open, updatePosition])

  const openCalendar = () => {
    setViewMonth(selected
      ? new Date(selected.getFullYear(), selected.getMonth(), 1)
      : new Date((monthCursor ?? today).getFullYear(), (monthCursor ?? today).getMonth(), 1))
    setOpen(current => !current)
  }

  const firstDay = new Date(viewMonth.getFullYear(), viewMonth.getMonth(), 1)
  const mondayOffset = (firstDay.getDay() + 6) % 7
  const gridStart = new Date(firstDay.getFullYear(), firstDay.getMonth(), 1 - mondayOffset)
  const days = Array.from({ length: 42 }, (_, index) => {
    const date = new Date(gridStart.getFullYear(), gridStart.getMonth(), gridStart.getDate() + index)
    return { date, key: toDateKey(date), inMonth: date.getMonth() === viewMonth.getMonth() }
  })
  const canGoNext = !disableFuture || viewMonth.getFullYear() < today.getFullYear()
    || (viewMonth.getFullYear() === today.getFullYear() && viewMonth.getMonth() < today.getMonth())
  const chooseDate = (dateKey: string) => { onChange(dateKey); setOpen(false) }
  const triggerClass = trigger === 'icon'
    ? 'fc-calendar-icon-trigger'
    : trigger === 'field' ? 'fc-calendar-field-trigger' : 'fc-calendar-text-trigger'

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        id={id}
        className={`${triggerClass} ${className} ${open ? 'is-open' : ''}`.trim()}
        aria-label={trigger === 'icon' ? placeholder : undefined}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={openCalendar}
      >
        {showCalendarIcon && <CalendarDays size={15} aria-hidden="true" />}
        {label && <span className="fc-calendar-prefix">{label}</span>}
        {trigger !== 'icon' && <span className="fc-calendar-value">{selectedLabel}</span>}
        {trigger === 'field' && <ChevronDown size={13} aria-hidden="true" />}
      </button>
      {open && createPortal(
        <div
          ref={popoverRef}
          className="fc-calendar-popover"
          role="dialog"
          aria-label="Seleccionar fecha"
          style={{ top: position?.top ?? -1000, left: position?.left ?? -1000 }}
        >
          <div className="fc-calendar-header">
            <button type="button" aria-label="Mes anterior" onClick={() => setViewMonth(month => new Date(month.getFullYear(), month.getMonth() - 1, 1))}>
              <ChevronLeft size={16} />
            </button>
            <span>{monthTitle}</span>
            <button type="button" aria-label="Mes siguiente" disabled={!canGoNext} onClick={() => setViewMonth(month => new Date(month.getFullYear(), month.getMonth() + 1, 1))}>
              <ChevronRight size={16} />
            </button>
          </div>
          <div className="fc-calendar-grid" role="grid">
            {['L', 'M', 'X', 'J', 'V', 'S', 'D'].map((day, index) => (
              <span key={`${day}-${index}`} className="fc-calendar-weekday" role="columnheader">{day}</span>
            ))}
            {days.map(({ date, key, inMonth }) => {
              const isFuture = disableFuture && key > todayKey
              return (
                <button
                  key={key}
                  type="button"
                  role="gridcell"
                  disabled={isFuture}
                  aria-label={date.toLocaleDateString('es-VE', { dateStyle: 'full' })}
                  aria-pressed={value === key}
                  className={[
                    'fc-calendar-day',
                    !inMonth && 'outside',
                    value === key && 'selected',
                    key === todayKey && 'today',
                  ].filter(Boolean).join(' ')}
                  onClick={() => chooseDate(key)}
                >
                  {date.getDate()}
                </button>
              )
            })}
          </div>
          <div className="fc-calendar-footer">
            <span>Selecciona un día</span>
            <button type="button" onClick={() => chooseDate(todayKey)}>Hoy</button>
          </div>
        </div>,
        document.body,
      )}
    </>
  )
}
