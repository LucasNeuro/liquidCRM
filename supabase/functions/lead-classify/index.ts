/**
 * lead-classify — arquivo ÚNICO para deploy Via Editor (Dashboard).
 * Inclui skill (prompt) + gemini + usage + cors.
 * Secrets: GEMINI_API_KEY, GEMINI_MODEL (opcional)
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

const LEAD_CLASSIFY_SYSTEM_PROMPT = `Você é o classificador oficial de leads do CRM LIQUI (Contabilidade Facilitada).

Tarefa: analisar a mensagem do lead e produzir uma classificação objetiva.

REGRAS:
- Use apenas o texto e o nome do lead fornecidos.
- Não invente histórico, produto ou intenção que não apareçam no texto.
- Responda SOMENTE com JSON válido, sem markdown e sem comentários.
- intent ∈ {compra, informacao, suporte, demo, agendamento, proposta, cancelamento, outro}
- sentiment ∈ {positivo, neutro, negativo}
- score ∈ [0, 100] (número inteiro)
- confidence ∈ [0, 1]
- labels: 0 a 5 strings curtas em português

FORMATO OBRIGATÓRIO:
{"intent":"...","sentiment":"...","labels":[],"score":0,"summary":"...","confidence":0.0}`

function validateClassification(
  parsed: Record<string, unknown>,
  model: string,
) {
  return {
    intent: String(parsed.intent || 'outro'),
    sentiment: String(parsed.sentiment || 'neutro'),
    labels: Array.isArray(parsed.labels) ? parsed.labels.map(String) : [],
    score: Number(parsed.score ?? 0),
    summary: String(parsed.summary || ''),
    confidence: Number(parsed.confidence ?? 0),
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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }
  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405)
  }

  try {
    const body = await req.json()
    const text = String(body.text || '')
    if (text.trim().length < 2) {
      return jsonResponse({ error: 'Campo text é obrigatório' }, 400)
    }

    const leadName = body.leadName ? String(body.leadName) : ''
    const { parsed, model, raw } = await runGeminiJson({
      systemPrompt: LEAD_CLASSIFY_SYSTEM_PROMPT,
      userPrompt: leadName
        ? `Nome do lead: ${leadName}\n\nTexto:\n${text}`
        : text,
      temperature: 0.1,
    })

    const result = validateClassification(parsed, model)

    await logAiUsage({
      provider: 'gemini',
      operation: 'lead_classify',
      model_name: model,
      units: 1,
      estimated_cost_usd: 0.0015,
      meta: { lead_name: leadName || null },
    })

    return jsonResponse({ ...result, raw_response: raw })
  } catch (error) {
    return jsonResponse(
      {
        error:
          error instanceof Error ? error.message : 'Erro no agente classify',
      },
      500,
    )
  }
})
