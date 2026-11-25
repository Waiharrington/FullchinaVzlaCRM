import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { AppErrorBoundary } from './AppErrorBoundary'

function Boom(): never { throw new Error('fallo de prueba') }

describe('AppErrorBoundary', () => {
  it('muestra el contenido cuando no hay error', () => {
    render(<AppErrorBoundary><p>hola</p></AppErrorBoundary>)
    expect(screen.getByText('hola')).toBeTruthy()
  })

  it('muestra un aviso con botón de recarga cuando un hijo falla', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    render(<AppErrorBoundary><Boom /></AppErrorBoundary>)
    expect(screen.getByRole('alert')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Recargar' })).toBeTruthy()
    spy.mockRestore()
  })
})
