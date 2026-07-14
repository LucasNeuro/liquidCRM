import type { ReactNode } from 'react'
import { formatLeadCode, maskUuid } from '../../lib/format'

type Tone = 'navy' | 'orange' | 'zinc' | 'soft'

const toneClass: Record<Tone, string> = {
  navy: 'bg-liqui-navy text-white',
  orange: 'bg-liqui-orange text-white',
  zinc: 'bg-zinc-100 text-zinc-600',
  soft: 'bg-liqui-orange-soft text-liqui-navy',
}

/** Badge compacto para códigos (LED-0001, NEG-2026-0009, etc.). */
export function IdBadge({
  children,
  tone = 'soft',
  className = '',
  title,
}: {
  children: ReactNode
  tone?: Tone
  className?: string
  title?: string
}) {
  if (children == null || children === '' || children === '—') {
    return <span className="text-zinc-400">—</span>
  }
  return (
    <span
      title={title}
      className={`inline-flex max-w-full items-center truncate rounded-md px-1.5 py-0.5 font-mono text-[10px] font-bold tracking-wide ${toneClass[tone]} ${className}`}
    >
      {children}
    </span>
  )
}

export function LeadIdBadge({
  id,
  tone = 'soft',
}: {
  id: number | string | null | undefined
  tone?: Tone
}) {
  const code = formatLeadCode(id)
  return <IdBadge tone={tone}>{code || '—'}</IdBadge>
}

export function NegocioIdBadge({
  codigo,
  tone = 'navy',
}: {
  codigo: string | null | undefined
  tone?: Tone
}) {
  return <IdBadge tone={tone}>{codigo || '—'}</IdBadge>
}

/** UUID / chave longa mascarada (PIP-BDA74F, STG-…, ID-…). Hover mostra o valor completo. */
export function UuidBadge({
  value,
  hint,
  tone = 'zinc',
}: {
  value: string | number | null | undefined
  /** Nome da coluna para prefixo (pipeline_id → PIP, stage_id → STG) */
  hint?: string
  tone?: Tone
}) {
  if (value == null || value === '') {
    return <span className="text-zinc-400">—</span>
  }
  const full = String(value)
  const masked = maskUuid(full, hint) || full
  return (
    <IdBadge tone={tone} title={full}>
      {masked}
    </IdBadge>
  )
}
