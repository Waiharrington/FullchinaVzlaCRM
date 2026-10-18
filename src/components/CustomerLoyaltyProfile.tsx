import { useCallback, useEffect, useRef, useState, type CSSProperties, type FormEvent, type PointerEvent as ReactPointerEvent } from 'react'
import { createPortal } from 'react-dom'
import { Award, ArrowLeft, ArrowRight, CalendarDays, ChevronDown, ChevronLeft, ChevronRight, Eye, EyeOff, Gift, History, LoaderCircle, LogOut, RotateCw, Tag, Utensils } from 'lucide-react'
import { customerSupabase } from '../lib/supabase'
import { customerAuthErrorMessage } from '../lib/customerAuthErrors'
import { getCustomerOrderProfile } from '../lib/customerOrderProfile'
import Toast from './Toast'
import CustomerRewardJourney from './CustomerRewardJourney'
import CustomerVisitHistory from './CustomerVisitHistory'
import { PublicMenuSkeleton } from './PublicMenuSkeleton'
import { getCustomerOrderForRepeat, getPublicCatalog, type CustomerRepeatOrder } from '../lib/publicOrders'
import './CustomerLoyaltyProfile.css'

type Visit = { order_id: string; order_number: string; visited_at: string; reward_description?: string | null }
type LoyaltyReward = { id: number; cycle_number: number; reward_description: string; unlocked_at: string; redeemed_at?: string | null }
type LoyaltyProfile = { customer: { first_name: string; last_name: string; full_name: string; phone: string; identification?: string }; total_visits: number; current_cycle_visits?: number; rewards_unlocked: number; reward_description: string; next_reward_description?: string; visits_per_reward: number; available_rewards: LoyaltyReward[]; redeemed_rewards: LoyaltyReward[]; has_more: boolean; visits: Visit[]; account_status: 'active' }
type PendingCelebration = { pending: boolean; stamp?: number; reward_description?: string }

const pageSize = 5
const AUTH_MODE_KEY = 'fullchina_customer_auth_preferred_mode'
const victoryDishImages = ['/optimized/productos/M1.webp', '/optimized/productos/M2.webp', '/optimized/productos/M3.webp', '/optimized/productos/M13.webp']

type CustomerLoyaltyProfileProps = {
  onRepeatOrder?: (order: CustomerRepeatOrder) => Promise<void>
  presentation?: 'profile' | 'promotion' | 'recommended'
  onJoin?: () => void
}

function customerProductImage(imageUrl: string) {
  const match = imageUrl.match(/^\/productos\/([^/?#]+)\.(?:png|jpe?g|webp)([?#].*)?$/i)
  return match ? `/optimized/productos/${match[1]}.webp${match[2] || ''}` : imageUrl
}

function CustomerRecentOrders({ visits, onRepeatOrder }: { visits: Visit[]; onRepeatOrder?: CustomerLoyaltyProfileProps['onRepeatOrder'] }) {
  const [orders, setOrders] = useState<CustomerRepeatOrder[]>([])
  const [productImages, setProductImages] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [shouldLoad, setShouldLoad] = useState(false)
  const [repeatingOrderId, setRepeatingOrderId] = useState<string | null>(null)
  const [error, setError] = useState('')
  const rail = useRef<HTMLDivElement>(null)
  const section = useRef<HTMLElement>(null)

  useEffect(() => {
    const target = section.current
    if (!target || shouldLoad) return
    if (!('IntersectionObserver' in window)) { setShouldLoad(true); return }
    const observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) {
        setShouldLoad(true)
        observer.disconnect()
      }
    }, { rootMargin: '240px 0px' })
    observer.observe(target)
    return () => observer.disconnect()
  }, [shouldLoad])

  useEffect(() => {
    if (!shouldLoad) return
    let cancelled = false
    setLoading(true)
    setError('')
    const load = async () => {
      const catalogPromise = getPublicCatalog().catch(() => [])
      const results = await Promise.allSettled(visits.slice(0, 5).map(visit => getCustomerOrderForRepeat(visit.order_id)))
      const catalog = await catalogPromise
      if (!cancelled) setProductImages(Object.fromEntries(catalog.filter(product => product.imageUrl).map(product => [product.id, customerProductImage(product.imageUrl!)])))
      if (results.every(result => result.status === 'rejected') && results.length) setError('No pudimos cargar tus pedidos recientes.')
      return results.flatMap(result => result.status === 'fulfilled' ? [result.value] : [])
    }
    load().then(nextOrders => {
      if (!cancelled) setOrders(nextOrders)
    }).catch(cause => {
      if (!cancelled) setError(cause instanceof Error ? cause.message : 'No pudimos cargar tus pedidos recientes.')
    }).finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [visits, shouldLoad])

  const repeatOrder = async (order: CustomerRepeatOrder) => {
    if (!onRepeatOrder || repeatingOrderId) return
    setRepeatingOrderId(order.orderId)
    setError('')
    try { await onRepeatOrder(order) }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'No pudimos preparar este pedido. Inténtalo otra vez.') }
    finally { setRepeatingOrderId(null) }
  }

  return <section ref={section} className="customer-recent-orders" aria-labelledby="customer-recent-orders-title" aria-busy={loading}>
    <header className="customer-recent-orders-heading"><div><span>PARA VOLVER A DISFRUTAR</span><h2 id="customer-recent-orders-title">Tus favoritos</h2><p>Tus últimos pedidos, listos para repetir.</p></div><div className="customer-recent-orders-actions"><div className="customer-recent-orders-controls"><button type="button" aria-label="Pedidos anteriores" onClick={() => rail.current?.scrollBy({ left: -300, behavior: 'smooth' })}><ArrowLeft size={17} /></button><button type="button" aria-label="Más pedidos" onClick={() => rail.current?.scrollBy({ left: 300, behavior: 'smooth' })}><ArrowRight size={17} /></button></div></div></header>
    {loading ? <div className="customer-recent-orders-skeletons" aria-label="Cargando tus últimos pedidos">{Array.from({ length: 2 }, (_, index) => <div className="customer-recent-order-skeleton" key={index}><span /><div><i /><i /><i /></div></div>)}</div> : orders.length ? <div className="customer-recent-orders-rail" ref={rail}>
      {orders.map((order, index) => {
        const leadItem = order.items[0]
        const leadImage = leadItem ? productImages[leadItem.productId] : undefined
        const date = visits.find(visit => visit.order_id === order.orderId)?.visited_at
        return <article className="customer-recent-order-card" key={order.orderId} style={{ '--order-index': index } as CSSProperties}>
          <div className="customer-recent-order-card-top"><span><Utensils size={15} /> {order.orderType === 'delivery' ? 'Delivery' : 'Para retirar'}</span><small>{date ? new Date(date).toLocaleDateString('es-VE', { day: 'numeric', month: 'short' }) : `#${order.orderId.slice(0, 6)}`}</small></div>
          <div className="customer-recent-order-featured">
            {leadImage && <img src={leadImage} alt={leadItem?.productName || ''} loading="lazy" decoding="async" onError={event => { event.currentTarget.hidden = true }} />}
            <div><strong className="customer-recent-order-title">{leadItem?.productName || 'Pedido Full China'}</strong>
            <p>{leadItem ? `${leadItem.quantity} × ${leadItem.productName}${order.items.length > 1 ? ` + ${order.items.length - 1} ${order.items.length === 2 ? 'producto' : 'productos'}` : ''}` : 'Comanda reciente'}</p></div>
          </div>
          <button type="button" className="customer-repeat-order-button" disabled={!onRepeatOrder || repeatingOrderId !== null} onClick={() => void repeatOrder(order)}>{repeatingOrderId === order.orderId ? <LoaderCircle size={16} className="customer-repeat-order-spinner" /> : <RotateCw size={16} />}<span>{repeatingOrderId === order.orderId ? 'Preparando…' : 'Volver a pedir'}</span></button>
        </article>
      })}
    </div> : <div className="customer-recent-orders-status">{error || 'Cuando hagas tus primeros pedidos, aparecerán aquí.'}</div>}
    {error && orders.length > 0 && <p className="customer-repeat-order-error" role="alert">{error}</p>}
  </section>
}

