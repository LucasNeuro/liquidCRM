import { useMemo, useState } from 'react'
import { Search } from 'lucide-react'
import type { LeadDistributionRow } from '../../lib/distribuicao'
import type { Profile } from '../../lib/profiles'

export function consultorLabel(c: {
  full_name?: string | null
  email?: string | null
}) {
  const name = String(c.full_name || '').trim()
  const email = String(c.email || '').trim()
  if (name) return name
  if (email) return email.split('@')[0] || email
  return 'Consultor'
}

type Props = {
  consultores: Profile[]
  dist: LeadDistributionRow[]
  selectedId: string
  onSelect: (id: string) => void
  /** Se false, só ativos */
  includeInactive?: boolean
  /** Lista sem seleção (ex.: preview do pool no rodízio) */
  readOnly?: boolean
  title?: string
}

/** Minitabela com busca para escolher 1 consultor (sideover de distribuição). */
export function ConsultorPickTable({
  consultores,
  dist,
  selectedId,
  onSelect,
  includeInactive = false,
  readOnly = false,
  title = 'Consultor destino',
}: Props) {
  const [query, setQuery] = useState('')

  const leadsById = useMemo(() => {
    const m = new Map<string, number>()
    for (const r of dist) m.set(r.consultor_id, r.total_leads)
    return m
  }, [dist])

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase()
    return consultores
      .filter((c) => includeInactive || c.active !== false)
      .filter((c) => {
        if (!q) return true
        const label = consultorLabel(c).toLowerCase()
        return (
          label.includes(q) ||
          c.email.toLowerCase().includes(q) ||
          c.full_name.toLowerCase().includes(q)
        )
      })
      .sort((a, b) =>
        consultorLabel(a).localeCompare(consultorLabel(b), 'pt-BR'),
      )
  }, [consultores, includeInactive, query])

  return (
    <div className="space-y-2">
      <p className="text-sm font-semibold text-liqui-navy">{title}</p>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar por nome ou e-mail…"
          className="w-full rounded-xl border border-zinc-200 bg-white py-2.5 pl-9 pr-3 text-sm outline-none focus:border-liqui-orange"
        />
      </div>

      <div className="max-h-64 overflow-auto rounded-xl border border-zinc-200 bg-white">
        <table className="w-full border-collapse text-left text-sm">
          <thead className="sticky top-0 z-10 bg-zinc-50">
            <tr>
              <th className="px-3 py-2 text-[10px] font-bold uppercase tracking-wide text-zinc-400">
                Nome
              </th>
              <th className="px-3 py-2 text-[10px] font-bold uppercase tracking-wide text-zinc-400">
                Status
              </th>
              <th className="px-3 py-2 text-right text-[10px] font-bold uppercase tracking-wide text-zinc-400">
                Leads
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td
                  colSpan={3}
                  className="px-3 py-8 text-center text-xs text-zinc-400"
                >
                  Nenhum consultor encontrado
                </td>
              </tr>
            ) : (
              rows.map((c) => {
                const selected = !readOnly && selectedId === c.id
                const active = c.active !== false
                return (
                  <tr
                    key={c.id}
                    onClick={() => {
                      if (!readOnly) onSelect(c.id)
                    }}
                    className={`border-t border-zinc-100 transition ${
                      readOnly
                        ? ''
                        : 'cursor-pointer'
                    } ${
                      selected
                        ? 'bg-liqui-orange-soft/70'
                        : readOnly
                          ? ''
                          : 'hover:bg-zinc-50'
                    }`}
                  >
                    <td className="px-3 py-2.5">
                      <p className="font-semibold text-liqui-navy">
                        {consultorLabel(c)}
                      </p>
                      <p className="truncate text-[11px] text-zinc-400">
                        {c.email}
                      </p>
                    </td>
                    <td className="px-3 py-2.5">
                      <span
                        className={`text-xs font-semibold ${
                          active ? 'text-liqui-navy' : 'text-amber-700'
                        }`}
                      >
                        {active ? 'Ativo' : 'Pendente'}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-right font-extrabold text-liqui-navy">
                      {leadsById.get(c.id) ?? 0}
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      {!readOnly && selectedId && (
        <p className="text-xs text-zinc-500">
          Selecionado:{' '}
          <strong className="text-liqui-navy">
            {consultorLabel(
              consultores.find((c) => c.id === selectedId) || {
                full_name: '',
                email: '',
              },
            )}
          </strong>
        </p>
      )}
    </div>
  )
}
