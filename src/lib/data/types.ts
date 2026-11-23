
export interface Product {
  id: string
  name: string
  description: string | null
  price: number
  cost: number | null
  category: string
  categories: string[]
  emoji: string
  active: boolean
  imageUrl: string | null
  allowProteinExtras?: boolean
  menuLabel?: 'top_sales' | 'new' | 'recommended' | 'free_drink' | null
  publicVisible?: boolean
  publicCarousel?: boolean
  publicCarouselOrder?: number
}

export interface SelectedModifier {
  optionId: string
  optionName: string
  modifierName: string
  price: number
  quantity: number
}

export interface CartItem {
  productId: string
  productName: string
  price: number
  quantity: number
  emoji?: string
  /** Identificador único de la línea del carrito (necesario para modificadores). */
  lineId?: string
  /** Opciones de modificador elegidas para esta línea. */
  selectedModifiers?: SelectedModifier[]
}

export interface ModifierOption {
  id: string
  name: string
  price: number
}

export interface ProductModifierGroup {
  modifierId: string
  name: string
  minSelections: number
  maxSelections: number | null
  allowRepeat: boolean
  options: ModifierOption[]
}

/** Grupos como la composición del Full Kilo: el total incluido se reparte
 * entre opciones y cada opción puede repetirse sin recargo. */
export function isQuantityModifierGroup(group: ProductModifierGroup): boolean {
  return group.allowRepeat && group.maxSelections != null && group.maxSelections > 1 && group.options.length > 1
}

export type PaymentMethod = 'cash' | 'mobile' | 'card' | 'transfer' | 'binance' | 'zelle' | 'other' | 'personal_account'

export interface OrderPaymentComponent {
  method: PaymentMethod
  amount: number
  accountId?: string | null
  personalAccountId?: string | null
  referenceNumber?: string | null
  receivedAmount?: number | null
  receivedCurrency?: 'USD' | 'VES' | null
  receivedExchangeRate?: number | null
  changeAmount?: number | null
  changeCurrency?: 'USD' | 'VES' | null
  changeAccountId?: string | null
  changeExchangeRate?: number | null
  notes?: string | null
}

export interface RecordedOrderPayment extends OrderPaymentComponent {
  id: string
  createdAt: string
}

export interface OrderResult {
  id: string
  orderNumber: number
  status: string
  total: number
  bcvRate: number | null
  createdAt: string
  paymentMethod: PaymentMethod
  items: CartItem[]
  customerName?: string
  orderType?: string
  tableNumber?: number | null
  employeeName?: string
  deliveryFeeUsd?: number
  payments?: OrderPaymentComponent[]
}

export interface TodayOrder {
  id: string
  orderNumber: number
  status: string
  total: number
  paymentMethod: PaymentMethod | null
  createdAt: string
}

export interface FullOrder {
  id: string
  orderNumber: number
  status: string
  creditAuthorized?: boolean
  customerId?: string | null
  fulfillmentStatus: 'new' | 'preparing' | 'ready' | 'delivered'
  notes: string | null
  orderType: string
  tableNumber: number | null
  customerName: string
  customerPhone: string | null
  customerAddress: string | null
  customerIdentification: string | null
  bcvRate: number | null
  createdBy: string
  createdAt: string
  updatedAt: string
  items: OrderItem[]
  payments: RecordedOrderPayment[]
  totalAmount: number
}

export const isPersonalAccountOrder = (order: Pick<FullOrder, 'payments'>): boolean =>
  order.payments.some(payment => payment.method === 'personal_account')

/** Una comanda pendiente solo es deuda cuando se autorizó explícitamente como crédito. */
export const isCreditAuthorizedOrder = (order: Pick<FullOrder, 'creditAuthorized'>): boolean =>
  order.creditAuthorized === true

export interface OrderItem {
  id: string
  sellableProductId: string
  productName: string
  emoji: string
  category: string
  quantity: number
  unitPrice: number
  modifiers?: SelectedModifier[]
}

export interface Credit {
  id: string
  customerId: string | null
  customerName: string
  totalAmount: number
  totalPaid: number
  balancePending: number
  status: string
  orderId: string
  createdAt: string
  dueDate?: string | null
  isIndefinite?: boolean
}

