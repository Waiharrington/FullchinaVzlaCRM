import { useState, useEffect } from 'react'
import { useAuth } from '../context/auth-context'
import { ShieldCheck, User, Lock, Eye, EyeOff, ArrowRight, Grid3X3 } from 'lucide-react'
import './Login.css'

const CAROUSEL_IMAGES = [
  '/login-carousel/slide1.webp',
  '/login-carousel/slide2.webp',
  '/login-carousel/slide3.png',
  '/login-carousel/slide4.png',
  '/login-carousel/slide5.png',
  '/login-carousel/slide7.jpg'
];

const CAROUSEL_SETTINGS = [
  { posY: 80, zoom: 1.25 },
  { posY: 80, zoom: 1.15 },
  { posY: 85, zoom: 1.10 },
  { posY: 80, zoom: 1.00 },
  { posY: 85, zoom: 1.10 },
  { posY: 75, zoom: 1.15 },
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
  const [currentSlide, setCurrentSlide] = useState(0)

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % CAROUSEL_IMAGES.length)
    }, 10000)
    return () => clearInterval(interval)
  }, [])

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
              objectPosition: `50% ${CAROUSEL_SETTINGS[index]?.posY ?? 25}%`,
              transform: `scale(${CAROUSEL_SETTINGS[index]?.zoom ?? 1})`
            }}
          />
        ))}
        <div className="carousel-overlay"></div>
      </div>

      <div className="login-layout">
        
        {/* LEFT COLUMN: Branding */}
        <div className="login-left">
          <div className="login-left-top">
            <img src="/logo.png" alt="Full China" className="login-main-logo" />
          </div>
          
          <div className="login-left-bottom">
            <div className="login-hero-text">
              <h2>Sabor que</h2>
              <h2><span className="text-highlight">enciende</span></h2>
              <h2>tu día</h2>
            </div>
            
            <p className="login-description">
              Gestiona tu negocio, controla<br />
              tus ventas y haz crecer<br />
              Full China cada día.
            </p>
          </div>
        </div>

        {/* RIGHT COLUMN: Login Card */}
        <div className="login-right">
          <div className="login-card animate-fade-in">
            {/* Logo */}
            <div className="card-logo-wrapper">
              <img src="/logo.png" alt="Full China" className="card-logo-img" />
            </div>

            <div className="login-header">
              <h1 className="login-title">¡Bienvenido!</h1>
              <p className="login-subtitle">Inicia sesión para continuar</p>
            </div>

            <form onSubmit={handleSubmit} className="login-form">
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
                      />
                    </div>
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

