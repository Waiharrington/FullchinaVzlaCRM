import { getOrdersWithItems } from '../../lib/dataService'
import { getPendingWebOrders } from '../../lib/publicOrders'
import { dateKeyInTimeZone, dayRangeInTimeZone } from '../../lib/money'
import { onSessionReset } from '../../lib/supabase'
import { withTimeout } from '../../lib/withTimeout'
import type { ComandaOrder } from './model'

export type BoardDay = 'today' | 'yesterday'

const LOAD_TIMEOUT_MS = 20_000
/** Último tablero mostrado por día, para pintarlo al instante al volver a Comandas. */
const snapshots = new Map<string, ComandaOrder[]>()
onSessionReset(() => snapshots.clear())

function boardDate(day: BoardDay) {
  return day === 'yesterday' ? new Date(Date.now() - 24 * 60 * 60 * 1000) : new Date()
}

export function boardKey(day: BoardDay) {
  return dateKeyInTimeZone(boardDate(day))
}

export function readBoardSnapshot(day: BoardDay) {
  return snapshots.get(boardKey(day))
}

export function saveBoardSnapshot(key: string, orders: ComandaOrder[]) {
  snapshots.set(key, orders)
}

export function clearBoardSnapshots() {
  snapshots.clear()
}

/** Comandas del día y, si es hoy, los pedidos web sin confirmar. */
export function fetchBoardOrders(day: BoardDay) {
  // El "día" del negocio se calcula en horario de Venezuela (UTC-4), no en UTC:
  // de lo contrario las comandas creadas después de las 8pm local caen en el día
  // UTC siguiente y desaparecen del tablero.
  const { start, end } = dayRangeInTimeZone(boardDate(day))
  return withTimeout(Promise.all([
    getOrdersWithItems(start, end),
    day === 'today' ? getPendingWebOrders() : Promise.resolve([]),
  ]), LOAD_TIMEOUT_MS)
}
