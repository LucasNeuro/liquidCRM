import { useEffect, useState } from 'react'
import {
  createPipeline,
  createStage,
  deletePipeline,
  deleteStage,
  updatePipeline,
  updateStage,
  type Pipeline,
  type PipelineKind,
  type PipelineStage,
} from '../../lib/pipelines'

export type PipelineCrudMode =
  | 'pipeline-create'
  | 'pipeline-edit'
  | 'stage-create'
  | 'stage-edit'

type Props = {
  mode: PipelineCrudMode
  kind: PipelineKind
  pipeline?: Pipeline
  stage?: PipelineStage
  onCancel: () => void
  onDone: () => void
}

export function pipelineCrudTitle(mode: PipelineCrudMode) {
  if (mode === 'pipeline-create') return 'Novo funil'
  if (mode === 'pipeline-edit') return 'Editar funil'
  if (mode === 'stage-create') return 'Novo estágio'
  return 'Editar estágio'
}

/** Formulário inline — usado dentro do Gerenciar funis (sem segundo sideover). */
export function PipelineCrudForm({
  mode,
  kind,
  pipeline,
  stage,
  onCancel,
  onDone,
}: Props) {
  const [name, setName] = useState(
    mode.includes('stage') ? stage?.name || '' : pipeline?.name || '',
  )
  const [color, setColor] = useState(stage?.color || '#f7941d')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setName(mode.includes('stage') ? stage?.name || '' : pipeline?.name || '')
    setColor(stage?.color || '#f7941d')
    setError(null)
  }, [mode, pipeline, stage])

  async function handleSave() {
    if (!name.trim()) {
      setError('Nome obrigatório')
      return
    }
    setSaving(true)
    setError(null)
    try {
      if (mode === 'pipeline-create') {
        await createPipeline(name.trim(), kind)
      } else if (mode === 'pipeline-edit' && pipeline) {
        await updatePipeline(pipeline.id, { name: name.trim() })
      } else if (mode === 'stage-create' && pipeline) {
        await createStage(pipeline.id, name.trim())
      } else if (mode === 'stage-edit' && stage) {
        await updateStage(stage.id, { name: name.trim(), color })
      }
      onDone()
      onCancel()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao salvar')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!confirm('Excluir permanentemente?')) return
    setSaving(true)
    try {
      if (mode === 'pipeline-edit' && pipeline) {
        await deletePipeline(pipeline.id)
      } else if (mode === 'stage-edit' && stage) {
        await deleteStage(stage.id)
      }
      onDone()
      onCancel()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao excluir')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex h-full min-h-[280px] flex-col">
      <div className="flex-1 space-y-4">
        <p className="text-sm text-zinc-500">
          {kind === 'negocios' ? 'Funil de negócios' : 'Funil de leads'}
        </p>
        <label className="block text-sm font-semibold text-liqui-navy">
          Nome
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-2 w-full rounded-xl border border-zinc-200 px-3 py-2.5 text-sm outline-none focus:border-liqui-orange"
            autoFocus
          />
        </label>
        {(mode === 'stage-edit' || mode === 'stage-create') && (
          <label className="block text-sm font-semibold text-liqui-navy">
            Cor
            <input
              type="color"
              value={color || '#f7941d'}
              onChange={(e) => setColor(e.target.value)}
              className="mt-2 h-10 w-full cursor-pointer rounded-xl border border-zinc-200"
            />
          </label>
        )}
        {error && (
          <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-600">
            {error}
          </p>
        )}
      </div>

      <div className="mt-6 flex gap-2 border-t border-zinc-100 pt-4">
        {(mode === 'pipeline-edit' || mode === 'stage-edit') && (
          <button
            type="button"
            onClick={() => void handleDelete()}
            disabled={saving}
            className="rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-semibold text-red-600"
          >
            Excluir
          </button>
        )}
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 rounded-xl border border-zinc-200 px-4 py-2.5 text-sm font-semibold"
        >
          Voltar
        </button>
        <button
          type="button"
          disabled={saving}
          onClick={() => void handleSave()}
          className="flex-1 rounded-xl bg-liqui-orange px-4 py-2.5 text-sm font-bold text-white disabled:opacity-60"
        >
          {saving ? 'Salvando…' : 'Salvar'}
        </button>
      </div>
    </div>
  )
}
