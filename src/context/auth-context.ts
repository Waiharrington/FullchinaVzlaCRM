import { createContext, useContext } from 'react'
import type { Session } from '@supabase/supabase-js'

export interface User {
  id: string
  email: string
  role: 'owner' | 'manager' | 'cashier'
}

export interface AuthContextType {
  session: Session | null
  user: User | null
  loading: boolean
  splashDone: boolean
  setSplashDone: (val: boolean) => void
  signIn: (email: string, password: string) => Promise<{ error?: string }>
  signInWithPin: (pin: string) => Promise<{ error?: string }>
  signOut: () => Promise<void>
}

export const AuthContext = createContext<AuthContextType | null>(null)

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used within AuthProvider')
  return context
}
