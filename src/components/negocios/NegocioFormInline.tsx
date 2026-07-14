import { useState } from 'react'
import { createNegocio } from '../../lib/negocios'
import type { PipelineStage } from '../../lib/pipelines'

type Props = {
  pipelineId: string
  stages: PipelineStage[]
  defaultLeadId?: number
  onClose: () => void
  onCreated: () => void
}

export function NegocioFormInline({
  pipelineId,
  stages,
  defaultLeadId,
  onClose,
  onCreated,
}: Props) {
  const [titulo, setTitulo] = useState('')
  const [valor, setValor] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSave() {
    if (!titulo.trim() || !stages[0]) {
      setError('Título é obrigatório.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      await createNegocio({
        titulo: titulo.trim(),
        idLead: defaultLeadId || 0,
        valor: Number(String(valor).replace(',', '.') || 0),
        pipelineId,
        stageId: stages[0].id,
      })
      onCreated()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao criar negócio')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold text-liqui-navy">
          Novo negócio
        </h3>
      </div>

      {error && (
        <p className="rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-600">
          {error}
        </p>
      )}

      <div className="space-y-3">
        <label className="block text-sm font-semibold text-liqui-navy">
          Título
          <input
            type="text"
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            placeholder="Ex: Proposta para Contabilidade"
            className="mt-2 w-full rounded-xl border border-zinc-200 px-3 py-2.5 text-sm outline-none focus:border-liqui-orange"
          />
        </label>

        <label className="block text-sm font-semibold text-liqui-navy">
          Valor (R$)
          <input
            type="text"
            value={valor}
            onChange={(e) => setValor(e.target.value)}
            placeholder="Ex: 5000.00"
            className="mt-2 w-full rounded-xl border border-zinc-200 px-3 py-2.5 text-sm outline-none focus:border-liqui-orange"
          />
        </label>
      </div>

      <div className="flex gap-2 pt-2">
        <button
          type="button"
          onClick={onClose}
          className="flex-1 rounded-xl border border-zinc-200 px-4 py-2.5 text-sm font-semibold"
        >
          Cancelar
        </button>
        <button
          type="button"
          disabled={saving || !titulo.trim()}
          onClick={() => void handleSave()}
          className="flex-1 rounded-xl bg-liqui-orange px-4 py-2.5 text-sm font-bold text-white disabled:opacity-60"
        >
          {saving ? 'Salvando…' : 'Criar negócio'}
        </button>
      </div>
    </div>
  )
}
