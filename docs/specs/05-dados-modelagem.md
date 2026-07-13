# Spec 05 — Dados e modelagem

**Enunciado:** base Sheets com inconsistências; tratamento faz parte da avaliação.

## Fonte

Google Sheets (cópia):  
https://docs.google.com/spreadsheets/d/1HAUUSKJZ9T0yqu6-22naL31xVEm8vwvn9vEX4vM3x_0/edit?usp=sharing

## Núcleo (obrigatório)

```
leads
tentativas_compra  (id_lead FK → leads)
respostas_pesquisa (id_lead FK → leads)
classifications    (id_lead FK → leads)
profiles           (id → auth.users)
```

Campos Gemini em `leads`: `score_gemini`, `intent_gemini`, `labels_gemini`.

Datas do enunciado permanecem **VARCHAR** (não forçar DATE) — inconsistências são parte do desafio.

## Auxiliares (produto LIQUI)

```
pipelines
pipeline_stages
lead_insights
```

Aplicação: **`supabase/upgrade-robusto.sql`** (preferencial).

Extras legados: `migrate-auxiliares.sql` · `migrate-negocios.sql`.

## Tabela `negocios` (extra RF-13)

`id_lead` FK → leads (N negócios por lead). Funil com `pipelines.kind = 'negocios'`.
Ver [07-negocios.md](./07-negocios.md) · [08-schema-robusto.md](./08-schema-robusto.md).

## Tratamento de inconsistências

| Problema | Estratégia |
|----------|------------|
| E-mail maiúsculo/minúsculo | `lower(trim(...))` |
| Telefone com máscaras/`+55` | só dígitos; match pelos últimos 8 |
| Nome abreviado vs completo | fallback contains / igualdade case-insensitive |
| Datas misturadas | exibir como texto; não parsear agressivamente |
| NULL e-mail/telefone | matching por outros campos; UI mostra "—" |

## Aceite

- [ ] Schema aplicado no projeto Supabase  
- [ ] Backfill `id_lead` nas auxiliares  
- [ ] Ficha usa FK quando disponível  
- [ ] View `v_crm_resumo` / `v_lead_ficha` para checagem  

## SQL

- `supabase/schema.sql` — install do zero + seed ~2x  
- `supabase/migrate-auxiliares.sql` — banco já existente  
- `supabase/pipelines.sql` — complementar  
