import { useEffect, useMemo, useState } from 'react'
import {
  Layers3,
  Mail,
  Phone,
  RefreshCw,
  Search,
  Star,
  Trophy,
  X,
} from 'lucide-react'
import { LeadDrawer } from '../components/leads/LeadDrawer'
import { LeadKanbanCard } from '../components/leads/LeadKanbanCard'
import { PipelineManagerSideOver } from '../components/crm/PipelineManagerSideOver'
import {
  FilterSelect,
  matchesQuery,
  uniqueOptions,
} from '../components/ui/CrmFilters'
import { DataTable, type DataColumn } from '../components/ui/DataTable'
import { LeadAvatar } from '../components/ui/LeadAvatar'
import { LeadIdBadge, UuidBadge } from '../components/ui/IdBadge'
import { useShellHeader } from '../layouts/ShellContext'
import { useAuth } from '../contexts/AuthContext'
import { onCrmChanged } from '../lib/crmEvents'
import { formatCellValue } from '../lib/format'
import {
  fetchLeadIdsWithInsights,
  fetchLeads,
  fetchRespostas,
  fetchTentativas,
  isLeadClassified,
} from '../lib/leads'
import {
  fetchPipelines,
  fetchStages,
  updateLeadStage,
  type Pipeline,
  type PipelineStage,
} from '../lib/pipelines'
import { supabase } from '../lib/supabase'
import type { Lead, RespostaPesquisa, TentativaCompra } from '../lib/types'

const STAGE_ICONS = [Mail, Phone, Star, Trophy, Layers3]

