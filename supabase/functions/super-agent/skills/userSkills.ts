// =============================================================================
// Skills de Usuários para o Super Agente
// =============================================================================

import type { AgentContext, AgentResult, CreateUserData, UpdateUserData } from '../types.ts';

/** Criar um novo usuário */
export async function createUser(
  data: CreateUserData,
  context: AgentContext,
): Promise<AgentResult> {
  try {
    const { supabaseAdmin } = context;
    
    // Criar usuário no Auth
    const password = data.password || crypto.randomUUID().replace(/-/g, '').slice(0, 12) + 'Aa1!';
    
    const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: password,
      email_confirm: true,
      user_metadata: { full_name: data.full_name },
    });

    if (authError) throw authError;

    const userId = authUser.user?.id;
    if (!userId) throw new Error('Usuário não criado no Auth');

    // Criar perfil no profiles
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .upsert({
        id: userId,
        email: data.email,
        full_name: data.full_name,
        role: data.role,
        active: true,
        menu_access: data.role === 'owner' ? 
          '{ "dashboard": true, "leads": true, "tentativas": true, "pesquisas": true, "negocios": true, "distribuicao": true, "plataforma": true }'::any
          : '{ "dashboard": false, "leads": true, "tentativas": false, "pesquisas": false, "negocios": true, "distribuicao": false, "plataforma": false }'::any,
      });

    if (profileError) throw profileError;

    return {
      success: true,
      message: `Usuário "${data.email}" criado com sucesso! Role: ${data.role}`,
      data: { userId, email: data.email, role: data.role, password: data.password ? '***' : password },
    };
  } catch (error) {
    return {
      success: false,
      message: 'Falha ao criar usuário',
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/** Atualizar um usuário */
export async function updateUser(
  data: UpdateUserData,
  context: AgentContext,
): Promise<AgentResult> {
  try {
    const { supabaseAdmin, isOwner } = context;
    
    // Somente owners podem atualizar outros usuários
    if (data.user_id !== context.userId && !isOwner) {
      return {
        success: false,
        message: 'Permissão negada: apenas owners podem atualizar outros usuários',
      };
    }

    const updates: Record<string, unknown> = {};
    if (data.full_name !== undefined) updates.full_name = data.full_name;
    if (data.role !== undefined) updates.role = data.role;
    if (data.active !== undefined) updates.active = data.active;
    if (data.menu_access !== undefined) updates.menu_access = data.menu_access;

    const { data: profile, error } = await supabaseAdmin
      .from('profiles')
      .update(updates)
      .eq('id', data.user_id)
      .select()
      .single();

    if (error) throw error;

    return {
      success: true,
      message: `Usuário ${data.user_id} atualizado com sucesso!`,
      data: profile,
    };
  } catch (error) {
    return {
      success: false,
      message: 'Falha ao atualizar usuário',
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/** Listar usuários */
export async function listUsers(
  context: AgentContext,
): Promise<AgentResult> {
  try {
    const { supabaseAdmin, isOwner } = context;
    
    // Somente owners podem listar todos os usuários
    if (!isOwner) {
      return {
        success: false,
        message: 'Permissão negada: apenas owners podem listar usuários',
      };
    }

    const { data: users, error } = await supabaseAdmin
      .from('profiles')
      .select('id, email, full_name, role, active, created_at')
      .order('created_at', { ascending: false });

    if (error) throw error;

    return {
      success: true,
      message: `Encontrados ${users?.length || 0} usuários`,
      data: users,
    };
  } catch (error) {
    return {
      success: false,
      message: 'Falha ao listar usuários',
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
