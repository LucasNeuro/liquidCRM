// =============================================================================
// Report Skills - Skills de relatórios para o Super Agente
// =============================================================================

import type { AgentContext, AgentResult, GenerateReportData } from '../types.ts';
import { generateReport, saveReport } from '../reportGenerator.ts';
import { broadcastToWebhooks } from '../webhookHandler.ts';

/**
 * Gera um relatório
 */
export async function generateReportSkill(
  data: GenerateReportData,
  context: AgentContext,
): Promise<AgentResult> {
  try {
    const { report, result } = await generateReport(data, context);
    
    // Salva o relatório no banco
    await saveReport(report, context);
    
    // Se tiver webhook_url, já foi enviado automaticamente
    // Se não tiver, broadcast para todos os webhooks configurados
    if (!data.webhook_url) {
      await broadcastToWebhooks('report_generated', report, context);
    }
    
    return {
      ...result,
      data: {
        ...result.data,
        report_id: report.id,
        report_type: report.type,
        generated_at: report.generated_at,
      },
    };
  } catch (error) {
    return {
      success: false,
      message: 'Falha ao gerar relatório',
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Lista relatórios gerados
 */
export async function listReports(
  limit: number = 50,
  context: AgentContext,
): Promise<AgentResult> {
  try {
    const { supabaseAdmin } = context;
    
    const { data, error } = await supabaseAdmin
      .from('agent_reports')
      .select('*')
      .order('generated_at', { ascending: false })
      .limit(limit);
    
    if (error) throw error;
    
    return {
      success: true,
      message: `Encontrados ${data?.length || 0} relatórios`,
      data: data || [],
    };
  } catch (error) {
    return {
      success: false,
      message: 'Falha ao listar relatórios',
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Obtém um relatório específico
 */
export async function getReport(
  id: string,
  context: AgentContext,
): Promise<AgentResult> {
  try {
    const { supabaseAdmin } = context;
    
    const { data, error } = await supabaseAdmin
      .from('agent_reports')
      .select('*')
      .eq('id', id)
      .single();
    
    if (error) throw error;
    if (!data) throw new Error('Relatório não encontrado');
    
    return {
      success: true,
      message: 'Relatório encontrado',
      data,
    };
  } catch (error) {
    return {
      success: false,
      message: 'Falha ao obter relatório',
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Deleta um relatório
 */
export async function deleteReport(
  id: string,
  context: AgentContext,
): Promise<AgentResult> {
  try {
    const { supabaseAdmin } = context;
    
    const { error } = await supabaseAdmin
      .from('agent_reports')
      .delete()
      .eq('id', id);
    
    if (error) throw error;
    
    return {
      success: true,
      message: 'Relatório deletado com sucesso',
    };
  } catch (error) {
    return {
      success: false,
      message: 'Falha ao deletar relatório',
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Agenda um relatório para ser gerado periodicamente
 */
export async function scheduleReport(
  data: {
    type: string;
    cron_expression: string;
    webhook_url?: string;
    filters?: Record<string, unknown>;
  },
  context: AgentContext,
): Promise<AgentResult> {
  try {
    const { supabaseAdmin } = context;
    
    // Cria tabela de agendamentos se não existir
    await supabaseAdmin.rpc('create_schedules_table_if_not_exists');
    
    const { data, error } = await supabaseAdmin
      .from('agent_report_schedules')
      .insert({
        id: crypto.randomUUID(),
        report_type: data.type,
        cron_expression: data.cron_expression,
        webhook_url: data.webhook_url,
        filters: data.filters,
        created_by: context.userId,
        active: true,
      })
      .select()
      .single();
    
    if (error) throw error;
    
    return {
      success: true,
      message: 'Relatório agendado com sucesso',
      data,
    };
  } catch (error) {
    return {
      success: false,
      message: 'Falha ao agendar relatório',
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Lista relatórios agendados
 */
export async function listScheduledReports(
  context: AgentContext,
): Promise<AgentResult> {
  try {
    const { supabaseAdmin } = context;
    
    const { data, error } = await supabaseAdmin
      .from('agent_report_schedules')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    
    return {
      success: true,
      message: `Encontrados ${data?.length || 0} relatórios agendados`,
      data: data || [],
    };
  } catch (error) {
    return {
      success: false,
      message: 'Falha ao listar relatórios agendados',
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
