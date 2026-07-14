import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Cpu,
  Database,
  Play,
  Plus,
  RefreshCw,
  Shield,
} from 'lucide-react'
import {
  CrmEntitySideOver,
  Field,
} from '../components/ui/CrmEntitySideOver'
import { DataTable, type DataColumn } from '../components/ui/DataTable'
import { IconBubble } from '../components/ui/IconBubble'
import { UuidBadge } from '../components/ui/IdBadge'
import { LlmIconBubble } from '../components/ui/LlmIcons'
import { SideOver } from '../components/ui/SideOver'
import { useShellHeader } from '../layouts/ShellContext'
import { runEmbedCrmBatch } from '../lib/ai'
import { formatDateTimeBr } from '../lib/format'
import {
  fetchEmbeddingJobs,
  fetchEmbeddingStats,
  type EmbeddingJob,
} from '../lib/embeddings'
import {
  fetchAiUsageSummary,
  fetchProfiles,
  manageUser,
  type Profile,
  type ProfileRole,
} from '../lib/profiles'
import { supabase } from '../lib/supabase'

type MainTab = 'visao' | 'usuarios' | 'indexacoes' | 'modelos'
type ViewMode = 'paineis' | 'tabela'

const OPERATING_MODELS = [
  {
    id: 'gemini',
    name: 'Google Gemini',
    role: 'Insight e classificação de leads',
    operations: ['lead-insight', 'lead-classify'],
    status: 'ativo' as const,
  },
  {
    id: 'mistral',
    name: 'Mistral',
    role: 'Embeddings RAG + ações auxiliares',
    operations: ['embed-crm-batch', 'mistral-action'],
    status: 'ativo' as const,
  },
]

function formatUsd(n: number) {
  return n.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  })
}

function roleLabel(role: string) {
  if (role === 'owner') return 'Owner'
  return 'Consultor'
}

