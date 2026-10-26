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
  imageUrl?: string | null
  productId?: string | null
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
  headerImageUrl?: string | null
  bcvBackgroundUrl?: string | null
  metricIconsBaseUrl?: string | null
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
  const itemTotals = new Map<string, { count: number; total: number; productId: string }>()
  let collectedFromOrdersToday = 0
  let personalConsumptionToday = source.personalConsumptionToday ?? 0

  for (const order of day) {
    for (const item of order.items) {
      const current = itemTotals.get(item.productName) ?? { count: 0, total: 0, productId: item.sellableProductId }
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
      .map(([label, value]) => ({ label, count: value.count, total: value.total, productId: value.productId }))
      .sort((a, b) => (b.count ?? 0) - (a.count ?? 0))
      .slice(0, 10),
  }
}

const RED = '#d92735'
const BG = '#f6f1e5'
const PANEL = '#ffffff'
const MUTED = '#687386'

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

function formatReportDate(value: string): string {
  const date = new Date(`${value}T12:00:00`)
  if (Number.isNaN(date.getTime())) return value
  const formatted = new Intl.DateTimeFormat('es-VE', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  }).format(date)
  return formatted.charAt(0).toLocaleUpperCase('es-VE') + formatted.slice(1)
}

const SECTION_NUMBERS: Record<string, string> = {
    'Clientes y consumo promedio': '02', 'Comparación semanal': '03', 'Estimación de cierre mensual': '04',
    'Dinero recibido': '05', 'Ventas del mes': '06', 'Créditos': '07',
    'Cobros por método de pago': '08', 'Consumos de cuentas personales': '09', '10 productos más vendidos': '10',
}

