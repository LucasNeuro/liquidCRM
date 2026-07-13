import type { Lead, RespostaPesquisa, TentativaCompra } from './types'

/** Estratégia de vínculo entre abas (enunciado: inconsistências propositais). */
export type MatchReason = 'id_lead' | 'email' | 'telefone' | 'nome'

export type MatchedTentativa = TentativaCompra & { match_by: MatchReason }
export type MatchedResposta = RespostaPesquisa & { match_by: MatchReason }

export function normalizeText(value: string | null | undefined) {
  return (value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
}

export function normalizePhone(value: string | null | undefined) {
  return (value || '').replace(/\D/g, '')
}

export function normalizeEmail(value: string | null | undefined) {
  return normalizeText(value)
}

export function phonesMatch(a: string | null, b: string | null) {
  const pa = normalizePhone(a)
  const pb = normalizePhone(b)
  if (!pa || !pb) return false
  if (pa === pb) return true
  const shortA = pa.slice(-8)
  const shortB = pb.slice(-8)
  return shortA.length >= 8 && shortA === shortB
}

export function emailsMatch(a: string | null, b: string | null) {
  const ea = normalizeEmail(a)
  const eb = normalizeEmail(b)
  return Boolean(ea && eb && ea === eb)
}

export function namesMatch(a: string | null, b: string | null) {
  const na = normalizeText(a)
  const nb = normalizeText(b)
  if (!na || !nb) return false
  return na === nb || na.includes(nb) || nb.includes(na)
}

function reasonForRow(
  lead: Lead,
  row: { id_lead?: number | null; email: string | null; telefone: string | null; nome: string },
): MatchReason | null {
  if (row.id_lead != null && row.id_lead === lead.id_lead) return 'id_lead'
  if (emailsMatch(lead.email, row.email)) return 'email'
  if (phonesMatch(lead.telefone, row.telefone)) return 'telefone'
  if (namesMatch(lead.nome, row.nome)) return 'nome'
  return null
}

/**
 * Preferência: FK id_lead. Fallback: e-mail → telefone (8 dígitos) → nome.
 * Datas VARCHAR e NULLs são mantidos — só vínculo, sem "corrigir" dados.
 */
export function matchTentativasDetailed(
  lead: Lead,
  tentativas: TentativaCompra[],
): MatchedTentativa[] {
  const byFk = tentativas.filter((t) => t.id_lead === lead.id_lead)
  if (byFk.length > 0) {
    return byFk.map((t) => ({ ...t, match_by: 'id_lead' as const }))
  }
  const out: MatchedTentativa[] = []
  for (const t of tentativas) {
    const reason = reasonForRow(lead, t)
    if (reason && reason !== 'id_lead') out.push({ ...t, match_by: reason })
  }
  return out
}

export function matchRespostasDetailed(
  lead: Lead,
  respostas: RespostaPesquisa[],
): MatchedResposta[] {
  const byFk = respostas.filter((r) => r.id_lead === lead.id_lead)
  if (byFk.length > 0) {
    return byFk.map((r) => ({ ...r, match_by: 'id_lead' as const }))
  }
  const out: MatchedResposta[] = []
  for (const r of respostas) {
    const reason = reasonForRow(lead, r)
    if (reason && reason !== 'id_lead') out.push({ ...r, match_by: reason })
  }
  return out
}

export function matchLabel(reason: MatchReason) {
  switch (reason) {
    case 'id_lead':
      return 'FK id_lead'
    case 'email':
      return 'e-mail normalizado'
    case 'telefone':
      return 'telefone (últimos 8)'
    case 'nome':
      return 'nome aproximado'
  }
}
