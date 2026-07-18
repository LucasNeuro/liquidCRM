import { createContext, useContext, useState, type ReactNode } from 'react'

interface SuperAgentContextValue {
  isSuperAgentOpen: boolean
  openSuperAgent: () => void
  closeSuperAgent: () => void
  toggleSuperAgent: () => void
}

const SuperAgentContext = createContext<SuperAgentContextValue | undefined>(undefined)

export function SuperAgentProvider({ children }: { children: ReactNode }) {
  const [isSuperAgentOpen, setIsSuperAgentOpen] = useState(false)

  const openSuperAgent = () => setIsSuperAgentOpen(true)
  const closeSuperAgent = () => setIsSuperAgentOpen(false)
  const toggleSuperAgent = () => setIsSuperAgentOpen((prev) => !prev)

  return (
    <SuperAgentContext.Provider
      value={{ isSuperAgentOpen, openSuperAgent, closeSuperAgent, toggleSuperAgent }}
    >
      {children}
    </SuperAgentContext.Provider>
  )
}

export function useSuperAgent() {
  const ctx = useContext(SuperAgentContext)
  if (!ctx) {
    throw new Error('useSuperAgent deve ser usado dentro de SuperAgentProvider')
  }
  return ctx
}
