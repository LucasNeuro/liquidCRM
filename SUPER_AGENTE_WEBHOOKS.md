# 🌐 Super Agente + Webhooks + REST API

## 🎯 Integração com Outras Plataformas

O **Super Agente** agora suporta:
- ✅ **Geração de relatórios** via comandos de voz/texto
- ✅ **Envio para webhooks** externos
- ✅ **Uso da REST API** do Supabase (`https://nnhiyqtzzjfxnxgmufgo.supabase.co/rest/v1/`)

---

## 📡 Como Funciona

```
Usuário → Comando → Super Agente → Gera Relatórios → Envia via Webhook → Outras Plataformas
```

### Fluxo Detalhado:

1. **Usuário envia comando:**
   ```json
   {
     "command": "Gere um relatório diário de leads e envie para o Slack"
   }
   ```

2. **Super Agente processa:**
   - Interpreta o comando
   - Gera o relatório
   - Salva no banco
   - Envia para o webhook configurado

3. **Plataforma externa recebe:**
   ```json
   {
     "event": "report_generated",
     "data": {
       "id": "abc-123",
       "type": "leads_daily",
       "summary": "Relatório diário de leads: 15 leads",
       "data": { ... },
       "generated_at": "2026-07-18T10:00:00.000Z"
     },
     "timestamp": "2026-07-18T10:00:00.000Z",
     "source": "super-agent",
     "project": "https://nnhiyqtzzjfxnxgmufgo.supabase.co"
   }
   ```

---

## 📋 Tipos de Relatórios

| Tipo | Descrição | Comando |
|------|-----------|---------|
| `leads_daily` | Relatórios diário de leads | "Gere um relatório diário de leads" |
| `leads_weekly` | Relatórios semanal de leads | "Gere um relatório semanal de leads" |
| `negocios_status` | Status de negócios | "Gere um relatório de status de negócios" |
| `users_activity` | Atividade de usuários | "Gere um relatório de atividade de usuários" |
| `custom` | Query personalizada | "Gere um relatório com query: SELECT * FROM leads" |

---

## 🌍 Configuração de Webhooks

### 1. Adicionar um Webhook

**Comando:**
```json
{
  "command": "Adicione um webhook para https://hooks.slack.com/services/YOUR/WEBHOOK com nome Slack e eventos report_generated,lead_created"
}
```

**Ou via API:**
```bash
curl -X POST \
  https://nnhiyqtzzjfxnxgmufgo.supabase.co/functions/v1/super-agent \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "command": "Adicione um webhook para https://hooks.slack.com/services/YOUR/WEBHOOK com nome Slack e eventos report_generated,lead_created"
  }'
```

### 2. Listar Webhooks

**Comando:**
```json
{
  "command": "Liste todos os webhooks"
}
```

### 3. Testar um Webhook

**Comando:**
```json
{
  "command": "Teste o webhook com ID abc-123"
}
```

### 4. Remover um Webhook

**Comando:**
```json
{
  "command": "Remova o webhook com ID abc-123"
}
```

---

## 📊 Exemplos de Integração

### 1. Slack

**Webhook URL:** `https://hooks.slack.com/services/YOUR/WEBHOOK/URL`

**Formato da mensagem:**
```json
{
  "text": "📊 *Novo Relatórios do CRM*",
  "attachments": [
    {
      "color": "#36a64f",
      "title": "Relatório Diário de Leads",
      "text": "15 novos leads hoje",
      "fields": [
        {"title": "Total", "value": "15", "short": true},
        {"title": "Data", "value": "2026-07-18", "short": true}
      ]
    }
  ]
}
```

**Como configurar:**
1. Crie um **Incoming Webhook** no Slack
2. Copie a URL do webhook
3. Adicione no Super Agente:
   ```json
   {
     "command": "Adicione um webhook para <SLACK_WEBHOOK_URL> com nome Slack e eventos report_generated"
   }
   ```

---

### 2. Discord

**Webhook URL:** `https://discord.com/api/webhooks/YOUR/WEBHOOK/URL`