function CustomerDesktopVisitHistory({ visits, onRepeatOrder }: { visits: Visit[]; onRepeatOrder?: CustomerLoyaltyProfileProps['onRepeatOrder'] }) {
  const [month, setMonth] = useState('all')
  const [monthMenuOpen, setMonthMenuOpen] = useState(false)
  const [expandedVisitId, setExpandedVisitId] = useState<string | null>(null)
  const [expandedMonths, setExpandedMonths] = useState<Record<string, boolean>>({})
  const [monthPages, setMonthPages] = useState<Record<string, number>>({})
  const [repeatingOrderId, setRepeatingOrderId] = useState<string | null>(null)
  const [repeatOrderError, setRepeatOrderError] = useState('')
  const monthMenuRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!monthMenuOpen) return
    const closeOnOutside = (event: PointerEvent) => {
      if (!monthMenuRef.current?.contains(event.target as Node)) setMonthMenuOpen(false)
    }
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMonthMenuOpen(false)
    }
    document.addEventListener('pointerdown', closeOnOutside)
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('pointerdown', closeOnOutside)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [monthMenuOpen])
  const months = [...new Set(visits.map(visit => visit.visited_at.slice(0, 7)))]
  const visibleVisits = visits.filter(visit => month === 'all' || visit.visited_at.startsWith(month))
  const groupedVisits = [...new Set(visibleVisits.map(visit => visit.visited_at.slice(0, 7)))].map(value => ({
    value,
    visits: visibleVisits.filter(visit => visit.visited_at.startsWith(value)),
  }))
  const labelDate = (date: Date, options: Intl.DateTimeFormatOptions) => date.toLocaleDateString('es-VE', options)
  const monthLabel = (value: string) => value === 'all' ? 'Todos los meses' : new Date(`${value}-15T12:00:00-04:00`).toLocaleDateString('es-VE', { month: 'long', year: 'numeric' })
  const chooseMonth = (value: string) => { setMonth(value); setExpandedVisitId(null); setMonthPages({}); setExpandedMonths(value === 'all' ? {} : { [value]: true }); setMonthMenuOpen(false) }
  const repeatOrder = async (orderId: string) => {
    if (!onRepeatOrder || repeatingOrderId) return
    setRepeatingOrderId(orderId)
    setRepeatOrderError('')
    try { await onRepeatOrder(await getCustomerOrderForRepeat(orderId)) }
    catch (cause) { setRepeatOrderError(cause instanceof Error ? cause.message : 'No pudimos preparar este pedido. Inténtalo otra vez.') }
    finally { setRepeatingOrderId(null) }
  }
  return <section className="customer-desktop-history" aria-label="Historial de visitas">
    <header className="customer-desktop-history-heading"><div className="customer-desktop-history-icon"><History size={22} /></div><div><h2>Historial de visitas</h2><p>Revisa tus visitas y avances.</p></div><div className={`customer-desktop-history-filter${monthMenuOpen ? ' is-open' : ''}`} ref={monthMenuRef}><button type="button" aria-label="Filtrar historial por mes" aria-expanded={monthMenuOpen} aria-controls="customer-desktop-month-options" onClick={() => setMonthMenuOpen(open => !open)}><CalendarDays size={16} /><span>{monthLabel(month)}</span><ChevronDown size={15} className="customer-desktop-history-filter-arrow" /></button>{monthMenuOpen && <div className="customer-desktop-history-month-menu" id="customer-desktop-month-options" role="listbox" aria-label="Meses del historial">{['all', ...months].map(value => <button type="button" role="option" aria-selected={month === value} className={month === value ? 'is-selected' : ''} key={value} onClick={() => chooseMonth(value)}>{monthLabel(value)}</button>)}</div>}</div></header>
    {visibleVisits.length ? <div className="customer-desktop-history-month-groups">{groupedVisits.map(({ value, visits: monthOrders }, groupIndex) => {
      const pageIndex = monthPages[value] ?? 0
      const pageCount = Math.ceil(monthOrders.length / pageSize)
      const pageVisits = monthOrders.slice(pageIndex * pageSize, (pageIndex + 1) * pageSize)
      const isMonthOpen = month === 'all' ? (expandedMonths[value] ?? groupIndex === 0) : true
      const headingId = `desktop-month-${value}`
      return <section className={`customer-desktop-history-month${isMonthOpen ? ' is-open' : ''}`} key={value}>
        <button type="button" className="customer-desktop-history-month-toggle" aria-expanded={isMonthOpen} aria-controls={`${headingId}-visits`} onClick={() => setExpandedMonths(current => ({ ...current, [value]: !isMonthOpen }))}>
          <span><strong id={headingId}>{monthLabel(value)}</strong><small>{monthOrders.length} {monthOrders.length === 1 ? 'pedido' : 'pedidos'}</small></span><ChevronDown size={18} className="customer-desktop-history-chevron" />
        </button>
        {isMonthOpen && <><div className="customer-desktop-history-list" id={`${headingId}-visits`}>{pageVisits.map(visit => {
      const date = new Date(visit.visited_at)
      const isOpen = expandedVisitId === visit.order_id || (expandedVisitId === null && groupIndex === 0 && pageIndex === 0 && visit.order_id === monthOrders[0]?.order_id)
      return <article className={`customer-desktop-history-visit${isOpen ? ' is-open' : ''}`} key={visit.order_id}>
        <button type="button" className="customer-desktop-history-visit-button" aria-expanded={isOpen} aria-controls={`desktop-visit-${visit.order_id}`} onClick={() => setExpandedVisitId(isOpen ? '' : visit.order_id)}><span className="customer-desktop-history-stamp"><img src="/icons/wok-mark.png" alt="" /></span><span className="customer-desktop-history-visit-copy"><strong>{labelDate(date, { weekday: 'long', day: 'numeric', month: 'long' })}</strong><small>Visita registrada <b>+1 sello</b></small></span><span className="customer-desktop-history-time"><time dateTime={visit.visited_at}>{date.toLocaleTimeString('es-VE', { hour: 'numeric', minute: '2-digit' })}</time><small>#{visit.order_number}</small></span><ChevronDown size={17} className="customer-desktop-history-chevron" /></button>
        {isOpen && <div id={`desktop-visit-${visit.order_id}`} className="customer-desktop-history-order"><p>Esta visita quedó asociada a la comanda <strong>{visit.order_number}</strong> y sumó un sello a tu tarjeta.</p><button type="button" className="customer-repeat-order-button" disabled={!onRepeatOrder || repeatingOrderId !== null} onClick={() => void repeatOrder(visit.order_id)}>{repeatingOrderId === visit.order_id ? <LoaderCircle size={16} className="customer-repeat-order-spinner" /> : <RotateCw size={16} />}<span>{repeatingOrderId === visit.order_id ? 'Preparando pedido…' : 'Volver a pedir'}</span></button>{repeatOrderError && <p className="customer-repeat-order-error" role="alert">{repeatOrderError}</p>}</div>}
      </article>
    })}</div>{pageCount > 1 && <footer className="customer-desktop-history-pagination"><button type="button" disabled={pageIndex === 0} onClick={() => { setMonthPages(current => ({ ...current, [value]: pageIndex - 1 })); setExpandedVisitId(null) }} aria-label={`Pedidos anteriores de ${monthLabel(value)}`}><ChevronLeft size={16} /></button><span>Página {pageIndex + 1} de {pageCount}</span><button type="button" disabled={pageIndex >= pageCount - 1} onClick={() => { setMonthPages(current => ({ ...current, [value]: pageIndex + 1 })); setExpandedVisitId(null) }} aria-label={`Más pedidos de ${monthLabel(value)}`}><ChevronRight size={16} /></button></footer>}</>}
      </section>
    })}</div> : <div className="customer-desktop-history-empty"><History size={34} /><strong>Tu historia empieza aquí</strong><p>Cuando hagas tu primer pedido, tus visitas aparecerán en esta lista.</p></div>}
  </section>
}

