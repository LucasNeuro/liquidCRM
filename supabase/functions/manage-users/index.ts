/**
 * manage-users — arquivo ÚNICO para deploy Via Editor (Dashboard).
 * Secrets: SUPABASE_* automáticos; JWT do owner no Authorization.
 *
 * menu_access é obrigatório no update quando enviado — NÃO engole erro de coluna.
 * Rode supabase/migrate-fix-menu-access.sql se a coluna não existir.
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.0'

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const DEFAULT_CONSULTOR_MENU = {
  dashboard: false,
  leads: true,
  tentativas: false,
  pesquisas: false,
  negocios: true,
  distribuicao: false,
  plataforma: false,
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

function sanitizeMenu(
  raw: unknown,
  role: string,
): Record<string, boolean> {
  const base = { ...DEFAULT_CONSULTOR_MENU }
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    const obj = raw as Record<string, unknown>
    for (const key of Object.keys(base) as (keyof typeof base)[]) {
      if (typeof obj[key] === 'boolean') base[key] = obj[key] as boolean
    }
  }
  if (role === 'owner') {
    return {
      dashboard: true,
      leads: true,
      tentativas: true,
      pesquisas: true,
      negocios: true,
      distribuicao: true,
      plataforma: true,
    }
  }
  base.plataforma = false
  return base
}

async function requireOwner(req: Request) {
  const supabaseUrl = Deno.env.get('SUPABASE_URL') || ''
  const anon = Deno.env.get('SUPABASE_ANON_KEY') || ''
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
  if (!supabaseUrl || !serviceKey) {
    throw new Error('Supabase env ausente')
  }

  const authHeader = req.headers.get('Authorization') || ''
  const userClient = createClient(supabaseUrl, anon || serviceKey, {
    global: { headers: { Authorization: authHeader } },
  })
  const { data: userData, error: userErr } = await userClient.auth.getUser()
  if (userErr || !userData.user) throw new Error('Não autenticado')

  const admin = createClient(supabaseUrl, serviceKey)
  const { data: profile } = await admin
    .from('profiles')
    .select('role, active')
    .eq('id', userData.user.id)
    .maybeSingle()

  if (!profile || profile.role !== 'owner') {
    throw new Error('Acesso restrito a owner')
  }

  return { admin, callerId: userData.user.id }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }
  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405)
  }

  try {
    const { admin } = await requireOwner(req)
    const body = await req.json()
    const action = String(body.action || '')

    if (action === 'create') {
      const email = String(body.email || '').trim().toLowerCase()
      let password = String(body.password || '')
      const full_name =
        String(body.full_name || '').trim() || email.split('@')[0]
      const role = String(body.role || 'consultor')
      if (!email) {
        return jsonResponse({ error: 'E-mail obrigatório' }, 400)
      }
      if (password.length < 6) {
        password = crypto.randomUUID().replace(/-/g, '') + 'Aa1!'
      }
      if (role !== 'owner' && role !== 'consultor') {
        return jsonResponse(
          { error: 'Cargo inválido (owner | consultor)' },
          400,
        )
      }

      const { data, error } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name },
      })
      if (error) throw new Error(error.message)

      const userId = data.user?.id
      if (userId) {
        const menu_access = sanitizeMenu(body.menu_access, role)
        const { error: upsertErr } = await admin.from('profiles').upsert({
          id: userId,
          email,
          full_name,
          role,
          active: true,
          menu_access,
        })
        if (upsertErr) {
          if (/menu_access|column/i.test(upsertErr.message)) {
            throw new Error(
              'Coluna menu_access ausente. Rode migrate-fix-menu-access.sql no SQL Editor e tente de novo.',
            )
          }
          throw new Error(upsertErr.message)
        }
      }
      return jsonResponse({ ok: true, user: data.user })
    }

    if (action === 'update') {
      const user_id = String(body.user_id || '')
      if (!user_id) return jsonResponse({ error: 'user_id obrigatório' }, 400)

      const { data: existing } = await admin
        .from('profiles')
        .select('role')
        .eq('id', user_id)
        .maybeSingle()

      const patch: Record<string, unknown> = {}
      if (body.full_name != null) patch.full_name = String(body.full_name)
      if (body.role != null) {
        const role = String(body.role)
        if (role !== 'owner' && role !== 'consultor') {
          return jsonResponse(
            { error: 'Cargo inválido (owner | consultor)' },
            400,
          )
        }
        patch.role = role
      }
      if (body.active != null) {
        // Owner nunca pode ser desativado
        const targetRole = String(patch.role ?? existing?.role ?? body.role_hint ?? 'consultor')
        if (targetRole !== 'owner') {
          patch.active = Boolean(body.active)
        }
      }

      const roleForPatch = String(
        patch.role ?? existing?.role ?? body.role_hint ?? 'consultor',
      )

      if (body.menu_access != null && typeof body.menu_access === 'object') {
        patch.menu_access = sanitizeMenu(body.menu_access, roleForPatch)
      }

      const { data: updated, error } = await admin
        .from('profiles')
        .update(patch)
        .eq('id', user_id)
        .select('id, menu_access, active, role')
        .maybeSingle()

      if (error) {
        if (
          patch.menu_access != null &&
          /menu_access|column/i.test(error.message)
        ) {
          throw new Error(
            'Coluna menu_access ausente. Rode migrate-fix-menu-access.sql no SQL Editor, depois Salvar de novo. Os toggles NÃO foram gravados.',
          )
        }
        throw new Error(error.message)
      }
      if (!updated) {
        throw new Error('Usuário não encontrado para update')
      }
      return jsonResponse({
        ok: true,
        menu_access: updated.menu_access ?? null,
        profile: updated,
      })
    }

    if (action === 'delete') {
      const user_id = String(body.user_id || '')
      if (!user_id) return jsonResponse({ error: 'user_id obrigatório' }, 400)
      
      // Verificar se o usuário é owner
      const { data: targetProfile } = await admin
        .from('profiles')
        .select('role')
        .eq('id', user_id)
        .maybeSingle()
      
      if (targetProfile?.role === 'owner') {
        return jsonResponse({ error: 'Não é possível deletar um owner' }, 400)
      }
      
      if (body.hard === true) {
        const { error } = await admin.auth.admin.deleteUser(user_id)
        if (error) throw new Error(error.message)
      } else {
        const { error } = await admin
          .from('profiles')
          .update({ active: false })
          .eq('id', user_id)
        if (error) throw new Error(error.message)
      }
      return jsonResponse({ ok: true })
    }

    return jsonResponse({ error: 'action inválida' }, 400)
  } catch (error) {
    return jsonResponse(
      { error: error instanceof Error ? error.message : 'Erro manage-users' },
      500,
    )
  }
})
