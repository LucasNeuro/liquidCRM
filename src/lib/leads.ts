import { supabase } from './supabase'
import {
  matchRespostasDetailed,
  matchTentativasDetailed,
} from './matching'
import type {
  Lead,
  Negocio,
  RespostaPesquisa,
  TentativaCompra,
} from './types'

export {
  normalizeEmail,
  normalizePhone,
  normalizeText,
  emailsMatch,
  phonesMatch,
  namesMatch,
  matchTentativasDetailed,
  matchRespostasDetailed,
  matchLabel,
} from './matching'
export type { MatchReason, MatchedTentativa, MatchedResposta } from './matching'

export async function fetchLeads(includeArchived = false) {
  let q = supabase
    .from('leads')
    .select('*')
    .order('id_lead', { ascending: true })
  if (!includeArchived) q = q.is('archived_at', null)
  const { data, error } = await q

  if (error) {
    if (!includeArchived && /archived_at/i.test(error.message)) {
      const fallback = await supabase
        .from('leads')
        .select('*')
        .order('id_lead', { ascending: true })
      if (fallback.error) throw new Error(fallback.error.message)
      return (fallback.data ?? []) as Lead[]
    }
    throw new Error(error.message)
  }
  return (data ?? []) as Lead[]
}

export async function updateLeadStatus(idLead: number, status: string) {
  const { error } = await supabase
    .from('leads')
    .update({ status })
    .eq('id_lead', idLead)

  if (error) throw new Error(error.message)
}

export async function updateLead(idLead: number, patch: Partial<Lead>) {
  const { error } = await supabase
    .from('leads')
    .update(patch)
    .eq('id_lead', idLead)
  if (error) throw new Error(error.message)
}

export async function createLead(
  row: Omit<Lead, 'id_lead' | 'archived_at'> & { id_lead?: number },
) {
  const payload = { ...row }
  if (payload.id_lead == null) {
    const { data: maxRow } = await supabase
      .from('leads')
      .select('id_lead')
      .order('id_lead', { ascending: false })
      .limit(1)
      .maybeSingle()
    const maxId =
      maxRow && typeof maxRow === 'object' && 'id_lead' in maxRow
        ? Number((maxRow as { id_lead: number }).id_lead)
        : 0
    payload.id_lead = maxId + 1
  }
  const { data, error } = await supabase
    .from('leads')
    .insert(payload)
    .select('*')
    .single()
  if (error) throw new Error(error.message)
  return data as Lead
}

export async function archiveLead(idLead: number) {
  const { error } = await supabase
    .from('leads')
    .update({ archived_at: new Date().toISOString() })
    .eq('id_lead', idLead)
  if (error) throw new Error(error.message)
}

export async function deleteLead(idLead: number) {
  const { error } = await supabase.from('leads').delete().eq('id_lead', idLead)
  if (error) throw new Error(error.message)
}

export async function fetchTentativas() {
  const { data, error } = await supabase
    .from('tentativas_compra')
    .select('*')
    .is('archived_at', null)
  if (error) {
    if (/archived_at/i.test(error.message)) {
      const fallback = await supabase.from('tentativas_compra').select('*')
      if (fallback.error) throw new Error(fallback.error.message)
      return (fallback.data ?? []) as TentativaCompra[]
    }
    throw new Error(error.message)
  }
  return (data ?? []) as TentativaCompra[]
}

export async function fetchRespostas() {
  const { data, error } = await supabase
    .from('respostas_pesquisa')
    .select('*')
    .is('archived_at', null)
  if (error) {
    if (/archived_at/i.test(error.message)) {
      const fallback = await supabase.from('respostas_pesquisa').select('*')
      if (fallback.error) throw new Error(fallback.error.message)
      return (fallback.data ?? []) as RespostaPesquisa[]
    }
    throw new Error(error.message)
  }
  return (data ?? []) as RespostaPesquisa[]
}

export function matchTentativasForLead(
  lead: Lead,
  tentativas: TentativaCompra[],
) {
  return matchTentativasDetailed(lead, tentativas)
}

export function matchRespostasForLead(
  lead: Lead,
  respostas: RespostaPesquisa[],
) {
  return matchRespostasDetailed(lead, respostas)
}

export async function fetchLatestInsight(idLead: number) {
  const { data, error } = await supabase
    .from('lead_insights')
    .select('*')
    .eq('id_lead', idLead)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) throw new Error(error.message)
  if (!data) return null
  return mapInsightRow(data)
}

