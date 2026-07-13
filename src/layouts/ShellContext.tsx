import { createContext, useContext, useMemo, useState, type ReactNode } from 'react'

type ShellHeader = {
  title: string
  subtitle?: string
  actions?: ReactNode
}

type ShellContextValue = {
  header: ShellHeader
  setHeader: (header: ShellHeader) => void
}

const ShellContext = createContext<ShellContextValue | null>(null)

export function ShellProvider({ children }: { children: ReactNode }) {
  const [header, setHeader] = useState<ShellHeader>({
    title: 'LIQUI',
    subtitle: 'Mini CRM',
  })

  const value = useMemo(() => ({ header, setHeader }), [header])
  return (
    <ShellContext.Provider value={value}>{children}</ShellContext.Provider>
  )
}

export function useShellHeader() {
  const ctx = useContext(ShellContext)
  if (!ctx) throw new Error('useShellHeader fora do ShellProvider')
  return ctx
}
