# Playbooks Gemini (LIQUI)

O proxy monolítico foi substituído por:

1. **Skills** (`skills/`) — prompts validados para classificação e insight  
2. **Playbooks TypeScript** (`server/playbooks/`) — execução Gemini  
3. **Gateway fino** (`server/gateway.ts`) — só despacha HTTP → playbook  

```
skills/
  lead-classification/   # classify
  lead-insight/          # ficha do lead
server/
  playbooks/
    geminiClient.ts
    classifyLead.ts
    generateInsight.ts
    loadSkillPrompt.ts
  gateway.ts
```

Rotas do gateway (iguais às do front):

- `POST /ai/classify` → `classifyLeadPlaybook`
- `POST /ai/insight` → `generateInsightPlaybook`
- `GET /health`

```bash
npm run ai          # compila + sobe gateway
npm run build:server
```
