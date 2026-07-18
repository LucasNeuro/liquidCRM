# 🤖 Super Agente - Assistente Conversacional do CRM

## 🎯 O que é o Super Agente?

O **Super Agente** é um assistente de IA conversacional que permite executar operações no CRM **via comandos em linguagem natural**. Ele tem:

- ✅ **Acesso total** a todos os dados do sistema
- ✅ **Skills de leitura** de todos os itens (leads, negócios, tentativas, etc.)
- ✅ **Capacidade de CRUD** em toda a plataforma
- ✅ **Interface conversacional** (como um assistente que entende e executa comandos)

## 🏗️ Arquitetura

```
supabase/functions/
├── super-agent/
│   ├── index.ts          # Edge Function principal
│   ├── deno.json         # Configuração do Deno
│   ├── deploy.sh         # Script de deploy
│   ├── types.ts          # Tipos TypeScript
│   ├── skills/
│   │   ├── leadSkills.ts # Operações com leads
│   │   ├── negocioSkills.ts # Operações com negócios
│   │   └── userSkills.ts # Operações com usuários
│   └── prompts/
│       └── system.md     # Instruções do sistema
```

## 🚀 Como Usar

### 1. Deploy da Edge Function

```bash
cd supabase/functions/super-agent
chmod +x deploy.sh
./deploy.sh
```

Ou manualmente:
```bash
cd supabase/functions/super-agent
npx supabase functions deploy super-agent
```

### 2. Chamar o Super Agente via API

**Endpoint:** `POST https://<seu-projeto>.supabase.co/functions/v1/super-agent`

**Headers:**
```
Authorization: Bearer <seu-token>
Content-Type: application/json
```

**Body:**
```json
{
  "command": "Crie um lead para João Silva com email joao@teste.com"
}
```

**Resposta:**
```json
{
  "thought": "Vou criar um lead para \"João Silva\"",
  "action": {
    "type": "create_lead",
    "data": {
      "nome": "João Silva",
      "email": "joao@teste.com"
    }
  },
  "response": "Lead \"João Silva\" criado com sucesso!",
  "result": {
    "success": true,
    "message": "Lead \"João Silva\" criado com sucesso!",
    "data": { ... }
  }
}
```

## 📋 Comandos Suportados

### 🔹 Leads

| Comando | Exemplo | Ação |
|---------|---------|------|
| Criar lead | `"Crie um lead para João com email joao@teste.com"` | `create_lead` |
| Criar lead com telefone | `"Crie um lead para Maria com email maria@teste.com e telefone 11999999999"` | `create_lead` |
| Atualizar lead | `"Atualize o lead 123 com status qualificado"` | `update_lead` |
| Buscar leads | `"Mostre todos os leads qualificados"` | `search_leads` |

### 🔹 Negócios

| Comando | Exemplo | Ação |
|---------|---------|------|
| Criar negócio | `"Crie um negócio Venda para João para o lead 123"` | `create_negocio` |
| Criar negócio com valor | `"Crie um negócio Venda para João para o lead 123 com valor 10000"` | `create_negocio` |
| Atualizar negócio | `"Atualize o negócio abc-123 com status ganho"` | `update_negocio` |

### 🔹 Usuários

| Comando | Exemplo | Ação |
|---------|---------|------|
| Criar usuário | `"Crie um usuário para maria@empresa.com com nome Maria Silva e role consultor"` | `create_user` |
| Atualizar usuário | `"Atualize o usuário xyz-123 com role owner"` | `update_user` |

### 🔹 Outras Ações

| Comando | Exemplo | Ação |
|---------|---------|------|
| Estatísticas | `"Mostre as estatísticas do sistema"` | `get_stats` |
| Query personalizada | `"Execute: SELECT * FROM leads WHERE status = 'qualificado'"` | `custom_query` |

## 🔧 Configuração

### Variáveis de Ambiente

A Edge Function usa as variáveis padrão do Supabase:
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (para operações admin)

### Permissões

O Super Agente **requer autenticação**. Somente usuários autenticados podem usar o agente.

- **Owners**: Podem executar todas as ações
- **Consultores**: Podem executar ações em seus próprios dados (com restrições)

## 📝 Exemplos de Uso

### Exemplo 1: Criar um Lead

**Request:**
```bash
curl -X POST \
  https://<seu-projeto>.supabase.co/functions/v1/super-agent \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"command": "Crie um lead para João Silva com email joao@teste.com e telefone 11999999999"}'
```

**Response:**
```json
{
  "thought": "Vou criar um lead para \"João Silva\"",
  "action": {
    "type": "create_lead",
    "data": {
      "nome": "João Silva",
      "email": "joao@teste.com",
      "telefone": "11999999999"
    }
  },
  "response": "Lead \"João Silva\" criado com sucesso!",
  "result": {
    "success": true,
    "message": "Lead \"João Silva\" criado com sucesso!",
    "data": {
      "id_lead": 123,
      "nome": "João Silva",
      "email": "joao@teste.com",
      "telefone": "11999999999",
      "created_at": "2026-07-18T10:00:00.000Z"
    }
  }
}
```

### Exemplo 2: Buscar Leads

**Request:**
```bash
curl -X POST \
  https://<seu-projeto>.supabase.co/functions/v1/super-agent \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"command": "Mostre todos os leads qualificados"}'
```

**Response:**
```json
{
  "thought": "Vou buscar os leads com status \"qualificado\"",
  "action": {
    "type": "search_leads",
    "data": {
      "status": "qualificado",
      "limit": 50
    }
  },
  "response": "Encontrados 15 leads",
  "result": {
    "success": true,
    "message": "Encontrados 15 leads",
    "data": [
      {"id_lead": 1, "nome": "João", "email": "joao@teste.com", "status": "qualificado"},
      {"id_lead": 2, "nome": "Maria", "email": "maria@teste.com", "status": "qualificado"},
      ...
    ]
  }
}
```

