/**
 * cord-chat — Assistente CORD (owner only).
 * Deploy: Dashboard → Edge Functions → cord-chat (arquivo único).
 * Secrets: MISTRAL_API_KEY, MEM0_API_KEY (opcional mas recomendado).
 * NÃO use VITE_MEM0_* no frontend — a chave fica só no Edge / .env do servidor.
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.0'

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const MISTRAL_API_KEY = Deno.env.get('MISTRAL_API_KEY') || ''
const MEM0_API_KEY = Deno.env.get('MEM0_API_KEY') || ''
const MISTRAL_MODEL =
  Deno.env.get('MISTRAL_CORD_MODEL') ||
  Deno.env.get('MISTRAL_MODEL') ||
  'mistral-small-latest'

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

async function mem0Search(userId: string, query: string): Promise<string[]> {
  if (!MEM0_API_KEY || !query.trim()) return []
  try {
    const res = await fetch('https://api.mem0.ai/v2/memories/search/', {
      method: 'POST',
      headers: {
        Authorization: `Token ${MEM0_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: query.slice(0, 1000),
        filters: { user_id: userId },
        top_k: 6,
      }),
    })
    if (!res.ok) return []
    const data = await res.json()
    const rows = Array.isArray(data) ? data : data?.results || data?.memories || []
    return (rows as Array<{ memory?: string; text?: string }>)
      .map((r) => String(r.memory || r.text || '').trim())
      .filter(Boolean)
      .slice(0, 6)
  } catch {
    return []
  }
}

async function mem0Add(
  userId: string,
  pair: Array<{ role: string; content: string }>,
  threadId?: string | null,
) {
  if (!MEM0_API_KEY || pair.length < 1) return
  try {
    await fetch('https://api.mem0.ai/v3/memories/add/', {
      method: 'POST',
      headers: {
        Authorization: `Token ${MEM0_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messages: pair.map((m) => ({
          role: m.role,
          content: String(m.content).slice(0, 4000),
        })),
        user_id: userId,
        agent_id: 'cord',
        run_id: threadId || undefined,
        metadata: { app: 'liqui', agent: 'cord' },
      }),
    })
  } catch {
    /* memória nunca derruba o chat */
  }
}

function pickSkill(message: string): string {
  const m = message.toLowerCase()
  if (
    /redistribu|sem consultor|atribu|desatribu|dispatch|carteira|rod[ií]zio|fila/.test(
      m,
    )
  ) {
    return 'cord-dispatch'
  }
  if (/receita|pipeline|r\$|fatur|negoci/.test(m)) {
    return 'cord-revenue-radar'
  }
  if (/consultor|equipe|carga|sobrecarreg|time|team/.test(m)) {
    return 'cord-team-load'
  }
  if (/insight|ia|radar|risco|oportun/.test(m)) {
    return 'cord-insight-brief'
  }
  if (/funil|status|gargalo|novo|qualific|perdid|ganho/.test(m)) {
    return 'cord-funnel-pulse'
  }
  return 'cord-funnel-pulse'
}

// Skills canônicas (espelho de skills/cord-*/prompt.system.md) — embutidas no Edge.
const SKILL_PROMPTS: Record<string, string> = {
  'cord-funnel-pulse': `Skill cord-funnel-pulse: ler SNAPSHOT e responder sobre o funil.
Só use números do snapshot. Destaque estágio com mais leads e o que parece parado.
Se sem_consultor > 0, mencione. Não invente receita.`,

  'cord-team-load': `Skill cord-team-load: analisar carga dos consultores no SNAPSHOT.
Cite nome + leads + abertos + ganhos. Marque inativos. Sinalize desbalanceamento.
Não invente % de conversão.`,

  'cord-revenue-radar': `Skill cord-revenue-radar: explicar receita/pipeline.
receita_pipeline_aberta = potencial (negócios abertos). Separe de ganhos.
Formate R$ pt-BR. Não some com leads/tentativas inventadas.`,

  'cord-dispatch': `Skill cord-dispatch: orientar atribuição / desatribuição / rodízio / transferência.
NUNCA execute mudança sozinho. NUNCA mande o owner para Operação → Distribuição para confirmar.
A UI do chat mostra botões Aprovar / Reprovar — diga isso claramente.
Se RESULTADO DA AÇÃO existir, resuma o que aconteceu.
Descreva o plano (de quem → pra quem, quantidade) e peça aprovação nos botões.`,

  'cord-insight-brief': `Skill cord-insight-brief: briefing de inteligência.
Use insights_recentes + funil + Mem0. Não invente conteúdo de insight por lead.
Termine com 1 prioridade para o owner hoje.`,
}

