-- =============================================================================
-- SOLUÇÃO DEFINITIVA COMPLETA: Owners SIEMPRE ativos com acesso total
-- Execute este SQL INTEIRO no Supabase SQL Editor
-- =============================================================================

-- =============================================================================
-- PARTE 1: CORRIGE OS DADOS EXISTENTES
-- =============================================================================

-- 1. Garante que todos os owners estejam ativos AGORA
UPDATE public.profiles 
SET active = true 
WHERE role = 'owner';

-- 2. Garante que todos os owners tenham menu_access COMPLETO com TODAS as chaves
-- (O frontend espera: dashboard, leads, tentativas, pesquisas, negocios, distribuicao, plataforma)
UPDATE public.profiles 
SET menu_access = '{
  "dashboard": true,
  "leads": true,
  "tentativas": true,
  "pesquisas": true,
  "negocios": true,
  "distribuicao": true,
  "plataforma": true
}'::jsonb
WHERE role = 'owner';

-- 3. CORREÇÃO ESPECÍFICA: Atualiza os usuários owners
UPDATE public.profiles 
SET 
  role = 'owner',
  active = true,
  menu_access = '{
    "dashboard": true,
    "leads": true,
    "tentativas": true,
    "pesquisas": true,
    "negocios": true,
    "distribuicao": true,
    "plataforma": true
  }'::jsonb
WHERE email IN ('neuroboost.ai2025@gmail.com', 'lucasoffgod@hotmail.com');

-- =============================================================================
-- PARTE 2: ADICIONA PROTEÇÕES NO BANCO
-- =============================================================================

-- 4. Adiciona CONSTRAINT para prevenir owners inativos
DO $$
BEGIN
  ALTER TABLE public.profiles 
    ADD CONSTRAINT profiles_owner_must_be_active 
    CHECK (role <> 'owner' OR active = true);
EXCEPTION WHEN duplicate_object THEN 
  RAISE NOTICE 'Constraint profiles_owner_must_be_active já existe';
END $$;

-- 5. Função para forçar owners a terem acesso total
CREATE OR REPLACE FUNCTION public.ensure_owner_full_access()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Se for owner, forçar active = true e menu_access completo
  IF NEW.role = 'owner' THEN
    NEW.active = true;
    NEW.menu_access = '{
      "dashboard": true,
      "leads": true,
      "tentativas": true,
      "pesquisas": true,
      "negocios": true,
      "distribuicao": true,
      "plataforma": true
    }'::jsonb;
  END IF;
  RETURN NEW;
END;
$$;

-- 6. TRIGGER para UPDATE
DROP TRIGGER IF EXISTS ensure_owner_access_update ON public.profiles;
CREATE TRIGGER ensure_owner_access_update
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.ensure_owner_full_access();

-- 7. TRIGGER para INSERT
DROP TRIGGER IF EXISTS ensure_owner_access_insert ON public.profiles;
CREATE TRIGGER ensure_owner_access_insert
  BEFORE INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.ensure_owner_full_access();

-- =============================================================================
-- PARTE 3: CORRIGE O TRIGGER DE CRIAÇÃO DE PERFIL
-- =============================================================================

-- 8. Corrige o trigger para usar TODAS as chaves que o frontend espera
CREATE OR REPLACE FUNCTION public.handle_new_user_profile()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Se já existir um perfil com este ID, não fazer nada (evita conflitos)
  IF EXISTS (SELECT 1 FROM public.profiles WHERE id = new.id) THEN
    RETURN new;
  END IF;
  
  -- Verificar se este usuário deve ser owner (primeiro usuário do sistema)
  DECLARE
    owner_count INTEGER;
    user_role TEXT;
    user_menu_access JSONB;
  BEGIN
    SELECT COUNT(*) INTO owner_count FROM public.profiles WHERE role = 'owner';
    
    -- Se não houver owners, este usuário será owner
    IF owner_count = 0 THEN
      user_role := 'owner';
      user_menu_access := '{
        "dashboard": true,
        "leads": true,
        "tentativas": true,
        "pesquisas": true,
        "negocios": true,
        "distribuicao": true,
        "plataforma": true
      }'::jsonb;
    ELSE
      user_role := 'consultor';
      user_menu_access := '{
        "dashboard": false,
        "leads": true,
        "tentativas": false,
        "pesquisas": false,
        "negocios": true,
        "distribuicao": false,
        "plataforma": false
      }'::jsonb;
    END IF;
    
    INSERT INTO public.profiles (id, email, full_name, role, active, menu_access)
    VALUES (
      new.id,
      coalesce(new.email, ''),
      coalesce(
        new.raw_user_meta_data->>'full_name',
        split_part(coalesce(new.email, 'usuario'), '@', 1)
      ),
      user_role,
      true,
      user_menu_access
    )
    ON CONFLICT (id) DO UPDATE SET
      email = excluded.email,
      full_name = coalesce(nullif(profiles.full_name, ''), excluded.full_name),
      role = excluded.role,
      active = excluded.active,
      menu_access = excluded.menu_access;
  END;
  
  RETURN new;
END;
$$;

-- 9. Atualiza o trigger
DROP TRIGGER IF EXISTS on_auth_user_created_profile ON auth.users;
CREATE TRIGGER on_auth_user_created_profile
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user_profile();

-- =============================================================================
-- PARTE 4: CORRIGE AS POLICIES DE RLS (ISSO É CRÍTICO!)
-- =============================================================================

-- 10. Função para verificar se usuário é owner
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

-- 11. Policy para SELECT: Permitir que qualquer usuário autenticado leia perfis
-- (Necessário para que o frontend possa carregar o perfil no login)
-- A segurança é mantida porque:
-- - O frontend verifica o role e active
-- - A Edge Function verifica permissão de owner
-- - O trigger garante que owners sempre tenham active=true
DROP POLICY IF EXISTS profiles_select_policy ON public.profiles;
CREATE POLICY profiles_select_policy ON public.profiles
  FOR SELECT TO authenticated
  USING (true);  -- Qualquer usuário autenticado pode ler perfis

-- 12. Policy para UPDATE: owner pode atualizar qualquer perfil, usuário só o seu
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

-- 13. Policy para INSERT: permitir via service role (trigger) ou owner
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

-- 14. Habilita RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- PARTE 5: VERIFICAÇÃO FINAL
-- =============================================================================

-- 15. Verificação: TODOS os owners
SELECT 
  id, 
  email, 
  role, 
  active,
  menu_access
FROM public.profiles 
WHERE role = 'owner'
ORDER BY email;

-- 16. Verificação: Testa se o usuário pode ler perfis (execute como lucasoffgod@hotmail.com)
-- SELECT id, email, role, active FROM public.profiles WHERE id = auth.uid();
