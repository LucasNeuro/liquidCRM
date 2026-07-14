import { loadSkillPrompt } from './loadSkillPrompt.js'
import { runGeminiJson } from './geminiClient.js'
import { logAiUsage } from './logAiUsage.js'

export type InsightOutput = {
  titulo: string
  resumo: string
  proximo_passo: string
  riscos: string[]
  evidencias: string[]
  markdown: string
  model_name: string
  raw_response?: unknown
  pipeline?: string
  mistral_brief_used?: boolean
}

function buildMarkdownFallback(input: {
  titulo: string
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

  return `# ${input.titulo}

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

function validateInsight(
  parsed: Record<string, unknown>,
  model: string,
  raw: unknown,
): InsightOutput {
  const resumo = String(parsed.resumo || '').trim()
  const proximo_passo = String(parsed.proximo_passo || '').trim()
  const titulo = String(parsed.titulo || '').trim() || resumo.slice(0, 80)
  const riscos = Array.isArray(parsed.riscos)
    ? parsed.riscos.map(String)
    : []
  const evidencias = Array.isArray(parsed.evidencias)
    ? parsed.evidencias.map(String)
    : []
  let markdown = String(parsed.markdown || '').trim()

  if (!resumo || !proximo_passo) {
    throw new Error('Insight incompleto: resumo e proximo_passo são obrigatórios')
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
    raw_response: raw,
  }
}

/** Síntese pré-Gemini no Aprofundar (dev local; produção usa Edge + RAG real). */
async function mistralBriefLocal(
  leadContext: unknown,
  previousInsight: unknown,
): Promise<{ brief: string; model: string } | null> {
  const key = process.env.MISTRAL_API_KEY || ''
  const model = process.env.MISTRAL_MODEL || 'mistral-small-latest'
  if (!key) return null

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
        {
          role: 'system',
          content: `Você é o motor RAG da LIQUI (Mistral). Extraia só fatos do JSON do lead para aprofundar.
Não invente. Português. Seções: FATOS | CRUZAMENTOS | GAPS | SINAIS.`,
        },
        {
          role: 'user',
          content: `Insight anterior:\n${JSON.stringify(previousInsight)}\n\nContexto:\n${JSON.stringify(leadContext).slice(0, 12000)}`,
        },
      ],
    }),
  })

  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>
    message?: string
    error?: { message?: string }
  }
  if (!response.ok) return null
  const brief = String(data?.choices?.[0]?.message?.content || '').trim()
  if (!brief) return null
  return { brief, model }
}

/** Playbook: insight do lead via skill lead-insight + Gemini (cruzamento da base) */
export async function generateInsightPlaybook(
  leadContext: unknown,
  options?: {
    reinforce?: boolean
    previousInsight?: unknown
  },
): Promise<InsightOutput> {
  const systemPrompt = loadSkillPrompt('lead-insight')
  const reinforce = Boolean(options?.reinforce && options.previousInsight)

  let mistralBrief: string | null = null
  let mistralModel: string | null = null
  if (reinforce) {
    const brief = await mistralBriefLocal(
      leadContext,
      options?.previousInsight,
    )
    if (brief) {
      mistralBrief = brief.brief
      mistralModel = brief.model
      await logAiUsage({
        provider: 'mistral',
        operation: 'lead_insight_mistral_brief',
        model_name: brief.model,
        units: 1,
        estimated_cost_usd: 0.0015,
        meta: { source: 'local_gateway', stage: 'rag_brief' },
      })
    }
  }

  const reinforceBlock = reinforce
    ? `\n\nMODO APROFUNDAR (pipeline Mistral→Gemini):\n${JSON.stringify(options?.previousInsight, null, 2)}`
    : ''
  const mistralBlock = mistralBrief
    ? `\n\nSÍNTESE MISTRAL (1º passo):\n${mistralBrief}`
    : reinforce
      ? '\n\nSÍNTESE MISTRAL: indisponível no gateway local.'
      : ''

  const userPrompt = `DADOS DA BASE (não invente nada além disso):\n${JSON.stringify(leadContext, null, 2)}${mistralBlock}${reinforceBlock}`

  const { parsed, model, raw } = await runGeminiJson({
    systemPrompt,
    userPrompt,
    temperature: reinforce ? 0.25 : 0.15,
  })

  const insight = validateInsight(
    parsed,
    reinforce && mistralBrief ? `mistral→${model}` : model,
    raw,
  )

  await logAiUsage({
    provider: 'gemini',
    operation: reinforce ? 'lead_insight_reinforce' : 'lead_insight',
    model_name: model,
    units: 1,
    estimated_cost_usd: reinforce ? 0.003 : 0.0025,
    meta: {
      source: 'local_gateway',
      reinforce,
      mistral_brief: Boolean(mistralBrief),
      pipeline: reinforce ? 'mistral_rag->gemini' : 'gemini',
      mistral_model: mistralModel,
    },
  })

  return {
    ...insight,
    pipeline: reinforce ? 'mistral_rag->gemini' : 'gemini',
    mistral_brief_used: Boolean(mistralBrief),
  }
}
