/**
 * Deploy das Edge Functions essenciais do LIQUI (com _shared).
 * NÃO use o editor "Via Editor" do Dashboard — ele não envia ../_shared.
 *
 * Uso:
 *   node scripts/deploy-edge.mjs
 *   node scripts/deploy-edge.mjs embed-crm-batch
 */
import { spawnSync } from 'node:child_process'

const PROJECT_REF = 'nnhiyqtzzjfxnxgmufgo'

const ALL = [
  'lead-insight',
  'lead-classify',
  'embed-crm-batch',
  'manage-users',
]

const only = process.argv.slice(2).filter((a) => !a.startsWith('-'))
const names = only.length ? only : ALL

console.log(`[deploy-edge] project-ref=${PROJECT_REF}`)
console.log(`[deploy-edge] functions: ${names.join(', ')}`)
console.log(
  '[deploy-edge] Dica: secrets GEMINI_* / MISTRAL_* já devem estar no Dashboard.\n',
)

for (const name of names) {
  console.log(`\n=== deploy ${name} ===`)
  const result = spawnSync(
    'npx',
    [
      'supabase',
      'functions',
      'deploy',
      name,
      '--project-ref',
      PROJECT_REF,
      '--no-verify-jwt',
      '--use-api',
    ],
    { stdio: 'inherit', shell: true, cwd: process.cwd() },
  )
  if (result.status !== 0) {
    console.error(`\n[deploy-edge] falhou: ${name} (exit ${result.status})`)
    console.error(
      'Confirme: npx supabase login  (e token com acesso ao projeto)',
    )
    process.exit(result.status || 1)
  }
}

console.log('\n[deploy-edge] ok. Teste Plataforma → Rodar indexação.')