const SYSTEM = `Você é o CORD, assistente operacional do LIQUI (CRM Contabilidade Facilitada).
Fale com o owner em português do Brasil, curto e útil.
Use SOMENTE SNAPSHOT CRM + MEMÓRIAS MEM0 + o texto da ACTIVE_SKILL — não invente.

Skills disponíveis:
- cord-funnel-pulse · funil e gargalos
- cord-team-load · carga dos consultores
- cord-revenue-radar · receita / pipeline
- cord-dispatch · atribuir / desatribuir / transferir / rodízio
- cord-insight-brief · briefing de inteligência

REGRA CRÍTICA: qualquer alteração em leads (atribuir, desatribuir, transferir, redistribuir)
exige Aprovar/Reprovar nos botões do chat. Nunca diga para ir em Operação → Distribuição
para confirmar. A Distribuição manual existe para seleção fina; no chat use os botões.
Se houver PENDING_ACTION no contexto, descreva-a e peça Aprovar ou Reprovar.
Formato: bullets quando listar métricas.`


async function requireOwner(req: Request) {
  const supabaseUrl = Deno.env.get('SUPABASE_URL') || ''
  const anon = Deno.env.get('SUPABASE_ANON_KEY') || ''
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
  if (!supabaseUrl || !serviceKey) throw new Error('Supabase env ausente')

  const authHeader = req.headers.get('Authorization') || ''
  const userClient = createClient(supabaseUrl, anon || serviceKey, {
    global: { headers: { Authorization: authHeader } },
  })
  const { data: userData, error: userErr } = await userClient.auth.getUser()
  if (userErr || !userData.user) throw new Error('Não autenticado')

  const admin = createClient(supabaseUrl, serviceKey)
  const { data: profile } = await admin
    .from('profiles')
    .select('role, active, full_name')
    .eq('id', userData.user.id)
    .maybeSingle()

  if (!profile || profile.role !== 'owner' || profile.active === false) {
    throw new Error('CORD disponível apenas para owner')
  }

  return { admin, userId: userData.user.id, ownerName: profile.full_name }
}

type CrmSnapshot = {
  leads_total: number
  leads_por_status: Record<string, number>
  sem_consultor: number
  receita_pipeline_aberta: number
  negocios_abertos: number
  negocios_ganhos: number
  consultores: Array<{
    nome: string
    email: string
    ativo: boolean
    leads: number
    ganhos: number
    abertos: number
  }>
  insights_recentes: number
}

