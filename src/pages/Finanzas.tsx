import { useEffect, useMemo, useState, useCallback } from 'react'
import { createPortal } from 'react-dom'
import {
  getOrdersWithItems, getExpenses, getPurchases, getRecipeSummaries, getPayrollSummary, getFinancialOperations, getFinancialAccounts, updateFinancialAccountOpeningBalance, createFinancialTransfer,
  type FullOrder, type Expense, type Purchase, type RecipeSummary, type FinancialOperation, type FinancialAccount,
} from '../lib/dataService'
import { buildDailyFinancialRows, sumFinancialRows, weekRangeFor } from '../lib/dailyFinancialSummary'
import { buildFinancialAccountActivity } from '../lib/financialAccountActivity'
import { useRates } from '../context/rates-context'
import { useAuth } from '../context/auth-context'
import { PageSkeleton } from '../components/PageSkeleton'
import { StyledSelect } from '../components/StyledSelect'
import { formatUsd, formatVes } from '../lib/money'
import {
  Target, ShoppingCart, Wallet, DollarSign, TrendingUp, Percent,
  Banknote, Smartphone, CreditCard, Building2, CalendarDays, Download, Pencil, Check, X,
  ChevronLeft, ChevronRight, CircleAlert, CircleCheckBig, ArrowRightLeft,
} from 'lucide-react'
import './Finanzas.css'

type Period = 'hoy' | 'ayer' | 'semana' | 'mes' | 'rango'
interface PL {
  grossSales: number; cogs: number; opex: number; payroll: number
  grossProfit: number; netProfit: number; margin: number
  ordersCount: number; avgTicket: number; payments: Record<string, number>
}
const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0)
const endOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999)
const addDays = (d: Date, n: number) => { const x = new Date(d); x.setDate(x.getDate() + n); return x }
const isoDate = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const pct = (cur: number, prev: number) => (prev > 0 ? ((cur - prev) / prev) * 100 : null)

const PAY_META: Record<string, { label: string; icon: React.ReactNode; color: string; sub?: string }> = {
  cash: { label: 'Efectivo', icon: <Banknote size={16} />, color: '#22c55e', sub: 'En caja física' },
  mobile: { label: 'Pago Móvil (Bancos)', icon: <Smartphone size={16} />, color: '#38bdf8', sub: 'Verificado con referencia' },
  card: { label: 'Punto de Venta', icon: <CreditCard size={16} />, color: '#a855f7', sub: 'Tarjeta crédito/débito' },
  transfer: { label: 'Transferencia', icon: <Building2 size={16} />, color: '#f59e0b' },
  binance: { label: 'Binance', icon: <DollarSign size={16} />, color: '#eab308' },
  zelle: { label: 'Zelle', icon: <DollarSign size={16} />, color: '#6366f1' },
  other: { label: 'Otro', icon: <Wallet size={16} />, color: '#71717a' },
}

