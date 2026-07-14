import type { ReactNode } from 'react'
import {
  formatCellValue,
  formatDateTimeBr,
  isUuidLike,
} from '../../lib/format'
import { LeadIdBadge, NegocioIdBadge, UuidBadge } from './IdBadge'

/** Meta box read-only (ficha) — formata datas BR e IDs como badge. */
export function MetaInfo({
  label,
  value,
  kind = 'auto',
}: {
  label: string
  value: string | number | null | undefined
  kind?: 'auto' | 'text' | 'datetime' | 'date' | 'leadId' | 'negocioCode' | 'id'
}) {
  const resolved =
    kind === 'auto'
      ? inferKind(label, value)
      : kind

  let body: ReactNode
  if (resolved === 'leadId') {
    body = <LeadIdBadge id={value} />
  } else if (resolved === 'negocioCode') {
    body = <NegocioIdBadge codigo={value == null ? null : String(value)} />
  } else if (resolved === 'id') {
    body = <UuidBadge value={value} hint={label} />
  } else if (resolved === 'datetime' || resolved === 'date') {
    body = (
      <span className="text-sm font-medium text-liqui-navy">
        {resolved === 'date'
          ? formatCellValue(value, 'data_')
          : formatDateTimeBr(value)}
      </span>
    )
  } else {
    body = (
      <span className="break-all text-sm font-medium text-liqui-navy">
        {value == null || value === '' ? '—' : String(value)}
      </span>
    )
  }

  return (
    <div className="rounded-xl bg-zinc-50 px-3 py-2">
      <dt className="text-[10px] font-bold uppercase tracking-wide text-zinc-400">
        {label}
      </dt>
      <dd className="mt-1">{body}</dd>
    </div>
  )
}

function inferKind(
  label: string,
  value: unknown,
): 'text' | 'datetime' | 'date' | 'leadId' | 'negocioCode' | 'id' {
  const k = label.toLowerCase()
  if (k === 'id_lead' || k === 'lead_id' || k.startsWith('led')) return 'leadId'
  if (k === 'codigo' || k.startsWith('neg-') || k.includes('negocio')) {
    if (typeof value === 'string' && /^NEG-/i.test(value)) return 'negocioCode'
    if (k === 'codigo') return 'negocioCode'
  }
  if (
    k.includes('created') ||
    k.includes('updated') ||
    k.includes('finished') ||
    k.includes('started') ||
    k.includes('archived') ||
    k.endsWith('_at')
  ) {
    return 'datetime'
  }
  if (k.startsWith('data_') || k.includes('date')) return 'date'
  if (k === 'id' || k.endsWith('_id') || isUuidLike(value)) return 'id'
  return 'text'
}