export interface CreditPayment {
  id: string
  creditId: string
  amount: number
  notes: string | null
  createdBy: string
  createdAt: string
  method?: PaymentMethod | null
  accountId?: string | null
  referenceNumber?: string | null
  receivedAmount?: number | null
  receivedCurrency?: 'USD' | 'VES' | null
  changeAmount?: number | null
  changeCurrency?: 'USD' | 'VES' | null
  changeAccountId?: string | null
}

export interface FinancialAccountCreditPayment {
  id: string
  creditId: string
  creditOrderId: string | null
  customerName: string
  amount: number
  accountId: string | null
  method: PaymentMethod | null
  referenceNumber: string | null
  exchangeRate: number | null
  receivedAmount: number | null
  receivedCurrency: 'USD' | 'VES' | null
  receivedExchangeRate: number | null
  changeAmount: number
  changeCurrency: 'USD' | 'VES' | null
  changeAccountId: string | null
  changeExchangeRate: number | null
  createdAt: string
}

export interface DailyClose {
  id: string
  closeDate: string
  totalSales: number
  totalPayments: number
  notes: string | null
  closedBy: string
  createdAt: string
}

export interface DailyCloseSummary {
  id: string
  closeDate: string
  totalSales: number
  totalPayments: number
  totalExpenses: number
  totalCredits: number
  balance: number
  notes: string | null
  closedBy: string
}

export interface Expense {
  id: string
  concept: string
  amount: number
  category: string
  expenseDate: string
  notes: string | null
  createdBy: string
  createdAt: string
  accountId: string | null
  exchangeRate: number | null
  payments: ExpensePayment[]
  purchaseExpenseItemId: string | null
}

export interface ExpensePayment {
  id: string
  accountId: string
  accountName: string
  amount: number
  amountUsd: number
  currency: 'USD' | 'VES'
  exchangeRate: number | null
  method: string | null
  reference: string | null
  bankFeeAmount: number
}

export interface FinancialOperation {
  id: string
  type: 'transfer' | 'receivable' | 'receivable_collection' | 'tip' | 'tip_distribution' | 'employee_advance' | 'loan' | 'loan_payment' | 'bank_fee' | 'adjustment' | 'payroll'
  concept: string
  operationDate: string
  amountUsd: number
  originalCurrency: 'USD' | 'VES'
  originalAmount: number
  exchangeRate: number | null
  counterparty: string | null
  referenceNumber: string | null
  affectsProfit: boolean
  fromAccountId?: string | null
  toAccountId?: string | null
  fromAccount: string | null
  toAccount: string | null
}

export interface TodayStats {
  totalSales: number
  ordersCount: number
  pendingOrders: number
  readyOrders: number
  avgTicket: number
}

export interface DailySales {
  date: string
  total: number
  count: number
}

export interface ProductRanking {
  name: string
  emoji: string
  imageUrl: string | null
  count: number
  revenue: number
}

export interface CategorySales {
  category: string
  total: number
}

export interface PaymentMethodSales {
  method: string
  total: number
  count: number
}

export interface Ingredient {
  id: string
  name: string
  unitId: string
  unitName: string
  unitSymbol: string
  isActive: boolean
  currentStock: number
  pricePerUnit: number | null
  stockValue: number | null
  inventoryClass: 'raw_material' | 'packaging' | 'beverage' | 'non_inventory'
}

export interface FinancialAccount {
  id: string
  name: string
  accountType: string
  currency: 'USD' | 'VES'
  isActive: boolean
  acceptsCustomerPayments: boolean
  openingBalance: number
  currentBalance: number
}

export interface PersonalAccount {
  id: string
  name: string
  isActive: boolean
  totalConsumption: number
  movementCount: number
}

export interface PersonalAccountOption {
  id: string
  name: string
  isActive: true
}

export type WarehouseIngredient = Ingredient

export interface InventorySnapshotItem extends Ingredient {
  sourceSystem: string | null
  sourceKey: string | null
  sourceCode: string | null
  operationalStock: number
  warehouseStock: number
}

export interface InventorySnapshotUpdate {
  ingredientId: string
  operationalStock: number
  warehouseStock: number
}

export interface StockMovement {
  id: string
  ingredientId: string
  ingredientName: string
  quantity: number
  unitId: string
  unitSymbol: string
  movementType: string
  stockLocation: 'warehouse' | 'operational'
  referenceType: string | null
  referenceId: string | null
  notes: string | null
  createdBy: string | null
  createdAt: string
}

