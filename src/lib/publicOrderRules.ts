import type { ProductModifierGroup } from './dataService'
import { normalizeForSearch } from './textFormat'

export type PublicModifierSelection = Record<string, number>

export const PUBLIC_ORDER_MAX_UNITS_PER_PRESENTATION = 30
export const PUBLIC_ORDER_MAX_DISTINCT_LINES = 40

export type PublicCartLimitViolation = 'presentation-quantity' | 'distinct-lines'

/** Shared limits for cart additions, edits, and restored orders. */
export function getPublicCartLimitViolation(items: readonly { productId: string; quantity: number }[]): PublicCartLimitViolation | null {
  if (items.length > PUBLIC_ORDER_MAX_DISTINCT_LINES) return 'distinct-lines'
  const quantitiesByProduct = new Map<string, number>()
  for (const item of items) quantitiesByProduct.set(item.productId, (quantitiesByProduct.get(item.productId) ?? 0) + item.quantity)
  return [...quantitiesByProduct.values()].some(quantity => quantity > PUBLIC_ORDER_MAX_UNITS_PER_PRESENTATION)
    ? 'presentation-quantity'
    : null
}

/** Fixed included-protein recipes start with one serving of each protein. */
export function isIncludedProteinGroup(group: ProductModifierGroup): boolean {
  const totalIncluded = group.maxSelections
  return normalizeForSearch(group.name).startsWith('proteinas incluidas')
    && totalIncluded !== null
    && totalIncluded > 0
    && (group.minSelections === totalIncluded || group.minSelections === 0)
    && group.allowRepeat
    && group.options.length === totalIncluded
}

export function getDefaultModifierSelection(groups: ProductModifierGroup[]): PublicModifierSelection {
  const selection: PublicModifierSelection = {}
  for (const group of groups) {
    if (!isIncludedProteinGroup(group)) continue
    group.options.forEach(option => { selection[option.id] = 1 })
  }
  return selection
}

export function countModifierSelections(group: ProductModifierGroup, selection: PublicModifierSelection): number {
  return group.options.reduce((total, option) => total + (selection[option.id] ?? 0), 0)
}

export function getModifierSelectionError(
  groups: ProductModifierGroup[],
  selection: PublicModifierSelection,
): ProductModifierGroup | null {
  const knownOptionIds = new Set(groups.flatMap(group => group.options.map(option => option.id)))
  if (Object.entries(selection).some(([id, quantity]) => !knownOptionIds.has(id) || !Number.isInteger(quantity) || quantity < 1 || quantity > 30)) {
    return null
  }
  return groups.find(group => {
    const count = countModifierSelections(group, selection)
    const repeatedOption = !group.allowRepeat && group.options.some(option => (selection[option.id] ?? 0) > 1)
    return repeatedOption || count < group.minSelections || (group.maxSelections !== null && count > group.maxSelections)
  }) ?? null
}

export function hasInvalidModifierSelection(groups: ProductModifierGroup[], selection: PublicModifierSelection): boolean {
  const knownOptionIds = new Set(groups.flatMap(group => group.options.map(option => option.id)))
  return Object.entries(selection).some(([id, quantity]) => !knownOptionIds.has(id) || !Number.isInteger(quantity) || quantity < 1 || quantity > 30)
}

export function calculateModifierTotal(groups: ProductModifierGroup[], selection: PublicModifierSelection): number {
  return groups.reduce((total, group) => total + group.options.reduce(
    (groupTotal, option) => groupTotal + option.price * (selection[option.id] ?? 0), 0,
  ), 0)
}

export function appendRequiredOrderMetadata(primaryNotes: string, requiredMetadata: string, limit = 500): string {
  if (requiredMetadata.length >= limit) return requiredMetadata.slice(-limit)
  const separator = primaryNotes && requiredMetadata ? ' · ' : ''
  const available = Math.max(0, limit - requiredMetadata.length - separator.length)
  return `${primaryNotes.slice(0, available)}${separator}${requiredMetadata}`
}

/** Último pedido: se dejan de aceptar pedidos web este tiempo antes del cierre (solo cliente). */
export const PUBLIC_ORDER_LAST_CALL_MINUTES = 15

/**
 * Teléfono venezolano móvil: acepta `+58 4xx…`, `58 4xx…` o `04xx…` y devuelve
 * siempre `04xxxxxxxxx` (11 dígitos). Devuelve null si no es válido.
 */
export function normalizeVenezuelanPhone(raw: string): string | null {
  let digits = raw.replace(/\D/g, '')
  if (digits.startsWith('58') && digits.length >= 12) digits = digits.slice(2)
  if (digits.length === 10 && digits.startsWith('4')) digits = `0${digits}`
  return /^04\d{9}$/.test(digits) ? digits : null
}

/**
 * Cédula (V/E, 6–8 dígitos) o RIF jurídico (J, 8 dígitos + verificador = 9).
 * Misma regla que fn_create_web_order en el servidor.
 */
export function isValidPublicIdentification(raw: string): boolean {
  const value = raw.trim()
  return /^(?:[VE]-?)?\d{6,8}$/i.test(value) || /^J-?\d{9}$/i.test(value)
}

export function maxIdentificationDigits(prefix: 'V' | 'E' | 'J'): number {
  return prefix === 'J' ? 9 : 8
}

/** Pedido mínimo en USD (subtotal de productos, sin delivery). Igual en el servidor. */
export const PUBLIC_ORDER_MIN_SUBTOTAL = 1

/** Minutos mínimos de preparación antes de la primera hora de retiro elegible. */
export const PUBLIC_PICKUP_PREP_MINUTES = 20
const PUBLIC_PICKUP_SLOT_MINUTES = 15

function minutesToClock(total: number) {
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
}

/**
 * Horas de retiro elegibles hoy (HH:MM, cada 15 min) dentro del horario:
 * desde ahora + preparación (o la apertura, si aún no abre) hasta el último
 * pedido antes del cierre. Lista vacía si ya no quedan horas.
 */
export function getPublicPickupSlots(nowMinutes: number, openTime: string, closeTime: string): string[] {
  const toMinutes = (value: string) => {
    const [hour = '0', minute = '0'] = value.split(':')
    return Number(hour) * 60 + Number(minute)
  }
  const opens = toMinutes(openTime)
  const lastSlot = toMinutes(closeTime) - PUBLIC_ORDER_LAST_CALL_MINUTES
  const earliest = Math.max(opens, nowMinutes + PUBLIC_PICKUP_PREP_MINUTES)
  const first = Math.ceil(earliest / PUBLIC_PICKUP_SLOT_MINUTES) * PUBLIC_PICKUP_SLOT_MINUTES
  const slots: string[] = []
  for (let minute = first; minute <= lastSlot; minute += PUBLIC_PICKUP_SLOT_MINUTES) slots.push(minutesToClock(minute))
  return slots
}

/** "19:30" → "7:30 p. m." */
export function formatPickupClock(value: string): string {
  const [hour = '0', minute = '00'] = value.split(':')
  const numericHour = Number(hour)
  return `${numericHour % 12 || 12}:${minute} ${numericHour < 12 ? 'a. m.' : 'p. m.'}`
}

export function describePickupTime(value: string): string {
  return value === 'asap' ? 'Lo antes posible' : formatPickupClock(value)
}
