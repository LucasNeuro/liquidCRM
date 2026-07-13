import { useEffect, useMemo, useState } from 'react'
import {
  Layers3,
  Mail,
  Phone,
  Plus,
  RefreshCw,
  Search,
  Star,
  Trophy,
  X,
} from 'lucide-react'
import { LeadDrawer } from '../components/leads/LeadDrawer'
import { LeadKanbanCard } from '../components/leads/LeadKanbanCard'
import {
  FilterSelect,
  matchesQuery,
  uniqueOptions,
} from '../components/ui/CrmFilters'
import { DataTable, type DataColumn } from '../components/ui/DataTable'
import { LeadAvatar } from '../components/ui/LeadAvatar'
import { SideOver } from '../components/ui/SideOver'
import { useShellHeader } from '../layouts/ShellContext'
import {
  fetchLeads,
  fetchRespostas,
  fetchTentativas,
} from '../lib/leads'
import {
  createPipeline,
  createStage,
  fetchPipelines,
  fetchStages,
  updateLeadStage,
  type Pipeline,
  type PipelineStage,
} from '../lib/pipelines'
import type { Lead, RespostaPesquisa, TentativaCompra } from '../lib/types'

const STAGE_ICONS = [Mail, Phone, Star, Trophy, Layers3]

export function LeadsPage() {
  const { setHeader } = useShellHeader()
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
  const [selected, setSelected] = useState<Lead | null>(null)
  const [draggingId, setDraggingId] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)
  const [view, setView] = useState<'kanban' | 'lista'>('kanban')
  const [showPipelineModal, setShowPipelineModal] = useState(false)
  const [showStageModal, setShowStageModal] = useState(false)
  const [newPipelineName, setNewPipelineName] = useState('')
  const [newStageName, setNewStageName] = useState('')

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
      const [l, t, r] = await Promise.all([
        fetchLeads(),
        fetchTentativas(),
        fetchRespostas(),
      ])
      setLeads(l)
      setTentativas(t)
      setRespostas(r)
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
    setHeader({
      title: 'Leads',
      subtitle: `Leads · ${leads.length} leads${saving ? ' · salvando…' : ''}`,
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
  }, [leads.length, saving, setHeader])

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
    intentFiltro !== 'todos'

  function clearFilters() {
    setQuery('')
    setOrigem('todas')
    setProduto('todos')
    setStatusFiltro('todos')
    setStageFiltro('todos')
    setIntentFiltro('todos')
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

  async function handleCreatePipeline() {
    if (!newPipelineName.trim()) return
    try {
      const pipe = await createPipeline(newPipelineName.trim())
      setNewPipelineName('')
      setShowPipelineModal(false)
      await loadAll()
      await switchPipeline(pipe.id)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao criar funil')
    }
  }

  async function handleCreateStage() {
    if (!newStageName.trim() || !pipelineId) return
    try {
      await createStage(pipelineId, newStageName.trim())
      setNewStageName('')
      setShowStageModal(false)
      const st = await fetchStages(pipelineId)
      setStages(st)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao criar estágio')
    }
  }

  function stageForLead(lead: Lead) {
    if (lead.stage_id) {
      return stages.find((s) => s.id === lead.stage_id)
    }
    return stages.find((s) => s.name === (lead.status || 'Novo'))
  }

  const cell = (v: unknown) => (v == null || v === '' ? '—' : String(v))

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
    { key: 'id_lead', label: 'id_lead', render: (l) => cell(l.id_lead) },
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
      render: (l) => cell(l.data_entrada),
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
      key: 'labels_gemini',
      label: 'labels_gemini',
      render: (l) =>
        Array.isArray(l.labels_gemini) && l.labels_gemini.length
          ? l.labels_gemini.join(', ')
          : '—',
    },
    { key: 'created_at', label: 'created_at', render: (l) => cell(l.created_at) },
    {
      key: 'pipeline_id',
      label: 'pipeline_id',
      render: (l) => cell(l.pipeline_id),
    },
    { key: 'stage_id', label: 'stage_id', render: (l) => cell(l.stage_id) },
    {
      key: 'archived_at',
      label: 'archived_at',
      render: (l) => cell(l.archived_at),
    },
  ]

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Toolbar fixa (não rola com o board) */}
      <div className="shrink-0 space-y-3 border-b border-zinc-200 bg-[#f3f4f6] px-5 pb-3 pt-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wide text-zinc-400">
              Funil
            </span>
            <select
              value={pipelineId}
              onChange={(e) => void switchPipeline(e.target.value)}
              className="rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-sm font-semibold outline-none"
            >
              {pipelines.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            <div className="inline-flex rounded-full bg-white p-1 shadow-sm">
              <button
                type="button"
                onClick={() => setView('kanban')}
                className={`rounded-full px-3 py-1.5 text-sm font-semibold ${
                  view === 'kanban'
                    ? 'bg-liqui-orange text-white'
                    : 'text-zinc-600'
                }`}
              >
                Kanban
              </button>
              <button
                type="button"
                onClick={() => setView('lista')}
                className={`rounded-full px-3 py-1.5 text-sm font-semibold ${
                  view === 'lista'
                    ? 'bg-liqui-orange text-white'
                    : 'text-zinc-600'
                }`}
              >
                Lista
              </button>
            </div>
            <button
              type="button"
              onClick={() => setShowPipelineModal(true)}
              className="inline-flex items-center gap-1 rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-sm font-semibold text-zinc-700"
            >
              <Plus className="h-3.5 w-3.5" /> Pipeline
            </button>
            <button
              type="button"
              onClick={() => setShowStageModal(true)}
              className="inline-flex items-center gap-1 rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-sm font-semibold text-zinc-700"
            >
              <Layers3 className="h-3.5 w-3.5" /> Estágios
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar nome, telefone, e-mail ou código…"
                className="w-[240px] rounded-full border border-zinc-200 bg-white py-2 pl-9 pr-3 text-sm outline-none focus:border-liqui-orange"
              />
            </div>
            <FilterSelect
              value={origem}
              onChange={setOrigem}
              allLabel="Todas origens"
              allValue="todas"
              options={origens}
            />
            <FilterSelect
              value={produto}
              onChange={setProduto}
              allLabel="Todos produtos"
              options={produtos}
            />
            <FilterSelect
              value={statusFiltro}
              onChange={setStatusFiltro}
              allLabel="Todos status"
              options={statusList}
            />
            <select
              value={stageFiltro}
              onChange={(e) => setStageFiltro(e.target.value)}
              className="rounded-full border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-liqui-orange"
            >
              <option value="todos">Todos estágios</option>
              {stages.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
            <FilterSelect
              value={intentFiltro}
              onChange={setIntentFiltro}
              allLabel="Todas intents"
              options={intents}
            />
            {hasActiveFilters && (
              <button
                type="button"
                onClick={clearFilters}
                className="inline-flex items-center gap-1 rounded-full border border-zinc-200 bg-white px-3 py-2 text-sm font-semibold text-zinc-600"
              >
                <X className="h-3.5 w-3.5" /> Limpar
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
              onClick={() => setShowPipelineModal(true)}
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

      {showPipelineModal && (
        <SideOver
          title="Novo funil"
          subtitle="Crie um pipeline com estágios padrão"
          onClose={() => setShowPipelineModal(false)}
          widthClass="max-w-md"
          footer={
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setShowPipelineModal(false)}
                className="flex-1 rounded-xl border border-zinc-200 px-4 py-2.5 text-sm font-semibold"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => void handleCreatePipeline()}
                className="flex-1 rounded-xl bg-liqui-orange px-4 py-2.5 text-sm font-bold text-white"
              >
                Criar funil
              </button>
            </div>
          }
        >
          <label className="block text-sm font-semibold text-liqui-navy">
            Nome do funil
            <input
              value={newPipelineName}
              onChange={(e) => setNewPipelineName(e.target.value)}
              placeholder="Ex.: Onboarding, Comercial..."
              className="mt-2 w-full rounded-xl border border-zinc-200 px-3 py-2.5 text-sm outline-none focus:border-liqui-orange"
              autoFocus
            />
          </label>
          <p className="mt-3 text-xs text-zinc-500">
            Serão criados os estágios: Novo, Em contato, Qualificado, Ganho e
            Perdido — você pode adicionar mais depois.
          </p>
        </SideOver>
      )}

      {showStageModal && (
        <SideOver
          title="Novo estágio"
          subtitle="Adicione uma coluna ao funil atual"
          onClose={() => setShowStageModal(false)}
          widthClass="max-w-md"
          footer={
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setShowStageModal(false)}
                className="flex-1 rounded-xl border border-zinc-200 px-4 py-2.5 text-sm font-semibold"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => void handleCreateStage()}
                className="flex-1 rounded-xl bg-liqui-orange px-4 py-2.5 text-sm font-bold text-white"
              >
                Criar estágio
              </button>
            </div>
          }
        >
          <label className="block text-sm font-semibold text-liqui-navy">
            Nome do estágio
            <input
              value={newStageName}
              onChange={(e) => setNewStageName(e.target.value)}
              placeholder="Ex.: Proposta, Negociação..."
              className="mt-2 w-full rounded-xl border border-zinc-200 px-3 py-2.5 text-sm outline-none focus:border-liqui-orange"
              autoFocus
            />
          </label>
        </SideOver>
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

