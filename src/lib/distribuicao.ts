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
  if (lErr && !/assigned_to/i.test(lErr.message)) throw new Error(lErr.message)

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
  let q = supabase
    .from('leads')
    .select('*')
    .is('archived_at', null)
    .order('id_lead', { ascending: true })

  const { data, error } = await q
  if (error) {
    if (/archived_at/i.test(error.message)) {
      const fb = await supabase.from('leads').select('*').order('id_lead')
      if (fb.error) throw new Error(fb.error.message)
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
    if (/assigned_to/i.test(error.message)) return [] as Lead[]
    throw new Error(error.message)
  }
  return (data ?? []) as Lead[]
}

export async function assignLead(
  idLead: number,
  consultorId: string | null,
) {
  const { error } = await supabase
    .from('leads')
    .update({ assigned_to: consultorId })
    .eq('id_lead', idLead)
  if (error) throw new Error(error.message)
}

/** Atribui vários leads a um consultor (ou limpa com null). */
export async function assignLeadsBulk(
  idLeads: number[],
  consultorId: string | null,
) {
  if (idLeads.length === 0) return
  const { error } = await supabase
    .from('leads')
    .update({ assigned_to: consultorId })
    .in('id_lead', idLeads)
  if (error) throw new Error(error.message)
}

/** Round-robin nos consultores: agrupa e atualiza em lote (mais rápido). */
export async function redistributeRoundRobin(
  idLeads: number[],
  consultorIds: string[],
) {
  if (idLeads.length === 0 || consultorIds.length === 0) return

  const buckets = new Map<string, number[]>()
  for (let i = 0; i < idLeads.length; i++) {
    const target = consultorIds[i % consultorIds.length]!
    const list = buckets.get(target)
    if (list) list.push(idLeads[i]!)
    else buckets.set(target, [idLeads[i]!])
  }

  await Promise.all(
    [...buckets.entries()].map(([consultorId, ids]) =>
      assignLeadsBulk(ids, consultorId),
    ),
  )
}
