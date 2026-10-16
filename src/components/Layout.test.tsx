import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useNavigate } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { Layout } from './Layout'

vi.mock('./Sidebar', () => ({ Sidebar: () => null }))
vi.mock('./BottomNav', () => ({ BottomNav: () => null }))
vi.mock('./GlobalSearch', () => ({ GlobalSearch: () => null }))

function GoToNextPage() {
  const navigate = useNavigate()
  return <button onClick={() => navigate('/next')}>Abrir otra página</button>
}

describe('Layout', () => {
  it('reinicia el scroll del contenido al navegar a otra página', () => {
    render(
      <MemoryRouter initialEntries={['/current']}>
        <Routes>
          <Route element={<Layout />}>
            <Route path="/current" element={<p>Página actual</p>} />
            <Route path="/next" element={<p>Página nueva</p>} />
          </Route>
        </Routes>
        <GoToNextPage />
      </MemoryRouter>,
    )

    const main = document.querySelector<HTMLElement>('.app-main')
    expect(main).not.toBeNull()
    if (!main) return
    main.scrollTop = 640

    fireEvent.click(screen.getByRole('button', { name: 'Abrir otra página' }))

    expect(screen.getByText('Página nueva')).toBeInTheDocument()
    expect(main.scrollTop).toBe(0)
    expect(main.scrollLeft).toBe(0)
  })
})
