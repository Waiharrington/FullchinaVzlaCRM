import { beforeEach, describe, expect, it, vi } from 'vitest'

const officialResponse = {
  fuente: 'oficial',
  nombre: 'Dólar Oficial',
  compra: null,
  venta: null,
  promedio: 756.7083,
  fechaActualizacion: '2026-08-07T00:00:00-04:00',
}

describe('getExchangeRates', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.restoreAllMocks()
    vi.resetModules()
  })

  it('acepta y conserva una respuesta oficial válida', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => officialResponse,
    }))

    const { getExchangeRates } = await import('./rates')
    const rates = await getExchangeRates({ force: true })

    expect(rates.bcv).toBe(756.7083)
    expect(rates.updatedAt).toBe(officialResponse.fechaActualizacion)
    expect(rates.stale).toBe(false)
  })

  it('usa la última tasa guardada y la marca como desactualizada si falla la red', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => officialResponse,
    }))

    const { getExchangeRates } = await import('./rates')
    await getExchangeRates({ force: true })

    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('sin conexión')))
    const cached = await getExchangeRates({ force: true })

    expect(cached.bcv).toBe(756.7083)
    expect(cached.stale).toBe(true)
    expect(cached.error).toBe(true)
  })
})
