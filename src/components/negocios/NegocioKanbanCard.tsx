import type { DragEvent } from 'react'
import { Eye } from 'lucide-react'
import { IconBubble } from '../ui/IconBubble'
import { LeadAvatar } from '../ui/LeadAvatar'
import type { NegocioWithLead } from '../../lib/negocios'

type Props = {
  negocio: NegocioWithLead
  dragging?: boolean
  onOpen: () => void
  onDragStart: (e: DragEvent) => void
  onDragEnd: () => void
}

function money(v: number) {
  return Number(v || 0).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 0,
  })
}

export function NegocioKanbanCard({
  negocio,
  dragging,
  onOpen,
  onDragStart,
  onDragEnd,
}: Props) {
  const leadName = negocio.leads?.nome || `Lead #${negocio.id_lead}`
  const badge =
    negocio.status_negocio === 'ganho'
      ? 'Ganho'
      : negocio.status_negocio === 'perdido'
        ? 'Perdido'
        : 'Aberto'

  return (
    <article
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onClick={onOpen}
      className={`cursor-grab rounded-2xl border border-zinc-200 bg-white p-3 shadow-sm transition hover:border-liqui-orange/40 hover:shadow-md active:cursor-grabbing ${
        dragging ? 'opacity-50' : ''
      }`}
    >
      <div className="flex items-start gap-2.5">
        <LeadAvatar name={leadName} size="sm" />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="line-clamp-2 text-sm font-bold text-liqui-navy">
                {negocio.titulo}
              </p>
              <p className="mt-0.5 truncate text-xs font-semibold text-zinc-600">
                {leadName}
              </p>
              <p className="mt-0.5 text-[11px] text-zinc-400">
                {negocio.codigo || '—'} · LED-{negocio.id_lead}
              </p>
            </div>
            <span
              className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                negocio.status_negocio === 'ganho'
                  ? 'bg-emerald-50 text-emerald-700'
                  : negocio.status_negocio === 'perdido'
                    ? 'bg-red-50 text-red-600'
                    : 'bg-liqui-orange-soft text-liqui-navy'
              }`}
            >
              {badge}
            </span>
          </div>
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between border-t border-zinc-50 pt-2.5">
        <span className="text-sm font-extrabold text-liqui-navy">
          {money(negocio.valor)}
        </span>
        <IconBubble icon={Eye} size="sm" tone="zinc" />
      </div>
    </article>
  )
}
