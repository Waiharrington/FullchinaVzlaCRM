import { useEffect, useMemo, useState } from 'react'
import { getCustomers, registerCustomerVisit, type Customer } from '../lib/dataService'
import { normalizeForSearch } from '../lib/textFormat'
import { Trophy, Award, Gift, Star, CheckCircle2, UserPlus, Flame, Plus, Medal, Search, X, ChevronLeft, ChevronRight, Phone } from 'lucide-react'
import { PageSkeleton } from '../components/PageSkeleton'
import './Fidelizacion.css'

const CYCLE = 10 // visitas por premio
const PAGE_SIZE = 8

const AVATAR_COLORS = ['#E31B2B', '#FF6259', '#FF9E1B', '#FFD23F', '#b91c1c', '#c2410c']

function avatarColorFor(name: string): string {
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0
  return AVATAR_COLORS[hash % AVATAR_COLORS.length]
}

function initialsFor(name: string): string {
  const parts = name.trim().split(/\s+/)
  return `${parts[0]?.[0] || '?'}${parts[1]?.[0] || ''}`.toUpperCase()
}

export function Fidelizacion() {
  const [customers, setCustomers] = useState<Customer[]>([])
  const [selectedCustomerId, setSelectedCustomerId] = useState('')
  const [visitNotice, setVisitNotice] = useState('')
  const [noticeError, setNoticeError] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)

  const topVisitsCustomers = [...customers].sort((a, b) => b.totalVisits - a.totalVisits)
  const selectedCustomer = customers.find(c => c.id === selectedCustomerId) || customers[0]

  useEffect(() => {
    getCustomers().then(data => {
      setCustomers(data)
      setSelectedCustomerId(current => current || data[0]?.id || '')
    }).catch(error => {
      setNoticeError(true)
      setVisitNotice(error instanceof Error ? error.message : 'No se pudieron cargar los clientes')
    }).finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    setPage(1)
  }, [searchTerm])

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

  const rankedCustomers = useMemo(
    () => topVisitsCustomers.map((cust, idx) => ({ cust, rank: idx })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [customers],
  )

  const filteredCustomers = useMemo(() => {
    const q = normalizeForSearch(searchTerm)
    if (!q) return rankedCustomers
    return rankedCustomers.filter(({ cust }) =>
      normalizeForSearch(cust.name).includes(q) || cust.phone.includes(searchTerm.trim()))
  }, [rankedCustomers, searchTerm])

  const totalPages = Math.max(1, Math.ceil(filteredCustomers.length / PAGE_SIZE))
  const safePage = Math.min(page, totalPages)
  const pageStart = (safePage - 1) * PAGE_SIZE
  const pagedCustomers = filteredCustomers.slice(pageStart, pageStart + PAGE_SIZE)

  if (loading) return <PageSkeleton cards={4} rows={5} hasTable={false} />

  if (!selectedCustomer) {
    return (
      <div className="fidel-page" key="fidel-empty">
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

  const medal = (idx: number) => (idx === 0 ? <Trophy size={14} /> : idx === 1 ? <Medal size={14} /> : idx === 2 ? <Award size={14} /> : null)

  return (
    <div className="page fidel-page animate-fade-in management-workspace management-workspace--loyalty" key="fidel-full">
      <header className="page-header management-workspace-header">
        <div>
          <h1 className="page-title"><Award size={22} className="page-title-icon" /> Fidelización</h1>
          <p className="page-subtitle">Premia las visitas recurrentes y sigue a tus clientes VIP.</p>
        </div>
      </header>

      {/* Métricas */}
      <div className="fidel-metrics management-workspace-metrics">
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
            <span className="fidel-card-count">{filteredCustomers.length} cliente{filteredCustomers.length === 1 ? '' : 's'}</span>
          </div>

          <div className="filter-search-box fidel-search-box">
            <Search size={16} className="filter-search-icon" />
            <input
              type="text"
              placeholder="Buscar cliente por nombre o teléfono…"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="filter-search-input"
            />
            {searchTerm && (
              <button type="button" className="search-clear-btn" onClick={() => setSearchTerm('')} aria-label="Limpiar búsqueda">
                <X size={13} />
              </button>
            )}
          </div>

          <div className="fidel-list">
            {pagedCustomers.length === 0 && (
              <div className="fidel-list-empty">
                {searchTerm ? `Sin resultados para "${searchTerm}".` : 'No hay clientes todavía.'}
              </div>
            )}
            {pagedCustomers.map(({ cust, rank }) => {
              const stamps = cust.totalVisits % CYCLE
              const pct = (stamps / CYCLE) * 100
              return (
                <button
                  type="button"
                  key={cust.id}
                  className={`fidel-row ${cust.id === selectedCustomerId ? 'selected' : ''} ${rank < 3 ? `podium-${rank + 1}` : ''}`}
                  onClick={() => setSelectedCustomerId(cust.id)}
                >
                  <span className="fidel-row-rank">{medal(rank) ?? <>#{rank + 1}</>}</span>
                  <span className="fidel-row-avatar" style={{ background: avatarColorFor(cust.name) }}>{initialsFor(cust.name)}</span>
                  <span className="fidel-row-body">
                    <span className="fidel-row-name">{cust.name}</span>
                    <span className="fidel-row-meta">
                      {cust.phone ? <><Phone size={11} /> {cust.phone}</> : 'Sin teléfono'}
                      {cust.lastVisit ? ` · Últ. visita ${cust.lastVisit}` : ''}
                    </span>
                    <span className="fidel-row-progress-track"><span className="fidel-row-progress-fill" style={{ width: `${pct}%` }} /></span>
                  </span>
                  <span className="fidel-row-visits">
                    <strong>{cust.totalVisits}</strong>
                    <small>visitas</small>
                  </span>
                  <span className="fidel-row-reward"><Gift size={13} /> {cust.rewardsUnlocked}</span>
                  <span
                    className="fidel-row-add"
                    role="button"
                    tabIndex={0}
                    onClick={(e) => { e.stopPropagation(); setSelectedCustomerId(cust.id); handleAddVisit(cust.id) }}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.stopPropagation(); setSelectedCustomerId(cust.id); handleAddVisit(cust.id) } }}
                    title="Registrar una visita"
                  >
                    <Plus size={15} />
                  </span>
                </button>
              )
            })}
          </div>

          {totalPages > 1 && (
            <div className="fidel-pagination">
              <button type="button" disabled={safePage <= 1} onClick={() => setPage(p => Math.max(1, p - 1))}>
                <ChevronLeft size={16} />
              </button>
              <span>Página {safePage} de {totalPages}</span>
              <button type="button" disabled={safePage >= totalPages} onClick={() => setPage(p => Math.min(totalPages, p + 1))}>
                <ChevronRight size={16} />
              </button>
            </div>
          )}
        </div>

        {/* Tarjeta de fidelidad */}
        <div className="fidel-side">
          <div className="loyalty-card">
            <div className="loyalty-card-shine" aria-hidden />
            <div className="loyalty-bg-art" aria-hidden />
            <div className="loyalty-head">
              <div>
                <span className="loyalty-kicker">Tarjeta de Fidelidad</span>
                <h3 className="loyalty-name">{selectedCustomer.name}</h3>
                <span className="loyalty-meta">
                  {selectedCustomer.phone || 'Sin teléfono'}
                  {selectedCustomer.favoriteProduct ? ` · ${selectedCustomer.favoriteProduct}` : ''}
                </span>
              </div>
              <div className="loyalty-award"><img src="/icons/wok-mark.png" alt="" /></div>
            </div>

            {visitNotice && (
              <div className={`loyalty-notice ${noticeError ? 'error' : ''}`}>
                <CheckCircle2 size={15} /> <span>{visitNotice}</span>
              </div>
            )}

            <div className="loyalty-perforation" aria-hidden />

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
                    {isStamped ? <img src="/icons/wok-mark.png" alt="" /> : i + 1}
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
