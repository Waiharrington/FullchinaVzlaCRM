import type { Credit, FullOrder, PaymentMethod } from './dataService.js'

/** Datos para generar el resumen diario que luego se enviará por correo. */
export interface DailySalesMetric {
  label: string
  value: string | number | null
  format?: 'money' | 'number'
  detail?: string | null
}

export interface DailySalesRow {
  label: string
  count?: number | null
  total: number | null
  detail?: string | null
}

export interface DailySalesEmailData {
  businessName?: string
  reportDate: string
  currency?: string
  bcvRate?: number | null
  bcvRateDate?: string | null
  bcvRateSource?: 'history' | 'order' | null
  dailySummary: DailySalesMetric[]
  customers: DailySalesMetric[]
  weekComparison: DailySalesMetric[]
  collections: DailySalesMetric[]
  monthlySales: DailySalesMetric[]
  monthlyProjection: DailySalesMetric[]
  dailyCredits: DailySalesMetric[]
  paymentMethods: DailySalesRow[]
  personalConsumption: DailySalesMetric[]
  topItems: DailySalesRow[]
  logoUrl?: string | null
}

export interface DailySalesEmailSource {
  reportDate: string
  bcvRate?: number | null
  bcvRateDate?: string | null
  bcvRateSource?: 'history' | 'order' | null
  /** Ventas registradas (pagadas o autorizadas a crédito), filtradas por día local de Caracas. */
  dayOrders: FullOrder[]
  previousWeekdayOrders?: FullOrder[]
  monthOrders?: FullOrder[]
  /** Pagos recibidos dentro del día y del mes, según su propia fecha de registro. */
  dayPayments?: Array<{ method: PaymentMethod; amount: number }>
  monthPayments?: Array<{ method: PaymentMethod; amount: number }>
  /** Créditos creados durante el día y saldos actuales al generar el correo. */
  dayCredits?: Credit[]
  openCredits?: Credit[]
  /** Abonos a créditos recibidos hoy y en el mes, excluidos de las ventas. */
  creditCollectionsToday?: number
  creditCollectionsMonth?: number
  personalConsumptionToday?: number
  businessName?: string
  logoUrl?: string | null
}

const PAYMENT_LABELS: Record<PaymentMethod, string> = {
  cash: 'Efectivo', mobile: 'Pago móvil', card: 'Punto de venta', transfer: 'Transferencia',
  binance: 'Binance', zelle: 'Zelle', other: 'Otro', personal_account: 'Cuenta personal',
}

function saleOrders(orders: FullOrder[] | undefined): FullOrder[] {
  return (orders ?? []).filter(order =>
    (order.status === 'paid' || (order.creditAuthorized && order.status !== 'cancelled')) &&
    !order.payments.some(payment => payment.method === 'personal_account'),
  )
}

function orderTotal(orders: FullOrder[]): number {
  return orders.reduce((sum, order) => sum + order.totalAmount, 0)
}

function countIdentifiedCustomers(orders: FullOrder[]): number {
  const identifiers = new Set<string>()
  for (const order of orders) {
    if (order.customerId) {
      identifiers.add(`id:${order.customerId.trim().toLowerCase()}`)
      continue
    }
    const phone = order.customerPhone?.replace(/\D/g, '')
    if (phone && phone.length >= 7) identifiers.add(`phone:${phone}`)
  }
  return identifiers.size
}

