/**
 * lead-insight — arquivo ÚNICO para deploy Via Editor (Dashboard).
 * Inclui skill + gemini + mistral (embed RAG + chat no Aprofundar) + usage + cors.
 * Secrets: GEMINI_API_KEY, MISTRAL_API_KEY
 *
 * Aprofundar (reinforce): Mistral processa RAG → Gemini finaliza e a UI abre o modal.
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

const LEAD_INSIGHT_SYSTEM_PROMPT = `Você é um analista sênior de CRM da Contabilidade Facilitada / plataforma LIQUI.

Sua missão: gerar um insight **rico e cruzado** para o consultor, combinando:
1) JSON de contexto (lead + tentativas_compra + respostas_pesquisa + negocios + cruzamento)
2) TRECHOS RECUPERADOS DO ÍNDICE (RAG / pgvector), quando houver

REGRAS DE FIDELIDADE (avaliação — crítico):
- Use SOMENTE fatos presentes no JSON e nos trechos RAG. É PROIBIDO inventar valores, datas, produtos, contatos, intenções, scores ou histórico.
- Se faltar dado, declare no resumo (ex.: "sem e-mail na base", "nenhuma tentativa vinculada", "RAG sem trechos").
- RAG é evidência complementar. Em ## Evidências do índice (RAG) escreva EM LINGUAGEM COMERCIAL (frases curtas e bullets), NUNCA cole dumps com tabela=/id=/similarity=/\\n.
- Formato obrigatório da seção RAG:
  ### O que a base confirma
  - bullets tipo: "Tentativa de compra: produto X · boleto · abandonado · R$ 997 · data Y"
  ### Atenção para o consultor
  - inconsistências e gaps em português claro (ex.: "Lead marcado como Ganho, mas há tentativas abandonadas")
  ### Leitura do índice
  - se houver SÍNTESE MISTRAL, reescreva em 2–4 bullets comerciais (sem o rótulo técnico SÍNTESE MISTRAL)
- Array evidencias: pode manter campos literais curtos para auditoria (status_pagamento=abandonado), mas o markdown precisa ser legível para vendas.
- Não "corrija" inconsistências (e-mails mistos, máscaras de telefone, datas VARCHAR): cite como estão.
- Português do Brasil.
- Responda SOMENTE JSON válido (sem cercas \`\`\`).

CRUZAMENTO OBRIGATÓRIO (não resuma só o lead):
- Relacione produto_interesse do lead com produtos das tentativas e área/momento das pesquisas.
- Compare score_gemini / intent_gemini (se existirem) com nota_intencao e momento_compra.
- Confrontar objeções (principal_objecao) com status_pagamento das tentativas e status_negocio dos negócios.
- Se houver negócios: cite titulo, codigo, valor e status_negocio e como encaixam no funil.
- Use o bloco cruzamento do JSON (totais, listas únicas) como guia, mas detalhe com os registros.
- Se o pedido for REFORÇAR / APROFUNDAR: use a SÍNTESE MISTRAL (RAG) + insight anterior para aprofundar (mais evidências, próximo passo em sequência, riscos específicos) — sem contradizer fatos da base nem inventar além da síntese/JSON.
- No Aprofundar, cite na seção RAG o que veio da síntese Mistral quando houver.

proximo_passo: UMA ação concreta e priorizada (canal + motivo + dado citado).
evidencias: 5–12 itens com campos literais (ex.: "status_pagamento=abandonado", "nota_intencao=1", "status_negocio=aberto", "RAG leads similarity=0.82").
riscos: 2–6 itens derivados só dos dados.

O campo "markdown" DEVE ser um documento Markdown completo, com:
- Título (#)
- ## Resumo executivo
- ## Contexto do lead
- ## Cruzamento (lead × tentativas × pesquisas × negócios)
- ## Tentativas de compra
- ## Pesquisas
- ## Negócios no funil
- ## Sinais de intenção / IA
- ## Evidências do índice (RAG)
- ## Riscos
- ## Próximo passo recomendado
- ## Evidências
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

function humanizeChunkForPrompt(input: {
  source_table?: string
  similarity?: number
  chunk_text: string
}) {
  const text = String(input.chunk_text || '').replace(/\\n/g, '\n')
  const fields: Record<string, string> = {}
  for (const line of text.split('\n')) {
    const i = line.indexOf('=')
    if (i <= 0) continue
    fields[line.slice(0, i).trim()] = line.slice(i + 1).trim()
  }
  const table = input.source_table || fields.tabela || 'registro'
  const label =
    table === 'leads'
      ? 'Cadastro do lead'
      : table === 'tentativas_compra'
        ? 'Tentativa de compra'
        : table === 'respostas_pesquisa'
          ? 'Resposta de pesquisa'
          : table
  const parts: string[] = []
  if (fields.nome) parts.push(fields.nome)
  if (fields.produto || fields.produto_interesse) {
    parts.push(fields.produto || fields.produto_interesse)
  }
  if (fields.valor) parts.push(`R$ ${fields.valor}`)
  if (fields.forma_pagamento) parts.push(fields.forma_pagamento)
  if (fields.status_pagamento) {
    parts.push(`pagamento: ${fields.status_pagamento}`)
  }
  if (fields.status) parts.push(`status: ${fields.status}`)
  if (fields.momento_compra) parts.push(`momento: ${fields.momento_compra}`)
  if (fields.principal_objecao) {
    parts.push(`objeção: ${fields.principal_objecao}`)
  }
  if (fields.nota_intencao) parts.push(`nota ${fields.nota_intencao}`)
  if (fields.data_tentativa || fields.data_entrada || fields.data_resposta) {
    parts.push(
      fields.data_tentativa || fields.data_entrada || fields.data_resposta,
    )
  }
  return {
    tipo: label,
    resumo_comercial: parts.join(' · ') || 'registro indexado',
    table,
  }
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

/**
 * 1º passo do Aprofundar: Mistral lê os chunks RAG (+ contexto mínimo)
 * e devolve uma síntese factual para o Gemini finalizar.
 */
