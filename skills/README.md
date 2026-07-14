# Skills de IA (LIQUI)

Prompts canônicos usados pelos playbooks locais (`server/playbooks`) e espelhados nas Edge Functions.

| Skill | Provider | Uso |
|-------|----------|-----|
| `lead-insight` | **Gemini** | Análise + insight markdown do lead |
| `lead-classification` | **Gemini** | Classificação de intenção |
| `mistral-crm-actions` | **Mistral** | Actions auxiliares (resumo, reply, notas…) |
| `cord-funnel-pulse` | **Mistral + Mem0** | CORD · pulso do funil |
| `cord-team-load` | **Mistral + Mem0** | CORD · carga dos consultores |
| `cord-revenue-radar` | **Mistral + Mem0** | CORD · receita / pipeline |
| `cord-dispatch` | **Mistral + Mem0** | CORD · redistribuição (com confirmação) |
| `cord-insight-brief` | **Mistral + Mem0** | CORD · briefing de inteligência |

Edge Functions:
- `supabase/functions/lead-insight/`
- `supabase/functions/lead-classify/`
- `supabase/functions/mistral-action/`
- `supabase/functions/cord-chat/`
