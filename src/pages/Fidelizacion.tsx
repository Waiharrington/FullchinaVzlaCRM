import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { getLoyaltyCustomers, type Customer } from '../lib/dataService'
import { normalizeForSearch } from '../lib/textFormat'
import { Award, Gift, Star, Flame, Search, X, ChevronLeft, ChevronRight, Phone, KeyRound, CheckCircle2, Settings2, Plus, Trash2, UtensilsCrossed, UsersRound, CreditCard, SlidersHorizontal } from 'lucide-react'
import { PageSkeleton } from '../components/PageSkeleton'
import { supabase } from '../lib/supabase'
import './Fidelizacion.css'
import { useLiveDataRefresh } from '../lib/liveDataRefresh'

const PHONE_PAGE_SIZE = 8
const WIDE_PAGE_SIZE = 12
const ACCOUNT_PAGE_SIZE = 10
type LoyaltySection = 'cards' | 'rewards' | 'accounts' | 'program'
type Account = { customer_id: string; customer_name: string; identification: string | null; phone: string | null; email: string | null; status: 'active' | 'disabled' }
type CustomerRewardRecord = { id: number; cycle_number: number; reward_description: string; unlocked_at: string; redeemed_at?: string | null }
type CustomerRewardState = { available: CustomerRewardRecord[]; redeemed: CustomerRewardRecord[] }
type PendingCustomerReward = CustomerRewardRecord & { customer_id: string; customer_name: string; phone: string | null }
type RewardMenuProduct = { id: string; name: string; category: string | null; image_url: string | null }
type RewardConfig = { visits_per_reward: number; sequence: Array<{ product_id: string; name: string }> }

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

