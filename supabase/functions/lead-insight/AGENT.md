# Agente: lead-insight

## Responsabilidade

Gerar insight completo do lead (resumo, próximo passo, riscos, evidências e **markdown completo**) usando **somente** o JSON de contexto da base.

| Modo | Pipeline |
|------|----------|
| Gerar insight | Gemini (+ RAG embed Mistral opcional) |
| **Aprofundar** (`reinforce: true`) | 1) Mistral embed + chat sobre chunks RAG → 2) Gemini finaliza JSON/markdown |

## Arquivos

| Arquivo | Papel |
|---------|--------|
| `index.ts` | HTTP handler (self-contained para deploy no Dashboard) |

## Input

```json
{
  "leadContext": { "lead": {}, "tentativas_compra": [], "respostas_pesquisa": [], "negocios": [] },
  "reinforce": true,
  "previousInsight": { "resumo": "...", "proximo_passo": "...", "markdown": "..." }
}
```

## Output (Aprofundar)

```json
{
  "titulo": "...",
  "resumo": "...",
  "proximo_passo": "...",
  "riscos": [],
  "evidencias": [],
  "markdown": "# ...",
  "model_name": "mistral→gemini-2.5-flash",
  "pipeline": "mistral_rag->gemini",
  "mistral_brief_used": true,
  "rag_chunks_used": 8
}
```

## Secrets

`GEMINI_API_KEY`, `MISTRAL_API_KEY` (obrigatória no Aprofundar para o brief; embed continua opcional)

## Spec

[`docs/specs/03-insight-ia.md`](../../../docs/specs/03-insight-ia.md)
