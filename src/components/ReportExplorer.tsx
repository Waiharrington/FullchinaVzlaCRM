import { useCallback, useEffect, useMemo, useState } from 'react'
import { CalendarDays, Search, Star, ArrowLeft, FileSpreadsheet, ArrowUpDown, X } from 'lucide-react'
import { getAdvances, getAuditLogs, getCredits, getCustomers, getDailyCloses, getExpenses, getFinancialOperations, getIngredients, getLegacyDeletedOrdersReport, getLegacyPurchaseOrdersReport, getLegacySalesReport, getOrdersWithItems, getPayrollPayments, getProducts, getProductionBatches, getPurchases, getRecipeSummaries, getReportAdjustments, getReportAttendance, getReportEventLogs, getReportGiftCards, getReportRequisitions, getReportStockMovements, getWarehouseIngredients, type Advance, type AuditLog, type Credit, type DailyCloseSummary, type Expense, type FinancialOperation, type FullOrder, type Ingredient, type LegacyDeletedOrderReportRow, type LegacyPurchaseOrderReportRow, type LegacySaleReportRow, type PayrollPayment, type ProductionBatch, type Product, type Purchase, type ReportAdjustmentRow, type ReportAttendanceRow, type ReportEventRow, type ReportGiftCardRow, type ReportRequisitionRow, type StockMovement, type WarehouseIngredient } from '../lib/dataService'
import { dateKeyInTimeZone, formatUsd, formatVes } from '../lib/money'
import { buildReport, REPORTS, SOURCE_REPORT_IDS, type ReportData, type ReportId } from '../lib/reporting'
import './ReportExplorer.css'

type Loaded = ReportData & { family?: string; start?: string; end?: string }
const favoritesKey = 'fullchina-report-favorites'
const dateShift = (date: Date, days: number) => { const result = new Date(date); result.setDate(result.getDate() + days); return result }
const iso = (date: Date) => dateKeyInTimeZone(date)
const detailPaymentNames: Record<string, string> = { cash: 'Efectivo', mobile: 'Pago móvil', card: 'Punto de venta', transfer: 'Transferencia', binance: 'Binance', zelle: 'Zelle', other: 'Otro' }
const detailOrderType = (value: string) => ({ 'dine-in': 'Mesa', dine_in: 'Mesa', takeaway: 'Para llevar', delivery: 'Delivery', pickup: 'Para llevar' } as Record<string, string>)[value] ?? value
const detailUsesBolivares = (method: string) => method === 'mobile' || method === 'card' || method === 'transfer'
const downloadExcel =(name: string, columns: string[], rows: string[][]) => {
  const escape = (value: string) => value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
  const row = (values: string[]) => `<Row>${values.map(value => `<Cell><Data ss:Type="String">${escape(value)}</Data></Cell>`).join('')}</Row>`
  const workbook = `<?xml version="1.0"?><Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"><Worksheet ss:Name="Reporte"><Table>${row(columns)}${rows.map(row).join('')}</Table></Worksheet></Workbook>`
  const url = URL.createObjectURL(new Blob([workbook], { type: 'application/vnd.ms-excel' }))
  const link = document.createElement('a'); link.href = url; link.download = `${name}.xls`; link.click(); URL.revokeObjectURL(url)
}

