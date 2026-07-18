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
  | { type: 'custom_query', data: { query: string } };

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
}

/** Comando do usuário */
export interface UserCommand {
  text: string;
  context?: Record<string, unknown>;
}

/** Resposta do agente */
export interface AgentResponse {
  thought: string;  // Processamento interno (para debug)
  action: AgentAction | null;
  response: string;  // Resposta em linguagem natural
  result?: AgentResult;
}
