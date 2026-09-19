import { dateKeyInTimeZone, formatUsd, formatVes } from './money'
import type { Advance, AuditLog, Credit, DailyCloseSummary, Expense, FinancialOperation, FullOrder, Ingredient, PayrollPayment, ProductionBatch, Purchase, StockMovement, Customer, Product, LegacySaleReportRow, LegacyDeletedOrderReportRow, LegacyPurchaseOrderReportRow, ReportEventRow, ReportAdjustmentRow, ReportAttendanceRow, ReportRequisitionRow, ReportGiftCardRow, WarehouseIngredient, RecipeSummary } from './dataService'

export type ReportId = 'orders' | 'items' | 'categories' | 'payments' | 'tables' | 'orderTypes' | 'hours' | 'customers' | 'expenses' | 'purchases' | 'purchaseItems' | 'credits' | 'closes' | 'inventory' | 'movements' | 'productionWaste' | string
export type ReportGroup = 'Ventas' | 'Finanzas' | 'Inventario'
export interface ReportDefinition { id: ReportId; title: string; group: ReportGroup; description: string; ready?: boolean; requirement?: string }
export interface ReportTable { columns: string[]; rows: string[][]; total?: string; note?: string; orderIds?: string[] }
export interface ReportData { orders?: FullOrder[]; expenses?: Expense[]; purchases?: Purchase[]; credits?: Credit[]; closes?: DailyCloseSummary[]; ingredients?: Ingredient[]; warehouseIngredients?: WarehouseIngredient[]; movements?: StockMovement[]; batches?: ProductionBatch[]; customers?: Customer[]; operations?: FinancialOperation[]; payrollPayments?: PayrollPayment[]; advances?: Advance[]; auditLogs?: AuditLog[]; products?: Product[]; recipeSummaries?: Map<string, RecipeSummary>; legacySales?: LegacySaleReportRow[]; legacyDeletedOrders?: LegacyDeletedOrderReportRow[]; legacyPurchaseOrders?: LegacyPurchaseOrderReportRow[]; events?: ReportEventRow[]; adjustments?: ReportAdjustmentRow[]; attendance?: ReportAttendanceRow[]; requisitions?: ReportRequisitionRow[]; giftCards?: ReportGiftCardRow[]; sourceUnavailable?: boolean }

export const REPORTS: ReportDefinition[] = [
  { id: 'orders', title: 'Órdenes cerradas', group: 'Ventas', description: 'Comandas cobradas, cliente, mesa y total' },
  { id: 'items', title: 'Ventas por ítem', group: 'Ventas', description: 'Unidades e ingresos por producto' },
  { id: 'categories', title: 'Ventas por categoría', group: 'Ventas', description: 'Ingresos y unidades por grupo del menú' },
  { id: 'payments', title: 'Por tipo de pago', group: 'Ventas', description: 'Pagos registrados por método' },
  { id: 'tables', title: 'Órdenes por mesa', group: 'Ventas', description: 'Cantidad y ventas por mesa' },
  { id: 'orderTypes', title: 'Tipo de órdenes', group: 'Ventas', description: 'Mesa, para llevar y delivery' },
  { id: 'hours', title: 'Ventas por hora', group: 'Ventas', description: 'Horas de mayor movimiento' },
  { id: 'customers', title: 'Ventas por cliente', group: 'Ventas', description: 'Clientes identificados y frecuencia' },
  { id: 'expenses', title: 'Gastos por categoría', group: 'Finanzas', description: 'Egresos registrados y sus conceptos' },
  { id: 'purchases', title: 'Compras por proveedor', group: 'Finanzas', description: 'Compras vigentes agrupadas por proveedor' },
  { id: 'purchaseItems', title: 'Productos comprados', group: 'Finanzas', description: 'Cantidades y costos de insumos adquiridos' },
  { id: 'credits', title: 'Cuentas por cobrar', group: 'Finanzas', description: 'Créditos y saldo pendiente por cliente' },
  { id: 'closes', title: 'Cierres diarios de caja', group: 'Finanzas', description: 'Ventas, pagos y balance calculado de cada cierre' },
  { id: 'inventory', title: 'Inventario actual', group: 'Inventario', description: 'Existencias y valor del stock operativo' },
  { id: 'movements', title: 'Historial de inventario', group: 'Inventario', description: 'Entradas, salidas y ajustes registrados' },
  { id: 'productionWaste', title: 'Mermas de producción', group: 'Inventario', description: 'Cantidad y porcentaje de merma de cada preparación' },
  { id: 'customersList', title: 'Clientes', group: 'Ventas', description: 'Clientes activos, visitas y última compra', ready: true },
  { id: 'financialOperations', title: 'Operaciones financieras', group: 'Finanzas', description: 'Transferencias, cobros, ajustes y movimientos confirmados', ready: true },
  { id: 'payrollPayments', title: 'Pagos de nómina', group: 'Finanzas', description: 'Pagos efectuados a empleados', ready: true },
  { id: 'advances', title: 'Adelantos de salario', group: 'Finanzas', description: 'Adelantos y estado de deducción', ready: true },
  { id: 'auditLogs', title: 'Auditoría del sistema', group: 'Finanzas', description: 'Acciones importantes registradas por usuario', ready: true },
  { id: 'productsList', title: 'Catálogo de productos', group: 'Ventas', description: 'Productos activos y precios actuales', ready: true },
]