function shuffledVictoryDishes() {
  const images = [...victoryDishImages]
  for (let index = images.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1))
    ;[images[index], images[randomIndex]] = [images[randomIndex], images[index]]
  }
  return images
}

function getInitialAuthMode(): 'login' | 'register' {
  try {
    const savedMode = window.localStorage.getItem(AUTH_MODE_KEY)
    return savedMode === 'login' || savedMode === 'register' ? savedMode : 'register'
  } catch {
    return 'register'
  }
}

export function CustomerLoyaltyProfile({ onRepeatOrder, presentation = 'profile', onJoin }: CustomerLoyaltyProfileProps) {
  const [profile, setProfile] = useState<LoyaltyProfile | null>(null)
  const [recentVisits, setRecentVisits] = useState<Visit[]>([])
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [identification, setIdentification] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [mode, setMode] = useState<'login' | 'register'>(getInitialAuthMode)
  const [hasSwitchedMode, setHasSwitchedMode] = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const [page, setPage] = useState(0)
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [authReady, setAuthReady] = useState(false)
  const [sessionActive, setSessionActive] = useState(false)
  const [profileLoading, setProfileLoading] = useState(false)
  const [profileLoadError, setProfileLoadError] = useState('')
  const [memberCardAnimating, setMemberCardAnimating] = useState(false)
  const memberCardElement = useRef<HTMLButtonElement>(null)
  const memberCardPointer = useRef<{ x: number; y: number } | null>(null)
  const memberCardDragged = useRef(false)
  const [showWelcomeIntro, setShowWelcomeIntro] = useState(true)
  const [initialAuthCheck, setInitialAuthCheck] = useState(true)
  const [celebration, setCelebration] = useState<{ stamp: number; complete: boolean; id: number; rewardDescription?: string } | null>(null)
  const [victoryDishes, setVictoryDishes] = useState<string[]>([])
  const [newestStamp, setNewestStamp] = useState<{ index: number; id: number } | null>(null)
  const [rewardArrival, setRewardArrival] = useState<'receiving' | 'landing' | null>(null)
  const previousCelebrationCount = useRef<number | null>(null)
  const suppressNextCountCelebration = useRef(false)
  const celebrationClose = useRef<HTMLButtonElement>(null)
  const celebrationDialog = useRef<HTMLDivElement>(null)
  const isCelebrationOpen = Boolean(celebration)
  const threshold = Math.max(1, Number(profile?.visits_per_reward) || 10)

  const handleMemberCardPointerDown = (event: ReactPointerEvent<HTMLButtonElement>) => {
    memberCardDragged.current = false
    memberCardPointer.current = { x: event.clientX, y: event.clientY }
  }
  const handleMemberCardPointerMove = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (memberCardAnimating || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const card = memberCardElement.current
    if (!card) return
    const rect = card.getBoundingClientRect()
    const x = Math.max(-1, Math.min(1, ((event.clientX - rect.left) / rect.width - .5) * 2))
    const y = Math.max(-1, Math.min(1, ((event.clientY - rect.top) / rect.height - .5) * 2))
    card.style.setProperty('--member-card-tilt-x', `${-y * 12}deg`)
    card.style.setProperty('--member-card-tilt-y', `${x * 16}deg`)
    if (memberCardPointer.current && Math.hypot(event.clientX - memberCardPointer.current.x, event.clientY - memberCardPointer.current.y) > 5) {
      memberCardDragged.current = true
    }
  }
  const resetMemberCardTilt = () => {
    const card = memberCardElement.current
    card?.style.setProperty('--member-card-tilt-x', '0deg')
    card?.style.setProperty('--member-card-tilt-y', '0deg')
    memberCardPointer.current = null
  }
  const activateMemberCard = () => {
    if (memberCardDragged.current) {
      memberCardDragged.current = false
      return
    }
    if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) setMemberCardAnimating(true)
  }

  const closeCelebration = useCallback(() => {
    const shouldFlyReward = Boolean(celebration?.complete && profile?.available_rewards?.length)
    const sourceTicket = shouldFlyReward ? celebrationDialog.current?.querySelector<HTMLElement>('.customer-victory-prize') : null
    const sourceRect = sourceTicket?.getBoundingClientRect()
    if (shouldFlyReward && sourceRect) setRewardArrival('receiving')
    setCelebration(null)
    if (sourceTicket && sourceRect) {
      const ticketFlight = sourceTicket.cloneNode(true) as HTMLElement
      ticketFlight.setAttribute('aria-hidden', 'true')
      ticketFlight.removeAttribute('id')
      ticketFlight.style.position = 'fixed'
      ticketFlight.style.zIndex = '10003'
      ticketFlight.style.left = `${sourceRect.left}px`
      ticketFlight.style.top = `${sourceRect.top}px`
      ticketFlight.style.width = `${sourceRect.width}px`
      ticketFlight.style.height = `${sourceRect.height}px`
      ticketFlight.style.maxWidth = 'none'
      ticketFlight.style.margin = '0'
      ticketFlight.style.transformOrigin = 'top left'
      ticketFlight.style.animation = 'none'
      ticketFlight.style.pointerEvents = 'none'
      ticketFlight.querySelector('.customer-victory-prize-shine')?.remove()
      document.body.append(ticketFlight)
      window.requestAnimationFrame(() => window.requestAnimationFrame(() => {
        const destination = document.querySelector<HTMLElement>('.customer-reward-unlocked-ticket')
        if (!destination) {
          ticketFlight.remove()
          setRewardArrival(null)
          return
        }
        const destinationRect = destination.getBoundingClientRect()
        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
          ticketFlight.remove()
          setRewardArrival('landing')
          return
        }
        const translateX = destinationRect.left - sourceRect.left
        const translateY = destinationRect.top - sourceRect.top
        const scaleX = destinationRect.width / sourceRect.width
        const scaleY = destinationRect.height / sourceRect.height
        const flight = ticketFlight.animate([
          { transform: 'translate(0, 0) scale(1)', opacity: 1 },
          { transform: `translate(${translateX}px, ${translateY}px) scale(${scaleX}, ${scaleY})`, opacity: .96 },
        ], { duration: 920, easing: 'cubic-bezier(.18,.82,.22,1)', fill: 'forwards' })
        flight.onfinish = () => {
          ticketFlight.remove()
          setRewardArrival('landing')
        }
        flight.oncancel = () => ticketFlight.remove()
      }))
    }
  }, [celebration, profile])

  useEffect(() => {
    if (rewardArrival !== 'landing') return
    const timer = window.setTimeout(() => setRewardArrival(null), 1100)
    return () => window.clearTimeout(timer)
  }, [rewardArrival])

  useEffect(() => {
    if (!isCelebrationOpen) return
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const previousBodyOverflow = document.body.style.overflow
    const previousRootOverflow = document.documentElement.style.overflow
    document.body.style.overflow = 'hidden'
    document.documentElement.style.overflow = 'hidden'
    celebrationClose.current?.focus({ preventScroll: true })
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeCelebration()
      if (event.key === 'Tab') {
        event.preventDefault()
        const focusable = Array.from(celebrationDialog.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])') ?? [])
        if (!focusable.length) return
        const index = focusable.indexOf(document.activeElement as HTMLButtonElement)
        const nextIndex = event.shiftKey
          ? (index <= 0 ? focusable.length - 1 : index - 1)
          : (index >= focusable.length - 1 ? 0 : index + 1)
        focusable[nextIndex]?.focus()
      }
    }
    document.addEventListener('keydown', handleKey)
    return () => {
      document.removeEventListener('keydown', handleKey)
      document.body.style.overflow = previousBodyOverflow
      document.documentElement.style.overflow = previousRootOverflow
      previousFocus?.focus({ preventScroll: true })
    }
  }, [isCelebrationOpen, closeCelebration])

  useEffect(() => {
    if (!profile) { previousCelebrationCount.current = null; return }
    const limit = Math.max(1, Number(profile.visits_per_reward) || 10)
    const count = profile.current_cycle_visits ?? profile.total_visits % limit
    const previous = previousCelebrationCount.current
    previousCelebrationCount.current = count
    if (suppressNextCountCelebration.current) {
      suppressNextCountCelebration.current = false
      setNewestStamp(null)
      return
    }
    if (previous === null || count <= previous) { setNewestStamp(null); return }
    const complete = count >= limit
    setNewestStamp({ index: complete ? limit - 1 : count - 1, id: Date.now() })
    const celebrationId = Date.now()
    setVictoryDishes(complete ? shuffledVictoryDishes() : [])
    setCelebration({ stamp: complete ? limit : count, complete, id: celebrationId })
    if (complete && customerSupabase) {
      void customerSupabase.rpc('fn_claim_customer_loyalty_celebration')
    }
  }, [profile])

  useEffect(() => {
    if (!celebration) return
    const timer = window.setTimeout(closeCelebration, celebration.complete ? 4300 : 3000)
    return () => window.clearTimeout(timer)
  }, [celebration, closeCelebration])

  const chooseMode = (nextMode: 'login' | 'register') => {
    if (nextMode === mode) return
    setMode(nextMode)
    setError('')
    setShowPassword(false)
    setHasSwitchedMode(true)
    try { window.localStorage.setItem(AUTH_MODE_KEY, nextMode) } catch { /* el formulario sigue funcionando sin almacenamiento */ }
  }

  const loadProfile = useCallback(async () => {
    if (!customerSupabase) { setProfile(null); setRecentVisits([]); setSessionActive(false); setProfileLoading(false); setProfileLoadError(''); setAuthReady(true); return }
    const { data: sessionData } = await customerSupabase.auth.getSession()
    if (!sessionData.session) { setProfile(null); setRecentVisits([]); setSessionActive(false); setProfileLoading(false); setProfileLoadError(''); setAuthReady(true); return }
    setSessionActive(true)
    setProfileLoading(true)
    setProfileLoadError('')
    setAuthReady(true)
    const [{ data, error: profileError }, orderProfile] = await Promise.all([
      customerSupabase.rpc('fn_get_customer_loyalty_profile', { p_page: page, p_page_size: pageSize }),
      getCustomerOrderProfile().catch(() => null),
    ])
    if (profileError || !data) {
      setProfile(null)
      setProfileLoadError('Tu sesión se inició, pero no pudimos abrir tu perfil. Intenta de nuevo.')
      setProfileLoading(false)
      return
    }
    const loyaltyProfile = data as LoyaltyProfile
    const { data: pendingData } = await customerSupabase.rpc('fn_claim_customer_loyalty_celebration')
    const pendingCelebration = pendingData as PendingCelebration | null
    if (pendingCelebration?.pending) suppressNextCountCelebration.current = true
    setProfile({
      ...loyaltyProfile,
      customer: {
        ...loyaltyProfile.customer,
        identification: orderProfile?.identification || loyaltyProfile.customer.identification || '',
      },
    })
    if (pendingCelebration?.pending) {
      const limit = Math.max(1, Number(loyaltyProfile.visits_per_reward) || 10)
      setNewestStamp(null)
      setVictoryDishes(shuffledVictoryDishes())
      setCelebration({
        stamp: Number(pendingCelebration.stamp) || limit,
        complete: true,
        id: Date.now(),
        rewardDescription: pendingCelebration.reward_description,
      })
    }
    if (page === 0) setRecentVisits((data as LoyaltyProfile).visits ?? [])
    setProfileLoading(false)
    setAuthReady(true)
  }, [page])

  const failProfileLoad = useCallback((keepSession = false) => {
    setProfile(null)
    setProfileLoading(false)
    setProfileLoadError('Tu sesión se inició, pero no pudimos abrir tu perfil. Intenta de nuevo.')
    if (keepSession) setSessionActive(true)
    setAuthReady(true)
  }, [])

  useEffect(() => {
    void loadProfile().catch(() => failProfileLoad())
      .finally(() => setInitialAuthCheck(false))
    if (!customerSupabase) return
    const { data } = customerSupabase.auth.onAuthStateChange((_event, session) => {
      if (session) window.setTimeout(() => { void loadProfile().catch(() => failProfileLoad(true)) }, 0)
      else window.setTimeout(() => { setProfile(null); setRecentVisits([]); setSessionActive(false); setProfileLoading(false); setProfileLoadError(''); setAuthReady(true) }, 0)
    })
    return () => data.subscription.unsubscribe()
  }, [failProfileLoad, loadProfile])

  useEffect(() => {
    if (!authReady || profile || !showWelcomeIntro) return
    const timer = window.setTimeout(() => setShowWelcomeIntro(false), 3600)
    return () => window.clearTimeout(timer)
  }, [authReady, profile, showWelcomeIntro])

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (mode === 'register') {
      const identificationDigits = identification.replace(/\D/g, '')
      if (identificationDigits.length < 6 || identificationDigits.length > 10) {
        setError('La cédula debe tener entre 6 y 10 dígitos.')
        setNotice('')
        return
      }
    }
    setBusy(true); setError(''); setNotice('')
    let sessionEstablished = false
    try {
      if (!customerSupabase) throw new Error('El perfil no está disponible ahora. Intenta más tarde.')
      const body = mode === 'login'
        ? { action: 'login', identifier: identifier.trim(), password }
        : { action: 'register', first_name: firstName.trim(), last_name: lastName.trim(), identification: identification.trim(), phone: phone.trim(), email: email.trim() || null, password }
      const { data, error: authError } = await customerSupabase.functions.invoke('customer-auth', { body })
      if (authError) {
        setError(await customerAuthErrorMessage(authError, data))
        return
      }
      if (mode === 'register') {
        setNotice('¡Cuenta creada! Tu tarjeta comienza desde cero y sumará visitas en las comandas que pagues después de registrarte.')
        chooseMode('login')
      } else {
        const { error: sessionError } = await customerSupabase.auth.setSession({ access_token: data.access_token, refresh_token: data.refresh_token })
        if (sessionError) throw sessionError
        sessionEstablished = true
        await loadProfile()
      }
    } catch (cause) {
      setProfileLoading(false)
      if (sessionEstablished) failProfileLoad(true)
      else {
        const message = cause instanceof Error ? cause.message : ''
        setError(message === 'El perfil no está disponible ahora. Intenta más tarde.'
          ? message
          : await customerAuthErrorMessage(cause))
      }
    } finally { setBusy(false) }
  }

  const logout = async () => { await customerSupabase?.auth.signOut(); setProfile(null); setShowHistory(false); setNotice('') }

  if (initialAuthCheck) return <PublicMenuSkeleton />

  if (!profile && sessionActive && profileLoading) return <PublicMenuSkeleton />

  if (!profile && sessionActive && profileLoadError) return <main className="customer-profile-page customer-profile-auth customer-profile-auth-login">
    <section className="customer-profile-shell">
      <header className="customer-profile-brand"><h1>No pudimos abrir tu perfil</h1><span>Tu sesión sigue activa. Prueba cargarlo otra vez.</span></header>
      <div className="customer-profile-form-wrap"><p className="customer-profile-message error" role="alert">{profileLoadError}</p><button type="button" className="customer-profile-submit" onClick={() => { void loadProfile().catch(() => failProfileLoad(true)) }}>Reintentar</button></div>
    </section>
  </main>

  if (presentation === 'promotion' || presentation === 'recommended') return <main className={`customer-loyalty-promotion${presentation === 'recommended' ? ' customer-loyalty-promotion--recommended' : ''}`} aria-labelledby="customer-loyalty-promotion-title">
    <div className="customer-loyalty-promotion-glow" aria-hidden="true" />
    <div className="customer-loyalty-promotion-copy">
      <span className="customer-loyalty-promotion-kicker"><i /> PROGRAMA DE FIDELIDAD</span>
      <h2 id="customer-loyalty-promotion-title">Cada visita te acerca a <em>un premio</em></h2>
      <p>Por cada visita sumas un sello. Completa los 10 y disfruta tu recompensa Full China.</p>
      <div className="customer-loyalty-promotion-progress" aria-label="Tarjeta de diez sellos">
        {Array.from({ length: 10 }, (_, index) => <span key={index} className={index < 6 ? 'is-earned' : ''}><img src="/icons/wok-mark.png" alt="" /></span>)}
        <small>10 visitas · 1 premio</small>
      </div>
      <button type="button" className="customer-loyalty-promotion-cta" onClick={onJoin}>Únete al programa <ArrowRight size={17} /></button>
    </div>
    <div className="customer-loyalty-promotion-card-wrap" aria-hidden="true">
      <article className="customer-profile-welcome-card customer-loyalty-promotion-card">
        <div className="customer-profile-welcome-card-top"><img src="/optimized/root/logo.webp" alt="" /><span>MEMBER<br />CARD</span></div>
        <div className="customer-profile-welcome-card-copy"><small>FULL CHINA · FIDELIDAD</small><strong>TU TARJETA<br /><em>DE VISITAS</em></strong></div>
        <div className="customer-profile-welcome-stamps">{Array.from({ length: 10 }, (_, index) => <span key={index}><img src="/icons/wok-mark.png" alt="" /></span>)}</div>
      </article>
    </div>
  </main>

  if (!profile && showWelcomeIntro) return <main className="customer-profile-page customer-profile-auth customer-profile-auth-login customer-profile-welcome-intro">
    <div className="customer-profile-welcome-embers" aria-hidden="true"><i /><i /><i /><i /><i /><i /><i /></div>
    <section className="customer-profile-welcome-content" aria-label="Bienvenida a Full China">
      <p className="customer-profile-welcome-kicker"><span /> PROGRAMA DE LEALTAD <span /></p>
      <p className="customer-profile-welcome-sr-only" role="status">Bienvenido a Full China. Cada visita suma un sello y te acerca al premio.</p>
      <div className="customer-profile-welcome-motion-stage" aria-hidden="true">
        <div className="customer-profile-welcome-kinetic-type">
          <span className="customer-welcome-type-visit">CADA VISITA</span>
          <span className="customer-welcome-type-suma">SUMA</span>
          <span className="customer-welcome-type-sello">CADA SELLO, MÁS CERCA DEL</span>
          <span className="customer-welcome-type-premio">PREMIO</span>
        </div>
        <article className="customer-profile-welcome-card">
          <div className="customer-profile-welcome-card-top"><img src="/optimized/root/logo.webp" alt="" /><span>MEMBER<br />CARD</span></div>
          <div className="customer-profile-welcome-card-copy"><small>FULL CHINA · FIDELIDAD</small><strong>TU TARJETA<br /><em>DE VISITAS</em></strong></div>
          <div className="customer-profile-welcome-stamps">{Array.from({ length: 10 }, (_, index) => <span key={index}><img src="/icons/wok-mark.png" alt="" /></span>)}</div>
        </article>
      </div>
      <div className="customer-profile-welcome-progress" aria-hidden="true"><span /></div>
      <button type="button" className="customer-profile-welcome-skip" onClick={() => setShowWelcomeIntro(false)}>Continuar al login <ArrowRight size={15} /></button>
    </section>
  </main>

  if (!profile) return <main className={`customer-profile-page customer-profile-auth customer-profile-auth-${mode} customer-profile-auth-transition${hasSwitchedMode ? ` customer-profile-mode-changed customer-profile-mode-changed-${mode}` : ''}`}>
    {error && <Toast type="error" title={mode === 'login' && /acceso|coinciden/i.test(error) ? 'No pudimos iniciar sesión' : undefined} message={mode === 'login' && /acceso|coinciden/i.test(error) ? 'Revisa tus datos e inténtalo de nuevo.' : error} onClose={() => setError('')} duration={4500} />}
    {notice && <Toast type="success" message={notice} onClose={() => setNotice('')} duration={4500} />}
    <aside className="customer-profile-desktop-story">
      <span className="customer-profile-desktop-eyebrow"><i /> PROGRAMA DE LEALTAD</span>
      <h1>{mode === 'login' ? <>Inicia <em>sesión</em></> : <>Crea tu <em>cuenta</em></>}</h1>
      <p>{mode === 'login' ? 'Accede a tu cuenta y sigue acumulando visitas para canjear premios, descuentos y sorpresas.' : 'Regístrate y acumula visitas para ganar premios y descuentos.'}</p>
      <section className="customer-profile-desktop-benefits">
        {mode === 'register' && <h2>BENEFICIOS</h2>}
        <div className="customer-profile-desktop-benefit-list">
          <span><Utensils /><b>Acumula<br />visitas</b></span><i />
          <span><Gift /><b>Canjea<br />premios</b></span><i />
          <span><Tag /><b>Descuentos<br />exclusivos</b></span>
        </div>
      </section>
    </aside>
    <section className="customer-profile-shell">
      <div className="customer-profile-brand"><img className="customer-profile-mobile-logo" src="/optimized/root/logo.webp" alt="Full China" /><span className="customer-profile-brand-icon"><Award /></span><p>FULL CHINA</p><h1 className="customer-profile-mobile-heading">{mode === 'login' ? <>Inicia <em>sesión</em></> : <>Crea tu <em>cuenta</em></>}</h1><h1 className="customer-profile-desktop-heading">Mi perfil</h1><span className="customer-profile-mobile-description">{mode === 'login' ? 'Visitas y premios en cada pedido.' : 'Cada pedido te acerca a un premio.'}</span><span className="customer-profile-desktop-description">Tu tarjeta de fidelidad, siempre contigo.</span>
        {mode === 'register' && <div className="customer-profile-benefits"><span><Utensils /><b>Visitas</b></span><i /><span><Gift /><b>Premios</b></span><i /><span><Tag /><b>Descuentos</b></span></div>}
      </div>
      <div className="customer-profile-form-wrap">
        <header className="customer-profile-desktop-card-header"><img src="/optimized/root/logo.webp" alt="Full China" /><h2>{mode === 'login' ? 'Bienvenido de nuevo' : 'Únete a Full China'}</h2><p>{mode === 'login' ? 'Ingresa a tu cuenta de Full China.' : 'Crea tu cuenta y empieza a sumar beneficios.'}</p></header>
        <div className="customer-profile-toggle"><button className={mode === 'login' ? 'active' : ''} onClick={() => chooseMode('login')}>Iniciar sesión</button><button className={mode === 'register' ? 'active' : ''} onClick={() => chooseMode('register')}>Crear cuenta</button></div>
        <form className="customer-profile-form" onSubmit={submit}>
          {mode === 'register' ? <>
            <div className="customer-profile-two customer-profile-desktop-name-fields"><label>Nombre<input required autoComplete="given-name" value={firstName} onChange={e => setFirstName(e.target.value)} /></label><label>Apellido<input required autoComplete="family-name" value={lastName} onChange={e => setLastName(e.target.value)} /></label></div>
            <label className="customer-profile-mobile-name-field">Nombre y apellido<input required autoComplete="name" value={firstName && lastName ? `${firstName} ${lastName}` : firstName || lastName} onChange={e => { const [first, ...rest] = e.target.value.trim().split(/\s+/); setFirstName(first || ''); setLastName(rest.join(' ')) }} /></label>
            <label>Cédula<input required autoComplete="off" value={identification} onChange={e => setIdentification(e.target.value)} placeholder="V-12345678" /></label>
            <label>Teléfono<input required autoComplete="tel" value={phone} onChange={e => setPhone(e.target.value)} /></label>
            <label className="customer-profile-email-field"><span className="customer-profile-email-label">Correo <small>(opcional)</small></span><input type="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} /></label>
          </> : <label>Cédula, teléfono o correo<input required autoComplete="username" value={identifier} onChange={e => setIdentifier(e.target.value)} /></label>}
          <div className="customer-profile-password-field"><label htmlFor="customer-profile-password">Contraseña</label><div className="customer-profile-password-control"><input id="customer-profile-password" required type={showPassword ? 'text' : 'password'} minLength={8} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} value={password} onChange={e => setPassword(e.target.value)} /><button type="button" className="customer-profile-password-toggle" onClick={() => setShowPassword(visible => !visible)} aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'} aria-pressed={showPassword}>{showPassword ? <EyeOff size={19} /> : <Eye size={19} />}</button></div></div>
          <button className={`customer-profile-submit${mode === 'login' ? ' customer-profile-submit-login' : ''}`} disabled={busy}>{busy ? <LoaderCircle className="spin" /> : mode === 'login' ? null : null}{mode === 'login' ? 'Entrar' : 'Crear cuenta'}<ArrowRight /></button>
          {mode === 'register' && <button type="button" className="customer-profile-existing" onClick={() => chooseMode('login')}>Ya tengo cuenta</button>}
        </form>
        <p className="customer-profile-desktop-switch">{mode === 'login' ? '¿Aún no tienes cuenta?' : '¿Ya tienes cuenta?'} <button type="button" onClick={() => chooseMode(mode === 'login' ? 'register' : 'login')}>{mode === 'login' ? 'Regístrate' : 'Inicia sesión'}</button></p>
      </div>
    </section>
  </main>

  if (showHistory) return <CustomerVisitHistory visits={profile.visits ?? []} page={page} hasMore={profile.has_more} onPage={setPage} onBack={() => setShowHistory(false)} onRepeatOrder={onRepeatOrder} />
  const availableRewards = profile.available_rewards ?? []
  const redeemedRewards = profile.redeemed_rewards ?? []
  const stamps = availableRewards.length ? threshold : profile.current_cycle_visits ?? profile.total_visits % threshold
  const displayedRewards = availableRewards.length
  return <main className="customer-profile-page customer-profile-member"><section className="customer-profile-dashboard">
    {celebration && createPortal(<div className="customer-celebration-backdrop" onClick={closeCelebration}><div ref={celebrationDialog} className={`customer-stamp-celebration${celebration.complete ? ' is-complete' : ''}`} role="dialog" aria-modal="true" aria-labelledby="customer-celebration-title" onClick={event => event.stopPropagation()}>
      <button ref={celebrationClose} type="button" className="customer-celebration-close" aria-label="Cerrar celebración" onClick={closeCelebration}>×</button>
      <div key={celebration.id} className="customer-celebration-confetti" aria-hidden="true">{Array.from({ length: 36 }, (_, i) => <i key={i} style={{ '--piece-x': `${(i * 37) % 100}%`, '--piece-delay': `${(i % 9) * (celebration.complete ? .02 : .12)}s`, '--piece-turn': `${i * 47}deg`, '--piece-drift': `${(i % 2 ? 1 : -1) * (20 + i % 5 * 13)}px`, '--piece-color': ['#ff3851', '#ffd269', '#ff9850'][i % 3] } as CSSProperties} />)}</div>
      <div className="customer-celebration-halo" aria-hidden="true" />
      <div className="customer-celebration-sparks" aria-hidden="true">{Array.from({ length: 12 }, (_, i) => <i key={i} style={{ transform: `rotate(${i * 30}deg)` }} />)}</div>
      {celebration.complete && <div className="customer-victory-rays" aria-hidden="true" />}
      {celebration.complete && <div className="customer-victory-impact" aria-hidden="true" />}
      {celebration.complete && <div className="customer-victory-food-showcase" aria-hidden="true">{victoryDishes.map((image, index) => <figure key={`${celebration.id}-${image}`} style={{ '--dish-index': index } as CSSProperties}><img src={image} alt="" decoding="async" /></figure>)}</div>}
      <div key={`${celebration.id}-medal`} className="customer-celebration-medal"><img src={celebration.complete ? '/optimized/customer-profile/victory-trophy.webp' : '/icons/wok-mark.png'} alt="" /></div>
      <small>{celebration.complete ? 'TARJETA COMPLETA' : `SELLO ${celebration.stamp} · FULL CHINA`}</small>
      <strong id="customer-celebration-title">{celebration.complete ? '¡El premio es tuyo!' : celebration.stamp === 1 ? '¡Tu historia empieza con sabor!' : celebration.stamp === threshold - 1 ? '¡A un sello de saborearlo!' : celebration.stamp === Math.ceil(threshold / 2) ? '¡Mitad del camino, doble emoción!' : ['¡Otro momento para celebrar!', '¡El sabor de volver!', '¡Tu próxima alegría está más cerca!'][celebration.stamp % 3]}</strong>
      <p>{celebration.complete ? 'Tu recompensa ya está disponible.' : 'Una visita más. Un paso más hacia tu premio.'}</p>
      {celebration.complete && <div className="customer-victory-prize"><div className="customer-victory-prize-emblem"><Gift size={23} /></div><div className="customer-victory-prize-copy"><small>PREMIO DESBLOQUEADO</small><b>{celebration.rewardDescription ?? availableRewards[0]?.reward_description ?? profile.next_reward_description ?? profile.reward_description}</b><span>¡Completaste tu tarjeta!</span></div><div className="customer-victory-prize-seal"><span>FULL CHINA</span><strong>{threshold}/{threshold}</strong><small>SELLOS</small></div><i className="customer-victory-prize-shine" aria-hidden="true" /></div>}
    </div></div>, document.body)}
    <header className="customer-profile-welcome"><div><img className="customer-member-logo" src="/optimized/root/logo.webp" alt="Full China" /><span>MI PERFIL</span><h1>¡Hola, <em>{profile.customer.first_name || profile.customer.full_name.split(' ')[0]}</em><span className="customer-profile-greeting-mark">!</span></h1><p>Qué bueno tenerte de vuelta.</p></div><button onClick={() => void logout()}><LogOut size={16} /> Salir</button></header>
    <article className="customer-loyalty-card">
      <div className="customer-loyalty-head"><div><span>Tarjeta de Fidelidad</span><h2>{profile.customer.full_name}</h2><div className="customer-loyalty-personal-details"><small><b>Teléfono</b> · {profile.customer.phone}</small>{profile.customer.identification && <small><b>Cédula</b> · {profile.customer.identification}</small>}</div></div><button ref={memberCardElement} type="button" className={`customer-member-physical-card customer-member-mini-card${memberCardAnimating ? ' is-spinning' : ''}`} aria-label="Girar tarjeta de fidelidad en 3D" title="Mueve el puntero o toca para girar la tarjeta" disabled={memberCardAnimating} onPointerDown={handleMemberCardPointerDown} onPointerMove={handleMemberCardPointerMove} onPointerLeave={resetMemberCardTilt} onPointerUp={resetMemberCardTilt} onPointerCancel={resetMemberCardTilt} onClick={activateMemberCard} onAnimationEnd={() => setMemberCardAnimating(false)}><span className="customer-member-mini-top"><img src="/optimized/root/logo.webp" alt="" decoding="async" /><span>MEMBER<br />CARD</span></span><span className="customer-member-mini-copy"><small>FULL CHINA · FIDELIDAD</small><strong>TU TARJETA<br /><em>DE VISITAS</em></strong></span></button></div>
      <div className="customer-loyalty-progress"><span>Sellos de visita</span><strong>{stamps} / {threshold}</strong></div>
      <div className="customer-loyalty-bar"><span style={{ width: `${(stamps / threshold) * 100}%` }} /></div>
      <div className="customer-loyalty-stamps">{Array.from({ length: threshold }, (_, i) => <span className={`${i < stamps ? 'earned' : ''}${i === threshold - 1 && i < stamps ? ' customer-stamp-winner' : ''}${!celebration && i < stamps && newestStamp?.index === i ? ' customer-stamp-new' : ''}`} key={newestStamp?.index === i ? `${i}-${newestStamp.id}` : i}><img src="/icons/wok-mark.png" alt={i < stamps ? "Visita obtenida" : "Visita pendiente"} decoding="async" /><small>{i + 1}</small></span>)}</div>
      <CustomerRewardJourney stamps={stamps} threshold={threshold} rewards={displayedRewards} arrival={rewardArrival} description={availableRewards[0]?.reward_description ?? profile.next_reward_description ?? profile.reward_description} />
    </article>
    {redeemedRewards.length ? <details className="customer-redeemed-history">
      <summary><span><Gift size={17} /> Premios canjeados</span><b>{redeemedRewards.length}</b></summary>
      <div className="customer-redeemed-list">{redeemedRewards.map(reward => <article className="customer-redeemed-item" key={reward.id} aria-label={`${reward.reward_description}, canjeado el ${new Date(reward.redeemed_at ?? reward.unlocked_at).toLocaleDateString('es-VE')}`}><span className="customer-redeemed-icon"><Gift size={20} /></span><span className="customer-redeemed-copy"><small>PREMIO CANJEADO</small><strong>{reward.reward_description}</strong><span>Tarjeta {reward.cycle_number} · {new Date(reward.redeemed_at ?? reward.unlocked_at).toLocaleDateString('es-VE', { day: 'numeric', month: 'long', year: 'numeric' })}</span></span><span className="customer-redeemed-seals"><small>FULL CHINA</small><strong>{threshold}/{threshold}</strong><span>SELLOS</span></span></article>)}</div>
    </details> : <section className="customer-redeemed-history customer-redeemed-history-empty" aria-labelledby="customer-redeemed-empty-title">
      <div className="customer-redeemed-empty-head"><span><Gift size={17} /> Premios canjeados</span><b>0</b></div>
      <div className="customer-redeemed-empty-content"><span><History size={17} /></span><p><strong id="customer-redeemed-empty-title">Aún no has canjeado premios</strong><small>Cuando entregues tu recompensa, aparecerá aquí.</small></p></div>
    </section>}
    <CustomerRecentOrders visits={recentVisits} onRepeatOrder={onRepeatOrder} />
    <aside className="customer-profile-tools desktop-only" aria-label="Historial de visitas"><CustomerDesktopVisitHistory visits={profile.visits ?? []} onRepeatOrder={onRepeatOrder} /></aside>
    <button className="customer-profile-history-button" onClick={() => { setCelebration(null); setShowHistory(true) }}><History size={18} /> <span><strong>{showHistory ? 'Ocultar historial' : 'Historial de visitas'}</strong><small>Revisa todas tus visitas y avances.</small></span><ChevronRight className={showHistory ? 'rotated' : ''} size={17} /></button>

  </section></main>
}
