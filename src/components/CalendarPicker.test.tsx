import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { CalendarPicker } from './CalendarPicker'

describe('CalendarPicker', () => {
  it('opens the shared calendar and returns today as a local ISO date', () => {
    const onChange = vi.fn()
    render(<CalendarPicker value="" onChange={onChange} placeholder="Fecha de envío" />)

    fireEvent.click(screen.getByRole('button', { name: 'Fecha de envío' }))
    expect(screen.getByRole('dialog', { name: 'Seleccionar fecha' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Mes siguiente' })).toBeEnabled()

    fireEvent.click(screen.getByRole('button', { name: 'Hoy' }))
    const today = new Date()
    const expected = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
    expect(onChange).toHaveBeenCalledWith(expected)
    expect(screen.queryByRole('dialog', { name: 'Seleccionar fecha' })).not.toBeInTheDocument()
  })

  it('can disable future dates for historical filters', () => {
    render(<CalendarPicker value="" onChange={vi.fn()} disableFuture />)

    fireEvent.click(screen.getByRole('button', { name: 'Elegir fecha' }))
    expect(screen.getByRole('button', { name: 'Mes siguiente' })).toBeDisabled()
  })
})
