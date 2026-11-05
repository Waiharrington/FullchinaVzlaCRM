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
  const additionalRecipients = (environment.DAILY_SALES_REPORT_ADDITIONAL_TO ?? '')
    .split(',').map(address => address.trim()).filter(Boolean)
  const recipients = [...new Set([recipient?.trim(), ...additionalRecipients].filter((address): address is string => Boolean(address)))]
  const sender = environment.DAILY_SALES_REPORT_FROM ?? 'Full China <fullchinareportes@somosdostudio.com>'
  if (!supabaseUrl || !serviceKey || !resendKey || !cronSecret || recipients.length === 0) {
    return Response.json({ error: 'Faltan variables de configuración del reporte.' }, { status: 500 })
  }
  if (request.headers.get('authorization') !== `Bearer ${cronSecret}`) {
    return Response.json({ error: 'No autorizado.' }, { status: 401 })
  }

  const url = new URL(request.url)
  const sample = url.searchParams.get('sample') === '1'
  const manualResend = url.searchParams.get('resend') === '1'
  const requestedRecipient = sample || manualResend ? url.searchParams.get('to')?.trim() : null
  if (requestedRecipient && (requestedRecipient.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(requestedRecipient))) {
    return Response.json({ error: 'El destinatario de prueba no es válido.' }, { status: 400 })
  }
  const sendTo = requestedRecipient ? [requestedRecipient] : recipients
  const override = url.searchParams.get('date')
  const reportDate = override && /^\d{4}-\d{2}-\d{2}$/.test(override) ? override : shiftDate(dateKey(new Date()), -1)
  const dayAfter = shiftDate(reportDate, 1)
  const monthStart = `${reportDate.slice(0, 7)}-01`
  const priorWeekday = shiftDate(reportDate, -7)
  const priorWeekdayAfter = shiftDate(priorWeekday, 1)
  const supabase = createClient(supabaseUrl, serviceKey, {
    db: { schema: 'fullchinavzla' }, auth: { persistSession: false, autoRefreshToken: false },
  })
  const fetchOrders = (from: string, to: string) => rows(() => supabase.from('v_orders_with_credit_status').select('*')
    .gte('created_at', utcStart(from)).lt('created_at', utcStart(to)).order('created_at', { ascending: true }))
  const fetchPayments = (from: string, to: string) => rows(() => supabase.from('payments').select('order_id,method,amount,account_id,personal_account_id,received_amount,received_currency,received_exchange_rate,change_amount,change_currency,change_account_id,change_exchange_rate,created_at')
    .gte('created_at', utcStart(from)).lt('created_at', utcStart(to)).order('created_at', { ascending: true }))
  const fetchCredits = (from: string, to: string) => rows(() => supabase.from('v_credit_balances').select('*')
    .gte('created_at', utcStart(from)).lt('created_at', utcStart(to)).order('created_at', { ascending: true }))

  const [[dayOrderRows, monthOrderRows, priorOrderRows], [dayPaymentRows, monthPaymentRows], [dayCreditRows, allCreditRows]] = await Promise.all([
    Promise.all([fetchOrders(reportDate, dayAfter), fetchOrders(monthStart, dayAfter), fetchOrders(priorWeekday, priorWeekdayAfter)]),
    Promise.all([fetchPayments(reportDate, dayAfter), fetchPayments(monthStart, dayAfter)]),
    Promise.all([fetchCredits(reportDate, dayAfter), rows(() => supabase.from('v_credit_balances').select('*').order('created_at', { ascending: true }))]),
  ])

  const standaloneCreditIds = allCreditRows.filter(credit => credit.order_id == null).map(credit => String(credit.credit_id))
  let creditCollectionsToday = 0
  let creditCollectionsMonth = 0
  let creditPaymentRowsToday: DbRow[] = []
  let creditPaymentRowsMonth: DbRow[] = []
  if (standaloneCreditIds.length) {
    const [todayPayments, monthPayments] = await Promise.all([
      rows(() => supabase.from('credit_payments').select('credit_id,amount,method,reference_number,exchange_rate,account_id,received_amount,received_currency,received_exchange_rate,change_amount,change_currency,change_account_id,change_exchange_rate,created_at').in('credit_id', standaloneCreditIds)
        .gte('created_at', utcStart(reportDate)).lt('created_at', utcStart(dayAfter))),
      rows(() => supabase.from('credit_payments').select('credit_id,amount,method,reference_number,exchange_rate,account_id,received_amount,received_currency,received_exchange_rate,change_amount,change_currency,change_account_id,change_exchange_rate,created_at').in('credit_id', standaloneCreditIds)
        .gte('created_at', utcStart(monthStart)).lt('created_at', utcStart(dayAfter))),
    ])
    creditPaymentRowsToday = todayPayments
    creditPaymentRowsMonth = monthPayments
    creditCollectionsToday = todayPayments.reduce((sum, payment) => sum + Number(payment.amount ?? 0), 0)
    creditCollectionsMonth = monthPayments.reduce((sum, payment) => sum + Number(payment.amount ?? 0), 0)
  }

  const paymentRows = [...dayPaymentRows, ...monthPaymentRows, ...creditPaymentRowsToday, ...creditPaymentRowsMonth]
  const paymentAccountIds = [...new Set(paymentRows
    .flatMap(row => [row.account_id, row.change_account_id])
    .filter((id): id is string => typeof id === 'string' && Boolean(id)))]
  const personalAccountIds = [...new Set(dayPaymentRows.map(row => row.personal_account_id).filter((id): id is string => typeof id === 'string' && Boolean(id)))]
  const [paymentAccountRows, paymentOrderRows, personalAccountRows] = await Promise.all([
    paymentAccountIds.length
      ? rows(() => supabase.from('financial_accounts').select('id,currency,account_type').in('id', paymentAccountIds))
      : Promise.resolve([] as DbRow[]),
    (() => {
      const orderIds = [...new Set([...dayPaymentRows, ...monthPaymentRows].map(row => row.order_id).filter((id): id is string => typeof id === 'string' && Boolean(id)))]
      return orderIds.length
        ? rows(() => supabase.from('orders').select('id,bcv_rate').in('id', orderIds))
        : Promise.resolve([] as DbRow[])
    })(),
    personalAccountIds.length
      ? rows(() => supabase.from('personal_accounts').select('id,name').in('id', personalAccountIds))
      : Promise.resolve([] as DbRow[]),
  ])
  const accountsById = new Map(paymentAccountRows.map(row => [String(row.id), row]))
  const orderRateById = new Map(paymentOrderRows.map(row => [String(row.id), Number(row.bcv_rate ?? 0)]))
  const personalAccountsById = new Map(personalAccountRows.map(row => [String(row.id), String(row.name ?? 'Cuenta personal')]))
  const mapPayment = (row: DbRow, isCreditPayment = false) => {
    const account = accountsById.get(String(row.account_id ?? ''))
    const changeAccount = accountsById.get(String(row.change_account_id ?? ''))
    const accountCurrency: 'USD' | 'VES' | null = account?.currency === 'VES' ? 'VES' : account?.currency === 'USD' ? 'USD' : null
    const changeAccountCurrency: 'USD' | 'VES' | null = changeAccount?.currency === 'VES' ? 'VES' : changeAccount?.currency === 'USD' ? 'USD' : null
    return {
      method: row.method as PaymentMethod, amount: Number(row.amount ?? 0), accountId: row.account_id ?? null,
      accountCurrency, accountType: account?.account_type ?? null,
      personalAccountId: row.personal_account_id ?? null,
      personalAccountName: personalAccountsById.get(String(row.personal_account_id ?? '')) ?? null,
      receivedAmount: row.received_amount == null ? null : Number(row.received_amount),
      receivedCurrency: row.received_currency === 'VES' || row.received_currency === 'USD' ? row.received_currency : null,
      receivedExchangeRate: row.received_exchange_rate == null ? null : Number(row.received_exchange_rate),
      changeAmount: Number(row.change_amount ?? 0),
      changeCurrency: row.change_currency === 'VES' || row.change_currency === 'USD' ? row.change_currency : null,
      changeExchangeRate: row.change_exchange_rate == null ? null : Number(row.change_exchange_rate),
      changeAccountId: row.change_account_id ?? null, changeAccountCurrency, changeAccountType: changeAccount?.account_type ?? null,
      exchangeRate: isCreditPayment ? Number(row.exchange_rate ?? 0) || null : orderRateById.get(String(row.order_id ?? '')) ?? null,
    }
  }
  const dayPayments = dayPaymentRows.map(row => mapPayment(row))
  const monthPayments = monthPaymentRows.map(row => mapPayment(row))
  const creditCollectionPaymentsToday = creditPaymentRowsToday.map(row => mapPayment(row, true))
  const creditCollectionPaymentsMonth = creditPaymentRowsMonth.map(row => mapPayment(row, true))
  const personalConsumptionToday = dayPayments.filter(payment => payment.method === 'personal_account').reduce((sum, payment) => sum + payment.amount, 0)
  const personalConsumptionByAccount = [...dayPayments.filter(payment => payment.method === 'personal_account').reduce((totals, payment) => {
    const name = payment.personalAccountName ?? 'Cuenta personal sin identificar'
    totals.set(name, (totals.get(name) ?? 0) + payment.amount)
    return totals
  }, new Map<string, number>())].map(([name, amount]) => ({ name, amount }))
  const dayCredits = dayCreditRows.map(creditRecord)
  const bcvReference = await getReportBcvRate(reportDate, [...dayOrderRows, ...monthOrderRows, ...priorOrderRows])
  const publicSiteOrigin = getPublicSiteOrigin()
  const data = buildDailySalesEmailData({
    reportDate, dayOrders: dayOrderRows.map(orderRecord), monthOrders: monthOrderRows.map(orderRecord),
    previousWeekdayOrders: priorOrderRows.map(orderRecord), dayPayments, monthPayments,
    dayCredits, openCredits: allCreditRows.map(creditRecord), creditCollectionsToday, creditCollectionsMonth,
    creditCollectionPaymentsToday, creditCollectionPaymentsMonth,
    personalConsumptionToday, personalAccountConsumptionsToday: personalConsumptionByAccount, businessName: 'Full China',
    bcvRate: bcvReference.rate, bcvRateDate: bcvReference.date, bcvRateSource: bcvReference.source,
  })
  const imageUrl = (path: string) => `${publicSiteOrigin}${path}`
  data.headerImageUrl = imageUrl('/daily-sales-report-banner.jpg')
  data.bcvBackgroundUrl = `${publicSiteOrigin}/daily-sales-bcv-bg.png`
  data.metricIcons = {
    'orders.png': imageUrl('/daily-sales-metrics/orders.png'),
    'order-average.png': imageUrl('/daily-sales-metrics/order-average.png'),
    'customers.png': imageUrl('/daily-sales-metrics/customers.png'),
    'customer-average.png': imageUrl('/daily-sales-metrics/customer-average.png'),
  }
  const productIds = [...new Set(data.topItems.map(item => item.productId).filter((id): id is string => Boolean(id)))]
  if (productIds.length) {
    const { data: productRows, error: productImageError } = await supabase.from('sellable_products')
      .select('id,image_url').in('id', productIds)
    if (productImageError) console.error('No se pudieron cargar las fotos del top de productos:', productImageError.message)
    else {
      const imageById = new Map((productRows ?? []).map(product => {
        const imagePath = typeof product.image_url === 'string' ? product.image_url : null
        const isDataImage = /^data:image\//i.test(imagePath ?? '')
        const productId = String(product.id)
        const hasPublicOptimizedImage = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(productId)
        const match = imagePath?.match(/^\/productos\/([^/?#]+)\.(?:png|jpe?g|webp)([?#].*)?$/i)
        const optimized = isDataImage
          ? hasPublicOptimizedImage ? `/optimized/productos/${productId}.webp` : null
          : match ? `/optimized/productos/${match[1]}.webp${match[2] || ''}` : imagePath
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
      ...(sample || manualResend ? {} : { 'Idempotency-Key': `fullchina-daily-report-${reportDate}` }),
    },
    body: JSON.stringify({ from: sender, to: sendTo, subject, html }),
  })
  const resendBody = await resendResponse.json().catch(() => ({})) as DbRow
  if (!resendResponse.ok) {
    console.error('No se pudo enviar reporte diario:', resendResponse.status, resendBody.name ?? resendBody.message ?? 'Resend error')
    return Response.json({ error: 'No se pudo enviar el reporte por correo.', providerStatus: resendResponse.status }, { status: 502 })
  }
  return Response.json({ sent: true, reportDate, recipients: sendTo, emailId: resendBody.id ?? null, mode: sample ? 'sample' : manualResend ? 'manual' : 'scheduled' })
}

export async function GET(request: Request): Promise<Response> {
  try {
    return await sendReport(request)
  } catch (error) {
    console.error('Error generando reporte diario:', error instanceof Error ? error.message : 'error desconocido')
    return Response.json({ error: 'No se pudo generar el reporte diario.' }, { status: 500 })
  }
}