// Catálogo adicional inspirado en Invu. Estos nombres ya forman parte de la
// navegación para que el módulo sea extensible; se habilitan al existir el
// registro fuente en FullChina y nunca se muestran como datos inventados.
const plannedReports: Array<Omit<ReportDefinition, 'ready'>> = [
  ['itemDeleted', 'Ítems eliminados en órdenes', 'Ventas', 'Auditoría de líneas eliminadas', 'Historial de cambios de comandas'],
  ['creditNotes', 'Notas de crédito', 'Finanzas', 'Notas de crédito y devoluciones', 'Flujo de notas de crédito'],
  ['openOrders', 'Órdenes abiertas', 'Ventas', 'Comandas aún no cobradas', 'Estados y filtros de comandas'],
  ['deletedOrders', 'Órdenes eliminadas', 'Ventas', 'Órdenes anuladas o eliminadas', 'Auditoría de anulaciones'],
  ['orderReconciliation', 'Reconciliación de órdenes', 'Finanzas', 'Ventas contra pagos y caja', 'Conciliación contable'],
  ['orderTime', 'Tiempo de orden', 'Ventas', 'Tiempo desde creación hasta entrega', 'Tiempos de cocina y entrega'],
  ['cashLogs', 'Logs de caja', 'Finanzas', 'Eventos de caja y turnos', 'Bitácora de caja'],
  ['tipsByEmployee', 'Propinas por empleado', 'Finanzas', 'Propinas distribuidas por empleado', 'Registro de propinas'],
  ['tipsByOrder', 'Propinas por orden', 'Finanzas', 'Propina asociada a cada comanda', 'Registro de propinas'],
  ['tipsByPayment', 'Propinas por tipo de pago', 'Finanzas', 'Propinas agrupadas por método', 'Registro de propinas'],
  ['commissions', 'Comisiones', 'Finanzas', 'Comisiones generadas y pagadas', 'Reglas de comisión'],
  ['laborHours', 'Horas laborales', 'Finanzas', 'Horas trabajadas por empleado', 'Marcaciones de empleados'],
  ['laborCost', 'Costo laboral', 'Finanzas', 'Costo de personal por período', 'Marcaciones y tarifas'],
  ['primeCosts', 'Costos primos', 'Finanzas', 'Insumos más mano de obra', 'Cierre contable de costos'],
  ['taxes', 'Impuestos', 'Finanzas', 'Impuestos cobrados por venta', 'Configuración fiscal'],
  ['creditNoteTaxes', 'Impuestos por notas de crédito', 'Finanzas', 'Impuestos de devoluciones', 'Notas de crédito e impuestos'],
  ['shrinkage', 'Mermas', 'Inventario', 'Pérdidas de inventario por motivo', 'Motivos de merma normalizados'],
  ['inventoryUsage', 'Uso de inventario', 'Inventario', 'Consumo de insumos por período', 'Valorización de recetas'],
  ['inventoryUsageAdvanced', 'Uso de inventario avanzado', 'Inventario', 'Consumo detallado por receta', 'Valorización de recetas'],
  ['requisitions', 'Requisiciones', 'Inventario', 'Solicitudes internas de insumos', 'Módulo de requisiciones'],
  ['warehouseInventory', 'Inventario por bodega', 'Inventario', 'Existencias por ubicación', 'Múltiples bodegas'],
  ['exchangeRates', 'Tasas de cambio', 'Finanzas', 'Historial de tasas BCV usadas', 'Historial de tasas'],
  ['deposits', 'Depósitos', 'Finanzas', 'Depósitos bancarios registrados', 'Módulo de depósitos'],
  ['employeeMarkings', 'Marcaciones', 'Finanzas', 'Entradas y salidas de empleados', 'Módulo de asistencia'],
  ['salesByRegister', 'Ventas por caja', 'Ventas', 'Ventas separadas por caja', 'Identificador de caja por venta'],
  ['salesByEmployee', 'Ventas por empleado', 'Ventas', 'Ventas asignadas a cada empleado', 'Asignación de vendedor'],
  ['salesByGroup', 'Ventas por grupo', 'Ventas', 'Ventas por grupo de productos', 'Grupos comerciales'],
  ['salesBySection', 'Ventas por sección', 'Ventas', 'Ventas por sección del menú', 'Secciones del menú'],
  ['salesByBranch', 'Ventas por sucursal', 'Ventas', 'Ventas por sucursal', 'Multi-sucursal'],
  ['discounts', 'Descuentos', 'Ventas', 'Descuentos aplicados por orden', 'Registro de descuentos'],
  ['modifiers', 'Modificadores', 'Ventas', 'Opciones y extras vendidos', 'Líneas de modificadores'],
  ['salesWithoutMovement', 'Productos sin ventas', 'Ventas', 'Productos que no tuvieron ventas', 'Catálogo y período'],
  ['averageInventoryUsage', 'Uso promedio de inventario', 'Inventario', 'Promedio de consumo por día', 'Valorización de recetas'],
  ['salesByWeek', 'Ventas por semanas', 'Ventas', 'Comparativo semanal', 'Calendario fiscal'],
  ['salesByYear', 'Ventas por año', 'Ventas', 'Acumulado anual', 'Calendario fiscal'],
  ['masterReport', 'Reporte maestro', 'Ventas', 'Resumen consolidado del sistema', 'Modelo consolidado de reportes'],
  ['salesDetail', 'Detalle consolidado de ventas', 'Ventas', 'Detalle exportable de cada venta', 'Campos fiscales y de venta'],
  ['products', 'Productos', 'Inventario', 'Catálogo completo de productos', 'Catálogo de productos'],
  ['menu', 'Menú', 'Ventas', 'Configuración publicada del menú', 'Catálogo de menú'],
  ['recipes', 'Recetas', 'Inventario', 'Componentes y costos de recetas', 'Costo histórico de recetas'],
  ['purchasedProducts', 'Productos comprados', 'Inventario', 'Historial de compras por producto', 'Detalle de compras'],
  ['suppliersProducts', 'Proveedores de productos', 'Inventario', 'Relación proveedor-insumo', 'Relación de proveedores'],
  ['generalCosts', 'Costos generales', 'Finanzas', 'Costos operativos no asociados a ventas', 'Clasificación contable'],
  ['giftCards', 'Gift cards utilizadas', 'Finanzas', 'Recargas y uso de tarjetas regalo', 'Módulo de gift cards'],
  ['donations', 'Donaciones por tipo de pago', 'Finanzas', 'Donaciones recibidas por método', 'Registro de donaciones'],
  ['services', 'Servicios', 'Ventas', 'Servicios y cargos adicionales', 'Catálogo de servicios'],
  ['customerFavorite', 'Cliente favorito', 'Ventas', 'Clientes con mayor recurrencia', 'Historial de clientes'],
  ['customerByItem', 'Cliente por ítem', 'Ventas', 'Clientes que compraron un producto', 'Historial detallado de clientes'],
  ['customerByCategory', 'Cliente por categoría', 'Ventas', 'Clientes por categoría comprada', 'Historial detallado de clientes'],
  ['productByEmployee', 'Ítem por empleado', 'Ventas', 'Productos vendidos por empleado', 'Asignación de vendedor'],
  ['generalLossGain', 'Ganancia y pérdida', 'Finanzas', 'Resultado financiero consolidado', 'Modelo contable completo'],
  ['fiscalTemplate', 'Plantilla fiscal', 'Finanzas', 'Exportación para sistema fiscal', 'Definición fiscal y país'],
  ['legacyPurchaseOrders', 'Órdenes de compra importadas', 'Inventario', 'Órdenes de compra históricas de Invu', 'Historial importado de órdenes de compra'],
  ['reportZ', 'Reporte Z', 'Finanzas', 'Cierre fiscal y contable de caja', 'Reglas fiscales y cierre certificado'],
  ['reconciliation', 'Reconciliación', 'Finanzas', 'Ventas contra cobros y movimientos', 'Conciliación de órdenes y pagos'],
  ['beepers', 'Beepers', 'Finanzas', 'Asignaciones y cobros de beepers', 'Módulo de beepers'],
  ['soldVsCollected', 'Vendido vs cobrado', 'Finanzas', 'Comparación de ventas y cobros', 'Conciliación de ventas'],
  ['costsBySupplier', 'Costos por proveedor', 'Finanzas', 'Costos comprados por proveedor', 'Historial de costos'],
  ['donationsByPayment', 'Donaciones por tipo de pago', 'Finanzas', 'Donaciones agrupadas por método', 'Registro de donaciones'],
  ['itemsDeletedLogs', 'Ítems eliminados en órdenes', 'Ventas', 'Detalle de ítems anulados', 'Auditoría de líneas eliminadas'],
  ['partialCreditNotes', 'Notas de crédito parciales', 'Finanzas', 'Devoluciones parciales por orden', 'Flujo de notas de crédito'],
  ['precheckLogs', 'Logs de precuentas', 'Ventas', 'Impresiones y eventos de precuenta', 'Eventos de impresión'],
  ['xLogs', 'Logs X', 'Ventas', 'Eventos del reporte X', 'Cierres y eventos de caja'],
  ['zLogs', 'Logs Z', 'Ventas', 'Eventos del reporte Z', 'Cierres y eventos de caja'],
  ['beeperLogs', 'Logs de beepers', 'Ventas', 'Eventos de beepers', 'Módulo de beepers'],
  ['kdsLogs', 'Logs de cocina (KDS)', 'Ventas', 'Estados y tiempos de cocina', 'Eventos KDS'],
  ['kdsItems', 'Ítems KDS', 'Ventas', 'Detalle de preparación en cocina', 'Eventos KDS por ítem'],
  ['giftCardReloads', 'Recargas de gift cards', 'Finanzas', 'Recargas de tarjetas regalo', 'Módulo de gift cards'],
  ['fiscalNumberChanges', 'Cambios de números fiscales', 'Finanzas', 'Historial de cambios fiscales', 'Auditoría fiscal'],
  ['tipsAddedLogs', 'Logs de propinas agregadas', 'Finanzas', 'Auditoría de propinas agregadas', 'Registro de propinas'],
  ['longReportLogs', 'Logs de reporte largo', 'Ventas', 'Eventos de reportes extensos', 'Auditoría de reportes'],
  ['openOrderItems', 'Ítems en órdenes abiertas', 'Ventas', 'Detalle de comandas sin cobrar', 'Órdenes abiertas'],
  ['consolidatedPayments', 'Pagos consolidados', 'Finanzas', 'Pagos agrupados por período', 'Conciliación de pagos'],
  ['openDrawerLogs', 'Logs de apertura de cajón', 'Finanzas', 'Aperturas del cajón de caja', 'Eventos de caja'],
  ['prebillPrintLogs', 'Logs de impresión de precuenta', 'Ventas', 'Impresiones de precuentas', 'Eventos de impresión'],
  ['purchaseAdvanced', 'Compras avanzadas', 'Inventario', 'Detalle avanzado de compras', 'Historial ampliado de compras'],
  ['reversedPurchaseOrders', 'Órdenes de compra revertidas', 'Inventario', 'Compras revertidas', 'Auditoría de compras'],
  ['requisitionsAdvanced', 'Requisiciones avanzadas', 'Inventario', 'Detalle de solicitudes internas', 'Módulo de requisiciones'],
  ['inventoryByWarehouse', 'Inventario por bodega', 'Inventario', 'Existencias separadas por bodega', 'Ubicaciones de inventario'],
  ['subcategories', 'Ventas por subcategoría', 'Ventas', 'Ventas por subcategoría del menú', 'Subcategorías comerciales'],
  ['certificates', 'Certificados', 'Ventas', 'Certificados y documentos de venta', 'Módulo de certificados'],
  ['collections', 'Colecciones', 'Ventas', 'Ventas por colección', 'Colecciones del menú'],
  ['families', 'Ventas por familia', 'Ventas', 'Ventas por familia comercial', 'Familias del menú'],
  ['modifiersAdvanced', 'Modificadores avanzados', 'Ventas', 'Modificadores con detalle de empleado', 'Líneas de modificadores'],
  ['invuPayOrders', 'Órdenes Invu Pay', 'Ventas', 'Órdenes cobradas con Invu Pay', 'Integración de pagos'],
  ['usageAverageInventory', 'Uso promedio de inventario', 'Inventario', 'Promedio de consumo valorizado', 'Valorización de recetas'],
  ['employeesModifiers', 'Empleados y modificadores', 'Ventas', 'Modificadores asignados por empleado', 'Líneas de modificadores'],
  ['masterReportAdvanced', 'Reporte maestro avanzado', 'Ventas', 'Consolidado completo de ventas y pagos', 'Modelo consolidado fiscal'],
  ['menuPublished', 'Menú publicado', 'Ventas', 'Versión publicada del menú', 'Catálogo del menú'],
  ['modifiersWithCosts', 'Modificadores con costos', 'Inventario', 'Costo de modificadores', 'Costo de recetas'],
  ['requisitionProducts', 'Productos de requisiciones', 'Inventario', 'Productos solicitados internamente', 'Módulo de requisiciones'],
  ['itemMovementLogs', 'Logs de movimientos de ítems', 'Inventario', 'Auditoría de movimientos de productos', 'Auditoría de inventario'],
].map(([id, title, group, description, requirement]) => ({ id, title, group: group as ReportGroup, description, requirement, ready: false }))
REPORTS.push(...plannedReports)
// Estos reportes ya pueden resolverse con las fuentes operativas existentes.
// El resto permanece explícitamente pendiente hasta que exista su módulo de
// origen, evitando presentar cifras simuladas.
export const SOURCE_REPORT_IDS = new Set<ReportId>(['orderTime', 'cashLogs', 'kdsLogs', 'precheckLogs', 'prebillPrintLogs', 'openDrawerLogs', 'kdsItems', 'tipsByEmployee', 'tipsAddedLogs', 'laborHours', 'employeeMarkings', 'requisitions', 'giftCards'])
const operationalReportIds = new Set<ReportId>(['orders', 'items', 'categories', 'payments', 'tables', 'orderTypes', 'hours', 'customers', 'expenses', 'purchases', 'purchaseItems', 'credits', 'closes', 'inventory', 'movements', 'productionWaste', 'customersList', 'financialOperations', 'payrollPayments', 'advances', 'auditLogs', 'productsList', 'openOrders', 'salesDetail', 'salesByWeek', 'salesByYear', 'salesByEmployee', 'salesBySection', 'salesByGroup', 'customerFavorite', 'customerByItem', 'customerByCategory', 'productByEmployee', 'salesWithoutMovement', 'creditNotes', 'partialCreditNotes', 'deletedOrders', 'taxes', 'creditNoteTaxes', 'discounts', 'tipsByOrder', 'tipsByPayment', 'legacyPurchaseOrders', 'inventoryUsage', 'inventoryUsageAdvanced', 'shrinkage', 'averageInventoryUsage', 'orderReconciliation', 'reconciliation', 'consolidatedPayments', 'soldVsCollected', 'exchangeRates', 'laborCost', 'products', 'menu', 'menuPublished', 'recipes', 'purchasedProducts', 'purchaseAdvanced', 'suppliersProducts', 'costsBySupplier', 'generalLossGain', 'modifiers', 'modifiersAdvanced', 'modifiersWithCosts', 'warehouseInventory', 'inventoryByWarehouse', ...SOURCE_REPORT_IDS])
for (const report of REPORTS) if (operationalReportIds.has(report.id)) report.ready = true

