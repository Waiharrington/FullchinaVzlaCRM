import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Check, ChevronDown, Clock3 } from 'lucide-react'
import './TimeSelect.css'

interface TimeSelectProps {
  value: string
  onChange: (value: string) => void
  label: string
}

function formatTime(value: string) {
  const [rawHour, rawMinute] = value.split(':').map(Number)
  const hour = rawHour % 12 || 12
  return `${String(hour).padStart(2, '0')}:${String(rawMinute).padStart(2, '0')} ${rawHour >= 12 ? 'p. m.' : 'a. m.'}`
}

function parseTime(text: string) {
  const normalized = text.toLowerCase().trim().replace(/[.\s]/g, '')
  const match = /^(\d{1,2}):(\d{1,2})(am|pm)?$/.exec(normalized)
  if (!match) return null

  const enteredHour = Number(match[1])
  const minute = Number(match[2])
  const suffix = match[3]
  if (minute > 59 || (suffix ? enteredHour < 1 || enteredHour > 12 : enteredHour > 23)) return null

  const hour24 = suffix ? enteredHour % 12 + (suffix === 'pm' ? 12 : 0) : enteredHour
  return `${String(hour24).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
}

const hourOptions = Array.from({ length: 12 }, (_, index) => index + 1)
const minuteOptions = Array.from({ length: 60 }, (_, index) => index)

export function TimeSelect({ value, onChange, label }: TimeSelectProps) {
  const [draft, setDraft] = useState(() => formatTime(value))
  const [error, setError] = useState('')
  const [pickerOpen, setPickerOpen] = useState(false)
  const [pickerPosition, setPickerPosition] = useState({ top: 0, left: 0 })
  const lastSyncedValue = useRef(value)
  const inputRef = useRef<HTMLInputElement>(null)
  const rootRef = useRef<HTMLDivElement>(null)
  const popoverRef = useRef<HTMLDivElement>(null)
  const hourWheelRef = useRef<HTMLDivElement>(null)
  const minuteWheelRef = useRef<HTMLDivElement>(null)
  const wheelsReadyRef = useRef(false)

  useEffect(() => {
    if (value !== lastSyncedValue.current) {
      lastSyncedValue.current = value
      setDraft(formatTime(value))
    }
  }, [value])

  useEffect(() => {
    if (!pickerOpen) return
    const onOutside = (event: PointerEvent) => {
      if (event.target instanceof Node && !rootRef.current?.contains(event.target) && !popoverRef.current?.contains(event.target)) setPickerOpen(false)
    }
    const onEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') setPickerOpen(false) }
    const onOtherPicker = (event: Event) => {
      if ((event as CustomEvent<HTMLDivElement | null>).detail !== rootRef.current) setPickerOpen(false)
    }
    const closeOnScroll = (event: Event) => {
      if (event.target instanceof Node && popoverRef.current?.contains(event.target)) return
      setPickerOpen(false)
    }
    document.addEventListener('pointerdown', onOutside)
    document.addEventListener('keydown', onEscape)
    document.addEventListener('fc-time-picker-open', onOtherPicker)
    window.addEventListener('scroll', closeOnScroll, true)
    return () => {
      document.removeEventListener('pointerdown', onOutside)
      document.removeEventListener('keydown', onEscape)
      document.removeEventListener('fc-time-picker-open', onOtherPicker)
      window.removeEventListener('scroll', closeOnScroll, true)
    }
  }, [pickerOpen])

  const applyTime = () => {
    const parsed = parseTime(draft)
    if (!parsed) {
      setError('Escribe una hora como 11:30 a. m., 6:10 PM o 22:00.')
      inputRef.current?.focus()
      return
    }
    lastSyncedValue.current = parsed
    onChange(parsed)
    setError('')
    setPickerOpen(false)
    inputRef.current?.focus()
  }

  const openPicker = () => {
    if (pickerOpen) {
      setPickerOpen(false)
      return
    }
    const bounds = rootRef.current?.getBoundingClientRect()
    if (bounds) {
      const panelWidth = Math.min(280, window.innerWidth - 24)
      const panelHeight = 225
      const below = bounds.bottom + 7
      const top = below + panelHeight <= window.innerHeight - 8
        ? below
        : Math.max(8, bounds.top - panelHeight - 7)
      const left = Math.min(Math.max(8, bounds.left), window.innerWidth - panelWidth - 8)
      setPickerPosition({ top, left })
    }
    document.dispatchEvent(new CustomEvent('fc-time-picker-open', { detail: rootRef.current }))
    setPickerOpen(true)
  }
  const currentParsed = parseTime(draft) ?? value
  const [currentHour, currentMinute] = currentParsed.split(':').map(Number)
  const pickerHour = currentHour % 12 || 12
  const pickerPeriod = currentHour >= 12 ? 'PM' : 'AM'
  const wheelSelectionRef = useRef({ hour: pickerHour, minute: currentMinute })
  wheelSelectionRef.current = { hour: pickerHour, minute: currentMinute }
  useEffect(() => {
    wheelsReadyRef.current = false
    if (!pickerOpen) return
    const frame = window.requestAnimationFrame(() => {
      const selection = wheelSelectionRef.current
      if (hourWheelRef.current) hourWheelRef.current.scrollTop = (selection.hour - 1) * 36
      if (minuteWheelRef.current) minuteWheelRef.current.scrollTop = selection.minute * 36
      wheelsReadyRef.current = true
    })
    return () => {
      window.cancelAnimationFrame(frame)
      wheelsReadyRef.current = false
    }
  }, [pickerOpen])
  const chooseParts = (hour: number, minute: number, period: 'AM' | 'PM') => {
    setDraft(`${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')} ${period === 'AM' ? 'a. m.' : 'p. m.'}`)
    setError('')
  }

  return <div className="fc-time-picker" ref={rootRef}>
    <form className="fc-time-picker-entry" onSubmit={event => { event.preventDefault(); applyTime() }}>
      <Clock3 className="fc-time-picker-icon" size={16} aria-hidden="true" />
      <input
        ref={inputRef}
        className="fc-time-picker-input"
        type="text"
        inputMode="text"
        aria-label={label}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${label.replace(/\W+/g, '-').toLowerCase()}-time-error` : undefined}
        value={draft}
        onChange={event => {
          const nextDraft = event.target.value
          setDraft(nextDraft)
          setError('')
          const parsed = parseTime(nextDraft)
          if (parsed) {
            lastSyncedValue.current = parsed
            onChange(parsed)
          }
        }}
        placeholder="Escribe la hora"
        autoComplete="off"
        spellCheck={false}
      />
      <button type="button" className="fc-time-picker-open" aria-label="Abrir selector de hora" aria-haspopup="dialog" aria-expanded={pickerOpen} onClick={openPicker}><ChevronDown size={15} /></button>
    </form>
    {pickerOpen && createPortal(<div ref={popoverRef} className="fc-time-picker-popover is-fixed" style={{ top: pickerPosition.top, left: pickerPosition.left }} role="dialog" aria-label={`Selector de ${label.toLowerCase()}`}>
      <div className="fc-time-picker-heading"><Clock3 size={15} aria-hidden="true" /><strong>Elegir hora</strong><span>{draft || formatTime(value)}</span></div>
      <div className="fc-time-picker-quick-row">
        <div className="fc-time-picker-wheel-column" aria-label="Hora"><span>HORA</span><div className="fc-time-picker-wheel" ref={hourWheelRef} role="listbox" aria-label="Seleccionar hora" onScroll={event => { if (!wheelsReadyRef.current) return; const index = Math.max(0, Math.min(hourOptions.length - 1, Math.round(event.currentTarget.scrollTop / 36))); const hour = hourOptions[index]; if (hour !== pickerHour) chooseParts(hour, currentMinute, pickerPeriod) }}>{hourOptions.map((hour, index) => <button type="button" role="option" aria-selected={pickerHour === hour} key={hour} className={pickerHour === hour ? 'selected' : ''} onClick={event => { event.currentTarget.parentElement!.scrollTop = index * 36; chooseParts(hour, currentMinute, pickerPeriod) }}>{String(hour).padStart(2, '0')}</button>)}</div></div>
        <div className="fc-time-picker-wheel-column" aria-label="Minutos"><span>MIN</span><div className="fc-time-picker-wheel" ref={minuteWheelRef} role="listbox" aria-label="Seleccionar minutos" onScroll={event => { if (!wheelsReadyRef.current) return; const minute = Math.max(0, Math.min(minuteOptions.length - 1, Math.round(event.currentTarget.scrollTop / 36))); if (minute !== currentMinute) chooseParts(pickerHour, minute, pickerPeriod) }}>{minuteOptions.map((minute, index) => <button type="button" role="option" aria-selected={currentMinute === minute} key={minute} className={currentMinute === minute ? 'selected' : ''} onClick={event => { event.currentTarget.parentElement!.scrollTop = index * 36; chooseParts(pickerHour, minute, pickerPeriod) }}>{String(minute).padStart(2, '0')}</button>)}</div></div>
        <div className="fc-time-picker-period" aria-label="Período"><button type="button" className={pickerPeriod === 'AM' ? 'selected' : ''} aria-pressed={pickerPeriod === 'AM'} onClick={() => chooseParts(pickerHour, currentMinute, 'AM')}>a. m.</button><button type="button" className={pickerPeriod === 'PM' ? 'selected' : ''} aria-pressed={pickerPeriod === 'PM'} onClick={() => chooseParts(pickerHour, currentMinute, 'PM')}>p. m.</button></div>
      </div>
      <button type="button" className="fc-time-picker-done" onClick={applyTime}><Check size={14} /> Aplicar hora</button>
    </div>, document.body)}
    {error && <small className="fc-time-picker-error" id={`${label.replace(/\W+/g, '-').toLowerCase()}-time-error`} role="alert">{error}</small>}
  </div>
}