async function buildCrmSnapshot(admin: ReturnType<typeof createClient>): Promise<CrmSnapshot> {
  const [
    { data: leads },
    { data: negocios },
    { data: profiles },
    { count: insightsCount },
  ] = await Promise.all([
    admin
      .from('leads')
      .select('id_lead, status, assigned_to, archived_at')
      .is('archived_at', null),
    admin
      .from('negocios')
      .select('valor, status_negocio, archived_at')
      .is('archived_at', null),
    admin
      .from('profiles')
      .select('id, full_name, email, role, active')
      .eq('role', 'consultor'),
    admin
      .from('lead_insights')
      .select('id', { count: 'exact', head: true }),
  ])

  const leadRows = leads ?? []
  const byStatus: Record<string, number> = {}
  let semConsultor = 0
  for (const l of leadRows) {
    const st = String(l.status || 'sem_status').toLowerCase()
    byStatus[st] = (byStatus[st] || 0) + 1
    if (!l.assigned_to) semConsultor += 1
  }

  const negoRows = negocios ?? []
  let receita = 0
  let abertos = 0
  let ganhos = 0
  for (const n of negoRows) {
    const v = Number(n.valor || 0)
    const st = String(n.status_negocio || '').toLowerCase()
    if (st === 'aberto') {
      abertos += 1
      receita += v
    } else if (st === 'ganho') {
      ganhos += 1
    }
  }

  const consultores = (profiles ?? []).map((p) => {
    const mine = leadRows.filter((l) => l.assigned_to === p.id)
    const status = (s: unknown) => String(s || '').toLowerCase()
    return {
      nome: p.full_name || p.email,
      email: p.email,
      ativo: p.active !== false,
      leads: mine.length,
      ganhos: mine.filter((l) => status(l.status) === 'ganho').length,
      abertos: mine.filter(
        (l) => !['ganho', 'perdido'].includes(status(l.status)),
      ).length,
    }
  })

  return {
    leads_total: leadRows.length,
    leads_por_status: byStatus,
    sem_consultor: semConsultor,
    receita_pipeline_aberta: Math.round(receita * 100) / 100,
    negocios_abertos: abertos,
    negocios_ganhos: ganhos,
    consultores: consultores.sort((a, b) => b.leads - a.leads),
    insights_recentes: insightsCount ?? 0,
  }
}

async function redistributeUnassigned(
  admin: ReturnType<typeof createClient>,
  activeOnly: boolean,
) {
  const [{ data: leads }, { data: profiles }] = await Promise.all([
    admin
      .from('leads')
      .select('id_lead')
      .is('assigned_to', null)
      .is('archived_at', null),
    admin
      .from('profiles')
      .select('id, active')
      .eq('role', 'consultor'),
  ])

  const ids = (leads ?? []).map((l) => Number(l.id_lead))
  let consultors = (profiles ?? []).map((p) => ({
    id: String(p.id),
    active: p.active !== false,
  }))
  if (activeOnly) consultors = consultors.filter((c) => c.active)
  if (ids.length === 0) {
    return { assigned: 0, message: 'Nenhum lead sem consultor.' }
  }
  if (consultors.length === 0) {
    return { assigned: 0, message: 'Nenhum consultor elegível.' }
  }

  const buckets = new Map<string, number[]>()
  for (let i = 0; i < ids.length; i++) {
    const target = consultors[i % consultors.length]!.id
    const list = buckets.get(target)
    if (list) list.push(ids[i]!)
    else buckets.set(target, [ids[i]!])
  }

  for (const [consultorId, leadIds] of buckets.entries()) {
    // chunk em 80
    for (let i = 0; i < leadIds.length; i += 80) {
      const slice = leadIds.slice(i, i + 80)
      const { data, error } = await admin
        .from('leads')
        .update({ assigned_to: consultorId })
        .in('id_lead', slice)
        .select('id_lead')
      if (error) throw new Error(error.message)
      if (!data?.length) {
        throw new Error(
          'Redistribuição não gravou linhas. Confira leads.assigned_to e RLS (migrate-lead-assignment.sql).',
        )
      }
    }
  }

  const { count: stillOpen } = await admin
    .from('leads')
    .select('id_lead', { count: 'exact', head: true })
    .is('assigned_to', null)
    .is('archived_at', null)

  return {
    assigned: ids.length,
    consultores: consultors.length,
    sem_consultor_restante: stillOpen ?? 0,
    message: `Redistribuídos ${ids.length} lead(s) entre ${consultors.length} consultor(es) ativo(s).`,
  }
}

type CordPendingAction = {
  type: 'redistribute_unassigned' | 'transfer' | 'unassign_from'
  summary: string
  from_id?: string | null
  to_id?: string | null
  from_label?: string
  to_label?: string
  lead_count: number
}

