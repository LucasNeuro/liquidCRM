# 03 — Requisitos

## Requisitos funcionais (mínimo)

| ID | Requisito | Spec |
|----|-----------|------|
| RF-01 | Exibir funil Kanban com leads como cards | 01-kanban |
| RF-02 | Arrastar card entre colunas com persistência | 01-kanban |
| RF-03 | Abrir ficha do lead com dados consolidados | 02-ficha-lead |
| RF-04 | Botão Insight IA (resumo + próximo passo) | 03-insight-ia |
| RF-05 | Insight usa só dados da base (Gemini) | 03-insight-ia |
| RF-06 | Buscar lead | 04-busca-filtros |
| RF-07 | Filtrar por ≥1–2 campos (origem, status…) | 04-busca-filtros |

## Requisitos funcionais (extras desejáveis)

| ID | Requisito |
|----|-----------|
| RF-08 | Criar funis e estágios |
| RF-09 | View Lista além de Kanban |
| RF-10 | Persistência de insights e classificações |
| RF-11 | Auth e-mail/senha Supabase |
| RF-12 | Dashboard KPI simples |
| RF-13 | Negócios N:1 lead — Kanban + Lista | 07-negocios |

## Requisitos não funcionais

| ID | Requisito |
|----|-----------|
| RNF-01 | TypeScript + organização de pastas |
| RNF-02 | Secrets de IA só no servidor / Edge Function |
| RNF-03 | Deploy gratuito público (Vercel/Netlify) |
| RNF-04 | UI responsiva desktop + mobile básico |
| RNF-05 | Tratar inconsistências sem crash |
| RNF-06 | Spec-Driven: docs atualizados quando o comportamento mudar |

## Fora de escopo (por enquanto)

- App mobile nativo  
- Billing / Stripe  
- Multi-tenant com RLS por empresa (avaliar depois)
