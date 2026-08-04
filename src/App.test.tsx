import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import App from './App'

describe('App', () => {
  it('renders the dashboard in demo mode', () => {
    render(<App />)
    expect(screen.getByRole('heading', { name: /dashboard crm/i })).toBeDefined()
    expect(screen.getByText(/modo demo activo/i)).toBeDefined()
  })
})
