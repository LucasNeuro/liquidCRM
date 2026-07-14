import { useEffect, useState } from 'react'
import {
  Archive,
  Bot,
  BriefcaseBusiness,
  Clock3,
  Copy,
  MessageCircle,
  Plus,
  RefreshCw,
  Sparkles,
  Trash2,
} from 'lucide-react'
import { generateLeadInsight } from '../../lib/ai'
import { classifyAndPersistLead } from '../../lib/classify'
import {
  archiveLead,
  buildClassificationText,
  buildLeadContextPayload,
  deleteLead,
  fetchLeadInsights,
  matchLabel,
  matchRespostasDetailed,
  matchTentativasDetailed,
  persistLeadInsight,
  updateLead,
} from '../../lib/leads'
import { fetchNegociosByLead } from '../../lib/negocios'
import {
  fetchPipelines,
  fetchStages,
  type PipelineStage,
} from '../../lib/pipelines'
import type {
  Lead,
  LeadInsight,
  Negocio,
  RespostaPesquisa,
  TentativaCompra,
} from '../../lib/types'
import { NegocioFormSideOver } from '../negocios/NegocioFormSideOver'
import { formatCellValue, formatDateTimeBr } from '../../lib/format'
import { LeadIdBadge, NegocioIdBadge } from '../ui/IdBadge'
import { LeadAvatar } from '../ui/LeadAvatar'
import { GeminiIcon } from '../ui/LlmIcons'
import { MarkdownViewer } from '../ui/MarkdownViewer'
import { Modal } from '../ui/Modal'
import { SideOver } from '../ui/SideOver'

type LeadDrawerProps = {
  lead: Lead
  tentativas: TentativaCompra[]
  respostas: RespostaPesquisa[]
  onClose: () => void
  onChanged?: () => void
}

type TabId = 'resumo' | 'negocios' | 'historico' | 'insight' | 'timeline'

