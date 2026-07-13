# LIQUI

Mini CRM Kanban — Contabilidade Facilitada (desafio Analista de IA Aplicada).

**Documentação Spec-Driven:** comece por [`docs/README.md`](docs/README.md).

## Setup

1. Copie `.env.example` → `.env` (Supabase + Gemini).
2. Auth → Email ativo no Supabase.
3. Schema: no SQL Editor rode **`supabase/upgrade-robusto.sql`** (não apaga o dump do enunciado).
4. IA em produção: deploy das Edge Functions (`supabase/functions/`) + secrets `GEMINI_API_KEY`.

```bash
npm install
npm run dev
```

## Escopo (mínimo do enunciado)

- Kanban com drag persistente
- Ficha consolidada (sideover)
- Insight Gemini sem inventar dados
- Busca + filtros

Detalhes: [`docs/00-enunciado.md`](docs/00-enunciado.md) · critérios: [`docs/01-criterios-avaliacao.md`](docs/01-criterios-avaliacao.md).

## IA = Edge Functions (agentes)

Skills **não** ficam no Cursor. Ver [`supabase/functions/`](supabase/functions/).

| Agente | Função |
|--------|--------|
| Insight | `lead-insight` |
| Classificar | `lead-classify` |

Fallback local de dev: gateway em `npm run dev` (`VITE_AI_PROXY_URL`).

## Rotas

- `/login`, `/cadastro`
- `/leads` — funil Kanban
- `/negocios` — negócios N:1 lead
- `/dashboard` — painel

## Deploy (Render)

Blueprint: [`render.yaml`](render.yaml). Detalhes: [`docs/specs/06-auth-deploy.md`](docs/specs/06-auth-deploy.md).

1. SQL: `migrate-plataforma.sql` + `migrate-pgvector-rag.sql` + `migrate-ai-costs-cron.sql`
2. Deploy Edge Functions + secrets (`GEMINI_API_KEY`, `MISTRAL_API_KEY`, `CRON_SECRET`)
3. Render Blueprint (static + cron 18h BRT)

## Variáveis

| Variável | Onde | Uso |
|----------|------|-----|
| `VITE_SUPABASE_URL` | front / Render build | cliente + base das functions |
| `VITE_SUPABASE_ANON_KEY` | front / Render build | Auth / API |
| `VITE_AI_PROXY_URL` | front | fallback local |
| `GEMINI_API_KEY` | Edge Function secret / `.env` local | Gemini |
| `MISTRAL_API_KEY` | Edge Function secret | embeddings + ações |
| `CRON_SECRET` | Edge + Render Cron | indexação 18h |
| `EMBED_FUNCTION_URL` | Render Cron | URL `embed-crm-batch` |
