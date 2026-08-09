import { useState, useEffect, type ReactNode } from 'react'
import { AuthContext } from './auth-context'
import type { User } from './auth-context'
import { supabase, isDemoMode } from '../lib/supabase'

const DEMO_USERS: Record<string, User> = {
  owner: { id: 'demo-owner', email: 'duena@fullchinavzla.com', role: 'owner' },
  manager: { id: 'demo-manager', email: 'gerencia@fullchinavzla.com', role: 'manager' },
  cashier: { id: 'demo-cashier', email: 'caja@fullchinavzla.com', role: 'cashier' }
}

async function fetchUserRole(userId: string): Promise<'owner' | 'manager' | 'cashier' | null> {
  if (!supabase) return null
  const { data, error } = await supabase
    .from('profiles')
    .select('role,is_active')
    .eq('id', userId)
    .maybeSingle()
  if (error || !data?.is_active || !['owner', 'manager', 'cashier'].includes(data.role)) return null
  return data.role as 'owner' | 'manager' | 'cashier'
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<import('@supabase/supabase-js').Session | null>(null)
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  const [splashDone, setSplashDone] = useState(false)

  useEffect(() => {
    if (isDemoMode) {
      const savedUser = localStorage.getItem('demo_user')
      if (savedUser) {
        try {
          setUser(JSON.parse(savedUser))
        } catch {
          setUser(null)
        }
      } else {
        setUser(null)
      }
      setSession(null)
      setLoading(false)
      return
    }

    supabase!.auth.getSession().then(async ({ data: { session: currentSession } }) => {
      setSession(currentSession)
      if (currentSession?.user) {
        const role = await fetchUserRole(currentSession.user.id)
        if (role) {
          setUser({ id: currentSession.user.id, email: currentSession.user.email || '', role })
        } else {
          setSession(null)
          setUser(null)
          void supabase!.auth.signOut({ scope: 'local' })
        }
      }
      setLoading(false)
    })

    const { data: { subscription } } = supabase!.auth.onAuthStateChange(
      async (_event, currentSession) => {
        setSession(currentSession)
        if (currentSession?.user) {
          const role = await fetchUserRole(currentSession.user.id)
          if (role) {
            setUser({ id: currentSession.user.id, email: currentSession.user.email || '', role })
          } else {
            setSession(null)
            setUser(null)
            void supabase!.auth.signOut({ scope: 'local' })
          }
        } else {
          setUser(null)
        }
      }
    )

    return () => subscription.unsubscribe()
  }, [])

  const signIn = async (email: string, password: string) => {
    if (isDemoMode) {
      setUser(DEMO_USERS.owner)
      localStorage.setItem('demo_user', JSON.stringify(DEMO_USERS.owner))
      setSplashDone(false) // Trigger splash on next render
      return {}
    }

    const { data, error } = await supabase!.auth.signInWithPassword({ email, password })
    if (error) return { error: error.message }
    const role = data.user ? await fetchUserRole(data.user.id) : null
    if (!role) {
      await supabase!.auth.signOut({ scope: 'local' })
      return { error: 'Este usuario no está autorizado para FullChinaVzla.' }
    }
    setUser({ id: data.user.id, email: data.user.email || email, role })
    setSplashDone(false) // Trigger splash on next render
    return {}
  }

  const signInWithPin = async (pin: string) => {
    if (isDemoMode) return { error: 'Usa los PIN de demostración.' }

    const { data: pinData, error: pinError } = await supabase!.functions.invoke('pin-login', {
      body: { pin },
    })

    if (pinError || !pinData?.token_hash || !pinData?.email) {
      const context = await pinError?.context?.json?.().catch(() => null)
      if (context?.error === 'temporarily_locked') {
        return { error: 'Demasiados intentos. Espera 15 minutos antes de volver a intentar.' }
      }
      if (context?.error === 'login_unavailable') {
        return { error: 'El acceso por PIN no está disponible en este momento.' }
      }
      return { error: 'PIN incorrecto.' }
    }

    const { data, error } = await supabase!.auth.verifyOtp({
      token_hash: pinData.token_hash,
      type: 'magiclink',
    })
    if (error || !data.user) return { error: 'No se pudo iniciar sesión con el PIN.' }

    const role = await fetchUserRole(data.user.id)
    if (!role) {
      await supabase!.auth.signOut({ scope: 'local' })
      return { error: 'Este usuario no está autorizado para FullChinaVzla.' }
    }

    setUser({ id: data.user.id, email: data.user.email || pinData.email, role })
    setSplashDone(false)
    return {}
  }

  const signInAsDemo = (role: 'owner' | 'manager' | 'cashier') => {
    if (isDemoMode) {
      setUser(DEMO_USERS[role])
      localStorage.setItem('demo_user', JSON.stringify(DEMO_USERS[role]))
      setSplashDone(false) // Trigger splash on next render
    }
  }

  const signOut = async () => {
    if (isDemoMode) {
      setUser(null)
      localStorage.removeItem('demo_user')
      return
    }
    await supabase!.auth.signOut()
    localStorage.removeItem('demo_user')
  }

  return (
    <AuthContext.Provider value={{ session, user, loading, demoMode: isDemoMode, signIn, signInWithPin, signInAsDemo, signOut, splashDone, setSplashDone }}>
      {children}
    </AuthContext.Provider>
  )
}
