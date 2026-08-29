import { ChevronUp, ChevronDown } from 'lucide-react'
import './NumberStepper.css'

interface NumberStepperProps {
  value: string
  onChange: (value: string) => void
  step?: number
  min?: number
  max?: number
  placeholder?: string
  prefix?: string
  required?: boolean
  disabled?: boolean
  className?: string
  id?: string
  autoFocus?: boolean
}

function decimalsOf(n: number) {
  const s = String(n)
  const i = s.indexOf('.')
  return i === -1 ? 0 : s.length - i - 1
}

export default function NumberStepper({
  value, onChange, step = 1, min, max, placeholder, prefix, required, disabled, className = '', id, autoFocus,
}: NumberStepperProps) {
  const bump = (dir: 1 | -1) => {
    const current = parseFloat(value) || 0
    const precision = Math.max(decimalsOf(step), decimalsOf(current))
    const factor = 10 ** precision
    let next = Math.round((current + dir * step) * factor) / factor
    if (min != null && next < min) next = min
    if (max != null && next > max) next = max
    onChange(String(next))
  }

  const current = parseFloat(value)
  const atMax = max != null && !Number.isNaN(current) && current >= max
  const atMin = min != null && !Number.isNaN(current) && current <= min

  return (
    <div className={`num-stepper ${className}`}>
      {prefix && <span className="num-stepper-prefix">{prefix}</span>}
      <input
        id={id}
        type="number"
        inputMode="decimal"
        className="num-stepper-input"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        step={step}
        min={min}
        max={max}
        placeholder={placeholder}
        required={required}
        disabled={disabled}
        autoFocus={autoFocus}
      />
      <div className="num-stepper-controls">
        <button type="button" className="num-stepper-btn" tabIndex={-1} disabled={disabled || atMax} onClick={() => bump(1)} aria-label="Aumentar">
          <ChevronUp size={12} strokeWidth={3} />
        </button>
        <button type="button" className="num-stepper-btn" tabIndex={-1} disabled={disabled || atMin} onClick={() => bump(-1)} aria-label="Disminuir">
          <ChevronDown size={12} strokeWidth={3} />
        </button>
      </div>
    </div>
  )
}