export function ReportExplorer() {
  const [active, setActive] = useState<ReportId | null>(null)
  const [search, setSearch] = useState('')
  const [catalogPage, setCatalogPage] = useState(1)
  const [catalogPageSize, setCatalogPageSize] = useState(12)
  const [tableSearch, setTableSearch] = useState('')
  const [start, setStart] = useState(iso(dateShift(new Date(), -6)))
  const [end, setEnd] = useState(iso(new Date()))
  const [startHour, setStartHour] = useState('')
  const [endHour, setEndHour] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [sortColumn, setSortColumn] = useState<number | null>(null)
  const [sortAscending, setSortAscending] = useState(true)
  const [favorites, setFavorites] = useState<ReportId[]>(() => {
    try { return JSON.parse(localStorage.getItem(favoritesKey) ?? '[]') as ReportId[] } catch { return [] }
  })
  const [loaded, setLoaded] = useState<Loaded>({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [detailOrder, setDetailOrder] = useState<FullOrder | null>(null)
  const definition = REPORTS.find(report => report.id === active)
  const family = definition?.group

  const load = useCallback(async () => {
    if (!family || !active) return
    if (start > end) { setError('La fecha inicial no puede ser posterior a la fecha final.'); return }
    setLoading(true); setError('')
    let next: Loaded = { family, start, end }
    try {
        if (definition?.ready === false && !SOURCE_REPORT_IDS.has(active)) { setLoaded(next); setPage(1); return }
      const needsLegacySales = ['creditNotes', 'partialCreditNotes', 'taxes', 'creditNoteTaxes', 'discounts', 'tipsByOrder', 'tipsByPayment'].includes(active)
      if (needsLegacySales) { const legacySales: LegacySaleReportRow[] = await getLegacySalesReport(true); next = { ...next, legacySales } }
      if (active === 'deletedOrders' || active === 'itemDeleted') { const legacyDeletedOrders: LegacyDeletedOrderReportRow[] = await getLegacyDeletedOrdersReport(true); next = { ...next, legacyDeletedOrders } }
      if (active === 'legacyPurchaseOrders') { const legacyPurchaseOrders: LegacyPurchaseOrderReportRow[] = await getLegacyPurchaseOrdersReport(true); next = { ...next, legacyPurchaseOrders } }
      if (['orderTime', 'cashLogs', 'kdsLogs', 'precheckLogs', 'prebillPrintLogs', 'openDrawerLogs', 'kdsItems'].includes(active)) { const events: ReportEventRow[] = await getReportEventLogs(true); next = { ...next, events } }
      if (['tipsByEmployee', 'tipsAddedLogs'].includes(active)) { const adjustments: ReportAdjustmentRow[] = await getReportAdjustments(true); next = { ...next, adjustments } }
      if (['laborHours', 'employeeMarkings'].includes(active)) { const attendance: ReportAttendanceRow[] = await getReportAttendance(true); next = { ...next, attendance } }
      if (active === 'requisitions') { const requisitions: ReportRequisitionRow[] = await getReportRequisitions(true); next = { ...next, requisitions } }
      if (active === 'giftCards') { const giftCards: ReportGiftCardRow[] = await getReportGiftCards(true); next = { ...next, giftCards } }
      if (family === 'Ventas') {
        if (active === 'customersList') { const customers = await getCustomers(); next = { ...next, customers }; setLoaded(next); setPage(1); return }
        if (['productsList', 'products', 'menu', 'menuPublished', 'services', 'salesWithoutMovement'].includes(active)) { const products: Product[] = await getProducts(); next = { ...next, products }; if (active === 'productsList') { setLoaded(next); setPage(1); return } }
        const nextDay = iso(dateShift(new Date(`${end}T12:00:00`), 1))
        const orders: FullOrder[] = await getOrdersWithItems(`${start}T00:00:00-04:00`, `${nextDay}T00:00:00-04:00`, true)
        next = { ...next, orders }
      } else if (family === 'Finanzas') {
        if (['orderReconciliation', 'reconciliation', 'soldVsCollected', 'consolidatedPayments', 'generalLossGain', 'exchangeRates'].includes(active)) { const nextDay = iso(dateShift(new Date(`${end}T12:00:00`), 1)); const orders: FullOrder[] = await getOrdersWithItems(`${start}T00:00:00-04:00`, `${nextDay}T00:00:00-04:00`, true); next = { ...next, orders } }
        if (active === 'expenses') { const expenses: Expense[] = await getExpenses(start, end, true); next = { ...next, expenses } }
        if (active === 'generalLossGain') { const expenses: Expense[] = await getExpenses(start, end, true); next = { ...next, expenses } }
        if (active === 'laborCost') { const payrollPayments: PayrollPayment[] = await getPayrollPayments(true); next = { ...next, payrollPayments } }
        if (active === 'purchases' || active === 'purchaseItems') { const purchases: Purchase[] = await getPurchases(true); next = { ...next, purchases } }
        if (active === 'credits') { const credits: Credit[] = await getCredits(true); next = { ...next, credits } }
        if (active === 'closes') { const closes: DailyCloseSummary[] = await getDailyCloses(); next = { ...next, closes } }
        if (active === 'financialOperations') { const operations: FinancialOperation[] = await getFinancialOperations(start, end, true); next = { ...next, operations } }
        if (active === 'payrollPayments') { const payrollPayments: PayrollPayment[] = await getPayrollPayments(true); next = { ...next, payrollPayments } }
        if (active === 'advances') { const advances: Advance[] = await getAdvances(start, end, true); next = { ...next, advances } }
        if (active === 'auditLogs') { const auditLogs: AuditLog[] = await getAuditLogs(200, true); next = { ...next, auditLogs } }
      } else if (active === 'inventory' || active === 'recipes' || active === 'modifiersWithCosts' || active === 'warehouseInventory' || active === 'inventoryByWarehouse') {
        const ingredients: Ingredient[] = await getIngredients(); next = { ...next, ingredients }
        if (['warehouseInventory', 'inventoryByWarehouse'].includes(active)) { const warehouseIngredients: WarehouseIngredient[] = await getWarehouseIngredients(); next = { ...next, warehouseIngredients } }
        if (['products', 'recipes', 'menu', 'menuPublished', 'modifiersWithCosts'].includes(active)) { const products: Product[] = await getProducts(); next = { ...next, products } }
        if (active === 'recipes') { const recipeSummaries = await getRecipeSummaries(); next = { ...next, recipeSummaries } }
        if (active === 'modifiersWithCosts') { const nextDay = iso(dateShift(new Date(`${end}T12:00:00`), 1)); const orders: FullOrder[] = await getOrdersWithItems(`${start}T00:00:00-04:00`, `${nextDay}T00:00:00-04:00`, true); next = { ...next, orders } }
        if (['purchasedProducts', 'suppliersProducts', 'purchaseAdvanced', 'costsBySupplier'].includes(active)) { const purchases: Purchase[] = await getPurchases(true); next = { ...next, purchases } }
      } else if (active === 'productionWaste') {
        const batches: ProductionBatch[] = await getProductionBatches(start, end); next = { ...next, batches }
      } else {
        const nextDay = iso(dateShift(new Date(`${end}T12:00:00`), 1))
        const movements: StockMovement[] = await getReportStockMovements(`${start}T00:00:00-04:00`, `${nextDay}T00:00:00-04:00`); next = { ...next, movements }
      }
      setLoaded(next); setPage(1)
    } catch (cause) {
      const sourceMissing = SOURCE_REPORT_IDS.has(active) && typeof cause === 'object' && cause !== null && ('code' in cause && (cause as { code?: string }).code === '42P01' || 'status' in cause && (cause as { status?: number }).status === 404)
      if (sourceMissing) { setLoaded({ ...next, sourceUnavailable: true }); setPage(1); return }
      setError(cause instanceof Error ? cause.message : 'No se pudo cargar el reporte.')
    } finally { setLoading(false) }
  }, [active, definition?.ready, family, start, end])

  useEffect(() => { if (active) void load() }, [active, load])

  const table = useMemo(() => active && loaded.family === family && loaded.start === start && loaded.end === end ? buildReport(active, start, end, loaded, startHour, endHour) : null, [active, end, endHour, family, loaded, start, startHour])
  const filteredRows = useMemo(() => {
    const pairs = (table?.rows ?? []).map((row, index) => ({ row, orderId: table?.orderIds?.[index] }))
      .filter(pair => pair.row.join(' ').toLocaleLowerCase('es').includes(tableSearch.toLocaleLowerCase('es')))
    if (sortColumn === null) return pairs
    return [...pairs].sort((left, right) => left.row[sortColumn].localeCompare(right.row[sortColumn], 'es', { numeric: true, sensitivity: 'base' }) * (sortAscending ? 1 : -1))
  }, [sortAscending, sortColumn, table, tableSearch])
  const openOrderDetail = (orderId?: string) => {
    if (!orderId) return
    const order = (loaded.orders ?? []).find(o => o.id === orderId)
    if (order) setDetailOrder(order)
  }
  const pages = Math.max(1, Math.ceil(filteredRows.length / pageSize))
  const visibleRows = filteredRows.slice((Math.min(page, pages) - 1) * pageSize, Math.min(page, pages) * pageSize)
  const matching = REPORTS.filter(report => `${report.title} ${report.description} ${report.group}`.toLocaleLowerCase('es').includes(search.toLocaleLowerCase('es')))
  const catalogPages = Math.max(1, Math.ceil(matching.length / catalogPageSize))
  const visibleCatalogReports = matching.slice((Math.min(catalogPage, catalogPages) - 1) * catalogPageSize, Math.min(catalogPage, catalogPages) * catalogPageSize)
  const setPreset = (preset: string) => {
    const now = new Date()
    const today = iso(now)
    if (preset === 'Hoy') { setStart(today); setEnd(today) }
    if (preset === 'Ayer') { const yesterday = iso(dateShift(now, -1)); setStart(yesterday); setEnd(yesterday) }
    if (preset === 'Semana') { setStart(iso(dateShift(now, -((now.getDay() + 6) % 7)))); setEnd(today) }
    if (preset === 'Mes') { setStart(iso(new Date(now.getFullYear(), now.getMonth(), 1))); setEnd(today) }
  }
  const toggleFavorite = (id: ReportId) => {
    const next = favorites.includes(id) ? favorites.filter(value => value !== id) : [...favorites, id]
    setFavorites(next); localStorage.setItem(favoritesKey, JSON.stringify(next))
  }

  return <section className="report-explorer card" aria-label="Catálogo de reportes">
    {!active ? <>
      <div className="report-explorer-heading"><div><span className="report-eyebrow">CENTRO DE REPORTES</span><h2>Encuentra el dato que necesitas</h2><p>Reportes basados en las operaciones registradas en FullChina.</p></div><span className="report-count">{REPORTS.length} reportes disponibles</span></div>
      <label className="report-search"><Search size={19} /><input value={search} onChange={event => { setSearch(event.target.value); setCatalogPage(1) }} placeholder="Buscar reportes..." aria-label="Buscar reportes" /></label>
      {favorites.length > 0 && !search && <div className="report-group"><h3><Star size={16} /> Favoritos</h3><div className="report-links">{REPORTS.filter(report => favorites.includes(report.id)).map(report => <button key={report.id} className="report-link" onClick={() => setActive(report.id)}>{report.title}<span>Ver reporte →</span></button>)}</div></div>}
      {(['Ventas', 'Finanzas', 'Inventario'] as const).map(group => { const reports = visibleCatalogReports.filter(report => report.group === group); return reports.length ? <div className="report-group" key={group}><h3>{group}</h3><div className="report-links">{reports.map(report => <div className="report-link-row" key={report.id}><button className="report-link" onClick={() => { setTableSearch(''); setActive(report.id) }}><strong>{report.title}</strong><small>{report.description}</small><em>{report.ready === false ? 'Requiere módulo de datos' : 'Disponible'}</em></button><button className={`report-favorite ${favorites.includes(report.id) ? 'is-active' : ''}`} aria-label={`${favorites.includes(report.id) ? 'Quitar' : 'Añadir'} ${report.title} a favoritos`} onClick={() => toggleFavorite(report.id)}><Star size={18} fill={favorites.includes(report.id) ? 'currentColor' : 'none'} /></button></div>)}</div></div> : null })}
      {matching.length === 0 && <p className="report-empty">No hay reportes que coincidan con la búsqueda.</p>}
      {matching.length > 0 && <div className="report-pagination report-catalog-pagination" aria-label="Paginación del catálogo de reportes"><label>Reportes por página <select value={catalogPageSize} onChange={event => { setCatalogPageSize(Number(event.target.value)); setCatalogPage(1) }}><option value={12}>12</option><option value={24}>24</option><option value={48}>48</option></select></label><span>Página {Math.min(catalogPage, catalogPages)} de {catalogPages} · {matching.length} reportes</span><button onClick={() => setCatalogPage(value => Math.max(1, value - 1))} disabled={catalogPage <= 1}>Anterior</button><button onClick={() => setCatalogPage(value => Math.min(catalogPages, value + 1))} disabled={catalogPage >= catalogPages}>Siguiente</button></div>}
    </> : <>
      <div className="report-explorer-heading"><div><button className="report-back" onClick={() => setActive(null)}><ArrowLeft size={17} /> Todos los reportes</button><span className="report-eyebrow">{family?.toUpperCase()}</span><h2>{definition?.title}</h2><p>{definition?.description}</p></div></div>
      <div className="report-filters"><label><span>Fecha inicial</span><input type="date" value={start} onChange={event => setStart(event.target.value)} /></label><label><span>Fecha final</span><input type="date" value={end} onChange={event => setEnd(event.target.value)} /></label>{(family === 'Ventas' || active === 'movements') && <><label><span>Hora inicial</span><input type="time" value={startHour} onChange={event => { setStartHour(event.target.value); setPage(1) }} /></label><label><span>Hora final</span><input type="time" value={endHour} onChange={event => { setEndHour(event.target.value); setPage(1) }} /></label></>}<button className="report-refresh" onClick={() => void load()} disabled={loading}><CalendarDays size={17} /> {loading ? 'Cargando...' : 'Actualizar'}</button><div className="report-presets">{['Hoy', 'Ayer', 'Semana', 'Mes'].map(preset => <button key={preset} onClick={() => setPreset(preset)}>{preset}</button>)}</div>{table && !error && <div className="report-filters-tools"><label className="report-table-search"><Search size={16} /><input value={tableSearch} onChange={event => { setTableSearch(event.target.value); setPage(1) }} placeholder="Buscar en tabla..." aria-label="Buscar en tabla" /></label><button onClick={() => downloadExcel(active, table.columns, filteredRows.map(pair => pair.row))}><FileSpreadsheet size={16} /> Excel</button></div>}</div>
      {error && <p className="report-error" role="alert">{error}</p>}
      {table && !error && <>
        <div className="report-result-heading"><span>{filteredRows.length} resultados {table.total && <strong>· Total: {table.total}</strong>}</span></div>
        {table.note && <p className="report-note">{table.note}</p>}
        <div className="report-table-wrap"><table><thead><tr>{table.columns.map((column, index) => <th key={column}><button className="report-sort" onClick={() => { setSortColumn(index); setSortAscending(current => sortColumn === index ? !current : true); setPage(1) }}>{column}<ArrowUpDown size={13} aria-hidden="true" /></button></th>)}</tr></thead><tbody className="report-screen-rows">{visibleRows.map((pair, index) => <tr key={`${page}-${index}`} className={pair.orderId ? 'report-row-clickable' : ''} onClick={pair.orderId ? () => openOrderDetail(pair.orderId) : undefined} title={pair.orderId ? 'Ver detalle de la comanda' : undefined}>{pair.row.map((value, cell) => <td key={cell}>{value}</td>)}</tr>)}</tbody><tbody className="report-print-rows">{filteredRows.map((pair, index) => <tr key={index}>{pair.row.map((value, cell) => <td key={cell}>{value}</td>)}</tr>)}</tbody></table>{filteredRows.length === 0 && <p className="report-empty">No hay datos registrados para este período.</p>}</div>
        <div className="report-pagination"><label>Filas por página <select value={pageSize} onChange={event => { setPageSize(Number(event.target.value)); setPage(1) }}><option value={10}>10</option><option value={25}>25</option><option value={50}>50</option></select></label><span>Página {Math.min(page, pages)} de {pages}</span><button onClick={() => setPage(value => Math.max(1, value - 1))} disabled={page <= 1}>Anterior</button><button onClick={() => setPage(value => Math.min(pages, value + 1))} disabled={page >= pages}>Siguiente</button></div>
      </>}
    </>}
    {detailOrder && (() => {
      const order = detailOrder
      const rate = order.bcvRate ?? 0
      const itemsSubtotal = order.items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0)
      return <div className="report-detail-overlay" role="presentation" onClick={() => setDetailOrder(null)}>
        <div className="report-detail-modal" role="dialog" aria-modal="true" aria-label={`Comanda ${order.orderNumber}`} onClick={event => event.stopPropagation()}>
          <div className="report-detail-head">
            <div>
              <span className="report-eyebrow">COMANDA</span>
              <h3>#{order.orderNumber}</h3>
              <p>{order.customerName || 'Cliente'} · {order.tableNumber ? `Mesa ${order.tableNumber}` : detailOrderType(order.orderType)} · {dateKeyInTimeZone(new Date(order.createdAt))} {new Intl.DateTimeFormat('en-GB', { timeZone: 'America/Caracas', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(order.createdAt))}</p>
            </div>
            <button type="button" className="report-detail-close" onClick={() => setDetailOrder(null)} aria-label="Cerrar"><X size={18} /></button>
          </div>
          <div className="report-detail-body">
            <table className="report-detail-items"><thead><tr><th>Producto</th><th>Cant.</th><th>P. unit</th><th>Subtotal</th></tr></thead><tbody>
              {order.items.map(item => <tr key={item.id}><td>{item.productName}</td><td>{item.quantity}</td><td>{formatUsd(item.unitPrice)}</td><td>{formatUsd(item.quantity * item.unitPrice)}</td></tr>)}
            </tbody></table>
            <div className="report-detail-totals">
              <div><span>Subtotal ítems</span><strong>{formatUsd(itemsSubtotal)}</strong></div>
              {Math.abs(order.totalAmount - itemsSubtotal) > 0.001 && <div><span>Otros / delivery</span><strong>{formatUsd(order.totalAmount - itemsSubtotal)}</strong></div>}
              <div className="report-detail-total"><span>Total</span><strong>{formatUsd(order.totalAmount)}{rate > 0 ? ` · ${formatVes(order.totalAmount * rate)}` : ''}</strong></div>
              {rate > 0 && <div className="report-detail-rate"><span>Tasa del día</span><strong>{formatVes(rate)}</strong></div>}
            </div>
            <h4 className="report-detail-subtitle">Pagos</h4>
            {order.payments.length === 0 ? <p className="report-empty">Sin pagos registrados.</p> : <div className="report-detail-payments">
              {order.payments.map((payment, index) => {
                const bs = detailUsesBolivares(payment.method) && rate > 0
                return <div className="report-detail-payment" key={index}>
                  <span>{detailPaymentNames[payment.method] ?? payment.method}{payment.referenceNumber ? ` · Ref. ${payment.referenceNumber}` : ''}</span>
                  <strong>{bs ? <>{formatVes(payment.amount * rate)} <small>({formatUsd(payment.amount)})</small></> : formatUsd(payment.amount)}</strong>
                </div>
              })}
            </div>}
          </div>
        </div>
      </div>
    })()}
  </section>
}