**Formato da mensagem:**
```json
{
  "content": "📊 **Novo Relatórios do CRM**",
  "embeds": [
    {
      "title": "Relatório Diário de Leads",
      "description": "15 novos leads hoje",
      "color": 3447003,
      "fields": [
        {"name": "Total", "value": "15", "inline": true},
        {"name": "Data", "value": "2026-07-18", "inline": true}
      ]
    }
  ]
}
```

**Como configurar:**
1. Crie um **Webhook** no servidor do Discord
2. Copie a URL do webhook
3. Adicione no Super Agente

---

### 3. Zapier

**Webhook URL:** `https://hooks.zapier.com/hooks/catch/YOUR/WEBHOOK/URL`

**Formato:**
O Zapier aceita qualquer JSON e permite mapear os campos para outras ações.

**Como configurar:**
1. Crie um **Webhook Trigger** no Zapier
2. Copie a URL
3. Adicione no Super Agente
4. Configure as ações no Zapier (ex: enviar email, salvar no Google Sheets, etc.)

---

### 4. Make.com (Integromat)

**Webhook URL:** `https://hook.make.com/YOUR/WEBHOOK/URL`

**Formato:**
Similar ao Zapier, o Make.com aceita JSON e permite criar fluxos de automação.

---

### 5. API Customizada

**Exemplo:** Enviar para uma API REST

**Comando:**
```json
{
  "command": "Enviar para webhook https://sua-api.com/webhook com body {\"data\": \"teste\"}"
}
```

**Ou via ação direta:**
```json
{
  "command": "Execute: send_webhook",
  "data": {
    "url": "https://sua-api.com/webhook",
    "method": "POST",
    "headers": {
      "Authorization": "Bearer YOUR_TOKEN",
      "Content-Type": "application/json"
    },
    "body": {
      "event": "custom_event",
      "data": {"message": "Dados do CRM"}
    }
  }
}
```

---

## 🔧 Configuração do Banco de Dados

### 1. Crie as tabelas do Super Agente

Execute o SQL:
```sql
-- Copie de: supabase/create-agent-tables.sql
-- Execute no Supabase SQL Editor
```

### 2. Verifique as tabelas

```sql
SELECT table_name FROM information_schema.tables 
WHERE table_name IN ('agent_reports', 'agent_webhooks', 'agent_report_schedules');
```

---

## 📅 Agendamento de Relatórios

### 1. Agendar um Relatório

**Comando:**
```json
{
  "command": "Agende um relatório diário de leads para ser gerado às 9h todos os dias e enviado para https://hooks.slack.com/services/YOUR/WEBHOOK"
}
```

**Formato do agendamento:**
```json
{
  "report_type": "leads_daily",
  "cron_expression": "0 9 * * *",  // 9h todos os dias
  "webhook_url": "https://hooks.slack.com/services/YOUR/WEBHOOK",
  "filters": {}
}
```

### 2. Expressões Cron

| Expressão | Descrição |
|-----------|-----------|
| `0 9 * * *` | Todos os dias às 9h |
| `0 0 * * 1` | Toda segunda-feira à meia-noite |
| `0 */2 * * *` | A cada 2 horas |
| `0 0,12 * * *` | Meia-noite e meio-dia todos os dias |

### 3. Listar Relatórios Agendados

**Comando:**
```json
{
  "command": "Liste todos os relatórios agendados"
}
```

---

## 🚀 Exemplos Práticos

### Exemplo 1: Gerar e Enviar Relatórios Diários

**Objetivo:** Enviar relatório diário de leads para o Slack todas as manhãs

**Passos:**

1. **Crie o webhook no Slack** e obtenha a URL
2. **Adicione o webhook no Super Agente:**
   ```json
   {
     "command": "Adicione um webhook para https://hooks.slack.com/services/YOUR/WEBHOOK com nome Slack e eventos report_generated"
   }
   ```
