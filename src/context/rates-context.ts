import { createContext, useContext } from 'react'

export interface RatesContextValue {
  bcvRate: number | null
  updatedAt: string | null
  loading: boolean
  stale: boolean
  error: boolean
  refresh: () => Promise<void>
}

export const RatesContext = createContext<RatesContextValue | null>(null)

export function useRates() {
  const context = useContext(RatesContext)
  if (!context) throw new Error('useRates must be used within RatesProvider')
  return context
}
