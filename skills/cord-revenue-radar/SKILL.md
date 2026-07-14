---
name: cord-revenue-radar
description: >-
  CORD skill: receita prevista / pipeline aberto (negócios) e ganhos.
  Owner only. Números só do snapshot CRM.
---

# CORD · Revenue Radar

## Quando usar

- "Qual a receita prevista?"
- "Pipeline em aberto"
- "Quanto já ganhou?"

## Regras

1. Usar `receita_pipeline_aberta`, `negocios_abertos`, `negocios_ganhos`.
2. Formatar valor em R$ quando numérico.
3. Separar claramente: previsto (aberto) vs já ganho (não misturar).
4. Se dados zerados, dizer que a base de negócios está vazia/parcial — não inventar.

## Saída esperada

- Receita potencial (pipeline aberto)
- Qtde negócios abertos / ganhos
- 1 leitura comercial curta