const localDate = (value: string) => dateKeyInTimeZone(new Date(value))
const localTime = (value: string) => new Intl.DateTimeFormat('en-GB', { timeZone: 'America/Caracas', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(value))
const inRange = (value: string, start: string, end: string, startHour = '', endHour = '') => {
  const day = value.includes('T') ? localDate(value) : value.slice(0, 10)
  if (day < start || day > end) return false
  if (!value.includes('T') || (!startHour && !endHour)) return true
  const time = localTime(value)
  return time >= (startHour || '00:00') && time <= (endHour || '23:59')
}
const count = (value: number) => Number(value.toFixed(3)).toLocaleString('es-VE')
const total = (rows: Array<{ amount: number }>) => formatUsd(rows.reduce((sum, row) => sum + row.amount, 0))
const ordered = <T extends { amount: number }>(rows: T[]) => rows.sort((a, b) => b.amount - a.amount)
const aggregate = <T>(items: T[], key: (item: T) => string, amount: (item: T) => number, quantity: (item: T) => number = () => 1) => {
  const map = new Map<string, { label: string; quantity: number; amount: number }>()
  for (const item of items) {
    const label = key(item) || 'Sin asignar'
    const row = map.get(label) ?? { label, quantity: 0, amount: 0 }
    row.quantity += quantity(item)
    row.amount += amount(item)
    map.set(label, row)
  }
  return ordered([...map.values()])
}
const grouped = (rows: Array<{ label: string; quantity: number; amount: number }>, first: string, second = 'Cantidad'): ReportTable => ({
  columns: [first, second, 'Total (USD)'],
  rows: rows.map(row => [row.label, count(row.quantity), formatUsd(row.amount)]),
  total: total(rows),
})
const paymentNames: Record<string, string> = { cash: 'Efectivo', mobile: 'Pago móvil', card: 'Punto de venta', transfer: 'Transferencia', binance: 'Binance', zelle: 'Zelle', other: 'Otro' }
const orderTypeName = (value: string) => ({ 'dine-in': 'Mesa', dine_in: 'Mesa', dinein: 'Mesa', takeaway: 'Para llevar', delivery: 'Delivery', pickup: 'Para llevar' } as Record<string, string>)[value] ?? value
// Métodos que se cobran en bolívares (el monto guardado está en USD; el Bs se
// obtiene multiplicando por la tasa del día del pedido).
const paymentUsesBolivares = (method: string) => method === 'mobile' || method === 'card' || method === 'transfer'
const orderPaymentMethods = (order: FullOrder) => {
  const names = [...new Set((order.payments ?? []).map(p => paymentNames[p.method] ?? p.method))]
  return names.length === 0 ? '—' : names.length === 1 ? names[0] : names.join(' + ')
}
const orderAmountSummary = (order: FullOrder) => {
  const rate = order.bcvRate ?? 0
  const paidUsdBs = (order.payments ?? []).filter(p => paymentUsesBolivares(p.method)).reduce((s, p) => s + p.amount, 0)
  const paidUsdUsd = (order.payments ?? []).filter(p => !paymentUsesBolivares(p.method)).reduce((s, p) => s + p.amount, 0)
  if (paidUsdBs > 0 && paidUsdUsd <= 0.001) {
    // Pagado en Bs: monto en Bs y referencia en USD del día.
    return rate > 0 ? `${formatVes(paidUsdBs * rate)}  (${formatUsd(paidUsdBs)})` : formatUsd(paidUsdBs)
  }
  if (paidUsdBs <= 0.001) return formatUsd(paidUsdUsd || order.totalAmount) // solo dólares
  // Mixto: parte en USD y parte en Bs.
  return `${formatUsd(paidUsdUsd)} + ${rate > 0 ? formatVes(paidUsdBs * rate) : formatUsd(paidUsdBs)}`
}

export function buildReport(id: ReportId, start: string, end: string, data: ReportData, startHour = '', endHour = ''): ReportTable {
  if (data.sourceUnavailable) return { columns: ['Estado', 'Reporte', 'Detalle'], rows: [['Fuente pendiente', REPORTS.find(report => report.id === id)?.title ?? id, 'Aplica la migración de fuentes de reportes para habilitar este reporte.']], note: 'Este reporte se activará automáticamente cuando exista su fuente de datos.' }
  const paid = (data.orders ?? []).filter(order => order.status === 'paid' && inRange(order.createdAt, start, end, startHour, endHour))
  const salesItems = paid.flatMap(order => order.items)
  switch (id) {
    case 'orders': return {
      columns: ['Fecha', 'Hora', 'Comanda', 'Cliente', 'Tipo / mesa', 'Ítems', 'Método de pago', 'Tasa del día', 'Cobrado'],
      rows: paid.map(order => [localDate(order.createdAt), localTime(order.createdAt), `#${order.orderNumber}`, order.customerName || 'Cliente', order.tableNumber ? `Mesa ${order.tableNumber}` : orderTypeName(order.orderType), count(order.items.reduce((sum, item) => sum + item.quantity, 0)), orderPaymentMethods(order), order.bcvRate ? formatVes(order.bcvRate) : '—', orderAmountSummary(order)]),
      total: formatUsd(paid.reduce((sum, order) => sum + order.totalAmount, 0)),
      orderIds: paid.map(order => order.id),
    }
    case 'items': return { ...grouped(aggregate(salesItems, item => item.productName, item => item.quantity * item.unitPrice, item => item.quantity), 'Producto', 'Unidades'), note: 'El total proviene de líneas de productos; puede diferir de ventas brutas por delivery u otros cargos.' }
    case 'categories': return { ...grouped(aggregate(salesItems, item => item.category, item => item.quantity * item.unitPrice, item => item.quantity), 'Categoría', 'Unidades'), note: 'El total proviene de líneas de productos; puede diferir de ventas brutas por delivery u otros cargos.' }
    case 'payments': return {
      ...grouped(aggregate(paid.flatMap(order => order.payments), payment => paymentNames[payment.method] ?? payment.method, payment => payment.amount), 'Método de pago', 'Pagos'),
      note: 'Totaliza los pagos registrados; una comanda puede tener varios métodos.',
    }
    case 'tables': return grouped(aggregate(paid, order => order.tableNumber ? `Mesa ${order.tableNumber}` : 'Sin mesa', order => order.totalAmount), 'Mesa', 'Órdenes')
    case 'orderTypes': return grouped(aggregate(paid, order => ({ dine_in: 'Mesa', takeaway: 'Para llevar', delivery: 'Delivery' } as Record<string, string>)[order.orderType] ?? order.orderType, order => order.totalAmount), 'Tipo', 'Órdenes')
    case 'hours': return grouped(aggregate(paid, order => new Intl.DateTimeFormat('es-VE', { timeZone: 'America/Caracas', hour: '2-digit', hour12: false }).format(new Date(order.createdAt)) + ':00', order => order.totalAmount), 'Hora', 'Órdenes')
    case 'customers': return grouped(aggregate(paid.filter(order => order.customerName && order.customerName !== 'Cliente'), order => order.customerName, order => order.totalAmount), 'Cliente', 'Órdenes')
    case 'expenses': return grouped(aggregate((data.expenses ?? []).filter(row => inRange(row.expenseDate, start, end)), row => row.category, row => row.amount), 'Categoría', 'Gastos')
    case 'purchases': return grouped(aggregate((data.purchases ?? []).filter(row => !row.isVoided && inRange(row.purchaseDate, start, end)), row => row.supplierName, row => row.totalAmount), 'Proveedor', 'Compras')
    case 'purchaseItems': return grouped(aggregate((data.purchases ?? []).filter(row => !row.isVoided && inRange(row.purchaseDate, start, end)).flatMap(row => row.items), row => `${row.ingredientName} (${row.unitSymbol})`, row => row.total, row => row.quantity), 'Insumo', 'Cantidad')
    case 'credits': return {
      columns: ['Fecha', 'Cliente', 'Crédito (USD)', 'Abonado (USD)', 'Pendiente (USD)', 'Estado'],
      rows: (data.credits ?? []).filter(row => inRange(row.createdAt, start, end)).map(row => [localDate(row.createdAt), row.customerName, formatUsd(row.totalAmount), formatUsd(row.totalPaid), formatUsd(row.balancePending), row.status]),
      total: formatUsd((data.credits ?? []).filter(row => inRange(row.createdAt, start, end)).reduce((sum, row) => sum + row.balancePending, 0)),
      note: 'El saldo mostrado es el saldo actual de créditos creados en el período, no una reconstrucción histórica.',
    }
    case 'closes': return {
      columns: ['Fecha', 'Ventas (USD)', 'Pagos (USD)', 'Gastos (USD)', 'Créditos (USD)', 'Balance (USD)'],
      rows: (data.closes ?? []).filter(row => inRange(row.closeDate, start, end)).map(row => [row.closeDate, formatUsd(row.totalSales), formatUsd(row.totalPayments), formatUsd(row.totalExpenses), formatUsd(row.totalCredits), formatUsd(row.balance)]),
      note: 'Usa los cierres diarios registrados, no calcula un Reporte Z fiscal.',
    }
    case 'inventory': return {
      columns: ['Insumo', 'Clase', 'Existencia', 'Unidad', 'Costo unitario (USD)', 'Valor (USD)'],
      rows: (data.ingredients ?? []).filter(row => row.isActive).map(row => [row.name, row.inventoryClass, count(row.currentStock), row.unitSymbol, row.pricePerUnit == null ? 'Sin costo' : formatUsd(row.pricePerUnit), row.stockValue == null ? 'Sin costo' : formatUsd(row.stockValue)]),
      total: formatUsd((data.ingredients ?? []).reduce((sum, row) => sum + (row.stockValue ?? 0), 0)),
      note: 'Existencia actual; el filtro de fechas no modifica este corte de inventario.',
    }
    case 'warehouseInventory':
    case 'inventoryByWarehouse': return {
      columns: ['Insumo', 'Existencia en bodega', 'Unidad', 'Costo unitario (USD)', 'Valor (USD)'],
      rows: (data.warehouseIngredients ?? []).filter(row => row.isActive).map(row => [row.name, count(row.currentStock), row.unitSymbol, row.pricePerUnit == null ? 'Sin costo' : formatUsd(row.pricePerUnit), row.stockValue == null ? 'Sin costo' : formatUsd(row.stockValue)]),
      total: formatUsd((data.warehouseIngredients ?? []).reduce((sum, row) => sum + (row.stockValue ?? 0), 0)),
      note: 'Corte de existencias de la bodega; no mezcla el stock operativo.',
    }
    case 'movements': return {
      columns: ['Fecha', 'Hora', 'Insumo', 'Movimiento', 'Cantidad', 'Ubicación', 'Referencia'],
      rows: (data.movements ?? []).filter(row => inRange(row.createdAt, start, end, startHour, endHour)).map(row => [localDate(row.createdAt), localTime(row.createdAt), row.ingredientName, row.movementType, `${count(row.quantity)} ${row.unitSymbol}`, row.stockLocation, row.referenceType ?? 'Manual']),
      note: 'Los movimientos son append-only; esta vista no modifica el historial.',
    }
    case 'productionWaste': return {
      columns: ['Fecha', 'Preparación', 'Producido', 'Merma', 'Porcentaje'],
      rows: (data.batches ?? []).filter(row => inRange(row.productionDate, start, end)).map(row => [row.productionDate, row.name, `${count(row.quantityProduced)} ${row.unitProduced}`, `${count(row.wasteQuantity)} ${row.unitProduced}`, `${row.wastePercentage.toFixed(1)}%`]),
      note: 'Solo incluye la merma capturada en lotes de producción; no infiere pérdidas de ajustes manuales.',
    }
    case 'customersList': return { columns: ['Cliente', 'Teléfono', 'Visitas', 'Última visita', 'Producto favorito', 'Estado'], rows: (data.customers ?? []).filter(row => row.isActive).map(row => [row.name, row.phone || 'Sin teléfono', String(row.totalVisits), row.lastVisit ? localDate(row.lastVisit) : 'Sin visitas', row.favoriteProduct || 'Sin datos', 'Activo']) }
    case 'openOrders': return {
      columns: ['Fecha', 'Hora', 'Comanda', 'Cliente', 'Tipo / mesa', 'Ítems', 'Total (USD)'],
      rows: (data.orders ?? []).filter(order => order.status !== 'paid' && inRange(order.createdAt, start, end, startHour, endHour)).map(order => [localDate(order.createdAt), localTime(order.createdAt), `#${order.orderNumber}`, order.customerName || 'Cliente', order.tableNumber ? `Mesa ${order.tableNumber}` : orderTypeName(order.orderType), count(order.items.reduce((sum, item) => sum + item.quantity, 0)), formatUsd(order.totalAmount)]),
      note: 'Incluye comandas que todavía no tienen estado pagado en el período seleccionado.',
    }
    case 'salesDetail': return {
      columns: ['Fecha', 'Hora', 'Comanda', 'Producto', 'Categoría', 'Cantidad', 'Precio unitario', 'Subtotal'],
      rows: paid.flatMap(order => order.items.map(item => [localDate(order.createdAt), localTime(order.createdAt), `#${order.orderNumber}`, item.productName, item.category, count(item.quantity), formatUsd(item.unitPrice), formatUsd(item.quantity * item.unitPrice)])),
      note: 'Detalle de líneas de venta cobradas; no incluye cargos que no pertenecen a un producto.',
    }
    case 'modifiers': return grouped(aggregate(salesItems.flatMap(item => (item.modifiers ?? []).map(modifier => ({ label: modifier.optionName, amount: item.quantity * modifier.quantity * modifier.price, quantity: item.quantity * modifier.quantity }))), row => row.label, row => row.amount, row => row.quantity), 'Opción', 'Unidades')
    case 'modifiersAdvanced': return { columns: ['Producto', 'Modificador', 'Opción', 'Cantidad', 'Precio (USD)', 'Total (USD)'], rows: salesItems.flatMap(item => (item.modifiers ?? []).map(modifier => [item.productName, modifier.modifierName, modifier.optionName, count(item.quantity * modifier.quantity), formatUsd(modifier.price), formatUsd(item.quantity * modifier.quantity * modifier.price)])), note: 'Detalle de opciones realmente guardadas en las líneas de órdenes cobradas.' }
    case 'modifiersWithCosts': return { columns: ['Producto', 'Modificador', 'Opción', 'Cantidad', 'Importe (USD)'], rows: salesItems.flatMap(item => (item.modifiers ?? []).map(modifier => [item.productName, modifier.modifierName, modifier.optionName, count(item.quantity * modifier.quantity), formatUsd(item.quantity * modifier.quantity * modifier.price)])), note: 'El importe corresponde al precio sellado de la opción; el costo de ingredientes del modificador requiere valorización de receta.' }
    case 'salesByWeek': return grouped(aggregate(paid, order => {
      const date = new Date(order.createdAt)
      const monday = new Date(date)
      monday.setDate(date.getDate() - ((date.getDay() + 6) % 7))
      return localDate(monday.toISOString())
    }, order => order.totalAmount), 'Semana', 'Órdenes')
    case 'salesByYear': return grouped(aggregate(paid, order => localDate(order.createdAt).slice(0, 4), order => order.totalAmount), 'Año', 'Órdenes')
    case 'salesByEmployee': return grouped(aggregate(paid, order => order.createdBy || 'Sin asignar', order => order.totalAmount), 'Empleado / usuario', 'Órdenes')
    case 'salesBySection': return grouped(aggregate(salesItems, item => item.category, item => item.quantity * item.unitPrice, item => item.quantity), 'Sección', 'Unidades')
    case 'salesByGroup': return grouped(aggregate(salesItems, item => item.category, item => item.quantity * item.unitPrice, item => item.quantity), 'Grupo', 'Unidades')
    case 'customerByCategory': return grouped(aggregate(paid.flatMap(order => order.items.filter(() => order.customerName && order.customerName !== 'Cliente').map(item => ({ label: `${order.customerName} · ${item.category}`, amount: item.quantity * item.unitPrice, quantity: item.quantity }))), row => row.label, row => row.amount, row => row.quantity), 'Cliente · categoría', 'Unidades')
    case 'salesWithoutMovement': {
      const sold = new Set(salesItems.map(item => item.productName.toLocaleLowerCase('es')))
      return { columns: ['Producto', 'Categoría', 'Precio (USD)', 'Estado'], rows: (data.products ?? []).filter(product => product.active && !sold.has(product.name.toLocaleLowerCase('es'))).map(product => [product.name, product.category, formatUsd(product.price), 'Sin ventas en el período']), note: 'Compara el catálogo activo contra las líneas cobradas del período.' }
    }
    case 'customerFavorite': return grouped(aggregate(paid.filter(order => order.customerName && order.customerName !== 'Cliente'), order => order.customerName, order => order.totalAmount), 'Cliente', 'Órdenes')
    case 'customerByItem': return grouped(aggregate(paid.flatMap(order => order.items.filter(() => order.customerName && order.customerName !== 'Cliente').map(item => ({ item: item.productName, customer: order.customerName, amount: item.quantity * item.unitPrice, quantity: item.quantity }))), row => `${row.customer} · ${row.item}`, row => row.amount, row => row.quantity), 'Cliente · producto', 'Unidades')
    case 'productByEmployee': return grouped(aggregate(paid.flatMap(order => order.items.map(item => ({ employee: order.createdBy, product: item.productName, amount: item.quantity * item.unitPrice, quantity: item.quantity }))), row => `${row.employee} · ${row.product}`, row => row.amount, row => row.quantity), 'Empleado · producto', 'Unidades')
    case 'orderReconciliation': return { columns: ['Fecha', 'Orden', 'Total orden (USD)', 'Pagado (USD)', 'Diferencia (USD)', 'Estado'], rows: (data.orders ?? []).filter(order => inRange(order.createdAt, start, end)).map(order => { const paidAmount = order.payments.reduce((sum, payment) => sum + payment.amount, 0); return [localDate(order.createdAt), `#${order.orderNumber}`, formatUsd(order.totalAmount), formatUsd(paidAmount), formatUsd(order.totalAmount - paidAmount), order.status] }), note: 'Compara el total guardado de cada comanda con la suma de sus pagos registrados.' }
    case 'reconciliation': return { columns: ['Fecha', 'Orden', 'Total (USD)', 'Pagos (USD)', 'Diferencia (USD)', 'Resultado'], rows: (data.orders ?? []).filter(order => inRange(order.createdAt, start, end)).map(order => { const payments = order.payments.reduce((sum, payment) => sum + payment.amount, 0); const difference = order.totalAmount - payments; return [localDate(order.createdAt), `#${order.orderNumber}`, formatUsd(order.totalAmount), formatUsd(payments), formatUsd(difference), Math.abs(difference) < 0.01 ? 'Conciliada' : 'Revisar'] }) }
    case 'consolidatedPayments': return grouped(aggregate((data.orders ?? []).filter(order => inRange(order.createdAt, start, end)).flatMap(order => order.payments), payment => paymentNames[payment.method] ?? payment.method, payment => payment.amount, () => 1), 'Método de pago', 'Movimientos')
    case 'soldVsCollected': return { columns: ['Fecha', 'Ventas (USD)', 'Cobros (USD)', 'Diferencia (USD)'], rows: [...new Set((data.orders ?? []).filter(order => inRange(order.createdAt, start, end)).map(order => localDate(order.createdAt)))].sort().map(day => { const orders = (data.orders ?? []).filter(order => localDate(order.createdAt) === day && inRange(order.createdAt, start, end)); const sales = orders.reduce((sum, order) => sum + order.totalAmount, 0); const collected = orders.reduce((sum, order) => sum + order.payments.reduce((inner, payment) => inner + payment.amount, 0), 0); return [day, formatUsd(sales), formatUsd(collected), formatUsd(sales - collected)] }) }
    case 'creditNotes': return { columns: ['Fecha', 'Orden', 'Cliente', 'Subtotal', 'Impuesto', 'Total', 'Propina'], rows: (data.legacySales ?? []).filter(row => inRange(row.closedAt ?? '', start, end)).filter(row => row.itemDiscount + row.orderDiscount < 0).map(row => [localDate(row.closedAt ?? ''), row.orderLabel ?? '-', row.customer ?? '-', formatUsd(row.subtotal), formatUsd(row.tax), formatUsd(row.total), formatUsd(row.tips)]), note: 'Lee notas o ajustes negativos importados desde Invu; las ventas actuales no generan notas de crédito todavía.' }
    case 'partialCreditNotes': return { columns: ['Fecha', 'Orden', 'Cliente', 'Descuento aplicado', 'Impuesto', 'Total original'], rows: (data.legacySales ?? []).filter(row => inRange(row.closedAt ?? '', start, end)).filter(row => row.itemDiscount !== 0 || row.orderDiscount !== 0).map(row => [localDate(row.closedAt ?? ''), row.orderLabel ?? '-', row.customer ?? '-', formatUsd(row.itemDiscount + row.orderDiscount), formatUsd(row.tax), formatUsd(row.total)]), note: 'Descuentos o devoluciones parciales disponibles en ventas históricas importadas.' }
    case 'creditNoteTaxes': return { columns: ['Fecha', 'Orden', 'Impuesto asociado (USD)'], rows: (data.legacySales ?? []).filter(row => inRange(row.closedAt ?? '', start, end)).filter(row => row.itemDiscount + row.orderDiscount < 0).map(row => [localDate(row.closedAt ?? ''), row.orderLabel ?? '-', formatUsd(row.tax)]), note: 'Impuestos asociados a notas de crédito importadas; las notas actuales requieren el flujo fiscal correspondiente.' }
    case 'deletedOrders': return { columns: ['Fecha', 'Orden', 'Eliminada por', 'Detalle'], rows: (data.legacyDeletedOrders ?? []).filter(row => inRange(row.deletedAt ?? '', start, end)).map(row => [localDate(row.deletedAt ?? ''), row.orderLabel ?? '-', row.deletedBy ?? '-', row.description ?? '-']), note: 'Historial de órdenes eliminadas importado desde Invu.' }
    case 'taxes': return { columns: ['Fecha', 'Orden', 'Subtotal', 'Impuestos', 'Total'], rows: (data.legacySales ?? []).filter(row => inRange(row.closedAt ?? '', start, end)).map(row => [localDate(row.closedAt ?? ''), row.orderLabel ?? '-', formatUsd(row.subtotal), formatUsd(row.tax), formatUsd(row.total)]), total: formatUsd((data.legacySales ?? []).filter(row => inRange(row.closedAt ?? '', start, end)).reduce((sum, row) => sum + row.tax, 0)), note: 'Impuestos disponibles en ventas históricas importadas desde Invu.' }
    case 'discounts': return { columns: ['Fecha', 'Orden', 'Cliente', 'Descuento por ítem', 'Descuento por orden'], rows: (data.legacySales ?? []).filter(row => inRange(row.closedAt ?? '', start, end)).filter(row => row.itemDiscount !== 0 || row.orderDiscount !== 0).map(row => [localDate(row.closedAt ?? ''), row.orderLabel ?? '-', row.customer ?? '-', formatUsd(row.itemDiscount), formatUsd(row.orderDiscount)]), note: 'Descuentos disponibles en ventas históricas importadas desde Invu.' }
    case 'tipsByOrder': return { columns: ['Fecha', 'Orden', 'Cliente', 'Propina (USD)'], rows: (data.legacySales ?? []).filter(row => inRange(row.closedAt ?? '', start, end)).filter(row => row.tips !== 0).map(row => [localDate(row.closedAt ?? ''), row.orderLabel ?? '-', row.customer ?? '-', formatUsd(row.tips)]), total: formatUsd((data.legacySales ?? []).filter(row => inRange(row.closedAt ?? '', start, end)).reduce((sum, row) => sum + row.tips, 0)) }
    case 'tipsByPayment': return grouped(aggregate((data.legacySales ?? []).filter(row => inRange(row.closedAt ?? '', start, end)).flatMap(row => [{ method: 'Efectivo', amount: row.cashPaid, quantity: row.cashPaid ? 1 : 0 }, { method: 'Tarjeta', amount: row.cardPaid, quantity: row.cardPaid ? 1 : 0 }, { method: 'Cheque', amount: row.chequePaid, quantity: row.chequePaid ? 1 : 0 }, { method: 'Otro', amount: row.otherPaid, quantity: row.otherPaid ? 1 : 0 }].filter(payment => payment.amount > 0)), row => row.method, row => row.amount, row => row.quantity), 'Método de pago', 'Pagos')
    case 'legacyPurchaseOrders': return { columns: ['Fecha', 'Orden de compra', 'Proveedor', 'Impuestos', 'Descuento', 'Total', 'Estado'], rows: (data.legacyPurchaseOrders ?? []).filter(row => inRange(row.poDate ?? '', start, end)).map(row => [localDate(row.poDate ?? ''), row.poCode ?? '-', row.supplier ?? '-', formatUsd(row.tax), formatUsd(row.discount), formatUsd(row.total), row.status ?? '-']) }
    case 'products': return { columns: ['Producto', 'Categoría', 'Precio (USD)', 'Costo (USD)', 'Estado'], rows: (data.products ?? []).map(row => [row.name, row.category, formatUsd(row.price), row.cost == null ? 'Sin costo' : formatUsd(row.cost), row.active ? 'Activo' : 'Inactivo']) }
    case 'recipes': return { columns: ['Producto', 'Componentes', 'Costo receta (USD)', 'Margen estimado'], rows: (data.products ?? []).filter(row => row.active).map(row => { const summary = data.recipeSummaries?.get(row.id); return [row.name, String(summary?.componentCount ?? 0), summary?.recipeCost == null ? 'Sin costo' : formatUsd(summary.recipeCost), summary?.marginEstimated == null ? 'Sin datos' : `${summary.marginEstimated.toFixed(1)}%`] }), note: 'Resumen de recetas y costos calculado por la función de costos disponible para owner/manager.' }
    case 'menu':
    case 'menuPublished': return { columns: ['Producto', 'Categoría', 'Precio (USD)', 'Estado'], rows: (data.products ?? []).filter(row => row.active).map(row => [row.name, row.category, formatUsd(row.price), 'Publicado']), note: 'Vista del catálogo activo publicado en el menú.' }
    case 'purchasedProducts':
    case 'purchaseAdvanced': return grouped(aggregate((data.purchases ?? []).filter(row => !row.isVoided && inRange(row.purchaseDate, start, end)).flatMap(row => row.items), row => `${row.ingredientName} (${row.unitSymbol})`, row => row.total, row => row.quantity), 'Insumo', 'Cantidad')
    case 'suppliersProducts': return grouped(aggregate((data.purchases ?? []).filter(row => !row.isVoided && inRange(row.purchaseDate, start, end)).flatMap(row => row.items.map(item => ({ label: `${row.supplierName} · ${item.ingredientName}`, amount: item.total, quantity: item.quantity }))), row => row.label, row => row.amount, row => row.quantity), 'Proveedor · insumo', 'Cantidad')
    case 'costsBySupplier': return grouped(aggregate((data.purchases ?? []).filter(row => !row.isVoided && inRange(row.purchaseDate, start, end)), row => row.supplierName, row => row.totalAmount), 'Proveedor', 'Compras')
    case 'generalLossGain': { const sales = (data.orders ?? []).filter(order => order.status === 'paid' && inRange(order.createdAt, start, end)).reduce((sum, order) => sum + order.totalAmount, 0); const expenses = (data.expenses ?? []).filter(row => inRange(row.expenseDate, start, end)).reduce((sum, row) => sum + row.amount, 0); return { columns: ['Concepto', 'Monto (USD)'], rows: [['Ventas cobradas', formatUsd(sales)], ['Gastos registrados', formatUsd(-expenses)], ['Resultado', formatUsd(sales - expenses)]], total: formatUsd(sales - expenses), note: 'Resultado operativo simple: ventas cobradas menos gastos registrados. No incluye costo de recetas ni nómina.' } }
    case 'laborCost': return grouped(aggregate((data.payrollPayments ?? []).filter(row => inRange(row.paymentDate, start, end)).map(row => ({ label: row.employeeName, amount: row.currency === 'USD' ? row.amount : (row.exchangeRate ? row.amount / row.exchangeRate : 0) })), row => row.label, row => row.amount), 'Empleado', 'Pagos')
    case 'exchangeRates': return { columns: ['Fecha', 'Tasa BCV (Bs/USD)', 'Órdenes registradas'], rows: [...new Set((data.orders ?? []).filter(order => inRange(order.createdAt, start, end) && order.bcvRate).map(order => `${localDate(order.createdAt)}|${order.bcvRate}`))].map(value => { const [date, rate] = value.split('|'); return [date, Number(rate).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 4 }), String((data.orders ?? []).filter(order => localDate(order.createdAt) === date && String(order.bcvRate) === rate).length)] }) , note: 'Historial de tasas guardadas en las órdenes; no sustituye una serie oficial diaria del BCV.' }
    case 'orderTime': return { columns: ['Orden', 'Evento', 'Valor anterior', 'Valor actual', 'Fecha', 'Hora'], rows: (data.events ?? []).filter(row => inRange(row.occurredAt, start, end, startHour, endHour)).map(row => [`#${row.orderId.slice(0, 8)}`, row.eventType, row.previousValue ?? '-', row.currentValue ?? '-', localDate(row.occurredAt), localTime(row.occurredAt)]) }
    case 'cashLogs': return { columns: ['Orden', 'Evento', 'Fecha', 'Hora', 'Detalle'], rows: (data.events ?? []).filter(row => row.eventType === 'drawer_opened' && inRange(row.occurredAt, start, end, startHour, endHour)).map(row => [`#${row.orderId.slice(0, 8)}`, row.eventType, localDate(row.occurredAt), localTime(row.occurredAt), row.currentValue ?? '-']) }
    case 'kdsLogs': return { columns: ['Orden', 'Evento', 'Estado', 'Fecha', 'Hora'], rows: (data.events ?? []).filter(row => row.eventType === 'kitchen_status_changed' && inRange(row.occurredAt, start, end, startHour, endHour)).map(row => [`#${row.orderId.slice(0, 8)}`, row.eventType, row.currentValue ?? '-', localDate(row.occurredAt), localTime(row.occurredAt)]) }
    case 'kdsItems': return { columns: ['Orden', 'Evento', 'Estado', 'Fecha', 'Hora'], rows: (data.events ?? []).filter(row => row.eventType === 'kitchen_status_changed' && inRange(row.occurredAt, start, end, startHour, endHour)).map(row => [`#${row.orderId.slice(0, 8)}`, 'Estado de comanda', row.currentValue ?? '-', localDate(row.occurredAt), localTime(row.occurredAt)]), note: 'El registro actual audita cambios de estado de la comanda; el detalle por ítem requiere eventos KDS por línea.' }
    case 'precheckLogs':
    case 'prebillPrintLogs': return { columns: ['Orden', 'Evento', 'Fecha', 'Hora', 'Detalle'], rows: (data.events ?? []).filter(row => row.eventType === 'printed' && inRange(row.occurredAt, start, end, startHour, endHour)).map(row => [`#${row.orderId.slice(0, 8)}`, 'Precuenta impresa', localDate(row.occurredAt), localTime(row.occurredAt), row.currentValue ?? '-']) }
    case 'openDrawerLogs': return { columns: ['Orden', 'Evento', 'Fecha', 'Hora', 'Detalle'], rows: (data.events ?? []).filter(row => row.eventType === 'drawer_opened' && inRange(row.occurredAt, start, end, startHour, endHour)).map(row => [`#${row.orderId.slice(0, 8)}`, 'Apertura de cajón', localDate(row.occurredAt), localTime(row.occurredAt), row.currentValue ?? '-']) }
    case 'tipsByEmployee': return grouped(aggregate((data.adjustments ?? []).filter(row => row.adjustmentType === 'tip' && inRange(row.createdAt, start, end)).map(row => ({ label: row.employeeId ?? 'Sin asignar', amount: row.amountUsd })), row => row.label, row => row.amount), 'Empleado', 'Propinas')
    case 'tipsAddedLogs': return { columns: ['Fecha', 'Empleado', 'Orden', 'Monto (USD)', 'Motivo'], rows: (data.adjustments ?? []).filter(row => row.adjustmentType === 'tip' && inRange(row.createdAt, start, end)).map(row => [localDate(row.createdAt), row.employeeId ?? 'Sin asignar', `#${row.orderId.slice(0, 8)}`, formatUsd(row.amountUsd), row.reason ?? '-']) }
    case 'laborHours': return grouped(aggregate((data.attendance ?? []).filter(row => inRange(row.workDate, start, end)).map(row => ({ label: row.employeeId, amount: row.clockIn && row.clockOut ? (new Date(row.clockOut).getTime() - new Date(row.clockIn).getTime()) / 3600000 : 0 })), row => row.label, row => row.amount), 'Empleado', 'Horas')
    case 'employeeMarkings': return { columns: ['Fecha', 'Empleado', 'Entrada', 'Salida', 'Horas'], rows: (data.attendance ?? []).filter(row => inRange(row.workDate, start, end)).map(row => [row.workDate, row.employeeId, row.clockIn ? localTime(row.clockIn) : 'Sin entrada', row.clockOut ? localTime(row.clockOut) : 'Sin salida', row.clockIn && row.clockOut ? ((new Date(row.clockOut).getTime() - new Date(row.clockIn).getTime()) / 3600000).toFixed(2) : '-']) }
    case 'requisitions': return { columns: ['Fecha', 'Insumo', 'Cantidad', 'Origen', 'Destino', 'Estado'], rows: (data.requisitions ?? []).filter(row => inRange(row.requestedAt, start, end)).map(row => [localDate(row.requestedAt), row.ingredientId, count(row.quantity), row.fromLocation, row.toLocation, row.status]) }
    case 'giftCards': return { columns: ['Fecha', 'Código', 'Movimiento', 'Monto (USD)', 'Orden'], rows: (data.giftCards ?? []).filter(row => inRange(row.transactionAt ?? row.createdAt, start, end)).map(row => [localDate(row.transactionAt ?? row.createdAt), row.code, row.transactionType ?? 'Emisión', formatUsd(row.transactionAmountUsd ?? row.initialAmountUsd), row.orderId ? `#${row.orderId.slice(0, 8)}` : '-']) }
    case 'inventoryUsage': return grouped(aggregate((data.movements ?? []).filter(row => row.movementType === 'consumption' && inRange(row.createdAt, start, end)), row => row.ingredientName, row => Math.abs(row.quantity), row => Math.abs(row.quantity)), 'Insumo', 'Cantidad consumida')
    case 'inventoryUsageAdvanced': return { columns: ['Fecha', 'Insumo', 'Cantidad', 'Unidad', 'Referencia'], rows: (data.movements ?? []).filter(row => row.movementType === 'consumption' && inRange(row.createdAt, start, end)).map(row => [localDate(row.createdAt), row.ingredientName, count(Math.abs(row.quantity)), row.unitSymbol, row.referenceType ?? '-']), note: 'Detalle de consumos registrados por recetas o producción.' }
    case 'shrinkage': return grouped(aggregate((data.movements ?? []).filter(row => (row.movementType === 'waste' || row.movementType === 'adjustment') && inRange(row.createdAt, start, end)), row => row.ingredientName, row => Math.abs(row.quantity), row => Math.abs(row.quantity)), 'Insumo', 'Cantidad')
    case 'averageInventoryUsage': {
      const days = Math.max(1, Math.round((new Date(`${end}T12:00:00`).getTime() - new Date(`${start}T12:00:00`).getTime()) / 86400000) + 1)
      return grouped(aggregate((data.movements ?? []).filter(row => row.movementType === 'consumption' && inRange(row.createdAt, start, end)), row => row.ingredientName, row => Math.abs(row.quantity) / days, row => Math.abs(row.quantity) / days), 'Insumo', 'Promedio diario')
    }
    case 'financialOperations': return { columns: ['Fecha', 'Tipo', 'Concepto', 'Moneda original', 'Monto (USD)', 'Cuenta origen', 'Cuenta destino'], rows: (data.operations ?? []).filter(row => inRange(row.operationDate, start, end)).map(row => [row.operationDate, row.type, row.concept, `${row.originalAmount} ${row.originalCurrency}`, formatUsd(row.amountUsd), row.fromAccount ?? '-', row.toAccount ?? '-']), total: formatUsd((data.operations ?? []).filter(row => inRange(row.operationDate, start, end)).reduce((sum, row) => sum + row.amountUsd, 0)) }
    case 'payrollPayments': return { columns: ['Fecha', 'Empleado', 'Monto', 'Moneda', 'Cuenta', 'Referencia'], rows: (data.payrollPayments ?? []).filter(row => inRange(row.paymentDate, start, end)).map(row => [row.paymentDate, row.employeeName, row.amount.toLocaleString('es-VE', { minimumFractionDigits: 2 }), row.currency, row.paymentAccount ?? '-', row.reference ?? '-']) }
    case 'advances': return { columns: ['Fecha', 'Empleado', 'Monto (USD)', 'Estado', 'Notas'], rows: (data.advances ?? []).filter(row => inRange(row.advanceDate, start, end)).map(row => [row.advanceDate, row.employeeName, formatUsd(row.amount), row.isDeducted ? 'Deducido' : 'Pendiente', row.notes ?? '-']), total: formatUsd((data.advances ?? []).filter(row => inRange(row.advanceDate, start, end)).reduce((sum, row) => sum + row.amount, 0)) }
    case 'auditLogs': return { columns: ['Fecha', 'Usuario', 'Módulo', 'Acción', 'Severidad', 'Detalle'], rows: (data.auditLogs ?? []).filter(row => inRange(row.occurredAt, start, end)).map(row => [localDate(row.occurredAt), row.actorName, row.module, row.action, row.severity, row.details ?? '-']) }
    case 'productsList': return { columns: ['Producto', 'Categoría', 'Precio (USD)', 'Costo (USD)', 'Estado'], rows: (data.products ?? []).filter(row => row.active).map(row => [row.name, row.category, formatUsd(row.price), row.cost == null ? 'Sin costo' : formatUsd(row.cost), 'Activo']) }
    default: return {
      columns: ['Estado', 'Reporte', 'Detalle'],
      rows: [['Pendiente de datos', REPORTS.find(report => report.id === id)?.title ?? id, REPORTS.find(report => report.id === id)?.requirement ?? 'Requiere un registro específico']],
      note: 'El reporte está reservado en el catálogo. Se habilitará cuando FullChina registre estos datos; no se muestran ceros simulados.',
    }
  }
}
