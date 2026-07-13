import { supabase } from './supabase'

/** Cargos pré-setados em profiles.role (ENUM ou text). */
export type ProfileRole = 'owner' | 'consultor'

export const PROFILE_ROLES: { value: ProfileRole; label: string }[] = [
  { value: 'owner', label: 'Owner (plataforma)' },
  { value: 'consultor', label: 'Consultor (vendas)' },
]

export type Profile = {
  id: string
  full_name: string
  email: string
  role: ProfileRole
  active?: boolean
  created_at?: string
}

function normalizeRole(role: unknown): ProfileRole {
  const r = String(role ?? '')
    .trim()
    .toLowerCase()
  return r === 'owner' ? 'owner' : 'consultor'
}

function normalizeProfile(row: Record<string, unknown> | null): Profile | null {
  if (!row?.id) return null
  return {
    id: String(row.id),
    full_name: String(row.full_name ?? ''),
    email: String(row.email ?? ''),
    role: normalizeRole(row.role),
    active: row.active === false ? false : true,
    created_at: row.created_at ? String(row.created_at) : undefined,
  }
}

export async function fetchMyProfile(
  userId: string,
  email?: string | null,
) {
  const cols = 'id, full_name, email, role, active, created_at'

  let data: Record<string, unknown> | null = null
  let error: { message: string } | null = null

  {
    const res = await supabase
      .from('profiles')
      .select(cols)
      .eq('id', userId)
      .maybeSingle()
    data = (res.data as Record<string, unknown> | null) ?? null
    error = res.error
  }

  // Coluna active pode não existir se migrate-plataforma não rodou
  if (error && /active|column/i.test(error.message)) {
    const fallback = await supabase
      .from('profiles')
      .select('id, full_name, email, role, created_at')
      .eq('id', userId)
      .maybeSingle()
    data = (fallback.data as Record<string, unknown> | null) ?? null
    error = fallback.error
  }

  if (error) throw new Error(error.message)

  let profile = normalizeProfile(data)

  // Fallback por e-mail (caso raro de id dessincronizado)
  if (!profile && email) {
    const byEmail = await supabase
      .from('profiles')
      .select('id, full_name, email, role, created_at')
      .ilike('email', email.trim())
      .maybeSingle()
    if (byEmail.error) throw new Error(byEmail.error.message)
    profile = normalizeProfile(byEmail.data as Record<string, unknown> | null)
  }

  return profile
}

export async function fetchProfiles() {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, full_name, email, role, active, created_at')
    .order('created_at', { ascending: false })

  if (error && /active|column/i.test(error.message)) {
    const fallback = await supabase
      .from('profiles')
      .select('id, full_name, email, role, created_at')
      .order('created_at', { ascending: false })
    if (fallback.error) throw new Error(fallback.error.message)
    return (fallback.data ?? [])
      .map((row) => normalizeProfile(row as Record<string, unknown>))
      .filter(Boolean) as Profile[]
  }

  if (error) throw new Error(error.message)
  return (data ?? [])
    .map((row) => normalizeProfile(row as Record<string, unknown>))
    .filter(Boolean) as Profile[]
}

export async function manageUser(body: Record<string, unknown>) {
  const base = (import.meta.env.VITE_SUPABASE_URL || '').replace(/\/$/, '')
  const functionsBase =
    import.meta.env.VITE_SUPABASE_FUNCTIONS_URL?.replace(/\/$/, '') ||
    (base ? `${base}/functions/v1` : '')
  if (!functionsBase) throw new Error('URL Edge Functions ausente')

  const { data: sessionData } = await supabase.auth.getSession()
  const token =
    sessionData.session?.access_token ||
    import.meta.env.VITE_SUPABASE_ANON_KEY ||
    ''

  const response = await fetch(`${functionsBase}/manage-users`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      apikey: import.meta.env.VITE_SUPABASE_ANON_KEY || '',
    },
    body: JSON.stringify(body),
  })

  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(data?.error || `manage-users HTTP ${response.status}`)
  }
  return data
}

export async function fetchAiUsageSummary() {
  // Prefer view agregada (tempo real / barato)
  const view = await supabase.from('v_ai_cost_resumo').select('*').maybeSingle()
  if (!view.error && view.data) {
    return {
      geminiCost: Number(view.data.gemini_cost_usd || 0),
      mistralCost: Number(view.data.mistral_cost_usd || 0),
      totalCost: Number(view.data.total_cost_usd || 0),
      chunksIndexed: Number(view.data.chunks_indexed || 0),
      events: [] as Array<Record<string, unknown>>,
      missing: false as const,
      fromView: true as const,
    }
  }

  const { data, error } = await supabase
    .from('ai_usage_events')
    .select('provider, estimated_cost_usd, operation, created_at')
    .order('created_at', { ascending: false })
    .limit(500)

  if (error) {
    if (/ai_usage_events|v_ai_cost|does not exist/i.test(error.message)) {
      return {
        geminiCost: 0,
        mistralCost: 0,
        totalCost: 0,
        chunksIndexed: 0,
        events: [] as Array<Record<string, unknown>>,
        missing: true as const,
        fromView: false as const,
      }
    }
    throw new Error(error.message)
  }

  const events = data ?? []
  let geminiCost = 0
  let mistralCost = 0
  for (const e of events) {
    const c = Number(e.estimated_cost_usd || 0)
    if (e.provider === 'gemini') geminiCost += c
    if (e.provider === 'mistral') mistralCost += c
  }
  return {
    geminiCost,
    mistralCost,
    totalCost: geminiCost + mistralCost,
    chunksIndexed: 0,
    events,
    missing: false as const,
    fromView: false as const,
  }
}
