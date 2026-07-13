import { loadSkillPrompt } from './loadSkillPrompt.js'
import { runGeminiJson } from './geminiClient.js'

const INTENTS = new Set([
  'compra',
  'informacao',
  'suporte',
  'demo',
  'agendamento',
  'proposta',
  'cancelamento',
  'outro',
])

const SENTIMENTS = new Set(['positivo', 'neutro', 'negativo'])

export type ClassificationOutput = {
  intent: string
  sentiment: string
  labels: string[]
  score: number
  summary: string
  confidence: number
  model_name: string
  raw_response?: unknown
}

function validateClassification(
  parsed: Record<string, unknown>,
  model: string,
  raw: unknown,
): ClassificationOutput {
  const intent = String(parsed.intent || 'outro')
  const sentiment = String(parsed.sentiment || 'neutro')
  const labels = Array.isArray(parsed.labels)
    ? parsed.labels.map(String).slice(0, 5)
    : []
  const score = Math.max(0, Math.min(100, Math.round(Number(parsed.score) || 0)))
  const confidence = Math.max(
    0,
    Math.min(1, Number(parsed.confidence) || 0.5),
  )
  const summary = String(parsed.summary || '')

  if (!INTENTS.has(intent)) {
    throw new Error(`Intent inválida no playbook: ${intent}`)
  }
  if (!SENTIMENTS.has(sentiment)) {
    throw new Error(`Sentiment inválido no playbook: ${sentiment}`)
  }

  return {
    intent,
    sentiment,
    labels,
    score,
    summary,
    confidence,
    model_name: model,
    raw_response: raw,
  }
}

/** Playbook: classificação de lead via skill lead-classification + Gemini */
export async function classifyLeadPlaybook(input: {
  text: string
  leadName?: string
}): Promise<ClassificationOutput> {
  const systemPrompt = loadSkillPrompt('lead-classification')
  const userPrompt = `Lead: ${input.leadName || 'desconhecido'}

Mensagem:
"""
${input.text}
"""`

  const { parsed, model, raw } = await runGeminiJson({
    systemPrompt,
    userPrompt,
    temperature: 0.2,
  })

  return validateClassification(parsed, model, raw)
}
