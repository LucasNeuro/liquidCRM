import { loadSkillPrompt } from './loadSkillPrompt.js'
import { runGeminiJson } from './geminiClient.js'

export type InsightOutput = {
  titulo: string
  resumo: string
  proximo_passo: string
  riscos: string[]
  evidencias: string[]
  markdown: string
  model_name: string
  raw_response?: unknown
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

/** Playbook: insight do lead via skill lead-insight + Gemini (só dados da base) */
export async function generateInsightPlaybook(
  leadContext: unknown,
): Promise<InsightOutput> {
  const systemPrompt = loadSkillPrompt('lead-insight')
  const userPrompt = `DADOS DA BASE (não invente nada além disso):\n${JSON.stringify(leadContext, null, 2)}`

  const { parsed, model, raw } = await runGeminiJson({
    systemPrompt,
    userPrompt,
    temperature: 0.15,
  })

  return validateInsight(parsed, model, raw)
}
