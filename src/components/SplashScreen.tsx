import { useEffect, useState } from 'react'
import './SplashScreen.css'

interface SplashScreenProps {
  onDone: () => void
  minDuration?: number
  /** When true the splash stays visible indefinitely (no auto-close). */
  persist?: boolean
}

export function SplashScreen({ onDone, minDuration = 2800, persist }: SplashScreenProps) {
  const [phase, setPhase] = useState<'enter' | 'exit'>('enter')

  useEffect(() => {
    if (persist) return
    const timer = setTimeout(() => setPhase('exit'), minDuration)
    return () => clearTimeout(timer)
  }, [minDuration, persist])

  useEffect(() => {
    if (!persist && phase === 'exit') {
      const timer = setTimeout(onDone, 600)
      return () => clearTimeout(timer)
    }
  }, [phase, onDone, persist])

  return (
    <div className={`splash-screen ${phase === 'exit' ? 'splash-exit' : ''}`}>
      <img src="/optimized/root/splash-logo.webp" alt="Full China" className="splash-logo" />
      <p className="splash-tagline splash-tagline-desktop">El mejor chino-venezolano de Aragua</p>
      <p className="splash-tagline splash-tagline-mobile">Chino-venezolano auténtico</p>
      <div className="splash-bar-wrap">
        <div className="splash-bar-fill" />
      </div>
      <p className="splash-loading-text">Cargando...</p>
    </div>
  )
}