async function mistralRagBrief(input: {
  chunks: Array<{
    source_table?: string
    source_id?: string
    id_lead?: number | null
    similarity?: number
    chunk_text: string
  }>
  leadContext: Record<string, unknown>
  previousInsight?: {
    titulo?: string
    resumo?: string
    proximo_passo?: string
    riscos?: string[]
    evidencias?: string[]
  }
}): Promise<{ brief: string; model: string } | null> {
  const key = Deno.env.get('MISTRAL_API_KEY') || ''
  const model = Deno.env.get('MISTRAL_MODEL') || 'mistral-small-latest'
  if (!key) return null

  const lead = (input.leadContext.lead || {}) as Record<string, unknown>
  const system = `Você é o motor de leitura do índice da LIQUI (Mistral).
Tarefa: transformar trechos do índice em bullets COMERCIAIS curtos (português do Brasil).
Regras:
- NÃO invente além dos trechos e do insight anterior.
- NÃO use jargão técnico (similarity, source_table, tabela=, \\n, id=).
- Se não houver trechos, diga "Índice sem trechos para este lead".
- Saída em texto com seções:
  O QUE A BASE CONFIRMA | ATENÇÃO PARA O CONSULTOR | GAPS`

  const user = [
    `Lead: id=${lead.id_lead ?? ''} nome=${lead.nome || ''} produto=${lead.produto_interesse || ''} status=${lead.status || ''}`,
    input.previousInsight
      ? `Insight anterior (só referência):\n${JSON.stringify({
          titulo: input.previousInsight.titulo,
          resumo: input.previousInsight.resumo,
          proximo_passo: input.previousInsight.proximo_passo,
          riscos: input.previousInsight.riscos || [],
          evidencias: input.previousInsight.evidencias || [],
        })}`
      : 'Insight anterior: nenhum',
    `Trechos do índice (${input.chunks.length}):\n${JSON.stringify(
      input.chunks.map((c) => humanizeChunkForPrompt(c)),
      null,
      2,
    )}`,
  ].join('\n\n')

  const response = await fetch('https://api.mistral.ai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
    }),
  })

  const data = await response.json()
  if (!response.ok) {
    console.error('mistralRagBrief', data?.message || data?.error)
    return null
  }

  const brief = String(data?.choices?.[0]?.message?.content || '').trim()
  if (!brief) return null
  return { brief, model }
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

