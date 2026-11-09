import { useEffect, useState } from 'react'
import { BatteryFull, CalendarDays, Camera, ChevronDown, ChevronLeft, ChevronRight, Clock3, Compass, Copy, Download, Images, MapPinned, Menu, MessageCircle, MoreVertical, Music2, Phone, Play, Plus, RotateCcw, Settings, Share, Smartphone, Signal, Wifi, X } from 'lucide-react'
import './PwaInstallPrompt.css'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>
}

const DISMISSED_KEY = 'fullchina-client-pwa-install-dismissed'

type InstallBrowser = 'safari' | 'chrome'
type InstallPlatform = 'iphone' | 'android'
type AndroidInstallChoice = 'install' | 'shortcut'
type InstallStage = 'intro' | 'choose' | 'choose-chrome-platform' | 'demo'

function isStandaloneApp() {
  return window.matchMedia('(display-mode: standalone)').matches
    || Boolean((navigator as Navigator & { standalone?: boolean }).standalone)
}

function isPhoneViewport() {
  return window.matchMedia('(max-width: 767px) and (pointer: coarse)').matches
}

export function PwaInstallPrompt() {
  const [isPhone, setIsPhone] = useState(isPhoneViewport)
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [isVisible, setIsVisible] = useState(() =>
    !isStandaloneApp() && sessionStorage.getItem(DISMISSED_KEY) !== 'true',
  )
  const [showInstallShortcut, setShowInstallShortcut] = useState(() =>
    !isStandaloneApp() && sessionStorage.getItem(DISMISSED_KEY) === 'true',
  )
  const [installStage, setInstallStage] = useState<InstallStage>('intro')
  const [selectedBrowser, setSelectedBrowser] = useState<InstallBrowser | null>(null)
  const [selectedPlatform, setSelectedPlatform] = useState<InstallPlatform | null>(null)
  const [androidInstallChoice, setAndroidInstallChoice] = useState<AndroidInstallChoice | null>(null)
  const [demoStep, setDemoStep] = useState(0)
  const safariSteps = ['Toca el menú de Safari', 'Toca «Compartir»', 'Toca «Agregar a Inicio»', 'Toca «Agregar»', 'Busca Full China en tu inicio']
  const safariDescriptions = ['Está junto a la dirección de la página, abajo.', 'Elige «Compartir» en el menú que se abrió.', 'Desliza hacia arriba para encontrar esta opción.', 'El botón azul está arriba a la derecha.', 'Listo. Toca su icono para abrirla.']
  const chromeIphoneSteps = ['Toca «Compartir» arriba', 'Toca «Ver más»', 'Toca «Agregar a Inicio»', 'Toca «Agregar»', 'Busca Full China en tu inicio']
  const chromeIphoneDescriptions = [
    'Está a la derecha de la dirección de la página.',
    'En la ventana que aparece, toca «Ver más».',
    'En la lista, elige «Agregar a Inicio».',
    'El botón azul está arriba a la derecha.',
    'Listo. Toca su icono para abrirla.',
  ]
  const chromeAndroidSteps = ['Toca los tres puntos ⋮', 'Elige una opción', androidInstallChoice === 'shortcut' ? 'Toca «Añadir»' : 'Toca «Instalar»', androidInstallChoice === 'shortcut' ? 'Busca el acceso directo' : 'Busca Full China en tus apps']
  const chromeAndroidDescriptions = [
    'Están arriba, junto a la dirección de la página.',
    'Elige «Instalar aplicación» o, si esa opción no aparece, «Añadir a pantalla de inicio».',
    androidInstallChoice === 'shortcut' ? 'Confirma para crear el acceso directo.' : 'Confirma la instalación de Full China.',
    androidInstallChoice === 'shortcut' ? 'Listo. Toca el acceso directo para abrirla.' : 'Listo. Toca el icono de Full China para abrirla.',
  ]
  const demoSteps = selectedBrowser === 'safari' ? safariSteps : selectedPlatform === 'android' ? chromeAndroidSteps : chromeIphoneSteps
  const demoDescriptions = selectedBrowser === 'safari' ? safariDescriptions : selectedPlatform === 'android' ? chromeAndroidDescriptions : chromeIphoneDescriptions
  const lastDemoStep = demoSteps.length - 1

  useEffect(() => {
    const phoneViewport = window.matchMedia('(max-width: 767px) and (pointer: coarse)')
    const updateDeviceType = () => setIsPhone(phoneViewport.matches)
    phoneViewport.addEventListener('change', updateDeviceType)
    return () => phoneViewport.removeEventListener('change', updateDeviceType)
  }, [])

  useEffect(() => {
    const hideWhenInstalled = () => {
      if (!isStandaloneApp()) return
      setIsVisible(false)
      setShowInstallShortcut(false)
    }

    if (isStandaloneApp()) return

    const captureInstallPrompt = (event: Event) => {
      event.preventDefault()
      setInstallPrompt(event as BeforeInstallPromptEvent)
    }
    const markInstalled = () => {
      setIsVisible(false)
      setShowInstallShortcut(false)
    }

    window.addEventListener('beforeinstallprompt', captureInstallPrompt)
    window.addEventListener('appinstalled', markInstalled)
    window.addEventListener('pageshow', hideWhenInstalled)
    document.addEventListener('visibilitychange', hideWhenInstalled)
    return () => {
      window.removeEventListener('beforeinstallprompt', captureInstallPrompt)
      window.removeEventListener('appinstalled', markInstalled)
      window.removeEventListener('pageshow', hideWhenInstalled)
      document.removeEventListener('visibilitychange', hideWhenInstalled)
    }
  }, [])

  const closePrompt = () => {
    sessionStorage.setItem(DISMISSED_KEY, 'true')
    setIsVisible(false)
    setShowInstallShortcut(true)
  }

  const openInstallShortcut = () => {
    setIsVisible(true)
    setShowInstallShortcut(false)
    setInstallStage('choose')
  }

  const chooseBrowser = (browser: InstallBrowser) => {
    setSelectedBrowser(browser)
    setAndroidInstallChoice(null)
    if (browser === 'chrome') {
      setSelectedPlatform(null)
      setInstallStage('choose-chrome-platform')
      return
    }
    setSelectedPlatform('iphone')
    setDemoStep(0)
    setInstallStage('demo')
  }

  const chooseChromePlatform = (platform: InstallPlatform) => {
    setSelectedPlatform(platform)
    setAndroidInstallChoice(null)
    setDemoStep(0)
    setInstallStage('demo')
  }

  const chooseAndroidInstallPath = (choice: AndroidInstallChoice) => {
    setAndroidInstallChoice(choice)
    setDemoStep(2)
  }

  const goToDemoStep = (step: number) => {
    setDemoStep(Math.max(0, Math.min(lastDemoStep, step)))
  }

  const installOrShowInstructions = async () => {
    if (installStage === 'intro') {
      setInstallStage('choose')
      return
    }

    if (installStage !== 'demo' || selectedBrowser !== 'chrome' || selectedPlatform !== 'android' || androidInstallChoice !== 'install' || !installPrompt) return

    const entry = document.documentElement.dataset.pwaEntry
    const manifest = document.getElementById('pwa-manifest') as HTMLLinkElement | null
    const manifestPath = manifest ? new URL(manifest.href, window.location.href).pathname : ''

    // On SPA navigation, changing the manifest link is not enough: browsers
    // may keep the install prompt bound to the manifest from the first HTML.
    // Reload through the dedicated customer HTML before asking to install.
    if (entry !== 'cliente' || manifestPath !== '/manifest-cliente.webmanifest') {
      window.location.assign('/pedir')
      return
    }

    await installPrompt.prompt()
    const choice = await installPrompt.userChoice
    setInstallPrompt(null)
    if (choice.outcome === 'accepted') {
      setIsVisible(false)
      setShowInstallShortcut(false)
    }
  }

  if (!isPhone) return null

  if (!isVisible && showInstallShortcut) {
    return (
      <button className="pwa-install-shortcut" type="button" onClick={openInstallShortcut} aria-label="Ver cómo instalar Full China" title="Instalar Full China">
        <Download size={16} aria-hidden="true" />
        <span>Instalar</span>
      </button>
    )
  }

  if (!isVisible) return null

  return (
    <aside className={`pwa-install-prompt${installStage !== 'intro' ? ' has-install-flow' : ''}${installStage === 'demo' ? ' is-demo' : ''}`} aria-label="Instala la aplicación de Full China">
      <div className="pwa-install-prompt__icon" aria-hidden="true"><Smartphone size={24} /></div>
      <div className="pwa-install-prompt__content">
        <small className="pwa-install-prompt__eyebrow">FULL CHINA EN TU INICIO</small>
        <strong>{installStage === 'intro' ? 'Tu menú, a un toque' : installStage === 'choose' ? '¿Qué navegador usas?' : installStage === 'choose-chrome-platform' ? '¿En qué teléfono usas Chrome?' : `Demo de ${selectedBrowser === 'safari' ? 'Safari' : 'Chrome'}`}</strong>
        <span>{installStage === 'intro'
          ? 'Añade la app a tu pantalla de inicio y vuelve a pedir fácilmente.'
          : installStage === 'choose'
            ? 'Elige Safari o Chrome y te mostramos dónde tocar.'
            : installStage === 'choose-chrome-platform'
              ? 'Chrome se instala de forma distinta en iPhone y Android.'
            : 'Sigue cada paso a tu ritmo.'}</span>
      </div>
      {installStage !== 'intro' && (
        <section className="pwa-install-prompt__flow" aria-live="polite">
          {installStage === 'choose' ? <>
            <p className="pwa-install-prompt__choice-label">Elige tu navegador</p>
            <div className="pwa-install-prompt__device-options">
              <button type="button" onClick={() => chooseBrowser('safari')}>
                <span className="pwa-install-prompt__device-icon is-safari"><img src="/icons/safari-brand.svg" alt="" /></span>
                <span><strong>Safari</strong><small>Compartir · Añadir a inicio</small></span>
                <ChevronRight size={18} aria-hidden="true" />
              </button>
              <button type="button" onClick={() => chooseBrowser('chrome')}>
                <span className="pwa-install-prompt__device-icon is-chrome"><img src="/icons/chrome-brand.svg" alt="" /></span>
                <span><strong>Google Chrome</strong><small>Compartir en iPhone · Instalar en Android</small></span>
                <ChevronRight size={18} aria-hidden="true" />
              </button>
            </div>
          </> : installStage === 'choose-chrome-platform' ? <>
            <div className="pwa-install-prompt__demo-heading">
              <div><strong>Google Chrome</strong><span>ELIGE TU TELÉFONO</span></div>
              <button type="button" onClick={() => setInstallStage('choose')}><ChevronLeft size={15} /> Navegadores</button>
            </div>
            <div className="pwa-install-prompt__device-options">
              <button type="button" onClick={() => chooseChromePlatform('iphone')}>
                <span className="pwa-install-prompt__device-icon is-safari"><Smartphone size={20} /></span>
                <span><strong>iPhone</strong><small>Chrome · Compartir</small></span>
                <ChevronRight size={18} aria-hidden="true" />
              </button>
              <button type="button" onClick={() => chooseChromePlatform('android')}>
                <span className="pwa-install-prompt__device-icon is-chrome"><Smartphone size={20} /></span>
                <span><strong>Android / Samsung</strong><small>Chrome · Instalar app</small></span>
                <ChevronRight size={18} aria-hidden="true" />
              </button>
            </div>
          </> : selectedBrowser && selectedPlatform && <>
            <div className="pwa-install-prompt__demo-heading">
              <div><strong>{selectedBrowser === 'safari' ? 'Safari · iPhone' : `Chrome · ${selectedPlatform === 'iphone' ? 'iPhone' : 'Android'}`}</strong><span>GUÍA DE INSTALACIÓN</span></div>
              <button type="button" onClick={() => setInstallStage(selectedBrowser === 'chrome' ? 'choose-chrome-platform' : 'choose')}><ChevronLeft size={15} /> Cambiar</button>
            </div>
            <div className="pwa-install-prompt__demo-layout">
              <div className="pwa-install-prompt__phone" aria-hidden="true">
                <div className="pwa-install-prompt__phone-screen" key={`${selectedBrowser}-${selectedPlatform}-${demoStep}`}>
                  {demoStep === lastDemoStep ? (selectedPlatform === 'iphone' ? <div className="pwa-install-prompt__home-screen">
                    <div className="pwa-install-prompt__ios-status"><b>9:41</b><span><Signal size={8} /><Wifi size={9} /><BatteryFull size={11} /></span></div>
                    <div className="pwa-install-prompt__ios-app-grid">
                      <div className="pwa-install-prompt__ios-app is-fullchina"><img src="/icons/customer-pwa-icon.png" alt="" /><span>Full<br />China</span></div>
                      <div className="pwa-install-prompt__ios-app"><i className="is-calendar"><CalendarDays size={15} /></i><span>Calen.</span></div>
                      <div className="pwa-install-prompt__ios-app"><i className="is-photos"><Images size={15} /></i><span>Fotos</span></div>
                      <div className="pwa-install-prompt__ios-app"><i className="is-camera"><Camera size={15} /></i><span>Cámara</span></div>
                      <div className="pwa-install-prompt__ios-app"><i className="is-maps"><MapPinned size={15} /></i><span>Mapas</span></div>
                      <div className="pwa-install-prompt__ios-app"><i className="is-clock"><Clock3 size={15} /></i><span>Reloj</span></div>
                      <div className="pwa-install-prompt__ios-app"><i className="is-notes">▤</i><span>Notas</span></div>
                      <div className="pwa-install-prompt__ios-app"><i className="is-settings"><Settings size={15} /></i><span>Ajustes</span></div>
                    </div>
                    <div className="pwa-install-prompt__ios-page-dots"><i className="active" /><i /><i /></div>
                    <div className="pwa-install-prompt__home-dock">
                      <i className="is-phone"><Phone size={13} /></i><i className="is-safari-dock"><Compass size={13} /></i><i className="is-messages"><MessageCircle size={13} /></i><i className="is-music"><Music2 size={13} /></i>
                    </div>
                    <span className="pwa-install-prompt__ios-home-indicator" />
                  </div> : <div className="pwa-install-prompt__samsung-home-screen">
                    <div className="pwa-install-prompt__samsung-status"><b>9:41</b><span>● ● <Wifi size={9} /><BatteryFull size={11} /></span></div>
                    <div className="pwa-install-prompt__samsung-clock"><strong>9:41</strong><span>Lun, 9 nov</span><small>Maracay&nbsp; · &nbsp;28° ☀</small></div>
                    <div className="pwa-install-prompt__samsung-app-grid">
                      <div className="pwa-install-prompt__samsung-app is-fullchina"><img src="/icons/customer-pwa-icon.png" alt="" /><span>Full<br />China</span></div>
                      <div className="pwa-install-prompt__samsung-app"><i className="is-gallery"><Images size={14} /></i><span>Galería</span></div>
                      <div className="pwa-install-prompt__samsung-app"><i className="is-playstore"><Play size={14} /></i><span>Play Store</span></div>
                      <div className="pwa-install-prompt__samsung-app"><i className="is-camera"><Camera size={14} /></i><span>Cámara</span></div>
                      <div className="pwa-install-prompt__samsung-app"><i className="is-calendar"><CalendarDays size={14} /></i><span>Calend.</span></div>
                      <div className="pwa-install-prompt__samsung-app"><i className="is-clock"><Clock3 size={14} /></i><span>Reloj</span></div>
                      <div className="pwa-install-prompt__samsung-app"><i className="is-settings"><Settings size={14} /></i><span>Ajustes</span></div>
                      <div className="pwa-install-prompt__samsung-app"><i className="is-internet"><Compass size={14} /></i><span>Internet</span></div>
                    </div>
                    <div className="pwa-install-prompt__samsung-page-dots"><i className="active" /><i /></div>
                    <div className="pwa-install-prompt__samsung-dock">
                      <i className="is-phone"><Phone size={13} /></i><i className="is-messages"><MessageCircle size={13} /></i><i className="is-chrome"><img src="/icons/chrome-brand.svg" alt="" /></i><i className="is-camera"><Camera size={13} /></i>
                    </div>
                    <span className="pwa-install-prompt__samsung-nav" />
                  </div>) : <div className={`pwa-install-prompt__app-screen is-${selectedBrowser} is-${selectedPlatform}`}>
                    <img className="pwa-install-prompt__real-app" src="/optimized/pwa-install-menu-demo.jpg" alt="Pantalla real del menú Full China" />
                    {selectedBrowser === 'safari' ? <div className="pwa-install-prompt__browser-tools is-safari is-iphone">
                      <span>‹</span><span className={`pwa-install-prompt__safari-menu-button${demoStep === 0 ? ' is-highlighted' : ''}`}><Menu size={13} /></span><span className="pwa-install-prompt__browser-address">fullchinavzla.com</span><span>↻</span>
                    </div> : selectedPlatform === 'iphone' ? <div className="pwa-install-prompt__browser-tools is-chrome is-iphone">
                      <span className="pwa-install-prompt__chrome-back">‹</span><span className="pwa-install-prompt__browser-address is-chrome-iphone"><small>ⓘ</small> fullchinavzla.vercel.app <i className={`pwa-install-prompt__chrome-share${demoStep === 0 ? ' is-highlighted' : ''}`}><Share size={13} /></i></span><span className="pwa-install-prompt__chrome-more"><MoreVertical size={14} /></span>
                    </div> : <div className="pwa-install-prompt__browser-tools is-chrome is-android">
                      <span className="pwa-install-prompt__browser-lock">⌑</span><span className="pwa-install-prompt__browser-address">fullchinavzla.com</span><span className={`pwa-install-prompt__tap-target${demoStep === 0 ? ' is-highlighted' : ''}`}><MoreVertical size={14} /></span>
                    </div>}
                    {selectedBrowser === 'safari' && demoStep === 1 && <div className="pwa-install-prompt__system-menu is-safari-browser"><b><Share size={13} /> Compartir</b><span>Añadir a marcadores</span><span>Buscar en la página</span></div>}
                    {selectedBrowser === 'safari' && demoStep === 2 && <div className="pwa-install-prompt__share-sheet">
                      <div className="pwa-install-prompt__share-preview"><img src="/icons/customer-pwa-icon.png" alt="" /><span><b>Full China</b><small>fullchinavzla.vercel.app</small></span></div>
                      <div className="pwa-install-prompt__share-people"><i /><i /><i /><i /></div>
                      <div className="pwa-install-prompt__share-apps"><span>AirDrop</span><span>Mensajes</span><span>Notas</span><span>Más</span></div>
                      <div className="pwa-install-prompt__share-actions"><span>Copiar</span><span>Agregar a marcadores</span><b className="is-highlighted"><Plus size={13} /> Agregar a Inicio</b></div>
                      <span className="pwa-install-prompt__sheet-scroll">Desliza hacia arriba</span>
                    </div>}
                    {selectedBrowser === 'chrome' && selectedPlatform === 'iphone' && demoStep === 1 && <div className="pwa-install-prompt__share-sheet is-chrome-iphone-share">
                      <div className="pwa-install-prompt__share-preview"><img src="/icons/customer-pwa-icon.png" alt="" /><span><b>Full China</b><small>fullchinavzla.vercel.app</small></span></div>
                      <div className="pwa-install-prompt__share-people"><i /><i /><i /><i /></div>
                      <div className="pwa-install-prompt__share-apps"><span>AirDrop</span><span>Mensajes</span><span>Notas</span><span>Recordatorios</span></div>
                      <div className="pwa-install-prompt__share-actions"><span><Copy size={12} /> Copiar</span><span><Smartphone size={12} /> Enviar a tu dispositivo</span><span><Plus size={12} /> Añadir a lista de lectura</span><b className="is-highlighted"><ChevronDown size={12} /> Ver más</b></div>
                    </div>}
                    {selectedBrowser === 'chrome' && selectedPlatform === 'iphone' && demoStep === 2 && <div className="pwa-install-prompt__share-sheet is-chrome-iphone-share is-chrome-iphone-expanded">
                      <div className="pwa-install-prompt__share-preview"><img src="/icons/customer-pwa-icon.png" alt="" /><span><b>Full China</b><small>fullchinavzla.vercel.app</small></span></div>
                      <div className="pwa-install-prompt__chrome-action-list"><span>Agregar marcador</span><span>Buscar en la página</span><span>Traducir</span><b className="is-highlighted"><Plus size={13} /> Agregar a Inicio</b></div>
                    </div>}
                    {((selectedBrowser === 'safari' && demoStep === 3) || (selectedBrowser === 'chrome' && selectedPlatform === 'iphone' && demoStep === 3)) && <div className="pwa-install-prompt__add-home-sheet">
                      <div className="pwa-install-prompt__add-home-header"><span>×</span><b>Agregar a Inicio</b><strong className="is-highlighted">Agregar</strong></div>
                      <div className="pwa-install-prompt__add-home-preview"><img src="/icons/customer-pwa-icon.png" alt="" /><span><b>Full China</b><small>https://fullchinavzla.vercel.app/pedir</small></span></div>
                      <div className="pwa-install-prompt__web-app-option">Abrir como app web <i /></div>
                    </div>}
                    {selectedBrowser === 'chrome' && selectedPlatform === 'android' && demoStep === 1 && <div className="pwa-install-prompt__system-menu is-chrome"><span>Nueva pestaña</span><span>Historial</span><b className={androidInstallChoice === 'install' || androidInstallChoice === null ? 'is-highlighted' : ''}><Download size={13} /> Instalar aplicación</b><b className={androidInstallChoice === 'shortcut' || androidInstallChoice === null ? 'is-highlighted' : ''}><Plus size={13} /> Añadir a pantalla de inicio</b></div>}
                    {selectedBrowser === 'chrome' && selectedPlatform === 'android' && demoStep === 2 && <div className="pwa-install-prompt__android-install-dialog">
                      <div className="pwa-install-prompt__android-install-title"><img src="/icons/customer-pwa-icon.png" alt="" /><span><b>{androidInstallChoice === 'shortcut' ? 'Añadir a pantalla de inicio' : '¿Instalar Full China?'}</b><small>Full China · {androidInstallChoice === 'shortcut' ? 'Acceso directo' : 'Aplicación web'}</small></span></div>
                      <p>{androidInstallChoice === 'shortcut' ? 'El acceso directo abrirá Full China en Chrome.' : 'Se añadirá a tu pantalla de inicio.'}</p>
                      <div><span>Cancelar</span><b className="is-highlighted">{androidInstallChoice === 'shortcut' ? 'Añadir' : 'Instalar'}</b></div>
                    </div>}
                  </div>}
                </div>
              </div>
              <div className="pwa-install-prompt__demo-copy" key={`${selectedBrowser}-${demoStep}`}>
                <span>PASO {demoStep + 1} DE {demoSteps.length}</span>
                <strong>{demoSteps[demoStep]}</strong>
                <p>{demoDescriptions[demoStep]}</p>
                {selectedBrowser === 'chrome' && selectedPlatform === 'android' && demoStep === 1 && <div className="pwa-install-prompt__android-choice-actions">
                  <button type="button" onClick={() => chooseAndroidInstallPath('install')}><Download size={17} /> Instalar aplicación</button>
                  <button type="button" onClick={() => chooseAndroidInstallPath('shortcut')}><Plus size={17} /> Añadir a pantalla de inicio</button>
                </div>}
              </div>
            </div>
            <div className="pwa-install-prompt__step-progress" role="progressbar" aria-label="Progreso del tutorial" aria-valuemin={1} aria-valuemax={demoSteps.length} aria-valuenow={demoStep + 1}>
              <span style={{ width: `${((demoStep + 1) / demoSteps.length) * 100}%` }} />
            </div>
            <div className="pwa-install-prompt__step-navigation">
              <button type="button" onClick={() => goToDemoStep(demoStep - 1)} disabled={demoStep === 0}><ChevronLeft size={18} /> Atrás</button>
              {demoStep === lastDemoStep
                ? <button type="button" onClick={() => goToDemoStep(0)}><RotateCcw size={17} /> Ver de nuevo</button>
                : <button type="button" onClick={() => goToDemoStep(demoStep + 1)} disabled={selectedBrowser === 'chrome' && selectedPlatform === 'android' && demoStep === 1}><span>Siguiente</span><ChevronRight size={18} />
                </button>}
            </div>
          </>}
        </section>
      )}
      {(installStage === 'intro' || (selectedBrowser === 'chrome' && selectedPlatform === 'android' && androidInstallChoice === 'install' && installPrompt)) && (
        <button className="pwa-install-prompt__install" key={installStage} type="button" onClick={() => void installOrShowInstructions()}>
          {installStage === 'intro' ? <><Download size={16} aria-hidden="true" /> Instalar</>
            : <><Download size={16} aria-hidden="true" /> Instalar ahora</>}
        </button>
      )}
      <button className="pwa-install-prompt__close" type="button" aria-label="Cerrar aviso de instalación" onClick={closePrompt}>
        <X size={17} aria-hidden="true" />
      </button>
    </aside>
  )
}
