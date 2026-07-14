import { useEffect, useMemo, useState } from 'react'
import { Plus, RefreshCw, Search, X } from 'lucide-react'
import { CrmEntitySideOver, Field } from '../components/ui/CrmEntitySideOver'
import {
  FilterSelect,
  matchesQuery,
  uniqueOptions,
} from '../components/ui/CrmFilters'
import { DataTable, type DataColumn } from '../components/ui/DataTable'
import { LeadIdBadge, UuidBadge } from '../components/ui/IdBadge'
import { LeadAvatar } from '../components/ui/LeadAvatar'
import { useShellHeader } from '../layouts/ShellContext'
import { formatCellValue } from '../lib/format'
import {
  archiveTentativa,
  createTentativa,
  deleteTentativa,
  emptyTentativa,
  fetchTentativas,
  TENTATIVA_STATUSES,
  updateTentativa,
  updateTentativaStatus,
} from '../lib/tentativas'
import type { TentativaCompra } from '../lib/types'

function money(v: number | null) {
  return Number(v ?? 0).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  })
}

function cell(v: unknown, key?: string) {
  return formatCellValue(v, key)
}

export function TentativasPage() {
  const { setHeader } = useShellHeader()
  const [rows, setRows] = useState<TentativaCompra[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [produto, setProduto] = useState('todos')
  const [statusPagamento, setStatusPagamento] = useState('todos')
  const [formaPagamento, setFormaPagamento] = useState('todos')
  const [vinculoLead, setVinculoLead] = useState('todos')
  const [view, setView] = useState<'kanban' | 'lista'>('kanban')
  const [draggingId, setDraggingId] = useState<number | null>(null)
  const [selected, setSelected] = useState<TentativaCompra | null>(null)
  const [isNew, setIsNew] = useState(false)
  const [saving, setSaving] = useState(false)

  async function loadAll() {
    setLoading(true)
    setError(null)
    try {
      setRows(await fetchTentativas())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao carregar')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadAll()
  }, [])

  useEffect(() => {
    setHeader({
      title: 'Tentativas de compra',
      subtitle: `${rows.length} registros`,
      actions: (
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setIsNew(true)
              setSelected(emptyTentativa())
            }}
            className="inline-flex items-center gap-2 rounded-xl bg-liqui-orange px-3 py-2 text-sm font-bold text-white"
          >
            <Plus className="h-4 w-4" /> Nova
          </button>
          <button
            type="button"
            onClick={() => void loadAll()}
            className="inline-flex items-center gap-2 rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm font-semibold"
          >
            <RefreshCw className="h-4 w-4" /> Atualizar
          </button>
        </div>
      ),
    })
  }, [rows.length, setHeader])

  const produtos = useMemo(
    () => uniqueOptions(rows.map((r) => r.produto)),
    [rows],
  )
  const statusOptions = useMemo(
    () => uniqueOptions(rows.map((r) => r.status_pagamento)),
    [rows],
  )
  const formas = useMemo(
    () => uniqueOptions(rows.map((r) => r.forma_pagamento)),
    [rows],
  )

  const hasActiveFilters =
    query.trim() !== '' ||
    produto !== 'todos' ||
    statusPagamento !== 'todos' ||
    formaPagamento !== 'todos' ||
    vinculoLead !== 'todos'

  function clearFilters() {
    setQuery('')
    setProduto('todos')
    setStatusPagamento('todos')
    setFormaPagamento('todos')
    setVinculoLead('todos')
  }

  const columns = useMemo(() => {
    const fromData = Array.from(
      new Set(rows.map((r) => r.status_pagamento || 'sem status')),
    )
    const ordered = [
      ...TENTATIVA_STATUSES.filter((s) => fromData.includes(s)),
      ...fromData.filter(
        (s) => !(TENTATIVA_STATUSES as readonly string[]).includes(s),
      ),
    ]
    return ordered.length ? ordered : [...TENTATIVA_STATUSES]
  }, [rows])

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (produto !== 'todos' && r.produto !== produto) return false
      if (
        statusPagamento !== 'todos' &&
        (r.status_pagamento || '') !== statusPagamento
      ) {
        return false
      }
      if (
        formaPagamento !== 'todos' &&
        (r.forma_pagamento || '') !== formaPagamento
      ) {
        return false
      }
      if (vinculoLead === 'com' && r.id_lead == null) return false
      if (vinculoLead === 'sem' && r.id_lead != null) return false
      return matchesQuery(
        [
          r.id,
          r.nome,
          r.email,
          r.telefone,
          r.produto,
          r.valor,
          r.forma_pagamento,
          r.status_pagamento,
          r.data_tentativa,
          r.id_lead,
        ],
        query,
      )
    })
  }, [
    rows,
    query,
    produto,
    statusPagamento,
    formaPagamento,
    vinculoLead,
  ])

  const tableColumns: DataColumn<TentativaCompra>[] = [
    {
      key: 'nome',
      label: 'nome',
      render: (r) => (
        <div className="flex items-center gap-2">
          <LeadAvatar name={r.nome || '?'} size="sm" />
          <span className="font-semibold text-liqui-navy">{r.nome}</span>
        </div>
      ),
    },
    { key: 'id', label: 'id', render: (r) => <UuidBadge value={r.id} hint="id" /> },
    { key: 'email', label: 'email', render: (r) => cell(r.email) },
    { key: 'telefone', label: 'telefone', render: (r) => cell(r.telefone) },
    { key: 'produto', label: 'produto', render: (r) => cell(r.produto) },
    { key: 'valor', label: 'valor', render: (r) => money(r.valor) },
    {
      key: 'forma_pagamento',
      label: 'forma_pagamento',
      render: (r) => cell(r.forma_pagamento),
    },
    {
      key: 'status_pagamento',
      label: 'status_pagamento',
      render: (r) => cell(r.status_pagamento),
    },
    {
      key: 'data_tentativa',
      label: 'data_tentativa',
      render: (r) => cell(r.data_tentativa, 'data_tentativa'),
    },
    {
      key: 'id_lead',
      label: 'id_lead',
      render: (r) => <LeadIdBadge id={r.id_lead} />,
    },
    {
      key: 'archived_at',
      label: 'archived_at',
      render: (r) => cell(r.archived_at, 'archived_at'),
    },
  ]

  async function moveCard(id: number, status: string) {
    const current = rows.find((r) => r.id === id)
    if (!current || (current.status_pagamento || 'sem status') === status) return
    const prev = current.status_pagamento
    setRows((list) =>
      list.map((r) =>
        r.id === id ? { ...r, status_pagamento: status } : r,
      ),
    )
    try {
      await updateTentativaStatus(id, status === 'sem status' ? '' : status)
    } catch (err) {
      setRows((list) =>
        list.map((r) =>
          r.id === id ? { ...r, status_pagamento: prev } : r,
        ),
      )
      setError(err instanceof Error ? err.message : 'Falha ao mover')
    }
  }

  async function saveSelected() {
    if (!selected) return
    if (!selected.nome.trim()) {
      setError('Nome é obrigatório')
      return
    }
    setSaving(true)
    setError(null)
    try {
      const payload = {
        nome: selected.nome.trim(),
        email: selected.email,
        telefone: selected.telefone,
        produto: selected.produto,
        valor: selected.valor,
        forma_pagamento: selected.forma_pagamento,
        status_pagamento: selected.status_pagamento,
        data_tentativa: selected.data_tentativa,
        id_lead: selected.id_lead,
      }
      if (isNew) await createTentativa(payload)
      else await updateTentativa(selected.id, payload)
      setSelected(null)
      setIsNew(false)
      await loadAll()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao salvar')
    } finally {
      setSaving(false)
    }
  }

  async function handleArchive() {
    if (!selected || isNew) return
    if (!confirm('Arquivar esta tentativa?')) return
    setSaving(true)
    try {
      await archiveTentativa(selected.id)
      setSelected(null)
      await loadAll()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao arquivar')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!selected || isNew) return
    if (!confirm('Excluir permanentemente esta tentativa?')) return
    setSaving(true)
    try {
      await deleteTentativa(selected.id)
      setSelected(null)
      await loadAll()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao excluir')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="shrink-0 space-y-3 border-b border-zinc-200 bg-[#f3f4f6] px-5 pb-3 pt-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="inline-flex rounded-full bg-white p-1 shadow-sm">
            <Toggle active={view === 'kanban'} onClick={() => setView('kanban')}>
              Kanban
            </Toggle>
            <Toggle active={view === 'lista'} onClick={() => setView('lista')}>
              Lista
            </Toggle>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <FilterSelect
              value={produto}
              onChange={setProduto}
              allLabel="Todos produtos"
              options={produtos}
            />
            <FilterSelect
              value={statusPagamento}
              onChange={setStatusPagamento}
              allLabel="Todos status"
              options={statusOptions}
            />
            <FilterSelect
              value={formaPagamento}
              onChange={setFormaPagamento}
              allLabel="Todas formas"
              options={formas}
            />
            <select
              value={vinculoLead}
              onChange={(e) => setVinculoLead(e.target.value)}
              className="rounded-full border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-liqui-orange"
            >
              <option value="todos">Lead: todos</option>
              <option value="com">Com id_lead</option>
              <option value="sem">Sem id_lead</option>
            </select>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar em todas as colunas…"
                className="w-[240px] rounded-full border border-zinc-200 bg-white py-2 pl-9 pr-3 text-sm outline-none focus:border-liqui-orange"
              />
            </div>
            {hasActiveFilters && (
              <button
                type="button"
                onClick={clearFilters}
                className="inline-flex items-center gap-1 rounded-full border border-zinc-200 bg-white px-3 py-2 text-sm font-semibold text-zinc-600"
              >
                <X className="h-3.5 w-3.5" /> Limpar
              </button>
            )}
          </div>
        </div>
        {error && (
          <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-hidden px-5 py-4">
        {loading ? (
          <p className="text-sm text-zinc-500">Carregando…</p>
        ) : view === 'lista' ? (
          <DataTable
            columns={tableColumns}
            rows={filtered}
            rowKey={(r) => r.id}
            onRowClick={(r) => {
              setIsNew(false)
              setSelected(r)
            }}
          />
        ) : (
          <div className="flex h-full gap-3 overflow-x-auto pb-1">
            {columns.map((col) => {
              const cards = filtered.filter(
                (r) => (r.status_pagamento || 'sem status') === col,
              )
              return (
                <section
                  key={col}
                  className="flex h-full w-[280px] shrink-0 flex-col rounded-2xl border border-zinc-200 bg-zinc-100/80"
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault()
                    const id = Number(e.dataTransfer.getData('text/tentativa-id'))
                    if (id) void moveCard(id, col)
                    setDraggingId(null)
                  }}
                >
                  <header className="flex items-center justify-between px-3 py-3">
                    <h2 className="text-sm font-extrabold capitalize text-liqui-navy">
                      {col}
                    </h2>
                    <span className="rounded-full bg-white px-2 text-xs font-bold text-zinc-500">
                      {cards.length}
                    </span>
                  </header>
                  <div className="min-h-0 flex-1 space-y-2 overflow-y-auto px-2 pb-3">
                    {cards.map((r) => (
                      <article
                        key={r.id}
                        draggable
                        onDragStart={(e) => {
                          e.dataTransfer.setData('text/tentativa-id', String(r.id))
                          setDraggingId(r.id)
                        }}
                        onDragEnd={() => setDraggingId(null)}
                        onClick={() => {
                          setIsNew(false)
                          setSelected(r)
                        }}
                        className={`cursor-grab rounded-2xl border border-zinc-200 bg-white p-3 shadow-sm ${
                          draggingId === r.id ? 'opacity-50' : ''
                        }`}
                      >
                        <div className="flex items-start gap-2">
                          <LeadAvatar name={r.nome} size="sm" />
                          <div className="min-w-0">
                            <p className="truncate text-sm font-bold text-liqui-navy">
                              {r.nome}
                            </p>
                            <p className="text-[11px] text-zinc-400">
                              {r.produto || '—'}
                            </p>
                          </div>
                        </div>
                        <p className="mt-2 text-sm font-extrabold text-liqui-navy">
                          {money(r.valor)}
                        </p>
                        <p className="mt-1 text-[11px] text-zinc-400">
                          {r.forma_pagamento || '—'} ·{' '}
                          {formatCellValue(r.data_tentativa, 'data_tentativa')}
                        </p>
                      </article>
                    ))}
                  </div>
                </section>
              )
            })}
          </div>
        )}
      </div>

      {selected && (
        <CrmEntitySideOver
          title={isNew ? 'Nova tentativa' : selected.nome}
          subtitle={
            isNew ? (
              'Criar registro'
            ) : (
              <span className="inline-flex items-center gap-1.5">
                <UuidBadge value={selected.id} hint="id" />
                <span>editar</span>
              </span>
            )
          }
          onClose={() => {
            setSelected(null)
            setIsNew(false)
          }}
          onSave={() => void saveSelected()}
          onArchive={isNew ? undefined : () => void handleArchive()}
          onDelete={isNew ? undefined : () => void handleDelete()}
          saving={saving}
          isNew={isNew}
        >
          <div className="space-y-3">
            <Field
              label="nome"
              value={selected.nome}
              onChange={(v) => setSelected({ ...selected, nome: v })}
            />
            <Field
              label="email"
              value={selected.email || ''}
              onChange={(v) => setSelected({ ...selected, email: v || null })}
            />
            <Field
              label="telefone"
              value={selected.telefone || ''}
              onChange={(v) => setSelected({ ...selected, telefone: v || null })}
            />
            <Field
              label="produto"
              value={selected.produto || ''}
              onChange={(v) => setSelected({ ...selected, produto: v || null })}
            />
            <Field
              label="valor"
              value={String(selected.valor ?? '')}
              onChange={(v) =>
                setSelected({
                  ...selected,
                  valor: v === '' ? null : Number(v.replace(',', '.')) || 0,
                })
              }
            />
            <Field
              label="forma_pagamento"
              value={selected.forma_pagamento || ''}
              onChange={(v) =>
                setSelected({ ...selected, forma_pagamento: v || null })
              }
            />
            <Field
              label="status_pagamento"
              value={selected.status_pagamento || ''}
              onChange={(v) =>
                setSelected({ ...selected, status_pagamento: v || null })
              }
            />
            <Field
              label="data_tentativa"
              value={selected.data_tentativa || ''}
              onChange={(v) =>
                setSelected({ ...selected, data_tentativa: v || null })
              }
            />
            <Field
              label="id_lead"
              value={selected.id_lead == null ? '' : String(selected.id_lead)}
              onChange={(v) =>
                setSelected({
                  ...selected,
                  id_lead: v === '' ? null : Number(v) || null,
                })
              }
            />
          </div>
        </CrmEntitySideOver>
      )}
    </div>
  )
}

function Toggle({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-3 py-1.5 text-sm font-semibold ${
        active ? 'bg-liqui-orange text-white' : 'text-zinc-600'
      }`}
    >
      {children}
    </button>
  )
}
