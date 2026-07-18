// =============================================================================
// Report Generator - Gera relatórios para o Super Agente
// =============================================================================

import type { AgentContext, AgentResult, GenerateReportData, Report, ReportType } from './types.ts';

/**
 * Gera um relatório com base no tipo
 */
export async function generateReport(
  data: GenerateReportData,
  context: AgentContext,
): Promise<{ report: Report; result: AgentResult }> {
  const reportId = crypto.randomUUID();
  const generatedAt = new Date().toISOString();
  
  try {
    let reportData: Record<string, unknown>;
    let summary = '';
    
    switch (data.type) {
      case 'leads_daily':
        reportData = await generateLeadsDailyReport(context, data);
        summary = `Relatório diário de leads: ${reportData.total || 0} leads`;
        break;
      case 'leads_weekly':
        reportData = await generateLeadsWeeklyReport(context, data);
        summary = `Relatório semanal de leads: ${reportData.total || 0} leads`;
        break;
      case 'negocios_status':
        reportData = await generateNegociosStatusReport(context, data);
        summary = `Relatório de status de negócios: ${reportData.total || 0} negócios`;
        break;
      case 'users_activity':
        reportData = await generateUsersActivityReport(context, data);
        summary = `Relatório de atividade de usuários: ${reportData.total || 0} usuários ativos`;
        break;
      case 'custom':
        reportData = await generateCustomReport(context, data);
        summary = `Relatório personalizado gerado`;
        break;
      default:
        throw new Error(`Tipo de relatório desconhecido: ${data.type}`);
    }
    
    const report: Report = {
      id: reportId,
      type: data.type,
      generated_at: generatedAt,
      data: reportData,
      summary,
    };
    
    // Se tiver webhook_url, envia automaticamente
    if (data.webhook_url) {
      await sendToWebhook(data.webhook_url, report, context);
    }
    
    return {
      report,
      result: {
        success: true,
        message: `Relatório ${data.type} gerado com sucesso`,
        data: reportData,
      },
    };
  } catch (error) {
    const report: Report = {
      id: reportId,
      type: data.type,
      generated_at: generatedAt,
      data: { error: error instanceof Error ? error.message : String(error) },
      summary: `Erro ao gerar relatório: ${error instanceof Error ? error.message : String(error)}`,
    };
    
    return {
      report,
      result: {
        success: false,
        message: 'Falha ao gerar relatório',
        error: error instanceof Error ? error.message : String(error),
      },
    };
  }
}

/**
 * Gera relatório diário de leads
 */
async function generateLeadsDailyReport(
  context: AgentContext,
  data: GenerateReportData,
): Promise<Record<string, unknown>> {
  const { supabaseAdmin } = context;
  
  const startDate = data.start_date || new Date().toISOString().split('T')[0];
  const endDate = data.end_date || new Date().toISOString().split('T')[0];
  
  // Leads criados hoje
  const { data: newLeads, error: leadsError } = await supabaseAdmin
    .from('leads')
    .select('count(*)')
    .gte('created_at', startDate)
    .lte('created_at', endDate);
  
  // Leads por status
  const { data: leadsByStatus, error: statusError } = await supabaseAdmin
    .from('leads')
    .select('status, count(*)')
    .gte('created_at', startDate)
    .lte('created_at', endDate)
    .group('status');
  
  // Leads por origem
  const { data: leadsByOrigin, error: originError } = await supabaseAdmin
    .from('leads')
    .select('origem, count(*)')
    .gte('created_at', startDate)
    .lte('created_at', endDate)
    .group('origem');
  
  if (leadsError || statusError || originError) {
    throw new Error('Falha ao buscar dados de leads');
  }
  
  return {
    period: { start: startDate, end: endDate },
    total: newLeads?.[0]?.count || 0,
    by_status: leadsByStatus || [],
    by_origin: leadsByOrigin || [],
    generated_at: new Date().toISOString(),
  };
}

/**
 * Gera relatório semanal de leads
 */
async function generateLeadsWeeklyReport(
  context: AgentContext,
  data: GenerateReportData,
): Promise<Record<string, unknown>> {
  const { supabaseAdmin } = context;
  
  const endDate = data.end_date || new Date().toISOString().split('T')[0];
  const startDate = new Date(endDate);
  startDate.setDate(startDate.getDate() - 7);
  
  // Dados da semana
  const { data: weeklyLeads, error } = await supabaseAdmin
    .from('leads')
    .select('*')
    .gte('created_at', startDate.toISOString())
    .lte('created_at', endDate);
  
  if (error) throw error;
  
  // Agrupa por dia
  const byDay: Record<string, number> = {};
  weeklyLeads?.forEach(lead => {
    const date = new Date(lead.created_at).toISOString().split('T')[0];
    byDay[date] = (byDay[date] || 0) + 1;
  });
  
  return {
    period: { start: startDate.toISOString(), end: endDate },
    total: weeklyLeads?.length || 0,
    by_day: byDay,
    generated_at: new Date().toISOString(),
  };
}

/**
 * Gera relatório de status de negócios
 */
