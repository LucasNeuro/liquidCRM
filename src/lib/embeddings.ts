import { supabase } from './supabase'

export type EmbeddingJob = {
  id: string
  status: 'running' | 'success' | 'error'
  trigger_source: string
  total_sources: number
  embedded_count: number
  skipped_count: number
  error_message: string | null
  started_at: string
  finished_at: string | null
  estimated_cost_usd?: number | null
  meta: Record<string, unknown> | null
}

export async function fetchEmbeddingJobs(limit = 12) {
  const { data, error } = await supabase
    .from('embedding_jobs')
    .select('*')
    .order('started_at', { ascending: false })
    .limit(limit)
  if (error) throw new Error(error.message)
  return (data ?? []) as EmbeddingJob[]
}

export async function fetchEmbeddingStats() {
  const { count, error } = await supabase
    .from('crm_embeddings')
    .select('*', { count: 'exact', head: true })
  if (error) {
    if (/crm_embeddings|relation|does not exist|vector/i.test(error.message)) {
      return { total: 0, missingSchema: true as const }
    }
    throw new Error(error.message)
  }
  return { total: count ?? 0, missingSchema: false as const }
}
