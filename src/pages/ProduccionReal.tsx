import { useEffect, useState } from 'react'
import { getProductionBatches, getProductionBonuses, getProductionStats, type ProductionBatch, type ProductionBonus, type ProductionStats } from '../lib/dataService'

export function ProduccionReal() {
  const [stats, setStats] = useState<ProductionStats | null>(null)
  const [batches, setBatches] = useState<ProductionBatch[]>([])
  const [bonuses, setBonuses] = useState<ProductionBonus[]>([])
  const [error, setError] = useState('')
  useEffect(() => { Promise.all([getProductionStats(), getProductionBatches(), getProductionBonuses()]).then(([s, b, p]) => { setStats(s); setBatches(b); setBonuses(p) }).catch(e => setError(e instanceof Error ? e.message : 'Error al cargar producción')) }, [])
  return <div className="page animate-fade-in"><header className="page-header"><div><h1 className="page-title text-gradient">Producción real</h1><p className="page-subtitle">Lotes, rendimiento y bonos registrados en el sistema.</p></div></header>
    {error && <div className="card">{error}</div>}
    <div className="stats-grid"><div className="stat-card"><div className="stat-info"><span className="stat-value">{stats?.batchesToday ?? 0}</span><span className="stat-label">Lotes hoy</span></div></div><div className="stat-card"><div className="stat-info"><span className="stat-value">{(stats?.avgYield ?? 0).toFixed(1)}%</span><span className="stat-label">Rendimiento</span></div></div><div className="stat-card"><div className="stat-info"><span className="stat-value">{(stats?.totalWaste ?? 0).toFixed(2)}</span><span className="stat-label">Merma</span></div></div></div>
    <div className="card mt-6"><h2 className="card-title">Lotes registrados</h2><div className="table-responsive-wrapper"><table className="almacen-table"><thead><tr><th>Fecha</th><th>Producto</th><th>Producido</th><th>Merma</th><th>Costo</th><th>Estado</th></tr></thead><tbody>{batches.map(batch => <tr key={batch.id}><td>{batch.productionDate}</td><td>{batch.productName}</td><td>{batch.quantityProduced} {batch.unitProduced}</td><td>{batch.wasteQuantity}</td><td>${batch.totalCost.toFixed(2)}</td><td>{batch.status}</td></tr>)}{batches.length === 0 && <tr><td colSpan={6}>Todavía no hay lotes registrados.</td></tr>}</tbody></table></div></div>
    <div className="card mt-6"><h2 className="card-title">Bonos registrados ({bonuses.length})</h2>{bonuses.length === 0 && <p className="page-subtitle">Todavía no hay bonos de producción.</p>}</div>
  </div>
}
