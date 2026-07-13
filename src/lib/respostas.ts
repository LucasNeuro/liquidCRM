import { supabase } from './supabase'
import type { RespostaPesquisa } from './types'

export async function fetchRespostas(includeArchived = false) {
  let q = supabase
    .from('respostas_pesquisa')
    .select('*')
    .order('id', { ascending: true })
  if (!includeArchived) q = q.is('archived_at', null)
  const { data, error } = await q
  if (error) {
    if (!includeArchived && /archived_at/i.test(error.message)) {
      const fallback = await supabase
        .from('respostas_pesquisa')
        .select('*')
        .order('id', { ascending: true })
      if (fallback.error) throw new Error(fallback.error.message)
      return (fallback.data ?? []) as RespostaPesquisa[]
    }
    throw new Error(error.message)
  }
  return (data ?? []) as RespostaPesquisa[]
}

export async function updateRespostaMomento(id: number, momento_compra: string) {
  const { error } = await supabase
    .from('respostas_pesquisa')
    .update({ momento_compra })
    .eq('id', id)
  if (error) throw new Error(error.message)
}

export async function updateResposta(
  id: number,
  patch: Partial<RespostaPesquisa>,
) {
  const { error } = await supabase
    .from('respostas_pesquisa')
    .update(patch)
    .eq('id', id)
  if (error) throw new Error(error.message)
}

export async function createResposta(
  row: Omit<RespostaPesquisa, 'id' | 'archived_at'>,
) {
  const { data, error } = await supabase
    .from('respostas_pesquisa')
    .insert(row)
    .select('*')
    .single()
  if (error) throw new Error(error.message)
  return data as RespostaPesquisa
}

export async function archiveResposta(id: number) {
  const { error } = await supabase
    .from('respostas_pesquisa')
    .update({ archived_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw new Error(error.message)
}

export async function deleteResposta(id: number) {
  const { error } = await supabase
    .from('respostas_pesquisa')
    .delete()
    .eq('id', id)
  if (error) throw new Error(error.message)
}

export const MOMENTOS_COMPRA = [
  'só pesquisando',
  'em alguns meses',
  'quero comprar já',
] as const

export function emptyResposta(): RespostaPesquisa {
  return {
    id: 0,
    nome: '',
    email: null,
    telefone: null,
    momento_compra: 'só pesquisando',
    principal_objecao: null,
    area_interesse: null,
    nota_intencao: null,
    data_resposta: null,
    id_lead: null,
  }
}
