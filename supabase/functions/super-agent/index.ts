/**
 * Super Agente - Assistente Conversacional do CRM
 * 
 * Este agente permite executar operações no CRM via comandos em linguagem natural.
 * Requer autenticação como owner ou consultor com permissões.
 * 
 * Uso:
 * POST /functions/v1/super-agent
 * Body: { "command": "Crie um lead para João com email joao@teste.com" }
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.0'
import type { AgentAction, AgentResponse, UserCommand, AgentContext, AgentResult } from './types.ts'
import * as leadSkills from './skills/leadSkills.ts'
import * as negocioSkills from './skills/negocioSkills.ts'
import * as userSkills from './skills/userSkills.ts'

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

/**
 * Extrai ação e dados de um comando usando regra simples (sem IA)
 * Futuro: integrar com Gemini/Mistral para interpretação mais inteligente
 */
function extractActionFromCommand(command: string): { action: AgentAction | null, response: string } {
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
            role: roleMatch ? roleMatch[1] as 'owner' | 'consultor' : 'consultor',
          },
        },
        response: `Vou criar um usuário para ${emailMatch[1].trim()}`,
      }
    }
  }
  
  // Buscar leads
  if (cmd.includes('buscar lead') || cmd.includes('listar lead') || cmd.includes('mostrar lead')) {
    const statusMatch = cmd.match(/(?:status|estado|filtrar por)[^:]*:?\s*(\S+)/i)
    
    return {
      action: {
        type: 'search_leads',
        data: {
          status: statusMatch ? statusMatch[1] : undefined,
          limit: 50,
        },
      },
      response: 'Vou buscar os leads' + (statusMatch ? ` com status "${statusMatch[1]}"` : ''),
    }
  }
  
  // Estatísticas
  if (cmd.includes('estatística') || cmd.includes('stats') || cmd.includes('relatório')) {
    return {
      action: { type: 'get_stats', data: undefined },
      response: 'Vou gerar as estatísticas do sistema',
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
  
  // Comando não reconhecido
  return {
    action: null,
    response: 'Desculpe, não entendi o comando. Tente: "Crie um lead para João", "Atualize o lead 123", "Mostre estatísticas"',
  }
}

/**
 * Executa uma ação
 */
async function executeAction(action: AgentAction, context: AgentContext): Promise<AgentResult> {
  switch (action.type) {
    case 'create_lead':
      return leadSkills.createLead(action.data, context)
    case 'update_lead':
      return leadSkills.updateLead(action.data, context)
    case 'delete_lead':
      return leadSkills.deleteLead(action.data.id, context)
    case 'search_leads':
      return leadSkills.searchLeads(action.data, context)
    case 'create_negocio':
      return negocioSkills.createNegocio(action.data, context)
    case 'update_negocio':
      return negocioSkills.updateNegocio(action.data, context)
    case 'create_user':
      return userSkills.createUser(action.data, context)
    case 'update_user':
      return userSkills.updateUser(action.data, context)
    case 'get_stats':
      return getSystemStats(context)
    case 'custom_query':
      return executeCustomQuery(action.data.query, context)
    default:
      return { success: false, message: 'Ação não implementada' }
  }
}

/**
 * Obtém estatísticas do sistema
 */
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

/**
 * Executa uma query personalizada
 */
async function executeCustomQuery(query: string, context: AgentContext): Promise<AgentResult> {
  try {
    const { supabaseAdmin } = context
    
    // Validação básica para evitar queries perigosas
    const dangerousPatterns = ['drop table', 'delete from', 'truncate', 'alter table', 'update .* set']
    const isDangerous = dangerousPatterns.some(pattern => 
      query.toLowerCase().includes(pattern)
    )
    
    if (isDangerous) {
      return {
        success: false,
        message: 'Query bloqueada por segurança',
      }
    }
    
    const { data, error } = await supabaseAdmin.rpc('run_custom_query', { query_text: query })
    
    if (error) throw error
    
    return {
      success: true,
      message: 'Query executada com sucesso',
      data,
    }
  } catch (error) {
    return {
      success: false,
      message: 'Falha ao executar query',
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

/**
 * Verifica se o usuário é owner
 */
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

/**
 * Função para requerer autenticação
 */
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
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }
  
  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405)
  }

  try {
    // Autenticação
    const { admin, callerId, callerEmail, isOwner } = await requireAuth(req)
    const context: AgentContext = {
      userId: callerId,
      userEmail: callerEmail,
      isOwner,
      supabaseAdmin: admin,
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
        action: null,
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
        action: null,
        response: 'Ocorreu um erro ao processar o comando',
      },
      500,
    )
  }
})
