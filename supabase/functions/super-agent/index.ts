/**
 * Super Agente - Versão Simplificada (Tudo em um único arquivo)
 * 
 * Este agente permite executar operações no CRM via comandos em linguagem natural.
 * Requer autenticação como owner ou consultor com permissões.
 * 
 * Uso:
 * POST /functions/v1/super-agent
 * Body: { "command": "Crie um lead para João com email joao@teste.com" }
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.0'

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

// =============================================================================
// TIPOS
// =============================================================================

interface AgentContext {
  userId: string;
  userEmail: string;
  isOwner: boolean;
  supabaseAdmin: any;
  supabaseUrl: string;
  anonKey: string;
}

interface AgentResult {
  success: boolean;
  message: string;
  data?: Record<string, unknown>;
  error?: string;
}

interface AgentResponse {
  thought: string;
  action?: { type: string; data?: Record<string, unknown> };
  response: string;
  result?: AgentResult;
}

// =============================================================================
// FUNÇÕES DE AUTENTICAÇÃO
// =============================================================================

async function checkIsOwner(supabaseAdmin: any, userId: string): Promise<boolean> {
  try {
    const { data, error } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', userId)
      .single()
    
    if (error) return false
    return data?.role === 'owner'
  } catch {
    return false
  }
}

async function requireAuth(req: Request) {
  const supabaseUrl = Deno.env.get('SUPABASE_URL') || ''
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
  
  if (!supabaseUrl || !serviceKey) {
    throw new Error('Supabase env ausente')
  }

  const authHeader = req.headers.get('Authorization') || ''
  const userClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY') || serviceKey, {
    global: { headers: { Authorization: authHeader } },
  })
  
  const { data: userData, error: userErr } = await userClient.auth.getUser()
  if (userErr || !userData.user) throw new Error('Não autenticado')

  const admin = createClient(supabaseUrl, serviceKey)
  const isOwner = await checkIsOwner(admin, userData.user.id)

  return {
    admin,
    callerId: userData.user.id,
    callerEmail: userData.user.email || '',
    isOwner,
    supabaseUrl,
    anonKey: Deno.env.get('SUPABASE_ANON_KEY') || '',
  }
}

// =============================================================================
// FUNÇÕES DE EXTRAÇÃO DE COMANDOS
// =============================================================================

function extractDateFromCommand(command: string, untilKeyword?: string): string | undefined {
  const datePatterns = [
    /(\d{4}-\d{2}-\d{2})/,
    /(\d{2}\/\d{2}\/\d{4})/,
    /(hoje|today)/i,
    /(ontem|yesterday)/i,
  ]
  
  for (const pattern of datePatterns) {
    const match = command.match(pattern)
    if (match) {
      const dateStr = match[1]
      if (dateStr === 'hoje' || dateStr === 'today') {
        return new Date().toISOString().split('T')[0]
      }
      if (dateStr === 'ontem' || dateStr === 'yesterday') {
        const yesterday = new Date()
        yesterday.setDate(yesterday.getDate() - 1)
        return yesterday.toISOString().split('T')[0]
      }
      if (dateStr.includes('/')) {
        const [day, month, year] = dateStr.split('/')
        return `${year}-${month}-${day}`
      }
      return dateStr
    }
  }
  return undefined
}

function extractActionFromCommand(command: string): { action?: { type: string; data?: Record<string, unknown> }; response: string } {
  const cmd = command.toLowerCase().trim()
  
  // Criar lead
  if (cmd.includes('criar lead') || cmd.includes('crie lead') || cmd.includes('novo lead')) {
    const nomeMatch = cmd.match(/(?:criar|criar lead|novo lead)[^:]*:?\s*(.+?)(?:\s+com|\s+email|\s+telefone|$)/i)
    const emailMatch = cmd.match(/(?:email|e-mail)[^:]*:?\s*([a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,})/i)
    const telefoneMatch = cmd.match(/(?:telefone|fone|celular)[^:]*:?\s*([0-9\s-]+)/i)
    
    return {
      action: {
        type: 'create_lead',
        data: {
          nome: nomeMatch ? nomeMatch[1].trim() : 'Sem nome',
          email: emailMatch ? emailMatch[1].trim() : undefined,
          telefone: telefoneMatch ? telefoneMatch[1].trim().replace(/[\s-]/g, '') : undefined,
        },
      },
      response: `Vou criar um lead para "${nomeMatch ? nomeMatch[1].trim() : 'Sem nome'}"`,
    }
  }
  
  // Atualizar lead
  if (cmd.includes('atualizar lead') || cmd.includes('atualize lead') || cmd.includes('alterar lead')) {
    const idMatch = cmd.match(/(?:lead|id)[^:]*:?\s*(\d+)/i)
    const statusMatch = cmd.match(/(?:status|estado)[^:]*:?\s*(\S+)/i)
    
    if (idMatch) {
      return {
        action: {
          type: 'update_lead',
          data: {
            id: parseInt(idMatch[1]),
            status: statusMatch ? statusMatch[1] : undefined,
          },
        },
        response: `Vou atualizar o lead ${idMatch[1]}`,
      }
    }
  }
  
  // Criar negócio
  if (cmd.includes('criar negócio') || cmd.includes('crie negócio') || cmd.includes('novo negócio')) {
    const tituloMatch = cmd.match(/(?:criar|criar negócio|novo negócio)[^:]*:?\s*(.+?)(?:\s+para|\s+lead|\s+com|$)/i)
    const leadMatch = cmd.match(/(?:lead|id_lead)[^:]*:?\s*(\d+)/i)
    const valorMatch = cmd.match(/(?:valor|preço)[^:]*:?\s*([\d.,]+)/i)
    
    if (tituloMatch && leadMatch) {
      return {
        action: {
          type: 'create_negocio',
          data: {
            titulo: tituloMatch[1].trim(),
            id_lead: parseInt(leadMatch[1]),
            valor: valorMatch ? parseFloat(valorMatch[1].replace(',', '.')) : undefined,
          },
        },
        response: `Vou criar um negócio "${tituloMatch[1].trim()}" para o lead ${leadMatch[1]}`,
      }
    }
  }
  
  // Criar usuário
  if (cmd.includes('criar usuário') || cmd.includes('crie usuário') || cmd.includes('novo usuário')) {
    const emailMatch = cmd.match(/(?:email|e-mail)[^:]*:?\s*([a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,})/i)
    const nomeMatch = cmd.match(/(?:nome|name)[^:]*:?\s*(.+?)(?:\s+com|\s+email|$)/i)
    const roleMatch = cmd.match(/(?:role|cargo|tipo)[^:]*:?\s*(owner|consultor)/i)
    
    if (emailMatch) {
      return {
        action: {
          type: 'create_user',
          data: {
            email: emailMatch[1].trim(),
            full_name: nomeMatch ? nomeMatch[1].trim() : 'Sem nome',
            role: roleMatch ? roleMatch[1] : 'consultor',
          },
        },
        response: `Vou criar um usuário para ${emailMatch[1].trim()}`,
      }
    }
  }
  
  // Gerar relatório
  if (cmd.includes('gerar relatório') || cmd.includes('gere relatório') || cmd.includes('relatório')) {
    const typeMatch = cmd.match(/(?:relatório|report)[^:]*:?\s*(diário|semanal|status|usuários|custom)/i)
    const reportType = typeMatch ? typeMatch[1] : 'leads_daily'
    
    const typeMap: Record<string, string> = {
      'diário': 'leads_daily',
      'semanal': 'leads_weekly',
      'status': 'negocios_status',
      'usuários': 'users_activity',
      'custom': 'custom',
    }
    
    const mappedType = typeMap[reportType] || 'leads_daily'
    
    return {
      action: {
        type: 'generate_report',
        data: {
          type: mappedType,
          start_date: extractDateFromCommand(cmd),
          end_date: extractDateFromCommand(cmd, 'até|until'),
          webhook_url: extractWebhookUrlFromCommand(cmd),
        },
      },
      response: `Vou gerar um relatório ${reportType}`,
    }
  }
  
  // Enviar para webhook
  if (cmd.includes('enviar para webhook') || cmd.includes('envie para webhook')) {
    const urlMatch = cmd.match(/(?:webhook|url)[^:]*:?\s*(https?:\/\/[^\s]+)/i)
    if (urlMatch) {
      return {
        action: {
          type: 'send_webhook',
          data: {
            url: urlMatch[1],
            body: { message: 'Dados do Super Agente' },
          },
        },
        response: `Vou enviar dados para o webhook ${urlMatch[1]}`,
      }
    }
  }
  
  // Query personalizada
  if (cmd.toLowerCase().startsWith('select') || cmd.toLowerCase().startsWith('execute') || cmd.includes('query:')) {
    const queryMatch = cmd.match(/(?:select|execute|query:)\s*(.+)/i)
    if (queryMatch) {
      return {
        action: {
          type: 'custom_query',
          data: { query: queryMatch[1].trim() },
        },
        response: 'Vou executar a query',
      }
    }
  }
  
  // Estatísticas
  if (cmd.includes('estatística') || cmd.includes('stats') || cmd.includes('relatório')) {
    return {
      action: { type: 'get_stats' },
      response: 'Vou gerar as estatísticas do sistema',
    }
  }
  
  // Comando não reconhecido
  return {
    response: 'Desculpe, não entendi o comando. Tente: "Crie um lead para João", "Atualize o lead 123", "Mostre estatísticas"',
  }
}

function extractWebhookUrlFromCommand(command: string): string | undefined {
  const urlMatch = command.match(/(?:webhook|url|enviar para|envie para)[^:]*:?\s*(https?:\/\/[^\s]+)/i)
  return urlMatch ? urlMatch[1] : undefined
}

// =============================================================================
// FUNÇÕES DE EXECUÇÃO DE AÇÕES
// =============================================================================

async function executeAction(action: { type: string; data?: Record<string, unknown> }, context: AgentContext): Promise<AgentResult> {
  const { supabaseAdmin, isOwner, userId } = context
  
  switch (action.type) {
    // Leads
    case 'create_lead': {
      const data = action.data as { nome: string; email?: string; telefone?: string }
      const { data: lead, error } = await supabaseAdmin
        .from('leads')
        .insert({
          nome: data.nome,
          email: data.email,
          telefone: data.telefone,
          origem: 'super-agent',
        })
        .select()
        .single()
      
      if (error) return { success: false, message: 'Falha ao criar lead', error: error.message }
      return { success: true, message: `Lead "${data.nome}" criado com sucesso!`, data: lead }
    }
    
    case 'update_lead': {
      const data = action.data as { id: number; status?: string }
      const updates: Record<string, unknown> = {}
      if (data.status !== undefined) updates.status = data.status
      
      const { data: lead, error } = await supabaseAdmin
        .from('leads')
        .update(updates)
        .eq('id_lead', data.id)
        .select()
        .single()
      
      if (error) return { success: false, message: 'Falha ao atualizar lead', error: error.message }
      return { success: true, message: `Lead ${data.id} atualizado com sucesso!`, data: lead }
    }
    
    // Negócios
    case 'create_negocio': {
      const data = action.data as { titulo: string; id_lead: number; valor?: number }
      const { data: negocio, error } = await supabaseAdmin
        .from('negocios')
        .insert({
          titulo: data.titulo,
          id_lead: data.id_lead,
          valor: data.valor || 0,
          status_negocio: 'aberto',
        })
        .select()
        .single()
      
      if (error) return { success: false, message: 'Falha ao criar negócio', error: error.message }
      return { success: true, message: `Negócio "${data.titulo}" criado com sucesso!`, data: negocio }
    }
    
    case 'update_negocio': {
      const data = action.data as { id: string; status_negocio?: string }
      const updates: Record<string, unknown> = {}
      if (data.status_negocio !== undefined) updates.status_negocio = data.status_negocio
      
      const { data: negocio, error } = await supabaseAdmin
        .from('negocios')
        .update(updates)
        .eq('id', data.id)
        .select()
        .single()
      
      if (error) return { success: false, message: 'Falha ao atualizar negócio', error: error.message }
      return { success: true, message: `Negócio ${data.id} atualizado com sucesso!`, data: negocio }
    }
    
    // Usuários
    case 'create_user': {
      const data = action.data as { email: string; full_name: string; role: string }
      
      // Criar usuário no Auth
      const password = crypto.randomUUID().replace(/-/g, '').slice(0, 12) + 'Aa1!'
      const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email: data.email,
        password: password,
        email_confirm: true,
        user_metadata: { full_name: data.full_name },
      })
      
      if (authError) return { success: false, message: 'Falha ao criar usuário no Auth', error: authError.message }
      
      const userId = authUser.user?.id
      if (!userId) return { success: false, message: 'Usuário não criado no Auth' }
      
      // Criar perfil
      const menuAccess = data.role === 'owner' 
        ? '{ "dashboard": true, "leads": true, "tentativas": true, "pesquisas": true, "negocios": true, "distribuicao": true, "plataforma": true }'
        : '{ "dashboard": false, "leads": true, "tentativas": false, "pesquisas": false, "negocios": true, "distribuicao": false, "plataforma": false }'
      
      const { error: profileError } = await supabaseAdmin
        .from('profiles')
        .upsert({
          id: userId,
          email: data.email,
          full_name: data.full_name,
          role: data.role,
          active: true,
          menu_access: menuAccess,
        })
      
      if (profileError) return { success: false, message: 'Falha ao criar perfil', error: profileError.message }
      
      return { 
        success: true, 
        message: `Usuário "${data.email}" criado com sucesso! Role: ${data.role}`,
        data: { userId, email: data.email, role: data.role, password: '***' }
      }
    }
    
    // Relatórios
    case 'generate_report': {
      const data = action.data as { type: string; start_date?: string; end_date?: string; webhook_url?: string }
      return generateReport(data, context)
    }
    
    // Webhooks
    case 'send_webhook': {
      const data = action.data as { url: string; body: Record<string, unknown> }
      return sendToWebhook(data, context)
    }
    
    // Query personalizada
    case 'custom_query': {
      const data = action.data as { query: string }
      return executeCustomQuery(data.query, context)
    }
    
    // Estatísticas
    case 'get_stats': {
      return getSystemStats(context)
    }
    
    default:
      return { success: false, message: 'Ação não implementada' }
  }
}

// =============================================================================
// FUNÇÕES DE RELATÓRIOS E WEBHOOKS
// =============================================================================

async function generateReport(data: { type: string; start_date?: string; end_date?: string; webhook_url?: string }, context: AgentContext): Promise<AgentResult> {
  const { supabaseAdmin } = context
  const reportId = crypto.randomUUID()
  const generatedAt = new Date().toISOString()
  
  try {
    let reportData: Record<string, unknown> = {}
    let summary = ''
    
    switch (data.type) {
      case 'leads_daily':
        reportData = await generateLeadsDailyReport(supabaseAdmin, data)
        summary = `Relatório diário de leads: ${reportData.total || 0} leads`
        break
      case 'leads_weekly':
        reportData = await generateLeadsWeeklyReport(supabaseAdmin, data)
        summary = `Relatório semanal de leads: ${reportData.total || 0} leads`
        break
      case 'negocios_status':
        reportData = await generateNegociosStatusReport(supabaseAdmin, data)
        summary = `Relatório de status de negócios: ${reportData.total || 0} negócios`
        break
      case 'users_activity':
        reportData = await generateUsersActivityReport(supabaseAdmin, data)
        summary = `Relatório de atividade de usuários: ${reportData.total || 0} usuários ativos`
        break
      case 'custom':
        reportData = await generateCustomReport(supabaseAdmin, data)
        summary = 'Relatório personalizado gerado'
        break
      default:
        throw new Error(`Tipo de relatório desconhecido: ${data.type}`)
    }
    
    const report = {
      id: reportId,
      type: data.type,
      generated_at: generatedAt,
      data: reportData,
      summary,
    }
    
    // Envia para webhook se especificado
    if (data.webhook_url) {
      await sendToWebhook({ url: data.webhook_url, body: report }, context)
    }
    
    return {
      success: true,
      message: `Relatório ${data.type} gerado com sucesso`,
      data: { ...reportData, report_id: reportId },
    }
  } catch (error) {
    return {
      success: false,
      message: 'Falha ao gerar relatório',
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

async function generateLeadsDailyReport(supabaseAdmin: any, data: { start_date?: string; end_date?: string }) {
  const startDate = data.start_date || new Date().toISOString().split('T')[0]
  const endDate = data.end_date || new Date().toISOString().split('T')[0]
  
  const [newLeads, leadsByStatus, leadsByOrigin] = await Promise.all([
    supabaseAdmin.from('leads').select('count(*)').gte('created_at', startDate).lte('created_at', endDate),
    supabaseAdmin.from('leads').select('status, count(*)').gte('created_at', startDate).lte('created_at', endDate).group('status'),
    supabaseAdmin.from('leads').select('origem, count(*)').gte('created_at', startDate).lte('created_at', endDate).group('origem'),
  ])
  
  return {
    period: { start: startDate, end: endDate },
    total: newLeads.data?.[0]?.count || 0,
    by_status: leadsByStatus.data || [],
    by_origin: leadsByOrigin.data || [],
  }
}

async function generateLeadsWeeklyReport(supabaseAdmin: any, data: { start_date?: string; end_date?: string }) {
  const endDate = data.end_date || new Date().toISOString().split('T')[0]
  const startDate = new Date(endDate)
  startDate.setDate(startDate.getDate() - 7)
  
  const { data: weeklyLeads, error } = await supabaseAdmin
    .from('leads')
    .select('*')
    .gte('created_at', startDate.toISOString())
    .lte('created_at', endDate)
  
  if (error) throw error
  
  const byDay: Record<string, number> = {}
  weeklyLeads?.forEach((lead: any) => {
    const date = new Date(lead.created_at).toISOString().split('T')[0]
    byDay[date] = (byDay[date] || 0) + 1
  })
  
  return {
    period: { start: startDate.toISOString(), end: endDate },
    total: weeklyLeads?.length || 0,
    by_day: byDay,
  }
}

async function generateNegociosStatusReport(supabaseAdmin: any, data: { start_date?: string; end_date?: string }) {
  const { data: byStatus, error: statusError } = await supabaseAdmin
    .from('negocios')
    .select('status_negocio, count(*), sum(valor) as total_valor')
    .group('status_negocio')
  
  const { data: byPipeline, error: pipelineError } = await supabaseAdmin
    .from('negocios')
    .select('pipeline_id, count(*)')
    .group('pipeline_id')
  
  if (statusError || pipelineError) {
    throw new Error('Falha ao buscar dados de negócios')
  }
  
  const totalByStatus: Record<string, number> = {}
  byStatus?.forEach((item: any) => {
    totalByStatus[item.status_negocio] = Number(item.total_valor || 0)
  })
  
  return {
    by_status: byStatus || [],
    by_pipeline: byPipeline || [],
    total_value_by_status: totalByStatus,
    total_value: Object.values(totalByStatus).reduce((a, b) => a + b, 0),
  }
}

async function generateUsersActivityReport(supabaseAdmin: any, data: { start_date?: string; end_date?: string }) {
  const [activeUsers, inactiveUsers, recentLogins] = await Promise.all([
    supabaseAdmin.from('profiles').select('role, count(*)').eq('active', true).group('role'),
    supabaseAdmin.from('profiles').select('role, count(*)').eq('active', false).group('role'),
    supabaseAdmin.from('auth.users').select('id, email, last_sign_in_at').order('last_sign_in_at', { ascending: false }).limit(10),
  ])
  
  if (activeUsers.error || inactiveUsers.error || recentLogins.error) {
    throw new Error('Falha ao buscar dados de usuários')
  }
  
  return {
    active_users: activeUsers.data || [],
    inactive_users: inactiveUsers.data || [],
    recent_logins: recentLogins.data || [],
    total_active: activeUsers.data?.reduce((sum: number, item: any) => sum + Number(item.count), 0) || 0,
    total_inactive: inactiveUsers.data?.reduce((sum: number, item: any) => sum + Number(item.count), 0) || 0,
  }
}

async function generateCustomReport(supabaseAdmin: any, data: { start_date?: string; end_date?: string; query?: string }) {
  if (!data.query) {
    throw new Error('Query personalizada não fornecida')
  }
  
  const query = data.query
  
  // Validação de segurança
  if (isDangerousQuery(query)) {
    throw new Error('Query bloqueada por segurança')
  }
  
  // Extrai o nome da tabela
  const table = extractTableFromQuery(query)
  
  // Usa a REST API do Supabase
  const response = await fetch(`${context.supabaseUrl}/rest/v1/${table}`, {
    method: 'GET',
    headers: {
      'apikey': context.anonKey,
      'Authorization': `Bearer ${context.anonKey}`,
      'Content-Type': 'application/json',
    },
  })
  
  if (!response.ok) {
    throw new Error(`REST API error: ${response.status}`)
  }
  
  const result = await response.json()
  
  return {
    query: query,
    result: result,
    count: result?.length || 0,
  }
}

function isDangerousQuery(query: string): boolean {
  const dangerousPatterns = ['drop table', 'delete from', 'truncate', 'alter table', 'update .* set', '--', ';']
  const lowerQuery = query.toLowerCase()
  return dangerousPatterns.some(pattern => lowerQuery.includes(pattern))
}

function extractTableFromQuery(query: string): string {
  const match = query.match(/from\s+(\w+)/i)
  return match ? match[1] : 'leads'
}

async function sendToWebhook(data: { url: string; body: Record<string, unknown> }, context: AgentContext): Promise<AgentResult> {
  try {
    const response = await fetch(data.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Supabase-Project': context.supabaseUrl,
        'X-Sender': 'super-agent',
        'X-Timestamp': new Date().toISOString(),
      },
      body: JSON.stringify(data.body),
    })
    
    if (!response.ok) {
      return {
        success: false,
        message: `Webhook falhou: ${response.status}`,
        error: await response.text(),
      }
    }
    
    return {
      success: true,
      message: 'Dados enviados para webhook com sucesso',
      data: { status: response.status },
    }
  } catch (error) {
    return {
      success: false,
      message: 'Falha ao enviar para webhook',
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

async function executeCustomQuery(query: string, context: AgentContext): Promise<AgentResult> {
  try {
    if (isDangerousQuery(query)) {
      return {
        success: false,
        message: 'Query bloqueada por segurança',
      }
    }
    
    const table = extractTableFromQuery(query)
    
    const response = await fetch(`${context.supabaseUrl}/rest/v1/${table}`, {
      method: 'GET',
      headers: {
        'apikey': context.anonKey,
        'Authorization': `Bearer ${context.anonKey}`,
        'Content-Type': 'application/json',
      },
    })
    
    if (!response.ok) {
      return {
        success: false,
        message: `REST API error: ${response.status}`,
        error: await response.text(),
      }
    }
    
    const result = await response.json()
    
    return {
      success: true,
      message: 'Query executada com sucesso',
      data: result,
    }
  } catch (error) {
    return {
      success: false,
      message: 'Falha ao executar query',
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

async function getSystemStats(context: AgentContext): Promise<AgentResult> {
  try {
    const { supabaseAdmin } = context
    
    const [leads, negocios, users] = await Promise.all([
      supabaseAdmin.from('leads').select('status, count(*)').group('status'),
      supabaseAdmin.from('negocios').select('status_negocio, count(*)').group('status_negocio'),
      supabaseAdmin.from('profiles').select('role, count(*)').group('role'),
    ])
    
    return {
      success: true,
      message: 'Estatísticas do sistema',
      data: {
        leads: leads.data,
        negocios: negocios.data,
        users: users.data,
      },
    }
  } catch (error) {
    return {
      success: false,
      message: 'Falha ao obter estatísticas',
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

// =============================================================================
// EDGE FUNCTION PRINCIPAL
// =============================================================================

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }
  
  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405)
  }

  try {
    // Autenticação
    const authResult = await requireAuth(req)
    const context: AgentContext = {
      ...authResult,
    }

    // Obtém o comando
    const body = await req.json()
    const command = body.command as string || body.text as string || ''
    
    if (!command) {
      return jsonResponse({ error: 'Comando não fornecido' }, 400)
    }

    // Extrai ação do comando
    const { action, response: thought } = extractActionFromCommand(command)
    
    if (!action) {
      return jsonResponse({
        thought,
        response: thought,
      })
    }

    // Executa a ação
    const result = await executeAction(action, context)

    // Retorna a resposta
    return jsonResponse({
      thought,
      action,
      response: result.success 
        ? result.message 
        : `Erro: ${result.message}${result.error ? ` - ${result.error}` : ''}`,
      result,
    })

  } catch (error) {
    return jsonResponse(
      {
        error: error instanceof Error ? error.message : 'Erro no Super Agente',
        thought: 'Erro de autenticação ou execução',
        response: 'Ocorreu um erro ao processar o comando',
      },
      500,
    )
  }
})
