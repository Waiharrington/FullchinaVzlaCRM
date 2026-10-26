import { createClient } from '@supabase/supabase-js'
import { buildDailySalesEmailData, buildDailySalesEmailHtml } from '../src/lib/dailySalesEmail.js'

const TIME_ZONE = 'America/Caracas'
const CURRENCY = 'USD'
const PAGE_SIZE = 1000
const BCV_HISTORY_URL = 'https://bcv.today/api/v1/history.json'
const PUBLIC_SITE_FALLBACK = 'https://fullchinavzla.vercel.app'
const environment = (globalThis as typeof globalThis & { process?: { env?: Record<string, string | undefined> } }).process?.env ?? {}

function getPublicSiteOrigin(): string {
  const configured = environment.DAILY_SALES_REPORT_PUBLIC_URL?.trim()
    || environment.VERCEL_PROJECT_PRODUCTION_URL?.trim()
    || PUBLIC_SITE_FALLBACK
  try {
    return new URL(/^https?:\/\//i.test(configured) ? configured : `https://${configured}`).origin
  } catch {
    return PUBLIC_SITE_FALLBACK
  }
}

// La respuesta PostgREST contiene columnas dinámicas definidas por el esquema desplegado.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DbRow = Record<string, any>
type PaymentMethod = 'cash' | 'mobile' | 'card' | 'transfer' | 'binance' | 'zelle' | 'other' | 'personal_account'

interface BcvHistoryEntry {
  USD?: number
  effective_date?: string
}

async function getReportBcvRate(reportDate: string, orderRows: DbRow[]) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 5_000)
  try {
    const response = await fetch(BCV_HISTORY_URL, { signal: controller.signal, headers: { Accept: 'application/json' } })
    if (response.ok) {
      const entries = await response.json() as BcvHistoryEntry[]
      if (Array.isArray(entries)) {
        const historicalRate = entries
          .filter(entry => entry.effective_date && entry.effective_date <= reportDate && Number.isFinite(entry.USD) && Number(entry.USD) > 0)
          .sort((a, b) => String(b.effective_date).localeCompare(String(a.effective_date)))[0]
        if (historicalRate?.effective_date && historicalRate.USD) {
          return { rate: Number(historicalRate.USD), date: historicalRate.effective_date, source: 'history' as const }
        }
      }
    }
  } catch {
    // El reporte puede usar como respaldo la tasa guardada en las comandas.
  } finally {
    clearTimeout(timeout)
  }

  const latestOrderRate = orderRows
    .filter(row => row.created_at && String(row.created_at).slice(0, 10) <= reportDate && Number.isFinite(Number(row.bcv_rate)) && Number(row.bcv_rate) > 0)
    .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))[0]
  return latestOrderRate
    ? { rate: Number(latestOrderRate.bcv_rate), date: String(latestOrderRate.created_at).slice(0, 10), source: 'order' as const }
    : { rate: null, date: null, source: null }
}

function dateKey(date: Date): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit' }).format(date)
}

function shiftDate(key: string, days: number): string {
  const date = new Date(`${key}T12:00:00-04:00`)
  date.setUTCDate(date.getUTCDate() + days)
  return dateKey(date)
}

function utcStart(key: string): string {
  return `${key}T04:00:00.000Z`
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function rows(queryFactory: () => any): Promise<DbRow[]> {
  const result: DbRow[] = []
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const { data, error } = await queryFactory().range(offset, offset + PAGE_SIZE - 1)
    if (error) throw new Error(error.message)
    result.push(...(data ?? []))
    if (!data || data.length < PAGE_SIZE) return result
  }
}

