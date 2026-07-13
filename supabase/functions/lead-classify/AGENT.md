# Agente: lead-classify

## Responsabilidade

Classificar texto/mensagem de um lead: intent, sentiment, labels, score, confidence.

## Arquivos

| Arquivo | Papel |
|---------|--------|
| `index.ts` | HTTP handler |
| `skill.ts` | Prompt canônico + schema |

## Input

```json
{
  "text": "mensagem do lead",
  "leadName": "opcional"
}
```

## Output

```json
{
  "intent": "compra|informacao|...",
  "sentiment": "positivo|neutro|negativo",
  "labels": [],
  "score": 0,
  "summary": "...",
  "confidence": 0.0,
  "model_name": "gemini-2.5-flash"
}
```

## Persistência (app)

Inserir em `classifications` e atualizar `leads.score_gemini`, `intent_gemini`, `labels_gemini`.
