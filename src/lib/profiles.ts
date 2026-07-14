import { supabase } from './supabase'
import {
  normalizeMenuAccess,
  type MenuAccess,
} from './menuAccess'

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
  menu_access?: MenuAccess
}

/** true = pode usar o CRM; false/pendente = aguardando owner. */
export function isProfileActive(active: unknown): boolean {
  if (active === false || active === 0 || active === '0') return false
  if (active === 'false' || active === 'f' || active === 'F') return false
  return true
}

function normalizeRole(role: unknown): ProfileRole {
  const r = String(role ?? '')
    .trim()
    .toLowerCase()
  // legado DB: 'agente' = consultor de vendas
  if (r === 'owner') return 'owner'
  return 'consultor'
}

function normalizeProfile(row: Record<string, unknown> | null): Profile | null {
  if (!row?.id) return null
  const role = normalizeRole(row.role)
  return {
    id: String(row.id),
    full_name: String(row.full_name ?? ''),
    email: String(row.email ?? ''),
    role,
    active: isProfileActive(row.active),
    created_at: row.created_at ? String(row.created_at) : undefined,
    menu_access: normalizeMenuAccess(row.menu_access, role),
  }
}

/** Exposto para Realtime (AuthContext) aplicar UPDATE de profiles. */
export function normalizeProfileRow(
  row: Record<string, unknown> | null,
): Profile | null {
  return normalizeProfile(row)
}

const PROFILE_COLS =
  'id, full_name, email, role, active, created_at, menu_access'
const PROFILE_COLS_NO_MENU =
  'id, full_name, email, role, active, created_at'
const PROFILE_COLS_MIN = 'id, full_name, email, role, created_at'

export async function fetchMyProfile(
  userId: string,
  email?: string | null,
) {
  let data: Record<string, unknown> | null = null
  let error: { message: string } | null = null

  {
    const res = await supabase
      .from('profiles')
      .select(PROFILE_COLS)
      .eq('id', userId)
      .maybeSingle()
    data = (res.data as Record<string, unknown> | null) ?? null
    error = res.error
  }

  if (error && /menu_access|column/i.test(error.message)) {
    const fb = await supabase
      .from('profiles')
      .select(PROFILE_COLS_NO_MENU)
      .eq('id', userId)
      .maybeSingle()
    data = (fb.data as Record<string, unknown> | null) ?? null
    error = fb.error
  }

  if (error && /active|column/i.test(error.message)) {
    const fallback = await supabase
      .from('profiles')
      .select(PROFILE_COLS_MIN)
      .eq('id', userId)
      .maybeSingle()
    data = (fallback.data as Record<string, unknown> | null) ?? null
    error = fallback.error
  }

  if (error) throw new Error(error.message)

  let profile = normalizeProfile(data)

  if (!profile && email) {
    const byEmail = await supabase
      .from('profiles')
      .select(PROFILE_COLS)
      .ilike('email', email.trim())
      .maybeSingle()
    if (byEmail.error && /menu_access|column/i.test(byEmail.error.message)) {
      const fb = await supabase
        .from('profiles')
        .select(PROFILE_COLS_NO_MENU)
        .ilike('email', email.trim())
        .maybeSingle()
      if (fb.error) throw new Error(fb.error.message)
      profile = normalizeProfile(fb.data as Record<string, unknown> | null)
    } else {
      if (byEmail.error) throw new Error(byEmail.error.message)
      profile = normalizeProfile(
        byEmail.data as Record<string, unknown> | null,
      )
    }
  }

  return profile
}

