# Spec 03 — Insight por IA (Gemini)

**Enunciado:** botão gera resumo + próximo passo **somente** com dados da base, sem inventar. Gemini, limite R$ 50.

## Comportamento

1. Botão na ficha: **Gerar insight por IA (Gemini)**.  
2. Front monta `leadContext` (lead + tentativas + pesquisas já consolidadas).  
3. Chama Edge Function `lead-insight` (agente).  
4. Resposta JSON:
   ```json
   {
     "resumo": "...",
     "proximo_passo": "...",
     "riscos": ["..."],
     "evidencias": ["..."],
     "model_name": "..."
   }
   ```
5. Persistir em `lead_insights` (histórico / Timeline).  
6. UI obrigatória: **resumo** + **próximo passo** em destaque; evidências listadas.  
7. Markdown completo opcional no modal.  
8. Prompt proíbe invenção; evidências citam fatos do JSON.

## Restrições de custo

- Sem geração automática em massa no load da página.  
- Modelo preferencial: `gemini-2.5-flash`.  
- Uma chamada por clique do usuário.

## Aceite

- [ ] Botão funciona autenticado  
- [ ] Resumo e próximo passo presentes  
- [ ] Sem dados inventados óbvios (avaliador confronta com a base)  
- [ ] Chave Gemini só no secret da Edge Function  
- [ ] Erro de rede/API mostrado na UI  

## Agente

Ver [`supabase/functions/lead-insight/AGENT.md`](../../supabase/functions/lead-insight/AGENT.md) e código em `supabase/functions/lead-insight/`.