### Exemplo 3: Estatísticas

**Request:**
```bash
curl -X POST \
  https://<seu-projeto>.supabase.co/functions/v1/super-agent \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"command": "Mostre as estatísticas do sistema"}'
```

**Response:**
```json
{
  "thought": "Vou gerar as estatísticas do sistema",
  "action": {"type": "get_stats"},
  "response": "Estatísticas do sistema",
  "result": {
    "success": true,
    "message": "Estatísticas do sistema",
    "data": {
      "leads": [
        {"status": "novo", "count": 10},
        {"status": "qualificado", "count": 15}
      ],
      "negocios": [
        {"status_negocio": "aberto", "count": 5},
        {"status_negocio": "ganho", "count": 3}
      ],
      "users": [
        {"role": "owner", "count": 1},
        {"role": "consultor", "count": 5}
      ]
    }
  }
}
```

## 🔮 Integração com IA (Futuro)

Atualmente, o Super Agente usa **regras simples** para interpretar comandos. No futuro, podemos integrar com:

- **Google Gemini** para interpretação mais inteligente
- **Mistral AI** para processamento em português
- **RAG (Retrieval-Augmented Generation)** para buscar informações no banco

Exemplo de integração com IA:

```typescript
// Futuro: Usar IA para interpretar comandos
async function extractActionWithAI(command: string): Promise<AgentAction> {
  const response = await fetch('https://api.gemini.google.com/v1/models/gemini-pro:generateContent', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{
        parts: [{
          text: `SYSTEM: ${SYSTEM_PROMPT}\nUSER: ${command}`
        }]
      }]
    })
  });
  
  const result = await response.json();
  return JSON.parse(result.candidates[0].content.parts[0].text);
}
```

## 📊 Skills Implementadas

### Lead Skills
- ✅ `create_lead` - Criar novo lead
- ✅ `update_lead` - Atualizar lead existente
- ✅ `delete_lead` - Deletar lead
- ✅ `search_leads` - Buscar leads

### Negócio Skills
- ✅ `create_negocio` - Criar novo negócio
- ✅ `update_negocio` - Atualizar negócio
- ✅ `search_negocios` - Buscar negócios
- ✅ `get_negocios_stats` - Estatísticas de negócios

### User Skills
- ✅ `create_user` - Criar novo usuário
- ✅ `update_user` - Atualizar usuário
- ✅ `list_users` - Listar usuários

### Outras Skills
- ✅ `get_stats` - Estatísticas do sistema
- ✅ `custom_query` - Query personalizada (com validação de segurança)

## 🔒 Segurança

### Validações
- **Autenticação obrigatória**: Somente usuários autenticados podem usar o agente
- **Validação de permissões**: Owners têm acesso total, consultores têm restrições
- **Validação de queries**: Queries personalizadas são validadas para evitar operações perigosas
- **Sanitização de dados**: Todos os inputs são sanitizados

### Restrições
- **Consultores não podem**:
  - Atualizar outros usuários
  - Listar todos os usuários
  - Executar queries perigosas

## 📈 Roadmap

### Versão 1.0 (Atual)
- [x] Comandos básicos de CRUD
- [x] Interpretação por regras simples
- [x] Autenticação e permissões
- [x] Skills de leads, negócios e usuários

### Versão 2.0 (Futuro)
- [ ] Integração com Google Gemini para interpretação inteligente
- [ ] Suporte a mais entidades (tentativas, pesquisas, etc.)
- [ ] Memória de conversa (contextos)
- [ ] Sugestões automáticas
- [ ] Interface de chat em tempo real

### Versão 3.0 (Futuro)
- [ ] Integração com RAG para busca inteligente
- [ ] Análise preditiva
- [ ] Automação de workflows
- [ ] Integração com outros sistemas

## 🎓 Como Estender

### Adicionar Nova Skill

1. Crie um novo arquivo em `skills/`:
```typescript
// supabase/functions/super-agent/skills/tentativaSkills.ts
import type { AgentContext, AgentResult } from '../types.ts';

export async function createTentativa(data: any, context: AgentContext): Promise<AgentResult> {
  // Implementação
}
```

2. Adicione a ação ao tipo `AgentAction` em `types.ts`:
```typescript
export type AgentAction = 
  | ...
  | { type: 'create_tentativa', data: any };
```

3. Adicione o case no switch em `index.ts`:
```typescript
case 'create_tentativa':
  return tentativaSkills.createTentativa(action.data, context)
```

4. Adicione regras de extração em `extractActionFromCommand`:
```typescript
if (cmd.includes('criar tentativa') || cmd.includes('crie tentativa')) {
  return { action: { type: 'create_tentativa', data: {...} }, response: '...' }
}
```

## 📚 Documentação Adicional

- [Supabase Edge Functions](https://supabase.com/docs/guides/functions)
- [Deno Runtime](https://deno.land/)
- [TypeScript](https://www.typescriptlang.org/)

## 🤝 Contribuição

Para contribuir com o Super Agente:

1. Fork o repositório
2. Crie uma branch (`git checkout -b feature/nova-skill`)
3. Commit suas mudanças (`git commit -m 'Adiciona nova skill'`)
4. Push para a branch (`git push origin feature/nova-skill`)
5. Abra um Pull Request

## 📄 Licença

MIT License - Sinta-se à vontade para usar e modificar.
