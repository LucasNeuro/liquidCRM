/**
 * Chunks textuais a partir das tabelas CRM (só fatos — nada inventado).
 */
export type SourceChunk = {
  source_table: string
  source_id: string
  id_lead: number | null
  chunk_text: string
}

export async function sha256Hex(text: string): Promise<string> {
  const data = new TextEncoder().encode(text)
  const hash = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

export function chunkFromLead(row: Record<string, unknown>): SourceChunk {
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

export function chunkFromTentativa(row: Record<string, unknown>): SourceChunk {
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

export function chunkFromResposta(row: Record<string, unknown>): SourceChunk {
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
