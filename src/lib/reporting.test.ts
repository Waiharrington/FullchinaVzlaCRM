import { describe, expect, it } from 'vitest'
import { buildReport } from './reporting'
import type { FullOrder, StockMovement } from './dataService'

const order = (overrides: Partial<FullOrder> = {}): FullOrder => ({
  id: '1', orderNumber: 12, status: 'paid', fulfillmentStatus: 'delivered', notes: null,
  orderType: 'dine_in', tableNumber: 3, customerName: 'María', customerPhone: null,
  customerAddress: null, customerIdentification: null, bcvRate: 800, createdBy: '1',
  createdAt: '2026-09-15T01:00:00Z', updatedAt: '2026-09-15T01:00:00Z',
  items: [{ id: 'i', sellableProductId: 'p', productName: 'Pollo', emoji: '🍗', category: 'proteinas', quantity: 2, unitPrice: 5 }],
  payments: [{ id: 'pay', method: 'cash', amount: 10, createdAt: '2026-09-15T01:00:00Z' }],
  totalAmount: 10, ...overrides,
})

describe('reportes operativos', () => {
  it('usa el día calendario de Caracas y excluye comandas no cobradas', () => {
    const result = buildReport('orders', '2026-09-14', '2026-09-14', { orders: [order(), order({ id: '2', status: 'open' })] })
    expect(result.rows).toHaveLength(1)
    expect(result.rows[0][0]).toBe('2026-09-14')
    expect(result.total).toBe('$10,00')
  })

  it('agrupa unidades e importes de ítems cobrados', () => {
    const result = buildReport('items', '2026-09-14', '2026-09-14', { orders: [order(), order({ id: '2', totalAmount: 10 })] })
    expect(result.rows).toEqual([['Pollo', '4', '$20,00']])
  })

  it('cuenta pagos mixtos por método sin duplicar comandas', () => {
    const mixed = order({ payments: [
      { id: 'a', method: 'cash', amount: 6, createdAt: '2026-09-15T01:00:00Z' },
      { id: 'b', method: 'mobile', amount: 4, createdAt: '2026-09-15T01:00:00Z' },
    ] })
    const result = buildReport('payments', '2026-09-14', '2026-09-14', { orders: [mixed] })
    expect(result.rows).toEqual([['Efectivo', '1', '$6,00'], ['Pago móvil', '1', '$4,00']])
    expect(result.total).toBe('$10,00')
  })

  it('no incluye movimientos fuera del rango', () => {
    const movement = { id: 'm', ingredientId: 'i', ingredientName: 'Pollo', quantity: -2, unitId: 'u', unitSymbol: 'kg', movementType: 'consumption', stockLocation: 'operational', referenceType: 'order', referenceId: '1', notes: null, createdBy: '1', createdAt: '2026-09-15T01:00:00Z' } as StockMovement
    const result = buildReport('movements', '2026-09-15', '2026-09-15', { movements: [movement] })
    expect(result.rows).toHaveLength(0)
  })

  it('filtra la hora local sin cambiar el rango de días', () => {
    const result = buildReport('orders', '2026-09-14', '2026-09-14', { orders: [order()] }, '20:00', '21:00')
    expect(result.rows).toHaveLength(1)
    const excluded = buildReport('orders', '2026-09-14', '2026-09-14', { orders: [order()] }, '22:00', '23:00')
    expect(excluded.rows).toHaveLength(0)
  })

  it('muestra solo cierres registrados y no simula un Z fiscal', () => {
    const result = buildReport('closes', '2026-09-14', '2026-09-14', { closes: [{
      id: 'c', closeDate: '2026-09-14', totalSales: 100, totalPayments: 90,
      totalExpenses: 5, totalCredits: 10, balance: 85, notes: null, closedBy: 'u',
    }] })
    expect(result.rows[0][1]).toBe('$100,00')
    expect(result.note).toContain('no calcula un Reporte Z fiscal')
  })

  it('reconcilia el total de la comanda contra sus pagos', () => {
    const result = buildReport('reconciliation', '2026-09-14', '2026-09-14', { orders: [order({ totalAmount: 12 })] })
    expect(result.rows[0]).toEqual(['2026-09-14', '#12', '$12,00', '$10,00', '$2,00', 'Revisar'])
  })

  it('expone una fuente pendiente sin inventar cifras', () => {
    const result = buildReport('kdsLogs', '2026-09-14', '2026-09-14', { sourceUnavailable: true })
    expect(result.rows[0][0]).toBe('Fuente pendiente')
    expect(result.note).toContain('activará automáticamente')
  })
})
