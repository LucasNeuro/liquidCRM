import { supabase } from './supabase'

const SUPABASE_URL = (import.meta.env.VITE_SUPABASE_URL || '').replace(/\/$/, '')
const FUNCTIONS_BASE =
  import.meta.env.VITE_SUPABASE_FUNCTIONS_URL?.replace(/\/$/, '') ||
  (SUPABASE_URL ? `${SUPABASE_URL}/functions/v1` : '')

const LOCAL_AI_URL =
  import.meta.env.VITE_AI_PROXY_URL?.replace(/\/$/, '') ||
  'http://127.0.0.1:8787'

/** Em dev, usa gateway local (GEMINI_API_KEY do .env). Em prod, Edge Functions. */
const PREFER_LOCAL =
  import.meta.env.DEV ||
  import.meta.env.VITE_AI_PREFER_LOCAL === 'true'

export type ClassificationResult = {
  intent: string
  sentiment: string
  labels: string[]
  score: number
  summary: string
  confidence: number
  model_name: string
  raw_response?: unknown
}

export type LeadInsightResult = {
  titulo?: string
  resumo: string
  proximo_passo: string
  riscos: string[]
  evidencias: string[]
  markdown?: string
  model_name: string
  raw_response?: unknown
  rag_chunks_used?: number
}

type EdgeName = 'lead-insight' | 'lead-classify' | 'embed-crm-batch'

async function callLocal<T>(
  path: string,
  body: unknown,
  authToken?: string,
): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }
  if (authToken) {
    headers.Authorization = `Bearer ${authToken}`
    headers.apikey = import.meta.env.VITE_SUPABASE_ANON_KEY || ''
  }

  const response = await fetch(`${LOCAL_AI_URL}${path}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  })

  let data: { error?: string } = {}
  try {
    data = await response.json()
  } catch {
    throw new Error(
      `Gateway IA local sem JSON (HTTP ${response.status}). Rode npm run dev.`,
    )
  }

  if (!response.ok) {
    throw new Error(
      data?.error ||
        `Falha no gateway IA local (HTTP ${response.status}). Confira GEMINI_API_KEY no .env.`,
    )
  }
  return data as T
}

async function callEdge<T>(name: EdgeName, body: unknown): Promise<T> {
  if (!FUNCTIONS_BASE) {
    throw new Error('URL das Edge Functions ausente')
  }

  const { data: sessionData } = await supabase.auth.getSession()
  const token =
    sessionData.session?.access_token ||
    import.meta.env.VITE_SUPABASE_ANON_KEY ||
    ''

  const response = await fetch(`${FUNCTIONS_BASE}/${name}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      apikey: import.meta.env.VITE_SUPABASE_ANON_KEY || '',
    },
    body: JSON.stringify(body),
  })

  let data: { error?: string; msg?: string } = {}
  try {
    data = await response.json()
  } catch {
    throw new Error(`Edge Function ${name} respondeu sem JSON (HTTP ${response.status})`)
  }

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error(
        `Edge Function "${name}" não encontrada (deploy: npx supabase functions deploy ${name})`,
      )
    }
    throw new Error(
      data?.error ||
        data?.msg ||
        `Edge Function ${name} (HTTP ${response.status})`,
    )
  }
  return data as T
}

async function invokeFunction<T>(
  name: 'lead-insight' | 'lead-classify',
  body: unknown,
  localPath: string,
): Promise<T> {
  const errors: string[] = []

  if (PREFER_LOCAL) {
    try {
      return await callLocal<T>(localPath, body)
    } catch (err) {
      errors.push(err instanceof Error ? err.message : String(err))
    }
  }

  if (FUNCTIONS_BASE) {
    try {
      return await callEdge<T>(name, body)
    } catch (err) {
      errors.push(err instanceof Error ? err.message : String(err))
    }
  }

  if (!PREFER_LOCAL) {
    try {
      return await callLocal<T>(localPath, body)
    } catch (err) {
      errors.push(err instanceof Error ? err.message : String(err))
    }
  }

  throw new Error(
    errors.filter(Boolean).join(' · ') ||
      'Nenhum backend de IA disponível (gateway local ou Edge Function).',
  )
}

/** Classificação — agente lead-classify */
export function classifyLead(input: { text: string; leadName?: string }) {
  return invokeFunction<ClassificationResult>(
    'lead-classify',
    input,
    '/ai/classify',
  )
}

/** Insight — agente lead-insight */
export function generateLeadInsight(leadContext: unknown) {
  return invokeFunction<LeadInsightResult>(
    'lead-insight',
    { leadContext },
    '/ai/insight',
  )
}

export type EmbedBatchResult = {
  ok: boolean
  job_id?: string
  total_sources?: number
  embedded_count?: number
  skipped_count?: number
  model_name?: string
  estimated_cost_usd?: number
  error?: string
}

/** Indexação pgvector — sempre via Edge embed-crm-batch (precisa deploy + MISTRAL_API_KEY). */
export async function runEmbedCrmBatch(
  trigger_source: 'manual' | 'cron' = 'manual',
) {
  const { data: sessionData } = await supabase.auth.getSession()
  const token =
    sessionData.session?.access_token ||
    import.meta.env.VITE_SUPABASE_ANON_KEY ||
    ''

  const errors: string[] = []

  // 1) Edge Functions (produção e local após deploy)
  if (FUNCTIONS_BASE) {
    try {
      return await callEdge<EmbedBatchResult>('embed-crm-batch', {
        trigger_source,
      })
    } catch (err) {
      errors.push(err instanceof Error ? err.message : String(err))
    }
  }

  // 2) Gateway local faz proxy para a mesma Edge (npm run ai)
  try {
    return await callLocal<EmbedBatchResult>(
      '/ai/embed-batch',
      { trigger_source },
      token,
    )
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    if (!/Rota não encontrada/i.test(msg)) errors.push(msg)
  }

  throw new Error(
    [
      'Não foi possível indexar (embed-crm-batch).',
      'Deploy: npx supabase functions deploy embed-crm-batch',
      'Secret: MISTRAL_API_KEY no Supabase',
      ...errors.slice(0, 2),
    ]
      .filter(Boolean)
      .join(' · '),
  )
}

export async function checkAiProxyHealth() {
  try {
    const response = await fetch(`${LOCAL_AI_URL}/health`)
    if (response.ok) {
      const data = (await response.json()) as {
        ok: boolean
        gemini?: boolean
        mode?: string
      }
      return { ...data, mode: data.mode || 'local-gateway' }
    }
  } catch {
    /* ignore */
  }

  if (FUNCTIONS_BASE && !PREFER_LOCAL) {
    return { ok: true as const, mode: 'edge-functions' as const }
  }

  return { ok: false as const }
}
