import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { SendSlider } from './wow'

afterEach(cleanup)

function setup() {
  const onSend = vi.fn()
  render(<SendSlider submitting={false} onSend={onSend} />)
  const button = screen.getByRole('button', { name: 'Enviar pedido' })
  Object.defineProperty(button, 'clientWidth', { value: 356 })
  const drag = (distance: number) => {
    // jsdom no implementa PointerEvent: se envía un MouseEvent con el mismo nombre.
    for (const [type, x] of [['pointerdown', 20], ['pointermove', 20 + distance], ['pointerup', 20 + distance]] as const) {
      fireEvent(button, new MouseEvent(type, { bubbles: true, clientX: x }))
    }
  }
  return { button, drag, onSend }
}

describe('SendSlider', () => {
  it('envía una vez al tocarlo', () => {
    const { button, onSend } = setup()
    fireEvent.click(button)
    expect(onSend).toHaveBeenCalledTimes(1)
  })

  it('envía una sola vez al deslizar hasta el final', () => {
    const { button, drag, onSend } = setup()
    drag(280)
    fireEvent.click(button)
    expect(onSend).toHaveBeenCalledTimes(1)
  })

  it('no envía si el deslizamiento se queda corto', () => {
    const { button, drag, onSend } = setup()
    drag(80)
    fireEvent.click(button)
    expect(onSend).not.toHaveBeenCalled()
  })
})