type ConsultorRow = {
  id: string
  full_name: string
  email: string
  active: boolean
}

async function listConsultores(
  admin: ReturnType<typeof createClient>,
): Promise<ConsultorRow[]> {
  const { data } = await admin
    .from('profiles')
    .select('id, full_name, email, active')
    .eq('role', 'consultor')
  return (data ?? []).map((p) => ({
    id: String(p.id),
    full_name: String(p.full_name || ''),
    email: String(p.email || ''),
    active: p.active !== false,
  }))
}

function scoreName(needle: string, c: ConsultorRow): number {
  const strip = (s: string) =>
    s
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim()
  const n = strip(needle)
  if (!n || n.length < 2) return 0
  const name = strip(c.full_name)
  const email = c.email.toLowerCase()
  const local = email.split('@')[0] || ''
  if (name === n || local === n || email === n) return 100
  if (name.includes(n) || local.includes(n)) return 80
  const parts = n.split(/\s+/).filter(Boolean)
  if (parts.length && parts.every((p) => name.includes(p) || local.includes(p))) {
    return 70
  }
  if (parts.some((p) => p.length > 2 && (name.includes(p) || local.includes(p)))) {
    return 40
  }
  return 0
}

function findConsultor(
  list: ConsultorRow[],
  needle: string,
): ConsultorRow | null {
  let best: ConsultorRow | null = null
  let bestScore = 0
  for (const c of list) {
    const s = scoreName(needle, c)
    if (s > bestScore) {
      bestScore = s
      best = c
    }
  }
  return bestScore >= 40 ? best : null
}

async function countLeadsOf(
  admin: ReturnType<typeof createClient>,
  consultorId: string | null,
): Promise<number> {
  let q = admin
    .from('leads')
    .select('id_lead', { count: 'exact', head: true })
    .is('archived_at', null)
  if (consultorId === null) q = q.is('assigned_to', null)
  else q = q.eq('assigned_to', consultorId)
  const { count } = await q
  return count ?? 0
}

async function transferLeads(
  admin: ReturnType<typeof createClient>,
  fromId: string,
  toId: string,
) {
  const { data, error } = await admin
    .from('leads')
    .update({ assigned_to: toId })
    .eq('assigned_to', fromId)
    .is('archived_at', null)
    .select('id_lead')
  if (error) throw new Error(error.message)
  return {
    transferred: data?.length ?? 0,
    message: `Transferidos ${data?.length ?? 0} lead(s).`,
  }
}

async function unassignFrom(
  admin: ReturnType<typeof createClient>,
  fromId: string,
) {
  const { data, error } = await admin
    .from('leads')
    .update({ assigned_to: null })
    .eq('assigned_to', fromId)
    .is('archived_at', null)
    .select('id_lead')
  if (error) throw new Error(error.message)
  return {
    unassigned: data?.length ?? 0,
    message: `${data?.length ?? 0} lead(s) voltaram para a fila.`,
  }
}

function parseTransferNeedles(message: string): { from: string; to: string } | null {
  const text = message.replace(/\s+/g, ' ').trim()
  const patterns = [
    /leads?\s+d[oea]\s+(.+?)\s+(?:e\s+)?(?:passe|passa|transf\w*|mova|move)\s+(?:todos?\s+)?(?:pra|para|pro)\s+(.+)$/i,
    /(?:passe|passa|transf\w*|mova)\s+(?:os\s+)?leads?\s+(?:d[oea]\s+)?(.+?)\s+(?:pra|para|pro)\s+(.+)$/i,
    /(?:pegue|pege|pega)\s+(?:os\s+)?leads?\s+d[oea]\s+(.+?)\s+(?:e\s+)?(?:passe|passa)\s+(?:todos?\s+)?(?:pra|para|pro)\s+(.+)$/i,
    /d[oea]\s+(.+?)\s+(?:pra|para|pro)\s+(.+)$/i,
  ]
  for (const re of patterns) {
    const m = text.match(re)
    if (m?.[1] && m?.[2]) {
      return {
        from: m[1].replace(/\be\s+passe.*$/i, '').trim(),
        to: m[2].trim(),
      }
    }
  }
  return null
}

