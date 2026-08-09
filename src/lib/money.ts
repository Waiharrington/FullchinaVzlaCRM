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
