/**
 * lead-insight — arquivo ÚNICO para deploy Via Editor (Dashboard).
 * Inclui skill + gemini + mistral embed (RAG) + usage + cors.
 * Secrets: GEMINI_API_KEY, MISTRAL_API_KEY (RAG opcional)
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

const LEAD_INSIGHT_SYSTEM_PROMPT = `Você é um analista de CRM da Contabilidade Facilitada / plataforma LIQUI.

Com base APENAS no JSON de contexto (lead + tentativas_compra + respostas_pesquisa), gere um insight acionável para o consultor.

REGRAS DE FIDELIDADE (avaliação — crítico):
- Use SOMENTE fatos presentes no JSON. É PROIBIDO inventar valores, datas, produtos, contatos, intenções, scores ou histórico.
- Se faltar dado, declare no resumo (ex.: "sem e-mail na base", "nenhuma tentativa vinculada").
- Se houver TRECHOS RECUPERADOS DO ÍNDICE (RAG), use-os só como evidência complementar — ainda sem inventar.
- Não "corrija" inconsistências (e-mails em caixa mista, telefones com máscara, datas VARCHAR): cite como estão.
- proximo_passo: UMA ação concreta curta, derivada só dos dados (ex.: ligar sobre pagamento pendente do produto X).
- evidencias: 3–8 itens citando campos literais (ex.: "status_pagamento=pendente", "nota_intencao=8", "origem=whatsapp").
- Se tentativas_compra ou respostas_pesquisa estiverem vazias, diga isso — não invente registros.
- Português do Brasil.
- Responda SOMENTE JSON válido (sem cercas \`\`\`).

O campo "markdown" DEVE ser um documento Markdown completo, com:
- Título (#)
- ## Resumo executivo, ## Contexto do lead, ## Tentativas de compra, ## Pesquisas, ## Sinais de intenção, ## Riscos, ## Próximo passo recomendado, ## Evidências
- Listas e negrito; se seção sem dados: "Sem registros na base."

FORMATO:
{"titulo":"...","resumo":"...","proximo_passo":"...","riscos":["..."],"evidencias":["..."],"markdown":"# ...\\n\\n## Resumo executivo\\n..."}`

function buildMarkdownFallback(input: {
  titulo?: string
  resumo: string
  proximo_passo: string
  riscos: string[]
  evidencias: string[]
}) {
  const riscos =
    input.riscos.length > 0
      ? input.riscos.map((r) => `- ${r}`).join('\n')
      : '- Nenhum risco explícito nos dados.'
  const evidencias =
    input.evidencias.length > 0
      ? input.evidencias.map((e) => `- \`${e}\``).join('\n')
      : '- Sem evidências listadas.'

  return `# ${input.titulo || 'Insight do lead'}

## Resumo executivo

${input.resumo}

## Riscos

${riscos}

## Próximo passo recomendado

**${input.proximo_passo}**

## Evidências

${evidencias}
`
}

function validateInsight(parsed: Record<string, unknown>, model: string) {
  const resumo = String(parsed.resumo || '').trim()
  const proximo_passo = String(parsed.proximo_passo || '').trim()
  const titulo = String(parsed.titulo || '').trim() || resumo.slice(0, 80)
  const riscos = Array.isArray(parsed.riscos) ? parsed.riscos.map(String) : []
  const evidencias = Array.isArray(parsed.evidencias)
    ? parsed.evidencias.map(String)
    : []
  let markdown = String(parsed.markdown || '').trim()

  if (!resumo || !proximo_passo) {
    throw new Error(
      'Insight incompleto: resumo e proximo_passo são obrigatórios',
    )
  }

  if (!markdown) {
    markdown = buildMarkdownFallback({
      titulo,
      resumo,
      proximo_passo,
      riscos,
      evidencias,
    })
  }

  return {
    titulo,
    resumo,
    proximo_passo,
    riscos,
    evidencias,
    markdown,
    model_name: model,
  }
}

function extractJsonObject(text: string): Record<string, unknown> {
  const cleaned = text.replace(/```json|```/gi, '').trim()
  const start = cleaned.indexOf('{')
  const end = cleaned.lastIndexOf('}')
  if (start === -1 || end === -1) {
    throw new Error('Resposta da IA sem JSON válido')
  }
  return JSON.parse(cleaned.slice(start, end + 1)) as Record<string, unknown>
}

async function runGeminiJson(input: {
  systemPrompt: string
  userPrompt: string
  temperature?: number
}): Promise<{ parsed: Record<string, unknown>; model: string; raw: unknown }> {
  const apiKey = Deno.env.get('GEMINI_API_KEY') || ''
  const model = Deno.env.get('GEMINI_MODEL') || 'gemini-2.5-flash'
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY ausente nos secrets da Edge Function')
  }

  const url =
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent` +
    `?key=${encodeURIComponent(apiKey)}`

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: input.systemPrompt }] },
      contents: [{ role: 'user', parts: [{ text: input.userPrompt }] }],
      generationConfig: {
        temperature: input.temperature ?? 0.2,
        responseMimeType: 'application/json',
      },
    }),
  })

  const data = await response.json()
  if (!response.ok) {
    throw new Error(data?.error?.message || `Gemini HTTP ${response.status}`)
  }

  const rawText =
    data?.candidates?.[0]?.content?.parts
      ?.map((p: { text?: string }) => p.text || '')
      .join('\n') || ''

  return { parsed: extractJsonObject(rawText), model, raw: data }
}

async function mistralEmbed(texts: string[]): Promise<number[][]> {
  const key = Deno.env.get('MISTRAL_API_KEY') || ''
  const model = Deno.env.get('MISTRAL_EMBED_MODEL') || 'mistral-embed'
  if (!key || !texts.length) return []

  const response = await fetch('https://api.mistral.ai/v1/embeddings', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model,
      input: texts,
      encoding_format: 'float',
    }),
  })
  const data = await response.json()
  if (!response.ok) return []
  const rows = (data?.data || []) as Array<{
    embedding: number[]
    index: number
  }>
  rows.sort((a, b) => a.index - b.index)
  return rows.map((r) => r.embedding)
}

async function logAiUsage(input: {
  provider: 'gemini' | 'mistral'
  operation: string
  model_name?: string
  units?: number
  estimated_cost_usd: number
  meta?: Record<string, unknown>
}) {
  const supabaseUrl = Deno.env.get('SUPABASE_URL') || ''
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
  if (!supabaseUrl || !serviceKey) return
  try {
    const admin = createClient(supabaseUrl, serviceKey)
    await admin.from('ai_usage_events').insert({
      provider: input.provider,
      operation: input.operation,
      model_name: input.model_name ?? null,
      units: input.units ?? 1,
      estimated_cost_usd: input.estimated_cost_usd,
      meta: input.meta ?? {},
    })
  } catch {
    /* métrica opcional */
  }
}

