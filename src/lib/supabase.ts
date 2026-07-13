import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim()
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim()

const urlOk =
  Boolean(supabaseUrl) &&
  /^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/i.test(supabaseUrl || '') &&
  !supabaseUrl?.includes('seu-projeto')

const keyOk =
  Boolean(supabaseAnonKey) &&
  supabaseAnonKey !== 'sua-anon-key' &&
  (supabaseAnonKey?.length ?? 0) > 40

if (!urlOk || !keyOk) {
  console.warn(
    '[LIQUI] Configure VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY no .env com o projeto real e reinicie o npm run dev.',
  )
}

export const supabaseConfigured = urlOk && keyOk

export const supabase = createClient(
  urlOk ? supabaseUrl! : 'https://placeholder.supabase.co',
  keyOk ? supabaseAnonKey! : 'placeholder',
)
