# Agente: lead-insight

## Responsabilidade

Gerar insight completo do lead (resumo, próximo passo, riscos, evidências e **markdown completo**) usando **somente** o JSON de contexto da base. Provider: **Gemini**.

## Arquivos

| Arquivo | Papel |
|---------|--------|
| `index.ts` | HTTP handler |
| `skill.ts` | Prompt canônico + validação da saída |

## Input

```json
{
  "leadContext": {
    "lead": { "...campos do lead..." },
    "tentativas_compra": [],
    "respostas_pesquisa": []
  }
}
```

## Output

```json
{
  "titulo": "string",
  "resumo": "string",
  "proximo_passo": "string",
  "riscos": ["string"],
  "evidencias": ["string"],
  "markdown": "# documento markdown completo...",
  "model_name": "gemini-2.5-flash"
}
```

## Persistência

Salvo em `lead_insights` (N por lead). Timeline na ficha do lead.

## Spec de produto

[`docs/specs/03-insight-ia.md`](../../../docs/specs/03-insight-ia.md)
