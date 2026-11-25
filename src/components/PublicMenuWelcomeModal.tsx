import { useEffect, useRef, useState, type CSSProperties, type Ref } from 'react'
import { startWelcomeScene } from '../pedir-v2/welcomeScene'
import { ChevronRight } from 'lucide-react'
import { markPublicMenuWelcomeDismissedForCurrentLoad, shouldShowPublicMenuWelcome } from '../lib/publicMenuWelcome'
import './PublicMenuWelcomeModal.css'

interface PublicMenuWelcomeModalProps {
  dontShowAgain: boolean
  onDontShowAgainChange: (checked: boolean) => void
  onContinue: () => void
  buttonRef?: Ref<HTMLButtonElement>
  closing?: boolean
  loading?: boolean
  showDismissChoice?: boolean
}

export function PublicMenuWelcomeModal({
  dontShowAgain,
  onDontShowAgainChange,
  onContinue,
  buttonRef,
  closing = false,
  loading = false,
  showDismissChoice = true,
}: PublicMenuWelcomeModalProps) {
  const sceneRef = useRef<HTMLDivElement>(null)
  useEffect(() => startWelcomeScene(sceneRef.current), [])
  return (
    <div ref={sceneRef} className={`public-welcome-backdrop${closing ? ' is-closing' : ''}`}>
      <section className="public-welcome-dialog" role="dialog" aria-modal="true" aria-labelledby="public-welcome-title" aria-describedby="public-welcome-copy">
        <div className="pd-boom" data-welcome-scene aria-hidden="true"><i className="pd-boom-glow"></i><i className="pd-boom-ring"></i><span className="pd-boom-dish" style={{ '--x': '13%', '--y': '20%', '--w': '11%', '--r': '-24deg', '--z': 0.35, '--i': 0, zIndex: 1 } as CSSProperties}><span><b><img src="/optimized/pedir-v2/platos/719e1857.webp" alt="" draggable={false} /></b></span></span><span className="pd-boom-dish" style={{ '--x': '84%', '--y': '15%', '--w': '27%', '--r': '16deg', '--z': 0.4, '--i': 1, zIndex: 1 } as CSSProperties}><span><b><img src="/optimized/pedir-v2/platos/d82a1cdc.webp" alt="" draggable={false} /></b></span></span><span className="pd-boom-dish" style={{ '--x': '48%', '--y': '12%', '--w': '37%', '--r': '-4deg', '--z': 0.5, '--i': 2, zIndex: 1 } as CSSProperties}><span><b><img src="/optimized/pedir-v2/platos/41db2c04.webp" alt="" draggable={false} /></b></span></span><span className="pd-boom-dish" style={{ '--x': '22%', '--y': '40%', '--w': '44%', '--r': '-14deg', '--z': 0.8, '--i': 3, zIndex: 1 } as CSSProperties}><span><b><img src="/optimized/pedir-v2/platos/6472a0b8.webp" alt="" draggable={false} /></b></span></span><span className="pd-boom-dish" style={{ '--x': '82%', '--y': '41%', '--w': '36%', '--r': '12deg', '--z': 0.85, '--i': 4, zIndex: 1 } as CSSProperties}><span><b><img src="/optimized/pedir-v2/platos/b8e60734.webp" alt="" draggable={false} /></b></span></span><span className="pd-boom-dish" style={{ '--x': '51%', '--y': '36%', '--w': '50%', '--r': '-6deg', '--z': 1.1, '--i': 5, zIndex: 3 } as CSSProperties}><span><b><img src="/optimized/pedir-v2/platos/a6d1d84a.webp" alt="" draggable={false} /></b></span></span><span className="pd-boom-dish" style={{ '--x': '15%', '--y': '66%', '--w': '30%', '--r': '10deg', '--z': 1.4, '--i': 6, zIndex: 3 } as CSSProperties}><span><b><img src="/optimized/pedir-v2/platos/a79e9da6.webp" alt="" draggable={false} /></b></span></span><span className="pd-boom-dish" style={{ '--x': '85%', '--y': '66%', '--w': '36%', '--r': '-12deg', '--z': 1.3, '--i': 7, zIndex: 3 } as CSSProperties}><span><b><img src="/optimized/pedir-v2/platos/b65fdd1e.webp" alt="" draggable={false} /></b></span></span><span className="pd-boom-box"><img src="/optimized/pedir-v2/caja.webp" alt="" /></span><span className="pd-boom-bits">{Array.from({ length: 16 }, (_, i) => <i key={i} />)}</span></div>
        <div className="public-welcome-brand"><img src="/optimized/root/logo-welcome.webp" alt="Full China" width="192" height="84" /></div>
        <div className="public-welcome-menu-heading">
          <h2 id="public-welcome-title">Que empiece el <em>banquete</em></h2>
          <p id="public-welcome-copy">Arma tu pedido aquí. <strong>No pagas en esta página:</strong> te escribimos por WhatsApp para confirmarlo y coordinar el pago.</p>
        </div>
        <div className="public-welcome-menu-list" aria-label="Pasos para hacer tu pedido"><div className="public-welcome-menu-item"><i aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 11h18a9 9 0 0 1-6 8.5V21H9v-1.5A9 9 0 0 1 3 11Z"/><path d="m13 8 6-6M16 9l5-5"/></svg></i><strong>Elige</strong><small>Elige tus platos y agrégalos al carrito.</small></div><div className="public-welcome-menu-item"><i aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></svg></i><strong>Tus datos</strong><small>Completa tus datos y revisa tu pedido.</small></div><div className="public-welcome-menu-item"><i aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 11.5a8.5 8.5 0 0 1-12.6 7.4L3 21l2.1-5.4A8.5 8.5 0 1 1 21 11.5Z"/><path d="m8.5 12 2.5 2.5 4.5-5"/></svg></i><strong>WhatsApp</strong><small>Confirmamos tu pedido y coordinamos el pago contigo.</small></div></div>
        {showDismissChoice && <label className="public-welcome-dismiss-choice">
          <input type="checkbox" checked={dontShowAgain} onChange={event => onDontShowAgainChange(event.target.checked)} />
          <span>No volver a mostrar este mensaje</span>
        </label>}
        <button ref={buttonRef} type="button" className="public-welcome-confirm" onClick={onContinue} disabled={loading} aria-busy={loading}>
          {loading ? 'Abriendo la carta…' : <>Abrir la carta <ChevronRight size={19} /></>}
        </button>
      </section>
      <div className="pd-curtain pd-curtain--welcome" aria-hidden="true"><img src="/optimized/root/logo-welcome.webp" alt="" /><span>Prendiendo el fuego…</span></div>
    </div>
  )
}

/** Muestra la bienvenida útil mientras carga el módulo de la carta. */
export function PublicMenuWelcomeFallback({ onContinue, loading = false }: { onContinue?: (dontShowAgain: boolean) => void; loading?: boolean }) {
  const [dontShowAgain, setDontShowAgain] = useState(false)
  if (!loading && !shouldShowPublicMenuWelcome()) return null

  return (
    <PublicMenuWelcomeModal
      dontShowAgain={dontShowAgain}
      onDontShowAgainChange={setDontShowAgain}
      onContinue={() => {
        if (loading) return
        markPublicMenuWelcomeDismissedForCurrentLoad(dontShowAgain)
        onContinue?.(dontShowAgain)
      }}
      loading={loading}
      showDismissChoice={!loading}
    />
  )
}