export async function fetchLeadInsights(idLead: number) {
  const { data, error } = await supabase
    .from('lead_insights')
    .select('*')
    .eq('id_lead', idLead)
    .order('created_at', { ascending: false })

  if (error) throw new Error(error.message)
  return (data ?? []).map(mapInsightRow)
}

/** IDs de leads que já têm pelo menos um insight salvo. */
export async function fetchLeadIdsWithInsights() {
  const { data, error } = await supabase
    .from('lead_insights')
    .select('id_lead')
    .not('id_lead', 'is', null)

  if (error) {
    if (/lead_insights|does not exist/i.test(error.message)) return new Set<number>()
    throw new Error(error.message)
  }

  const ids = new Set<number>()
  for (const row of data ?? []) {
    const id = Number((row as { id_lead: number }).id_lead)
    if (Number.isFinite(id)) ids.add(id)
  }
  return ids
}

/** Insights mais recentes (hub / dashboard). */
export async function fetchRecentInsights(limit = 8) {
  const { data, error } = await supabase
    .from('lead_insights')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) {
    if (/lead_insights|does not exist/i.test(error.message)) return []
    throw new Error(error.message)
  }

  return (data ?? []).map(mapInsightRow)
}

export function isLeadClassified(lead: Lead) {
  return lead.score_gemini != null || Boolean(lead.intent_gemini)
}

function mapInsightRow(data: Record<string, unknown>) {
  const resumo = String(data.resumo || '')
  const proximo_passo = String(data.proximo_passo || '')
  const riscos = (data.riscos as string[]) ?? []
  const evidencias = (data.evidencias as string[]) ?? []
  const titulo =
    (data.titulo as string | null) ||
    resumo.slice(0, 80) ||
    'Insight'
  let markdown = (data.markdown as string | null) || null
  if (!markdown) {
    markdown = [
      `# ${titulo}`,
      '',
      '## Resumo executivo',
      '',
      resumo,
      '',
      '## Riscos',
      '',
      ...(riscos.length ? riscos.map((r) => `- ${r}`) : ['- Nenhum']),
      '',
      '## Próximo passo recomendado',
      '',
      `**${proximo_passo}**`,
      '',
      '## Evidências',
      '',
      ...(evidencias.length
        ? evidencias.map((e) => `- \`${e}\``)
        : ['- Sem evidências']),
    ].join('\n')
  }
  return {
    id: data.id as string,
    id_lead: data.id_lead as number | undefined,
    titulo,
    resumo,
    proximo_passo,
    riscos,
    evidencias,
    markdown,
    model_name: data.model_name as string,
    created_at: data.created_at as string,
  }
}

export async function persistLeadInsight(input: {
  idLead: number
  insight: {
    titulo?: string
    resumo: string
    proximo_passo: string
    riscos: string[]
    evidencias: string[]
    markdown?: string
    model_name: string
    raw_response?: unknown
  }
}) {
  const titulo =
    input.insight.titulo?.trim() || input.insight.resumo.slice(0, 80)
  const markdown =
    input.insight.markdown?.trim() ||
    [
      `# ${titulo}`,
      '',
      '## Resumo executivo',
      '',
      input.insight.resumo,
      '',
      '## Próximo passo recomendado',
      '',
      `**${input.insight.proximo_passo}**`,
    ].join('\n')

  const row: Record<string, unknown> = {
    id_lead: input.idLead,
    resumo: input.insight.resumo,
    proximo_passo: input.insight.proximo_passo,
    riscos: input.insight.riscos,
    evidencias: input.insight.evidencias,
    model_name: input.insight.model_name,
    raw_response: input.insight.raw_response ?? null,
    titulo,
    markdown,
  }

  let { data, error } = await supabase
    .from('lead_insights')
    .insert(row)
    .select('*')
    .single()

  // Compat: se migration markdown ainda não rodou
  if (error && /titulo|markdown/i.test(error.message)) {
    const { titulo: _t, markdown: _m, ...legacy } = row
    const retry = await supabase
      .from('lead_insights')
      .insert(legacy)
      .select('*')
      .single()
    data = retry.data
    error = retry.error
  }

  if (error) throw new Error(error.message)
  return mapInsightRow(data as Record<string, unknown>)
}

