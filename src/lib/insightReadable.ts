/**
 * Torna dumps técnicos do índice (tabela=...\nid=...) legíveis para o comercial.
 */

const TABLE_LABEL: Record<string, string> = {
  leads: 'Cadastro do lead',
  tentativas_compra: 'Tentativa de compra',
  respostas_pesquisa: 'Resposta de pesquisa',
  negocios: 'Negócio',
}

function parseKvBlob(raw: string): Record<string, string> {
  const text = raw
    .replace(/^["'`]+|["'`]+$/g, '')
    .replace(/\\n/g, '\n')
    .replace(/\r/g, '')
  const out: Record<string, string> = {}
  for (const line of text.split(/\n/)) {
    const idx = line.indexOf('=')
    if (idx <= 0) continue
    const key = line.slice(0, idx).trim().toLowerCase()
    let val = line.slice(idx + 1).trim()
    // remove cauda técnica no mesmo campo
    val = val.replace(/\s*\(source_table=.*$/i, '').trim()
    if (key) out[key] = val
  }
  const sim = text.match(/similarity\s*=\s*([0-9.]+)/i)
  if (sim) out.similarity = sim[1]
  const src = text.match(/source_table\s*=\s*([a-z_]+)/i)
  if (src) out.source_table = src[1]
  return out
}

function moneyBr(v: string | undefined) {
  if (v == null || v === '') return null
  const n = Number(String(v).replace(',', '.'))
  if (!Number.isFinite(n)) return v
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

/** Uma linha comercial a partir de um chunk do índice. */
export function humanizeRagChunk(input: {
  source_table?: string | null
  similarity?: number | string | null
  chunk_text: string
}): string {
  const f = parseKvBlob(input.chunk_text)
  const table =
    input.source_table || f.source_table || f.tabela || 'registro'
  const label = TABLE_LABEL[table] || table

  const bits: string[] = []
  if (f.nome) bits.push(f.nome)
  if (f.produto || f.produto_interesse) {
    bits.push(String(f.produto || f.produto_interesse))
  }
  if (f.valor) {
    const m = moneyBr(f.valor)
    if (m) bits.push(m)
  }
  if (f.forma_pagamento) bits.push(String(f.forma_pagamento))
  if (f.status_pagamento) bits.push(`pagamento: ${f.status_pagamento}`)
  if (f.status) bits.push(`status: ${f.status}`)
  if (f.origem) bits.push(`origem: ${f.origem}`)
  if (f.momento_compra) bits.push(`momento: ${f.momento_compra}`)
  if (f.principal_objecao) bits.push(`objeção: ${f.principal_objecao}`)
  if (f.area_interesse) bits.push(String(f.area_interesse))
  if (f.nota_intencao) bits.push(`nota ${f.nota_intencao}`)
  if (f.data_tentativa || f.data_entrada || f.data_resposta) {
    bits.push(
      String(f.data_tentativa || f.data_entrada || f.data_resposta),
    )
  }

  const body = bits.length > 0 ? bits.join(' · ') : 'registro no índice'
  return `**${label}:** ${body}`
}

function looksLikeRagDump(s: string) {
  return /tabela\s*=/i.test(s) || /source_table\s*=/i.test(s)
}

/**
 * Reescreve dumps RAG colados no markdown para leitura comercial.
 * Funciona em insights já salvos (modal abre legível).
 */
export function prettifyInsightMarkdown(markdown: string): string {
  if (!markdown?.trim()) return markdown

  let md = markdown.replace(/\r\n/g, '\n')

  // blocos entre aspas com escapes \n
  md = md.replace(/"([^"]*tabela=[^"]*)"/gi, (_m, inner: string) => {
    if (!looksLikeRagDump(inner)) return `"${inner}"`
    return `- ${humanizeRagChunk({ chunk_text: inner })}`
  })

  // linhas de lista com dump
  md = md.replace(
    /^[ \t]*[-*]\s+`?([\s\S]*?tabela=[\s\S]*?)`?(?:\s*\([^)]*similarity[^)]*\))?[ \t]*$/gim,
    (_m, blob: string) => `- ${humanizeRagChunk({ chunk_text: blob })}`,
  )

  // parágrafos que são só o dump + (source_table..., similarity...)
  md = md.replace(
    /(?:^|\n)([^\n]*tabela=[^\n]*(?:\\n[^\n]*)+)(?:\s*\([^)]*source_table[^)]*\))?/gi,
    (full, blob) => {
      if (!looksLikeRagDump(String(blob))) return full
      return `\n- ${humanizeRagChunk({ chunk_text: String(blob) })}`
    },
  )

  md = md.replace(
    /\s*\(source_table=[a-z_]+,\s*similarity=[0-9.]+\)/gi,
    '',
  )

  md = md.replace(
    /SÍNTESE MISTRAL:\s*/gi,
    '**Leitura do índice (IA):** ',
  )

  return md
}