function sectionContent(title: string, contents: string): string {
  const number = SECTION_NUMBERS[title] ?? '01'
  return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse"><tr><td style="padding:0 0 11px"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse"><tr><td width="39" valign="middle" style="width:39px"><div style="width:30px;height:30px;line-height:30px;text-align:center;background:${RED};border:1px solid #f0c84a;color:#fff;font-size:10px;font-weight:800;letter-spacing:.4px">${number}</div></td><td valign="middle"><h2 style="font-size:15px;line-height:20px;color:#202939;margin:0;font-weight:700">${escapeHtml(title)}</h2><div style="height:2px;width:38px;background:#f0c84a;margin-top:5px"></div></td></tr></table></td></tr><tr><td>${contents}</td></tr></table>`
}

function section(title: string, contents: string, topPadding = 0): string {
  if (!contents) return ''
  return `<tr><td class="email-pad" style="padding:${topPadding}px 28px 22px;word-break:normal;overflow-wrap:break-word">${sectionContent(title, contents)}</td></tr>`
}

function pairedSections(left: { title: string; content: string }, right: { title: string; content: string }): string {
  return `<tr><td class="email-pad" style="padding:0 28px 20px"><table role="presentation" class="email-two-col" width="100%" cellspacing="0" cellpadding="0" style="width:100%;table-layout:fixed;border-collapse:collapse"><tr><td class="email-col email-col-left" width="50%" valign="top" style="width:50%;padding:0 10px 0 0">${sectionContent(left.title, left.content)}</td><td class="email-col email-col-right" width="50%" valign="top" style="width:50%;padding:0 0 0 10px">${sectionContent(right.title, right.content)}</td></tr></table></td></tr>`
}

function summaryStats(data: DailySalesEmailData, currency: string): string {
  const withDetail = (metric: DailySalesMetric | undefined, detail: string): DailySalesMetric | undefined => metric ? { ...metric, detail: metric.detail ?? detail } : metric
  const metrics = [
    { label: 'Comandas', metric: withDetail(data.dailySummary[1], 'Cantidad de comandas de venta registradas durante la jornada.'), icon: 'orders.png' },
    { label: 'Promedio por comanda', metric: withDetail(data.dailySummary[2], 'Monto promedio de venta por cada comanda registrada.'), icon: 'order-average.png' },
    { label: 'Clientes únicos', metric: data.customers[0], icon: 'customers.png' },
    { label: 'Consumo promedio por cliente', metric: data.customers[1], icon: 'customer-average.png' },
  ]
  const icon = (name: string) => `<img src="${escapeHtml(data.metricIconsBaseUrl ? `${data.metricIconsBaseUrl}/${name}` : '')}" width="27" height="27" alt="" style="display:block;width:27px;height:27px;border:0">`
  const value = (metric: DailySalesMetric | undefined) => `<div style="font-size:18px;line-height:23px;font-weight:800;white-space:nowrap">${escapeHtml(display(metric?.value ?? null, currency, metric?.format))}</div>${metric?.detail ? `<div style="font-size:10px;line-height:14px;color:#667080;margin-top:5px">${escapeHtml(metric.detail)}</div>` : ''}`
  const cells = metrics.map(({ label, metric, icon: iconName }, index) => `<td class="summary-stat" width="25%" valign="top" style="width:25%;padding:15px 13px 13px;${index < metrics.length - 1 ? 'border-right:1px solid #eadfca;' : ''}color:#202124;vertical-align:top"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="width:100%;border-collapse:collapse"><tr><td width="36" valign="top" style="width:36px;padding:2px 9px 0 0">${icon(iconName)}</td><td valign="top"><div class="summary-stat-label" style="height:38px;font-size:10px;line-height:13px;color:#243746;font-weight:700;text-transform:uppercase;letter-spacing:.25px">${escapeHtml(label)}</div></td></tr><tr><td colspan="2" style="padding:0 0 0 45px">${value(metric)}</td></tr></table></td>`).join('')
  const desktop = `<table role="presentation" class="summary-stats summary-stats-desktop" width="100%" cellspacing="0" cellpadding="0" style="width:100%;table-layout:fixed;border-collapse:collapse;background:#fffaf2;border-top:1px solid #eadfca;border-bottom:1px solid #eadfca"><tr>${cells}</tr></table>`
  const mobile = `<table role="presentation" class="summary-stats summary-stats-mobile" width="100%" cellspacing="0" cellpadding="0" style="display:none;width:100%;table-layout:fixed;border-collapse:collapse;background:#fffaf2;border-top:1px solid #eadfca;border-bottom:1px solid #eadfca"><tr>${cells}</tr></table>`
  return `${desktop}${mobile}`
}

function metricsTable(rows: DailySalesMetric[], currency: string, bcvRate: number | null): string {
  const body = rows.map((row, index) => `<tr style="background:${index % 2 === 0 ? '#fffaf0' : '#ffffff'}">
    <td width="62%" style="width:62%;padding:12px 10px;border-bottom:1px solid #eadfca;color:#465164;font-size:13px;overflow-wrap:break-word">${escapeHtml(row.label)}${row.detail ? `<div style="font-size:11px;line-height:16px;color:#8993a3;margin-top:4px">${escapeHtml(row.detail)}</div>` : ''}</td>
    <td width="38%" style="width:38%;padding:12px 8px;border-bottom:1px solid #eadfca;color:#172033;font-size:14px;text-align:right;font-weight:700;white-space:nowrap;word-break:keep-all;overflow-wrap:normal">${escapeHtml(display(row.value, currency, row.format))}${typeof row.value === 'number' && row.format !== 'number' && currency === 'USD' && Number.isFinite(row.value) && (bcvRate ?? 0) > 0 ? `<div style="font-size:11px;line-height:15px;color:${MUTED};font-weight:500;margin-top:3px;white-space:nowrap">${escapeHtml(displayVesReference(row.value, bcvRate!))}</div>` : ''}</td>
  </tr>`).join('')
  return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="width:100%;table-layout:fixed;border-collapse:collapse;background:${PANEL};border-top:1px solid #e4e8ee">${body}</table>`
}

