import { Users } from 'lucide-react'
import { SideOver } from '../ui/SideOver'
import {
  ConsultorPickTable,
  consultorLabel,
} from './ConsultorPickTable'
import type { LeadDistributionRow } from '../../lib/distribuicao'
import type { Profile } from '../../lib/profiles'
import type { Lead } from '../../lib/types'

export type DistMode = 'um' | 'roundrobin' | 'fila'

type Props = {
  open: boolean
  onClose: () => void
  saving: boolean
  mode: DistMode
  onMode: (m: DistMode) => void
  targetId: string
  onTarget: (id: string) => void
  includeInactive: boolean
  onIncludeInactive: (v: boolean) => void
  /** Só entra no lote leads sem dono (ignorado no modo desatribuir). */
  onlyUnassigned: boolean
  onOnlyUnassigned: (v: boolean) => void
  /** Rodízio: true = todos ativos; false = pool escolhido */
  poolAuto: boolean
  onPoolAuto: (v: boolean) => void
  poolIds: Set<string>
  onTogglePoolId: (id: string) => void
  selectedCount: number
  loteCount: number
  lotePreview: Lead[]
  consultores: Profile[]
  dist: LeadDistributionRow[]
  poolSize: number
  nameById: Map<string, string>
  onApply: () => void
  error?: string | null
}

/**
 * Sideover: lote → atribuir / redistribuir carga / desatribuir (fila).
 */
