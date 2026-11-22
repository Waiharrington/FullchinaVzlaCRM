import { useRef, useState, useEffect, type Dispatch, type SetStateAction } from 'react'
import { customerSupabase, subscribeToDataChanges, stopCustomerDataChangeFeed, startCustomerDataChangeFeed } from '../../lib/supabase'
import { FAVORITES_KEY } from '../../lib/publicMenuConfig'
import { syncCustomerFavorites, getCustomerFavorites } from '../../lib/customerFavorites'

interface UseFavoritesArgs {
  favoriteIds: string[]
  setFavoriteIds: Dispatch<SetStateAction<string[]>>
}

export function useFavorites({ favoriteIds, setFavoriteIds }: UseFavoritesArgs) {
  const favoriteIdsRef = useRef(favoriteIds)
  const remoteFavoriteSyncRef = useRef(false)
  const [favoriteAccountId, setFavoriteAccountId] = useState<string | null>(null)
  const [favoriteStorageMode, setFavoriteStorageMode] = useState<'loading' | 'guest' | 'account'>(customerSupabase ? 'loading' : 'guest')
  const [favoriteSyncReady, setFavoriteSyncReady] = useState(false)
  const favoriteSyncSequence = useRef(0)
  useEffect(() => { favoriteIdsRef.current = favoriteIds }, [favoriteIds])
  useEffect(() => {
    if (favoriteStorageMode === 'guest') {
      try { localStorage.setItem(FAVORITES_KEY, JSON.stringify(favoriteIds)) } catch { /* el menú sigue funcionando sin almacenamiento */ }
      return
    }
    if (favoriteStorageMode !== 'account' || !favoriteAccountId) return
    const accountKey = `${FAVORITES_KEY}:${favoriteAccountId}`
    try { localStorage.setItem(accountKey, JSON.stringify(favoriteIds)) } catch { /* la cuenta sigue sincronizando en línea */ }
    if (remoteFavoriteSyncRef.current) { remoteFavoriteSyncRef.current = false; return }
    if (!favoriteSyncReady) return
    void syncCustomerFavorites(favoriteIds).catch(() => undefined)
  }, [favoriteAccountId, favoriteIds, favoriteStorageMode, favoriteSyncReady])
  useEffect(() => {
    if (favoriteStorageMode !== 'account' || !favoriteAccountId) return
    let active = true
    const unsubscribe = subscribeToDataChanges(table => {
      if (table !== 'customer_favorites') return
      void getCustomerFavorites().then(nextFavorites => {
        if (!active) return
        const current = [...favoriteIdsRef.current].sort()
        const incoming = [...nextFavorites].sort()
        if (current.length === incoming.length && current.every((key, index) => key === incoming[index])) return
        remoteFavoriteSyncRef.current = true
        favoriteIdsRef.current = nextFavorites
        setFavoriteIds(nextFavorites)
      }).catch(() => undefined)
    })
    return () => { active = false; unsubscribe() }
  }, [favoriteAccountId, favoriteStorageMode, setFavoriteIds])
  useEffect(() => {
    if (!customerSupabase) return
    const customerClient = customerSupabase
    let active = true
    const localKeys = (key: string) => {
      try {
        const value: unknown = JSON.parse(localStorage.getItem(key) || '[]')
        return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []
      } catch { return [] }
    }
    const applySession = async (userId: string | null) => {
      if (!active) return
      const sequence = ++favoriteSyncSequence.current
      setFavoriteSyncReady(false)
      if (!userId) {
        stopCustomerDataChangeFeed()
        if (!active || sequence !== favoriteSyncSequence.current) return
        const guestFavorites = localKeys(FAVORITES_KEY)
        setFavoriteAccountId(null)
        setFavoriteIds(guestFavorites)
        setFavoriteStorageMode('guest')
        return
      }
      startCustomerDataChangeFeed(userId)
      const accountKey = `${FAVORITES_KEY}:${userId}`
      const importedGuestKey = `${FAVORITES_KEY}:imported:${userId}`
      const guestFavorites = localKeys(FAVORITES_KEY)
      const cachedAccountFavorites = localKeys(accountKey)
      const importedGuestFavorites = localKeys(importedGuestKey)
      let hasImportedGuestFavorites = false
      try { hasImportedGuestFavorites = localStorage.getItem(importedGuestKey) !== null } catch { /* continúa con favoritos en memoria */ }
      const newGuestFavorites = guestFavorites.filter(key => !importedGuestFavorites.includes(key))
      const removedGuestFavorites = importedGuestFavorites.filter(key => !guestFavorites.includes(key))
      let mergedFavorites = hasImportedGuestFavorites
        ? [...new Set([...favoriteIdsRef.current, ...newGuestFavorites])]
        : [...new Set([...cachedAccountFavorites, ...guestFavorites, ...favoriteIdsRef.current])]
      try {
        const serverFavorites = await getCustomerFavorites()
        if (!active || sequence !== favoriteSyncSequence.current) return
        mergedFavorites = hasImportedGuestFavorites
          ? [...new Set([...serverFavorites, ...newGuestFavorites])].filter(key => !removedGuestFavorites.includes(key))
          : [...new Set([...serverFavorites, ...mergedFavorites])]
        const syncedFavorites = await syncCustomerFavorites(mergedFavorites)
        if (!active || sequence !== favoriteSyncSequence.current) return
        mergedFavorites = syncedFavorites
        try { localStorage.setItem(importedGuestKey, JSON.stringify(guestFavorites)) } catch { /* la sincronización remota ya quedó guardada */ }
        setFavoriteSyncReady(true)
      } catch {
        if (!active || sequence !== favoriteSyncSequence.current) return
        // Mantiene visibles los favoritos del dispositivo y los de esta cuenta;
        // el efecto de persistencia vuelve a intentar la sincronización.
      }
      setFavoriteAccountId(userId)
      setFavoriteIds(mergedFavorites)
      setFavoriteStorageMode('account')
    }
    const { data } = customerClient.auth.onAuthStateChange((_event, session) => {
      window.setTimeout(() => { void applySession(session?.user.id ?? null) }, 0)
    })
    const refreshFavorites = () => {
      if (document.visibilityState === 'hidden') return
      void customerClient.auth.getSession().then(({ data: sessionData }) => applySession(sessionData.session?.user.id ?? null)).catch(() => undefined)
    }
    void customerClient.auth.getSession().then(({ data: sessionData }) => applySession(sessionData.session?.user.id ?? null)).catch(() => applySession(null))
    window.addEventListener('focus', refreshFavorites)
    window.addEventListener('pageshow', refreshFavorites)
    document.addEventListener('visibilitychange', refreshFavorites)
    return () => {
      active = false
      stopCustomerDataChangeFeed()
      data.subscription.unsubscribe()
      window.removeEventListener('focus', refreshFavorites)
      window.removeEventListener('pageshow', refreshFavorites)
      document.removeEventListener('visibilitychange', refreshFavorites)
    }
  }, [setFavoriteIds])

  const toggleFavorite = (groupKey: string) => setFavoriteIds(current => current.includes(groupKey) ? current.filter(id => id !== groupKey) : [...current, groupKey])
  return { toggleFavorite }
}