export function buildLeadContextPayload(
  lead: Lead,
  tentativas: TentativaCompra[],
  respostas: RespostaPesquisa[],
  negocios: Negocio[] = [],
) {
  const objecoes = [
    ...new Set(
      respostas
        .map((r) => r.principal_objecao)
        .filter((v): v is string => Boolean(v && String(v).trim())),
    ),
  ]
  const statusPagamentos = [
    ...new Set(
      tentativas
        .map((t) => t.status_pagamento)
        .filter((v): v is string => Boolean(v && String(v).trim())),
    ),
  ]
  const momentos = [
    ...new Set(
      respostas
        .map((r) => r.momento_compra)
        .filter((v): v is string => Boolean(v && String(v).trim())),
    ),
  ]
  const valorTotalTentativas = tentativas.reduce(
    (acc, t) => acc + Number(t.valor ?? 0),
    0,
  )
  const valorPipeline = negocios
    .filter((n) => n.status_negocio === 'aberto')
    .reduce((acc, n) => acc + Number(n.valor || 0), 0)

  return {
    lead: {
      id_lead: lead.id_lead,
      nome: lead.nome,
      email: lead.email,
      telefone: lead.telefone,
      origem: lead.origem,
      produto_interesse: lead.produto_interesse,
      status: lead.status,
      data_entrada: lead.data_entrada,
      score_gemini: lead.score_gemini,
      intent_gemini: lead.intent_gemini,
      labels_gemini: lead.labels_gemini ?? [],
      pipeline_id: lead.pipeline_id ?? null,
      stage_id: lead.stage_id ?? null,
    },
    tentativas_compra: tentativas.map((t) => ({
      id: t.id,
      produto: t.produto,
      valor: t.valor,
      forma_pagamento: t.forma_pagamento,
      status_pagamento: t.status_pagamento,
      data_tentativa: t.data_tentativa,
      match_by: 'match_by' in t ? (t as { match_by?: string }).match_by ?? null : null,
    })),
    respostas_pesquisa: respostas.map((r) => ({
      id: r.id,
      momento_compra: r.momento_compra,
      principal_objecao: r.principal_objecao,
      area_interesse: r.area_interesse,
      nota_intencao: r.nota_intencao,
      data_resposta: r.data_resposta,
      match_by: 'match_by' in r ? (r as { match_by?: string }).match_by ?? null : null,
    })),
    negocios: negocios.map((n) => ({
      id: n.id,
      codigo: n.codigo,
      titulo: n.titulo,
      valor: n.valor,
      status_negocio: n.status_negocio,
      pipeline_id: n.pipeline_id,
      stage_id: n.stage_id,
      created_at: n.created_at,
      updated_at: n.updated_at,
    })),
    cruzamento: {
      qtd_tentativas: tentativas.length,
      qtd_respostas: respostas.length,
      qtd_negocios: negocios.length,
      tem_score_ia: lead.score_gemini != null,
      tem_intent_ia: Boolean(lead.intent_gemini),
      objecoes_unicas: objecoes,
      status_pagamento_unicos: statusPagamentos,
      momentos_unicos: momentos,
      valor_total_tentativas: valorTotalTentativas,
      valor_pipeline_aberto: valorPipeline,
      produto_interesse_lead: lead.produto_interesse || null,
    },
  }
}

/** Texto rico para classificação Gemini (cruza as 3 abas) */
export function buildClassificationText(
  lead: Lead,
  tentativas: TentativaCompra[],
  respostas: RespostaPesquisa[],
) {
  const lines = [
    `Lead: ${lead.nome}`,
    `Origem: ${lead.origem || '?'}`,
    `Produto interesse: ${lead.produto_interesse || '?'}`,
    `Status: ${lead.status || '?'}`,
    `E-mail: ${lead.email || 'ausente'}`,
    `Telefone: ${lead.telefone || 'ausente'}`,
  ]
  if (tentativas.length) {
    lines.push('Tentativas de compra:')
    for (const t of tentativas) {
      lines.push(
        `- ${t.produto || '?'} | R$ ${t.valor ?? 0} | ${t.status_pagamento || '?'} | ${t.forma_pagamento || '?'}`,
      )
    }
  } else {
    lines.push('Tentativas de compra: nenhuma vinculada')
  }
  if (respostas.length) {
    lines.push('Respostas de pesquisa:')
    for (const r of respostas) {
      lines.push(
        `- momento=${r.momento_compra || '?'} | objeção=${r.principal_objecao || '?'} | área=${r.area_interesse || '?'} | nota=${r.nota_intencao ?? '?'}`,
      )
    }
  } else {
    lines.push('Respostas de pesquisa: nenhuma vinculada')
  }
  return lines.join('\n')
}
