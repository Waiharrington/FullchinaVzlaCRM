import { useDraggable, useDroppable } from '@dnd-kit/core'
import { LoadingSkeleton } from '../../components/LoadingSkeleton'
import { MoneyWithBcv } from '../../components/MoneyWithBcv'
import { CalendarPicker } from '../../components/CalendarPicker'
import { type ComandaStatus } from '../../lib/comandaWorkflow'
import { Clock, CheckCircle2, Truck, User, ShoppingBag, Bike, UtensilsCrossed, CreditCard, Printer, ChefHat, AlertTriangle, Globe, Timer } from 'lucide-react'

import { COLUMN_PREVIEW_LIMIT, ComandaOrder, formatElapsed, compactPaymentLabel, compactCardTime, COLUMNS } from './model'

export function HistoryDayPicker({
  value,
  monthCursor,
  onChange,
}: {
  value: string
  monthCursor: Date
  onChange: (value: string) => void
}) {
  return (
    <CalendarPicker
      value={value}
      onChange={onChange}
      monthCursor={monthCursor}
      label="Día"
      placeholder="Elegir fecha"
      trigger="field"
      disableFuture
      className={`cmd-history-date-filter ${value ? 'active' : ''}`}
    />
  )
}

export interface ComandaCardProps {
  order: ComandaOrder
  color: string
  onOpen: (order: ComandaOrder) => void
  onAdvance: (orderId: string, status: ComandaStatus) => void
  onConfirmWeb: (order: ComandaOrder) => void
  onPrint: (order: ComandaOrder) => void
  confirmingWebId: string | null
  isUpdating: boolean
}

// Tarjeta individual, arrastrable a cualquier columna (excepto pedidos web
// sin confirmar, que solo se mueven con el botón "Confirmar pedido").
// Contenido visual puro de la tarjeta, sin lógica de arrastre — se reutiliza
// tanto en la tarjeta real (dentro de la columna) como en el DragOverlay
// (la copia flotante que se ve mientras arrastrás, sin que el scroll de la
// columna de origen la corte).
export function ComandaCardContent({ order, color, onAdvance, onConfirmWeb, onPrint, confirmingWebId, isUpdating }: Omit<ComandaCardProps, 'onOpen'>) {
  return (
    <>
      {/* Top Header line */}
      <div className="card-top-line">
        <span className="card-order-no">{order.orderNumber}</span>
        <div className="card-time-wrap">
          <span className="card-time-text">{order.time}</span>
          {order.isRetraso && (
            <span className="badge-retraso"><Clock size={12} /> Retraso</span>
          )}
        </div>
      </div>

      {/* Customer & Delivery line */}
      <div className="card-customer-line">
        <span className="customer-name">
          <User size={13} className="meta-icon" /> {order.customerName}
        </span>
        <span className="order-type-tag">
          {order.orderType === 'Delivery' ? <Bike size={13} /> : order.orderType.startsWith('Mesa') ? <UtensilsCrossed size={13} /> : <ShoppingBag size={13} />} {order.orderType}
        </span>
      </div>

      {/* Item list */}
      <div className="card-items-list">
        {order.items.map(item => (
          <div key={item.id} className="card-item-row">
            <span className="dot-indicator" style={{ backgroundColor: color }}></span>
            <span className="item-name-text">{item.name}</span>
            <span className="item-qty-text">× {item.quantity}</span>
          </div>
        ))}
      </div>

      {/* Footer Row */}
      <div className={`card-footer-line ${order.isPaid ? 'is-paid' : 'is-unpaid'}`}>
        {order.source === 'web' ? (
          <span className="badge-sin-pagar"><Globe size={12} /> Web · Por confirmar</span>
        ) : order.isPaid ? (
          <span className={`payment-type-badge pay-${order.paymentType}`} title={order.paymentMethod}>
            {compactPaymentLabel(order.paymentMethod)}
          </span>
        ) : order.creditAuthorized ? (
          <span className="badge-sin-pagar is-credit" title="Crédito autorizado" aria-label="Crédito autorizado"><CreditCard size={12} /> Crédito OK</span>
        ) : (
          <span className="badge-sin-pagar"><AlertTriangle size={12} /> Sin cobrar</span>
        )}

        {order.isPaid && <MoneyWithBcv usd={order.totalAmount || 0} rate={order.bcvRate} className="card-total-amounts" compact />}

        {order.status === 'ready' ? (
          <div className="status-ready-group">
            <span className="badge-ready-tag">✓ Listo</span>
            <span className="timer-mins text-green"><Timer size={12} /> {formatElapsed(order.elapsedMins)}</span>
          </div>
        ) : order.status === 'delivered' ? (
          <span className="badge-delivered-tag" title={`Entregado ${order.deliveredTime || ''}`}>
            ✓ Entregado {compactCardTime(order.deliveredTime)}
          </span>
        ) : (
          <span className={`timer-mins ${order.isRetraso ? 'text-red-urgent' : 'text-orange'}`}>
            {order.isRetraso ? <Clock size={12} /> : <Timer size={12} />} {formatElapsed(order.elapsedMins)}
          </span>
        )}
      </div>

      <button
        className="quick-print-btn"
        type="button"
        onMouseDown={e => e.stopPropagation()}
        onTouchStart={e => e.stopPropagation()}
        onKeyDown={e => e.stopPropagation()}
        onClick={e => { e.stopPropagation(); onPrint(order) }}
        aria-label={`Imprimir ${order.isPaid ? 'recibo' : 'precuenta'} de ${order.orderNumber}`}
      >
        <Printer size={14} /> {order.isPaid ? 'Reimprimir recibo' : 'Imprimir precuenta'}
      </button>

      {/* Quick Advance Status Action */}
      {order.source === 'web' ? (
        <button
          className="quick-advance-btn"
          disabled={confirmingWebId === order.webRequestId || isUpdating}
          onMouseDown={e => e.stopPropagation()}
          onTouchStart={e => e.stopPropagation()}
          onKeyDown={e => e.stopPropagation()}
          onClick={e => { e.stopPropagation(); onConfirmWeb(order) }}
        >
          {confirmingWebId === order.webRequestId ? 'Confirmando…' : <><CheckCircle2 size={16} /> Confirmar pedido de WhatsApp</>}
        </button>
      ) : order.status !== 'delivered' && (
        <button
          className="quick-advance-btn"
          disabled={isUpdating}
          onMouseDown={e => e.stopPropagation()}
          onTouchStart={e => e.stopPropagation()}
          onKeyDown={e => e.stopPropagation()}
          onClick={e => {
            e.stopPropagation()
            onAdvance(order.id, order.status)
          }}
        >
          {order.status === 'new'
            ? <><ChefHat size={16} /> Iniciar preparación</>
            : order.status === 'preparing'
            ? <><CheckCircle2 size={16} /> Marcar como lista</>
            : <><Truck size={16} /> Marcar como entregada</>}
        </button>
      )}
    </>
  )
}

