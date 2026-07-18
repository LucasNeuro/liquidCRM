// =============================================================================
// Webhook Handler - Gerencia envio e recebimento de webhooks
// =============================================================================

import type { AgentContext, WebhookConfig, SendWebhookData, AgentResult } from './types.ts';

/**
 * Lista de webhooks configurados (pode ser movido para o banco no futuro)
 */
const DEFAULT_WEBHOOKS: WebhookConfig[] = [
  {
    id: 'slack-main',
    name: 'Slack - Notificações Principais',
    url: 'https://hooks.slack.com/services/YOUR/SLACK/WEBHOOK',
    events: ['report_generated', 'lead_created', 'negocio_created'],
    active: true,
  },
  {
    id: 'discord-alerts',
    name: 'Discord - Alertas',
    url: 'https://discord.com/api/webhooks/YOUR/DISCORD/WEBHOOK',
    events: ['report_generated', 'error'],
    active: true,
  },
  {
    id: 'zapier-integration',
    name: 'Zapier - Integração',
    url: 'https://hooks.zapier.com/hooks/catch/YOUR/ZAPIER/WEBHOOK',
    events: ['report_generated', 'lead_created', 'negocio_created', 'user_created'],
    active: true,
  },
];

/**
 * Envia dados para um webhook
 */
export async function sendToWebhook(
  data: SendWebhookData,
  context: AgentContext,
): Promise<AgentResult> {
  try {
    const response = await fetch(data.url, {
      method: data.method || 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Supabase-Project': context.supabaseUrl,
        'X-Sender': 'super-agent',
        'X-Timestamp': new Date().toISOString(),
        ...data.headers,
      },
      body: JSON.stringify(data.body),
    });
    
    if (!response.ok) {
      return {
        success: false,
        message: `Webhook falhou: ${response.status}`,
        error: await response.text(),
      };
    }
    
    return {
      success: true,
      message: 'Dados enviados para webhook com sucesso',
      data: { status: response.status },
    };
  } catch (error) {
    return {
      success: false,
      message: 'Falha ao enviar para webhook',
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Envia para todos os webhooks configurados para um evento
 */
export async function broadcastToWebhooks(
  event: string,
  payload: Record<string, unknown>,
  context: AgentContext,
): Promise<{ sent: number; failed: number }> {
  const webhooks = await getWebhookConfigs(context);
  const eventWebhooks = webhooks.filter(
    wh => wh.active && wh.events.includes(event)
  );
  
  let sent = 0;
  let failed = 0;
  
  for (const webhook of eventWebhooks) {
    try {
      const result = await sendToWebhook({
        url: webhook.url,
        method: 'POST',
        headers: webhook.secret ? { 'X-Webhook-Secret': webhook.secret } : undefined,
        body: {
          event,
          payload,
          timestamp: new Date().toISOString(),
          source: 'super-agent',
          project: context.supabaseUrl,
        },
      }, context);
      
      if (result.success) {
        sent++;
      } else {
        failed++;
        console.warn(`Webhook ${webhook.name} falhou: ${result.error}`);
      }
    } catch (error) {
      failed++;
      console.error(`Webhook ${webhook.name} error: ${error}`);
    }
  }
  
  return { sent, failed };
}

/**
 * Obtém as configurações de webhooks
 */
async function getWebhookConfigs(context: AgentContext): Promise<WebhookConfig[]> {
  const { supabaseAdmin } = context;
  
  // Tenta buscar do banco
  try {
    const { data, error } = await supabaseAdmin
      .from('agent_webhooks')
      .select('*');
    
    if (!error && data && data.length > 0) {
      return data as WebhookConfig[];
    }
  } catch {
    // Se não existir tabela, usa os defaults
  }
  
  // Retorna os defaults
  return DEFAULT_WEBHOOKS;
}

/**
 * Adiciona um novo webhook
 */
export async function addWebhook(
  config: Omit<WebhookConfig, 'id' | 'active'>,
  context: AgentContext,
): Promise<AgentResult> {
  try {
    const { supabaseAdmin } = context;
    
    // Cria tabela se não existir
    await supabaseAdmin.rpc('create_webhooks_table_if_not_exists');
    
    const { data, error } = await supabaseAdmin
      .from('agent_webhooks')
      .insert({
        ...config,
        id: crypto.randomUUID(),
        active: true,
      })
      .select()
      .single();
    
    if (error) throw error;
    
    return {
      success: true,
      message: 'Webhook adicionado com sucesso',
      data,
    };
  } catch (error) {
    return {
      success: false,
      message: 'Falha ao adicionar webhook',
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Remove um webhook
 */
export async function removeWebhook(
  id: string,
  context: AgentContext,
): Promise<AgentResult> {
  try {
    const { supabaseAdmin } = context;
    
    const { error } = await supabaseAdmin
      .from('agent_webhooks')
      .delete()
      .eq('id', id);
    
    if (error) throw error;
    
    return {
      success: true,
      message: 'Webhook removido com sucesso',
    };
  } catch (error) {
    return {
      success: false,
      message: 'Falha ao remover webhook',
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Lista todos os webhooks
 */
export async function listWebhooks(
  context: AgentContext,
): Promise<AgentResult> {
  try {
    const webhooks = await getWebhookConfigs(context);
    
    return {
      success: true,
      message: `Encontrados ${webhooks.length} webhooks`,
      data: webhooks,
    };
  } catch (error) {
    return {
      success: false,
      message: 'Falha ao listar webhooks',
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Testa um webhook
 */
export async function testWebhook(
  id: string,
  context: AgentContext,
): Promise<AgentResult> {
  try {
    const webhooks = await getWebhookConfigs(context);
    const webhook = webhooks.find(wh => wh.id === id);
    
    if (!webhook) {
      return {
        success: false,
        message: 'Webhook não encontrado',
      };
    }
    
    const result = await sendToWebhook({
      url: webhook.url,
      method: 'POST',
      body: {
        test: true,
        message: 'Teste de webhook do Super Agente',
        timestamp: new Date().toISOString(),
      },
    }, context);
    
    return result;
  } catch (error) {
    return {
      success: false,
      message: 'Falha ao testar webhook',
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
