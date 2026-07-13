# Spec 04 — Busca e filtros

**Enunciado:** localizar lead e filtrar por ao menos 1–2 campos (ex.: origem, status).

## Comportamento

1. **Busca** textual em: nome, e-mail, telefone, produto, `id_lead`.  
2. **Filtro origem** (select das origens presentes).  
3. Filtro implícito por **funil/estágio** (colunas = status/stage).  
4. Opcional extra: filtro explícito de status na Lista.

## Aceite

- [ ] Digitar na busca reduz cards/linhas  
- [ ] Filtrar origem funciona  
- [ ] Combinação busca + origem funciona  
- [ ] Campos vazios/NULL não quebram o filtro  

## UX

Campo “Buscar nome, telefone ou código…” na toolbar.
