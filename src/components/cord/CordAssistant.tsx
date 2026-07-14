import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Bot,
  Eraser,
  History,
  Loader2,
  MessageSquare,
  Plus,
  Send,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { sendCordMessage, type CordPendingAction } from '../../lib/cord'
import { emitCrmChanged } from '../../lib/crmEvents'
import { MistralIcon } from '../ui/LlmIcons'
import {
  cordWelcomeMessage,
  createCordThread,
  deleteCordThread,
  loadCordThreads,
  upsertCordThread,
  type CordThread,
} from '../../lib/cordHistory'

type Tab = 'chat' | 'history'

/**
 * CORD — balão flutuante canto inferior direito (owner only).
 * Chat + limpar + histórico local; memória longa via Mem0 no Edge.
 */
export function CordAssistant() {
  const { isOwner, loading, user } = useAuth()
  const userId = user?.id || ''

  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState<Tab>('chat')
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [thread, setThread] = useState<CordThread>(() => createCordThread())
  const [threads, setThreads] = useState<CordThread[]>([])
  const [proposeRedistribute, setProposeRedistribute] = useState(false)
  const [pendingAction, setPendingAction] = useState<CordPendingAction | null>(
    null,
  )
  const [semConsultor, setSemConsultor] = useState(0)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!userId) return
    const list = loadCordThreads(userId)
    setThreads(list)
    if (list[0]) setThread(list[0])
  }, [userId])

  useEffect(() => {
    if (open && tab === 'chat') {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [thread.messages, open, busy, tab])

  const messages = thread.messages

  const chips = useMemo(
    () => [
      'Como está o funil agora?',
      'Resumo dos consultores',
      'Qual a receita prevista do pipeline?',
      'Há leads sem consultor?',
      'Insights gerais da base',
      'Como desatribuir ou transferir leads?',
    ],
    [],
  )

  function persist(next: CordThread) {
    setThread(next)
    if (!userId) return
    setThreads(upsertCordThread(userId, next))
  }

  function clearConversation() {
    const cleared: CordThread = {
      ...thread,
      messages: [cordWelcomeMessage()],
      title: 'Nova conversa',
      updatedAt: Date.now(),
    }
    setProposeRedistribute(false)
    setPendingAction(null)
    setError(null)
    persist(cleared)
  }

  function newConversation() {
    const fresh = createCordThread()
    setProposeRedistribute(false)
    setPendingAction(null)
    setError(null)
    setTab('chat')
    persist(fresh)
  }

  function openThread(t: CordThread) {
    setThread(t)
    setTab('chat')
    setError(null)
    setProposeRedistribute(false)
    setPendingAction(null)
  }

  function removeThread(id: string) {
    if (!userId) return
    const next = deleteCordThread(userId, id)
    setThreads(next)
    if (thread.id === id) {
      const fresh = createCordThread()
      setThread(fresh)
      upsertCordThread(userId, fresh)
      setThreads(loadCordThreads(userId))
    }
  }

  async function run(
    message: string,
    opts?: { confirmAction?: CordPendingAction | null; confirmRedistribute?: boolean },
  ) {
    const trimmed = message.trim()
    const confirming = Boolean(opts?.confirmAction || opts?.confirmRedistribute)
    if ((!trimmed && !confirming) || busy) return

    setBusy(true)
    setError(null)

    let working = thread
    if (trimmed) {
      working = {
        ...thread,
        messages: [...thread.messages, { role: 'user', content: trimmed }],
      }
      setThread(working)
      setInput('')
    }

    try {
      const history = working.messages.filter(
        (m) => m.role === 'user' || m.role === 'assistant',
      )
      const res = await sendCordMessage({
        message:
          trimmed ||
          (confirming ? 'Aprovar alteração crítica' : ''),
        history,
        confirmRedistribute: opts?.confirmRedistribute,
        confirmAction: opts?.confirmAction,
        threadId: working.id,
      })
      const withReply: CordThread = {
        ...working,
        messages: [
          ...working.messages,
          { role: 'assistant', content: res.reply },
        ],
      }
      persist(withReply)
      setPendingAction(res.pending_action || null)
      setProposeRedistribute(
        Boolean(res.propose_redistribute) && !res.pending_action,
      )
      setSemConsultor(Number(res.sem_consultor || 0))
      if (confirming) {
        setPendingAction(null)
        setProposeRedistribute(false)
        emitCrmChanged({ source: 'cord', reason: 'critical-action' })
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha no CORD')
      if (trimmed) persist(working)
    } finally {
      setBusy(false)
    }
  }

  function rejectPending() {
    if (!pendingAction) return
    const summary = pendingAction.summary
    setPendingAction(null)
    setProposeRedistribute(false)
    const next: CordThread = {
      ...thread,
      messages: [
        ...thread.messages,
        {
          role: 'assistant',
          content: `Reprovado. Não executei: ${summary}`,
        },
      ],
    }
    persist(next)
  }

  if (loading || !isOwner) return null

  return (
    <div className="pointer-events-none fixed bottom-5 right-5 z-[80] flex flex-col items-end gap-3">
      {open && (
        <div className="pointer-events-auto flex h-[min(720px,88vh)] w-[min(520px,calc(100vw-1.5rem))] flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-2xl shadow-zinc-900/15">
          <div className="flex items-center justify-between bg-liqui-navy px-4 py-3 text-white">
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-white/10">
                <Sparkles className="h-4 w-4 text-liqui-orange" />
              </span>
              <div>
                <p className="text-sm font-extrabold tracking-wide">CORD</p>
                <p className="text-[11px] text-white/70">Assistente do owner</p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              {tab === 'chat' && (
                <button
                  type="button"
                  onClick={clearConversation}
                  className="rounded-lg p-1.5 text-white/80 hover:bg-white/10"
                  title="Limpar conversa"
                  aria-label="Limpar conversa"
                >
                  <Eraser className="h-4 w-4" />
                </button>
              )}
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-lg p-1.5 text-white/80 hover:bg-white/10"
                aria-label="Fechar CORD"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="flex border-b border-zinc-100 bg-white px-2 pt-1">
            <TabBtn
              active={tab === 'chat'}
              icon={MessageSquare}
              label="Chat"
              onClick={() => setTab('chat')}
            />
            <TabBtn
              active={tab === 'history'}
              icon={History}
              label="Histórico"
              onClick={() => setTab('history')}
            />
          </div>

          {tab === 'chat' ? (
            <>
              <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto bg-[#f7f8fa] px-3 py-3">
                {messages.map((m, i) => (
                  <div
                    key={`${thread.id}-${i}`}
                    className={`max-w-[92%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-sm leading-relaxed ${
                      m.role === 'user'
                        ? 'ml-auto bg-liqui-navy text-white'
                        : 'mr-auto border border-zinc-100 bg-white text-zinc-700'
                    }`}
                  >
                    {m.content}
                  </div>
                ))}

                {pendingAction && !busy && (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-3 text-xs text-amber-950">
                    <p className="font-extrabold text-amber-900">
                      Aprovação necessária
                    </p>
                    <p className="mt-1 leading-relaxed">
                      {pendingAction.summary}
                    </p>
                    <div className="mt-3 flex gap-2">
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() =>
                          void run('', { confirmAction: pendingAction })
                        }
                        className="flex-1 rounded-lg bg-liqui-navy px-3 py-2 text-xs font-bold text-white"
                      >
                        Aprovar
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={rejectPending}
                        className="flex-1 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-xs font-bold text-zinc-700"
                      >
                        Reprovar
                      </button>
                    </div>
                  </div>
                )}

                {!pendingAction &&
                  proposeRedistribute &&
                  semConsultor > 0 &&
                  !busy && (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                    <p className="font-semibold">
                      {semConsultor} lead(s) sem consultor.
                    </p>
                    <div className="mt-2 flex gap-2">
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() =>
                          void run('', { confirmRedistribute: true })
                        }
                        className="flex-1 rounded-lg bg-liqui-navy px-3 py-1.5 text-xs font-bold text-white"
                      >
                        Aprovar redistribuição
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => setProposeRedistribute(false)}
                        className="flex-1 rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-xs font-bold text-zinc-700"
                      >
                        Reprovar
                      </button>
                    </div>
                  </div>
                )}

                {busy && (
                  <div className="mr-auto flex items-center gap-2 rounded-2xl border border-zinc-100 bg-white px-3 py-2 text-xs text-zinc-500">
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-liqui-orange" />
                    Pensando…
                  </div>
                )}
                {error && (
                  <p className="rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-xs text-red-600">
                    {error}
                  </p>
                )}
                <div ref={bottomRef} />
              </div>

              <div className="border-t border-zinc-100 bg-white p-3">
                <div className="mb-2 flex flex-wrap gap-1.5">
                  {chips.map((c) => (
                    <button
                      key={c}
                      type="button"
                      disabled={busy}
                      onClick={() => void run(c)}
                      className="rounded-full border border-zinc-200 bg-zinc-50 px-2.5 py-1 text-[11px] font-medium text-zinc-600 hover:border-liqui-orange/40 hover:bg-liqui-orange-soft"
                    >
                      {c}
                    </button>
                  ))}
                </div>
                <form
                  className="flex gap-2"
                  onSubmit={(e) => {
                    e.preventDefault()
                    void run(input)
                  }}
                >
                  <input
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="Pergunte ao CORD…"
                    disabled={busy}
                    className="min-w-0 flex-1 rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2.5 text-sm text-liqui-navy outline-none ring-liqui-orange/30 focus:ring-2"
                  />
                  <button
                    type="submit"
                    disabled={busy || !input.trim()}
                    className="inline-flex items-center justify-center rounded-xl bg-liqui-orange px-3 text-white disabled:opacity-40"
                    aria-label="Enviar"
                  >
                    <Send className="h-4 w-4" />
                  </button>
                </form>
                <p className="mt-2 flex items-center justify-center gap-1.5 text-[10px] text-zinc-400">
                  <MistralIcon className="h-3.5 w-3.5" />
                  Powered by Mistral AI
                </p>
              </div>
            </>
          ) : (
            <div className="flex min-h-0 flex-1 flex-col bg-[#f7f8fa]">
              <div className="flex items-center justify-between border-b border-zinc-100 bg-white px-3 py-2">
                <p className="text-xs font-semibold text-zinc-500">
                  Conversas neste dispositivo
                </p>
                <button
                  type="button"
                  onClick={newConversation}
                  className="inline-flex items-center gap-1 rounded-lg bg-liqui-navy px-2.5 py-1.5 text-[11px] font-bold text-white"
                >
                  <Plus className="h-3.5 w-3.5 text-liqui-orange" />
                  Nova
                </button>
              </div>
              <div className="min-h-0 flex-1 space-y-1 overflow-y-auto p-2">
                {threads.length === 0 ? (
                  <p className="px-2 py-6 text-center text-xs text-zinc-400">
                    Ainda não há histórico. Converse no Chat — o Mem0 guarda
                    preferências longas no servidor.
                  </p>
                ) : (
                  threads.map((t) => (
                    <div
                      key={t.id}
                      className={`flex items-start gap-2 rounded-xl border px-3 py-2 ${
                        t.id === thread.id
                          ? 'border-liqui-orange/40 bg-liqui-orange-soft'
                          : 'border-zinc-100 bg-white'
                      }`}
                    >
                      <button
                        type="button"
                        className="min-w-0 flex-1 text-left"
                        onClick={() => openThread(t)}
                      >
                        <p className="truncate text-sm font-semibold text-liqui-navy">
                          {t.title}
                        </p>
                        <p className="text-[11px] text-zinc-400">
                          {new Date(t.updatedAt).toLocaleString('pt-BR', {
                            day: '2-digit',
                            month: 'short',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                          {' · '}
                          {t.messages.length} msgs
                        </p>
                      </button>
                      <button
                        type="button"
                        onClick={() => removeThread(t.id)}
                        className="rounded-lg p-1.5 text-zinc-400 hover:bg-red-50 hover:text-red-500"
                        aria-label="Apagar conversa"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      )}

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="pointer-events-auto relative flex h-14 w-14 items-center justify-center rounded-2xl bg-liqui-navy text-white shadow-lg shadow-liqui-navy/35 transition hover:scale-[1.04] hover:bg-liqui-navy"
        aria-label={open ? 'Fechar CORD' : 'Abrir CORD'}
        title="CORD · assistente owner"
      >
        {open ? (
          <X className="h-5 w-5 text-white" />
        ) : (
          <Bot className="h-7 w-7 text-[#b8f000]" strokeWidth={2.25} />
        )}
        {!open && (
          <span className="absolute -right-1 -top-1 rounded-full bg-liqui-orange px-1.5 py-0.5 text-[8px] font-extrabold uppercase tracking-wide text-white shadow-sm ring-2 ring-white">
            Cord
          </span>
        )}
      </button>
    </div>
  )
}

function TabBtn({
  active,
  icon: Icon,
  label,
  onClick,
}: {
  active: boolean
  icon: typeof MessageSquare
  label: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex flex-1 items-center justify-center gap-1.5 border-b-2 px-2 py-2.5 text-xs font-bold transition ${
        active
          ? 'border-liqui-orange text-liqui-navy'
          : 'border-transparent text-zinc-400 hover:text-zinc-600'
      }`}
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
    </button>
  )
}