async function fetchRagChunks(leadContext: Record<string, unknown>) {
  const supabaseUrl = Deno.env.get('SUPABASE_URL') || ''
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
  if (!supabaseUrl || !serviceKey) return []

  try {
    const lead = (leadContext.lead || {}) as Record<string, unknown>
    const queryText = [
      `Lead ${lead.nome || ''}`,
      `origem=${lead.origem || ''}`,
      `produto=${lead.produto_interesse || ''}`,
      `status=${lead.status || ''}`,
      JSON.stringify(leadContext.tentativas_compra || []),
      JSON.stringify(leadContext.respostas_pesquisa || []),
    ].join('\n')

    const [embedding] = await mistralEmbed([queryText.slice(0, 6000)])
    if (!embedding?.length) return []

    const admin = createClient(supabaseUrl, serviceKey)
    const idLead =
      lead.id_lead != null && lead.id_lead !== ''
        ? Number(lead.id_lead)
        : null

    const { data, error } = await admin.rpc('match_crm_embeddings', {
      query_embedding: embedding,
      match_count: 8,
      filter_id_lead: idLead,
    })

    if (error) {
      const retry = await admin.rpc('match_crm_embeddings', {
        query_embedding: embedding,
        match_count: 8,
        filter_id_lead: null,
      })
      if (retry.error) return []
      return retry.data ?? []
    }
    return data ?? []
  } catch {
    return []
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }
  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405)
  }

  try {
    const body = await req.json()
    if (!body?.leadContext) {
      return jsonResponse({ error: 'leadContext é obrigatório' }, 400)
    }

    const ragChunks = await fetchRagChunks(
      body.leadContext as Record<string, unknown>,
    )
    const ragBlock =
      ragChunks.length > 0
        ? `\n\nTRECHOS RECUPERADOS DO ÍNDICE (pgvector / só fatos já indexados):\n${JSON.stringify(ragChunks, null, 2)}`
        : '\n\nTRECHOS RAG: nenhum (rode embed-crm-batch em Plataforma se quiser enriquecer).'

    const { parsed, model, raw } = await runGeminiJson({
      systemPrompt: LEAD_INSIGHT_SYSTEM_PROMPT,
      userPrompt: `DADOS DA BASE (não invente nada além disso):\n${JSON.stringify(body.leadContext, null, 2)}${ragBlock}`,
      temperature: 0.15,
    })

    const insight = validateInsight(parsed, model)

    await logAiUsage({
      provider: 'gemini',
      operation: 'lead_insight',
      model_name: model,
      units: 1,
      estimated_cost_usd: 0.0025,
      meta: {
        rag_chunks_used: ragChunks.length,
        lead_id: (body.leadContext as { lead?: { id_lead?: number } })?.lead
          ?.id_lead,
      },
    })

    return jsonResponse({
      ...insight,
      raw_response: raw,
      rag_chunks_used: ragChunks.length,
    })
  } catch (error) {
    return jsonResponse(
      {
        error:
          error instanceof Error ? error.message : 'Erro no agente insight',
      },
      500,
    )
  }
})
