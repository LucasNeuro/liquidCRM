// =============================================================================
// Skills de Leads para o Super Agente
// =============================================================================

import type { AgentContext, AgentResult, CreateLeadData, UpdateLeadData, SearchLeadsData } from '../types.ts';

/** Criar um novo lead */
export async function createLead(
  data: CreateLeadData,
  context: AgentContext,
): Promise<AgentResult> {
  try {
    const { supabaseAdmin } = context;
    
    const { data: lead, error } = await supabaseAdmin
      .from('leads')
      .insert({
        nome: data.nome,
        email: data.email,
        telefone: data.telefone,
        origem: data.origem || 'super-agent',
        produto_interesse: data.produto_interesse,
        empresa_id: data.empresa_id,
      })
      .select()
      .single();

    if (error) throw error;

    return {
      success: true,
      message: `Lead "${data.nome}" criado com sucesso!`,
      data: lead,
    };
  } catch (error) {
    return {
      success: false,
      message: 'Falha ao criar lead',
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/** Atualizar um lead */
export async function updateLead(
  data: UpdateLeadData,
  context: AgentContext,
): Promise<AgentResult> {
  try {
    const { supabaseAdmin } = context;
    
    const updates: Record<string, unknown> = {};
    if (data.nome !== undefined) updates.nome = data.nome;
    if (data.email !== undefined) updates.email = data.email;
    if (data.telefone !== undefined) updates.telefone = data.telefone;
    if (data.status !== undefined) updates.status = data.status;
    if (data.origem !== undefined) updates.origem = data.origem;
    if (data.produto_interesse !== undefined) updates.produto_interesse = data.produto_interesse;
    if (data.assigned_to !== undefined) updates.assigned_to = data.assigned_to;
    if (data.pipeline_id !== undefined) updates.pipeline_id = data.pipeline_id;
    if (data.stage_id !== undefined) updates.stage_id = data.stage_id;

    const { data: lead, error } = await supabaseAdmin
      .from('leads')
      .update(updates)
      .eq('id_lead', data.id)
      .select()
      .single();

    if (error) throw error;

    return {
      success: true,
      message: `Lead ${data.id} atualizado com sucesso!`,
      data: lead,
    };
  } catch (error) {
    return {
      success: false,
      message: 'Falha ao atualizar lead',
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/** Deletar um lead */
export async function deleteLead(
  id: number,
  context: AgentContext,
): Promise<AgentResult> {
  try {
    const { supabaseAdmin } = context;
    
    const { error } = await supabaseAdmin
      .from('leads')
      .delete()
      .eq('id_lead', id);

    if (error) throw error;

    return {
      success: true,
      message: `Lead ${id} deletado com sucesso!`,
    };
  } catch (error) {
    return {
      success: false,
      message: 'Falha ao deletar lead',
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/** Buscar leads */
export async function searchLeads(
  data: SearchLeadsData,
  context: AgentContext,
): Promise<AgentResult> {
  try {
    const { supabaseAdmin } = context;
    
    let query = supabaseAdmin.from('leads').select('*');
    
    if (data.query) {
      query = query.or(`nome.ilike.%${data.query}%,email.ilike.%${data.query}%`);
    }
    if (data.status) {
      query = query.eq('status', data.status);
    }
    if (data.assigned_to) {
      query = query.eq('assigned_to', data.assigned_to);
    }
    if (data.limit) {
      query = query.limit(data.limit);
    }

    const { data: leads, error } = await query;

    if (error) throw error;

    return {
      success: true,
      message: `Encontrados ${leads?.length || 0} leads`,
      data: leads,
    };
  } catch (error) {
    return {
      success: false,
      message: 'Falha ao buscar leads',
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
