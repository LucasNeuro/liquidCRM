/**
 * embed-crm-batch — indexação RAG (Mistral + pgvector)
 * Arquivo ÚNICO (sem imports locais) para deploy Via Editor no Dashboard.
 * Secrets: MISTRAL_API_KEY (e opcional MISTRAL_EMBED_MODEL)
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.0'

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

type SourceChunk = {
  source_table: string
  source_id: string
  id_lead: number | null
  chunk_text: string
}

async function sha256Hex(text: string): Promise<string> {
  const data = new TextEncoder().encode(text)
  const hash = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

function chunkFromLead(row: Record<string, unknown>): SourceChunk {
  const id = String(row.id_lead)
  const lines = [
    `tabela=leads`,
    `id_lead=${id}`,
    `nome=${row.nome ?? ''}`,
    `email=${row.email ?? ''}`,
    `telefone=${row.telefone ?? ''}`,
    `origem=${row.origem ?? ''}`,
    `produto_interesse=${row.produto_interesse ?? ''}`,
    `status=${row.status ?? ''}`,
    `data_entrada=${row.data_entrada ?? ''}`,
    `score_gemini=${row.score_gemini ?? ''}`,
    `intent_gemini=${row.intent_gemini ?? ''}`,
  ]
  return {
    source_table: 'leads',
    source_id: id,
    id_lead: Number(row.id_lead),
    chunk_text: lines.join('\n'),
  }
}

function chunkFromTentativa(row: Record<string, unknown>): SourceChunk {
  const id = String(row.id)
  const lines = [
    `tabela=tentativas_compra`,
    `id=${id}`,
    `id_lead=${row.id_lead ?? ''}`,
    `nome=${row.nome ?? ''}`,
    `email=${row.email ?? ''}`,
    `telefone=${row.telefone ?? ''}`,
    `produto=${row.produto ?? ''}`,
    `valor=${row.valor ?? ''}`,
    `forma_pagamento=${row.forma_pagamento ?? ''}`,
    `status_pagamento=${row.status_pagamento ?? ''}`,
    `data_tentativa=${row.data_tentativa ?? ''}`,
  ]
  return {
    source_table: 'tentativas_compra',
    source_id: id,
    id_lead: row.id_lead == null ? null : Number(row.id_lead),
    chunk_text: lines.join('\n'),
  }
}

function chunkFromResposta(row: Record<string, unknown>): SourceChunk {
  const id = String(row.id)
  const lines = [
    `tabela=respostas_pesquisa`,
    `id=${id}`,
    `id_lead=${row.id_lead ?? ''}`,
    `nome=${row.nome ?? ''}`,
    `email=${row.email ?? ''}`,
    `telefone=${row.telefone ?? ''}`,
    `momento_compra=${row.momento_compra ?? ''}`,
    `principal_objecao=${row.principal_objecao ?? ''}`,
    `area_interesse=${row.area_interesse ?? ''}`,
    `nota_intencao=${row.nota_intencao ?? ''}`,
    `data_resposta=${row.data_resposta ?? ''}`,
  ]
  return {
    source_table: 'respostas_pesquisa',
    source_id: id,
    id_lead: row.id_lead == null ? null : Number(row.id_lead),
    chunk_text: lines.join('\n'),
  }
}

const MISTRAL_API_KEY = Deno.env.get('MISTRAL_API_KEY') || ''
const MISTRAL_EMBED_MODEL =
  Deno.env.get('MISTRAL_EMBED_MODEL') || 'mistral-embed'

async function mistralEmbed(texts: string[]): Promise<number[][]> {
  if (!MISTRAL_API_KEY) {
    throw new Error('MISTRAL_API_KEY ausente nos secrets')
  }
  if (!texts.length) return []

  const response = await fetch('https://api.mistral.ai/v1/embeddings', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${MISTRAL_API_KEY}`,
    },
    body: JSON.stringify({
      model: MISTRAL_EMBED_MODEL,
      input: texts,
      encoding_format: 'float',
    }),
  })

  const data = await response.json()
  if (!response.ok) {
    throw new Error(
      data?.message ||
        data?.error?.message ||
        `Mistral embed HTTP ${response.status}`,
    )
  }

  const rows = (data?.data || []) as Array<{
    embedding: number[]
    index: number
  }>
  rows.sort((a, b) => a.index - b.index)
  return rows.map((r) => r.embedding)
}

const BATCH = 16

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }
  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405)
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL') || ''
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
  if (!supabaseUrl || !serviceKey) {
    return jsonResponse(
      { error: 'SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY ausentes' },
      500,
    )
  }

  const cronSecret = Deno.env.get('CRON_SECRET') || ''
  if (cronSecret) {
    const token = (req.headers.get('Authorization') || '')
      .replace(/^Bearer\s+/i, '')
      .trim()
    const bodyPeek = await req
      .clone()
      .json()
      .catch(() => ({} as Record<string, unknown>))
    const isCron = String(bodyPeek.trigger_source || '') === 'cron'
    if (isCron && token !== cronSecret && token !== serviceKey) {
      return jsonResponse({ error: 'Unauthorized cron' }, 401)
    }
  }

  const admin = createClient(supabaseUrl, serviceKey)
  let jobId: string | null = null

  try {
    const body = await req.json().catch(() => ({}))
    const trigger_source = String(body.trigger_source || 'manual')

    const { data: job, error: jobErr } = await admin
      .from('embedding_jobs')
      .insert({
        status: 'running',
        trigger_source,
        started_at: new Date().toISOString(),
      })
      .select('id')
      .single()

    if (jobErr) throw new Error(jobErr.message)
    jobId = job.id as string

    const [leadsRes, tentRes, respRes] = await Promise.all([
      admin.from('leads').select('*').is('archived_at', null),
      admin.from('tentativas_compra').select('*').is('archived_at', null),
      admin.from('respostas_pesquisa').select('*').is('archived_at', null),
    ])

    const leads =
      leadsRes.error && /archived_at/i.test(leadsRes.error.message)
        ? (await admin.from('leads').select('*')).data ?? []
        : leadsRes.data ?? []
    const tentativas =
      tentRes.error && /archived_at/i.test(tentRes.error.message)
        ? (await admin.from('tentativas_compra').select('*')).data ?? []
        : tentRes.data ?? []
    const respostas =
      respRes.error && /archived_at/i.test(respRes.error.message)
        ? (await admin.from('respostas_pesquisa').select('*')).data ?? []
        : respRes.data ?? []

    if (leadsRes.error && !/archived_at/i.test(leadsRes.error.message)) {
      throw new Error(leadsRes.error.message)
    }

    const chunks: SourceChunk[] = [
      ...leads.map((r) => chunkFromLead(r as Record<string, unknown>)),
      ...tentativas.map((r) =>
        chunkFromTentativa(r as Record<string, unknown>),
      ),
      ...respostas.map((r) =>
        chunkFromResposta(r as Record<string, unknown>),
      ),
    ]

    const { data: existing } = await admin
      .from('crm_embeddings')
      .select('source_table, source_id, content_hash')

    const hashMap = new Map<string, string>()
    for (const row of existing ?? []) {
      hashMap.set(`${row.source_table}:${row.source_id}`, row.content_hash)
    }

    const toEmbed: Array<SourceChunk & { content_hash: string }> = []
    let skipped = 0

    for (const c of chunks) {
      const content_hash = await sha256Hex(c.chunk_text)
      const key = `${c.source_table}:${c.source_id}`
      if (hashMap.get(key) === content_hash) {
        skipped += 1
        continue
      }
      toEmbed.push({ ...c, content_hash })
    }

    let embedded = 0
    for (let i = 0; i < toEmbed.length; i += BATCH) {
      const batch = toEmbed.slice(i, i + BATCH)
      const vectors = await mistralEmbed(batch.map((b) => b.chunk_text))

      const rows = batch.map((b, idx) => ({
        source_table: b.source_table,
        source_id: b.source_id,
        id_lead: b.id_lead,
        chunk_text: b.chunk_text,
        content_hash: b.content_hash,
        embedding: vectors[idx],
        model_name: MISTRAL_EMBED_MODEL,
        updated_at: new Date().toISOString(),
      }))

      const { error: upsertErr } = await admin
        .from('crm_embeddings')
        .upsert(rows, { onConflict: 'source_table,source_id' })

      if (upsertErr) throw new Error(upsertErr.message)
      embedded += rows.length
    }

    const totalChars = toEmbed.reduce((s, c) => s + c.chunk_text.length, 0)
    const tokens = Math.max(1, Math.ceil(totalChars / 4))
    const estimated_cost_usd = Number(((tokens / 1_000_000) * 0.1).toFixed(6))

    await admin
      .from('embedding_jobs')
      .update({
        status: 'success',
        total_sources: chunks.length,
        embedded_count: embedded,
        skipped_count: skipped,
        finished_at: new Date().toISOString(),
        estimated_cost_usd,
        meta: {
          leads: leads.length,
          tentativas: tentativas.length,
          respostas: respostas.length,
          model: MISTRAL_EMBED_MODEL,
          tokens_est: tokens,
        },
      })
      .eq('id', jobId)

    if (embedded > 0) {
      await admin.from('ai_usage_events').insert({
        provider: 'mistral',
        operation: 'embed_batch',
        model_name: MISTRAL_EMBED_MODEL,
        units: tokens,
        estimated_cost_usd,
        meta: { job_id: jobId, embedded },
      })
    }

    return jsonResponse({
      ok: true,
      job_id: jobId,
      total_sources: chunks.length,
      embedded_count: embedded,
      skipped_count: skipped,
      model_name: MISTRAL_EMBED_MODEL,
      estimated_cost_usd,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro no embed'
    if (jobId) {
      await admin
        .from('embedding_jobs')
        .update({
          status: 'error',
          error_message: message,
          finished_at: new Date().toISOString(),
        })
        .eq('id', jobId)
    }
    return jsonResponse({ error: message, job_id: jobId }, 500)
  }
})
