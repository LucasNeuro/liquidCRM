# Supabase — CRM Contabilidade Facilitada / LIQUI

## Rode isto (banco que já tem o dump do enunciado)

No SQL Editor, cole e execute **um único arquivo**:

```text
supabase/upgrade-robusto.sql
```

Isso **não apaga** `leads` / tentativas / pesquisas. Completa o banco para funis, insights, negócios, FKs, RLS e views.

Realtime (opcional):

```text
supabase/enable-realtime.sql
```

Kanbans tentativas/pesquisas (índices + view enriquecida):

```text
supabase/migrate-kanbans-entidades.sql
```

Conferir:

```sql
select * from public.v_schema_health;
select * from public.v_crm_resumo;
```

Detalhes: [`docs/specs/08-schema-robusto.md`](../docs/specs/08-schema-robusto.md)

---

## Schema do enunciado (núcleo — já deve existir)

| Tabela | Papel |
|--------|--------|
| `leads` | Lead + campos Gemini |
| `tentativas_compra` | Tentativas (`id_lead` FK) |
| `respostas_pesquisa` | Pesquisas (`id_lead` FK) |
| `classifications` | Classificação Gemini |
| `profiles` | Auth |

## Auxiliares (criadas pelo upgrade)

| Tabela | Papel |
|--------|--------|
| `pipelines` / `pipeline_stages` | Funis `leads` \| `negocios` |
| `lead_insights` | Histórico insight Gemini |
| `negocios` | N negócios por lead |

## Banco novo (do zero, com seed ~2x)

1. `schema.sql`
2. `upgrade-robusto.sql` (funis + negócios + views)

## Arquivos legados (opcional)

`migrate-auxiliares.sql`, `migrate-negocios.sql`, `pipelines.sql` — conteúdo já absorvido em `upgrade-robusto.sql`.
