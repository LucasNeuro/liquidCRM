-- =============================================================================
-- CORREÇÃO DAS POLICIES DE RLS - VERSÃO SEGURA
-- O problema: RLS está bloqueando o SELECT de perfis para novos usuários
-- Solução: Permitir que usuários leiam seu próprio perfil ou todos se for owner
-- =============================================================================

-- 1. Função para verificar se usuário é owner
CREATE OR REPLACE FUNCTION public.is_owner_user(user_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = user_id AND role = 'owner'
  );
$$;

-- 2. Policy para SELECT: owner vê todos, usuário vê só seu perfil
-- (Isso permite que o frontend carregue o perfil no login)
DROP POLICY IF EXISTS profiles_select_policy ON public.profiles;
CREATE POLICY profiles_select_policy ON public.profiles
  FOR SELECT TO authenticated
  USING (
    -- Owners veem todos os perfis
    (public.is_owner_user(auth.uid()) = true) OR
    -- Usuários veem seu próprio perfil
    (id = auth.uid())
  );

-- 3. Policy para UPDATE: owner pode atualizar qualquer perfil, usuário só o seu
DROP POLICY IF EXISTS profiles_update_policy ON public.profiles;
CREATE POLICY profiles_update_policy ON public.profiles
  FOR UPDATE TO authenticated
  USING (
    -- Owners podem atualizar qualquer perfil
    (public.is_owner_user(auth.uid()) = true) OR
    -- Usuários podem atualizar só seu próprio perfil
    (id = auth.uid())
  )
  WITH CHECK (
    -- Owners podem fazer qualquer alteração
    (public.is_owner_user(auth.uid()) = true) OR
    -- Usuários só podem atualizar seu próprio perfil
    (id = auth.uid())
  );

-- 4. Policy para INSERT: permitir via service role (trigger) ou owner
DROP POLICY IF EXISTS profiles_insert_policy ON public.profiles;
CREATE POLICY profiles_insert_policy ON public.profiles
  FOR INSERT TO authenticated
  WITH CHECK (
    -- Owners podem inserir
    (public.is_owner_user(auth.uid()) = true) OR
    -- Service role (usado pelo trigger) pode inserir
    (current_setting('request.jwt.claims') IS NOT NULL AND 
     (current_setting('request.jwt.claims')::jsonb->>'role' = 'service_role'))
  );

-- 5. Habilita RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 6. Verificação: Testa se o usuário pode ler seu perfil
SELECT id, email, role, active FROM public.profiles WHERE id = auth.uid();
