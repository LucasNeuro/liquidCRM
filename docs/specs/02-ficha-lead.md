# Spec 02 — Ficha do lead

**Enunciado:** ao abrir um card, ver dados consolidados das abas da base.

## Comportamento

1. Clique no card (ou linha na Lista) abre **SideOver** (não modal centro).  
2. Cabeçalho: nome, avatar, telefone/e-mail, origem, status.  
3. Abas internas sugeridas:
   - **Dados** — campos do lead + tentativas  
   - **Histórico** — tentativas + pesquisas (+ insights gerados)  
   - **Insight IA** — botão e resultado (spec 03)  
4. Consolidação:
   - Preferência: `id_lead` em `tentativas_compra` / `respostas_pesquisa`  
   - Fallback: e-mail normalizado → telefone (últimos 8) → nome aproximado  

## Aceite

- [ ] SideOver abre/fecha (ESC e overlay)  
- [ ] Mostra lead + tentativas + pesquisas relacionadas  
- [ ] Não inventa linhas que não existem na base  
- [ ] Trata NULL / formatos mistos sem quebrar  

## UI

Mesmo padrão visual dos exemplos (waje): painel direito, tabs, botão IA no footer.
