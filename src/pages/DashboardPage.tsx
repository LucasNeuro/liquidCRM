import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Bot,
  Columns3,
  RefreshCw,
  Sparkles,
  TrendingUp,
  Users,
} from 'lucide-react'
import {
  countBy,
  DonutCard,
  GaugeCard,
} from '../components/ui/DashCharts'
import { DataTable, type DataColumn } from '../components/ui/DataTable'
import { LeadIdBadge } from '../components/ui/IdBadge'
import { IconBubble } from '../components/ui/IconBubble'
import { checkAiProxyHealth } from '../lib/ai'
import { formatDateTimeBr } from '../lib/format'
import { fetchLeads, fetchRecentInsights } from '../lib/leads'
import { fetchProfiles, type Profile } from '../lib/profiles'
import { fetchTentativas } from '../lib/tentativas'
import type { Lead, LeadInsight, TentativaCompra } from '../lib/types'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { useShellHeader } from '../layouts/ShellContext'

type DashTab = 'visao' | 'comercial' | 'operacao'

function formatMoney(n: number) {
  if (n >= 1_000_000) return `R$ ${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1000) return `R$ ${Math.round(n / 1000)}k`
  return `R$ ${n.toLocaleString('pt-BR')}`
}

function isToday(iso: string | null | undefined) {
  if (!iso) return false
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return false
  const now = new Date()
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  )
}

export function DashboardPage() {
  const { isOwner } = useAuth()
  const { setHeader } = useShellHeader()
  const [proxyOk, setProxyOk] = useState<boolean | null>(null)
  const [tab, setTab] = useState<DashTab>('visao')
  const [view, setView] = useState<'paineis' | 'tabela'>('paineis')
  const [leads, setLeads] = useState<Lead[]>([])
  const [tentativas, setTentativas] = useState<TentativaCompra[]>([])
  const [recentInsights, setRecentInsights] = useState<LeadInsight[]>([])
  const [consultores, setConsultores] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)
  const [resumo, setResumo] = useState<{
    total_leads: number
    total_tentativas: number
    total_respostas: number
    leads_novos: number
    leads_ganhos: number
  } | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    void checkAiProxyHealth().then((h) => setProxyOk(Boolean(h.ok)))
    const [resumoRes, leadsList, tentList, insightsList, profilesList] =
      await Promise.all([
        supabase.from('v_crm_resumo').select('*').maybeSingle(),
        fetchLeads().catch(() => [] as Lead[]),
        fetchTentativas().catch(() => [] as TentativaCompra[]),
        fetchRecentInsights(8).catch(() => [] as LeadInsight[]),
        fetchProfiles().catch(() => [] as Profile[]),
      ])
    if (resumoRes.data) setResumo(resumoRes.data)
    setLeads(leadsList)
    setTentativas(tentList)
    setRecentInsights(insightsList)
    setConsultores(
      profilesList.filter(
        (p) => p.role === 'consultor' && p.active !== false,
      ),
    )
    setLoading(false)
  }, [])

  useEffect(() => {
    setHeader({
      title: 'Dashboard & Relatórios',
      subtitle: 'Visão geral do CRM · Insights LIQUI',
      actions: (
        <button
          type="button"
          onClick={() => void load()}
          className="inline-flex items-center gap-2 rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm font-semibold"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Atualizar
        </button>
      ),
    })
  }, [setHeader, load, loading])

  useEffect(() => {
    void load()
  }, [load])

  const leadsHoje = useMemo(
    () =>
      leads.filter(
        (l) => isToday(l.data_entrada) || isToday(l.created_at ?? null),
      ).length,
    [leads],
  )

  const receitaPotencial = useMemo(() => {
    const abertos = tentativas.filter((t) => {
      const s = (t.status_pagamento || '').toLowerCase()
      return s !== 'aprovado' && s !== 'pago' && s !== 'cancelado'
    })
    const sum = abertos.reduce((acc, t) => acc + Number(t.valor || 0), 0)
    if (sum > 0) return formatMoney(sum)
    // fallback: negócios proxy via leads não ganhos × ticket médio das tentativas
    const ticket =
      tentativas.length > 0
        ? tentativas.reduce((a, t) => a + Number(t.valor || 0), 0) /
          tentativas.length
        : 0
    const pipeline = leads.filter(
      (l) =>
        (l.status || '').toLowerCase() !== 'ganho' &&
        (l.status || '').toLowerCase() !== 'perdido',
    ).length
    return formatMoney(Math.round(pipeline * ticket))
  }, [tentativas, leads])

  const stageCounts = useMemo(() => countBy(leads, 'status'), [leads])

  const origemSlices = useMemo(
    () => countBy(leads, 'origem', 'Sem origem'),
    [leads],
  )

  const pagamentoSlices = useMemo(
    () => countBy(tentativas, 'status_pagamento', 'Sem status'),
    [tentativas],
  )

  const withIa = useMemo(
    () =>
      leads.filter(
        (l) => Number(l.score_gemini || 0) > 0 || Boolean(l.intent_gemini),
      ).length,
    [leads],
  )

  const conversaoPct = useMemo(() => {
    const total = resumo?.total_leads ?? leads.length
    const ganhos =
      resumo?.leads_ganhos ??
      leads.filter((l) => (l.status || '').toLowerCase() === 'ganho').length
    if (!total) return 0
    return (ganhos / total) * 100
  }, [resumo, leads])

  const qualificacaoPct = useMemo(() => {
    if (!leads.length) return 0
    const qual = leads.filter((l) => {
      const s = (l.status || '').toLowerCase()
      return (
        s === 'qualificado' ||
        s === 'ganho' ||
        Number(l.score_gemini || 0) >= 60
      )
    }).length
    return (qual / leads.length) * 100
  }, [leads])

  const iaSlices = useMemo(() => {
    const com = withIa
    const sem = Math.max(0, leads.length - withIa)
    return [
      { label: 'Com insight/score', value: com, color: '#F7941D' },
      { label: 'Sem IA', value: sem, color: '#64748B' },
    ]
  }, [withIa, leads.length])

  const leadNameById = useMemo(() => {
    const map = new Map<number, string>()
    for (const l of leads) map.set(l.id_lead, l.nome)
    return map
  }, [leads])

  const leadColumns: DataColumn<Lead>[] = [
    {
      key: 'nome',
      label: 'Nome',
      render: (r) => (
        <span className="font-semibold text-liqui-navy">{r.nome}</span>
      ),
    },
    {
      key: 'id_lead',
      label: 'ID',
      render: (r) => <LeadIdBadge id={r.id_lead} />,
    },
    { key: 'telefone', label: 'Telefone', render: (r) => r.telefone || '—' },
    { key: 'email', label: 'E-mail', render: (r) => r.email || '—' },
    { key: 'origem', label: 'Origem', render: (r) => r.origem || '—' },
    { key: 'status', label: 'Status', render: (r) => r.status || '—' },
    {
      key: 'score',
      label: 'Score',
      render: (r) => r.score_gemini ?? '—',
    },
  ]

  const tabs: { id: DashTab; label: string }[] = [
    { id: 'visao', label: 'Visão geral' },
    { id: 'comercial', label: 'Comercial' },
    { id: 'operacao', label: 'Operação' },
  ]

  const showTabela = view === 'tabela'

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <div className="shrink-0 space-y-4 px-5 pt-5 pb-4">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Kpi
            label="Leads hoje"
            value={String(leadsHoje)}
            hint="entrada no dia"
            icon={Users}
            progress={leadsHoje ? Math.min(100, leadsHoje * 8) : 0}
          />
          <Kpi
            label="Receita potencial"
            value={receitaPotencial}
            hint="pipeline em aberto"
            icon={TrendingUp}
            progress={40}
          />
          <Kpi
            label="Agentes IA ativos"
            value="2"
            hint={
              proxyOk === null
                ? 'checando hub…'
                : proxyOk
                  ? 'modelos no hub'
                  : 'hub indisponível'
            }
            icon={Sparkles}
            progress={proxyOk ? 30 : 8}
          />
          <Kpi
            label="Leads com IA"
            value={String(withIa)}
            hint={`${leads.length} no CRM`}
            icon={Bot}
            progress={leads.length ? (withIa / leads.length) * 100 : 0}
          />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-1 rounded-xl bg-white p-1 shadow-sm ring-1 ring-zinc-200">
            {tabs.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={`rounded-lg px-3 py-2 text-sm font-semibold transition ${
                  tab === t.id
                    ? 'bg-liqui-navy text-white'
                    : 'text-zinc-600 hover:bg-zinc-50'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
          <div className="flex rounded-xl bg-white p-1 shadow-sm ring-1 ring-zinc-200">
            <button
              type="button"
              onClick={() => setView('paineis')}
              className={`rounded-lg px-3 py-1.5 text-xs font-bold ${
                view === 'paineis'
                  ? 'bg-liqui-orange text-white'
                  : 'text-zinc-500'
              }`}
            >
              Painéis
            </button>
            <button
              type="button"
              onClick={() => setView('tabela')}
              className={`rounded-lg px-3 py-1.5 text-xs font-bold ${
                view === 'tabela'
                  ? 'bg-liqui-orange text-white'
                  : 'text-zinc-500'
              }`}
            >
              Tabela
            </button>
          </div>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-auto p-5 pt-0">
        {showTabela ? (
          <div className="min-h-[360px]">
            <DataTable
              columns={leadColumns}
              rows={
                tab === 'comercial'
                  ? leads.filter((l) => {
                      const s = (l.status || '').toLowerCase()
                      return s !== 'perdido'
                    })
                  : leads
              }
              rowKey={(r) => r.id_lead}
              emptyMessage="Nenhum lead"
            />
          </div>
        ) : (
          <div className="space-y-4">
            {/* Donuts / gauge no topo */}
            <div>
              <p className="mb-3 text-[11px] font-bold uppercase tracking-wide text-zinc-400">
                Insights atualizáveis
              </p>
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {tab === 'operacao' ? (
                  <>
                    <DonutCard
                      title="Cobertura IA"
                      subtitle="Leads com score/insight"
                      slices={iaSlices}
                      unit="leads"
                    />
                    <GaugeCard
                      title="Qualificação IA"
                      subtitle="Score ≥ 60 ou qualificado/ganho"
                      percent={qualificacaoPct}
                      meta={40}
                      label="Qualificação"
                    />
                    <DonutCard
                      title="Origens"
                      subtitle="De onde vêm os leads"
                      slices={origemSlices}
                      unit="leads"
                    />
                  </>
                ) : (
                  <>
                    <DonutCard
                      title="Funil comercial"
                      subtitle="Leads por estágio"
                      slices={stageCounts}
                      unit="leads"
                    />
                    <GaugeCard
                      title="Conversão"
                      subtitle="Ganhos ÷ total de leads"
                      percent={conversaoPct}
                      meta={40}
                      label="Ganhos"
                    />
                    <DonutCard
                      title={
                        tab === 'comercial' ? 'Pagamentos' : 'Origens'
                      }
                      subtitle={
                        tab === 'comercial'
                          ? 'Status das tentativas'
                          : 'Canal de entrada'
                      }
                      slices={
                        tab === 'comercial' ? pagamentoSlices : origemSlices
                      }
                      unit={tab === 'comercial' ? 'tentativas' : 'leads'}
                    />
                  </>
                )}
              </div>
            </div>

            {/* Barras abaixo */}
            <div className="grid gap-4 lg:grid-cols-2">
              {(tab === 'visao' || tab === 'comercial') && (
                <section className="rounded-2xl bg-liqui-navy p-5 text-white shadow-sm">
                  <h3 className="mb-1 text-sm font-extrabold">Funil comercial</h3>
                  <p className="mb-4 text-xs text-white/50">Leads por status</p>
                  {stageCounts.length === 0 ? (
                    <p className="text-sm text-white/50">Sem dados de status</p>
                  ) : (
                    stageCounts.slice(0, 6).map((row) => (
                      <div key={row.label} className="mb-3">
                        <div className="mb-1 flex justify-between text-xs">
                          <span className="text-white/70">{row.label}</span>
                          <span className="font-bold">{row.value}</span>
                        </div>
                        <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
                          <div
                            className="h-full rounded-full bg-liqui-orange"
                            style={{
                              width: `${Math.max(
                                8,
                                (row.value / Math.max(leads.length, 1)) * 100,
                              )}%`,
                            }}
                          />
                        </div>
                      </div>
                    ))
                  )}
                </section>
              )}

              {(tab === 'visao' || tab === 'operacao') && (
                <section className="rounded-2xl bg-liqui-navy p-5 text-white shadow-sm">
                  <h3 className="mb-1 text-sm font-extrabold">Operação</h3>
                  <p className="mb-4 text-xs text-white/50">Volumes da base</p>
                  <OpBar
                    label="Total leads"
                    value={resumo?.total_leads ?? leads.length}
                    max={Math.max(resumo?.total_leads ?? leads.length, 1)}
                  />
                  <OpBar
                    label="Tentativas"
                    value={resumo?.total_tentativas ?? tentativas.length}
                    max={Math.max(
                      resumo?.total_tentativas ?? tentativas.length,
                      1,
                    )}
                  />
                  <OpBar
                    label="Pesquisas"
                    value={resumo?.total_respostas ?? 0}
                    max={Math.max(resumo?.total_respostas ?? 1, 1)}
                  />
                  <OpBar
                    label="Ganhos"
                    value={resumo?.leads_ganhos ?? 0}
                    max={Math.max(resumo?.total_leads ?? 1, 1)}
                  />
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Link
                      to="/leads"
                      className="inline-flex items-center gap-2 rounded-xl bg-liqui-orange px-4 py-2.5 text-sm font-bold text-white"
                    >
                      <Columns3 className="h-4 w-4" />
                      Abrir pipeline
                    </Link>
                    {isOwner && (
                      <Link
                        to="/plataforma"
                        className="inline-flex items-center gap-2 rounded-xl border border-white/20 px-4 py-2.5 text-sm font-semibold text-white/90"
                      >
                        Plataforma
                      </Link>
                    )}
                  </div>
                </section>
              )}

              {tab === 'comercial' && (
                <section className="rounded-2xl bg-liqui-navy p-5 text-white shadow-sm">
                  <h3 className="mb-1 text-sm font-extrabold">Pagamentos</h3>
                  <p className="mb-4 text-xs text-white/50">
                    Tentativas por status · ao vivo
                  </p>
                  {pagamentoSlices.length === 0 ? (
                    <p className="text-sm text-white/50">Sem tentativas</p>
                  ) : (
                    pagamentoSlices.slice(0, 6).map((row) => (
                      <div key={row.label} className="mb-3">
                        <div className="mb-1 flex justify-between text-xs">
                          <span className="text-white/70">{row.label}</span>
                          <span className="font-bold">{row.value}</span>
                        </div>
                        <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
                          <div
                            className="h-full rounded-full"
                            style={{
                              background: row.color,
                              width: `${Math.max(
                                8,
                                (row.value / Math.max(tentativas.length, 1)) *
                                  100,
                              )}%`,
                            }}
                          />
                        </div>
                      </div>
                    ))
                  )}
                </section>
              )}

              {tab === 'operacao' && (
                <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
                  <div className="flex items-center gap-2">
                    <IconBubble icon={Sparkles} size="sm" tone="soft" />
                    <p className="text-sm font-extrabold text-liqui-navy">
                      Hub de IA
                    </p>
                  </div>

                  <div className="mt-4 grid gap-4 sm:grid-cols-2">
                    <div>
                      <div className="mb-2 flex items-center justify-between">
                        <p className="text-[11px] font-bold uppercase tracking-wide text-zinc-400">
                          Últimos insights
                        </p>
                        <Link
                          to="/leads"
                          className="text-[11px] font-semibold text-liqui-orange"
                        >
                          Ver leads
                        </Link>
                      </div>
                      {recentInsights.length === 0 ? (
                        <p className="rounded-xl bg-zinc-50 px-3 py-4 text-xs text-zinc-500">
                          Nenhum insight gerado ainda.
                        </p>
                      ) : (
                        <ul className="max-h-52 space-y-1.5 overflow-y-auto">
                          {recentInsights.map((ins) => {
                            const nome =
                              (ins.id_lead != null
                                ? leadNameById.get(ins.id_lead)
                                : null) || `Lead #${ins.id_lead ?? '—'}`
                            const titulo =
                              ins.titulo?.trim() ||
                              ins.resumo.slice(0, 72) ||
                              'Insight'
                            return (
                              <li key={ins.id || `${ins.id_lead}-${ins.created_at}`}>
                                <Link
                                  to="/leads"
                                  className="block rounded-xl border border-zinc-100 bg-zinc-50/80 px-3 py-2 transition hover:border-liqui-orange/30 hover:bg-liqui-orange-soft/40"
                                >
                                  <div className="flex items-start justify-between gap-2">
                                    <p className="truncate text-xs font-bold text-liqui-navy">
                                      {nome}
                                    </p>
                                    <span className="shrink-0 text-[10px] text-zinc-400">
                                      {formatDateTimeBr(ins.created_at)}
                                    </span>
                                  </div>
                                  <p className="mt-0.5 line-clamp-2 text-[11px] leading-snug text-zinc-600">
                                    {titulo}
                                  </p>
                                </Link>
                              </li>
                            )
                          })}
                        </ul>
                      )}
                    </div>

                    <div>
                      <div className="mb-2 flex items-center justify-between">
                        <p className="text-[11px] font-bold uppercase tracking-wide text-zinc-400">
                          Consultores ativos
                        </p>
                        {isOwner && (
                          <Link
                            to="/plataforma"
                            className="text-[11px] font-semibold text-liqui-orange"
                          >
                            Gerenciar
                          </Link>
                        )}
                      </div>
                      {consultores.length === 0 ? (
                        <p className="rounded-xl bg-zinc-50 px-3 py-4 text-xs text-zinc-500">
                          Nenhum consultor ativo.
                        </p>
                      ) : (
                        <div className="max-h-52 overflow-auto rounded-xl border border-zinc-100">
                          <table className="w-full text-left text-xs">
                            <thead className="sticky top-0 bg-zinc-50 text-[10px] uppercase tracking-wide text-zinc-400">
                              <tr>
                                <th className="px-3 py-2 font-bold">Nome</th>
                                <th className="px-3 py-2 font-bold">E-mail</th>
                              </tr>
                            </thead>
                            <tbody>
                              {consultores.map((c) => (
                                <tr
                                  key={c.id}
                                  className="border-t border-zinc-100"
                                >
                                  <td className="px-3 py-2 font-semibold text-liqui-navy">
                                    {c.full_name || '—'}
                                  </td>
                                  <td className="truncate px-3 py-2 text-zinc-500">
                                    {c.email || '—'}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  </div>
                </section>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function OpBar({
  label,
  value,
  max,
}: {
  label: string
  value: number
  max: number
}) {
  return (
    <div className="mb-3">
      <div className="mb-1 flex justify-between text-xs">
        <span className="text-white/70">{label}</span>
        <span className="font-bold">{value}</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full rounded-full bg-liqui-orange"
          style={{
            width: `${Math.max(6, Math.min(100, (value / max) * 100))}%`,
          }}
        />
      </div>
    </div>
  )
}

function Kpi({
  label,
  value,
  hint,
  icon,
  progress,
}: {
  label: string
  value: string
  hint: string
  icon: typeof Users
  progress: number
}) {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wide text-zinc-400">
            {label}
          </p>
          <p className="mt-1 text-2xl font-extrabold text-liqui-navy">{value}</p>
        </div>
        <IconBubble icon={icon} size="sm" tone="soft" />
      </div>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-zinc-100">
        <div
          className="h-full rounded-full bg-liqui-orange"
          style={{ width: `${Math.max(4, Math.min(100, progress))}%` }}
        />
      </div>
      <p className="mt-2 text-[11px] text-zinc-400">{hint}</p>
    </div>
  )
}