function orderRecord(row: DbRow) {
  const payments = (row.payments ?? []).map((payment: DbRow) => ({
    id: String(payment.id ?? ''), method: payment.method as PaymentMethod, amount: Number(payment.amount ?? 0),
    createdAt: String(payment.created_at ?? ''), accountId: payment.account_id ?? null,
    personalAccountId: payment.personal_account_id ?? null, referenceNumber: payment.reference_number ?? null,
    receivedAmount: payment.received_amount == null ? null : Number(payment.received_amount), notes: payment.notes ?? null,
  }))
  const items = (row.items ?? []).map((item: DbRow) => ({
    id: String(item.id ?? ''), sellableProductId: String(item.sellable_product_id ?? ''),
    productName: String(item.product_name ?? 'Producto'), emoji: String(item.emoji ?? ''),
    category: String(item.category ?? ''), quantity: Number(item.quantity ?? 0),
    unitPrice: Number(item.unit_price ?? 0),
  }))
  return {
    id: String(row.id), orderNumber: Number(row.order_number ?? 0), status: String(row.status ?? ''),
    creditAuthorized: Boolean(row.credit_authorized), customerId: row.customer_id ?? null,
    fulfillmentStatus: String(row.fulfillment_status ?? 'new') as 'new', notes: row.notes ?? null,
    orderType: String(row.order_type ?? ''), tableNumber: row.table_number == null ? null : Number(row.table_number),
    customerName: String(row.customer_name ?? ''), customerPhone: row.customer_phone ?? null,
    customerAddress: row.customer_address ?? null, customerIdentification: row.customer_identification ?? null,
    bcvRate: row.bcv_rate == null ? null : Number(row.bcv_rate), createdBy: String(row.created_by ?? ''),
    createdAt: String(row.created_at ?? ''), updatedAt: String(row.updated_at ?? ''), items, payments,
    totalAmount: Number(row.total_amount ?? 0),
  }
}

function creditRecord(row: DbRow) {
  return {
    id: String(row.credit_id), customerId: row.customer_id ?? null, customerName: String(row.customer_name ?? ''),
    totalAmount: Number(row.total_amount ?? 0), totalPaid: Number(row.total_paid ?? 0),
    balancePending: Number(row.balance_pending ?? 0), status: String(row.status ?? ''),
    orderId: row.order_id == null ? '' : String(row.order_id), createdAt: String(row.created_at ?? ''),
  }
}

