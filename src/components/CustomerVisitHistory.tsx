import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { ChevronLeft, ChevronRight, Check, ShoppingBag, ReceiptText, ArrowRight, LoaderCircle, RotateCw } from 'lucide-react'
import { getCustomerOrderForRepeat, type CustomerRepeatOrder } from '../lib/publicOrders'

type Visit = { order_id: string; order_number: string; visited_at: string }
type Props = { visits: Visit[]; page: number; hasMore: boolean; onPage: (page: number) => void; onBack: () => void; onRepeatOrder?: (order: CustomerRepeatOrder) => Promise<void> }

export default function CustomerVisitHistory({ visits, page, hasMore, onPage, onBack, onRepeatOrder }: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [isLeaving, setIsLeaving] = useState(false)
  const [repeatingOrderId, setRepeatingOrderId] = useState<string | null>(null)
  const [repeatOrderError, setRepeatOrderError] = useState('')
  const exitTimer = useRef<number | null>(null)
  const visibleVisits = visits
  const selected = visibleVisits.find(visit => visit.order_id === selectedId) ?? visibleVisits[0]
  const heading = useRef<HTMLHeadingElement>(null)
  useEffect(() => {
    const title = heading.current
    let container = title?.parentElement
    while (container) {
      if (container.scrollHeight > container.clientHeight && /auto|scroll/.test(window.getComputedStyle(container).overflowY)) {
        container.scrollTo({ top: 0, behavior: 'instant' })
      }
      container = container.parentElement
    }
    window.scrollTo({ top: 0, behavior: 'instant' })
    title?.focus({ preventScroll: true })
  }, [])
  useEffect(() => () => { if (exitTimer.current !== null) window.clearTimeout(exitTimer.current) }, [])
  const closeHistory = () => {
    if (isLeaving) return
    setIsLeaving(true)
    exitTimer.current = window.setTimeout(onBack, 460)
  }
  const repeatOrder = async (orderId: string) => {
    if (!onRepeatOrder || repeatingOrderId) return
    setRepeatingOrderId(orderId)
    setRepeatOrderError('')
    try {
      const order = await getCustomerOrderForRepeat(orderId)
      await onRepeatOrder(order)
    }
    catch (cause) { setRepeatOrderError(cause instanceof Error ? cause.message : 'No pudimos preparar este pedido. Inténtalo otra vez.') }
    finally { setRepeatingOrderId(null) }
  }
  const date = selected ? new Date(selected.visited_at) : null
  return <main className={`customer-profile-page customer-profile-member customer-visit-history${isLeaving ? ' is-leaving' : ''}`}>
    <div className="customer-history-scene" aria-hidden="true" />
    <div className="customer-history-layout">
      <header className="customer-history-heading"><button type="button" onClick={closeHistory} aria-label="Volver a mi perfil"><ChevronLeft size={26} /></button><div><h1 ref={heading} tabIndex={-1}>Historial de visitas</h1><p>Revisa todas tus visitas y avances.</p></div></header>
      {visibleVisits.length > 0 ? <>
        <nav className="customer-history-dates" aria-label="Seleccionar visita">{visibleVisits.map((visit, index) => {
          const visitDate = new Date(visit.visited_at)
          const active = visit.order_id === selected?.order_id
          return <button key={visit.order_id} style={{ '--history-order': index } as CSSProperties} type="button" className={active ? 'is-selected' : ''} aria-pressed={active} onClick={() => { setSelectedId(visit.order_id); setRepeatOrderError('') }} aria-label={`Visita del ${visitDate.toLocaleDateString('es-VE')} · Comanda ${visit.order_number}`}><span>{visitDate.toLocaleDateString('es-VE', { weekday: 'short' }).replace('.', '')}</span><strong>{visitDate.toLocaleDateString('es-VE', { day: 'numeric', month: 'short' }).replace('.', '')}</strong>{active && <Check size={14} />}</button>
        })}</nav>
        {selected && date && <article className="customer-history-detail" key={selected.order_id}>
          <header className="customer-history-visit-heading"><div className="customer-history-seal"><img src="/icons/wok-mark.png" alt="" /></div><div><h2>{date.toLocaleDateString('es-VE', { weekday: 'long', day: 'numeric', month: 'long' })}</h2><p>Visita registrada <span>+1 sello</span></p></div><div className="customer-history-order"><time dateTime={selected.visited_at}>{date.toLocaleTimeString('es-VE', { hour: 'numeric', minute: '2-digit' })}</time><span>#{selected.order_number}</span></div></header>
          <section className="customer-history-order-panel"><h3><ShoppingBag size={22} /> Tu pedido</h3><div className="customer-history-unavailable"><ReceiptText size={32} /><strong>Comanda {selected.order_number}</strong><p>Puedes intentar volver a pedir esta comanda.</p><small>Revisaremos los productos, las opciones y los precios actuales antes de cargar el carrito.</small></div></section>
          <div className="customer-history-confirmed"><Check size={17} /><span>Esta visita sumó un sello a tu progreso.</span></div>
          <div className="customer-history-repeat-order"><button type="button" className="customer-repeat-order-button" disabled={!onRepeatOrder || repeatingOrderId !== null} onClick={() => void repeatOrder(selected.order_id)}>{repeatingOrderId === selected.order_id ? <LoaderCircle size={17} className="customer-repeat-order-spinner" /> : <RotateCw size={17} />}<span>{repeatingOrderId === selected.order_id ? 'Preparando pedido…' : 'Volver a pedir'}</span></button>{repeatOrderError && <p className="customer-repeat-order-error" role="alert">{repeatOrderError}</p>}</div>
        </article>}
      </> : <section className="customer-history-empty customer-history-first-chapter">
        <div className="customer-history-empty-art" aria-hidden="true"><img src="/optimized/customer-profile/reward-rice.webp" alt="" loading="lazy" decoding="async" /></div>
        <div className="customer-history-empty-copy"><h2>{page === 0 ? 'Aún no tienes visitas' : 'No hay visitas en esta página'}</h2><p>{page === 0 ? 'Cuando hagas tu primer pedido y se registre tu visita, aparecerá aquí junto con el sello que sumaste.' : 'Vuelve a la página anterior para consultar tus visitas.'}</p></div>
        <div className="customer-history-empty-actions"><button className="customer-history-empty-action" type="button" onClick={page === 0 ? closeHistory : () => onPage(page - 1)}>{page === 0 ? 'Ver mi tarjeta' : 'Página anterior'}<ArrowRight size={16} /></button></div>
      </section>}
      {(visibleVisits.length > 0 || page > 0 || hasMore) && <footer className="customer-history-pagination"><button type="button" disabled={page <= 0} onClick={() => onPage(page - 1)} aria-label="Página anterior"><ChevronLeft size={18} /></button><span>Página {page + 1}</span><button type="button" disabled={!hasMore} onClick={() => onPage(page + 1)} aria-label="Página siguiente"><ChevronRight size={18} /></button></footer>}
    </div>
  </main>
}