export interface Supplier {
  id: string
  name: string
  contact: string | null
  phone: string | null
  email: string | null
  notes: string | null
  isActive: boolean
}

export interface Purchase {
  id: string
  supplierId: string
  supplierName: string
  purchaseDate: string
  invoiceNumber: string | null
  notes: string | null
  createdBy: string
  createdAt: string
  items: PurchaseItem[]
  expenseItems: PurchaseExpenseItem[]
  inventoryTotalAmount: number
  totalAmount: number
  isPaid: boolean
  accountId: string | null
  accountName: string | null
  paymentCurrency: 'USD' | 'VES' | null
  paymentMethod: string | null
  paymentReference: string | null
  exchangeRate: number | null
  isVoided: boolean
  payments: PurchasePayment[]
}

export interface PurchasePayment {
  id: string
  accountId: string
  accountName: string
  amount: number
  amountUsd: number
  currency: 'USD' | 'VES'
  exchangeRate: number | null
  method: string | null
  reference: string | null
  bankFeeAmount: number
}

export interface PurchaseItem {
  id: string
  purchaseId: string
  ingredientId: string
  ingredientName: string
  quantity: number
  unitId: string
  unitSymbol: string
  unitCost: number
  total: number
  stockLocation: 'warehouse' | 'operational'
}

export interface PurchaseExpenseItem {
  id: string
  description: string
  quantity: number
  unitId: string
  unitSymbol: string
  unitCost: number
  total: number
}

export interface SellableProduct {
  id: string
  name: string
  description: string | null
  salePrice: number
  cost: number | null
  category: string
  categories: string[]
  emoji: string
  isActive: boolean
  imageUrl: string | null
  isDelivery: boolean
  allowProteinExtras: boolean
  menuLabel: 'top_sales' | 'new' | 'recommended' | 'free_drink' | null
  publicVisible?: boolean
  publicCarousel?: boolean
  publicCarouselOrder?: number
}

export interface RecipeSummary {
  componentCount: number
  recipeCost: number | null
  marginEstimated: number | null
}

export interface RecipeComponent {
  id: string
  sellableProductId: string
  ingredientId: string | null
  preparationBatchId: string | null
  portionRecipeId: string | null
  ingredientName: string | null
  quantity: number
  unitId: string
  unitSymbol: string
  costPerUnit: number | null
}

export interface PortionRecipe {
  id: string
  name: string
  ingredientId: string
  ingredientName: string
  quantity: number
  unitId: string
  unitSymbol: string
  isActive: boolean
  notes: string | null
}

export interface Employee {
  id: string
  fullName: string
  photoUrl?: string | null
  position: string | null
  hourlyRate: number
  weeklySalary: number
  overtimeRate: number
  isActive: boolean
  hasWeeklyPayrollColumns?: boolean
}

export interface PayrollPeriod {
  id: string
  startDate: string
  endDate: string
  status: 'open' | 'closed' | 'paid'
  notes: string | null
  createdAt: string
}

export interface PayrollEntry {
  id: string
  payrollPeriodId: string
  employeeId: string
  employeeName: string
  position: string | null
  hoursWorked: number
  baseSalary: number
  deductions: number
  netPay: number
  notes: string | null
  weeklySalary: number
  bonusAmount: number
  overtimeHours: number
  overtimeAmount: number
  transportAmount: number
  absenceDays: number
  absenceDeduction: number
  advanceDeduction: number
  hasBreakdown: boolean
}

export interface DeliveryAssignment {
  id: string
  employeeId: string
  employeeName: string
  orderId: string
  deliveryFee: number
  employeePercent: number
  employeeAmount: number
  companyAmount: number
  status: 'pending' | 'paid' | 'cancelled'
  assignedAt: string
  payrollPeriodId: string | null
}

export interface LegacySaleReportRow {
  id: string
  orderLabel: string | null
  customer: string | null
  closedAt: string | null
  orderType: string | null
  subtotal: number
  itemDiscount: number
  orderDiscount: number
  tax: number
  tips: number
  total: number
  cashPaid: number
  cardPaid: number
  chequePaid: number
  otherPaid: number
}

export interface LegacyDeletedOrderReportRow {
  id: string
  orderLabel: string | null
  description: string | null
  deletedAt: string | null
  deletedBy: string | null
}

export interface LegacyPurchaseOrderReportRow {
  id: string
  poCode: string | null
  supplier: string | null
  poDate: string | null
  tax: number
  discount: number
  total: number
  status: string | null
}