3. **Agende o relatório:**
   ```json
   {
     "command": "Agende um relatório diário de leads para ser gerado às 9h todos os dias e enviado para o Slack"
   }
   ```

**Resultado:**
- Todos os dias às 9h, o Super Agente:
  - Gera um relatório de leads do dia anterior
  - Salva no banco
  - Envia para o Slack

---

### Exemplo 2: Notificações de Novos Leads

**Objetivo:** Receber notificação no Discord quando um novo lead é criado

**Passos:**

1. **Crie o webhook no Discord**
2. **Adicione o webhook:**
   ```json
   {
     "command": "Adicione um webhook para https://discord.com/api/webhooks/YOUR/WEBHOOK com nome Discord e eventos lead_created"
   }
   ```
3. **Modifique o frontend** para chamar o Super Agente quando um lead for criado:
   ```typescript
   // Após criar um lead
   await fetch('https://nnhiyqtzzjfxnxgmufgo.supabase.co/functions/v1/super-agent', {
     method: 'POST',
     headers: {
       'Authorization': `Bearer ${token}`,
       'Content-Type': 'application/json',
     },
     body: JSON.stringify({
       command: 'Enviar notificação de novo lead para o Discord',
     }),
   })
   ```

**Resultado:**
- Sempre que um lead for criado, o Discord recebe uma notificação

---

### Exemplo 3: Integração com Google Sheets

**Objetivo:** Salvar relatórios no Google Sheets via Zapier

**Passos:**

1. **Crie um Zap no Zapier:**
   - Trigger: Webhook
   - Action: Google Sheets → Add Row
2. **Copie a URL do webhook do Zapier**
3. **Adicione no Super Agente:**
   ```json
   {
     "command": "Adicione um webhook para https://hooks.zapier.com/hooks/catch/YOUR/WEBHOOK com nome Google Sheets e eventos report_generated"
   }
   ```
4. **Agende relatórios:**
   ```json
   {
     "command": "Agende um relatório semanal de negócios para ser enviado para o Google Sheets"
   }
   ```

**Resultado:**
- Relatórios semanais são automaticamente salvos no Google Sheets

---

## 📊 Uso da REST API do Supabase

O Super Agente usa a **REST API** do Supabase (`https://nnhiyqtzzjfxnxgmufgo.supabase.co/rest/v1/`) para:
- Executar queries personalizadas
- Acessar dados sem precisar do client Supabase
- Integração mais flexível

### Exemplo de Query via REST API

**Comando:**
```json
{
  "command": "Execute: SELECT * FROM leads WHERE status = 'qualificado' LIMIT 10"
}
```

**O que acontece:**
1. O Super Agente valida a query (bloqueia queries perigosas)
2. Executa via REST API: `GET https://nnhiyqtzzjfxnxgmufgo.supabase.co/rest/v1/leads?status=eq.qualificado&limit=10`
3. Retorna os dados

### Headers da REST API

```
Authorization: Bearer <anon-key>
apikey: <anon-key>
Content-Type: application/json
```

### Filtros na REST API

| Operador | REST API | Exemplo |
|----------|----------|---------|
| Igual | `eq` | `?status=eq.qualificado` |
| Diferente | `neq` | `?status=neq.qualificado` |
| Maior que | `gt` | `?valor=gt.1000` |
| Menor que | `lt` | `?valor=lt.1000` |
| Contém | `like` | `?nome=like.*João*` |
| OR | `or` | `?or=(status.eq.qualificado,status.eq.novo)` |

---

## 🔐 Segurança

### 1. Validação de Queries
- Queries com `DROP`, `DELETE`, `TRUNCATE`, `ALTER` são bloqueadas
- Queries com `--` (comentários) são bloqueadas
- Queries com `;` são bloqueadas

### 2. Autenticação
- Todas as requisições requerem token de autenticação
- Somente usuários autenticados podem usar o Super Agente
- Owners têm acesso total, consultores têm restrições

### 3. Webhooks
- Webhooks podem ter um `secret` para autenticação
- O header `X-Webhook-Secret` é enviado para verificação
- Somente owners podem gerenciar webhooks de outros usuários

