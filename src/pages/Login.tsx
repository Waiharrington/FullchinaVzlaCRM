import { useState } from 'react'
import { useAuth } from '../context/auth-context'
import './Login.css'

const ROLES = [
  { key: 'owner' as const, label: 'Owner', icon: '👑', desc: 'Acceso total: costos, reportes, config' },
  { key: 'manager' as const, label: 'Manager', icon: '📋', desc: 'Operación: inventario, producción, compras' },
  { key: 'cashier' as const, label: 'Cashier', icon: '💰', desc: 'Ventas: caja, comandas, cobros' }
]

export function Login() {
  const { signIn, signInAsDemo, demoMode } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    const result = await signIn(email, password)
    if (result.error) setError(result.error)
    setLoading(false)
  }

  if (demoMode) {
    return (
      <div className="login-page">
        <div className="login-card animate-fade-in">
          <div className="login-brand">
            <span className="login-logo">🚚</span>
            <h1 className="login-title text-gradient">Clienta Food Truck</h1>
            <span className="badge badge-demo">Modo Demo</span>
          </div>
          <p className="login-hint">
            Selecciona un rol para acceder a la demo:
          </p>
          <div className="role-selector">
            {ROLES.map((role, index) => (
              <button
                key={role.key}
                className="role-btn"
                onClick={() => signInAsDemo(role.key)}
                style={{ animationDelay: `${index * 0.1}s` }}
              >
                <span className="role-icon">{role.icon}</span>
                <span className="role-label">{role.label}</span>
                <span className="role-desc">{role.desc}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="login-page">
      <div className="login-card animate-fade-in">
        <div className="login-brand">
          <span className="login-logo">🚚</span>
          <h1 className="login-title text-gradient">Clienta Food Truck</h1>
        </div>
        <form onSubmit={handleSubmit} className="login-form">
          <div className="field">
            <label htmlFor="email" className="field-label">Correo</label>
            <input
              id="email"
              type="email"
              className="field-input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
          </div>
          <div className="field">
            <label htmlFor="password" className="field-label">Contraseña</label>
            <input
              id="password"
              type="password"
              className="field-input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
            />
          </div>
          {error && <p className="login-error">{error}</p>}
          <button type="submit" className="btn-accent" disabled={loading}>
            {loading ? 'Ingresando...' : 'Ingresar'}
          </button>
        </form>
      </div>
    </div>
  )
}
