import { useEffect, useMemo, useState } from 'react'
import { Plus, RefreshCw, Search, X } from 'lucide-react'
import { CrmEntitySideOver, Field } from '../components/ui/CrmEntitySideOver'
import {
  FilterSelect,
  matchesQuery,
  uniqueOptions,
} from '../components/ui/CrmFilters'
import { DataTable, type DataColumn } from '../components/ui/DataTable'
import { LeadAvatar } from '../components/ui/LeadAvatar'
import { useShellHeader } from '../layouts/ShellContext'
import {
  archiveResposta,
  createResposta,
  deleteResposta,
  emptyResposta,
  fetchRespostas,
  MOMENTOS_COMPRA,
  updateResposta,
  updateRespostaMomento,
} from '../lib/respostas'
import type { RespostaPesquisa } from '../lib/types'

function cell(v: unknown) {
  if (v == null || v === '') return '—'
  return String(v)
}

export function RespostasPage() {
  const { setHeader } = useShellHeader()
  const [rows, setRows] = useState<RespostaPesquisa[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [objecao, setObjecao] = useState('todas')
  const [area, setArea] = useState('todas')
  const [momento, setMomento] = useState('todos')
  const [nota, setNota] = useState('todas')
  const [vinculoLead, setVinculoLead] = useState('todos')
  const [view, setView] = useState<'kanban' | 'lista'>('kanban')
  const [draggingId, setDraggingId] = useState<number | null>(null)
  const [selected, setSelected] = useState<RespostaPesquisa | null>(null)
  const [isNew, setIsNew] = useState(false)
  const [saving, setSaving] = useState(false)

  async function loadAll() {
    setLoading(true)
    setError(null)
    try {
      setRows(await fetchRespostas())
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
      title: 'Respostas de pesquisa',
      subtitle: `${rows.length} registros`,
      actions: (
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setIsNew(true)
              setSelected(emptyResposta())
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

  const objecoes = useMemo(
    () => uniqueOptions(rows.map((r) => r.principal_objecao)),
    [rows],
  )
  const areas = useMemo(
    () => uniqueOptions(rows.map((r) => r.area_interesse)),
    [rows],
  )
  const momentos = useMemo(
    () => uniqueOptions(rows.map((r) => r.momento_compra)),
    [rows],
  )
  const notas = useMemo(
    () => uniqueOptions(rows.map((r) => r.nota_intencao)),
    [rows],
  )

  const hasActiveFilters =
    query.trim() !== '' ||
    objecao !== 'todas' ||
    area !== 'todas' ||
    momento !== 'todos' ||
    nota !== 'todas' ||
    vinculoLead !== 'todos'

  function clearFilters() {
    setQuery('')
    setObjecao('todas')
    setArea('todas')
    setMomento('todos')
    setNota('todas')
    setVinculoLead('todos')
  }

  const columns = useMemo(() => {
    const fromData = Array.from(
      new Set(rows.map((r) => r.momento_compra || 'sem momento')),
    )
    const ordered = [
      ...MOMENTOS_COMPRA.filter((s) => fromData.includes(s)),
      ...fromData.filter(
        (s) => !(MOMENTOS_COMPRA as readonly string[]).includes(s),
      ),
    ]
    return ordered.length ? ordered : [...MOMENTOS_COMPRA]
  }, [rows])

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (objecao !== 'todas' && r.principal_objecao !== objecao) return false
      if (area !== 'todas' && r.area_interesse !== area) return false
      if (momento !== 'todos' && (r.momento_compra || '') !== momento) {
        return false
      }
      if (nota === 'sem') {
        if (r.nota_intencao != null) return false
      } else if (nota !== 'todas' && String(r.nota_intencao) !== nota) {
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
          r.momento_compra,
          r.principal_objecao,
          r.area_interesse,
          r.nota_intencao,
          r.data_resposta,
          r.id_lead,
        ],
        query,
      )
    })
  }, [rows, query, objecao, area, momento, nota, vinculoLead])

  const tableColumns: DataColumn<RespostaPesquisa>[] = [
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
    { key: 'id', label: 'id', render: (r) => cell(r.id) },
    { key: 'email', label: 'email', render: (r) => cell(r.email) },
    { key: 'telefone', label: 'telefone', render: (r) => cell(r.telefone) },
    {
      key: 'momento_compra',
      label: 'momento_compra',
      render: (r) => cell(r.momento_compra),
    },
    {
      key: 'principal_objecao',
      label: 'principal_objecao',
      render: (r) => cell(r.principal_objecao),
    },
    {
      key: 'area_interesse',
      label: 'area_interesse',
      render: (r) => cell(r.area_interesse),
    },
    {
      key: 'nota_intencao',
      label: 'nota_intencao',
      render: (r) => cell(r.nota_intencao),
    },
    {
      key: 'data_resposta',
      label: 'data_resposta',
      render: (r) => cell(r.data_resposta),
    },
    { key: 'id_lead', label: 'id_lead', render: (r) => cell(r.id_lead) },
    {
      key: 'archived_at',
      label: 'archived_at',
      render: (r) => cell(r.archived_at),
    },
  ]

  async function moveCard(id: number, momento: string) {
    const current = rows.find((r) => r.id === id)
    if (!current || (current.momento_compra || 'sem momento') === momento) return
    const prev = current.momento_compra
    setRows((list) =>
      list.map((r) =>
        r.id === id ? { ...r, momento_compra: momento } : r,
      ),
    )
    try {
      await updateRespostaMomento(
        id,
        momento === 'sem momento' ? '' : momento,
      )
    } catch (err) {
      setRows((list) =>
        list.map((r) =>
          r.id === id ? { ...r, momento_compra: prev } : r,
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
        momento_compra: selected.momento_compra,
        principal_objecao: selected.principal_objecao,
        area_interesse: selected.area_interesse,
        nota_intencao: selected.nota_intencao,
        data_resposta: selected.data_resposta,
        id_lead: selected.id_lead,
      }
      if (isNew) await createResposta(payload)
      else await updateResposta(selected.id, payload)
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
    if (!confirm('Arquivar esta resposta?')) return
    setSaving(true)
    try {
      await archiveResposta(selected.id)
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
    if (!confirm('Excluir permanentemente esta resposta?')) return
    setSaving(true)
    try {
      await deleteResposta(selected.id)
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
            <button
              type="button"
              onClick={() => setView('kanban')}
              className={`rounded-full px-3 py-1.5 text-sm font-semibold ${
                view === 'kanban' ? 'bg-liqui-orange text-white' : 'text-zinc-600'
              }`}
            >
              Kanban
            </button>
            <button
              type="button"
              onClick={() => setView('lista')}
              className={`rounded-full px-3 py-1.5 text-sm font-semibold ${
                view === 'lista' ? 'bg-liqui-orange text-white' : 'text-zinc-600'
              }`}
            >
              Lista
            </button>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <FilterSelect
              value={momento}
              onChange={setMomento}
              allLabel="Todos momentos"
              options={momentos}
            />
            <FilterSelect
              value={objecao}
              onChange={setObjecao}
              allLabel="Todas objeções"
              allValue="todas"
              options={objecoes}
            />
            <FilterSelect
              value={area}
              onChange={setArea}
              allLabel="Todas áreas"
              allValue="todas"
              options={areas}
            />
            <select
              value={nota}
              onChange={(e) => setNota(e.target.value)}
              className="rounded-full border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-liqui-orange"
            >
              <option value="todas">Todas notas</option>
              <option value="sem">Sem nota</option>
              {notas.map((n) => (
                <option key={n} value={n}>
                  nota {n}
                </option>
              ))}
            </select>
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
                className="w-[220px] rounded-full border border-zinc-200 bg-white py-2 pl-9 pr-3 text-sm outline-none focus:border-liqui-orange"
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
                (r) => (r.momento_compra || 'sem momento') === col,
              )
              return (
                <section
                  key={col}
                  className="flex h-full w-[280px] shrink-0 flex-col rounded-2xl border border-zinc-200 bg-zinc-100/80"
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault()
                    const id = Number(e.dataTransfer.getData('text/resposta-id'))
                    if (id) void moveCard(id, col)
                    setDraggingId(null)
                  }}
                >
                  <header className="flex items-center justify-between px-3 py-3">
                    <h2 className="text-sm font-extrabold text-liqui-navy">{col}</h2>
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
                          e.dataTransfer.setData('text/resposta-id', String(r.id))
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
                              {r.area_interesse || '—'}
                            </p>
                          </div>
                        </div>
                        <div className="mt-2 flex flex-wrap gap-1">
                          <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-bold text-zinc-600">
                            {r.principal_objecao || 'objeção?'}
                          </span>
                          <span className="rounded-full bg-liqui-orange-soft px-2 py-0.5 text-[10px] font-bold text-liqui-navy">
                            nota {r.nota_intencao ?? '—'}
                          </span>
                        </div>
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
          title={isNew ? 'Nova resposta' : selected.nome}
          subtitle={isNew ? 'Criar registro' : `ID ${selected.id} · editar`}
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
              label="momento_compra"
              value={selected.momento_compra || ''}
              onChange={(v) =>
                setSelected({ ...selected, momento_compra: v || null })
              }
            />
            <Field
              label="principal_objecao"
              value={selected.principal_objecao || ''}
              onChange={(v) =>
                setSelected({ ...selected, principal_objecao: v || null })
              }
            />
            <Field
              label="area_interesse"
              value={selected.area_interesse || ''}
              onChange={(v) =>
                setSelected({ ...selected, area_interesse: v || null })
              }
            />
            <Field
              label="nota_intencao"
              value={String(selected.nota_intencao ?? '')}
              onChange={(v) =>
                setSelected({
                  ...selected,
                  nota_intencao: v === '' ? null : Number(v),
                })
              }
            />
            <Field
              label="data_resposta"
              value={selected.data_resposta || ''}
              onChange={(v) =>
                setSelected({ ...selected, data_resposta: v || null })
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