function loyaltyProductImage(imageUrl: string | null | undefined) {
  if (!imageUrl) return null
  const match = imageUrl.match(/^\/productos\/([^/?#]+)\.(?:png|jpe?g|webp)([?#].*)?$/i)
  return match ? `/optimized/productos/${match[1]}.webp${match[2] || ''}` : imageUrl
}

export function Fidelizacion() {
  const metricsCarouselRef = useRef<HTMLDivElement>(null)
  const metricsCarouselPaused = useRef(false)
  const currentMetricIndex = useRef(0)
  const mobileCardCloseTimer = useRef<number | null>(null)
  const [customers, setCustomers] = useState<Customer[]>([])
  const [selectedCustomerId, setSelectedCustomerId] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [page, setPage] = useState(1)
  const [accountPage, setAccountPage] = useState(1)
  const [accountSearch, setAccountSearch] = useState('')
  const [activeSection, setActiveSection] = useState<LoyaltySection>('cards')
  const [showMobileCustomerCard, setShowMobileCustomerCard] = useState(false)
  const [closingMobileCustomerCard, setClosingMobileCustomerCard] = useState(false)
  const [isWideLayout, setIsWideLayout] = useState(() => window.matchMedia('(min-width: 641px)').matches)
  const [loading, setLoading] = useState(true)
  const [accounts, setAccounts] = useState<Account[]>([])
  const [visitsPerReward, setVisitsPerReward] = useState(10)
  const [rewardMenuProducts, setRewardMenuProducts] = useState<RewardMenuProduct[]>([])
  const [rewardProductIds, setRewardProductIds] = useState<string[]>([])
  const [rewardProductSearch, setRewardProductSearch] = useState('')
  const [adminNotice, setAdminNotice] = useState('')
  const [customerRewards, setCustomerRewards] = useState<CustomerRewardState>({ available: [], redeemed: [] })
  const [pendingRewards, setPendingRewards] = useState<PendingCustomerReward[]>([])
  const [rewardStorageError, setRewardStorageError] = useState('')
  const [rewardActionNotice, setRewardActionNotice] = useState('')
  const [redeemingRewardId, setRedeemingRewardId] = useState<number | null>(null)

  const openMobileCustomerCard = useCallback(() => {
    if (mobileCardCloseTimer.current !== null) window.clearTimeout(mobileCardCloseTimer.current)
    mobileCardCloseTimer.current = null
    setClosingMobileCustomerCard(false)
    setShowMobileCustomerCard(true)
  }, [])

  const closeMobileCustomerCard = useCallback(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setShowMobileCustomerCard(false)
      setClosingMobileCustomerCard(false)
      return
    }
    setClosingMobileCustomerCard(true)
    if (mobileCardCloseTimer.current !== null) window.clearTimeout(mobileCardCloseTimer.current)
    mobileCardCloseTimer.current = window.setTimeout(() => {
      setShowMobileCustomerCard(false)
      setClosingMobileCustomerCard(false)
      mobileCardCloseTimer.current = null
    }, 220)
  }, [])

  useEffect(() => {
    const media = window.matchMedia('(min-width: 641px)')
    const updatePageSize = () => {
      setIsWideLayout(media.matches)
      setPage(1)
    }
    media.addEventListener('change', updatePageSize)
    return () => media.removeEventListener('change', updatePageSize)
  }, [])
  useEffect(() => {
    if (isWideLayout) {
      setShowMobileCustomerCard(false)
      return
    }
    if (!showMobileCustomerCard) return
    const previousOverflow = document.body.style.overflow
    document.body.classList.add('modal-open')
    document.body.style.overflow = 'hidden'
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') closeMobileCustomerCard() }
    window.addEventListener('keydown', closeOnEscape)
    return () => {
      window.removeEventListener('keydown', closeOnEscape)
      document.body.classList.remove('modal-open')
      document.body.style.overflow = previousOverflow
    }
  }, [closeMobileCustomerCard, isWideLayout, showMobileCustomerCard])

  useEffect(() => () => {
    if (mobileCardCloseTimer.current !== null) window.clearTimeout(mobileCardCloseTimer.current)
  }, [])
  const pageSize = isWideLayout ? WIDE_PAGE_SIZE : PHONE_PAGE_SIZE

  useEffect(() => {
    if (window.matchMedia('(max-width: 640px)').matches === false || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const timer = window.setInterval(() => {
      const carousel = metricsCarouselRef.current
      if (!carousel || metricsCarouselPaused.current || carousel.children.length < 2) return
      const nextIndex = (currentMetricIndex.current + 1) % carousel.children.length
      const nextSlide = carousel.children[nextIndex] as HTMLElement
      const left = nextSlide.getBoundingClientRect().left - carousel.getBoundingClientRect().left + carousel.scrollLeft
      carousel.scrollTo({ left, behavior: 'smooth' })
      currentMetricIndex.current = nextIndex
    }, 5000)
    return () => window.clearInterval(timer)
  }, [])

  const selectedCustomer = customers.find(c => c.id === selectedCustomerId) || customers[0] || {
    id: '', name: '', identification: '', phone: '', address: '', email: '', totalVisits: 0,
    rewardsUnlocked: 0, lastVisit: '', favoriteProduct: '', birthday: '', createdAt: '', isActive: true,
  }

  const refreshPendingRewards = useCallback(async () => {
    if (!supabase) { setPendingRewards([]); return }
    const { data, error } = await supabase.rpc('fn_admin_list_pending_loyalty_rewards')
    if (error) {
      setPendingRewards([])
      setRewardStorageError('El registro de premios necesita activarse en la base de datos antes de usar canjes.')
      return
    }
    setPendingRewards((data ?? []) as PendingCustomerReward[])
    setRewardStorageError('')
  }, [])

  const refreshCustomers = useCallback(async () => {
    try {
      const [data, accountResult, settingsResult, menuProductsResult] = await Promise.all([
        getLoyaltyCustomers(),
        supabase?.rpc('fn_admin_customer_accounts'),
        supabase?.rpc('fn_admin_get_loyalty_reward_config'),
        supabase?.rpc('fn_admin_get_loyalty_menu_products'),
        refreshPendingRewards(),
      ])
      setCustomers(data)
      setSelectedCustomerId(current => current || data[0]?.id || '')
      if (accountResult?.data) setAccounts(accountResult.data as Account[])
      if (settingsResult?.data) {
        const config = settingsResult.data as RewardConfig
        setVisitsPerReward(Number(config.visits_per_reward))
        setRewardProductIds((config.sequence ?? []).map(reward => reward.product_id))
      }
      if (menuProductsResult?.data) setRewardMenuProducts(menuProductsResult.data as RewardMenuProduct[])
    } catch (error) {
      setAdminNotice(error instanceof Error ? error.message : 'No se pudieron cargar los datos de fidelización.')
    } finally {
      setLoading(false)
    }
  }, [refreshPendingRewards])
  useEffect(() => { void refreshCustomers() }, [refreshCustomers])
  useLiveDataRefresh('fidelizacion', refreshCustomers)

  const refreshSelectedRewards = useCallback(async () => {
    if (!selectedCustomerId || !supabase) { setCustomerRewards({ available: [], redeemed: [] }); return }
    const { data, error } = await supabase.rpc('fn_admin_get_customer_loyalty_rewards', { p_customer_id: selectedCustomerId })
    if (error) {
      setCustomerRewards({ available: [], redeemed: [] })
      setRewardStorageError('El registro de premios necesita activarse en la base de datos antes de usar canjes.')
      return
    }
    setCustomerRewards(data as CustomerRewardState)
    setRewardStorageError('')
  }, [selectedCustomerId])
  useEffect(() => { void refreshSelectedRewards() }, [refreshSelectedRewards])

  useEffect(() => {
    setPage(1)
  }, [searchTerm])

  useEffect(() => {
    setAccountPage(1)
  }, [accountSearch])

  const saveLoyaltySettings = async () => {
    const { error } = await supabase!.rpc('fn_admin_set_loyalty_reward_config', { p_visits: visitsPerReward, p_sellable_product_ids: rewardProductIds })
    setAdminNotice(error ? error.message : 'Configuración de fidelización guardada.')
    if (!error) {
      await refreshCustomers()
      window.setTimeout(() => setAdminNotice(''), 4000)
    }
  }

  const resetCustomerPassword = async (account: Account) => {
    const nextPassword = window.prompt(`Nueva contraseña para ${account.customer_name} (mínimo 8 caracteres):`)
    if (!nextPassword) return
    const { data, error } = await supabase!.functions.invoke('customer-auth', { body: { action: 'admin-reset-password', customer_id: account.customer_id, new_password: nextPassword } })
    setAdminNotice(error ? (data?.message || error.message) : `Contraseña actualizada para ${account.customer_name}.`)
    window.setTimeout(() => setAdminNotice(''), 5000)
  }

  const redeemCustomerReward = async (reward: PendingCustomerReward | CustomerRewardRecord) => {
    const customerName = 'customer_name' in reward ? reward.customer_name : selectedCustomer.name
    if (!window.confirm(`Confirma que entregaste “${reward.reward_description}” a ${customerName}.`)) return
    setRedeemingRewardId(reward.id)
    const { error } = await supabase!.rpc('fn_admin_redeem_customer_loyalty_reward', { p_reward_id: reward.id })
    if (error) setRewardActionNotice(`No se pudo registrar el canje: ${error.message}`)
    else {
      setRewardActionNotice(`Premio del ciclo ${reward.cycle_number} marcado como canjeado.`)
      await Promise.all([refreshSelectedRewards(), refreshPendingRewards()])
    }
    setRedeemingRewardId(null)
    window.setTimeout(() => setRewardActionNotice(''), 5000)
  }

  const filteredCustomers = useMemo(() => {
    const q = normalizeForSearch(searchTerm)
    return [...customers]
      .sort((a, b) => a.name.localeCompare(b.name, 'es'))
      .filter(cust => !q || normalizeForSearch(cust.name).includes(q) || cust.phone.includes(searchTerm.trim()))
  }, [customers, searchTerm])

  const totalPages = Math.max(1, Math.ceil(filteredCustomers.length / pageSize))
  const safePage = Math.min(page, totalPages)
  const pageStart = (safePage - 1) * pageSize
  const pagedCustomers = filteredCustomers.slice(pageStart, pageStart + pageSize)
  const filteredAccounts = useMemo(() => {
    const q = normalizeForSearch(accountSearch)
    return accounts.filter(account => !q || normalizeForSearch(`${account.customer_name} ${account.identification ?? ''} ${account.phone ?? ''} ${account.email ?? ''}`).includes(q))
  }, [accounts, accountSearch])
  const accountTotalPages = Math.max(1, Math.ceil(filteredAccounts.length / ACCOUNT_PAGE_SIZE))
  const safeAccountPage = Math.min(accountPage, accountTotalPages)
  const pagedAccounts = filteredAccounts.slice((safeAccountPage - 1) * ACCOUNT_PAGE_SIZE, safeAccountPage * ACCOUNT_PAGE_SIZE)

  if (loading) return <PageSkeleton cards={4} rows={5} hasTable={false} />

  const loyaltyCycle = visitsPerReward
  const selectedHasPendingReward = customerRewards.available.length > 0 || pendingRewards.some(reward => reward.customer_id === selectedCustomer.id)
  const stampsInCycle = selectedHasPendingReward ? loyaltyCycle : selectedCustomer.totalVisits % loyaltyCycle
  const progressPct = (stampsInCycle / loyaltyCycle) * 100
  const totalVisitsAll = customers.reduce((s, c) => s + c.totalVisits, 0)
  const totalRewards = customers.reduce((s, c) => s + c.rewardsUnlocked, 0)
  const vipCount = new Set(pendingRewards.map(reward => reward.customer_id)).size
  const filteredRewardMenuProducts = rewardMenuProducts.filter(product => {
    const query = normalizeForSearch(rewardProductSearch)
    return !query || normalizeForSearch(`${product.name} ${product.category ?? ''}`).includes(query)
  })

  const METRICS = [
    { icon: <UsersRound size={22} />, cls: 'gold', label: 'Clientes', value: customers.length.toLocaleString('es-VE'), sub: 'Tarjetas registradas' },
    { icon: <Flame size={22} />, cls: 'fire', label: 'Visitas', value: totalVisitsAll.toLocaleString('es-VE'), sub: 'Suma de visitas' },
    { icon: <Gift size={22} />, cls: 'violet', label: 'Premios', value: totalRewards.toLocaleString('es-VE'), sub: 'Platos gratis' },
    { icon: <Star size={22} />, cls: 'red', label: 'Clientes VIP', value: vipCount.toLocaleString('es-VE'), sub: `Mínimo ${loyaltyCycle} visitas` },
  ]

  const selectedCustomerCard = (
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

      <div className="loyalty-perforation" aria-hidden />

      <div className="loyalty-progress-block">
        <div className="loyalty-progress-top">
          <span>Sellos de visita</span>
          <strong>{stampsInCycle} / {loyaltyCycle}</strong>
        </div>
        <div className="loyalty-progress-bar">
          <div className="loyalty-progress-fill" style={{ width: `${progressPct}%` }} />
        </div>
      </div>

      <div className="loyalty-stamps">
        {Array.from({ length: loyaltyCycle }).map((_, i) => {
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
          <span className="loyalty-reward-label">Premios pendientes de entregar</span>
          <span className="loyalty-reward-value">
            {customerRewards.available.length > 0
              ? <><Gift size={14} /> {customerRewards.available.length} premio(s) por canjear</>
              : `Faltan ${loyaltyCycle - stampsInCycle} visita(s) para el próximo premio`}
          </span>
        </div>
        {customerRewards.available.map(reward => <div className="fidel-customer-reward-row" key={reward.id}><span><strong>{reward.reward_description}</strong><small>Tarjeta {reward.cycle_number} · {new Date(reward.unlocked_at).toLocaleDateString('es-VE')}</small></span><button type="button" disabled={redeemingRewardId !== null} onClick={() => void redeemCustomerReward(reward)}>{redeemingRewardId === reward.id ? 'Guardando…' : 'Marcar canjeado'}</button></div>)}
        {customerRewards.redeemed.length > 0 && <details className="fidel-customer-redeemed"><summary>Premios canjeados ({customerRewards.redeemed.length})</summary>{customerRewards.redeemed.map(reward => <div key={reward.id}><span>{reward.reward_description}</span><small>Tarjeta {reward.cycle_number} · {new Date(reward.redeemed_at ?? reward.unlocked_at).toLocaleDateString('es-VE')}</small></div>)}</details>}
        <span className="loyalty-automatic-note"><CheckCircle2 size={14} /> Visitas automáticas al pagar una comanda con comida</span>
      </div>
    </div>
  )

  return (
    <div className="page fidel-page animate-fade-in management-workspace management-workspace--loyalty" key="fidel-full">
      <header className="page-header management-workspace-header">
        <div>
          <h1 className="page-title"><Award size={22} className="page-title-icon" /> Fidelización</h1>
          <p className="page-subtitle"><span className="fidel-subtitle-desktop">Premia las visitas recurrentes y sigue a tus clientes VIP.</span><span className="fidel-subtitle-mobile">Premia la fidelidad de tus clientes.</span></p>
        </div>
      </header>

      {/* Métricas */}
      <div
        ref={metricsCarouselRef}
        className="fidel-metrics management-workspace-metrics"
        role="region"
        aria-label="Resumen de fidelización"
        aria-roledescription="carrusel"
        onScroll={event => {
          const carousel = event.currentTarget
          const left = carousel.getBoundingClientRect().left
          let nearestIndex = 0
          let nearestDistance = Number.POSITIVE_INFINITY
          Array.from(carousel.children).forEach((child, index) => {
            const distance = Math.abs((child as HTMLElement).getBoundingClientRect().left - left)
            if (distance < nearestDistance) { nearestDistance = distance; nearestIndex = index }
          })
          currentMetricIndex.current = nearestIndex
        }}
        onPointerDown={() => { metricsCarouselPaused.current = true }}
        onPointerUp={() => { metricsCarouselPaused.current = false }}
        onPointerCancel={() => { metricsCarouselPaused.current = false }}
        onPointerEnter={event => { if (event.pointerType === 'mouse') metricsCarouselPaused.current = true }}
        onPointerLeave={() => { metricsCarouselPaused.current = false }}
        onFocusCapture={() => { metricsCarouselPaused.current = true }}
        onBlurCapture={event => {
          if (!event.currentTarget.contains(event.relatedTarget as Node | null)) metricsCarouselPaused.current = false
        }}
      >
        {METRICS.map((m, i) => (
          <div key={i} className="fidel-metric" role="group" aria-roledescription="diapositiva" aria-label={`${i + 1} de ${METRICS.length}: ${m.label}`}>
            <div className={`fidel-metric-icon ${m.cls}`}>{m.icon}</div>
            <div className="fidel-metric-body">
              <span className="fidel-metric-label">{m.label}</span>
              <span className="fidel-metric-value">{m.value}</span>
              <span className="fidel-metric-sub">{m.sub}</span>
            </div>
          </div>
        ))}
      </div>
      <p className="fidel-carousel-hint">Pasan automáticamente · También puedes deslizar</p>

      <nav className="fidel-section-tabs" role="tablist" aria-label="Secciones de fidelización">
        <button type="button" role="tab" aria-selected={activeSection === 'cards'} onClick={() => setActiveSection('cards')}><CreditCard size={17} /><span>Tarjetas</span><b>{customers.length}</b></button>
        <button type="button" role="tab" aria-selected={activeSection === 'rewards'} onClick={() => setActiveSection('rewards')}><Gift size={17} /><span>Premios por entregar</span><b>{pendingRewards.length}</b></button>
        <button type="button" role="tab" aria-selected={activeSection === 'accounts'} onClick={() => setActiveSection('accounts')}><UsersRound size={17} /><span>Cuentas de clientes</span><b>{accounts.length}</b></button>
        <button type="button" role="tab" aria-selected={activeSection === 'program'} onClick={() => setActiveSection('program')}><SlidersHorizontal size={17} /><span>Programa</span></button>
      </nav>

      {activeSection === 'cards' && <div className="fidel-grid" role="tabpanel">
        <section className="fidel-card">
          <div className="fidel-card-head">
            <div className="fidel-card-head-icon"><CreditCard size={18} /></div>
            <div><h2 className="fidel-card-title">Tarjetas de clientes</h2><span className="fidel-card-sub">Busca un cliente y revisa sus visitas.</span></div>
            <span className="fidel-card-count">{filteredCustomers.length} clientes</span>
          </div>
          <div className="filter-search-box fidel-search-box"><Search size={16} className="filter-search-icon" /><input type="text" placeholder="Buscar por nombre o teléfono…" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="filter-search-input" />{searchTerm && <button type="button" className="search-clear-btn" onClick={() => setSearchTerm('')} aria-label="Limpiar búsqueda"><X size={13} /></button>}</div>
          <div className="fidel-list">
            {pagedCustomers.length === 0 && <div className="fidel-list-empty">{searchTerm ? `Sin resultados para "${searchTerm}".` : 'No hay clientes todavía.'}</div>}
            {pagedCustomers.map(cust => {
              const hasPendingReward = pendingRewards.some(reward => reward.customer_id === cust.id)
              const stamps = hasPendingReward ? loyaltyCycle : cust.totalVisits % loyaltyCycle
              const pct = (stamps / loyaltyCycle) * 100
              return <button type="button" key={cust.id} className={`fidel-row ${cust.id === selectedCustomerId ? 'selected' : ''}`} onClick={() => { setSelectedCustomerId(cust.id); openMobileCustomerCard() }}>
                <span className="fidel-row-avatar" style={{ background: avatarColorFor(cust.name) }}>{initialsFor(cust.name)}</span>
                <span className="fidel-row-body"><span className="fidel-row-name">{cust.name}</span><span className="fidel-row-meta">{cust.phone ? <><Phone size={11} /> {cust.phone}</> : 'Sin teléfono'}{cust.lastVisit ? ` · Últ. visita ${cust.lastVisit}` : ''}</span><span className="fidel-row-progress-track"><span className="fidel-row-progress-fill" style={{ width: `${pct}%` }} /></span></span>
                <span className="fidel-row-visits"><strong>{cust.totalVisits}</strong><small>visitas</small></span><span className="fidel-row-reward"><Gift size={13} /> {cust.rewardsUnlocked}</span>
              </button>
            })}
          </div>
          {totalPages > 1 && <div className="fidel-pagination"><button type="button" disabled={safePage <= 1} onClick={() => setPage(p => Math.max(1, p - 1))}><ChevronLeft size={16} /></button><span>Página {safePage} de {totalPages}</span><button type="button" disabled={safePage >= totalPages} onClick={() => setPage(p => Math.min(totalPages, p + 1))}><ChevronRight size={16} /></button></div>}
        </section>

        <div className="fidel-side">
          {selectedCustomerCard}
        </div>
      </div>}

      {showMobileCustomerCard && !isWideLayout && activeSection === 'cards' && createPortal(
        <div className={`fidel-customer-card-modal-overlay${closingMobileCustomerCard ? ' is-closing' : ''}`} onClick={closeMobileCustomerCard}>
          <section className="fidel-customer-card-modal" role="dialog" aria-modal="true" aria-labelledby="fidel-customer-card-modal-title" onClick={event => event.stopPropagation()}>
            <header className="fidel-customer-card-modal-header">
              <div><CreditCard size={17} /><h2 id="fidel-customer-card-modal-title">Tarjeta de fidelidad</h2></div>
              <button type="button" aria-label="Cerrar tarjeta de fidelidad" autoFocus onClick={closeMobileCustomerCard}><X size={19} /></button>
            </header>
            {selectedCustomerCard}
          </section>
        </div>,
        document.body,
      )}

      {activeSection === 'rewards' && <section className="fidel-pending-panel fidel-tab-panel" role="tabpanel" aria-labelledby="fidel-pending-title">
        <header><div><Gift size={19} /><div><h2 id="fidel-pending-title">Premios por entregar</h2><p>Confirma el canje cuando el cliente reciba su recompensa.</p></div></div><b>{pendingRewards.length}</b></header>
        {rewardStorageError && <p className="fidel-reward-storage-notice" role="status">{rewardStorageError}</p>}{rewardActionNotice && <p className="fidel-admin-notice" role="status">{rewardActionNotice}</p>}
        {pendingRewards.length ? <div className="fidel-pending-list">{pendingRewards.map(reward => <article key={reward.id}><div className="fidel-pending-customer"><strong>{reward.customer_name}</strong><small>{reward.phone || 'Sin teléfono'} · Tarjeta {reward.cycle_number}</small></div><div className="fidel-pending-prize"><span>{reward.reward_description}</span><small>Disponible desde {new Date(reward.unlocked_at).toLocaleDateString('es-VE', { day: 'numeric', month: 'short', year: 'numeric' })}</small></div><button type="button" disabled={redeemingRewardId !== null} onClick={() => void redeemCustomerReward(reward)}>{redeemingRewardId === reward.id ? 'Guardando…' : 'Marcar canjeado'}</button></article>)}</div> : !rewardStorageError && <p className="fidel-pending-empty">No hay premios pendientes. Aquí aparecerán al completar una tarjeta.</p>}
      </section>}

      {activeSection === 'accounts' && <section className="fidel-accounts-panel fidel-accounts-page" role="tabpanel">
        <header className="fidel-accounts-page-head"><div><span className="fidel-accounts-eyebrow">ACCESO A MI PERFIL</span><h2><UsersRound size={19} /> Cuentas de clientes</h2><p>Busca una cuenta, revisa sus datos y restablece su clave cuando lo necesite.</p></div><span className="fidel-accounts-total"><strong>{filteredAccounts.length}</strong><small>{filteredAccounts.length === 1 ? 'cuenta' : 'cuentas'}</small></span></header>
        {adminNotice && <p className="fidel-admin-notice" role="status">{adminNotice}</p>}
        <div className="filter-search-box fidel-account-search"><Search size={17} className="filter-search-icon" /><input type="search" placeholder="Buscar por nombre, cédula, teléfono o correo…" value={accountSearch} onChange={event => setAccountSearch(event.target.value)} className="filter-search-input" />{accountSearch && <button type="button" className="search-clear-btn" onClick={() => setAccountSearch('')} aria-label="Limpiar búsqueda"><X size={13} /></button>}</div>
        {pagedAccounts.length > 0 && <div className="fidel-accounts-table-wrap"><table className="fidel-accounts-table"><thead><tr><th>Cliente</th><th>Cédula</th><th>Contacto</th><th>Estado</th><th><span className="sr-only">Acciones</span></th></tr></thead><tbody>{pagedAccounts.map(account => <tr key={account.customer_id}><td><div className="fidel-account-table-customer"><span className="fidel-account-avatar" style={{ background: avatarColorFor(account.customer_name) }}>{initialsFor(account.customer_name)}</span><strong>{account.customer_name}</strong></div></td><td>{account.identification || <span className="fidel-table-muted">Sin cédula</span>}</td><td><div className="fidel-account-table-contact"><strong>{account.phone || 'Sin teléfono'}</strong>{account.email && <small>{account.email}</small>}</div></td><td><span className={`fidel-account-status ${account.status}`}><i />{account.status === 'active' ? 'Activa' : 'Desactivada'}</span></td><td><button className="fidel-account-table-action" type="button" onClick={() => void resetCustomerPassword(account)}><KeyRound size={14} /> Restablecer clave</button></td></tr>)}</tbody></table></div>}
        <div className="fidel-accounts-list">{pagedAccounts.length === 0 ? <div className="fidel-accounts-empty"><UsersRound size={25} /><strong>{accountSearch ? 'No encontramos esa cuenta' : 'Todavía no hay cuentas'}</strong><span>{accountSearch ? 'Prueba con otro nombre, teléfono o correo.' : 'Las cuentas creadas desde Mi perfil aparecerán aquí.'}</span></div> : pagedAccounts.map(account => <article className="fidel-account-card" key={account.customer_id}><div className="fidel-account-card-head"><span className="fidel-account-avatar" style={{ background: avatarColorFor(account.customer_name) }}>{initialsFor(account.customer_name)}</span><div className="fidel-account-identity"><strong>{account.customer_name}</strong><span>Cliente de Full China</span></div><span className={`fidel-account-status ${account.status}`}><i />{account.status === 'active' ? 'Activa' : 'Desactivada'}</span></div><div className="fidel-account-details"><span><small>CÉDULA</small><strong>{account.identification || 'Sin cédula'}</strong></span><span><small>TELÉFONO</small><strong>{account.phone || 'Sin teléfono'}</strong></span>{account.email && <span className="fidel-account-email"><small>CORREO</small><strong>{account.email}</strong></span>}</div><div className="fidel-account-actions"><button type="button" onClick={() => void resetCustomerPassword(account)}><KeyRound size={15} /> Restablecer clave</button></div></article>)}</div>
        {filteredAccounts.length > 0 && <div className="fidel-account-pagination"><span>Mostrando {(safeAccountPage - 1) * ACCOUNT_PAGE_SIZE + 1}–{Math.min(safeAccountPage * ACCOUNT_PAGE_SIZE, filteredAccounts.length)} de {filteredAccounts.length}</span><div><button type="button" disabled={safeAccountPage <= 1} onClick={() => setAccountPage(current => Math.max(1, current - 1))} aria-label="Página anterior"><ChevronLeft size={17} /></button><b>Página {safeAccountPage} de {accountTotalPages}</b><button type="button" disabled={safeAccountPage >= accountTotalPages} onClick={() => setAccountPage(current => Math.min(accountTotalPages, current + 1))} aria-label="Página siguiente"><ChevronRight size={17} /></button></div></div>}
        <small className="fidel-password-note"><KeyRound size={13} /> La clave actual nunca se muestra. Solo puedes establecer una nueva.</small>
      </section>}

      {activeSection === 'program' && <section className="fidel-accounts-panel fidel-program-panel" role="tabpanel">
            <header><div><h2><Settings2 size={19} /> Programa de fidelización</h2><p>Configura las visitas necesarias y los premios que se entregan.</p></div></header>
            <div className="fidel-loyalty-settings">
              <label>Visitas para ganar un premio<input type="number" min={1} max={50} value={visitsPerReward} onChange={e => setVisitsPerReward(Number(e.target.value))} /></label>
              <div className="fidel-reward-picker">
                <div className="fidel-reward-picker-heading"><strong>Arma los premios de la tarjeta <span>{rewardProductIds.length}/20</span></strong><small>Toca un plato para sumarlo. Al completar cada tarjeta se entrega el siguiente premio.</small></div>
                {rewardProductIds.length > 0 && <div className="fidel-reward-selected-list" aria-label="Premios seleccionados en orden">{rewardProductIds.map((productId, index) => {
                  const product = rewardMenuProducts.find(item => item.id === productId)
                  return <div className="fidel-reward-selected-item" key={`${index}-${productId}`}>{loyaltyProductImage(product?.image_url) ? <img className="fidel-reward-selected-image" src={loyaltyProductImage(product?.image_url)!} alt="" loading="lazy" decoding="async" /> : <span className="fidel-reward-selected-fallback"><UtensilsCrossed size={17} /></span>}<span className="fidel-reward-selected-number">{index + 1}</span><span className="fidel-reward-selected-name"><strong>{product?.name ?? 'Plato del menú'}</strong><small>{product?.category ?? 'Premio'} · Tarjeta {index + 1}</small></span><button type="button" aria-label={`Quitar ${product?.name ?? 'premio'} de la secuencia`} onClick={() => setRewardProductIds(current => current.filter((_, itemIndex) => itemIndex !== index))}><Trash2 size={15} /></button></div>
                })}</div>}
                <label className="fidel-reward-search"><Search size={16} /><input type="search" value={rewardProductSearch} onChange={event => setRewardProductSearch(event.target.value)} placeholder="Buscar plato o categoría…" aria-label="Buscar platos para premios" /></label>
                {filteredRewardMenuProducts.length > 0 ? <div className="fidel-reward-menu-grid" aria-label="Platos disponibles para premios">{filteredRewardMenuProducts.map(product => <button className="fidel-reward-menu-option" type="button" key={product.id} disabled={rewardProductIds.length >= 20} onClick={() => setRewardProductIds(current => current.length < 20 ? [...current, product.id] : current)}>{loyaltyProductImage(product.image_url) ? <img className="fidel-reward-menu-option-image" src={loyaltyProductImage(product.image_url)!} alt="" loading="lazy" decoding="async" /> : <span className="fidel-reward-menu-option-fallback"><UtensilsCrossed size={17} /></span>}<span className="fidel-reward-menu-option-copy"><strong>{product.name}</strong><small>{product.category || 'Menú'}</small></span><span className="fidel-reward-menu-option-add"><Plus size={16} /></span></button>)}</div> : <p className="fidel-reward-picker-empty">{rewardMenuProducts.length ? 'No encontramos platos con esa búsqueda.' : 'No hay platos activos con receta disponibles para elegir.'}</p>}
                <p className="fidel-reward-inventory-note"><CheckCircle2 size={14} /> El regalo descuenta ingredientes de inventario, sin sumar a caja.</p>
              </div>
              <button type="button" disabled={rewardProductIds.length === 0} onClick={() => void saveLoyaltySettings()}>Guardar programa</button>
            </div>
            {adminNotice && <p className="fidel-admin-notice">{adminNotice}</p>}
      </section>}
    </div>
  )
}
