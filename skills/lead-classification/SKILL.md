---
name: lead-classification
description: >-
  Classifica leads do CRM LIQUI/Contabilidade Facilitada com Gemini.
  Use ao analisar mensagem ou intenção de um lead e produzir intent, score e labels.
---

# Classificação de leads (LIQUI)

## Quando usar

- Botão de classificação no CRM
- Análise de mensagem/intenção de um lead

## Regras validadas

1. Responder somente JSON válido (sem markdown).
2. Não inventar fatos fora do texto enviado.
3. `score` entre 0 e 100; `confidence` entre 0 e 1.
4. `intent` deve ser um dos valores do schema.
5. Labels curtas, em português, no máximo 5.

## Schema de saída

```json
{
  "intent": "compra|informacao|suporte|demo|agendamento|proposta|cancelamento|outro",
  "sentiment": "positivo|neutro|negativo",
  "labels": ["string"],
  "score": 0,
  "summary": "string",
  "confidence": 0.0
}
```

## Prompt canônico

Ver `prompt.system.md` — carregado pelo playbook `server/playbooks/classifyLead.ts`.