export async function fetchProfiles() {
  const { data, error } = await supabase
    .from('profiles')
    .select(PROFILE_COLS)
    .order('created_at', { ascending: false })

  if (error && /menu_access|column/i.test(error.message)) {
    const fb = await supabase
      .from('profiles')
      .select(PROFILE_COLS_NO_MENU)
      .order('created_at', { ascending: false })
    if (fb.error && /active|column/i.test(fb.error.message)) {
      const fallback = await supabase
        .from('profiles')
        .select(PROFILE_COLS_MIN)
        .order('created_at', { ascending: false })
      if (fallback.error) throw new Error(fallback.error.message)
      return (fallback.data ?? [])
        .map((row) => normalizeProfile(row as Record<string, unknown>))
        .filter(Boolean) as Profile[]
    }
    if (fb.error) throw new Error(fb.error.message)
    return (fb.data ?? [])
      .map((row) => normalizeProfile(row as Record<string, unknown>))
      .filter(Boolean) as Profile[]
  }

  if (error && /active|column/i.test(error.message)) {
    const fallback = await supabase
      .from('profiles')
      .select(PROFILE_COLS_MIN)
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

/**
 * Grava menu_access de forma confiável:
 * 1) Edge manage-users (service role)
 * 2) Confirma no SELECT; se não bateu, UPDATE direto (owner)
 * 3) Se a coluna não existir, erro com SQL a rodar
 */
export async function persistConsultantAccess(input: {
  userId: string
  full_name: string
  role: ProfileRole
  active: boolean
  menu_access: MenuAccess
}) {
  const menu = normalizeMenuAccess(input.menu_access, input.role)

  const edge = await manageUser({
    action: 'update',
    user_id: input.userId,
    full_name: input.full_name,
    role: input.role,
    active: input.active,
    menu_access: menu,
  })

  // Verificação + reforço direto (não confia só no flash do Edge antigo)
  const verify = await supabase
    .from('profiles')
    .select('menu_access')
    .eq('id', input.userId)
    .maybeSingle()

  if (verify.error && /menu_access|column/i.test(verify.error.message)) {
    throw new Error(
      'Coluna menu_access ainda não existe no banco. Rode supabase/migrate-fix-menu-access.sql no SQL Editor e redeploy manage-users.',
    )
  }
  if (verify.error) throw new Error(verify.error.message)

  const saved = normalizeMenuAccess(verify.data?.menu_access, input.role)
  const matches = MENU_KEYS_EQUAL(saved, menu)

  if (!matches) {
    const { error: upErr } = await supabase
      .from('profiles')
      .update({
        full_name: input.full_name,
        role: input.role,
        active: input.active,
        menu_access: menu,
      })
      .eq('id', input.userId)

    if (upErr) {
      if (/menu_access|column/i.test(upErr.message)) {
        throw new Error(
          'Coluna menu_access ausente. Rode migrate-fix-menu-access.sql no Supabase.',
        )
      }
      if (/policy|rls|permission|denied/i.test(upErr.message)) {
        throw new Error(
          'Menus não gravaram: redeploy da Edge manage-users (versão nova) e rode migrate-fix-menu-access.sql (inclui RLS owner).',
        )
      }
      throw new Error(upErr.message)
    }

    const again = await supabase
      .from('profiles')
      .select('menu_access')
      .eq('id', input.userId)
      .maybeSingle()
    if (again.error) throw new Error(again.error.message)
    const saved2 = normalizeMenuAccess(again.data?.menu_access, input.role)
    if (!MENU_KEYS_EQUAL(saved2, menu)) {
      throw new Error(
        'Salvou, mas o banco ainda devolveu o menu antigo. Confira migrate-fix-menu-access.sql e o deploy do manage-users.',
      )
    }
    return { ok: true as const, menu_access: saved2, via: 'direct' as const }
  }

  return {
    ok: true as const,
    menu_access: saved,
    via: 'edge' as const,
    edge,
  }
}

function MENU_KEYS_EQUAL(a: MenuAccess, b: MenuAccess) {
  const keys: (keyof MenuAccess)[] = [
    'dashboard',
    'leads',
    'tentativas',
    'pesquisas',
    'negocios',
    'distribuicao',
    'plataforma',
  ]
  return keys.every((k) => Boolean(a[k]) === Boolean(b[k]))
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
