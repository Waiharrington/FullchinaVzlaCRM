import { MoneyWithBcv } from '../../components/MoneyWithBcv'
import { LoadingSkeleton } from '../../components/LoadingSkeleton'
import { formatUsd } from '../../lib/money'
import { Search, ChevronDown, ChevronLeft, ChevronRight, Clock, ShoppingBag, Bike, UtensilsCrossed, X } from 'lucide-react'
import { EmptyState } from '../../components/EmptyState'
import { ComandaOrder, compactPaymentLabel, compactCardTime } from '../comandas/model'
import { HistoryDayPicker } from '../comandas/ComandaCards'
import type { Dispatch, SetStateAction, RefObject } from 'react'

export interface HistoryModalProps {
  closingHistory: boolean
  closeHistoryModal: (then?: () => void) => void
  historyLoading: boolean
  filteredHistoryOrders: ComandaOrder[]
  historySearch: string
  setHistorySearch: Dispatch<SetStateAction<string>>
  setHistorySelectedDate: Dispatch<SetStateAction<string>>
  setHistoryMonthCursor: Dispatch<SetStateAction<Date>>
  Date: DateConstructor
  historyMonthCursor: Date
  canGoNextMonth: boolean
  historySelectedDate: string
  handleHistoryDateChange: (value: string) => void
  clearHistoryDate: () => void
  historyYearMenuRef: RefObject<HTMLDivElement | null>
  setShowHistoryYearMenu: Dispatch<SetStateAction<boolean>>
  showHistoryYearMenu: boolean
  Array: ArrayConstructor
  historyWeeksRef: RefObject<HTMLDivElement | null>
  historyWeeksInMonth: { key: string; start: Date; end: Date; label: string; }[]
  historyWeekStartKey: string | null
  setHistoryWeekStartKey: Dispatch<SetStateAction<string | null>>
  historyFilter: "all" | "unpaid" | "active" | "delivery" | "pickup"
  setHistoryFilter: Dispatch<SetStateAction<"all" | "unpaid" | "active" | "delivery" | "pickup">>
  historyGroups: { key: string; label: string; orders: ComandaOrder[]; total: number; }[]
  setSelectedOrder: Dispatch<SetStateAction<ComandaOrder | null>>
}

