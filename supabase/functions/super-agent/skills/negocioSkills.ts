// =============================================================================
// Skills de Negócios para o Super Agente
// =============================================================================

import type { AgentContext, AgentResult, CreateNegocioData, UpdateNegocioData } from '../types.ts';

/** Criar um novo negócio */
export async function createNegocio(
  data: CreateNegocioData,
  context: AgentContext,
): Promise<AgentResult> {
  try {
    const { supabaseAdmin } = context;
    
    const { data: negocio, error } = await supabaseAdmin
      .from('negocios')
      .insert({
        titulo: data.titulo,
        id_lead: data.id_lead,
        valor: data.valor || 0,
        status_negocio: data.status_negocio || 'aberto',
        pipeline_id: data.pipeline_id,
        stage_id: data.stage_id,
      })
      .select()
      .single();

    if (error) throw error;

    return {
      success: true,
      message: `Negócio "${data.titulo}" criado com sucesso!`,
      data: negocio,
    };
  } catch (error) {
    return {
      success: false,
      message: 'Falha ao criar negócio',
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/** Atualizar um negócio */
export async function updateNegocio(
  data: UpdateNegocioData,
  context: AgentContext,
): Promise<AgentResult> {
  try {
    const { supabaseAdmin } = context;
    
    const updates: Record<string, unknown> = {};
    if (data.titulo !== undefined) updates.titulo = data.titulo;
    if (data.valor !== undefined) updates.valor = data.valor;
    if (data.status_negocio !== undefined) updates.status_negocio = data.status_negocio;
    if (data.pipeline_id !== undefined) updates.pipeline_id = data.pipeline_id;
    if (data.stage_id !== undefined) updates.stage_id = data.stage_id;

    const { data: negocio, error } = await supabaseAdmin
      .from('negocios')
      .update(updates)
      .eq('id', data.id)
      .select()
      .single();

    if (error) throw error;

    return {
      success: true,
      message: `Negócio ${data.id} atualizado com sucesso!`,
      data: negocio,
    };
  } catch (error) {
    return {
      success: false,
      message: 'Falha ao atualizar negócio',
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/** Buscar negócios */
export async function searchNegocios(
  query: string,
  context: AgentContext,
): Promise<AgentResult> {
  try {
    const { supabaseAdmin } = context;
    
    const { data: negocios, error } = await supabaseAdmin
      .from('negocios')
      .select('*')
      .or(`titulo.ilike.%${query}%,codigo.ilike.%${query}%`)
      .limit(50);

    if (error) throw error;

    return {
      success: true,
      message: `Encontrados ${negocios?.length || 0} negócios`,
      data: negocios,
    };
  } catch (error) {
    return {
      success: false,
      message: 'Falha ao buscar negócios',
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/** Obter estatísticas de negócios */
export async function getNegociosStats(
  context: AgentContext,
): Promise<AgentResult> {
  try {
    const { supabaseAdmin } = context;
    
    const { data: stats, error } = await supabaseAdmin
      .from('negocios')
      .select('status_negocio, count(*)')
      .group('status_negocio');

    if (error) throw error;

    return {
      success: true,
      message: 'Estatísticas de negócios',
      data: stats,
    };
  } catch (error) {
    return {
      success: false,
      message: 'Falha ao obter estatísticas',
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
