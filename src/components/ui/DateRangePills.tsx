export type CadastroDays = 7 | 15 | 30 | 60

const OPTIONS: { days: CadastroDays; label: string }[] = [
  { days: 7, label: '7 dias' },
  { days: 15, label: '15 dias' },
  { days: 30, label: '30 dias' },
  { days: 60, label: '60 dias' },
]

type Props = {
  value: CadastroDays | null
  onChange: (value: CadastroDays | null) => void
  /** Mostra opção “Todos” para limpar o filtro */
  allowAll?: boolean
  className?: string
}

export function daysAgoCutoff(days: CadastroDays): Date {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() - days)
  return d
}

export function isWithinLastDays(
  iso: string | undefined | null,
  days: CadastroDays | null,
): boolean {
  if (days == null) return true
  if (!iso) return false
  const created = new Date(iso)
  if (Number.isNaN(created.getTime())) return false
  return created >= daysAgoCutoff(days)
}

/** Segmented control estilo pill: 7 / 15 / 30 / 60 dias. */
export function DateRangePills({
  value,
  onChange,
  allowAll = true,
  className = '',
}: Props) {
  return (
    <div
      className={`inline-flex shrink-0 items-center rounded-full bg-zinc-200/70 p-0.5 ${className}`}
      role="group"
      aria-label="Filtro por data de cadastro"
    >
      {allowAll && (
        <button
          type="button"
          onClick={() => onChange(null)}
          className={`rounded-full px-2.5 py-1.5 text-xs font-semibold transition ${
            value == null
              ? 'bg-white text-liqui-navy shadow-sm'
              : 'text-zinc-600 hover:text-liqui-navy'
          }`}
        >
          Todos
        </button>
      )}
      {OPTIONS.map((opt) => (
        <button
          key={opt.days}
          type="button"
          onClick={() => onChange(opt.days)}
          className={`rounded-full px-2.5 py-1.5 text-xs font-semibold transition ${
            value === opt.days
              ? 'bg-white text-liqui-navy shadow-sm'
              : 'text-zinc-600 hover:text-liqui-navy'
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}
