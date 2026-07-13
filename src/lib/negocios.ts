import { supabase } from './supabase'
import type { Negocio } from './types'

export type NegocioWithLead = Negocio & {
  leads?: { nome: string; origem: string | null; telefone: string | null } | null
}

export async function fetchNegocios(includeArchived = false) {
  let q = supabase
    .from('negocios')
    .select('*, leads(nome, origem, telefone)')
    .order('created_at', { ascending: false })
  if (!includeArchived) q = q.is('archived_at', null)
  const { data, error } = await q
  if (error) {
    if (!includeArchived && /archived_at/i.test(error.message)) {
      const fallback = await supabase
        .from('negocios')
        .select('*, leads(nome, origem, telefone)')
        .order('created_at', { ascending: false })
      if (fallback.error) throw new Error(fallback.error.message)
      return (fallback.data ?? []) as NegocioWithLead[]
    }
    throw new Error(error.message)
  }
  return (data ?? []) as NegocioWithLead[]
}

export async function fetchNegociosByLead(idLead: number) {
  const { data, error } = await supabase
    .from('negocios')
    .select('*')
    .eq('id_lead', idLead)
    .is('archived_at', null)
    .order('created_at', { ascending: false })
  if (error) {
    if (/archived_at/i.test(error.message)) {
      const fallback = await supabase
        .from('negocios')
        .select('*')
        .eq('id_lead', idLead)
        .order('created_at', { ascending: false })
      if (fallback.error) throw new Error(fallback.error.message)
      return (fallback.data ?? []) as Negocio[]
    }
    throw new Error(error.message)
  }
  return (data ?? []) as Negocio[]
}

export async function updateNegocio(id: string, patch: Partial<Negocio>) {
  const { error } = await supabase.from('negocios').update(patch).eq('id', id)
  if (error) throw new Error(error.message)
}

export async function archiveNegocio(id: string) {
  const { error } = await supabase
    .from('negocios')
    .update({ archived_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw new Error(error.message)
}

export async function deleteNegocio(id: string) {
  const { error } = await supabase.from('negocios').delete().eq('id', id)
  if (error) throw new Error(error.message)
}

export async function createNegocio(input: {
  titulo: string
  idLead: number
  valor?: number
  pipelineId: string
  stageId: string
}) {
  const year = new Date().getFullYear()
  const { count } = await supabase
    .from('negocios')
    .select('*', { count: 'exact', head: true })
    .like('codigo', `NEG-${year}-%`)

  const seq = String((count ?? 0) + 1).padStart(4, '0')
  const codigo = `NEG-${year}-${seq}`

  const { data, error } = await supabase
    .from('negocios')
    .insert({
      codigo,
      titulo: input.titulo.trim(),
      id_lead: input.idLead,
      valor: input.valor ?? 0,
      pipeline_id: input.pipelineId,
      stage_id: input.stageId,
      status_negocio: 'aberto',
    })
    .select('*')
    .single()

  if (error) throw new Error(error.message)
  return data as Negocio
}

export async function updateNegocioStage(input: {
  id: string
  stageId: string
  stageName: string
  pipelineId: string
}) {
  const lower = input.stageName.toLowerCase()
  let status_negocio: Negocio['status_negocio'] = 'aberto'
  if (lower.includes('ganho')) status_negocio = 'ganho'
  else if (lower.includes('perdido')) status_negocio = 'perdido'

  const { error } = await supabase
    .from('negocios')
    .update({
      stage_id: input.stageId,
      pipeline_id: input.pipelineId,
      status_negocio,
    })
    .eq('id', input.id)

  if (error) throw new Error(error.message)
}