/** Prepara ventas, cobros y créditos como cifras distintas para no confundir ingresos con crédito. */
export function buildDailySalesEmailData(source: DailySalesEmailSource): DailySalesEmailData {
  const day = saleOrders(source.dayOrders)
  const prior = saleOrders(source.previousWeekdayOrders)
  const month = saleOrders(source.monthOrders)
  const salesToday = orderTotal(day)
  const salesPriorWeek = orderTotal(prior)
  const salesMonth = orderTotal(month)
  const customers = countIdentifiedCustomers(day)
  const payments = new Map<PaymentMethod, { count: number; total: number }>()
  const itemTotals = new Map<string, { count: number; total: number }>()
  let collectedFromOrdersToday = 0
  let personalConsumptionToday = source.personalConsumptionToday ?? 0

  for (const order of day) {
    for (const item of order.items) {
      const current = itemTotals.get(item.productName) ?? { count: 0, total: 0 }
      current.count += item.quantity
      current.total += item.quantity * item.unitPrice
      itemTotals.set(item.productName, current)
    }
  }

  for (const payment of source.dayPayments ?? []) {
    if (payment.method === 'personal_account') {
      if (source.personalConsumptionToday == null) personalConsumptionToday += payment.amount
      continue
    }
    const current = payments.get(payment.method) ?? { count: 0, total: 0 }
    current.count += 1
    current.total += payment.amount
    collectedFromOrdersToday += payment.amount
    payments.set(payment.method, current)
  }

  const date = new Date(`${source.reportDate}T12:00:00`)
  const daysInMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate()
  const averageDailySales = date.getDate() ? salesMonth / date.getDate() : null
  const newCreditAmount = (source.dayCredits ?? []).reduce((sum, credit) => sum + credit.totalAmount, 0)
  const newCreditBalance = (source.dayCredits ?? []).reduce((sum, credit) => sum + credit.balancePending, 0)
  const outstandingCreditBalance = (source.openCredits ?? [])
    .filter(credit => credit.status !== 'paid' && credit.status !== 'cancelled')
    .reduce((sum, credit) => sum + Math.max(0, credit.balancePending), 0)
  const creditCollectionsToday = source.creditCollectionsToday
  const collectedToday = creditCollectionsToday == null ? null : collectedFromOrdersToday + creditCollectionsToday

  return {
    businessName: source.businessName,
    logoUrl: source.logoUrl,
    reportDate: source.reportDate,
    bcvRate: source.bcvRate,
    bcvRateDate: source.bcvRateDate,
    bcvRateSource: source.bcvRateSource,
    dailySummary: [
      { label: 'Ventas registradas', value: salesToday, detail: 'Incluye comandas pagadas y ventas autorizadas a crédito.' },
      { label: 'Comandas de venta', value: day.length, format: 'number' },
      { label: 'Promedio por comanda', value: day.length ? salesToday / day.length : null },
    ],
    customers: [
      { label: 'Clientes únicos identificados', value: customers, format: 'number', detail: 'Cada cliente asociado por cuenta o teléfono cuenta una sola vez, aunque haga varias comandas.' },
      { label: 'Consumo promedio por cliente identificado', value: customers ? salesToday / customers : null, detail: 'No incluye comandas sin cliente asociado o teléfono identificable.' },
    ],
    weekComparison: [
      { label: 'Ventas del mismo día la semana pasada', value: prior.length ? salesPriorWeek : null },
      { label: 'Variación frente a esa fecha', value: prior.length ? salesToday - salesPriorWeek : null, detail: 'Diferencia en ventas registradas.' },
    ],
    collections: [
      { label: 'Total de dinero recibido', value: collectedToday, detail: creditCollectionsToday == null ? 'Falta conectar el historial de abonos a créditos para completar este total.' : 'Pagos registrados más abonos a créditos recibidos hoy.' },
      { label: 'Cobros aplicados a comandas', value: collectedFromOrdersToday },
      { label: 'Abonos de créditos recibidos hoy', value: creditCollectionsToday ?? null },
    ],
    monthlySales: [
      { label: 'Ventas registradas en el mes', value: month.length ? salesMonth : null },
      { label: 'Dinero recibido en el mes', value: source.monthPayments ? source.monthPayments.filter(payment => payment.method !== 'personal_account').reduce((sum, payment) => sum + payment.amount, 0) + (source.creditCollectionsMonth ?? 0) : null, detail: 'Pagos registrados por fecha de recepción más abonos a créditos; no equivale a las ventas del mes.' },
      { label: 'Cobros de créditos recibidos en el mes', value: source.creditCollectionsMonth ?? null, detail: 'Abonos cobrados este mes; no se vuelven a sumar como ventas.' },
    ],
    monthlyProjection: [
      { label: 'Promedio diario de ventas este mes', value: averageDailySales },
      { label: 'Estimación de ventas al cierre del mes', value: averageDailySales == null ? null : averageDailySales * daysInMonth, detail: 'Estimación lineal usando el promedio diario hasta la fecha.' },
    ],
    dailyCredits: [
      { label: 'Créditos autorizados hoy', value: source.dayCredits?.length ?? null, format: 'number' },
      { label: 'Monto de ventas a crédito autorizadas hoy', value: source.dayCredits ? newCreditAmount : null },
      { label: 'Saldo pendiente de esos créditos', value: source.dayCredits ? newCreditBalance : null },
      { label: 'Saldo pendiente de todos los créditos', value: source.openCredits ? outstandingCreditBalance : null, detail: 'Saldo vigente al momento de generar el reporte.' },
    ],
    paymentMethods: [...payments.entries()]
      .map(([method, value]) => ({ label: PAYMENT_LABELS[method], count: value.count, total: value.total }))
      .sort((a, b) => (b.total ?? 0) - (a.total ?? 0)),
    personalConsumption: [
      { label: 'Consumos cargados a cuentas personales', value: personalConsumptionToday, detail: 'Se muestran aparte porque no son dinero recibido en caja.' },
    ],
    topItems: [...itemTotals.entries()]
      .map(([label, value]) => ({ label, count: value.count, total: value.total }))
      .sort((a, b) => (b.count ?? 0) - (a.count ?? 0))
      .slice(0, 10),
  }
}