async function generateNegociosStatusReport(
  context: AgentContext,
  data: GenerateReportData,
): Promise<Record<string, unknown>> {
  const { supabaseAdmin } = context;
  
  // Negócios por status
  const { data: byStatus, error: statusError } = await supabaseAdmin
    .from('negocios')
    .select('status_negocio, count(*), sum(valor) as total_valor')
    .group('status_negocio');
  
  // Negócios por pipeline
  const { data: byPipeline, error: pipelineError } = await supabaseAdmin
    .from('negocios')
    .select('pipeline_id, count(*)')
    .group('pipeline_id');
  
  // Valor total por status
  const totalByStatus: Record<string, number> = {};
  byStatus?.forEach(item => {
    totalByStatus[item.status_negocio] = Number(item.total_valor || 0);
  });
  
  if (statusError || pipelineError) {
    throw new Error('Falha ao buscar dados de negócios');
  }
  
  return {
    by_status: byStatus || [],
    by_pipeline: byPipeline || [],
    total_value_by_status: totalByStatus,
    total_value: Object.values(totalByStatus).reduce((a, b) => a + b, 0),
    generated_at: new Date().toISOString(),
  };
}

/**
 * Gera relatório de atividade de usuários
 */
async function generateUsersActivityReport(
  context: AgentContext,
  data: GenerateReportData,
): Promise<Record<string, unknown>> {
  const { supabaseAdmin } = context;
  
  // Usuários ativos
  const { data: activeUsers, error: activeError } = await supabaseAdmin
    .from('profiles')
    .select('role, count(*)')
    .eq('active', true)
    .group('role');
  
  // Usuários inativos
  const { data: inactiveUsers, error: inactiveError } = await supabaseAdmin
    .from('profiles')
    .select('role, count(*)')
    .eq('active', false)
    .group('role');
  
  // Últimos logins (via auth.users)
  const { data: recentLogins, error: loginError } = await supabaseAdmin
    .from('auth.users')
    .select('id, email, last_sign_in_at')
    .order('last_sign_in_at', { ascending: false })
    .limit(10);
  
  if (activeError || inactiveError || loginError) {
    throw new Error('Falha ao buscar dados de usuários');
  }
  
  return {
    active_users: activeUsers || [],
    inactive_users: inactiveUsers || [],
    recent_logins: recentLogins || [],
    total_active: activeUsers?.reduce((sum, item) => sum + Number(item.count), 0) || 0,
    total_inactive: inactiveUsers?.reduce((sum, item) => sum + Number(item.count), 0) || 0,
    generated_at: new Date().toISOString(),
  };
}

/**
 * Gera relatório personalizado
 */
async function generateCustomReport(
  context: AgentContext,
  data: GenerateReportData,
): Promise<Record<string, unknown>> {
  const { supabaseAdmin } = context;
  
  if (!data.filters?.query) {
    throw new Error('Query personalizada não fornecida');
  }
  
  // Executa query via REST API (mais seguro)
  const query = data.filters.query as string;
  
  // Validação de segurança
  if (isDangerousQuery(query)) {
    throw new Error('Query bloqueada por segurança');
  }
  
  // Usa a REST API do Supabase
  const response = await fetch(`${context.supabaseUrl}/rest/v1/${getTableFromQuery(query)}`, {
    method: 'GET',
    headers: {
      'apikey': context.anonKey,
      'Authorization': `Bearer ${context.anonKey}`,
      'Content-Type': 'application/json',
    },
  });
  
  if (!response.ok) {
    throw new Error(`REST API error: ${response.status}`);
  }
  
  const result = await response.json();
  
  return {
    query: query,
    result: result,
    count: result?.length || 0,
    generated_at: new Date().toISOString(),
  };
}

/**
 * Verifica se uma query é perigosa
 */
function isDangerousQuery(query: string): boolean {
  const dangerousPatterns = [
    'drop table',
    'delete from',
    'truncate',
    'alter table',
    'update .* set',
    'insert into',
    '--',
    ';',
  ];
  
  const lowerQuery = query.toLowerCase();
  return dangerousPatterns.some(pattern => lowerQuery.includes(pattern));
}

/**
 * Extrai o nome da tabela de uma query SELECT
 */
function getTableFromQuery(query: string): string {
  const match = query.match(/from\s+(\w+)/i);
  return match ? match[1] : 'leads';
}

/**
 * Envia relatório para um webhook
 */
async function sendToWebhook(
  url: string,
  report: Report,
  context: AgentContext,
): Promise<void> {
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Supabase-Project': context.supabaseUrl,
        'X-Report-Type': report.type,
        'X-Report-Id': report.id,
      },
      body: JSON.stringify({
        event: 'report_generated',
        data: report,
        timestamp: new Date().toISOString(),
        source: 'super-agent',
      }),
    });
    
    if (!response.ok) {
      console.warn(`Webhook failed: ${response.status} - ${url}`);
    }
  } catch (error) {
    console.error(`Webhook error: ${error}`);
  }
}

/**
 * Salva o relatório no banco (opcional)
 */
export async function saveReport(
  report: Report,
  context: AgentContext,
): Promise<void> {
  const { supabaseAdmin } = context;
  
  // Cria tabela de relatórios se não existir
  await supabaseAdmin.rpc('create_reports_table_if_not_exists');
  
  await supabaseAdmin.from('agent_reports').insert({
    id: report.id,
    type: report.type,
    data: report.data,
    summary: report.summary,
    generated_at: report.generated_at,
    generated_by: context.userId,
  });
}
