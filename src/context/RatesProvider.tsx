import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useLocation } from 'react-router-dom'
import { getExchangeRates } from '../lib/rates'
import { RatesContext } from './rates-context'

export function RatesProvider({ children }: { children: ReactNode }) {
  const location = useLocation()
  const [bcvRate, setBcvRate] = useState<number | null>(null)
  const [updatedAt, setUpdatedAt] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [stale, setStale] = useState(false)
  const [error, setError] = useState(false)

  const loadRates = useCallback(async (force = false) => {
    setLoading(true)
    const rates = await getExchangeRates({ force })
    setBcvRate(rates.bcv > 0 ? rates.bcv : null)
    setUpdatedAt(rates.updatedAt)
    setStale(rates.stale)
    setError(Boolean(rates.error))
    setLoading(false)
  }, [])

  useEffect(() => {
    // El menú público obtiene la tasa sin bloquear el catálogo. Evita una
    // segunda solicitud simultánea desde el proveedor global de la app interna.
    if (location.pathname.toLowerCase().startsWith('/pedir')) {
      setLoading(false)
      return
    }
    void loadRates()
  }, [loadRates, location.pathname])

  const refresh = useCallback(async () => {
    await loadRates(true)
  }, [loadRates])

  const value = useMemo(() => ({ bcvRate, updatedAt, loading, stale, error, refresh }), [bcvRate, updatedAt, loading, stale, error, refresh])

  return <RatesContext.Provider value={value}>{children}</RatesContext.Provider>
}
