import { supabase } from './supabase'
import type { TentativaCompra } from './types'

export async function fetchTentativas(includeArchived = false) {
  let q = supabase
    .from('tentativas_compra')
    .select('*')
    .order('id', { ascending: true })
  if (!includeArchived) q = q.is('archived_at', null)
  const { data, error } = await q
  if (error) {
    if (!includeArchived && /archived_at/i.test(error.message)) {
      const fallback = await supabase
        .from('tentativas_compra')
        .select('*')
        .order('id', { ascending: true })
      if (fallback.error) throw new Error(fallback.error.message)
      return (fallback.data ?? []) as TentativaCompra[]
    }
    throw new Error(error.message)
  }
  return (data ?? []) as TentativaCompra[]
}

export async function updateTentativaStatus(
  id: number,
  status_pagamento: string,
) {
  const { error } = await supabase
    .from('tentativas_compra')
    .update({ status_pagamento })
    .eq('id', id)
  if (error) throw new Error(error.message)
}

export async function updateTentativa(
  id: number,
  patch: Partial<TentativaCompra>,
) {
  const { error } = await supabase
    .from('tentativas_compra')
    .update(patch)
    .eq('id', id)
  if (error) throw new Error(error.message)
}

export async function createTentativa(
  row: Omit<TentativaCompra, 'id' | 'archived_at'>,
) {
  const { data, error } = await supabase
    .from('tentativas_compra')
    .insert(row)
    .select('*')
    .single()
  if (error) throw new Error(error.message)
  return data as TentativaCompra
}

export async function archiveTentativa(id: number) {
  const { error } = await supabase
    .from('tentativas_compra')
    .update({ archived_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw new Error(error.message)
}

export async function deleteTentativa(id: number) {
  const { error } = await supabase
    .from('tentativas_compra')
    .delete()
    .eq('id', id)
  if (error) throw new Error(error.message)
}

export const TENTATIVA_STATUSES = [
  'aprovado',
  'pendente',
  'recusado',
  'abandonado',
  'em análise',
] as const

export function emptyTentativa(): TentativaCompra {
  return {
    id: 0,
    nome: '',
    email: null,
    telefone: null,
    produto: null,
    valor: null,
    forma_pagamento: null,
    status_pagamento: 'pendente',
    data_tentativa: null,
    id_lead: null,
  }
}
