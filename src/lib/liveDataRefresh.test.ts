import { act, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { MODULE_TABLES, moduleUsesTable, useLiveDataRefresh } from './liveDataRefresh'
import { publishDataChange } from './supabase'

afterEach(() => vi.useRealTimers())

describe('module change subscriptions', () => {
  it('has scoped table dependencies for every administrative module and alias', () => {
    const expectedModules = [
      'dashboard', 'caja', 'caja-operativa', 'comandas', 'mesas', 'cocina', 'clientes',
      'proveedores', 'almacen', 'inventario', 'produccion', 'recetas', 'menu', 'menu-semanal',
      'compras', 'gastos', 'finanzas', 'equipo', 'fidelizacion', 'marketing', 'nomina',
      'creditos', 'auditoria', 'mas', 'promociones', 'reportes', 'delivery-settings',
    ]
    expect(Object.keys(MODULE_TABLES).sort()).toEqual(expectedModules.sort())
    expect(Object.values(MODULE_TABLES).every(tables => tables.length > 0)).toBe(true)
  })

  it('refreshes a matching module but ignores unrelated data changes', () => {
    expect(moduleUsesTable('cocina', 'orders')).toBe(true)
    expect(moduleUsesTable('cocina', 'expenses')).toBe(false)
    expect(moduleUsesTable('reportes', 'payroll_payments')).toBe(true)
    expect(moduleUsesTable('unknown-future-module', 'any_table')).toBe(true)
  })

  it('debounces related changes and refreshes only the mounted module', () => {
    vi.useFakeTimers()
    const refresh = vi.fn()
    renderHook(() => useLiveDataRefresh('cocina', refresh))

    act(() => {
      publishDataChange('expenses')
      publishDataChange('orders')
    })
    act(() => { vi.advanceTimersByTime(179) })
    expect(refresh).not.toHaveBeenCalled()
    act(() => { vi.advanceTimersByTime(1) })
    expect(refresh).toHaveBeenCalledTimes(1)
  })

  it('does not refresh a hidden tab and unsubscribes when the module unmounts', () => {
    vi.useFakeTimers()
    const originalVisibility = Object.getOwnPropertyDescriptor(document, 'visibilityState')
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' })
    const refresh = vi.fn()
    const { unmount } = renderHook(() => useLiveDataRefresh('cocina', refresh))

    act(() => { publishDataChange('orders') })
    act(() => { vi.advanceTimersByTime(200) })
    expect(refresh).not.toHaveBeenCalled()
    unmount()
    Object.defineProperty(document, 'visibilityState', originalVisibility ?? { configurable: true, value: 'visible' })

    act(() => { publishDataChange('orders') })
    act(() => { vi.advanceTimersByTime(200) })
    expect(refresh).not.toHaveBeenCalled()
  })
})
