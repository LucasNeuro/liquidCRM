import { useEffect, useMemo, useState } from 'react'
import {
  FolderKanban,
  Layers3,
  Plus,
  RefreshCw,
  Search,
  Trophy,
  X,
} from 'lucide-react'
import { NegocioFormSideOver } from '../components/negocios/NegocioFormSideOver'
import { NegocioKanbanCard } from '../components/negocios/NegocioKanbanCard'
import { PipelineManagerSideOver } from '../components/crm/PipelineManagerSideOver'
import { CrmEntitySideOver, Field } from '../components/ui/CrmEntitySideOver'
import {
  FilterSelect,
  matchesQuery,
  uniqueOptions,
} from '../components/ui/CrmFilters'
import { DataTable, type DataColumn } from '../components/ui/DataTable'
import { LeadIdBadge, NegocioIdBadge, UuidBadge } from '../components/ui/IdBadge'
import { MetaInfo } from '../components/ui/MetaInfo'
import { LeadAvatar } from '../components/ui/LeadAvatar'
import { useShellHeader } from '../layouts/ShellContext'
import { useAuth } from '../contexts/AuthContext'
import { formatCellValue } from '../lib/format'
import {
  fetchPipelines,
  fetchStages,
  type Pipeline,
  type PipelineStage,
} from '../lib/pipelines'
import {
  archiveNegocio,
  deleteNegocio,
  fetchNegocios,
  updateNegocio,
  updateNegocioStage,
  type NegocioWithLead,
} from '../lib/negocios'

const STAGE_ICONS = [FolderKanban, Search, Layers3, Trophy, FolderKanban, Layers3]

function money(v: number) {
  return Number(v || 0).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 0,
  })
}

