import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { DashboardQuickAccess, type DashboardShortcut } from './DashboardQuickAccess'

vi.mock('../pages/Comandas', () => ({ Comandas: () => <div>Vista de comandas</div> }))
vi.mock('../pages/Caja', () => ({ Caja: ({ embedded }: { embedded?: boolean }) => <div>Vista de ventas {embedded ? 'integrada' : ''}</div> }))
vi.mock('../pages/Menu', () => ({ Menu: () => <div>Vista de menú</div> }))
vi.mock('../pages/Mesas', () => ({ Mesas: () => <div>Vista de mesas</div> }))
vi.mock('../pages/Inventario', () => ({ Inventario: () => <div>Vista de inventario</div> }))
vi.mock('../pages/Clientes', () => ({ Clientes: () => <div>Vista de clientes</div> }))

const shortcutCases: Array<[DashboardShortcut, string, string]> = [
  ['comandas', 'Comandas', 'Vista de comandas'],
  ['ventas', 'Ventas', 'Vista de ventas integrada'],
  ['menu', 'Menú', 'Vista de menú'],
  ['mesas', 'Mesas', 'Vista de mesas'],
  ['inventario', 'Inventario', 'Vista de inventario'],
  ['clientes', 'Clientes', 'Vista de clientes'],
]

describe('DashboardQuickAccess', () => {
  afterEach(() => {
    document.body.style.overflow = ''
  })

  it.each(shortcutCases)('muestra %s dentro de un diálogo superpuesto', async (shortcut, title, view) => {
    const onClose = vi.fn()
    render(<DashboardQuickAccess shortcut={shortcut} onClose={onClose} />)

    expect(await screen.findByText(view)).toBeInTheDocument()
    expect(screen.getByRole('dialog', { name: title })).toBeInTheDocument()
    expect(document.body.style.overflow).toBe('hidden')

    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledOnce()
  })
})
