# 08 — Schema robusto (upgrade único)

## Objetivo

Partir do dump do enunciado (leads / tentativas / pesquisas / classifications / profiles) e deixar o banco pronto para **todas** as funções da app LIQUI — **sem apagar o seed**.

## Arquivo a rodar

```text
supabase/upgrade-robusto.sql
```

Cole no **SQL Editor** do Supabase → **Run** (pode rodar de novo; é idempotente).

## O que o upgrade faz

| Área | Tabelas / ações |
|------|-----------------|
| Núcleo | Garante colunas Gemini + `id_lead` nas auxiliares |
| Kanban leads | `pipelines` / `pipeline_stages` (`kind=leads`) + `leads.pipeline_id/stage_id` |
| Insights | `lead_insights` |
| Negócios | `negocios` N:1 lead + funil `kind=negocios` |
| Qualidade | backfill `id_lead` (e-mail → telefone → nome) |
| Segurança | RLS policies |
| Checagem | views `v_crm_resumo`, `v_lead_ficha`, `v_schema_health` |

## Modelo final

```
auth.users
    └── profiles

leads ──< tentativas_compra
     ├──< respostas_pesquisa
     ├──< classifications
     ├──< lead_insights
     └──< negocios

pipelines (kind: leads|negocios)
    └── pipeline_stages
          ↑
leads.stage_id / negocios.stage_id
```

## Depois de rodar

```sql
select * from public.v_schema_health;
select * from public.v_crm_resumo;
```

Esperado: tabelas auxiliares com linhas > 0 nos funis; `tentativas_com_lead` / `respostas_com_lead` > 0 após backfill; `total_negocios` ≥ 0 (seed demo cria 8 se vazio).

## Relação com outros SQLs

| Arquivo | Quando usar |
|---------|-------------|
| **`upgrade-robusto.sql`** | **Preferencial** — banco já com dump do enunciado |
| `enable-realtime.sql` | Liga Realtime em todas as tabelas da app |
| `schema.sql` | Install do zero + seed 2x (recria) |
| `migrate-auxiliares.sql` / `migrate-negocios.sql` | Legados; conteúdo absorvido no upgrade |
