import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.0'

export type AiProvider = 'gemini' | 'mistral'

/** Persistência de custo estimado — alimenta v_ai_cost_resumo / Plataforma. */
export async function logAiUsage(input: {
  provider: AiProvider
  operation: string
  model_name?: string
  units?: number
  estimated_cost_usd: number
  meta?: Record<string, unknown>
  created_by?: string | null
}) {
  const supabaseUrl = Deno.env.get('SUPABASE_URL') || ''
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
  if (!supabaseUrl || !serviceKey) return

  try {
    const admin = createClient(supabaseUrl, serviceKey)
    await admin.from('ai_usage_events').insert({
      provider: input.provider,
      operation: input.operation,
      model_name: input.model_name ?? null,
      units: input.units ?? 1,
      estimated_cost_usd: input.estimated_cost_usd,
      meta: input.meta ?? {},
      created_by: input.created_by ?? null,
    })
  } catch {
    /* métrica nunca derruba o agente */
  }
}
