import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../context/auth-context'
import { ShieldCheck, User, Lock, Eye, EyeOff, ArrowRight, Grid3X3 } from 'lucide-react'
import './Login.css'

const CAROUSEL_IMAGES = [
  '/login-carousel/slide1.webp',
  '/login-carousel/slide2.webp',
  '/login-carousel/slide3.png',
  '/login-carousel/slide4.png',
  '/login-carousel/slide5.png'
];

const CAROUSEL_SETTINGS = [
  {
    "posY": 38,
    "posX": 51,
    "zoom": 1.09,
    "maskRight": 83
  },
  {
    "posY": 25,
    "posX": 48,
    "zoom": 2.35,
    "maskRight": 61
  },
  {
    "posY": 6,
    "posX": 47,
    "zoom": 3.17,
    "maskRight": 56
  },
  {
    "posY": 49,
    "posX": 48,
    "zoom": 3.06,
    "maskRight": 86
  },
  {
    "posY": 0,
    "posX": 41,
    "zoom": 2.62,
    "maskRight": 56
  }
];

export function Login() {
  const { signIn, signInAsDemo, demoMode } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [rememberMe, setRememberMe] = useState(true)

  const [isPinMode, setIsPinMode] = useState(false)
  const [pin, setPin] = useState('')
  const [isExiting, setIsExiting] = useState(false)
  const [carouselSettings, setCarouselSettings] = useState(CAROUSEL_SETTINGS)
  const [currentSlide, setCurrentSlide] = useState(0)
  const [isTabletViewport, setIsTabletViewport] = useState(false)
  const formRef = useRef<HTMLFormElement>(null)
  const didSetTabletDefault = useRef(false)

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % CAROUSEL_IMAGES.length);
    }, 6000); // 6 seconds per slide
    return () => clearInterval(timer);
  }, []);

  // Tablets en el mostrador funcionan como terminal de caja: PIN es el modo por defecto.
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 680px) and (max-width: 1200px)')
    const update = () => setIsTabletViewport(mq.matches)
    update()
    mq.addEventListener('change', update)
    return () => mq.removeEventListener('change', update)
  }, [])

  useEffect(() => {
    if (isTabletViewport && !didSetTabletDefault.current) {
      setIsPinMode(true)
      didSetTabletDefault.current = true
    }
  }, [isTabletViewport])

  // Auto-envía al completar 4 dígitos (largo de los PIN configurados en .env y demo).
  useEffect(() => {
    if (isPinMode && pin.length === 4 && !loading) {
      formRef.current?.requestSubmit()
    }
  }, [pin, isPinMode, loading])

  const triggerExit = (action: () => void) => {
    setIsExiting(true)
    setTimeout(action, 600)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    
    if (demoMode) {
      if (isPinMode) {
        if (pin === '1234') triggerExit(() => signInAsDemo('cashier'))
        else if (pin === '4321') triggerExit(() => signInAsDemo('manager'))
        else if (pin === '9999') triggerExit(() => signInAsDemo('owner'))
        else {
          setError('PIN incorrecto. (Usa 1234, 4321 o 9999 en demo)')
          setLoading(false)
        }
      } else {
        const role = email.toLowerCase().includes('manager') ? 'manager' : 
                     email.toLowerCase().includes('cashier') ? 'cashier' : 'owner';
        triggerExit(() => signInAsDemo(role))
      }
      return
    }

    // Real Supabase login with PIN mapping
    if (isPinMode) {
      const pinCashier = import.meta.env.VITE_CASHIER_PIN || '1234'
      const pinManager = import.meta.env.VITE_MANAGER_PIN || '4321'
      const pinOwner = import.meta.env.VITE_OWNER_PIN || '9999'

      let targetEmail = ''
      let targetPassword = ''

      if (pin === pinCashier) {
        targetEmail = import.meta.env.VITE_CASHIER_EMAIL
        targetPassword = import.meta.env.VITE_CASHIER_PASSWORD
      } else if (pin === pinManager) {
        targetEmail = import.meta.env.VITE_MANAGER_EMAIL
        targetPassword = import.meta.env.VITE_MANAGER_PASSWORD
      } else if (pin === pinOwner) {
        targetEmail = import.meta.env.VITE_OWNER_EMAIL
        targetPassword = import.meta.env.VITE_OWNER_PASSWORD
      }

      if (targetEmail && targetPassword) {
        try {
          await signIn(targetEmail, targetPassword)
        } catch (err: unknown) {
          setError(err instanceof Error ? err.message : 'Error al conectar con Supabase')
        } finally {
          setLoading(false)
        }
        return
      } else {
        setError('PIN no configurado en el servidor. Configure las credenciales de correo en el archivo .env.')
        setLoading(false)
        return
      }
    }

    const result = await signIn(email, password)
    if (result.error) setError(result.error)
    setLoading(false)
  }

  return (
    <div className={`login-page ${isExiting ? 'exiting' : ''}`}>
      
      {/* Mobile/Tablet Header Carousel */}
      <div className="login-carousel">
        {CAROUSEL_IMAGES.map((src, index) => (
          <img 
            key={src}
            src={src} 
            alt="Full China Food"
            className={`carousel-img ${index === currentSlide ? 'active' : ''}`}
            style={{
              objectPosition: 'center',
              transform: `translate(${(carouselSettings[index]?.posX ?? 50) - 50}%, ${(carouselSettings[index]?.posY ?? 50) - 50}%) scale(${carouselSettings[index]?.zoom ?? 1})`,
              WebkitMaskImage: `linear-gradient(to right, black ${carouselSettings[index]?.maskRight ?? 100}%, transparent ${(carouselSettings[index]?.maskRight ?? 100) + 10}%)`,
              maskImage: `linear-gradient(to right, black ${carouselSettings[index]?.maskRight ?? 100}%, transparent ${(carouselSettings[index]?.maskRight ?? 100) + 10}%)`
            }}
          />
        ))}
        <div className="carousel-overlay"></div>
      </div>

      {/* Desktop Premium Layers */}
      <div className="desktop-layers">
        <div className="desktop-bg-layer" style={{ backgroundImage: 'url(/fondo-login.png)' }}></div>
        
        {/* Left Carousel for Desktop */}
        <div className="desktop-carousel-layer">
          {CAROUSEL_IMAGES.map((src, index) => (
            <img 
              key={src}
              src={src} 
              alt="Full China Food"
              className={`desktop-carousel-img ${index === currentSlide ? 'active' : ''}`}
              style={{
                objectPosition: 'center',
                transform: `translate(${(carouselSettings[index]?.posX ?? 50) - 50}%, ${(carouselSettings[index]?.posY ?? 50) - 50}%) scale(${carouselSettings[index]?.zoom ?? 1})`,
                WebkitMaskImage: `linear-gradient(to right, black ${carouselSettings[index]?.maskRight ?? 100}%, transparent ${(carouselSettings[index]?.maskRight ?? 100) + 10}%)`,
                maskImage: `linear-gradient(to right, black ${carouselSettings[index]?.maskRight ?? 100}%, transparent ${(carouselSettings[index]?.maskRight ?? 100) + 10}%)`
              }}
            />
          ))}
        </div>

        {/* Screen-wide gradients */}
        <div className="desktop-carousel-gradient"></div>
        <div className="desktop-carousel-bottom-gradient"></div>

        {/* Bottom food image */}
        <div className="desktop-bottom-layer">
          <img src="/foto-comida.png" alt="Platos Full China" className="desktop-food-img" />
        </div>
      </div>

      <div className="login-layout">
        
        {/* LEFT COLUMN: Branding */}
        <div className="login-left">
          <div className="login-left-top">
            <img src="/logo.png" alt="Full China" className="login-main-logo" />
          </div>
          
          <div className="login-left-bottom">
            <div className="login-hero-text">
              <h2>El auténtico sabor</h2>
              <h2><span className="text-highlight">chino</span> sobre ruedas</h2>
            </div>
            
            <p className="login-description">
              Gestiona tu negocio, controla tus ventas y haz crecer Full China cada día.
            </p>
          </div>
        </div>

        {/* RIGHT COLUMN: Login Card */}
        <div className="login-right">
          <div className={`login-card animate-fade-in ${isPinMode ? 'pin-active' : ''}`}>
            {/* Logo */}
            <div className="card-logo-wrapper">
              <img src="/logo.png" alt="Full China" className="card-logo-img" />
            </div>

            <div className="login-header">
              <h1 className="login-title">¡Bienvenido!</h1>
              <p className="login-subtitle">Inicia sesión para continuar</p>
            </div>

            <form onSubmit={handleSubmit} className="login-form" ref={formRef}>
              <div className="form-sections-container">
                {/* PIN MODE SECTION */}
                <div className={`form-section ${isPinMode ? 'active' : 'inactive-left'}`}>
                  <div className="field-group">
                    <label htmlFor="pin">PIN de acceso</label>
                    <div className="input-wrapper">
                      <Grid3X3 className="input-icon" size={18} />
                      <input
                        id="pin"
                        type="password"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        placeholder="••••"
                        value={pin}
                        onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
                        maxLength={6}
                        style={{ fontSize: '1.5rem', letterSpacing: '0.5rem', textAlign: 'center' }}
                        required={isPinMode}
                        disabled={!isPinMode}
                        autoFocus={isPinMode}
                        readOnly={isTabletViewport}
                      />
                    </div>
                  </div>

                  <div className="pin-keypad">
                    {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
                      <button
                        type="button"
                        key={digit}
                        className="keypad-btn"
                        onClick={() => setPin((p) => (p.length < 6 ? p + digit : p))}
                      >
                        {digit}
                      </button>
                    ))}
                    <button
                      type="button"
                      className="keypad-btn keypad-clear"
                      onClick={() => setPin('')}
                    >
                      Borrar
                    </button>
                    <button
                      type="button"
                      className="keypad-btn"
                      onClick={() => setPin((p) => (p.length < 6 ? p + '0' : p))}
                    >
                      0
                    </button>
                    <button
                      type="button"
                      className="keypad-btn keypad-back"
                      onClick={() => setPin((p) => p.slice(0, -1))}
                      aria-label="Borrar último dígito"
                    >
                      ⌫
                    </button>
                  </div>
                </div>

                {/* EMAIL MODE SECTION */}
                <div className={`form-section ${!isPinMode ? 'active' : 'inactive-right'}`}>
                  <div className="field-group">
                    <label htmlFor="email">Correo electrónico</label>
                    <div className="input-wrapper">
                      <User className="input-icon" size={18} />
                      <input
                        id="email"
                        type="text"
                        placeholder="correo@ejemplo.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required={!isPinMode}
                        disabled={isPinMode}
                        autoFocus={!isPinMode}
                      />
                    </div>
                  </div>

                  <div className="field-group">
                    <label htmlFor="password">Contraseña</label>
                    <div className="input-wrapper">
                      <Lock className="input-icon" size={18} />
                      <input
                        id="password"
                        type={showPassword ? "text" : "password"}
                        placeholder="••••••••••••••"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required={!demoMode && !isPinMode}
                        disabled={isPinMode}
                      />
                      <button 
                        type="button" 
                        className="icon-btn"
                        onClick={() => setShowPassword(!showPassword)}
                      >
                        {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <div className="form-options">
                <label className="checkbox-wrapper">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                  />
                  <span className="checkbox-custom"></span>
                  <span className="checkbox-label">Recordar sesión</span>
                </label>
                <a href="#" className="forgot-password" onClick={(e) => e.preventDefault()}>¿Olvidaste tu contraseña?</a>
              </div>

              {error && <p className="error-message">{error}</p>}

              <button type="submit" className="btn-primary" disabled={loading}>
                {loading ? 'Ingresando...' : 'Iniciar sesión'}
                <ArrowRight size={18} />
              </button>

              <div className="divider-row">
                <span className="divider-line"></span>
                <span className="divider-text">o</span>
                <span className="divider-line"></span>
              </div>

              <button 
                type="button" 
                className="btn-secondary" 
                onClick={() => {
                  setIsPinMode(!isPinMode)
                  setError('')
                  setPin('')
                }}
              >
                {isPinMode ? (
                  <>
                    <User size={18} />
                    Ingresar con correo
                  </>
                ) : (
                  <>
                    <Grid3X3 size={18} />
                    Ingresar con PIN
                  </>
                )}
              </button>
            </form>

            <div className="login-footer">
              <ShieldCheck size={16} className="footer-icon" />
              <span>Sistema seguro para Full China</span>
            </div>
          </div>
        </div>

      </div>


    </div>
  )
}
