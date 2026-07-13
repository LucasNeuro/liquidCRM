export type Lead = {
  id_lead: number
  nome: string
  email: string | null
  telefone: string | null
  origem: string | null
  produto_interesse: string | null
  status: string | null
  data_entrada: string | null
  score_gemini: number | null
  intent_gemini: string | null
  labels_gemini: string[] | null
  created_at?: string | null
  pipeline_id?: string | null
  stage_id?: string | null
  archived_at?: string | null
}

export type TentativaCompra = {
  id: number
  nome: string
  email: string | null
  telefone: string | null
  produto: string | null
  valor: number | null
  forma_pagamento: string | null
  status_pagamento: string | null
  data_tentativa: string | null
  id_lead?: number | null
  archived_at?: string | null
}

export type RespostaPesquisa = {
  id: number
  nome: string
  email: string | null
  telefone: string | null
  momento_compra: string | null
  principal_objecao: string | null
  area_interesse: string | null
  nota_intencao: number | null
  data_resposta: string | null
  id_lead?: number | null
  archived_at?: string | null
}

export type LeadInsight = {
  id?: string
  id_lead?: number
  titulo?: string | null
  resumo: string
  proximo_passo: string
  riscos: string[]
  evidencias: string[]
  markdown?: string | null
  model_name: string
  created_at?: string
}

export type Negocio = {
  id: string
  codigo: string | null
  titulo: string
  id_lead: number
  valor: number
  status_negocio: 'aberto' | 'ganho' | 'perdido'
  pipeline_id: string | null
  stage_id: string | null
  created_at?: string
  updated_at?: string
  archived_at?: string | null
}

export const FUNNEL_COLUMNS = [
  'Novo',
  'Em contato',
  'Qualificado',
  'Ganho',
  'Perdido',
] as const

export type FunnelStatus = (typeof FUNNEL_COLUMNS)[number]
