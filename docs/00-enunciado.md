# 00 — Enunciado oficial

> **Avaliação Prática — Analista de IA Aplicada — Contabilidade Facilitada**

Fonte: desafio enviado pelo cliente. Este documento deve permanecer fiel ao texto original.

---

## Sobre o desafio

Construa um pequeno CRM, em formato Kanban, para gestão de um funil de leads e geração de insights por IA para cada lead. Recomendamos o uso de Lovable ou Claude Code e pedimos que hospede a aplicação **gratuitamente** na web (Vercel ou Netlify).

---

## Escopo mínimo esperado

### 1. Pipeline de leads (Kanban)

Colunas do funil, com os leads como cards. Deve ser possível **arrastar** um card entre colunas e a mudança deve **persistir**.

### 2. Ficha do lead

Ao abrir um card, ver os dados daquele lead **consolidados das diferentes abas da base**.

### 3. Insight por IA

Um botão que gera um **resumo do lead** e sugere o **próximo passo**, usando **apenas os dados da base**, **sem inventar informações**.

Usar a API key do **Gemini** enviada por mensagem (limite de **R$ 50** de uso).

### 4. Busca e filtros

Localizar um lead e filtrar por **ao menos um ou dois campos** (ex.: origem, status).

> O que está acima é o **mínimo esperado**. Funcionalidades adicionais relevantes serão consideradas positivamente.

---

## A base de dados

Disponível neste Google Sheets (link para criar cópia):

https://docs.google.com/spreadsheets/d/1HAUUSKJZ9T0yqu6-22naL31xVEm8vwvn9vEX4vM3x_0/edit?usp=sharing

Contém abas com informações fictícias de:

- leads  
- tentativas de compra  
- respostas de pesquisa  

A base tem **inconsistências propositais**, e a forma como você as tratará **faz parte da avaliação**.

---

## Critérios de avaliação (enunciado)

1. Tratamento e modelagem dos dados  
2. Qualidade e fidelidade do insight gerado pela IA  
3. Funcionamento do Kanban e dos filtros  
4. Qualidade e organização do código  

Detalhamento operacional: [01-criterios-avaliacao.md](./01-criterios-avaliacao.md).

---

## Marca / produto deste repositório

| Item | Valor |
|------|--------|
| Produto | LIQUI |
| Cliente | Contabilidade Facilitada |
| Stack pedida no projeto | React + Tailwind + Supabase |
| IA | Gemini via **Supabase Edge Functions** (agentes) |
