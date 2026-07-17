# Correção: Owner sempre ativo

## Problema
O owner estava aparecendo como "pendente" na tabela de profiles e precisava de aprovação de acesso, mesmo sendo o administrador da plataforma.

## Causa
1. O campo `active` no banco de dados poderia ser `false` para owners
2. A lógica no frontend considerava `active === false` como inativo, mesmo para owners
3. Não havia proteção contra a desativação acidental do owner

## Solução

### 1. Correções no Banco de Dados (SQL)
Rode o seguinte SQL no Supabase SQL Editor:

```sql
-- Ativa todos os owners que estiverem inativos
UPDATE public.profiles
SET active = true
WHERE role = 'owner' AND active = false;

-- Adiciona um CHECK para prevenir que owner seja desativado
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_owner_always_active
  CHECK (role <> 'owner' OR active = true);

-- Adiciona um TRIGGER para garantir que owner nunca seja desativado
CREATE OR REPLACE FUNCTION public.prevent_owner_inactivation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

Ou use o arquivo pronto: `supabase/fix-owner-always-active.sql`

### 2. Correções no Frontend

#### Arquivo: `src/lib/profiles.ts`
- Modificado `normalizeProfile` para garantir que owners sempre tenham `active: true`

#### Arquivo: `src/contexts/AuthContext.tsx`
- Modificado `isOwnerRole` para não verificar o campo `active` (owner sempre é ativo)
- Modificado `isConsultorRole` para garantir que owner nunca seja considerado consultor

### 3. Correções na Edge Function

#### Arquivo: `supabase/functions/manage-users/index.ts`
- Modificado `update` para não permitir desativar owners
- Modificado `delete` para não permitir deletar owners (hard ou soft delete)

## Deploy

### Passo 1: Execute o SQL no Supabase
```bash
# Copie o conteúdo de supabase/fix-owner-always-active.sql
# e execute no SQL Editor do Supabase
```

### Passo 2: Redeploy da Edge Function
```bash
# Na raiz do projeto
cd supabase/functions/manage-users
npm install
npm run deploy

# Ou use o script
npm run deploy-edge
```

### Passo 3: Redeploy do Frontend
```bash
npm run build
# E faça o deploy no Render/Vercel/Netlify
```

## Verificação

1. Verifique que todos os owners estão ativos:
```sql
SELECT id, email, role, active FROM public.profiles WHERE role = 'owner';
```

2. Teste o login como owner - deve ter acesso imediato à plataforma
3. Teste criar um novo owner - deve estar ativo automaticamente
4. Tente desativar um owner pela interface - deve falhar

## Arquivos Modificados
- `src/lib/profiles.ts` - Lógica de normalização de perfil
- `src/contexts/AuthContext.tsx` - Lógica de verificação de roles
- `supabase/functions/manage-users/index.ts` - Edge function de gerenciamento de usuários
- `supabase/fix-owner-always-active.sql` - Script SQL de correção (novo)