// Tarjeta arrastrable real, dentro de la columna. Se oculta (opacity 0)
// mientras se arrastra en vez de moverse con transform, porque el
// DragOverlay es el que muestra la copia flotante en su lugar.
export function ComandaCard({ order, color, onOpen, onAdvance, onConfirmWeb, onPrint, confirmingWebId, isUpdating }: ComandaCardProps) {
  const isWeb = order.source === 'web'
  const isDraggable = !isWeb && !isUpdating && order.status !== 'delivered'
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: order.id,
    disabled: !isDraggable,
  })

  return (
    <div
      ref={setNodeRef}
      style={isDragging ? { opacity: 0 } : undefined}
      className={`comanda-card-item card-${order.status} ${order.isRetraso ? 'has-retraso' : ''} ${isUpdating ? 'is-updating' : ''} ${isDraggable ? 'is-draggable' : ''}`}
      onClick={() => onOpen(order)}
      aria-busy={isUpdating}
      aria-label={isDraggable ? `${order.orderNumber}. Arrastra esta tarjeta para cambiarla de estado.` : undefined}
      title={isDraggable ? 'Arrastra desde cualquier parte libre de la tarjeta' : undefined}
      {...attributes}
      {...listeners}
    >
      <ComandaCardContent order={order} color={color} onAdvance={onAdvance} onConfirmWeb={onConfirmWeb} onPrint={onPrint} confirmingWebId={confirmingWebId} isUpdating={isUpdating} />
    </div>
  )
}

export interface KanbanColumnProps {
  col: typeof COLUMNS[number]
  loading?: boolean
  failed?: boolean
  colOrders: ComandaOrder[]
  visibleOrders: ComandaOrder[]
  hiddenCount: number
  isExpanded: boolean
  onToggleExpand: () => void
  onOpen: (order: ComandaOrder) => void
  onAdvance: (orderId: string, status: ComandaStatus) => void
  onConfirmWeb: (order: ComandaOrder) => void
  onPrint: (order: ComandaOrder) => void
  confirmingWebId: string | null
  updatingOrderIds: Set<string>
}

// Columna del tablero, receptora de la tarjeta; la máquina de estados valida
// que el destino sea exactamente la siguiente etapa antes de persistirlo.
export function KanbanColumn({ col, loading = false, failed = false, colOrders, visibleOrders, hiddenCount, isExpanded, onToggleExpand, onOpen, onAdvance, onConfirmWeb, onPrint, confirmingWebId, updatingOrderIds }: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: col.key })

  return (
    <div className="kanban-column">
      {/* Column Header */}
      <div className="kanban-col-header" style={{ borderBottomColor: col.color }}>
        <div className="col-header-left">
          <span className="col-icon" style={{ color: col.color }}>{col.icon}</span>
          <h2 className="col-title">{col.label}</h2>
        </div>
        <span className="col-count-badge">{loading || failed ? '…' : colOrders.length}</span>
      </div>

      {/* Column Body / Order Cards */}
      <div ref={setNodeRef} className={`kanban-col-body ${isOver ? 'drag-over' : ''}`}>
        {loading ? (
          <LoadingSkeleton className="kanban-col-loading" label={`Cargando comandas: ${col.label}`} count={3} />
        ) : colOrders.length === 0 ? (
          <div className="empty-col">
            <span className="empty-col-icon" style={{ color: col.color }}>{col.icon}</span>
            <span className="empty-col-text">{failed ? 'No se pudo cargar' : 'Sin comandas'}</span>
          </div>
        ) : (
          visibleOrders.map(order => (
            <ComandaCard
              key={order.id}
              order={order}
              color={col.color}
              onOpen={onOpen}
              onAdvance={onAdvance}
              onConfirmWeb={onConfirmWeb}
              onPrint={onPrint}
              confirmingWebId={confirmingWebId}
              isUpdating={updatingOrderIds.has(order.id)}
            />
          ))
        )}
      </div>

      {/* Column Footer */}
      {(hiddenCount > 0 || isExpanded) && colOrders.length > COLUMN_PREVIEW_LIMIT && (
        <div className="kanban-col-footer">
          <button className="ver-todas-btn" onClick={onToggleExpand}>
            {isExpanded ? 'Ver menos' : `+ Ver todas (${colOrders.length})`}
          </button>
        </div>
      )}
    </div>
  )
}

// Cuántas comandas se muestran por columna antes de "Ver todas".
