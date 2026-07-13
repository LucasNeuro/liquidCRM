/**
 * Skill de referência (prompt canônico).
 * Runtime deployável = index.ts (Via Editor não envia skill.ts / _shared).
 * Ao alterar o prompt, sincronize index.ts.
 */
export const LEAD_CLASSIFY_SYSTEM_PROMPT = `Você é o classificador oficial de leads do CRM LIQUI (Contabilidade Facilitada).

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

export function validateClassification(
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
