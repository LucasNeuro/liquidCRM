import { supabase } from './supabase'
import type { Lead } from './types'

export type LeadDistributionRow = {
  consultor_id: string
  full_name: string
  email: string
  role: string
  active: boolean
  total_leads: number
  ganhos: number
  abertos: number
  perdidos: number
}

const ASSIGNED_TO_HINT =
  'Coluna leads.assigned_to ausente. Rode supabase/migrate-lead-assignment.sql no SQL Editor.'

function chunkIds<T>(arr: T[], size = 80): T[][] {
  const out: T[][] = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

export async function fetchLeadDistribution() {
  const view = await supabase
    .from('v_leads_distribuicao')
    .select('*')
    .order('total_leads', { ascending: false })

  if (!view.error && view.data) {
    return (view.data as LeadDistributionRow[]).map((r) => ({
      ...r,
      active: r.active !== false,
      total_leads: Number(r.total_leads || 0),
      ganhos: Number(r.ganhos || 0),
      abertos: Number(r.abertos || 0),
      perdidos: Number(r.perdidos || 0),
    }))
  }

  const [{ data: profiles, error: pErr }, { data: leads, error: lErr }] =
    await Promise.all([
      supabase
        .from('profiles')
        .select('id, full_name, email, role, active')
        .eq('role', 'consultor'),
      supabase.from('leads').select('id_lead, status, assigned_to, archived_at'),
    ])

  if (pErr) throw new Error(pErr.message)
  if (lErr) {
    if (/assigned_to|column/i.test(lErr.message)) {
      throw new Error(ASSIGNED_TO_HINT)
    }
    throw new Error(lErr.message)
  }

  const list = profiles ?? []
  const leadRows = (leads ?? []).filter((l) => !l.archived_at)

  return list.map((p) => {
    const mine = leadRows.filter((l) => l.assigned_to === p.id)
    const status = (s: string | null) => (s || '').toLowerCase()
    return {
      consultor_id: p.id,
      full_name: p.full_name,
      email: p.email,
      role: String(p.role),
      active: p.active !== false,
      total_leads: mine.length,
      ganhos: mine.filter((l) => status(l.status) === 'ganho').length,
      abertos: mine.filter(
        (l) => !['ganho', 'perdido'].includes(status(l.status)),
      ).length,
      perdidos: mine.filter((l) => status(l.status) === 'perdido').length,
    }
  })
}

/** Todos os leads (owner) para distribuição com seleção. */
export async function fetchAllLeadsForDistribution() {
  const { data, error } = await supabase
    .from('leads')
    .select('*')
    .is('archived_at', null)
    .order('id_lead', { ascending: true })

  if (error) {
    if (/assigned_to|column/i.test(error.message)) {
      throw new Error(ASSIGNED_TO_HINT)
    }
    if (/archived_at/i.test(error.message)) {
      const fb = await supabase.from('leads').select('*').order('id_lead')
      if (fb.error) {
        if (/assigned_to|column/i.test(fb.error.message)) {
          throw new Error(ASSIGNED_TO_HINT)
        }
        throw new Error(fb.error.message)
      }
      return (fb.data ?? []) as Lead[]
    }
    throw new Error(error.message)
  }
  return (data ?? []) as Lead[]
}

export async function fetchUnassignedLeads() {
  const { data, error } = await supabase
    .from('leads')
    .select('*')
    .is('assigned_to', null)
    .is('archived_at', null)
    .order('id_lead', { ascending: true })
    .limit(500)

  if (error) {
    if (/assigned_to|column/i.test(error.message)) {
      throw new Error(ASSIGNED_TO_HINT)
    }
    throw new Error(error.message)
  }
  return (data ?? []) as Lead[]
}

export async function assignLead(
  idLead: number,
  consultorId: string | null,
) {
  await assignLeadsBulk([idLead], consultorId)
}

/**
 * Atribui vários leads. Verifica se o UPDATE realmente afetou linhas
 * (PostgREST + RLS pode “suceder” com 0 rows).
 */
export async function assignLeadsBulk(
  idLeads: number[],
  consultorId: string | null,
) {
  if (idLeads.length === 0) return { updated: 0 }

  let updated = 0
  for (const batch of chunkIds(idLeads, 80)) {
    const { data, error } = await supabase
      .from('leads')
      .update({ assigned_to: consultorId })
      .in('id_lead', batch)
      .select('id_lead')

    if (error) {
      if (/assigned_to|column/i.test(error.message)) {
        throw new Error(ASSIGNED_TO_HINT)
      }
      if (/policy|rls|permission|denied/i.test(error.message)) {
        throw new Error(
          'Sem permissão para atribuir leads. Confirme que você é owner e rode migrate-lead-assignment.sql (RLS).',
        )
      }
      throw new Error(error.message)
    }
    updated += data?.length ?? 0
  }

  if (updated === 0) {
    throw new Error(
      'Nenhum lead foi atualizado (0 linhas). Possíveis causas: RLS bloqueando, IDs inválidos ou migrate-lead-assignment.sql não rodada.',
    )
  }

  if (updated < idLeads.length) {
    throw new Error(
      `Só ${updated} de ${idLeads.length} lead(s) foram atribuídos. Verifique RLS / IDs.`,
    )
  }

  return { updated }
}

/** Round-robin nos consultores: agrupa e atualiza em lote. */
export async function redistributeRoundRobin(
  idLeads: number[],
  consultorIds: string[],
) {
  if (idLeads.length === 0 || consultorIds.length === 0) {
    return { updated: 0 }
  }

  const buckets = new Map<string, number[]>()
  for (let i = 0; i < idLeads.length; i++) {
    const target = consultorIds[i % consultorIds.length]!
    const list = buckets.get(target)
    if (list) list.push(idLeads[i]!)
    else buckets.set(target, [idLeads[i]!])
  }

  let updated = 0
  for (const [consultorId, ids] of buckets.entries()) {
    const res = await assignLeadsBulk(ids, consultorId)
    updated += res.updated
  }
  return { updated }
}
