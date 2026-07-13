# LIQUI — Documentação Spec-Driven Development (SDD)

Esta pasta é a **fonte da verdade** da implementação. Antes de codar, ler e respeitar os specs.

## Como trabalhar (SDD)

1. **Spec primeiro** — requisitos e critérios em `docs/`  
2. **Implementar** só o que o spec cobre  
3. **Validar** contra critérios de aceite  
4. **Não inventar escopo** fora do enunciado (extras só se marcados como “além do mínimo”)

## Índice

| Doc | Conteúdo |
|-----|----------|
| [00-enunciado.md](./00-enunciado.md) | Enunciado oficial do desafio |
| [01-criterios-avaliacao.md](./01-criterios-avaliacao.md) | Critérios de avaliação + checklist de aceite |
| [02-arquitetura-sdd.md](./02-arquitetura-sdd.md) | Arquitetura, stack, Edge Functions como agentes |
| [03-requisitos.md](./03-requisitos.md) | Requisitos funcionais / não funcionais |
| [specs/](./specs/) | Specs por funcionalidade |

## Specs de feature

| Spec | Mínimo do enunciado |
|------|---------------------|
| [specs/01-kanban.md](./specs/01-kanban.md) | Pipeline Kanban + drag persistente |
| [specs/02-ficha-lead.md](./specs/02-ficha-lead.md) | Ficha consolidada |
| [specs/03-insight-ia.md](./specs/03-insight-ia.md) | Insight Gemini sem inventar |
| [specs/04-busca-filtros.md](./specs/04-busca-filtros.md) | Busca + filtros |
| [specs/05-dados-modelagem.md](./specs/05-dados-modelagem.md) | Modelagem + inconsistências |
| [specs/06-auth-deploy.md](./specs/06-auth-deploy.md) | Auth + host gratuito |
| [specs/07-negocios.md](./specs/07-negocios.md) | Negócios N por lead (Kanban + Lista) |
| [specs/09-kanbans-entidades.md](./specs/09-kanbans-entidades.md) | Kanbans leads/tentativas/pesquisas + CRUD |

## Agentes / IA

Agentes **não** ficam em `docs/`. Código + skill + doc = Edge Functions:

→ [`supabase/functions/README.md`](../supabase/functions/README.md)

## Regra para o agente Cursor

Sempre seguir estes docs. Rule do projeto: `.cursor/rules/sdd-liqui.mdc`.
