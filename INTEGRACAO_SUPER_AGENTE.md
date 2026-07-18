# 🤖 Integração do Super Agente na Interface do CRM

## 🎯 Objetivo

Integrar o **Super Agente** na interface do CRM, ao lado do assistente existente, com um **botão flutuante** que abre um chat para interação via comandos em linguagem natural.

---

## 📁 Arquivos Criados

| Arquivo | Descrição |
|---------|-----------|
| `src/components/SuperAgentChat.tsx` | Componente de chat com o Super Agente |
| `src/components/SuperAgentButton.tsx` | Botão flutuante para abrir o chat |
| `src/components/SuperAgentProvider.tsx` | Contexto para gerenciar estado do agente |
| `src/hooks/useSuperAgent.ts` | Hooks para interagir com o Super Agente |

---

## 🚀 Passos para Integração

### Passo 1: Adicione o Provider no App

No arquivo `src/App.tsx` ou `src/main.tsx`, envolva sua aplicação com o `SuperAgentProvider`:

```tsx
// src/main.tsx ou src/App.tsx
import { SuperAgentProvider } from './components/SuperAgentProvider'

function App() {
  return (
    <SuperAgentProvider>
      {/* Sua aplicação existente */}
      <AppShell />
    </SuperAgentProvider>
  )
}
```

---

### Passo 2: Adicione o Botão Flutuante

Há **3 opções** para adicionar o botão:

#### Opção A: Botão Simples (Recomendado)

```tsx
// No seu componente principal (ex: src/layouts/AppShell.tsx)
import { SuperAgentButton } from '../components/SuperAgentButton'

function AppShell() {
  return (
    <>
      {/* Seu layout existente */}
      
      {/* Adicione o botão flutuante */}
      <SuperAgentButton position="right" />
    </>
  )
}
```

#### Opção B: Botão com Badge de Notificações

```tsx
import { SuperAgentButtonWithBadge } from '../components/SuperAgentButton'

function AppShell() {
  return (
    <>
      {/* Seu layout existente */}
      
      {/* Botão com badge */}
      <SuperAgentButtonWithBadge position="right" />
    </>
  )
}
```

#### Opção C: Integração com Botão Existente

Se você já tem um botão de chat (como o assistente atual), pode adicionar o Super Agente ao lado:

```tsx
import { SuperAgentToggle } from '../components/SuperAgentButton'
import { useSuperAgent } from '../components/SuperAgentProvider'

function ChatButtons() {
  const { isSuperAgentOpen, toggleSuperAgent } = useSuperAgent()
  
  return (
    <>
      {/* Botão do assistente existente */}
      <button className="fixed bottom-6 right-6 ...">
        <MessageCircle />
      </button>
      
      {/* Botão do Super Agente (ao lado) */}
      <SuperAgentToggle 
        isOpen={isSuperAgentOpen} 
        onToggle={toggleSuperAgent}
        position="right"
      />
    </>
  )
}
```

---

## 🎨 Customização do Chat

### Personalizar Cores

No arquivo `SuperAgentChat.tsx`, você pode personalizar as cores:

```tsx
// No cabeçalho do chat
<div className="bg-liqui-navy rounded-t-2xl">  // Cor de fundo do cabeçalho

// Nas mensagens do usuário
<div className="bg-liqui-navy text-white">  // Mensagens do usuário

// Nas mensagens do agente
<div className="bg-white text-liqui-navy border border-zinc-200">  // Mensagens do agente
```

### Personalizar Posição

```tsx
// Ao usar o componente
<SuperAgentButton position="left" />  // ou "right"
<SuperAgentChat position="left" />    // ou "right"
```

### Personalizar Mensagens de Boas-Vindas

No arquivo `SuperAgentChat.tsx`, edite o array `welcomeMessages`:

```tsx
const welcomeMessages: Message[] = [
  {
    id: '1',
    text: 'Olá! Eu sou o **Super Agente**, seu assistente de CRM.',
    sender: 'agent',
    timestamp: new Date(),
  },
  {
    id: '2',
    text: 'Posso ajudar você com:',
    sender: 'agent',
    timestamp: new Date(),
  },
  // ... adicione mais mensagens
]
```

---

## 💡 Uso dos Hooks

### Hook Básico: useSuperAgent

```tsx
import { useSuperAgent } from '../hooks/useSuperAgent'

function MyComponent() {
  const { messages, isLoading, error, sendCommand, clearMessages, getSuggestions } = useSuperAgent()

  const handleSend = async () => {
    await sendCommand("Crie um lead para João com email joao@teste.com")
  }

  return (
    <div>
      <button onClick={handleSend}>Testar Super Agente</button>
      {isLoading && <p>Carregando...</p>}
      {error && <p className="text-red-500">{error}</p>}
      
      <div>
        {messages.map((msg) => (
          <div key={msg.timestamp.getTime()}>
            <strong>{msg.sender}:</strong> {msg.text}
          </div>
        ))}
      </div>
    </div>
  )
}
```

