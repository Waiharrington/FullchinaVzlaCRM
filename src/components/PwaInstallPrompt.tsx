import { useEffect, useState } from 'react'
import { Download, Share, Smartphone, X } from 'lucide-react'
import './PwaInstallPrompt.css'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>
}

const DISMISSED_KEY = 'fullchina-client-pwa-install-dismissed'

function isStandaloneApp() {
  return window.matchMedia('(display-mode: standalone)').matches
    || Boolean((navigator as Navigator & { standalone?: boolean }).standalone)
}

function isIosDevice() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent)
    || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
}

export function PwaInstallPrompt() {
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [isVisible, setIsVisible] = useState(() =>
    !isStandaloneApp() && sessionStorage.getItem(DISMISSED_KEY) !== 'true',
  )
  const [showInstructions, setShowInstructions] = useState(false)

  useEffect(() => {
    if (isStandaloneApp() || sessionStorage.getItem(DISMISSED_KEY) === 'true') return

    const captureInstallPrompt = (event: Event) => {
      event.preventDefault()
      setInstallPrompt(event as BeforeInstallPromptEvent)
    }
    const markInstalled = () => setIsVisible(false)

    window.addEventListener('beforeinstallprompt', captureInstallPrompt)
    window.addEventListener('appinstalled', markInstalled)
    return () => {
      window.removeEventListener('beforeinstallprompt', captureInstallPrompt)
      window.removeEventListener('appinstalled', markInstalled)
    }
  }, [])

  if (!isVisible) return null

  const closePrompt = () => {
    sessionStorage.setItem(DISMISSED_KEY, 'true')
    setIsVisible(false)
  }

  const installOrShowInstructions = async () => {
    if (!installPrompt) {
      setShowInstructions(value => !value)
      return
    }

    await installPrompt.prompt()
    const choice = await installPrompt.userChoice
    setInstallPrompt(null)
    if (choice.outcome === 'accepted') setIsVisible(false)
  }

  return (
    <aside className="pwa-install-prompt" aria-label="Instala la aplicación de Full China">
      <div className="pwa-install-prompt__icon" aria-hidden="true"><Smartphone size={22} /></div>
      <div className="pwa-install-prompt__content">
        <strong>Instala nuestra app</strong>
        <span>Haz tus pedidos más rápido desde tu pantalla de inicio.</span>
        {showInstructions && (
          <p className="pwa-install-prompt__instructions">
            {isIosDevice()
              ? <><Share size={14} aria-hidden="true" /> Toca <b>Compartir</b> y luego <b>Añadir a pantalla de inicio</b>.</>
              : <>Abre el menú del navegador <b>⋮</b> y elige <b>Instalar aplicación</b> o <b>Añadir a pantalla principal</b>.</>}
          </p>
        )}
      </div>
      <button className="pwa-install-prompt__install" type="button" onClick={() => void installOrShowInstructions()}>
        <Download size={16} aria-hidden="true" />
        {installPrompt ? 'Instalar' : showInstructions ? 'Listo' : 'Cómo instalar'}
      </button>
      <button className="pwa-install-prompt__close" type="button" aria-label="Cerrar aviso de instalación" onClick={closePrompt}>
        <X size={17} aria-hidden="true" />
      </button>
    </aside>
  )
}
