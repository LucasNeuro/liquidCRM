---
name: lead-insight
description: >-
  Gera insight completo (JSON + markdown) de um lead do CRM LIQUI usando só dados
  da base. Provider: Gemini. Persistido em lead_insights com timeline.
---

# Insight de lead (LIQUI)

## Quando usar

- Botão "Gerar insight" / Timeline na ficha do lead
- Análise e insight comerciais (somente Gemini nesta feature)

## Provider

**Gemini** (`GEMINI_API_KEY` / Edge `lead-insight`). Outras automações CRM usam **Mistral** (`skills/mistral-*`).

## Regras

1. Usar apenas o JSON de contexto enviado.
2. Não inventar valores, datas, intenções ou contatos.
3. Campo `markdown` = documento completo.
4. Persistência obrigatória em `lead_insights`.

## Prompt canônico

Ver `prompt.system.md` — carregado pelo playbook `server/playbooks/generateInsight.ts`.
