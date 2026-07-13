# 01 — Critérios de avaliação e aceite

Derivado do enunciado. Cada item de aceite deve ser demonstrável na app hospedada.

---

## 1. Tratamento e modelagem dos dados

| Critério | O que o avaliador espera | Aceite / onde ver |
|----------|--------------------------|-------------------|
| Schema alinhado às abas | `leads`, `tentativas_compra`, `respostas_pesquisa` | Rotas Leads / Tentativas / Pesquisas |
| Campos Gemini | `score_gemini`, `intent_gemini`, `labels_gemini` + `classifications` | Classificar na ficha → card atualiza |
| Inconsistências | Datas VARCHAR, e-mails mistos, telefones mascarados, NULLs | Não quebra; exibe "—" |
| Vínculo entre abas | `id_lead` + fallback e-mail/telefone/nome | Ficha → aba **Histórico** (badge do match) |
| Auxiliares | `pipelines`, `pipeline_stages`, `lead_insights`, `profiles` | Funil + Timeline de insights |

Código de matching: `src/lib/matching.ts`.

**Documentação:** [specs/05-dados-modelagem.md](./specs/05-dados-modelagem.md).

---

## 2. Qualidade e fidelidade do insight (IA)

| Critério | Aceite / onde ver |
|----------|-------------------|
| Botão na ficha | **Gerar insight por IA (Gemini)** |
| Só dados da base | Prompt proíbe inventar; contexto = lead + tentativas + pesquisas |
| Resumo + próximo passo | Cards destacados na aba **Insight IA** |
| Evidências | Lista de campos literais (`status_pagamento=…`) |
| Markdown + histórico | Modal + aba **Timeline** (`lead_insights`) |
| Gemini | Secret / gateway — nunca `VITE_GEMINI_*` |
| Custo | Uma chamada por clique (`gemini-2.5-flash`) |

**Spec:** [specs/03-insight-ia.md](./specs/03-insight-ia.md) · **Agente:** [`supabase/functions/lead-insight/`](../supabase/functions/lead-insight/AGENT.md).

---

## 3. Kanban e filtros

| Critério | Aceite / onde ver |
|----------|-------------------|
| Colunas do funil | Estágios do pipeline ativo |
| Drag-and-drop | Arrastar card → persistência `stage_id`/`status` |
| Scroll por coluna | `overflow-y` próprio; sidebar/header fixos |
| Busca | Nome, telefone, e-mail, código |
| Filtros | Origem + produto + status + estágio (+ intents) |

**Specs:** [specs/01-kanban.md](./specs/01-kanban.md), [specs/04-busca-filtros.md](./specs/04-busca-filtros.md).

---

## 4. Qualidade e organização do código

| Critério | Aceite |
|----------|--------|
| Separação UI / lib / AI | `src/`, `supabase/`, `docs/`, `skills/` |
| Spec-driven | `docs/specs/*` |
| Agentes | Edge Functions + playbooks locais |
| Tipagem | TypeScript |
| Segredos | Gemini só server-side |
| Deploy | Vercel/Netlify |

---

## Checklist rápido (demo para o avaliador)

1. Login  
2. `/leads` — Kanban com colunas scrolláveis  
3. Arrastar lead → F5 → permanece  
4. Abrir ficha → **Histórico** mostra tentativas/pesquisas com badge do vínculo  
5. **Insight IA** → Gerar → ver Resumo + Próximo passo + Evidências  
6. **Timeline** → clicar insight → Markdown  
7. Buscar + filtrar origem  
8. Favicon ok · URL pública  

---

## Extras (positivos)

- Funis/estágios customizáveis · Kanban/Lista · KPIs · CRUD CRM · Arquivamento · Negócios N:1 · Classificação Gemini · Dashboard `v_crm_resumo`
