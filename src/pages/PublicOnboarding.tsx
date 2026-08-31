import { lazy, Suspense, useCallback, useEffect, useState, type CSSProperties } from 'react'
import { BookOpen, Flame, MapPin, Utensils, ShoppingBag, Send } from 'lucide-react'
import { PublicMenuSkeleton } from '../components/PublicMenuSkeleton'
import { HeroWokEmbers } from '../components/HeroWokEmbers'
import './PublicOnboarding.css'

const PublicMenu = lazy(() => import('./PublicMenu').then(module => ({ default: module.PublicMenu })))

function WhatsAppIcon({ size = 15 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.626.712.227 1.36.195 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" />
      <path d="M12.05 22h-.005a9.87 9.87 0 0 1-4.99-1.363L2 22l1.395-5.077A9.87 9.87 0 1 1 12.05 22Zm0-18.09a8.13 8.13 0 0 0-6.968 12.34l.213.34-.826 3.014 3.09-.81.328.195A8.13 8.13 0 1 0 12.05 3.91Z" />
    </svg>
  )
}

const STORAGE_KEY = 'fullchina_onboarding_seen'

const STEPS = [
  { icon: <Utensils size={22} strokeWidth={2} />, label: 'Elige tus platos' },
  { icon: <ShoppingBag size={22} strokeWidth={2} />, label: 'Define la entrega' },
  { icon: <Send size={22} strokeWidth={2} />, label: 'Envía tu pedido' },
]

function OnboardingScreen({ onComplete }: { onComplete: () => void }) {
  const [isExiting, setIsExiting] = useState(false)
  const desktop = window.matchMedia('(min-width: 1280px) and (pointer: fine)').matches
  const fullBackgroundAsset = desktop
    ? '/fondos/fondo_onboarding_compu.png'
    : '/optimized/fondos/onboarding-bg-phone.webp'
  const previewBackgroundAsset = desktop
    ? '/fondos/fondo_onboarding_compu.png'
    : '/optimized/previews/fondos/onboarding-bg-phone.webp'
  const [backgroundAsset, setBackgroundAsset] = useState(previewBackgroundAsset)
  const configuredPhone = String(import.meta.env.VITE_FULLCHINA_WHATSAPP || '').replace(/\D/g, '')

  useEffect(() => {
    const image = new Image()
    let active = true

    image.decoding = 'async'
    image.fetchPriority = 'high'
    image.src = fullBackgroundAsset

    const reveal = () => {
      const decoded = typeof image.decode === 'function' ? image.decode() : Promise.resolve()
      void decoded.catch(() => undefined).then(() => {
        if (active) setBackgroundAsset(fullBackgroundAsset)
      })
    }

    if (image.complete) reveal()
    else image.onload = reveal

    return () => { active = false }
  }, [fullBackgroundAsset])

  const goToMenu = useCallback(() => {
    localStorage.setItem(STORAGE_KEY, 'true')
    setIsExiting(true)
    setTimeout(onComplete, 400)
  }, [onComplete])

  return (
    <div className={`onb-page ${isExiting ? 'exiting' : ''}`}>
      <div
        className="onb-bg-img is-ready"
        style={{ backgroundImage: `url("${backgroundAsset}")` } as CSSProperties}
      />
      <div className="onb-bg-scrim" />
      <HeroWokEmbers />

      <div className="onb-scroll">
        <div className="onb-hero-spacer" />

        <section className="onb-card">
          <img src="/optimized/root/logo.webp" alt="Full China" className="onb-card-logo-img" />

          <h1 className="onb-card-title">
            <span className="onb-brand-welcome">BIENVENIDO A</span>
            <div className="onb-brand-logo">
              <span className="onb-brand-full">FULL</span>
              <span className="onb-brand-china">CHINA</span>
            </div>
          </h1>

          <div className="onb-divider">
            <span className="onb-divider-line" />
            <Flame size={16} className="onb-divider-icon" />
            <span className="onb-divider-line" />
          </div>

          <p className="onb-tagline">Sabor chino, hecho al <span className="onb-tagline-accent">fuego</span>.</p>

          <div className="onb-divider onb-divider-plain"><span className="onb-divider-line" /></div>

          <ul className="onb-categories">
            <li>Arroz</li>
            <li>Tallarines</li>
            <li>Wok</li>
            <li>Más</li>
          </ul>

          <button className="onb-cta onb-cta--block" onClick={goToMenu} type="button">
            <BookOpen size={18} strokeWidth={2.3} />
            <span>VER MENÚ</span>
          </button>

          {configuredPhone && (
            <a
              className="onb-whatsapp-link onb-whatsapp-link--secondary"
              href={`https://wa.me/${configuredPhone}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <WhatsAppIcon size={13} />
              <span>¿Necesitas ayuda? WhatsApp</span>
            </a>
          )}
        </section>

        <div className="onb-mid-spacer" />

        <section className="onb-how">
          <div className="onb-how-heading">
            <span className="onb-how-heading-line" />
            <span>¿Cómo pedir?</span>
            <span className="onb-how-heading-line" />
          </div>

          <div className="onb-steps">
            {STEPS.map((step, index) => (
              <div className="onb-step" key={step.label}>
                <span className="onb-step-num">{index + 1}</span>
                <span className="onb-step-icon">{step.icon}</span>
                <span className="onb-step-label">{step.label}</span>
              </div>
            ))}
          </div>

          <span className="onb-location-line" />

          <p className="onb-location">
            <MapPin size={14} />
            Encuéntranos en{' '}
            <a href="https://maps.app.goo.gl/sh8SDNhhdD6is87y8" target="_blank" rel="noopener noreferrer">
              nuestra ubicación
            </a>
          </p>
        </section>
      </div>
    </div>
  )
}

export function PublicOnboarding() {
  const forceOnboarding = window.location.search.includes('onboarding')
  const [seen, setSeen] = useState(() => !forceOnboarding && localStorage.getItem(STORAGE_KEY) === 'true')

  if (seen) {
    return <Suspense fallback={<PublicMenuSkeleton />}><PublicMenu /></Suspense>
  }

  return <OnboardingScreen onComplete={() => setSeen(true)} />
}
