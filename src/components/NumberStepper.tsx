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
  hideControls?: boolean
  allowComma?: boolean
}

export default function NumberStepper({
  value, onChange, min, max, placeholder, prefix, required, disabled, className = '', id, autoFocus, allowComma,
}: NumberStepperProps) {
  return (
    <div className={`num-stepper ${className}`}>
      {prefix && <span className="num-stepper-prefix">{prefix}</span>}
      <input
        id={id}
        type={allowComma ? 'text' : 'number'}
        inputMode="decimal"
        className="num-stepper-input"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        step="any"
        min={min}
        max={max}
        placeholder={placeholder}
        required={required}
        disabled={disabled}
        autoFocus={autoFocus}
      />
    </div>
  )
}
