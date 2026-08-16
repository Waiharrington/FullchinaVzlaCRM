import { useState } from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { SearchSelect, type SearchSelectOption } from './SearchSelect'

const OPTIONS: SearchSelectOption[] = [
  { value: '1', label: 'Aceite (L)' },
  { value: '2', label: 'Arroz (kg)' },
  { value: '3', label: 'Cebollín (kg)' },
  { value: '4', label: 'Pollo (kg)' },
]

function Harness() {
  const [value, setValue] = useState('')
  return (
    <div>
      <SearchSelect options={OPTIONS} value={value} onChange={setValue} placeholder="Buscar ingrediente..." />
      <span data-testid="selected">{value}</span>
    </div>
  )
}

describe('SearchSelect', () => {
  it('filtra al escribir y selecciona una opción', () => {
    render(<Harness />)
    const input = screen.getByRole('combobox')

    // Al enfocar se abre la lista con todas las opciones
    fireEvent.focus(input)
    expect(screen.getByText('Aceite (L)')).toBeInTheDocument()
    expect(screen.getByText('Pollo (kg)')).toBeInTheDocument()

    // Escribir filtra
    fireEvent.change(input, { target: { value: 'arr' } })
    expect(screen.getByText('Arroz (kg)')).toBeInTheDocument()
    expect(screen.queryByText('Pollo (kg)')).not.toBeInTheDocument()

    // Seleccionar dispara onChange con el value correcto
    fireEvent.mouseDown(screen.getByText('Arroz (kg)'))
    expect(screen.getByTestId('selected').textContent).toBe('2')
  })

  it('muestra el texto vacío cuando no hay coincidencias', () => {
    render(<Harness />)
    const input = screen.getByRole('combobox')
    fireEvent.focus(input)
    fireEvent.change(input, { target: { value: 'zzz' } })
    expect(screen.getByText('Sin resultados')).toBeInTheDocument()
  })
})
