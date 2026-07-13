# Agentes IA — Supabase Edge Functions

Neste projeto, **skills e agentes vivem aqui** (`supabase/functions/`), não em `docs/` nem no Cursor.

Cada pasta de função = um agente (código + skill + documentação).

## Mapa

| Agente | Pasta | Doc |
|--------|-------|-----|
| Insight Lead | [`lead-insight/`](./lead-insight/) | [`lead-insight/AGENT.md`](./lead-insight/AGENT.md) |
| Classificador | [`lead-classify/`](./lead-classify/) | [`lead-classify/AGENT.md`](./lead-classify/AGENT.md) |
| Embeddings RAG | [`embed-crm-batch/`](./embed-crm-batch/) | [`embed-crm-batch/AGENT.md`](./embed-crm-batch/AGENT.md) |

## Estrutura de cada agente

```
supabase/functions/<nome>/
  index.ts    # HTTP handler (Deno.serve)
  skill.ts    # prompt + validação (= “skill” do agente)
  AGENT.md    # contrato input/output e regras
```

Shared: [`_shared/`](./_shared/) — CORS + cliente Gemini.

## Contrato HTTP

```
https://<PROJECT_REF>.supabase.co/functions/v1/<function-name>
```

Headers:

- `Authorization: Bearer <anon_or_user_jwt>`
- `Content-Type: application/json`
- `apikey: <anon_key>`

## Secrets

```bash
supabase secrets set GEMINI_API_KEY=sua_chave
supabase secrets set GEMINI_MODEL=gemini-2.5-flash
```

## Deploy

## Deploy (Via Editor / Dashboard)

No Dashboard só sobe o que está em **FILES**. Por isso as functions essenciais
são **arquivo único** (`index.ts` — skill + deps embutidos):

| Function | Só cole |
|----------|---------|
| `embed-crm-batch` | `index.ts` |
| `lead-classify` | `index.ts` |
| `lead-insight` | `index.ts` |
| `manage-users` | `index.ts` |

`skill.ts` e `_shared/` ficam no repo como referência; **não** são enviados pelo Via Editor.

```bash
# alternativa CLI
npm run deploy:edge
```

Secrets: `GEMINI_API_KEY`, `GEMINI_MODEL`, `MISTRAL_API_KEY`, `MISTRAL_MODEL`.

## Front

`src/lib/ai.ts` chama `…/functions/v1/lead-insight` e `…/lead-classify`.

## Specs de produto

Requisitos de UX/negócio continuam em `docs/specs/` (ex.: insight).  
A **implementação do agente** é só esta pasta.
