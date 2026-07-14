import { useCallback, useEffect, useMemo, useState } from 'react'
import { RefreshCw, Search, SlidersHorizontal, Users } from 'lucide-react'
import { DataTable, type DataColumn } from '../components/ui/DataTable'
import {
  DateRangePills,
  isWithinLastDays,
  type CadastroDays,
} from '../components/ui/DateRangePills'
import { LeadIdBadge, UuidBadge } from '../components/ui/IdBadge'
import { useShellHeader } from '../layouts/ShellContext'
import {
  assignLeadsBulk,
  fetchAllLeadsForDistribution,
  fetchLeadDistribution,
  redistributeRoundRobin,
  type LeadDistributionRow,
} from '../lib/distribuicao'
import { fetchProfiles, type Profile } from '../lib/profiles'
import { consultorLabel } from '../components/distribuicao/ConsultorPickTable'
import {
  DistributeSideOver,
  type DistMode,
} from '../components/distribuicao/DistributeSideOver'
import { uniqueOptions } from '../components/ui/CrmFilters'
import { onCrmChanged, emitCrmChanged } from '../lib/crmEvents'
import { supabase } from '../lib/supabase'
import type { Lead } from '../lib/types'

type MainTab = 'leads' | 'consultores'

/**
 * Distribuição manual: tabela de seleção + sideover (atribuir / desatribuir / rodízio).
 */