export interface ReportEventRow { id: string; orderId: string; eventType: string; previousValue: string | null; currentValue: string | null; actorId: string | null; occurredAt: string }
export interface ReportAdjustmentRow { id: string; orderId: string; orderItemId: string | null; adjustmentType: string; amountUsd: number; reason: string | null; employeeId: string | null; createdAt: string }
export interface ReportAttendanceRow { id: string; employeeId: string; workDate: string; clockIn: string | null; clockOut: string | null; notes: string | null }
export interface ReportRequisitionRow { id: string; ingredientId: string; quantity: number; unitId: string; fromLocation: string; toLocation: string; status: string; requestedAt: string; fulfilledAt: string | null }
export interface ReportGiftCardRow { id: string; code: string; initialAmountUsd: number; isActive: boolean; expiresAt: string | null; createdAt: string; transactionType?: string; transactionAmountUsd?: number; transactionAt?: string; orderId?: string | null }

export interface DashboardAlertInput {
  key: 'inventory' | 'credits' | 'orders_delayed' | 'cash_open' | 'cash_discrepancy' | 'production_yield'
  title: string
  detail: string
  path: string
  tone: 'critical' | 'warning'
}

export interface DashboardAlertEvent extends DashboardAlertInput {
  id: string
  detectedAt: string
  lastDetectedAt: string
  resolvedAt: string | null
}

export interface PayrollPayment {
  id: string
  employeeId: string
  employeeName: string
  amount: number
  currency: 'USD' | 'Bs'
  exchangeRate: number | null
  paymentAccount: string | null
  accountId: string | null
  payrollPeriodId: string | null
  paymentDate: string
  reference: string | null
  notes: string | null
  bankFeeAmount: number
}

export interface PayrollAdjustment {
  id: string
  employeeId: string
  employeeName: string
  adjustmentType: string
  amount: number
  direction: 'add' | 'deduct'
  adjustmentDate: string
  description: string | null
}

export interface Advance {
  id: string
  employeeId: string
  employeeName: string
  amount: number
  accountId: string | null
  accountName: string | null
  currency: 'USD' | 'VES' | null
  originalAmount: number | null
  exchangeRate: number | null
  advanceDate: string
  isDeducted: boolean
  notes: string | null
  createdAt: string
}

export interface AuditLog {
  id: string
  occurredAt: string
  actorName: string
  module: string
  action: string
  details: string | null
  severity: 'info' | 'warning' | 'danger'
}

export interface SystemActivityLog {
  id: string
  occurredAt: string
  actorName: string
  module: string
  action: 'INSERT' | 'UPDATE' | 'DELETE'
  entityTable: string
  entityId: string | null
  entityLabel: string | null
  changedFields: string[]
  changes: Record<string, { before: unknown; after: unknown }>
  context: Record<string, string | number | boolean | null>
}

export interface BatchItem {
  id: string
  ingredientId: string
  ingredientName: string
  quantityUsed: number
  unitId: string
  unitSymbol: string
  costPerUnit: number
}

export interface ProductionBatch {
  id: string
  batchNumber: number
  name: string
  sellableProductId: string | null
  productName: string
  productionDate: string
  quantityProduced: number
  unitProduced: string
  wasteQuantity: number
  wastePercentage: number
  totalCost: number
  costPerPortion: number
  operator: string
  status: string
  items: BatchItem[]
  notes: string | null
  createdAt: string
}

export interface ProductionStats {
  batchesToday: number
  avgYield: number
  totalWaste: number
  avgCostPerPortion: number
  batchesYesterday: number
  yieldChange: number
  wasteChange: number
  costChange: number
}

export interface RecentProductionBatch {
  id: string
  name: string
  productionDate: string
  quantityProduced: number
  wasteQuantity: number
  wastePercentage?: number
}

export interface ProductionBonus {
  employeeId: string
  employeeName: string
  initials: string
  piecesCount: number
  bonusAmount: number
  percentage: number
}

// El esquema TypeScript puede estar desfasado respecto a una migración nueva;
// normalizamos las respuestas PostgREST al tipo de fila conocido en este módulo.
export interface MenuCategoryRow { id: string; key: string; label: string; sortOrder: number; isActive: boolean }

