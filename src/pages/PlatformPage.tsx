import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Cpu,
  Database,
  Play,
  Plus,
  RefreshCw,
  Search,
  Shield,
  UserCheck,
  UserMinus,
} from 'lucide-react'
import { DataTable, type DataColumn } from '../components/ui/DataTable'
import {
  DateRangePills,
  isWithinLastDays,
  type CadastroDays,
} from '../components/ui/DateRangePills'
import { IconBubble } from '../components/ui/IconBubble'
import { UuidBadge } from '../components/ui/IdBadge'
import { LlmIconBubble } from '../components/ui/LlmIcons'
import { SideOver } from '../components/ui/SideOver'
import { UserAccessSideOver } from '../components/platform/UserAccessSideOver'
import { useShellHeader } from '../layouts/ShellContext'
import { runEmbedCrmBatch } from '../lib/ai'
import { formatDateTimeBr } from '../lib/format'
import {
  DEFAULT_CONSULTOR_MENU_ACCESS,
  FULL_OWNER_MENU_ACCESS,
  normalizeMenuAccess,
  type MenuAccess,
  type MenuAccessKey,
} from '../lib/menuAccess'
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
type UserStatusFilter = 'todos' | 'pendente' | 'ativo'
type BulkAction = 'activate' | 'inactivate' | 'delete'

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

function RoleBadge({ role }: { role: string }) {
  if (role === 'owner') {
    return (
      <span className="rounded-full bg-liqui-navy px-2 py-0.5 text-[10px] font-bold uppercase text-white">
        {roleLabel(role)}
      </span>
    )
  }
  return (
    <span className="rounded-full bg-liqui-orange-soft px-2 py-0.5 text-[10px] font-bold uppercase text-liqui-navy">
      {roleLabel(role)}
    </span>
  )
}

