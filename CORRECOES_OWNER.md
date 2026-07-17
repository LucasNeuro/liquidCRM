# Correções: Owner Sempre Ativo

## Problema Reportado
O usuário owner estava aparecendo como "pendente" na tabela de profiles e precisava de aprovação de acesso, mesmo sendo o administrador da plataforma.

## Causa Raiz
1. O campo `active` no banco de dados poderia ser `false` para owners
2. A lógica no frontend considerava `active === false` como inativo, mesmo para owners
3. Não havia proteção contra a desativação acidental do owner
4. A Edge Function permitia desativar owners

## Solução Completa

### 📄 Arquivos Modificados

#### 1. Banco de Dados (SQL)
**Novo arquivo:** `supabase/fix-owner-always-active.sql`
- Ativa todos os owners que estiverem inativos
- Adiciona CHECK constraint para prevenir que owner seja desativado
- Adiciona TRIGGER para garantir que owner sempre tenha `active = true`

#### 2. Frontend - Lógica de Perfis

**`src/lib/profiles.ts`**
- Modificado `normalizeProfile()` para garantir que owners sempre tenham `active: true`
```typescript
// Antes:
active: isProfileActive(row.active),

// Depois:
active: role === "owner" ? true : isProfileActive(row.active),
```

**`src/contexts/AuthContext.tsx`**
- Modificado `isOwnerRole()` para não verificar o campo `active`
- Modificado `isConsultorRole()` para garantir que owner nunca seja considerado consultor
```typescript
// isOwnerRole - antes:
if (profile.active === false) return false

// isOwnerRole - depois:
// Owner sempre é ativo, independentemente do campo active
return String(profile.role || '').trim().toLowerCase() === 'owner'

// isConsultorRole - adicionado:
if (String(profile.role || '').trim().toLowerCase() === 'owner') return false
```

**`src/components/ProtectedRoute.tsx`**
- Modificado `ProtectedRoute()` para não redirecionar owners para /pendente
- Modificado `PendingRoute()` para permitir owners mesmo com active=false
- Modificado `PublicOnlyRoute()` para não redirecionar owners para /pendente

#### 3. Frontend - Interface de Usuários

**`src/pages/PlatformPage.tsx`**
- Modificado status display para sempre mostrar owners como "Ativo"
- Removido botões "Ativar/Inativar" para owners
- Removido botão "Excluir" para owners
- Adicionado validação em `setProfileActive()` para não permitir desativar owners

**`src/components/platform/UserAccessSideOver.tsx`**
- Desabilitado toggle de ativação para owners
- Desabilitado botões "Ativar agora" e "Inativar agora" para owners

#### 4. Backend - Edge Function

**`supabase/functions/manage-users/index.ts`**
- Modificado `update` para não permitir desativar owners
- Modificado `delete` para não permitir deletar owners (hard ou soft delete)

### 🚀 Passos para Deploy

#### Passo 1: Execute o SQL no Supabase
```bash
# Copie o conteúdo de supabase/fix-owner-always-active.sql
# e execute no SQL Editor do Supabase
```

Ou execute diretamente:
```sql
-- Ativa todos os owners que estiverem inativos
UPDATE public.profiles SET active = true WHERE role = 'owner' AND active = false;

-- Adiciona CHECK constraint
ALTER TABLE public.profiles 
  ADD CONSTRAINT profiles_owner_always_active 
  CHECK (role <> 'owner' OR active = true);

-- Adiciona TRIGGER
CREATE OR REPLACE FUNCTION public.prevent_owner_inactivation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NEW.role = 'owner' THEN
    NEW.active = true;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS prevent_owner_inactivation_trigger ON public.profiles;
CREATE TRIGGER prevent_owner_inactivation_trigger
  BEFORE UPDATE OR INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_owner_inactivation();
```

#### Passo 2: Redeploy da Edge Function
```bash
cd /workspace/LucasNeuro__liquidCRM
cd supabase/functions/manage-users
npm install
npm run deploy
```

#### Passo 3: Redeploy do Frontend
```bash
npm run build
# E faça o deploy no Render/Vercel/Netlify
```

### ✅ Verificação

1. **Verifique no banco:**
```sql
SELECT id, email, role, active FROM public.profiles WHERE role = 'owner';
```
Todos os owners devem ter `active = true`

2. **Teste o login como owner:**
   - Deve ter acesso imediato à plataforma
   - Não deve ser redirecionado para /pendente

3. **Teste criar um novo owner:**
   - Deve estar ativo automaticamente

4. **Tente desativar um owner pela interface:**
   - Os botões devem estar desabilitados
   - Deve mostrar erro se tentar via API

5. **Tente excluir um owner:**
   - O botão deve estar oculto
   - Deve mostrar erro se tentar via API

### 📝 Arquivos Criados/Modificados

**Novos arquivos:**
- `supabase/fix-owner-always-active.sql` - Script SQL de correção
- `DEPLOY_FIX_OWNER.md` - Documentação do deploy
- `CORRECOES_OWNER.md` - Este arquivo

**Arquivos modificados:**
- `src/lib/profiles.ts` - Normalização de perfis
- `src/contexts/AuthContext.tsx` - Verificação de roles
- `src/components/ProtectedRoute.tsx` - Roteamento protegido
- `src/pages/PlatformPage.tsx` - Interface de gerenciamento de usuários
- `src/components/platform/UserAccessSideOver.tsx` - Sideover de acesso de usuário
- `supabase/functions/manage-users/index.ts` - Edge function de gerenciamento

### 🔒 Segurança

As correções garantem que:
1. Owners **nunca** podem ser desativados
2. Owners **nunca** podem ser deletados
3. Owners **sempre** têm acesso à plataforma
4. A interface **não permite** ações que desativem owners
5. A API **rejeita** tentativas de desativar owners

### 📊 Impacto

- **Owners existentes:** Serão automaticamente ativados no banco
- **Novos owners:** Serão sempre criados como ativos
- **Consultores:** Não são afetados, continuam com a lógica normal de aprovação