export function Finanzas() {
  const { bcvRate } = useRates()
  const { user } = useAuth()
  const [orders, setOrders] = useState<FullOrder[]>([])
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [purchases, setPurchases] = useState<Purchase[]>([])
  const [recipeCost, setRecipeCost] = useState<Map<string, RecipeSummary>>(new Map())
  const [payroll, setPayroll] = useState<{ periods: Array<{ endDate: string; total: number }>; bonuses: Array<{ date: string; amount: number }> }>({ periods: [], bonuses: [] })
  const [operations, setOperations] = useState<FinancialOperation[]>([])
  const [accounts, setAccounts] = useState<FinancialAccount[]>([])
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState<Period>('semana')
  const [rangeStart, setRangeStart] = useState(isoDate(new Date()))
  const [rangeEnd, setRangeEnd] = useState(isoDate(new Date()))
  const [editingAccountId, setEditingAccountId] = useState<string | null>(null)
  const [openingBalanceDraft, setOpeningBalanceDraft] = useState('')
  const currentMonth = isoDate(new Date()).slice(0, 7)
  const [summaryMonth, setSummaryMonth] = useState(currentMonth)
  const [selectedSummaryDate, setSelectedSummaryDate] = useState(isoDate(new Date()))
  const [showTransfer, setShowTransfer] = useState(false)
  const [selectedAccount, setSelectedAccount] = useState<FinancialAccount | null>(null)
  const [selectedLedgerCurrency, setSelectedLedgerCurrency] = useState<'USD' | 'VES' | null>(null)
  const [transfer, setTransfer] = useState({ concept: '', from: '', to: '', currency: 'VES' as 'USD' | 'VES', amount: '', rate: '', reference: '', notes: '' })
  const [transferSaving, setTransferSaving] = useState(false)
  const [transferError, setTransferError] = useState('')

  const load = useCallback(async () => {
    try {
      setLoading(true)
      const now = new Date()
      const comparisonStart = new Date(now.getFullYear(), now.getMonth() - 1, 1)
      const selectedStart = new Date(`${summaryMonth}-01T00:00:00`)
      const dataStart = selectedStart < comparisonStart ? selectedStart : comparisonStart
      const [ords, exps, purchaseData, recipes, pay, ops, accts] = await Promise.all([
        getOrdersWithItems(dataStart.toISOString()),
        getExpenses(isoDate(dataStart)),
        getPurchases().catch((error) => { console.error('No se pudieron cargar las compras en Finanzas:', error); return [] }),
        getRecipeSummaries().catch(() => new Map<string, RecipeSummary>()),
        getPayrollSummary().catch(() => ({ periods: [], bonuses: [] })),
        getFinancialOperations(isoDate(dataStart)).catch(() => []),
        getFinancialAccounts().catch(() => []),
      ])
      setOrders(ords); setExpenses(exps); setPurchases(purchaseData); setRecipeCost(recipes); setPayroll(pay); setOperations(ops); setAccounts(accts)
    } catch (e) { console.error(e) } finally { setLoading(false) }
  }, [summaryMonth])
  useEffect(() => { void load() }, [load])

  const computePL = useCallback((start: Date, end: Date): PL => {
    const s = start.getTime(), e = end.getTime()
    const sIso = isoDate(start), eIso = isoDate(end)
    const paid = orders.filter((o) => { const t = new Date(o.createdAt).getTime(); return o.status === 'paid' && t >= s && t <= e })
    const grossSales = paid.reduce((sum, o) => sum + o.totalAmount, 0)
    let cogs = 0
    const payments: Record<string, number> = {}
    for (const o of paid) {
      for (const it of o.items) cogs += it.quantity * (recipeCost.get(it.sellableProductId)?.recipeCost ?? 0)
      for (const p of o.payments) payments[p.method] = (payments[p.method] ?? 0) + p.amount
    }
    const opex = expenses.filter((x) => x.expenseDate >= sIso && x.expenseDate <= eIso).reduce((sum, x) => sum + x.amount, 0)
    const pay = payroll.periods.filter((p) => p.endDate >= sIso && p.endDate <= eIso).reduce((sum, p) => sum + p.total, 0)
      + payroll.bonuses.filter((b) => b.date >= sIso && b.date <= eIso).reduce((sum, b) => sum + b.amount, 0)
    const grossProfit = grossSales - cogs
    const netProfit = grossProfit - opex - pay
    return {
      grossSales, cogs, opex, payroll: pay, grossProfit, netProfit,
      margin: grossSales > 0 ? (netProfit / grossSales) * 100 : 0,
      ordersCount: paid.length, avgTicket: paid.length > 0 ? grossSales / paid.length : 0, payments,
    }
  }, [orders, expenses, recipeCost, payroll])

  const ranges = useMemo(() => {
    const now = new Date()
    const monday = startOfDay(addDays(now, -((now.getDay() + 6) % 7)))
    const monthStart = startOfDay(new Date(now.getFullYear(), now.getMonth(), 1))
    const customStart = startOfDay(new Date(`${rangeStart}T00:00:00`))
    const customEnd = endOfDay(new Date(`${rangeEnd}T00:00:00`))
    return {
      hoy: [startOfDay(now), endOfDay(now)] as const,
      ayer: [startOfDay(addDays(now, -1)), endOfDay(addDays(now, -1))] as const,
      semana: [monday, endOfDay(now)] as const,
      mes: [monthStart, endOfDay(now)] as const,
      prevDay2: [startOfDay(addDays(now, -1)), endOfDay(addDays(now, -1))] as const,
      rango: [customStart, customEnd] as const,
    }
  }, [rangeStart, rangeEnd])

  const pls = useMemo(() => (loading ? null : {
    hoy: computePL(...ranges.hoy), ayer: computePL(...ranges.ayer),
    semana: computePL(...ranges.semana), mes: computePL(...ranges.mes), rango: computePL(...ranges.rango),
  }), [loading, computePL, ranges])

  const dailyRows = useMemo(() => buildDailyFinancialRows(summaryMonth, orders, purchases, expenses), [summaryMonth, orders, purchases, expenses])
  const monthTotals = useMemo(() => sumFinancialRows(dailyRows), [dailyRows])
  const selectedWeek = useMemo(() => weekRangeFor(selectedSummaryDate), [selectedSummaryDate])
  const weekRows = useMemo(() => dailyRows.filter(row => row.date >= selectedWeek.start && row.date <= selectedWeek.end), [dailyRows, selectedWeek])
  const weekTotals = useMemo(() => sumFinancialRows(weekRows), [weekRows])
  const selectedDay = dailyRows.find(row => row.date === selectedSummaryDate) ?? dailyRows[0]
  const accountActivity = useMemo(() => buildFinancialAccountActivity(
    accounts,
    orders,
    expenses,
    purchases,
    isoDate(ranges[period][0]),
    isoDate(ranges[period][1]),
  ), [accounts, orders, expenses, purchases, period, ranges])
  const changeSummaryMonth = (offset: number) => {
    const [year, month] = summaryMonth.split('-').map(Number)
    const next = new Date(year, month - 1 + offset, 1)
    const value = `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}`
    setSummaryMonth(value)
    setSelectedSummaryDate(`${value}-01`)
  }

  if (loading || !pls) return <PageSkeleton cards={4} rows={6} />

  const cur = pls[period]
  const prev = pls.ayer // referencia de comparación para las tarjetas
  const currentPaidOrders = orders.filter(order => {
    const time = new Date(order.createdAt).getTime()
    return order.status === 'paid' && time >= ranges[period][0].getTime() && time <= ranges[period][1].getTime()
  })
  const missingCostProducts = Array.from(new Set(currentPaidOrders.flatMap(order => order.items)
    .filter(item => !recipeCost.has(item.sellableProductId) || (recipeCost.get(item.sellableProductId)?.recipeCost ?? 0) <= 0)
    .map(item => item.productName)))
  const unassignedPayments = currentPaidOrders.flatMap(order => order.payments).filter(payment => !payment.accountId).length
  const coverageTarget = cur.cogs + cur.opex + cur.payroll
  const coverageReady = coverageTarget > 0 && missingCostProducts.length === 0
  const coveragePct = coverageReady ? Math.min(100, Math.round((cur.grossSales / coverageTarget) * 100)) : 0
  const totalPayments = Object.values(cur.payments).reduce((s, v) => s + v, 0)
  const periodOperations = operations.filter((op) => op.operationDate >= isoDate(ranges[period][0]) && op.operationDate <= isoDate(ranges[period][1]))
  const periodLabel = period === 'hoy' ? 'Hoy' : period === 'ayer' ? 'Ayer' : period === 'semana' ? 'Esta semana' : period === 'mes' ? 'Este mes' : `${rangeStart} al ${rangeEnd}`
  const salesUsd = Object.entries(cur.payments).filter(([method]) => ['cash','binance','zelle'].includes(method)).reduce((sum,[,amount]) => sum+amount,0)
  const salesVesUsd = Math.max(cur.grossSales-salesUsd,0)
  const buildAccountDay = (account: FinancialAccount) => {
    const amountFor = (usd: number, rate: number | null) => account.currency === 'VES' ? usd * (rate || bcvRate || 0) : usd
    const operationAmount = (op: FinancialOperation) => account.currency === op.originalCurrency
      ? op.originalAmount
      : account.currency === 'USD' ? op.amountUsd : op.amountUsd * (op.exchangeRate || bcvRate || 0)
    const day = selectedSummaryDate
    const sales = orders.filter(order => order.status === 'paid' && isoDate(new Date(order.createdAt)) === day)
      .flatMap(order => order.payments.map(payment => ({ payment, rate: order.bcvRate })))
      .filter(row => row.payment.accountId === account.id)
      .reduce((sum, row) => sum + amountFor(row.payment.amount, row.rate), 0)
    const expensesDay = expenses.filter(row => row.accountId === account.id && row.expenseDate === day)
      .reduce((sum, row) => sum + amountFor(row.amount, row.exchangeRate), 0)
    const purchasesDay = purchases.filter(row => row.isPaid && row.accountId === account.id && row.purchaseDate === day)
      .reduce((sum, row) => sum + amountFor(row.totalAmount, row.exchangeRate), 0)
    let collections = 0; let transfers = 0; let others = 0
    for (const op of operations.filter(row => row.operationDate === day)) {
      const signed = op.toAccount === account.name ? operationAmount(op) : op.fromAccount === account.name ? -operationAmount(op) : 0
      if (!signed) continue
      if (op.type === 'receivable_collection') collections += signed
      else if (op.type === 'transfer') transfers += signed
      else others += signed
    }
    const dayNet = sales - expensesDay - purchasesDay + collections + transfers + others
    const tomorrow = isoDate(addDays(new Date(`${day}T12:00:00`), 1))
    const afterStart = day < isoDate(new Date()) ? tomorrow : '9999-12-31'
    const afterActivity = buildFinancialAccountActivity(accounts, orders, expenses, purchases, afterStart, '9999-12-31').get(account.id)?.net ?? 0
    const afterOperations = operations.filter(op => op.operationDate > day).reduce((sum, op) => {
      const value = operationAmount(op)
      return sum + (op.toAccount === account.name ? value : op.fromAccount === account.name ? -value : 0)
    }, 0)
    const closing = account.currentBalance - afterActivity - afterOperations
    return { opening: closing - dayNet, sales, expenses: expensesDay, purchases: purchasesDay, collections, transfers, others, closing }
  }
  const saveOpeningBalance = async (account: FinancialAccount) => {
    const value = Number(openingBalanceDraft)
    if (!Number.isFinite(value)) return
    await updateFinancialAccountOpeningBalance(account.id, value)
    setAccounts(await getFinancialAccounts())
    setEditingAccountId(null)
  }
  const saveTransfer = async () => {
    setTransferError('')
    if (!user || !transfer.from || !transfer.to || !transfer.concept) return setTransferError('Completa concepto y cuentas')
    try {
      setTransferSaving(true)
      await createFinancialTransfer({ concept: transfer.concept, operationDate: isoDate(new Date()), fromAccountId: transfer.from, toAccountId: transfer.to, originalCurrency: transfer.currency, originalAmount: Number(transfer.amount), exchangeRate: transfer.currency === 'VES' ? Number(transfer.rate) : null, referenceNumber: transfer.reference, notes: transfer.notes, userId: user.id })
      setShowTransfer(false); setTransfer({ concept: '', from: '', to: '', currency: 'VES', amount: '', rate: '', reference: '', notes: '' }); await load()
    } catch (error) { setTransferError(error instanceof Error ? error.message : 'No se pudo guardar la transferencia') } finally { setTransferSaving(false) }
  }

  const exportReport = () => {
    const rows = [
      ['Concepto', `${periodLabel} (USD)`, '% Ventas'],
      ['Ventas Totales Brutas', cur.grossSales.toFixed(2), '100.0'],
      ['Costo de Productos Vendidos', (-cur.cogs).toFixed(2), cur.grossSales > 0 ? (-cur.cogs / cur.grossSales * 100).toFixed(1) : '0'],
      ['Ganancia Bruta', cur.grossProfit.toFixed(2), cur.grossSales > 0 ? (cur.grossProfit / cur.grossSales * 100).toFixed(1) : '0'],
      ['Gastos Operativos', (-cur.opex).toFixed(2), cur.grossSales > 0 ? (-cur.opex / cur.grossSales * 100).toFixed(1) : '0'],
      ['Nómina', (-cur.payroll).toFixed(2), cur.grossSales > 0 ? (-cur.payroll / cur.grossSales * 100).toFixed(1) : '0'],
      ['Ganancia Neta Final', cur.netProfit.toFixed(2), cur.margin.toFixed(1)],
    ]
    const csv = rows.map((r) => r.map((c) => `"${c}"`).join(',')).join('\n')
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }))
    const a = document.createElement('a'); a.href = url; a.download = `finanzas_${period}_${isoDate(new Date())}.csv`; a.click(); URL.revokeObjectURL(url)
  }

  const salesDelta = pct(cur.grossSales, prev.grossSales)
  const netDelta = pct(cur.netProfit, prev.netProfit)
  const marginPP = cur.margin - prev.margin
  const cogsPctSales = cur.grossSales > 0 ? (cur.cogs / cur.grossSales) * 100 : 0
  const financialWarnings = [
    ...(accounts.length === 0 ? ['No hay cuentas financieras configuradas; no se pueden conciliar saldos.'] : []),
    ...(unassignedPayments > 0 ? [`${unassignedPayments} cobro${unassignedPayments === 1 ? '' : 's'} sin cuenta de destino en ${periodLabel.toLowerCase()}.`] : []),
    ...(missingCostProducts.length > 0 ? [`Falta costo de receta para ${missingCostProducts.slice(0, 3).join(', ')}${missingCostProducts.length > 3 ? ` y ${missingCostProducts.length - 3} producto(s) más` : ''}.`] : []),
  ]

  return (
    <div className="page fin-page animate-fade-in management-workspace management-workspace--finance">
      <header className="page-header management-workspace-header">
        <div>
          <h1 className="page-title"><TrendingUp size={22} className="page-title-icon" /> Finanzas & Cierre Financiero Automático</h1>
          <p className="page-subtitle">Consolidado sin planillas de Excel. Punto de equilibrio y rentabilidad real del negocio.</p>
        </div>
        <div className="fin-head-actions">
          <span className="fin-period"><CalendarDays size={15} />
            <StyledSelect value={period} onChange={(e) => setPeriod(e.target.value as Period)}>
              <option value="hoy">Hoy</option><option value="ayer">Ayer</option><option value="semana">Esta semana</option><option value="mes">Este mes</option><option value="rango">Rango personalizado</option>
            </StyledSelect>
          </span>
          {period === 'rango' && <span className="fin-date-range"><input type="date" value={rangeStart} onChange={(e) => setRangeStart(e.target.value)} /><span>a</span><input type="date" value={rangeEnd} min={rangeStart} onChange={(e) => setRangeEnd(e.target.value)} /></span>}
          <button className="fin-export" onClick={exportReport}><Download size={15} /> Exportar reporte</button>
        </div>
      </header>

      <section className={`fin-data-status ${financialWarnings.length ? 'warning' : 'ready'}`}>
        {financialWarnings.length ? <CircleAlert size={20} /> : <CircleCheckBig size={20} />}
        <div>
          <strong>{financialWarnings.length ? 'Datos que requieren atención' : 'Datos conciliables'}</strong>
          {financialWarnings.length ? <ul>{financialWarnings.map(message => <li key={message}>{message}</li>)}</ul> : <p>Los cobros del período tienen cuenta y los productos vendidos tienen costo registrado.</p>}
        </div>
      </section>

      {/* Cobertura de costos registrados */}
      <div className="fin-be">
        <div className="fin-be-top">
          <div style={{ display: 'flex', gap: 10 }}>
            <span className="fin-be-ic"><Target size={20} /></span>
            <div><h2>Cobertura de costos del período</h2><p>Compara las ventas con insumos, gastos y nómina realmente registrados.</p></div>
          </div>
          <div className="fin-be-target"><span className="v">{coverageReady ? formatUsd(coverageTarget) : 'No calculable'}</span><span className="l">Costos registrados</span></div>
        </div>
        <div className="fin-be-bar"><div style={{ width: `${coveragePct}%` }} /></div>
        <div className="fin-be-legend">
          <span style={{ color: '#eab308', fontWeight: 700 }}>{coverageReady ? `${coveragePct}% cubierto` : 'Completa los datos señalados'}</span>
          <span>Llevas {formatUsd(cur.grossSales)} vendidos</span>
          <span>{coverageReady ? (cur.grossSales >= coverageTarget ? 'Resultado operativo positivo' : `Faltan ${formatUsd(coverageTarget - cur.grossSales)} para cubrir costos`) : 'No se mostrará una utilidad incompleta'}</span>
        </div>
      </div>

      {/* KPIs */}
      <div className="fin-kpis management-workspace-metrics">
        <div className="fin-kpi green">
          <div className="fin-kpi-top"><span className="fin-kpi-ic"><ShoppingCart size={18} /></span>
            <div><div className="fin-kpi-lbl">Ventas Brutas Totales</div><div className="fin-kpi-val">{formatUsd(cur.grossSales)}</div></div></div>
          <div className="fin-kpi-sub">{salesDelta != null ? <span className={salesDelta >= 0 ? 'fin-up' : 'fin-down'}>{salesDelta >= 0 ? '▲' : '▼'} {Math.abs(salesDelta).toFixed(0)}% vs ayer</span> : periodLabel}</div>
        </div>
        <div className="fin-kpi red">
          <div className="fin-kpi-top"><span className="fin-kpi-ic"><Wallet size={18} /></span>
            <div><div className="fin-kpi-lbl">Costo de Insumos (COGS)</div><div className="fin-kpi-val">{formatUsd(cur.cogs)}</div></div></div>
          <div className="fin-kpi-sub fin-down">{cogsPctSales.toFixed(1)}% de las ventas</div>
        </div>
        <div className="fin-kpi purple">
          <div className="fin-kpi-top"><span className="fin-kpi-ic"><DollarSign size={18} /></span>
            <div><div className="fin-kpi-lbl">Gastos + Nómina</div><div className="fin-kpi-val">{formatUsd(cur.opex + cur.payroll)}</div></div></div>
          <div className="fin-kpi-sub">{formatUsd(cur.opex)} gastos · {formatUsd(cur.payroll)} nómina</div>
        </div>
        <div className="fin-kpi green">
          <div className="fin-kpi-top"><span className="fin-kpi-ic"><TrendingUp size={18} /></span>
            <div><div className="fin-kpi-lbl">Ganancia Neta Estimada</div><div className="fin-kpi-val" style={{ color: cur.netProfit >= 0 ? '#22c55e' : '#ef4444' }}>{formatUsd(cur.netProfit)}</div></div></div>
          <div className="fin-kpi-sub">{netDelta != null ? <span className={netDelta >= 0 ? 'fin-up' : 'fin-down'}>{netDelta >= 0 ? '▲' : '▼'} {Math.abs(netDelta).toFixed(0)}% vs ayer</span> : `${cur.margin.toFixed(1)}% de las ventas`}</div>
        </div>
        <div className="fin-kpi blue">
          <div className="fin-kpi-top"><span className="fin-kpi-ic"><Percent size={18} /></span>
            <div><div className="fin-kpi-lbl">Margen Neto</div><div className="fin-kpi-val">{cur.margin.toFixed(1)}%</div></div></div>
          <div className="fin-kpi-sub"><span className={marginPP >= 0 ? 'fin-up' : 'fin-down'}>{marginPP >= 0 ? '▲' : '▼'} {Math.abs(marginPP).toFixed(1)} pp vs ayer</span></div>
        </div>
      </div>

      <div className="fin-card fin-accounts-card management-workspace-panel">
        <h2>Saldos actuales por cuenta</h2>
        <p className="sub">Saldo inicial más cobros, menos compras y gastos asociados a cada cuenta.</p>
        <div className="fin-account-grid">
          {accounts.map((account) => {
            const activity = accountActivity.get(account.id) ?? { inflows: 0, outflows: 0, net: 0 }
            const money = (value: number) => account.currency === 'VES' ? formatVes(value) : formatUsd(value)
            const reference = bcvRate
              ? account.currency === 'VES'
                ? `≈ ${formatUsd(account.currentBalance / bcvRate)} al BCV de hoy`
                : `≈ ${formatVes(account.currentBalance * bcvRate)} al BCV de hoy`
              : null
            return (
            <div className="fin-account-box" key={account.id} role="button" tabIndex={0} onClick={() => setSelectedAccount(account)} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') setSelectedAccount(account) }}>
              <span>{account.name}</span><strong>{account.currency === 'VES' ? formatVes(account.currentBalance) : formatUsd(account.currentBalance)}</strong>
              <small>{account.currency} · saldo actual</small>{reference && <small className="fin-account-reference">{reference}</small>}
              <div className="fin-account-activity"><span>Entradas <b>{money(activity.inflows)}</b></span><span>Salidas <b>{money(activity.outflows)}</b></span><span className={activity.net >= 0 ? 'positive' : 'negative'}>Neto {money(activity.net)}</span></div>
              {editingAccountId === account.id ? <div className="fin-opening-edit" onClick={event => event.stopPropagation()}><input type="text" inputMode="decimal" value={openingBalanceDraft} onChange={(e) => setOpeningBalanceDraft(e.target.value)} /><button onClick={() => void saveOpeningBalance(account)} title="Guardar"><Check size={14}/></button><button onClick={() => setEditingAccountId(null)} title="Cancelar"><X size={14}/></button></div> : <button className="fin-opening-btn" onClick={(event) => { event.stopPropagation(); setEditingAccountId(account.id); setOpeningBalanceDraft(String(account.openingBalance)) }}><Pencil size={12}/> Saldo inicial</button>}
            </div>
          )})}
          {accounts.length === 0 && <p className="fin-account-empty">Configura las cuentas para ver Banco Exterior, Banesco, efectivo y punto de venta.</p>}
        </div>
      </div>

      <div className="fin-currency-summary">
        <button className="fin-card" onClick={() => setSelectedLedgerCurrency('VES')}><span className="sub">Cobros recibidos en bolívares · {periodLabel}</span><strong>{bcvRate ? formatVes(salesVesUsd * bcvRate) : 'Bs. —'}</strong><small>{formatUsd(salesVesUsd)} de referencia contable · Ver control diario</small></button>
        <button className="fin-card" onClick={() => setSelectedLedgerCurrency('USD')}><span className="sub">Cobros recibidos en dólares · {periodLabel}</span><strong>{formatUsd(salesUsd)}</strong><small>Efectivo y medios denominados en USD · Ver control diario</small></button>
      </div>

      <section className="fin-card fin-daily-summary">
        <div className="fin-daily-head">
          <div><h2>Resumen diario de operación</h2><p className="sub">Ventas y egresos reales organizados como el control diario del negocio.</p></div>
          <div className="fin-month-nav"><button onClick={() => changeSummaryMonth(-1)} aria-label="Mes anterior"><ChevronLeft size={16}/></button><input type="month" value={summaryMonth} max={currentMonth} onChange={event => { setSummaryMonth(event.target.value); setSelectedSummaryDate(`${event.target.value}-01`) }} aria-label="Mes del resumen"/><button onClick={() => changeSummaryMonth(1)} disabled={summaryMonth >= currentMonth} aria-label="Mes siguiente"><ChevronRight size={16}/></button></div>
        </div>
        <div className="fin-daily-layout">
          <div className="fin-daily-table-wrap">
            <table className="fin-daily-table">
              <thead><tr><th>Día</th><th>Ventas</th><th>Total egresos</th><th>Compras</th><th>Gastos fijos</th><th>Gastos variables</th><th>Otros</th><th>Diferencia</th></tr></thead>
              <tbody>{dailyRows.map(row => <tr key={row.date} className={selectedSummaryDate === row.date ? 'selected' : ''} onClick={() => setSelectedSummaryDate(row.date)}><td><button>{row.day}</button></td><td className="sales">{formatUsd(row.sales)}</td><td className="outflow">{formatUsd(row.totalOutflows)}</td><td>{formatUsd(row.purchases)}</td><td>{formatUsd(row.fixedExpenses)}</td><td>{formatUsd(row.variableExpenses)}</td><td>{formatUsd(row.otherExpenses)}</td><td className={row.difference >= 0 ? 'positive' : 'negative'}>{formatUsd(row.difference)}</td></tr>)}</tbody>
              <tfoot><tr><td>Mes</td><td>{formatUsd(monthTotals.sales)}</td><td>{formatUsd(monthTotals.totalOutflows)}</td><td>{formatUsd(monthTotals.purchases)}</td><td>{formatUsd(monthTotals.fixedExpenses)}</td><td>{formatUsd(monthTotals.variableExpenses)}</td><td>{formatUsd(monthTotals.otherExpenses)}</td><td className={monthTotals.difference >= 0 ? 'positive' : 'negative'}>{formatUsd(monthTotals.difference)}</td></tr></tfoot>
            </table>
          </div>
          <aside className="fin-week-summary">
            <div className="fin-week-title"><span>Semana seleccionada</span><strong>{selectedWeek.start.slice(8)} al {selectedWeek.end.slice(8)}</strong></div>
            <div className="fin-week-primary"><span>Ventas</span><strong>{formatUsd(weekTotals.sales)}</strong></div>
            <div className={`fin-week-primary difference ${weekTotals.difference >= 0 ? 'positive' : 'negative'}`}><span>Diferencia</span><strong>{formatUsd(weekTotals.difference)}</strong></div>
            <div className="fin-week-primary"><span>Egresos</span><strong>{formatUsd(weekTotals.totalOutflows)}</strong></div>
            <dl><div><dt>Compras</dt><dd>{formatUsd(weekTotals.purchases)}</dd></div><div><dt>Gastos fijos</dt><dd>{formatUsd(weekTotals.fixedExpenses)}</dd></div><div><dt>Gastos variables</dt><dd>{formatUsd(weekTotals.variableExpenses)}</dd></div><div><dt>Otros</dt><dd>{formatUsd(weekTotals.otherExpenses)}</dd></div></dl>
            {selectedDay && <div className="fin-selected-day"><small>Día seleccionado · {selectedDay.date}</small><span>Ventas {formatUsd(selectedDay.sales)} · Egresos {formatUsd(selectedDay.totalOutflows)}</span></div>}
          </aside>
        </div>
      </section>

      <div className="fin-card">
            <h2>Cierre por Método de Pago</h2>
            <p className="sub">Total cobrado en {periodLabel.toLowerCase()} según los métodos usados en Caja.</p>
            {Object.entries(cur.payments).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]).map(([m, v]) => {
              const meta = PAY_META[m] ?? PAY_META.other
              return (
                <div className="fin-pay-row" key={m}>
                  <span className="fin-pay-ic" style={{ background: `${meta.color}22`, color: meta.color }}>{meta.icon}</span>
                  <span className="fin-pay-name">{meta.label}{meta.sub && <small>{meta.sub}</small>}</span>
                  <span className="fin-pay-amt">{formatUsd(v)}{bcvRate ? <small style={{ display: 'block', color: '#71717a', fontWeight: 400 }}>{formatVes(v * bcvRate)}</small> : null}</span>
                  <span className="fin-pay-pct">{totalPayments > 0 ? ((v / totalPayments) * 100).toFixed(1) : '0'}%</span>
                </div>
              )
            })}
            {totalPayments === 0 && <p style={{ color: '#71717a', padding: '10px 0' }}>Sin cobros en el período.</p>}
            <div className="fin-pay-total"><span>Total Cobrado</span><span className="g">{formatUsd(totalPayments)}</span></div>
      </div>
      <div className="fin-card">
        <h2>Movimientos administrativos</h2>
        <p className="sub">Traspasos, cuentas por cobrar, adelantos, préstamos y propinas. Los que no afectan utilidad se muestran sin convertirlos en gastos.</p>
        <button className="fin-export" onClick={() => setShowTransfer(true)}><ArrowRightLeft size={15} /> Registrar transferencia</button>
        <div className="fin-ops">
          {periodOperations.slice(0, 12).map((op) => (
            <div className="fin-op" key={op.id}>
              <div><strong>{op.concept}</strong><small>{op.operationDate} · {op.type.replace(/_/g, ' ')}{op.counterparty ? ` · ${op.counterparty}` : ''}</small></div>
              <div className="fin-op-route">{op.fromAccount && <span>{op.fromAccount}</span>}{op.fromAccount && op.toAccount && ' → '}{op.toAccount && <span>{op.toAccount}</span>}</div>
              <div className="fin-op-amount">{formatUsd(op.amountUsd)}<small className={op.affectsProfit ? 'fin-down' : 'fin-neutral'}>{op.affectsProfit ? 'Afecta resultado' : 'No altera utilidad'}</small></div>
            </div>
          ))}
          {periodOperations.length === 0 && <p style={{ color: '#71717a' }}>Sin movimientos administrativos en este período.</p>}
        </div>
      </div>
      {selectedAccount && (() => {
        const ledger = buildAccountDay(selectedAccount)
        const money = (value: number) => selectedAccount.currency === 'VES' ? formatVes(value) : formatUsd(value)
        return createPortal(<div className="modal-overlay-dark fin-modal-overlay" role="dialog" aria-modal="true" onClick={() => setSelectedAccount(null)}><div className="modal-card fin-account-modal" onClick={event => event.stopPropagation()}>
          <div className="fin-account-modal-head"><div><span>CONTROL DIARIO POR CUENTA</span><h2>{selectedAccount.name}</h2><p>{selectedSummaryDate} · {selectedAccount.currency === 'VES' ? `BCV ${formatVes(bcvRate || 0)} por $1` : 'Cuenta en dólares'}</p></div><button className="icon-btn" onClick={() => setSelectedAccount(null)} aria-label="Cerrar"><X size={18}/></button></div>
          <div className="fin-account-modal-balance"><span>Saldo actual</span><strong>{money(ledger.closing)}</strong>{bcvRate ? <small>{selectedAccount.currency === 'VES' ? `≈ ${formatUsd(ledger.closing / bcvRate)}` : `≈ ${formatVes(ledger.closing * bcvRate)}`}</small> : null}</div>
          <table className="fin-account-ledger"><tbody>
            <tr><th>Saldo anterior</th><td>{money(ledger.opening)}</td></tr>
            <tr className="income"><th>Ventas del día</th><td>+ {money(ledger.sales)}</td></tr>
            <tr className="expense"><th>Gastos del día</th><td>- {money(ledger.expenses)}</td></tr>
            <tr className="expense"><th>Compras pagadas</th><td>- {money(ledger.purchases)}</td></tr>
            <tr><th>Cuentas cobradas</th><td>{ledger.collections >= 0 ? '+' : '-'} {money(Math.abs(ledger.collections))}</td></tr>
            <tr><th>Transferencias / Punto por hacerse efectivo</th><td>{ledger.transfers >= 0 ? '+' : '-'} {money(Math.abs(ledger.transfers))}</td></tr>
            <tr><th>Otros movimientos</th><td>{ledger.others >= 0 ? '+' : '-'} {money(Math.abs(ledger.others))}</td></tr>
            <tr className="total"><th>Saldo actual</th><td>{money(ledger.closing)}</td></tr>
          </tbody></table>
          <div className="fin-account-modal-foot"><button onClick={() => setSelectedAccount(null)}>Cerrar</button><button className="fin-export" onClick={() => { setSelectedAccount(null); setShowTransfer(true) }}><ArrowRightLeft size={15}/> Registrar movimiento</button></div>
        </div></div>, document.body)
      })()}
      {selectedLedgerCurrency && (() => {
        const ledgerAccounts = accounts.filter(account => account.currency === selectedLedgerCurrency)
        const rows = ledgerAccounts.map(account => ({ account, ledger: buildAccountDay(account) }))
        const money = (value: number) => selectedLedgerCurrency === 'VES' ? formatVes(value) : formatUsd(value)
        const cells = (pick: (ledger: ReturnType<typeof buildAccountDay>) => number, sign: 'income' | 'expense' | 'neutral' = 'neutral') => rows.map(({ account, ledger }) => {
          const value = pick(ledger)
          const prefix = sign === 'income' && value ? '+' : sign === 'expense' && value ? '-' : ''
          return <td key={account.id}>{prefix} {money(Math.abs(value))}</td>
        })
        return createPortal(<div className="modal-overlay-dark fin-modal-overlay" role="dialog" aria-modal="true" onClick={() => setSelectedLedgerCurrency(null)}><div className="modal-card fin-account-modal fin-ledger-modal" onClick={event => event.stopPropagation()}>
          <div className="fin-account-modal-head"><div><span>CONTROL DIARIO DE SALDOS</span><h2>{selectedLedgerCurrency === 'VES' ? 'Bolívares' : 'Dólares'}</h2><p>{selectedSummaryDate} · {bcvRate ? `Tasa BCV ${formatVes(bcvRate)} por $1` : 'Sin tasa BCV disponible'}</p></div><button className="icon-btn" onClick={() => setSelectedLedgerCurrency(null)} aria-label="Cerrar"><X size={18}/></button></div>
          {rows.length ? <div className="fin-ledger-scroll"><table className="fin-account-ledger fin-account-ledger-wide"><thead><tr><th>Movimiento</th>{rows.map(({ account }) => <th key={account.id}>{account.name}</th>)}</tr></thead><tbody>
            <tr><th>Saldo anterior</th>{cells(ledger => ledger.opening)}</tr>
            <tr className="income"><th>Ventas del día</th>{cells(ledger => ledger.sales, 'income')}</tr>
            <tr className="expense"><th>Gastos del día</th>{cells(ledger => ledger.expenses, 'expense')}</tr>
            <tr className="expense"><th>Compras pagadas</th>{cells(ledger => ledger.purchases, 'expense')}</tr>
            <tr><th>Cuentas cobradas</th>{cells(ledger => ledger.collections)}</tr>
            <tr><th>Punto / Transferencias</th>{cells(ledger => ledger.transfers)}</tr>
            <tr><th>Otros movimientos</th>{cells(ledger => ledger.others)}</tr>
            <tr className="total"><th>Saldo actual</th>{cells(ledger => ledger.closing)}</tr>
          </tbody></table></div> : <p className="fin-ledger-empty">No hay cuentas activas configuradas en esta moneda.</p>}
          <div className="fin-account-modal-foot"><button onClick={() => setSelectedLedgerCurrency(null)}>Cerrar</button><button className="fin-export" onClick={() => { setSelectedLedgerCurrency(null); setShowTransfer(true) }}><ArrowRightLeft size={15}/> Registrar movimiento</button></div>
        </div></div>, document.body)
      })()}
      {showTransfer && createPortal(<div className="modal-overlay-dark fin-modal-overlay" role="dialog" aria-modal="true"><div className="modal-card fin-transfer-modal">
        <div className="fin-pl-head"><div><h2>Registrar transferencia</h2><p className="sub">Mueve dinero entre cuentas sin afectar la utilidad.</p></div><button className="icon-btn" onClick={() => setShowTransfer(false)}><X size={18}/></button></div>
        <input placeholder="Concepto (ej. Depósito del punto a Banesco)" value={transfer.concept} onChange={e => setTransfer({...transfer, concept: e.target.value})}/>
        <div className="fin-transfer-grid"><label>Desde<select value={transfer.from} onChange={e => setTransfer({...transfer, from: e.target.value})}><option value="">Selecciona cuenta</option>{accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}</select></label><label>Hacia<select value={transfer.to} onChange={e => setTransfer({...transfer, to: e.target.value})}><option value="">Selecciona cuenta</option>{accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}</select></label></div>
        <div className="fin-transfer-grid"><label>Moneda<select value={transfer.currency} onChange={e => setTransfer({...transfer, currency: e.target.value as 'USD'|'VES'})}><option value="VES">Bolívares</option><option value="USD">Dólares</option></select></label><label>Monto<input type="number" min="0" step="0.01" value={transfer.amount} onChange={e => setTransfer({...transfer, amount: e.target.value})}/></label></div>
        {transfer.currency === 'VES' && <label>Tasa de cambio<input type="number" min="0" step="0.000001" placeholder={String(bcvRate || '')} value={transfer.rate} onChange={e => setTransfer({...transfer, rate: e.target.value})}/></label>}
        <input placeholder="Referencia (opcional)" value={transfer.reference} onChange={e => setTransfer({...transfer, reference: e.target.value})}/><textarea placeholder="Notas (opcional)" value={transfer.notes} onChange={e => setTransfer({...transfer, notes: e.target.value})}/>
        {transferError && <p className="fin-down">{transferError}</p>}<div className="fin-modal-actions"><button onClick={() => setShowTransfer(false)}>Cancelar</button><button className="fin-export" disabled={transferSaving} onClick={() => void saveTransfer()}>{transferSaving ? 'Guardando...' : 'Guardar transferencia'}</button></div>
      </div></div>, document.body)}
    </div>
  )
}
