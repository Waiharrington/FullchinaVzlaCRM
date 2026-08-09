import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { getExchangeRates } from '../lib/rates'
import { RatesContext } from './rates-context'

export function RatesProvider({ children }: { children: ReactNode }) {
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
    void loadRates()
  }, [loadRates])

  const refresh = useCallback(async () => {
    await loadRates(true)
  }, [loadRates])

  const value = useMemo(() => ({ bcvRate, updatedAt, loading, stale, error, refresh }), [bcvRate, updatedAt, loading, stale, error, refresh])

  return <RatesContext.Provider value={value}>{children}</RatesContext.Provider>
}
