import { useEffect, useState } from 'react'
import './SplashScreen.css'

interface SplashScreenProps {
  onDone: () => void
  minDuration?: number
  /** The splash only exits after both this signal and minDuration are ready. */
  ready?: boolean
}

export function SplashScreen({ onDone, minDuration = 2800, ready = true }: SplashScreenProps) {
  const [phase, setPhase] = useState<'enter' | 'exit'>('enter')
  const [minimumElapsed, setMinimumElapsed] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => setMinimumElapsed(true), minDuration)
    return () => clearTimeout(timer)
  }, [minDuration])

  useEffect(() => {
    if (minimumElapsed && ready) setPhase('exit')
  }, [minimumElapsed, ready])

  useEffect(() => {
    if (phase === 'exit') {
      const timer = setTimeout(onDone, 400)
      return () => clearTimeout(timer)
    }
  }, [phase, onDone])

  return (
    <div
      className={`splash-screen ${phase === 'exit' ? 'splash-exit' : ''}`}
      role="status"
      aria-label="Cargando Full China"
    >
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