### Hook para Relatórios: useSuperAgentReports

```tsx
import { useSuperAgentReports } from '../hooks/useSuperAgent'

function ReportButton() {
  const { generateReport, isLoading, error } = useSuperAgentReports()

  const handleGenerateDailyReport = async () => {
    const result = await generateReport('leads_daily')
    console.log('Relatório gerado:', result)
  }

  return (
    <button onClick={handleGenerateDailyReport} disabled={isLoading}>
      {isLoading ? 'Gerando...' : 'Gerar Relatório Diário'}
    </button>
  )
}
```

### Hook para Webhooks: useSuperAgentWebhooks

```tsx
import { useSuperAgentWebhooks } from '../hooks/useSuperAgent'

function WebhookButton() {
  const { sendToWebhook, isLoading, error } = useSuperAgentWebhooks()

  const handleSendToSlack = async () => {
    const result = await sendToWebhook(
      'https://hooks.slack.com/services/YOUR/WEBHOOK',
      { message: 'Dados do CRM', type: 'report' }
    )
    console.log('Enviado para webhook:', result)
  }

  return (
    <button onClick={handleSendToSlack} disabled={isLoading}>
      Enviar para Slack
    </button>
  )
}
```

---

## 📋 Comandos Suportados

O Super Agente entende os seguintes comandos:

### Leads
- `"Crie um lead para [nome] com email [email]"`
- `"Crie um lead para [nome] com email [email] e telefone [telefone]"`
- `"Atualize o lead [id] com status [status]"`
- `"Busque leads com status [status]"`

### Negócios
- `"Crie um negócio [título] para o lead [id]"`
- `"Crie um negócio [título] para o lead [id] com valor [valor]"`
- `"Atualize o negócio [id] com status [status]"`

### Usuários
- `"Crie um usuário para [email] com nome [nome] e role [role]"`
- `"Atualize o usuário [id] com role [role]"`

### Relatórios
- `"Gere um relatório diário de leads"`
- `"Gere um relatório semanal de leads"`
- `"Gere um relatório de status de negócios"`
- `"Gere um relatório de atividade de usuários"`
- `"Gere um relatório com query: [sua query]"`

### Webhooks
- `"Enviar para webhook [url]"`
- `"Gere um relatório diário de leads e envie para [url]"`

### Estatísticas
- `"Mostre as estatísticas do sistema"`

---

## 🎯 Exemplo de Integração Completa

Aqui está um exemplo completo de como integrar o Super Agente em uma página:

```tsx
// src/pages/LeadsPage.tsx
import { useState } from 'react'
import { SuperAgentButton } from '../components/SuperAgentButton'
import { useSuperAgent } from '../hooks/useSuperAgent'

export function LeadsPage() {
  const { messages, sendCommand } = useSuperAgent()
  const [showChat, setShowChat] = useState(false)

  const handleQuickCommand = async (command: string) => {
    await sendCommand(command)
  }

  // Sugestões de comandos rápidos para leads
  const quickCommands = [
    'Crie um lead para Novo Cliente',
    'Atualize o lead 123 com status qualificado',
    'Busque leads com status novo',
    'Gere um relatório diário de leads',
  ]

  return (
    <div className="relative">
      {/* Conteúdo da página */}
      <div className="p-6">
        <h1>Leads</h1>
        {/* ... seu conteúdo existente ... */}
      </div>

      {/* Botão flutuante do Super Agente */}
      <SuperAgentButton position="right" />

      {/* Sugestões de comandos rápidos (opcional) */}
      {showChat && (
        <div className="fixed bottom-24 right-6 bg-white rounded-xl shadow-lg p-4 border border-zinc-200">
          <h3 className="text-sm font-semibold text-liqui-navy mb-2">Comandos Rápidos:</h3>
          <div className="space-y-2">
            {quickCommands.map((cmd) => (
              <button
                key={cmd}
                onClick={() => handleQuickCommand(cmd)}
                className="w-full text-left text-xs text-zinc-600 hover:bg-zinc-50 p-2 rounded-lg"
              >
                {cmd}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
```

---

## 🔧 Customização Avançada

### Adicionar Novos Comandos

Para adicionar novos comandos, edite o arquivo `SuperAgentChat.tsx` e adicione novas regras na função `extractActionFromCommand`:

```tsx
// Adicione novo caso no switch
if (cmd.includes('novo comando') || cmd.includes('fazer algo')) {
  return {
    action: {
      type: 'nova_acao',
      data: { /* dados extraídos */ },
    },
    response: 'Vou executar a nova ação',
  }
}
```

