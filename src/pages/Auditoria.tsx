import { useState, useEffect, useCallback, useMemo } from 'react'
import { Activity, AlertTriangle, ChevronDown, Clock3, RefreshCw, Search, Shield } from 'lucide-react'
import { getSystemActivityLogs, type SystemActivityLog } from '../lib/dataService'
import { useLiveDataRefresh } from '../lib/liveDataRefresh'
import { PageSkeleton } from '../components/PageSkeleton'
import Toast from '../components/Toast'
import './Auditoria.css'

const PAGE_SIZE = 100

export function Auditoria() {
  const [logs, setLogs] = useState<SystemActivityLog[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(false)
  const [error, setError] = useState('')
  const [migrationNeeded, setMigrationNeeded] = useState(false)
  const [search, setSearch] = useState('')
  const [moduleFilter, setModuleFilter] = useState('')

  const load = useCallback(async (silent = false) => {
    try {
      if (!silent) setLoading(true)
      setError('')
      setMigrationNeeded(false)
      const recent = await getSystemActivityLogs(0, PAGE_SIZE)
      setHasMore(recent.length === PAGE_SIZE)
      setLogs(previous => silent
        ? [...recent, ...previous.filter(old => !recent.some(item => item.id === old.id))]
        : recent)
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Error cargando el historial general'
      if (message.includes('system_activity_logs') && message.includes('does not exist')) {
        setMigrationNeeded(true)
        setLogs([])
      } else {
        setError(message)
      }
    } finally {
      if (!silent) setLoading(false)
    }
  }, [])

  const loadMore = async () => {
    if (loadingMore || !hasMore) return
    setLoadingMore(true)
    try {
      const nextPage = await getSystemActivityLogs(logs.length, PAGE_SIZE)
      setLogs(previous => [...previous, ...nextPage.filter(item => !previous.some(old => old.id === item.id))])
      setHasMore(nextPage.length === PAGE_SIZE)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo cargar el historial anterior')
    } finally {
      setLoadingMore(false)
    }
  }

  useEffect(() => { void load() }, [load])
  useLiveDataRefresh('auditoria', () => load(true))

  const modules = useMemo(() => [...new Set(logs.map(log => log.module))].sort((a, b) => a.localeCompare(b, 'es')), [logs])
  const filteredLogs = useMemo(() => {
    const normalizedSearch = search.trim().toLocaleLowerCase('es')
    return logs.filter(log => {
      if (moduleFilter && log.module !== moduleFilter) return false
      if (!normalizedSearch) return true
      const searchable = [log.actorName, log.module, log.action, log.entityTable, log.entityLabel, ...log.changedFields, ...Object.values(log.context), ...Object.entries(log.changes).flatMap(([key, values]) => [key, values.before, values.after])]
        .join(' ').toLocaleLowerCase('es')
      return searchable.includes(normalizedSearch)
    })
  }, [logs, moduleFilter, search])

  if (loading) return <PageSkeleton cards={2} rows={5} />

  if (migrationNeeded) {
    return (
      <div className="page animate-fade-in">
        <header className="page-header">
          <div><h1 className="page-title"><Activity size={22} className="page-title-icon" /> Historial general</h1><p className="page-subtitle">Cambios y movimientos realizados en el sistema</p></div>
        </header>
        <div className="card table-card" style={{ textAlign: 'center', padding: '48px 16px' }}>
          <AlertTriangle size={42} style={{ color: '#eab308', marginBottom: 14, opacity: .7 }} />
          <h3 style={{ color: '#fff', margin: '0 0 8px' }}>Migración pendiente</h3>
          <p style={{ color: '#a1a1aa', margin: 0 }}>Para empezar a registrar la actividad, aplica con backup previo la migración <code>20261003010000_general_activity_history.sql</code>.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="page animate-fade-in">
      <header className="page-header">
        <div>
          <h1 className="page-title"><Activity size={22} className="page-title-icon" /> Historial general</h1>
          <p className="page-subtitle">{logs.length} movimientos cargados · Quién hizo cada cambio y cuándo</p>
        </div>
        <button className="btn-transfer-submit" style={{ margin: 0 }} onClick={() => void load()}><RefreshCw size={16} /> Actualizar</button>
      </header>

      {error && <Toast type="error" message={error} onClose={() => setError('')} />}

      <section className="card activity-history-card">
        <div className="activity-history-toolbar">
          <label className="activity-history-search"><Search size={16} /><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Buscar persona, acción o registro" /></label>
          <label className="activity-history-module"><span>Módulo</span><select value={moduleFilter} onChange={event => setModuleFilter(event.target.value)}><option value="">Todos</option>{modules.map(module => <option key={module} value={module}>{module}</option>)}</select><ChevronDown size={14} /></label>
          <span className="activity-history-count">{filteredLogs.length} de {logs.length}</span>
        </div>

        <div className="activity-history-list">
          {filteredLogs.map(log => (
            <article className={`activity-history-row activity-${log.action.toLowerCase()}`} key={log.id}>
              <div className="activity-history-icon"><Activity size={16} /></div>
              <div className="activity-history-main">
                <div className="activity-history-title"><strong>{actionLabel(log.action)}</strong><span className="activity-history-module-badge">{log.module}</span></div>
                <div className="activity-history-entity">{entityLabel(log)}{log.entityId && <small> · {log.entityId.slice(0, 8)}</small>}</div>
                <div className="activity-history-meta"><span><Shield size={12} /> {log.actorName}</span><span><Clock3 size={12} /> {new Date(log.occurredAt).toLocaleString('es-VE')}</span></div>
                {(log.changedFields.length > 0 || Object.keys(log.context).length > 0 || Object.keys(log.changes).length > 0) && (
                  <details className="activity-history-details">
                    <summary>Ver detalle</summary>
                    <div>{log.changedFields.length > 0 && <p><b>Campos:</b> {log.changedFields.map(fieldLabel).join(', ')}</p>}
                      {Object.entries(log.changes).map(([key, values]) => <p key={`change-${key}`}><b>{fieldLabel(key)}:</b> {displayValue(values.before)} → {displayValue(values.after)}</p>)}
                      {Object.entries(log.context).map(([key, value]) => <p key={key}><b>{fieldLabel(key)}:</b> {String(value)}</p>)}</div>
                  </details>
                )}
              </div>
            </article>
          ))}
          {filteredLogs.length === 0 && <div className="activity-history-empty">No hay movimientos que coincidan con la búsqueda.</div>}
        </div>

        {hasMore && <button className="activity-history-more" onClick={() => void loadMore()} disabled={loadingMore}>{loadingMore ? 'Cargando…' : 'Cargar movimientos anteriores'}</button>}
        <p className="activity-history-footnote">El historial registra los cambios desde que se active la migración; no reconstruye acciones pasadas que no fueron auditadas.</p>
      </section>
    </div>
  )
}

function actionLabel(action: SystemActivityLog['action']) {
  if (action === 'INSERT') return 'Creó'
  if (action === 'DELETE') return 'Eliminó'
  return 'Editó'
}

function entityLabel(log: SystemActivityLog) {
  const labels: Record<string, string> = {
    orders: 'Comanda', order_items: 'Producto de comanda', payments: 'Cobro',
    purchases: 'Compra', purchase_items: 'Producto de compra', purchase_payments: 'Pago de compra',
    expenses: 'Gasto', expense_payments: 'Pago de gasto', customers: 'Cliente', suppliers: 'Proveedor',
    stock_movements: 'Movimiento de inventario', sellable_products: 'Producto del menú',
    profiles: 'Usuario', employees: 'Empleado', cash_sessions: 'Turno de caja', cash_movements: 'Movimiento de caja',
  }
  return `${labels[log.entityTable] ?? humanize(log.entityTable)}${log.entityLabel ? ` · ${log.entityLabel}` : ''}`
}

function fieldLabel(value: string) {
  const labels: Record<string, string> = {
    amount: 'Monto', total_amount: 'Total', price: 'Precio', unit_price: 'Precio unitario', quantity: 'Cantidad',
    order_number: 'N.º de comanda', status: 'Estado', fulfillment_status: 'Estado de preparación',
    concept: 'Concepto', method: 'Método', movement_type: 'Tipo de movimiento', order_type: 'Tipo de pedido',
    table_number: 'Mesa', product_name: 'Producto', related_item: 'Producto o ingrediente', name: 'Nombre', code: 'Código',
  }
  return labels[value] ?? humanize(value)
}

function humanize(value: string) {
  return value.replace(/_/g, ' ').replace(/\b\w/g, (letter: string) => letter.toLocaleUpperCase('es'))
}

function displayValue(value: unknown) {
  if (value == null || value === 'null') return '—'
  if (typeof value === 'boolean') return value ? 'Sí' : 'No'
  return String(value)
}
