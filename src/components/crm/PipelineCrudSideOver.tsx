import { SideOver } from '../ui/SideOver'
import { useState } from 'react'
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

type Mode = 'pipeline-create' | 'pipeline-edit' | 'stage-create' | 'stage-edit'

type Props = {
  mode: Mode
  kind: PipelineKind
  pipeline?: Pipeline
  stage?: PipelineStage
  onClose: () => void
  onDone: () => void
}

export function PipelineCrudSideOver({
  mode,
  kind,
  pipeline,
  stage,
  onClose,
  onDone,
}: Props) {
  const [name, setName] = useState(
    mode.includes('stage') ? stage?.name || '' : pipeline?.name || '',
  )
  const [color, setColor] = useState(stage?.color || '#f7941d')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const title =
    mode === 'pipeline-create'
      ? 'Novo funil'
      : mode === 'pipeline-edit'
        ? 'Editar funil'
        : mode === 'stage-create'
          ? 'Novo estágio'
          : 'Editar estágio'

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
      onClose()
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
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao excluir')
    } finally {
      setSaving(false)
    }
  }

  return (
    <SideOver
      title={title}
      subtitle={kind === 'negocios' ? 'Funil de negócios' : 'Funil de leads'}
      onClose={onClose}
      widthClass="max-w-md"
      footer={
        <div className="flex gap-2">
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
            onClick={onClose}
            className="flex-1 rounded-xl border border-zinc-200 px-4 py-2.5 text-sm font-semibold"
          >
            Cancelar
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
      }
    >
      <label className="block text-sm font-semibold text-liqui-navy">
        Nome
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="mt-2 w-full rounded-xl border border-zinc-200 px-3 py-2.5 text-sm outline-none focus:border-liqui-orange"
          autoFocus
        />
      </label>
      {mode.includes('stage') && mode !== 'stage-create' && (
        <label className="mt-4 block text-sm font-semibold text-liqui-navy">
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
        <p className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-600">
          {error}
        </p>
      )}
    </SideOver>
  )
}
