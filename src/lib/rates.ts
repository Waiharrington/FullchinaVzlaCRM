// Cotización oficial Bs/USD publicada por DolarAPI a partir de datos BCV.
// El valor se comparte, se valida y se conserva localmente para poder mostrar
// la última referencia conocida durante una caída temporal del proveedor.

export interface Rates {
  bcv: number
  nextBcvRate?: number | null
  nextBcvUpdatedAt?: string | null
  paralelo: number
  updatedAt: string | null
  fetchedAt: string
  stale: boolean
  error?: boolean
}

interface DolarApiEntry {
  fuente: string
  promedio: number
  fechaActualizacion: string
}

const OFFICIAL_URL = 'https://ve.dolarapi.com/v1/dolares/oficial'
const ALL_RATES_URL = 'https://ve.dolarapi.com/v1/dolares'
const BCV_EFFECTIVE_RATE_URL = 'https://bcv.today/api/v1/history'
const CACHE_KEY = 'fullchina_bcv_rates_v3'
const FRESH_CACHE_MS = 30 * 60 * 1000
const REQUEST_TIMEOUT_MS = 8_000

let memoryCache: Rates | null = null
let pendingRequest: Promise<Rates> | null = null

function isValidRate(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 && value < 1_000_000
}

interface BcvEffectiveRateEntry {
  USD: number
  effective_date: string
}

function addCalendarDays(date: string, days: number): string {
  const next = new Date(`${date}T00:00:00Z`)
  next.setUTCDate(next.getUTCDate() + days)
  return next.toISOString().slice(0, 10)
}

function isCaracasWeekend(now = new Date()): boolean {
  const weekday = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Caracas', weekday: 'short' }).format(now)
  return weekday === 'Sat' || weekday === 'Sun'
}

function caracasDateKey(now = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Caracas', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(now)
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]))
  return `${values.year}-${values.month}-${values.day}`
}

async function getNextAvailableRate(lastPublishedDate: string): Promise<BcvEffectiveRateEntry | null> {
  // El BCV no siempre publica una tasa con fecha efectiva de lunes. Consultamos
  // los próximos días y elegimos la primera tasa realmente publicada después
  // de la última, sin confundir los registros del fin de semana con una tasa nueva.
  const candidates = await Promise.all(Array.from({ length: 7 }, async (_, index) => {
    const requestedDate = addCalendarDays(lastPublishedDate, index + 1)
    try {
      const entry = await fetchJson<BcvEffectiveRateEntry>(`${BCV_EFFECTIVE_RATE_URL}/${requestedDate}.json`)
      if (!isValidRate(entry.USD) || entry.effective_date <= lastPublishedDate) return null
      return entry
    } catch {
      return null
    }
  }))
  return candidates.find((entry): entry is BcvEffectiveRateEntry => entry !== null) ?? null
}

function readCache(): Rates | null {
  if (memoryCache) return memoryCache
  if (typeof localStorage === 'undefined') return null
  try {
    const parsed = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null') as Rates | null
    if (!parsed || !isValidRate(parsed.bcv) || !parsed.fetchedAt) return null
    memoryCache = parsed
    return parsed
  } catch {
    return null
  }
}

function saveCache(rates: Rates) {
  memoryCache = rates
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(rates))
  } catch {
    // El almacenamiento local es una optimización; la tasa de red sigue válida.
  }
}

async function fetchJson<T>(url: string): Promise<T> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    })
    if (!response.ok) throw new Error(`Rates HTTP ${response.status}`)
    return await response.json() as T
  } finally {
    clearTimeout(timeout)
  }
}

async function requestRates(): Promise<Rates> {
  let official: DolarApiEntry | undefined
  let paralelo: DolarApiEntry | undefined

  try {
    official = await fetchJson<DolarApiEntry>(OFFICIAL_URL)
  } catch {
    const entries = await fetchJson<DolarApiEntry[]>(ALL_RATES_URL)
    official = entries.find(entry => entry.fuente === 'oficial')
    paralelo = entries.find(entry => entry.fuente === 'paralelo')
  }

  if (!official || official.fuente !== 'oficial' || !isValidRate(official.promedio)) {
    throw new Error('Invalid BCV rate response')
  }

  const latestPublishedDate = official.fechaActualizacion?.slice(0, 10)
  const nextAvailableRate = latestPublishedDate && /^\d{4}-\d{2}-\d{2}$/.test(latestPublishedDate)
    ? await getNextAvailableRate(latestPublishedDate)
    : null

  const nextRateIsCurrent = Boolean(nextAvailableRate && nextAvailableRate.effective_date <= caracasDateKey())
  const rateForCurrentUse = nextAvailableRate && (isCaracasWeekend() || nextRateIsCurrent) ? nextAvailableRate : null
  const rates: Rates = {
    bcv: rateForCurrentUse?.USD ?? official.promedio,
    nextBcvRate: nextAvailableRate?.USD ?? null,
    nextBcvUpdatedAt: nextAvailableRate ? `${nextAvailableRate.effective_date}T00:00:00-04:00` : null,
    paralelo: isValidRate(paralelo?.promedio) ? paralelo.promedio : 0,
    updatedAt: rateForCurrentUse
      ? `${rateForCurrentUse.effective_date}T00:00:00-04:00`
      : official.fechaActualizacion || null,
    fetchedAt: new Date().toISOString(),
    stale: false,
  }
  saveCache(rates)
  return rates
}

export async function getExchangeRates(options: { force?: boolean } = {}): Promise<Rates> {
  const cached = readCache()
  const cacheAge = cached ? Date.now() - new Date(cached.fetchedAt).getTime() : Number.POSITIVE_INFINITY
  if (!options.force && cached && cacheAge < FRESH_CACHE_MS) return { ...cached, stale: false, error: false }
  if (!options.force && pendingRequest) return pendingRequest

  pendingRequest = requestRates().catch((error) => {
    console.error('Error fetching BCV exchange rate:', error)
    if (cached) return { ...cached, stale: true, error: true }
    return {
      bcv: 0,
      paralelo: 0,
      updatedAt: null,
      fetchedAt: new Date().toISOString(),
      stale: true,
      error: true,
    }
  }).finally(() => {
    pendingRequest = null
  })

  return pendingRequest
}
