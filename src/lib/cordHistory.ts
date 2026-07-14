import type { CordMessage } from './cord'

export type CordThread = {
  id: string
  title: string
  updatedAt: number
  messages: CordMessage[]
}

const WELCOME: CordMessage = {
  role: 'assistant',
  content:
    'Olá, eu sou o CORD. Posso falar de funil, consultores, receita do pipeline e insights. Também proponho redistribuir leads sem dono — com a sua confirmação.',
}

function storageKey(userId: string) {
  return `liqui.cord.threads.${userId}`
}

export function cordWelcomeMessage(): CordMessage {
  return { ...WELCOME }
}

export function createCordThread(seed?: CordMessage[]): CordThread {
  const now = Date.now()
  return {
    id: crypto.randomUUID(),
    title: 'Nova conversa',
    updatedAt: now,
    messages: seed?.length ? seed : [cordWelcomeMessage()],
  }
}

export function loadCordThreads(userId: string): CordThread[] {
  try {
    const raw = localStorage.getItem(storageKey(userId))
    if (!raw) return []
    const parsed = JSON.parse(raw) as CordThread[]
    if (!Array.isArray(parsed)) return []
    return parsed.sort((a, b) => b.updatedAt - a.updatedAt)
  } catch {
    return []
  }
}

export function saveCordThreads(userId: string, threads: CordThread[]) {
  try {
    localStorage.setItem(
      storageKey(userId),
      JSON.stringify(threads.slice(0, 40)),
    )
  } catch {
    /* quota */
  }
}

export function titleFromMessages(messages: CordMessage[]): string {
  const firstUser = messages.find((m) => m.role === 'user')
  if (!firstUser) return 'Nova conversa'
  const t = firstUser.content.trim().replace(/\s+/g, ' ')
  return t.length > 42 ? `${t.slice(0, 42)}…` : t
}

export function upsertCordThread(
  userId: string,
  thread: CordThread,
): CordThread[] {
  const list = loadCordThreads(userId).filter((t) => t.id !== thread.id)
  const next = [
    {
      ...thread,
      title: titleFromMessages(thread.messages),
      updatedAt: Date.now(),
    },
    ...list,
  ]
  saveCordThreads(userId, next)
  return next
}

export function deleteCordThread(userId: string, threadId: string) {
  const next = loadCordThreads(userId).filter((t) => t.id !== threadId)
  saveCordThreads(userId, next)
  return next
}