export interface DeliveryConfigRow { originLat: number | null; originLng: number | null; roadFactor: number; enabled: boolean; employeePercent: number }
export interface DeliveryZoneRow { id: string; minKm: number; maxKm: number | null; price: number; sortOrder: number; isActive: boolean }

export interface FloorTable {
  id: string
  number: number
  zone: string
  shape: 'square' | 'round'
  seats: number
  posX: number
  posY: number
  isActive: boolean
  openOrderId: string | null
  openOrderNumber: number | null
  openOrderCustomer: string | null
  openOrderCreatedBy: string | null
  openOrderCreatedByName: string | null
  openOrderCreatedAt: string | null
  openOrderTotal: number
}

export interface Customer {
  id: string
  name: string
  identification: string
  phone: string
  address?: string
  email: string
  totalVisits: number
  rewardsUnlocked: number
  lastVisit: string
  favoriteProduct: string
  birthday: string
  createdAt: string
  isActive: boolean
}

export interface CustomerOrderSummary {
  id: string
  orderNumber: number
  createdAt: string
  orderType: string
  status: string
  fulfillmentStatus: string
  total: number
  itemsText: string
  items: Array<{ productName: string; quantity: number }>
  paymentMethods: string[]
}

export interface CustomerPurchaseMetric {
  customerId: string | null
  customerName: string
  orderCount: number
  totalPurchased: number
  lastPurchase: string
}

export interface WeeklyDish {
  id: string
  name: string
  description: string
  price: number
  cost: number
  emoji: string
  status: 'active' | 'inactive'
  weekTag: string
  sellableProductId: string | null
  imageUrl: string | null
  /** Fecha (YYYY-MM-DD) del lunes de la última semana en que estuvo activo. */
  lastUsedWeekStart: string | null
}

export interface WhatsAppMessage {
  id: string
  templateType: string
  customerName: string
  phone: string
  message: string
  sentAt: string
  status: 'queued' | 'sending' | 'sent' | 'failed' | 'cancelled'
  errorMessage?: string | null
}

export interface WhatsAppSegment {
  id: string
  name: string
  description: string | null
  customerIds: string[]
  createdAt: string
  updatedAt: string
}

export interface WhatsAppTemplate {
  id: string
  name: string
  category: string
  description: string | null
  message: string
  scheduleLabel: string | null
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export interface LegacyPurchaseOrder {
  id: string
  code: string
  supplier: string
  date: string
  total: number
  invoiceNumber: string
  status: string
}

export interface CashMovement {
  id: string
  direction: 'in' | 'out'
  movementType: 'cash_in' | 'cash_out' | 'withdrawal' | 'expense' | 'adjustment'
  currency: 'USD' | 'VES'
  amount: number
  description: string
  referenceNumber: string | null
  createdAt: string
}

export interface CashSessionSnapshot {
  id: string
  sessionNumber: number
  registerId: string
  registerCode: string
  registerName: string
  status: 'open' | 'closed'
  openedAt: string
  openedBy: string
  openingCashUsd: number
  openingCashVes: number
  cashSalesUsd: number
  cashSalesVes: number
  paymentTotal: number
  paymentBreakdown: Record<string, number>
  paymentBreakdownVes: Record<string, number>
  movementInUsd: number
  movementOutUsd: number
  movementInVes: number
  movementOutVes: number
  expectedCashUsd: number
  expectedCashVes: number
  countedCashUsd: number | null
  countedCashVes: number | null
  differenceUsd: number | null
  differenceVes: number | null
  closedAt: string | null
  movements: CashMovement[]
}

// --- Créditos ----------------------------------------------------------------

export interface CashTransaction {
  id: string
  kind: 'payment' | 'movement'
  direction: 'in' | 'out'
  orderNumber: number | null
  orderType: string | null
  customerName: string | null
  method: string
  currency: 'USD' | 'VES'
  amount: number
  referenceNumber: string | null
  createdAt: string
  itemsSummary: string | null
}

export interface AuthUser {
  id: string
  email: string
  fullName: string
  role: 'owner' | 'manager' | 'cashier'
  isActive: boolean
  allowedModules: string[] | null
  createdAt: string
  lastSignInAt: string | null
}

export interface ProductionBonusRecord {
  id: string
  employeeId: string
  employeeName: string
  amount: number
  accountId: string | null
  accountName: string | null
  currency: 'USD' | 'VES' | null
  originalAmount: number | null
  exchangeRate: number | null
  bonusDate: string
  reason: string | null
  createdAt: string
}

