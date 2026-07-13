type Slice = {
  label: string
  value: number
  color: string
}

const FALLBACK_COLORS = [
  '#F7941D',
  '#3B82F6',
  '#10B981',
  '#F59E0B',
  '#A78BFA',
  '#F43F5E',
  '#22D3EE',
  '#94A3B8',
]

export function paletteFor(index: number) {
  return FALLBACK_COLORS[index % FALLBACK_COLORS.length]
}

/** Donut SVG com legenda — dados reais (não fictícios). */
export function DonutCard({
  title,
  subtitle,
  slices,
  unit = 'leads',
}: {
  title: string
  subtitle: string
  slices: Slice[]
  unit?: string
}) {
  const total = slices.reduce((s, x) => s + x.value, 0)
  const size = 132
  const stroke = 16
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r

  let offset = 0
  const arcs =
    total === 0
      ? null
      : slices
          .filter((s) => s.value > 0)
          .map((s) => {
            const len = (s.value / total) * c
            const dash = `${len} ${c - len}`
            const rot = (offset / c) * 360 - 90
            offset += len
            return { ...s, dash, rot }
          })

  return (
    <section className="rounded-2xl bg-liqui-navy p-5 text-white shadow-sm">
      <h3 className="text-sm font-extrabold">{title}</h3>
      <p className="mt-0.5 text-xs text-white/50">{subtitle}</p>

      <div className="mt-4 flex items-center gap-4">
        <div className="relative shrink-0" style={{ width: size, height: size }}>
          <svg width={size} height={size} className="rotate-0">
            <circle
              cx={size / 2}
              cy={size / 2}
              r={r}
              fill="none"
              stroke="rgba(255,255,255,0.08)"
              strokeWidth={stroke}
            />
            {arcs?.map((a) => (
              <circle
                key={a.label}
                cx={size / 2}
                cy={size / 2}
                r={r}
                fill="none"
                stroke={a.color}
                strokeWidth={stroke}
                strokeDasharray={a.dash}
                strokeLinecap="butt"
                transform={`rotate(${a.rot} ${size / 2} ${size / 2})`}
                style={{ filter: 'drop-shadow(0 0 6px rgba(247,148,29,0.35))' }}
              />
            ))}
          </svg>
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-2xl font-extrabold text-liqui-orange">
              {total}
            </span>
            <span className="text-[10px] font-semibold uppercase tracking-wide text-white/50">
              {unit}
            </span>
          </div>
        </div>

        <ul className="min-w-0 flex-1 space-y-1.5">
          {(slices.length === 0 || total === 0) && (
            <li className="text-xs text-white/40">Sem dados ainda</li>
          )}
          {slices.slice(0, 6).map((s) => (
            <li
              key={s.label}
              className="flex items-center justify-between gap-2 text-xs"
            >
              <span className="flex min-w-0 items-center gap-2">
                <span
                  className="h-2 w-2 shrink-0 rounded-full"
                  style={{
                    background: s.color,
                    boxShadow: `0 0 8px ${s.color}`,
                  }}
                />
                <span className="truncate text-white/80">{s.label}</span>
              </span>
              <span className="font-bold tabular-nums">{s.value}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}

/** Gauge semicircular — conversão real vs meta. */
export function GaugeCard({
  title,
  subtitle,
  percent,
  meta = 40,
  label = 'Qualificação',
}: {
  title: string
  subtitle: string
  percent: number
  meta?: number
  label?: string
}) {
  const pct = Math.max(0, Math.min(100, percent))
  const size = 160
  const stroke = 14
  const r = (size - stroke) / 2 - 4
  const c = Math.PI * r // semicircle

  return (
    <section className="rounded-2xl bg-liqui-navy p-5 text-white shadow-sm">
      <h3 className="text-sm font-extrabold">{title}</h3>
      <p className="mt-0.5 text-xs text-white/50">{subtitle}</p>

      <div className="relative mx-auto mt-2" style={{ width: size, height: size / 2 + 28 }}>
        <svg width={size} height={size / 2 + 8} viewBox={`0 0 ${size} ${size / 2 + 8}`}>
          <path
            d={`M ${stroke / 2 + 4} ${size / 2} A ${r} ${r} 0 0 1 ${size - stroke / 2 - 4} ${size / 2}`}
            fill="none"
            stroke="rgba(255,255,255,0.1)"
            strokeWidth={stroke}
            strokeLinecap="round"
          />
          <path
            d={`M ${stroke / 2 + 4} ${size / 2} A ${r} ${r} 0 0 1 ${size - stroke / 2 - 4} ${size / 2}`}
            fill="none"
            stroke="#F7941D"
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={`${(pct / 100) * c} ${c}`}
            style={{ filter: 'drop-shadow(0 0 8px rgba(247,148,29,0.55))' }}
          />
        </svg>
        <div className="absolute inset-x-0 bottom-0 text-center">
          <p className="text-3xl font-extrabold text-liqui-orange">
            {Math.round(pct)}%
          </p>
          <p className="text-xs text-white/80">{label}</p>
          <p className="text-[10px] text-white/40">meta {meta}%</p>
        </div>
      </div>
    </section>
  )
}

export function countBy<T extends object>(
  rows: T[],
  key: keyof T & string,
  fallback = 'Sem dado',
): Slice[] {
  const map = new Map<string, number>()
  for (const row of rows) {
    const raw = row[key]
    const label =
      raw == null || String(raw).trim() === '' ? fallback : String(raw)
    map.set(label, (map.get(label) || 0) + 1)
  }
  return [...map.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([label, value], i) => ({
      label,
      value,
      color: paletteFor(i),
    }))
}
