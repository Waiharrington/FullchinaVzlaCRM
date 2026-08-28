const fs = require('fs');

const tsxFile = 'src/pages/PublicOnboarding.tsx';
let tsxContent = fs.readFileSync(tsxFile, 'utf8');

const newTSX = `import { useCallback, useEffect, useMemo, useState } from 'react'
import { Timer, MessageCircle } from 'lucide-react'
import { PublicMenu } from './PublicMenu'
import './PublicOnboarding.css'

const HERO_SLIDES = [
  '/onboarding-slides/slide1.webp',
  '/onboarding-slides/slide2.webp',
  '/onboarding-slides/slide3.webp',
  '/onboarding-slides/slide4.webp',
  '/onboarding-slides/slide5.webp',
  '/onboarding-slides/slide6.webp',
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
      <span className="onb-feature-arrow">&#8250;</span>
    </div>
  )
}

function OnboardingScreen() {
  const [current, setCurrent] = useState(0)
  const [opacity, setOpacity] = useState(1)

  const [adjustments, setAdjustments] = useState([
    { x: 50, y: 100, scale: 1 },
    { x: 50, y: 100, scale: 1 },
    { x: 50, y: 83, scale: 1 },
    { x: 50, y: 41, scale: 1.2 },
    { x: 50, y: 74, scale: 1.05 },
    { x: 50, y: 63, scale: 1 }
  ])
  const [isPaused, setIsPaused] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => {
      window.__removeFCSplash?.()
    }, 2500)
    return () => clearTimeout(timer)
  }, [])

  useEffect(() => {
    if (isPaused) return
    const id = setInterval(() => {
      setOpacity(0)
      setTimeout(() => {
        setCurrent(prev => (prev + 1) % HERO_SLIDES.length)
        setOpacity(1)
      }, 300)
    }, SLIDE_INTERVAL)
    return () => clearInterval(id)
  }, [isPaused])

  const goToMenu = useCallback(() => {
    localStorage.setItem(STORAGE_KEY, 'true')
    window.location.reload()
  }, [])

  return (
    <div className="onb-page">
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

      {/* EDITOR UI (Tablet Solo) */}
      <div className="tablet-image-editor">
        <div className="tie-header">
          <span>Ajustando Foto {current + 1}/6</span>
          <button onClick={() => setIsPaused(!isPaused)}>{isPaused ? '▶️ Continuar' : '⏸️ Pausar'}</button>
        </div>
        <div className="tie-controls">
          <button onClick={() => { setIsPaused(true); setCurrent((prev) => (prev - 1 + HERO_SLIDES.length) % HERO_SLIDES.length) }}>⏪ Ant</button>
          
          <div className="tie-pad">
            <button onClick={() => { setIsPaused(true); setAdjustments(p => { const n = [...p]; n[current] = {...n[current], y: n[current].y - 2}; return n; }) }}>⬆️</button>
            <div style={{display: 'flex', gap: '5px'}}>
              <button onClick={() => { setIsPaused(true); setAdjustments(p => { const n = [...p]; n[current] = {...n[current], x: n[current].x - 2}; return n; }) }}>⬅️</button>
              <button onClick={() => { setIsPaused(true); setAdjustments(p => { const n = [...p]; n[current] = {...n[current], x: n[current].x + 2}; return n; }) }}>➡️</button>
            </div>
            <button onClick={() => { setIsPaused(true); setAdjustments(p => { const n = [...p]; n[current] = {...n[current], y: n[current].y + 2}; return n; }) }}>⬇️</button>
          </div>

          <div className="tie-zoom">
            <button onClick={() => { setIsPaused(true); setAdjustments(p => { const n = [...p]; n[current] = {...n[current], scale: n[current].scale + 0.05}; return n; }) }}>➕ Zoom</button>
            <button onClick={() => { setIsPaused(true); setAdjustments(p => { const n = [...p]; n[current] = {...n[current], scale: n[current].scale - 0.05}; return n; }) }}>➖ Zoom</button>
          </div>
          
          <button onClick={() => { setIsPaused(true); setCurrent((prev) => (prev + 1) % HERO_SLIDES.length) }}>Sig ⏩</button>
        </div>
        <button className="tie-copy" onClick={() => {
          const css = adjustments.map((adj, i) => \`.onb-slide-\${i} .onb-hero-img { object-position: \${adj.x}% \${adj.y}% !important; transform: scale(\${adj.scale.toFixed(2)}) !important; }\`).join('\\n');
          navigator.clipboard.writeText(css).then(() => alert('¡Ajustes copiados al portapapeles! Envíamelos por el chat.'));
        }}>📋 Copiar Ajustes para IA</button>
      </div>

      <div className="onb-scroll">
        <div className="onb-top">
          <img className="onb-logo" src="/logo.png" alt="Full China" />

          <div className="onb-hero">
            <img
              className={\`onb-hero-img onb-slide-\${current}\`}
              style={{ 
                opacity,
                objectPosition: \`\${adjustments[current].x}% \${adjustments[current].y}%\`,
                transform: \`scale(\${adjustments[current].scale})\`,
                transition: 'opacity 0.3s ease, object-position 0.1s, transform 0.1s'
              }}
              src={HERO_SLIDES[current]}
              alt="Plato de Full China"
            />
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
  const seen = useMemo(() => !forceOnboarding && localStorage.getItem(STORAGE_KEY) === 'true', [forceOnboarding])

  if (seen) {
    return <PublicMenu />
  }

  return <OnboardingScreen />
}
`;
fs.writeFileSync(tsxFile, newTSX);

const cssFile = 'src/pages/PublicOnboarding.css';
let cssContent = fs.readFileSync(cssFile, 'utf8');

cssContent = cssContent.replace(/\/\* Per-slide adjustments \*\/[\s\S]*?\.onb-slide-5.*?\}\n/, '');

const editorCSS = `
/* --- Tablet Image Editor --- */
.tablet-image-editor { display: none; }

@media (min-width: 600px) and (max-width: 1366px) {
  .tablet-image-editor {
    display: flex; flex-direction: column; position: fixed;
    bottom: 20px; left: 50%; transform: translateX(-50%); z-index: 999999;
    background: rgba(10, 10, 15, 0.95); border: 2px solid #FF5528;
    border-radius: 16px; padding: 16px; color: white;
    box-shadow: 0 10px 40px rgba(0,0,0,0.9); gap: 12px;
    backdrop-filter: blur(10px); font-family: sans-serif;
    width: 90%; max-width: 500px;
  }
  .tie-header { display: flex; justify-content: space-between; font-weight: bold; align-items: center; font-size: 18px; }
  .tie-header button { background: #333; color: white; border: none; padding: 8px 16px; border-radius: 8px; cursor: pointer; font-weight: bold; }
  .tie-controls { display: flex; gap: 12px; align-items: center; justify-content: space-between; }
  .tie-controls button { background: #222; color: white; border: 1px solid #555; border-radius: 8px; padding: 10px; cursor: pointer; font-size: 16px; }
  .tie-controls button:active { background: #FF5528; }
  .tie-pad { display: flex; flex-direction: column; align-items: center; gap: 6px; }
  .tie-zoom { display: flex; flex-direction: column; gap: 6px; }
  .tie-copy { background: #FF5528; color: white; font-weight: bold; border: none; padding: 14px; border-radius: 12px; cursor: pointer; margin-top: 4px; font-size: 16px; box-shadow: 0 4px 15px rgba(255, 85, 40, 0.4); }
}
`;

fs.writeFileSync(cssFile, cssContent + editorCSS);
console.log('Done installing tablet editor');