export function LeadsPage() {
  const { setHeader } = useShellHeader()
  const { isOwner, isConsultor } = useAuth()
  const [leads, setLeads] = useState<Lead[]>([])
  const [tentativas, setTentativas] = useState<TentativaCompra[]>([])
  const [respostas, setRespostas] = useState<RespostaPesquisa[]>([])
  const [pipelines, setPipelines] = useState<Pipeline[]>([])
  const [stages, setStages] = useState<PipelineStage[]>([])
  const [pipelineId, setPipelineId] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [origem, setOrigem] = useState('todas')
  const [produto, setProduto] = useState('todos')
  const [statusFiltro, setStatusFiltro] = useState('todos')
  const [stageFiltro, setStageFiltro] = useState('todos')
  const [intentFiltro, setIntentFiltro] = useState('todos')
  const [iaFiltro, setIaFiltro] = useState<
    'todos' | 'classificados' | 'com_insight' | 'ambos' | 'sem_ia'
  >('todos')
  const [insightLeadIds, setInsightLeadIds] = useState<Set<number>>(
    () => new Set(),
  )
  const [selected, setSelected] = useState<Lead | null>(null)
  const [draggingId, setDraggingId] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)
  const [view, setView] = useState<'kanban' | 'lista'>('kanban')
  const [showPipelineManager, setShowPipelineManager] = useState(false)

  async function loadStructure() {
    const pipes = await fetchPipelines()
    setPipelines(pipes)
    const active =
      pipes.find((p) => p.id === pipelineId) ||
      pipes.find((p) => p.is_default) ||
      pipes[0]
    if (!active) {
      setPipelineId('')
      setStages([])
      return
    }
    setPipelineId(active.id)
    const st = await fetchStages(active.id)
    setStages(st)
  }

  async function loadAll() {
    setLoading(true)
    setError(null)
    try {
      const [l, t, r, insightIds] = await Promise.all([
        fetchLeads(),
        fetchTentativas(),
        fetchRespostas(),
        fetchLeadIdsWithInsights(),
      ])
      setLeads(l)
      setTentativas(t)
      setRespostas(r)
      setInsightLeadIds(insightIds)
      await loadStructure()
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Falha ao carregar. Rode supabase/pipelines.sql se ainda não rodou.',
      )
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadAll()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const off = onCrmChanged(() => {
      void loadAll()
    })
    const channel = supabase
      .channel('leads-page-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'leads' },
        () => {
          void loadAll()
        },
      )
      .subscribe()
    return () => {
      off()
      void supabase.removeChannel(channel)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    setHeader({
      title: isConsultor ? 'Meus leads' : 'Leads',
      subtitle: isConsultor
        ? `Kanban · ${leads.length} lead(s) atribuído(s)${saving ? ' · salvando…' : ''}`
        : `Leads · ${leads.length} leads${saving ? ' · salvando…' : ''}`,
      actions: (
        <button
          type="button"
          onClick={() => void loadAll()}
          className="inline-flex items-center gap-2 rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm font-semibold text-zinc-700 hover:bg-zinc-50"
        >
          <RefreshCw className="h-4 w-4" />
          Atualizar
        </button>
      ),
    })
  }, [leads.length, saving, setHeader, isConsultor])

  async function switchPipeline(id: string) {
    setPipelineId(id)
    const st = await fetchStages(id)
    setStages(st)
  }

  const origens = useMemo(
    () => uniqueOptions(leads.map((l) => l.origem)),
    [leads],
  )
  const produtos = useMemo(
    () => uniqueOptions(leads.map((l) => l.produto_interesse)),
    [leads],
  )
  const statusList = useMemo(
    () => uniqueOptions(leads.map((l) => l.status)),
    [leads],
  )
  const intents = useMemo(
    () => uniqueOptions(leads.map((l) => l.intent_gemini)),
    [leads],
  )

  const hasActiveFilters =
    query.trim() !== '' ||
    origem !== 'todas' ||
    produto !== 'todos' ||
    statusFiltro !== 'todos' ||
    stageFiltro !== 'todos' ||
    intentFiltro !== 'todos' ||
    iaFiltro !== 'todos'

  function clearFilters() {
    setQuery('')
    setOrigem('todas')
    setProduto('todos')
    setStatusFiltro('todos')
    setStageFiltro('todos')
    setIntentFiltro('todos')
    setIaFiltro('todos')
  }

  const filtered = useMemo(() => {
    return leads.filter((lead) => {
      if (origem !== 'todas' && lead.origem !== origem) return false
      if (produto !== 'todos' && lead.produto_interesse !== produto) return false
      if (statusFiltro !== 'todos' && (lead.status || '') !== statusFiltro) {
        return false
      }
      if (stageFiltro !== 'todos' && (lead.stage_id || '') !== stageFiltro) {
        return false
      }
      if (
        intentFiltro !== 'todos' &&
        (lead.intent_gemini || '') !== intentFiltro
      ) {
        return false
      }

      const classified = isLeadClassified(lead)
      const hasInsight = insightLeadIds.has(lead.id_lead)
      if (iaFiltro === 'classificados' && !classified) return false
      if (iaFiltro === 'com_insight' && !hasInsight) return false
      if (iaFiltro === 'ambos' && !(classified && hasInsight)) return false
      if (iaFiltro === 'sem_ia' && (classified || hasInsight)) return false

      return matchesQuery(
        [
          lead.id_lead,
          lead.nome,
          lead.email,
          lead.telefone,
          lead.origem,
          lead.produto_interesse,
          lead.status,
          lead.data_entrada,
          lead.score_gemini,
          lead.intent_gemini,
          lead.labels_gemini?.join(' '),
          lead.pipeline_id,
          lead.stage_id,
        ],
        query,
      )
    })
  }, [
    leads,
    query,
    origem,
    produto,
    statusFiltro,
    stageFiltro,
    intentFiltro,
    iaFiltro,
    insightLeadIds,
  ])

  const kpis = useMemo(() => {
    const noFunnel = filtered.length
    const ganho = filtered.filter((l) => (l.status || '') === 'Ganho').length
    const followup = filtered.filter((l) =>
      ['Novo', 'Em contato'].includes(l.status || ''),
    ).length
    const abertos = filtered.filter((l) => l.status !== 'Perdido').length
    return { noFunnel, ganho, followup, abertos }
  }, [filtered])

  async function moveLead(idLead: number, stage: PipelineStage) {
    const current = leads.find((l) => l.id_lead === idLead)
    if (!current) return
    if (current.stage_id === stage.id || current.status === stage.name) return

    const previous = {
      status: current.status,
      stage_id: current.stage_id,
      pipeline_id: current.pipeline_id,
    }

    setLeads((prev) =>
      prev.map((l) =>
        l.id_lead === idLead
          ? {
              ...l,
              status: stage.name,
              stage_id: stage.id,
              pipeline_id: stage.pipeline_id,
            }
          : l,
      ),
    )
    setSaving(true)
    try {
      await updateLeadStage({
        idLead,
        stageId: stage.id,
        stageName: stage.name,
        pipelineId: stage.pipeline_id,
      })
    } catch (err) {
      setLeads((prev) =>
        prev.map((l) =>
          l.id_lead === idLead
            ? {
                ...l,
                status: previous.status,
                stage_id: previous.stage_id,
                pipeline_id: previous.pipeline_id,
              }
            : l,
        ),
      )
      setError(err instanceof Error ? err.message : 'Falha ao mover lead')
    } finally {
      setSaving(false)
    }
  }

  function stageForLead(lead: Lead) {
    if (lead.stage_id) {
      return stages.find((s) => s.id === lead.stage_id)
    }
    return stages.find((s) => s.name === (lead.status || 'Novo'))
  }

  const cell = (v: unknown, key?: string) => formatCellValue(v, key)

  const leadTableColumns: DataColumn<Lead>[] = [
    {
      key: 'nome',
      label: 'nome',
      render: (l) => (
        <div className="flex items-center gap-2">
          <LeadAvatar name={l.nome} size="sm" />
          <span className="font-semibold text-liqui-navy">{l.nome}</span>
        </div>
      ),
    },
    {
      key: 'id_lead',
      label: 'id_lead',
      render: (l) => <LeadIdBadge id={l.id_lead} />,
    },
    { key: 'email', label: 'email', render: (l) => cell(l.email) },
    { key: 'telefone', label: 'telefone', render: (l) => cell(l.telefone) },
    { key: 'origem', label: 'origem', render: (l) => cell(l.origem) },
    {
      key: 'produto_interesse',
      label: 'produto_interesse',
      render: (l) => cell(l.produto_interesse),
    },
    { key: 'status', label: 'status', render: (l) => cell(l.status) },
    {
      key: 'data_entrada',
      label: 'data_entrada',
      render: (l) => cell(l.data_entrada, 'data_entrada'),
    },
    {
      key: 'score_gemini',
      label: 'score_gemini',
      render: (l) => cell(l.score_gemini),
    },
    {
      key: 'intent_gemini',
      label: 'intent_gemini',
      render: (l) => cell(l.intent_gemini),
    },
    {
      key: 'ia',
      label: 'ia',
      render: (l) => {
        const classified = isLeadClassified(l)
        const hasInsight = insightLeadIds.has(l.id_lead)
        if (!classified && !hasInsight) {
          return <span className="text-zinc-400">—</span>
        }
        return (
          <span className="inline-flex flex-wrap gap-1">
            {classified && (
              <span className="rounded-md bg-liqui-orange px-1.5 py-0.5 text-[10px] font-bold text-white">
                classificado
              </span>
            )}
            {hasInsight && (
              <span className="rounded-md bg-liqui-navy px-1.5 py-0.5 text-[10px] font-bold text-white">
                insight
              </span>
            )}
          </span>
        )
      },
    },
    {
      key: 'labels_gemini',
      label: 'labels_gemini',
      render: (l) =>
        Array.isArray(l.labels_gemini) && l.labels_gemini.length
          ? l.labels_gemini.join(', ')
          : '—',
    },
    {
      key: 'created_at',
      label: 'created_at',
      render: (l) => cell(l.created_at, 'created_at'),
    },
    {
      key: 'pipeline_id',
      label: 'pipeline_id',
      render: (l) => <UuidBadge value={l.pipeline_id} hint="pipeline_id" />,
    },
    {
      key: 'stage_id',
      label: 'stage_id',
      render: (l) => <UuidBadge value={l.stage_id} hint="stage_id" />,
    },
    {
      key: 'archived_at',
      label: 'archived_at',
      render: (l) => cell(l.archived_at, 'archived_at'),
    },
  ]

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Toolbar fixa (não rola com o board) */}
      <div className="shrink-0 space-y-3 border-b border-zinc-200 bg-[#f3f4f6] px-5 pb-3 pt-4">
        <div className="flex items-center gap-2 overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:thin]">
          {/* Visão */}
          <div className="inline-flex shrink-0 rounded-full bg-white p-0.5 shadow-sm ring-1 ring-zinc-200">
            <button
              type="button"
              onClick={() => setView('kanban')}
              className={`rounded-full px-3 py-1.5 text-xs font-bold ${
                view === 'kanban'
                  ? 'bg-liqui-orange text-white'
                  : 'text-zinc-600 hover:bg-zinc-50'
              }`}
            >
              Kanban
            </button>
            <button
              type="button"
              onClick={() => setView('lista')}
              className={`rounded-full px-3 py-1.5 text-xs font-bold ${
                view === 'lista'
                  ? 'bg-liqui-orange text-white'
                  : 'text-zinc-600 hover:bg-zinc-50'
              }`}
            >
              Lista
            </button>
          </div>

          {/* Funil */}
          <div className="inline-flex shrink-0 items-center gap-1 rounded-full border border-zinc-200 bg-white py-0.5 pl-2.5 pr-0.5 shadow-sm">
            <span className="text-[10px] font-bold uppercase tracking-wide text-zinc-400">
              Funil
            </span>
            <select
              value={pipelineId}
              onChange={(e) => void switchPipeline(e.target.value)}
              className="max-w-[140px] truncate border-0 bg-transparent py-1 pr-1 text-xs font-semibold text-liqui-navy outline-none"
            >
              {pipelines.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            {isOwner && (
              <button
                type="button"
                onClick={() => setShowPipelineManager(true)}
                title="Gerenciar funis"
                className="inline-flex items-center gap-1 rounded-full bg-zinc-50 px-2.5 py-1.5 text-xs font-semibold text-zinc-700 hover:bg-zinc-100"
              >
                <Layers3 className="h-3.5 w-3.5" />
                Funis
              </button>
            )}
          </div>

          <div className="hidden h-5 w-px shrink-0 bg-zinc-200 sm:block" />

          {/* Busca */}
          <div className="relative shrink-0">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar…"
              className="w-[160px] rounded-full border border-zinc-200 bg-white py-1.5 pl-8 pr-3 text-xs outline-none focus:border-liqui-orange lg:w-[200px]"
            />
          </div>

          {/* Filtros */}
          <div className="inline-flex shrink-0 items-center gap-1.5">
            <FilterSelect
              value={origem}
              onChange={setOrigem}
              allLabel="Origem"
              allValue="todas"
              options={origens}
              className="py-1.5 text-xs"
            />
            <FilterSelect
              value={produto}
              onChange={setProduto}
              allLabel="Produto"
              options={produtos}
              className="py-1.5 text-xs"
            />
            <FilterSelect
              value={statusFiltro}
              onChange={setStatusFiltro}
              allLabel="Status"
              options={statusList}
              className="py-1.5 text-xs"
            />
            <select
              value={stageFiltro}
              onChange={(e) => setStageFiltro(e.target.value)}
              className="rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-xs outline-none focus:border-liqui-orange"
            >
              <option value="todos">Estágio</option>
              {stages.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
            <FilterSelect
              value={intentFiltro}
              onChange={setIntentFiltro}
              allLabel="Intent"
              options={intents}
              className="py-1.5 text-xs"
            />
            <select
              value={iaFiltro}
              onChange={(e) =>
                setIaFiltro(
                  e.target.value as
                    | 'todos'
                    | 'classificados'
                    | 'com_insight'
                    | 'ambos'
                    | 'sem_ia',
                )
              }
              className={`rounded-full border px-3 py-1.5 text-xs outline-none focus:border-liqui-orange ${
                iaFiltro !== 'todos'
                  ? 'border-liqui-orange bg-liqui-orange-soft font-semibold text-liqui-navy'
                  : 'border-zinc-200 bg-white'
              }`}
            >
              <option value="todos">IA</option>
              <option value="classificados">Classificados</option>
              <option value="com_insight">Com insight</option>
              <option value="ambos">Classificados + insight</option>
              <option value="sem_ia">Sem IA</option>
            </select>
          </div>

          {/* Ações */}
          <div className="inline-flex shrink-0 rounded-full bg-white p-0.5 shadow-sm ring-1 ring-zinc-200">
            <button
              type="button"
              onClick={() => setIaFiltro('ambos')}
              className={`rounded-full px-3 py-1.5 text-xs font-bold ${
                iaFiltro === 'ambos'
                  ? 'bg-liqui-navy text-white'
                  : 'text-zinc-600 hover:bg-zinc-50'
              }`}
            >
              IA completa
            </button>
            {hasActiveFilters && (
              <button
                type="button"
                onClick={clearFilters}
                className="inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-bold text-zinc-600 hover:bg-zinc-50"
              >
                <X className="h-3.5 w-3.5" />
                Limpar
              </button>
            )}
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <KpiCard title="Leads no funil" value={`${kpis.noFunnel}`} hint="Após filtros" />
          <KpiCard title="Ganhos" value={`${kpis.ganho}`} hint="Status Ganho" />
          <KpiCard
            title="Sem resposta / ativos"
            value={`${kpis.followup}`}
            hint="Novo + Em contato"
            danger={kpis.followup > 0}
          />
          <KpiCard title="Atendimento aberto" value={`${kpis.abertos}`} hint="Exceto perdidos" />
        </div>

        {error && (
          <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-600">
            {error}
          </p>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-hidden px-5 py-4">
        {loading ? (
          <div className="flex h-full items-center justify-center text-sm text-zinc-500">
            Carregando funil…
          </div>
        ) : stages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 text-sm text-zinc-500">
            <p>Nenhum funil/estágio encontrado.</p>
            <p>Execute o arquivo <code>supabase/pipelines.sql</code> no Supabase.</p>
            <button
              type="button"
              onClick={() => setShowPipelineManager(true)}
              className="rounded-xl bg-liqui-orange px-4 py-2 font-bold text-white"
            >
              Criar funil
            </button>
          </div>
        ) : view === 'lista' ? (
          <DataTable
            columns={leadTableColumns}
            rows={filtered}
            rowKey={(l) => l.id_lead}
            onRowClick={(lead) => setSelected(lead)}
          />
        ) : (
          <div className="flex h-full gap-3 overflow-x-auto pb-1">
            {stages.map((stage, index) => {
              const Icon = STAGE_ICONS[index % STAGE_ICONS.length]
              const cards = filtered.filter((l) => {
                const st = stageForLead(l)
                return st?.id === stage.id || (!st && l.status === stage.name)
              })

              return (
                <section
                  key={stage.id}
                  className="flex h-full w-[300px] shrink-0 flex-col rounded-2xl border border-zinc-200 bg-zinc-100/80"
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault()
                    const id = Number(e.dataTransfer.getData('text/lead-id'))
                    if (id) void moveLead(id, stage)
                    setDraggingId(null)
                  }}
                >
                  <header className="flex shrink-0 items-center justify-between gap-2 px-3 py-3">
                    <div className="flex items-center gap-2">
                      <span
                        className="flex h-7 w-7 items-center justify-center rounded-xl text-white"
                        style={{ backgroundColor: stage.color || '#f7941d' }}
                      >
                        <Icon className="h-3.5 w-3.5" />
                      </span>
                      <h2 className="text-sm font-extrabold text-liqui-navy">
                        {stage.name}
                      </h2>
                    </div>
                    <span className="rounded-full bg-white px-2 py-0.5 text-xs font-bold text-zinc-500 shadow-sm">
                      {cards.length}
                    </span>
                  </header>

                  {/* Rolagem própria da coluna */}
                  <div className="min-h-0 flex-1 space-y-2 overflow-y-auto px-2 pb-3">
                    {cards.length === 0 && (
                      <p className="px-2 py-10 text-center text-xs text-zinc-400">
                        vazio
                      </p>
                    )}
                    {cards.map((lead) => (
                      <LeadKanbanCard
                        key={lead.id_lead}
                        lead={lead}
                        hasInsight={insightLeadIds.has(lead.id_lead)}
                        dragging={draggingId === lead.id_lead}
                        onOpen={() => setSelected(lead)}
                        onDragStart={(e) => {
                          e.dataTransfer.setData(
                            'text/lead-id',
                            String(lead.id_lead),
                          )
                          e.dataTransfer.effectAllowed = 'move'
                          setDraggingId(lead.id_lead)
                        }}
                        onDragEnd={() => setDraggingId(null)}
                      />
                    ))}
                  </div>
                </section>
              )
            })}
          </div>
        )}
      </div>

      {selected && (
        <LeadDrawer
          lead={selected}
          tentativas={tentativas}
          respostas={respostas}
          onClose={() => setSelected(null)}
          onChanged={() => void loadAll()}
        />
      )}

      {showPipelineManager && isOwner && (
        <PipelineManagerSideOver
          kind="leads"
          activePipelineId={pipelineId}
          onClose={() => setShowPipelineManager(false)}
          onChanged={() => void loadAll()}
        />
      )}
    </div>
  )
}

function KpiCard({
  title,
  value,
  hint,
  danger,
}: {
  title: string
  value: string
  hint: string
  danger?: boolean
}) {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-bold uppercase tracking-wide text-zinc-400">
        {title}
      </p>
      <p
        className={`mt-1 text-2xl font-extrabold ${
          danger ? 'text-red-500' : 'text-liqui-navy'
        }`}
      >
        {value}
      </p>
      <p className="mt-1 text-xs text-zinc-500">{hint}</p>
    </div>
  )
}

