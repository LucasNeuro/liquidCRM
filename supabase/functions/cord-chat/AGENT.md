# CORD — assistente owner (LIQUI)

## Deploy
1. Supabase Dashboard → Edge Functions → Create/Update `cord-chat`
2. Cole `index.ts`
3. Secrets:
   - `MISTRAL_API_KEY` (obrigatório)
   - `MEM0_API_KEY` (recomendado — memória longa)
   - opcional `MISTRAL_CORD_MODEL`

## Chaves — onde colocar
| Chave | Supabase Secrets (Edge) | `.env` local (Vite) |
|-------|-------------------------|---------------------|
| `MEM0_API_KEY` | **Sim** | Só se tiver gateway Node local — **sem** prefixo `VITE_` |
| `MISTRAL_API_KEY` | **Sim** | Idem |

**Nunca** `VITE_MEM0_API_KEY` — isso vaza no browser.

## Skills embutidas no Edge (`SKILL_PROMPTS` em index.ts)
- cord-funnel-pulse
- cord-team-load
- cord-revenue-radar
- cord-dispatch (atribuir / desatribuir / rodízio)
- cord-insight-brief

Fonte canônica também em `skills/cord-*/`.

## UI
Balão canto inferior direito (owner): Chat, limpar, Histórico (local), Mem0 no servidor.
