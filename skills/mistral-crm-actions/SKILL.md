---
name: mistral-crm-actions
description: >-
  Padrão LIQUI para features CRM com Mistral (resumo, resposta, notas, skills).
  Use em tudo que NÃO for análise/insight de lead (esses ficam no Gemini).
---

# Mistral — actions CRM (LIQUI)

## Quando usar

- Resumir mensagens, sugerir reply WhatsApp, rascunhar notas internas
- Automações auxiliares e futuras skills do CRM
- **Não** usar para insight/classificação analítica do lead (isso é Gemini)

## Provider

- Edge Function: `supabase/functions/mistral-action`
- Env: `MISTRAL_API_KEY`, `MISTRAL_MODEL` (default `mistral-small-latest`)

## Actions atuais

| action | Uso |
|--------|-----|
| `summarize` | Resumo curto |
| `suggest_reply` | Resposta WhatsApp |
| `draft_note` | Nota interna CRM |
| `enrich_lead` | 3 próximos passos |

## Como adicionar uma skill Mistral

1. Criar pasta `skills/mistral-<nome>/` com `SKILL.md` + `prompt.system.md`
2. Registrar a action em `mistral-action/index.ts` (ou nova Edge Function)
3. Chamar do front só quando a feature estiver pronta

## Prompt base (actions genéricas)

Ver `prompt.system.md` nesta pasta.
