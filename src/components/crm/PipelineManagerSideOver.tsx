import { useCallback, useEffect, useState } from 'react'
import {
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  Pencil,
  Plus,
  Trash2,
} from 'lucide-react'
import {
  deletePipeline,
  deleteStage,
  fetchPipelines,
  fetchStages,
  updateStage,
  type Pipeline,
  type PipelineKind,
  type PipelineStage,
} from '../../lib/pipelines'
import { SideOver } from '../ui/SideOver'
import {
  PipelineCrudForm,
  pipelineCrudTitle,
  type PipelineCrudMode,
} from './PipelineCrudForm'

type CrudState =
  | { mode: 'pipeline-create' }
  | { mode: 'pipeline-edit'; pipeline: Pipeline }
  | { mode: 'stage-create'; pipeline: Pipeline }
  | { mode: 'stage-edit'; pipeline: Pipeline; stage: PipelineStage }

type Props = {
  kind: PipelineKind
  activePipelineId?: string | null
  onClose: () => void
  /** Recarrega funis/estágios nas páginas de Kanban após mudanças */
  onChanged: () => void
}

export function PipelineManagerSideOver({
  kind,
  activePipelineId,
  onClose,
  onChanged,
}: Props) {
  const [pipelines, setPipelines] = useState<Pipeline[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(
    activePipelineId || null,
  )
  const [stages, setStages] = useState<PipelineStage[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [crud, setCrud] = useState<CrudState | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  const selected = pipelines.find((p) => p.id === selectedId) || null

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const list = await fetchPipelines(kind)
      setPipelines(list)
      setSelectedId((prev) => {
        if (prev && list.some((p) => p.id === prev)) return prev
        if (activePipelineId && list.some((p) => p.id === activePipelineId)) {
          return activePipelineId
        }
        return list[0]?.id ?? null
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao carregar funis')
    } finally {
      setLoading(false)
    }
  }, [kind, activePipelineId])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    if (!selectedId) {
      setStages([])
      return
    }
    let cancelled = false
    void (async () => {
      try {
        const rows = await fetchStages(selectedId)
        if (!cancelled) setStages(rows)
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : 'Falha ao carregar estágios',
          )
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [selectedId])

  async function refreshAll() {
    await load()
    onChanged()
    if (selectedId) {
      try {
        setStages(await fetchStages(selectedId))
      } catch {
        /* load já seta erro se preciso */
      }
    }
  }

  async function handleDeletePipeline(p: Pipeline) {
    if (
      !confirm(
        `Excluir o funil “${p.name}” e todos os estágios? Cards vinculados podem ficar sem estágio.`,
      )
    ) {
      return
    }
    setBusyId(p.id)
    setError(null)
    try {
      await deletePipeline(p.id)
      await refreshAll()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao excluir funil')
    } finally {
      setBusyId(null)
    }
  }

  async function handleDeleteStage(s: PipelineStage) {
    if (!confirm(`Excluir o estágio “${s.name}”?`)) return
    setBusyId(s.id)
    setError(null)
    try {
      await deleteStage(s.id)
      await refreshAll()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao excluir estágio')
    } finally {
      setBusyId(null)
    }
  }

  async function moveStage(s: PipelineStage, dir: -1 | 1) {
    const idx = stages.findIndex((x) => x.id === s.id)
    const swap = stages[idx + dir]
    if (!swap) return
    setBusyId(s.id)
    setError(null)
    try {
      await updateStage(s.id, { position: swap.position })
      await updateStage(swap.id, { position: s.position })
      await refreshAll()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao reordenar')
    } finally {
      setBusyId(null)
    }
  }

  const inForm = Boolean(crud)
  const formMode = crud?.mode as PipelineCrudMode | undefined

  return (
    <SideOver
      title={formMode ? pipelineCrudTitle(formMode) : 'Gerenciar funis'}
      subtitle={
        formMode
          ? kind === 'negocios'
            ? 'Funil de negócios'
            : 'Funil de leads'
          : kind === 'negocios'
            ? 'Funis e estágios de negócios · só owner'
            : 'Funis e estágios de leads · só owner'
      }
      onClose={onClose}
      widthClass="max-w-2xl"
      headerExtra={
        inForm ? (
          <button
            type="button"
            onClick={() => setCrud(null)}
            className="mt-2 inline-flex items-center gap-1 text-xs font-bold text-liqui-orange"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Voltar à lista
          </button>
        ) : null
      }
    >
      {crud && formMode ? (
        <PipelineCrudForm
          mode={formMode}
          kind={kind}
          pipeline={
            crud.mode === 'pipeline-edit' ||
            crud.mode === 'stage-create' ||
            crud.mode === 'stage-edit'
              ? crud.pipeline
              : undefined
          }
          stage={crud.mode === 'stage-edit' ? crud.stage : undefined}
          onCancel={() => setCrud(null)}
          onDone={() => void refreshAll()}
        />
      ) : (
        <div className="space-y-5">
          {error && (
            <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-600">
              {error}
            </p>
          )}

          <section>
            <div className="mb-2 flex items-center justify-between gap-2">
              <h3 className="text-xs font-bold uppercase tracking-wide text-zinc-400">
                Funis ({pipelines.length})
              </h3>
              <button
                type="button"
                onClick={() => setCrud({ mode: 'pipeline-create' })}
                className="inline-flex items-center gap-1 rounded-full bg-liqui-orange px-2.5 py-1 text-[11px] font-bold text-white"
              >
                <Plus className="h-3 w-3" /> Novo funil
              </button>
            </div>

            {loading ? (
              <p className="text-sm text-zinc-500">Carregando…</p>
            ) : pipelines.length === 0 ? (
              <p className="rounded-xl border border-dashed border-zinc-200 bg-zinc-50 px-3 py-6 text-center text-sm text-zinc-500">
                Nenhum funil ainda. Crie o primeiro.
              </p>
            ) : (
              <ul className="space-y-1.5">
                {pipelines.map((p) => {
                  const active = p.id === selectedId
                  return (
                    <li key={p.id}>
                      <div
                        className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 ${
                          active
                            ? 'border-liqui-orange bg-liqui-orange-soft/40'
                            : 'border-zinc-100 bg-white hover:border-zinc-200'
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => setSelectedId(p.id)}
                          className="min-w-0 flex-1 text-left"
                        >
                          <p className="truncate text-sm font-bold text-liqui-navy">
                            {p.name}
                          </p>
                          {p.is_default && (
                            <p className="text-[10px] font-semibold uppercase text-zinc-400">
                              padrão
                            </p>
                          )}
                        </button>
                        <button
                          type="button"
                          title="Editar funil"
                          onClick={() =>
                            setCrud({ mode: 'pipeline-edit', pipeline: p })
                          }
                          className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-50 hover:text-liqui-navy"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          title="Excluir funil"
                          disabled={busyId === p.id}
                          onClick={() => void handleDeletePipeline(p)}
                          className="rounded-lg p-1.5 text-zinc-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </section>

          <section>
            <div className="mb-2 flex items-center justify-between gap-2">
              <h3 className="text-xs font-bold uppercase tracking-wide text-zinc-400">
                Estágios
                {selected ? ` · ${selected.name}` : ''} ({stages.length})
              </h3>
              <button
                type="button"
                disabled={!selected}
                onClick={() =>
                  selected &&
                  setCrud({ mode: 'stage-create', pipeline: selected })
                }
                className="inline-flex items-center gap-1 rounded-full border border-zinc-200 bg-white px-2.5 py-1 text-[11px] font-bold text-liqui-navy disabled:opacity-40"
              >
                <Plus className="h-3 w-3" /> Novo estágio
              </button>
            </div>

            {!selected ? (
              <p className="text-sm text-zinc-500">Selecione um funil acima.</p>
            ) : stages.length === 0 ? (
              <p className="rounded-xl border border-dashed border-zinc-200 bg-zinc-50 px-3 py-6 text-center text-sm text-zinc-500">
                Nenhum estágio neste funil.
              </p>
            ) : (
              <ul className="space-y-1.5">
                {stages.map((s, i) => (
                  <li
                    key={s.id}
                    className="flex items-center gap-2 rounded-xl border border-zinc-100 bg-white px-3 py-2"
                  >
                    <span
                      className="h-3 w-3 shrink-0 rounded-full"
                      style={{ background: s.color || '#f7941d' }}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-liqui-navy">
                        {s.name}
                      </p>
                      <p className="text-[10px] text-zinc-400">
                        posição {s.position}
                      </p>
                    </div>
                    <div className="flex items-center gap-0.5">
                      <button
                        type="button"
                        title="Subir"
                        disabled={i === 0 || busyId === s.id}
                        onClick={() => void moveStage(s, -1)}
                        className="rounded-lg p-1 text-zinc-400 hover:bg-zinc-50 disabled:opacity-30"
                      >
                        <ChevronUp className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        title="Descer"
                        disabled={i === stages.length - 1 || busyId === s.id}
                        onClick={() => void moveStage(s, 1)}
                        className="rounded-lg p-1 text-zinc-400 hover:bg-zinc-50 disabled:opacity-30"
                      >
                        <ChevronDown className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        title="Editar estágio"
                        onClick={() =>
                          selected &&
                          setCrud({
                            mode: 'stage-edit',
                            pipeline: selected,
                            stage: s,
                          })
                        }
                        className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-50 hover:text-liqui-navy"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        title="Excluir estágio"
                        disabled={busyId === s.id}
                        onClick={() => void handleDeleteStage(s)}
                        className="rounded-lg p-1.5 text-zinc-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}
    </SideOver>
  )
}
