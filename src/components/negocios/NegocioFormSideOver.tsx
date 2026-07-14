import { useEffect, useState } from 'react'
import { SideOver } from '../ui/SideOver'
import { fetchLeads } from '../../lib/leads'
import { createNegocio } from '../../lib/negocios'
import type { Lead } from '../../lib/types'
import type { PipelineStage } from '../../lib/pipelines'

type Props = {
  pipelineId: string
  stages: PipelineStage[]
  defaultLeadId?: number
  onClose: () => void
  onCreated: () => void
}

export function NegocioFormSideOver({
  pipelineId,
  stages,
  defaultLeadId,
  onClose,
  onCreated,
}: Props) {
  const [leads, setLeads] = useState<Lead[]>([])
  const [titulo, setTitulo] = useState('')
  const [idLead, setIdLead] = useState<number | ''>(defaultLeadId ?? '')
  const [valor, setValor] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    void fetchLeads().then(setLeads).catch(() => setLeads([]))
  }, [])

  useEffect(() => {
    if (defaultLeadId) setIdLead(defaultLeadId)
  }, [defaultLeadId])

  async function handleSave() {
    if (!titulo.trim() || !idLead || !stages[0]) {
      setError('Título e lead são obrigatórios.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      await createNegocio({
        titulo: titulo.trim(),
        idLead: Number(idLead),
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
    <SideOver
      title="Novo negócio"
      subtitle="Vinculado a um lead existente"
      onClose={onClose}
      widthClass="max-w-md"
      footer={
        <div className="flex gap-2">
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
            {saving ? 'Salvando…' : 'Criar negócio'}
          </button>
        </div>
      }
    >
      <div className="space-y-4">
        <label className="block text-sm font-semibold text-liqui-navy">
          Lead
          <select
            value={idLead}
            onChange={(e) =>
              setIdLead(e.target.value ? Number(e.target.value) : '')
            }
            className="mt-2 w-full rounded-xl border border-zinc-200 px-3 py-2.5 text-sm outline-none focus:border-liqui-orange"
            disabled={Boolean(defaultLeadId)}
          >
            <option value="">Selecione…</option>
            {leads.map((l) => (
              <option key={l.id_lead} value={l.id_lead}>
                {l.nome} (LED-{String(l.id_lead).padStart(4, '0')})
              </option>
            ))}
          </select>
        </label>

        <label className="block text-sm font-semibold text-liqui-navy">
          Título
          <input
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            placeholder="Ex.: Pacote Aprovação Contábil"
            className="mt-2 w-full rounded-xl border border-zinc-200 px-3 py-2.5 text-sm outline-none focus:border-liqui-orange"
            autoFocus
          />
        </label>

        <label className="block text-sm font-semibold text-liqui-navy">
          Valor estimado (R$)
          <input
            value={valor}
            onChange={(e) => setValor(e.target.value)}
            placeholder="0,00"
            inputMode="decimal"
            className="mt-2 w-full rounded-xl border border-zinc-200 px-3 py-2.5 text-sm outline-none focus:border-liqui-orange"
          />
        </label>

        {error && (
          <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-600">
            {error}
          </p>
        )}
      </div>
    </SideOver>
  )
}