async function sendReport(request: Request): Promise<Response> {
  const supabaseUrl = environment.SUPABASE_URL ?? environment.VITE_SUPABASE_URL
  const serviceKey = environment.SUPABASE_SERVICE_ROLE_KEY
  const resendKey = environment.RESEND_API_KEY
  const cronSecret = environment.CRON_SECRET
  const recipient = environment.DAILY_SALES_REPORT_TO
  const sender = environment.DAILY_SALES_REPORT_FROM ?? 'Full China <fullchinareportes@somosdostudio.com>'
  if (!supabaseUrl || !serviceKey || !resendKey || !cronSecret || !recipient) {
    return Response.json({ error: 'Faltan variables de configuración del reporte.' }, { status: 500 })
  }
  if (request.headers.get('authorization') !== `Bearer ${cronSecret}`) {
    return Response.json({ error: 'No autorizado.' }, { status: 401 })
  }

  const url = new URL(request.url)
  const sample = url.searchParams.get('sample') === '1'
  const requestedRecipient = sample ? url.searchParams.get('to')?.trim() : null
  if (requestedRecipient && (requestedRecipient.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(requestedRecipient))) {
    return Response.json({ error: 'El destinatario de prueba no es válido.' }, { status: 400 })
  }
  const sendTo = requestedRecipient || recipient
  const override = url.searchParams.get('date')
  const reportDate = override && /^\d{4}-\d{2}-\d{2}$/.test(override) ? override : shiftDate(dateKey(new Date()), -1)
  const dayAfter = shiftDate(reportDate, 1)
  const monthStart = `${reportDate.slice(0, 7)}-01`
  const weekStart = shiftDate(reportDate, -7)
  const supabase = createClient(supabaseUrl, serviceKey, {
    db: { schema: 'fullchinavzla' }, auth: { persistSession: false, autoRefreshToken: false },
  })
  const fetchOrders = (from: string, to: string) => rows(() => supabase.from('v_orders_with_credit_status').select('*')
    .gte('created_at', utcStart(from)).lt('created_at', utcStart(to)).order('created_at', { ascending: true }))
  const fetchPayments = (from: string, to: string) => rows(() => supabase.from('payments').select('method,amount,created_at')
    .gte('created_at', utcStart(from)).lt('created_at', utcStart(to)).order('created_at', { ascending: true }))
  const fetchCredits = (from: string, to: string) => rows(() => supabase.from('v_credit_balances').select('*')
    .gte('created_at', utcStart(from)).lt('created_at', utcStart(to)).order('created_at', { ascending: true }))

  const [[dayOrderRows, monthOrderRows, priorOrderRows], [dayPaymentRows, monthPaymentRows], [dayCreditRows, allCreditRows]] = await Promise.all([
    Promise.all([fetchOrders(reportDate, dayAfter), fetchOrders(monthStart, dayAfter), fetchOrders(weekStart, reportDate)]),
    Promise.all([fetchPayments(reportDate, dayAfter), fetchPayments(monthStart, dayAfter)]),
    Promise.all([fetchCredits(reportDate, dayAfter), rows(() => supabase.from('v_credit_balances').select('*').order('created_at', { ascending: true }))]),
  ])

  const standaloneCreditIds = allCreditRows.filter(credit => credit.order_id == null).map(credit => String(credit.credit_id))
  let creditCollectionsToday = 0
  let creditCollectionsMonth = 0
  if (standaloneCreditIds.length) {
    const [todayPayments, monthPayments] = await Promise.all([
      rows(() => supabase.from('credit_payments').select('credit_id,amount,created_at').in('credit_id', standaloneCreditIds)
        .gte('created_at', utcStart(reportDate)).lt('created_at', utcStart(dayAfter))),
      rows(() => supabase.from('credit_payments').select('credit_id,amount,created_at').in('credit_id', standaloneCreditIds)
        .gte('created_at', utcStart(monthStart)).lt('created_at', utcStart(dayAfter))),
    ])
    creditCollectionsToday = todayPayments.reduce((sum, payment) => sum + Number(payment.amount ?? 0), 0)
    creditCollectionsMonth = monthPayments.reduce((sum, payment) => sum + Number(payment.amount ?? 0), 0)
  }

  const dayPayments = dayPaymentRows.map(row => ({ method: row.method as PaymentMethod, amount: Number(row.amount ?? 0) }))
  const monthPayments = monthPaymentRows.map(row => ({ method: row.method as PaymentMethod, amount: Number(row.amount ?? 0) }))
  const personalConsumptionToday = dayPayments.filter(payment => payment.method === 'personal_account').reduce((sum, payment) => sum + payment.amount, 0)
  const dayCredits = dayCreditRows.map(creditRecord)
  const bcvReference = await getReportBcvRate(reportDate, [...dayOrderRows, ...monthOrderRows, ...priorOrderRows])
  const publicSiteOrigin = getPublicSiteOrigin()
  const inlineImageAttachments: Array<{ content: string; filename: string; content_type: string; content_id: string }> = []
  const inlineAsset = async (path: string, contentId: string) => {
    try {
      const response = await fetch(`${publicSiteOrigin}${path}`)
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      const contentType = response.headers.get('content-type')?.split(';')[0] ?? ''
      if (!contentType.startsWith('image/')) throw new Error(`Unexpected content type: ${contentType || 'missing'}`)
      const bytes = new Uint8Array(await response.arrayBuffer())
      let binary = ''
      for (let offset = 0; offset < bytes.length; offset += 0x8000) {
        binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000))
      }
      inlineImageAttachments.push({
        content: btoa(binary),
        filename: path.split('/').pop() ?? 'report-image',
        content_type: contentType,
        content_id: contentId,
      })
      return `cid:${contentId}`
    } catch (error) {
      console.error(`No se pudo incrustar recurso del reporte ${path}:`, error instanceof Error ? error.message : 'unknown error')
      return `${publicSiteOrigin}${path}`
    }
  }
  const staticImageAssets = await Promise.all([
    inlineAsset('/logo.png', 'fullchina-logo@fullchina'),
    inlineAsset('/daily-sales-report-banner.jpg', 'fullchina-report-header@fullchina'),
    inlineAsset('/daily-sales-metrics/orders.png', 'fullchina-metric-orders@fullchina'),
    inlineAsset('/daily-sales-metrics/order-average.png', 'fullchina-metric-order-average@fullchina'),
    inlineAsset('/daily-sales-metrics/customers.png', 'fullchina-metric-customers@fullchina'),
    inlineAsset('/daily-sales-metrics/customer-average.png', 'fullchina-metric-customer-average@fullchina'),
  ])
  const data = buildDailySalesEmailData({
    reportDate, dayOrders: dayOrderRows.map(orderRecord), monthOrders: monthOrderRows.map(orderRecord),
    previousWeekdayOrders: priorOrderRows.map(orderRecord), dayPayments, monthPayments,
    dayCredits, openCredits: allCreditRows.map(creditRecord), creditCollectionsToday, creditCollectionsMonth,
    personalConsumptionToday, businessName: 'Full China',
    bcvRate: bcvReference.rate, bcvRateDate: bcvReference.date, bcvRateSource: bcvReference.source,
  })
  data.logoUrl = staticImageAssets[0]
  data.headerImageUrl = staticImageAssets[1]
  data.bcvBackgroundUrl = `${publicSiteOrigin}/daily-sales-bcv-bg.png`
  data.metricIcons = {
    'orders.png': staticImageAssets[2],
    'order-average.png': staticImageAssets[3],
    'customers.png': staticImageAssets[4],
    'customer-average.png': staticImageAssets[5],
  }
  const productIds = [...new Set(data.topItems.map(item => item.productId).filter((id): id is string => Boolean(id)))]
  if (productIds.length) {
    const { data: productRows, error: productImageError } = await supabase.from('sellable_products')
      .select('id,image_url').in('id', productIds)
    if (productImageError) console.error('No se pudieron cargar las fotos del top de productos:', productImageError.message)
    else {
      const imageById = new Map((productRows ?? []).map(product => {
        const imagePath = typeof product.image_url === 'string' ? product.image_url : null
        const dataImage = imagePath?.match(/^data:(image\/(?:png|jpe?g|webp|gif|avif));base64,([a-z0-9+/=\s]+)$/i)
        if (dataImage) {
          const mimeType = dataImage[1].toLowerCase().replace('jpg', 'jpeg')
          const contentId = `top-product-${String(product.id).replace(/[^a-z0-9-]/gi, '')}@fullchina`
          const extension = mimeType.split('/')[1].replace('jpeg', 'jpg')
          inlineImageAttachments.push({
            content: dataImage[2].replace(/\s+/g, ''),
            filename: `${contentId}.${extension}`,
            content_type: mimeType,
            content_id: contentId,
          })
          return [String(product.id), `cid:${contentId}`]
        }
        const match = imagePath?.match(/^\/productos\/([^/?#]+)\.(?:png|jpe?g|webp)([?#].*)?$/i)
        const optimized = match ? `/optimized/productos/${match[1]}.webp${match[2] || ''}` : imagePath
        return [String(product.id), optimized ? (/^https?:\/\//i.test(optimized) ? optimized : `${publicSiteOrigin}${optimized.startsWith('/') ? '' : '/'}${optimized}`) : null]
      }))
      data.topItems = data.topItems.map(item => ({ ...item, imageUrl: item.productId ? imageById.get(item.productId) ?? null : null }))
    }
  }
  const html = buildDailySalesEmailHtml({ ...data, currency: CURRENCY })
  const subject = `${sample ? '[Prueba] ' : ''}Full China · Reporte diario · ${reportDate}`
  const resendResponse = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json',
      ...(sample ? {} : { 'Idempotency-Key': `fullchina-daily-report-${reportDate}` }),
    },
    body: JSON.stringify({ from: sender, to: [sendTo], subject, html, ...(inlineImageAttachments.length ? { attachments: inlineImageAttachments } : {}) }),
  })
  const resendBody = await resendResponse.json().catch(() => ({})) as DbRow
  if (!resendResponse.ok) {
    console.error('No se pudo enviar reporte diario:', resendResponse.status, resendBody.name ?? resendBody.message ?? 'Resend error')
    return Response.json({ error: 'No se pudo enviar el reporte por correo.', providerStatus: resendResponse.status }, { status: 502 })
  }
  return Response.json({ sent: true, reportDate, recipient: sendTo, emailId: resendBody.id ?? null, mode: sample ? 'sample' : 'scheduled' })
}

export async function GET(request: Request): Promise<Response> {
  try {
    return await sendReport(request)
  } catch (error) {
    console.error('Error generando reporte diario:', error instanceof Error ? error.message : 'error desconocido')
    return Response.json({ error: 'No se pudo generar el reporte diario.' }, { status: 500 })
  }
}
