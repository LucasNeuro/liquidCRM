/**
 * manage-users — arquivo ÚNICO para deploy Via Editor (Dashboard).
 * Secrets: SUPABASE_* automáticos; JWT do owner no Authorization.
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.0'

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
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

  if (!profile || profile.role !== 'owner' || profile.active === false) {
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
      const password = String(body.password || '')
      const full_name =
        String(body.full_name || '').trim() || email.split('@')[0]
      const role = String(body.role || 'consultor')
      if (!email || password.length < 6) {
        return jsonResponse(
          { error: 'E-mail e senha (mín. 6) obrigatórios' },
          400,
        )
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
        await admin.from('profiles').upsert({
          id: userId,
          email,
          full_name,
          role,
          active: true,
        })
      }
      return jsonResponse({ ok: true, user: data.user })
    }

    if (action === 'update') {
      const user_id = String(body.user_id || '')
      if (!user_id) return jsonResponse({ error: 'user_id obrigatório' }, 400)
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
      if (body.active != null) patch.active = Boolean(body.active)
      const { error } = await admin
        .from('profiles')
        .update(patch)
        .eq('id', user_id)
      if (error) throw new Error(error.message)
      return jsonResponse({ ok: true })
    }

    if (action === 'delete') {
      const user_id = String(body.user_id || '')
      if (!user_id) return jsonResponse({ error: 'user_id obrigatório' }, 400)
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