export function PlatformPage() {
  const { setHeader } = useShellHeader()
  const [tab, setTab] = useState<MainTab>('usuarios')
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
  const [formRole, setFormRole] = useState<ProfileRole>('consultor')
  const [formActive, setFormActive] = useState(true)
  const [formMenu, setFormMenu] = useState<MenuAccess>({
    ...DEFAULT_CONSULTOR_MENU_ACCESS,
  })

  const [jobDetail, setJobDetail] = useState<EmbeddingJob | null>(null)

  const [userQuery, setUserQuery] = useState('')
  const [userDays, setUserDays] = useState<CadastroDays | null>(null)
  const [userStatus, setUserStatus] = useState<UserStatusFilter>('todos')
  const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(
    () => new Set(),
  )
  const [bulkWorking, setBulkWorking] = useState(false)

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
      setSelectedUserIds(new Set())
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

  const filteredProfiles = useMemo(() => {
    const q = userQuery.trim().toLowerCase()
    return profiles.filter((p) => {
      if (!isWithinLastDays(p.created_at, userDays)) return false
      const isActive = p.active !== false
      if (userStatus === 'pendente' && isActive) return false
      if (userStatus === 'ativo' && !isActive) return false
      if (!q) return true
      return (
        p.full_name.toLowerCase().includes(q) ||
        p.email.toLowerCase().includes(q) ||
        roleLabel(p.role).toLowerCase().includes(q)
      )
    })
  }, [profiles, userQuery, userDays, userStatus])

  const statusCounts = useMemo(() => {
    let pendente = 0
    let ativo = 0
    for (const p of profiles) {
      if (p.active === false) pendente += 1
      else ativo += 1
    }
    return { todos: profiles.length, pendente, ativo }
  }, [profiles])

  const allFilteredSelected =
    filteredProfiles.length > 0 &&
    filteredProfiles.every((p) => selectedUserIds.has(p.id))

  function toggleUserSelected(id: string) {
    setSelectedUserIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleAllFilteredUsers() {
    setSelectedUserIds((prev) => {
      const next = new Set(prev)
      if (allFilteredSelected) {
        for (const p of filteredProfiles) next.delete(p.id)
      } else {
        for (const p of filteredProfiles) next.add(p.id)
      }
      return next
    })
  }

  async function applyBulkAction(action: BulkAction) {
    const ids = [...selectedUserIds]
    if (ids.length === 0) {
      setError('Selecione ao menos um usuário.')
      return
    }
    setBulkWorking(true)
    setError(null)
    try {
      const results = await Promise.allSettled(
        ids.map((user_id) => {
          if (action === 'activate') {
            return manageUser({ action: 'update', user_id, active: true })
          }
          if (action === 'inactivate') {
            return manageUser({ action: 'update', user_id, active: false })
          }
          return manageUser({ action: 'delete', user_id, hard: false })
        }),
      )
      const ok = results.filter((r) => r.status === 'fulfilled').length
      const fail = results.length - ok
      const label =
        action === 'activate'
          ? 'ativado(s)'
          : action === 'inactivate'
            ? 'inativado(s)'
            : 'desativado(s)'
      setFlash(
        fail
          ? `${ok} ${label}, ${fail} falha(s).`
          : `${ok} usuário(s) ${label}.`,
      )
      setSelectedUserIds(new Set())
      await load()
      setTimeout(() => setFlash(null), 3500)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha na ação em massa')
    } finally {
      setBulkWorking(false)
    }
  }

  async function setProfileActive(p: Profile, active: boolean) {
    setSaving(true)
    setError(null)
    try {
      await manageUser({ action: 'update', user_id: p.id, active })
      setFlash(active ? `${p.full_name} ativado` : `${p.full_name} inativado`)
      await load()
      setTimeout(() => setFlash(null), 2500)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao atualizar status')
    } finally {
      setSaving(false)
    }
  }

  async function softDeleteProfile(p: Profile) {
    if (!window.confirm(`Desativar acesso de ${p.full_name || p.email}?`)) return
    setSaving(true)
    setError(null)
    try {
      await manageUser({ action: 'delete', user_id: p.id, hard: false })
      setFlash(`${p.full_name || p.email} desativado`)
      await load()
      setTimeout(() => setFlash(null), 2500)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao desativar')
    } finally {
      setSaving(false)
    }
  }

  function openCreateUser() {
    setFormName('')
    setFormEmail('')
    setFormRole('consultor')
    setFormActive(true)
    setFormMenu({ ...DEFAULT_CONSULTOR_MENU_ACCESS })
    setUserForm({ mode: 'create' })
  }

  function openEditUser(p: Profile) {
    setFormName(p.full_name || '')
    setFormEmail(p.email || '')
    setFormRole((p.role as ProfileRole) || 'consultor')
    setFormActive(p.active !== false)
    setFormMenu(
      normalizeMenuAccess(
        p.menu_access,
        (p.role as ProfileRole) || 'consultor',
      ),
    )
    setUserForm({ mode: 'edit', profile: p })
  }

  function patchMenu(key: MenuAccessKey, value: boolean) {
    setFormMenu((prev) => {
      const next = { ...prev, [key]: value }
      if (key === 'plataforma') next.plataforma = false
      return next
    })
  }

  async function saveUser() {
    if (!userForm) return
    setSaving(true)
    setError(null)
    try {
      const menu =
        formRole === 'owner'
          ? FULL_OWNER_MENU_ACCESS
          : { ...formMenu, plataforma: false }

      if (userForm.mode === 'create') {
        await manageUser({
          action: 'create',
          email: formEmail,
          full_name: formName,
          role: formRole,
          menu_access: menu,
        })
        setFlash('Usuário criado (pendente) — ative quando for aprovar')
      } else if (userForm.profile) {
        await manageUser({
          action: 'update',
          user_id: userForm.profile.id,
          full_name: formName,
          role: formRole,
          active: formActive,
          menu_access: menu,
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
      key: 'sel',
      className: 'w-10',
      label: (
        <input
          type="checkbox"
          checked={allFilteredSelected}
          onChange={toggleAllFilteredUsers}
          aria-label="Selecionar todos filtrados"
          className="h-4 w-4 rounded border-zinc-300"
        />
      ),
      render: (r) => (
        <input
          type="checkbox"
          checked={selectedUserIds.has(r.id)}
          onClick={(e) => e.stopPropagation()}
          onChange={() => toggleUserSelected(r.id)}
          aria-label={`Selecionar ${r.full_name || r.email}`}
          className="h-4 w-4 rounded border-zinc-300"
        />
      ),
    },
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
      render: (r) => <RoleBadge role={r.role} />,
    },
    {
      key: 'active',
      label: 'Status',
      render: (r) =>
        r.active === false ? (
          <span className="text-xs font-semibold text-amber-700">Pendente</span>
        ) : (
          <span className="text-xs font-semibold text-liqui-navy">Ativo</span>
        ),
    },
    {
      key: 'created_at',
      label: 'Criado',
      render: (r) => formatDateTimeBr(r.created_at),
    },
    {
      key: 'acoes',
      label: 'Ações',
      render: (r) => (
        <div
          className="flex flex-wrap gap-1"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            onClick={() => openEditUser(r)}
            className="rounded-lg border border-zinc-200 px-2 py-1 text-[11px] font-semibold text-zinc-600 hover:bg-zinc-50"
          >
            Editar
          </button>
          {r.active === false ? (
            <button
              type="button"
              disabled={saving}
              onClick={() => void setProfileActive(r, true)}
              className="rounded-lg bg-liqui-navy px-2 py-1 text-[11px] font-bold text-white disabled:opacity-50"
            >
              Ativar
            </button>
          ) : (
            <button
              type="button"
              disabled={saving}
              onClick={() => void setProfileActive(r, false)}
              className="rounded-lg border border-amber-200 bg-amber-50 px-2 py-1 text-[11px] font-semibold text-amber-800 disabled:opacity-50"
            >
              Inativar
            </button>
          )}
          <button
            type="button"
            disabled={saving}
            onClick={() => void softDeleteProfile(r)}
            className="rounded-lg border border-red-200 bg-red-50 px-2 py-1 text-[11px] font-semibold text-red-600 disabled:opacity-50"
          >
            Excluir
          </button>
        </div>
      ),
    },
  ]

  const tabs: { id: MainTab; label: string }[] = [
    { id: 'visao', label: 'Visão geral' },
    { id: 'usuarios', label: 'Usuários' },
    { id: 'indexacoes', label: 'Indexações' },
    { id: 'modelos', label: 'Modelos' },
  ]

  const usersFiltersBar = (
    <div className="flex shrink-0 flex-wrap items-center gap-2">
      <div className="relative">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-400" />
        <input
          value={userQuery}
          onChange={(e) => setUserQuery(e.target.value)}
          placeholder="Buscar nome ou e-mail…"
          className="w-[200px] rounded-full border border-zinc-200 bg-white py-1.5 pl-8 pr-3 text-xs outline-none focus:border-liqui-orange lg:w-[240px]"
        />
      </div>
      <div className="inline-flex rounded-full bg-zinc-200/70 p-0.5">
        {(
          [
            { id: 'todos' as const, label: 'Todos' },
            { id: 'pendente' as const, label: 'Pendentes' },
            { id: 'ativo' as const, label: 'Ativos' },
          ] as const
        ).map((opt) => (
          <button
            key={opt.id}
            type="button"
            onClick={() => setUserStatus(opt.id)}
            className={`rounded-full px-2.5 py-1.5 text-xs font-semibold transition ${
              userStatus === opt.id
                ? 'bg-white text-liqui-navy shadow-sm'
                : 'text-zinc-600 hover:text-liqui-navy'
            }`}
          >
            {opt.label} ({statusCounts[opt.id]})
          </button>
        ))}
      </div>
      <DateRangePills value={userDays} onChange={setUserDays} />
      <span className="text-xs text-zinc-500">
        {selectedUserIds.size} selecionado(s) · {filteredProfiles.length} na
        lista
      </span>
    </div>
  )

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
            {tab === 'usuarios' && (
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
              <>
                <div className="flex rounded-xl bg-white p-1 shadow-sm ring-1 ring-zinc-200">
                  <button
                    type="button"
                    disabled={bulkWorking || selectedUserIds.size === 0}
                    onClick={() => void applyBulkAction('activate')}
                    className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold text-liqui-navy disabled:opacity-40 hover:bg-zinc-50"
                    title="Ativar selecionados"
                  >
                    <UserCheck className="h-3.5 w-3.5 text-liqui-orange" />
                    Ativar
                    {selectedUserIds.size > 0
                      ? ` (${selectedUserIds.size})`
                      : ''}
                  </button>
                  <button
                    type="button"
                    disabled={bulkWorking || selectedUserIds.size === 0}
                    onClick={() => void applyBulkAction('inactivate')}
                    className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold text-liqui-navy disabled:opacity-40 hover:bg-zinc-50"
                    title="Inativar selecionados"
                  >
                    <UserMinus className="h-3.5 w-3.5 text-liqui-orange" />
                    Inativar
                    {selectedUserIds.size > 0
                      ? ` (${selectedUserIds.size})`
                      : ''}
                  </button>
                </div>
                <button
                  type="button"
                  onClick={openCreateUser}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-liqui-navy px-3 py-2 text-sm font-bold text-white"
                >
                  <Plus className="h-4 w-4 text-liqui-orange" />
                  Conta excepcional
                </button>
              </>
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
        {tab === 'visao' && (
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
                pct={Math.min(100, (geminiCost + mistralCost) * 200)}
              />
              <button
                type="button"
                onClick={() => {
                  setTab('usuarios')
                  setView('tabela')
                }}
                className="mt-3 w-full rounded-xl bg-white/10 px-3 py-2 text-sm font-bold text-white hover:bg-white/15"
              >
                Ir para gerenciamento de usuários
              </button>
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
        )}

        {tab === 'usuarios' && (
          <div className="flex h-full min-h-[360px] flex-col gap-3">
            <p className="text-sm text-zinc-500">
              Consultores se cadastram sozinhos (e-mail/senha). Aqui o owner{' '}
              <strong>aprova</strong>, define <strong>menus</strong> e pode
              inativar/excluir.
            </p>
            {usersFiltersBar}
            {view === 'tabela' ? (
              <div className="min-h-0 flex-1">
                <DataTable
                  columns={userColumns}
                  rows={filteredProfiles}
                  rowKey={(r) => r.id}
                  onRowClick={openEditUser}
                  rowClassName={(r) =>
                    r.role === 'owner' ? 'bg-violet-50 hover:bg-violet-100/80' : undefined
                  }
                  emptyMessage={
                    loading
                      ? 'Carregando…'
                      : userStatus === 'ativo'
                        ? 'Nenhum usuário ativo. Vá em Pendentes, selecione e clique Ativar.'
                        : userStatus === 'pendente'
                          ? 'Nenhum cadastro pendente.'
                          : 'Nenhum usuário no filtro'
                  }
                />
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {filteredProfiles.map((p) => (
                  <div
                    key={p.id}
                    className={`rounded-2xl border p-4 text-left shadow-sm transition hover:border-liqui-orange/40 ${
                      p.role === 'owner'
                        ? 'border-violet-200 bg-violet-50'
                        : 'border-zinc-200 bg-white'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <input
                        type="checkbox"
                        checked={selectedUserIds.has(p.id)}
                        onChange={() => toggleUserSelected(p.id)}
                        aria-label={`Selecionar ${p.full_name || p.email}`}
                        className="mt-1 h-4 w-4 rounded border-zinc-300"
                      />
                      <button
                        type="button"
                        onClick={() => openEditUser(p)}
                        className="flex min-w-0 flex-1 items-start gap-3 text-left"
                      >
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-liqui-navy text-xs font-bold text-white">
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
                            <RoleBadge role={p.role} />
                            {p.active === false ? (
                              <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold uppercase text-amber-700">
                                Pendente
                              </span>
                            ) : (
                              <span className="rounded-full bg-liqui-navy/10 px-2 py-0.5 text-[10px] font-bold uppercase text-liqui-navy">
                                Ativo
                              </span>
                            )}
                          </div>
                        </div>
                      </button>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-1 border-t border-zinc-100 pt-3">
                      {p.active === false ? (
                        <button
                          type="button"
                          onClick={() => void setProfileActive(p, true)}
                          className="rounded-lg bg-liqui-navy px-2 py-1 text-[11px] font-bold text-white"
                        >
                          Ativar
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => void setProfileActive(p, false)}
                          className="rounded-lg border border-amber-200 bg-amber-50 px-2 py-1 text-[11px] font-semibold text-amber-800"
                        >
                          Inativar
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => openEditUser(p)}
                        className="rounded-lg border border-zinc-200 px-2 py-1 text-[11px] font-semibold text-zinc-600"
                      >
                        Editar
                      </button>
                      <button
                        type="button"
                        onClick={() => void softDeleteProfile(p)}
                        className="rounded-lg border border-red-200 bg-red-50 px-2 py-1 text-[11px] font-semibold text-red-600"
                      >
                        Excluir
                      </button>
                    </div>
                  </div>
                ))}
                {filteredProfiles.length === 0 && !loading && (
                  <p className="text-sm text-zinc-400">
                    Nenhum perfil no filtro.
                  </p>
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
        <UserAccessSideOver
          mode={userForm.mode}
          title={
            userForm.mode === 'create' ? 'Novo usuário' : 'Gerenciar acesso'
          }
          email={formEmail}
          name={formName}
          role={formRole}
          active={formActive}
          menuAccess={formMenu}
          saving={saving}
          onClose={() => setUserForm(null)}
          onSave={() => void saveUser()}
          onDeleteSoft={
            userForm.mode === 'edit'
              ? () => void deleteUser(false)
              : undefined
          }
          onHardDelete={
            userForm.mode === 'edit'
              ? () => void deleteUser(true)
              : undefined
          }
          onChangeName={setFormName}
          onChangeEmail={
            userForm.mode === 'create' ? setFormEmail : undefined
          }
          onChangeRole={(role) => {
            setFormRole(role)
            setFormMenu(
              role === 'owner'
                ? { ...FULL_OWNER_MENU_ACCESS }
                : { ...DEFAULT_CONSULTOR_MENU_ACCESS },
            )
          }}
          onChangeActive={setFormActive}
          onChangeMenu={patchMenu}
          onActivateNow={
            userForm.profile
              ? () => {
                  void (async () => {
                    if (!userForm.profile) return
                    setSaving(true)
                    setError(null)
                    try {
                      const menu =
                        formRole === 'owner'
                          ? FULL_OWNER_MENU_ACCESS
                          : { ...formMenu, plataforma: false }
                      await manageUser({
                        action: 'update',
                        user_id: userForm.profile.id,
                        full_name: formName,
                        role: formRole,
                        active: true,
                        menu_access: menu,
                      })
                      setFlash(`${formName || formEmail} ativado`)
                      setUserForm(null)
                      await load()
                    } catch (err) {
                      setError(
                        err instanceof Error
                          ? err.message
                          : 'Falha ao ativar',
                      )
                    } finally {
                      setSaving(false)
                    }
                  })()
                }
              : undefined
          }
          onInactivateNow={
            userForm.profile
              ? () => {
                  void (async () => {
                    if (!userForm.profile) return
                    setSaving(true)
                    setError(null)
                    try {
                      await manageUser({
                        action: 'update',
                        user_id: userForm.profile.id,
                        active: false,
                      })
                      setFlash(`${formName || formEmail} inativado`)
                      setUserForm(null)
                      await load()
                    } catch (err) {
                      setError(
                        err instanceof Error
                          ? err.message
                          : 'Falha ao inativar',
                      )
                    } finally {
                      setSaving(false)
                    }
                  })()
                }
              : undefined
          }
        />
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
