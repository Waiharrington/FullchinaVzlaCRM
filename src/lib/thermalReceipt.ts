import { formatUsd, formatVes } from './money'

export interface ThermalReceiptModifier {
  name: string
  quantity: number
  unitPrice: number
}

export interface ThermalReceiptItem {
  name: string
  quantity: number
  unitPrice: number
  modifiers?: ThermalReceiptModifier[]
}

export interface ThermalReceiptPayment {
  method: string
  amount: number
  referenceNumber?: string | null
}

export interface ThermalReceiptData {
  kind: 'precuenta' | 'venta'
  orderNumber: string
  createdAt: string
  orderType: string
  tableNumber?: number | null
  employeeName: string
  customerName: string
  items: ThermalReceiptItem[]
  totalUsd: number
  deliveryFeeUsd?: number
  bcvRate?: number | null
  payments?: ThermalReceiptPayment[]
}

const escapeHtml = (value: string) => value
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;')

const paymentNames: Record<string, string> = {
  cash: 'Efectivo',
  mobile: 'Pago móvil',
  card: 'Punto',
  transfer: 'Transferencia',
  binance: 'Binance',
  zelle: 'Zelle',
  other: 'Otro',
}

const itemTotal = (item: ThermalReceiptItem) => item.quantity * (
  item.unitPrice + (item.modifiers ?? []).reduce((sum, modifier) => sum + modifier.unitPrice * modifier.quantity, 0)
)

