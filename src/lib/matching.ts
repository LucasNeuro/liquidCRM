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
  return normalizeText(value).replace(/\s+/g, '')
}

/** id_lead pode vir number ou string do dump/Sheets. */
export function sameLeadId(a: unknown, b: unknown) {
  if (a == null || b == null || a === '' || b === '') return false
  const na = Number(a)
  const nb = Number(b)
  return Number.isFinite(na) && Number.isFinite(nb) && na === nb
}

/**
 * Telefone com máscaras / +55 / pedaços visíveis.
 * Ex.: (11) 98765-4321 ≈ 11987654321 ≈ *****-4321
 */
export function phonesMatch(a: string | null, b: string | null) {
  const rawA = String(a || '')
  const rawB = String(b || '')
  const pa = normalizePhone(rawA)
  const pb = normalizePhone(rawB)
  if (!pa || !pb) return false
  if (pa === pb) return true

  for (const n of [11, 10, 9, 8]) {
    if (
      pa.length >= n &&
      pb.length >= n &&
      pa.slice(-n) === pb.slice(-n)
    ) {
      return true
    }
  }

  // segmentos de 4+ dígitos preservados apesar de máscara (*)
  const partsA = rawA.match(/\d{4,}/g) || []
  const partsB = rawB.match(/\d{4,}/g) || []
  for (const seg of partsA) {
    if (pb.includes(seg) || partsB.some((x) => x === seg || x.endsWith(seg) || seg.endsWith(x))) {
      return true
    }
  }
  for (const seg of partsB) {
    if (pa.includes(seg)) return true
  }

  // um é sufixo do outro (parcial vs completo)
  if (pa.length >= 4 && pb.length >= 4) {
    if (pa.endsWith(pb) || pb.endsWith(pa)) return true
  }
  return false
}

export function emailsMatch(a: string | null, b: string | null) {
  const ea = normalizeEmail(a)
  const eb = normalizeEmail(b)
  if (!ea || !eb) return false
  if (ea === eb) return true
  // local-part com ponto / sem ponto (Gmail-style inconsistências)
  const [la, da] = ea.split('@')
  const [lb, db] = eb.split('@')
  if (da && db && da === db && la && lb) {
    if (la.replace(/\./g, '') === lb.replace(/\./g, '')) return true
  }
  return false
}

export function namesMatch(a: string | null, b: string | null) {
  const na = normalizeText(a)
  const nb = normalizeText(b)
  if (!na || !nb) return false
  if (na === nb) return true
  if (na.includes(nb) || nb.includes(na)) return true
  // tokens em comum (nome/sobrenome trocados ou abreviados)
  const ta = na.split(/\s+/).filter((t) => t.length >= 3)
  const tb = nb.split(/\s+/).filter((t) => t.length >= 3)
  if (ta.length === 0 || tb.length === 0) return false
  const shared = ta.filter((t) => tb.includes(t))
  return shared.length >= 2 || (shared.length === 1 && (ta.length === 1 || tb.length === 1))
}

function reasonForRow(
  lead: Lead,
  row: {
    id_lead?: number | string | null
    email: string | null
    telefone: string | null
    nome: string
  },
): MatchReason | null {
  if (sameLeadId(row.id_lead, lead.id_lead)) return 'id_lead'
  if (emailsMatch(lead.email, row.email)) return 'email'
  if (phonesMatch(lead.telefone, row.telefone)) return 'telefone'
  if (namesMatch(lead.nome, row.nome)) return 'nome'
  return null
}

/**
 * União: FK id_lead + fallbacks (e-mail → telefone → nome).
 * Não para no primeiro tipo — o dump tem vínculos parciais e inconsistentes.
 */
function matchRowsDetailed<T extends {
  id: number
  id_lead?: number | string | null
  email: string | null
  telefone: string | null
  nome: string
}>(lead: Lead, rows: T[]): Array<T & { match_by: MatchReason }> {
  const out: Array<T & { match_by: MatchReason }> = []
  const seen = new Set<number>()

  for (const row of rows) {
    const reason = reasonForRow(lead, row)
    if (!reason) continue
    if (seen.has(row.id)) continue
    seen.add(row.id)
    out.push({ ...row, match_by: reason })
  }

  // Preferir ordem: id_lead, email, telefone, nome
  const rank: Record<MatchReason, number> = {
    id_lead: 0,
    email: 1,
    telefone: 2,
    nome: 3,
  }
  out.sort((a, b) => rank[a.match_by] - rank[b.match_by])
  return out
}

export function matchTentativasDetailed(
  lead: Lead,
  tentativas: TentativaCompra[],
): MatchedTentativa[] {
  return matchRowsDetailed(lead, tentativas)
}

export function matchRespostasDetailed(
  lead: Lead,
  respostas: RespostaPesquisa[],
): MatchedResposta[] {
  return matchRowsDetailed(lead, respostas)
}

export function matchLabel(reason: MatchReason) {
  switch (reason) {
    case 'id_lead':
      return 'FK id_lead'
    case 'email':
      return 'e-mail normalizado'
    case 'telefone':
      return 'telefone (máscara/sufixo)'
    case 'nome':
      return 'nome aproximado'
  }
}