const RED = '#ed1c2e'
const BG = '#111114'
const PANEL = '#1b1b20'
const MUTED = '#a7a7b2'

function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character] ?? character)
}

function display(value: string | number | null | undefined, currency: string, format: DailySalesMetric['format'] = 'money'): string {
  if (value === null || value === undefined || value === '') return 'Sin dato registrado'
  if (typeof value === 'number') {
    if (format === 'number') return new Intl.NumberFormat('es-VE', { maximumFractionDigits: 0 }).format(value)
    return new Intl.NumberFormat('es-VE', { style: 'currency', currency, minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value)
  }
  return value
}

function displayVesReference(value: number, rate: number): string {
  const amount = new Intl.NumberFormat('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value * rate)
  return `Ref. Bs. ${amount}`
}

function section(title: string, contents: string): string {
  if (!contents) return ''
  return `<tr><td style="padding:0 24px 18px"><h2 style="font-size:15px;line-height:20px;color:#fff;margin:0 0 10px;padding-left:10px;border-left:3px solid ${RED}">${escapeHtml(title)}</h2>${contents}</td></tr>`
}

function metricsTable(rows: DailySalesMetric[], currency: string, bcvRate: number | null): string {
  const body = rows.map(row => `<tr>
    <td style="padding:9px 10px;border-bottom:1px solid #303037;color:${MUTED};font-size:13px">${escapeHtml(row.label)}${row.detail ? `<div style="font-size:11px;color:#858590;margin-top:3px">${escapeHtml(row.detail)}</div>` : ''}</td>
    <td style="padding:9px 10px;border-bottom:1px solid #303037;color:#fff;font-size:13px;text-align:right;font-weight:700">${escapeHtml(display(row.value, currency, row.format))}${typeof row.value === 'number' && row.format !== 'number' && currency === 'USD' && Number.isFinite(row.value) && (bcvRate ?? 0) > 0 ? `<div style="font-size:10px;line-height:14px;color:${MUTED};font-weight:400;margin-top:2px">${escapeHtml(displayVesReference(row.value, bcvRate!))}</div>` : ''}</td>
  </tr>`).join('')
  return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;background:${PANEL};border:1px solid #303037;border-radius:10px">${body}</table>`
}

function rowsTable(rows: DailySalesRow[], currency: string, countLabel: string, bcvRate: number | null): string {
  const header = `<tr style="background:#24242a"><th align="left" style="padding:9px 10px;color:${MUTED};font-size:10px;text-transform:uppercase">Detalle</th><th align="right" style="padding:9px 6px;color:${MUTED};font-size:10px">${escapeHtml(countLabel)}</th><th align="right" style="padding:9px 10px;color:${MUTED};font-size:10px">Total</th></tr>`
  const body = rows.length ? rows.map(row => `<tr>
    <td style="padding:9px 10px;border-bottom:1px solid #303037;color:#f5f5f7;font-size:12px">${escapeHtml(row.label)}${row.detail ? `<div style="font-size:10px;color:#858590;margin-top:3px">${escapeHtml(row.detail)}</div>` : ''}</td>
    <td style="padding:9px 6px;border-bottom:1px solid #303037;color:${MUTED};font-size:12px;text-align:right">${row.count == null ? '—' : escapeHtml(row.count)}</td>
    <td style="padding:9px 10px;border-bottom:1px solid #303037;color:#fff;font-size:12px;text-align:right;font-weight:700">${escapeHtml(display(row.total, currency))}${typeof row.total === 'number' && currency === 'USD' && Number.isFinite(row.total) && (bcvRate ?? 0) > 0 ? `<div style="font-size:10px;line-height:14px;color:${MUTED};font-weight:400;margin-top:2px">${escapeHtml(displayVesReference(row.total, bcvRate!))}</div>` : ''}</td>
  </tr>`).join('') : `<tr><td colspan="3" style="padding:12px;color:${MUTED};font-size:12px">Sin registros para este día.</td></tr>`
  return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;background:${PANEL};border:1px solid #303037;border-radius:10px">${header}${body}</table>`
}

/** HTML inicial, autocontenido y apto para correo; la presentación visual queda lista para rediseñarse luego. */
export function buildDailySalesEmailHtml(data: DailySalesEmailData): string {
  const currency = data.currency ?? 'USD'
  const bcvRate = data.bcvRate && data.bcvRate > 0 ? data.bcvRate : null
  const name = data.businessName ?? 'Full China'
  const logo = data.logoUrl
    ? `<img src="${escapeHtml(data.logoUrl)}" width="46" height="46" alt="${escapeHtml(name)}" style="display:block;border:0;border-radius:10px">`
    : `<div style="width:46px;height:46px;line-height:46px;text-align:center;background:${RED};border-radius:10px;color:#fff;font-weight:900;font-size:15px">FC</div>`
  const blocks = [
    section('Ventas registradas del día', metricsTable(data.dailySummary, currency, bcvRate)),
    section('Clientes y consumo promedio', metricsTable(data.customers, currency, bcvRate)),
    section('Comparación semanal', metricsTable(data.weekComparison, currency, bcvRate)),
    section('Dinero recibido', metricsTable(data.collections, currency, bcvRate)),
    section('Créditos', metricsTable(data.dailyCredits, currency, bcvRate)),
    section('Cobros por método de pago', rowsTable(data.paymentMethods, currency, 'Pagos', bcvRate)),
    section('Consumos de cuentas personales', metricsTable(data.personalConsumption, currency, bcvRate)),
    section('Ventas del mes', metricsTable(data.monthlySales, currency, bcvRate)),
    section('Estimación de cierre mensual', metricsTable(data.monthlyProjection, currency, bcvRate)),
    section('10 productos más vendidos', rowsTable(data.topItems, currency, 'Unidades', bcvRate)),
  ].filter(Boolean).join('')

  return `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Reporte diario | ${escapeHtml(name)}</title></head>
<body style="margin:0;padding:24px 10px;background:${BG};font-family:Arial,Helvetica,sans-serif;color:#f5f5f7">
  <table role="presentation" align="center" width="100%" cellspacing="0" cellpadding="0" style="max-width:680px;margin:0 auto;border:1px solid #303037;border-radius:16px;overflow:hidden;background:#141417">
    <tr><td style="padding:22px 24px;background:#211013;border-bottom:1px solid #333238">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td width="58" valign="middle">${logo}</td><td valign="middle"><div style="color:#fff;font-size:18px;font-weight:800;letter-spacing:.2px">${escapeHtml(name)}</div><div style="color:#ff5965;font-size:11px;font-weight:700;letter-spacing:1.2px;margin-top:4px">REPORTE DE FIN DE DÍA</div></td></tr></table>
      <div style="font-size:13px;color:${MUTED};margin-top:18px">${escapeHtml(data.reportDate)}</div>
      ${bcvRate ? `<div style="font-size:10px;color:#858590;margin-top:4px">Tasa de referencia: Bs. ${escapeHtml(new Intl.NumberFormat('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 4 }).format(bcvRate))} por US$1${data.bcvRateDate ? ` · ${data.bcvRateSource === 'history' ? 'BCV efectivo' : 'tasa registrada en comandas'} ${escapeHtml(data.bcvRateDate)}` : ''}</div>` : ''}
    </td></tr>
    ${blocks || '<tr><td style="padding:24px;color:#aaa">No hay métricas disponibles para este reporte.</td></tr>'}
    <tr><td style="padding:16px 24px;border-top:1px solid #303037;color:#777783;font-size:10px;text-align:center">Reporte generado automáticamente para uso interno · ${escapeHtml(name)}</td></tr>
  </table>
</body></html>`
}
