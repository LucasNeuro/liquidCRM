# Spec 06 — Auth e deploy

## Auth

- Provider: e-mail/senha Supabase Auth.
- Rotas: `/login`, `/cadastro`.
- App autenticada atrás de `ProtectedRoute`.
- Perfil em `profiles` (`role`: `owner` | `consultor`).
- Aba **Plataforma** só para `role = owner`.

## Custos IA (tabelas auxiliares)

| Objeto | Uso |
|--------|-----|
| `ai_usage_events` | cada chamada Gemini/Mistral com `estimated_cost_usd` |
| `v_ai_cost_resumo` | KPIs ao vivo (Gemini, Mistral, chunks) |
| `v_ai_cost_daily` | breakdown diário BRT |
| `embedding_jobs` | histórico + custo por indexação |

SQL: `supabase/migrate-plataforma.sql` + `supabase/migrate-ai-costs-cron.sql`.  
Realtime na tela Plataforma (subscription nas tabelas de custo / jobs / chunks).

## Cron indexação 18h

1. **Render Cron** (recomendado): serviço `liqui-embed-18h` em `render.yaml`
   - Agenda: `0 21 * * *` (18:00 BRT)
   - Chama `POST .../functions/v1/embed-crm-batch` com `{ "trigger_source": "cron" }`
   - Secrets: `EMBED_FUNCTION_URL`, `CRON_SECRET` (mesmo valor no secret da Edge Function)

2. **Alternativa Supabase pg_cron**: script comentado em `migrate-ai-costs-cron.sql`.

## Deploy no Render

1. Rode no Supabase: `migrate-plataforma.sql`, `migrate-pgvector-rag.sql`, `migrate-ai-costs-cron.sql`.
2. Deploy Edge Functions + secrets: `GEMINI_API_KEY`, `MISTRAL_API_KEY`, `CRON_SECRET`.
3. Render → Blueprint com `render.yaml` **ou** Static Site manual:
   - Build: `npm ci && npm run build`
   - Publish: `dist`
   - Rewrite SPA: `/*` → `/index.html`
4. Env **build** do static site:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   - `VITE_SUPABASE_FUNCTIONS_URL` (opcional)
5. Cron: `EMBED_FUNCTION_URL=https://<ref>.supabase.co/functions/v1/embed-crm-batch` + `CRON_SECRET`.

### Por que Render + Supabase

- Front estático barato no Render.
- Auth, Postgres, pgvector e Edge Functions no Supabase.
- Gateway Node local (`server/`) **não** precisa no Render em produção.

## Aceite

- [ ] Cadastro + login
- [ ] Owner vê Plataforma; custos sobem após insight/classify/embed
- [ ] Cron 18h cria `embedding_jobs` com `trigger_source=cron`
- [ ] App pública no Render
