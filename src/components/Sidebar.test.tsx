import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { AuthContext } from '../context/auth-context'
import { Sidebar } from './Sidebar'

const authValue = {
  session: null,
  user: { id: 'owner-1', email: 'owner@fullchina.test', role: 'owner' as const, allowedModules: null },
  loading: false,
  splashDone: true,
  setSplashDone: vi.fn(),
  signIn: vi.fn(async () => ({})),
  signInWithPin: vi.fn(async () => ({})),
  signOut: vi.fn(async () => undefined),
}

function LocationProbe() {
  const location = useLocation()
  return <output data-testid="location">{location.pathname}</output>
}

function renderSidebar(path = '/') {
  return render(
    <AuthContext.Provider value={authValue}>
      <MemoryRouter initialEntries={[path]}>
        <Sidebar collapsed={false} onToggle={vi.fn()} />
        <LocationProbe />
      </MemoryRouter>
    </AuthContext.Provider>
  )
}

describe('Sidebar', () => {
  it('despliega cualquier grupo sin redirigir al pulsar su encabezado', () => {
    renderSidebar()

    const finances = screen.getByRole('button', { name: /finanzas/i })
    expect(finances).toHaveAttribute('aria-expanded', 'false')

    fireEvent.click(finances)

    expect(finances).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByRole('link', { name: /^finanzas$/i })).toBeInTheDocument()
    expect(screen.getByTestId('location')).toHaveTextContent('/')
  })

  it('abre automáticamente el grupo de la ruta activa', () => {
    renderSidebar('/gastos')

    expect(screen.getByRole('button', { name: /finanzas/i })).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByRole('link', { name: /gastos/i })).toHaveClass('active')
  })
})