function salesSummary(rows: DailySalesMetric[], currency: string, bcvRate: number | null): string {
  const [sales, orderCount, average] = rows
  if (!sales || !orderCount || !average) return metricsTable(rows, currency, bcvRate)
  const salesAmount = typeof sales.value === 'number'
    ? new Intl.NumberFormat('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(sales.value)
    : display(sales.value, currency, sales.format)
  const bolivarAmount = typeof sales.value === 'number' && currency === 'USD' && (bcvRate ?? 0) > 0
    ? escapeHtml(displayVesReference(sales.value, bcvRate!)).replace('Ref. ', '')
    : 'Sin tasa de referencia'
  const cashIcon = `<table role="presentation" width="48" height="48" cellspacing="0" cellpadding="0" style="width:48px;height:48px;border:2px solid #f0c84a;border-radius:50%;border-collapse:separate"><tr><td align="center" valign="middle" style="color:#f0c84a;font-size:30px;font-weight:700">$</td></tr></table>`
  const bolivarIcon = `<table role="presentation" width="48" height="48" cellspacing="0" cellpadding="0" style="width:48px;height:48px;border:2px solid #f0c84a;border-radius:50%;border-collapse:separate"><tr><td align="center" valign="middle" style="color:#f0c84a;font-size:22px;font-weight:700">Bs</td></tr></table>`
  const salesDetail = escapeHtml(sales.detail ?? '').replace(/ a crédito\b/gi, ' a&nbsp;crédito')
  return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="width:100%;table-layout:fixed;border-collapse:collapse;background:#a90016;border-radius:10px;color:#fff"><tr><td class="sales-hero-cell" width="50%" valign="middle" style="width:50%;padding:18px 14px"><table role="presentation" cellspacing="0" cellpadding="0"><tr><td valign="middle" style="padding-right:12px">${cashIcon}</td><td valign="middle"><div style="font-size:10px;line-height:14px;letter-spacing:1px;color:#fff;font-weight:800">VENTAS DEL DÍA</div><div class="sales-hero-value" style="font-size:29px;line-height:34px;color:#fff;font-weight:800;margin-top:3px;white-space:nowrap">USD ${escapeHtml(salesAmount)}</div></td></tr></table></td><td class="sales-hero-cell sales-hero-ves" width="50%" valign="middle" style="width:50%;padding:18px 14px;border-left:1px solid #efb7a9"><table role="presentation" cellspacing="0" cellpadding="0"><tr><td valign="middle" style="padding-right:12px">${bolivarIcon}</td><td valign="middle"><div style="font-size:10px;line-height:14px;letter-spacing:.7px;color:#fff;font-weight:800">EQUIVALENTE EN BOLÍVARES</div><div class="sales-hero-value" style="font-size:27px;line-height:34px;color:#fff;font-weight:800;margin-top:5px;white-space:nowrap">${bolivarAmount}</div></td></tr></table></td></tr></table><div style="padding:8px 2px 5px;font-size:11px;line-height:16px;color:#687386">${salesDetail}</div>`
}

function rowsTable(rows: DailySalesRow[], currency: string, countLabel: string, bcvRate: number | null): string {
  const header = `<tr style="background:#8f1020"><th align="left" style="padding:10px;color:#fff;border-bottom:2px solid #f0c84a;font-size:11px;text-transform:uppercase;letter-spacing:.7px">Detalle</th><th align="right" style="padding:10px;color:#fff;border-bottom:2px solid #f0c84a;font-size:11px;text-transform:uppercase;letter-spacing:.7px">Total</th></tr>`
  const body = rows.length ? rows.map((row, index) => `<tr style="background:${index % 2 === 0 ? '#fffaf0' : '#ffffff'}">
    <td width="64%" style="width:64%;padding:11px 8px;border-bottom:1px solid #eadfca;color:#354052;font-size:12px;word-break:break-word">${escapeHtml(row.label)}${row.count == null ? '' : `<div style="font-size:10px;color:#78632b;margin-top:3px">${escapeHtml(countLabel)}: ${escapeHtml(row.count)}</div>`}${row.detail ? `<div style="font-size:10px;color:#8993a3;margin-top:3px">${escapeHtml(row.detail)}</div>` : ''}</td>
    <td width="36%" style="width:36%;padding:11px 8px;border-bottom:1px solid #eadfca;color:#172033;font-size:12px;text-align:right;font-weight:700;white-space:nowrap;word-break:keep-all;overflow-wrap:normal">${escapeHtml(display(row.total, currency))}${typeof row.total === 'number' && currency === 'USD' && Number.isFinite(row.total) && (bcvRate ?? 0) > 0 ? `<div style="font-size:11px;line-height:14px;color:${MUTED};font-weight:500;margin-top:3px;white-space:nowrap">${escapeHtml(displayVesReference(row.total, bcvRate!))}</div>` : ''}</td>
  </tr>`).join('') : `<tr><td colspan="2" style="padding:12px;color:${MUTED};font-size:12px">Sin registros para este día.</td></tr>`
  return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="table-layout:fixed;border-collapse:collapse;background:${PANEL};border-top:1px solid #e4e8ee">${header}${body}</table>`
}

function rankedProducts(rows: DailySalesRow[], currency: string, startRank: number): string {
  const body = rows.map((row, index) => {
    const image = row.imageUrl ? `<img src="${escapeHtml(row.imageUrl)}" width="38" height="38" alt="${escapeHtml(row.label)}" style="display:block;width:38px;height:38px;object-fit:cover;border-radius:4px;border:1px solid #eadfca">` : `<div style="width:38px;height:38px;line-height:38px;text-align:center;background:#fff0c2;border:1px solid #eadfca;color:${RED};font-size:15px">🍜</div>`
    return `<tr style="background:${index % 2 === 0 ? '#fffaf0' : '#ffffff'}"><td width="24" align="center" style="width:24px;padding:6px 3px;border-bottom:1px solid #eadfca;color:${RED};font-size:10px;font-weight:800">${startRank + index}</td><td width="44" style="width:44px;padding:5px 3px 5px 0;border-bottom:1px solid #eadfca">${image}</td><td style="padding:6px 5px 6px 2px;border-bottom:1px solid #eadfca;color:#354052;font-size:11px;overflow-wrap:anywhere">${escapeHtml(row.label)}</td><td width="44" align="center" style="width:44px;padding:6px 3px;border-bottom:1px solid #eadfca;color:#687386;font-size:10px">${row.count == null ? '—' : escapeHtml(row.count)}</td><td width="78" align="right" style="width:78px;padding:6px 4px;border-bottom:1px solid #eadfca;color:#172033;font-size:10px;font-weight:700;white-space:nowrap">${escapeHtml(display(row.total, currency))}</td></tr>`
  }).join('')
  const header = `<tr style="background:#202124"><th width="28" style="width:28px;padding:8px 3px;color:#f0c84a;font-size:9px">#</th><th width="44" style="width:44px;padding:8px 3px;color:#202124;font-size:9px">&nbsp;</th><th align="left" style="padding:8px 5px 8px 2px;color:#f0c84a;font-size:9px">PRODUCTO</th><th width="44" align="center" style="width:44px;padding:8px 3px;color:#f0c84a;font-size:9px">UNID.</th><th width="78" align="right" style="width:78px;padding:8px 5px;color:#f0c84a;font-size:9px">TOTAL</th></tr>`
  return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="width:100%;table-layout:fixed;border-collapse:collapse"><colgroup><col width="28"><col width="44"><col><col width="44"><col width="78"></colgroup>${header}${body}</table>`
}

function topProducts(rows: DailySalesRow[], currency: string): string {
  const split = Math.ceil(rows.length / 2)
  const left = rows.slice(0, split)
  const right = rows.slice(split)
  const desktopColumns = `<tr class="products-desktop-row"><td colspan="5" style="padding:0"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="width:100%;table-layout:fixed;border-collapse:collapse"><tr><td width="50%" valign="top" style="width:50%;padding-right:8px;border-right:1px solid #eadfca">${rankedProducts(left, currency, 1)}</td><td width="50%" valign="top" style="width:50%;padding-left:8px">${rankedProducts(right, currency, split + 1)}</td></tr></table></td></tr>`
  const mobileRows = `<tr class="products-mobile-row"><td colspan="5" style="padding:0">${rankedProducts(rows, currency, 1)}</td></tr>`
  return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="width:100%;table-layout:fixed;border-collapse:collapse">${desktopColumns}${mobileRows}</table>`
}

/** Plantilla autocontenida y apta para correo, conservando todas las métricas del informe. */
export function buildDailySalesEmailHtml(data: DailySalesEmailData): string {
  const currency = data.currency ?? 'USD'
  const bcvRate = data.bcvRate && data.bcvRate > 0 ? data.bcvRate : null
  const name = data.businessName ?? 'Full China'
  const headerImage = data.headerImageUrl
    ? `<tr><td style="padding:0;line-height:0"><img src="${escapeHtml(data.headerImageUrl)}" width="700" alt="Full China · comida china" style="display:block;width:100%;max-width:700px;height:auto;border:0"></td></tr>`
    : ''
  const blocks = [
    `<tr><td class="email-pad" style="padding:12px 28px 8px">${salesSummary(data.dailySummary, currency, bcvRate)}</td></tr>`,
    `<tr><td class="email-pad" style="padding:0 28px 18px">${summaryStats(data, currency)}</td></tr>`,
    pairedSections({ title: 'Comparación semanal', content: metricsTable(data.weekComparison, currency, bcvRate) }, { title: 'Estimación de cierre mensual', content: metricsTable(data.monthlyProjection, currency, bcvRate) }),
    pairedSections({ title: 'Dinero recibido', content: metricsTable(data.collections, currency, bcvRate) }, { title: 'Ventas del mes', content: metricsTable(data.monthlySales, currency, bcvRate) }),
    pairedSections({ title: 'Créditos', content: metricsTable(data.dailyCredits, currency, bcvRate) }, { title: 'Cobros por método de pago', content: rowsTable(data.paymentMethods, currency, 'Pagos', bcvRate) }),
    section('Consumos de cuentas personales', metricsTable(data.personalConsumption, currency, bcvRate), 0),
    section('10 productos más vendidos', topProducts(data.topItems, currency), 0),
  ].filter(Boolean).join('')

  return `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Reporte diario | ${escapeHtml(name)}</title><link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Graduate&family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet"><style>body,table,td,th,div{font-family:'Inter','DM Sans',Arial,sans-serif!important}.email-display{font-family:'Graduate','Inter',Georgia,serif!important}.email-meta{font-family:'DM Sans','Inter',Arial,sans-serif!important}.email-subtitle-short{display:none}.email-bcv{background-size:auto 100%!important;background-position:right center!important}.products-mobile-row{display:none}@media screen and (max-width:520px){.email-shell{width:100%!important;border-radius:0!important}.email-pad{padding-left:16px!important;padding-right:16px!important}.email-title{font-size:20px!important}.email-report-title{font-family:'Graduate','Inter',Georgia,serif!important;font-size:18px!important;line-height:23px!important;white-space:nowrap!important}.email-date-row,.email-date-row>td{display:block!important;width:100%!important;text-align:left!important}.email-date-row>td:last-child{padding:4px 0 0!important;border-top:0!important}.email-report-date{margin-left:63px!important;margin-right:0!important}.email-bcv{background-size:auto 100%!important;background-position:right center!important}.email-bcv{background-size:auto 100%!important;background-position:right center!important}.email-subtitle-full{display:none!important}.email-subtitle-short{display:inline!important}.email-col{display:block!important;width:100%!important;max-width:100%!important;box-sizing:border-box!important;padding-left:0!important;padding-right:0!important}.email-col-right{padding-top:18px!important}.summary-stats-desktop{display:none!important}.summary-stats-mobile{display:table!important}.summary-stat{display:block!important;width:100%!important;box-sizing:border-box!important;border-right:0!important;border-bottom:1px solid #eadfca!important;padding:8px 12px!important}.summary-stat-label{height:auto!important}.sales-hero-cell{display:block!important;width:100%!important;box-sizing:border-box!important;padding:14px 12px!important}.sales-hero-ves{border-left:0!important;border-top:1px solid #efb7a9!important}.sales-hero-value{font-size:25px!important;white-space:normal!important;overflow-wrap:anywhere!important}.products-desktop-row{display:none!important}.products-mobile-row{display:table-row!important}}</style></head>
<body style="margin:0;padding:28px 10px;background:${BG};font-family:'Inter','DM Sans',Arial,sans-serif;color:#202939">
  <table class="email-shell" role="presentation" align="center" width="100%" cellspacing="0" cellpadding="0" style="width:100%;max-width:700px;margin:0 auto;border:1px solid #e3e7ed;border-radius:16px;overflow:hidden;background:#fff">
    ${headerImage}
    <tr><td class="email-pad" style="padding:20px 28px 18px;background:#fff;border-bottom:1px solid #eadfca">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr class="email-date-row"><td valign="middle"><table role="presentation" cellspacing="0" cellpadding="0"><tr><td valign="middle" style="padding-right:13px"><table role="presentation" width="50" height="50" cellspacing="0" cellpadding="0" style="width:50px;height:50px;background:${RED};border:2px solid #f0c84a"><tr><td align="center" valign="middle"><table role="presentation" width="25" height="32" cellspacing="0" cellpadding="0" style="width:25px;height:32px;background:#fff;border-collapse:collapse"><tr><td align="center" style="height:15px;color:${RED};font-size:15px;line-height:15px;font-weight:800">$</td></tr><tr><td valign="bottom" style="height:12px;padding:0 3px 3px"><table role="presentation" width="100%" height="9" cellspacing="1" cellpadding="0" style="width:100%;height:9px;border-collapse:collapse"><tr><td valign="bottom"><div style="height:3px;background:${RED};font-size:1px;line-height:1px">&nbsp;</div></td><td valign="bottom"><div style="height:6px;background:#f0c84a;font-size:1px;line-height:1px">&nbsp;</div></td><td valign="bottom"><div style="height:9px;background:${RED};font-size:1px;line-height:1px">&nbsp;</div></td></tr></table></td></tr></table></td></tr></table></td><td valign="middle"><div class="email-display email-report-title" style="font-size:22px;line-height:27px;color:#101820;font-weight:700;text-transform:uppercase;white-space:nowrap">Cierre de jornada</div><div class="email-meta" style="font-size:10px;line-height:15px;color:#243746;font-weight:700;letter-spacing:1px;margin-top:4px"><span class="email-subtitle-full">RESUMEN DE VENTAS Y OPERACIÓN · USO INTERNO</span><span class="email-subtitle-short">VENTAS Y OPERACIÓN · INTERNO</span></div></td></tr></table></td><td valign="middle" align="right" style="padding-left:12px"><table role="presentation" class="email-report-date" cellspacing="0" cellpadding="0"><tr><td valign="middle" style="padding:4px 0"><div style="color:#687386;font-size:13px;line-height:18px;font-weight:600">${escapeHtml(formatReportDate(data.reportDate))}</div></td></tr></table></td></tr></table>
      ${bcvRate ? `<table role="presentation" class="email-bcv" width="100%" cellspacing="0" cellpadding="0" bgcolor="#fdfaf2" background="${escapeHtml(data.bcvBackgroundUrl ?? '')}" style="margin-top:13px;background-color:#fdfaf2;background-image:url('${escapeHtml(data.bcvBackgroundUrl ?? '')}');background-position:center center;background-repeat:no-repeat;background-size:100% 100%;border:1px solid #f0dfb0;border-collapse:separate;border-radius:9px"><tr><td width="66" valign="middle" style="width:66px;padding:12px 8px 12px 12px"><div style="width:48px;height:42px;line-height:42px;text-align:center;background:#f0c84a;border-radius:5px;color:#202124;font-size:14px;font-weight:800;letter-spacing:.3px">BCV</div></td><td valign="middle" style="padding:11px 12px 11px 2px"><div style="font-size:10px;line-height:14px;color:#8f1020;font-weight:800;letter-spacing:1px">TASA DE REFERENCIA</div><div style="font-size:16px;line-height:21px;color:#202124;font-weight:800;margin-top:2px">Bs. ${escapeHtml(new Intl.NumberFormat('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 4 }).format(bcvRate))} por US$1</div><div style="font-size:11px;line-height:15px;color:#786a47;font-weight:600;margin-top:3px">${data.bcvRateSource === 'history' ? 'BCV efectivo' : 'Tasa registrada en comandas'}${data.bcvRateDate ? ` · ${escapeHtml(data.bcvRateDate)}` : ''}</div></td></tr></table>` : ''}
    </td></tr>
    ${blocks || '<tr><td style="padding:24px;color:#aaa">No hay métricas disponibles para este reporte.</td></tr>'}
    <tr><td style="padding:18px 28px;border-top:3px solid #f0c84a;color:#f4e6b8;font-size:10px;text-align:center;background:#202124">Reporte generado automáticamente para uso interno · ${escapeHtml(name)}</td></tr>
  </table>
</body></html>`
}
