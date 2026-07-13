/** Valores únicos ordenados a partir de uma lista (ignora null/vazio). */
export function uniqueOptions(
  values: Array<string | number | null | undefined>,
): string[] {
  const set = new Set<string>()
  for (const v of values) {
    if (v == null || v === '') continue
    set.add(String(v))
  }
  return Array.from(set).sort((a, b) =>
    a.localeCompare(b, 'pt-BR', { sensitivity: 'base' }),
  )
}

export function matchesQuery(
  haystacks: Array<string | number | null | undefined>,
  query: string,
) {
  const q = query.trim().toLowerCase()
  if (!q) return true
  return haystacks.some((h) =>
    String(h ?? '')
      .toLowerCase()
      .includes(q),
  )
}

type FilterSelectProps = {
  value: string
  onChange: (v: string) => void
  allLabel: string
  allValue?: string
  options: string[]
  className?: string
}

export function FilterSelect({
  value,
  onChange,
  allLabel,
  allValue = 'todos',
  options,
  className = '',
}: FilterSelectProps) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={`rounded-full border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-liqui-orange ${className}`}
    >
      <option value={allValue}>{allLabel}</option>
      {options.map((o) => (
        <option key={o} value={o}>
          {o}
        </option>
      ))}
    </select>
  )
}