### 4. RLS (Row Level Security)
- As tabelas do Super Agente têm RLS configurado
- Usuários só veem seus próprios dados (a menos que sejam owners)

---

## 📚 API de Integração

### Endpoint Principal

```
POST https://nnhiyqtzzjfxnxgmufgo.supabase.co/functions/v1/super-agent
```

### Headers

| Header | Obrigatório | Descrição |
|--------|-------------|-----------|
| `Authorization` | ✅ | Token de autenticação |
| `Content-Type` | ✅ | `application/json` |

### Body

```json
{
  "command": "Comando em linguagem natural",
  "context": { ... }  // Opcional: contexto adicional
}
```

### Response

```json
{
  "thought": "Processamento interno",
  "action": { "type": "...", "data": { ... } },
  "response": "Resposta em linguagem natural",
  "result": { "success": true, "message": "...", "data": { ... } },
  "report": { ... },  // Se um relatório foi gerado
  "webhook_sent": true  // Se foi enviado via webhook
}
```

---

## 🎯 Casos de Uso

### 1. Automação de Relatórios
- **Relatórios diários** de leads para o time de vendas
- **Relatórios semanais** de negócios para a diretoria
- **Relatórios personalizados** sob demanda

### 2. Integração com Ferramentas Externas
- **Slack**: Notificações em tempo real
- **Discord**: Alertas para a equipe
- **Zapier/Make**: Automação com outras plataformas
- **Google Sheets**: Armazenamento de dados
- **APIs Customizadas**: Integração com sistemas legados

### 3. Assistente Virtual
- **Chatbot** no site para criar leads
- **Assistente** no CRM para executar ações
- **Comandos de voz** para gerar relatórios

### 4. Monitoramento
- **Alertas** quando métricas importantes mudam
- **Notificações** de novos leads/negócios
- **Relatórios** de atividade do sistema

---

## 🚀 Deploy

### 1. Deploy da Edge Function

```bash
cd supabase/functions/super-agent
chmod +x deploy.sh
./deploy.sh
```

### 2. Crie as tabelas no banco

```bash
# Copie de: supabase/create-agent-tables.sql
# Execute no Supabase SQL Editor
```

### 3. Teste

```bash
curl -X POST \
  https://nnhiyqtzzjfxnxgmufgo.supabase.co/functions/v1/super-agent \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"command": "Gere um relatório diário de leads"}'
```

---

## 📁 Arquivos Importantes

| Arquivo | Descrição |
|---------|-----------|
| `supabase/functions/super-agent/index.ts` | Edge Function principal |
| `supabase/functions/super-agent/types.ts` | Tipos TypeScript |
| `supabase/functions/super-agent/reportGenerator.ts` | Gera relatórios |
| `supabase/functions/super-agent/webhookHandler.ts` | Gerencia webhooks |
| `supabase/functions/super-agent/skills/reportSkills.ts` | Skills de relatórios |
| `supabase/create-agent-tables.sql` | SQL para criar tabelas |
| `SUPER_AGENTE.md` | Documentação principal |
| `SUPER_AGENTE_WEBHOOKS.md` | Esta documentação |

---

## 🔗 Links Úteis

- [Supabase REST API](https://supabase.com/docs/guides/api/rest)
- [Supabase Edge Functions](https://supabase.com/docs/guides/functions)
- [Webhooks do Slack](https://api.slack.com/messaging/webhooks)
- [Webhooks do Discord](https://support.discord.com/hc/en-us/articles/228383668-Intro-to-Webhooks)
- [Zapier Webhooks](https://zapier.com/apps/webhook/integrations)

---

## 🤝 Contribuição

Para adicionar novas integrações:

1. **Adicione um novo adaptador** em `webhookHandler.ts`
2. **Crie novas skills** em `skills/`
3. **Atualize a documentação**

---

## 📄 Licença

MIT License - Sinta-se à vontade para usar e modificar.
