import { act, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { SplashScreen } from './SplashScreen'

describe('SplashScreen', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('stays fully visible until the application is ready', () => {
    vi.useFakeTimers()
    const onDone = vi.fn()
    const { rerender } = render(<SplashScreen onDone={onDone} minDuration={100} ready={false} />)

    act(() => vi.advanceTimersByTime(1000))

    const splash = screen.getByRole('status', { name: 'Cargando Full China' })
    expect(splash).not.toHaveClass('splash-exit')
    expect(screen.getByRole('img', { name: 'Full China' })).toBeInTheDocument()
    expect(onDone).not.toHaveBeenCalled()

    rerender(<SplashScreen onDone={onDone} minDuration={100} ready />)
    expect(splash).toHaveClass('splash-exit')

    act(() => vi.advanceTimersByTime(399))
    expect(onDone).not.toHaveBeenCalled()

    act(() => vi.advanceTimersByTime(1))
    expect(onDone).toHaveBeenCalledOnce()
  })

  it('waits for the minimum duration even when the application is already ready', () => {
    vi.useFakeTimers()
    const onDone = vi.fn()
    render(<SplashScreen onDone={onDone} minDuration={100} ready />)

    const splash = screen.getByRole('status', { name: 'Cargando Full China' })
    act(() => vi.advanceTimersByTime(99))
    expect(splash).not.toHaveClass('splash-exit')

    act(() => vi.advanceTimersByTime(1))
    expect(splash).toHaveClass('splash-exit')
  })
})