export function NegociosPage() {
  const { setHeader } = useShellHeader()
  const { isOwner } = useAuth()
  const [negocios, setNegocios] = useState<NegocioWithLead[]>([])
  const [pipelines, setPipelines] = useState<Pipeline[]>([])
  const [stages, setStages] = useState<PipelineStage[]>([])
  const [pipelineId, setPipelineId] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('todos')
  const [stageFilter, setStageFilter] = useState('todos')
  const [origemFilter, setOrigemFilter] = useState('todas')
  const [view, setView] = useState<'kanban' | 'lista'>('kanban')
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [showCreate, setShowCreate] = useState(false)
  const [showPipelineManager, setShowPipelineManager] = useState(false)
  const [selected, setSelected] = useState<NegocioWithLead | null>(null)
  const [savingEdit, setSavingEdit] = useState(false)

  async function loadStructure() {
    const pipes = await fetchPipelines('negocios')
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
    setStages(await fetchStages(active.id))
  }

  async function loadAll() {
    setLoading(true)
    setError(null)
    try {
      const rows = await fetchNegocios()
      setNegocios(rows)
      await loadStructure()
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Falha ao carregar. Rode supabase/migrate-negocios.sql',
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
      title: 'Negócios',
      subtitle: `${negocios.length} negócios${saving ? ' · salvando…' : ''}`,
      actions: (
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => void loadAll()}
            className="inline-flex items-center gap-2 rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm font-semibold text-zinc-700 hover:bg-zinc-50"
          >
            <RefreshCw className="h-4 w-4" />
            Atualizar
          </button>
          <button
            type="button"
            onClick={() => setShowCreate(true)}
            className="inline-flex items-center gap-2 rounded-xl bg-liqui-navy px-3 py-2 text-sm font-bold text-white hover:bg-liqui-navy/90"
          >
            <Plus className="h-4 w-4 text-liqui-orange" />
            Novo negócio
          </button>
        </div>
      ),
    })
  }, [negocios.length, saving, setHeader])

  async function switchPipeline(id: string) {
    setPipelineId(id)
    setStages(await fetchStages(id))
  }

  const origensLead = useMemo(
    () => uniqueOptions(negocios.map((n) => n.leads?.origem)),
    [negocios],
  )

  const hasActiveFilters =
    query.trim() !== '' ||
    statusFilter !== 'todos' ||
    stageFilter !== 'todos' ||
    origemFilter !== 'todas'

  function clearFilters() {
    setQuery('')
    setStatusFilter('todos')
    setStageFilter('todos')
    setOrigemFilter('todas')
  }

  const filtered = useMemo(() => {
    return negocios.filter((n) => {
      if (pipelineId && n.pipeline_id && n.pipeline_id !== pipelineId) {
        return false
      }
      if (statusFilter !== 'todos' && n.status_negocio !== statusFilter) {
        return false
      }
      if (stageFilter !== 'todos' && (n.stage_id || '') !== stageFilter) {
        return false
      }
      if (
        origemFilter !== 'todas' &&
        (n.leads?.origem || '') !== origemFilter
      ) {
        return false
      }
      return matchesQuery(
        [
          n.id,
          n.codigo,
          n.titulo,
          n.id_lead,
          n.valor,
          n.status_negocio,
          n.pipeline_id,
          n.stage_id,
          n.created_at,
          n.updated_at,
          n.leads?.nome,
          n.leads?.origem,
          n.leads?.telefone,
        ],
        query,
      )
    })
  }, [
    negocios,
    query,
    pipelineId,
    statusFilter,
    stageFilter,
    origemFilter,
  ])

  const kpis = useMemo(() => {
    const total = filtered.length
    const pipeline = filtered.reduce((s, n) => s + Number(n.valor || 0), 0)
    const negociacao = filtered.filter(
      (n) => n.status_negocio === 'aberto',
    ).length
    const ganhos = filtered.filter((n) => n.status_negocio === 'ganho').length
    const taxa = total ? Math.round((ganhos / total) * 100) : null
    return { total, pipeline, negociacao, taxa }
  }, [filtered])

  async function moveNegocio(id: string, stage: PipelineStage) {
    const current = negocios.find((n) => n.id === id)
    if (!current || current.stage_id === stage.id) return

    const prev = {
      stage_id: current.stage_id,
      pipeline_id: current.pipeline_id,
      status_negocio: current.status_negocio,
    }

    const lower = stage.name.toLowerCase()
    const status_negocio =
      lower.includes('ganho')
        ? ('ganho' as const)
        : lower.includes('perdido')
          ? ('perdido' as const)
          : ('aberto' as const)

    setNegocios((list) =>
      list.map((n) =>
        n.id === id
          ? {
              ...n,
              stage_id: stage.id,
              pipeline_id: stage.pipeline_id,
              status_negocio,
            }
          : n,
      ),
    )
    setSaving(true)
    try {
      await updateNegocioStage({
        id,
        stageId: stage.id,
        stageName: stage.name,
        pipelineId: stage.pipeline_id,
      })
    } catch (err) {
      setNegocios((list) =>
        list.map((n) => (n.id === id ? { ...n, ...prev } : n)),
      )
      setError(err instanceof Error ? err.message : 'Falha ao mover negócio')
    } finally {
      setSaving(false)
    }
  }

  const cell = (v: unknown, key?: string) => formatCellValue(v, key)

  const negocioTableColumns: DataColumn<NegocioWithLead>[] = [
    {
      key: 'titulo',
      label: 'titulo',
      render: (n) => {
        const leadName = n.leads?.nome || `Lead #${n.id_lead}`
        return (
          <div className="flex items-center gap-2">
            <LeadAvatar name={leadName} size="sm" />
            <div>
              <p className="font-semibold text-liqui-navy">{n.titulo}</p>
              <div className="mt-0.5">
                <NegocioIdBadge codigo={n.codigo} />
              </div>
            </div>
          </div>
        )
      },
    },
    {
      key: 'id',
      label: 'id',
      render: (n) => <UuidBadge value={n.id} hint="id" />,
    },
    {
      key: 'codigo',
      label: 'codigo',
      render: (n) => <NegocioIdBadge codigo={n.codigo} />,
    },
    {
      key: 'id_lead',
      label: 'id_lead',
      render: (n) => <LeadIdBadge id={n.id_lead} />,
    },
    { key: 'valor', label: 'valor', render: (n) => money(n.valor) },
    {
      key: 'status_negocio',
      label: 'status_negocio',
      render: (n) => cell(n.status_negocio),
    },
    {
      key: 'pipeline_id',
      label: 'pipeline_id',
      render: (n) => <UuidBadge value={n.pipeline_id} hint="pipeline_id" />,
    },
    {
      key: 'stage_id',
      label: 'stage_id',
      render: (n) => <UuidBadge value={n.stage_id} hint="stage_id" />,
    },
    {
      key: 'created_at',
      label: 'created_at',
      render: (n) => cell(n.created_at, 'created_at'),
    },
    {
      key: 'updated_at',
      label: 'updated_at',
      render: (n) => cell(n.updated_at, 'updated_at'),
    },
    {
      key: 'archived_at',
      label: 'archived_at',
      render: (n) => cell(n.archived_at, 'archived_at'),
    },
  ]

  async function saveSelected() {
    if (!selected) return
    setSavingEdit(true)
    setError(null)
    try {
      await updateNegocio(selected.id, {
        titulo: selected.titulo,
        valor: selected.valor,
        status_negocio: selected.status_negocio,
        id_lead: selected.id_lead,
        pipeline_id: selected.pipeline_id,
        stage_id: selected.stage_id,
      })
      setSelected(null)
      await loadAll()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao salvar')
    } finally {
      setSavingEdit(false)
    }
  }

  async function handleArchiveNegocio() {
    if (!selected) return
    if (!confirm('Arquivar este negócio?')) return
    setSavingEdit(true)
    try {
      await archiveNegocio(selected.id)
      setSelected(null)
      await loadAll()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao arquivar')
    } finally {
      setSavingEdit(false)
    }
  }

  async function handleDeleteNegocio() {
    if (!selected) return
    if (!confirm('Excluir permanentemente este negócio?')) return
    setSavingEdit(true)
    try {
      await deleteNegocio(selected.id)
      setSelected(null)
      await loadAll()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao excluir')
    } finally {
      setSavingEdit(false)
    }
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
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
                  view === 'kanban' ? 'bg-liqui-orange text-white' : 'text-zinc-600'
                }`}
              >
                Kanban
              </button>
              <button
                type="button"
                onClick={() => setView('lista')}
                className={`rounded-full px-3 py-1.5 text-sm font-semibold ${
                  view === 'lista' ? 'bg-liqui-orange text-white' : 'text-zinc-600'
                }`}
              >
                Lista
              </button>
            </div>
            {isOwner && (
              <button
                type="button"
                onClick={() => setShowPipelineManager(true)}
                className="inline-flex items-center gap-1 rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-sm font-semibold"
              >
                <Layers3 className="h-3.5 w-3.5" /> Gerenciar funis
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar em todas as colunas…"
                className="w-[240px] rounded-full border border-zinc-200 bg-white py-2 pl-9 pr-3 text-sm outline-none focus:border-liqui-orange"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="rounded-full border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-liqui-orange"
            >
              <option value="todos">Todos status</option>
              <option value="aberto">Aberto</option>
              <option value="ganho">Ganho</option>
              <option value="perdido">Perdido</option>
            </select>
            <select
              value={stageFilter}
              onChange={(e) => setStageFilter(e.target.value)}
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
              value={origemFilter}
              onChange={setOrigemFilter}
              allLabel="Todas origens"
              allValue="todas"
              options={origensLead}
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
          <Kpi title="Negócios" value={`${kpis.total}`} hint="No funil filtrado" />
          <Kpi title="Pipeline aberto" value={money(kpis.pipeline)} hint="Soma dos valores" />
          <Kpi title="Em negociação" value={`${kpis.negociacao}`} hint="Status aberto" />
          <Kpi
            title="Taxa de fechamento"
            value={kpis.taxa == null ? '—' : `${kpis.taxa}%`}
            hint="Ganhos / total"
          />
        </div>

        {error && (
          <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-hidden px-5 py-4">
        {loading ? (
          <div className="flex h-full items-center justify-center text-sm text-zinc-500">
            Carregando negócios…
          </div>
        ) : stages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 text-sm text-zinc-500">
            <p>Nenhum funil de negócios. Rode migrate-negocios.sql</p>
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
            columns={negocioTableColumns}
            rows={filtered}
            rowKey={(n) => n.id}
            onRowClick={(n) => setSelected(n)}
          />
        ) : (
          <div className="flex h-full gap-3 overflow-x-auto pb-1">
            {stages.map((stage, index) => {
              const Icon = STAGE_ICONS[index % STAGE_ICONS.length]
              const cards = filtered.filter((n) => n.stage_id === stage.id)
              const colValue = cards.reduce((s, n) => s + Number(n.valor || 0), 0)

              return (
                <section
                  key={stage.id}
                  className="flex h-full w-[300px] shrink-0 flex-col rounded-2xl border border-zinc-200 bg-zinc-100/80"
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault()
                    const id = e.dataTransfer.getData('text/negocio-id')
                    if (id) void moveNegocio(id, stage)
                    setDraggingId(null)
                  }}
                >
                  <header className="flex shrink-0 items-center justify-between gap-2 px-3 py-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span
                          className="flex h-7 w-7 items-center justify-center rounded-xl text-white"
                          style={{ backgroundColor: stage.color || '#f7941d' }}
                        >
                          <Icon className="h-3.5 w-3.5" />
                        </span>
                        <h2 className="truncate text-sm font-extrabold text-liqui-navy">
                          {stage.name}
                        </h2>
                      </div>
                      <p className="mt-1 pl-9 text-[11px] font-semibold text-zinc-400">
                        {money(colValue)}
                      </p>
                    </div>
                    <span className="rounded-full bg-white px-2 py-0.5 text-xs font-bold text-zinc-500 shadow-sm">
                      {cards.length}
                    </span>
                  </header>

                  <div className="min-h-0 flex-1 space-y-2 overflow-y-auto px-2 pb-3">
                    {cards.length === 0 && (
                      <p className="px-2 py-10 text-center text-xs text-zinc-400">
                        vazio
                      </p>
                    )}
                    {cards.map((negocio) => (
                      <NegocioKanbanCard
                        key={negocio.id}
                        negocio={negocio}
                        dragging={draggingId === negocio.id}
                        onOpen={() => setSelected(negocio)}
                        onDragStart={(e) => {
                          e.dataTransfer.setData('text/negocio-id', negocio.id)
                          e.dataTransfer.effectAllowed = 'move'
                          setDraggingId(negocio.id)
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

      {showCreate && pipelineId && stages[0] && (
        <NegocioFormSideOver
          pipelineId={pipelineId}
          stages={stages}
          onClose={() => setShowCreate(false)}
          onCreated={() => void loadAll()}
        />
      )}

      {selected && (
        <CrmEntitySideOver
          title={selected.titulo}
          subtitle={
            <span className="inline-flex flex-wrap items-center gap-1.5">
              <NegocioIdBadge codigo={selected.codigo} />
              <LeadIdBadge id={selected.id_lead} />
            </span>
          }
          onClose={() => setSelected(null)}
          onSave={() => void saveSelected()}
          onArchive={() => void handleArchiveNegocio()}
          onDelete={() => void handleDeleteNegocio()}
          saving={savingEdit}
        >
          <div className="space-y-3">
            <Field
              label="titulo"
              value={selected.titulo}
              onChange={(v) => setSelected({ ...selected, titulo: v })}
            />
            <Field
              label="valor"
              value={String(selected.valor ?? '')}
              onChange={(v) =>
                setSelected({
                  ...selected,
                  valor: Number(v.replace(',', '.')) || 0,
                })
              }
            />
            <Field
              label="status_negocio"
              value={selected.status_negocio}
              onChange={(v) =>
                setSelected({
                  ...selected,
                  status_negocio: v as NegocioWithLead['status_negocio'],
                })
              }
            />
            <Field
              label="id_lead"
              value={String(selected.id_lead)}
              onChange={(v) =>
                setSelected({ ...selected, id_lead: Number(v) || selected.id_lead })
              }
            />
            <Field
              label="pipeline_id"
              value={selected.pipeline_id || ''}
              onChange={(v) =>
                setSelected({ ...selected, pipeline_id: v || null })
              }
            />
            <Field
              label="stage_id"
              value={selected.stage_id || ''}
              onChange={(v) =>
                setSelected({ ...selected, stage_id: v || null })
              }
            />
            <dl className="grid grid-cols-2 gap-3 text-sm">
              <MetaInfo label="codigo" value={selected.codigo} />
              <MetaInfo label="Lead" value={selected.leads?.nome} kind="text" />
              <MetaInfo label="created_at" value={selected.created_at} />
              <MetaInfo label="updated_at" value={selected.updated_at} />
            </dl>
          </div>
        </CrmEntitySideOver>
      )}

      {showPipelineManager && isOwner && (
        <PipelineManagerSideOver
          kind="negocios"
          activePipelineId={pipelineId}
          onClose={() => setShowPipelineManager(false)}
          onChanged={() => void loadAll()}
        />
      )}
    </div>
  )
}

function Kpi({
  title,
  value,
  hint,
}: {
  title: string
  value: string
  hint: string
}) {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-bold uppercase tracking-wide text-zinc-400">{title}</p>
      <p className="mt-1 text-2xl font-extrabold text-liqui-navy">{value}</p>
      <p className="mt-1 text-xs text-zinc-500">{hint}</p>
    </div>
  )
}