async function proposePendingAction(
  admin: ReturnType<typeof createClient>,
  message: string,
  semConsultor: number,
): Promise<CordPendingAction | null> {
  const list = await listConsultores(admin)
  const transfer = parseTransferNeedles(message)
  if (transfer) {
    const from = findConsultor(list, transfer.from)
    const to = findConsultor(list, transfer.to)
    if (from && to && from.id !== to.id) {
      const n = await countLeadsOf(admin, from.id)
      if (n === 0) return null
      return {
        type: 'transfer',
        summary: `Transferir ${n} lead(s) de ${from.full_name || from.email} → ${to.full_name || to.email}`,
        from_id: from.id,
        to_id: to.id,
        from_label: from.full_name || from.email,
        to_label: to.full_name || to.email,
        lead_count: n,
      }
    }
  }

  if (
    /desatribu|voltar\s+pra\s+fila|remover\s+consultor|tire\s+os\s+leads/i.test(
      message,
    )
  ) {
    const m = message.match(
      /(?:d[oea]|de)\s+([a-z0-9_.@\-\s]{2,40?}?)(?:\s|$)/i,
    )
    const needle = m?.[1]?.trim()
    if (needle) {
      const from = findConsultor(list, needle)
      if (from) {
        const n = await countLeadsOf(admin, from.id)
        if (n > 0) {
          return {
            type: 'unassign_from',
            summary: `Desatribuir ${n} lead(s) de ${from.full_name || from.email} (voltar pra fila)`,
            from_id: from.id,
            from_label: from.full_name || from.email,
            lead_count: n,
          }
        }
      }
    }
  }

  if (
    semConsultor > 0 &&
    /redistribu|sem consultor|fila|rod[ií]zio/i.test(message)
  ) {
    return {
      type: 'redistribute_unassigned',
      summary: `Redistribuir ${semConsultor} lead(s) da fila entre consultores ativos`,
      lead_count: semConsultor,
    }
  }

  return null
}

