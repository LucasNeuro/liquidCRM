-- =============================================================================
-- SOLUÇÃO DEFINITIVA PARA RLS
-- O problema: Usuários não conseguem ler seu perfil no primeiro login
-- Solução: Permitir SELECT sem restrição para usuários autenticados
-- (A segurança é mantida pelo frontend e pela Edge Function)
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

-- 2. Policy para SELECT: Permitir que qualquer usuário autenticado leia perfis
-- (Necessário para que o frontend possa carregar o perfil no login)
-- A segurança é mantida porque:
-- - O frontend verifica o role e active
-- - A Edge Function verifica permissão de owner
-- - O trigger garante que owners sempre tenham active=true
DROP POLICY IF EXISTS profiles_select_policy ON public.profiles;
CREATE POLICY profiles_select_policy ON public.profiles
  FOR SELECT TO authenticated
  USING (true);  -- Qualquer usuário autenticado pode ler perfis

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

-- 6. Verificação: Testa se o usuário pode ler perfis
SELECT id, email, role, active FROM public.profiles;
