# Ativar pgvector + RAG (LIQUI)

## Por que isso melhora insight/classificação?

1. **Mistral** gera embeddings das tabelas CRM (barato, em lote).  
2. Trechos ficam no **pgvector**.  
3. No **Gerar insight**, o Gemini recebe o lead + top-K chunks recuperados — **só fatos indexados**, menos alucinação e menos tokens inventados.

## Passo a passo no Supabase

### 1) Extensão vector

1. Abra o projeto no [Dashboard Supabase](https://supabase.com/dashboard)  
2. **Database → Extensions**  
3. Busque `vector`  
4. Clique **Enable**

> Ou rode no SQL Editor: `create extension if not exists vector;`  
> (o migrate tenta `extensions` / `public` conforme o plano)

### 2) Schema

No **SQL Editor**, cole e execute:

`supabase/migrate-pgvector-rag.sql`

Isso cria:

- `crm_embeddings` (chunks + `vector(1024)`)  
- `embedding_jobs` (histórico de jobs)  
- função `match_crm_embeddings(...)`

### 3) Secret Mistral

```bash
supabase secrets set MISTRAL_API_KEY=sua_chave
supabase secrets set MISTRAL_EMBED_MODEL=mistral-embed
```

### 4) Deploy da Edge Function

```bash
supabase functions deploy embed-crm-batch --no-verify-jwt
supabase functions deploy lead-insight --no-verify-jwt
```

(`lead-insight` atualizado já consulta o RAG quando há chunks.)

### 5) Rodar na app

**Plataforma → Configurações → Rodar indexação agora**

Agenda sugerida: **todo dia às 18:00** via Cron do Supabase (opcional):

```sql
-- Exemplo pg_cron + http (ajuste URL/key do projeto)
-- select cron.schedule('liqui-embed-18h', '0 18 * * *', $$ ... $$);
```

## UI

Gaveta **Sistema** removida. Monitoramento em **Plataforma → Configurações**.
