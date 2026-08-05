// Tasa de cambio Bs/USD desde ve.dolarapi.com (mismo patrón que AstroBarber).
// API pública, sin key. `fuente: 'oficial'` = BCV, `fuente: 'paralelo'` = paralelo.

export interface Rates {
  bcv: number
  paralelo: number
  updatedAt: string | null
  error?: boolean
}

interface DolarApiEntry {
  fuente: string
  promedio: number
  fechaActualizacion: string
}

export async function getExchangeRates(): Promise<Rates> {
  try {
    const res = await fetch('https://ve.dolarapi.com/v1/dolares')
    if (!res.ok) throw new Error('Rates not available')
    const data = (await res.json()) as DolarApiEntry[]

    const oficial = data.find((r) => r.fuente === 'oficial')
    const paralelo = data.find((r) => r.fuente === 'paralelo')

    return {
      bcv: oficial?.promedio ?? 0,
      paralelo: paralelo?.promedio ?? 0,
      updatedAt: oficial?.fechaActualizacion ?? null,
    }
  } catch (error) {
    console.error('Error fetching exchange rates:', error)
    return { bcv: 0, paralelo: 0, updatedAt: null, error: true }
  }
}
