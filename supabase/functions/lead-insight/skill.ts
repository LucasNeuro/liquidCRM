/**
 * Skill de referência (prompt canônico).
 * Runtime deployável = index.ts (Via Editor não envia skill.ts / _shared).
 * Ao alterar o prompt, sincronize index.ts.
 */
export const LEAD_INSIGHT_SYSTEM_PROMPT = `Você é um analista de CRM da Contabilidade Facilitada / plataforma LIQUI.

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

export function buildMarkdownFallback(input: {
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

export function validateInsight(
  parsed: Record<string, unknown>,
  model: string,
) {
  const resumo = String(parsed.resumo || '').trim()
  const proximo_passo = String(parsed.proximo_passo || '').trim()
  const titulo = String(parsed.titulo || '').trim() || resumo.slice(0, 80)
  const riscos = Array.isArray(parsed.riscos) ? parsed.riscos.map(String) : []
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
  }
}
