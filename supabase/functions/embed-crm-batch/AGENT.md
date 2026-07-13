# Agente: embed-crm-batch

## Responsabilidade

Indexar `leads`, `tentativas_compra` e `respostas_pesquisa` em **pgvector** com embeddings **Mistral** (`mistral-embed`). Insumo RAG para Gemini (insight/classificação).

## Input

```json
{ "trigger_source": "manual" | "cron" }
```

## Output

```json
{
  "ok": true,
  "job_id": "uuid",
  "total_sources": 282,
  "embedded_count": 40,
  "skipped_count": 242,
  "model_name": "mistral-embed"
}
```

## Secrets

- `MISTRAL_API_KEY`
- `MISTRAL_EMBED_MODEL` (opcional, default `mistral-embed`)
- `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` (automáticos no Edge)

## SQL

`supabase/migrate-pgvector-rag.sql`

## Deploy

```bash
supabase functions deploy embed-crm-batch --no-verify-jwt
supabase secrets set MISTRAL_API_KEY=...
```
