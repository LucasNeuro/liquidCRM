/** Timezone oficial da Contabilidade Facilitada / LIQUI. */
export const APP_TZ = 'America/Sao_Paulo'

function parseFlexibleDate(value: unknown): Date | null {
  if (value == null || value === '') return null
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value
  }

  const raw = String(value).trim()
  if (!raw || raw === '—') return null

  // ISO / timestamptz
  const iso = new Date(raw)
  if (!Number.isNaN(iso.getTime()) && /T|\+|Z|\d{4}-\d{2}-\d{2}/.test(raw)) {
    return iso
  }

  // DD/MM/YYYY ou DD-MM-YYYY [HH:mm[:ss]]
  const br = raw.match(
    /^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?$/,
  )
  if (br) {
    const day = Number(br[1])
    const month = Number(br[2]) - 1
    let year = Number(br[3])
    if (year < 100) year += 2000
    const hour = Number(br[4] || 0)
    const minute = Number(br[5] || 0)
    const second = Number(br[6] || 0)
    const d = new Date(year, month, day, hour, minute, second)
    return Number.isNaN(d.getTime()) ? null : d
  }

  // YYYY-MM-DD sem hora
  const ymd = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (ymd) {
    const d = new Date(Number(ymd[1]), Number(ymd[2]) - 1, Number(ymd[3]))
    return Number.isNaN(d.getTime()) ? null : d
  }

  const fallback = new Date(raw)
  return Number.isNaN(fallback.getTime()) ? null : fallback
}

/** Data + hora Brasília: 13/07/2026, 18:16 */
export function formatDateTimeBr(value: unknown): string {
  const d = parseFlexibleDate(value)
  if (!d) return value == null || value === '' ? '—' : String(value)
  return d.toLocaleString('pt-BR', {
    timeZone: APP_TZ,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/** Só data Brasília: 13/07/2026 */
export function formatDateBr(value: unknown): string {
  const d = parseFlexibleDate(value)
  if (!d) return value == null || value === '' ? '—' : String(value)
  return d.toLocaleDateString('pt-BR', {
    timeZone: APP_TZ,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

/**
 * Heurística para células de tabela:
 * - timestamptz / ISO → data+hora BR
 * - data curta / entrada → data BR
 * - resto → string
 */
export function formatCellValue(value: unknown, hint?: string): string {
  if (value == null || value === '') return '—'
  const key = (hint || '').toLowerCase()
  if (
    key.includes('created') ||
    key.includes('updated') ||
    key.includes('finished') ||
    key.includes('started') ||
    key.includes('archived') ||
    key.includes('_at')
  ) {
    return formatDateTimeBr(value)
  }
  if (
    key.includes('data_') ||
    key.includes('date') ||
    key === 'data_entrada' ||
    key === 'data_tentativa' ||
    key === 'data_resposta'
  ) {
    const s = String(value)
    // se tiver hora no valor, mostrar com hora
    if (/T|\d{1,2}:\d{2}/.test(s)) return formatDateTimeBr(value)
    return formatDateBr(value)
  }
  if (typeof value === 'boolean') return value ? 'sim' : 'não'
  return String(value)
}

export function formatLeadCode(id: number | string | null | undefined) {
  if (id == null || id === '') return null
  return `LED-${String(id).padStart(4, '0')}`
}

export function formatNegocioCode(codigo: string | null | undefined) {
  if (!codigo) return null
  return String(codigo)
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function isUuidLike(value: unknown): boolean {
  if (value == null || value === '') return false
  return UUID_RE.test(String(value).trim())
}

/** Prefixo curto para chaves UUID em tabelas (PIP / STG / ID). */
export function uuidTagPrefix(hint?: string): string {
  const k = (hint || '').toLowerCase()
  if (k.includes('pipeline')) return 'PIP'
  if (k.includes('stage') || k.includes('estagio') || k.includes('estágio'))
    return 'STG'
  if (k.includes('user') || k.includes('profile')) return 'USR'
  if (k.includes('job')) return 'JOB'
  return 'ID'
}

/**
 * Mascara UUID longo → tag curta (ex.: PIP-BDA74F).
 * Título/tooltip deve exibir o valor completo.
 */
export function maskUuid(
  value: unknown,
  hint?: string,
): string | null {
  if (value == null || value === '') return null
  const raw = String(value).trim()
  const prefix = uuidTagPrefix(hint)
  if (isUuidLike(raw)) {
    const hex = raw.replace(/-/g, '').slice(-6).toUpperCase()
    return `${prefix}-${hex}`
  }
  // IDs longos não-UUID ainda mascaram
  if (raw.length > 14) {
    return `${prefix}-${raw.slice(-6).toUpperCase()}`
  }
  return raw
}
