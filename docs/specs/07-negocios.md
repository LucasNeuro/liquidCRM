# Spec 07 — Negócios (N por lead)

**Extra positivo:** cada lead pode ter **N negócios**; board próprio em Kanban e Lista.

## Modelo

```
leads (1) ──< (N) negocios
negocios.pipeline_id / stage_id → funil kind = 'negocios'
```

| Campo | Tipo | Nota |
|-------|------|------|
| id | uuid | PK |
| codigo | text | NEG-AAAA-NNNN |
| titulo | text | obrigatório |
| id_lead | int FK | vínculo obrigatório ao lead |
| valor | numeric | valor estimado |
| status_negocio | text | aberto / ganho / perdido |
| pipeline_id, stage_id | uuid | estágio no funil de negócios |
| created_at, updated_at | timestamptz | |

`pipelines.kind`: `'leads' | 'negocios'`.

## Comportamento

1. Rota `/negocios` — Kanban + Lista (mesmo padrão de leads).  
2. Drag entre colunas persiste `stage_id` + `status_negocio` se estágio for Ganho/Perdido.  
3. Criar negócio: SideOver com lead, título, valor.  
4. Na ficha do lead: aba **Negócios** lista os N itens + “+ Novo negócio”.  
5. Card mostra título, código, valor, nome do lead.

## Aceite

- [ ] Lead sem limite rígido de N negócios  
- [ ] Kanban e Lista em `/negocios`  
- [ ] Persistência do estágio  
- [ ] Criação a partir da ficha do lead e da página de negócios  
- [ ] Funil separado (`kind=negocios`)  

## SQL

`supabase/migrate-negocios.sql`
