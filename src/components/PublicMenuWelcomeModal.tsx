import { useState, type Ref } from 'react'
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
  return (
    <div className={`public-welcome-backdrop${closing ? ' is-closing' : ''}`}>
      <section className="public-welcome-dialog" role="dialog" aria-modal="true" aria-labelledby="public-welcome-title" aria-describedby="public-welcome-copy">
        <div className="public-welcome-brand">
          <img src="/optimized/root/logo-welcome.webp" alt="Full China" width="192" height="84" />
        </div>
        <div className="public-welcome-menu-heading">
          <span>BIENVENIDO A LA CASA</span>
          <h2 id="public-welcome-title">La carta de Full China</h2>
          <p id="public-welcome-copy">Arma tu pedido aquí. <strong>No pagas en esta página.</strong> Al finalizar, confirmas la compra y coordinas el pago por WhatsApp con Full China.</p>
        </div>
        <div className="public-welcome-menu-list" aria-label="Pasos para hacer tu pedido">
          <div className="public-welcome-menu-section-title">TU PEDIDO, PASO A PASO</div>
          <div className="public-welcome-menu-item">
            <span><b>01</b><strong>Elige tus platos</strong></span>
            <small>Agrégalos al carrito.</small>
          </div>
          <div className="public-welcome-menu-item">
            <span><b>02</b><strong>Completa tus datos</strong></span>
            <small>Revisa tu pedido.</small>
          </div>
          <div className="public-welcome-menu-item">
            <span><b>03</b><strong>Confirma por WhatsApp</strong></span>
            <small>Allí confirmas la compra y coordinas el pago.</small>
          </div>
        </div>
        {showDismissChoice && <label className="public-welcome-dismiss-choice">
          <input type="checkbox" checked={dontShowAgain} onChange={event => onDontShowAgainChange(event.target.checked)} />
          <span>No volver a mostrar este mensaje</span>
        </label>}
        <button ref={buttonRef} type="button" className="public-welcome-confirm" onClick={onContinue} disabled={loading} aria-busy={loading}>
          {loading ? 'Abriendo la carta…' : <>Explorar la carta <ChevronRight size={19} /></>}
        </button>
      </section>
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