export function PlatformPage() {
  const { setHeader } = useShellHeader()
  const [tab, setTab] = useState<MainTab>('visao')
  const [view, setView] = useState<ViewMode>('tabela')
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [jobs, setJobs] = useState<EmbeddingJob[]>([])
  const [totalChunks, setTotalChunks] = useState(0)
  const [missingSchema, setMissingSchema] = useState(false)
  const [geminiCost, setGeminiCost] = useState(0)
  const [mistralCost, setMistralCost] = useState(0)
  const [usageMissing, setUsageMissing] = useState(false)
  const [loading, setLoading] = useState(true)
  const [running, setRunning] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [flash, setFlash] = useState<string | null>(null)

  const [userForm, setUserForm] = useState<null | {
    mode: 'create' | 'edit'
    profile?: Profile
  }>(null)
  const [formName, setFormName] = useState('')
  const [formEmail, setFormEmail] = useState('')
  const [formPassword, setFormPassword] = useState('')
  const [formRole, setFormRole] = useState<ProfileRole>('consultor')
  const [formActive, setFormActive] = useState(true)

  const [jobDetail, setJobDetail] = useState<EmbeddingJob | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [stats, list, usage, users] = await Promise.all([
        fetchEmbeddingStats(),
        fetchEmbeddingJobs(40).catch(() => [] as EmbeddingJob[]),
        fetchAiUsageSummary(),
        fetchProfiles().catch(() => [] as Profile[]),
      ])
      setTotalChunks(stats.total)
      setMissingSchema(stats.missingSchema)
      setJobs(list)
      setGeminiCost(usage.geminiCost)
      setMistralCost(usage.mistralCost)
      setUsageMissing(Boolean(usage.missing))
      setProfiles(users)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao carregar')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  // KPIs vivos: qualquer insert em custos / jobs recarrega a tela
  useEffect(() => {
    const channel = supabase
      .channel('plataforma-ai-costs')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'ai_usage_events' },
        () => {
          void load()
        },
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'embedding_jobs' },
        () => {
          void load()
        },
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'crm_embeddings' },
        () => {
          void load()
        },
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [load])

  useEffect(() => {
    setHeader({
      title: 'Acesso Owner',
      subtitle: 'Gestão da plataforma · custos IA · usuários · indexação RAG',
      actions: (
        <button
          type="button"
          onClick={() => void load()}
          className="inline-flex items-center gap-2 rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm font-semibold text-liqui-navy"
        >
          <RefreshCw className="h-4 w-4" />
          Atualizar
        </button>
      ),
    })
  }, [setHeader, load])

  const activeConsultores = useMemo(
    () =>
      profiles.filter(
        (p) => p.role === 'consultor' && p.active !== false,
      ).length,
    [profiles],
  )

  const jobsCostTotal = useMemo(
    () =>
      jobs.reduce((s, j) => s + Number(j.estimated_cost_usd || 0), 0),
    [jobs],
  )

  function openCreateUser() {
    setFormName('')
    setFormEmail('')
    setFormPassword('')
    setFormRole('consultor')
    setFormActive(true)
    setUserForm({ mode: 'create' })
  }

  function openEditUser(p: Profile) {
    setFormName(p.full_name || '')
    setFormEmail(p.email || '')
    setFormPassword('')
    setFormRole((p.role as ProfileRole) || 'consultor')
    setFormActive(p.active !== false)
    setUserForm({ mode: 'edit', profile: p })
  }

  async function saveUser() {
    if (!userForm) return
    setSaving(true)
    setError(null)
    try {
      if (userForm.mode === 'create') {
        await manageUser({
          action: 'create',
          email: formEmail,
          password: formPassword,
          full_name: formName,
          role: formRole,
        })
        setFlash('Usuário criado')
      } else if (userForm.profile) {
        await manageUser({
          action: 'update',
          user_id: userForm.profile.id,
          full_name: formName,
          role: formRole,
          active: formActive,
        })
        setFlash('Usuário atualizado')
      }
      setUserForm(null)
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao salvar usuário')
    } finally {
      setSaving(false)
    }
  }

  async function deleteUser(hard: boolean) {
    if (!userForm?.profile) return
    const msg = hard
      ? 'Excluir permanentemente este usuário do Auth?'
      : 'Desativar este usuário (soft delete)?'
    if (!window.confirm(msg)) return
    setSaving(true)
    setError(null)
    try {
      await manageUser({
        action: 'delete',
        user_id: userForm.profile.id,
        hard,
      })
      setFlash(hard ? 'Usuário removido' : 'Usuário desativado')
      setUserForm(null)
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao remover')
    } finally {
      setSaving(false)
    }
  }

  async function handleRun() {
    setRunning(true)
    setError(null)
    setFlash(null)
    try {
      const result = await runEmbedCrmBatch('manual')
      setFlash(
        `Indexados ${result.embedded_count ?? 0} · ignorados ${result.skipped_count ?? 0} · custo est. ${formatUsd(Number(result.estimated_cost_usd || 0))}`,
      )
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao indexar')
    } finally {
      setRunning(false)
    }
  }

  const userColumns: DataColumn<Profile>[] = [
    {
      key: 'id',
      label: 'ID',
      render: (r) => <UuidBadge value={r.id} hint="user_id" />,
    },
    {
      key: 'nome',
      label: 'Nome',
      render: (r) => (
        <span className="font-semibold text-liqui-navy">{r.full_name}</span>
      ),
    },
    { key: 'email', label: 'E-mail', render: (r) => r.email },
    {
      key: 'role',
      label: 'Cargo',
      render: (r) => (
        <span className="rounded-full bg-liqui-orange-soft px-2 py-0.5 text-[10px] font-bold uppercase text-liqui-navy">
          {roleLabel(r.role)}
        </span>
      ),
    },
    {
      key: 'active',
      label: 'Status',
      render: (r) =>
        r.active === false ? (
          <span className="text-xs font-semibold text-amber-600">Pendente</span>
        ) : (
          <span className="text-xs font-semibold text-emerald-600">Ativo</span>
        ),
    },
    {
      key: 'created_at',
      label: 'Criado',
      render: (r) => formatDateTimeBr(r.created_at),
    },
  ]

  const tabs: { id: MainTab; label: string }[] = [
    { id: 'visao', label: 'Visão geral' },
    { id: 'usuarios', label: 'Usuários' },
    { id: 'indexacoes', label: 'Indexações' },
    { id: 'modelos', label: 'Modelos' },
  ]

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <div className="shrink-0 space-y-4 border-b border-zinc-200/80 bg-[#f3f4f6] px-5 pt-5 pb-4">
        {(missingSchema || usageMissing) && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            {missingSchema && (
              <p>
                Schema RAG: rode{' '}
                <code className="font-mono text-xs">
                  migrate-pgvector-rag.sql
                </code>{' '}
                (extensão <strong>vector</strong> já ativa).
              </p>
            )}
            {usageMissing && (
              <p className={missingSchema ? 'mt-1' : ''}>
                Métricas de custo: rode{' '}
                <code className="font-mono text-xs">
                  migrate-plataforma.sql
                </code>{' '}
                +{' '}
                <code className="font-mono text-xs">
                  migrate-ai-costs-cron.sql
                </code>{' '}
                e promova seu user a{' '}
                <code className="font-mono text-xs">role = owner</code>.
                Custos sobem após insight/classify/embed nas Edge Functions
                (não no gateway local).
              </p>
            )}
          </div>
        )}

        {error && (
          <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-600">
            {error}
          </p>
        )}
        {flash && (
          <p className="rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
            {flash}
          </p>
        )}

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            label="Custo Gemini"
            value={loading ? '…' : formatUsd(geminiCost)}
            hint="insight + classificação"
            llm="gemini"
            progress={Math.min(100, geminiCost * 400)}
          />
          <MetricCard
            label="Custo Mistral"
            value={loading ? '…' : formatUsd(mistralCost)}
            hint="indexação + RAG no insight"
            llm="mistral"
            progress={Math.min(100, mistralCost * 400)}
          />
          <MetricCard
            label="Modelos em operação"
            value={String(OPERATING_MODELS.length)}
            hint="hub de IA da plataforma"
            icon={Cpu}
            progress={30}
          />
          <MetricCard
            label="Chunks indexados"
            value={loading ? '…' : String(totalChunks)}
            hint={`jobs · ${formatUsd(jobsCostTotal)}`}
            icon={Database}
            progress={totalChunks > 0 ? 100 : 0}
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

          <div className="flex items-center gap-2">
            {(tab === 'usuarios' || tab === 'visao') && (
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
            )}
            {tab === 'usuarios' && (
              <button
                type="button"
                onClick={openCreateUser}
                className="inline-flex items-center gap-1.5 rounded-xl bg-liqui-navy px-3 py-2 text-sm font-bold text-white"
              >
                <Plus className="h-4 w-4 text-liqui-orange" />
                Novo consultor
              </button>
            )}
            {tab === 'indexacoes' && (
              <button
                type="button"
                disabled={running || missingSchema}
                onClick={() => void handleRun()}
                className="inline-flex items-center gap-1.5 rounded-xl bg-liqui-navy px-3 py-2 text-sm font-bold text-white disabled:opacity-50"
              >
                <Play className="h-4 w-4 text-liqui-orange" />
                {running ? 'Indexando…' : 'Rodar indexação'}
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-auto p-5">
        {tab === 'visao' &&
          (view === 'tabela' ? (
            <div className="min-h-[360px]">
              <DataTable
                columns={userColumns}
                rows={profiles}
                rowKey={(r) => r.id}
                onRowClick={openEditUser}
                emptyMessage="Nenhum usuário"
              />
            </div>
          ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            <section className="rounded-2xl border border-zinc-200 bg-liqui-navy p-5 text-white shadow-sm">
              <div className="mb-4 flex items-center gap-2">
                <IconBubble icon={Shield} size="sm" tone="orange" />
                <h3 className="text-sm font-extrabold">Operação da plataforma</h3>
              </div>
              <OpRow
                label="Consultores ativos"
                value={String(activeConsultores)}
                max={Math.max(activeConsultores, 1)}
              />
              <OpRow
                label="Usuários totais"
                value={String(profiles.length)}
                max={Math.max(profiles.length, 1)}
              />
              <OpRow
                label="Chunks RAG"
                value={String(totalChunks)}
                max={Math.max(totalChunks, 1)}
              />
              <OpRow
                label="Custo total IA"
                value={formatUsd(geminiCost + mistralCost)}
                max={100}
                pct={Math.min(
                  100,
                  (geminiCost + mistralCost) * 200,
                )}
              />
            </section>

            <section className="rounded-2xl border border-zinc-200 bg-liqui-navy p-5 text-white shadow-sm">
              <div className="mb-4 flex items-center gap-2">
                <IconBubble icon={Cpu} size="sm" tone="orange" />
                <h3 className="text-sm font-extrabold">Modelos no hub</h3>
              </div>
              {OPERATING_MODELS.map((m) => (
                <div
                  key={m.id}
                  className="mb-3 rounded-xl border border-white/10 bg-white/5 px-3 py-2.5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-2">
                      <LlmIconBubble
                        provider={m.id === 'gemini' ? 'gemini' : 'mistral'}
                        size="sm"
                      />
                      <p className="truncate text-sm font-bold">{m.name}</p>
                    </div>
                    <span className="rounded-full bg-liqui-orange/20 px-2 py-0.5 text-[10px] font-bold uppercase text-liqui-orange">
                      {m.status}
                    </span>
                  </div>
                  <p className="mt-0.5 pl-8 text-xs text-white/60">{m.role}</p>
                </div>
              ))}
            </section>
          </div>
          ))}

        {tab === 'usuarios' && (
          <div className="flex h-full min-h-[360px] flex-col gap-3">
            <p className="text-sm text-zinc-500">
              Cadastros públicos ficam <strong>pendentes</strong> até você
              ativar e definir o cargo (<strong>owner</strong> ou{' '}
              <strong>consultor</strong>). Só owner vê esta aba.
            </p>
            {view === 'tabela' ? (
              <div className="min-h-0 flex-1">
                <DataTable
                  columns={userColumns}
                  rows={profiles}
                  rowKey={(r) => r.id}
                  onRowClick={openEditUser}
                  emptyMessage="Nenhum usuário"
                />
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {profiles.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => openEditUser(p)}
                    className="rounded-2xl border border-zinc-200 bg-white p-4 text-left shadow-sm transition hover:border-liqui-orange/40"
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-liqui-navy text-xs font-bold text-white">
                        {(p.full_name || p.email || '?')
                          .slice(0, 2)
                          .toUpperCase()}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-bold text-liqui-navy">
                          {p.full_name}
                        </p>
                        <p className="truncate text-xs text-zinc-500">
                          {p.email}
                        </p>
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          <span className="rounded-full bg-liqui-orange-soft px-2 py-0.5 text-[10px] font-bold uppercase text-liqui-navy">
                            {roleLabel(p.role)}
                          </span>
                          {p.active === false ? (
                            <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold uppercase text-amber-700">
                              Pendente
                            </span>
                          ) : (
                            <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold uppercase text-emerald-700">
                              Ativo
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </button>
                ))}
                {profiles.length === 0 && !loading && (
                  <p className="text-sm text-zinc-400">Nenhum perfil.</p>
                )}
              </div>
            )}
          </div>
        )}

        {tab === 'indexacoes' && (
          <div className="flex h-full min-h-[360px] flex-col gap-3">
            <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
              <h3 className="text-sm font-extrabold text-liqui-navy">
                Índice RAG (pgvector + Mistral)
              </h3>
              <p className="mt-0.5 text-xs text-zinc-500">
                Só as 3 tabelas de análise: <code>leads</code>,{' '}
                <code>tentativas_compra</code> e{' '}
                <code>respostas_pesquisa</code>. Agenda 18:00 · botão acima para
                rodar agora.
              </p>
            </div>

            <ul className="space-y-2">
              {jobs.map((j) => (
                <li key={j.id}>
                  <button
                    type="button"
                    onClick={() => setJobDetail(j)}
                    className="w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-left shadow-sm hover:border-liqui-orange/30"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                          j.status === 'success'
                            ? 'bg-emerald-50 text-emerald-700'
                            : j.status === 'error'
                              ? 'bg-red-50 text-red-600'
                              : 'bg-amber-50 text-amber-700'
                        }`}
                      >
                        {j.status}
                      </span>
                      <span className="text-[11px] text-zinc-400">
                        {formatDateTimeBr(j.started_at)} · {j.trigger_source}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-zinc-600">
                      {j.embedded_count} indexados · {j.skipped_count}{' '}
                      ignorados · {formatUsd(Number(j.estimated_cost_usd || 0))}
                    </p>
                  </button>
                </li>
              ))}
              {jobs.length === 0 && (
                <p className="text-sm text-zinc-400">Nenhum job ainda.</p>
              )}
            </ul>
          </div>
        )}

        {tab === 'modelos' && (
          <div className="grid gap-4 md:grid-cols-2">
            {OPERATING_MODELS.map((m) => (
              <section
                key={m.id}
                className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm"
              >
                <div className="flex items-start gap-3">
                  <LlmIconBubble
                    provider={m.id === 'gemini' ? 'gemini' : 'mistral'}
                    size="lg"
                  />
                  <div>
                    <h3 className="text-base font-extrabold text-liqui-navy">
                      {m.name}
                    </h3>
                    <p className="mt-1 text-sm text-zinc-500">{m.role}</p>
                    <p className="mt-3 text-[10px] font-bold uppercase text-zinc-400">
                      Operações
                    </p>
                    <ul className="mt-1 space-y-1">
                      {m.operations.map((op) => (
                        <li
                          key={op}
                          className="rounded-lg bg-zinc-50 px-2 py-1 font-mono text-xs text-zinc-600"
                        >
                          {op}
                        </li>
                      ))}
                    </ul>
                    <p className="mt-3 text-sm font-semibold text-liqui-navy">
                      Custo acumulado:{' '}
                      {formatUsd(m.id === 'gemini' ? geminiCost : mistralCost)}
                    </p>
                  </div>
                </div>
              </section>
            ))}
          </div>
        )}
      </div>

      {userForm && (
        <CrmEntitySideOver
          title={
            userForm.mode === 'create' ? 'Novo usuário' : 'Editar usuário'
          }
          subtitle="Consultores e acessos · perfis da plataforma"
          isNew={userForm.mode === 'create'}
          saving={saving}
          onClose={() => setUserForm(null)}
          onSave={() => void saveUser()}
          onDelete={
            userForm.mode === 'edit'
              ? () => void deleteUser(false)
              : undefined
          }
        >
          <div className="space-y-3">
            <Field label="Nome" value={formName} onChange={setFormName} />
            {userForm.mode === 'create' && (
              <>
                <Field
                  label="E-mail"
                  value={formEmail}
                  onChange={setFormEmail}
                  type="email"
                />
                <Field
                  label="Senha inicial"
                  value={formPassword}
                  onChange={setFormPassword}
                  type="password"
                />
              </>
            )}
            {userForm.mode === 'edit' && (
              <p className="rounded-xl bg-zinc-50 px-3 py-2 text-xs text-zinc-500">
                {formEmail}
              </p>
            )}
            <label className="block text-sm font-semibold text-liqui-navy">
              Cargo
              <select
                value={formRole}
                onChange={(e) => setFormRole(e.target.value as ProfileRole)}
                className="mt-1.5 w-full rounded-xl border border-zinc-200 px-3 py-2.5 text-sm outline-none focus:border-liqui-orange"
              >
                <option value="consultor">Consultor (vendas)</option>
                <option value="owner">Owner (plataforma)</option>
              </select>
            </label>
            {userForm.mode === 'edit' && (
              <>
                <label className="flex items-center gap-2 text-sm font-semibold text-liqui-navy">
                  <input
                    type="checkbox"
                    checked={formActive}
                    onChange={(e) => setFormActive(e.target.checked)}
                    className="rounded border-zinc-300"
                  />
                  Conta ativa (libera acesso ao CRM)
                </label>
                <p className="text-xs text-zinc-500">
                  Sem esta opção marcada, o usuário fica em “Acesso pendente”
                  mesmo com e-mail confirmado.
                </p>
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => void deleteUser(true)}
                  className="w-full rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-600"
                >
                  Excluir permanentemente do Auth
                </button>
                <p className="text-[11px] text-zinc-400">
                  <strong>Excluir</strong> no rodapé desativa o acesso (soft
                  delete). Remoção permanente apaga o login.
                </p>
              </>
            )}
          </div>
        </CrmEntitySideOver>
      )}

      {jobDetail && (
        <SideOver
          title="Detalhe da indexação"
          subtitle={jobDetail.trigger_source}
          onClose={() => setJobDetail(null)}
          widthClass="max-w-md"
        >
          <dl className="space-y-3 text-sm">
            <Row label="Status" value={jobDetail.status} />
            <Row
              label="Início"
              value={formatDateTimeBr(jobDetail.started_at)}
            />
            <Row
              label="Fim"
              value={formatDateTimeBr(jobDetail.finished_at)}
            />
            <Row label="Indexados" value={String(jobDetail.embedded_count)} />
            <Row label="Ignorados" value={String(jobDetail.skipped_count)} />
            <Row label="Fontes" value={String(jobDetail.total_sources)} />
            <Row
              label="Custo estimado"
              value={formatUsd(Number(jobDetail.estimated_cost_usd || 0))}
            />
            {jobDetail.error_message && (
              <Row label="Erro" value={jobDetail.error_message} />
            )}
          </dl>
        </SideOver>
      )}
    </div>
  )
}

function MetricCard({
  label,
  value,
  hint,
  icon,
  llm,
  progress,
}: {
  label: string
  value: string
  hint: string
  icon?: typeof Database
  llm?: 'gemini' | 'mistral'
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
        {llm ? (
          <LlmIconBubble provider={llm} size="sm" />
        ) : icon ? (
          <IconBubble icon={icon} size="sm" tone="soft" />
        ) : null}
      </div>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-zinc-100">
        <div
          className="h-full rounded-full bg-liqui-orange transition-all"
          style={{ width: `${Math.max(4, Math.min(100, progress))}%` }}
        />
      </div>
      <p className="mt-2 text-[11px] text-zinc-400">{hint}</p>
    </div>
  )
}

function OpRow({
  label,
  value,
  max,
  pct,
}: {
  label: string
  value: string
  max: number
  pct?: number
}) {
  const width = pct ?? Math.min(100, (Number(value) / max) * 100 || 8)
  return (
    <div className="mb-3">
      <div className="mb-1 flex justify-between text-xs">
        <span className="text-white/70">{label}</span>
        <span className="font-bold">{value}</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full rounded-full bg-liqui-orange"
          style={{ width: `${Math.max(6, width)}%` }}
        />
      </div>
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[10px] font-bold uppercase text-zinc-400">{label}</dt>
      <dd className="mt-0.5 font-semibold text-liqui-navy">{value}</dd>
    </div>
  )
}