### Adicionar Novas Ações

No arquivo `index.ts` da Edge Function, adicione novo case no switch:

```typescript
case 'nova_acao': {
  const data = action.data as { /* tipo */ }
  // Implementação da ação
  return { success: true, message: 'Ação executada', data: result }
}
```

---

## 📊 Estilos e Aparência

### CSS Personalizado

Você pode adicionar estilos personalizados no seu arquivo CSS global:

```css
/* Estilos para o Super Agente */
.super-agent-chat {
  box-shadow: 0 10px 40px rgba(0,0,0,0.15) !important;
}

.super-agent-button {
  box-shadow: 0 4px 15px rgba(0,0,0,0.25) !important;
  transition: all 0.2s ease !important;
}

.super-agent-button:hover {
  transform: scale(1.05) !important;
}
```

### Tema Escuro

Para adaptar ao tema escuro, modifique as cores no `SuperAgentChat.tsx`:

```tsx
// No cabeçalho
<div className="bg-zinc-800 rounded-t-2xl">

// Nas mensagens do usuário
<div className="bg-liqui-orange text-white">

// Nas mensagens do agente
<div className="bg-zinc-700 text-white border border-zinc-600">
```

---

## 🚀 Deploy e Teste

### 1. Deploy da Edge Function

```bash
cd supabase/functions/super-agent
chmod +x deploy.sh
./deploy.sh
```

### 2. Teste o Chat

- Acesse sua aplicação
- Clique no botão flutuante do Super Agente
- Digite um comando (ex: "Crie um lead para Teste")
- Verifique se a ação é executada

### 3. Teste com Webhook

```bash
# Teste local com curl
curl -X POST \
  https://nnhiyqtzzjfxnxgmufgo.supabase.co/functions/v1/super-agent \
  -H "Authorization: Bearer <seu-token>" \
  -H "Content-Type: application/json" \
  -d '{"command": "Gere um relatório diário de leads"}'
```

---

## 🔍 Solução de Problemas

### Problema: Botão não aparece
**Solução:** Verifique se o `SuperAgentProvider` está envolto na sua aplicação.

### Problema: Chat não abre
**Solução:** Verifique se não há conflitos de z-index com outros elementos.

### Problema: Comandos não funcionam
**Solução:** 
1. Verifique se a Edge Function está deployada
2. Verifique se o token de autenticação é válido
3. Verifique o console do navegador para erros

### Problema: Mensagens não aparecem
**Solução:** Verifique se o estado `messages` está sendo atualizado corretamente.

---

## 📚 Arquivos de Referência

- [`SuperAgentChat.tsx`](src/components/SuperAgentChat.tsx) - Componente de chat
- [`SuperAgentButton.tsx`](src/components/SuperAgentButton.tsx) - Botão flutuante
- [`SuperAgentProvider.tsx`](src/components/SuperAgentProvider.tsx) - Contexto
- [`useSuperAgent.ts`](src/hooks/useSuperAgent.ts) - Hooks
- [`super-agent/index.ts`](supabase/functions/super-agent/index.ts) - Edge Function

---

## 🎯 Resumo

| Item | Status | Descrição |
|------|--------|-----------|
| ✅ Componente de Chat | Implementado | Interface conversacional |
| ✅ Botão Flutuante | Implementado | Acesso rápido ao agente |
| ✅ Provider | Implementado | Gerenciamento de estado |
| ✅ Hooks | Implementados | Integração fácil |
| ✅ Comandos | Implementados | Leads, Negócios, Usuários, Relatórios |
| ✅ Webhooks | Implementados | Integração com outras plataformas |

**O Super Agente está pronto para ser integrado na interface do seu CRM!** 🚀

---

## 💬 Exemplo de Conversa

**Usuário:** "Crie um lead para João Silva com email joao@teste.com"

**Super Agente:**
```
💭 Processamento: Vou criar um lead para "João Silva"

📋 Ação: `create_lead`
Dados: `{"nome": "João Silva", "email": "joao@teste.com"}`

📊 Resultado: ✅ Lead "João Silva" criado com sucesso!
`{
  "id_lead": 123,
  "nome": "João Silva",
  "email": "joao@teste.com",
  "created_at": "2026-07-18T10:00:00.000Z"
}`
```

**Usuário:** "Gere um relatório diário de leads"

**Super Agente:**
```
💭 Processamento: Vou gerar um relatório diário de leads

📋 Ação: `generate_report`
Dados: `{"type": "leads_daily"}`

📊 Resultado: ✅ Relatório diário de leads gerado com sucesso
`{
  "period": {"start": "2026-07-18", "end": "2026-07-18"},
  "total": 15,
  "by_status": [
    {"status": "novo", "count": 10},
    {"status": "qualificado", "count": 5}
  ]
}`
```
