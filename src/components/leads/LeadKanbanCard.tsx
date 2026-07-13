import type { DragEvent } from 'react'
import { Eye, MessageCircle, Sparkles } from 'lucide-react'
import { IconBubble } from '../ui/IconBubble'
import { LeadAvatar } from '../ui/LeadAvatar'
import type { Lead } from '../../lib/types'

type LeadKanbanCardProps = {
  lead: Lead
  dragging?: boolean
  onOpen: () => void
  onDragStart: (e: DragEvent) => void
  onDragEnd: () => void
}

export function LeadKanbanCard({
  lead,
  dragging,
  onOpen,
  onDragStart,
  onDragEnd,
}: LeadKanbanCardProps) {
  const score = lead.score_gemini ?? null
  const classified = score != null || Boolean(lead.intent_gemini)
  const isWhatsapp = (lead.origem || '').toLowerCase().includes('whats')
  const scorePct = Math.min(100, Math.max(0, score ?? 0))

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
        <LeadAvatar name={lead.nome} size="sm" />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-liqui-navy">
                {lead.nome}
              </p>
              <p className="text-[11px] text-zinc-400">
                LED-{String(lead.id_lead).padStart(4, '0')}
              </p>
            </div>
            <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold uppercase text-emerald-700">
              Ativo
            </span>
          </div>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <div className="rounded-xl bg-zinc-50 px-2.5 py-2">
          <p className="text-[10px] font-bold uppercase tracking-wide text-zinc-400">
            Origem
          </p>
          <p
            className={`mt-0.5 truncate text-xs font-semibold ${
              isWhatsapp ? 'text-emerald-600' : 'text-liqui-orange'
            }`}
          >
            {lead.origem || '—'}
          </p>
        </div>
        <div className="rounded-xl bg-zinc-50 px-2.5 py-2">
          <p className="text-[10px] font-bold uppercase tracking-wide text-zinc-400">
            Contato
          </p>
          <p className="mt-0.5 truncate text-xs font-semibold text-zinc-600">
            {lead.telefone || lead.email || '—'}
          </p>
        </div>
      </div>

      {lead.produto_interesse && (
        <p className="mt-2.5 line-clamp-1 text-[11px] text-zinc-500">
          {lead.produto_interesse}
        </p>
      )}

      {/* Mini footer: score + classificação IA */}
      <div className="mt-3 space-y-2 border-t border-zinc-100 pt-2.5">
        <div className="flex items-center justify-between gap-2 text-[10px] font-bold uppercase tracking-wide text-zinc-400">
          <span>Score</span>
          <span className={classified ? 'text-liqui-navy' : 'text-zinc-300'}>
            {classified ? `${scorePct}%` : '—'}
          </span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-zinc-100">
          <div
            className={`h-full rounded-full transition-all ${
              classified ? 'bg-liqui-orange' : 'bg-zinc-200'
            }`}
            style={{ width: `${classified ? scorePct : 0}%` }}
          />
        </div>

        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-1.5">
            {classified ? (
              <span className="shrink-0 rounded-md bg-liqui-orange px-1.5 py-0.5 text-[10px] font-bold text-white">
                IA
              </span>
            ) : (
              <span className="shrink-0 rounded-md border border-dashed border-zinc-300 px-1.5 py-0.5 text-[10px] font-bold text-zinc-400">
                Sem IA
              </span>
            )}
            <span className="inline-flex min-w-0 items-center gap-1.5 text-[11px] text-zinc-500">
              {isWhatsapp ? (
                <IconBubble icon={MessageCircle} size="sm" tone="emerald" />
              ) : (
                <IconBubble icon={Sparkles} size="sm" tone="soft" />
              )}
              <span className="truncate">
                {classified
                  ? lead.intent_gemini || 'classificado'
                  : 'não classificado'}
              </span>
            </span>
          </div>
          <IconBubble icon={Eye} size="sm" tone="zinc" />
        </div>
      </div>
    </article>
  )
}
