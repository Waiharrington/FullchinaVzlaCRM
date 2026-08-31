import { useEffect, useState } from 'react'
import { getCustomers, registerCustomerVisit, type Customer } from '../lib/dataService'
import { Trophy, Award, Gift, Star, CheckCircle2, UserPlus, Flame, Plus, Medal } from 'lucide-react'
import './Fidelizacion.css'

const CYCLE = 10 // visitas por premio

export function Fidelizacion() {
  const [customers, setCustomers] = useState<Customer[]>([])
  const [selectedCustomerId, setSelectedCustomerId] = useState('')
  const [visitNotice, setVisitNotice] = useState('')
  const [noticeError, setNoticeError] = useState(false)

  const topVisitsCustomers = [...customers].sort((a, b) => b.totalVisits - a.totalVisits)
  const selectedCustomer = customers.find(c => c.id === selectedCustomerId) || customers[0]

  useEffect(() => {
    getCustomers().then(data => {
      setCustomers(data)
      setSelectedCustomerId(current => current || data[0]?.id || '')
    }).catch(error => {
      setNoticeError(true)
      setVisitNotice(error instanceof Error ? error.message : 'No se pudieron cargar los clientes')
    })
  }, [])

  const handleAddVisit = async (customerId: string) => {
    try {
      const updated = await registerCustomerVisit(customerId)
      setCustomers(prev => prev.map(c => c.id === customerId ? updated : c))
      setNoticeError(false)
      setVisitNotice(`¡Nueva visita registrada para ${updated.name}! (${updated.totalVisits} visitas en total)`)
      setTimeout(() => setVisitNotice(''), 4000)
    } catch (error) {
      setNoticeError(true)
      setVisitNotice(error instanceof Error ? error.message : 'No se pudo registrar la visita')
      setTimeout(() => setVisitNotice(''), 5000)
    }
  }

  if (!selectedCustomer) {
    return (
      <div className="fidel-page">
        <div className="fidel-empty">
          {visitNotice || 'No hay clientes disponibles todavía.'}
        </div>
      </div>
    )
  }

  const stampsInCycle = selectedCustomer.totalVisits % CYCLE
  const progressPct = (stampsInCycle / CYCLE) * 100
  const totalVisitsAll = customers.reduce((s, c) => s + c.totalVisits, 0)
  const totalRewards = customers.reduce((s, c) => s + c.rewardsUnlocked, 0)
  const vipCount = customers.filter(c => c.totalVisits >= 10).length

  const METRICS = [
    { icon: <Trophy size={22} />, cls: 'gold', label: 'Mejor Cliente del Mes', value: topVisitsCustomers[0]?.name.split(' ')[0] ?? '—', sub: `${topVisitsCustomers[0]?.totalVisits ?? 0} visitas recurrentes` },
    { icon: <Flame size={22} />, cls: 'fire', label: 'Visitas Totales', value: totalVisitsAll.toLocaleString('es-VE'), sub: 'Acumuladas por clientes' },
    { icon: <Gift size={22} />, cls: 'violet', label: 'Recompensas Entregadas', value: totalRewards.toLocaleString('es-VE'), sub: 'Platos o raciones gratis' },
    { icon: <Star size={22} />, cls: 'red', label: 'Clientes VIP (≥ 10)', value: vipCount.toLocaleString('es-VE'), sub: 'Criterio de fidelización' },
  ]

  const medal = (idx: number) => (idx === 0 ? <Trophy size={16} /> : idx === 1 ? <Medal size={16} /> : idx === 2 ? <Award size={16} /> : null)

  return (
    <div className="fidel-page">
      <header className="page-header">
        <div>
          <h1 className="page-title"><Award size={22} className="page-title-icon" /> Fidelización</h1>
          <p className="page-subtitle">Premia las visitas recurrentes y sigue a tus clientes VIP.</p>
        </div>
      </header>

      {/* Métricas */}
      <div className="fidel-metrics">
        {METRICS.map((m, i) => (
          <div key={i} className="fidel-metric">
            <div className={`fidel-metric-icon ${m.cls}`}>{m.icon}</div>
            <div className="fidel-metric-body">
              <span className="fidel-metric-label">{m.label}</span>
              <span className="fidel-metric-value">{m.value}</span>
              <span className="fidel-metric-sub">{m.sub}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="fidel-grid">
        {/* Ranking */}
        <div className="fidel-card">
          <div className="fidel-card-head">
            <div className="fidel-card-head-icon"><Trophy size={18} /></div>
            <div>
              <h2 className="fidel-card-title">Ranking del "Mejor Cliente"</h2>
              <span className="fidel-card-sub">Premia la frecuencia de visita</span>
            </div>
          </div>

          <div className="fidel-table-wrap">
            <table className="fidel-table">
              <thead>
                <tr>
                  <th>Pos.</th>
                  <th>Cliente</th>
                  <th className="hide-sm">Teléfono</th>
                  <th>Visitas</th>
                  <th className="hide-sm">Última</th>
                  <th>Premios</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {topVisitsCustomers.map((cust, idx) => (
                  <tr
                    key={cust.id}
                    className={`${cust.id === selectedCustomerId ? 'selected' : ''} ${idx < 3 ? `podium-${idx + 1}` : ''}`}
                    onClick={() => setSelectedCustomerId(cust.id)}
                  >
                    <td>
                      {medal(idx)
                        ? <span className={`fidel-rank medal-${idx + 1}`}>{medal(idx)} {idx + 1}</span>
                        : <span className="fidel-rank">{idx + 1}</span>}
                    </td>
                    <td className="fidel-cust-name">{cust.name}</td>
                    <td className="hide-sm fidel-muted">{cust.phone || '—'}</td>
                    <td><span className="fidel-visits">{cust.totalVisits}</span></td>
                    <td className="hide-sm fidel-muted">{cust.lastVisit || '—'}</td>
                    <td><span className="fidel-reward-badge"><Gift size={14} /> {cust.rewardsUnlocked}</span></td>
                    <td>
                      <button
                        className="fidel-add-visit"
                        onClick={(e) => { e.stopPropagation(); setSelectedCustomerId(cust.id); handleAddVisit(cust.id) }}
                        title="Registrar una visita"
                      >
                        <Plus size={14} /> Visita
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Tarjeta de fidelidad */}
        <div className="fidel-side">
          <div className="loyalty-card">
            <div className="loyalty-card-shine" aria-hidden />
            <div className="loyalty-head">
              <div>
                <span className="loyalty-kicker">Tarjeta de Fidelidad</span>
                <h3 className="loyalty-name">{selectedCustomer.name}</h3>
                <span className="loyalty-meta">
                  {selectedCustomer.phone || 'Sin teléfono'}
                  {selectedCustomer.favoriteProduct ? ` · ${selectedCustomer.favoriteProduct}` : ''}
                </span>
              </div>
              <div className="loyalty-award"><Award size={26} /></div>
            </div>

            {visitNotice && (
              <div className={`loyalty-notice ${noticeError ? 'error' : ''}`}>
                <CheckCircle2 size={15} /> <span>{visitNotice}</span>
              </div>
            )}

            <div className="loyalty-progress-block">
              <div className="loyalty-progress-top">
                <span>Sellos de visita</span>
                <strong>{stampsInCycle} / {CYCLE}</strong>
              </div>
              <div className="loyalty-progress-bar">
                <div className="loyalty-progress-fill" style={{ width: `${progressPct}%` }} />
              </div>
            </div>

            <div className="loyalty-stamps">
              {Array.from({ length: CYCLE }).map((_, i) => {
                const isStamped = i < stampsInCycle
                return (
                  <div key={i} className={`loyalty-stamp ${isStamped ? 'on' : ''}`}>
                    {isStamped ? <CheckCircle2 size={18} /> : i + 1}
                  </div>
                )
              })}
            </div>

            <div className="loyalty-reward-box">
              <div className="loyalty-reward-info">
                <span className="loyalty-reward-label">Recompensas disponibles</span>
                <span className="loyalty-reward-value">
                  {selectedCustomer.rewardsUnlocked > 0
                    ? <><Gift size={14} /> {selectedCustomer.rewardsUnlocked} ración(es) gratis</>
                    : `Faltan ${CYCLE - stampsInCycle} visita(s) para el próximo premio`}
                </span>
              </div>
              <button className="loyalty-mark-btn" onClick={() => handleAddVisit(selectedCustomer.id)}>
                <UserPlus size={15} /> Marcar visita
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
