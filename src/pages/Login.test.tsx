import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Login } from './Login'

const { signInWithPin } = vi.hoisted(() => ({ signInWithPin: vi.fn() }))

vi.mock('../context/auth-context', () => ({
  useAuth: () => ({
    signIn: vi.fn(),
    signInWithPin,
  }),
}))

describe('Login con PIN', () => {
  beforeEach(() => {
    signInWithPin.mockReset()
    signInWithPin.mockResolvedValue({ error: 'PIN incorrecto.' })
    vi.stubGlobal('matchMedia', vi.fn().mockImplementation(() => ({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })))
  })

  it('envía una sola vez y limpia un PIN rechazado', async () => {
    render(<Login />)

    fireEvent.click(screen.getByRole('button', { name: /ingresar con pin/i }))
    const pinInput = screen.getByLabelText(/pin de acceso/i) as HTMLInputElement
    fireEvent.change(pinInput, { target: { value: '0000' } })

    await waitFor(() => expect(screen.getByText('PIN incorrecto.')).toBeInTheDocument())
    expect(pinInput.value).toBe('')
    expect(signInWithPin).toHaveBeenCalledTimes(1)

    await new Promise((resolve) => setTimeout(resolve, 50))
    expect(signInWithPin).toHaveBeenCalledTimes(1)
  })
})
