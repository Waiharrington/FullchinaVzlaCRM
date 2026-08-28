import { useState } from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { StyledSelect } from './StyledSelect'

function ControlledSelect({ onChange = vi.fn() }: { onChange?: (value: string) => void }) {
  const [value, setValue] = useState('week')
  return (
    <StyledSelect aria-label="Período" value={value} onChange={event => { setValue(event.target.value); onChange(event.target.value) }}>
      <option value="day">Hoy</option>
      <option value="week">Esta semana</option>
      <option value="month">Este mes</option>
    </StyledSelect>
  )
}

describe('StyledSelect', () => {
  it('muestra el valor actual y conserva el evento change', () => {
    const onChange = vi.fn()
    render(<ControlledSelect onChange={onChange} />)

    fireEvent.click(screen.getByRole('button', { name: 'Período' }))
    fireEvent.click(screen.getByRole('option', { name: 'Este mes' }))

    expect(onChange).toHaveBeenCalledWith('month')
    expect(screen.getByRole('button', { name: 'Período' })).toHaveTextContent('Este mes')
  })

  it('permite elegir con teclado', () => {
    const onChange = vi.fn()
    render(<ControlledSelect onChange={onChange} />)
    const trigger = screen.getByRole('button', { name: 'Período' })

    fireEvent.keyDown(trigger, { key: 'ArrowDown' })
    fireEvent.keyDown(trigger, { key: 'ArrowDown' })
    fireEvent.keyDown(trigger, { key: 'Enter' })

    expect(onChange).toHaveBeenCalledWith('month')
  })

  it('agrega búsqueda cuando hay muchas opciones', () => {
    render(
      <StyledSelect aria-label="Día" value="1" onChange={() => {}}>
        {Array.from({ length: 12 }, (_, index) => <option key={index + 1} value={index + 1}>Día {index + 1}</option>)}
      </StyledSelect>,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Día' }))
    fireEvent.change(screen.getByRole('textbox', { name: 'Buscar opción' }), { target: { value: '12' } })

    expect(screen.getByRole('option', { name: 'Día 12' })).toBeInTheDocument()
    expect(screen.queryByRole('option', { name: 'Día 2' })).not.toBeInTheDocument()
  })
})
