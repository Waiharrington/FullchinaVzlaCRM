import { DEFAULT_PUBLIC_ORDER_PAGE_SETTINGS, type PublicOrderPageSettings } from './publicOrderPageSettings'
import { formatPublicOrderDays, getPublicOrderDayCodes } from './publicOrderSchedule'
import { PUBLIC_ORDER_LAST_CALL_MINUTES } from './publicOrderRules'

export const STORE_TIME_ZONE = 'America/Caracas'

export function formatStoreTime(value: string) {
  const [hour = '0', minute = '00'] = value.split(':')
  const numericHour = Number(hour)
  const suffix = numericHour < 12 ? 'a. m.' : 'p. m.'
  const displayHour = numericHour % 12 || 12
  return `${displayHour}:${minute} ${suffix}`
}

export function formatStoreSchedule(settings: PublicOrderPageSettings) {
  return `${formatPublicOrderDays(settings.contactDays)} · ${formatStoreTime(settings.contactOpenTime)}–${formatStoreTime(settings.contactCloseTime)}`
}

export function getStoreClock(settings: PublicOrderPageSettings = DEFAULT_PUBLIC_ORDER_PAGE_SETTINGS) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: STORE_TIME_ZONE,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
    weekday: 'short',
  }).formatToParts(new Date())
  const hour = Number(parts.find(part => part.type === 'hour')?.value ?? 0)
  const minute = Number(parts.find(part => part.type === 'minute')?.value ?? 0)
  const weekday = parts.find(part => part.type === 'weekday')?.value ?? ''
  const [openHour = '0', openMinute = '0'] = settings.contactOpenTime.split(':')
  const [closeHour = '0', closeMinute = '0'] = settings.contactCloseTime.split(':')
  const now = hour * 60 + minute
  const opens = Number(openHour) * 60 + Number(openMinute)
  const closes = Number(closeHour) * 60 + Number(closeMinute)
  const openDay = getPublicOrderDayCodes(settings.contactDays).includes(weekday)
  const previewClosed = import.meta.env.DEV
    && new URLSearchParams(window.location.search).get('previewStoreClosed') === '1'
  const isOpen = !previewClosed && openDay && now >= opens && now < closes
  // Último pedido: se corta unos minutos antes del cierre (solo en el cliente).
  const acceptingOrders = isOpen && now < closes - PUBLIC_ORDER_LAST_CALL_MINUTES
  return { isOpen, acceptingOrders, nowMinutes: now }
}
