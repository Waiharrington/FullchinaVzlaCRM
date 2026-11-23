import { supabase } from '../supabase'

export function client() {
  if (!supabase) throw new Error('Supabase no está configurado (revisa el .env)')
  return supabase
}

// --- Productos ---------------------------------------------------------------

export function getErrorMessage(e: unknown, fallback = 'Error inesperado'): string {
  if (!e) return fallback
  if (typeof e === 'string') return e
  if (e instanceof Error && e.message) return e.message
  const obj = e as Record<string, unknown>
  if (typeof obj.message === 'string' && obj.message) return obj.message
  if (typeof obj.error_description === 'string' && obj.error_description) return obj.error_description
  if (typeof obj.details === 'string' && obj.details) return `${obj.message ? `${obj.message}: ` : ''}${obj.details}`
  return fallback
}

