import { useState, useEffect, type ReactNode } from 'react'
import { AuthContext } from './auth-context'
import type { User } from './auth-context'
import { supabase, isDemoMode } from '../lib/supabase'

const DEMO_USERS: Record<string, User> = {
  owner: { id: 'demo-owner', email: 'dueña@clienta.app', role: 'owner' },
  manager: { id: 'demo-manager', email: 'encargado@clienta.app', role: 'manager' },
  cashier: { id: 'demo-cashier', email: 'cajera@clienta.app', role: 'cashier' }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<import('@supabase/supabase-js').Session | null>(null)
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

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

    supabase!.auth.getSession().then(({ data: { session: currentSession } }) => {
      setSession(currentSession)
      if (currentSession?.user) {
        setUser({
          id: currentSession.user.id,
          email: currentSession.user.email || '',
          role: 'owner'
        })
      }
      setLoading(false)
    })

    const { data: { subscription } } = supabase!.auth.onAuthStateChange(
      (_event, currentSession) => {
        setSession(currentSession)
        if (currentSession?.user) {
          setUser({
            id: currentSession.user.id,
            email: currentSession.user.email || '',
            role: 'owner'
          })
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
      return {}
    }

    const { error } = await supabase!.auth.signInWithPassword({ email, password })
    if (error) return { error: error.message }
    return {}
  }

  const signInAsDemo = (role: 'owner' | 'manager' | 'cashier') => {
    if (isDemoMode) {
      setUser(DEMO_USERS[role])
      localStorage.setItem('demo_user', JSON.stringify(DEMO_USERS[role]))
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
    <AuthContext.Provider value={{ session, user, loading, demoMode: isDemoMode, signIn, signInAsDemo, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}