export function LeadDrawer({
  lead: leadProp,
  tentativas,
  respostas,
  onClose,
  onChanged,
}: LeadDrawerProps) {
  const [lead, setLead] = useState(leadProp)
  const relatedTentativas = matchTentativasDetailed(lead, tentativas)
  const relatedRespostas = matchRespostasDetailed(lead, respostas)
  const [tab, setTab] = useState<TabId>('negocios')
  const [insight, setInsight] = useState<LeadInsight | null>(null)
  const [lastRagChunks, setLastRagChunks] = useState<number | null>(null)
  const [copyFlash, setCopyFlash] = useState<string | null>(null)
  const [timeline, setTimeline] = useState<LeadInsight[]>([])
  const [viewing, setViewing] = useState<LeadInsight | null>(null)
  const [negocios, setNegocios] = useState<Negocio[]>([])
  const [negStages, setNegStages] = useState<PipelineStage[]>([])
  const [negPipelineId, setNegPipelineId] = useState('')
  const [showCreateNegocio, setShowCreateNegocio] = useState(false)
  const [loadingInsight, setLoadingInsight] = useState(false)
  const [loadingClassify, setLoadingClassify] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [classifyMsg, setClassifyMsg] = useState<string | null>(null)

  useEffect(() => {
    setLead(leadProp)
  }, [leadProp])

  async function loadNegocios() {
    try {
      setNegocios(await fetchNegociosByLead(lead.id_lead))
    } catch {
      setNegocios([])
    }
  }

  async function loadInsights() {
    try {
      const rows = await fetchLeadInsights(lead.id_lead)
      setTimeline(rows)
      setInsight(rows[0] ?? null)
    } catch {
      setTimeline([])
      setInsight(null)
    }
  }

  useEffect(() => {
    setInsight(null)
    setTimeline([])
    setViewing(null)
    setError(null)
    setTab('negocios')
    void loadInsights()
    void loadNegocios()
    void fetchPipelines('negocios').then(async (pipes) => {
      const active = pipes.find((p) => p.is_default) || pipes[0]
      if (!active) return
      setNegPipelineId(active.id)
      setNegStages(await fetchStages(active.id))
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lead.id_lead])

  async function handleClassify() {
    setLoadingClassify(true)
    setError(null)
    setClassifyMsg(null)
    setTab('insight')
    try {
      const text = buildClassificationText(
        lead,
        relatedTentativas,
        relatedRespostas,
      )
      const result = await classifyAndPersistLead({
        leadId: lead.id_lead,
        text,
        leadName: lead.nome,
      })
      setClassifyMsg(
        `Classificado: ${result.intent} · score ${result.score} · ${result.summary}`,
      )
      onChanged?.()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha na classificação')
    } finally {
      setLoadingClassify(false)
    }
  }

  async function handleInsight(opts?: {
    reinforce?: boolean
    from?: LeadInsight | null
  }) {
    const base = opts?.from || insight || viewing
    setLoadingInsight(true)
    setError(null)
    setTab('insight')
    try {
      const leadContext = buildLeadContextPayload(
        lead,
        relatedTentativas,
        relatedRespostas,
        negocios,
      )
      const result = await generateLeadInsight(leadContext, {
        reinforce: Boolean(opts?.reinforce && base),
        previousInsight: opts?.reinforce && base
          ? {
              titulo: base.titulo,
              resumo: base.resumo,
              proximo_passo: base.proximo_passo,
              riscos: base.riscos,
              evidencias: base.evidencias,
              markdown: base.markdown,
            }
          : undefined,
      })
      const saved = await persistLeadInsight({
        idLead: lead.id_lead,
        insight: result,
      })
      setInsight(saved)
      setLastRagChunks(
        typeof result.rag_chunks_used === 'number'
          ? result.rag_chunks_used
          : null,
      )
      await loadInsights()
      if (opts?.reinforce) {
        setViewing(saved)
      } else {
        setTab('timeline')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao gerar insight')
    } finally {
      setLoadingInsight(false)
    }
  }

  async function handleCopyInsight(item: LeadInsight) {
    const text =
      item.markdown?.trim() ||
      [
        item.titulo || 'Insight',
        '',
        item.resumo,
        '',
        `Próximo passo: ${item.proximo_passo}`,
      ].join('\n')
    try {
      await navigator.clipboard.writeText(text)
      setCopyFlash('Insight copiado')
      setTimeout(() => setCopyFlash(null), 2000)
    } catch {
      setError('Não foi possível copiar (permissão do navegador)')
    }
  }

  async function handleSaveLead() {
    setSaving(true)
    setError(null)
    try {
      await updateLead(lead.id_lead, {
        nome: lead.nome,
        email: lead.email,
        telefone: lead.telefone,
        origem: lead.origem,
        produto_interesse: lead.produto_interesse,
        status: lead.status,
        data_entrada: lead.data_entrada,
      })
      onChanged?.()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao salvar lead')
    } finally {
      setSaving(false)
    }
  }

  async function handleArchive() {
    if (!confirm('Arquivar este lead?')) return
    setSaving(true)
    try {
      await archiveLead(lead.id_lead)
      onChanged?.()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao arquivar')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!confirm('Excluir permanentemente este lead?')) return
    setSaving(true)
    try {
      await deleteLead(lead.id_lead)
      onChanged?.()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao excluir')
    } finally {
      setSaving(false)
    }
  }

  const isWhatsapp = (lead.origem || '').toLowerCase().includes('whats')

  return (
    <>
      <SideOver
        title={lead.nome}
        subtitle={
          <span className="inline-flex flex-wrap items-center gap-1.5">
            <span>{lead.telefone || lead.email || 'sem contato'}</span>
            <LeadIdBadge id={lead.id_lead} />
          </span>
        }
        onClose={onClose}
        widthClass="max-w-xl"
        headerExtra={
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <LeadAvatar name={lead.nome} size="lg" />
            <div className="flex flex-wrap gap-1.5">
              {isWhatsapp && (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-bold text-emerald-700">
                  <MessageCircle className="h-3 w-3" />
                  WhatsApp
                </span>
              )}
              <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-[11px] font-bold text-zinc-600">
                {lead.status || 'Sem estágio'}
              </span>
              <span className="rounded-full bg-liqui-navy/5 px-2.5 py-1 text-[11px] font-bold text-liqui-navy">
                {negocios.length} negócio(s)
              </span>
              <span className="rounded-full bg-liqui-orange-soft px-2.5 py-1 text-[11px] font-bold text-liqui-navy">
                {timeline.length} insight(s)
              </span>
            </div>
          </div>
        }
        footer={
          <div className="space-y-3">
            {tab === 'negocios' ? (
              <button
                type="button"
                onClick={() => setShowCreateNegocio(true)}
                disabled={!negPipelineId || negStages.length === 0}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-liqui-orange px-4 py-3 text-sm font-bold text-white disabled:opacity-60"
              >
                <Plus className="h-4 w-4" />
                Novo negócio neste lead
              </button>
            ) : tab === 'resumo' ? (
              <div className="flex flex-col gap-2">
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => void handleSaveLead()}
                  className="w-full rounded-xl bg-liqui-orange px-4 py-2.5 text-sm font-bold text-white disabled:opacity-60"
                >
                  {saving ? 'Salvando…' : 'Salvar dados'}
                </button>
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => void handleArchive()}
                    className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm font-semibold text-zinc-600"
                  >
                    <Archive className="h-3.5 w-3.5" />
                    Arquivar
                  </button>
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => void handleDelete()}
                    className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-600"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Excluir
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => void handleClassify()}
                    disabled={loadingClassify}
                    className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-liqui-navy/20 bg-white px-3 py-2.5 text-sm font-bold text-liqui-navy disabled:opacity-60"
                  >
                    {loadingClassify ? 'Classificando…' : 'Classificar'}
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleInsight()}
                    disabled={loadingInsight}
                    className="inline-flex flex-[1.4] items-center justify-center gap-2 rounded-xl bg-liqui-navy px-3 py-2.5 text-sm font-bold text-white disabled:opacity-60"
                  >
                    <Sparkles className="h-4 w-4 text-liqui-orange" />
                    {loadingInsight ? 'Gerando…' : 'Gerar insight'}
                  </button>
                </div>
                {(tab === 'insight' || tab === 'timeline') && insight && (
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => void handleCopyInsight(insight)}
                      className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm font-semibold text-liqui-navy"
                    >
                      <Copy className="h-3.5 w-3.5" />
                      Copiar
                    </button>
                    <button
                      type="button"
                      disabled={loadingInsight}
                      onClick={() =>
                        void handleInsight({ reinforce: true, from: insight })
                      }
                      className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-liqui-orange/40 bg-liqui-orange-soft px-3 py-2 text-sm font-semibold text-liqui-navy disabled:opacity-60"
                    >
                      <RefreshCw className="h-3.5 w-3.5" />
                      Aprofundar
                    </button>
                  </div>
                )}
              </div>
            )}
            <p className="flex items-center justify-center gap-1.5 text-[10px] text-zinc-400">
              <GeminiIcon className="h-3.5 w-3.5" />
              Powered by Gemini
            </p>
          </div>
        }
      >
        <div className="mb-4 flex gap-1 overflow-x-auto rounded-xl bg-zinc-100 p-1">
          {(
            [
              { id: 'negocios' as const, label: 'Negócios' },
              { id: 'resumo' as const, label: 'Dados' },
              { id: 'historico' as const, label: 'Histórico' },
              { id: 'insight' as const, label: 'Insight IA' },
              { id: 'timeline' as const, label: 'Timeline' },
            ] as const
          ).map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`shrink-0 rounded-lg px-3 py-2 text-xs font-bold transition ${
                tab === t.id
                  ? 'bg-white text-liqui-navy shadow-sm'
                  : 'text-zinc-500 hover:text-liqui-navy'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {error && (tab === 'resumo' || tab === 'insight' || tab === 'timeline') && (
          <p className="mb-3 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-600">
            {error}
          </p>
        )}

        {tab === 'negocios' && (
          <div className="space-y-3">
            <p className="text-xs text-zinc-500">
              Cada lead pode ter N negócios no funil comercial.
            </p>
            {negocios.length === 0 ? (
              <p className="rounded-xl border border-dashed border-zinc-200 bg-zinc-50 px-4 py-8 text-center text-sm text-zinc-500">
                Nenhum negócio ainda. Crie o primeiro abaixo.
              </p>
            ) : (
              <ul className="space-y-2">
                {negocios.map((n) => (
                  <li
                    key={n.id}
                    className="flex items-start gap-3 rounded-2xl border border-zinc-100 bg-white p-3"
                  >
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-zinc-100">
                      <BriefcaseBusiness className="h-4 w-4 text-liqui-navy" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-liqui-navy">{n.titulo}</p>
                      <div className="mt-0.5">
                        <NegocioIdBadge codigo={n.codigo} />
                      </div>
                      <p className="mt-1 text-sm font-bold text-liqui-navy">
                        R${' '}
                        {Number(n.valor || 0).toLocaleString('pt-BR', {
                          minimumFractionDigits: 2,
                        })}
                        <span className="ml-2 text-xs font-semibold capitalize text-zinc-400">
                          · {n.status_negocio}
                        </span>
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {tab === 'resumo' && (
          <div className="space-y-3">
            <LeadField
              label="nome"
              value={lead.nome}
              onChange={(v) => setLead({ ...lead, nome: v })}
            />
            <LeadField
              label="email"
              value={lead.email || ''}
              onChange={(v) => setLead({ ...lead, email: v || null })}
            />
            <LeadField
              label="telefone"
              value={lead.telefone || ''}
              onChange={(v) => setLead({ ...lead, telefone: v || null })}
            />
            <LeadField
              label="origem"
              value={lead.origem || ''}
              onChange={(v) => setLead({ ...lead, origem: v || null })}
            />
            <LeadField
              label="produto_interesse"
              value={lead.produto_interesse || ''}
              onChange={(v) =>
                setLead({ ...lead, produto_interesse: v || null })
              }
            />
            <LeadField
              label="status"
              value={lead.status || ''}
              onChange={(v) => setLead({ ...lead, status: v || null })}
            />
            <LeadField
              label="data_entrada"
              value={lead.data_entrada || ''}
              onChange={(v) => setLead({ ...lead, data_entrada: v || null })}
            />
          </div>
        )}

        {tab === 'historico' && (
          <div className="space-y-5">
            <p className="rounded-xl bg-zinc-50 px-3 py-2 text-xs text-zinc-600">
              Consolidação das 3 abas da base. Preferência:{' '}
              <strong>id_lead</strong>; fallback: e-mail → telefone (últimos 8) →
              nome. Datas no padrão Brasília (pt-BR).
            </p>

            <section>
              <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-zinc-400">
                Tentativas de compra ({relatedTentativas.length})
              </h3>
              {relatedTentativas.length === 0 ? (
                <p className="text-sm text-zinc-500">Nenhuma vinculada.</p>
              ) : (
                <ul className="space-y-2">
                  {relatedTentativas.map((t) => (
                    <li
                      key={t.id}
                      className="rounded-xl border border-zinc-100 bg-white px-3 py-2.5 text-sm"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="font-semibold text-liqui-navy">
                          {t.produto || 'Produto?'} · R${' '}
                          {Number(t.valor ?? 0).toLocaleString('pt-BR', {
                            minimumFractionDigits: 2,
                          })}
                        </p>
                        <span className="shrink-0 rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-bold text-zinc-500">
                          {matchLabel(t.match_by)}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-zinc-500">
                        {t.status_pagamento || '—'} · {t.forma_pagamento || '—'}{' '}
                        · {formatCellValue(t.data_tentativa, 'data_tentativa')}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section>
              <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-zinc-400">
                Respostas de pesquisa ({relatedRespostas.length})
              </h3>
              {relatedRespostas.length === 0 ? (
                <p className="text-sm text-zinc-500">Nenhuma vinculada.</p>
              ) : (
                <ul className="space-y-2">
                  {relatedRespostas.map((r) => (
                    <li
                      key={r.id}
                      className="rounded-xl border border-zinc-100 bg-white px-3 py-2.5 text-sm"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="font-semibold text-liqui-navy">
                          {r.momento_compra || 'Pesquisa'} ·{' '}
                          {r.principal_objecao || '—'}
                        </p>
                        <span className="shrink-0 rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-bold text-zinc-500">
                          {matchLabel(r.match_by)}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-zinc-500">
                        {r.area_interesse || '—'} · nota{' '}
                        {r.nota_intencao ?? '—'} ·{' '}
                        {formatCellValue(r.data_resposta, 'data_resposta')}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        )}

        {tab === 'insight' && (
          <section className="space-y-4">
            <div className="rounded-2xl border border-liqui-orange/30 bg-liqui-orange-soft/60 p-4">
              <div className="flex items-start gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-liqui-navy text-liqui-orange">
                  <Bot className="h-5 w-5" />
                </span>
                <div>
                  <h3 className="text-sm font-extrabold text-liqui-navy">
                    Insight por IA
                  </h3>
                  <p className="mt-1 text-xs text-zinc-600">
                    Cruzamento: lead · {relatedTentativas.length} tentativa(s) ·{' '}
                    {relatedRespostas.length} pesquisa(s) · {negocios.length}{' '}
                    negócio(s)
                    {lastRagChunks != null
                      ? ` · ${lastRagChunks} trecho(s) RAG`
                      : ''}
                    .
                  </p>
                </div>
              </div>
            </div>
            {(classifyMsg || copyFlash) && (
              <p className="rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
                {copyFlash || classifyMsg}
              </p>
            )}
            {insight ? (
              <div className="space-y-3">
                <div className="rounded-2xl border border-zinc-200 bg-white p-4">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-zinc-400">
                    Resumo
                  </p>
                  <p className="mt-1.5 text-sm text-liqui-navy">{insight.resumo}</p>
                </div>
                <div className="rounded-2xl border border-liqui-orange/40 bg-liqui-orange-soft/50 p-4">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-zinc-400">
                    Próximo passo
                  </p>
                  <p className="mt-1.5 text-sm font-semibold text-liqui-navy">
                    {insight.proximo_passo}
                  </p>
                </div>
                {insight.evidencias?.length > 0 && (
                  <div className="rounded-2xl border border-zinc-100 bg-zinc-50 p-4">
                    <p className="text-[10px] font-bold uppercase tracking-wide text-zinc-400">
                      Evidências (fidelidade à base)
                    </p>
                    <ul className="mt-2 space-y-1">
                      {insight.evidencias.map((e) => (
                        <li
                          key={e}
                          className="font-mono text-[11px] text-zinc-600"
                        >
                          · {e}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {insight.riscos?.length > 0 && (
                  <div className="rounded-2xl border border-red-100 bg-red-50/60 p-4">
                    <p className="text-[10px] font-bold uppercase tracking-wide text-red-400">
                      Riscos
                    </p>
                    <ul className="mt-2 list-disc space-y-1 pl-4 text-sm text-red-700">
                      {insight.riscos.map((r) => (
                        <li key={r}>{r}</li>
                      ))}
                    </ul>
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => setViewing(insight)}
                  className="w-full rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-sm font-semibold text-liqui-navy hover:border-liqui-orange/40"
                >
                  Abrir Markdown completo
                </button>
                <p className="text-center text-[11px] text-zinc-400">
                  {formatDate(insight.created_at)} · salvo no lead
                </p>
              </div>
            ) : (
              !loadingInsight && (
                <p className="rounded-xl border border-dashed border-zinc-200 px-4 py-8 text-center text-sm text-zinc-500">
                  Use Classificar / Gerar insight no rodapé do painel.
                </p>
              )
            )}
          </section>
        )}

        {tab === 'timeline' && (
          <section className="space-y-3">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-zinc-400">
              <Clock3 className="h-3.5 w-3.5" />
              Histórico de insights · {timeline.length}
            </div>
            {timeline.length === 0 ? (
              <p className="rounded-xl border border-dashed border-zinc-200 px-4 py-8 text-center text-sm text-zinc-500">
                Nenhum insight salvo ainda.
              </p>
            ) : (
              <ol className="relative space-y-3 border-l-2 border-liqui-orange/30 pl-4">
                {timeline.map((item) => (
                  <li key={item.id || item.created_at}>
                    <span className="absolute -left-[7px] mt-2 h-3 w-3 rounded-full border-2 border-white bg-liqui-orange" />
                    <button
                      type="button"
                      onClick={() => setViewing(item)}
                      className="w-full rounded-2xl border border-zinc-200 bg-white p-3 text-left shadow-sm hover:border-liqui-orange/50"
                    >
                      <p className="text-[11px] font-semibold text-zinc-400">
                        {formatDate(item.created_at)} · {item.model_name}
                      </p>
                      <p className="mt-1 text-sm font-bold text-liqui-navy">
                        {item.titulo || item.resumo.slice(0, 80)}
                      </p>
                      <p className="mt-1 line-clamp-2 text-xs text-zinc-500">
                        {item.proximo_passo}
                      </p>
                    </button>
                  </li>
                ))}
              </ol>
            )}
          </section>
        )}
      </SideOver>

      {viewing && (
        <Modal
          wide
          title={viewing.titulo || 'Insight'}
          subtitle={`${viewing.model_name} · ${formatDate(viewing.created_at)} · vinculado ao lead`}
          onClose={() => setViewing(null)}
          footer={
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void handleCopyInsight(viewing)}
                className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-sm font-semibold text-liqui-navy"
              >
                <Copy className="h-4 w-4" />
                {copyFlash ? 'Copiado!' : 'Copiar insight'}
              </button>
              <button
                type="button"
                disabled={loadingInsight}
                onClick={() =>
                  void handleInsight({ reinforce: true, from: viewing })
                }
                className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-liqui-navy px-4 py-2.5 text-sm font-bold text-white disabled:opacity-60"
              >
                <RefreshCw
                  className={`h-4 w-4 text-liqui-orange ${loadingInsight ? 'animate-spin' : ''}`}
                />
                {loadingInsight ? 'Aprofundando…' : 'Aprofundar análise'}
              </button>
            </div>
          }
        >
          <MarkdownViewer markdown={viewing.markdown || viewing.resumo} />
        </Modal>
      )}

      {showCreateNegocio && negPipelineId && negStages[0] && (
        <NegocioFormSideOver
          pipelineId={negPipelineId}
          stages={negStages}
          defaultLeadId={lead.id_lead}
          onClose={() => setShowCreateNegocio(false)}
          onCreated={() => void loadNegocios()}
        />
      )}
    </>
  )
}

function formatDate(value?: string) {
  return formatDateTimeBr(value)
}

function LeadField({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (v: string) => void
}) {
  return (
    <label className="block text-sm font-semibold text-liqui-navy">
      {label}
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1.5 w-full rounded-xl border border-zinc-200 px-3 py-2.5 text-sm outline-none focus:border-liqui-orange"
      />
    </label>
  )
}
