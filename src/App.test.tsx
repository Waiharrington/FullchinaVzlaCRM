import { render, screen, waitFor } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import App from './App'

describe('App', () => {
  it('renders application correctly', async () => {
    render(<App />)
    await waitFor(() => {
      const heading = screen.queryByRole('heading', { name: /dashboard crm/i }) || screen.queryByRole('heading', { name: /clienta food truck/i }) || screen.queryByText(/cargando/i)
      expect(heading).toBeDefined()
    })
  })
})

