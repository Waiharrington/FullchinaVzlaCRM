export function formatUsd(value: number) {
  return `$${Number(value || 0).toLocaleString('es-VE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

export function formatVes(value: number) {
  return `Bs. ${Number(value || 0).toLocaleString('es-VE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

export function usdToVes(usd: number, bcvRate: number | null | undefined) {
  return bcvRate && bcvRate > 0 ? usd * bcvRate : null
}

export function formatRateDate(value: string | null) {
  if (!value) return 'fecha no disponible'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'fecha no disponible'
  return date.toLocaleDateString('es-VE', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

export function dateKeyInTimeZone(date: Date = new Date(), timeZone = 'America/Caracas') {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date)
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]))
  return `${values.year}-${values.month}-${values.day}`
}

/** Rango de instantes para un día calendario en la zona horaria indicada. */
export function dayRangeInTimeZone(date: Date = new Date(), timeZone = 'America/Caracas') {
  const startDate = dateKeyInTimeZone(date, timeZone)
  const [year, month, day] = startDate.split('-').map(Number)
  const next = new Date(Date.UTC(year, month - 1, day + 1))
  const endDate = next.toISOString().slice(0, 10)
  // Venezuela mantiene UTC-4; el offset explícito evita que PostgreSQL
  // interprete la fecha como UTC y desplace las órdenes al día anterior.
  return {
    start: `${startDate}T00:00:00-04:00`,
    end: `${endDate}T00:00:00-04:00`,
  }
}