export function DistributeSideOver({
  open,
  onClose,
  saving,
  mode,
  onMode,
  targetId,
  onTarget,
  includeInactive,
  onIncludeInactive,
  onlyUnassigned,
  onOnlyUnassigned,
  poolAuto,
  onPoolAuto,
  poolIds,
  onTogglePoolId,
  selectedCount,
  loteCount,
  lotePreview,
  consultores,
  dist,
  poolSize,
  nameById,
  onApply,
  error,
}: Props) {
  if (!open) return null

  const isUnassign = mode === 'fila'
  const canApply =
    loteCount > 0 &&
    (mode !== 'um' || Boolean(targetId)) &&
    !(mode === 'roundrobin' && poolSize === 0)

  const actionLabel =
    mode === 'fila'
      ? 'Desatribuir'
      : mode === 'um'
        ? 'Atribuir'
        : 'Redistribuir'

  return (
    <SideOver
      title="Distribuir leads"
      subtitle="Fila = sem consultor. Lote + ação no painel."
      onClose={onClose}
      widthClass="max-w-xl"
      footer={
        <div className="flex flex-col gap-2">
          {error && (
            <p className="rounded-xl bg-red-50 px-3 py-2 text-xs text-red-600">
              {error}
            </p>
          )}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-xl border border-zinc-200 py-2.5 text-sm font-semibold text-liqui-navy"
            >
              Cancelar
            </button>
            <button
              type="button"
              disabled={saving || !canApply}
              onClick={onApply}
              className="flex-1 rounded-xl bg-liqui-orange py-2.5 text-sm font-bold text-white disabled:opacity-40"
            >
              {saving
                ? 'Aplicando…'
                : `${actionLabel} (${loteCount})`}
            </button>
          </div>
        </div>
      }
    >
      <div className="space-y-5">
        <div className="rounded-2xl border border-zinc-100 bg-zinc-50 px-4 py-3">
          <p className="text-xs font-bold uppercase tracking-wide text-zinc-400">
            Lote
          </p>
          <p className="mt-1 text-sm text-liqui-navy">
            {selectedCount > 0 ? (
              <>
                <strong>{selectedCount}</strong> selecionado(s) na tabela
                {onlyUnassigned && !isUnassign
                  ? ' · só quem está na fila'
                  : ''}
              </>
            ) : (
              <>
                Nenhuma seleção —{' '}
                {isUnassign
                  ? 'usará todos com consultor (cuidado)'
                  : onlyUnassigned
                    ? 'usará a fila (sem consultor)'
                    : 'usará todos os leads'}
              </>
            )}
          </p>
          <p className="mt-1 text-lg font-extrabold text-liqui-navy">
            {loteCount} lead(s) no lote
          </p>
          {loteCount === 0 && (
            <p className="mt-2 text-xs text-amber-700">
              {isUnassign
                ? 'Marque leads que JÁ têm consultor para devolver à fila.'
                : 'Marque leads na tabela ou ajuste “só fila / sem consultor”.'}
            </p>
          )}
          {lotePreview.length > 0 && (
            <ul className="mt-3 max-h-28 space-y-1 overflow-y-auto text-xs text-zinc-600">
              {lotePreview.slice(0, 8).map((l) => (
                <li key={l.id_lead} className="flex justify-between gap-2">
                  <span className="truncate font-medium text-liqui-navy">
                    #{l.id_lead} {l.nome}
                  </span>
                  <span className="shrink-0 text-zinc-400">
                    {l.assigned_to
                      ? nameById.get(l.assigned_to) || '…'
                      : 'fila'}
                  </span>
                </li>
              ))}
              {lotePreview.length > 8 && (
                <li className="text-zinc-400">
                  +{lotePreview.length - 8} mais…
                </li>
              )}
            </ul>
          )}
        </div>

        {!isUnassign && (
          <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-zinc-100 px-3 py-3">
            <input
              type="checkbox"
              className="mt-0.5 h-4 w-4 rounded border-zinc-300"
              checked={onlyUnassigned}
              onChange={(e) => onOnlyUnassigned(e.target.checked)}
            />
            <span>
              <span className="block text-sm font-semibold text-liqui-navy">
                Só fila (sem consultor)
              </span>
              <span className="text-xs text-zinc-500">
                Desmarque para redistribuir quem já tem dono (rebalancear
                carga).
              </span>
            </span>
          </label>
        )}

        <div>
          <p className="mb-2 text-xs font-bold uppercase tracking-wide text-zinc-400">
            Ação
          </p>
          <div className="space-y-2">
            <ModeCard
              active={mode === 'um'}
              onClick={() => onMode('um')}
              title="Atribuir a um consultor"
              hint="Manual: lote → uma pessoa"
            />
            <ModeCard
              active={mode === 'roundrobin'}
              onClick={() => onMode('roundrobin')}
              title="Redistribuir carga (automático)"
              hint={`Rodízio · ${poolSize} no pool`}
            />
            <ModeCard
              active={mode === 'fila'}
              onClick={() => onMode('fila')}
              title="Desatribuir → volta pra fila"
              hint="Tira o dono; leads ficam sem consultor"
              danger
            />
          </div>
        </div>

        {mode === 'um' && (
          <ConsultorPickTable
            consultores={consultores}
            dist={dist}
            selectedId={targetId}
            onSelect={onTarget}
            includeInactive={includeInactive}
            title="Consultor destino"
          />
        )}

        {mode === 'roundrobin' && (
          <div className="space-y-3">
            <div className="space-y-2 rounded-2xl border border-zinc-100 p-3">
              <label className="flex cursor-pointer items-start gap-3">
                <input
                  type="radio"
                  name="pool-mode"
                  className="mt-1"
                  checked={poolAuto}
                  onChange={() => onPoolAuto(true)}
                />
                <span>
                  <span className="block text-sm font-semibold text-liqui-navy">
                    Automático — todos os ativos
                  </span>
                  <span className="text-xs text-zinc-500">
                    Pool livre: {poolAuto ? poolSize : '—'} consultor(es)
                  </span>
                </span>
              </label>
              <label className="flex cursor-pointer items-start gap-3">
                <input
                  type="radio"
                  name="pool-mode"
                  className="mt-1"
                  checked={!poolAuto}
                  onChange={() => onPoolAuto(false)}
                />
                <span>
                  <span className="block text-sm font-semibold text-liqui-navy">
                    Escolher consultores do rodízio
                  </span>
                  <span className="text-xs text-zinc-500">
                    Marque quem entra no balanceamento
                  </span>
                </span>
              </label>
            </div>

            {poolAuto && (
              <label className="flex cursor-pointer items-center gap-2 text-sm text-zinc-600">
                <input
                  type="checkbox"
                  checked={includeInactive}
                  onChange={(e) => onIncludeInactive(e.target.checked)}
                  className="h-4 w-4 rounded border-zinc-300"
                />
                Incluir pendentes no automático
              </label>
            )}

            {!poolAuto && (
              <ConsultorPickTable
                consultores={consultores}
                dist={dist}
                selectedId=""
                onSelect={() => undefined}
                multi
                selectedIds={poolIds}
                onToggleId={onTogglePoolId}
                includeInactive
                title="Pool do rodízio"
              />
            )}

            <div className="flex items-center gap-2 rounded-xl border border-zinc-100 bg-zinc-50 px-3 py-2 text-xs text-zinc-500">
              <Users className="h-4 w-4 text-liqui-orange" />
              Pool efetivo: {poolSize} consultor(es)
            </div>
          </div>
        )}

        {mode === 'fila' && (
          <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
            A fila continua existindo: leads sem consultor. Depois use
            Redistribuir carga ou Atribuir para tirar da fila.
          </p>
        )}

        {mode === 'um' && targetId && (
          <p className="text-xs text-zinc-500">
            Destino:{' '}
            <strong className="text-liqui-navy">
              {consultorLabel(
                consultores.find((c) => c.id === targetId) || {
                  full_name: nameById.get(targetId),
                  email: '',
                },
              )}
            </strong>
          </p>
        )}
      </div>
    </SideOver>
  )
}

function ModeCard({
  active,
  onClick,
  title,
  hint,
  danger,
}: {
  active: boolean
  onClick: () => void
  title: string
  hint: string
  danger?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full rounded-2xl border px-4 py-3 text-left transition ${
        active
          ? danger
            ? 'border-red-300 bg-red-50 ring-1 ring-red-200'
            : 'border-liqui-orange bg-liqui-orange-soft ring-1 ring-liqui-orange/30'
          : 'border-zinc-200 bg-white hover:bg-zinc-50'
      }`}
    >
      <p
        className={`text-sm font-bold ${
          danger && active ? 'text-red-800' : 'text-liqui-navy'
        }`}
      >
        {title}
      </p>
      <p className="mt-0.5 text-xs text-zinc-500">{hint}</p>
    </button>
  )
}
