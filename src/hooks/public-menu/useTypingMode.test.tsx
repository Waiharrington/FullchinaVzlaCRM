import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useTypingMode } from './useTypingMode'

function Panel() {
  const { typing, typingHandlers } = useTypingMode()
  return <aside data-testid="panel" className={typing ? 'is-typing' : ''} {...typingHandlers}><input aria-label="Referencia" /><input type="checkbox" aria-label="Aceptar" /></aside>
}

const pointer = (coarse: boolean) => vi.stubGlobal('matchMedia', () => ({ matches: coarse }))

describe('useTypingMode', () => {
  afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals() })

  it('activa el modo escritura en táctil y lo quita poco después de salir del campo', () => {
    vi.useFakeTimers()
    pointer(true)
    render(<Panel />)
    const field = screen.getByLabelText('Referencia')

    fireEvent.focus(field)
    expect(screen.getByTestId('panel')).toHaveClass('is-typing')

    fireEvent.blur(field)
    expect(screen.getByTestId('panel')).toHaveClass('is-typing')
    act(() => { vi.advanceTimersByTime(300) })
    expect(screen.getByTestId('panel')).not.toHaveClass('is-typing')
  })

  it('restaura el panel si el teclado se cierra sin salir del campo', () => {
    pointer(true)
    const viewport = Object.assign(new EventTarget(), { height: 800, offsetTop: 0 })
    vi.stubGlobal('visualViewport', viewport)
    render(<Panel />)
    const field = screen.getByLabelText('Referencia')
    fireEvent.focus(field)
    const resize = (height: number) => act(() => { viewport.height = height; viewport.dispatchEvent(new Event('resize')) })

    resize(450)
    expect(screen.getByTestId('panel')).toHaveClass('is-typing')
    resize(800)
    expect(screen.getByTestId('panel')).not.toHaveClass('is-typing')
    fireEvent.click(field)
    expect(screen.getByTestId('panel')).toHaveClass('is-typing')
  })

  it('ignora casillas y computadoras', () => {
    pointer(true)
    const view = render(<Panel />)
    fireEvent.focus(screen.getByLabelText('Aceptar'))
    expect(screen.getByTestId('panel')).not.toHaveClass('is-typing')
    view.unmount()

    pointer(false)
    render(<Panel />)
    fireEvent.focus(screen.getByLabelText('Referencia'))
    expect(screen.getByTestId('panel')).not.toHaveClass('is-typing')
  })
})