export function DistribuicaoPage() {
  const { setHeader } = useShellHeader()
  const [tab, setTab] = useState<MainTab>('leads')
  const [dist, setDist] = useState<LeadDistributionRow[]>([])
  const [leads, setLeads] = useState<Lead[]>([])
  const [consultores, setConsultores] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [panelError, setPanelError] = useState<string | null>(null)
  const [flash, setFlash] = useState<string | null>(null)
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [showConfig, setShowConfig] = useState(false)
  const [saving, setSaving] = useState(false)

  const [fOrigem, setFOrigem] = useState('todas')
  const [fStatus, setFStatus] = useState('todos')
  const [fConsultor, setFConsultor] = useState('todos')
  const [fQuery, setFQuery] = useState('')

  const [cQuery, setCQuery] = useState('')
  const [cDays, setCDays] = useState<CadastroDays | null>(null)

  const [mode, setMode] = useState<DistMode>('um')
  const [targetId, setTargetId] = useState('')
  const [includeInactive, setIncludeInactive] = useState(false)
  /** Só filtra sem dono em atribuir/rodízio — NUNCA no desatribuir. */
  const [onlyUnassigned, setOnlyUnassigned] = useState(false)
  /** Rodízio: automático (todos ativos) ou pool manual */
  const [poolAuto, setPoolAuto] = useState(true)
  const [poolIds, setPoolIds] = useState<Set<string>>(() => new Set())

  const nameById = useMemo(() => {
    const m = new Map<string, string>()
    for (const c of consultores) m.set(c.id, consultorLabel(c))
    return m
  }, [consultores])

  const createdAtById = useMemo(() => {
    const m = new Map<string, string | undefined>()
    for (const c of consultores) m.set(c.id, c.created_at)
    return m
  }, [consultores])

  const filteredConsultores = useMemo(() => {
    const q = cQuery.trim().toLowerCase()
    return dist.filter((r) => {
      if (!isWithinLastDays(createdAtById.get(r.consultor_id), cDays)) {
        return false
      }
      if (!q) return true
      return (
        r.full_name.toLowerCase().includes(q) ||
        r.email.toLowerCase().includes(q)
      )
    })
  }, [dist, createdAtById, cQuery, cDays])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [d, allLeads, profiles] = await Promise.all([
        fetchLeadDistribution(),
        fetchAllLeadsForDistribution(),
        fetchProfiles(),
      ])
      setDist(d)
      setLeads(allLeads)
      setConsultores(profiles.filter((p) => p.role === 'consultor'))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao carregar')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    const off = onCrmChanged(() => {
      void load()
    })
    const channel = supabase
      .channel('distribuicao-leads')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'leads' },
        () => {
          void load()
        },
      )
      .subscribe()
    return () => {
      off()
      void supabase.removeChannel(channel)
    }
  }, [load])

  useEffect(() => {
    setHeader({
      title: 'Distribuição de leads',
      subtitle: 'Selecione leads → abra o painel para atribuir ou desatribuir',
      actions: (
        <button
          type="button"
          onClick={() => void load()}
          className="inline-flex items-center gap-2 rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm font-semibold"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Atualizar
        </button>
      ),
    })
  }, [setHeader, load, loading])

  const origens = useMemo(
    () => uniqueOptions(leads.map((l) => l.origem)),
    [leads],
  )
  const statusList = useMemo(
    () => uniqueOptions(leads.map((l) => l.status)),
    [leads],
  )

  const filteredLeads = useMemo(() => {
    const q = fQuery.trim().toLowerCase()
    return leads.filter((l) => {
      if (fOrigem === '__none__') {
        if (l.origem?.trim()) return false
      } else if (fOrigem !== 'todas' && (l.origem || '') !== fOrigem) {
        return false
      }
      if (fStatus === '__none__') {
        if (l.status?.trim()) return false
      } else if (fStatus !== 'todos' && (l.status || '') !== fStatus) {
        return false
      }
      if (fConsultor === 'sem') {
        if (l.assigned_to) return false
      } else if (fConsultor !== 'todos') {
        if (l.assigned_to !== fConsultor) return false
      }
      if (!q) return true
      return (
        l.nome.toLowerCase().includes(q) ||
        String(l.email || '')
          .toLowerCase()
          .includes(q) ||
        String(l.id_lead).includes(q)
      )
    })
  }, [leads, fOrigem, fStatus, fConsultor, fQuery])

  const filteredIds = useMemo(
    () => filteredLeads.map((l) => l.id_lead),
    [filteredLeads],
  )

  const allFilteredSelected =
    filteredIds.length > 0 && filteredIds.every((id) => selected.has(id))

  function toggleOne(id: number) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleAllFiltered() {
    setSelected((prev) => {
      const next = new Set(prev)
      if (allFilteredSelected) {
        for (const id of filteredIds) next.delete(id)
      } else {
        for (const id of filteredIds) next.add(id)
      }
      return next
    })
  }

  const totais = useMemo(() => {
    const atribuidos = leads.filter((l) => l.assigned_to).length
    const fila = leads.filter((l) => !l.assigned_to).length
    const ativos = consultores.filter((c) => c.active !== false).length
    const pendentes = consultores.filter((c) => c.active === false).length
    const leadsByConsultor = new Map<string, number>()
    for (const l of leads) {
      if (!l.assigned_to) continue
      leadsByConsultor.set(
        l.assigned_to,
        (leadsByConsultor.get(l.assigned_to) || 0) + 1,
      )
    }
    const semLeads = consultores.filter(
      (c) =>
        c.active !== false && (leadsByConsultor.get(c.id) || 0) === 0,
    ).length
    const pctAtribuidos =
      leads.length > 0 ? Math.round((atribuidos / leads.length) * 100) : 0
    return {
      atribuidos,
      fila,
      ativos,
      pendentes,
      semLeads,
      pctAtribuidos,
      total: leads.length,
    }
  }, [leads, consultores])

  const consultoresAtivos = useMemo(
    () => consultores.filter((c) => c.active !== false),
    [consultores],
  )

  const consultoresPool = useMemo(() => {
    if (!poolAuto) {
      return consultores.filter((c) => poolIds.has(c.id))
    }
    if (includeInactive) return consultores
    return consultoresAtivos
  }, [poolAuto, poolIds, consultores, consultoresAtivos, includeInactive])

  /**
   * Lote efetivo.
   * - Desatribuir: precisa de leads COM consultor (ignora “só sem”).
   * - Atribuir/rodízio: respeita onlyUnassigned.
   */
  const loteIds = useMemo(() => {
    const base =
      selected.size > 0
        ? Array.from(selected)
        : leads.map((l) => l.id_lead)

    return base.filter((id) => {
      const l = leads.find((x) => x.id_lead === id)
      if (!l) return false
      if (mode === 'fila') return Boolean(l.assigned_to)
      if (onlyUnassigned) return !l.assigned_to
      return true
    })
  }, [selected, leads, onlyUnassigned, mode])

  const lotePreview = useMemo(
    () =>
      loteIds
        .map((id) => leads.find((l) => l.id_lead === id))
        .filter(Boolean) as Lead[],
    [loteIds, leads],
  )

  function openPanel(preferred?: DistMode) {
    setPanelError(null)
    const hasSelection = selected.size > 0
    const selectedAssigned = hasSelection
      ? Array.from(selected).some((id) => {
          const l = leads.find((x) => x.id_lead === id)
          return Boolean(l?.assigned_to)
        })
      : false

    if (preferred) setMode(preferred)
    else if (selectedAssigned) setMode('um')
    else if (totais.fila > 0) setMode('roundrobin')
    else setMode('um')

    // Se vai desatribuir ou transferir quem já tem dono, não filtre “só sem”
    setOnlyUnassigned(false)
    setIncludeInactive(false)
    setPoolAuto(true)
    setPoolIds(new Set())
    setTargetId('')
    setShowConfig(true)
  }

  async function handleApply() {
    setSaving(true)
    setPanelError(null)
    try {
      const ids = loteIds
      if (ids.length === 0) {
        setPanelError(
          mode === 'fila'
            ? 'Selecione leads que já têm consultor para desatribuir.'
            : onlyUnassigned
              ? 'Nenhum lead sem consultor no lote. Desmarque o filtro ou selecione leads.'
              : 'Selecione leads na tabela primeiro.',
        )
        return
      }

      if (mode === 'fila') {
        const res = await assignLeadsBulk(ids, null)
        setFlash(`${res.updated} lead(s) desatribuídos (fila).`)
      } else if (mode === 'um') {
        if (!targetId) {
          setPanelError('Escolha o consultor de destino.')
          return
        }
        const dest = consultores.find((c) => c.id === targetId)
        if (dest?.active === false && !includeInactive) {
          setPanelError(
            'Consultor pendente. Ative em Plataforma ou inclua pendentes.',
          )
          return
        }
        const res = await assignLeadsBulk(ids, targetId)
        setFlash(
          `${res.updated} lead(s) → ${nameById.get(targetId) || 'consultor'}.`,
        )
      } else {
        const pool = consultoresPool.map((c) => c.id)
        if (pool.length === 0) {
          setPanelError('Nenhum consultor no pool do rodízio.')
          return
        }
        const res = await redistributeRoundRobin(ids, pool)
        setFlash(
          `${res.updated} lead(s) redistribuídos · ${pool.length} consultor(es) no pool.`,
        )
      }

      setShowConfig(false)
      setSelected(new Set())
      emitCrmChanged({ source: 'distribuicao', reason: mode })
      await load()
      setTimeout(() => setFlash(null), 4000)
    } catch (err) {
      setPanelError(err instanceof Error ? err.message : 'Falha ao aplicar')
    } finally {
      setSaving(false)
    }
  }

  const consultorColumns: DataColumn<LeadDistributionRow>[] = [
    {
      key: 'id',
      label: 'ID',
      render: (r) => <UuidBadge value={r.consultor_id} hint="user_id" />,
    },
    {
      key: 'nome',
      label: 'Consultor',
      render: (r) => (
        <span className="font-semibold text-liqui-navy">{r.full_name}</span>
      ),
    },
    { key: 'email', label: 'E-mail', render: (r) => r.email },
    {
      key: 'status',
      label: 'Acesso',
      render: (r) =>
        r.active ? (
          <span className="text-xs font-semibold text-liqui-navy">Ativo</span>
        ) : (
          <span className="text-xs font-semibold text-amber-700">Pendente</span>
        ),
    },
    {
      key: 'total',
      label: 'Leads',
      render: (r) => (
        <span className="font-extrabold text-liqui-navy">{r.total_leads}</span>
      ),
    },
    {
      key: 'acao',
      label: '',
      render: (r) => (
        <button
          type="button"
          className="text-xs font-bold text-liqui-orange hover:underline"
          onClick={() => {
            setFConsultor(r.consultor_id)
            setTab('leads')
          }}
        >
          Ver leads
        </button>
      ),
    },
  ]

  const leadColumns: DataColumn<Lead>[] = [
    {
      key: 'sel',
      className: 'w-10',
      label: (
        <input
          type="checkbox"
          checked={allFilteredSelected}
          onChange={toggleAllFiltered}
          aria-label="Selecionar todos filtrados"
          className="h-4 w-4 rounded border-zinc-300"
        />
      ),
      render: (r) => (
        <input
          type="checkbox"
          checked={selected.has(r.id_lead)}
          onChange={() => toggleOne(r.id_lead)}
          onClick={(e) => e.stopPropagation()}
          className="h-4 w-4 rounded border-zinc-300"
        />
      ),
    },
    {
      key: 'id_lead',
      label: 'ID',
      render: (r) => <LeadIdBadge id={r.id_lead} />,
    },
    {
      key: 'nome',
      label: 'Nome',
      render: (r) => (
        <span className="font-semibold text-liqui-navy">{r.nome}</span>
      ),
    },
    { key: 'origem', label: 'Origem', render: (r) => r.origem || '—' },
    { key: 'status', label: 'Status', render: (r) => r.status || '—' },
    {
      key: 'consultor',
      label: 'Consultor',
      render: (r) =>
        r.assigned_to ? (
          <span className="text-xs font-semibold text-liqui-navy">
            {nameById.get(r.assigned_to) || '—'}
          </span>
        ) : (
          <span className="text-xs font-semibold text-amber-600">
            Sem consultor
          </span>
        ),
    },
  ]

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <div className="shrink-0 space-y-3 border-b border-zinc-200 bg-[#f3f4f6] px-5 pb-3 pt-4">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <MetricTile
            label="Total de leads"
            value={totais.total}
            hint="Base no CRM"
            bars={[40, 55, 48, 70, 100]}
          />
          <MetricTile
            label="Atribuídos"
            value={totais.atribuidos}
            hint={`${totais.pctAtribuidos}% · fila ${totais.fila}`}
            variant="progress"
            progress={totais.pctAtribuidos}
          />
          <MetricTile
            label="Consultores ativos"
            value={totais.ativos}
            hint={
              totais.pendentes > 0
                ? `${totais.pendentes} pendente(s)`
                : 'Com acesso'
            }
            bars={[30, 45, 50, 65, 80]}
          />
          <MetricTile
            label="Sem carteira"
            value={totais.semLeads}
            hint="Ativos sem leads"
            bars={[20, 35, 28, 50, 60]}
          />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex gap-1 rounded-xl bg-white p-1 shadow-sm ring-1 ring-zinc-200">
            {(
              [
                { id: 'leads' as const, label: 'Leads' },
                { id: 'consultores' as const, label: 'Consultores' },
              ] as const
            ).map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={`rounded-lg px-3 py-2 text-sm font-semibold transition ${
                  tab === t.id
                    ? 'bg-liqui-navy text-white'
                    : 'text-zinc-600 hover:bg-zinc-50'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap gap-2">
            {selected.size > 0 && (
              <>
                <button
                  type="button"
                  onClick={() => openPanel('um')}
                  className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm font-semibold text-liqui-navy"
                >
                  Atribuir ({selected.size})
                </button>
                <button
                  type="button"
                  onClick={() => openPanel('fila')}
                  className="rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700"
                >
                  Desatribuir ({selected.size})
                </button>
              </>
            )}
            <button
              type="button"
              onClick={() => openPanel()}
              className="inline-flex items-center gap-1.5 rounded-xl bg-liqui-navy px-3 py-2 text-sm font-bold text-white"
            >
              <SlidersHorizontal className="h-4 w-4 text-liqui-orange" />
              Painel
              {selected.size > 0 ? ` (${selected.size})` : ''}
            </button>
          </div>
        </div>

        {error && (
          <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-600">
            {error}
          </p>
        )}
        {flash && (
          <p className="rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
            {flash}
          </p>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-hidden p-5">
        {tab === 'leads' && (
          <div className="flex h-full min-h-0 flex-col gap-3">
            <div className="flex shrink-0 flex-wrap items-center gap-2">
              <input
                value={fQuery}
                onChange={(e) => setFQuery(e.target.value)}
                placeholder="Buscar…"
                className="w-[160px] rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-xs outline-none focus:border-liqui-orange"
              />
              <select
                value={fOrigem}
                onChange={(e) => setFOrigem(e.target.value)}
                className="rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-xs"
              >
                <option value="todas">Origem</option>
                {origens.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
              <select
                value={fStatus}
                onChange={(e) => setFStatus(e.target.value)}
                className="rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-xs"
              >
                <option value="todos">Status</option>
                {statusList.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
              <select
                value={fConsultor}
                onChange={(e) => setFConsultor(e.target.value)}
                className="rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-xs"
              >
                <option value="todos">Todos consultores</option>
                <option value="sem">Sem consultor</option>
                {consultores.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.full_name}
                  </option>
                ))}
              </select>
              <span className="text-xs text-zinc-500">
                {selected.size} selecionado(s) · {filteredLeads.length} na
                tabela
              </span>
            </div>
            <div className="min-h-0 flex-1">
              <DataTable
                columns={leadColumns}
                rows={filteredLeads}
                rowKey={(r) => r.id_lead}
                pageSize={30}
                emptyMessage={loading ? 'Carregando…' : 'Nenhum lead'}
              />
            </div>
          </div>
        )}

        {tab === 'consultores' && (
          <div className="flex h-full min-h-0 flex-col gap-3">
            <div className="flex shrink-0 flex-wrap items-center gap-2">
              <Users className="h-4 w-4 text-liqui-orange" />
              <div className="relative">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-400" />
                <input
                  value={cQuery}
                  onChange={(e) => setCQuery(e.target.value)}
                  placeholder="Buscar consultor…"
                  className="w-[180px] rounded-full border border-zinc-200 bg-white py-1.5 pl-8 pr-3 text-xs"
                />
              </div>
              <DateRangePills value={cDays} onChange={setCDays} />
            </div>
            <div className="min-h-0 flex-1">
              <DataTable
                columns={consultorColumns}
                rows={filteredConsultores}
                rowKey={(r) => r.consultor_id}
                pageSize={25}
                emptyMessage={loading ? 'Carregando…' : 'Nenhum consultor'}
              />
            </div>
          </div>
        )}
      </div>

      <DistributeSideOver
        open={showConfig}
        onClose={() => setShowConfig(false)}
        saving={saving}
        mode={mode}
        onMode={setMode}
        targetId={targetId}
        onTarget={setTargetId}
        includeInactive={includeInactive}
        onIncludeInactive={setIncludeInactive}
        onlyUnassigned={onlyUnassigned}
        onOnlyUnassigned={setOnlyUnassigned}
        poolAuto={poolAuto}
        onPoolAuto={setPoolAuto}
        poolIds={poolIds}
        onTogglePoolId={(id) => {
          setPoolIds((prev) => {
            const next = new Set(prev)
            if (next.has(id)) next.delete(id)
            else next.add(id)
            return next
          })
        }}
        selectedCount={selected.size}
        loteCount={loteIds.length}
        lotePreview={lotePreview}
        consultores={consultores}
        dist={dist}
        poolSize={consultoresPool.length}
        nameById={nameById}
        onApply={() => void handleApply()}
        error={panelError}
      />
    </div>
  )
}

function MetricTile({
  label,
  value,
  hint,
  bars,
  variant = 'bars',
  progress = 0,
}: {
  label: string
  value: number
  hint: string
  bars?: number[]
  variant?: 'bars' | 'progress'
  progress?: number
}) {
  const spark = bars || [25, 40, 35, 55, 70]
  return (
    <div className="rounded-2xl border border-zinc-200/80 bg-white p-4 shadow-sm">
      <p className="text-[11px] font-bold uppercase tracking-wide text-zinc-500">
        {label}
      </p>
      <div className="mt-2 flex items-end justify-between gap-3">
        <div>
          <p className="text-3xl font-extrabold tracking-tight text-liqui-navy">
            {value}
          </p>
          <p className="mt-0.5 text-xs text-zinc-500">{hint}</p>
        </div>
        {variant === 'bars' ? (
          <div className="flex h-10 items-end gap-1" aria-hidden>
            {spark.map((h, i) => (
              <span
                key={i}
                className={`w-1.5 rounded-sm ${
                  i === spark.length - 1
                    ? 'bg-liqui-orange'
                    : 'bg-liqui-orange/25'
                }`}
                style={{ height: `${Math.max(12, Math.min(100, h))}%` }}
              />
            ))}
          </div>
        ) : (
          <div className="mb-1 w-[88px]">
            <div className="h-1.5 overflow-hidden rounded-full bg-zinc-100">
              <div
                className="h-full rounded-full bg-liqui-orange"
                style={{ width: `${Math.max(0, Math.min(100, progress))}%` }}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
