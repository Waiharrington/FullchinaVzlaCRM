// Cotización oficial Bs/USD publicada por DolarAPI a partir de datos BCV.
// El valor se comparte, se valida y se conserva localmente para poder mostrar
// la última referencia conocida durante una caída temporal del proveedor.

export interface Rates {
  bcv: number
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
const CACHE_KEY = 'fullchina_bcv_rates_v2'
const FRESH_CACHE_MS = 30 * 60 * 1000
const REQUEST_TIMEOUT_MS = 8_000
const CARACAS_TIME_ZONE = 'America/Caracas'

let memoryCache: Rates | null = null
let pendingRequest: Promise<Rates> | null = null

function isValidRate(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 && value < 1_000_000
}

interface BcvEffectiveRateEntry {
  USD: number
  effective_date: string
}

function getUpcomingMondayRateDate(now = new Date()): string | null {
  const weekday = new Intl.DateTimeFormat('en-US', {
    timeZone: CARACAS_TIME_ZONE,
    weekday: 'short',
  }).format(now)
  const daysUntilMonday = weekday === 'Sat' ? 2 : weekday === 'Sun' ? 1 : 0
  if (daysUntilMonday === 0) return null

  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: CARACAS_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now)
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]))
  const nextDate = new Date(Date.UTC(Number(values.year), Number(values.month) - 1, Number(values.day) + daysUntilMonday))
  return nextDate.toISOString().slice(0, 10)
}

async function getUpcomingMondayRate(effectiveDate: string): Promise<BcvEffectiveRateEntry | null> {
  try {
    const entry = await fetchJson<BcvEffectiveRateEntry>(`${BCV_EFFECTIVE_RATE_URL}/${effectiveDate}.json`)
    if (!isValidRate(entry.USD) || entry.effective_date !== effectiveDate) return null
    return entry
  } catch {
    // La tasa futura es opcional: si el BCV todavía no la publicó, usamos la última tasa diaria disponible.
    return null
  }
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
  const weekendEffectiveDate = getUpcomingMondayRateDate()
  let official: DolarApiEntry | undefined
  let paralelo: DolarApiEntry | undefined

  try {
    official = await fetchJson<DolarApiEntry>(OFFICIAL_URL)
  } catch {
    const entries = await fetchJson<DolarApiEntry[]>(ALL_RATES_URL)
    official = entries.find(entry => entry.fuente === 'oficial')
    paralelo = entries.find(entry => entry.fuente === 'paralelo')
  }

  const weekendRate = weekendEffectiveDate ? await getUpcomingMondayRate(weekendEffectiveDate) : null

  if (!official || official.fuente !== 'oficial' || !isValidRate(official.promedio)) {
    throw new Error('Invalid BCV rate response')
  }

  const rates: Rates = {
    bcv: weekendRate?.USD ?? official.promedio,
    paralelo: isValidRate(paralelo?.promedio) ? paralelo.promedio : 0,
    updatedAt: weekendRate
      ? `${weekendRate.effective_date}T00:00:00-04:00`
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
  const weekendEffectiveDate = getUpcomingMondayRateDate()
  const cacheMatchesWeekendRate = !weekendEffectiveDate || cached?.updatedAt?.slice(0, 10) === weekendEffectiveDate
  if (!options.force && cached && cacheAge < FRESH_CACHE_MS && cacheMatchesWeekendRate) return { ...cached, stale: false, error: false }
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
