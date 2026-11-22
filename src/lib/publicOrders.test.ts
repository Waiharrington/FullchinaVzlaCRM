import { describe, expect, it, vi } from 'vitest'

vi.mock('./supabase', () => ({ supabase: null, customerSupabase: null }))

import { caracasTodayStartIso, describeWebOrderError } from './publicOrders'

describe('caracasTodayStartIso', () => {
  it('uses Caracas midnight, not UTC midnight', () => {
    // 02:00 UTC del 22 = 22:00 del 21 en Caracas → el día empezó el 21 a las 04:00 UTC.
    expect(caracasTodayStartIso(new Date('2026-11-22T02:00:00Z'))).toBe('2026-11-21T04:00:00.000Z')
    expect(caracasTodayStartIso(new Date('2026-11-22T05:00:00Z'))).toBe('2026-11-22T04:00:00.000Z')
  })
})

describe('describeWebOrderError', () => {
  it('translates legacy unaccented backend messages', () => {
    expect(describeWebOrderError({ message: 'Ubicacion fuera de las zonas de delivery' })).toMatch(/fuera del área de delivery/)
    expect(describeWebOrderError(new Error('Producto no disponible'))).toMatch(/ya no está disponible/)
  })

  it('explains network failures without losing the order', () => {
    expect(describeWebOrderError(new TypeError('Failed to fetch'))).toMatch(/Revisa tu conexión/)
  })

  it('keeps customer-ready messages from the hardened backend', () => {
    const closed = 'Full China está cerrado en este momento. Revisa el horario e inténtalo cuando abramos.'
    expect(describeWebOrderError({ message: closed })).toBe(closed)
  })

  it('hides unknown technical errors', () => {
    expect(describeWebOrderError({ message: 'permission denied for function fn_create_web_order' })).toBe('No pudimos registrar el pedido. Inténtalo de nuevo en unos segundos.')
  })
})
