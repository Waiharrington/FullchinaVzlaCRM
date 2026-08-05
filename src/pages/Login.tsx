import { useState, useEffect } from 'react'
import { useAuth } from '../context/auth-context'
import { ShieldCheck, User, Lock, Eye, EyeOff, ArrowRight, Grid3X3, Truck } from 'lucide-react'
import './Login.css'

const CAROUSEL_IMAGES = [
  '/login-carousel/slide1.webp',
  '/login-carousel/slide2.webp',
  '/login-carousel/slide3.png',
  '/login-carousel/slide4.png',
  '/login-carousel/slide5.png',
  '/login-carousel/slide6.png',
  '/login-carousel/slide7.jpg'
];

export function Login() {
  const { signIn, signInAsDemo, demoMode } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const [isPinMode, setIsPinMode] = useState(false)
  const [pin, setPin] = useState('')
  const [isExiting, setIsExiting] = useState(false)
  const [currentSlide, setCurrentSlide] = useState(0)

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % CAROUSEL_IMAGES.length)
    }, 2000)
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
        } catch (err: any) {
          setError(err.message || 'Error al conectar con Supabase')
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
          />
        ))}
        <div className="carousel-overlay"></div>
      </div>

      <div className="login-layout">
        
        {/* LEFT COLUMN: Branding */}
        <div className="login-left">
          <img src="/logo.png" alt="Full China" className="login-main-logo" />
          
          <div className="login-hero-text">
            <h2>Sabor que</h2>
            <h2><span className="text-highlight">enciende</span> tu día</h2>
          </div>
          
          <p className="login-description">
            Gestiona tu food truck con el control y<br />la pasión que nos caracteriza.
          </p>

          <div className="login-features">
            <div className="feature-item">
              <svg width="34" height="34" viewBox="0 0 24 24" fill="none" strokeWidth="1.5">
                <path d="M3 20h18" stroke="#d12c2c" strokeLinecap="round" className="sales-floor"/>
                <path d="M6 20v-5m6 5v-8m6 8v-11" stroke="#facc15" strokeLinecap="round" className="sales-bar"/>
                <path d="M3 13l5-5 4 4 8-8" stroke="#facc15" strokeLinecap="round" strokeLinejoin="round" className="sales-line"/>
                <path d="M16 4h4v4" stroke="#facc15" strokeLinecap="round" strokeLinejoin="round" className="sales-arrow"/>
              </svg>
              <span>Ventas</span>
            </div>
            <div className="feature-item">
              <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="#facc15" strokeWidth="1.5">
                <path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1-2-1z" strokeLinecap="round" strokeLinejoin="round" className="ticket-body"/>
                <path d="M8 8h8M8 12h8M8 16h8" strokeLinecap="round" className="ticket-lines"/>
              </svg>
              <span>Comandas</span>
            </div>
            <div className="feature-item">
              <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="#facc15" strokeWidth="1.5">
                <path d="M12 2.5l8 4.5-8 4.5-8-4.5 8-4.5z" strokeLinecap="round" strokeLinejoin="round" className="box-lid"/>
                <path d="M20 7v9l-8 4.5V11.5M4 7v9l8 4.5V11.5" strokeLinecap="round" strokeLinejoin="round" className="box-sides"/>
                <path d="M8 4.5l8 4.5" strokeLinecap="round" strokeLinejoin="round" className="box-tape"/>
              </svg>
              <span>Inventario</span>
            </div>
            <div className="feature-item">
              <svg width="34" height="34" viewBox="0 0 24 24" fill="none" strokeWidth="1.5">
                <path d="M12 11c-2 0-4-1.5-4-4 0-1.5 1.5-3 2.5-4.5C10.5 2.5 10 4 11 5c1-1 3-2 3-2-1.5 2-2 3-2 4 0 1.5 1 2.5 2 2.5z" fill="#d12c2c" stroke="#d12c2c" strokeLinecap="round" strokeLinejoin="round" className="flame-big"/>
                <path d="M14.5 9c1 0 2-1 2-2 0-1-1-2-1-2 0 1-1 1.5-1 1.5s1 .5 1 1c0 .5-.5 1-1 1z" fill="#d12c2c" stroke="#d12c2c" strokeLinecap="round" strokeLinejoin="round" className="flame-mid"/>
                <path d="M8.5 9c-1 0-2-1-2-2 0-1 1-2 1-2 0 1 1 1.5 1 1.5s-1 .5-1 1c0 .5.5 1 1 1z" fill="#d12c2c" stroke="#d12c2c" strokeLinecap="round" strokeLinejoin="round" className="flame-small"/>
                <path d="M3 13c0 4.5 4 8 9 8s9-3.5 9-8" stroke="#facc15" strokeLinecap="round" strokeLinejoin="round" className="svg-wok-pan"/>
                <path d="M1 13h22" stroke="#facc15" strokeLinecap="round" strokeLinejoin="round" className="svg-wok-rim"/>
                <path d="M21 13l2-2" stroke="#facc15" strokeLinecap="round" strokeLinejoin="round" className="svg-wok-handle"/>
              </svg>
              <span>Producción</span>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: Login Card */}
        <div className="login-right">
          <div className="login-card animate-fade-in">
            <div className="login-header">
              <h1 className="login-title">Iniciar sesión</h1>
              <div className="secure-badge">
                <ShieldCheck size={16} />
                <span>Acceso seguro</span>
              </div>
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
                    <label htmlFor="email">Correo o usuario</label>
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

              {error && <p className="error-message">{error}</p>}

              <button type="submit" className="btn-primary" disabled={loading}>
                {loading ? 'Ingresando...' : 'Entrar al sistema'}
                <ArrowRight size={18} />
              </button>

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
              <Truck size={16} className="footer-icon" />
              <span>Sistema operativo para food truck</span>
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}

