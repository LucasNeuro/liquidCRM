import { supabase } from './supabase'

export type PipelineKind = 'leads' | 'negocios'

export type Pipeline = {
  id: string
  name: string
  is_default: boolean
  kind?: PipelineKind
  created_at?: string
}

export type PipelineStage = {
  id: string
  pipeline_id: string
  name: string
  position: number
  color: string | null
}

export async function fetchPipelines(kind: PipelineKind = 'leads') {
  const { data, error } = await supabase
    .from('pipelines')
    .select('*')
    .eq('kind', kind)
    .order('created_at', { ascending: true })

  if (error) {
    // fallback se coluna kind ainda não existir
    const fallback = await supabase
      .from('pipelines')
      .select('*')
      .order('created_at', { ascending: true })
    if (fallback.error) throw new Error(fallback.error.message)
    if (kind === 'leads') return (fallback.data ?? []) as Pipeline[]
    return [] as Pipeline[]
  }
  return (data ?? []) as Pipeline[]
}

export async function fetchStages(pipelineId: string) {
  const { data, error } = await supabase
    .from('pipeline_stages')
    .select('*')
    .eq('pipeline_id', pipelineId)
    .order('position', { ascending: true })
  if (error) throw new Error(error.message)
  return (data ?? []) as PipelineStage[]
}

export async function createPipeline(
  name: string,
  kind: PipelineKind = 'leads',
) {
  const { data, error } = await supabase
    .from('pipelines')
    .insert({ name, is_default: false, kind })
    .select('*')
    .single()
  if (error) throw new Error(error.message)

  const defaults =
    kind === 'negocios'
      ? ['Novos', 'Qualificando', 'Qualificado', 'Proposta', 'Ganho', 'Perdido']
      : ['Novo', 'Em contato', 'Qualificado', 'Ganho', 'Perdido']

  const colors =
    kind === 'negocios'
      ? ['#94a3b8', '#3b82f6', '#f7941d', '#a855f7', '#22c55e', '#ef4444']
      : ['#94a3b8', '#3b82f6', '#f7941d', '#22c55e', '#ef4444']

  const { error: stageError } = await supabase.from('pipeline_stages').insert(
    defaults.map((stageName, index) => ({
      pipeline_id: data.id,
      name: stageName,
      position: index,
      color: colors[index],
    })),
  )
  if (stageError) throw new Error(stageError.message)
  return data as Pipeline
}

export async function createStage(pipelineId: string, name: string) {
  const { data: existing } = await supabase
    .from('pipeline_stages')
    .select('position')
    .eq('pipeline_id', pipelineId)
    .order('position', { ascending: false })
    .limit(1)

  const nextPos = (existing?.[0]?.position ?? -1) + 1
  const { data, error } = await supabase
    .from('pipeline_stages')
    .insert({
      pipeline_id: pipelineId,
      name,
      position: nextPos,
      color: '#f7941d',
    })
    .select('*')
    .single()
  if (error) throw new Error(error.message)
  return data as PipelineStage
}

export async function updatePipeline(
  id: string,
  patch: { name?: string; is_default?: boolean },
) {
  const { error } = await supabase.from('pipelines').update(patch).eq('id', id)
  if (error) throw new Error(error.message)
}

export async function deletePipeline(id: string) {
  const { error } = await supabase.from('pipelines').delete().eq('id', id)
  if (error) throw new Error(error.message)
}

export async function updateStage(
  id: string,
  patch: { name?: string; color?: string | null; position?: number },
) {
  const { error } = await supabase
    .from('pipeline_stages')
    .update(patch)
    .eq('id', id)
  if (error) throw new Error(error.message)
}

export async function deleteStage(id: string) {
  const { error } = await supabase.from('pipeline_stages').delete().eq('id', id)
  if (error) throw new Error(error.message)
}

export async function updateLeadStage(input: {
  idLead: number
  stageId: string
  stageName: string
  pipelineId: string
}) {
  const { error } = await supabase
    .from('leads')
    .update({
      stage_id: input.stageId,
      status: input.stageName,
      pipeline_id: input.pipelineId,
    })
    .eq('id_lead', input.idLead)
  if (error) throw new Error(error.message)
}