export function HistoryModal({ closingHistory, closeHistoryModal, historyLoading, filteredHistoryOrders, historySearch, setHistorySearch, setHistorySelectedDate, setHistoryMonthCursor, Date, historyMonthCursor, canGoNextMonth, historySelectedDate, handleHistoryDateChange, clearHistoryDate, historyYearMenuRef, setShowHistoryYearMenu, showHistoryYearMenu, Array, historyWeeksRef, historyWeeksInMonth, historyWeekStartKey, setHistoryWeekStartKey, historyFilter, setHistoryFilter, historyGroups, setSelectedOrder }: HistoryModalProps) {
  return (
    <div className={`cmd-modal-overlay ${closingHistory ? 'closing' : ''}`} onClick={() => closeHistoryModal()}>
          <div className={`cmd-history-modal ${closingHistory ? 'animate-pop-out' : 'animate-pop'}`} onClick={e => e.stopPropagation()}>
            <header className="cmd-history-header">
              <div className="cmd-history-title">
                <span className="cmd-history-icon"><Clock size={18} /></span>
                <div className="cmd-history-title-text">
                  <h2>Historial de comandas</h2>
                  <span className="cmd-history-subtitle">
                    {historyLoading ? <LoadingSkeleton label="Cargando comandas" variant="inline" /> : `${filteredHistoryOrders.length} comanda${filteredHistoryOrders.length !== 1 ? 's' : ''}`}
                  </span>
                </div>
              </div>
              <button className="cmd-close-btn" onClick={() => closeHistoryModal()}>
                <X size={20} />
              </button>
            </header>

            <div className="cmd-history-toolbar">
              <div className="cmd-history-search">
                <Search size={16} />
                <input
                  type="text"
                  placeholder="Buscar por #, cliente o producto..."
                  value={historySearch}
                  onChange={e => setHistorySearch(e.target.value)}
                  autoFocus
                />
                {historySearch && (
                  <button type="button" className="search-clear-btn" onClick={() => setHistorySearch('')} aria-label="Borrar búsqueda">
                    <X size={13} />
                  </button>
                )}
              </div>
            </div>

            <div className="cmd-history-nav">
              <div className="cmd-history-month-nav">
                <button
                  type="button"
                  className="cmd-history-month-btn"
                  aria-label="Mes anterior"
                  onClick={() => { setHistorySelectedDate(''); setHistoryMonthCursor(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1)) }}
                >
                  <ChevronLeft size={16} />
                </button>
                <span className="cmd-history-month-label">
                  {(() => {
                    const raw = historyMonthCursor.toLocaleDateString('es-VE', { month: 'long' })
                    return raw.charAt(0).toUpperCase() + raw.slice(1)
                  })()}
                </span>
                <button
                  type="button"
                  className="cmd-history-month-btn"
                  aria-label="Mes siguiente"
                  disabled={!canGoNextMonth}
                  onClick={() => { setHistorySelectedDate(''); setHistoryMonthCursor(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1)) }}
                >
                  <ChevronRight size={16} />
                </button>
              </div>
              <div className="cmd-history-nav-actions">
                <HistoryDayPicker
                  value={historySelectedDate}
                  monthCursor={historyMonthCursor}
                  onChange={handleHistoryDateChange}
                />
                {historySelectedDate && (
                  <button type="button" className="cmd-history-clear-date" onClick={clearHistoryDate}>
                    Ver semanas
                  </button>
                )}
                <div className="filter-dropdown-wrap" ref={historyYearMenuRef}>
                  <button
                    type="button"
                    className="cmd-history-year-btn"
                    aria-label="Año"
                    onClick={() => setShowHistoryYearMenu(v => !v)}
                  >
                    <span>{historyMonthCursor.getFullYear()}</span>
                    <ChevronDown size={12} />
                  </button>
                  {showHistoryYearMenu && (
                    <div className="filter-dropdown-menu cmd-history-year-menu">
                      {Array.from({ length: 4 }, (_, i) => new Date().getFullYear() - i).map(y => (
                        <button
                          key={y}
                          type="button"
                          className={historyMonthCursor.getFullYear() === y ? 'active' : ''}
                          onClick={() => {
                            setHistorySelectedDate('')
                            setHistoryMonthCursor(prev => new Date(y, prev.getMonth(), 1))
                            setShowHistoryYearMenu(false)
                          }}
                        >
                          {y}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {!historySelectedDate && (
              <div className="cmd-history-weeks-row">
                <div className="cmd-history-weeks" role="tablist" aria-label="Semana" ref={historyWeeksRef}>
                  {historyWeeksInMonth.map(w => (
                    <button
                      key={w.key}
                      type="button"
                      role="tab"
                      aria-selected={historyWeekStartKey === w.key}
                      className={`cmd-history-week-btn ${historyWeekStartKey === w.key ? 'active' : ''}`}
                      onClick={() => { setHistorySelectedDate(''); setHistoryWeekStartKey(w.key) }}
                    >
                      {w.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="cmd-history-filters" role="group" aria-label="Filtrar comandas">
              {([
                ['all', 'Todas'],
                ['unpaid', 'Sin cobrar'],
                ['active', 'En curso'],
                ['delivery', 'Delivery'],
                ['pickup', 'Para llevar / Mesa'],
              ] as const).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={historyFilter === value}
                  className={`cmd-history-filter ${historyFilter === value ? 'active' : ''}`}
                  onClick={() => setHistoryFilter(value)}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="cmd-history-body">
              {historyLoading ? (
                <div className="cmd-history-skeleton" role="status" aria-label="Cargando comandas">
                  <span className="cmd-history-skeleton-day cmd-history-skeleton-cell" aria-hidden="true"><i /><i /></span>
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div className="cmd-history-skeleton-row" key={i} aria-hidden="true">
                      <span className="cmd-history-skeleton-cell is-time"><i /><i /></span>
                      <span className="cmd-history-skeleton-cell is-main"><i /><i /><i /></span>
                      <span className="cmd-history-skeleton-cell is-side"><i /><i /></span>
                    </div>
                  ))}
                </div>
              ) : historyGroups.length === 0 ? (
                <EmptyState
                  compact
                  title="No se encontraron comandas"
                  description="Prueba con otro número, cliente o rango de fechas."
                />
              ) : (
                historyGroups.map(group => (
                  <section className="cmd-history-group" key={group.key}>
                    <h3 className="cmd-history-group-label">
                      <span>{group.label}</span>
                      <small>{group.orders.length} comanda{group.orders.length !== 1 ? 's' : ''} · {formatUsd(group.total)}</small>
                    </h3>
                    <div className="cmd-history-list">
                      {group.orders.map(order => {
                        const deliveryLine = order.items.find(item => item.name === 'Delivery')
                        const products = order.items.filter(item => item.name !== 'Delivery')
                        const productText = products.slice(0, 2).map(item => `${item.name} ×${item.quantity}`).join(', ')
                          + (products.length > 2 ? ` +${products.length - 2}` : '')
                        const statusLabel = order.status === 'new' ? 'Nueva' : order.status === 'preparing' ? 'En preparación' : order.status === 'ready' ? 'Lista' : 'Entregada'
                        const paidMethod = compactPaymentLabel(order.paymentMethod).replace(/^Pago combinado$/i, 'Combinado')
                        const state = order.status !== 'delivered'
                          ? { tone: 'active', label: `En curso · ${statusLabel}${order.isPaid ? ' · Pagado' : ''}` }
                          : order.isPaid
                            ? { tone: 'paid', label: `Pagado · ${paidMethod}` }
                            : order.creditAuthorized
                              ? { tone: 'credit', label: 'Crédito' }
                              : { tone: 'unpaid', label: 'Sin cobrar' }
                        return (
                          <button
                            key={order.id}
                            type="button"
                            className={`cmd-history-row is-${state.tone}`}
                            onClick={() => closeHistoryModal(() => setSelectedOrder(order))}
                          >
                            <span className="cmd-history-row-time">
                              <strong>{compactCardTime(order.time)}</strong>
                              <small>{/p\.?\s*m/i.test(order.time) ? 'p. m.' : /a\.?\s*m/i.test(order.time) ? 'a. m.' : ''}</small>
                            </span>
                            <span className="cmd-history-row-type" aria-hidden="true">
                              {order.orderType === 'Delivery' ? <Bike size={16} /> : order.orderType.startsWith('Mesa') ? <UtensilsCrossed size={16} /> : <ShoppingBag size={16} />}
                            </span>
                            <span className="cmd-history-row-main">
                              <span className="cmd-history-row-title">
                                <strong>{order.customerName}</strong>
                                <small>{order.orderNumber}</small>
                              </span>
                              <span className="cmd-history-row-detail">
                                <span className="cmd-history-row-kind">{order.orderType}{deliveryLine ? ` · ${formatUsd(deliveryLine.subtotal || 0)}` : ''}</span>
                                {productText && <span className="cmd-history-row-products">{productText}</span>}
                              </span>
                            </span>
                            <span className="cmd-history-row-side">
                              <MoneyWithBcv usd={order.totalAmount || 0} compact className="cmd-history-row-total" />
                              <span className={`cmd-history-state is-${state.tone}`}>{state.label}</span>
                            </span>
                          </button>
                        )
                      })}
                    </div>
                  </section>
                ))
              )}
            </div>
          </div>
        </div>
  )
}
