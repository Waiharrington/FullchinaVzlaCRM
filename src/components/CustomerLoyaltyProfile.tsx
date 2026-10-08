import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Award, ChevronLeft, ChevronRight, Clock3, Gift, History, KeyRound, LoaderCircle, LogOut, UserRound } from 'lucide-react'
import { supabase } from '../lib/supabase'
import './CustomerLoyaltyProfile.css'

type Visit = { order_id: string; order_number: string; visited_at: string; reward_description?: string | null }
type LoyaltyProfile = { customer: { first_name: string; last_name: string; full_name: string; phone: string }; total_visits: number; rewards_unlocked: number; reward_description: string; visits_per_reward: number; has_more: boolean; visits: Visit[]; account_status: 'active' }

const pageSize = 5

export function CustomerLoyaltyProfile() {
  const [profile, setProfile] = useState<LoyaltyProfile | null>(null)
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [identification, setIdentification] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [showHistory, setShowHistory] = useState(false)
  const [page, setPage] = useState(0)
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const loadProfile = useCallback(async () => {
    if (!supabase) return
    const { data: sessionData } = await supabase.auth.getSession()
    if (!sessionData.session) { setProfile(null); return }
    const { data, error: profileError } = await supabase.rpc('fn_get_customer_loyalty_profile', { p_page: page, p_page_size: pageSize })
    if (profileError) throw profileError
    setProfile(data as LoyaltyProfile)
  }, [page])

  useEffect(() => {
    void loadProfile().catch(() => setProfile(null))
    if (!supabase) return
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) window.setTimeout(() => { void loadProfile().catch(() => setProfile(null)) }, 0)
      else window.setTimeout(() => setProfile(null), 0)
    })
    return () => data.subscription.unsubscribe()
  }, [loadProfile])

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setBusy(true); setError(''); setNotice('')
    try {
      if (!supabase) throw new Error('El perfil no está disponible ahora. Intenta más tarde.')
      const body = mode === 'login'
        ? { action: 'login', identifier: identifier.trim(), password }
        : { action: 'register', first_name: firstName.trim(), last_name: lastName.trim(), identification: identification.trim(), phone: phone.trim(), email: email.trim() || null, password }
      const { data, error: authError } = await supabase.functions.invoke('customer-auth', { body })
      if (authError) throw new Error(data?.message || authError.message)
      if (mode === 'register') {
        setNotice('¡Cuenta creada! Tu tarjeta comienza desde cero y sumará visitas en las comandas que pagues después de registrarte.')
        setMode('login')
      } else {
        const { error: sessionError } = await supabase.auth.setSession({ access_token: data.access_token, refresh_token: data.refresh_token })
        if (sessionError) throw sessionError
        await loadProfile()
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo completar la solicitud.')
    } finally { setBusy(false) }
  }

  const logout = async () => { await supabase?.auth.signOut(); setProfile(null); setShowHistory(false); setNotice('') }

  if (!profile) return <main className="customer-profile-page">
    <section className="customer-profile-shell">
      <div className="customer-profile-brand"><span className="customer-profile-brand-icon"><Award /></span><p>FULL CHINA</p><h1>Mi perfil</h1><span>Tu tarjeta de fidelidad, siempre contigo.</span></div>
      <div className="customer-profile-form-wrap">
        <div className="customer-profile-toggle"><button className={mode === 'login' ? 'active' : ''} onClick={() => setMode('login')}>Iniciar sesión</button><button className={mode === 'register' ? 'active' : ''} onClick={() => setMode('register')}>Crear cuenta</button></div>
        <form className="customer-profile-form" onSubmit={submit}>
          {mode === 'register' ? <>
            <div className="customer-profile-two"><label>Nombre<input required autoComplete="given-name" value={firstName} onChange={e => setFirstName(e.target.value)} /></label><label>Apellido<input required autoComplete="family-name" value={lastName} onChange={e => setLastName(e.target.value)} /></label></div>
            <label>Cédula<input required autoComplete="off" value={identification} onChange={e => setIdentification(e.target.value)} placeholder="V-12345678" /></label>
            <label>Teléfono<input required autoComplete="tel" value={phone} onChange={e => setPhone(e.target.value)} /></label>
            <label>Correo <small>(opcional)</small><input type="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} /></label>
          </> : <label>Cédula, teléfono o correo<input required autoComplete="username" value={identifier} onChange={e => setIdentifier(e.target.value)} /></label>}
          <label>Contraseña<input required type="password" minLength={8} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} value={password} onChange={e => setPassword(e.target.value)} /></label>
          {mode === 'login' && <p className="customer-profile-recovery"><KeyRound size={14} /> ¿Olvidaste tu contraseña? Contacta al negocio para recuperar el acceso.</p>}
          {error && <p className="customer-profile-message error">{error}</p>}{notice && <p className="customer-profile-message">{notice}</p>}
          <button className="customer-profile-submit" disabled={busy}>{busy ? <LoaderCircle className="spin" /> : mode === 'login' ? <UserRound /> : <Award />}{mode === 'login' ? 'Entrar a mi perfil' : 'Crear mi cuenta'}</button>
        </form>
      </div>
    </section>
  </main>

  const visitsOnPage = profile.visits ?? []
  const threshold = Math.max(1, Number(profile.visits_per_reward) || 10)
  const stamps = profile.total_visits % threshold
  return <main className="customer-profile-page"><section className="customer-profile-dashboard">
    <header className="customer-profile-welcome"><div><span>Bienvenido/a</span><h1>{profile.customer.first_name || profile.customer.full_name.split(' ')[0]}</h1></div><button onClick={() => void logout()}><LogOut size={16} /> Salir</button></header>
    <article className="customer-loyalty-card"><div className="customer-loyalty-head"><div><span>Tarjeta de Fidelidad</span><h2>{profile.customer.full_name}</h2><small>{profile.customer.phone}</small></div><img src="/icons/wok-mark.png" alt="" /></div><div className="customer-loyalty-progress"><span>Sellos de visita</span><strong>{stamps} / {threshold}</strong></div><div className="customer-loyalty-bar"><span style={{ width: `${(stamps / threshold) * 100}%` }} /></div><div className="customer-loyalty-stamps">{Array.from({ length: threshold }, (_, i) => <span className={i < stamps ? 'earned' : ''} key={i}>{i < stamps ? <img src="/icons/wok-mark.png" alt="Sello" /> : i + 1}</span>)}</div><div className="customer-loyalty-rewards"><Gift size={18} /><span><small>Premios disponibles</small><strong>{profile.rewards_unlocked} · {profile.reward_description}</strong></span></div></article>
    <button className="customer-profile-history-button" onClick={() => setShowHistory(open => !open)}><History size={18} /> {showHistory ? 'Ocultar historial' : 'Historial de visitas'}<ChevronRight className={showHistory ? 'rotated' : ''} size={17} /></button>
    {showHistory && <section className="customer-profile-history"><h2>Visitas</h2>{visitsOnPage.length ? visitsOnPage.map(visit => <article key={visit.order_id}><Clock3 size={16} /><span><strong>Comanda {visit.order_number}</strong><small>{new Date(visit.visited_at).toLocaleDateString('es-VE', { dateStyle: 'medium' })}</small></span></article>) : <p>Aún no hay visitas en esta página.</p>}<footer><button disabled={page <= 0} onClick={() => setPage(n => n - 1)}><ChevronLeft size={16} /></button><span>Página {page + 1}</span><button disabled={!profile.has_more} onClick={() => setPage(n => n + 1)}><ChevronRight size={16} /></button></footer></section>}
  </section></main>
}
