import jsPDF from 'jspdf'
import type { CartItem } from './dataService'
import { formatVes, usdToVes } from './money'

interface ReceiptData {
  orderId: string
  items: CartItem[]
  total: number
  paymentMethod: string
  createdAt: string
  bcvRate?: number | null
}

export function generateReceipt(data: ReceiptData): jsPDF {
  const doc = new jsPDF({ unit: 'mm', format: [80, 200] })
  const pageWidth = 80
  const margin = 5
  let y = 10

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(14)
  doc.text('FULL CHINA VZLA', pageWidth / 2, y, { align: 'center' })
  y += 6

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.text('Comprobante de Venta', pageWidth / 2, y, { align: 'center' })
  y += 8

  doc.setDrawColor(200, 200, 200)
  doc.line(margin, y, pageWidth - margin, y)
  y += 5

  doc.setFontSize(8)
  doc.text(`Orden: ${data.orderId}`, margin, y)
  y += 4
  const date = new Date(data.createdAt)
  doc.text(`Fecha: ${date.toLocaleDateString('es')}`, margin, y)
  y += 4
  doc.text(`Hora: ${date.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })}`, margin, y)
  y += 4
  const paymentLabel = data.paymentMethod === 'cash'
    ? 'Efectivo'
    : data.paymentMethod === 'mobile'
      ? 'Pago movil'
      : data.paymentMethod === 'card'
        ? 'Punto'
        : data.paymentMethod === 'transfer'
          ? 'Transferencia'
          : data.paymentMethod === 'binance'
            ? 'Binance'
            : data.paymentMethod === 'zelle'
              ? 'Zelle'
              : 'Pago combinado'
  doc.text(`Pago: ${paymentLabel}`, margin, y)
  y += 7

  doc.line(margin, y, pageWidth - margin, y)
  y += 5

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.text('CANT  PRODUCTO         SUBTOTAL', margin, y)
  y += 5

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)

  for (const item of data.items) {
    const qty = String(item.quantity).padStart(2, ' ')
    const name = item.productName.length > 16
      ? item.productName.substring(0, 15) + '.'
      : item.productName.padEnd(16)
    const sub = `$${(item.price * item.quantity).toFixed(2)}`.padStart(7)
    doc.text(`${qty}   ${name}  ${sub}`, margin, y)
    y += 4
  }

  y += 2
  doc.line(margin, y, pageWidth - margin, y)
  y += 5

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.text(`TOTAL: $${data.total.toFixed(2)}`, margin, y)
  y += 4
  const totalVes = usdToVes(data.total, data.bcvRate)
  if (totalVes !== null) {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.text(`REF. BCV: ${formatVes(totalVes)}`, margin, y)
    y += 5
  } else {
    y += 3
  }

  doc.line(margin, y, pageWidth - margin, y)
  y += 6

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7)
  doc.text('¡Gracias por su compra!', pageWidth / 2, y, { align: 'center' })

  return doc
}

export function downloadReceipt(data: ReceiptData) {
  const doc = generateReceipt(data)
  doc.save(`receipt-${data.orderId}.pdf`)
}
