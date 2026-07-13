# Skills de IA (LIQUI)

Prompts canônicos usados pelos playbooks locais (`server/playbooks`) e espelhados nas Edge Functions.

| Skill | Provider | Uso |
|-------|----------|-----|
| `lead-insight` | **Gemini** | Análise + insight markdown do lead |
| `lead-classification` | **Gemini** | Classificação de intenção |
| `mistral-crm-actions` | **Mistral** | Actions auxiliares (resumo, reply, notas…) |

Edge Functions espelho:
- `supabase/functions/lead-insight/`
- `supabase/functions/lead-classify/`
- `supabase/functions/mistral-action/`
