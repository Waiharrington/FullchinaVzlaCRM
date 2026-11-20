const WEEKDAYS = [
  { code: 'Mon', name: 'Lunes', short: 'Lun' },
  { code: 'Tue', name: 'Martes', short: 'Mar' },
  { code: 'Wed', name: 'Miércoles', short: 'Mié' },
  { code: 'Thu', name: 'Jueves', short: 'Jue' },
  { code: 'Fri', name: 'Viernes', short: 'Vie' },
  { code: 'Sat', name: 'Sábado', short: 'Sáb' },
  { code: 'Sun', name: 'Domingo', short: 'Dom' },
] as const

export const PUBLIC_ORDER_WEEKDAYS = WEEKDAYS

const LEGACY_DAY_SETS: Record<string, string[]> = {
  'martes a domingo': ['Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
  'lunes a domingo': ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
  'lunes a sabado': ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
  'lunes a viernes': ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
}

function normalizeDayName(value: string) {
  return value.trim().toLocaleLowerCase('es').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

export function getPublicOrderDayCodes(value: string) {
  const normalized = normalizeDayName(value)
  const legacyDays = LEGACY_DAY_SETS[normalized]
  if (legacyDays) return legacyDays

  const codeByName = new Map<string, string>()
  for (const day of WEEKDAYS) {
    codeByName.set(normalizeDayName(day.name), day.code)
    codeByName.set(normalizeDayName(day.short), day.code)
  }
  const codes = new Set(value.split(/[,·|]/).map(normalizeDayName).map(day => codeByName.get(day)).filter((day): day is string => Boolean(day)))
  return WEEKDAYS.filter(day => codes.has(day.code)).map(day => day.code)
}

export function serializePublicOrderDays(codes: string[]) {
  const selected = new Set(codes)
  return WEEKDAYS.filter(day => selected.has(day.code)).map(day => day.name).join(', ')
}

export function formatPublicOrderDays(value: string) {
  const codes = getPublicOrderDayCodes(value)
  const selected = new Set(codes)
  const equals = (days: string[]) => days.length === codes.length && days.every(day => selected.has(day))
  if (equals(['Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'])) return 'Mar a dom'
  if (equals(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'])) return 'Lun a dom'
  if (equals(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'])) return 'Lun a sáb'
  if (equals(['Mon', 'Tue', 'Wed', 'Thu', 'Fri'])) return 'Lun a vie'
  return WEEKDAYS.filter(day => selected.has(day.code)).map(day => day.short).join(', ')
}
