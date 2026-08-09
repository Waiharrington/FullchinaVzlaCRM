import { useEffect, useState } from 'react'
import { getLegacyPurchaseOrders, type LegacyPurchaseOrder } from '../lib/dataService'
import { MoneyWithBcv } from '../components/MoneyWithBcv'

export function ComprasReal() {
  const [orders, setOrders] = useState<LegacyPurchaseOrder[]>([])
  const [error, setError] = useState('')
  useEffect(() => { getLegacyPurchaseOrders().then(setOrders).catch(e => setError(e instanceof Error ? e.message : 'Error al cargar compras')) }, [])
  return <div className="page animate-fade-in">
    <header className="page-header"><div><h1 className="page-title text-gradient">Compras importadas de Invu</h1><p className="page-subtitle">Historial real de órdenes de compra. Los nuevos registros operativos se cargarán desde Compras.</p></div></header>
    {error && <div className="card">{error}</div>}
    <div className="card"><div className="table-responsive-wrapper"><table className="almacen-table"><thead><tr><th>Fecha</th><th>Orden</th><th>Proveedor</th><th>Factura</th><th>Estado</th><th>Total</th></tr></thead><tbody>
      {orders.map(order => <tr key={order.id}><td>{order.date ? new Date(order.date).toLocaleDateString('es-VE') : '—'}</td><td>{order.code || '—'}</td><td>{order.supplier || '—'}</td><td>{order.invoiceNumber || '—'}</td><td>{order.status || '—'}</td><td><MoneyWithBcv usd={order.total} compact /></td></tr>)}
      {!error && orders.length === 0 && <tr><td colSpan={6}>No hay compras registradas.</td></tr>}
    </tbody></table></div></div>
  </div>
}
