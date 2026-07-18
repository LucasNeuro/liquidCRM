-- =============================================================================
-- SOLUÇÃO DEFINITIVA: Owners SIEMPRE ativos e com TODAS as chaves de menu
-- Execute este SQL INTEIRO no Supabase SQL Editor
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

-- 3. Adiciona CONSTRAINT para prevenir owners inativos
DO $$
BEGIN
  ALTER TABLE public.profiles 
    ADD CONSTRAINT profiles_owner_must_be_active 
    CHECK (role <> 'owner' OR active = true);
EXCEPTION WHEN duplicate_object THEN 
  RAISE NOTICE 'Constraint profiles_owner_must_be_active já existe';
END $$;

-- 4. Função para forçar owners a terem acesso total com TODAS as chaves
CREATE OR REPLACE FUNCTION public.ensure_owner_full_access()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Se for owner, forçar active = true e menu_access completo com TODAS as chaves
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

-- 5. TRIGGER para UPDATE
DROP TRIGGER IF EXISTS ensure_owner_access_update ON public.profiles;
CREATE TRIGGER ensure_owner_access_update
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.ensure_owner_full_access();

-- 6. TRIGGER para INSERT
DROP TRIGGER IF EXISTS ensure_owner_access_insert ON public.profiles;
CREATE TRIGGER ensure_owner_access_insert
  BEFORE INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.ensure_owner_full_access();

-- 7. Função para verificar se usuário é owner (para RLS)
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

-- 8. RLS: Garante que owners sempre possam ler e atualizar
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Policy para SELECT: owner vê tudo, consultor vê só seu perfil
DROP POLICY IF EXISTS profiles_select_policy ON public.profiles;
CREATE POLICY profiles_select_policy ON public.profiles
  FOR SELECT TO authenticated
  USING (
    -- Owners veem todos os perfis
    (public.is_owner_user(auth.uid()) = true) OR
    -- Consultores veem só seu próprio perfil
    (id = auth.uid())
  );

-- Policy para UPDATE: owner pode atualizar qualquer perfil, consultor só o seu
DROP POLICY IF EXISTS profiles_update_policy ON public.profiles;
CREATE POLICY profiles_update_policy ON public.profiles
  FOR UPDATE TO authenticated
  USING (
    -- Owners podem atualizar qualquer perfil
    (public.is_owner_user(auth.uid()) = true) OR
    -- Consultores podem atualizar só seu próprio perfil
    (id = auth.uid())
  )
  WITH CHECK (
    -- Owners podem fazer qualquer alteração
    (public.is_owner_user(auth.uid()) = true) OR
    -- Consultores só podem atualizar seu próprio perfil
    (id = auth.uid())
  );

-- 9. CORREÇÃO ESPECÍFICA: Atualiza os usuários owners
-- (Incluindo neuroboost.ai2025@gmail.com e lucasoffgod@hotmail.com)
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

-- 10. Verificação final - TODOS os owners
SELECT 
  id, 
  email, 
  role, 
  active,
  menu_access
FROM public.profiles 
WHERE role = 'owner'
ORDER BY email;
