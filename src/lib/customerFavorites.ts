import { customerSupabase } from './supabase'

const syncQueues = new Map<string, Promise<string[]>>()

/** Reads the signed-in customer's saved public-menu favorite group keys. */
export async function getCustomerFavorites(): Promise<string[]> {
  if (!customerSupabase) throw new Error('Los favoritos de la cuenta no están disponibles ahora.')
  const { data: sessionData, error: sessionError } = await customerSupabase.auth.getSession()
  if (sessionError) throw sessionError
  if (!sessionData.session) return []
  const userId = sessionData.session.user.id
  await syncQueues.get(userId)?.catch(() => [])
  const { data: currentSessionData, error: currentSessionError } = await customerSupabase.auth.getSession()
  if (currentSessionError) throw currentSessionError
  if (currentSessionData.session?.user.id !== userId) throw new Error('La sesión cambió al cargar tus favoritos.')

  const { data, error } = await customerSupabase.rpc('fn_get_customer_favorites')
  if (error) throw error
  return Array.isArray(data) ? data.map(String) : []
}

/** Replaces the signed-in customer's favorite list atomically. */
export async function syncCustomerFavorites(favoriteKeys: string[]): Promise<string[]> {
  if (!customerSupabase) throw new Error('Los favoritos de la cuenta no están disponibles ahora.')
  const customerClient = customerSupabase
  const { data: sessionData, error: sessionError } = await customerClient.auth.getSession()
  if (sessionError) throw sessionError
  if (!sessionData.session) throw new Error('Inicia sesión para sincronizar tus favoritos.')
  const userId = sessionData.session.user.id
  const keys = [...new Set(favoriteKeys.map(key => key.trim()).filter(Boolean))]
  const previous = syncQueues.get(userId)
  const current = (previous ? previous.catch(() => []) : Promise.resolve([])).then(async () => {
    const { data: currentSessionData, error: currentSessionError } = await customerClient.auth.getSession()
    if (currentSessionError) throw currentSessionError
    if (currentSessionData.session?.user.id !== userId) throw new Error('La sesión cambió al sincronizar tus favoritos.')
    const { data, error } = await customerClient.rpc('fn_sync_customer_favorites', { p_favorite_keys: keys })
    if (error) throw error
    return Array.isArray(data) ? data.map(String) : []
  })
  syncQueues.set(userId, current)

  try { return await current }
  finally { if (syncQueues.get(userId) === current) syncQueues.delete(userId) }
}
