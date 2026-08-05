import { useEffect, useState } from 'react'
import './SplashScreen.css'

interface SplashScreenProps {
  onDone: () => void
  minDuration?: number
}

export function SplashScreen({ onDone, minDuration = 2800 }: SplashScreenProps) {
  const [phase, setPhase] = useState<'enter' | 'exit'>('enter')

  useEffect(() => {
    const timer = setTimeout(() => setPhase('exit'), minDuration)
    return () => clearTimeout(timer)
  }, [minDuration])

  useEffect(() => {
    if (phase === 'exit') {
      const timer = setTimeout(onDone, 600)
      return () => clearTimeout(timer)
    }
  }, [phase, onDone])

  return (
    <div className={`splash-screen ${phase === 'exit' ? 'splash-exit' : ''}`}>
      <img src="/splash-logo.png" alt="Full China" className="splash-logo" />
      <p className="splash-tagline splash-tagline-desktop">El mejor chino-venezolano de Aragua</p>
      <p className="splash-tagline splash-tagline-mobile">Chino-venezolano auténtico</p>
      <div className="splash-bar-wrap">
        <div className="splash-bar-fill" />
      </div>
      <p className="splash-loading-text">Cargando...</p>
    </div>
  )
}