async function executePendingAction(
  admin: ReturnType<typeof createClient>,
  action: CordPendingAction,
) {
  if (action.type === 'redistribute_unassigned') {
    return await redistributeUnassigned(admin, true)
  }
  if (action.type === 'transfer') {
    if (!action.from_id || !action.to_id) {
      throw new Error('Transferência incompleta (from/to)')
    }
    return await transferLeads(admin, action.from_id, action.to_id)
  }
  if (action.type === 'unassign_from') {
    if (!action.from_id) throw new Error('Desatribuir incompleto')
    return await unassignFrom(admin, action.from_id)
  }
  throw new Error('Ação desconhecida')
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }
  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405)
  }

  try {
    if (!MISTRAL_API_KEY) {
      return jsonResponse({ error: 'MISTRAL_API_KEY não configurada' }, 500)
    }

    const { admin, userId, ownerName } = await requireOwner(req)
    const body = await req.json()
    const message = String(body.message || '').trim()
    const history = Array.isArray(body.history) ? body.history : []
    const threadId = body.thread_id ? String(body.thread_id) : null
    const confirmAction =
      body.confirm_action && typeof body.confirm_action === 'object'
        ? (body.confirm_action as CordPendingAction)
        : null
    // legado
    const confirmRedistribute =
      body.confirm_redistribute === true && !confirmAction

    let actionResult: unknown = null
    if (confirmAction) {
      actionResult = await executePendingAction(admin, confirmAction)
    } else if (confirmRedistribute) {
      actionResult = await redistributeUnassigned(admin, true)
    }

    if (!message && !confirmAction && !confirmRedistribute) {
      return jsonResponse({ error: 'Mensagem vazia' }, 400)
    }

    const snapshot = await buildCrmSnapshot(admin)
    const activeSkill = pickSkill(message || 'dispatch')
    const memories = await mem0Search(
      userId,
      message || 'preferências operacionais do owner LIQUI',
    )

    let pendingAction: CordPendingAction | null = null
    if (!confirmAction && !confirmRedistribute && message) {
      pendingAction = await proposePendingAction(
        admin,
        message,
        snapshot.sem_consultor,
      )
    }

    const messages: Array<{ role: string; content: string }> = [
      {
        role: 'system',
        content: `${SYSTEM}

ACTIVE_SKILL: ${activeSkill}

SKILL_PROMPT:
${SKILL_PROMPTS[activeSkill] || SKILL_PROMPTS['cord-funnel-pulse']}

Owner: ${ownerName}
MEM0_ENABLED: ${Boolean(MEM0_API_KEY)}

MEMÓRIAS MEM0:
${memories.length ? memories.map((m) => `- ${m}`).join('\n') : '- (nenhuma ainda)'}

SNAPSHOT CRM:
${JSON.stringify(snapshot, null, 2)}
${
  pendingAction
    ? `\nPENDING_ACTION (aguardando Aprovar/Reprovar no chat):\n${JSON.stringify(pendingAction, null, 2)}`
    : ''
}${
  actionResult
    ? `\n\nRESULTADO DA AÇÃO:\n${JSON.stringify(actionResult)}`
    : ''
}`,
      },
    ]

    for (const h of history.slice(-12)) {
      const role = h?.role === 'assistant' ? 'assistant' : 'user'
      const content = String(h?.content || '').slice(0, 4000)
      if (content) messages.push({ role, content })
    }

    if (message) {
      messages.push({ role: 'user', content: message.slice(0, 4000) })
    } else if (confirmAction || confirmRedistribute) {
      messages.push({
        role: 'user',
        content:
          'Aprovei a ação crítica no chat. Resuma o resultado com os números.',
      })
    }

    const response = await fetch('https://api.mistral.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${MISTRAL_API_KEY}`,
      },
      body: JSON.stringify({
        model: MISTRAL_MODEL,
        temperature: 0.3,
        messages,
      }),
    })

    const data = await response.json()
    if (!response.ok) {
      throw new Error(
        data?.message ||
          data?.error?.message ||
          `Mistral HTTP ${response.status}`,
      )
    }

    let reply =
      data?.choices?.[0]?.message?.content || 'Sem resposta do modelo.'

    // Se há pending: resposta curta alinhada aos botões (evita mandar pra outra tela)
    if (pendingAction && !actionResult) {
      reply = `⚠️ **Confirmação necessária**

${pendingAction.summary}

Use **Aprovar** ou **Reprovar** abaixo. Nada será alterado até você decidir.`
    }

    const lastUser =
      message ||
      (confirmAction || confirmRedistribute
        ? 'Aprovei ação crítica no CORD'
        : '')
    if (lastUser) {
      void mem0Add(
        userId,
        [
          { role: 'user', content: lastUser },
          { role: 'assistant', content: reply },
        ],
        threadId,
      )
    }

    try {
      await admin.from('ai_usage_events').insert({
        provider: 'mistral',
        operation: 'cord-chat',
        model_name: MISTRAL_MODEL,
        units: 1,
        estimated_cost_usd: 0.002,
        meta: {
          skill: activeSkill,
          mem0: Boolean(MEM0_API_KEY),
          pending: Boolean(pendingAction),
          confirmed: Boolean(confirmAction || confirmRedistribute),
        },
        created_by: userId,
      })
    } catch {
      /* ignore */
    }

    return jsonResponse({
      reply,
      model: MISTRAL_MODEL,
      skill: activeSkill,
      mem0: Boolean(MEM0_API_KEY),
      snapshot,
      action_result: actionResult,
      pending_action: pendingAction,
      propose_redistribute:
        pendingAction?.type === 'redistribute_unassigned',
      sem_consultor: snapshot.sem_consultor,
    })
  } catch (error) {
    return jsonResponse(
      { error: error instanceof Error ? error.message : 'Erro CORD' },
      500,
    )
  }
})
