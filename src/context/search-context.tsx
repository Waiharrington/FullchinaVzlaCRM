import { createContext, useContext, useState, useCallback, type ReactNode } from 'react'

interface SearchCtx {
  open: () => void
  close: () => void
  isOpen: boolean
}

const Ctx = createContext<SearchCtx>({ open: () => {}, close: () => {}, isOpen: false })

export function SearchProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false)
  const open = useCallback(() => setIsOpen(true), [])
  const close = useCallback(() => setIsOpen(false), [])
  return <Ctx.Provider value={{ open, close, isOpen }}>{children}</Ctx.Provider>
}

export function useSearch() {
  return useContext(Ctx)
}
