# Spec 09 — Kanbans por entidade + CRUD + filtros

## Objetivo

Três fontes do Sheets / schema do enunciado devem ter **visão própria** (Kanban + Lista), filtros e cruzamento na ficha do lead.

| Entidade | Tabela | Colunas do Kanban (padrão) |
|----------|--------|----------------------------|
| Leads | `leads` | `pipeline_stages` (kind=`leads`) |
| Tentativas | `tentativas_compra` | `status_pagamento` |
| Pesquisas | `respostas_pesquisa` | `momento_compra` |
| Negócios | `negocios` | `pipeline_stages` (kind=`negocios`) |

## Filtros

- **Leads:** origem, produto, busca; indicador de tentativas/pesquisas vinculadas  
- **Tentativas:** status_pagamento, produto, busca  
- **Pesquisas:** momento_compra, principal_objecao, area_interesse, busca  
- **Negócios:** status_negocio, busca (lead/código/título)

## CRUD (sideovers)

- Criar / editar / excluir **pipeline** e **estágio** (leads e negócios)  
- Criar / editar lead, negócio, tentativa, resposta (mínimo: edição nos sideovers)  
- Drag persiste coluna

## Análise / IA

- Ficha do lead consolida cards de tentativas + pesquisas  
- Classificação / insight usa o contexto cruzado (`buildLeadContextPayload`)

## Aceite

- [ ] Rotas `/leads`, `/tentativas`, `/pesquisas`, `/negocios`  
- [ ] Filtros funcionam  
- [ ] Drag persiste  
- [ ] Sideover com cards claros  
- [ ] CRUD funil/estágio em sideover  
