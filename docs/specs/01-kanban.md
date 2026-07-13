# Spec 01 — Pipeline Kanban

**Enunciado:** colunas do funil, cards, drag-and-drop com persistência.

## Comportamento

1. Colunas = estágios do funil ativo (`pipeline_stages`).  
2. Cards = leads filtrados.  
3. Drag de um card para outra coluna atualiza `stage_id`, `pipeline_id` e `status` (nome do estágio).  
4. Persistência via Supabase; em falha, rollback otimista na UI.  
5. Sidebar e header fixos; **cada coluna** com `overflow-y: auto` próprio.  
6. Board: scroll horizontal se houver muitas colunas.

## UI

- Toolbar: seletor de funil, Kanban|Lista, + Pipeline, Estágios, busca, filtro origem.  
- KPIs acima do board (fixos no topo da área de conteúdo).  
- Cards com avatar, origem, contato, score (se houver), badge IA.

## Aceite

- [ ] Arrastar e soltar muda coluna visualmente  
- [ ] Após F5, lead permanece na nova coluna  
- [ ] Colunas scrollam independentemente  
- [ ] Header/sidebar não rolam com o board  

## Fora deste spec

Insight e ficha detalhada → specs 02 e 03.
