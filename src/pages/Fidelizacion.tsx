import { useState } from 'react'
import { DEMO_CUSTOMERS } from '../lib/demoData'
import type { Customer } from '../lib/demoData'
import { Trophy, Award, Gift, Star, CheckCircle2, UserPlus, Flame } from 'lucide-react'
import './Fidelizacion.css'

export function Fidelizacion() {
  const [customers, setCustomers] = useState<Customer[]>(DEMO_CUSTOMERS)
  const [selectedCustomerId, setSelectedCustomerId] = useState(customers[0]?.id || '')
  const [visitNotice, setVisitNotice] = useState('')

  // Sort customers by totalVisits descending ("Mejor Cliente" by visits)
  const topVisitsCustomers = [...customers].sort((a, b) => b.totalVisits - a.totalVisits)
  const selectedCustomer = customers.find(c => c.id === selectedCustomerId) || customers[0]

  const handleAddVisit = (customerId: string) => {
    setCustomers(prev => prev.map(c => {
      if (c.id === customerId) {
        const newVisits = c.totalVisits + 1
        const newRewards = Math.floor(newVisits / 5)
        return {
          ...c,
          totalVisits: newVisits,
          lastVisit: new Date().toISOString().split('T')[0],
          rewardsUnlocked: newRewards
        }
      }
      return c
    }))

    setVisitNotice(`¡Nueva visita registrada para ${selectedCustomer.name}! (${selectedCustomer.totalVisits + 1} visitas en total)`)
    setTimeout(() => setVisitNotice(''), 4000)
  }

  return (
    <div className="fidelizacion-page">
      {/* Metrics Banner */}
      <div className="almacen-metrics-grid">
        <div className="almacen-metric-card">
          <div className="metric-icon-box orange">
            <Trophy size={24} />
          </div>
          <div className="metric-info-group">
            <span className="metric-label">Mejor Cliente del Mes</span>
            <span className="metric-large-val">{topVisitsCustomers[0]?.name.split(' ')[0]}</span>
            <span className="metric-sub-text">{topVisitsCustomers[0]?.totalVisits} Visitas Recurrentes</span>
          </div>
        </div>

        <div className="almacen-metric-card">
          <div className="metric-icon-box green">
            <Flame size={24} />
          </div>
          <div className="metric-info-group">
            <span className="metric-label">Visitas Totales</span>
            <span className="metric-large-val">{customers.reduce((s, c) => s + c.totalVisits, 0)} Visitas</span>
            <span className="metric-sub-text">Acumuladas por clientes</span>
          </div>
        </div>

        <div className="almacen-metric-card">
          <div className="metric-icon-box purple">
            <Gift size={24} />
          </div>
          <div className="metric-info-group">
            <span className="metric-label">Recompensas Entregadas</span>
            <span className="metric-large-val">{customers.reduce((s, c) => s + c.rewardsUnlocked, 0)} Premios</span>
            <span className="metric-sub-text">Platos o raciones gratis</span>
          </div>
        </div>

        <div className="almacen-metric-card">
          <div className="metric-icon-box red">
            <Star size={24} />
          </div>
          <div className="metric-info-group">
            <span className="metric-label">Clientes VIP (&ge; 10 v)</span>
            <span className="metric-large-val">{customers.filter(c => c.totalVisits >= 10).length} Clientes</span>
            <span className="metric-sub-text">Criterio de fidelización</span>
          </div>
        </div>
      </div>

      <div className="fidel-grid">
        {/* Left Column: Ranking "Mejor Cliente" por Recurrencia */}
        <div className="fidel-card">
          <div className="prod-card-header-bar">
            <div className="header-title-group">
              <div className="card-header-icon-red" style={{ background: '#eab308', color: '#000' }}>
                <Trophy size={18} />
              </div>
              <div>
                <h2 className="prod-card-title">Ranking del "Mejor Cliente" (por Visitas)</h2>
                <span className="metric-sub-text">Criterio preferido por la dueña: premia la frecuencia de visita</span>
              </div>
            </div>
          </div>

          <div className="table-responsive-wrapper">
            <table className="almacen-table">
              <thead>
                <tr>
                  <th>Posición</th>
                  <th>Cliente</th>
                  <th>Teléfono</th>
                  <th>Total Visitas</th>
                  <th>Última Visita</th>
                  <th>Premios Ganados</th>
                  <th>Acción</th>
                </tr>
              </thead>
              <tbody>
                {topVisitsCustomers.map((cust, idx) => (
                  <tr key={cust.id} style={{ background: cust.id === selectedCustomerId ? 'rgba(234, 179, 8, 0.08)' : 'transparent' }}>
                    <td>
                      {idx === 0 ? <span className="rank-badge-gold">🥇 #1 TOP</span> : `#${idx + 1}`}
                    </td>
                    <td style={{ fontWeight: 700, color: '#fff' }}>{cust.name}</td>
                    <td>{cust.phone}</td>
                    <td style={{ fontWeight: 800, color: '#eab308', fontSize: '15px' }}>
                      {cust.totalVisits} visitas
                    </td>
                    <td>{cust.lastVisit}</td>
                    <td>
                      <span style={{ background: 'rgba(168, 85, 247, 0.15)', color: '#a855f7', fontWeight: 700, padding: '2px 8px', borderRadius: '6px', fontSize: '11px' }}>
                        🎁 {cust.rewardsUnlocked} Recompensa(s)
                      </span>
                    </td>
                    <td>
                      <button 
                        onClick={() => {
                          setSelectedCustomerId(cust.id)
                          handleAddVisit(cust.id)
                        }}
                        style={{ background: '#27272a', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', padding: '4px 10px', borderRadius: '6px', cursor: 'pointer', fontSize: '11px', fontWeight: 700 }}
                      >
                        + 1 Visita
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right Column: Tarjeta de Fidelidad Digital del Cliente Seleccionado */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div className="loyalty-stamp-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <span style={{ fontSize: '11px', color: '#eab308', fontWeight: 800, textTransform: 'uppercase' }}>Tarjeta de Fidelidad Digital</span>
                <h3 style={{ color: '#fff', fontSize: '18px', margin: '2px 0 0 0', fontWeight: 800 }}>{selectedCustomer.name}</h3>
                <span style={{ color: '#a1a1aa', fontSize: '12px' }}>{selectedCustomer.phone} • {selectedCustomer.favoriteProduct}</span>
              </div>
              <Award size={32} color="#eab308" />
            </div>

            {visitNotice && (
              <div style={{ background: 'rgba(234, 179, 8, 0.15)', border: '1px solid rgba(234, 179, 8, 0.3)', color: '#fef08a', padding: '8px 12px', borderRadius: '8px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <CheckCircle2 size={16} />
                <span>{visitNotice}</span>
              </div>
            )}

            {/* Stamps 1 to 10 */}
            <div>
              <span style={{ fontSize: '12px', color: '#a1a1aa', fontWeight: 700, display: 'block', marginBottom: '8px' }}>
                Sellos de Visita ({selectedCustomer.totalVisits % 10} / 10 para próximo premio)
              </span>
              <div className="stamps-grid">
                {Array.from({ length: 10 }).map((_, i) => {
                  const currentStamps = selectedCustomer.totalVisits % 10
                  const isStamped = i < currentStamps || (selectedCustomer.totalVisits > 0 && currentStamps === 0)
                  return (
                    <div key={i} className={`stamp-slot ${isStamped ? 'stamped' : ''}`}>
                      {isStamped ? '🥟' : i + 1}
                    </div>
                  )
                })}
              </div>
            </div>

            <div style={{ background: '#141416', padding: '12px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <span style={{ fontSize: '11px', color: '#8e8e93', fontWeight: 700, display: 'block' }}>Recompensas Disponibles</span>
                <span style={{ color: '#fff', fontWeight: 800, fontSize: '14px' }}>
                  {selectedCustomer.rewardsUnlocked > 0 ? `🎁 ${selectedCustomer.rewardsUnlocked} Ración(es) de Lumpias Gratis` : 'Completa 5 visitas para 1 premio'}
                </span>
              </div>
              <button 
                onClick={() => handleAddVisit(selectedCustomer.id)}
                className="btn-primary-red" 
                style={{ background: '#eab308', color: '#000', padding: '8px 12px', fontSize: '12px' }}
              >
                <UserPlus size={14} /> Marcar Visita
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
