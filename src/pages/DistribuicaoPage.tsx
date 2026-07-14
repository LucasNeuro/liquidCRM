import { useCallback, useEffect, useMemo, useState } from 'react'
import { RefreshCw, Search, SlidersHorizontal, Users } from 'lucide-react'
import { DataTable, type DataColumn } from '../components/ui/DataTable'
import {
  DateRangePills,
  isWithinLastDays,
  type CadastroDays,
} from '../components/ui/DateRangePills'
import { LeadIdBadge, UuidBadge } from '../components/ui/IdBadge'
import { SideOver } from '../components/ui/SideOver'
import { useShellHeader } from '../layouts/ShellContext'
import {
  assignLeadsBulk,
  fetchAllLeadsForDistribution,
  fetchLeadDistribution,
  redistributeRoundRobin,
  type LeadDistributionRow,
} from '../lib/distribuicao'
import { fetchProfiles, type Profile } from '../lib/profiles'
import { ConsultorPickTable, consultorLabel } from '../components/distribuicao/ConsultorPickTable'
import { uniqueOptions } from '../components/ui/CrmFilters'
import type { Lead } from '../lib/types'

type MainTab = 'visao' | 'consultores' | 'leads'

export function DistribuicaoPage() {
  const { setHeader } = useShellHeader()
  const [tab, setTab] = useState<MainTab>('visao')
  const [dist, setDist] = useState<LeadDistributionRow[]>([])
  const [leads, setLeads] = useState<Lead[]>([])
  const [consultores, setConsultores] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [flash, setFlash] = useState<string | null>(null)
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [showConfig, setShowConfig] = useState(false)
  const [saving, setSaving] = useState(false)

  // Filtros da tabela de leads
  const [fOrigem, setFOrigem] = useState('todas')
  const [fStatus, setFStatus] = useState('todos')
  const [fConsultor, setFConsultor] = useState('todos')
  const [fQuery, setFQuery] = useState('')

  // Filtros da aba consultores
  const [cQuery, setCQuery] = useState('')
  const [cDays, setCDays] = useState<CadastroDays | null>(null)

  // Sideover: destino (lote = seleção atual)
  const [mode, setMode] = useState<'um' | 'roundrobin' | 'fila'>('roundrobin')
  const [targetId, setTargetId] = useState('')
  /** Rodízio usa só ativos por padrão — pendentes não logam no CRM. */
  const [includeInactive, setIncludeInactive] = useState(false)
  const [loteSemConsultor, setLoteSemConsultor] = useState(true)

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
      setSelected(new Set())
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
    setHeader({
      title: 'Distribuição de leads',
      subtitle: 'Operação · quem trata cada lead no CRM',
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
    const pctSemLeads =
      ativos > 0 ? Math.round((semLeads / ativos) * 100) : 0
    return {
      atribuidos,
      fila,
      ativos,
      pendentes,
      semLeads,
      pctAtribuidos,
      pctSemLeads,
      total: leads.length,
    }
  }, [leads, consultores])

  const consultoresAtivos = useMemo(
    () => consultores.filter((c) => c.active !== false),
    [consultores],
  )

  const consultoresPool = useMemo(() => {
    if (includeInactive) return consultores
    return consultoresAtivos
  }, [consultores, consultoresAtivos, includeInactive])

  /** Lote final: seleção marcada, ou (se vazio) todos / só sem consultor. */
  const loteIds = useMemo(() => {
    if (selected.size > 0) {
      let ids = Array.from(selected)
      if (loteSemConsultor) {
        ids = ids.filter((id) => {
          const l = leads.find((x) => x.id_lead === id)
          return Boolean(l && !l.assigned_to)
        })
      }
      return ids
    }
    if (loteSemConsultor) {
      return leads.filter((l) => !l.assigned_to).map((l) => l.id_lead)
    }
    return leads.map((l) => l.id_lead)
  }, [selected, leads, loteSemConsultor])

  const byOrigem = useMemo(() => {
    const map = new Map<string, { total: number; sem: number }>()
    for (const l of leads) {
      const k = l.origem?.trim() || 'Sem origem'
      const cur = map.get(k) || { total: 0, sem: 0 }
      cur.total += 1
      if (!l.assigned_to) cur.sem += 1
      map.set(k, cur)
    }
    return Array.from(map.entries())
      .map(([key, v]) => ({
        key,
        total: v.total,
        sem: v.sem,
        atribuidos: v.total - v.sem,
      }))
      .sort((a, b) => b.total - a.total)
  }, [leads])

  const byStatus = useMemo(() => {
    const map = new Map<string, { total: number; sem: number }>()
    for (const l of leads) {
      const k = l.status?.trim() || 'Sem status'
      const cur = map.get(k) || { total: 0, sem: 0 }
      cur.total += 1
      if (!l.assigned_to) cur.sem += 1
      map.set(k, cur)
    }
    return Array.from(map.entries())
      .map(([key, v]) => ({
        key,
        total: v.total,
        sem: v.sem,
        atribuidos: v.total - v.sem,
      }))
      .sort((a, b) => b.total - a.total)
  }, [leads])

  function openDistribuirBucket(
    kind: 'origem' | 'status',
    value: string,
    onlySemConsultor = true,
  ) {
    const ids = leads
      .filter((l) => {
        if (onlySemConsultor && l.assigned_to) return false
        if (kind === 'origem') {
          const o = l.origem?.trim() || 'Sem origem'
          return o === value
        }
        const s = l.status?.trim() || 'Sem status'
        return s === value
      })
      .map((l) => l.id_lead)

    setSelected(new Set(ids))
    setLoteSemConsultor(onlySemConsultor)
    setIncludeInactive(false)
    setMode('roundrobin')
    setTargetId('')
    setShowConfig(true)
  }

  function openConfigFromToolbar() {
    setLoteSemConsultor(selected.size === 0 ? true : false)
    setIncludeInactive(false)
    setMode('roundrobin')
    setShowConfig(true)
  }

  function goLeadsFiltered(kind: 'origem' | 'status', value: string) {
    if (kind === 'origem') {
      setFOrigem(value === 'Sem origem' ? '__none__' : value)
      setFStatus('todos')
    } else {
      setFStatus(value === 'Sem status' ? '__none__' : value)
      setFOrigem('todas')
    }
    setFConsultor('todos')
    setTab('leads')
  }

  async function handleRedistribuir() {
    setSaving(true)
    setError(null)
    try {
      const ids = loteIds
      if (ids.length === 0) {
        setError(
          loteSemConsultor
            ? 'Nenhum lead sem consultor neste lote.'
            : 'Nenhum lead no lote. Selecione na aba Leads ou use Distribuir nas tabelas.',
        )
        return
      }
      if (mode === 'fila') {
        await assignLeadsBulk(ids, null)
        setFlash(`${ids.length} lead(s) ficaram sem consultor.`)
      } else if (mode === 'um') {
        if (!targetId) {
          setError('Escolha o consultor de destino.')
          return
        }
        const dest = consultores.find((c) => c.id === targetId)
        if (dest?.active === false && !includeInactive) {
          setError(
            'Este consultor ainda está pendente. Ative-o em Plataforma → Usuários ou marque “incluir pendentes”.',
          )
          return
        }
        await assignLeadsBulk(ids, targetId)
        setFlash(
          `${ids.length} lead(s) atribuídos a ${nameById.get(targetId) || 'consultor'}.`,
        )
      } else {
        const pool = consultoresPool.map((c) => c.id)
        if (pool.length === 0) {
          setError(
            totais.pendentes > 0
              ? `Nenhum consultor ativo. Há ${totais.pendentes} pendente(s) — ative em Plataforma → Usuários.`
              : 'Nenhum consultor cadastrado para o rodízio.',
          )
          return
        }
        await redistributeRoundRobin(ids, pool)
        setFlash(
          `${ids.length} lead(s) em rodízio entre ${pool.length} consultor(es)${includeInactive ? '' : ' ativo(s)'}.`,
        )
      }
      setShowConfig(false)
      setSelected(new Set())
      await load()
      setTimeout(() => setFlash(null), 3500)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao redistribuir')
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
    { key: 'abertos', label: 'Abertos', render: (r) => r.abertos },
    { key: 'ganhos', label: 'Ganhos', render: (r) => r.ganhos },
    { key: 'perdidos', label: 'Perdidos', render: (r) => r.perdidos },
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
          aria-label={`Selecionar ${r.nome}`}
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
      key: 'produto',
      label: 'Produto',
      render: (r) => r.produto_interesse || '—',
    },
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

  const tabs: { id: MainTab; label: string }[] = [
    { id: 'visao', label: 'Visão geral' },
    { id: 'consultores', label: 'Consultores' },
    { id: 'leads', label: 'Leads' },
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
            hint={`${totais.pctAtribuidos}% da base`}
            variant="progress"
            progress={totais.pctAtribuidos}
            progressLabel={`${totais.atribuidos} de ${totais.total}`}
          />
          <MetricTile
            label="Consultores ativos"
            value={totais.ativos}
            hint={
              totais.pendentes > 0
                ? `${totais.pendentes} pendente(s)`
                : 'Com acesso liberado'
            }
            bars={[30, 45, 50, 65, Math.min(100, totais.ativos * 8 || 12)]}
          />
          <MetricTile
            label="Consultor sem leads"
            value={totais.semLeads}
            hint="Ativos ainda sem carteira"
            trend={`${totais.pctSemLeads}%`}
            bars={[20, 35, 28, 50, Math.min(100, totais.semLeads * 10 || 8)]}
          />
        </div>

        {totais.pendentes > 0 && (
          <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            {totais.pendentes} consultor(es) pendente(s) — ainda sem acesso ao
            CRM. Ative em <strong>Plataforma → Usuários</strong>. O rodízio usa
            só os {totais.ativos} ativo(s).
          </p>
        )}
        {totais.ativos === 0 && (
          <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            Nenhum consultor ativo. Distribuição em rodízio fica bloqueada até
            você aprovar alguém.
          </p>
        )}

        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex gap-1 rounded-xl bg-white p-1 shadow-sm ring-1 ring-zinc-200">
            {tabs.map((t) => (
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

          <button
            type="button"
            onClick={openConfigFromToolbar}
            className="inline-flex items-center gap-1.5 rounded-xl bg-liqui-navy px-3 py-2 text-sm font-bold text-white"
          >
            <SlidersHorizontal className="h-4 w-4 text-liqui-orange" />
            Distribuição
            {selected.size > 0 ? ` (${selected.size})` : ''}
          </button>
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
        {tab === 'visao' && (
          <div className="grid h-full min-h-0 gap-4 lg:grid-cols-2">
            <div className="flex min-h-0 flex-col">
              <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-zinc-400">
                Por origem (canal)
              </p>
              <div className="min-h-0 flex-1">
                <DataTable
                  columns={[
                    {
                      key: 'key',
                      label: 'Origem',
                      render: (r) => (
                        <span className="font-semibold text-liqui-navy">
                          {r.key}
                        </span>
                      ),
                    },
                    { key: 'total', label: 'Total', render: (r) => r.total },
                    {
                      key: 'atribuidos',
                      label: 'Com consultor',
                      render: (r) => r.atribuidos,
                    },
                    {
                      key: 'sem',
                      label: 'Sem consultor',
                      render: (r) => (
                        <span className="font-semibold text-amber-600">
                          {r.sem}
                        </span>
                      ),
                    },
                    {
                      key: 'acoes',
                      label: 'Ações',
                      render: (r) => (
                        <div className="flex gap-1">
                          <button
                            type="button"
                            onClick={() => goLeadsFiltered('origem', r.key)}
                            className="rounded-lg border border-zinc-200 px-2 py-1 text-[11px] font-semibold text-zinc-600 hover:bg-zinc-50"
                          >
                            Ver
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              openDistribuirBucket('origem', r.key, true)
                            }
                            className="rounded-lg bg-liqui-navy px-2 py-1 text-[11px] font-bold text-white"
                          >
                            Distribuir
                          </button>
                        </div>
                      ),
                    },
                  ]}
                  rows={byOrigem}
                  rowKey={(r) => r.key}
                  pageSize={12}
                  emptyMessage={loading ? 'Carregando…' : 'Sem dados'}
                />
              </div>
            </div>
            <div className="flex min-h-0 flex-col">
              <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-zinc-400">
                Por status
              </p>
              <div className="min-h-0 flex-1">
                <DataTable
                  columns={[
                    {
                      key: 'key',
                      label: 'Status',
                      render: (r) => (
                        <span className="font-semibold text-liqui-navy">
                          {r.key}
                        </span>
                      ),
                    },
                    { key: 'total', label: 'Total', render: (r) => r.total },
                    {
                      key: 'atribuidos',
                      label: 'Com consultor',
                      render: (r) => r.atribuidos,
                    },
                    {
                      key: 'sem',
                      label: 'Sem consultor',
                      render: (r) => (
                        <span className="font-semibold text-amber-600">
                          {r.sem}
                        </span>
                      ),
                    },
                    {
                      key: 'acoes',
                      label: 'Ações',
                      render: (r) => (
                        <div className="flex gap-1">
                          <button
                            type="button"
                            onClick={() => goLeadsFiltered('status', r.key)}
                            className="rounded-lg border border-zinc-200 px-2 py-1 text-[11px] font-semibold text-zinc-600 hover:bg-zinc-50"
                          >
                            Ver
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              openDistribuirBucket('status', r.key, true)
                            }
                            className="rounded-lg bg-liqui-navy px-2 py-1 text-[11px] font-bold text-white"
                          >
                            Distribuir
                          </button>
                        </div>
                      ),
                    },
                  ]}
                  rows={byStatus}
                  rowKey={(r) => r.key}
                  pageSize={12}
                  emptyMessage={loading ? 'Carregando…' : 'Sem dados'}
                />
              </div>
            </div>
          </div>
        )}

        {tab === 'consultores' && (
          <div className="flex h-full min-h-0 flex-col gap-3">
            <div className="flex shrink-0 flex-wrap items-center gap-2">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-liqui-orange" />
                <p className="text-sm font-extrabold text-liqui-navy">
                  Distribuição por consultor
                </p>
              </div>
              <div className="relative">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-400" />
                <input
                  value={cQuery}
                  onChange={(e) => setCQuery(e.target.value)}
                  placeholder="Buscar consultor…"
                  className="w-[180px] rounded-full border border-zinc-200 bg-white py-1.5 pl-8 pr-3 text-xs outline-none focus:border-liqui-orange"
                />
              </div>
              <DateRangePills value={cDays} onChange={setCDays} />
              <span className="text-xs text-zinc-500">
                {filteredConsultores.length} consultor(es)
              </span>
            </div>
            <div className="min-h-0 flex-1">
              <DataTable
                columns={consultorColumns}
                rows={filteredConsultores}
                rowKey={(r) => r.consultor_id}
                pageSize={25}
                emptyMessage={
                  loading
                    ? 'Carregando…'
                    : 'Nenhum consultor no filtro. Rode seed-consultores-leads.sql'
                }
              />
            </div>
          </div>
        )}

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
                className="rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-xs outline-none"
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
                className="rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-xs outline-none"
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
                className="rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-xs outline-none"
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
                {selected.size} selecionado(s) · {filteredLeads.length}{' '}
                na tabela
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
      </div>

      {showConfig && (
        <SideOver
          title="Distribuir leads"
          subtitle="Quem recebe o lote · busca + minitabela"
          onClose={() => setShowConfig(false)}
          widthClass="max-w-xl"
          footer={
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setShowConfig(false)}
                className="flex-1 rounded-xl border border-zinc-200 px-4 py-2.5 text-sm font-semibold"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={saving || (mode !== 'fila' && loteIds.length === 0)}
                onClick={() => void handleRedistribuir()}
                className="flex-1 rounded-xl bg-liqui-orange px-4 py-2.5 text-sm font-bold text-white disabled:opacity-60"
              >
                {saving ? 'Aplicando…' : `Aplicar (${loteIds.length})`}
              </button>
            </div>
          }
        >
          <div className="space-y-4">
            <div className="rounded-xl bg-zinc-50 px-3 py-3 text-sm text-zinc-700">
              {selected.size > 0 ? (
                <p>
                  Lote: <strong>{selected.size}</strong> lead(s) marcados
                  {loteSemConsultor
                    ? ` → ${loteIds.length} sem consultor`
                    : ` → ${loteIds.length} no total`}
                  .
                </p>
              ) : (
                <p>
                  Sem seleção — usando a fila{' '}
                  <strong>sem consultor</strong> ({totais.fila} lead(s)).
                  Marque leads na aba Leads para um lote específico.
                </p>
              )}
            </div>

            <label className="flex items-start gap-2 rounded-xl border border-zinc-100 px-3 py-2 text-sm">
              <input
                type="checkbox"
                className="mt-0.5"
                checked={loteSemConsultor}
                onChange={(e) => setLoteSemConsultor(e.target.checked)}
              />
              <span>
                <span className="font-semibold text-liqui-navy">
                  Só leads sem consultor
                </span>
                <span className="mt-0.5 block text-xs text-zinc-500">
                  Evita redistribuir quem já tem dono.
                </span>
              </span>
            </label>

            <fieldset className="space-y-2">
              <legend className="text-xs font-bold uppercase tracking-wide text-zinc-400">
                Destino
              </legend>
              {(
                [
                  {
                    id: 'roundrobin' as const,
                    label: 'Rodízio entre consultores ativos',
                    hint: `${consultoresPool.length} no pool`,
                  },
                  {
                    id: 'um' as const,
                    label: 'Um consultor específico',
                    hint: null,
                  },
                  {
                    id: 'fila' as const,
                    label: 'Remover consultor',
                    hint: 'volta pra fila',
                  },
                ] as const
              ).map((m) => (
                <label
                  key={m.id}
                  className={`flex cursor-pointer items-center justify-between gap-2 rounded-xl border px-3 py-2.5 text-sm ${
                    mode === m.id
                      ? 'border-liqui-orange/40 bg-liqui-orange-soft/40'
                      : 'border-zinc-100'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="dist-mode"
                      checked={mode === m.id}
                      onChange={() => setMode(m.id)}
                    />
                    {m.label}
                  </span>
                  {m.hint && (
                    <span className="text-[11px] font-semibold text-zinc-400">
                      {m.hint}
                    </span>
                  )}
                </label>
              ))}
            </fieldset>

            {mode === 'um' && (
              <ConsultorPickTable
                consultores={consultores}
                dist={dist}
                selectedId={targetId}
                onSelect={setTargetId}
                includeInactive={includeInactive}
              />
            )}

            {mode === 'roundrobin' && (
              <div className="space-y-3">
                <div className="space-y-2 rounded-xl border border-zinc-100 px-3 py-3">
                  <p className="text-sm text-liqui-navy">
                    Pool do rodízio:{' '}
                    <strong>
                      {consultoresPool.length} consultor(es)
                      {!includeInactive ? ' ativos' : ''}
                    </strong>
                  </p>
                  {totais.pendentes > 0 && (
                    <label className="flex items-start gap-2 text-sm text-zinc-600">
                      <input
                        type="checkbox"
                        className="mt-0.5"
                        checked={includeInactive}
                        onChange={(e) => setIncludeInactive(e.target.checked)}
                      />
                      <span>
                        Incluir {totais.pendentes} pendente(s) no rodízio
                        <span className="mt-0.5 block text-xs text-amber-700">
                          Não recomendado: pendentes podem não acessar o CRM.
                        </span>
                      </span>
                    </label>
                  )}
                  {consultoresPool.length === 0 && (
                    <p className="text-xs font-semibold text-amber-700">
                      Sem destinatários no pool.
                    </p>
                  )}
                </div>
                <ConsultorPickTable
                  title="Consultores no pool"
                  consultores={consultoresPool}
                  dist={dist}
                  selectedId=""
                  onSelect={() => undefined}
                  includeInactive
                  readOnly
                />
              </div>
            )}
          </div>
        </SideOver>
      )}
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
  progressLabel,
  trend,
}: {
  label: string
  value: number
  hint: string
  bars?: number[]
  variant?: 'bars' | 'progress'
  progress?: number
  progressLabel?: string
  trend?: string
}) {
  const spark = bars || [25, 40, 35, 55, 70]
  return (
    <div className="rounded-2xl border border-zinc-200/80 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <p className="text-[11px] font-bold uppercase tracking-wide text-zinc-500">
          {label}
        </p>
        {trend != null && (
          <span className="text-[11px] font-bold text-liqui-orange">{trend}</span>
        )}
      </div>

      <div className="mt-2 flex items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="text-3xl font-extrabold tracking-tight text-liqui-navy">
            {value}
          </p>
          <p className="mt-0.5 text-xs text-zinc-500">{hint}</p>
        </div>

        {variant === 'bars' ? (
          <div className="flex h-10 items-end gap-1 pb-0.5" aria-hidden>
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
          <div className="mb-1 w-[88px] shrink-0">
            <div className="h-1.5 overflow-hidden rounded-full bg-zinc-100">
              <div
                className="h-full rounded-full bg-liqui-orange transition-all"
                style={{ width: `${Math.max(0, Math.min(100, progress))}%` }}
              />
            </div>
            <div className="mt-1 flex justify-between text-[10px] font-semibold text-zinc-400">
              <span>{progressLabel || '—'}</span>
              <span>{Math.round(progress)}%</span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
