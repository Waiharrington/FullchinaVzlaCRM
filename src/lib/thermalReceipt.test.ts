import { describe, expect, it } from 'vitest'
import { buildThermalReceiptHtml } from './thermalReceipt'

const sample = {
  kind: 'venta' as const,
  orderNumber: 'FC-000123',
  createdAt: '2026-10-01T17:15:00-04:00',
  orderType: 'Para llevar',
  employeeName: 'Edgar Buitrago',
  customerName: 'Cliente general',
  items: [{
    name: 'Arroz frito <especial>',
    quantity: 2,
    unitPrice: 8,
    modifiers: [{ name: 'Extra camarón', quantity: 1, unitPrice: 2 }],
  }],
  totalUsd: 20,
  bcvRate: 50,
  payments: [{ method: 'mobile', amount: 20, referenceNumber: 'REF-123' }],
}

describe('ticket térmico Full China', () => {
  it('genera una precuenta con cliente, empleado y extras cobrados por separado', () => {
    const html = buildThermalReceiptHtml({ ...sample, kind: 'precuenta', payments: [] })

    expect(html).toContain('FULL CHINA VZLA')
    expect(html).toContain('Precuenta de comanda')
    expect(html).toContain('Empleado: Edgar Buitrago')
    expect(html).toContain('Nombre y Apellido: Cliente general')
    expect(html).toContain('Extra camarón')
    expect(html).toContain('size: 80mm auto')
    expect(html).not.toContain('REF-123')
  })

  it('incluye pago, referencia y total en bolívares en el recibo de venta', () => {
    const html = buildThermalReceiptHtml(sample)

    expect(html).toContain('Recibo de venta')
    expect(html).toContain('Pago móvil')
    expect(html).toContain('Referencia: REF-123')
    expect(html).toContain('Bs. 1.000,00')
    expect(html).not.toContain('Arroz frito <especial>')
    expect(html).toContain('Arroz frito &lt;especial&gt;')
  })
})
