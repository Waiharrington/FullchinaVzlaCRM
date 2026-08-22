import { useCallback, useEffect, useMemo, useState } from 'react'
import { Timer, MessageCircle } from 'lucide-react'
import { PublicMenu } from './PublicMenu'
import './PublicOnboarding.css'

const HERO_SLIDES = [
  '/optimized/onboarding-slides/slide1.webp',
  '/optimized/onboarding-slides/slide2.webp',
  '/optimized/onboarding-slides/slide3.webp',
  '/optimized/onboarding-slides/slide4.webp',
  '/optimized/onboarding-slides/slide5.webp',
  '/optimized/onboarding-slides/slide6.webp',
]

const SLIDE_INTERVAL = 4000
const STORAGE_KEY = 'fullchina_onboarding_seen'

function FeatureCard({ icon, title, description, delay }: {
  icon: React.ReactNode
  title: string
  description: string
  delay: string
}) {
  return (
    <div className="onb-feature-card" style={{ animationDelay: delay }}>
      <div className="onb-feature-icon">{icon}</div>
      <div className="onb-feature-text">
        <span className="onb-feature-title">{title}</span>
        <span className="onb-feature-desc">{description}</span>
      </div>
    </div>
  )
}

function OnboardingScreen({ onComplete }: { onComplete: () => void }) {
  const [current, setCurrent] = useState(0)
  const [isExiting, setIsExiting] = useState(false)

  // Ajustes de imagen calculados con el editor (cargan instantáneamente)
  const adjustments = useMemo(() => [
    { x: 50, y: 88, scale: 1.00 },
    { x: 50, y: 82, scale: 1.00 },
    { x: 50, y: 85, scale: 1.00 },
    { x: 50, y: 45, scale: 1.45 },
    { x: 50, y: 66, scale: 1.05 },
    { x: 50, y: 77, scale: 1.00 }
  ], [])

  useEffect(() => {
    const timer = setTimeout(() => {
      window.__removeFCSplash?.()
    }, 2500)
    return () => clearTimeout(timer)
  }, [])

  useEffect(() => {
    const id = setInterval(() => {
      setCurrent(prev => (prev + 1) % HERO_SLIDES.length)
    }, SLIDE_INTERVAL)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    const nextImage = new Image()
    nextImage.src = HERO_SLIDES[(current + 1) % HERO_SLIDES.length]
  }, [current])

  const goToMenu = useCallback(() => {
    localStorage.setItem(STORAGE_KEY, 'true')
    setIsExiting(true)
    setTimeout(onComplete, 400)
  }, [onComplete])

  return (
    <div className={`onb-page ${isExiting ? 'exiting' : ''}`}>
      <div className="onb-bg-img" />
      <div className="onb-bg-atmosphere" />
      <div className="onb-embers">
        <div className="onb-ember" />
        <div className="onb-ember" />
        <div className="onb-ember" />
        <div className="onb-ember" />
        <div className="onb-ember" />
        <div className="onb-ember" />
      </div>
      <div className="onb-waves" />

      <div className="onb-scroll">
        <div className="onb-top">
          <img className="onb-logo" src="/optimized/root/logo.webp" alt="Full China" />

          {/* Carrusel Cross-fade Inmersivo sin saltos ni flash negro */}
          <div className="onb-hero">
            {HERO_SLIDES.map((src, index) => (
              <img
                key={src}
                className="onb-hero-img"
                style={{ 
                  opacity: current === index ? 1 : 0,
                  objectPosition: `${adjustments[index].x}% ${adjustments[index].y}%`,
                  transform: `scale(${adjustments[index].scale})`,
                  transition: 'opacity 0.8s ease'
                }}
                src={src}
                alt="Plato de Full China"
                loading={index === 0 ? 'eager' : 'lazy'}
                fetchPriority={index === 0 ? 'high' : 'low'}
                decoding="async"
              />
            ))}
            <div className="onb-hero-overlay" />
          </div>
        </div>

        <div className="onb-content">
          <div className="onb-copy">
            <h1 className="onb-title">
              Hoy toca Full China
              <span className="onb-flame">
                <span className="onb-flame-glow" />
                <span className="onb-flame-outer" />
                <span className="onb-flame-inner" />
              </span>
            </h1>
            <p className="onb-subtitle">
              Tu antojo favorito a un mensaje.
            </p>
          </div>

          <div className="onb-features">
            <FeatureCard
              icon={<Timer size={24} strokeWidth={2} />}
              title="Pedido r&aacute;pido"
              description="Elige, arma y env&iacute;a tu pedido"
              delay="0.3s"
            />
            <FeatureCard
              icon={<MessageCircle size={24} strokeWidth={2} />}
              title="Confirmaci&oacute;n por WhatsApp"
              description="Tu solicitud llega lista para confirmar"
              delay="0.4s"
            />
          </div>

          <div className="onb-bottom">
            <div className="onb-cta-wrap">
              <button className="onb-cta" onClick={goToMenu} type="button">
                <span className="onb-cta-text">Ver men&uacute;</span>
                <span className="onb-cta-arrow">&#8250;</span>
              </button>
            </div>
            <p className="onb-footnote">No necesitas crear una cuenta</p>
          </div>
        </div>
      </div>
    </div>
  )
}

export function PublicOnboarding() {
  const forceOnboarding = window.location.search.includes('onboarding')
  const [seen, setSeen] = useState(() => !forceOnboarding && localStorage.getItem(STORAGE_KEY) === 'true')

  if (seen) {
    return <PublicMenu />
  }

  return <OnboardingScreen onComplete={() => setSeen(true)} />
}
