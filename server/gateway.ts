import { createServer } from 'node:http'
import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'

loadEnvFile(resolve(process.cwd(), '.env'))

const { classifyLeadPlaybook } = await import('./playbooks/classifyLead.js')
const { generateInsightPlaybook } = await import('./playbooks/generateInsight.js')

const PORT = Number(process.env.AI_PROXY_PORT || 8787)

function loadEnvFile(filePath: string) {
  if (!existsSync(filePath)) return
  const raw = readFileSync(filePath, 'utf8')
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq === -1) continue
    const key = trimmed.slice(0, eq).trim()
    let value = trimmed.slice(eq + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    // Gemini sempre atualiza do .env (evita modelo antigo preso no process)
    if (!(key in process.env) || key.startsWith('GEMINI_')) {
      process.env[key] = value
    }
  }
}

function sendJson(
  res: import('node:http').ServerResponse,
  status: number,
  body: unknown,
) {
  const payload = JSON.stringify(body)
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  })
  res.end(payload)
}

async function readBody(req: import('node:http').IncomingMessage) {
  const chunks: Uint8Array[] = []
  for await (const chunk of req) chunks.push(chunk as Uint8Array)
  if (!chunks.length) return {}
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8')) as Record<
      string,
      unknown
    >
  } catch {
    return {}
  }
}

/**
 * Gateway fino: só despacha para playbooks TypeScript.
 * Prompts: supabase/functions (skill.ts) em prod; pasta skills/ nos playbooks locais.
 */
const server = createServer(async (req, res) => {
  const url = new URL(req.url || '/', `http://${req.headers.host}`)

  if (req.method === 'OPTIONS') {
    return sendJson(res, 204, {})
  }

  if (req.method === 'GET' && url.pathname === '/health') {
    return sendJson(res, 200, {
      ok: true,
      mode: 'playbooks',
      gemini: Boolean(process.env.GEMINI_API_KEY),
      geminiModel: process.env.GEMINI_MODEL || 'gemini-2.5-flash',
      playbooks: ['classifyLead', 'generateInsight'],
    })
  }

  try {
    if (req.method === 'POST' && url.pathname === '/ai/classify') {
      const body = await readBody(req)
      const text = String(body.text || '')
      if (text.trim().length < 2) {
        return sendJson(res, 400, { error: 'Campo text é obrigatório' })
      }
      const result = await classifyLeadPlaybook({
        text,
        leadName: body.leadName ? String(body.leadName) : undefined,
      })
      return sendJson(res, 200, result)
    }

    if (req.method === 'POST' && url.pathname === '/ai/insight') {
      const body = await readBody(req)
      if (!body.leadContext) {
        return sendJson(res, 400, { error: 'leadContext é obrigatório' })
      }
      const result = await generateInsightPlaybook(body.leadContext)
      return sendJson(res, 200, result)
    }

    if (req.method === 'POST' && url.pathname === '/ai/embed-batch') {
      const body = await readBody(req)
      const supabaseUrl = (process.env.VITE_SUPABASE_URL || '').replace(
        /\/$/,
        '',
      )
      const functionsBase =
        process.env.VITE_SUPABASE_FUNCTIONS_URL?.replace(/\/$/, '') ||
        (supabaseUrl ? `${supabaseUrl}/functions/v1` : '')
      const anon = process.env.VITE_SUPABASE_ANON_KEY || ''
      const authHeader =
        (typeof req.headers.authorization === 'string'
          ? req.headers.authorization
          : '') || (anon ? `Bearer ${anon}` : '')

      if (!functionsBase) {
        return sendJson(res, 503, {
          error:
            'VITE_SUPABASE_URL ausente no .env — necessário para proxy embed-crm-batch',
        })
      }

      try {
        const upstream = await fetch(`${functionsBase}/embed-crm-batch`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: authHeader,
            apikey: anon,
          },
          body: JSON.stringify({
            trigger_source: body.trigger_source || 'manual',
          }),
        })
        const text = await upstream.text()
        let payload: unknown = {}
        try {
          payload = JSON.parse(text)
        } catch {
          payload = {
            error:
              upstream.status === 404
                ? 'Edge Function embed-crm-batch não encontrada. Rode: npx supabase functions deploy embed-crm-batch'
                : `Resposta inválida da Edge (HTTP ${upstream.status})`,
          }
        }
        return sendJson(res, upstream.status, payload)
      } catch (err) {
        return sendJson(res, 502, {
          error:
            err instanceof Error
              ? `Proxy embed falhou: ${err.message}`
              : 'Proxy embed falhou',
        })
      }
    }

    return sendJson(res, 404, { error: 'Rota não encontrada' })
  } catch (error) {
    return sendJson(res, 500, {
      error: error instanceof Error ? error.message : 'Erro no playbook',
    })
  }
})

server.listen(PORT, '127.0.0.1', () => {
  console.log(`[liqui] playbooks gateway em http://127.0.0.1:${PORT}`)
})
