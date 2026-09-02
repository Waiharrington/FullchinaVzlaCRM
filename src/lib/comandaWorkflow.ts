export const COMANDA_STATUSES = ['new', 'preparing', 'ready', 'delivered'] as const

export type ComandaStatus = (typeof COMANDA_STATUSES)[number]

const NEXT_STATUS: Partial<Record<ComandaStatus, ComandaStatus>> = {
  new: 'preparing',
  preparing: 'ready',
  ready: 'delivered',
}

export function isComandaStatus(value: unknown): value is ComandaStatus {
  return typeof value === 'string' && COMANDA_STATUSES.includes(value as ComandaStatus)
}

export function nextComandaStatus(status: ComandaStatus): ComandaStatus | null {
  return NEXT_STATUS[status] ?? null
}

export function canMoveComandaStatus(from: ComandaStatus, to: ComandaStatus): boolean {
  return NEXT_STATUS[from] === to
}

export function getInvalidComandaTransitionMessage(from: ComandaStatus, to: ComandaStatus): string {
  if (from === 'delivered') return 'Una comanda entregada es final y no puede retrocederse desde el tablero.'
  if (COMANDA_STATUSES.indexOf(to) < COMANDA_STATUSES.indexOf(from)) {
    return 'El tablero no permite retroceder etapas para evitar inconsistencias operativas y financieras.'
  }
  const expected = NEXT_STATUS[from]
  if (!expected) return 'Este cambio de estado no está permitido.'
  const labels: Record<ComandaStatus, string> = {
    new: 'Nuevas',
    preparing: 'En preparación',
    ready: 'Listas',
    delivered: 'Entregadas',
  }
  return `Mueve la comanda primero a “${labels[expected]}”. El flujo debe avanzar una etapa a la vez.`
}
