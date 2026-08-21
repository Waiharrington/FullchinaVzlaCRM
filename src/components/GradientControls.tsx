import { useState, useCallback, useEffect } from 'react'

interface OverlayConfig {
  yShift: number
  gradientScale: number
  transparentEnd: number
  midStart: number
  midOpacity: number
  strongStart: number
  strongOpacity: number
  solidStart: number
}

interface BgConfig {
  topOpacity: number
  fadeEnd: number
  clearStart: number
}

interface SlideConfig {
  posY: number
  zoom: number
}

const HERO_DEFAULTS: OverlayConfig = {
  yShift: 0,
  gradientScale: 1,
  transparentEnd: 65,
  midStart: 80,
  midOpacity: 0.25,
  strongStart: 91,
  strongOpacity: 0.65,
  solidStart: 100,
}

const BG_DEFAULTS: BgConfig = {
  topOpacity: 0.3,
  fadeEnd: 30,
  clearStart: 50,
}

const SLIDE_DEFAULTS: SlideConfig = { posY: 15, zoom: 1 }

function buildHeroGradient(c: OverlayConfig): string {
  return `linear-gradient(180deg,
    transparent 0%,
    transparent ${c.transparentEnd}%,
    rgba(10, 11, 14, ${c.midOpacity}) ${c.midStart}%,
    rgba(10, 11, 14, ${c.strongOpacity}) ${c.strongStart}%,
    #0A0B0E ${c.solidStart}%
  )`
}

function buildBgGradient(c: BgConfig): string {
  return `linear-gradient(180deg,
    rgba(10, 11, 14, ${c.topOpacity}) 0%,
    rgba(10, 11, 14, ${c.topOpacity * 0.17}) ${c.fadeEnd}%,
    rgba(10, 11, 14, 0.0) ${c.clearStart}%,
    rgba(10, 11, 14, 0.0) 100%
  )`
}

function Slider({ label, value, onChange, min, max, step = 1, unit = '%' }: {
  label: string
  value: number
  onChange: (v: number) => void
  min: number
  max: number
  step?: number
  unit?: string
}) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 2, fontSize: 11, color: '#ccc' }}>
      <span style={{ display: 'flex', justifyContent: 'space-between' }}>
        {label}
        <span style={{ color: '#FFC83D', fontWeight: 700 }}>{value > 0 && unit === 'px' ? '+' : ''}{value}{unit}</span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={e => onChange(Number(e.target.value))}
        style={{ width: '100%', accentColor: '#E31B2B' }}
      />
    </label>
  )
}

type Tab = 'hero' | 'bg' | 'fotos'

