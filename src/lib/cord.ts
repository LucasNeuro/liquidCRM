import { supabase } from './supabase'

export type CordMessage = {
  role: 'user' | 'assistant'
  content: string
}

export type CordPendingAction = {
  type: 'redistribute_unassigned' | 'transfer' | 'unassign_from'
  summary: string
  from_id?: string | null
  to_id?: string | null
  from_label?: string
  to_label?: string
  lead_count: number
}

export type CordChatResponse = {
  reply: string
  model?: string
  propose_redistribute?: boolean
  pending_action?: CordPendingAction | null
  sem_consultor?: number
  action_result?: unknown
  error?: string
}

export async function sendCordMessage(input: {
  message: string
  history: CordMessage[]
  confirmRedistribute?: boolean
  confirmAction?: CordPendingAction | null
  threadId?: string
}): Promise<CordChatResponse> {
  const base = (import.meta.env.VITE_SUPABASE_URL || '').replace(/\/$/, '')
  if (!base) throw new Error('VITE_SUPABASE_URL ausente')

  const { data: sessionData } = await supabase.auth.getSession()
  const token = sessionData.session?.access_token
  if (!token) throw new Error('Sessão expirada')

  const response = await fetch(`${base}/functions/v1/cord-chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      apikey: import.meta.env.VITE_SUPABASE_ANON_KEY || '',
    },
    body: JSON.stringify({
      message: input.message,
      history: input.history,
      confirm_redistribute:
        input.confirmRedistribute === true && !input.confirmAction,
      confirm_action: input.confirmAction || null,
      thread_id: input.threadId || null,
    }),
  })

  const data = (await response.json()) as CordChatResponse & { error?: string }
  if (!response.ok) {
    throw new Error(data.error || `CORD HTTP ${response.status}`)
  }
  if (data.error) throw new Error(data.error)
  return data
}
