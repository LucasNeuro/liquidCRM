# Agente: mistral-action

## Responsabilidade

Actions auxiliares do CRM via **Mistral** (resumo, reply, nota, enrich).  
Análise/insight de lead permanece no agente **lead-insight (Gemini)**.

## Skills

- Projetos: [`skills/mistral-crm-actions/`](../../../skills/mistral-crm-actions/)
- Novas skills Mistral devem seguir o mesmo padrão (SKILL.md + prompt).

## Env

- `MISTRAL_API_KEY`
- `MISTRAL_MODEL` (opcional)