export function buildThermalReceiptHtml(data: ThermalReceiptData): string {
  const date = new Date(data.createdAt)
  const dateLabel = Number.isNaN(date.getTime())
    ? ''
    : new Intl.DateTimeFormat('es-VE', { timeZone: 'America/Caracas', day: '2-digit', month: '2-digit', year: 'numeric' }).format(date)
  const timeLabel = Number.isNaN(date.getTime())
    ? ''
    : new Intl.DateTimeFormat('es-VE', { timeZone: 'America/Caracas', hour: '2-digit', minute: '2-digit', hour12: false }).format(date)
  const subtotalUsd = data.items.reduce((sum, item) => sum + itemTotal(item), 0) + (data.deliveryFeeUsd ?? 0)
  const vesSubtotal = data.bcvRate && data.bcvRate > 0 ? formatVes(subtotalUsd * data.bcvRate) : null
  const vesTotal = data.bcvRate && data.bcvRate > 0 ? formatVes(data.totalUsd * data.bcvRate) : null
  const lines = data.items.map((item) => {
    const baseAmount = item.quantity * item.unitPrice
    const modifiers = (item.modifiers ?? []).map((modifier) => {
      const quantity = modifier.quantity * item.quantity
      const amount = modifier.unitPrice * quantity
      return `<div class="modifier"><span>+ ${escapeHtml(modifier.name)}${quantity > 1 ? ` ×${quantity}` : ''}</span><span>${escapeHtml(formatUsd(amount))}</span></div>`
    }).join('')
    const base = `<div class="item"><span>${item.quantity} ${escapeHtml(item.name)}</span><span>${escapeHtml(formatUsd(baseAmount))}</span></div>`
    return base + modifiers
  }).join('')
  const delivery = (data.deliveryFeeUsd ?? 0) > 0
    ? `<div class="item"><span>1 Delivery</span><span>${escapeHtml(formatUsd(data.deliveryFeeUsd ?? 0))}</span></div>`
    : ''
  const payments = data.kind === 'venta' && data.payments?.length
    ? data.payments.map((payment) => {
        const name = paymentNames[payment.method] ?? payment.method
        const reference = payment.referenceNumber?.trim()
        const vesAmount = data.bcvRate && data.bcvRate > 0 ? `<div class="payment"><span>Pago ${escapeHtml(name)} (Bs)</span><span>${escapeHtml(formatVes(payment.amount * data.bcvRate))}</span></div>` : ''
        return `<div class="payment"><span>Pago ${escapeHtml(name)}</span><span>${escapeHtml(formatUsd(payment.amount))}</span></div>${vesAmount}${reference ? `<div class="reference">Referencia: ${escapeHtml(reference)}</div>` : ''}`
      }).join('')
    : data.kind === 'venta' ? '<div class="payment">Pago registrado</div>' : ''
  const orderType = data.tableNumber ? `Mesa ${data.tableNumber}` : data.orderType

  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${data.kind === 'precuenta' ? 'Precuenta' : 'Recibo de venta'} ${escapeHtml(data.orderNumber)}</title><style>
    @page { size: 80mm auto; margin: 4mm; }
    * { box-sizing: border-box; }
    html, body { width: 72mm; margin: 0; padding: 0; color: #000; background: #fff; }
    body { font-family: Arial, Helvetica, sans-serif; font-size: 10pt; line-height: 1.28; }
    .ticket { width: 100%; padding: 1mm 0 3mm; overflow-wrap: anywhere; }
    h1 { margin: 0 0 1mm; text-align: center; font-size: 15pt; letter-spacing: .2mm; }
    .subtitle { text-align: center; margin-bottom: 2mm; font-size: 10pt; }
    .meta { margin: .8mm 0; }
    .separator { border-top: 1px dashed #000; margin: 2.5mm 0; }
    .item, .modifier, .payment, .summary { display: flex; justify-content: space-between; gap: 2mm; align-items: flex-start; }
    .item { margin: 1.2mm 0; font-weight: 600; }
    .item span:first-child, .modifier span:first-child { flex: 1; }
    .item span:last-child, .modifier span:last-child, .payment span:last-child { white-space: nowrap; text-align: right; }
    .modifier { padding-left: 4mm; margin: .8mm 0 1mm; font-size: 9pt; }
    .summary { margin: 1mm 0; }
    .grand-total { margin-top: 1.5mm; font-size: 12pt; font-weight: 700; }
    .payment { margin-top: 1.5mm; }
    .reference { margin: .6mm 0 1.2mm; overflow-wrap: anywhere; }
    .footer { margin-top: 3mm; text-align: center; font-size: 9pt; }
    @media screen { body { padding: 3mm; } }
  </style></head><body><main class="ticket">
    <h1>FULL CHINA VZLA</h1>
    <div class="subtitle">${data.kind === 'precuenta' ? 'Precuenta de comanda' : 'Recibo de venta'}</div>
    <div class="meta">${escapeHtml(dateLabel)} ${escapeHtml(timeLabel)}</div>
    <div class="meta">Orden: ${escapeHtml(data.orderNumber)}</div>
    <div class="meta">Orden ${escapeHtml(orderType)}</div>
    <div class="meta">Empleado: ${escapeHtml(data.employeeName || 'Usuario del sistema')}</div>
    <div class="meta">Nombre y Apellido: ${escapeHtml(data.customerName || 'Cliente general')}</div>
    <div class="separator"></div>
    ${lines}${delivery}
    <div class="separator"></div>
    <div class="summary"><span>Subtotal:</span><span>${escapeHtml(formatUsd(subtotalUsd))}</span></div>
    ${vesSubtotal ? `<div class="summary"><span>Subtotal:</span><span>${escapeHtml(vesSubtotal)}</span></div>` : ''}
    <div class="summary grand-total"><span>Total:</span><span>${escapeHtml(formatUsd(data.totalUsd))}</span></div>
    ${vesTotal ? `<div class="summary grand-total"><span>Total:</span><span>${escapeHtml(vesTotal)}</span></div>` : ''}
    ${payments ? `<div class="separator"></div>${payments}` : ''}
    <div class="footer">¡Gracias por su preferencia!</div>
  </main></body></html>`
}

export function printThermalReceipt(data: ThermalReceiptData): Promise<void> {
  return new Promise((resolve) => {
    const frame = document.createElement('iframe')
    frame.setAttribute('aria-hidden', 'true')
    frame.title = 'Impresión de ticket Full China Vzla'
    frame.style.cssText = 'position:fixed;left:-10000px;top:0;width:80mm;height:100vh;border:0;opacity:0;pointer-events:none'
    frame.onerror = () => cleanup()
    let cleaned = false
    const cleanup = () => {
      if (cleaned) return
      cleaned = true
      window.clearTimeout(fallbackTimer)
      frame.remove()
      resolve()
    }
    const fallbackTimer = window.setTimeout(cleanup, 60_000)
    frame.onload = () => {
      const printWindow = frame.contentWindow
      if (!printWindow) {
        cleanup()
        return
      }
      printWindow.addEventListener('afterprint', cleanup, { once: true })
      printWindow.focus()
      try {
        printWindow.print()
      } catch {
        cleanup()
      }
    }
    frame.srcdoc = buildThermalReceiptHtml(data)
    document.body.appendChild(frame)
  })
}
