// =============================================================================
// Tipos para o Super Agente
// =============================================================================

/** Ações que o Super Agente pode executar */
export type AgentAction = 
  | { type: 'create_lead', data: CreateLeadData }
  | { type: 'update_lead', data: UpdateLeadData }
  | { type: 'delete_lead', data: { id: number } }
  | { type: 'search_leads', data: SearchLeadsData }
  | { type: 'create_negocio', data: CreateNegocioData }
  | { type: 'update_negocio', data: UpdateNegocioData }
  | { type: 'create_user', data: CreateUserData }
  | { type: 'update_user', data: UpdateUserData }
  | { type: 'get_stats', data?: never }
  | { type: 'custom_query', data: { query: string } }
  | { type: 'generate_report', data: GenerateReportData }  // NOVO
  | { type: 'send_webhook', data: SendWebhookData };      // NOVO

/** Dados para criar um lead */
export interface CreateLeadData {
  nome: string;
  email?: string;
  telefone?: string;
  origem?: string;
  produto_interesse?: string;
  empresa_id?: number;
}

/** Dados para atualizar um lead */
export interface UpdateLeadData {
  id: number;
  nome?: string;
  email?: string;
  telefone?: string;
  status?: string;
  origem?: string;
  produto_interesse?: string;
  assigned_to?: string;
  pipeline_id?: string;
  stage_id?: string;
}

/** Dados para buscar leads */
export interface SearchLeadsData {
  query?: string;
  status?: string;
  assigned_to?: string;
  limit?: number;
}

/** Dados para criar um negócio */
export interface CreateNegocioData {
  titulo: string;
  id_lead: number;
  valor?: number;
  status_negocio?: 'aberto' | 'ganho' | 'perdido';
  pipeline_id?: string;
  stage_id?: string;
}

/** Dados para atualizar um negócio */
export interface UpdateNegocioData {
  id: string;
  titulo?: string;
  valor?: number;
  status_negocio?: 'aberto' | 'ganho' | 'perdido';
  pipeline_id?: string;
  stage_id?: string;
}

/** Dados para criar um usuário */
export interface CreateUserData {
  email: string;
  password?: string;
  full_name: string;
  role: 'owner' | 'consultor';
}

/** Dados para atualizar um usuário */
export interface UpdateUserData {
  user_id: string;
  full_name?: string;
  role?: 'owner' | 'consultor';
  active?: boolean;
  menu_access?: Record<string, boolean>;
}

// =============================================================================
// NOVOS TIPOS PARA RELATÓRIOS E WEBHOOKS
// =============================================================================

/** Tipos de relatórios */
export type ReportType = 
  | 'leads_daily'
  | 'leads_weekly'
  | 'negocios_status'
  | 'users_activity'
  | 'custom';

/** Dados para gerar um relatório */
export interface GenerateReportData {
  type: ReportType;
  start_date?: string;  // ISO date
  end_date?: string;    // ISO date
  filters?: Record<string, unknown>;
  webhook_url?: string; // URL para enviar o relatório
}

/** Dados para enviar via webhook */
export interface SendWebhookData {
  url: string;
  method?: 'POST' | 'PUT' | 'PATCH';
  headers?: Record<string, string>;
  body: Record<string, unknown>;
}

/** Estrutura de um relatório */
export interface Report {
  id: string;
  type: ReportType;
  generated_at: string;
  data: Record<string, unknown>;
  summary: string;
}

/** Configuração de webhook */
export interface WebhookConfig {
  id: string;
  name: string;
  url: string;
  events: string[];  // Quais eventos disparar este webhook
  secret?: string;   // Token de segurança
  active: boolean;
}

/** Resultado de uma ação */
export interface AgentResult {
  success: boolean;
  message: string;
  data?: Record<string, unknown>;
  error?: string;
}

/** Contexto do agente */
export interface AgentContext {
  userId: string;
  userEmail: string;
  isOwner: boolean;
  supabaseAdmin: any;
  supabaseUrl: string;
  anonKey: string;
}

/** Comando do usuário */
export interface UserCommand {
  text: string;
  context?: Record<string, unknown>;
}

/** Resposta do agente */
export interface AgentResponse {
  thought: string;
  action: AgentAction | null;
  response: string;
  result?: AgentResult;
  report?: Report;          // NOVO: Relatórios gerados
  webhook_sent?: boolean;   // NOVO: Indica se foi enviado via webhook
}

/** Configuração do sistema */
export interface SystemConfig {
  webhooks: WebhookConfig[];
  report_schedules: {
    leads_daily: string;    // Cron expression
    leads_weekly: string;
    negocios_status: string;
  };
}