async function fetchRagChunks(leadContext: Record<string, unknown>): Promise<{
  chunks: Array<{
    source_table?: string
    source_id?: string
    id_lead?: number | null
    similarity?: number
    chunk_text: string
  }>
  queryEmbedded: boolean
}> {
  const supabaseUrl = Deno.env.get('SUPABASE_URL') || ''
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
  if (!supabaseUrl || !serviceKey) return { chunks: [], queryEmbedded: false }

  type RagRow = {
    id?: string
    source_table?: string
    source_id?: string
    id_lead?: number | null
    chunk_text?: string
    similarity?: number
  }

  try {
    const lead = (leadContext.lead || {}) as Record<string, unknown>
    const cruz = (leadContext.cruzamento || {}) as Record<string, unknown>
    const negocios = (leadContext.negocios || []) as unknown[]
    const queryText = [
      `Lead ${lead.nome || ''} id=${lead.id_lead ?? ''}`,
      `origem=${lead.origem || ''}`,
      `produto=${lead.produto_interesse || ''}`,
      `status=${lead.status || ''}`,
      `score=${lead.score_gemini ?? ''}`,
      `intent=${lead.intent_gemini || ''}`,
      `objecoes=${JSON.stringify(cruz.objecoes_unicas || [])}`,
      `status_pag=${JSON.stringify(cruz.status_pagamento_unicos || [])}`,
      `momentos=${JSON.stringify(cruz.momentos_unicos || [])}`,
      `negocios=${JSON.stringify(negocios).slice(0, 1500)}`,
      JSON.stringify(leadContext.tentativas_compra || []).slice(0, 2000),
      JSON.stringify(leadContext.respostas_pesquisa || []).slice(0, 2000),
    ].join('\n')

    const [embedding] = await mistralEmbed([queryText.slice(0, 6000)])
    if (!embedding?.length) return { chunks: [], queryEmbedded: false }

    const admin = createClient(supabaseUrl, serviceKey)
    const idLead =
      lead.id_lead != null && lead.id_lead !== ''
        ? Number(lead.id_lead)
        : null

    const byLead = await admin.rpc('match_crm_embeddings', {
      query_embedding: embedding,
      match_count: 10,
      filter_id_lead: idLead,
    })

    let rows: RagRow[] = []
    if (!byLead.error && Array.isArray(byLead.data)) {
      rows = byLead.data as RagRow[]
    }

    if (rows.length < 5) {
      const global = await admin.rpc('match_crm_embeddings', {
        query_embedding: embedding,
        match_count: 8,
        filter_id_lead: null,
      })
      if (!global.error && Array.isArray(global.data)) {
        const seen = new Set(rows.map((r) => r.id).filter(Boolean))
        for (const g of global.data as RagRow[]) {
          if (g.id && seen.has(g.id)) continue
          rows.push(g)
          if (g.id) seen.add(g.id)
          if (rows.length >= 14) break
        }
      }
    }

    return {
      queryEmbedded: true,
      chunks: rows.map((r) => ({
        source_table: r.source_table,
        source_id: r.source_id,
        id_lead: r.id_lead,
        similarity:
          typeof r.similarity === 'number'
            ? Number(r.similarity.toFixed(3))
            : r.similarity,
        chunk_text: String(r.chunk_text || '').slice(0, 1200),
      })),
    }
  } catch {
    return { chunks: [], queryEmbedded: false }
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

    const reinforce = Boolean(body.reinforce)
    const previous = body.previousInsight as
      | {
          titulo?: string
          resumo?: string
          proximo_passo?: string
          riscos?: string[]
          evidencias?: string[]
          markdown?: string
        }
      | undefined

    const { chunks: ragChunks, queryEmbedded } = await fetchRagChunks(
      body.leadContext as Record<string, unknown>,
    )
    const ragCards = ragChunks.map((c) => humanizeChunkForPrompt(c))
    const ragBlock =
      ragCards.length > 0
        ? `\n\nFATOS DO ÍNDICE (já legíveis para o comercial — use isso em ## Evidências do índice (RAG); NÃO cole dumps técnicos):\n${JSON.stringify(ragCards, null, 2)}`
        : '\n\nFATOS DO ÍNDICE: nenhum (rode embed-crm-batch em Plataforma se quiser enriquecer).'

    /** Aprofundar: Mistral processa RAG → Gemini finaliza o insight no modal */
    let mistralBrief: string | null = null
    let mistralChatModel: string | null = null
    let mistralChatCostUsd = 0

    if (reinforce) {
      const briefResult = await mistralRagBrief({
        chunks: ragChunks,
        leadContext: body.leadContext as Record<string, unknown>,
        previousInsight: previous,
      })
      if (briefResult) {
        mistralBrief = briefResult.brief
        mistralChatModel = briefResult.model
        mistralChatCostUsd = 0.0015
        await logAiUsage({
          provider: 'mistral',
          operation: 'lead_insight_mistral_brief',
          model_name: briefResult.model,
          units: 1,
          estimated_cost_usd: mistralChatCostUsd,
          meta: {
            rag_chunks_used: ragChunks.length,
            lead_id: (body.leadContext as { lead?: { id_lead?: number } })?.lead
              ?.id_lead,
            stage: 'rag_brief',
          },
        })
      }
    }

    const reinforceBlock =
      reinforce && previous
        ? `\n\nMODO APROFUNDAR (pipeline Mistral→Gemini): aprofunde a partir deste insight anterior (não contradiga a base atual):\n${JSON.stringify(
            {
              titulo: previous.titulo,
              resumo: previous.resumo,
              proximo_passo: previous.proximo_passo,
              riscos: previous.riscos || [],
              evidencias: previous.evidencias || [],
              markdown_resumo: String(previous.markdown || '').slice(0, 2500),
            },
            null,
            2,
          )}`
        : ''

    const mistralBlock =
      reinforce && mistralBrief
        ? `\n\nSÍNTESE MISTRAL (1º passo — só fatos do RAG / índice; use para aprofundar, sem inventar além dela):\n${mistralBrief}`
        : reinforce
          ? '\n\nSÍNTESE MISTRAL: indisponível (sem MISTRAL_API_KEY ou falha). Aprofunde só com JSON + trechos brutos + insight anterior.'
          : ''

    const { parsed, model, raw } = await runGeminiJson({
      systemPrompt: LEAD_INSIGHT_SYSTEM_PROMPT,
      userPrompt: `DADOS DA BASE (não invente nada além disso):\n${JSON.stringify(body.leadContext, null, 2)}${ragBlock}${mistralBlock}${reinforceBlock}`,
      temperature: reinforce ? 0.25 : 0.15,
    })

    const insight = validateInsight(
      parsed,
      reinforce && mistralBrief
        ? `mistral→${model}`
        : model,
    )

    const leadId = (body.leadContext as { lead?: { id_lead?: number } })?.lead
      ?.id_lead

    // Gemini = geração final do insight
    await logAiUsage({
      provider: 'gemini',
      operation: reinforce ? 'lead_insight_reinforce' : 'lead_insight',
      model_name: model,
      units: 1,
      estimated_cost_usd: reinforce ? 0.003 : 0.0025,
      meta: {
        rag_chunks_used: ragChunks.length,
        reinforce,
        lead_id: leadId,
        mistral_brief: Boolean(mistralBrief),
        pipeline: reinforce ? 'mistral_rag->gemini' : 'gemini',
      },
    })

    // Mistral embed da query RAG
    let mistralEmbedCostUsd = 0
    if (queryEmbedded) {
      mistralEmbedCostUsd = 0.0001
      await logAiUsage({
        provider: 'mistral',
        operation: 'lead_insight_rag',
        model_name: Deno.env.get('MISTRAL_EMBED_MODEL') || 'mistral-embed',
        units: 1,
        estimated_cost_usd: mistralEmbedCostUsd,
        meta: {
          rag_chunks_used: ragChunks.length,
          lead_id: leadId,
        },
      })
    }

    const mistralCostUsd = mistralEmbedCostUsd + mistralChatCostUsd

    return jsonResponse({
      ...insight,
      raw_response: raw,
      rag_chunks_used: ragChunks.length,
      reinforced: reinforce,
      pipeline: reinforce ? 'mistral_rag->gemini' : 'gemini',
      mistral_brief_used: Boolean(mistralBrief),
      mistral_model: mistralChatModel,
      estimated_cost: {
        gemini_usd: reinforce ? 0.003 : 0.0025,
        mistral_usd: mistralCostUsd,
      },
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
