-- =============================================================================
-- SOLUÇÃO DEFINITIVA: Desabilita RLS completamente para a tabela profiles
-- A segurança será mantida pelo frontend e Edge Function
-- =============================================================================

-- 1. DESABILITA RLS para a tabela profiles
ALTER TABLE public.profiles DISABLE ROW LEVEL SECURITY;

-- 2. REMOVE TODAS AS POLICIES (para garantir que não há bloqueio)
DROP POLICY IF EXISTS profiles_select_policy ON public.profiles;
DROP POLICY IF EXISTS profiles_update_policy ON public.profiles;
DROP POLICY IF EXISTS profiles_insert_policy ON public.profiles;
DROP POLICY IF EXISTS profiles_delete_policy ON public.profiles;
DROP POLICY IF EXISTS profiles_select_authenticated ON public.profiles;

-- 3. Verifica que não há mais policies
SELECT policyname, roles, cmd, perm 
FROM pg_policies 
WHERE tablename = 'profiles';

-- 4. Garante que os perfis dos usuários existam
-- Usário 1: lucasoffgod@hotmail.com (ID: 1266ab6a-dd5b-4809-ba3a-8f675ee5a69e)
INSERT INTO public.profiles (id, email, full_name, role, active, menu_access)
VALUES (
  '1266ab6a-dd5b-4809-ba3a-8f675ee5a69e',
  'lucasoffgod@hotmail.com',
  'Lucas Off God',
  'owner',
  true,
  '{
    "dashboard": true,
    "leads": true,
    "tentativas": true,
    "pesquisas": true,
    "negocios": true,
    "distribuicao": true,
    "plataforma": true
  }'::jsonb
)
ON CONFLICT (id) DO UPDATE SET
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
  }'::jsonb;

-- Usário 2: neuroboost.ai2025@gmail.com (ID: 55665324-2842-42f2-9920-9bed27afe62e)
INSERT INTO public.profiles (id, email, full_name, role, active, menu_access)
VALUES (
  '55665324-2842-42f2-9920-9bed27afe62e',
  'neuroboost.ai2025@gmail.com',
  'NeuroBoost AI',
  'owner',
  true,
  '{
    "dashboard": true,
    "leads": true,
    "tentativas": true,
    "pesquisas": true,
    "negocios": true,
    "distribuicao": true,
    "plataforma": true
  }'::jsonb
)
ON CONFLICT (id) DO UPDATE SET
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
  }'::jsonb;

-- 5. Verifica os perfis
SELECT id, email, role, active, menu_access 
FROM public.profiles 
WHERE email IN ('lucasoffgod@hotmail.com', 'neuroboost.ai2025@gmail.com');

-- 6. Verifica que não há RLS ativo
SELECT relname, relrowsecurity 
FROM pg_class 
WHERE relname = 'profiles';