export function GradientControls({ heroOverlayRef, bgOverlayRef, heroImgRef, currentSlide, onSlideChange, onOpenChange }: {
  heroOverlayRef: React.RefObject<HTMLDivElement | null>
  bgOverlayRef: React.RefObject<HTMLDivElement | null>
  heroImgRef: React.RefObject<HTMLImageElement | null>
  currentSlide: number
  onSlideChange?: (idx: number) => void
  onOpenChange?: (paused: boolean) => void
}) {
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState<Tab>('hero')
  const [hero, setHero] = useState<OverlayConfig>(HERO_DEFAULTS)
  const [bg, setBg] = useState<BgConfig>(BG_DEFAULTS)
  const [slides, setSlides] = useState<SlideConfig[]>([
    { ...SLIDE_DEFAULTS },
    { ...SLIDE_DEFAULTS },
    { ...SLIDE_DEFAULTS },
    { ...SLIDE_DEFAULTS },
    { ...SLIDE_DEFAULTS },
    { ...SLIDE_DEFAULTS },
  ])

  const handleToggle = useCallback(() => {
    setOpen(prev => {
      const next = !prev
      onOpenChange?.(next)
      return next
    })
  }, [onOpenChange])

  const updateHero = useCallback((key: keyof OverlayConfig, val: number) => {
    setHero(prev => ({ ...prev, [key]: val }))
  }, [])

  const updateBg = useCallback((key: keyof BgConfig, val: number) => {
    setBg(prev => ({ ...prev, [key]: val }))
  }, [])

  const updateSlide = useCallback((key: keyof SlideConfig, val: number) => {
    setSlides(prev => {
      const next = [...prev]
      next[currentSlide] = { ...next[currentSlide], [key]: val }
      return next
    })
  }, [currentSlide])

  // Apply hero overlay
  useEffect(() => {
    const el = heroOverlayRef.current
    if (el) {
      el.style.background = buildHeroGradient(hero)
      el.style.transform = `translateY(${hero.yShift}px) scaleX(${hero.gradientScale})`
      el.style.transformOrigin = 'center top'
    }
  }, [hero, heroOverlayRef])

  // Apply bg overlay
  useEffect(() => {
    const el = bgOverlayRef.current
    if (el) {
      el.style.background = buildBgGradient(bg)
    }
  }, [bg, bgOverlayRef])

  // Apply current slide adjustments
  useEffect(() => {
    const img = heroImgRef.current
    if (img) {
      const s = slides[currentSlide] || SLIDE_DEFAULTS
      img.style.objectPosition = `center ${s.posY}%`
      img.style.transform = `scale(${s.zoom})`
    }
  }, [currentSlide, slides, heroImgRef])

  const reset = useCallback(() => {
    setHero(HERO_DEFAULTS)
    setBg(BG_DEFAULTS)
    setSlides(Array(6).fill(null).map(() => ({ ...SLIDE_DEFAULTS })))
    const hEl = heroOverlayRef.current
    const bEl = bgOverlayRef.current
    const img = heroImgRef.current
    if (hEl) {
      hEl.style.background = buildHeroGradient(HERO_DEFAULTS)
      hEl.style.transform = ''
    }
    if (bEl) {
      bEl.style.background = buildBgGradient(BG_DEFAULTS)
    }
    if (img) {
      img.style.objectPosition = `center ${SLIDE_DEFAULTS.posY}%`
      img.style.transform = ''
    }
  }, [heroOverlayRef, bgOverlayRef, heroImgRef])

  const copyCSS = useCallback(() => {
    let css = ''
    if (tab === 'hero') {
      const gradientStr = buildHeroGradient(hero).replace(/\n/g, '\n  ')
      const transform = hero.yShift !== 0 ? `\n  transform: translateY(${hero.yShift}px);` : ''
      css = `.onb-hero-overlay {\n  background: ${gradientStr};${transform}\n}`
    } else if (tab === 'bg') {
      const gradientStr = buildBgGradient(bg).replace(/\n/g, '\n  ')
      css = `.onb-bg-overlay {\n  background: ${gradientStr};\n}`
    } else {
      const s = slides[currentSlide] || SLIDE_DEFAULTS
      css = `.onb-hero-img {\n  object-position: center ${s.posY}%;\n  transform: scale(${s.zoom});\n}`
    }
    navigator.clipboard.writeText(css)
  }, [tab, hero, bg, slides, currentSlide])

  const copyAllSlides = useCallback(() => {
    const lines = slides.map((s, i) =>
      `/* Foto ${i + 1} */\n.onb-slide-${i + 1} .onb-hero-img {\n  object-position: center ${s.posY}%;\n  transform: scale(${s.zoom});\n}`
    )
    navigator.clipboard.writeText(lines.join('\n\n'))
  }, [slides])

  const curSlide = slides[currentSlide] || SLIDE_DEFAULTS

  return (
    <div style={{
      position: 'fixed',
      bottom: open ? 0 : 60,
      right: 12,
      zIndex: 99999,
      fontFamily: 'monospace',
      transition: 'bottom 0.3s ease',
    }}>
      {open && (
        <div style={{
          background: 'rgba(10, 11, 14, 0.95)',
          border: '1px solid #333',
          borderRadius: 14,
          padding: 14,
          width: 240,
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
          marginBottom: 8,
          backdropFilter: 'blur(12px)',
          maxHeight: '80vh',
          overflowY: 'auto',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ color: '#fff', fontWeight: 700, fontSize: 12 }}>Controls</span>
            <button onClick={reset} style={{ background: '#333', color: '#aaa', border: 0, borderRadius: 6, padding: '3px 8px', fontSize: 10, cursor: 'pointer' }}>Reset</button>
          </div>

          <div style={{ display: 'flex', gap: 4, background: '#1a1a1a', borderRadius: 8, padding: 3 }}>
            {(['hero', 'bg', 'fotos'] as Tab[]).map(t => (
              <button key={t} onClick={() => setTab(t)} style={{ flex: 1, padding: '5px 0', borderRadius: 6, border: 0, background: tab === t ? '#E31B2B' : 'transparent', color: '#fff', fontSize: 10, fontWeight: 700, cursor: 'pointer', textTransform: 'capitalize' }}>
                {t === 'hero' ? 'Hero' : t === 'bg' ? 'Fondo' : 'Fotos'}
              </button>
            ))}
          </div>

          {tab === 'hero' && (
            <>
              <Slider label="Mover arriba / abajo" value={hero.yShift} onChange={v => updateHero('yShift', v)} min={-200} max={200} step={5} unit="px" />
              <Slider label="Zoom degradado" value={hero.gradientScale} onChange={v => updateHero('gradientScale', v)} min={0.5} max={3} step={0.05} unit="x" />
              <Slider label="Transparent hasta" value={hero.transparentEnd} onChange={v => updateHero('transparentEnd', v)} min={30} max={90} />
              <Slider label="Medio opacidad" value={hero.midOpacity} onChange={v => updateHero('midOpacity', v)} min={0} max={1} step={0.05} />
              <Slider label="Medio posición" value={hero.midStart} onChange={v => updateHero('midStart', v)} min={50} max={95} />
              <Slider label="Fuerte opacidad" value={hero.strongOpacity} onChange={v => updateHero('strongOpacity', v)} min={0} max={1} step={0.05} />
              <Slider label="Fuerte posición" value={hero.strongStart} onChange={v => updateHero('strongStart', v)} min={70} max={99} />
              <Slider label="Sólido desde" value={hero.solidStart} onChange={v => updateHero('solidStart', v)} min={85} max={100} />
            </>
          )}

          {tab === 'bg' && (
            <>
              <Slider label="Opacidad arriba" value={bg.topOpacity} onChange={v => updateBg('topOpacity', v)} min={0} max={0.8} step={0.01} />
              <Slider label="Se desvanece en" value={bg.fadeEnd} onChange={v => updateBg('fadeEnd', v)} min={5} max={80} />
              <Slider label="Transparente desde" value={bg.clearStart} onChange={v => updateBg('clearStart', v)} min={20} max={100} />
            </>
          )}

          {tab === 'fotos' && (
            <>
              <div style={{ color: '#888', fontSize: 10, textAlign: 'center' }}>
                Foto {currentSlide + 1} de 6
              </div>
              <Slider label="Posición Y" value={curSlide.posY} onChange={v => updateSlide('posY', v)} min={0} max={100} />
              <Slider label="Zoom" value={curSlide.zoom} onChange={v => updateSlide('zoom', v)} min={0.5} max={2} step={0.05} unit="x" />
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                {slides.map((_s, i) => (
                  <div
                    key={i}
                    onClick={() => onSlideChange?.(i)}
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: 6,
                      background: i === currentSlide ? '#E31B2B' : '#333',
                      color: '#fff',
                      fontSize: 10,
                      fontWeight: 700,
                      display: 'grid',
                      placeItems: 'center',
                      border: i === currentSlide ? '1px solid #ff6b6b' : '1px solid transparent',
                      cursor: 'pointer',
                    }}
                  >
                    {i + 1}
                  </div>
                ))}
              </div>
            </>
          )}

          <div style={{ display: 'flex', gap: 6 }}>
            <button onClick={copyCSS} style={{ flex: 1, background: '#E31B2B', color: '#fff', border: 0, borderRadius: 8, padding: '6px 0', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>Copiar CSS</button>
            {tab === 'fotos' && (
              <button onClick={copyAllSlides} style={{ flex: 1, background: '#FFC83D', color: '#0A0B0E', border: 0, borderRadius: 8, padding: '6px 0', fontSize: 10, fontWeight: 700, cursor: 'pointer' }}>Copiar todas</button>
            )}
          </div>
        </div>
      )}

      <button
        onClick={handleToggle}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 44,
          height: 44,
          borderRadius: 14,
          background: open ? '#E31B2B' : 'rgba(20, 21, 23, 0.9)',
          border: '1px solid rgba(255,255,255,0.1)',
          color: '#fff',
          fontSize: 20,
          cursor: 'pointer',
          boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
          marginLeft: 'auto',
          backdropFilter: 'blur(8px)',
        }}
      >
        {open ? '×' : '◎'}
      </button>
    </div>
  )
}
