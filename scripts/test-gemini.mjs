/**
 * Testa se GEMINI_API_KEY no .env está válida.
 * Uso: npm run test:gemini
 */
import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'

const envPath = resolve(process.cwd(), '.env')

function loadEnvFile(filePath) {
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
    if (!(key in process.env)) process.env[key] = value
  }
}

function maskKey(key) {
  if (!key) return '(vazia)'
  if (key.length <= 8) return '********'
  return `${key.slice(0, 4)}…${key.slice(-4)} (${key.length} chars)`
}

async function main() {
  loadEnvFile(envPath)

  const apiKey = (process.env.GEMINI_API_KEY || '').trim()
  const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash'

  console.log('─'.repeat(48))
  console.log('Teste Gemini — LIQUI')
  console.log('─'.repeat(48))
  console.log(`.env:   ${existsSync(envPath) ? 'ok' : 'NÃO ENCONTRADO'}`)
  console.log(`Modelo: ${model}`)
  console.log(`Chave:  ${maskKey(apiKey)}`)

  if (!apiKey) {
    console.error('\n✗ GEMINI_API_KEY ausente. Preencha no .env e tente de novo.')
    process.exit(1)
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`

  console.log('\nChamando Gemini (prompt mínimo)…')

  let response
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
            role: 'user',
            parts: [{ text: 'Responda só com a palavra: OK' }],
          },
        ],
        generationConfig: { temperature: 0, maxOutputTokens: 64 },
      }),
    })
  } catch (err) {
    console.error('\n✗ Falha de rede:', err instanceof Error ? err.message : err)
    process.exit(1)
  }

  const data = await response.json()

  if (!response.ok) {
    const msg = data?.error?.message || JSON.stringify(data)
    console.error(`\n✗ Chave inválida ou erro da API (HTTP ${response.status})`)
    console.error(`  ${msg}`)
    if (String(msg).toLowerCase().includes('no longer available')) {
      console.error(
        '\nDica: troque GEMINI_MODEL no .env (ex.: gemini-2.5-flash).',
      )
    }
    process.exit(1)
  }

  const parts = data?.candidates?.[0]?.content?.parts || []
  const text = parts
    .map((p) => p?.text || '')
    .join('')
    .trim()
  const finish =
    data?.candidates?.[0]?.finishReason ||
    data?.candidates?.[0]?.finish_reason ||
    '—'

  // HTTP 200 com API key aceita = chave válida (modelo pode omitir texto curto)
  console.log(`\n✓ Chave válida (HTTP ${response.status})`)
  console.log(`  finishReason: ${finish}`)
  console.log(`  resposta: "${text || '(sem texto — ok para este teste)'}"`)
  console.log('─'.repeat(48))
  process.exit(0)
}

main()
