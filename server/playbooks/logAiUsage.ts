import { createClient } from '@supabase/supabase-js'

/** Registra custo estimado em ai_usage_events (Plataforma Owner). */
export async function logAiUsage(input: {
  provider: 'gemini' | 'mistral'
  operation: string
  model_name?: string
  units?: number
  estimated_cost_usd: number
  meta?: Record<string, unknown>
}) {
  const url = (process.env.VITE_SUPABASE_URL || '').replace(/\/$/, '')
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.VITE_SUPABASE_ANON_KEY ||
    ''
  if (!url || !key) return

  try {
    const admin = createClient(url, key)
    await admin.from('ai_usage_events').insert({
      provider: input.provider,
      operation: input.operation,
      model_name: input.model_name ?? null,
      units: input.units ?? 1,
      estimated_cost_usd: input.estimated_cost_usd,
      meta: input.meta ?? {},
    })
  } catch (err) {
    console.warn('[ai-usage] falha ao gravar', err)
  }
}
